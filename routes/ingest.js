const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');

let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (err) {
  console.warn('⚠️ pdf-parse not available. PDF ingestion will fail until installed.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const upload = multer({ storage: multer.memoryStorage() });

// Ensure documents table exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT,
      content TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
ensureTable();

// POST /api/ingest
router.post('/ingest', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!pdfParse) {
      return res.status(500).json({ error: 'PDF parsing library not installed. Please redeploy with pdf-parse in package.json.' });
    }

    const data = await pdfParse(req.file.buffer);
    const text = data.text;

    await pool.query(
      'INSERT INTO documents (filename, content) VALUES ($1, $2)',
      [req.file.originalname, text]
    );

    // Update in‑memory cache
    if (!global.documentCache) global.documentCache = [];
    global.documentCache.push({ filename: req.file.originalname, content: text });

    res.json({ success: true, message: `Ingested ${req.file.originalname} (${text.length} chars)` });
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
