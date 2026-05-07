const { pool } = require('../db');

// Search for medications in formulary data
async function searchMedications(drugName) {
  const result = await pool.query(`
    SELECT name, generic_name, tier_typical, what_it_treats, 
           avg_monthly_cost_medicare, prior_auth_required, quantity_limit
    FROM medications 
    WHERE name ILIKE $1 OR generic_name ILIKE $1
    LIMIT 10
  `, [`%${drugName}%`]);
  return result.rows;
}

// Search for providers by specialty, location, or plan
async function searchProviders(specialty, zipCode, planName) {
  let query = `SELECT name, specialty, address, city, phone, accepting_new_patients, plans_accepted 
               FROM providers WHERE 1=1`;
  let params = [];
  let paramCount = 1;
  
  if (specialty) {
    query += ` AND specialty ILIKE $${paramCount}`;
    params.push(`%${specialty}%`);
    paramCount++;
  }
  if (zipCode) {
    query += ` AND zip LIKE $${paramCount}`;
    params.push(`${zipCode}%`);
    paramCount++;
  }
  
  query += ` LIMIT 15`;
  const result = await pool.query(query, params);
  return result.rows;
}

// Search for durable medical equipment
async function searchEquipment(equipmentName) {
  const result = await pool.query(`
    SELECT name, category, what_it_does, covered_by_medicare, coverage_notes
    FROM devices 
    WHERE name ILIKE $1 OR category ILIKE $1
    LIMIT 10
  `, [`%${equipmentName}%`]);
  return result.rows;
}

// Search for procedures and coverage
async function searchProcedures(procedureName) {
  const result = await pool.query(`
    SELECT name, category, description, typical_copay_medicare, recovery_time
    FROM procedures 
    WHERE name ILIKE $1 OR category ILIKE $1
    LIMIT 10
  `, [`%${procedureName}%`]);
  return result.rows;
}

// Find which plans cover a specific drug
async function findPlansCoveringDrug(drugName) {
  // This queries the formulary data you'll import from PDFs
  const result = await pool.query(`
    SELECT DISTINCT p.carrier, p.plan_name, f.tier, f.prior_auth, f.step_therapy
    FROM plans p
    JOIN formularies f ON p.id = f.plan_id
    WHERE f.drug_name ILIKE $1
    LIMIT 20
  `, [`%${drugName}%`]);
  return result.rows;
}

module.exports = {
  searchMedications,
  searchProviders,
  searchEquipment,
  searchProcedures,
  findPlansCoveringDrug
};
