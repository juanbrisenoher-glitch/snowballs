const express = require('express');
const router = express.Router();
const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
console.log(`🔑 GROQ_API_KEY present: ${GROQ_API_KEY ? 'YES' : 'NO'}`);
if (!GROQ_API_KEY) console.error('❌ GROQ_API_KEY environment variable is missing!');

let documentCache = [];

async function loadDocuments() {
  try {
    const result = await pool.query('SELECT filename, content FROM documents');
    documentCache = result.rows;
    console.log(`📚 Loaded ${documentCache.length} documents for RAG`);
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

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    console.log(`📨 Received message: "${message}"`);

    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    const context = findRelevantChunks(message).join('\n\n').slice(0, 6000);
    console.log(`📄 Context length: ${context.length} chars`);

    const systemPrompt = `You are MERIDIAN, a Medicare assistant. Use the context below to answer. If the answer is not in the context, say "I don't have that information in my documents."

CONTEXT:
${context || "No relevant documents found."}

Answer the user's question concisely.`;

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

    console.log(`🚀 Calling Groq API with key: ${GROQ_API_KEY ? GROQ_API_KEY.substring(0,10)+'...' : 'MISSING'}`);

    const groqResponse = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              console.error('Groq API error:', json.error);
              reject(new Error(json.error.message));
            } else {
              resolve(json);
            }
          } catch (e) {
            console.error('Failed to parse Groq response:', e);
            reject(new Error('Invalid JSON from Groq'));
          }
        });
      });
      request.on('error', (err) => {
        console.error('Request error:', err);
        reject(err);
      });
      request.write(body);
      request.end();
    });

    const reply = groqResponse.choices?.[0]?.message?.content || "I couldn't process that.";
    console.log(`✅ Reply: ${reply.substring(0, 100)}...`);
    res.json({ reply });
  } catch (err) {
    console.error('Chat route error:', err);
    res.status(500).json({ reply: `Error: ${err.message}` });
  }
});

module.exports = router;
