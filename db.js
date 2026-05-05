const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'meridian.db');
const db = new sqlite3.Database(dbPath);

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS plans (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    generic_name TEXT,
    drug_class TEXT,
    what_it_treats TEXT,
    tier_typical INTEGER,
    avg_monthly_cost_retail INTEGER,
    avg_monthly_cost_medicare INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    what_it_does TEXT,
    who_needs_it TEXT,
    covered_by_medicare INTEGER,
    coverage_notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS procedures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    description TEXT,
    why_needed TEXT,
    recovery_time TEXT,
    typical_copay_medicare INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    phone TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    session_id TEXT PRIMARY KEY,
    name TEXT,
    memory TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Helper functions
function getAll(table) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${table}`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function search(table, query, fields) {
  return new Promise((resolve, reject) => {
    const likeClauses = fields.map(f => `${f} LIKE ?`).join(' OR ');
    const params = fields.map(() => `%${query}%`);
    db.all(`SELECT * FROM ${table} WHERE ${likeClauses} LIMIT 20`, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function upsertUser(sessionId, name, memory) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (session_id, name, memory, last_seen) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(session_id) DO UPDATE SET name = ?, memory = ?, last_seen = CURRENT_TIMESTAMP`,
      [sessionId, name, JSON.stringify(memory), name, JSON.stringify(memory)],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
}

module.exports = { db, getAll, search, upsertUser };
