// scripts/import-plans.js
import pkg from 'pg';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import Groq from 'groq-sdk';

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ---------- 1. PDF URLs ----------
const PDF_URLS = `
https://crm.texasmedicalcareplans.com/files/plans/352-benefits-2025-alignment-heart-diabetes-dual-sob-english.pdf
https://crm.texasmedicalcareplans.com/files/plans/352-formulary-alignment-form-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/352-providers-alignment-providers-2026.pdf
https://crm.texasmedicalcareplans.com/files/plans/352-otc-alignment-catalog-otc-eng-2026.pdf
https://crm.texasmedicalcareplans.com/files/plans/530-benefits-alignment-002-004-007-009-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/312-benefits-2025-alignment-heart-diabetes-dual-sob-english.pdf
https://crm.texasmedicalcareplans.com/files/plans/466-benefits-2025-summary-of-benefits-az-h3443-001-002-005-en-508.pdf
https://crm.texasmedicalcareplans.com/files/plans/708-benefits-h5472-001-010-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/709-benefits-alignment-002-004-007-009-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/723-benefits-h7993-029-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/444-benefits-2024-devoted-choice-giveback-austin-ppo-sb-h6813-001-eng-sf20230925.pdf
https://crm.texasmedicalcareplans.com/files/plans/408-benefits-sob-ingles-h7993-007.pdf
https://crm.texasmedicalcareplans.com/files/plans/470-benefits-h4513-093-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/776-benefits-h7849-154-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/695-benefits-cigna-preferred-full-savings-h4513-091-000-liberty-county-cleveland-tx.pdf
https://crm.texasmedicalcareplans.com/files/plans/23-benefits-h4513-061-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/184-benefits-h4513-083-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/465-benefits-sb-h4513-083-004.pdf
https://crm.texasmedicalcareplans.com/files/plans/692-benefits_es-sb-h4513-083-005.pdf
https://crm.texasmedicalcareplans.com/files/plans/24-benefits-h4513-060-003-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/472-benefits-h5216-433-000-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/547-benefits-1731783310-h5216435003sb25.pdf
https://crm.texasmedicalcareplans.com/files/plans/749-benefits-h7617-041-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/186-benefits-h0473-004-000-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/427-benefits-humana-h5216-137-choice-ppo-giveback-new-mexico-1.pdf
https://crm.texasmedicalcareplans.com/files/plans/748-benefits-h4461-066-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/393-benefits-h0028-039-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/185-benefits-h5216-350-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/750-benefits-h7417-063-000-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/426-benefits-sob-eng-h5216-371.pdf
https://crm.texasmedicalcareplans.com/files/plans/7-2020-classic-select-sob.pdf
https://crm.texasmedicalcareplans.com/files/plans/82-benefits-h8849-011-004-sob-eng.pdf
https://crm.texasmedicalcareplans.com/files/plans/554-benefits-1070186musenmub-0186.pdf
https://crm.texasmedicalcareplans.com/files/plans/78-benefits-h8849-010-004-sob-eng-1.pdf
`.trim().split('\n').map(s => s.trim()).filter(Boolean);

// ---------- 2. Schema ----------
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id              SERIAL PRIMARY KEY,
      plan_id         TEXT UNIQUE NOT NULL,
      carrier         TEXT,
      plan_name       TEXT,
      contract_id     TEXT,
      premium         NUMERIC,
      moop            NUMERIC,
      giveback        NUMERIC,
      dental_benefit  TEXT,
      vision_benefit  TEXT,
      hearing_benefit TEXT,
      otc_allowance   TEXT,
      transportation  TEXT,
      pers            TEXT,
      gym             TEXT,
      specialist      TEXT,
      pcp             TEXT,
      er              TEXT,
      source_urls     TEXT[],
      raw_excerpt     TEXT,
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS plans_carrier_idx ON plans (lower(carrier));
    CREATE INDEX IF NOT EXISTS plans_name_idx    ON plans (lower(plan_name));
  `);
}

// ---------- 3. Helpers ----------
function carrierFromUrl(u) {
  const s = u.toLowerCase();
  if (s.includes('alignment')) return 'Alignment Health';
  if (s.includes('humana'))    return 'Humana';
  if (s.includes('cigna'))     return 'Cigna';
  if (s.includes('wellpoint')) return 'Wellpoint';
  if (s.includes('amerigroup'))return 'Amerigroup';
  if (s.includes('devoted'))   return 'Devoted Health';
  return 'Unknown';
}

function planIdFromUrl(u) {
  const m = u.match(/\/plans\/(\d+)-/);
  return m ? m[1] : null;
}

async function fetchPdfText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = await pdf(buf);
  return out.text || '';
}

// ---------- 4. Groq extraction ----------
const EXTRACT_PROMPT = `You extract Medicare Advantage plan benefits from a Summary of Benefits PDF.
Return ONLY valid minified JSON with these keys (use null when unknown, numbers for $ amounts):
{
 "plan_name": string|null,
 "contract_id": string|null,    // e.g. H5472-004
 "premium": number|null,        // monthly $
 "moop": number|null,           // in-network max out of pocket $
 "giveback": number|null,       // Part B premium reduction $/mo
 "dental_benefit": string|null, // short summary incl. annual $ allowance
 "vision_benefit": string|null,
 "hearing_benefit": string|null,
 "otc_allowance": string|null,  // e.g. "$125/quarter"
 "transportation": string|null,
 "pers": string|null,           // personal emergency response
 "gym": string|null,            // SilverSneakers etc.
 "specialist": string|null,     // copay
 "pcp": string|null,            // copay
 "er": string|null              // copay
}`;

async function extractWithGroq(carrier, planId, text) {
  const excerpt = text.replace(/\s+/g, ' ').slice(0, 18000);
  const r = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXTRACT_PROMPT },
      { role: 'user', content: `Carrier: ${carrier}\nPlan ID: ${planId}\n\nPDF TEXT:\n${excerpt}` },
    ],
  });
  return JSON.parse(r.choices[0].message.content);
}

// ---------- 5. Upsert ----------
async function upsert(planId, carrier, sources, excerpt, data) {
  await pool.query(`
    INSERT INTO plans (plan_id, carrier, plan_name, contract_id, premium, moop, giveback,
      dental_benefit, vision_benefit, hearing_benefit, otc_allowance, transportation,
      pers, gym, specialist, pcp, er, source_urls, raw_excerpt, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, NOW())
    ON CONFLICT (plan_id) DO UPDATE SET
      carrier=EXCLUDED.carrier, plan_name=EXCLUDED.plan_name, contract_id=EXCLUDED.contract_id,
      premium=EXCLUDED.premium, moop=EXCLUDED.moop, giveback=EXCLUDED.giveback,
      dental_benefit=EXCLUDED.dental_benefit, vision_benefit=EXCLUDED.vision_benefit,
      hearing_benefit=EXCLUDED.hearing_benefit, otc_allowance=EXCLUDED.otc_allowance,
      transportation=EXCLUDED.transportation, pers=EXCLUDED.pers, gym=EXCLUDED.gym,
      specialist=EXCLUDED.specialist, pcp=EXCLUDED.pcp, er=EXCLUDED.er,
      source_urls=EXCLUDED.source_urls, raw_excerpt=EXCLUDED.raw_excerpt, updated_at=NOW();
  `, [
    planId, carrier, data.plan_name, data.contract_id, data.premium, data.moop, data.giveback,
    data.dental_benefit, data.vision_benefit, data.hearing_benefit, data.otc_allowance,
    data.transportation, data.pers, data.gym, data.specialist, data.pcp, data.er,
    sources, excerpt.slice(0, 4000),
  ]);
}

// ---------- 6. Main ----------
async function main() {
  await ensureSchema();

  // group all URLs by plan id; only the *benefits* PDF is used for extraction
  const byPlan = new Map();
  for (const u of PDF_URLS) {
    const pid = planIdFromUrl(u);
    if (!pid) continue;
    if (!byPlan.has(pid)) byPlan.set(pid, []);
    byPlan.get(pid).push(u);
  }

  for (const [planId, urls] of byPlan) {
    const benefitsUrl = urls.find(u => /benefits|sob|summary/i.test(u)) || urls[0];
    const carrier = carrierFromUrl(benefitsUrl);
    try {
      console.log(`→ ${planId} (${carrier})`);
      const text = await fetchPdfText(benefitsUrl);
      const data = await extractWithGroq(carrier, planId, text);
      await upsert(planId, carrier, urls, text, data);
      console.log(`  ✓ ${data.plan_name ?? '(no name)'} premium=${data.premium} moop=${data.moop} giveback=${data.giveback}`);
    } catch (e) {
      console.error(`  ✗ ${planId}: ${e.message}`);
    }
  }
  await pool.end();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
