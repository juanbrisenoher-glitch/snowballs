const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Hardcoded URL exactly as you provided
const DATABASE_URL = 'postgresql://postgres:dSKgiSWkgHDXHaxxULtGRgynxHDjfGtN@postgres.railway.internal:5432/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get('/api/check', async (req, res) => {
  try {
    const result = await pool.query('SELECT current_database() as db, COUNT(*) FROM documents');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
