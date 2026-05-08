const express = require('express');
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const GROQ_API_KEY = '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';

async function loadDocumentCache() {
  const result = await pool.query('SELECT filename, content FROM documents');
  global.documentCache = result.rows;
  console.log(`📚 Loaded ${global.documentCache.length} documents into RAG cache`);
}
loadDocumentCache();

function findRelevantChunks(question, documents, maxChunks = 3) {
  const questionWords = question.toLowerCase().split(/\W+/);
  const scored = documents.map(doc => {
    const contentLower = doc.content.toLowerCase();
    let score = 0;
    for (const word of questionWords) {
      if (word.length > 2 && contentLower.includes(word)) score++;
    }
    return { ...doc, score };
  });
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, maxChunks);
}

const router = express.Router();

router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });

    const docs = global.documentCache || [];
    const relevant = findRelevantChunks(question, docs);
    const context = relevant.map(d => d.content).join('\n\n---\n\n').substring(0, 6000);

    const prompt = `You are MERIDIAN, a Medicare assistant. Use the context below to answer. If the answer is not in the context, say "I don't have that information yet."

Context:
${context || "No documents ingested yet."}

Question: ${question}

Answer:`;

    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });
      const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const request = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    const answer = response.choices?.[0]?.message?.content || "I couldn't process that.";
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
