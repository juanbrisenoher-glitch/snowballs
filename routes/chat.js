const express = require('express');
const router = express.Router();
const https = require('https');
const { pool } = require('../db');

const GROQ_API_KEY = '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';

// Store full conversation history per user
const userSessions = new Map();

// Intelligent intent detection with fuzzy matching
function getIntent(message, lastContext = {}) {
  const m = message.toLowerCase();
  
  // Handle follow-ups based on previous context
  if (lastContext.lastTopic && (m.includes('that') || m.includes('it') || m.includes('those'))) {
    return { type: 'follow_up', topic: lastContext.lastTopic };
  }
  
  // Check for plan comparisons
  if (m.includes('compare') || (m.includes('vs') || m.includes('versus'))) {
    return { type: 'comparison' };
  }
  
  // Benefit inquiries
  const benefits = ['giveback', 'moop', 'dental', 'vision', 'hearing', 'otc', 'transportation', 'fitness', 'pers'];
  for (const benefit of benefits) {
    if (m.includes(benefit) || fuzzyMatch(m, benefit)) {
      return { type: 'benefit', benefit: benefit };
    }
  }
  
  // Greetings
  if (m.match(/^(hi|hello|hey|good morning|good afternoon|howdy)/)) {
    return { type: 'greeting' };
  }
  
  // Gratitude
  if (m.includes('thank') || m.includes('thanks') || m === 'ty') {
    return { type: 'thanks' };
  }
  
  // Carrier specific
  const carriers = ['alignment', 'humana', 'cigna', 'wellpoint', 'amerigroup', 'devoted', 'aetna', 'uhc', 'united'];
  for (const carrier of carriers) {
    if (m.includes(carrier)) {
      return { type: 'carrier', carrier: carrier };
    }
  }
  
  return { type: 'general' };
}

function fuzzyMatch(str, pattern) {
  // Simple fuzzy: checks if all letters of pattern appear in order in str
  let patternIdx = 0;
  for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
    if (str[i] === pattern[patternIdx]) patternIdx++;
  }
  return patternIdx === pattern.length;
}

router.post('/', async (req, res) => {
  try {
    const { message, userId = 'anonymous' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    // Get or create user session
    if (!userSessions.has(userId)) {
      userSessions.set(userId, { history: [], lastContext: {} });
    }
    const session = userSessions.get(userId);
    
    // Add user message to history
    session.history.push({ role: 'user', content: message, timestamp: Date.now() });
    
    // Keep last 15 messages for context
    const recentHistory = session.history.slice(-15);
    
    // Detect intent with context awareness
    const intent = getIntent(message, session.lastContext);
    
    // Update last context for follow-ups
    if (intent.type === 'carrier' || intent.type === 'benefit') {
      session.lastContext = { lastTopic: intent.type === 'carrier' ? intent.carrier : intent.benefit };
    }
    
    // Build conversation history string
    let historyStr = '';
    for (let i = 0; i < recentHistory.length - 1; i++) {
      const h = recentHistory[i];
      historyStr += `${h.role === 'user' ? 'User' : 'MERIDIAN'}: ${h.content}\n`;
    }
    
    // Try to query database if we have data
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
            dbData = `\n[REAL DATA FROM YOUR PLANS]\n`;
            result.rows.forEach(p => {
              dbData += `• ${p.carrier} ${p.plan_name}: ${p[column]}\n`;
            });
          }
        }
      } catch (err) {
        // No data yet, that's fine
      }
    }
    
    // The super smart system prompt
    const systemPrompt = `You are MERIDIAN — a brilliant, warm, and trustworthy Medicare assistant based in El Paso, Texas.

YOUR PERSONALITY:
- You talk like a real person — no robotic scripts, no fake enthusiasm
- When someone says "hi", you say "hi" back naturally
- You remember what people tell you in this conversation
- You're patient with typos and different ways of asking the same thing
- If you're not sure what someone means, you ask a clarifying question

YOUR EXPERTISE:
- Medicare Advantage plans (HMO, PPO, D-SNP, C-SNP)
- Part B giveback amounts, MOOP, deductibles
- Dental, vision, hearing benefits
- OTC allowances, transportation, fitness memberships, PERS
- Prescription drug tiers and formularies
- Provider networks in El Paso and Hudspeth counties

CONVERSATION SO FAR:
${historyStr || "(This is the start of the conversation)"}

DETECTED INTENT: ${intent.type}${intent.carrier ? ` - ${intent.carrier}` : ''}${intent.benefit ? ` - ${intent.benefit}` : ''}

${dbData ? `DATABASE RESULTS:\n${dbData}\n` : '(No matching plan data in database yet - speak generally about Medicare)'}

USER'S MESSAGE: "${message}"

YOUR RESPONSE GUIDELINES:
1. Be conversational and natural
2. If they greeted you, greet back and ask how you can help
3. If they thanked you, say "you're welcome"
4. If you have real data above, use those exact numbers
5. If they're asking about a specific carrier or benefit, focus on that
6. Keep responses concise but helpful — 2-4 sentences usually
7. Never say "as an AI" or "I don't have feelings" — just be human

Now respond as MERIDIAN:`;

    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.85,
        max_tokens: 450
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
    
    // Clean up any odd formatting
    reply = reply.replace(/^["']|["']$/g, '');
    
    // Add assistant reply to history
    session.history.push({ role: 'assistant', content: reply, timestamp: Date.now() });
    
    // Trim old history (keep last 30 messages)
    if (session.history.length > 30) {
      session.history = session.history.slice(-30);
    }
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "Hey! I'm MERIDIAN. Having a little trouble connecting right now. Can you try again?" });
  }
});

module.exports = router;
module.exports = router;
module.exports = router;
