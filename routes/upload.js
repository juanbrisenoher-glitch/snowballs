const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const pdfParse = require('pdf-parse');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const upload = multer({ storage: multer.memoryStorage() });

// Extract basic plan info from PDF text
async function extractPlanFromPDF(buffer, filename) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text;
    
    // Determine carrier from filename
    let carrier = 'Unknown';
    if (filename.toLowerCase().includes('alignment')) carrier = 'Alignment Health';
    else if (filename.toLowerCase().includes('humana')) carrier = 'Humana';
    else if (filename.toLowerCase().includes('cigna')) carrier = 'Cigna';
    else if (filename.toLowerCase().includes('wellpoint')) carrier = 'Wellpoint';
    
    // Try to extract plan name (first few lines)
    const lines = text.split('\n').slice(0, 15).join(' ');
    let planName = filename.replace(/\.pdf$/i, '').substring(0, 100);
    
    // Look for common plan identifiers
    const nameMatch = lines.match(/([A-Za-z\s]+(?:HMO|PPO|D-SNP|C-SNP))/i);
    if (nameMatch) planName = nameMatch[0].trim();
    
    // Extract premium
    let premium = 0;
    const premiumMatch = text.match(/\$\s*(\d+(?:\.\d+)?)\s*\/\s*month/i);
    if (premiumMatch) premium = parseFloat(premiumMatch[1]);
    
    // Extract MOOP
    let moop = null;
    const moopMatch = text.match(/maximum out[\s-]of[\s-]pocket[:\s]*\$\s*(\d+(?:,\d+)?)/i);
    if (moopMatch) moop = parseFloat(moopMatch[1].replace(/,/g, ''));
    
    // Extract giveback
    let giveback = 0;
    const givebackMatch = text.match(/giveback[:\s]*\$\s*(\d+(?:\.\d+)?)/i);
    if (givebackMatch) giveback = parseFloat(givebackMatch[1]);
    
    return {
      carrier,
      plan_name: planName,
      premium,
      giveback,
      moop
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return null;
  }
}

// Upload endpoint
router.post('/', upload.array('pdfs', 20), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.json({ success: false, error: 'No files uploaded' });
    }
    
    let insertedCount = 0;
    const results = [];
    
    for (const file of files) {
      const planData = await extractPlanFromPDF(file.buffer, file.originalname);
      if (planData && planData.carrier !== 'Unknown') {
        // Insert into database
        await pool.query(`
          INSERT INTO plans (carrier, plan_name, premium, giveback, moop)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (plan_name) DO UPDATE SET
            premium = EXCLUDED.premium,
            giveback = EXCLUDED.giveback,
            moop = EXCLUDED.moop
        `, [planData.carrier, planData.plan_name, planData.premium, planData.giveback, planData.moop]);
        
        insertedCount++;
        results.push({ filename: file.originalname, success: true, plan: planData.plan_name });
        console.log(`✅ Inserted: ${planData.carrier} - ${planData.plan_name}`);
      } else {
        results.push({ filename: file.originalname, success: false, reason: 'Could not extract plan data' });
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${files.length} file(s), inserted ${insertedCount} plan(s)`,
      results
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// URL import endpoint
router.post('/url', express.json(), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.json({ success: false, error: 'No URL provided' });
    }
    
    const https = require('https');
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
    
    const filename = url.split('/').pop();
    const planData = await extractPlanFromPDF(pdfData, filename);
    
    if (planData && planData.carrier !== 'Unknown') {
      await pool.query(`
        INSERT INTO plans (carrier, plan_name, premium, giveback, moop)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (plan_name) DO UPDATE SET
          premium = EXCLUDED.premium,
          giveback = EXCLUDED.giveback,
          moop = EXCLUDED.moop
      `, [planData.carrier, planData.plan_name, planData.premium, planData.giveback, planData.moop]);
      
      res.json({ success: true, message: `Imported: ${planData.plan_name}` });
    } else {
      res.json({ success: false, error: 'Could not extract plan data from PDF' });
    }
  } catch (error) {
    console.error('URL import error:', error);
    res.status(500).json({ success: false, error: error.message });
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
