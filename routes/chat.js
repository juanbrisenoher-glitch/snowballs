const express = require('express');
const router = express.Router();
const https = require('https');
const { pool, getAll, search, upsertUser } = require('../db');

const GROQ_API_KEY = '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';

async function searchDatabase(userMessage) {
  const q = userMessage.toLowerCase();
  let context = '';

  try {
    const meds = await search('medications', q, ['name', 'generic_name', 'what_it_treats', 'drug_class']);
    if (meds && meds.length > 0) {
      context += '\nMEDICATIONS:\n';
      meds.slice(0,4).forEach(m => {
        context += `• ${m.name}${m.generic_name ? ' (' + m.generic_name + ')' : ''}: treats ${m.what_it_treats || 'N/A'}. Tier ${m.tier_typical || 'N/A'}. Retail ~$${m.avg_monthly_cost_retail || '?'}/mo, Medicare ~$${m.avg_monthly_cost_medicare || '?'}/mo.\n`;
      });
    }

    const providers = await search('providers', q, ['name', 'specialty', 'clinic_name', 'plans_accepted', 'languages']);
    if (providers && providers.length > 0) {
      context += '\nPROVIDERS:\n';
      providers.slice(0,4).forEach(p => {
        context += `• ${p.name} — ${p.specialty || 'N/A'} at ${p.clinic_name || 'N/A'}. ${p.city || 'El Paso'}, TX. Phone: ${p.phone || 'N/A'}. ${p.accepting_new_patients ? 'Accepting new patients.' : 'Not accepting.'} Languages: ${p.languages || 'N/A'}. Plans: ${p.plans_accepted || 'N/A'}.\n`;
      });
    }

    let planResults = await search('plans', q, ['carrier', 'plan_name', 'plan_type']);
    if (!planResults || planResults.length === 0) {
      if (q.includes('plan') || q.includes('benefit') || q.includes('coverage') || q.includes('compare')) {
        planResults = await getAll('plans');
      }
    }
    if (planResults && planResults.length > 0) {
      context += '\nPLANS:\n';
      planResults.slice(0,6).forEach(p => {
        context += `• ${p.carrier} — ${p.plan_name} (${p.plan_type || 'HMO'}): $${p.premium || 0}/mo premium, MOOP $${p.moop || 'N/A'}, Dental: ${p.dental_benefit || 'N/A'}, Vision: ${p.vision_benefit || 'N/A'}, Hearing: ${p.hearing_benefit || 'N/A'}, OTC: $${p.otc_allowance || 0}/qtr.\n`;
      });
    }

    const devices = await search('devices', q, ['name', 'category', 'what_it_does', 'who_needs_it']);
    if (devices && devices.length > 0) {
      context += '\nDEVICES:\n';
      devices.slice(0,3).forEach(d => {
        context += `• ${d.name} (${d.category || 'Device'}): ${d.what_it_does || ''}. For: ${d.who_needs_it || 'N/A'}. ${d.coverage_notes || ''}.\n`;
      });
    }

    const procedures = await search('procedures', q, ['name', 'category', 'description', 'why_needed']);
    if (procedures && procedures.length > 0) {
      context += '\nPROCEDURES:\n';
      procedures.slice(0,3).forEach(p => {
        context += `• ${p.name}: ${p.description || ''}. Recovery: ${p.recovery_time || 'N/A'}. Medicare copay: $${p.typical_copay_medicare || 'N/A'}.\n`;
      });
    }
  } catch (err) {
    console.error('Database search error:', err);
  }

  return context;
}

function buildCurrentPlanContext(currentPlan) {
  if (!currentPlan) return '';
  return `\nThe user currently has this plan open on their screen:
${currentPlan.name || currentPlan.plan_name} by ${currentPlan.carrier} (${currentPlan.type || currentPlan.plan_type})
Premium: $${currentPlan.premium || 0}/mo | MOOP: $${currentPlan.moop || 0} | Specialist: $${currentPlan.specialist || 'N/A'}
PCP: $${currentPlan.pcp || 'N/A'} | ER: $${currentPlan.er || 'N/A'} | Dental: ${currentPlan.dental || currentPlan.dental_benefit || 'N/A'}
Vision: ${currentPlan.vision || currentPlan.vision_benefit || 'N/A'} | Hearing: ${currentPlan.hearing || currentPlan.hearing_benefit || 'N/A'}
OTC: ${currentPlan.otc || currentPlan.otc_allowance || 'N/A'} | Food: ${currentPlan.food || 'N/A'} | Transport: ${currentPlan.transport || currentPlan.transportation || 'N/A'}
Giveback: ${currentPlan.giveback > 0 ? '$' + currentPlan.giveback + '/mo' : 'None'} | Gym: ${currentPlan.gym || 'N/A'} | PERS: ${currentPlan.pers || 'N/A'}
When the user says "this plan" or "it" they mean this one.`;
}

function buildSystemPrompt(userName, memory, dbContext, currentPlanContext) {
  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const name = userName && userName !== 'friend' ? userName : null;
  const memStr = memory && Object.keys(memory).length
    ? '\nWhat you know about this person: ' + JSON.stringify(memory) : '';
 
  return `You are MERIDIAN, an AI built into a Medicare platform for El Paso, Texas. Today is ${now}.${name ? ' The person you\'re talking to is ' + name + '.' : ''}${memStr}${currentPlanContext ? '\n' + currentPlanContext : ''}${dbContext ? '\nData you have access to:\n' + dbContext : ''}
 
You are genuinely intelligent, direct, and real. You don't sound like a chatbot. You don't open with scripted greetings or fake enthusiasm. When someone says hi, you just say hi back and ask what they need — like a real person would. You're not performing helpfulness, you actually are helpful.
 
You know Medicare Advantage inside and out — HMO, PPO, D-SNP, C-SNP, drug tiers, formularies, prior auth, MOOP, giveback, OTC, PERS, SSBCI, all of it. You know El Paso carriers: Alignment, Devoted, Humana, UHC, Wellcare, HealthSpring/Cigna, Wellpoint/Amerigroup, BCBS. You know medications, procedures, devices, recovery times, costs.
 
You talk like a human. Short sentences when it makes sense. You use the person's name naturally, not constantly. You remember what they tell you. If they're stressed or confused, you get that — you don't lecture them. You give real answers with real numbers, not vague corporate speak.
 
You never say "Certainly!" or "Great question!" or "As an AI" or any of that. You just answer. If you don't know something, you say so straight up. You never give actual medical advice but you don't make a big dramatic disclaimer about it every single time either — you just say "talk to your doctor on that one" and move on.
 
If someone asks you something completely off topic, you can engage with it briefly like a normal person would before steering back. You're not a robot with guardrails, you're just smart and helpful and real.
 
When the user shares their name, conditions, meds, or preferences worth remembering, end your reply with:
<memory>{"key": "value"}</memory>`;
}

router.post('/', async (req, res) => {
  const { messages, userName, memory = {}, sessionId, currentPlan } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages required' });
  }

  try {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const dbContext = await searchDatabase(lastUserMsg);
    const currentPlanContext = buildCurrentPlanContext(currentPlan);
 
    if (sessionId) {
      try { await upsertUser(sessionId, userName, memory); } catch(e) { console.error('Upsert error:', e); }
    }
 
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 800,
      temperature: 0.85,
      messages: [
        { role: 'system', content: buildSystemPrompt(userName, memory, dbContext, currentPlanContext) },
        ...messages
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
      return res.status(500).json({ error: { message: data.error.message } });
    }
    res.json(data);
 
  } catch(err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});
 
module.exports = router;on('error', reject);
      request.write(body);
      request.end();
    });
 
    if (data.error) return res.status(500).json({ error: { message: data.error.message } });
    res.json(data);
 
  } catch(err) {
    res.status(500).json({ error: { message: err.message } });
  }
});
 
module.exports = router;
