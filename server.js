const express = require('express');
const path = require('path');
const Groq = require('groq-sdk');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Hardcoded URL – exactly from your Postgres-vgQH variables
const DATABASE_URL = 'postgresql://postgres:dSKgiSWkgHDXHaxxULtGRgynxHDjfGtN@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Force schema
pool.query('SET search_path TO public;').catch(console.error);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static('public'));

// ------------------------------------------------------------------
// TEST ENDPOINT – runs a direct SQL query to check table
// ------------------------------------------------------------------
app.get('/api/test-db', async (req, res) => {
  try {
    const dbName = await pool.query('SELECT current_database() as db');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'documents'
      ) as exists;
    `);
    let rowCount = 0;
    if (tableCheck.rows[0].exists) {
      const count = await pool.query('SELECT COUNT(*) FROM public.documents');
      rowCount = parseInt(count.rows[0].count);
    }
    res.json({
      database: dbName.rows[0].db,
      table_exists: tableCheck.rows[0].exists,
      documents_count: rowCount,
      connection_string_used: DATABASE_URL.substring(0, 40) + '...'
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ------------------------------------------------------------------
// CHAT ENDPOINT (with full schema qualification)
// ------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const result = await pool.query(
      `SELECT filename, content FROM public.documents 
       WHERE content ILIKE $1 OR filename ILIKE $1
       LIMIT 5`,
      [`%${message}%`]
    );

    if (result.rows.length === 0) {
      return res.json({ reply: "No matching information in uploaded documents." });
    }

    const context = result.rows.map(r => `[${r.filename}]\n${r.content.substring(0,2000)}`).join('\n\n');
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: `Answer ONLY using the context below. If not found, say "I don't know".\n\nContext:\n${context}` },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Upload endpoint
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const filename = req.file.originalname;
    const content = req.file.buffer.toString('utf-8');
    const result = await pool.query(
      'INSERT INTO public.documents (filename, content) VALUES ($1, $2) RETURNING id',
      [filename, content]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
