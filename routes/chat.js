const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const GROQ_API_KEY = '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';

// Simple conversation memory
const conversations = new Map();

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
    
    // Add user message
    history.push({ role: 'user', content: message });
    const recentHistory = history.slice(-10);
    
    // Simple database query for plans
    let dbContext = '';
    const msg = message.toLowerCase();
    
    if (msg.includes('giveback')) {
      try {
        const result = await pool.query(
          `SELECT carrier, plan_name, giveback, premium FROM plans 
           WHERE giveback > 0 ORDER BY giveback DESC LIMIT 5`
        );
        if (result.rows.length > 0) {
          dbContext = result.rows.map(p => 
            `${p.carrier} ${p.plan_name}: $${p.giveback}/mo giveback`
          ).join('\n');
        }
      } catch (err) {
        console.log('No plans table yet:', err.message);
      }
    }
    
    // Build prompt with conversation memory
    let systemPrompt = `You are MERIDIAN, a friendly Medicare assistant for El Paso, Texas.

Rules:
- Be warm and conversational
- Say "hi" back when someone says "hi"
- Keep responses concise but friendly
- Remember what was said earlier in this conversation

${dbContext ? `\nHere is some plan data you can use:\n${dbContext}\n` : ''}

Previous conversation:
${recentHistory.slice(0, -1).map(m => `${m.role === 'user' ? 'User' : 'MERIDIAN'}: ${m.content}`).join('\n')}

User's new message: "${message}"

Respond naturally as MERIDIAN.`;
    
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
    let reply = data.choices?.[0]?.message?.content || "I couldn't process that.";
    
    // Add assistant reply to history
    history.push({ role: 'assistant', content: reply });
    
    // Keep history manageable
    if (history.length > 20) {
      conversations.set(userId, history.slice(-20));
    }
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "Hi! I'm here to help with Medicare questions. What would you like to know?" });
  }
});

module.exports = router;
