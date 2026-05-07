const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Process PDF and extract data
async function processPDF(pdfBuffer, filename) {
  try {
    console.log(`📄 Processing: ${filename}`);
    
    // Load pdf-parse dynamically
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    
    console.log(`📝 Extracted ${text.length} characters from PDF`);
    
    // Look for plan information in the text
    let carrier = 'Unknown';
    if (filename.toLowerCase().includes('alignment')) carrier = 'Alignment Health';
    else if (filename.toLowerCase().includes('humana')) carrier = 'Humana';
    else if (filename.toLowerCase().includes('cigna')) carrier = 'Cigna';
    
    // Also check text content for carrier names
    if (text.toLowerCase().includes('alignment health')) carrier = 'Alignment Health';
    if (text.toLowerCase().includes('humana')) carrier = 'Humana';
    if (text.toLowerCase().includes('cigna')) carrier = 'Cigna';
    
    // Try to extract plan name from first few lines
    const firstLines = text.split('\n').slice(0, 20).join(' ');
    let planName = filename.replace(/\.pdf$/i, '').substring(0, 100);
    
    // Look for common plan name patterns
    const planMatch = firstLines.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(HMO|PPO|D-SNP|C-SNP)/i);
    if (planMatch) planName = planMatch[0];
    
    // Try to find premium
    let premium = 0;
    const premiumPatterns = [
      /\$\s*(\d+(?:\.\d+)?)\s*\/\s*month/i,
      /premium[:\s]*\$\s*(\d+(?:\.\d+)?)/i,
      /monthly premium[:\s]*\$\s*(\d+(?:\.\d+)?)/i
    ];
    
    for (const pattern of premiumPatterns) {
      const match = text.match(pattern);
      if (match) {
        premium = parseFloat(match[1]);
        break;
      }
    }
    
    // Try to find MOOP
    let moop = null;
    const moopPatterns = [
      /maximum out[\s-]of[\s-]pocket[:\s]*\$\s*(\d+(?:,\d+)?)/i,
      /MOOP[:\s]*\$\s*(\d+(?:,\d+)?)/i,
      /out[\s-]of[\s-]pocket maximum[:\s]*\$\s*(\d+(?:,\d+)?)/i
    ];
    
    for (const pattern of moopPatterns) {
      const match = text.match(pattern);
      if (match) {
        moop = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }
    
    // Insert the plan
    const result = await pool.query(`
      INSERT INTO plans (carrier, plan_name, premium, giveback, moop)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (plan_name) DO UPDATE SET
        carrier = EXCLUDED.carrier,
        premium = EXCLUDED.premium,
        moop = EXCLUDED.moop
      RETURNING id
    `, [carrier, planName, premium, 0, moop]);
    
    console.log(`✅ Imported: ${carrier} - ${planName} (Premium: $${premium}, MOOP: $${moop || 'N/A'})`);
    
    return { success: true, inserted: 1, filename, planName, carrier };
    
  } catch (error) {
    console.error(`❌ Error processing ${filename}:`, error.message);
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
    
    console.log(`📥 Received ${files.length} file(s)`);
    
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
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/upload/url - Import from URL
router.post('/url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }
    
    console.log(`📥 Importing from URL: ${url}`);
    
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
    console.error('URL import error:', error);
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
