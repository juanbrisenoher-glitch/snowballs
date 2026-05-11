const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const https = require('https');

const upload = multer({ storage: multer.memoryStorage() });

const GROQ_API_KEY = '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';

// Prompts - even stricter
const PROMPTS = {
  summary_of_benefits: `Extract ALL benefit information from this Medicare Advantage Summary of Benefits. Return ONLY valid JSON. No extra text, no markdown, no explanations. Use null for missing values.
Required JSON structure:
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
}`,

  formulary: `Extract drug formulary data. Return ONLY valid JSON:
{
  "plan_name": "",
  "tier1_copay": "",
  "tier2_copay": "",
  "tier3_copay": "",
  "tier4_copay": "",
  "tier5_copay": "",
  "drugs": []
}`,

  otc_benefits: `Extract OTC benefit information. Return ONLY valid JSON:
{
  "plan_name": "",
  "quarterly_allowance": "",
  "annual_allowance": "",
  "where_to_use": [],
  "categories": []
}`,

  provider_directory: `Extract provider information. Return ONLY valid JSON:
{
  "plan_name": "",
  "network_name": "",
  "providers": []
}`,

  plan_benefits: `Extract plan benefits. Return ONLY valid JSON:
{
  "plan_name": "",
  "benefits": {}
}`
};

router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { plan_name, doc_type } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!plan_name) return res.status(400).json({ error: 'Plan name required' });
    if (!doc_type || !PROMPTS[doc_type]) return res.status(400).json({ error: 'Valid doc_type required' });

    // Extract text from PDF
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.slice(0, 20000); // limit to 20k chars

    const systemMsg = `You are a JSON extraction assistant. The user will provide PDF text. You must output ONLY valid JSON that matches the requested schema. No markdown, no backticks, no extra words. If a field is not present, use null or empty string.`;

    const userMsg = `Plan name: ${plan_name}\nDocument type: ${doc_type}\n\nPDF TEXT:\n${text}\n\nNow return JSON only.`;

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
    console.log('Raw Groq response:', raw);

    // Clean up: remove any markdown code blocks
    raw = raw.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    
    // Try to extract a JSON object using regex
    let match = raw.match(/(\{[\s\S]*\})/);
    if (!match) {
      throw new Error('No JSON object found in response');
    }
    let jsonString = match[1];
    
    // Attempt to parse
    let extracted;
    try {
      extracted = JSON.parse(jsonString);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      // Fallback: return raw for debugging
      return res.json({ 
        success: false, 
        error: 'Could not parse JSON from Groq response', 
        raw: raw.substring(0, 1000) 
      });
    }

    res.json({ success: true, extracted });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
