// routes/ingest.js
// Fetches a PDF from a URL, extracts text, chunks it, embeds it, stores in pgvector

const express = require('express');
const router = express.Router();
const pdf = require('pdf-parse');
const { Pool } = require('pg');
const OpenAI = require('openai');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Split text into overlapping chunks of ~500 words
function chunkText(text, size = 500, overlap = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(' ');
    if (chunk.trim().length > 50) chunks.push(chunk); // skip tiny fragments
    if (i + size >= words.length) break;
  }
  return chunks;
}

// POST /ingest
// Body: { url, doc_type, plan_name }
// doc_type: "formulary" | "provider_directory" | "plan_benefits" | "summary_of_benefits"
router.post('/ingest', async (req, res) => {
  const { url, doc_type, plan_name } = req.body;

  if (!url || !doc_type || !plan_name) {
    return res.status(400).json({ error: 'url, doc_type, and plan_name are required' });
  }

  try {
    console.log(`[INGEST] Starting: ${plan_name} | ${doc_type}`);

    // 1. Fetch the PDF
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extract text
    const data = await pdf(buffer);
    const text = data.text;
    console.log(`[INGEST] Extracted ${text.length} characters, ${data.numpages} pages`);

    // 3. Chunk the text
    const chunks = chunkText(text);
    console.log(`[INGEST] Created ${chunks.length} chunks`);

    // 4. Delete old chunks for this URL (safe re-ingest)
    await pool.query('DELETE FROM document_chunks WHERE source_url = $1', [url]);

    // 5. Embed each chunk and store
    let stored = 0;
    for (let i = 0; i < chunks.length; i++) {
      const embRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunks[i],
      });
      const embedding = embRes.data[0].embedding;

      await pool.query(
        `INSERT INTO document_chunks 
           (doc_type, source_url, plan_name, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [doc_type, url, plan_name, i, chunks[i], JSON.stringify(embedding)]
      );
      stored++;

      // Log progress every 20 chunks
      if (stored % 20 === 0) console.log(`[INGEST] Stored ${stored}/${chunks.length} chunks...`);
    }

    console.log(`[INGEST] Done! ${stored} chunks stored for ${plan_name}`);
    res.json({ success: true, plan_name, doc_type, chunks_stored: stored, pages: data.numpages });

  } catch (err) {
    console.error('[INGEST ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /ingest/status — see what's been ingested
router.get('/ingest/status', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT plan_name, doc_type, COUNT(*) as chunks, MAX(created_at) as last_updated
      FROM document_chunks
      GROUP BY plan_name, doc_type
      ORDER BY last_updated DESC
    `);
    res.json({ documents: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
