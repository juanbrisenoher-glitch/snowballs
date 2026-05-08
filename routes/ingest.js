const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const https = require('https');
const pdfParse = require('pdf-parse');

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
      source_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
ensureTable();

// Core function to ingest PDF buffer
async function ingestPDF(buffer, filename, sourceUrl = null) {
  const data = await pdfParse(buffer);
  const text = data.text;

  await pool.query(
    'INSERT INTO documents (filename, content, source_url) VALUES ($1, $2, $3)',
    [filename, text, sourceUrl]
  );

  // Update memory cache
  if (!global.documentCache) global.documentCache = [];
  global.documentCache.push({ filename, content: text, source_url: sourceUrl });

  return { filename, charCount: text.length };
}

// POST /api/ingest – upload a PDF file
router.post('/ingest', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const result = await ingestPDF(req.file.buffer, req.file.originalname);
    res.json({ success: true, message: `Ingested ${result.filename} (${result.charCount} chars)` });
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ingest/url – download PDF from URL and ingest
router.post('/ingest/url', express.json(), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    // Download PDF
    const pdfBuffer = await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    const filename = url.split('/').pop() || 'document.pdf';
    const result = await ingestPDF(pdfBuffer, filename, url);
    res.json({ success: true, message: `Ingested ${result.filename} from URL (${result.charCount} chars)` });
  } catch (error) {
    console.error('URL ingest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ingest/batch – multiple URLs in one request
router.post('/ingest/batch', express.json(), async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'urls array required' });
  }

  const results = [];
  for (const url of urls) {
    try {
      const pdfBuffer = await new Promise((resolve, reject) => {
        https.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          const chunks = [];
          response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
      });
      const filename = url.split('/').pop() || 'document.pdf';
      const result = await ingestPDF(pdfBuffer, filename, url);
      results.push({ url, success: true, chars: result.charCount });
    } catch (err) {
      results.push({ url, success: false, error: err.message });
    }
  }

  res.json({ success: true, results });
});

module.exports = router;
