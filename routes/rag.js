// routes/rag.js
// RAG-powered Q&A — searches pgvector for relevant chunks, feeds to Claude

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /ask
// Body: { question, doc_type? (optional filter), plan_name? (optional filter) }
router.post('/ask', async (req, res) => {
  const { question, doc_type, plan_name } = req.body;

  if (!question) return res.status(400).json({ error: 'question is required' });

  try {
    // 1. Embed the question
    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });
    const queryVec = JSON.stringify(embRes.data[0].embedding);

    // 2. Semantic search — find top 6 most relevant chunks
    const conditions = ['1=1'];
    const params = [queryVec];
    if (doc_type) { params.push(doc_type); conditions.push(`doc_type = $${params.length}`); }
    if (plan_name) { params.push(plan_name); conditions.push(`plan_name ILIKE $${params.length}`); }

    const { rows } = await pool.query(`
      SELECT content, plan_name, doc_type, source_url,
             1 - (embedding <=> $1::vector) AS similarity
      FROM document_chunks
      WHERE ${conditions.join(' AND ')}
      ORDER BY embedding <=> $1::vector
      LIMIT 6
    `, params);

    if (rows.length === 0) {
      return res.json({
        answer: "I don't have data ingested for that yet. Please ingest the relevant plan documents first.",
        sources: []
      });
    }

    // 3. Build context from retrieved chunks
    const context = rows
      .map(r => `--- ${r.plan_name} | ${r.doc_type} (relevance: ${(r.similarity * 100).toFixed(0)}%) ---\n${r.content}`)
      .join('\n\n');

    // 4. Ask Claude with the context
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are MERIDIAN, a Medicare intelligence assistant for licensed insurance agents in El Paso, TX.
You answer questions about Medicare Advantage plans, formularies, provider networks, and plan benefits.
Always be specific, accurate, and cite which plan and document type your answer comes from.
If the provided context doesn't fully answer the question, say so clearly.`,
      messages: [{
        role: 'user',
        content: `Answer this question using the Medicare document excerpts below.\n\nQUESTION: ${question}\n\nDOCUMENT EXCERPTS:\n${context}`
      }]
    });

    res.json({
      answer: message.content[0].text,
      sources: rows.map(r => ({
        plan: r.plan_name,
        type: r.doc_type,
        relevance: `${(r.similarity * 100).toFixed(0)}%`,
        url: r.source_url
      }))
    });

  } catch (err) {
    console.error('[RAG ERROR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
