const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Groq client with API key from environment variable
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.use(express.json());
app.use(express.static('public'));

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful Medicare assistant. Provide accurate, concise information about Medicare benefits, eligibility, enrollment, and plans. Always clarify that you are an AI and recommend consulting official Medicare resources or a licensed agent for personalized advice.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
      // Using a fast, capable free model
      model: 'llama-3.1-8b-instant',
      temperature: 0.5,
      max_tokens: 1024,
    });

    const reply = chatCompletion.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error('Groq API error:', error);
    res.status(500).json({ error: 'Failed to get response from AI. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
