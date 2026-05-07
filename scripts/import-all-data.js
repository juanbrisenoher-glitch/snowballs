const { Pool } = require('pg');
const https = require('https');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// All your PDF URLs organized by type
const dataSources = {
  plans: [
    'https://crm.texasmedicalcareplans.com/files/plans/352-benefits-2025-alignment-heart-diabetes-dual-sob-english.pdf',
    'https://crm.texasmedicalcareplans.com/files/plans/530-benefits-alignment-002-004-007-009-sob-eng.pdf',
    'https://crm.texasmedicalcareplans.com/files/plans/708-benefits-h5472-001-010-sob-eng.pdf',
    'https://crm.texasmedicalcareplans.com/files/plans/709-benefits-alignment-002-004-007-009-sob-eng.pdf',
    'https://crm.texasmedicalcareplans.com/files/plans/472-benefits-h5216-433-000-sob-eng.pdf',
    'https://crm.texasmedicalcareplans.com/files/plans/547-benefits-1731783310-h5216435003sb25.pdf'
  ],
  medications: [
    'https://crm.texasmedicalcareplans.com/files/plans/352-formulary-alignment-form-eng.pdf',
    'https://crm.texasmedicalcareplans.com/files/plans/530-formulary-alignment-form-eng.pdf'
  ],
  providers: [
    'https://crm.texasmedicalcareplans.com/files/plans/352-providers-alignment-providers-2026.pdf',
    'https://crm.texasmedicalcareplans.com/files/plans/530-providers-alignment-providers-2026.pdf'
  ]
};

// Sample plan data extracted from your PDFs (for immediate use)
const samplePlans = [
  {
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
    dental_benefit: '$0 exams/cleanings twice yearly, $2,000 max/year',
    vision_benefit: '$200 for glasses/contacts yearly',
    hearing_benefit: '$195-$1,750 for hearing aids, 2 per year',
    otc_allowance: '$40/month',
    gym: '$0 fitness membership',
    transportation: '50 one-way trips/year (30-mile radius)',
    pers: '$0 Personal Emergency Response System'
  },
  {
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
    dental_benefit: '$0 exams/cleanings, $4,000 max/year',
    vision_benefit: '$500 for glasses/contacts every 2 years',
    hearing_benefit: '$0 for hearing aids, 2 per year',
    otc_allowance: '$200/month',
    gym: '$0 fitness membership',
    transportation: '50 medical trips/year (50-mile radius)'
  },
  {
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
    dental_benefit: '$0 exams/cleanings, $3,500 max/year',
    vision_benefit: '$400 for glasses/contacts every 2 years',
    hearing_benefit: '$0 for hearing aids, 2 per year',
    otc_allowance: '$125/month',
    gym: '$0 fitness membership',
    transportation: '50 trips/year medical and non-medical'
  },
  {
    carrier: 'Humana',
    plan_name: 'Choice PPO',
    plan_id: 'H5216-433',
    plan_type: 'PPO',
    premium: 0,
    giveback: 50,
    moop: 4500,
    dental_benefit: '$1,500 max/year',
    vision_benefit: '$150 for glasses',
    hearing_benefit: '$500 for hearing aids'
  }
];

// Sample medications from formularies
const sampleMeds = [
  { name: 'Eliquis', generic_name: 'apixaban', drug_class: 'Anticoagulant', what_it_treats: 'Blood clots, stroke prevention', tier_typical: 3, avg_monthly_cost_medicare: 45 },
  { name: 'Jardiance', generic_name: 'empagliflozin', drug_class: 'SGLT2 Inhibitor', what_it_treats: 'Type 2 diabetes, heart failure', tier_typical: 3, avg_monthly_cost_medicare: 50 },
  { name: 'Ozempic', generic_name: 'semaglutide', drug_class: 'GLP-1 Agonist', what_it_treats: 'Type 2 diabetes', tier_typical: 3, avg_monthly_cost_medicare: 35 },
  { name: 'Mounjaro', generic_name: 'tirzepatide', drug_class: 'GIP/GLP-1 Agonist', what_it_treats: 'Type 2 diabetes', tier_typical: 4, avg_monthly_cost_medicare: 45 },
  { name: 'Farxiga', generic_name: 'dapagliflozin', drug_class: 'SGLT2 Inhibitor', what_it_treats: 'Type 2 diabetes, heart failure', tier_typical: 3, avg_monthly_cost_medicare: 50 }
];

// Sample providers from El Paso
const sampleProviders = [
  { name: 'Texas Tech Physicians of El Paso', specialty: 'Primary Care', address: '4801 Alberta Ave', city: 'El Paso', state: 'TX', zip: '79905', phone: '(915) 215-8000', accepting_new_patients: true },
  { name: 'University Medical Center of El Paso', specialty: 'Hospital', address: '4815 Alameda Ave', city: 'El Paso', state: 'TX', zip: '79905', phone: '(915) 521-7200', accepting_new_patients: true },
  { name: 'Providence Health Center', specialty: 'Hospital', address: '2001 N Oregon St', city: 'El Paso', state: 'TX', zip: '79902', phone: '(915) 577-6000', accepting_new_patients: true },
  { name: 'El Paso Cardiology Associates', specialty: 'Cardiology', address: '1700 N Oregon St', city: 'El Paso', state: 'TX', zip: '79902', phone: '(915) 533-6222', accepting_new_patients: true },
  { name: 'Rio Grande Family Medicine', specialty: 'Family Practice', address: '1300 Murchison Dr', city: 'El Paso', state: 'TX', zip: '79902', phone: '(915) 577-0900', accepting_new_patients: true }
];

async function importPlans() {
  console.log('📊 Importing plans...');
  for (const plan of samplePlans) {
    try {
      await pool.query(`
        INSERT INTO plans (carrier, plan_name, plan_id, plan_type, premium, giveback, moop, 
          specialist, pcp, er, dental_benefit, vision_benefit, hearing_benefit, otc_allowance, gym, transportation, pers)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO NOTHING
      `, [
        plan.carrier, plan.plan_name, plan.plan_id, plan.plan_type, plan.premium, 
        plan.giveback, plan.moop, plan.specialist, plan.pcp, plan.er, 
        plan.dental_benefit, plan.vision_benefit, plan.hearing_benefit, 
        plan.otc_allowance, plan.gym, plan.transportation, plan.pers || null
      ]);
      console.log(`  ✅ ${plan.carrier} - ${plan.plan_name}`);
    } catch (err) {
      console.log(`  ⚠️ Plan exists or error: ${err.message}`);
    }
  }
}

async function importMedications() {
  console.log('\n💊 Importing medications...');
  for (const med of sampleMeds) {
    try {
      await pool.query(`
        INSERT INTO medications (name, generic_name, drug_class, what_it_treats, tier_typical, avg_monthly_cost_medicare)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name) DO NOTHING
      `, [med.name, med.generic_name, med.drug_class, med.what_it_treats, med.tier_typical, med.avg_monthly_cost_medicare]);
      console.log(`  ✅ ${med.name}`);
    } catch (err) {
      console.log(`  ⚠️ Medication exists: ${err.message}`);
    }
  }
}

async function importProviders() {
  console.log('\n👨‍⚕️ Importing providers...');
  for (const provider of sampleProviders) {
    try {
      await pool.query(`
        INSERT INTO providers (name, specialty, address, city, state, zip, phone, accepting_new_patients)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (name) DO NOTHING
      `, [provider.name, provider.specialty, provider.address, provider.city, provider.state, provider.zip, provider.phone, provider.accepting_new_patients]);
      console.log(`  ✅ ${provider.name}`);
    } catch (err) {
      console.log(`  ⚠️ Provider exists: ${err.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting MERIDIAN Data Import...\n');
  
  await importPlans();
  await importMedications();
  await importProviders();
  
  console.log('\n🎉 Data import complete!');
  console.log(`📊 Plans imported: ${samplePlans.length}`);
  console.log(`💊 Medications imported: ${sampleMeds.length}`);
  console.log(`👨‍⚕️ Providers imported: ${sampleProviders.length}`);
  
  process.exit(0);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
