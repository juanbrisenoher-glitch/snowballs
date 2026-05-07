const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const GROQ_API_KEY = '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';

// Simple in-memory conversation storage (per user)
const conversations = new Map();

router.post('/', async (req, res) => {
  try {
    const { message, userId = 'anonymous' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    // Get or create conversation history for this user
    if (!conversations.has(userId)) {
      conversations.set(userId, []);
    }
    const history = conversations.get(userId);
    
    // Add user message to history
    history.push({ role: 'user', content: message });
    
    // Keep only last 10 messages to save tokens
    const recentHistory = history.slice(-10);
    
    // Query database for relevant info based on message
    let dbContext = '';
    const msg = message.toLowerCase();
    
    if (msg.includes('giveback') || msg.includes('give back')) {
      const result = await pool.query(
        `SELECT carrier, plan_name, giveback, premium FROM plans 
         WHERE giveback > 0 ORDER BY giveback DESC LIMIT 5`
      );
      if (result.rows.length > 0) {
        dbContext = `\n\nREAL PLANS WITH GIVEBACK:\n${result.rows.map(p => 
          `• ${p.carrier} ${p.plan_name}: $${p.giveback}/mo giveback, $${p.premium}/mo premium`
        ).join('\n')}`;
      }
    }
    
    if (msg.includes('moop') || msg.includes('out of pocket')) {
      const result = await pool.query(
        `SELECT carrier, plan_name, moop, premium FROM plans 
         WHERE moop IS NOT NULL ORDER BY moop ASC LIMIT 5`
      );
      if (result.rows.length > 0) {
        dbContext = `\n\nLOWEST MOOP PLANS:\n${result.rows.map(p => 
          `• ${p.carrier} ${p.plan_name}: MOOP $${p.moop}, $${p.premium}/mo premium`
        ).join('\n')}`;
      }
    }
    
    const systemPrompt = `You are MERIDIAN, a warm, friendly Medicare assistant for El Paso, Texas.

IMPORTANT RULES:
1. Have a natural conversation - greet back, ask questions, be human-like
2. If someone says "hi", say "hi" back naturally
3. Remember what they said earlier in this conversation
4. Use the data below if relevant, but don't force it
5. Be concise but friendly
6. Handle typos and different ways of asking the same thing

${dbContext ? `\nHERE IS REAL PLAN DATA YOU CAN USE:\n${dbContext}\n` : ''}

Previous conversation:
${recentHistory.slice(0, -1).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

Current question: ${message}

Answer naturally as MERIDIAN.`;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.8,
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't process that.";
    
    // Add assistant reply to history
    history.push({ role: 'assistant', content: reply });
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "I'm having trouble connecting. Please try again." });
  }
});

module.exports = router;
