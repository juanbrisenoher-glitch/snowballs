const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection (Railway provides DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

app.use(express.json());
app.use(express.static('public'));

// ---------------------------
// 1. CHAT endpoint (uses documents from database)
// ---------------------------
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    // Search for relevant documents by filename or content
    const result = await pool.query(
      `SELECT filename, content 
       FROM documents 
       WHERE content ILIKE $1 OR filename ILIKE $1
       LIMIT 5`,
      [`%${message}%`]
    );

    if (result.rows.length === 0) {
      return res.json({ reply: "I couldn't find any relevant information in your uploaded documents. Try a different question or upload more documents." });
    }

    // Build context from the retrieved documents
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process your request.' });
  }
});

// ---------------------------
// 2. DOCUMENT UPLOAD endpoint (for the "Scan document" tab)
// ---------------------------
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname;
    // Convert buffer to text (for .txt files – for PDF you'd need pdf-parse)
    const content = req.file.buffer.toString('utf-8');

    const result = await pool.query(
      'INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id',
      [filename, content]
    );

    res.json({ success: true, id: result.rows[0].id, message: 'Document uploaded and scanned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
