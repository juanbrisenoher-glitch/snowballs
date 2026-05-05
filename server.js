const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================
// YOUR COMPLETE DATA (copied from your GitHub)
// ============================================

const PLANS = [
  {id:1,carrier:"Alignment",plan_name:"Alignment the One + Walgreens (HMO-POS)",giveback:0,moop:2950,specialist:15,dental_benefit:"$2,500 annual",otc_allowance:20,transportation:"34 one-way trips",vision_benefit:"$200 eyewear",hearing_benefit:"$195-$1,750 copay per aid",gym:"Covered",food_utilities:"$30 monthly"},
  {id:2,carrier:"Alignment",plan_name:"Alignment SmartSavings (HMO-POS)",giveback:164.90,moop:6450,specialist:35,dental_benefit:"Preventive Only",otc_allowance:0,transportation:"Not Covered"},
  {id:3,carrier:"Alignment",plan_name:"Alignment Heart & Diabetes (HMO-POS C-SNP)",giveback:0,moop:2400,specialist:15,dental_benefit:"$2,000 annual",otc_allowance:40,transportation:"50 one-way trips"},
  {id:4,carrier:"Alignment",plan_name:"Alignment Dual Heart & Diabetes Plus (HMO C-SNP)",giveback:0,moop:0,specialist:0,dental_benefit:"$3,600 annual",otc_allowance:197,transportation:"50 one-way trips",food_utilities:"$197 monthly"},
  {id:5,carrier:"Alignment",plan_name:"Alignment Total Dual+ (HMO-POS D-SNP)",giveback:0,moop:0,specialist:0,dental_benefit:"$2,700 annual",otc_allowance:197,transportation:"50 one-way trips"},
  {id:6,carrier:"BCBS",plan_name:"BCBS Basic HMO",giveback:0,moop:3700,specialist:26,dental_benefit:"Preventive Only",otc_allowance:20,transportation:"Not Covered"},
  {id:7,carrier:"BCBS",plan_name:"BCBS Dental Premier PPO",giveback:0,moop:8000,specialist:47,dental_benefit:"Preventive Only",otc_allowance:0,transportation:"Not Covered"},
  {id:8,carrier:"Humana",plan_name:"Humana Gold Plus SNP-DE (HMO D-SNP)",giveback:0,moop:0,specialist:140,dental_benefit:"Covered",otc_allowance:0,food_utilities:"$125 monthly SSBCI"},
  {id:9,carrier:"UnitedHealthcare",plan_name:"UHC Dual Complete TX-Q2 HMO-POS (D-SNP)",giveback:0,moop:0,dental_benefit:"$1,500 annual",otc_allowance:99,food_utilities:"$99 monthly",transportation:"24 one-way trips"},
  {id:10,carrier:"UnitedHealthcare",plan_name:"UHC Dual Complete TX-D001 PPO (D-SNP)",giveback:0,moop:0,dental_benefit:"$1,500 annual",otc_allowance:60,food_utilities:"$60 monthly"},
  {id:11,carrier:"UnitedHealthcare",plan_name:"UHC Dual Complete TX-S4 HMO-POS (D-SNP)",giveback:0,moop:0,dental_benefit:"$1,500 annual",otc_allowance:143,food_utilities:"$143 monthly",transportation:"48 one-way trips"},
  {id:12,carrier:"HealthSpring/Cigna",plan_name:"HealthSpring Preferred (HMO)",giveback:0,moop:3500,specialist:15,dental_benefit:"$2,700 annual",otc_allowance:28,transportation:"Unlimited"},
  {id:13,carrier:"HealthSpring/Cigna",plan_name:"HealthSpring Preferred Savings (HMO)",giveback:145,moop:6775,specialist:45,dental_benefit:"$2,500 annual",otc_allowance:33},
  {id:14,carrier:"HealthSpring/Cigna",plan_name:"HealthSpring TotalCare (HMO D-SNP)",giveback:0,moop:3400,specialist:0,dental_benefit:"$3,000 annual",otc_allowance:67}
];

const PROVIDERS = [
  {id:1,name:"Dr. Maria Garcia",specialty:"Internal Medicine",clinic_name:"El Paso Medical Group",city:"El Paso",phone:"(915) 555-0101",accepting_new_patients:true,plans_accepted:"UnitedHealthcare, Humana, Wellcare"},
  {id:2,name:"Dr. James Patel",specialty:"Cardiology",clinic_name:"West Texas Heart Center",city:"El Paso",phone:"(915) 555-0202",accepting_new_patients:true,plans_accepted:"UnitedHealthcare, Humana, Alignment, Devoted"},
  {id:3,name:"Dr. Ana Lopez",specialty:"Endocrinology",clinic_name:"El Paso Diabetes & Endocrine",city:"El Paso",phone:"(915) 555-0303",accepting_new_patients:true,plans_accepted:"All plans"}
];

const MEDICATIONS = [
  {id:1,name:"Eliquis",what_it_treats:"Blood clots, stroke prevention",tier_typical:3,avg_monthly_cost_medicare:45},
  {id:2,name:"Ozempic",what_it_treats:"Type 2 diabetes",tier_typical:3,avg_monthly_cost_medicare:60},
  {id:3,name:"Metformin",what_it_treats:"Type 2 diabetes",tier_typical:1,avg_monthly_cost_medicare:5},
  {id:4,name:"Lisinopril",what_it_treats:"High blood pressure",tier_typical:1,avg_monthly_cost_medicare:5},
  {id:5,name:"Atorvastatin",what_it_treats:"High cholesterol",tier_typical:1,avg_monthly_cost_medicare:7}
];

// ============================================
// API ENDPOINTS
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/plans', (req, res) => {
  res.json(PLANS);
});

app.get('/api/providers', (req, res) => {
  res.json(PROVIDERS);
});

app.get('/api/medications', (req, res) => {
  res.json(MEDICATIONS);
});

// Main chat endpoint
app.post('/api/chat', (req, res) => {
  const { messages } = req.body;
  const userMsg = messages?.[messages.length - 1]?.content || '';
  const lower = userMsg.toLowerCase();
  
  let reply = "Hi! I'm MERIDIAN AI. I can help you find Medicare plans, check drug coverage, or find doctors. Try asking:\n\n• 'Which plans have giveback?'\n• 'Show me the lowest MOOP plans'\n• 'What dental benefits are available?'\n• 'Find a cardiologist in El Paso'";
  
  // GIVEBACK PLANS
  if (lower.includes('giveback')) {
    const gbPlans = PLANS.filter(p => p.giveback > 0);
    if (gbPlans.length) {
      reply = "💰 **Plans with Part B Giveback:**\n\n";
      gbPlans.forEach(p => {
        reply += `• ${p.carrier} ${p.plan_name} — $${p.giveback}/mo\n`;
      });
      reply += "\nWant me to show you the lowest MOOP plans instead?";
    }
  }
  // LOWEST MOOP
  else if (lower.includes('moop') || lower.includes('out of pocket')) {
    const sorted = [...PLANS].sort((a,b) => (a.moop || 9999) - (b.moop || 9999));
    reply = "📋 **Lowest MOOP plans:**\n\n";
    sorted.slice(0, 8).forEach(p => {
      reply += `• ${p.carrier} ${p.plan_name} — MOOP $${p.moop === 0 ? '0' : p.moop.toLocaleString()}\n`;
    });
    if (sorted[0]?.moop === 0) reply += "\n✨ Several D-SNP plans have $0 MOOP!";
  }
  // DENTAL
  else if (lower.includes('dental')) {
    const dentalPlans = PLANS.filter(p => p.dental_benefit && !p.dental_benefit.includes('Preventive'));
    if (dentalPlans.length) {
      reply = "🦷 **Best dental benefits:**\n\n";
      dentalPlans.forEach(p => {
        reply += `• ${p.carrier} ${p.plan_name} — ${p.dental_benefit}\n`;
      });
    } else {
      reply = "No plans with comprehensive dental benefits found in the current list.";
    }
  }
  // OTC
  else if (lower.includes('otc') || lower.includes('over the counter')) {
    const otcPlans = PLANS.filter(p => p.otc_allowance > 0);
    if (otcPlans.length) {
      reply = "💊 **OTC allowances:**\n\n";
      otcPlans.forEach(p => {
        reply += `• ${p.carrier} ${p.plan_name} — $${p.otc_allowance}/mo\n`;
      });
    }
  }
  // TRANSPORTATION
  else if (lower.includes('transport') || lower.includes('ride') || lower.includes('lyft')) {
    const transportPlans = PLANS.filter(p => p.transportation && p.transportation !== 'Not Covered');
    if (transportPlans.length) {
      reply = "🚗 **Transportation benefits:**\n\n";
      transportPlans.forEach(p => {
        reply += `• ${p.carrier} ${p.plan_name} — ${p.transportation}\n`;
      });
    }
  }
  // PROVIDERS / DOCTORS
  else if (lower.includes('doctor') || lower.includes('provider') || lower.includes('cardiologist') || lower.includes('find')) {
    let specialty = '';
    if (lower.includes('cardio')) specialty = 'Cardiology';
    else if (lower.includes('endo')) specialty = 'Endocrinology';
    else if (lower.includes('intern')) specialty = 'Internal Medicine';
    
    let matches = PROVIDERS;
    if (specialty) matches = PROVIDERS.filter(p => p.specialty === specialty);
    
    if (matches.length) {
      reply = "👨‍⚕️ **Providers in El Paso:**\n\n";
      matches.forEach(p => {
        reply += `• ${p.name} — ${p.specialty}\n  📍 ${p.clinic_name}\n  📞 ${p.phone}\n  ✅ Accepting new patients: ${p.accepting_new_patients ? 'Yes' : 'No'}\n  🩺 Plans: ${p.plans_accepted}\n\n`;
      });
    }
  }
  // DRUGS / MEDICATIONS
  else if (lower.includes('eliquis')) {
    const drug = MEDICATIONS.find(m => m.name === 'Eliquis');
    reply = `💊 **Eliquis (apixaban)**\n\n• Treats: ${drug.what_it_treats}\n• Typical tier: ${drug.tier_typical}\n• Medicare cost: ~$${drug.avg_monthly_cost_medicare}/mo\n• Retail cost: ~$${drug.avg_monthly_cost_medicare * 10}/mo\n\nMost plans cover Eliquis on Tier 3 with prior authorization. Some D-SNP plans have $0 copay.`;
  }
  else if (lower.includes('ozempic')) {
    reply = "💊 **Ozempic (semaglutide)**\n\n• Treats: Type 2 diabetes\n• Typical tier: 3\n• Medicare cost: ~$60/mo\n\nCoverage varies by plan. Prior authorization is common. Some D-SNP plans cover at $0. For weight loss, check with your doctor about alternatives.";
  }
  else if (lower.includes('metformin')) {
    reply = "💊 **Metformin**\n\n• Treats: Type 2 diabetes\n• Typical tier: 1 (lowest cost)\n• Medicare cost: ~$5/mo\n\nThis is a preferred generic on almost all plans — very affordable.";
  }
  
  res.json({ choices: [{ message: { content: reply } }] });
});

app.listen(PORT, () => {
  console.log(`✅ MERIDIAN backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Plans: http://localhost:${PORT}/api/plans`);
  console.log(`📍 Providers: http://localhost:${PORT}/api/providers`);
});
