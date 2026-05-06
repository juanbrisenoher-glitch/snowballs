const express = require('express');
const router = express.Router();
const https = require('https');

const GROQ_API_KEY = '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';

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    
    // Get the user's message
    const userMessage = messages?.find(m => m.role === 'user')?.content || 'Hello';
    
    // Call Groq API
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        { 
          role: 'system', 
          content: 'You are MERIDIAN, a helpful Medicare assistant for El Paso, Texas. Answer briefly and helpfully.' 
        },
        ...messages
      ]
    });
    
    const data = await new Promise((resolve, reject) => {
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
          } catch(e) {
            reject(new Error('Failed to parse response'));
          }
        });
      });
      
      request.on('error', reject);
      request.write(body);
      request.end();
    });
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    res.json(data);
    
  } catch(err) {
    console.error('Chat error:', err);
    res.json({
      choices: [{
        message: {
          content: `I'm having trouble connecting right now. Please try again in a moment.`
        }
      }]
    });
  }
});

module.exports = router;
