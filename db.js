// Minimal db.js to satisfy dependencies
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function getAll(table) {
  try {
    const result = await pool.query(`SELECT * FROM ${table} LIMIT 10`);
    return result.rows;
  } catch (err) {
    console.error('Database error:', err);
    return [];
  }
}

async function search(table, query, fields) {
  try {
    const result = await pool.query(`SELECT * FROM ${table} LIMIT 10`);
    return result.rows;
  } catch (err) {
    return [];
  }
}

async function upsertUser(sessionId, name, memory) {
  // Minimal implementation
  return Promise.resolve();
}

module.exports = { pool, getAll, search, upsertUser };
