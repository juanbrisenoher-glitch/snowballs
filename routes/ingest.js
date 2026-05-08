const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const https = require('https');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');

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

// Core function to ingest a PDF buffer
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

// Process a ZIP buffer, extract all PDFs and ingest them
async function ingestZip(buffer, zipFilename) {
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  const pdfEntries = zipEntries.filter(entry => 
    !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.pdf')
  );

  const results = [];
  for (const entry of pdfEntries) {
    const pdfBuffer = entry.getData();
    const result = await ingestPDF(pdfBuffer, `${zipFilename}/${entry.entryName}`);
    results.push(result);
  }
  return results;
}

// POST /api/ingest – handles both PDF and ZIP files
router.post('/ingest', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const isZip = req.file.mimetype === 'application/zip' || 
                  req.file.originalname.toLowerCase().endsWith('.zip');
    
    if (isZip) {
      const results = await ingestZip(req.file.buffer, req.file.originalname);
      return res.json({ 
        success: true, 
        message: `Processed ZIP: ${results.length} PDFs ingested`,
        results 
      });
    } else {
      const result = await ingestPDF(req.file.buffer, req.file.originalname);
      return res.json({ 
        success: true, 
        message: `Ingested ${result.filename} (${result.charCount} chars)`
      });
    }
  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ingest/url – unchanged (supports single PDF URL)
router.post('/ingest/url', express.json(), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

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
    res.json({ success: true, message: `Ingested from URL: ${result.filename}` });
  } catch (error) {
    console.error('URL ingest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ingest/batch – unchanged (batch of PDF URLs)
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
