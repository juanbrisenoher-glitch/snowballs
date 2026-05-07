const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Pool } = require('pg');
const { Groq } = require('groq-sdk');
const pdfParse = require('pdf-parse');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Configure multer for file uploads (store in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Process PDF and extract data using AI
async function processPDF(pdfBuffer, filename) {
  try {
    // Extract text from PDF
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    
    // Determine document type from filename
    let docType = 'unknown';
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.includes('benefits') || lowerFilename.includes('sob') || lowerFilename.includes('summary')) {
      docType = 'benefits';
    } else if (lowerFilename.includes('formulary')) {
      docType = 'formulary';
    } else if (lowerFilename.includes('provider') || lowerFilename.includes('directory')) {
      docType = 'providers';
    } else if (lowerFilename.includes('otc')) {
      docType = 'otc';
    }
    
    // Build prompt based on document type
    let prompt = '';
    if (docType === 'benefits') {
      prompt = `Extract Medicare plan information from this Summary of Benefits PDF. Return ONLY valid JSON with this exact structure:
{
  "data": [
    {
      "carrier": "string (e.g., Alignment Health, Humana, Cigna)",
      "plan_name": "string (full plan name)",
      "plan_id": "string (e.g., 002, 004)",
      "plan_type": "string (e.g., HMO, PPO, D-SNP, C-SNP)",
      "premium": number (monthly premium in dollars, use 0 if $0),
      "giveback": number (Part B giveback amount in dollars, use 0 if none),
      "moop": number (Maximum Out-of-Pocket in dollars),
      "specialist": number (specialist copay in dollars),
      "pcp": number (primary care copay in dollars),
      "er": number or string (ER copay),
      "dental_benefit": "string (describe dental coverage)",
      "vision_benefit": "string (describe vision coverage)",
      "hearing_benefit": "string (describe hearing coverage)",
      "otc_allowance": "string (e.g., $40/month)",
      "gym": "string (fitness benefit description)",
      "transportation": "string (transportation benefit)",
      "pers": "string (Personal Emergency Response System benefit)"
    }
  ]
}

PDF Text (first 8000 characters):
${text.substring(0, 8000)}`;
    } 
    else if (docType === 'formulary') {
      prompt = `Extract prescription drug information from this formulary PDF. Return ONLY valid JSON:
{
  "data": [
    {
      "drug_name": "string",
      "generic_name": "string or null",
      "drug_class": "string (e.g., Anticoagulant, Diabetes)",
      "what_it_treats": "string",
      "tier_typical": number (1-5),
      "prior_auth_required": boolean,
      "quantity_limit": boolean
    }
  ]
}

PDF Text: ${text.substring(0, 8000)}`;
    }
    else if (docType === 'providers') {
      prompt = `Extract provider information from this provider directory PDF. Return ONLY valid JSON:
{
  "data": [
    {
      "name": "string (doctor or clinic name)",
      "specialty": "string (e.g., Cardiology, Primary Care)",
      "address": "string",
      "city": "string",
      "state": "string",
      "zip": "string",
      "phone": "string",
      "accepting_new_patients": boolean
    }
  ]
}

PDF Text: ${text.substring(0, 8000)}`;
    }
    else {
      prompt = `Classify this Medicare-related PDF and extract relevant information. Return JSON with type and data.
PDF Text: ${text.substring(0, 4000)}`;
    }
    
    // Call Groq API to extract structured data
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });
    
    const extracted = JSON.parse(response.choices[0].message.content);
    const dataArray = extracted.data || (Array.isArray(extracted) ? extracted : [extracted]);
    
    // Insert into appropriate table
    let inserted = 0;
    for (const item of dataArray) {
      if (docType === 'benefits' && item.carrier) {
        await pool.query(`
          INSERT INTO plans (carrier, plan_name, plan_id, plan_type, premium, giveback, moop, 
            specialist, pcp, er, dental_benefit, vision_benefit, hearing_benefit, 
            otc_allowance, gym, transportation, pers)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (plan_name) DO UPDATE SET 
            premium = EXCLUDED.premium,
            giveback = EXCLUDED.giveback,
            moop = EXCLUDED.moop
        `, [
          item.carrier, item.plan_name, item.plan_id, item.plan_type, 
          item.premium, item.giveback, item.moop,
          item.specialist, item.pcp, item.er,
          item.dental_benefit, item.vision_benefit, item.hearing_benefit,
          item.otc_allowance, item.gym, item.transportation, item.pers
        ]);
        inserted++;
        console.log(`  ✅ Imported plan: ${item.carrier} - ${item.plan_name}`);
      } 
      else if (docType === 'formulary' && item.drug_name) {
        await pool.query(`
          INSERT INTO medications (name, generic_name, drug_class, what_it_treats, tier_typical, prior_auth_required)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (name) DO NOTHING
        `, [item.drug_name, item.generic_name, item.drug_class, item.what_it_treats, item.tier_typical, item.prior_auth_required || false]);
        inserted++;
        console.log(`  ✅ Imported drug: ${item.drug_name}`);
      }
      else if (docType === 'providers' && item.name) {
        await pool.query(`
          INSERT INTO providers (name, specialty, address, city, state, zip, phone, accepting_new_patients)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (name) DO NOTHING
        `, [item.name, item.specialty, item.address, item.city, item.state, item.zip, item.phone, item.accepting_new_patients || true]);
        inserted++;
        console.log(`  ✅ Imported provider: ${item.name}`);
      }
    }
    
    return { success: true, type: docType, inserted, filename };
  } catch (error) {
    console.error(`Error processing ${filename}:`, error.message);
    return { success: false, error: error.message, filename };
  }
}

// POST /api/upload - Upload and process PDF files
router.post('/', upload.array('pdfs', 20), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log(`📥 Received ${files.length} file(s) for processing`);
    
    const results = [];
    for (const file of files) {
      console.log(`📄 Processing: ${file.originalname}`);
      const result = await processPDF(file.buffer, file.originalname);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({ 
      success: true, 
      message: `Processed ${results.length} files: ${successCount} successful, ${failCount} failed`,
      results 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/upload/status - Get current database counts
router.get('/status', async (req, res) => {
  try {
    const planCount = await pool.query('SELECT COUNT(*) FROM plans');
    const medCount = await pool.query('SELECT COUNT(*) FROM medications');
    const providerCount = await pool.query('SELECT COUNT(*) FROM providers');
    
    res.json({
      plans: parseInt(planCount.rows[0].count),
      medications: parseInt(medCount.rows[0].count),
      providers: parseInt(providerCount.rows[0].count)
    });
  } catch (error) {
    res.json({ plans: 0, medications: 0, providers: 0 });
  }
});

module.exports = router;
