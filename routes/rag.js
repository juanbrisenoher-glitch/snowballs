const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const GROQ_API_KEY = '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';

// Load documents into memory on startup
async function loadDocuments() {
  try {
    const result = await pool.query('SELECT filename, content FROM documents');
    global.documentCache = result.rows;
    console.log(`📚 Loaded ${global.documentCache.length} documents for RAG`);
  } catch (err) {
    console.error('Failed to load documents:', err.message);
    global.documentCache = [];
  }
}
loadDocuments();

// Simple chunked keyword‑based retrieval
function findRelevantChunks(question, documents, maxChunks = 3) {
  const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (!documents.length) return [];

  const chunks = [];
  for (const doc of documents) {
    for (let i = 0; i < doc.content.length; i += 1000) {
      const chunk = doc.content.slice(i, i + 1000);
      let score = 0;
      for (const w of words) {
        if (chunk.toLowerCase().includes(w)) score++;
      }
      if (score > 0) chunks.push({ filename: doc.filename, content: chunk, score });
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

    console.log(`📝 /ask received: ${question.substring(0, 60)}...`);

    const docs = global.documentCache || [];
    const relevant = findRelevantChunks(question, docs);
    console.log(`📚 Found ${relevant.length} relevant chunks (out of ${docs.length} docs)`);

    const context = relevant.map(c => c.content).join('\n\n').substring(0, 6000);

    const prompt = `You are MERIDIAN, a Medicare assistant. Use the context below to answer the question. If the answer is not in the context, say "I don't have that information in my documents."

Context:
${context || "No relevant documents found."}

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
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              console.error('Groq API error:', json.error.message);
              reject(new Error(json.error.message));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(new Error('Failed to parse Groq response'));
          }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    const answer = groqResponse.choices?.[0]?.message?.content || "I couldn't process that.";
    console.log(`🤖 Answer length: ${answer.length}`);
    res.json({ answer });
  } catch (err) {
    console.error('RAG error:', err.message);
    res.status(500).json({ answer: `Internal error: ${err.message}` });
  }
});

module.exports = router;
