require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// ── Serve frontend ─────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ─────────────────────────────────────────
app.use('/api/chat', require('./routes/chat'));
app.use('/api/data', require('./routes/data'));
app.use('/api/import', require('./routes/import'));

// ── Health check ───────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'MERIDIAN Backend', 
    timestamp: new Date().toISOString() 
  });
});

// ── Root route ───────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'MERIDIAN Backend API is running', status: 'ok' });
});

// ── Catch all → serve index.html ───────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start server ───────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MERIDIAN Backend running on port ${PORT}`);
});
