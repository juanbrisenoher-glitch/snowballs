const express = require('express');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Your exact database URL (hardcoded to avoid env issues)
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

// Helper: check if buffer contains null bytes (binary)
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
    <title>Medicare Assistant</title>
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
    <h1>📄 Medicare Document Q&A (Conversational)</h1>
    <div id="chat"></div>
    <input type="text" id="question" placeholder="Ask anything..." style="width: 70%">
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

// Debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM documents');
    res.json({ documents_count: parseInt(countRes.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Conversational chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  try {
    const docs = await pool.query(
      `SELECT filename, content FROM documents 
       WHERE content ILIKE $1 OR filename ILIKE $1 
       LIMIT 3`,
      [`%${message}%`]
    );

    let context = '';
    if (docs.rows.length > 0) {
      context = docs.rows.map(d => `[${d.filename}]: ${d.content.substring(0, 1500)}`).join('\n\n');
    }

    const systemPrompt = context 
      ? `You are a helpful assistant. Use the following documents to answer the user's question if relevant. If the answer is not in the documents, say so, but you can also chat normally. Be friendly and concise.\n\nDocuments:\n${context}`
      : `You are a helpful assistant. The user has no documents uploaded yet, so just chat normally. Be friendly and helpful.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 1024,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload endpoint with binary detection and sanitization
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filename = req.file.originalname;

    // Only allow .txt files
    if (!filename.toLowerCase().endsWith('.txt')) {
      return res.status(400).json({ error: 'Only .txt files are supported. Please create a plain text file using Notepad.' });
    }

    // Check for binary content (null bytes)
    if (containsNullBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'The file contains binary data. Please save it as plain text (UTF-8) using a text editor like Notepad, not Word or PDF.' });
    }

    // Convert to string and strip non-printable characters
    let content = req.file.buffer.toString('utf-8');
    content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // remove control chars except tab/newline
    
    if (!content.trim()) {
      return res.status(400).json({ error: 'File is empty or contains only invalid characters.' });
    }

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
