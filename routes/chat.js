const express = require('express');
const router = express.Router();
const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) console.error('❌ GROQ_API_KEY not set in environment');

// Load documents once on startup
let documentCache = null;

async function loadDocuments() {
  try {
    const result = await pool.query('SELECT filename, content FROM documents');
    documentCache = result.rows;
    console.log(`📚 Chat RAG loaded ${documentCache.length} documents`);
  } catch (err) {
    console.error('Failed to load documents:', err.message);
    documentCache = [];
  }
}
loadDocuments();

// Simple chunk‑based retrieval (keyword overlap)
function findRelevantChunks(question, maxChunks = 3) {
  if (!documentCache || documentCache.length === 0) return [];
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
  chunks.sort((a, b) => b.score - a.score);
  return chunks.slice(0, maxChunks).map(c => c.content);
}

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    // Get relevant document chunks
    const relevantChunks = findRelevantChunks(message);
    const context = relevantChunks.join('\n\n').slice(0, 6000);

    const systemPrompt = `You are MERIDIAN, a Medicare assistant. 
Use the following context from official plan documents to answer the user's question. 
If the answer is not in the context, say "I don't have that information in my documents yet."

CONTEXT:
${context || "No relevant documents found."}

Be helpful, concise, and use specific details from the context.`;

    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
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
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON from Groq'));
          }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    const reply = response.choices?.[0]?.message?.content || "I couldn't process that.";
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ reply: 'Internal error. Please try again.' });
  }
});

module.exports = router;
