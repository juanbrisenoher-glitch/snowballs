const express = require('express');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Your exact database URL (hardcoded)
const DATABASE_URL = 'postgresql://postgres:dSKgiSWkgHDXHaxxULtGRgynxHDjfGtN@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auto-create documents table
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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());

// Helper to detect binary files
function containsNullBytes(buffer) {
  for (let i = 0; i < Math.min(buffer.length, 4096); i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

// Embedded HTML interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Medicare Document Assistant</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
        #chat { border: 1px solid #ccc; height: 400px; overflow-y: auto; padding: 10px; margin-bottom: 10px; background: #f9f9f9; }
        .user { background: #007bff; color: white; padding: 8px; margin: 5px; border-radius: 10px; text-align: right; }
        .ai { background: #e9ecef; padding: 8px; margin: 5px; border-radius: 10px; }
        input, button { padding: 8px; margin: 5px; }
        .status { margin-top: 10px; padding: 5px; color: green; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>📄 Medicare Document Q&A (Strictly from your documents)</h1>
    <div id="chat"></div>
    <input type="text" id="question" placeholder="Ask about your uploaded documents..." style="width: 70%">
    <button onclick="ask()">Send</button>
    <hr>
    <h3>📤 Upload Document (TXT files only)</h3>
    <input type="file" id="fileInput" accept=".txt">
    <button onclick="uploadDoc()">Upload</button>
    <div id="status" class="status"></div>

    <script>
        async function ask() {
            const q = document.getElementById('question').value;
            if (!q) return;
            addMessage(q, true);
            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: q })
                });
                const data = await res.json();
                if (res.ok) addMessage(data.reply, false);
                else addMessage('Error: ' + data.error, false);
            } catch (err) {
                addMessage('Network error', false);
            }
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
            if (!file) {
                showStatus('Please select a .txt file', 'error');
                return;
            }
            if (!file.name.endsWith('.txt')) {
                showStatus('Only .txt files are supported', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('document', file);
            showStatus('Uploading...');
            try {
                const res = await fetch('/api/upload-document', { method: 'POST', body: formData });
                const data = await res.json();
                if (res.ok) {
                    showStatus('✅ ' + data.message, 'success');
                } else {
                    showStatus('❌ Error: ' + data.error, 'error');
                }
            } catch (err) {
                showStatus('❌ Network error', 'error');
            }
        }

        function showStatus(msg, type) {
            const div = document.getElementById('status');
            div.innerText = msg;
            div.className = 'status ' + (type === 'error' ? 'error' : '');
            setTimeout(() => { div.innerText = ''; }, 5000);
        }
    </script>
</body>
</html>
  `);
});

// Debug endpoint to see how many documents are stored
app.get('/api/debug', async (req, res) => {
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM documents');
    res.json({ documents_count: parseInt(countRes.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STRICT DOCUMENT-ONLY CHAT – no outside knowledge
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  try {
    // Search documents for relevant content
    const docs = await pool.query(
      `SELECT filename, content FROM documents 
       WHERE content ILIKE $1 OR filename ILIKE $1 
       LIMIT 5`,
      [`%${message}%`]
    );

    if (docs.rows.length === 0) {
      return res.json({ reply: "I don't have any documents that answer that. Please upload a document containing that information." });
    }

    // Build context from the matched documents (limit to 2000 chars each)
    const context = docs.rows.map(d => `[${d.filename}]:\n${d.content.substring(0, 2000)}`).join('\n\n');

    // Strict system prompt – answer ONLY from context
    const systemPrompt = `You are a strict document-based assistant. Answer the user's question using ONLY the text below. 
If the answer is not explicitly stated in the documents, say "I don't have that information in my documents." 
Do NOT use any outside knowledge, including general facts about savings plans, investments, or Medicare beyond what is written.

Documents:
${context}`;

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
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Document upload endpoint with binary detection and sanitization
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = req.file.originalname;
    if (!filename.toLowerCase().endsWith('.txt')) {
      return res.status(400).json({ error: 'Only .txt files are supported. Please create a plain text file using Notepad.' });
    }
    if (containsNullBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'File contains binary data. Please save as plain text (UTF-8).' });
    }
    let content = req.file.buffer.toString('utf-8');
    // Remove problematic control characters
    content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (!content.trim()) return res.status(400).json({ error: 'File is empty.' });
    const result = await pool.query(
      'INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id',
      [filename, content]
    );
    res.json({ success: true, id: result.rows[0].id, message: `Uploaded ${filename} (${content.length} characters)` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
