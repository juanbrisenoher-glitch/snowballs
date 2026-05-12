const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection – uses DATABASE_URL from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static('public'));

// ---------------------------
// DEBUG CHAT ENDPOINT (returns database info)
// ---------------------------
app.post('/api/chat', async (req, res) => {
  try {
    // 1. Get current database name
    const dbResult = await pool.query('SELECT current_database() as db_name');
    const dbName = dbResult.rows[0].db_name;
    
    // 2. Count rows in documents table
    let rowCount = 0;
    try {
      const countResult = await pool.query('SELECT COUNT(*) FROM documents');
      rowCount = parseInt(countResult.rows[0].count);
    } catch (err) {
      // Table might not exist
      rowCount = -1;
    }
    
    res.json({
      reply: `✅ Connected to database: ${dbName}\nDocuments table has ${rowCount === -1 ? 'no table (create it first)' : `${rowCount} rows`}.\n\nAsk a real question after you confirm the database is correct.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------
// DOCUMENT UPLOAD ENDPOINT (keep as before)
// ---------------------------
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = req.file.originalname;
    const content = req.file.buffer.toString('utf-8');
    const result = await pool.query(
      'INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id',
      [filename, content]
    );
    res.json({ success: true, id: result.rows[0].id, message: 'Document uploaded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
