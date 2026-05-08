const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const upload = multer({ storage: multer.memoryStorage() });

// Ensure documents table exists (with plan_name column)
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT,
      content TEXT,
      plan_name TEXT,
      source_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // Add plan_name column if missing (idempotent)
  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS plan_name TEXT;`);
  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_url TEXT;`);
}
ensureTable().catch(console.error);

// Extract plan name from PDF text using regex
function extractPlanName(text, filename) {
  const patterns = [
    /(Alignment Health\s+[A-Za-z0-9\s\+]+?\s*\([A-Za-z\-]+\))/i,
    /(Alignment Health\s+[A-Za-z0-9\s\+]+?\s*\([A-Za-z\-]+\s+[A-Za-z\-]+\))/i,
    /(Wellpoint\s+[A-Za-z\s]+\([A-Za-z\-]+\))/i,
    /(Humana\s+[A-Za-z\s]+\([A-Za-z\-]+\))/i,
    /(Cigna\s+[A-Za-z\s]+\([A-Za-z\-]+\))/i,
    /(Devoted Health\s+[A-Za-z\s]+\([A-Za-z\-]+\))/i,
    /(Amerigroup\s+[A-Za-z\s]+\([A-Za-z\-]+\))/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  // Fallback to filename (remove .pdf)
  return filename.replace(/\.pdf$/i, '').replace(/\.zip.*$/i, '');
}

// Core ingestion for a single PDF buffer
async function ingestPDF(buffer, filename, sourceUrl = null) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const planName = extractPlanName(text, filename);
  
  await pool.query(`
    INSERT INTO documents (filename, content, plan_name, source_url)
    VALUES ($1, $2, $3, $4)
  `, [filename, text, planName, sourceUrl]);
  
  // Update in‑memory cache
  if (!global.documentCache) global.documentCache = [];
  global.documentCache.push({ filename, content: text, plan_name: planName, source_url: sourceUrl });
  
  return { filename, planName, charCount: text.length };
}

// Process a ZIP file: extract all PDFs and ingest each
async function ingestZip(buffer, zipFilename, sourceUrl = null) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const pdfEntries = entries.filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'));
  const results = [];
  for (const entry of pdfEntries) {
    const pdfBuffer = entry.getData();
    // Use full path inside zip as filename
    const internalName = `${zipFilename}/${entry.entryName}`;
    const result = await ingestPDF(pdfBuffer, internalName, sourceUrl);
    results.push(result);
  }
  return results;
}

// POST /api/ingest - handles single PDF or ZIP (file upload)
router.post('/ingest', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const isZip = req.file.mimetype === 'application/zip' || req.file.originalname.endsWith('.zip');
    if (isZip) {
      const results = await ingestZip(req.file.buffer, req.file.originalname);
      return res.json({ success: true, message: `Processed ZIP: ${results.length} PDFs ingested`, results });
    } else {
      const result = await ingestPDF(req.file.buffer, req.file.originalname);
      return res.json({ success: true, message: `Ingested ${result.filename} (plan: ${result.planName})`, result });
    }
  } catch (err) {
    console.error('Ingest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest/url - download PDF from URL and ingest
router.post('/ingest/url', express.json(), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    
    const pdfBuffer = await new Promise((resolve, reject) => {
      https.get(url, (resp) => {
        if (resp.statusCode !== 200) reject(new Error(`HTTP ${resp.statusCode}`));
        else {
          const chunks = [];
          resp.on('data', c => chunks.push(c));
          resp.on('end', () => resolve(Buffer.concat(chunks)));
        }
      }).on('error', reject);
    });
    const filename = url.split('/').pop() || 'document.pdf';
    const result = await ingestPDF(pdfBuffer, filename, url);
    res.json({ success: true, message: `Ingested from URL: ${result.filename} (plan: ${result.planName})` });
  } catch (err) {
    console.error('URL ingest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest/batch - array of URLs
router.post('/ingest/batch', express.json(), async (req, res) => {
  const { urls } = req.body;
  if (!urls || !Array.isArray(urls)) return res.status(400).json({ error: 'urls array required' });
  
  const results = [];
  for (const url of urls) {
    try {
      const pdfBuffer = await new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode !== 200) reject(new Error(`HTTP ${resp.statusCode}`));
          else {
            const chunks = [];
            resp.on('data', c => chunks.push(c));
            resp.on('end', () => resolve(Buffer.concat(chunks)));
          }
        }).on('error', reject);
      });
      const filename = url.split('/').pop() || 'document.pdf';
      const result = await ingestPDF(pdfBuffer, filename, url);
      results.push({ url, success: true, plan: result.planName });
    } catch (err) {
      results.push({ url, success: false, error: err.message });
    }
  }
  res.json({ success: true, results });
});

// GET /api/ingest/status
router.get('/status', async (req, res) => {
  const count = await pool.query('SELECT COUNT(*) FROM documents');
  res.json({ documents: parseInt(count.rows[0].count) });
});

module.exports = router;
