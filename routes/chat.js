const express = require('express');
const router = express.Router();
const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const GROQ_API_KEY = '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';

let documentCache = [];

async function loadDocuments() {
  try {
    const result = await pool.query('SELECT filename, content, plan_name FROM documents');
    documentCache = result.rows;
    console.log(`📚 Loaded ${documentCache.length} documents with plan names`);
  } catch (err) {
    console.error('Failed to load documents:', err.message);
  }
}
loadDocuments();

// Detect plan name from user question
function extractPlanName(question) {
  const q = question.toLowerCase();
  if (q.includes('alignment')) return 'Alignment Health';
  if (q.includes('humana')) return 'Humana';
  if (q.includes('cigna')) return 'Cigna';
  return null;
}

function findRelevantChunks(question, planName = null) {
  if (!documentCache.length) return [];
  const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const chunks = [];
  for (const doc of documentCache) {
    // If planName is specified and doc has a plan_name, only include matching docs
    if (planName && doc.plan_name && doc.plan_name !== planName) continue;
    for (let i = 0; i < doc.content.length; i += 1000) {
      const chunk = doc.content.slice(i, i + 1000);
      let score = 0;
      for (const w of words) if (chunk.toLowerCase().includes(w)) score++;
      if (score > 0) chunks.push({ content: chunk, score });
    }
  }
  chunks.sort((a,b) => b.score - a.score);
  return chunks.slice(0, 4).map(c => c.content);
}

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const planName = extractPlanName(message);
    const context = findRelevantChunks(message, planName).join('\n\n').slice(0, 6000);

    let systemPrompt = `You are MERIDIAN, a Medicare assistant. Use the context below to answer. If the answer is not in the context, say "I don't have that information in my documents."`;
    if (planName) {
      systemPrompt += `\nThe user asked about ${planName}. Only use context that comes from documents tagged with "${planName}".`;
    }
    systemPrompt += `\n\nCONTEXT:\n${context || "No relevant documents found."}\n\nAnswer the user's question concisely.`;

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

    const groqResponse = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) reject(new Error(json.error.message));
            else resolve(json);
          } catch (e) { reject(new Error('Invalid JSON from Groq')); }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    const reply = groqResponse.choices?.[0]?.message?.content || "I couldn't process that.";
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ reply: `Error: ${err.message}` });
  }
});

module.exports = router;
