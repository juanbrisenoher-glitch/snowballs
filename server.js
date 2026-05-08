require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const chatRouter = require('./routes/chat');
const plansRouter = require('./routes/plans');
const uploadRouter = require('./routes/upload');
const ingestRouter = require('./routes/ingest');
const ragRouter = require('./routes/rag');

app.use('/api/chat', chatRouter);
app.use('/api/plans', plansRouter);
app.use('/api/upload', uploadRouter);
app.use('/api', ingestRouter);
app.use('/api', ragRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MERIDIAN Backend running on port ${PORT}`);
});
