const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const DB = require('../db');

function buildFullContext() {
  let context = '';

  const plans = DB.getAll('plans');
  if (plans.length > 0) {
    context += '\n\n════ ALL MEDICARE PLANS ════\n';
    plans.forEach(p => {
      context += `\n▸ ${p.carrier} | ${p.plan_name} | Type: ${p.plan_type} | ID: ${p.plan_id||'N/A'}
  Premium: $${p.premium??0}/mo | Giveback: $${p.giveback??0}/mo | MOOP: $${p.moop??'N/A'}
  PCP: $${p.pcp??'N/A'} | Specialist: $${p.specialist??'N/A'} | Hospital: ${p.hospital??'N/A'}
  ER: $${p.er??'N/A'} | Urgent Care: $${p.urgent_care??'N/A'} | Ambulance: $${p.ambulance??'N/A'}
  Dental: ${p.dental_benefit??'N/A'} | Vision: ${p.vision_benefit??'N/A'} | Hearing: ${p.hearing_benefit??'N/A'}
  OTC: $${p.otc_allowance??0}/mo | Food/Utilities: ${p.food_utilities??'N/A'} | Transportation: ${p.transportation??'N/A'}
  Gym: ${p.gym??'N/A'} | PERS: ${p.pers??'N/A'} | Rx: ${p.rx??'N/A'} | Rx Deductible: ${p.rx_deductible??'N/A'}`;
    });
  }

  const providers = DB.getAll('providers');
  if (providers.length > 0) {
    context += '\n\n════ ALL PROVIDERS ════\n';
    providers.forEach(p => {
      context += `\n▸ ${p.name} | ${p.specialty??'N/A'} | ${p.clinic_name??'N/A'} | ${p.address??''} ${p.city??'El Paso'}, TX | Phone: ${p.phone??'N/A'} | Accepting: ${p.accepting_new_patients?'Yes':'No'} | Languages: ${p.languages??'N/A'} | Plans: ${p.plans_accepted??'N/A'}`;
    });
  }

  const meds = DB.getAll('medications');
  if (meds.length > 0) {
    context += '\n\n════ ALL MEDICATIONS ════\n';
    meds.forEach(m => {
      context += `\n▸ ${m.name}${m.generic_name?' ('+m.generic_name+')':''} | Class: ${m.drug_class??'N/A'} | Treats: ${m.what_it_treats??'N/A'} | Tier: ${m.tier_typical??'N/A'} | Retail: $${m.avg_monthly_cost_retail??'?'}/mo | Medicare: $${m.avg_monthly_cost_medicare??'?'}/mo`;
    });
  }

  const devices = DB.getAll('devices');
  if (devices.length > 0) {
    context += '\n\n════ ALL DEVICES ════\n';
    devices.forEach(d => {
      context += `\n▸ ${d.name} | ${d.category??'N/A'} | ${d.what_it_does??''} | Medicare covered: ${d.covered_by_medicare?'Yes':'No'} | Notes: ${d.coverage_notes??'N/A'}`;
    });
  }

  const procedures = DB.getAll('procedures');
  if (procedures.length > 0) {
    context += '\n\n════ ALL PROCEDURES ════\n';
    procedures.forEach(p => {
      context += `\n▸ ${p.name} | ${p.description??''} | Recovery: ${p.recovery_time??'N/A'} | Medicare copay: $${p.typical_copay_medicare??'?'}`;
    });
  }

  const services = DB.getAll('services');
  if (services.length > 0) {
    context += '\n\n════ ALL SERVICES ════\n';
    services.forEach(s => {
      context += `\n▸ ${s.name} | ${s.type??'N/A'} | ${s.city??'El Paso'}, TX | Phone: ${s.phone??'N/A'}`;
    });
  }

  return context;
}

function buildSystemPrompt(userName, memory) {
  const now = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const name = userName && userName !== 'friend' ? userName : 'there';
  const memStr = memory && Object.keys(memory).length ? '\n\nWhat you remember about this person:\n' + JSON.stringify(memory, null, 2) : '';

  return `You are MERIDIAN AI, a warm and knowledgeable Medicare assistant for El Paso, Texas. You help Medicare beneficiaries, caregivers, and insurance agents find the right plans, understand medications, find doctors, and navigate healthcare.

Today is ${now}. You are talking with ${name}.${memStr}

PERSONALITY: Warm and friendly like a trusted friend who knows healthcare. Use the user's name naturally. Show empathy. Be encouraging and clear, never condescending.

CRITICAL — USE THE DATA BELOW: You have MERIDIAN's complete live database. ALWAYS reference specific plans, providers, and medications from the data below. Give exact numbers, exact plan names, exact copays. Never give generic answers when the specific data is right here.

RESPONSE STYLE: Conversational, short paragraphs or bullets, specific numbers, always offer a helpful follow-up. Never give medical advice — always say talk to your doctor for medical decisions.

MEMORY: When user shares name, conditions, meds, or preferences, end response with: <memory>{"key": "value"}</memory>

════════════════════════════
MERIDIAN LIVE DATABASE — USE THIS IN YOUR ANSWERS:
════════════════════════════
${buildFullContext()}`;
}

router.post('/', async (req, res) => {
  const { messages, userName, memory = {}, sessionId } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  if (sessionId) { try { DB.upsertUser(sessionId, userName, memory); } catch(e) {} }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: buildSystemPrompt(userName, memory) },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const DB = require('../db');

function buildFullContext() {
  let context = '';

  const plans = DB.getAll('plans');
  if (plans.length > 0) {
    context += '\n\n════ ALL MEDICARE PLANS ════\n';
    plans.forEach(p => {
      context += `\n▸ ${p.carrier} | ${p.plan_name} | Type: ${p.plan_type} | ID: ${p.plan_id||'N/A'}
  Premium: $${p.premium??0}/mo | Giveback: $${p.giveback??0}/mo | MOOP: $${p.moop??'N/A'}
  PCP: $${p.pcp??'N/A'} | Specialist: $${p.specialist??'N/A'} | Hospital: ${p.hospital??'N/A'}
  ER: $${p.er??'N/A'} | Urgent Care: $${p.urgent_care??'N/A'} | Ambulance: $${p.ambulance??'N/A'}
  Dental: ${p.dental_benefit??'N/A'} | Vision: ${p.vision_benefit??'N/A'} | Hearing: ${p.hearing_benefit??'N/A'}
  OTC: $${p.otc_allowance??0}/mo | Food/Utilities: ${p.food_utilities??'N/A'} | Transportation: ${p.transportation??'N/A'}
  Gym: ${p.gym??'N/A'} | PERS: ${p.pers??'N/A'} | Rx: ${p.rx??'N/A'} | Rx Deductible: ${p.rx_deductible??'N/A'}`;
    });
  }

  const providers = DB.getAll('providers');
  if (providers.length > 0) {
    context += '\n\n════ ALL PROVIDERS ════\n';
    providers.forEach(p => {
      context += `\n▸ ${p.name} | ${p.specialty??'N/A'} | ${p.clinic_name??'N/A'} | ${p.address??''} ${p.city??'El Paso'}, TX | Phone: ${p.phone??'N/A'} | Accepting: ${p.accepting_new_patients?'Yes':'No'} | Languages: ${p.languages??'N/A'} | Plans: ${p.plans_accepted??'N/A'}`;
    });
  }

  const meds = DB.getAll('medications');
  if (meds.length > 0) {
    context += '\n\n════ ALL MEDICATIONS ════\n';
    meds.forEach(m => {
      context += `\n▸ ${m.name}${m.generic_name?' ('+m.generic_name+')':''} | Class: ${m.drug_class??'N/A'} | Treats: ${m.what_it_treats??'N/A'} | Tier: ${m.tier_typical??'N/A'} | Retail: $${m.avg_monthly_cost_retail??'?'}/mo | Medicare: $${m.avg_monthly_cost_medicare??'?'}/mo`;
    });
  }

  const devices = DB.getAll('devices');
  if (devices.length > 0) {
    context += '\n\n════ ALL DEVICES ════\n';
    devices.forEach(d => {
      context += `\n▸ ${d.name} | ${d.category??'N/A'} | ${d.what_it_does??''} | Medicare covered: ${d.covered_by_medicare?'Yes':'No'} | Notes: ${d.coverage_notes??'N/A'}`;
    });
  }

  const procedures = DB.getAll('procedures');
  if (procedures.length > 0) {
    context += '\n\n════ ALL PROCEDURES ════\n';
    procedures.forEach(p => {
      context += `\n▸ ${p.name} | ${p.description??''} | Recovery: ${p.recovery_time??'N/A'} | Medicare copay: $${p.typical_copay_medicare??'?'}`;
    });
  }

  const services = DB.getAll('services');
  if (services.length > 0) {
    context += '\n\n════ ALL SERVICES ════\n';
    services.forEach(s => {
      context += `\n▸ ${s.name} | ${s.type??'N/A'} | ${s.city??'El Paso'}, TX | Phone: ${s.phone??'N/A'}`;
    });
  }

  return context;
}

function buildSystemPrompt(userName, memory) {
  const now = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const name = userName && userName !== 'friend' ? userName : 'there';
  const memStr = memory && Object.keys(memory).length ? '\n\nWhat you remember about this person:\n' + JSON.stringify(memory, null, 2) : '';

  return `You are MERIDIAN AI, a warm and knowledgeable Medicare assistant for El Paso, Texas. You help Medicare beneficiaries, caregivers, and insurance agents find the right plans, understand medications, find doctors, and navigate healthcare.

Today is ${now}. You are talking with ${name}.${memStr}

PERSONALITY: Warm and friendly like a trusted friend who knows healthcare. Use the user's name naturally. Show empathy. Be encouraging and clear, never condescending.

CRITICAL — USE THE DATA BELOW: You have MERIDIAN's complete live database. ALWAYS reference specific plans, providers, and medications from the data below. Give exact numbers, exact plan names, exact copays. Never give generic answers when the specific data is right here.

RESPONSE STYLE: Conversational, short paragraphs or bullets, specific numbers, always offer a helpful follow-up. Never give medical advice — always say talk to your doctor for medical decisions.

MEMORY: When user shares name, conditions, meds, or preferences, end response with: <memory>{"key": "value"}</memory>

════════════════════════════
MERIDIAN LIVE DATABASE — USE THIS IN YOUR ANSWERS:
════════════════════════════
${buildFullContext()}`;
}

router.post('/', async (req, res) => {
  const { messages, userName, memory = {}, sessionId } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  if (sessionId) { try { DB.upsertUser(sessionId, userName, memory); } catch(e) {} }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: buildSystemPrompt(userName, memory) },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const DB = require('../db');

function buildFullContext() {
  let context = '';

  const plans = DB.getAll('plans');
  if (plans.length > 0) {
    context += '\n\n════ ALL MEDICARE PLANS ════\n';
    plans.forEach(p => {
      context += `\n▸ ${p.carrier} | ${p.plan_name} | Type: ${p.plan_type} | ID: ${p.plan_id||'N/A'}
  Premium: $${p.premium??0}/mo | Giveback: $${p.giveback??0}/mo | MOOP: $${p.moop??'N/A'}
  PCP: $${p.pcp??'N/A'} | Specialist: $${p.specialist??'N/A'} | Hospital: ${p.hospital??'N/A'}
  ER: $${p.er??'N/A'} | Urgent Care: $${p.urgent_care??'N/A'} | Ambulance: $${p.ambulance??'N/A'}
  Dental: ${p.dental_benefit??'N/A'} | Vision: ${p.vision_benefit??'N/A'} | Hearing: ${p.hearing_benefit??'N/A'}
  OTC: $${p.otc_allowance??0}/mo | Food/Utilities: ${p.food_utilities??'N/A'} | Transportation: ${p.transportation??'N/A'}
  Gym: ${p.gym??'N/A'} | PERS: ${p.pers??'N/A'} | Rx: ${p.rx??'N/A'} | Rx Deductible: ${p.rx_deductible??'N/A'}`;
    });
  }

  const providers = DB.getAll('providers');
  if (providers.length > 0) {
    context += '\n\n════ ALL PROVIDERS ════\n';
    providers.forEach(p => {
      context += `\n▸ ${p.name} | ${p.specialty??'N/A'} | ${p.clinic_name??'N/A'} | ${p.address??''} ${p.city??'El Paso'}, TX | Phone: ${p.phone??'N/A'} | Accepting: ${p.accepting_new_patients?'Yes':'No'} | Languages: ${p.languages??'N/A'} | Plans: ${p.plans_accepted??'N/A'}`;
    });
  }

  const meds = DB.getAll('medications');
  if (meds.length > 0) {
    context += '\n\n════ ALL MEDICATIONS ════\n';
    meds.forEach(m => {
      context += `\n▸ ${m.name}${m.generic_name?' ('+m.generic_name+')':''} | Class: ${m.drug_class??'N/A'} | Treats: ${m.what_it_treats??'N/A'} | Tier: ${m.tier_typical??'N/A'} | Retail: $${m.avg_monthly_cost_retail??'?'}/mo | Medicare: $${m.avg_monthly_cost_medicare??'?'}/mo`;
    });
  }

  const devices = DB.getAll('devices');
  if (devices.length > 0) {
    context += '\n\n════ ALL DEVICES ════\n';
    devices.forEach(d => {
      context += `\n▸ ${d.name} | ${d.category??'N/A'} | ${d.what_it_does??''} | Medicare covered: ${d.covered_by_medicare?'Yes':'No'} | Notes: ${d.coverage_notes??'N/A'}`;
    });
  }

  const procedures = DB.getAll('procedures');
  if (procedures.length > 0) {
    context += '\n\n════ ALL PROCEDURES ════\n';
    procedures.forEach(p => {
      context += `\n▸ ${p.name} | ${p.description??''} | Recovery: ${p.recovery_time??'N/A'} | Medicare copay: $${p.typical_copay_medicare??'?'}`;
    });
  }

  const services = DB.getAll('services');
  if (services.length > 0) {
    context += '\n\n════ ALL SERVICES ════\n';
    services.forEach(s => {
      context += `\n▸ ${s.name} | ${s.type??'N/A'} | ${s.city??'El Paso'}, TX | Phone: ${s.phone??'N/A'}`;
    });
  }

  return context;
}

function buildSystemPrompt(userName, memory) {
  const now = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const name = userName && userName !== 'friend' ? userName : 'there';
  const memStr = memory && Object.keys(memory).length ? '\n\nWhat you remember about this person:\n' + JSON.stringify(memory, null, 2) : '';

  return `You are MERIDIAN AI, a warm and knowledgeable Medicare assistant for El Paso, Texas. You help Medicare beneficiaries, caregivers, and insurance agents find the right plans, understand medications, find doctors, and navigate healthcare.

Today is ${now}. You are talking with ${name}.${memStr}

PERSONALITY: Warm and friendly like a trusted friend who knows healthcare. Use the user's name naturally. Show empathy. Be encouraging and clear, never condescending.

CRITICAL — USE THE DATA BELOW: You have MERIDIAN's complete live database. ALWAYS reference specific plans, providers, and medications from the data below. Give exact numbers, exact plan names, exact copays. Never give generic answers when the specific data is right here.

RESPONSE STYLE: Conversational, short paragraphs or bullets, specific numbers, always offer a helpful follow-up. Never give medical advice — always say talk to your doctor for medical decisions.

MEMORY: When user shares name, conditions, meds, or preferences, end response with: <memory>{"key": "value"}</memory>

════════════════════════════
MERIDIAN LIVE DATABASE — USE THIS IN YOUR ANSWERS:
════════════════════════════
${buildFullContext()}`;
}

router.post('/', async (req, res) => {
  const { messages, userName, memory = {}, sessionId } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  if (sessionId) { try { DB.upsertUser(sessionId, userName, memory); } catch(e) {} }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: buildSystemPrompt(userName, memory) },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const DB = require('../db');

function buildFullContext() {
  let context = '';

  const plans = DB.getAll('plans');
  if (plans.length > 0) {
    context += '\n\n════ ALL MEDICARE PLANS ════\n';
    plans.forEach(p => {
      context += `\n▸ ${p.carrier} | ${p.plan_name} | Type: ${p.plan_type} | ID: ${p.plan_id||'N/A'}
  Premium: $${p.premium??0}/mo | Giveback: $${p.giveback??0}/mo | MOOP: $${p.moop??'N/A'}
  PCP: $${p.pcp??'N/A'} | Specialist: $${p.specialist??'N/A'} | Hospital: ${p.hospital??'N/A'}
  ER: $${p.er??'N/A'} | Urgent Care: $${p.urgent_care??'N/A'} | Ambulance: $${p.ambulance??'N/A'}
  Dental: ${p.dental_benefit??'N/A'} | Vision: ${p.vision_benefit??'N/A'} | Hearing: ${p.hearing_benefit??'N/A'}
  OTC: $${p.otc_allowance??0}/mo | Food/Utilities: ${p.food_utilities??'N/A'} | Transportation: ${p.transportation??'N/A'}
  Gym: ${p.gym??'N/A'} | PERS: ${p.pers??'N/A'} | Rx: ${p.rx??'N/A'} | Rx Deductible: ${p.rx_deductible??'N/A'}`;
    });
  }

  const providers = DB.getAll('providers');
  if (providers.length > 0) {
    context += '\n\n════ ALL PROVIDERS ════\n';
    providers.forEach(p => {
      context += `\n▸ ${p.name} | ${p.specialty??'N/A'} | ${p.clinic_name??'N/A'} | ${p.address??''} ${p.city??'El Paso'}, TX | Phone: ${p.phone??'N/A'} | Accepting: ${p.accepting_new_patients?'Yes':'No'} | Languages: ${p.languages??'N/A'} | Plans: ${p.plans_accepted??'N/A'}`;
    });
  }

  const meds = DB.getAll('medications');
  if (meds.length > 0) {
    context += '\n\n════ ALL MEDICATIONS ════\n';
    meds.forEach(m => {
      context += `\n▸ ${m.name}${m.generic_name?' ('+m.generic_name+')':''} | Class: ${m.drug_class??'N/A'} | Treats: ${m.what_it_treats??'N/A'} | Tier: ${m.tier_typical??'N/A'} | Retail: $${m.avg_monthly_cost_retail??'?'}/mo | Medicare: $${m.avg_monthly_cost_medicare??'?'}/mo`;
    });
  }

  const devices = DB.getAll('devices');
  if (devices.length > 0) {
    context += '\n\n════ ALL DEVICES ════\n';
    devices.forEach(d => {
      context += `\n▸ ${d.name} | ${d.category??'N/A'} | ${d.what_it_does??''} | Medicare covered: ${d.covered_by_medicare?'Yes':'No'} | Notes: ${d.coverage_notes??'N/A'}`;
    });
  }

  const procedures = DB.getAll('procedures');
  if (procedures.length > 0) {
    context += '\n\n════ ALL PROCEDURES ════\n';
    procedures.forEach(p => {
      context += `\n▸ ${p.name} | ${p.description??''} | Recovery: ${p.recovery_time??'N/A'} | Medicare copay: $${p.typical_copay_medicare??'?'}`;
    });
  }

  const services = DB.getAll('services');
  if (services.length > 0) {
    context += '\n\n════ ALL SERVICES ════\n';
    services.forEach(s => {
      context += `\n▸ ${s.name} | ${s.type??'N/A'} | ${s.city??'El Paso'}, TX | Phone: ${s.phone??'N/A'}`;
    });
  }

  return context;
}

function buildSystemPrompt(userName, memory) {
  const now = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const name = userName && userName !== 'friend' ? userName : 'there';
  const memStr = memory && Object.keys(memory).length ? '\n\nWhat you remember about this person:\n' + JSON.stringify(memory, null, 2) : '';

  return `You are MERIDIAN AI, a warm and knowledgeable Medicare assistant for El Paso, Texas. You help Medicare beneficiaries, caregivers, and insurance agents find the right plans, understand medications, find doctors, and navigate healthcare.

Today is ${now}. You are talking with ${name}.${memStr}

PERSONALITY: Warm and friendly like a trusted friend who knows healthcare. Use the user's name naturally. Show empathy. Be encouraging and clear, never condescending.

CRITICAL — USE THE DATA BELOW: You have MERIDIAN's complete live database. ALWAYS reference specific plans, providers, and medications from the data below. Give exact numbers, exact plan names, exact copays. Never give generic answers when the specific data is right here.

RESPONSE STYLE: Conversational, short paragraphs or bullets, specific numbers, always offer a helpful follow-up. Never give medical advice — always say talk to your doctor for medical decisions.

MEMORY: When user shares name, conditions, meds, or preferences, end response with: <memory>{"key": "value"}</memory>

════════════════════════════
MERIDIAN LIVE DATABASE — USE THIS IN YOUR ANSWERS:
════════════════════════════
${buildFullContext()}`;
}

router.post('/', async (req, res) => {
  const { messages, userName, memory = {}, sessionId } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  if (sessionId) { try { DB.upsertUser(sessionId, userName, memory); } catch(e) {} }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: buildSystemPrompt(userName, memory) },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
