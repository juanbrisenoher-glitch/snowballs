const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configure multer to save files temporarily for testing
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Simple test upload - just count files
router.post('/', upload.array('pdfs', 20), async (req, res) => {
  try {
    const files = req.files;
    console.log(`📥 Upload endpoint hit. Files received: ${files ? files.length : 0}`);
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded', success: false });
    }
    
    // Log each file
    for (const file of files) {
      console.log(`  - ${file.originalname} (${file.size} bytes, type: ${file.mimetype})`);
    }
    
    // Try to insert a test plan manually
    const testPlan = {
      carrier: 'Test Carrier',
      plan_name: `Test Plan ${new Date().toISOString()}`,
      premium: 100,
      giveback: 0,
      moop: 5000
    };
    
    await pool.query(`
      INSERT INTO plans (carrier, plan_name, premium, giveback, moop)
      VALUES ($1, $2, $3, $4, $5)
    `, [testPlan.carrier, testPlan.plan_name, testPlan.premium, testPlan.giveback, testPlan.moop]);
    
    res.json({ 
      success: true, 
      message: `Received ${files.length} file(s). Added test plan.`,
      files: files.map(f => ({ name: f.originalname, size: f.size }))
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// URL import test
router.post('/url', async (req, res) => {
  try {
    const { url } = req.body;
    console.log(`📥 URL import: ${url}`);
    
    if (!url) {
      return res.status(400).json({ error: 'URL required', success: false });
    }
    
    res.json({ 
      success: true, 
      message: `URL received: ${url}. PDF parsing will be added soon.`,
      url: url
    });
    
  } catch (error) {
    console.error('URL error:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM plans');
    res.json({ plans: parseInt(result.rows[0].count) });
  } catch (error) {
    res.json({ plans: 0 });
  }
});

module.exports = router;
