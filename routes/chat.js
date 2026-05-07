const express = require('express');
const router = express.Router();
const https = require('https');
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
    const recentHistory = history.slice(-6);
    
    // Build conversation context
    let conversationText = '';
    for (let i = 0; i < recentHistory.length - 1; i++) {
      const msg = recentHistory[i];
      conversationText += `${msg.role === 'user' ? 'User' : 'MERIDIAN'}: ${msg.content}\n`;
    }
    
    const systemPrompt = `You are MERIDIAN, a friendly Medicare assistant for El Paso, Texas.

Rules:
- Be warm and conversational
- Say "hi" back when someone says "hi" - respond with something like "Hi there! How can I help with Medicare today?"
- Keep responses concise but friendly
- Remember what was said earlier

${conversationText ? `Previous conversation:\n${conversationText}` : ''}

User: ${message}

Respond as MERIDIAN (short, friendly, helpful):`;
    
    // Use https.request instead of fetch
    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.8,
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
    
    let reply = response.choices?.[0]?.message?.content || "Hi! I'm here to help with Medicare questions.";
    
    // Add assistant reply to history
    history.push({ role: 'assistant', content: reply });
    
    // Keep history manageable
    if (history.length > 20) {
      conversations.set(userId, history.slice(-20));
    }
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "Hi there! I'm MERIDIAN, your Medicare assistant. What can I help you with today?" });
  }
});

module.exports = router;
