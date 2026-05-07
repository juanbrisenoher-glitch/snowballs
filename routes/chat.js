const express = require('express');
const router = express.Router();
const https = require('https');
const { pool } = require('../db');

const GROQ_API_KEY = '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';

const conversations = new Map();

// Known utility company URLs for El Paso
const knownUrls = {
  'texas gas': 'https://www.texasgas.com/pay-bill',
  'el paso gas': 'https://www.epgas.com/pay-bill',
  'ep electric': 'https://www.epelectric.com/account/pay-bill',
  'city of el paso water': 'https://www.elpasotexas.gov/utilities/pay-bill',
  'att': 'https://www.att.com/pay-bill',
  'spectrum': 'https://www.spectrum.net/pay-bill'
};

// Improved web search with fallback URLs
async function webSearch(query) {
  const q = query.toLowerCase();
  
  // First, check known URLs
  for (const [company, url] of Object.entries(knownUrls)) {
    if (q.includes(company)) {
      return `Here's the direct link to pay your ${company} bill:\n${url}\n\nYou can also visit their main website for other payment options.`;
    }
  }
  
  // Try DuckDuckGo API
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(`${query} official payment website`);
    
    const options = {
      hostname: 'api.duckduckgo.com',
      path: `/?q=${encodedQuery}&format=json&no_html=1`,
      method: 'GET'
    };
    
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.AbstractURL) {
            resolve(`I found this link for you:\n${json.AbstractURL}\n\nYou can pay your bill there.`);
          } else {
            resolve(`I couldn't find a direct link. Please visit the company's official website or check your latest bill for payment instructions.`);
          }
        } catch (e) {
          resolve(`To pay your bill, please go to the company's official website or use the payment link on your latest bill statement.`);
        }
      });
    });
    
    request.on('error', () => {
      resolve(`To pay your bill, please go to the company's official website or check your latest bill for payment instructions.`);
    });
    request.end();
  });
}

// Check if query is bill payment related
function isBillPaymentQuery(message) {
  const m = message.toLowerCase();
  const billKeywords = ['pay bill', 'payment', 'bill pay', 'pay my bill', 'link to pay', 'where to pay'];
  const utilityKeywords = ['gas', 'electric', 'water', 'utility', 'texas gas', 'el paso gas', 'ep electric'];
  
  return billKeywords.some(k => m.includes(k)) || utilityKeywords.some(k => m.includes(k));
}

// Detect intent
function getIntent(message) {
  const m = message.toLowerCase();
  
  if (isBillPaymentQuery(message)) {
    return { type: 'bill_payment' };
  }
  
  const benefits = ['giveback', 'moop', 'dental', 'vision', 'hearing', 'otc'];
  for (const benefit of benefits) {
    if (m.includes(benefit)) {
      return { type: 'benefit', benefit: benefit };
    }
  }
  
  if (m.match(/^(hi|hello|hey)/)) {
    return { type: 'greeting' };
  }
  
  return { type: 'general' };
}

router.post('/', async (req, res) => {
  try {
    const { message, userId = 'anonymous' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    // Get session
    if (!conversations.has(userId)) {
      conversations.set(userId, { history: [] });
    }
    const session = conversations.get(userId);
    
    session.history.push({ role: 'user', content: message });
    const recentHistory = session.history.slice(-8);
    
    // Build history string
    let historyStr = '';
    for (let i = 0; i < recentHistory.length - 1; i++) {
      const h = recentHistory[i];
      historyStr += `${h.role === 'user' ? 'User' : 'MERIDIAN'}: ${h.content}\n`;
    }
    
    const intent = getIntent(message);
    let webResult = '';
    let dbResult = '';
    
    // Handle bill payment queries directly
    if (intent.type === 'bill_payment') {
      webResult = await webSearch(message);
    }
    
    // Handle Medicare benefit queries
    if (intent.type === 'benefit') {
      try {
        const column = intent.benefit === 'giveback' ? 'giveback' :
                       intent.benefit === 'moop' ? 'moop' :
                       intent.benefit === 'dental' ? 'dental_benefit' :
                       intent.benefit === 'vision' ? 'vision_benefit' : 'hearing_benefit';
        
        const result = await pool.query(
          `SELECT carrier, plan_name, ${column} FROM plans WHERE ${column} IS NOT NULL LIMIT 5`
        );
        if (result.rows.length > 0) {
          dbResult = `\nMEDICARE PLANS:\n${result.rows.map(p => `• ${p.carrier} ${p.plan_name}: ${p[column]}`).join('\n')}`;
        }
      } catch (err) { /* no data */ }
    }
    
    // Build system prompt
    let systemPrompt = `You are MERIDIAN, a helpful assistant.

${historyStr ? `Previous conversation:\n${historyStr}\n` : ''}

${webResult ? `INFORMATION FOR THE USER:\n${webResult}\n` : ''}
${dbResult ? `MEDICARE DATA:\n${dbResult}\n` : ''}

USER'S QUESTION: "${message}"

INSTRUCTIONS:
- If you have a link or direct answer above, give it simply and clearly
- For bill payment questions, PROVIDE THE LINK if you found it
- Be direct and helpful

Respond as MERIDIAN:`;

    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.5,
        max_tokens: 300
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
    
    let reply = response.choices?.[0]?.message?.content || "Let me help you with that.";
    
    session.history.push({ role: 'assistant', content: reply });
    
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "Having trouble. Please try again." });
  }
});

module.exports = router;
