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

// ---------- Simple search: just look for the exact question words ----------
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  try {
    // 1. Try to find documents where content contains any part of the question
    const searchTerm = `%${message}%`;
    let docs = await pool.query(
      `SELECT filename, content FROM documents WHERE content ILIKE $1 OR filename ILIKE $1 LIMIT 3`,
      [searchTerm]
    );

    // 2. If no results, try each word individually
    if (docs.rows.length === 0) {
      const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.length > 0) {
        const conditions = words.map((_, i) => `(content ILIKE $${i+1} OR filename ILIKE $${i+1})`).join(' OR ');
        const values = words.map(w => `%${w}%`);
        docs = await pool.query(`SELECT filename, content FROM documents WHERE ${conditions} LIMIT 3`, values);
      }
    }

    // 3. If still nothing, return a helpful message showing what documents exist
    if (docs.rows.length === 0) {
      const allDocs = await pool.query('SELECT id, filename, LEFT(content, 200) as preview FROM documents');
      if (allDocs.rows.length === 0) {
        return res.json({ reply: "No documents found in the database. Please upload a PDF or TXT file using the 'Upload Document' button above." });
      } else {
        const list = allDocs.rows.map(d => `- ${d.filename}: ${d.preview}...`).join('\n');
        return res.json({ reply: `Your question didn't match any documents. Here are the documents currently in the system:\n\n${list}\n\nTry asking about one of those filenames or key phrases.` });
      }
    }

    // Build context and ask Groq
    const context = docs.rows.map(d => `[${d.filename}]:\n${d.content.substring(0, 2000)}`).join('\n\n');
    const systemPrompt = `Answer the user's question using ONLY the text below. If not found, say "I don't have that information."\n\nDocuments:\n${context}`;
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
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

// ---------- Upload endpoint (supports PDF and TXT) ----------
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
      return res.status(400).json({ error: 'Only .txt or .pdf' });
    }
    if (!content.trim()) return res.status(400).json({ error: 'No readable text' });
    const result = await pool.query('INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id', [filename, content]);
    res.json({ success: true, id: result.rows[0].id, message: `Uploaded ${filename} (${content.length} chars)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Simple HTML frontend (with upload) ----------
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

app.get('/api/list-docs', async (req, res) => {
  const docs = await pool.query('SELECT id, filename, LEFT(content, 200) as preview FROM documents');
  res.json(docs.rows);
});

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
