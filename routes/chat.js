const express = require('express');
const router = express.Router();
const https = require('https');

const GROQ_API_KEY = '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';

// Store conversations by user ID
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
    
    // Keep only last 10 messages for context
    const recentHistory = history.slice(-10);
    
    // Build conversation context string
    let conversationContext = '';
    for (let i = 0; i < recentHistory.length - 1; i++) {
      const msg = recentHistory[i];
      conversationContext += `${msg.role === 'user' ? 'User' : 'MERIDIAN'}: ${msg.content}\n`;
    }
    
    const systemPrompt = `You are MERIDIAN, a warm, knowledgeable Medicare assistant for El Paso, Texas.

PERSONALITY:
- Friendly and conversational, like a helpful neighbor
- Say "hi" back naturally when greeted
- Use the person's name if they share it
- Be concise but not robotic

MEMORY:
${conversationContext || "This is the start of the conversation."}

Current message from user: "${message}"

IMPORTANT: 
- If this is a greeting, respond warmly and ask how you can help
- If they're asking about Medicare, be helpful
- Remember what they've said earlier in this conversation

Respond as MERIDIAN (friendly, helpful, conversational):`;
    
    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.8,
        max_tokens: 400
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
    
    let reply = response.choices?.[0]?.message?.content || "I'm here to help with Medicare questions! What would you like to know?";
    
    // Add assistant reply to history
    history.push({ role: 'assistant', content: reply });
    
    // Keep only last 20 messages total
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
