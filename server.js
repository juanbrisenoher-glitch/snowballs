const express = require('express');
const router = express.Router();
const DB = require('../db');

const COLLECTIONS = ['plans', 'providers', 'medications', 'devices', 'procedures', 'services'];
const SEARCH_FIELDS = {
  plans: ['carrier', 'plan_name', 'plan_type'],
  providers: ['name', 'specialty', 'clinic_name', 'city', 'plans_accepted'],
  medications: ['name', 'generic_name', 'brand_name', 'what_it_treats', 'drug_class'],
  devices: ['name', 'category', 'what_it_does'],
  procedures: ['name', 'category', 'description'],
  services: ['name', 'type', 'description', 'city']
};

COLLECTIONS.forEach(col => {
  router.get(`/${col}`, (req, res) => {
    const { search, ...filters } = req.query;
    const results = search ? DB.search(col, search, SEARCH_FIELDS[col] || ['name']) : DB.getAll(col, filters);
    res.json({ success: true, data: results, count: results.length });
  });

  router.get(`/${col}/:id`, (req, res) => {
    const item = DB.getById(col, req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: item });
  });

  router.post(`/${col}`, (req, res) => {
    res.json({ success: true, data: DB.insert(col, req.body) });
  });

  router.put(`/${col}/:id`, (req, res) => {
    const item = DB.update(col, req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: item });
  });

  router.delete(`/${col}/:id`, (req, res) => {
    res.json({ success: DB.delete(col, req.params.id) });
  });
});

router.get('/stats', (req, res) => res.json({ success: true, data: DB.stats() }));

module.exports = router;
