const express = require('express');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:dSKgiSWkgHDXHaxxULtGRgynxHDjfGtN@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    filename TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    source_url TEXT
  )
`).then(() => console.log('✅ documents table ready'))
  .catch(err => console.error('❌ Table creation error:', err));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json());

// Helper to get a summary of all documents (for generic questions)
async function getAllDocsSummary() {
  const result = await pool.query('SELECT filename, LEFT(content, 500) as snippet FROM documents LIMIT 10');
  return result.rows.map(d => `- ${d.filename}: ${d.snippet}...`).join('\n');
}

// ---------- CHAT ENDPOINT (handles generic questions like "do you have any plans") ----------
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  try {
    // First, try to find documents relevant to the question
    const searchTerm = `%${message}%`;
    let docs = await pool.query(
      `SELECT filename, content FROM documents WHERE content ILIKE $1 OR filename ILIKE $1 LIMIT 3`,
      [searchTerm]
    );

    if (docs.rows.length === 0) {
      // No direct match – get all documents for a generic answer
      const allDocsSummary = await getAllDocsSummary();
      if (!allDocsSummary) {
        return res.json({ reply: "No documents have been uploaded yet. Please upload a PDF or TXT file." });
      }
      // Use a prompt that answers generically
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: `You are a helpful assistant. The user asked: "${message}". Based on the following documents, answer the question. If the question is general (e.g., "do you have any plans"), list the plan names and a brief description from the documents. Be concise and friendly.\n\nDocuments:\n${allDocsSummary}` },
          { role: 'user', content: message }
        ],
        model: 'llama-3.1-8b-instant',
        temperature: 0.5,
        max_tokens: 500,
      });
      return res.json({ reply: completion.choices[0].message.content });
    }

    // If we have matching documents, use them strictly
    const context = docs.rows.map(d => `[${d.filename}]:\n${d.content.substring(0, 2000)}`).join('\n\n');
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: `Answer the user's question using ONLY the text below. If not found, say "I don't have that information."\n\nDocuments:\n${context}` },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 1024,
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- UPLOAD ENDPOINT (PDF/TXT) ----------
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = req.file.originalname;
    const ext = filename.split('.').pop().toLowerCase();
    let content = '';
    if (ext === 'txt') {
      content = req.file.buffer.toString('utf-8');
      content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else if (ext === 'pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      content = pdfData.text;
    } else {
      return res.status(400).json({ error: 'Only .txt or .pdf files are supported.' });
    }
    if (!content.trim()) return res.status(400).json({ error: 'File contains no readable text.' });
    const result = await pool.query('INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id', [filename, content]);
    res.json({ success: true, id: result.rows[0].id, message: `Uploaded ${filename} (${content.length} chars)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- ADMIN PAGE (list, add, delete documents) ----------
app.get('/admin', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, filename, created_at, LEFT(content, 100) as preview FROM documents ORDER BY id');
    const escapeHtml = (str) => {
      if (!str) return '';
      return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
      });
    };
    const rowsHtml = result.rows.map(row => `
      <tr>
        <td>${row.id}</td>
        <td>${escapeHtml(row.filename)}</td>
        <td>${escapeHtml(row.preview)}...${row.preview ? '' : ''}</td>
        <td>${new Date(row.created_at).toLocaleString()}</td>
        <td><button onclick="deleteDoc(${row.id})">Delete</button></td>
      </tr>
    `).join('');
    res.send(`<!DOCTYPE html>
<html>
<head><title>Admin – Documents</title>
<style>
body { font-family: Arial; max-width: 900px; margin: 0 auto; padding: 20px; }
table { width: 100%; border-collapse: collapse; margin-top: 20px; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
th { background: #f2f2f2; }
button { background: #dc3545; color: white; border: none; padding: 4px 8px; cursor: pointer; border-radius: 4px; }
button.delete-all { background: #dc3545; padding: 10px; margin-bottom: 20px; }
.form-add { margin: 20px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ccc; }
input, textarea { width: 100%; margin-bottom: 10px; padding: 8px; }
.success { color: green; }
.error { color: red; }
</style>
</head>
<body>
<h1>⚙️ Admin – Manage Documents</h1>
<div class="form-add">
  <h3>➕ Add New Document (JSON)</h3>
  <input type="text" id="newFilename" placeholder="Filename (e.g., plan.pdf)">
  <textarea id="newContent" rows="5" placeholder="Document content..."></textarea>
  <button onclick="addDocument()">Add Document</button>
  <div id="addStatus"></div>
</div>
<button class="delete-all" onclick="deleteAll()">⚠️ Delete ALL Documents</button>
<h3>📄 Existing Documents</h3>
<table>
<tr><th>ID</th><th>Filename</th><th>Preview</th><th>Created</th><th>Action</th></tr>
${rowsHtml || '<tr><td colspan="5">No documents found.</td></tr>'}
</table>
<script>
async function addDocument() {
  const filename = document.getElementById('newFilename').value.trim();
  const content = document.getElementById('newContent').value.trim();
  if (!filename || !content) {
    document.getElementById('addStatus').innerHTML = '<span class="error">Both fields required</span>';
    return;
  }
  const res = await fetch('/api/admin/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById('addStatus').innerHTML = '<span class="success">✅ ' + data.message + '</span>';
    setTimeout(() => location.reload(), 1000);
  } else {
    document.getElementById('addStatus').innerHTML = '<span class="error">❌ ' + data.error + '</span>';
  }
}
async function deleteDoc(id) {
  if (!confirm('Delete this document?')) return;
  const res = await fetch('/api/admin/delete/' + id, { method: 'DELETE' });
  if (res.ok) location.reload();
  else alert('Delete failed');
}
async function deleteAll() {
  if (!confirm('⚠️ Delete ALL documents? This cannot be undone.')) return;
  const res = await fetch('/api/admin/delete-all', { method: 'DELETE' });
  if (res.ok) location.reload();
  else alert('Delete failed');
}
</script>
</body>
</html>`);
  } catch (err) {
    res.status(500).send('Error loading admin: ' + err.message);
  }
});

// Admin API endpoints
app.post('/api/admin/add', async (req, res) => {
  const { filename, content } = req.body;
  if (!filename || !content) return res.status(400).json({ error: 'Filename and content required' });
  try {
    const result = await pool.query('INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id', [filename, content]);
    res.json({ success: true, id: result.rows[0].id, message: 'Document added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/admin/delete/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  try {
    await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/admin/delete-all', async (req, res) => {
  try {
    await pool.query('DELETE FROM documents');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- DEBUG ENDPOINTS ----------
app.get('/api/list-docs', async (req, res) => {
  const docs = await pool.query('SELECT id, filename, LEFT(content, 200) as preview FROM documents');
  res.json(docs.rows);
});
app.get('/api/debug', async (req, res) => {
  const count = await pool.query('SELECT COUNT(*) FROM documents');
  res.json({ count: parseInt(count.rows[0].count) });
});

// ---------- MAIN HTML PAGE (with admin link) ----------
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head><title>Medicare Assistant</title>
<style>
body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
#chat { border:1px solid #ccc; height:400px; overflow-y:auto; padding:10px; margin-bottom:10px; background:#f9f9f9; }
.user { background:#007bff; color:white; padding:8px; margin:5px; border-radius:10px; text-align:right; }
.ai { background:#e9ecef; padding:8px; margin:5px; border-radius:10px; }
input, button { padding:8px; margin:5px; }
.status { margin-top:10px; padding:5px; color:green; }
.error { color:red; }
.admin-link { margin-top:20px; text-align:center; }
</style>
</head>
<body>
<h1>📄 Medicare Document Q&A</h1>
<div id="chat"></div>
<input type="text" id="question" placeholder="Ask about your documents..." style="width:70%">
<button onclick="ask()">Send</button>
<hr>
<h3>📤 Upload PDF or TXT</h3>
<input type="file" id="fileInput" accept=".txt,.pdf">
<button onclick="uploadDoc()">Upload</button>
<div id="status"></div>
<div class="admin-link"><a href="/admin">⚙️ Admin – Manage Documents</a></div>
<script>
async function ask() {
  const q = document.getElementById('question').value;
  if (!q) return;
  addMessage(q, true);
  const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:q}) });
  const data = await res.json();
  addMessage(data.reply || data.error, false);
  document.getElementById('question').value = '';
}
function addMessage(text, isUser) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = isUser ? 'user' : 'ai';
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
async function uploadDoc() {
  const file = document.getElementById('fileInput').files[0];
  if (!file) return alert('Select a file');
  const fd = new FormData();
  fd.append('document', file);
  document.getElementById('status').innerText = 'Uploading...';
  const res = await fetch('/api/upload-document', { method:'POST', body:fd });
  const data = await res.json();
  if (res.ok) document.getElementById('status').innerText = '✅ ' + data.message;
  else document.getElementById('status').innerText = '❌ ' + data.error;
}
</script>
</body>
</html>`);
});

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
