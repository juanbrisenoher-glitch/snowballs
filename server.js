const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Simple in-memory fallback (no database required to keep server running)
let simpleMemory = {};

// Health check — always works
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'MERIDIAN backend is running'
  });
});

// Simple chat endpoint that doesn't need database
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  const lastMsg = messages?.[messages.length - 1]?.content || '';
  
  // Simple fallback responses (works even without API key)
  let reply = "I'm MERIDIAN AI. I can help you find Medicare plans, check drug coverage, or explain benefits. What would you like to know?";
  
  if (lastMsg.toLowerCase().includes('giveback')) {
    reply = "💰 Plans with Part B Giveback include:\n• HealthSpring Preferred Savings — $145/mo\n• HumanaChoice Giveback PPO — $120/mo\n• Alignment SmartSavings — $164.90/mo\n• Devoted Giveback — $184.70/mo\n• Wellcare Giveback HMO — $124/mo\n\nWant me to show you the lowest MOOP plans?";
  } else if (lastMsg.toLowerCase().includes('moop')) {
    reply = "📋 Lowest MOOP plans:\n• Alignment Heart & Diabetes — $2,400\n• Alignment the One + Walgreens — $2,950\n• Humana Gold Plus — $3,350\n• HealthSpring Preferred — $3,500\n\nSeveral D-SNP plans have $0 MOOP — would you like to see those?";
  } else if (lastMsg.toLowerCase().includes('dental')) {
    reply = "🦷 Best dental benefits:\n• Devoted Core 007 — $3,500 reimbursement\n• Humana Gold Plus $14 — $5,000 (covers dentures)\n• Alignment Total Dual+ — $4,000\n• Wellcare Dual Liberty — $4,000\n\nWant details on any of these?";
  }
  
  res.json({ 
    choices: [{ 
      message: { content: reply } 
    }] 
  });
});

// Serve static files if public folder exists
app.use(express.static(path.join(__dirname, 'public'), { fallthrough: true }));

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) res.status(200).send('MERIDIAN Backend Running');
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MERIDIAN backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
