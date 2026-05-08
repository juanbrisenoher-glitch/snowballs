const express = require('express');
const router = express.Router();
const https = require('https');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// TEMPORARY hardcoded key – replace with your valid key
const GROQ_API_KEY = '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';

// Load documents into memory cache
async function loadDocuments() {
  try {
    const result = await pool.query('SELECT filename, content, plan_name FROM documents');
    global.documentCache = result.rows;
    console.log(`📚 Loaded ${global.documentCache.length} documents with plan names`);
  } catch (err) {
    console.error('Failed to load documents:', err.message);
    global.documentCache = [];
  }
}
loadDocuments();

// Get all distinct plan names
async function getAllPlanNames() {
  const result = await pool.query('SELECT DISTINCT plan_name FROM documents WHERE plan_name IS NOT NULL AND plan_name != \'\' ORDER BY plan_name');
  return result.rows.map(row => row.plan_name);
}

// Detect plan name from user question
function detectPlanName(question) {
  const q = question.toLowerCase();
  const planKeywords = [
    { name: 'Alignment Health the ONE + Walgreens (HMO-POS)', keywords: ['one + walgreens', 'the one', 'one walgreens', 'h5472-001'] },
    { name: 'Alignment Health smartSavings (HMO-POS)', keywords: ['smartsavings', 'smart savings', 'h5472-010'] },
    { name: 'Alignment Health Heart & Diabetes (HMO-POS C-SNP)', keywords: ['heart & diabetes', 'heart and diabetes', 'h5472-002', 'c-snp'] },
    { name: 'Alignment Health Dual Select+ (HMO-POS D-SNP)', keywords: ['dual select', 'd-snp', 'h5472-007'] },
    { name: 'Alignment Health Total Dual+ (HMO-POS D-SNP)', keywords: ['total dual', 'h5472-009'] }
  ];
  for (const plan of planKeywords) {
    for (const kw of plan.keywords) {
      if (q.includes(kw)) return plan.name;
    }
  }
  return null;
}

// Directly search for a drug name within a document's content (full text)
function findDrugDetails(docContent, drugName) {
  const lines = docContent.split('\n');
  const drugLower = drugName.toLowerCase();
  const relevantLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(drugLower)) {
      // capture this line and the next few lines (often contains tier, QL)
      let block = lines[i];
      for (let j = i+1; j < Math.min(i+5, lines.length); j++) {
        block += '\n' + lines[j];
      }
      relevantLines.push(block);
      i += 4; // skip ahead to avoid duplicates
    }
  }
  return relevantLines.join('\n\n');
}

// Enhanced chunk retrieval: for drug questions, use full document search
function findRelevantChunks(question, documents, planName = null, maxChunks = 6) {
  const words = question.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (!documents.length) return [];

  // Filter by plan name if specified
  let filteredDocs = documents;
  if (planName) {
    filteredDocs = documents.filter(doc => doc.plan_name && doc.plan_name.toLowerCase() === planName.toLowerCase());
    if (filteredDocs.length === 0) {
      console.log(`⚠️ No docs for plan "${planName}", using all documents.`);
      filteredDocs = documents;
    }
  }

  // Check if this is a drug‑specific question
  const isDrugQuery = words.some(w => w.match(/^(metformin|eliquis|ozempic|insulin|lisinopril|atorvastatin|glipizide|glyburide)$/i)) ||
                      question.toLowerCase().includes('tier') ||
                      question.toLowerCase().includes('quantity limit') ||
                      question.toLowerCase().includes('prior auth');

  if (isDrugQuery) {
    // Extract the drug name (take the first long word that looks like a drug)
    const drugNameMatch = question.match(/\b([A-Za-z]+(?:[ -][A-Za-z]+)*)\b/i);
    const drugName = drugNameMatch ? drugNameMatch[1] : words[0];
    let fullContext = '';
    for (const doc of filteredDocs) {
      const details = findDrugDetails(doc.content, drugName);
      if (details) {
        fullContext += `\n--- From ${doc.filename} ---\n${details}\n`;
      }
    }
    if (fullContext) {
      // return as a single chunk (the whole extracted block)
      return [fullContext];
    }
  }

  // Standard chunking (increase chunk size and number)
  const chunks = [];
  for (const doc of filteredDocs) {
    for (let i = 0; i < doc.content.length; i += 2000) {  // larger chunk size
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

    // Handle plan listing
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('what plans') || lowerMsg.includes('list plans') || lowerMsg.includes('which plans') || lowerMsg.includes('plans do you have')) {
      const planNames = await getAllPlanNames();
      if (planNames.length > 0) {
        const planList = planNames.map((name, i) => `${i+1}. ${name}`).join('\n');
        return res.json({ reply: `Here are the Medicare plans I have documents for:\n${planList}\n\nAsk me about any of them for details.` });
      } else {
        return res.json({ reply: 'I don’t have any plan documents yet. Please upload PDFs first using the "Ingest Documents" section.' });
      }
    }

    const planName = detectPlanName(message);
    const docs = global.documentCache || [];
    const relevantChunks = findRelevantChunks(message, docs, planName);
    const context = relevantChunks.join('\n\n').slice(0, 8000);  // larger context limit

    let systemPrompt = `You are MERIDIAN, a Medicare assistant. Use the context below to answer. If the answer is not in the context, say "I don't have that information in my documents."`;
    if (planName) {
      systemPrompt += `\n\nThe user asked about the plan "${planName}". Only use the context that comes from that plan.`;
    }
    systemPrompt += `\n\nCONTEXT:\n${context || "No relevant documents found."}\n\nAnswer the user's question concisely and include specific numbers (tier, copay, quantity limits) if available.`;

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
