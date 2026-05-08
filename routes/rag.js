const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── POST /api/ask ────────────────────────────────────────────────────────────
// Body: { question, plan_name? (optional), doc_type? (optional) }
router.post('/ask', express.json(), async (req, res) => {
  const { question, plan_name, doc_type } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required' });

  try {
    // Build query terms for full-text search
    const searchTerms = question
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(' | '); // OR search — finds chunks with any of the words

    const conditions = [];
    const params = [searchTerms];

    if (plan_name) { params.push(`%${plan_name}%`); conditions.push(`plan_name ILIKE $${params.length}`); }
    if (doc_type)  { params.push(doc_type);          conditions.push(`doc_type = $${params.length}`); }

    const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    // Full-text search — no OpenAI needed, uses PostgreSQL ts_vector
    const { rows } = await pool.query(`
      SELECT content, plan_name, doc_type,
             ts_rank(search_vector, to_tsquery('english', $1)) AS rank
      FROM document_chunks
      WHERE search_vector @@ to_tsquery('english', $1)
      ${whereClause}
      ORDER BY rank DESC
      LIMIT 6
    `, params);

    // Fallback: if full-text search finds nothing, do a simple ILIKE keyword search
    let chunks = rows;
    if (chunks.length === 0) {
      const keywords = question.split(/\s+/).filter(w => w.length > 3);
      const likeClause = keywords.map((_, i) => `content ILIKE $${params.length + i + 1}`).join(' OR ');
      if (likeClause) {
        const likeParams = [...params, ...keywords.map(k => `%${k}%`)];
        const fallback = await pool.query(`
          SELECT content, plan_name, doc_type, 0 as rank
          FROM document_chunks
          WHERE (${likeClause}) ${whereClause}
          LIMIT 6
        `, likeParams);
        chunks = fallback.rows;
      }
    }

    if (chunks.length === 0) {
      return res.json({
        answer: `I don't have ingested documents to answer that yet. Please upload the relevant plan PDFs first using the Upload section.`,
        sources: [],
        used_rag: false
      });
    }

    // Build context for Claude
    const context = chunks
      .map(r => `=== ${r.plan_name} | ${r.doc_type} ===\n${r.content}`)
      .join('\n\n');

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: `You are MERIDIAN, a Medicare intelligence assistant for licensed insurance agents in El Paso, TX.
Answer questions about Medicare Advantage plans, formularies, provider networks, and benefits using ONLY the document excerpts provided.
Be specific and always mention which plan your answer refers to.
If the context doesn't fully answer the question, say so clearly — do not make up information.`,
      messages: [{
        role: 'user',
        content: `Answer this question using the Medicare document excerpts below.\n\nQUESTION: ${question}\n\nDOCUMENT EXCERPTS:\n${context}`
      }]
    });

    res.json({
      answer: message.content[0].text,
      sources: chunks.map(r => ({ plan: r.plan_name, type: r.doc_type })),
      used_rag: true
    });

  } catch (err) {
    console.error('[RAG ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
