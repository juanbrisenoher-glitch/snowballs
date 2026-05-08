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

// ─── Ensure Tables ───────────────────────────────────────────────────────────
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
  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type TEXT;`);

  // Add full-text search index to document_chunks for keyword search (no OpenAI needed)
  await pool.query(`ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS document_chunks_search_idx 
    ON document_chunks USING GIN(search_vector);
  `);
}
ensureTable().catch(console.error);

// ─── Chunk Text ───────────────────────────────────────────────────────────────
// Splits text into overlapping ~400-word chunks
function chunkText(text, size = 400, overlap = 50) {
  // Clean up excessive whitespace common in PDF extraction
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(' ');
    if (chunk.length > 100) chunks.push(chunk); // skip tiny fragments
    if (i + size >= words.length) break;
  }
  return chunks;
}

// ─── Core Ingest Function ─────────────────────────────────────────────────────
// plan_name and doc_type are NOW passed explicitly — no more fragile regex guessing
async function ingestPDF(buffer, filename, planName, docType, sourceUrl = null) {
  // 1. Extract text
  const data = await pdfParse(buffer);
  const text = data.text;

  if (!text || text.trim().length < 50) {
    throw new Error(`Could not extract text from ${filename}. The PDF may be a scanned image.`);
  }

  console.log(`[INGEST] ${planName} | ${docType} | ${data.numpages} pages | ${text.length} chars`);

  // 2. Save full document to documents table (keep this for reference)
  await pool.query(
    `INSERT INTO documents (filename, content, plan_name, doc_type, source_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [filename, text, planName, docType, sourceUrl]
  );

  // 3. Delete old chunks for this plan+docType combo (safe re-ingest)
  await pool.query(
    'DELETE FROM document_chunks WHERE plan_name = $1 AND doc_type = $2',
    [planName, docType]
  );

  // 4. Chunk and store in document_chunks with full-text search vector
  const chunks = chunkText(text);
  let stored = 0;

  for (let i = 0; i < chunks.length; i++) {
    await pool.query(
      `INSERT INTO document_chunks 
         (doc_type, source_url, plan_name, chunk_index, content, search_vector)
       VALUES ($1, $2, $3, $4, $5, to_tsvector('english', $5))`,
      [docType, sourceUrl, planName, i, chunks[i]]
    );
    stored++;
  }

  console.log(`[INGEST] ✅ Done: ${stored} chunks stored for "${planName}" (${docType})`);
  return { filename, planName, docType, pages: data.numpages, chunks: stored };
}

// ─── ZIP handler ──────────────────────────────────────────────────────────────
async function ingestZip(buffer, zipFilename, planName, docType, sourceUrl = null) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter(e => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'));
  const results = [];
  for (const entry of entries) {
    const pdfBuffer = entry.getData();
    const result = await ingestPDF(pdfBuffer, entry.entryName, planName, docType, sourceUrl);
    results.push(result);
  }
  return results;
}

// ─── POST /api/upload/ingest  (file upload from the UI) ──────────────────────
// Now requires: plan_name and doc_type as form fields alongside the file
// doc_type options: formulary | provider_directory | plan_benefits | summary_of_benefits
router.post('/ingest', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const planName = req.body.plan_name?.trim();
    const docType  = req.body.doc_type?.trim();

    if (!planName) return res.status(400).json({ error: 'plan_name is required' });
    if (!docType)  return res.status(400).json({ error: 'doc_type is required (formulary | provider_directory | plan_benefits | summary_of_benefits)' });

    const isZip = req.file.mimetype === 'application/zip' || req.file.originalname.endsWith('.zip');

    if (isZip) {
      const results = await ingestZip(req.file.buffer, req.file.originalname, planName, docType);
      return res.json({ success: true, message: `ZIP: ${results.length} PDFs processed`, results });
    } else {
      const result = await ingestPDF(req.file.buffer, req.file.originalname, planName, docType);
      return res.json({ success: true, message: `✅ ${result.chunks} chunks stored for "${planName}"`, result });
    }
  } catch (err) {
    console.error('[INGEST ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/upload/ingest/url  (ingest from a URL) ────────────────────────
router.post('/ingest/url', express.json(), async (req, res) => {
  try {
    const { url, plan_name, doc_type } = req.body;
    if (!url)       return res.status(400).json({ error: 'url required' });
    if (!plan_name) return res.status(400).json({ error: 'plan_name required' });
    if (!doc_type)  return res.status(400).json({ error: 'doc_type required' });

    const pdfBuffer = await fetchUrl(url);
    const filename = url.split('/').pop() || 'document.pdf';
    const result = await ingestPDF(pdfBuffer, filename, plan_name, doc_type, url);
    res.json({ success: true, message: `✅ ${result.chunks} chunks stored for "${plan_name}"`, result });
  } catch (err) {
    console.error('[URL INGEST ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/upload/ingest/batch  (multiple URLs at once) ──────────────────
router.post('/ingest/batch', express.json(), async (req, res) => {
  const { documents } = req.body;
  // documents = [{ url, plan_name, doc_type }, ...]
  if (!documents || !Array.isArray(documents)) {
    return res.status(400).json({ error: 'documents array required: [{ url, plan_name, doc_type }]' });
  }
  const results = [];
  for (const doc of documents) {
    try {
      const pdfBuffer = await fetchUrl(doc.url);
      const filename = doc.url.split('/').pop() || 'document.pdf';
      const result = await ingestPDF(pdfBuffer, filename, doc.plan_name, doc.doc_type, doc.url);
      results.push({ url: doc.url, plan_name: doc.plan_name, success: true, chunks: result.chunks });
    } catch (err) {
      results.push({ url: doc.url, plan_name: doc.plan_name, success: false, error: err.message });
    }
  }
  res.json({ success: true, results });
});

// ─── GET /api/upload/status  ──────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const docs = await pool.query('SELECT COUNT(*) FROM documents');
    const chunks = await pool.query(`
      SELECT plan_name, doc_type, COUNT(*) as chunks
      FROM document_chunks
      GROUP BY plan_name, doc_type
      ORDER BY plan_name
    `);
    res.json({
      total_documents: parseInt(docs.rows[0].count),
      indexed_chunks: chunks.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      if (resp.statusCode !== 200) return reject(new Error(`HTTP ${resp.statusCode} for ${url}`));
      const chunks = [];
      resp.on('data', c => chunks.push(c));
      resp.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

module.exports = router;
