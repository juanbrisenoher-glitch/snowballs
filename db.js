const { Pool } = require('pg');

// PostgreSQL connection from Railway environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize tables (PostgreSQL version)
async function initTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        carrier TEXT,
        plan_name TEXT,
        plan_id TEXT,
        plan_type TEXT,
        cat TEXT,
        premium INTEGER,
        giveback REAL,
        moop INTEGER,
        specialist INTEGER,
        pcp INTEGER,
        er INTEGER,
        urgent_care INTEGER,
        hospital TEXT,
        ambulance INTEGER,
        outpatient_surg TEXT,
        mri TEXT,
        xray TEXT,
        labs TEXT,
        med_deduct INTEGER,
        rx_deduct INTEGER,
        rx_copays TEXT,
        dental_benefit TEXT,
        vision_benefit TEXT,
        hearing_benefit TEXT,
        transportation TEXT,
        gym TEXT,
        otc_allowance TEXT,
        food_utilities TEXT,
        pers TEXT,
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS providers (
        id SERIAL PRIMARY KEY,
        npi TEXT,
        name TEXT,
        specialty TEXT,
        clinic_name TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        phone TEXT,
        accepting_new_patients INTEGER,
        languages TEXT,
        plans_accepted TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS medications (
        id SERIAL PRIMARY KEY,
        name TEXT,
        generic_name TEXT,
        drug_class TEXT,
        what_it_treats TEXT,
        tier_typical INTEGER,
        avg_monthly_cost_retail INTEGER,
        avg_monthly_cost_medicare INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        name TEXT,
        category TEXT,
        what_it_does TEXT,
        who_needs_it TEXT,
        covered_by_medicare INTEGER,
        coverage_notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS procedures (
        id SERIAL PRIMARY KEY,
        name TEXT,
        category TEXT,
        description TEXT,
        why_needed TEXT,
        recovery_time TEXT,
        typical_copay_medicare INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name TEXT,
        type TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        phone TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        session_id TEXT PRIMARY KEY,
        name TEXT,
        memory TEXT,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Helper functions (updated for PostgreSQL)
async function getAll(table) {
  try {
    const result = await pool.query(`SELECT * FROM ${table}`);
    return result.rows || [];
  } catch (err) {
    console.error(`Error in getAll(${table}):`, err);
    throw err;
  }
}

async function search(table, query, fields) {
  try {
    const likeClauses = fields.map(f => `${f} ILIKE $${fields.indexOf(f) + 1}`).join(' OR ');
    const params = fields.map(() => `%${query}%`);
    const result = await pool.query(`SELECT * FROM ${table} WHERE ${likeClauses} LIMIT 20`, params);
    return result.rows || [];
  } catch (err) {
    console.error(`Error in search(${table}):`, err);
    throw err;
  }
}

async function upsertUser(sessionId, name, memory) {
  try {
    await pool.query(
      `INSERT INTO users (session_id, name, memory, last_seen) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (session_id) DO UPDATE SET name = $2, memory = $3, last_seen = CURRENT_TIMESTAMP`,
      [sessionId, name, JSON.stringify(memory)]
    );
  } catch (err) {
    console.error('Error in upsertUser:', err);
    throw err;
  }
}

// Run initialization
initTables().catch(console.error);

module.exports = { pool, getAll, search, upsertUser };
