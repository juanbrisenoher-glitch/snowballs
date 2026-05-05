<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MERIDIAN | TX Medicare Intelligence</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg-primary: #f8fafc;
      --bg-secondary: #ffffff;
      --bg-tertiary: #f1f5f9;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --border: #e2e8f0;
      --accent: #c8553d;
      --accent-light: #fef1ee;
      --accent-dark: #b03e28;
      --accent-glow: rgba(200,85,61,0.15);
      --teal: #1a7a6e;
      --teal-light: #e6f4ea;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
      --radius-lg: 16px;
      --radius-xl: 24px;
    }
    
    [data-theme="dark"] {
      --bg-primary: #0f0f17;
      --bg-secondary: #1a1a24;
      --bg-tertiary: #1e1e2a;
      --text-primary: #f1f5f9;
      --text-secondary: #cbd5e1;
      --text-muted: #64748b;
      --border: #2a2a34;
      --accent: #e8734f;
      --accent-light: #2a1a16;
      --teal: #2a9d8f;
      --teal-light: #1a2a26;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      transition: all 0.3s ease;
    }
    
    .header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(var(--bg-secondary), 0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
    }
    .header-inner {
      max-width: 1600px;
      margin: 0 auto;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--accent), var(--accent-dark));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-icon i { color: white; font-size: 16px; }
    .logo-text h1 {
      font-family: 'Space Grotesk', monospace;
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--text-primary), var(--accent));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .logo-text p { font-size: 10px; color: var(--text-muted); }
    .stats-bar { display: flex; gap: 20px; }
    .stat-value {
      font-family: 'Space Grotesk', monospace;
      font-size: 20px;
      font-weight: 700;
      color: var(--accent);
    }
    .stat-label { font-size: 10px; text-transform: uppercase; color: var(--text-muted); }
    .header-actions { display: flex; gap: 10px; }
    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .icon-btn:hover {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    
    .main-layout {
      max-width: 1600px;
      margin: 0 auto;
      padding: 24px;
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }
    
    .sidebar {
      width: 280px;
      flex-shrink: 0;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      position: sticky;
      top: 80px;
      max-height: calc(100vh - 100px);
      overflow-y: auto;
    }
    .sidebar-section { margin-bottom: 28px; }
    .sidebar-title {
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .select-all-btn {
      font-size: 11px;
      color: var(--accent);
      cursor: pointer;
    }
    .plan-checkbox-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      cursor: pointer;
      font-size: 13px;
    }
    .plan-checkbox-item:hover { color: var(--accent); }
    .plan-checkbox-item input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent); }
    .plan-checkbox-item label { flex: 1; cursor: pointer; }
    
    .search-small { margin-top: 6px; }
    .search-small input {
      width: 100%;
      padding: 10px 14px;
      border-radius: 40px;
      border: 1px solid var(--border);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 13px;
      margin-bottom: 10px;
    }
    .search-small button {
      width: 100%;
      padding: 10px;
      background: var(--accent);
      border: none;
      border-radius: 40px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
    .clear-search-btn {
      margin-top: 8px;
      background: none;
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    
    .content { flex: 1; min-width: 0; }
    
    .compare-bar {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 12px 20px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .compare-slots { display: flex; gap: 12px; flex-wrap: wrap; }
    .compare-slot {
      background: var(--bg-tertiary);
      border: 1px dashed var(--border);
      border-radius: 40px;
      padding: 6px 14px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .compare-slot.filled { border-style: solid; border-color: var(--accent); background: var(--accent-light); }
    .compare-slot button { background: none; border: none; cursor: pointer; color: var(--text-muted); }
    .compare-btn {
      background: var(--accent);
      border: none;
      padding: 8px 20px;
      border-radius: 40px;
      color: white;
      font-weight: 600;
      cursor: pointer;
    }
    
    .plans-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }
    .plan-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px;
      transition: all 0.2s;
      cursor: pointer;
    }
    .plan-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
      border-color: var(--accent);
    }
    .plan-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .plan-carrier {
      font-size: 10px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
    }
    .plan-cat {
      font-size: 9px;
      padding: 2px 8px;
      border-radius: 99px;
      background: var(--accent-light);
      color: var(--accent);
    }
    .plan-name {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .plan-id {
      font-size: 9px;
      color: var(--text-muted);
      font-family: monospace;
      margin-bottom: 10px;
    }
    .plan-stats {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
      font-size: 11px;
    }
    .plan-actions {
      margin-top: 12px;
      display: flex;
      gap: 8px;
    }
    .compare-plan-btn {
      background: none;
      border: 1px solid var(--border);
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .compare-plan-btn:hover {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }
    
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(8px);
      z-index: 300;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: var(--bg-secondary);
      border-radius: var(--radius-xl);
      max-width: 700px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
    }
    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-body { padding: 24px; }
    .close-modal {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--bg-tertiary);
      border: none;
      cursor: pointer;
    }
    .benefits-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .benefit-item {
      background: var(--bg-tertiary);
      border-radius: 12px;
      padding: 10px;
    }
    .benefit-label {
      font-size: 9px;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .benefit-value {
      font-size: 14px;
      font-weight: 700;
      margin-top: 4px;
    }
    .empty-state { text-align: center; padding: 40px; color: var(--text-muted); }
    #providerResultsArea { margin-top: 24px; }
    .provider-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .provider-card {
      background: var(--bg-tertiary);
      border-radius: 12px;
      padding: 14px;
    }
    
    @media (max-width: 900px) {
      .main-layout { flex-direction: column; }
      .sidebar { width: 100%; position: relative; top: 0; max-height: none; }
      .stats-bar { display: none; }
      .benefits-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<header class="header">
  <div class="header-inner">
    <div class="logo">
      <div class="logo-icon"><i class="fas fa-chart-line"></i></div>
      <div class="logo-text">
        <h1>MERIDIAN</h1>
        <p>TX Medicare Intelligence</p>
      </div>
    </div>
    <div class="stats-bar">
      <div class="stat-item"><div class="stat-value" id="totalPlans">0</div><div class="stat-label">Total Plans</div></div>
      <div class="stat-item"><div class="stat-value" id="visibleCount">0</div><div class="stat-label">Visible</div></div>
    </div>
    <div class="header-actions">
      <button class="icon-btn" id="themeToggle"><i class="fas fa-moon"></i></button>
    </div>
  </div>
</header>

<div class="main-layout">
  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-title">
        <span><i class="fas fa-check-square"></i> Carriers</span>
        <span class="select-all-btn" onclick="toggleSelectAll()">Select All</span>
      </div>
      <div id="planCheckboxList"></div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-title"><span><i class="fas fa-pills"></i> Drug Lookup</span></div>
      <div class="search-small">
        <input type="text" id="drugInput" placeholder="Drug name... e.g., eliquis" onkeypress="if(event.key==='Enter') searchDrug()">
        <button onclick="searchDrug()">Search Drug</button>
        <button class="clear-search-btn" onclick="clearDrugSearch()">Clear Search</button>
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-title"><span><i class="fas fa-user-md"></i> Provider Search</span></div>
      <div class="search-small">
        <input type="text" id="providerInput" placeholder="Specialty or city..." onkeypress="if(event.key==='Enter') searchProvider()">
        <button onclick="searchProvider()">Search Provider</button>
        <button class="clear-search-btn" onclick="clearProviderSearch()">Clear Results</button>
      </div>
    </div>
  </aside>

  <div class="content">
    <div class="compare-bar" id="compareBar" style="display: none;">
      <div class="compare-slots" id="compareSlots"></div>
      <button class="compare-btn" onclick="showComparison()">Compare →</button>
    </div>

    <div class="plans-header">
      <h3><i class="fas fa-file-medical"></i> Medicare Plans</h3>
      <span style="font-size: 12px;">Click any plan for full benefits</span>
    </div>
    <div class="plans-grid" id="plansGrid"></div>

    <div id="providerResultsArea" style="display: none;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
        <strong><i class="fas fa-stethoscope"></i> Provider Results</strong>
        <span id="providerStats" style="font-size: 12px;"></span>
      </div>
      <div id="providerResultsContent"></div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="planModal">
  <div class="modal">
    <div class="modal-header">
      <div id="modalTitle"></div>
      <button class="close-modal" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>

<script>
// ============================================
// ALL 37 PLANS
// ============================================
const PLANS = [
  // WELLPOINT
  {id:"wlpt-full",carrier:"Wellpoint",name:"Wellpoint Full Dual Advantage",planId:"H8849-010-004",type:"HMO D-SNP",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$3,000",vision:"$250",hearing:"$3,000",transport:"48 one-way",gym:true,otc:"$105/month",food:"$105/month",pers:true,notes:"For QMB, FBDE, QMB+, SLMB+. $3,000 hearing. PERS included."},
  {id:"wlpt-dual",carrier:"Wellpoint",name:"Wellpoint Dual Advantage",planId:"H8894-011-004",type:"HMO D-SNP",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$3,000",vision:"$250",hearing:"$3,000",transport:"24 one-way",gym:true,otc:"$87/month",food:"$87/month",pers:true,notes:"For SLMB, QI levels. PERS included."},

  // UHC
  {id:"uhc-q2",carrier:"UnitedHealthcare",name:"UHC Dual Complete TX-Q2",planId:"H4527-057-000",type:"HMO-POS",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$1,500",vision:"$200",hearing:"$2,200/2yr",transport:"24 one-way",gym:true,otc:"$99/month",food:"$99/month",pers:false,notes:"For QMB, FBDE, QMB+, SLMB+. $99/mo SSBCI."},
  {id:"uhc-d001",carrier:"UnitedHealthcare",name:"UHC Dual Complete TX-D001 PPO",planId:"H2406-050-000",type:"PPO",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$1,500",vision:"$200",hearing:"$2,200/2yr",transport:"24 one-way",gym:true,otc:"$60/month",food:"$60/month",pers:false,notes:"PPO version. $60/mo SSBCI."},
  {id:"uhc-s4",carrier:"UnitedHealthcare",name:"UHC Dual Complete TX-S4",planId:"H4527-054-000",type:"HMO-POS",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$3,000",vision:"$350",hearing:"$2,500/2yr",transport:"48 one-way",gym:true,otc:"$143/month",food:"$143/month",pers:false,notes:"Best UHC dual. For FBDE, QMB+, SLMB+. $143/mo SSBCI."},
  {id:"uhc-v002",carrier:"UnitedHealthcare",name:"UHC Dual Complete TX-V002",planId:"H4527-003-000",type:"HMO-POS",cat:"dual",premium:0,giveback:0,moop:4900,specialist:35,pcp:0,er:130,urgentCare:50,hospital:"$350 days 1-6",ambulance:290,outpatientSurg:"$300-$350",mri:"$260",xray:"$25",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$1,500",vision:"$150/2yr",hearing:"$199-$1,249/aid",transport:"24 one-way",gym:true,otc:"$50/month",food:"$50/month",pers:false,notes:"For SLMB, QI levels. MOOP $4,900."},

  // HEALTHSPRING / CIGNA
  {id:"hs-061",carrier:"HealthSpring / Cigna",name:"HealthSpring Preferred",planId:"H4513-061-003",type:"HMO",cat:"standard",premium:0,giveback:0,moop:3500,specialist:15,pcp:0,er:150,urgentCare:25,hospital:"$50 days 1-5",ambulance:150,outpatientSurg:"$0-$125",mri:"$0-$150",xray:"$0",labs:0,medDeduct:0,rxDed:200,rxCopays:"$0 / $2 / $47 / 50% / 30%",dental:"$2,700",vision:"$200",hearing:"$399-$1,800/aid",transport:"Unlimited",gym:true,otc:"$85/quarter",food:"None",pers:false,notes:"UNLIMITED transportation!"},
  {id:"hs-083",carrier:"HealthSpring / Cigna",name:"HealthSpring Preferred Savings",planId:"H4513-083-003",type:"HMO",cat:"giveback",premium:0,giveback:145,moop:6775,specialist:45,pcp:0,er:115,urgentCare:35,hospital:"$320 days 1-6",ambulance:240,outpatientSurg:"$275-$320",mri:"$0-$325",xray:"$10",labs:0,medDeduct:0,rxDed:300,rxCopays:"$0 / $0 / $47 / 50% / 29%",dental:"$2,500",vision:"$250",hearing:"$399-$1,800/aid",transport:"Not Covered",gym:true,otc:"$100/quarter",food:"None",pers:false,notes:"$145/mo giveback. High MOOP."},
  {id:"hs-093",carrier:"HealthSpring / Cigna",name:"HealthSpring Preferred Full Savings",planId:"H4513-093-003",type:"HMO",cat:"giveback",premium:0,giveback:185,moop:6900,specialist:50,pcp:0,er:115,urgentCare:35,hospital:"$375 days 1-6",ambulance:240,outpatientSurg:"$275-$350",mri:"$0-$325",xray:"$10",labs:0,medDeduct:0,rxDed:500,rxCopays:"$0 / $0 / $47 / 50% / 27%",dental:"$1,200",vision:"$125",hearing:"$399-$1,800/aid",transport:"10 one-way",gym:true,otc:"$30/quarter",food:"None",pers:false,notes:"Highest giveback at $185/mo."},
  {id:"hs-060",carrier:"HealthSpring / Cigna",name:"HealthSpring TotalCare",planId:"H4513-060-003",type:"HMO D-SNP",cat:"dual",premium:0,giveback:0,moop:3400,specialist:0,pcp:0,er:150,urgentCare:0,hospital:"$0",ambulance:100,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$3,000",vision:"$300",hearing:"$399-$1,800/aid",transport:"Unlimited",gym:true,otc:"$200/quarter",food:"None",pers:false,notes:"D-SNP with UNLIMITED transportation. MOOP $3,400."},
  {id:"hs-ppo",carrier:"HealthSpring / Cigna",name:"True Choice PPO",planId:"H7849-154-000",type:"PPO",cat:"standard",premium:0,giveback:0,moop:6800,specialist:40,pcp:0,er:115,urgentCare:40,hospital:"$230 days 1-6",ambulance:275,outpatientSurg:"$325-$375",mri:"$0-$225",xray:"$50",labs:0,medDeduct:400,rxDed:500,rxCopays:"$0 / $5 / $47 / 50% / 30%",dental:"$600",vision:"$100",hearing:"$399-$1,800/aid",transport:"10 one-way",gym:true,otc:"$40/quarter",food:"None",pers:false,notes:"Only PPO. $400 medical deductible."},
  {id:"hs-009",carrier:"HealthSpring / Cigna",name:"HealthSpring",planId:"H4513-009",type:"HMO",cat:"standard",premium:120,giveback:0,moop:4300,specialist:25,pcp:0,er:130,urgentCare:30,hospital:"$375 per stay",ambulance:200,outpatientSurg:"$200-$250",mri:"$0-$150",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"Not Covered",dental:"$1,500",vision:"$250",hearing:"$399-$1,800/aid",transport:"Not Covered",gym:true,otc:"$45/quarter",food:"None",pers:false,notes:"$120 premium. NO Rx coverage."},

  // BCBS
  {id:"bcbs-basic",carrier:"BCBS",name:"Basic HMO",planId:"H8133-005-000",type:"HMO",cat:"standard",premium:0,giveback:0,moop:3700,specialist:26,pcp:0,er:135,urgentCare:30,hospital:"$325 days 1-6",ambulance:295,outpatientSurg:"$0-$300",mri:"$0-$300",xray:"$0-$50",labs:"$0-$50",medDeduct:0,rxDed:450,rxCopays:"$0 / $1 / 18% / 39% / 27%",dental:"Preventive Only",vision:"$100",hearing:"$699-$999/aid",transport:"Not Covered",gym:true,otc:"$60/quarter",food:"None",pers:false,notes:"Standard HMO. Preventive dental only."},
  {id:"bcbs-dental",carrier:"BCBS",name:"Dental Premier PPO",planId:"H4801-016-0",type:"PPO",cat:"standard",premium:110,giveback:0,moop:8000,specialist:47,pcp:7,er:100,urgentCare:40,hospital:"$375 days 1-6",ambulance:275,outpatientSurg:"$335-$390",mri:"$0-$300",xray:"$0-$100",labs:"$0",medDeduct:750,rxDed:450,rxCopays:"$0 / $1 / 17% / 37% / 27%",dental:"Preventive Only",vision:"$100",hearing:"$699-$999/aid",transport:"Not Covered",gym:true,otc:"None",food:"None",pers:false,notes:"$110 premium. NON-COMMISSIONABLE."},

  // HUMANA
  {id:"hum-061",carrier:"Humana",name:"Humana Gold Plus",planId:"H4461-061-000",type:"HMO",cat:"standard",premium:0,giveback:0,moop:3350,specialist:15,pcp:0,er:150,urgentCare:65,hospital:"$95 days 1-5",ambulance:335,outpatientSurg:"$45-$120",mri:"$200-$300",xray:"$0-$130",labs:0,medDeduct:0,rxDed:615,rxCopays:"$0 / $0 / $45 / 35% / 25%",dental:"$2,000 (covers dentures)",vision:"$250",hearing:"$399/aid",transport:"24 one-way",gym:true,otc:"$75/quarter",food:"None",pers:false,notes:"Good all-around standard plan."},
  {id:"hum-053",carrier:"Humana",name:"Humana Gold Plus $14",planId:"H4461-053-000",type:"HMO",cat:"standard",premium:14,giveback:0,moop:3400,specialist:0,pcp:0,er:150,urgentCare:65,hospital:"$95 days 1-5",ambulance:335,outpatientSurg:"$45-$120",mri:"$200-$300",xray:"$0-$130",labs:0,medDeduct:0,rxDed:615,rxCopays:"$0 / $0 / $45 / 50% / 25%",dental:"$5,000 (covers dentures)",vision:"$350",hearing:"$0-$299/aid",transport:"100 one-way",gym:true,otc:"$90/quarter",food:"None",pers:false,notes:"$5,000 dental. 100 transport trips. $0 specialist."},
  {id:"hum-066",carrier:"Humana",name:"Humana Gold Plus - Diabetes & Heart",planId:"H4461-066-000",type:"HMO C-SNP",cat:"csnp",premium:0,giveback:0,moop:3450,specialist:10,pcp:0,er:150,urgentCare:65,hospital:"$95 days 1-5",ambulance:335,outpatientSurg:"$45-$120",mri:"$200-$300",xray:"$0-$130",labs:0,medDeduct:0,rxDed:615,rxCopays:"$0 / $0 / $45 / 47% / 25%",dental:"$2,000",vision:"$200",hearing:"$299-$599/aid",transport:"60 one-way",gym:true,otc:"$75/month (roll-over)",food:"None",pers:false,notes:"C-SNP for diabetes/heart. $75/mo OTC rollover."},
  {id:"hum-gvb",carrier:"Humana",name:"HumanaChoice Giveback PPO",planId:"H7617-041-000",type:"PPO",cat:"giveback",premium:0,giveback:120,moop:7950,specialist:35,pcp:0,er:115,urgentCare:40,hospital:"$325 days 1-6",ambulance:335,outpatientSurg:"$275-$350",mri:"$200-$300",xray:"$0-$115",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $0 / $30 / 34% / 33%",dental:"$3,000",vision:"$113",hearing:"$699-$999/aid",transport:"Not Covered",gym:true,otc:"$40/quarter",food:"None",pers:false,notes:"PPO giveback. No Rx deductible."},
  {id:"hum-ppo1",carrier:"Humana",name:"HumanaChoice PPO",planId:"H7617-063-000",type:"PPO",cat:"standard",premium:0,giveback:1,moop:4225,specialist:30,pcp:0,er:130,urgentCare:50,hospital:"$245 days 1-5",ambulance:335,outpatientSurg:"$180-$275",mri:"$200-$300",xray:"$0-$130",labs:0,medDeduct:0,rxDed:340,rxCopays:"$0 / $9 / $45 / 45% / 29%",dental:"$2,500 (covers dentures)",vision:"$250",hearing:"$299-$599/aid",transport:"48 one-way",gym:true,otc:"$60/quarter",food:"None",pers:false,notes:"PPO with dental that covers dentures."},
  {id:"hum-dsnp1",carrier:"Humana",name:"Humana Gold Plus SNP-DE",planId:"H4461-070-000",type:"HMO D-SNP",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$3,000",vision:"$250",hearing:"$0 (basic aids)",transport:"60 one-way",gym:true,otc:"$215/month (SSBCI)",food:"$215/month",pers:false,notes:"$0 MOOP D-SNP. $215/mo SSBCI."},
  {id:"hum-usaa",carrier:"Humana",name:"Humana USAA Honor Giveback PPO",planId:"H7617-062-000",type:"PPO",cat:"giveback",premium:0,giveback:130,moop:7900,specialist:40,pcp:0,er:115,urgentCare:40,hospital:"$345 days 1-6",ambulance:335,outpatientSurg:"$275-$350",mri:"$200-$300",xray:"$0-$130",labs:0,medDeduct:0,rxDed:0,rxCopays:"NO PART D",dental:"$1,000",vision:"$113",hearing:"$699-$999/aid",transport:"Not Covered",gym:true,otc:"None",food:"None",pers:false,notes:"⚠️ NO PART D coverage. Requires USAA eligibility."},

  // ALIGNMENT
  {id:"aln-001",carrier:"Alignment Health",name:"Alignment the One + Walgreens",planId:"H5472-001-000",type:"HMO-POS",cat:"standard",premium:0,giveback:0,moop:2950,specialist:15,pcp:0,er:100,urgentCare:0,hospital:"$0 days 1-2 / $120 days 3-7",ambulance:200,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $0 / $45 / 32% / 33% / $5",dental:"$2,500 (Liberty Dental)",vision:"$200 (VSP)",hearing:"$195-$1,750/aid",transport:"34 one-way",gym:true,otc:"$20/month",food:"$30/month",pers:false,notes:"Lowest MOOP at $2,950."},
  {id:"aln-010",carrier:"Alignment Health",name:"Alignment SmartSavings",planId:"H5472-010",type:"HMO-POS",cat:"giveback",premium:0,giveback:164.90,moop:6450,specialist:35,pcp:0,er:120,urgentCare:20,hospital:"$375 days 1-6",ambulance:200,outpatientSurg:"$50-$200",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:615,rxCopays:"$0 / $0 / $45 / 40% / 25% / $5",dental:"Preventive Only",vision:"$100/2yr",hearing:"$0 exam only",transport:"Not Covered",gym:true,otc:"None",food:"None",pers:false,notes:"$164.90/mo giveback."},
  {id:"aln-002",carrier:"Alignment Health",name:"Alignment Heart & Diabetes",planId:"H5472-002",type:"HMO-POS-CSNP",cat:"csnp",premium:0,giveback:0,moop:2400,specialist:15,pcp:0,er:120,urgentCare:0,hospital:"$200 days 1-5",ambulance:200,outpatientSurg:"$50-$100",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $0 / $45 / 32% / 33% / $5",dental:"$2,000",vision:"$200",hearing:"$195-$1,750/aid",transport:"50 one-way",gym:true,otc:"$40/month",food:"$40/month",pers:false,notes:"C-SNP for heart/diabetes."},
  {id:"aln-004",carrier:"Alignment Health",name:"Alignment Dual H&D Plus",planId:"H5472-004",type:"HMO C-SNP",cat:"csnp",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$3,600",vision:"$500/2yr",hearing:"$0 (basic aids)",transport:"50 one-way",gym:true,otc:"$197/month",food:"$197/month",pers:true,notes:"$0 MOOP. Requires Medicaid + chronic condition."},
  {id:"aln-007",carrier:"Alignment Health",name:"Alignment Dual Select+",planId:"H5472-007",type:"HMO-POS-DSNP",cat:"dual",premium:0,giveback:0,moop:2900,specialist:0,pcp:0,er:135,urgentCare:0,hospital:"$0",ambulance:100,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$2,700",vision:"$400/2yr",hearing:"$0 (basic aids)",transport:"50 one-way",gym:true,otc:"$100/month",food:"$100/month",pers:false,notes:"D-SNP for SLMB/QI."},
  {id:"aln-009",carrier:"Alignment Health",name:"Alignment Total Dual+",planId:"H5472-009",type:"HMO-POS D-SNP",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$4,000",vision:"$400/2yr",hearing:"$0 (basic aids)",transport:"50 one-way",gym:true,otc:"$193/month",food:"$193/month",pers:true,notes:"$0 MOOP. $4,000 dental. PERS included."},

  // DEVOTED
  {id:"dev-007",carrier:"Devoted Health",name:"Devoted Core 007 TX",planId:"H7993-007-00",type:"HMO",cat:"standard",premium:0,giveback:0,moop:3450,specialist:20,pcp:0,er:150,urgentCare:45,hospital:"$120 days 1-5",ambulance:315,outpatientSurg:"$120-$220",mri:"$100-$300",xray:"$0-$75",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $0 / 24% / 43% / 33%",dental:"$3,500 Reimbursement",vision:"$400",hearing:"$0-$299/aid",transport:"Not Covered",gym:true,otc:"$70/quarter",food:"$100/month",pers:false,notes:"Best dental at $3,500 reimbursement."},
  {id:"dev-008",carrier:"Devoted Health",name:"Devoted Giveback 008 TX",planId:"H7993-008-000",type:"HMO",cat:"giveback",premium:0,giveback:184.70,moop:7550,specialist:45,pcp:0,er:115,urgentCare:40,hospital:"$375 days 1-5",ambulance:315,outpatientSurg:"$375-$475",mri:"$100-$300",xray:"$0-$75",labs:0,medDeduct:0,rxDed:605,rxCopays:"$0 / $0 / 24% / 25% / 25%",dental:"$3,000 Reimbursement",vision:"$400",hearing:"$0-$299/aid",transport:"Not Covered",gym:true,otc:"$200/quarter",food:"None",pers:false,notes:"Highest giveback at $184.70/mo."},
  {id:"dev-017",carrier:"Devoted Health",name:"Devoted Dual 017 TX",planId:"H7993-017-000",type:"HMO D-SNP",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$3,000",vision:"$400",hearing:"$0-$299/aid",transport:"Not Covered",gym:true,otc:"$50/quarter",food:"$200/month",pers:false,notes:"$0 MOOP D-SNP. $200/mo food."},
  {id:"dev-038",carrier:"Devoted Health",name:"Devoted Dual Full 038 TX",planId:"H7993-038-000",type:"HMO D-SNP",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$4,000",vision:"$400",hearing:"$0-$299/aid",transport:"Not Covered",gym:true,otc:"$50/quarter",food:"$375/month",pers:false,notes:"$375/mo food — highest."},

  // WELLCARE
  {id:"wc-dual-access",carrier:"Wellcare",name:"Wellcare Dual Access",planId:"H0174-004-000",type:"HMO D-SNP",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$3,000",vision:"$300",hearing:"$1,500",transport:"24 one-way",gym:true,otc:"$87/month",food:"$87/month",pers:true,notes:"PERS benefit included."},
  {id:"wc-dual-liberty",carrier:"Wellcare",name:"Wellcare Dual Liberty",planId:"H0174-006-000",type:"HMO D-SNP",cat:"dual",premium:0,giveback:0,moop:0,specialist:0,pcp:0,er:0,urgentCare:0,hospital:"$0",ambulance:0,outpatientSurg:"$0",mri:"$0",xray:"$0",labs:0,medDeduct:0,rxDed:0,rxCopays:"$0 / $1.60 / $4.90 / $5.10 / $12.65",dental:"$4,000",vision:"$400",hearing:"$2,000",transport:"48 one-way",gym:true,otc:"$123/month",food:"$123/month",pers:true,notes:"Best dental at $4,000. PERS included."},
  {id:"wc-giveback",carrier:"Wellcare",name:"Wellcare Giveback HMO",planId:"H0174-021-000",type:"HMO",cat:"giveback",premium:0,giveback:124,moop:6900,specialist:50,pcp:0,er:115,urgentCare:30,hospital:"$375 days 1-6",ambulance:210,outpatientSurg:"$250-$400",mri:"$250-$350",xray:"$50",labs:0,medDeduct:350,rxDed:615,rxCopays:"$0 / $0 / 25% / 42% / 25% / $0",dental:"$3,000",vision:"$100",hearing:"$700",transport:"Not Covered",gym:true,otc:"None",food:"None",pers:false,notes:"$124/mo giveback with $3,000 dental."},
  {id:"wc-simple",carrier:"Wellcare",name:"Wellcare Simple HMO",planId:"H0174-016-000",type:"HMO",cat:"standard",premium:0,giveback:0,moop:3900,specialist:20,pcp:0,er:150,urgentCare:30,hospital:"$325 days 1-6",ambulance:250,outpatientSurg:"$150-$280",mri:"$150-$225",xray:"$50",labs:0,medDeduct:0,rxDed:615,rxCopays:"$0 / $0 / 25% / 35% / 25% / $0",dental:"$2,000",vision:"$200",hearing:"$2,000",transport:"12 one-way",gym:true,otc:"$35/month",food:"None",pers:false,notes:"$2,000 hearing benefit."}
];

// DRUG COVERAGE DATA
const DRUG_COVERAGE = [
  {drug:"eliquis",planId:"aln-001",covers:true,copay:"$45",tier:3,priorAuth:true},
  {drug:"eliquis",planId:"hum-061",covers:true,copay:"$45",tier:3,priorAuth:true},
  {drug:"eliquis",planId:"uhc-s4",covers:true,copay:"$0",tier:1,priorAuth:false},
  {drug:"eliquis",planId:"wc-dual-liberty",covers:true,copay:"$0",tier:1,priorAuth:false},
  {drug:"eliquis",planId:"dev-007",covers:true,copay:"24%",tier:3,priorAuth:true},
  {drug:"metformin",planId:"aln-001",covers:true,copay:"$0",tier:1,priorAuth:false},
  {drug:"metformin",planId:"hum-061",covers:true,copay:"$0",tier:1,priorAuth:false},
  {drug:"metformin",planId:"uhc-s4",covers:true,copay:"$0",tier:1,priorAuth:false},
  {drug:"humira",planId:"aln-001",covers:true,copay:"32%",tier:4,priorAuth:true},
  {drug:"humira",planId:"hum-061",covers:true,copay:"35%",tier:4,priorAuth:true},
  {drug:"humira",planId:"uhc-s4",covers:true,copay:"$0",tier:1,priorAuth:false},
  {drug:"ozempic",planId:"uhc-s4",covers:true,copay:"$0",tier:1,priorAuth:false},
  {drug:"ozempic",planId:"aln-001",covers:true,copay:"$45",tier:3,priorAuth:true},
  {drug:"januvia",planId:"hum-061",covers:true,copay:"$45",tier:3,priorAuth:true},
  {drug:"xarelto",planId:"hum-061",covers:true,copay:"$45",tier:3,priorAuth:true},
  {drug:"xarelto",planId:"uhc-s4",covers:true,copay:"$0",tier:1,priorAuth:false}
];

// STATE
let selectedCarriers = new Set();
let compareList = [];
let activeDrugFilter = null;

function initializeCarriers() {
  const carriers = [...new Set(PLANS.map(p => p.carrier))];
  selectedCarriers = new Set(carriers);
}

function getVisiblePlans() {
  let filtered = PLANS.filter(p => selectedCarriers.has(p.carrier));
  if (activeDrugFilter) {
    const coveringPlanIds = DRUG_COVERAGE.filter(d => d.drug === activeDrugFilter && d.covers).map(d => d.planId);
    filtered = filtered.filter(p => coveringPlanIds.includes(p.id));
  }
  return filtered;
}

function renderPlans() {
  const visiblePlans = getVisiblePlans();
  const grid = document.getElementById("plansGrid");
  document.getElementById("totalPlans").innerText = PLANS.length;
  document.getElementById("visibleCount").innerText = visiblePlans.length;
  if (visiblePlans.length === 0) {
    grid.innerHTML = `<div class="empty-state">No plans match your selection.</div>`;
    return;
  }
  grid.innerHTML = visiblePlans.map(plan => `
    <div class="plan-card" onclick="showPlanDetail('${plan.id}')">
      <div class="plan-card-header">
        <span class="plan-carrier">${plan.carrier}</span>
        <span class="plan-cat">${plan.cat.toUpperCase()}</span>
      </div>
      <div class="plan-name">${plan.name}</div>
      <div class="plan-id">${plan.planId} · ${plan.type}</div>
      ${plan.giveback > 0 ? `<div style="color:var(--accent);font-size:12px;margin:6px 0;">↓ Part B: $${plan.giveback}/mo</div>` : ''}
      <div class="plan-stats">
        <span>MOOP: ${plan.moop === 0 ? '$0' : '$' + plan.moop.toLocaleString()}</span>
        <span>Spec: $${plan.specialist}</span>
        <span>ER: $${plan.er}</span>
      </div>
      <div class="plan-actions">
        <button class="compare-plan-btn" onclick="event.stopPropagation(); addToCompare('${plan.id}')">📊 Compare</button>
      </div>
    </div>
  `).join("");
}

function renderPlanCheckboxes() {
  const carriers = [...new Set(PLANS.map(p => p.carrier))];
  const container = document.getElementById("planCheckboxList");
  container.innerHTML = carriers.map(carrier => `
    <div class="plan-checkbox-item" onclick="toggleCarrier('${carrier}')">
      <input type="checkbox" ${selectedCarriers.has(carrier) ? 'checked' : ''} onclick="event.stopPropagation(); toggleCarrier('${carrier}')">
      <label>${carrier}</label>
    </div>
  `).join("");
  renderPlans();
}

function toggleCarrier(carrier) {
  if (selectedCarriers.has(carrier)) selectedCarriers.delete(carrier);
  else selectedCarriers.add(carrier);
  renderPlanCheckboxes();
  if (activeDrugFilter) searchDrug();
}

function toggleSelectAll() {
  const carriers = [...new Set(PLANS.map(p => p.carrier))];
  if (selectedCarriers.size === carriers.length) selectedCarriers.clear();
  else carriers.forEach(c => selectedCarriers.add(c));
  renderPlanCheckboxes();
  if (activeDrugFilter) searchDrug();
}

function searchDrug() {
  const drugName = document.getElementById("drugInput").value.trim().toLowerCase();
  if (!drugName) { clearDrugSearch(); return; }
  activeDrugFilter = drugName;
  renderPlans();
  const banner = document.getElementById("drugSearchBanner") || document.createElement("div");
  banner.id = "drugSearchBanner";
  banner.style.cssText = `background: var(--accent-light); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;`;
  banner.innerHTML = `<span><strong><i class="fas fa-pills"></i> Showing only plans covering: ${drugName.toUpperCase()}</strong></span>
    <button onclick="clearDrugSearch()" style="background: none; border: none; color: var(--accent); cursor: pointer;">Clear →</button>`;
  const header = document.querySelector(".plans-header");
  if (!document.getElementById("drugSearchBanner")) header.parentNode.insertBefore(banner, header.nextSibling);
}

function clearDrugSearch() {
  activeDrugFilter = null;
  document.getElementById("drugInput").value = "";
  const banner = document.getElementById("drugSearchBanner");
  if (banner) banner.remove();
  renderPlans();
}

async function searchProvider() {
  const query = document.getElementById("providerInput").value.trim();
  const area = document.getElementById("providerResultsArea");
  const content = document.getElementById("providerResultsContent");
  const stats = document.getElementById("providerStats");
  if (!query) { area.style.display = "none"; return; }
  area.style.display = "block";
  content.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
  try {
    const res = await fetch(`https://data.cms.gov/data-api/v1/dataset/5c4bd6da-3dca-4600-a051-4d45119f63ec/data?filter=state_code.equals('TX')&filter=primary_specialty_primary_taxonomy_description.contains('${encodeURIComponent(query)}')&limit=20`);
    const providers = await res.json();
    if (!providers.length) { content.innerHTML = `<div class="empty-state">No providers found for "${query}"</div>`; stats.innerHTML = "0 results"; return; }
    stats.innerHTML = `${providers.length} providers found`;
    content.innerHTML = `<div class="provider-grid">${providers.map(p => `
      <div class="provider-card">
        <div style="font-size:11px;font-weight:700;color:var(--accent);"><i class="fas fa-user-md"></i> Provider</div>
        <div style="font-weight:600;margin:8px 0;">${p.name_provider_organization_name_legal_business_name || 'Name not available'}</div>
        <div style="font-size:12px;color:var(--accent);">${p.primary_specialty_primary_taxonomy_description || 'Specialty not listed'}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">📍 ${p.city || ''}, ${p.state_code || 'TX'}</div>
        ${p.telephone_number ? `<div style="font-size:11px;">📞 ${p.telephone_number}</div>` : ''}
      </div>
    `).join('')}</div>`;
  } catch(e) { content.innerHTML = '<div class="empty-state">Error searching providers</div>'; }
}

function clearProviderSearch() {
  document.getElementById("providerInput").value = "";
  document.getElementById("providerResultsArea").style.display = "none";
}

function showPlanDetail(planId) {
  const plan = PLANS.find(p => p.id === planId);
  document.getElementById("modalTitle").innerHTML = `<div><div style="color:var(--accent);font-size:12px;">${plan.carrier}</div>
    <div style="font-size:20px;font-weight:700;">${plan.name}</div>
    <div style="font-size:11px;color:var(--text-muted);">${plan.planId} · ${plan.type}</div></div>`;
  document.getElementById("modalBody").innerHTML = `
    <div class="benefits-grid">
      <div class="benefit-item"><div class="benefit-label">Premium</div><div class="benefit-value">${plan.premium === 0 ? '$0' : '$' + plan.premium}</div></div>
      <div class="benefit-item"><div class="benefit-label">Giveback</div><div class="benefit-value">${plan.giveback > 0 ? '$' + plan.giveback + '/mo' : '—'}</div></div>
      <div class="benefit-item"><div class="benefit-label">MOOP</div><div class="benefit-value">${plan.moop === 0 ? '$0' : '$' + plan.moop.toLocaleString()}</div></div>
      <div class="benefit-item"><div class="benefit-label">Specialist</div><div class="benefit-value">$${plan.specialist}</div></div>
      <div class="benefit-item"><div class="benefit-label">PCP</div><div class="benefit-value">$${plan.pcp}</div></div>
      <div class="benefit-item"><div class="benefit-label">ER</div><div class="benefit-value">$${plan.er}</div></div>
      <div class="benefit-item"><div class="benefit-label">Hospital</div><div class="benefit-value">${plan.hospital}</div></div>
      <div class="benefit-item"><div class="benefit-label">Ambulance</div><div class="benefit-value">$${plan.ambulance}</div></div>
      <div class="benefit-item"><div class="benefit-label">Rx Deductible</div><div class="benefit-value">${plan.rxDed === 0 ? '$0' : '$' + plan.rxDed}</div></div>
      <div class="benefit-item"><div class="benefit-label">Rx Copays</div><div class="benefit-value" style="font-size:11px;">${plan.rxCopays}</div></div>
      <div class="benefit-item"><div class="benefit-label">Dental</div><div class="benefit-value">${plan.dental}</div></div>
      <div class="benefit-item"><div class="benefit-label">Vision</div><div class="benefit-value">${plan.vision}</div></div>
      <div class="benefit-item"><div class="benefit-label">Hearing</div><div class="benefit-value">${plan.hearing}</div></div>
      <div class="benefit-item"><div class="benefit-label">Transport</div><div class="benefit-value">${plan.transport}</div></div>
      <div class="benefit-item"><div class="benefit-label">OTC</div><div class="benefit-value">${plan.otc}</div></div>
      <div class="benefit-item"><div class="benefit-label">Food/SSBCI</div><div class="benefit-value">${plan.food}</div></div>
      <div class="benefit-item"><div class="benefit-label">Gym</div><div class="benefit-value">${plan.gym ? '✓' : '—'}</div></div>
      <div class="benefit-item"><div class="benefit-label">PERS</div><div class="benefit-value">${plan.pers ? '✓' : '—'}</div></div>
    </div>
    <div style="background:var(--bg-tertiary);border-radius:12px;padding:12px;"><strong>Note:</strong> ${plan.notes}</div>
  `;
  document.getElementById("planModal").classList.add("active");
}

function addToCompare(planId) {
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) return;
  if (compareList.some(p => p.id === planId)) { compareList = compareList.filter(p => p.id !== planId); }
  else { if (compareList.length >= 3) { alert("Max 3 plans to compare"); return; } compareList.push(plan); }
  updateCompareBar();
}

function updateCompareBar() {
  const bar = document.getElementById("compareBar");
  const slots = document.getElementById("compareSlots");
  if (compareList.length === 0) { bar.style.display = "none"; return; }
  bar.style.display = "flex";
  slots.innerHTML = compareList.map(plan => `<div class="compare-slot filled">${plan.name.substring(0, 20)}<button onclick="event.stopPropagation(); addToCompare('${plan.id}')">✕</button></div>`).join("");
  for (let i = compareList.length; i < 3; i++) slots.innerHTML += `<div class="compare-slot">Empty slot</div>`;
}

function showComparison() {
  if (compareList.length < 2) { alert("Select 2+ plans to compare"); return; }
  document.getElementById("modalTitle").innerHTML = "<div style='font-weight:700;'>Compare Plans</div>";
  document.getElementById("modalBody").innerHTML = `<div style="display:grid;grid-template-columns:repeat(${compareList.length},1fr);gap:16px;">${compareList.map(plan => `
    <div><div style="color:var(--accent);font-size:11px;">${plan.carrier}</div>
    <div style="font-weight:700;">${plan.name}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">${plan.planId}</div>
    <div><strong>MOOP:</strong> ${plan.moop === 0 ? '$0' : '$' + plan.moop}</div>
    <div><strong>Specialist:</strong> $${plan.specialist}</div>
    <div><strong>ER:</strong> $${plan.er}</div>
    <div><strong>Giveback:</strong> ${plan.giveback > 0 ? '$' + plan.giveback : '—'}</div></div>
  `).join('')}</div>`;
  document.getElementById("planModal").classList.add("active");
}

function closeModal() { document.getElementById("planModal").classList.remove("active"); }

function setupTheme() {
  const toggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  toggle.onclick = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('theme', 'light'); }
    else { document.documentElement.setAttribute('data-theme', 'dark'); localStorage.setItem('theme', 'dark'); }
  };
}

initializeCarriers();
renderPlanCheckboxes();
setupTheme();

window.toggleCarrier = toggleCarrier;
window.toggleSelectAll = toggleSelectAll;
window.searchDrug = searchDrug;
window.clearDrugSearch = clearDrugSearch;
window.searchProvider = searchProvider;
window.clearProviderSearch = clearProviderSearch;
window.showPlanDetail = showPlanDetail;
window.addToCompare = addToCompare;
window.showComparison = showComparison;
window.closeModal = closeModal;
</script>

<!-- ═══════ MERIDIAN AI ASSISTANT ═══════ -->
<style>
/* ── IMPORTANT: Replace this URL with your Cloudflare Worker URL after deploying ── */
/* Example: https://meridian-ai.YOUR-SUBDOMAIN.workers.dev                          */

#mBtn {
  position:fixed; bottom:28px; right:28px; z-index:9998;
  width:58px; height:58px; border-radius:50%;
  background:linear-gradient(135deg,var(--accent),var(--accent-dark));
  border:none; cursor:pointer; color:white; font-size:22px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 8px 28px rgba(200,85,61,0.5);
  transition:transform .2s,box-shadow .2s;
}
#mBtn:hover{transform:scale(1.1);box-shadow:0 12px 36px rgba(200,85,61,0.6);}
#mBtn .ring{
  position:absolute;inset:-7px;border-radius:50%;
  border:2px solid var(--accent);opacity:0;
  animation:ringPulse 2.5s ease-out infinite;
}
@keyframes ringPulse{0%{opacity:.65;transform:scale(1)}100%{opacity:0;transform:scale(1.6)}}

#mPanel {
  position:fixed; bottom:100px; right:28px; z-index:9999;
  width:390px; height:570px; max-height:calc(100vh - 116px);
  background:var(--bg-secondary); border:1px solid var(--border);
  border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,.2);
  display:flex; flex-direction:column; overflow:hidden;
  opacity:0; transform:translateY(14px) scale(.97); pointer-events:none;
  transition:opacity .22s ease,transform .22s ease;
}
#mPanel.open{opacity:1;transform:none;pointer-events:all;}

.mHead {
  background:linear-gradient(135deg,var(--accent),var(--accent-dark));
  padding:13px 16px; display:flex; align-items:center; gap:11px; flex-shrink:0;
}
.mAv {
  width:38px;height:38px;border-radius:50%;
  background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.3);
  display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;
}
.mHeadInfo{flex:1;}
.mHeadName{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:#fff;line-height:1;}
.mHeadSub{font-size:11px;color:rgba(255,255,255,.72);margin-top:3px;display:flex;align-items:center;gap:5px;}
.mDot{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:blink 2s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
.mCloseBtn{background:rgba(255,255,255,.15);border:none;width:30px;height:30px;border-radius:8px;
  color:white;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:background .2s;}
.mCloseBtn:hover{background:rgba(255,255,255,.3);}

.mScreen{flex:1;display:flex;flex-direction:column;overflow:hidden;}

/* Onboarding */
#mOnboard{align-items:center;justify-content:center;padding:28px;gap:14px;text-align:center;}
.mOnIcon{width:64px;height:64px;border-radius:20px;background:var(--accent-light);
  display:flex;align-items:center;justify-content:center;font-size:28px;}
.mOnTitle{font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:700;color:var(--text-primary);}
.mOnSub{font-size:13px;color:var(--text-secondary);line-height:1.6;max-width:280px;}
.mNameInput{
  width:100%;padding:12px 16px;border-radius:40px;
  border:2px solid var(--border);background:var(--bg-primary);
  color:var(--text-primary);font-size:14px;outline:none;
  text-align:center;font-family:'Inter',sans-serif;transition:border-color .2s;
}
.mNameInput:focus{border-color:var(--accent);}
.mNameBtn{
  width:100%;padding:12px;border-radius:40px;background:var(--accent);
  border:none;color:white;font-weight:600;font-size:14px;cursor:pointer;
  transition:background .2s;font-family:'Inter',sans-serif;
}
.mNameBtn:hover{background:var(--accent-dark);}
.mChips{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;width:100%;}
.mChip{
  padding:6px 13px;border-radius:20px;background:var(--bg-tertiary);
  border:1px solid var(--border);color:var(--text-secondary);font-size:12px;
  cursor:pointer;transition:all .15s;font-family:'Inter',sans-serif;
}
.mChip:hover{background:var(--accent-light);border-color:var(--accent);color:var(--accent);}

/* Chat */
#mChat{display:flex;flex-direction:column;}
.mMsgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
.mMsgs::-webkit-scrollbar{width:4px;}
.mMsgs::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}

.mMsg{max-width:82%;display:flex;flex-direction:column;gap:3px;}
.mMsg.user{align-self:flex-end;align-items:flex-end;}
.mMsg.ai{align-self:flex-start;align-items:flex-start;}
.mBubble{padding:10px 14px;border-radius:16px;font-size:13.5px;line-height:1.55;word-break:break-word;}
.mMsg.user .mBubble{background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:white;border-bottom-right-radius:4px;}
.mMsg.ai .mBubble{background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-bottom-left-radius:4px;}
.mMeta{font-size:10.5px;color:var(--text-muted);padding:0 4px;}

.mTyping{display:flex;align-items:center;gap:5px;padding:10px 14px;
  background:var(--bg-tertiary);border:1px solid var(--border);
  border-radius:16px;border-bottom-left-radius:4px;width:fit-content;}
.mTyping span{width:7px;height:7px;border-radius:50%;background:var(--accent);
  animation:typingDot .9s ease-in-out infinite;}
.mTyping span:nth-child(2){animation-delay:.15s;}
.mTyping span:nth-child(3){animation-delay:.3s;}
@keyframes typingDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}

.mSuggestions{padding:8px 14px;display:flex;gap:7px;overflow-x:auto;flex-shrink:0;border-top:1px solid var(--border);}
.mSuggestions::-webkit-scrollbar{display:none;}
.mSug{white-space:nowrap;padding:6px 12px;border-radius:20px;background:var(--bg-tertiary);
  border:1px solid var(--border);font-size:12px;color:var(--text-secondary);cursor:pointer;
  transition:all .15s;flex-shrink:0;}
.mSug:hover{background:var(--accent-light);border-color:var(--accent);color:var(--accent);}

.mInputWrap{padding:12px 14px;border-top:1px solid var(--border);display:flex;gap:9px;align-items:center;flex-shrink:0;}
.mInput{flex:1;padding:10px 16px;border-radius:40px;border:2px solid var(--border);
  background:var(--bg-primary);color:var(--text-primary);font-size:13.5px;outline:none;
  font-family:'Inter',sans-serif;resize:none;transition:border-color .2s;}
.mInput:focus{border-color:var(--accent);}
.mSendBtn{width:38px;height:38px;border-radius:50%;background:var(--accent);border:none;
  color:white;font-size:15px;cursor:pointer;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;transition:background .2s,transform .15s;}
.mSendBtn:hover{background:var(--accent-dark);transform:scale(1.05);}
.mSendBtn:disabled{background:var(--border);cursor:not-allowed;transform:none;}

@media(max-width:460px){
  #mPanel{width:calc(100vw - 20px);right:10px;bottom:90px;}
}
</style>

<!-- Floating button -->
<button id="mBtn" onclick="mToggle()" title="Ask MERIDIAN AI">
  <div class="ring"></div>🤖
</button>

<!-- Chat panel -->
<div id="mPanel">
  <div class="mHead">
    <div class="mAv">🤖</div>
    <div class="mHeadInfo">
      <div class="mHeadName">MERIDIAN AI</div>
      <div class="mHeadSub"><span class="mDot"></span><span id="mStatusTxt">Online · Here to help</span></div>
    </div>
    <button class="mCloseBtn" onclick="mToggle()">✕</button>
  </div>

  <!-- Screen 1: Name onboarding -->
  <div id="mOnboard" class="mScreen" style="display:flex;">
    <div class="mOnIcon">👋</div>
    <div class="mOnTitle">Hey there!</div>
    <div class="mOnSub">I'm your MERIDIAN AI assistant. I can help with Medicare plans, medications, procedures, devices — whatever you need. What's your name?</div>
    <input class="mNameInput" id="mNameInput" placeholder="Your first name..." maxlength="30"
      onkeydown="if(event.key==='Enter') mSaveName()" />
    <button class="mNameBtn" onclick="mSaveName()">Let's go →</button>
    <div class="mOnSub" style="font-size:11.5px;color:var(--text-muted);">Or jump right in</div>
    <div class="mChips"><span class="mChip" onclick="mSaveName('skip')">Skip →</span></div>
  </div>

  <!-- Screen 2: Chat -->
  <div id="mChat" class="mScreen hidden" style="display:none;">
    <div class="mMsgs" id="mMsgs"></div>
    <div class="mSuggestions" id="mSugs">
      <span class="mSug" onclick="mQuick(this)">💊 What does Eliquis cost?</span>
      <span class="mSug" onclick="mQuick(this)">🏥 What's a MOOP?</span>
      <span class="mSug" onclick="mQuick(this)">🦷 Best dental benefits?</span>
      <span class="mSug" onclick="mQuick(this)">🔍 What is a D-SNP plan?</span>
      <span class="mSug" onclick="mQuick(this)">💉 What is Ozempic used for?</span>
      <span class="mSug" onclick="mQuick(this)">🦴 What is a knee replacement?</span>
    </div>
    <div class="mInputWrap">
      <textarea class="mInput" id="mInput" rows="1" placeholder="Ask about plans, meds, procedures..."
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();mSend()}"
        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,90)+'px'"></textarea>
      <button class="mSendBtn" id="mSendBtn" onclick="mSend()">➤</button>
    </div>
  </div>
</div>

<script>
// Points to our backend — works locally and in production automatically
const API_URL = 'https://meridian-backend-production-4a20.up.railway.app/api/chat';

// Unique session ID for this user
const SESSION_ID = localStorage.getItem('mSession') || (() => {
  const id = 'sess_' + Math.random().toString(36).substr(2, 12);
  localStorage.setItem('mSession', id);
  return id;
})();

const M = {
  name: localStorage.getItem('mName') || '',
  history: [],
  busy: false,
  open: false,
  memory: JSON.parse(localStorage.getItem('mMemory') || '{}')
};

function mSystemPrompt() {
  // System prompt is now handled server-side
  const now = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const userName = M.name && M.name !== 'skip' ? M.name : 'the user';
  const memStr = Object.keys(M.memory).length
    ? '\n\nWhat you remember about ' + userName + ':\n' + JSON.stringify(M.memory, null, 2) : '';

  return `You are MERIDIAN AI, a warm, knowledgeable, and genuinely caring assistant built into the MERIDIAN Medicare Intelligence platform for Texas. You help Medicare beneficiaries, caregivers, and insurance agents understand Medicare Advantage plans, medications, medical devices, surgeries, procedures, and healthcare services.

Today is ${now}. You are talking with ${userName}.${memStr}

PERSONALITY:
- Be warm, friendly, and personable — like a trusted friend who knows a lot about healthcare
- Use the user's name naturally in conversation when appropriate
- Remember details they share (conditions, medications, concerns) and refer back to them
- Show genuine empathy — many users are seniors navigating a confusing system
- Be encouraging and clear, never condescending

KNOWLEDGE:
- Deep expertise in Medicare Advantage (HMO, PPO, D-SNP, C-SNP plans)
- Drug formularies, tiers, prior authorization, and copays
- Medical procedures, surgeries, and recovery (knee/hip replacements, cataract surgery, cardiac procedures, etc.)
- Medical devices (CPAP, CGM, hearing aids, PERS/fall alert devices, insulin pumps, etc.)
- Common medications — what they treat, side effects, alternatives
- TX-specific Medicare context (El Paso area and statewide)
- Plan benefits: MOOP, giveback, OTC allowance, food cards, transportation, dental, vision, hearing

PLATFORM CONTEXT:
MERIDIAN currently shows TX Medicare Advantage plans from: UnitedHealthcare, Humana, Alignment Health, Devoted Health, and Wellcare. Plan types include standard HMO/PPO, D-SNP (for people who have both Medicare and Medicaid), and C-SNP (for people with specific chronic conditions).

RESPONSE STYLE:
- Keep answers conversational and clear — no walls of text
- Use short paragraphs or bullet points when listing multiple items
- Always offer a follow-up or ask if they want more detail
- If asked about a specific plan benefit, give concrete numbers when possible
- NEVER give official medical advice — always recommend consulting their doctor for medical decisions
- If you don't know something, say so honestly

MEMORY:
If the user mentions their name, health conditions, medications, or important preferences, end your response with this block (ONLY when there's something new worth saving):
<memory>{"key": "value"}</memory>
Example: <memory>{"condition": "diabetes", "medication": "metformin"}</memory>`;
}

function mToggle() {
  M.open = !M.open;
  document.getElementById('mPanel').classList.toggle('open', M.open);
  if (M.open) {
    if (M.name) { mShow('mChat'); if (!M.history.length) mWelcome(); }
    else { mShow('mOnboard'); setTimeout(() => document.getElementById('mNameInput').focus(), 120); }
  }
}

function mShow(id) {
  document.getElementById('mOnboard').style.display = id === 'mOnboard' ? 'flex' : 'none';
  document.getElementById('mChat').style.display    = id === 'mChat'    ? 'flex' : 'none';
  if (id === 'mChat') setTimeout(() => document.getElementById('mInput').focus(), 120);
}

function mSaveName(skip) {
  const raw = skip === 'skip' ? '' : (document.getElementById('mNameInput').value.trim() || '');
  M.name = raw || 'friend';
  localStorage.setItem('mName', M.name);
  mShow('mChat');
  mWelcome();
}

function mWelcome() {
  const greet = M.name && M.name !== 'friend'
    ? `Hey ${M.name}! 👋` : `Hey there! 👋`;
  mAddMsg('ai', `${greet} I'm your MERIDIAN AI assistant — I'm here to help you make sense of Medicare plans, medications, medical devices, surgeries, and more.\n\nWhat can I help you with today?`);
}

async function mSend() {
  if (M.busy) return;
  const input = document.getElementById('mInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';
  mAddMsg('user', text);
  M.history.push({ role: 'user', content: text });
  document.getElementById('mSugs').style.display = 'none';
  await mAskAI();
}

function mQuick(el) {
  document.getElementById('mInput').value = el.textContent.replace(/^[^\w]+/,'').trim();
  mSend();
}

async function mAskAI() {
  M.busy = true;
  document.getElementById('mSendBtn').disabled = true;
  document.getElementById('mStatusTxt').textContent = 'Thinking...';

  const typingId = 'typing_' + Date.now();
  mAddRaw(`<div class="mMsg ai" id="${typingId}">
    <div class="mBubble"><div class="mTyping"><span></span><span></span><span></span></div></div>
  </div>`);
  mScrollBottom();

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: M.history,
        userName: M.name && M.name !== 'friend' ? M.name : '',
        memory: M.memory,
        sessionId: SESSION_ID
      })
    });

    const data = await res.json();
    document.getElementById(typingId)?.remove();

    if (data.error) throw new Error(data.error.message);

    let reply = data.choices?.[0]?.message?.content || "Sorry, I didn't catch that — try again!";

    // Extract and save memory tags
    const mem = reply.match(/<memory>([\s\S]*?)<\/memory>/);
    if (mem) {
      try { Object.assign(M.memory, JSON.parse(mem[1])); localStorage.setItem('mMemory', JSON.stringify(M.memory)); } catch(e){}
      reply = reply.replace(/<memory>[\s\S]*?<\/memory>/,'').trim();
    }

    M.history.push({ role: 'assistant', content: reply });
    mAddMsg('ai', reply);
    document.getElementById('mStatusTxt').textContent = 'Online · Here to help';

  } catch(err) {
    document.getElementById(typingId)?.remove();
    const msg = err.message?.includes('Failed to fetch')
      ? "Can't reach the AI right now — make sure the Worker URL is set correctly."
      : "Something went wrong. Please try again in a moment.";
    mAddMsg('ai', '⚠️ ' + msg);
    document.getElementById('mStatusTxt').textContent = '⚠️ Connection issue';
  }

  M.busy = false;
  document.getElementById('mSendBtn').disabled = false;
}

function mAddMsg(role, text) {
  const time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  mAddRaw(`<div class="mMsg ${role}"><div class="mBubble">${mFmt(text)}</div><div class="mMeta">${time}</div></div>`);
  mScrollBottom();
}

function mAddRaw(html) {
  const msgs = document.getElementById('mMsgs');
  const el = document.createElement('div');
  el.innerHTML = html;
  msgs.appendChild(el.firstChild);
}

function mScrollBottom() {
  const msgs = document.getElementById('mMsgs');
  requestAnimationFrame(() => msgs.scrollTop = msgs.scrollHeight);
}

function mFmt(t) {
  return t
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^[-•]\s(.+)$/gm,'<li style="margin:2px 0 2px 14px;">$1</li>')
    .replace(/\n\n/g,'</p><p style="margin-top:6px;">')
    .replace(/\n/g,'<br>');
}
</script>
</body>
</html>