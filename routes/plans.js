const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET all plans
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, carrier, plan_name, premium, giveback, moop, 
             dental_benefit, vision_benefit, hearing_benefit, otc_allowance
      FROM plans 
      ORDER BY carrier, premium
    `);
    res.json({ plans: result.rows });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.json({ plans: [] });
  }
});

// GET single plan by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plans WHERE id = $1', [req.params.id]);
    res.json({ plan: result.rows[0] || null });
  } catch (error) {
    res.json({ plan: null });
  }
});

module.exports = router;
