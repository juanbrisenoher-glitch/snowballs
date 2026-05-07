// routes/chat.js
import express from 'express';
import pkg from 'pg';
import Groq from 'groq-sdk';
import Fuse from 'fuse.js';

const { Pool } = pkg;
const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ---------- conversation memory (users table) ----------
async function ensureMemTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}
ensureMemTable().catch(console.error);

async function getHistory(userId) {
  const { rows } = await pool.query('SELECT history FROM users WHERE id=$1', [userId]);
  return rows[0]?.history ?? [];
}
async function saveHistory(userId, history) {
  const trimmed = history.slice(-20); // keep last 20 turns
  await pool.query(`
    INSERT INTO users (id, history, updated_at) VALUES ($1, $2, NOW())
    ON CONFLICT (id) DO UPDATE SET history=$2, updated_at=NOW();
  `, [userId, JSON.stringify(trimmed)]);
}

// ---------- intent classification ----------
const INTENT_SYSTEM = `You classify a Medicare shopper's question. Return ONLY JSON:
{
 "intent": "list_giveback" | "lowest_moop" | "dental" | "vision" | "otc" | "plan_detail" | "carrier_overview" | "general",
 "carrier": "Alignment Health"|"Humana"|"Cigna"|"Wellpoint"|"Amerigroup"|"Devoted Health"|null,
 "plan_query": string|null,    // free-text plan name the user mentioned (e.g. "heart diabetes")
 "limit": number|null
}
Use prior conversation to resolve pronouns ("what about Humana?" → carrier=Humana).`;

async function classify(message, history) {
  const r = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: INTENT_SYSTEM },
      ...history.slice(-6),
      { role: 'user', content: message },
    ],
  });
  try { return JSON.parse(r.choices[0].message.content); }
  catch { return { intent: 'general', carrier: null, plan_query: null, limit: null }; }
}

// ---------- fuzzy plan finder ----------
async function fuzzyFindPlans(query, carrier) {
  const params = [];
  let sql = 'SELECT * FROM plans';
  if (carrier) { params.push(carrier); sql += ` WHERE lower(carrier)=lower($${params.length})`; }
  const { rows } = await pool.query(sql, params);
  if (!query) return rows;
  const fuse = new Fuse(rows, {
    keys: ['plan_name', 'carrier', 'contract_id', 'raw_excerpt'],
    threshold: 0.4, ignoreLocation: true,
  });
  return fuse.search(query).map(r => r.item);
}

// ---------- intent → SQL ----------
async function runIntent(intent) {
  switch (intent.intent) {
    case 'list_giveback': {
      const { rows } = await pool.query(
        `SELECT carrier, plan_name, giveback, premium FROM plans
         WHERE giveback IS NOT NULL AND giveback > 0
         ORDER BY giveback DESC LIMIT $1`, [intent.limit ?? 10]);
      return { kind: 'list', label: 'Plans with Part B giveback', rows };
    }
    case 'lowest_moop': {
      const { rows } = await pool.query(
        `SELECT carrier, plan_name, moop, premium FROM plans
         WHERE moop IS NOT NULL ORDER BY moop ASC LIMIT $1`, [intent.limit ?? 5]);
      return { kind: 'list', label: 'Lowest MOOP plans', rows };
    }
    case 'dental':
    case 'vision':
    case 'otc': {
      const col = intent.intent === 'otc' ? 'otc_allowance'
                 : intent.intent === 'dental' ? 'dental_benefit' : 'vision_benefit';
      const params = []; let where = `${col} IS NOT NULL`;
      if (intent.carrier) { params.push(intent.carrier); where += ` AND lower(carrier)=lower($${params.length})`; }
      const { rows } = await pool.query(
        `SELECT carrier, plan_name, ${col} AS detail FROM plans WHERE ${where} LIMIT 15`, params);
      return { kind: 'list', label: `${intent.intent.toUpperCase()} benefits`, rows };
    }
    case 'plan_detail': {
      const matches = await fuzzyFindPlans(intent.plan_query, intent.carrier);
      return { kind: 'detail', rows: matches.slice(0, 3) };
    }
    case 'carrier_overview': {
      const { rows } = await pool.query(
        `SELECT plan_name, premium, moop, giveback FROM plans
         WHERE lower(carrier)=lower($1) ORDER BY premium NULLS LAST`, [intent.carrier]);
      return { kind: 'list', label: `${intent.carrier} plans`, rows };
    }
    default:
      return { kind: 'none', rows: [] };
  }
}

// ---------- final answer ----------
const ANSWER_SYSTEM = `You are MERIDIAN, a friendly Medicare plan assistant.
Use ONLY the JSON facts provided to answer. If facts are empty, say you don't have that information yet.
Be concise. Format dollar amounts. Use bullet lists for multiple plans.`;

async function answer(message, history, facts) {
  const r = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    messages: [
      { role: 'system', content: ANSWER_SYSTEM },
      ...history.slice(-8),
      { role: 'user', content: message },
      { role: 'system', content: `FACTS:\n${JSON.stringify(facts)}` },
    ],
  });
  return r.choices[0].message.content;
}

// ---------- POST /chat ----------
router.post('/', async (req, res) => {
  try {
    const { userId = 'anon', message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message required' });

    const history = await getHistory(userId);
    const intent = await classify(message, history);
    const facts = await runIntent(intent);
    const reply = await answer(message, history, facts);

    const newHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }];
    await saveHistory(userId, newHistory);

    res.json({ reply, intent, facts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
