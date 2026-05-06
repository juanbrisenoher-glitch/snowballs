const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    const userMessage = messages?.find(m => m.role === 'user')?.content || 'No message';
    
    res.json({
      choices: [{
        message: {
          content: `Backend working! You said: "${userMessage}"`
        }
      }]
    });
  } catch(err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
