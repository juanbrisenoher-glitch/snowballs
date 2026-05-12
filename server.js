const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Your exact database URL
const DATABASE_URL = 'postgresql://postgres:dSKgiSWkgHDXHaxxULtGRgynxHDjfGtN@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create documents table if it doesn't exist (runs on startup)
pool.query(`
  CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    filename TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    source_url TEXT
  )
`).then(() => console.log('✅ documents table ready'))
  .catch(err => console.error('❌ Table creation error:', err.message));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static('public'));

// Serve a simple HTML interface (no external file needed)
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Medicare Assistant</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
        #chat { border: 1px solid #ccc; height: 400px; overflow-y: auto; padding: 10px; margin-bottom: 10px; }
        .user { background: #007bff; color: white; padding: 8px; margin: 5px; border-radius: 10px; text-align: right; }
        .ai { background: #e9ecef; padding: 8px; margin: 5px; border-radius: 10px; }
        input, button { padding: 8px; margin: 5px; }
    </style>
</head>
<body>
    <h1>📄 Medicare Document Q&A</h1>
    <div id="chat"></div>
    <input type="text" id="question" placeholder="Ask about your documents..." style="width: 70%">
    <button onclick="ask()">Send</button>
    <hr>
    <h3>📤 Upload Document</h3>
    <input type="file" id="fileInput" accept=".txt">
    <button onclick="uploadDoc()">Upload</button>
    <div id="status"></div>

    <script>
        async function ask() {
            const q = document.getElementById('question').value;
            if (!q) return;
            addMessage(q, true);
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: q })
            });
            const data = await res.json();
            addMessage(data.reply || data.error, false);
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
            const formData = new FormData();
            formData.append('document', file);
            const res = await fetch('/api/upload-document', { method: 'POST', body: formData });
            const data = await res.json();
            document.getElementById('status').innerText = data.message || data.error;
        }
    </script>
</body>
</html>
  `);
});

// Debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    const count = await pool.query('SELECT COUNT(*) FROM documents');
    res.json({ documents_count: parseInt(count.rows[0].count) });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });
  try {
    const result = await pool.query(
      `SELECT filename, content FROM documents WHERE content ILIKE $1 OR filename ILIKE $1 LIMIT 5`,
      [`%${message}%`]
    );
    if (result.rows.length === 0) {
      return res.json({ reply: 'No information found in uploaded documents.' });
    }
    const context = result.rows.map(r => `[${r.filename}]\n${r.content.substring(0,2000)}`).join('\n\n');
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: `Answer ONLY using the context below. If not found, say "I don't know".\n\n${context}` },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Upload endpoint
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const filename = req.file.originalname;
    const content = req.file.buffer.toString('utf-8');
    const result = await pool.query(
      'INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id',
      [filename, content]
    );
    res.json({ success: true, id: result.rows[0].id, message: 'Uploaded successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
