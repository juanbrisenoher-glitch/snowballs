const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Search document_chunks using full-text search ────────────────────────────
async function searchChunks(question, planName = null, docType = null) {
  try {
    // Build a tsquery from the question words
    const searchTerms = question
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(' | ');

    if (!searchTerms) return [];

    const conditions = [];
    const params = [searchTerms];

    if (planName) {
      params.push(`%${planName}%`);
      conditions.push(`plan_name ILIKE $${params.length}`);
    }
    if (docType) {
      params.push(docType);
      conditions.push(`doc_type = $${params.length}`);
    }

    const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    // Primary: full-text search
    const { rows } = await pool.query(`
      SELECT content, plan_name, doc_type,
             ts_rank(search_vector, to_tsquery('english', $1)) AS rank
      FROM document_chunks
      WHERE search_vector @@ to_tsquery('english', $1)
      ${whereClause}
      ORDER BY rank DESC
      LIMIT 6
    `, params);

    if (rows.length > 0) return rows;

    // Fallback: ILIKE keyword search if full-text finds nothing
    const keywords = question.split(/\s+/).filter(w => w.length > 3);
    if (!keywords.length) return [];

    const likeParams = [...params];
    const likeClauses = keywords.map(k => {
      likeParams.push(`%${k}%`);
      return `content ILIKE $${likeParams.length}`;
    });

    const fallback = await pool.query(`
      SELECT content, plan_name, doc_type, 0 as rank
      FROM document_chunks
      WHERE (${likeClauses.join(' OR ')}) ${whereClause}
      LIMIT 6
    `, likeParams);

    return fallback.rows;
  } catch (err) {
    console.error('[SEARCH ERROR]', err.message);
    return [];
  }
}

// ─── Get all indexed plan names ───────────────────────────────────────────────
async function getIndexedPlans() {
  const { rows } = await pool.query(`
    SELECT DISTINCT plan_name, array_agg(DISTINCT doc_type) as doc_types
    FROM document_chunks
    GROUP BY plan_name
    ORDER BY plan_name
  `);
  return rows;
}

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { message, userId } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const lower = message.toLowerCase();

    // Handle "what plans do you have" type questions
    if (lower.includes('what plans') || lower.includes('list plans') ||
        lower.includes('which plans') || lower.includes('plans do you have') ||
        lower.includes('plans available')) {
      const plans = await getIndexedPlans();
      if (plans.length === 0) {
        return res.json({ reply: "I don't have any plan documents indexed yet. Please upload PDFs using the Upload panel on the left." });
      }
      const list = plans.map((p, i) =>
        `${i + 1}. ${p.plan_name} (${p.doc_types.join(', ')})`
      ).join('\n');
      return res.json({ reply: `Here are the plans I have documents for:\n\n${list}\n\nAsk me anything about any of them!` });
    }

    // Search document_chunks for relevant context
    const chunks = await searchChunks(message);
    const hasContext = chunks.length > 0;

    let reply;

    if (hasContext) {
      // Build context string
      const context = chunks
        .map(r => `=== ${r.plan_name} | ${r.doc_type} ===\n${r.content}`)
        .join('\n\n');

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 800,
        system: `You are MERIDIAN, a Medicare intelligence assistant for licensed insurance agents in El Paso, TX.
Answer questions about Medicare Advantage plans using ONLY the document excerpts provided below.
Be specific — include tier numbers, copays, quantity limits, prior auth requirements, and provider names when available.
Always mention which plan your answer is about.
If the context doesn't fully answer the question, say so clearly. Never make up coverage details.`,
        messages: [
          {
            role: 'user',
            content: `DOCUMENT EXCERPTS:\n${context}\n\n---\nQUESTION: ${message}`
          }
        ]
      });

      reply = response.content[0].text;
    } else {
      // No indexed documents match — fall back to general Medicare knowledge
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 600,
        system: `You are MERIDIAN, a Medicare intelligence assistant for licensed insurance agents in El Paso, TX.
You don't have specific plan documents to reference for this question.
Answer using your general Medicare knowledge, but clearly note that the agent should verify details in the actual plan documents.
If asked about specific plan details (copays, tiers, specific providers), remind the agent to upload those plan PDFs first.`,
        messages: [{ role: 'user', content: message }]
      });

      reply = response.content[0].text;
    }

    res.json({ reply, used_documents: hasContext });

  } catch (err) {
    console.error('[CHAT ERROR]', err.message);
    res.status(500).json({ reply: `Something went wrong: ${err.message}` });
  }
});

module.exports = router;
