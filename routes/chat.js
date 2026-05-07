const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const GROQ_API_KEY = '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';

router.post('/', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    let context = '';
    
    // Simple database query based on message
    if (message.toLowerCase().includes('giveback')) {
      const result = await pool.query(
        `SELECT carrier, plan_name, giveback, premium FROM plans 
         WHERE giveback > 0 ORDER BY giveback DESC LIMIT 5`
      );
      if (result.rows.length > 0) {
        context = result.rows.map(p => 
          `${p.carrier} ${p.plan_name}: $${p.giveback}/mo giveback`
        ).join('\n');
      }
    }
    
    const systemPrompt = context ? 
      `You are MERIDIAN. Use this real data to answer:\n${context}` :
      `You are MERIDIAN, a Medicare assistant for El Paso, Texas. Be helpful and concise.`;
    
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
        temperature: 0.7,
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't process that.";
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "I'm having trouble connecting. Please try again." });
  }
});

module.exports = router;
