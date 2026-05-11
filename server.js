const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.use(express.json());
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful Medicare assistant. Provide accurate, concise information. Clarify that you are an AI and recommend consulting official sources.',
        },
        { role: 'user', content: message },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.5,
      max_tokens: 1024,
    });
    res.json({ reply: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get response from AI.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
