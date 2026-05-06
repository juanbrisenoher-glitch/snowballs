// scripts/import-plans.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Plan data extracted from Alignment Health 2025 Summary of Benefits PDF
const plans = [
  {
    id: 'ALIGNMENT-002-2025',
    carrier: 'Alignment Health',
    plan_name: 'Heart & Diabetes (HMO-POS C-SNP)',
    plan_id: '002',
    plan_type: 'HMO-POS C-SNP',
    premium: 0,
    giveback: 0,
    moop: 2400,
    specialist: 15,
    pcp: 0,
    er: 70,
    urgent_care: 0,
    dental_benefit: '$0 for exams/cleanings twice yearly, $2,000 max/year',
    vision_benefit: '$200 for glasses/contacts yearly',
    hearing_benefit: '$195-$1,750 for hearing aids, 2/year',
    otc_allowance: '$40/month',
    gym: '$0 fitness membership',
    transportation: '50 one-way trips/year (30-mile radius)',
    pers: '$0 Personal Emergency Response System'
  },
  {
    id: 'ALIGNMENT-004-2025',
    carrier: 'Alignment Health',
    plan_name: 'Heart & Diabetes Plus (HMO-POS C-SNP)',
    plan_id: '004',
    plan_type: 'HMO-POS C-SNP',
    premium: 18.30,
    giveback: 0,
    moop: 8350,
    specialist: 0,
    pcp: 0,
    er: '20% coinsurance',
    urgent_care: 0,
    dental_benefit: '$0 for exams/cleanings, $4,000 max/year',
    vision_benefit: '$500 for glasses/contacts every 2 years',
    hearing_benefit: '$0 for hearing aids, 2/year',
    otc_allowance: '$200/month',
    gym: '$0 fitness membership',
    transportation: '50 medical trips/year (50-mile radius)',
    pers: '$0 Personal Emergency Response System'
  },
  {
    id: 'ALIGNMENT-007-2025',
    carrier: 'Alignment Health',
    plan_name: 'Dual Select+ (HMO-POS D-SNP)',
    plan_id: '007',
    plan_type: 'HMO-POS D-SNP',
    premium: 18.30,
    giveback: 0,
    moop: 2900,
    specialist: 0,
    pcp: 0,
    er: 135,
    urgent_care: 0,
    dental_benefit: '$0 for exams/cleanings, $3,500 max/year',
    vision_benefit: '$400 for glasses/contacts every 2 years',
    hearing_benefit: '$0 for hearing aids, 2/year',
    otc_allowance: '$125/month',
    gym: '$0 fitness membership',
    transportation: '50 trips/year medical and non-medical',
    pers: '$0 Personal Emergency Response System'
  }
];

async function importPlans() {
  try {
    console.log('📊 Starting import of Medicare plans...');
    
    for (const plan of plans) {
      const query = `
        INSERT INTO plans (
          id, carrier, plan_name, plan_id, plan_type, premium, giveback, moop,
          specialist, pcp, er, urgent_care, dental_benefit, vision_benefit,
          hearing_benefit, otc_allowance, gym, transportation, pers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (id) DO UPDATE SET
          carrier = EXCLUDED.carrier,
          plan_name = EXCLUDED.plan_name,
          premium = EXCLUDED.premium,
          moop = EXCLUDED.moop,
          otc_allowance = EXCLUDED.otc_allowance
      `;
      
      await pool.query(query, [
        plan.id, plan.carrier, plan.plan_name, plan.plan_id, plan.plan_type,
        plan.premium, plan.giveback, plan.moop, plan.specialist, plan.pcp,
        plan.er, plan.urgent_care, plan.dental_benefit, plan.vision_benefit,
        plan.hearing_benefit, plan.otc_allowance, plan.gym, plan.transportation, plan.pers
      ]);
      
      console.log(`✅ Imported: ${plan.carrier} - ${plan.plan_name}`);
    }
    
    console.log('🎉 All plans imported successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importPlans();
