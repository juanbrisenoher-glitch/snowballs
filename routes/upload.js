const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const upload = multer({ storage: multer.memoryStorage() });

// Ensure documents table has the needed columns
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT,
      content TEXT,
      plan_name TEXT,
      doc_type TEXT,
      source_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS plan_name TEXT;`);
  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type TEXT;`);
}
ensureTable().catch(console.error);

// Ingest a single PDF buffer
async function ingestPDF(buffer, filename, planName, docType) {
  const data = await pdfParse(buffer);
  const text = data.text;
  await pool.query(
    `INSERT INTO documents (filename, content, plan_name, doc_type) VALUES ($1, $2, $3, $4)`,
    [filename, text, planName, docType]
  );
  // Update in-memory cache
  if (!global.documentCache) global.documentCache = [];
  global.documentCache.push({ filename, content: text, plan_name: planName, doc_type: docType });
  return { filename, planName, docType, charCount: text.length };
}

// Handle ZIP upload
async function ingestZip(buffer, zipFilename, planName, docType) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const pdfEntries = entries.filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'));
  const results = [];
  for (const entry of pdfEntries) {
    const pdfBuffer = entry.getData();
    const internalName = `${zipFilename}/${entry.entryName}`;
    const result = await ingestPDF(pdfBuffer, internalName, planName, docType);
    results.push(result);
  }
  return results;
}

// POST /api/upload/ingest
router.post('/ingest', upload.single('file'), async (req, res) => {
  try {
    const { plan_name, doc_type } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!plan_name) return res.status(400).json({ error: 'Plan name is required' });
    if (!doc_type) return res.status(400).json({ error: 'Document type is required' });

    const isZip = req.file.mimetype === 'application/zip' || req.file.originalname.endsWith('.zip');
    if (isZip) {
      const results = await ingestZip(req.file.buffer, req.file.originalname, plan_name, doc_type);
      return res.json({ success: true, message: `Processed ZIP: ${results.length} PDFs ingested`, results });
    } else {
      const result = await ingestPDF(req.file.buffer, req.file.originalname, plan_name, doc_type);
      return res.json({ success: true, message: `Ingested ${result.filename} (plan: ${result.planName})` });
    }
  } catch (err) {
    console.error('Ingest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/upload/status – returns list of indexed documents (grouped by plan_name + doc_type)
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT plan_name, doc_type, COUNT(*) as chunks
      FROM documents
      WHERE plan_name IS NOT NULL AND doc_type IS NOT NULL
      GROUP BY plan_name, doc_type
      ORDER BY plan_name
    `);
    res.json({ indexed_chunks: result.rows });
  } catch (err) {
    res.json({ indexed_chunks: [] });
  }
});

module.exports = router;
