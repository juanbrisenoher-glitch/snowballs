const express = require('express');
const router = express.Router();
const https = require('https');
const { pool } = require('../db');

const GROQ_API_KEY = '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';

// Function to actually query the database for real plan data
async function getRealPlanData(planName) {
  try {
    // Search for plans matching the name
    const result = await pool.query(`
      SELECT carrier, plan_name, premium, moop, specialist, pcp, er, 
             dental_benefit, vision_benefit, hearing_benefit, otc_allowance, 
             transportation, pers, giveback
      FROM plans 
      WHERE plan_name ILIKE $1 OR carrier ILIKE $1
      LIMIT 5
    `, [`%${planName}%`]);
    
    return result.rows;
  } catch (err) {
    console.error('Database error:', err);
    return [];
  }
}

// Function to get all plans matching a benefit (giveback, low MOOP, etc.)
async function getPlansByBenefit(benefitType) {
  try {
    let query = '';
    if (benefitType === 'giveback') {
      query = `SELECT carrier, plan_name, giveback, premium, moop FROM plans WHERE giveback > 0 ORDER BY giveback DESC`;
    } else if (benefitType === 'lowest moop') {
      query = `SELECT carrier, plan_name, moop, premium FROM plans ORDER BY moop ASC LIMIT 5`;
    } else if (benefitType === 'dental') {
      query = `SELECT carrier, plan_name, dental_benefit, premium FROM plans WHERE dental_benefit IS NOT NULL LIMIT 5`;
    } else {
      query = `SELECT carrier, plan_name, premium, moop FROM plans LIMIT 10`;
    }
    
    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    console.error('Database error:', err);
    return [];
  }
}

router.post('/', async (req, res) => {
  try {
    const { messages } = req.body;
    const userMessage = messages?.find(m => m.role === 'user')?.content || '';
    
    // Determine what the user is asking for
    let dbContext = '';
    let plans = [];
    
    if (userMessage.toLowerCase().includes('giveback')) {
      plans = await getPlansByBenefit('giveback');
      dbContext = plans.length > 0 ? 
        `REAL PLANS WITH GIVEBACK (from your database):\n${plans.map(p => `• ${p.carrier} ${p.plan_name}: $${p.giveback}/mo giveback, $${p.premium}/mo premium, MOOP $${p.moop}`).join('\n')}` :
        'No giveback plans found in database.';
    } 
    else if (userMessage.toLowerCase().includes('lowest moop') || userMessage.toLowerCase().includes('moop')) {
      plans = await getPlansByBenefit('lowest moop');
      dbContext = plans.length > 0 ?
        `REAL PLANS WITH LOWEST MOOP (from your database):\n${plans.map(p => `• ${p.carrier} ${p.plan_name}: MOOP $${p.moop}, $${p.premium}/mo premium`).join('\n')}` :
        'No MOOP data found.';
    }
    else if (userMessage.toLowerCase().includes('dental')) {
      plans = await getPlansByBenefit('dental');
      dbContext = plans.length > 0 ?
        `REAL DENTAL BENEFITS (from your database):\n${plans.map(p => `• ${p.carrier} ${p.plan_name}: ${p.dental_benefit}, $${p.premium}/mo`).join('\n')}` :
        'No dental data found.';
    }
    else {
      // Try to find specific plan
      const planMatch = userMessage.match(/(alignment|humana|cigna|wellpoint|amerigroup|aetna|uhc|united)/i);
      if (planMatch) {
        plans = await getRealPlanData(planMatch[0]);
        if (plans.length > 0) {
          dbContext = `REAL PLAN DATA FROM YOUR DATABASE:\n${plans.map(p => 
            `• ${p.carrier} ${p.plan_name}: Premium $${p.premium}/mo, MOOP $${p.moop}, Specialist $${p.specialist}, PCP $${p.pcp}, ER $${p.er}, Dental: ${p.dental_benefit}, Vision: ${p.vision_benefit}, Hearing: ${p.hearing_benefit}, OTC: ${p.otc_allowance}, Transportation: ${p.transportation}, PERS: ${p.pers}`
          ).join('\n')}`;
        }
      }
    }
    
    const systemPrompt = `You are MERIDIAN, a REAL Medicare AI assistant for El Paso, Texas. You have DIRECT ACCESS to actual plan data.

CRITICAL RULES:
1. ONLY use the data provided below - do NOT make up numbers
2. If data shows $0, say "$0"
3. If data shows specific numbers, quote them exactly
4. If no data is found, say "I don't have that plan in my database yet"
5. Be specific - give actual dollar amounts from the data

${dbContext || 'No specific plan data found for this query. Ask user which carrier or plan they want details on.'}

If you have data above, answer with THOSE exact numbers. If you don't have data, say so clearly.`;

    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 800,
      temperature: 0.3,  // Lower temperature = more factual, less creative
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-3)  // Only last 3 messages for context
      ]
    });
    
    const data = await new Promise((resolve, reject) => {
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
      
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('Failed to parse response')); }
        });
      });
      
      request.on('error', reject);
      request.write(body);
      request.end();
    });
    
    if (data.error) {
      return res.json({ choices: [{ message: { content: `Error: ${data.error.message}` } }] });
    }
    res.json(data);
    
  } catch(err) {
    console.error('Chat error:', err);
    res.json({ choices: [{ message: { content: 'Having trouble connecting to the database. Please try again.' } }] });
  }
});

module.exports = router;
