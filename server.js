const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------
// DATABASE CONNECTION (hardcoded with your URL)
// ------------------------------------------------------------------
const pool = new Pool({
  connectionString: 'postgresql://postgres:dSKgiSWkgHDXHaxxULtGRgynxHDjfGtN@postgres.railway.internal:5432/railway',
  ssl: { rejectUnauthorized: false }
});

// Groq client – uses environment variable GROQ_API_KEY (set in Railway)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static('public'));

// ------------------------------------------------------------------
// DEBUG ENDPOINT – check database connection and table rows
// ------------------------------------------------------------------
app.get('/api/debug-db', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT current_database() as db_name');
    const countResult = await pool.query('SELECT COUNT(*) FROM documents');
    res.json({
      database: dbResult.rows[0].db_name,
      documents_count: parseInt(countResult.rows[0].count),
      message: 'Connection successful'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// CHAT ENDPOINT – searches documents and answers with Groq
// ------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    // Search documents by content or filename
    const result = await pool.query(
      `SELECT filename, content 
       FROM documents 
       WHERE content ILIKE $1 OR filename ILIKE $1
       LIMIT 5`,
      [`%${message}%`]
    );

    if (result.rows.length === 0) {
      return res.json({ reply: "I couldn't find any information about that in your uploaded documents. Try a different question or upload more documents." });
    }

    // Build context from retrieved documents
    const context = result.rows
      .map(row => `[File: ${row.filename}]\n${row.content.substring(0, 2000)}`)
      .join('\n\n');

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a strict document‑based assistant. Answer ONLY using the context below. Do not use any outside knowledge. If the answer is not in the context, say: "I don't have that information in the uploaded documents."

Context:
${context}`
        },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 1024,
    });

    res.json({ reply: chatCompletion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------------
// DOCUMENT UPLOAD ENDPOINT (for Scan Document tab)
// ------------------------------------------------------------------
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filename = req.file.originalname;
    const content = req.file.buffer.toString('utf-8'); // works for .txt files

    const result = await pool.query(
      'INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id',
      [filename, content]
    );

    res.json({ success: true, id: result.rows[0].id, message: 'Document uploaded and scanned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
