const express    = require('express');
const Groq       = require('groq-sdk');
const multer     = require('multer');
const { Pool }   = require('pg');
const pdfParse   = require('pdf-parse');
const fs         = require('fs');
const { execSync } = require('child_process');

const app  = express();
const PORT = process.env.PORT || 8080;

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://postgres:dSKgiSWkgHDXHaxxULtGRgynxHDjfGtN@postgres.railway.internal:5432/railway',
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id          SERIAL PRIMARY KEY,
      filename    TEXT,
      plan_name   TEXT,
      chunk_index INTEGER DEFAULT 0,
      content     TEXT,
      tsv         TSVECTOR,
      created_at  TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS documents_tsv_idx ON documents USING GIN(tsv)
  `);
  console.log('✅ documents table ready');
}
initDB().catch(err => console.error('❌ DB init error:', err));

// ─── GROQ ─────────────────────────────────────────────────────────────────────
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json());

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Extract text using pdftotext -layout (preserves table columns).
// Falls back to pdf-parse if poppler isn't installed yet.
function extractPdfText(buffer) {
  const tmpFile = `/tmp/upload_${Date.now()}.pdf`;
  try {
    fs.writeFileSync(tmpFile, buffer);
    const text = execSync(`pdftotext -layout -nopgbrk "${tmpFile}" -`, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000
    }).toString('utf-8');
    return text;
  } catch (err) {
    console.warn('⚠️  pdftotext failed, falling back to pdf-parse:', err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

// Paragraph-aware chunking — keeps table rows and bullet points whole.
// Never cuts in the middle of a line.
function chunkByParagraph(text, maxSize = 700, overlap = 80) {
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  const paragraphs = normalized.split(/\n\n+/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;
    if (candidate.length <= maxSize) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current.trim());
        current = current.slice(-overlap) + '\n\n' + para;
      } else {
        // Single paragraph bigger than maxSize — hard split
        for (let i = 0; i < para.length; i += maxSize - overlap) {
          chunks.push(para.slice(i, i + maxSize).trim());
        }
        current = '';
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 20);
}

// Strip stop words for cleaner Postgres full-text search
function extractKeywords(message) {
  const stopWords = new Set([
    'what','is','are','the','a','an','in','on','for','to','of','do','does',
    'can','i','me','my','how','much','many','any','some','about','with','and',
    'or','not','have','has','tell','please','show','list','find','get','will',
    'this','that','these','those','which','who','where','when','plan','plans'
  ]);
  return message.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 6);
}

// Auto-retry once on Groq 429 using their retry-after header
async function groqWithRetry(params, retries = 1) {
  try {
    return await groq.chat.completions.create(params);
  } catch (err) {
    if (err.status === 429 && retries > 0) {
      const wait = parseInt(err.headers?.['retry-after'] || '30') * 1000;
      console.log(`⏳ Rate limited. Retrying in ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
      return groqWithRetry(params, retries - 1);
    }
    throw err;
  }
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const keywords = extractKeywords(message);
    console.log('🔍 Keywords:', keywords);

    if (keywords.length === 0) {
      return res.json({ reply: "Could you be more specific? Ask about a plan name, benefit, medication, or provider." });
    }

    // Detect if the question names a specific plan we have on file
    const allPlans = await pool.query(
      'SELECT DISTINCT plan_name FROM documents WHERE plan_name IS NOT NULL ORDER BY plan_name'
    );
    const planNames    = allPlans.rows.map(r => r.plan_name);
    const mentionedPlan = planNames.find(p =>
      message.toLowerCase().includes(p.toLowerCase())
    );

    if (mentionedPlan) console.log(`🎯 Question targets plan: ${mentionedPlan}`);

    // OR search — any keyword can match, ranked by relevance
    const tsQuery = keywords.join(' | ');
    let chunks = [];

    if (mentionedPlan) {
      // Only search chunks from that specific plan
      const result = await pool.query(
        `SELECT filename, plan_name, chunk_index, content,
                ts_rank(tsv, to_tsquery('english', $1)) AS rank
         FROM documents
         WHERE plan_name ILIKE $2
           AND tsv @@ to_tsquery('english', $1)
         ORDER BY rank DESC LIMIT 4`,
        [tsQuery, `%${mentionedPlan}%`]
      );
      chunks = result.rows;

      // Fallback: just return first chunks of that plan if keyword search found nothing
      if (chunks.length === 0) {
        const fallback = await pool.query(
          `SELECT filename, plan_name, chunk_index, content
           FROM documents WHERE plan_name ILIKE $1
           ORDER BY chunk_index LIMIT 4`,
          [`%${mentionedPlan}%`]
        );
        chunks = fallback.rows;
      }
    } else {
      // No specific plan mentioned — search across all plans (good for comparisons)
      const result = await pool.query(
        `SELECT filename, plan_name, chunk_index, content,
                ts_rank(tsv, to_tsquery('english', $1)) AS rank
         FROM documents
         WHERE tsv @@ to_tsquery('english', $1)
         ORDER BY rank DESC LIMIT 4`,
        [tsQuery]
      );
      chunks = result.rows;
    }

    // Absolute last resort
    if (chunks.length === 0) {
      const fallback = await pool.query('SELECT filename, plan_name, chunk_index, content FROM documents LIMIT 4');
      chunks = fallback.rows;
    }

    if (chunks.length === 0) {
      return res.json({ reply: "No documents uploaded yet. Upload a plan PDF to get started." });
    }

    // Cap each chunk at 500 chars → ~2000 chars total context (~500 tokens)
    const context = chunks
      .map(c => `[Plan: ${c.plan_name || c.filename} | Part ${c.chunk_index + 1}]\n${c.content.substring(0, 500)}`)
      .join('\n\n---\n\n');

    console.log(`📄 Sending ${chunks.length} chunks, ${context.length} chars to Groq`);

    const planList = planNames.length > 0
      ? `Plans currently on file: ${planNames.join(', ')}.`
      : 'No plans tagged yet.';

    const completion = await groqWithRetry({
      messages: [
        {
          role: 'system',
          content: `You are a Medicare plan assistant helping insurance agents compare plans and look up benefits.
${planList}
Answer ONLY using the document excerpts below. Always state which plan the information is from.
If comparing plans, clearly separate each plan with its name as a header.
If the answer is not in the excerpts, say "I don't have that information in the uploaded documents."
Be concise. Use bullet points for benefits or lists.

DOCUMENT EXCERPTS:
${context}`
        },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens: 512,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    if (err.status === 429) {
      return res.status(429).json({ error: '⏳ AI is rate-limited. Wait 30 seconds and try again.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const planName = (req.body.plan_name || '').trim()
      || req.file.originalname.replace(/\.[^.]+$/, '');
    const filename = req.file.originalname;
    const ext      = filename.split('.').pop().toLowerCase();
    let rawText    = '';

    if (ext === 'txt') {
      rawText = req.file.buffer.toString('utf-8')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    } else if (ext === 'pdf') {
      // Try pdftotext first — much better for tables and columns
      rawText = extractPdfText(req.file.buffer);
      if (!rawText) {
        // Fallback to pdf-parse
        const pdfData = await pdfParse(req.file.buffer);
        rawText = pdfData.text;
      }
    } else {
      return res.status(400).json({ error: 'Only .txt or .pdf files supported.' });
    }

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'File has no readable text. It may be a scanned image PDF.' });
    }

    // Remove old chunks for this plan+file before re-uploading
    await pool.query('DELETE FROM documents WHERE filename = $1 AND plan_name = $2', [filename, planName]);

    // Paragraph-aware chunking keeps table rows and lists intact
    const chunks = chunkByParagraph(rawText, 700, 80);
    console.log(`📦 "${planName}" (${filename}): ${rawText.length} chars → ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      await pool.query(
        `INSERT INTO documents (filename, plan_name, chunk_index, content, tsv)
         VALUES ($1, $2, $3, $4, to_tsvector('english', $4))`,
        [filename, planName, i, chunks[i]]
      );
    }

    res.json({
      success: true,
      message: `Uploaded "${planName}" — ${chunks.length} chunks stored (${rawText.length} chars total)`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────
app.get('/admin', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT plan_name, filename, COUNT(*) as chunks,
             MIN(created_at) as created_at,
             LEFT(MIN(content), 150) as preview
      FROM documents
      GROUP BY plan_name, filename
      ORDER BY plan_name, filename
    `);

    const escape = s => (s || '').replace(/[&<>]/g,
      m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));

    const rowsHtml = result.rows.map(row => `
      <tr>
        <td><strong>${escape(row.plan_name)}</strong></td>
        <td>${escape(row.filename)}</td>
        <td>${row.chunks} chunks</td>
        <td style="font-size:12px;color:#555">${escape(row.preview)}…</td>
        <td>${new Date(row.created_at).toLocaleString()}</td>
        <td>
          <button onclick="deletePlan('${escape(row.plan_name)}','${escape(row.filename)}')">Delete</button>
        </td>
      </tr>`).join('');

    res.send(`<!DOCTYPE html>
<html>
<head><title>Admin – Medicare Plans</title>
<style>
body{font-family:Arial;max-width:1050px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}
th{background:#003087;color:white}
button{background:#dc3545;color:white;border:none;padding:4px 10px;cursor:pointer;border-radius:4px}
.del-all{padding:10px 16px;margin-bottom:12px;background:#dc3545;color:white;border:none;cursor:pointer;border-radius:4px;font-size:14px}
.upload-box{background:#f0f4ff;border:1px solid #c8d8ff;padding:16px 20px;margin-bottom:20px;border-radius:8px}
input[type=text],input[type=file]{width:100%;padding:8px;margin:5px 0 12px;box-sizing:border-box;border:1px solid #ccc;border-radius:4px}
label{font-size:13px;font-weight:bold;color:#333}
.ok{color:green;font-weight:bold}.err{color:red}
.upload-btn{padding:9px 18px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px}
</style></head>
<body>
<h1>⚙️ Medicare Plans — Admin</h1>

<div class="upload-box">
  <h3 style="margin-top:0">📤 Upload Plan Document</h3>
  <label>Plan Name (be specific — agents will ask by this exact name)</label>
  <input type="text" id="planName" placeholder='e.g. "Humana Gold Plus HMO 2025" or "Molina Medicare Complete Care"'>
  <label>Document (PDF or TXT)</label>
  <input type="file" id="fileInput" accept=".pdf,.txt">
  <button class="upload-btn" onclick="uploadDoc()">Upload</button>
  <div id="uploadStatus" style="margin-top:10px;font-size:13px"></div>
</div>

<button class="del-all" onclick="deleteAll()">⚠️ Delete ALL Documents</button>

<h3>📋 Uploaded Plans</h3>
<table>
  <tr><th>Plan Name</th><th>File</th><th>Chunks</th><th>Preview</th><th>Uploaded</th><th>Action</th></tr>
  ${rowsHtml || '<tr><td colspan="6">No documents yet. Upload a plan PDF above.</td></tr>'}
</table>

<script>
async function uploadDoc() {
  const planName = document.getElementById('planName').value.trim();
  const file     = document.getElementById('fileInput').files[0];
  const status   = document.getElementById('uploadStatus');
  if (!planName) { status.innerHTML = '<span class="err">⚠️ Enter a plan name first</span>'; return; }
  if (!file)     { status.innerHTML = '<span class="err">⚠️ Select a file</span>'; return; }
  const fd = new FormData();
  fd.append('document', file);
  fd.append('plan_name', planName);
  status.innerHTML = '⏳ Uploading & chunking document...';
  const res  = await fetch('/api/upload-document', { method:'POST', body:fd });
  const data = await res.json();
  status.innerHTML = res.ok
    ? '<span class="ok">✅ ' + data.message + '</span>'
    : '<span class="err">❌ ' + data.error + '</span>';
  if (res.ok) setTimeout(() => location.reload(), 1500);
}
async function deletePlan(planName, filename) {
  if (!confirm('Delete ' + planName + '?')) return;
  await fetch('/api/admin/delete-plan', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ plan_name: planName, filename })
  });
  location.reload();
}
async function deleteAll() {
  if (!confirm('Delete ALL plans and documents? This cannot be undone.')) return;
  await fetch('/api/admin/delete-all', { method:'DELETE' });
  location.reload();
}
</script>
</body></html>`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

app.post('/api/admin/delete-plan', async (req, res) => {
  const { plan_name, filename } = req.body;
  if (!plan_name) return res.status(400).json({ error: 'plan_name required' });
  await pool.query('DELETE FROM documents WHERE plan_name = $1 AND filename = $2', [plan_name, filename]);
  res.json({ success: true });
});

app.delete('/api/admin/delete-all', async (req, res) => {
  await pool.query('DELETE FROM documents');
  res.json({ success: true });
});

// ─── DEBUG ────────────────────────────────────────────────────────────────────
app.get('/api/debug', async (req, res) => {
  const count = await pool.query('SELECT COUNT(*) FROM documents');
  const plans = await pool.query(
    'SELECT plan_name, COUNT(*) as chunks FROM documents GROUP BY plan_name ORDER BY plan_name'
  );
  res.json({ total_chunks: parseInt(count.rows[0].count), plans: plans.rows });
});

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>Medicare Assistant</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:20px;background:#fff}
h2{color:#003087;margin-bottom:4px}
.subtitle{color:#666;font-size:13px;margin-bottom:16px}
#chat{border:1px solid #dde;height:440px;overflow-y:auto;padding:14px;margin-bottom:10px;background:#f8f9fc;border-radius:10px}
.user{background:#003087;color:white;padding:10px 14px;margin:6px 0 6px auto;border-radius:14px 14px 3px 14px;max-width:82%;width:fit-content}
.ai{background:#fff;border:1px solid #e2e8f0;padding:10px 14px;margin:6px 0;border-radius:3px 14px 14px 14px;white-space:pre-wrap;max-width:92%;font-size:14px;line-height:1.6;color:#1a202c}
.thinking{color:#aaa;font-style:italic;background:transparent;border:none;padding:6px 0}
#inputRow{display:flex;gap:8px;margin-bottom:20px}
#question{flex:1;padding:11px 14px;border:1px solid #ccc;border-radius:8px;font-size:14px;outline:none}
#question:focus{border-color:#003087}
.send-btn{padding:11px 22px;background:#003087;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:bold}
.send-btn:hover{background:#004db3}
hr{border:none;border-top:1px solid #eee;margin:4px 0 20px}
.upload-box{background:#f0f4ff;padding:16px 18px;border-radius:8px;border:1px solid #c8d8ff;margin-bottom:14px}
.upload-box strong{color:#003087}
.upload-box input[type=text]{width:100%;padding:8px 10px;margin:8px 0 10px;border:1px solid #ccc;border-radius:4px;font-size:13px}
.upload-row{display:flex;gap:10px;align-items:center}
#fileInput{flex:1;font-size:13px}
.upload-btn{padding:8px 16px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;white-space:nowrap}
#status{margin-top:8px;font-size:13px}
.links{font-size:12px;color:#888}
.links a{color:#003087;text-decoration:none}
.links a:hover{text-decoration:underline}
</style>
</head>
<body>
<h2>🏥 Medicare Plan Assistant</h2>
<p class="subtitle">Ask anything about uploaded Medicare plans — benefits, drugs, providers, copays, and more.</p>

<div id="chat">
  <div class="ai">👋 Hi! I can answer questions about any Medicare plan on file. Try asking:

• "What is the deductible for [plan name]?"
• "Does Humana cover dental?"
• "Compare OTC benefits across all plans"
• "What drugs are covered for diabetes?"
• "Which plan has the lowest specialist copay?"</div>
</div>

<div id="inputRow">
  <input type="text" id="question" placeholder="Ask about a plan, benefit, drug, or provider..." onkeydown="if(event.key==='Enter')ask()">
  <button class="send-btn" onclick="ask()">Send</button>
</div>

<hr>

<div class="upload-box">
  <strong>📤 Upload Plan Document</strong>
  <input type="text" id="planName" placeholder='Plan name — e.g. "Humana Gold Plus HMO 2025"'>
  <div class="upload-row">
    <input type="file" id="fileInput" accept=".txt,.pdf">
    <button class="upload-btn" onclick="uploadDoc()">Upload</button>
  </div>
  <div id="status"></div>
</div>

<div class="links">
  <a href="/admin">⚙️ Admin — manage plans</a> &nbsp;|&nbsp; <a href="/api/debug">🔍 Debug info</a>
</div>

<script>
async function ask() {
  const q = document.getElementById('question').value.trim();
  if (!q) return;
  addMsg(q, 'user');
  document.getElementById('question').value = '';
  const thinking = addMsg('Thinking…', 'ai thinking');
  try {
    const res  = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message: q })
    });
    const data = await res.json();
    thinking.remove();
    addMsg(data.reply || data.error, 'ai');
  } catch(e) {
    thinking.remove();
    addMsg('Error: ' + e.message, 'ai');
  }
}
function addMsg(text, cls) {
  const chat = document.getElementById('chat');
  const div  = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}
async function uploadDoc() {
  const planName = document.getElementById('planName').value.trim();
  const file     = document.getElementById('fileInput').files[0];
  const status   = document.getElementById('status');
  if (!planName) { status.textContent='⚠️ Enter a plan name first'; status.style.color='orange'; return; }
  if (!file)     { status.textContent='⚠️ Select a file'; status.style.color='orange'; return; }
  const fd = new FormData();
  fd.append('document', file);
  fd.append('plan_name', planName);
  status.textContent='⏳ Uploading...';
  status.style.color='#555';
  const res  = await fetch('/api/upload-document', { method:'POST', body:fd });
  const data = await res.json();
  status.textContent = res.ok ? '✅ ' + data.message : '❌ ' + data.error;
  status.style.color = res.ok ? 'green' : 'red';
}
</script>
</body>
</html>`);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
