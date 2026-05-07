const express = require('express');
const router = express.Router();
const https = require('https');
const { pool } = require('../db');

const GROQ_API_KEY = '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';

const conversations = new Map();

// Web search function using DuckDuckGo (free, no API key needed)
async function webSearch(query) {
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    
    const options = {
      hostname: 'api.duckduckgo.com',
      path: `/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`,
      method: 'GET',
      headers: {
        'User-Agent': 'MERIDIAN-AI/1.0'
      }
    };
    
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          let results = [];
          
          // Get abstract/summary
          if (json.AbstractText) {
            results.push(json.AbstractText);
          }
          
          // Get related topics
          if (json.RelatedTopics && json.RelatedTopics.length > 0) {
            for (let topic of json.RelatedTopics.slice(0, 3)) {
              if (topic.Text) {
                results.push(topic.Text);
              }
            }
          }
          
          if (results.length > 0) {
            resolve(results.join('\n\n'));
          } else {
            // Fallback: return a search suggestion
            resolve(`I searched for "${query}" but couldn't find specific results. You might want to check Google for the most up-to-date information.`);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    request.on('error', () => resolve(null));
    request.end();
  });
}

// Check if query needs web search
function needsWebSearch(message, intent) {
  const m = message.toLowerCase();
  
  // Off-topic indicators (not Medicare related)
  const offTopicIndicators = [
    'weather', 'bill pay', 'gas bill', 'electric bill', 'pay my bill',
    'restaurant', 'food near me', 'pizza', 'movie', 'news', 'sports',
    'stock', 'price of', 'youtube', 'facebook', 'instagram', 'twitter'
  ];
  
  // Medicare-related indicators
  const medicareIndicators = [
    'medicare', 'plan', 'giveback', 'moop', 'dental', 'vision', 
    'hearing', 'otc', 'prescription', 'drug', 'doctor', 'hospital',
    'premium', 'deductible', 'copay', 'alignment', 'humana', 'cigna'
  ];
  
  const isMedicareRelated = medicareIndicators.some(k => m.includes(k));
  const isOffTopic = offTopicIndicators.some(k => m.includes(k));
  
  // Search web if: off-topic OR (not clearly Medicare AND not already answered by database)
  return isOffTopic || (!isMedicareRelated && intent.type === 'general');
}

// Detect intent
function getIntent(message, lastContext = {}) {
  const m = message.toLowerCase();
  
  if (lastContext.lastTopic && (m.includes('that') || m.includes('it') || m.includes('those'))) {
    return { type: 'follow_up', topic: lastContext.lastTopic };
  }
  
  const benefits = ['giveback', 'moop', 'dental', 'vision', 'hearing', 'otc', 'transportation', 'fitness', 'pers'];
  for (const benefit of benefits) {
    if (m.includes(benefit)) {
      return { type: 'benefit', benefit: benefit };
    }
  }
  
  if (m.match(/^(hi|hello|hey|good morning|good afternoon)/)) {
    return { type: 'greeting' };
  }
  
  const carriers = ['alignment', 'humana', 'cigna', 'wellpoint', 'amerigroup', 'devoted', 'aetna', 'uhc'];
  for (const carrier of carriers) {
    if (m.includes(carrier)) {
      return { type: 'carrier', carrier: carrier };
    }
  }
  
  return { type: 'general' };
}

router.post('/', async (req, res) => {
  try {
    const { message, userId = 'anonymous' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    // Get or create user session
    if (!conversations.has(userId)) {
      conversations.set(userId, { history: [], lastContext: {} });
    }
    const session = conversations.get(userId);
    
    session.history.push({ role: 'user', content: message, timestamp: Date.now() });
    const recentHistory = session.history.slice(-10);
    
    const intent = getIntent(message, session.lastContext);
    
    // Update context
    if (intent.type === 'carrier' || intent.type === 'benefit') {
      session.lastContext = { lastTopic: intent.type === 'carrier' ? intent.carrier : intent.benefit };
    }
    
    // Build conversation history
    let historyStr = '';
    for (let i = 0; i < recentHistory.length - 1; i++) {
      const h = recentHistory[i];
      historyStr += `${h.role === 'user' ? 'User' : 'MERIDIAN'}: ${h.content}\n`;
    }
    
    // Query database for Medicare plans
    let dbData = '';
    if (intent.type === 'benefit') {
      try {
        const columnMap = {
          giveback: 'giveback', moop: 'moop', dental: 'dental_benefit',
          vision: 'vision_benefit', hearing: 'hearing_benefit', otc: 'otc_allowance',
          transportation: 'transportation', fitness: 'gym', pers: 'pers'
        };
        const column = columnMap[intent.benefit];
        if (column) {
          const result = await pool.query(
            `SELECT carrier, plan_name, ${column} FROM plans WHERE ${column} IS NOT NULL LIMIT 5`
          );
          if (result.rows.length > 0) {
            dbData = `\n📊 REAL PLAN DATA:\n`;
            result.rows.forEach(p => {
              dbData += `• ${p.carrier} ${p.plan_name}: ${p[column]}\n`;
            });
          }
        }
      } catch (err) { /* No data yet */ }
    }
    
    // Check if we need to search the web
    let webResults = '';
    const shouldSearchWeb = needsWebSearch(message, intent);
    
    if (shouldSearchWeb) {
      webResults = await webSearch(message);
      if (webResults) {
        webResults = `\n🌐 WEB SEARCH RESULTS for "${message}":\n${webResults}\n`;
      }
    }
    
    // Build system prompt
    let systemPrompt = `You are MERIDIAN — a brilliant, warm assistant. You have TWO specialties:

1. MEDICARE EXPERT: You know Medicare plans inside out for El Paso, Texas
2. GENERAL ASSISTANT: You can help with basic web searches for things like bill pay, weather, etc.

${historyStr ? `CONVERSATION SO FAR:\n${historyStr}\n` : ''}

${dbData ? `DATABASE RESULTS (use these for Medicare questions):\n${dbData}\n` : ''}

${webResults ? `WEB RESULTS (use these for non-Medicare questions):\n${webResults}\n` : ''}

USER'S QUESTION: "${message}"

INSTRUCTIONS:
- If the question is about MEDICARE plans, benefits, or coverage → use DATABASE RESULTS
- If the question is about ANYTHING ELSE (bill pay, weather, general info) → use WEB RESULTS  
- Be conversational, helpful, and concise
- If you used web results, say something like "I searched online and found..."

Now respond as MERIDIAN:`;

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
    
    let reply = response.choices?.[0]?.message?.content || "I'm here to help! What would you like to know?";
    
    session.history.push({ role: 'assistant', content: reply, timestamp: Date.now() });
    
    if (session.history.length > 30) {
      session.history = session.history.slice(-30);
    }
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "Having trouble connecting. Please try again." });
  }
});

module.exports = router;
