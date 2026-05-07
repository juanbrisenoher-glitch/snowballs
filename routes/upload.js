const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Simple function to extract basic plan info from PDF text
function extractBasicPlanInfo(text, filename) {
  const results = [];
  const lowerText = text.toLowerCase();
  
  // Try to detect carrier from filename or text
  let carrier = 'Unknown';
  if (filename.toLowerCase().includes('alignment')) carrier = 'Alignment Health';
  else if (filename.toLowerCase().includes('humana')) carrier = 'Humana';
  else if (filename.toLowerCase().includes('cigna')) carrier = 'Cigna';
  else if (filename.toLowerCase().includes('wellpoint')) carrier = 'Wellpoint';
  
  // Try to find premium
  let premium = null;
  const premiumMatch = text.match(/\$\s*(\d+(?:\.\d+)?)\s*\/\s*month/i);
  if (premiumMatch) premium = parseFloat(premiumMatch[1]);
  
  // Try to find MOOP
  let moop = null;
  const moopMatch = text.match(/maximum out[\s-]of[\s-]pocket:?\s*\$\s*(\d+(?:,\d+)?)/i);
  if (moopMatch) moop = parseFloat(moopMatch[1].replace(/,/g, ''));
  
  // Create a basic plan entry
  if (carrier !== 'Unknown') {
    results.push({
      carrier: carrier,
      plan_name: filename.replace(/\.pdf$/i, '').substring(0, 100),
      premium: premium || 0,
      giveback: 0,
      moop: moop || null,
      source: filename
    });
  }
  
  return results;
}

// Process PDF and extract data
async function processPDF(pdfBuffer, filename) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    
    const plans = extractBasicPlanInfo(text, filename);
    
    let inserted = 0;
    for (const plan of plans) {
      await pool.query(`
        INSERT INTO plans (carrier, plan_name, premium, giveback, moop)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (plan_name) DO UPDATE SET
          premium = EXCLUDED.premium,
          moop = EXCLUDED.moop
      `, [plan.carrier, plan.plan_name, plan.premium, plan.giveback, plan.moop]);
      inserted++;
      console.log(`✅ Imported: ${plan.carrier} - ${plan.plan_name}`);
    }
    
    return { success: true, inserted, filename };
  } catch (error) {
    console.error(`Error: ${filename} - ${error.message}`);
    return { success: false, error: error.message, filename };
  }
}

// POST /api/upload - Upload PDF files
router.post('/', upload.array('pdfs', 20), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const results = [];
    for (const file of files) {
      const result = await processPDF(file.buffer, file.originalname);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    res.json({ 
      success: true, 
      message: `Processed ${successCount} of ${results.length} files`,
      results 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/upload/url - Import from URL
router.post('/url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    
    const pdfData = await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
    
    const filename = url.split('/').pop() || 'document.pdf';
    const result = await processPDF(pdfData, filename);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/upload/status
router.get('/status', async (req, res) => {
  try {
    const planCount = await pool.query('SELECT COUNT(*) FROM plans');
    res.json({ plans: parseInt(planCount.rows[0].count) });
  } catch (error) {
    res.json({ plans: 0 });
  }
});

module.exports = router;
