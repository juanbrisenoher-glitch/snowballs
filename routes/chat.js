const express = require('express');
const router = express.Router();
const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) console.error('❌ GROQ_API_KEY not set');

async function loadDocuments() {
  try {
    const result = await pool.query('SELECT filename, content, plan_name FROM documents');
    global.documentCache = result.rows;
    console.log(`📚 Loaded ${global.documentCache.length} documents with plan names`);
  } catch (err) {
    global.documentCache = [];
  }
}
loadDocuments();

async function getAllPlanNames() {
  const result = await pool.query('SELECT DISTINCT plan_name FROM documents WHERE plan_name IS NOT NULL AND plan_name != \'\' ORDER BY plan_name');
  return result.rows.map(row => row.plan_name);
}

function detectPlanName(question) {
  const q = question.toLowerCase();
  // Explicit patterns – order matters (more specific first)
  const planKeywords = [
    { name: 'Alignment Health smartSavings (HMO-POS)', keywords: ['smartsavings', 'smart savings', 'smart-savings', 'h5472-010'] },
    { name: 'Alignment Health the ONE + Walgreens (HMO-POS)', keywords: ['one + walgreens', 'the one', 'one walgreens', 'h5472-001'] },
    { name: 'Alignment Health Heart & Diabetes (HMO-POS C-SNP)', keywords: ['heart & diabetes', 'heart and diabetes', 'h5472-002', 'c-snp'] },
    { name: 'Alignment Health Dual Select+ (HMO-POS D-SNP)', keywords: ['dual select', 'd-snp', 'h5472-007'] },
    { name: 'Alignment Health Total Dual+ (HMO-POS D-SNP)', keywords: ['total dual', 'h5472-009'] }
  ];
  for (const plan of planKeywords) {
    for (const kw of plan.keywords) {
      if (q.includes(kw)) {
        console.log(`🔍 Detected plan: ${plan.name} (matched keyword "${kw}")`);
        return plan.name;
      }
    }
  }
  return null;
}

function findRelevantChunks(question, documents, planName = null, maxChunks = 6) {
  const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (!documents.length) return [];

  let filteredDocs = documents;
  if (planName) {
    filteredDocs = documents.filter(doc => doc.plan_name && doc.plan_name.toLowerCase() === planName.toLowerCase());
    if (filteredDocs.length === 0) {
      console.log(`⚠️ No docs for plan "${planName}", using all documents.`);
      filteredDocs = documents;
    } else {
      console.log(`📄 Found ${filteredDocs.length} docs for plan "${planName}"`);
    }
  }

  const chunks = [];
  for (const doc of filteredDocs) {
    for (let i = 0; i < doc.content.length; i += 2000) {
      const chunk = doc.content.slice(i, i + 2000);
      let score = 0;
      for (const w of words) if (chunk.toLowerCase().includes(w)) score++;
      if (score > 0) chunks.push({ content: chunk, score });
    }
  }
  chunks.sort((a,b) => b.score - a.score);
  return chunks.slice(0, maxChunks).map(c => c.content);
}

router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('what plans') || lowerMsg.includes('list plans')) {
      const planNames = await getAllPlanNames();
      if (planNames.length > 0) {
        return res.json({ reply: `Here are the plans I have documents for:\n${planNames.map((n,i)=>`${i+1}. ${n}`).join('\n')}` });
      } else {
        return res.json({ reply: 'No plans yet. Upload documents using the scanner.' });
      }
    }

    const planName = detectPlanName(message);
    const docs = global.documentCache || [];
    const relevantChunks = findRelevantChunks(message, docs, planName);
    const context = relevantChunks.join('\n\n').slice(0, 8000);

    let systemPrompt = `You are MERIDIAN, a Medicare assistant. Use the context below to answer. If the answer is not in the context, say "I don't have that information in my documents."`;
    if (planName) {
      systemPrompt += `\n\nThe user asked about the plan "${planName}". Only use the context that comes from that plan.`;
    }
    systemPrompt += `\n\nCONTEXT:\n${context || "No relevant documents found."}\n\nAnswer concisely.`;

    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.3,
      max_tokens: 600
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
      const request = https.request(options, (resp) => {
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
