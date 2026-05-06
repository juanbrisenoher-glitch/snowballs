const express = require('express');
const router = express.Router();

// Simple working version - no syntax errors
router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    const userMessage = messages?.find(m => m.role === 'user')?.content || 'No message received';
    
    // Send a simple response
    res.json({
      choices: [{
        message: {
          content: `Backend is working! You said: "${userMessage}". The AI will be connected soon.`
        }
      }]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: { 
        message: 'Server error: ' + error.message 
      } 
    });
  }
});

module.exports = router;
