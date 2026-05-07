const express = require('express');
const router = express.Router();
const https = require('https');
const { pool } = require('../db');

const GROQ_API_KEY = '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';

const conversations = new Map();

// Helper to detect what user is asking for
function detectIntent(message) {
  const m = message.toLowerCase();
  
  if (m.includes('giveback') || m.includes('give back') || m.includes('part b reduction')) {
    return 'giveback';
  }
  if (m.includes('moop') || m.includes('max out of pocket') || m.includes('out of pocket max')) {
    return 'moop';
  }
  if (m.includes('dental') || m.includes('teeth') || m.includes('dentist')) {
    return 'dental';
  }
  if (m.includes('vision') || m.includes('eye') || m.includes('glasses')) {
    return 'vision';
  }
  if (m.includes('hearing') || m.includes('ear') || m.includes('hearing aid')) {
    return 'hearing';
  }
  if (m.includes('otc') || m.includes('over the counter')) {
    return 'otc';
  }
  if (m.includes('transportation') || m.includes('ride')) {
    return 'transportation';
  }
  return null;
}

router.post('/', async (req, res) => {
  try {
    const { message, userId = 'anonymous' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    // Get conversation history
    if (!conversations.has(userId)) {
      conversations.set(userId, []);
    }
    const history = conversations.get(userId);
    history.push({ role: 'user', content: message });
    const recentHistory = history.slice(-10);
    
    // Build conversation context
    let conversationContext = '';
    for (let i = 0; i < recentHistory.length - 1; i++) {
      const msg = recentHistory[i];
      conversationContext += `${msg.role === 'user' ? 'User' : 'MERIDIAN'}: ${msg.content}\n`;
    }
    
    // === QUERY DATABASE BASED ON INTENT ===
    let dbData = '';
    const intent = detectIntent(message);
    
    if (intent === 'giveback') {
      try {
        const result = await pool.query(
          `SELECT carrier, plan_name, giveback, premium, moop 
           FROM plans 
           WHERE giveback IS NOT NULL AND giveback > 0 
           ORDER BY giveback DESC 
           LIMIT 5`
        );
        if (result.rows.length > 0) {
          dbData = '\n\n📊 REAL PLAN DATA FROM YOUR DATABASE:\n';
          result.rows.forEach(p => {
            dbData += `• ${p.carrier} ${p.plan_name}: $${p.giveback}/mo giveback, $${p.premium}/mo premium, MOOP $${p.moop}\n`;
          });
        } else {
          dbData = '\n\n📊 No giveback plans found in your database yet. Import your plan data to see real results.\n';
        }
      } catch (err) {
        console.log('Database not ready:', err.message);
        dbData = '\n\n📊 Database not set up yet. Add your plans to get real data!\n';
      }
    }
    
    if (intent === 'moop') {
      try {
        const result = await pool.query(
          `SELECT carrier, plan_name, moop, premium 
           FROM plans 
           WHERE moop IS NOT NULL 
           ORDER BY moop ASC 
           LIMIT 5`
        );
        if (result.rows.length > 0) {
          dbData = '\n\n📊 LOWEST MOOP PLANS FROM YOUR DATABASE:\n';
          result.rows.forEach(p => {
            dbData += `• ${p.carrier} ${p.plan_name}: MOOP $${p.moop}, $${p.premium}/mo premium\n`;
          });
        }
      } catch (err) {
        console.log('Database not ready:', err.message);
      }
    }
    
    if (intent === 'dental') {
      try {
        const result = await pool.query(
          `SELECT carrier, plan_name, dental_benefit, premium 
           FROM plans 
           WHERE dental_benefit IS NOT NULL 
           LIMIT 5`
        );
        if (result.rows.length > 0) {
          dbData = '\n\n🦷 DENTAL BENEFITS FROM YOUR DATABASE:\n';
          result.rows.forEach(p => {
            dbData += `• ${p.carrier} ${p.plan_name}: ${p.dental_benefit}\n`;
          });
        }
      } catch (err) {}
    }
    
    // Build system prompt with database info if available
    let systemPrompt = `You are MERIDIAN, a warm, knowledgeable Medicare assistant for El Paso, Texas.

PERSONALITY: Friendly, conversational, helpful. Greet warmly. Be concise.

${conversationContext ? `PREVIOUS CONVERSATION:\n${conversationContext}\n` : ''}

${dbData ? `REAL DATA FROM USER'S MEDICARE PLANS:\n${dbData}\n` : ''}

CURRENT QUESTION: "${message}"

INSTRUCTIONS:
- If REAL DATA is provided above, USE IT to answer accurately
- If asking about giveback/MOOP/dental and data is shown, give specific numbers
- If no data is shown, explain that you're ready to help once plans are imported
- Be helpful and conversational

Respond as MERIDIAN:`;
    
    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
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
      
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse response'));
          }
        });
      });
      
      request.on('error', reject);
      request.write(body);
      request.end();
    });
    
    let reply = response.choices?.[0]?.message?.content || "I'm here to help with Medicare! What would you like to know?";
    
    history.push({ role: 'assistant', content: reply });
    
    if (history.length > 20) {
      conversations.set(userId, history.slice(-20));
    }
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "Hi! I'm MERIDIAN, your Medicare assistant. What can I help you with today?" });
  }
});

module.exports = router;
module.exports = router;
