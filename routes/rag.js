const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const GROQ_API_KEY = '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';

// Load documents into memory cache
async function loadDocuments() {
  const result = await pool.query('SELECT filename, content FROM documents');
  global.documentCache = result.rows;
  console.log(`📚 Loaded ${global.documentCache.length} documents for RAG`);
}
loadDocuments();

// Simple retrieval (keyword overlap)
function findRelevantChunks(question, documents, maxChunks = 3) {
  const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (!documents.length) return [];

  const chunks = [];
  for (const doc of documents) {
    // Split into ~1000 char chunks
    for (let i = 0; i < doc.content.length; i += 1000) {
      const chunk = doc.content.slice(i, i + 1000);
      let score = 0;
      for (const w of words) {
        if (chunk.toLowerCase().includes(w)) score++;
      }
      chunks.push({ filename: doc.filename, content: chunk, score });
    }
  }
  chunks.sort((a,b) => b.score - a.score);
  return chunks.slice(0, maxChunks);
}

router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'question required' });
    }

    const docs = global.documentCache || [];
    const relevant = findRelevantChunks(question, docs);
    const context = relevant.map(c => c.content).join('\n\n').substring(0, 6000);

    const prompt = `You are MERIDIAN, a Medicare assistant. Use the context below to answer the question. If the answer is not in the context, say "I don't have that information in my documents."

Context:
${context || "No relevant documents found."}

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
    console.error('RAG error:', err);
    res.status(500).json({ answer: "Internal server error." });
  }
});

module.exports = router;
