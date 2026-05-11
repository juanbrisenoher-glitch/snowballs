const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const https = require('https');

const upload = multer({ storage: multer.memoryStorage() });

// Read API key from environment variable (set in Railway)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY environment variable is not set!');
} else {
  console.log('✅ GROQ_API_KEY loaded (first 10 chars):', GROQ_API_KEY.substring(0, 10) + '...');
}

const PROMPTS = {
  summary_of_benefits: `Extract ALL benefit information from this Medicare Advantage Summary of Benefits text. Return ONLY valid JSON with these fields: 
{
  "plan_name": "",
  "plan_type": "",
  "premium": "",
  "deductible": "",
  "moop_in_network": "",
  "primary_care_visit": "",
  "specialist_visit": "",
  "urgent_care": "",
  "emergency_room": "",
  "inpatient_hospital": "",
  "outpatient_surgery": "",
  "dental_coverage": "",
  "vision_coverage": "",
  "hearing_coverage": "",
  "transportation": "",
  "otc_benefit": "",
  "telehealth": "",
  "notes": ""
}
If a value is not found, use null. No extra text, no markdown.`,

  formulary: `Extract drug formulary data from this Medicare Part D formulary text. Return ONLY valid JSON:
{
  "plan_name": "",
  "tier1_copay": "",
  "tier2_copay": "",
  "tier3_copay": "",
  "tier4_copay": "",
  "tier5_copay": "",
  "drugs": [{"name": "", "tier": "", "quantity_limit": ""}]
}
Include at least the first 10 drugs. No extra text.`,

  otc_benefits: `Extract OTC (Over‑the‑Counter) benefit information from this document. Return ONLY valid JSON:
{
  "plan_name": "",
  "quarterly_allowance": "",
  "annual_allowance": "",
  "where_to_use": [],
  "categories": []
}
No extra text.`,

  provider_directory: `Extract provider information. Return ONLY valid JSON:
{
  "plan_name": "",
  "network_name": "",
  "providers": [{"name": "", "specialty": "", "address": "", "phone": ""}]
}
Include first 5 providers. No extra text.`,

  plan_benefits: `Extract plan benefits. Return ONLY valid JSON:
{
  "plan_name": "",
  "benefits": {}
}
No extra text.`
};

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { plan_name, doc_type } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!plan_name) return res.status(400).json({ error: 'Plan name required' });
    if (!doc_type || !PROMPTS[doc_type]) return res.status(400).json({ error: 'Valid doc_type required' });

    // Extract text from PDF
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.slice(0, 25000);

    const prompt = PROMPTS[doc_type];
    const systemMsg = `You are a data extraction assistant. Return ONLY valid JSON. No explanations, no markdown, no backticks.`;

    const userMsg = `Plan name: ${plan_name}\nDocument type: ${doc_type}\n\nPDF TEXT:\n${text}\n\nNow return the JSON as instructed.`;

    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });
      const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const request = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) reject(new Error(json.error.message));
            else resolve(json);
          } catch (e) { reject(new Error('Failed to parse Groq response')); }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    let raw = response.choices[0].message.content;
    // Remove markdown code fences
    let clean = raw.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    let extracted;
    let parseError = null;
    try {
      extracted = JSON.parse(clean);
    } catch (e) {
      // Try to find JSON object using regex
      const match = clean.match(/(\{[\s\S]*\})/);
      if (match) {
        try {
          extracted = JSON.parse(match[1]);
        } catch (e2) {
          parseError = e2.message;
          extracted = { error: 'Could not parse JSON', raw_text: raw.substring(0, 2000) };
        }
      } else {
        parseError = e.message;
        extracted = { error: 'Could not parse JSON', raw_text: raw.substring(0, 2000) };
      }
    }

    res.json({ success: true, extracted, raw_text: raw, parse_error: parseError });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
