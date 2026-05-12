const express = require('express');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 8080;

// ─── DB ───────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://postgres:dSKgiSWkgHDXHaxxULtGRgynxHDjfGtN@postgres.railway.internal:5432/railway',
  ssl: { rejectUnauthorized: false }
});

// Schema: one row per CHUNK, not one row per document
pool.query(`
  CREATE TABLE IF NOT EXISTS documents (
    id          SERIAL PRIMARY KEY,
    filename    TEXT,
    chunk_index INTEGER DEFAULT 0,
    content     TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log('✅ documents table ready'))
  .catch(err => console.error('❌ Table creation error:', err));

// ─── GROQ ─────────────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json());

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks of ~600 chars.
 * Overlap keeps context from being cut off at boundaries.
 */
function chunkText(text, size = 600, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

/**
 * Extract the 3–5 most meaningful words from a question to use as search terms.
 * Strips common stop words so ILIKE hits relevant content.
 */
function extractKeywords(message) {
  const stopWords = new Set([
    'what','is','are','the','a','an','in','on','for','to','of','do','does',
    'can','i','me','my','how','much','many','any','some','about','with','and',
    'or','not','have','has','tell','please','show','list','find','get'
  ]);
  return message.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 5);
}

/**
 * Groq call with one automatic retry on rate-limit (429).
 */
async function groqWithRetry(params, retries = 1) {
  try {
    return await groq.chat.completions.create(params);
  } catch (err) {
    if (err.status === 429 && retries > 0) {
      const wait = (err.headers?.['retry-after'] || 30) * 1000;
      console.log(`⏳ Rate limited. Waiting ${wait / 1000}s before retry...`);
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
    await pool.query('SELECT NOW()'); // connection check

    const keywords = extractKeywords(message);
    console.log('🔍 Keywords:', keywords);

    let chunks = [];

    // Try each keyword until we find relevant chunks
    for (const kw of keywords) {
      if (chunks.length >= 3) break;
      const result = await pool.query(
        `SELECT filename, chunk_index, content
         FROM documents
         WHERE content ILIKE $1
         ORDER BY chunk_index
         LIMIT 3`,
        [`%${kw}%`]
      );
      // Merge, avoiding duplicates
      for (const row of result.rows) {
        const isDupe = chunks.some(c => c.filename === row.filename && c.chunk_index === row.chunk_index);
        if (!isDupe) chunks.push(row);
        if (chunks.length >= 3) break;
      }
    }

    // Fallback: return top 3 chunks from any document
    if (chunks.length === 0) {
      const fallback = await pool.query(
        `SELECT filename, chunk_index, content FROM documents LIMIT 3`
      );
      chunks = fallback.rows;
    }

    if (chunks.length === 0) {
      return res.json({
        reply: "No documents have been uploaded yet. Please upload a PDF or TXT file first."
      });
    }

    // ⚠️ Cap each chunk at 500 chars → max ~1500 chars context total (~375 tokens)
    const context = chunks
      .map(c => `[${c.filename} – part ${c.chunk_index + 1}]:\n${c.content.substring(0, 500)}`)
      .join('\n\n');

    console.log(`📄 Context: ${context.length} chars across ${chunks.length} chunks`);

    const completion = await groqWithRetry({
      messages: [
        {
          role: 'system',
          content: `You are a Medicare plan assistant. Answer using ONLY the document excerpts below.
If the answer is not in the excerpts, say "I don't have that information in the uploaded documents."
Be concise. Use bullet points when listing items.

Documents:
${context}`
        },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      max_tokens: 512,  // Keep response short to save TPM
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    if (err.status === 429) {
      return res.status(429).json({
        error: 'The AI is temporarily rate-limited. Please wait 30 seconds and try again.'
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filename = req.file.originalname;
    const ext = filename.split('.').pop().toLowerCase();
    let rawText = '';

    if (ext === 'txt') {
      rawText = req.file.buffer.toString('utf-8')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else if (ext === 'pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      rawText = pdfData.text;
    } else {
      return res.status(400).json({ error: 'Only .txt or .pdf files are supported.' });
    }

    if (!rawText.trim()) return res.status(400).json({ error: 'File contains no readable text.' });

    // Delete old chunks for this filename before re-uploading
    await pool.query('DELETE FROM documents WHERE filename = $1', [filename]);

    // Split into chunks and store each one separately
    const chunks = chunkText(rawText, 600, 100);
    console.log(`📦 ${filename}: ${rawText.length} chars → ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      await pool.query(
        'INSERT INTO documents (filename, chunk_index, content) VALUES ($1, $2, $3)',
        [filename, i, chunks[i]]
      );
    }

    res.json({
      success: true,
      message: `Uploaded "${filename}" — ${chunks.length} chunks stored (${rawText.length} chars total)`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────
app.get('/admin', async (req, res) => {
  try {
    // Show one row per file (group by filename)
    const result = await pool.query(`
      SELECT filename, COUNT(*) as chunks, MIN(created_at) as created_at,
             LEFT(MIN(content), 120) as preview
      FROM documents
      GROUP BY filename
      ORDER BY created_at DESC
    `);

    const escape = s => (s || '').replace(/[&<>]/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));

    const rowsHtml = result.rows.map(row => `
      <tr>
        <td>${escape(row.filename)}</td>
        <td>${row.chunks} chunks</td>
        <td>${escape(row.preview)}…</td>
        <td>${new Date(row.created_at).toLocaleString()}</td>
        <td><button onclick="deleteDoc('${escape(row.filename)}')">Delete</button></td>
      </tr>
    `).join('');

    res.send(`<!DOCTYPE html>
<html>
<head><title>Admin – Documents</title>
<style>
body{font-family:Arial;max-width:960px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{border:1px solid #ccc;padding:8px;text-align:left}
th{background:#f2f2f2}
button{background:#dc3545;color:white;border:none;padding:4px 10px;cursor:pointer;border-radius:4px}
.del-all{padding:10px;margin-bottom:10px}
.ok{color:green}.err{color:red}
</style></head>
<body>
<h1>⚙️ Admin – Documents</h1>
<button class="del-all" onclick="deleteAll()">⚠️ Delete ALL Documents</button>
<table>
  <tr><th>Filename</th><th>Chunks</th><th>Preview</th><th>Uploaded</th><th>Action</th></tr>
  ${rowsHtml || '<tr><td colspan="5">No documents.</td></tr>'}
</table>
<script>
async function deleteDoc(filename) {
  if (!confirm('Delete ' + filename + '?')) return;
  await fetch('/api/admin/delete-file', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({filename})
  });
  location.reload();
}
async function deleteAll() {
  if (!confirm('Delete ALL documents?')) return;
  await fetch('/api/admin/delete-all', {method:'DELETE'});
  location.reload();
}
</script>
</body></html>`);
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

app.post('/api/admin/delete-file', async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });
  await pool.query('DELETE FROM documents WHERE filename = $1', [filename]);
  res.json({ success: true });
});

app.delete('/api/admin/delete-all', async (req, res) => {
  await pool.query('DELETE FROM documents');
  res.json({ success: true });
});

// ─── DEBUG ────────────────────────────────────────────────────────────────────
app.get('/api/debug', async (req, res) => {
  const count = await pool.query('SELECT COUNT(*) FROM documents');
  const files = await pool.query(`
    SELECT filename, COUNT(*) as chunks FROM documents GROUP BY filename
  `);
  res.json({ total_chunks: parseInt(count.rows[0].count), files: files.rows });
});

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>Medicare Assistant</title>
<style>
body{font-family:Arial;max-width:800px;margin:0 auto;padding:20px}
#chat{border:1px solid #ccc;height:400px;overflow-y:auto;padding:10px;margin-bottom:10px;background:#f9f9f9}
.user{background:#007bff;color:white;padding:8px;margin:5px;border-radius:10px;text-align:right}
.ai{background:#e9ecef;padding:8px;margin:5px;border-radius:10px;white-space:pre-wrap}
input,button{padding:8px;margin:5px}
#status{margin-top:8px;color:green}
</style></head>
<body>
<h1>📄 Medicare Document Q&A</h1>
<div id="chat"></div>
<input type="text" id="question" placeholder="Ask about your documents..." style="width:70%" onkeydown="if(event.key==='Enter')ask()">
<button onclick="ask()">Send</button>
<hr>
<h3>📤 Upload PDF or TXT</h3>
<input type="file" id="fileInput" accept=".txt,.pdf">
<button onclick="uploadDoc()">Upload</button>
<div id="status"></div>
<p><a href="/admin">⚙️ Admin</a> | <a href="/api/debug">🔍 Debug</a></p>
<script>
async function ask() {
  const q = document.getElementById('question').value.trim();
  if (!q) return;
  addMsg(q, true);
  document.getElementById('question').value = '';
  addMsg('Thinking…', false, 'thinking');
  try {
    const res = await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q})});
    const data = await res.json();
    document.getElementById('thinking')?.remove();
    addMsg(data.reply || data.error, false);
  } catch(e) {
    document.getElementById('thinking')?.remove();
    addMsg('Error: ' + e.message, false);
  }
}
function addMsg(text, isUser, id) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = isUser ? 'user' : 'ai';
  if (id) div.id = id;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
async function uploadDoc() {
  const file = document.getElementById('fileInput').files[0];
  if (!file) return alert('Select a file first');
  const fd = new FormData();
  fd.append('document', file);
  document.getElementById('status').textContent = '⏳ Uploading & chunking...';
  const res = await fetch('/api/upload-document',{method:'POST',body:fd});
  const data = await res.json();
  document.getElementById('status').textContent = res.ok ? '✅ ' + data.message : '❌ ' + data.error;
}
</script>
</body></html>`);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
