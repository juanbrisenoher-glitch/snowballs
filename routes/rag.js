const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const GROQ_API_KEY = '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';

let documentCache = [];

async function loadDocuments() {
  try {
    const result = await pool.query('SELECT filename, content FROM documents');
    documentCache = result.rows;
    console.log(`📚 RAG loaded ${documentCache.length} documents`);
  } catch (err) {
    console.error('Failed to load documents:', err.message);
  }
}
loadDocuments();

function findRelevantChunks(question) {
  if (!documentCache.length) return [];
  const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const chunks = [];
  for (const doc of documentCache) {
    for (let i = 0; i < doc.content.length; i += 1000) {
      const chunk = doc.content.slice(i, i + 1000);
      let score = 0;
      for (const w of words) if (chunk.toLowerCase().includes(w)) score++;
      if (score > 0) chunks.push({ content: chunk, score });
    }
  }
  chunks.sort((a,b) => b.score - a.score);
  return chunks.slice(0, 3).map(c => c.content);
}

router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'question required' });

    const context = findRelevantChunks(question).join('\n\n').slice(0, 6000);

    const prompt = `You are MERIDIAN. Use the context below to answer. If not in context, say "I don't have that information."

Context:
${context || "No relevant documents."}

Question: ${question}

Answer:`;

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

    const groqResponse = await new Promise((resolve, reject) => {
      const reqGroq = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) reject(new Error(json.error.message));
            else resolve(json);
          } catch (e) { reject(new Error('Invalid JSON from Groq')); }
        });
      });
      reqGroq.on('error', reject);
      reqGroq.write(body);
      reqGroq.end();
    });

    const answer = groqResponse.choices?.[0]?.message?.content || "I couldn't process that.";
    res.json({ answer });
  } catch (err) {
    console.error('RAG error:', err);
    res.status(500).json({ answer: `Error: ${err.message}` });
  }
});

module.exports = router;
