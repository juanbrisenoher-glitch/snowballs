const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'MERIDIAN backend is running'
  });
});

// Smart chat endpoint — no database, no external API
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  const lastMsg = messages?.[messages.length - 1]?.content?.toLowerCase() || '';
  
  let reply = "I'm MERIDIAN AI. I can help you find Medicare plans, check drug coverage, or explain benefits. Try asking:\n\n• 'Which plans have giveback?'\n• 'Show me lowest MOOP plans'\n• 'What dental benefits are available?'\n• 'What is a D-SNP plan?'";
  
  if (lastMsg.includes('giveback')) {
    reply = "💰 **Plans with Part B Giveback:**\n\n• HealthSpring Preferred Savings — $145/mo\n• HumanaChoice Giveback PPO — $120/mo\n• Alignment SmartSavings — $164.90/mo\n• Devoted Giveback — $184.70/mo\n• Wellcare Giveback HMO — $124/mo\n\nWant me to show you the lowest MOOP plans?";
  }
  else if (lastMsg.includes('moop') || lastMsg.includes('out of pocket')) {
    reply = "📋 **Lowest MOOP plans:**\n\n• Alignment Heart & Diabetes — $2,400\n• Alignment the One + Walgreens — $2,950\n• Humana Gold Plus — $3,350\n• HealthSpring Preferred — $3,500\n\n✨ Several D-SNP plans have **$0 MOOP** — Wellpoint Full Dual, UHC Dual Complete, Humana D-SNP. Want to see those?";
  }
  else if (lastMsg.includes('dental')) {
    reply = "🦷 **Best dental benefits:**\n\n• Devoted Core 007 — $3,500 reimbursement\n• Humana Gold Plus $14 — $5,000 (covers dentures)\n• Alignment Total Dual+ — $4,000\n• Wellcare Dual Liberty — $4,000\n\nWould you like more details on any of these?";
  }
  else if (lastMsg.includes('vision')) {
    reply = "👓 **Vision benefits:**\n\n• Wellpoint Full Dual — $250 allowance\n• UHC Dual Complete TX-S4 — $350 allowance\n• Humana Gold Plus $14 — $350 allowance\n• Alignment Total Dual+ — $400 every 2 years\n\nWant to know which plans have the best hearing benefits?";
  }
  else if (lastMsg.includes('hearing')) {
    reply = "🦻 **Hearing benefits:**\n\n• Wellpoint Full Dual — $3,000 allowance\n• UHC Dual Complete TX-S4 — $2,500 every 2 years\n• Wellcare Dual Liberty — $2,000 allowance\n• Alignment Total Dual+ — basic aids included\n\nNeed help with something else?";
  }
  else if (lastMsg.includes('transport') || lastMsg.includes('ride')) {
    reply = "🚗 **Transportation benefits:**\n\n• HealthSpring Preferred — UNLIMITED trips\n• Humana Gold Plus $14 — 100 one-way trips\n• UHC Dual Complete TX-S4 — 48 one-way trips\n• Wellpoint Full Dual — 48 one-way trips\n\nWhich plan interests you most?";
  }
  else if (lastMsg.includes('otc') || lastMsg.includes('over the counter')) {
    reply = "💊 **OTC allowances:**\n\n• Humana D-SNP — $215/month\n• Alignment Total Dual+ — $193/month\n• UHC Dual Complete TX-S4 — $143/month\n• Wellcare Dual Liberty — $123/month\n• Wellpoint Full Dual — $105/month\n\nWant to compare these plans in more detail?";
  }
  else if (lastMsg.includes('d-snp') || lastMsg.includes('dual eligible')) {
    reply = "🏷️ **D-SNP plans (for dual-eligible Medicare + Medicaid):**\n\n• Wellpoint Full Dual — $0 MOOP, $3k hearing, $105 OTC\n• UHC Dual Complete TX-S4 — $0 MOOP, $143 OTC\n• Humana D-SNP — $0 MOOP, $215 OTC\n• Alignment Total Dual+ — $0 MOOP, $4k dental\n\nWould you like me to explain eligibility requirements?";
  }
  else if (lastMsg.includes('c-snp') || lastMsg.includes('chronic')) {
    reply = "🫀 **C-SNP plans (chronic conditions like diabetes/heart disease):**\n\n• Alignment Heart & Diabetes — MOOP $2,400, $40 OTC\n• Humana C-SNP — MOOP $3,450, $75 OTC rollover\n• Devoted C-SNP — MOOP $3,750\n\nDo you have a specific chronic condition you need covered?";
  }
  else if (lastMsg.includes('eliquis')) {
    reply = "💊 **Eliquis coverage:**\n\n• UHC Dual Complete — $0 copay, no prior auth\n• Wellcare Dual Liberty — $0 copay, no prior auth\n• Alignment — $45 copay, prior auth required\n• Humana — $45 copay, prior auth required\n• Devoted — 24% coinsurance, prior auth required\n\nNeed information about another medication?";
  }
  else if (lastMsg.includes('humira')) {
    reply = "💉 **Humira coverage:**\n\n• UHC Dual Complete — $0 copay, no prior auth\n• Alignment — 32% coinsurance, prior auth required\n• Humana — 35% coinsurance, prior auth required\n• Devoted — 43% coinsurance, prior auth required\n\nWould you like to see alternative medications?";
  }
  else if (lastMsg.includes('ozempic')) {
    reply = "💊 **Ozempic coverage:**\n\n• UHC Dual Complete — $0 copay, no prior auth\n• Alignment — $45 copay, prior auth required\n\nOzempic is typically Tier 3 on most plans. Would you like to compare with other diabetes medications?";
  }
  
  res.json({ 
    choices: [{ 
      message: { content: reply } 
    }] 
  });
});

// Serve static files if public folder exists
app.use(express.static(path.join(__dirname, 'public'), { fallthrough: true }));

// Catch-all for frontend routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>MERIDIAN Backend</title></head>
        <body>
          <h1>MERIDIAN API Running ✅</h1>
          <p>Health check: <a href="/api/health">/api/health</a></p>
          <p>Chat endpoint: POST /api/chat</p>
        </body>
        </html>
      `);
    }
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MERIDIAN backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
