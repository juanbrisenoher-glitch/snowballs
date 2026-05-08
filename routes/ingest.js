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

// Helper: extract plan name from PDF text
function extractPlanName(text, filename) {
  // First try to find a common pattern: "Alignment Health X (HMO...)"
  const patterns = [
    /(Alignment Health\s+[A-Za-z0-9\s\+]+?\s*\([A-Za-z\-]+\))/i,
    /(Alignment Health\s+[A-Za-z0-9\s\+]+?\s*\([A-Za-z\-]+\s+[A-Za-z\-]+\))/i,
    /(Wellpoint\s+[A-Za-z\s]+\([A-Za-z\-]+\))/i,
    /(Humana\s+[A-Za-z\s]+\([A-Za-z\-]+\))/i,
    /(Cigna\s+[A-Za-z\s]+\([A-Za-z\-]+\))/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  // If no pattern matches, fallback to filename (remove .pdf)
  return filename.replace(/\.pdf$/i, '');
}

// Core ingestion (single PDF)
async function ingestPDF(buffer, filename, isZip = false, zipPath = '') {
  const data = await pdfParse(buffer);
  const text = data.text;
  const planName = extractPlanName(text, filename);
  const docType = filename.toLowerCase().includes('formulary') ? 'formulary' :
                  filename.toLowerCase().includes('provider') ? 'provider' :
                  filename.toLowerCase().includes('otc') ? 'otc' :
                  filename.toLowerCase().includes('benefits') ? 'benefits' : 'other';

  await pool.query(`
    INSERT INTO documents (filename, content, plan_name, doc_type)
    VALUES ($1, $2, $3, $4)
  `, [filename, text, planName, docType]);

  // Update memory cache
  if (!global.documentCache) global.documentCache = [];
  global.documentCache.push({ filename, content: text, plan_name: planName, doc_type: docType });

  return { filename, planName, docType };
}

// Process ZIP (extract all PDFs)
async function ingestZip(buffer, zipFilename) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const pdfEntries = entries.filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'));
  const results = [];
  for (const entry of pdfEntries) {
    const pdfBuffer = entry.getData();
    const result = await ingestPDF(pdfBuffer, `${zipFilename}/${entry.entryName}`, true, entry.entryName);
    results.push(result);
  }
  return results;
}

// POST /api/ingest (file upload)
router.post('/ingest', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const isZip = req.file.mimetype === 'application/zip' || req.file.originalname.endsWith('.zip');
    if (isZip) {
      const results = await ingestZip(req.file.buffer, req.file.originalname);
      return res.json({ success: true, message: `Processed ZIP: ${results.length} PDFs ingested`, results });
    } else {
      const result = await ingestPDF(req.file.buffer, req.file.originalname);
      return res.json({ success: true, message: `Ingested ${result.filename} (plan: ${result.planName})` });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest/url
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
    const result = await ingestPDF(pdfBuffer, filename);
    res.json({ success: true, message: `Ingested from URL: ${result.filename} (plan: ${result.planName})` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ingest/batch (multiple URLs)
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
      const result = await ingestPDF(pdfBuffer, filename);
      results.push({ url, success: true, plan: result.planName });
    } catch (err) {
      results.push({ url, success: false, error: err.message });
    }
  }
  res.json({ success: true, results });
});

// GET /api/ingest/status
router.get('/status', async (req, res) => {
  const docs = await pool.query('SELECT COUNT(*) FROM documents');
  res.json({ documents: parseInt(docs.rows[0].count) });
});

module.exports = router;
