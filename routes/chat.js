const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { searchMedications, searchProviders, searchEquipment, findPlansCoveringDrug } = require('../services/documentSearch');
const { webSearch, getMedicareInfo } = require('../services/webSearch');

const GROQ_API_KEY = 'gsk_hEf8m2c34bhInXclfTwVWGdyb3FYup8WvZGdyb3FYup8Y4m0j0jiYlpm52MfmyFq9';

// Conversation memory
const conversations = new Map();

router.post('/', async (req, res) => {
  try {
    const { message, userId = 'anonymous' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    // Get conversation history
    if (!conversations.has(userId)) {
      conversations.set(userId, []);
    }
    const history = conversations.get(userId);
    history.push({ role: 'user', content: message });
    const recentHistory = history.slice(-10);
    
    // === STEP 1: Search LOCAL documents (your PDFs) ===
    let localContext = '';
    const msg = message.toLowerCase();
    
    // Check if asking about medications/drugs
    const drugMatches = msg.match(/(eliquis|metformin|lisinopril|atorvastatin|insulin|ozempic|mounjaro)/i);
    if (drugMatches || msg.includes('medicine') || msg.includes('drug') || msg.includes('prescription')) {
      const drugName = drugMatches ? drugMatches[0] : message;
      const drugs = await searchMedications(drugName);
      if (drugs.length > 0) {
        localContext += `\n📋 MEDICATION INFO FROM YOUR DOCUMENTS:\n`;
        drugs.forEach(d => {
          localContext += `• ${d.name}: Treats ${d.what_it_treats}. Tier ${d.tier_typical}. Medicare cost ~$${d.avg_monthly_cost_medicare}/mo\n`;
        });
      }
    }
    
    // Check if asking about doctors/providers
    if (msg.includes('doctor') || msg.includes('provider') || msg.includes('specialist') || msg.includes('cardiologist')) {
      const specialty = msg.match(/(cardiologist|endocrinologist|primary care|family doctor|dermatologist)/i)?.[0] || '';
      const providers = await searchProviders(specialty, '79901');
      if (providers.length > 0) {
        localContext += `\n👨‍⚕️ PROVIDERS IN EL PASO FROM YOUR DOCUMENTS:\n`;
        providers.slice(0, 5).forEach(p => {
          localContext += `• ${p.name} - ${p.specialty}. ${p.accepting_new_patients ? 'Accepting new patients' : 'Call about availability'}\n`;
        });
      }
    }
    
    // Check if asking about medical equipment
    if (msg.includes('wheelchair') || msg.includes('walker') || msg.includes('cane') || msg.includes('oxygen') || msg.includes('cpap')) {
      const equipment = await searchEquipment(message);
      if (equipment.length > 0) {
        localContext += `\n🩺 MEDICAL EQUIPMENT INFO:\n`;
        equipment.forEach(e => {
          localContext += `• ${e.name}: ${e.what_it_does}. Medicare covers: ${e.covered_by_medicare ? 'Yes' : 'Check coverage'}\n`;
        });
      }
    }
    
    // === STEP 2: Search WEB for current information ===
    let webContext = '';
    
    // Only search web for things not in local docs or current topics
    const needsWebSearch = (
      msg.includes('latest') || 
      msg.includes('2026') || 
      msg.includes('new') ||
      (drugMatches && drugMatches.length === 0) ||
      msg.includes('what is') ||
      msg.includes('how does')
    );
    
    if (needsWebSearch) {
      webContext = await webSearch(message);
      if (webContext) {
        webContext = `\n🌐 CURRENT INFORMATION FROM WEB:\n${webContext}\n`;
      }
    }
    
    // === STEP 3: Build the system prompt ===
    const systemPrompt = `You are MERIDIAN, an intelligent Medicare assistant with access to TWO sources of information:

1. LOCAL DOCUMENTS (your uploaded PDFs - plans, formularies, provider directories)
2. WEB SEARCH (current Medicare rules, drug info, latest updates)

CRITICAL RULES:
- Be warm, conversational, and human-like
- Remember everything said in this conversation
- When you have LOCAL data, prioritize it (it's specific to El Paso)
- Use WEB data for general Medicare knowledge or when local data is missing
- If you don't know something, say so honestly
- Handle typos and different phrasing naturally
- For drug questions: check local formularies first, then web for general info
- For doctor questions: use local provider directories
- For plan questions: use local plan data

${localContext ? `\n=== FROM YOUR DOCUMENTS ===\n${localContext}\n` : ''}
${webContext ? `\n=== FROM WEB SEARCH ===\n${webContext}\n` : ''}

Previous conversation:
${recentHistory.slice(0, -1).map(m => `${m.role === 'user' ? 'User' : 'MERIDIAN'}: ${m.content}`).join('\n')}

Current question: ${message}

Answer naturally as MERIDIAN, using the data above when relevant.`;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });
    
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't process that.";
    
    history.push({ role: 'assistant', content: reply });
    
    // Keep history manageable
    if (history.length > 20) {
      conversations.set(userId, history.slice(-20));
    }
    
    res.json({ reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.json({ reply: "I'm having trouble connecting. Please try again." });
  }
});

module.exports = router;
