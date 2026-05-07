require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const chatRouter = require('./routes/chat');
app.use('/api/chat', chatRouter);

// Plans API route
const plansRouter = require('./routes/plans');
app.use('/api/plans', plansRouter);

// Upload API route
const uploadRouter = require('./routes/upload');
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MERIDIAN Backend running on port ${PORT}`);
});
