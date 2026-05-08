const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Simple endpoint to add a plan manually
router.post('/add-plan', express.json(), async (req, res) => {
  try {
    const { carrier, plan_name, premium, giveback, moop } = req.body;
    
    if (!carrier || !plan_name) {
      return res.json({ success: false, error: 'Carrier and plan name required' });
    }
    
    await pool.query(`
      INSERT INTO plans (carrier, plan_name, premium, giveback, moop)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (plan_name) DO UPDATE SET
        premium = EXCLUDED.premium,
        giveback = EXCLUDED.giveback,
        moop = EXCLUDED.moop
    `, [carrier, plan_name, premium || 0, giveback || 0, moop || null]);
    
    res.json({ success: true, message: `Added plan: ${carrier} - ${plan_name}` });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all plans
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plans ORDER BY carrier, plan_name');
    res.json({ plans: result.rows });
  } catch (error) {
    res.json({ plans: [] });
  }
});

router.get('/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM plans');
    res.json({ plans: parseInt(result.rows[0].count) });
  } catch (error) {
    res.json({ plans: 0 });
  }
});

module.exports = router;
