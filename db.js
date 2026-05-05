const express = require('express');
const router = express.Router();
const DB = require('../db');

router.post('/json', (req, res) => {
  const { collection, data } = req.body;
  if (!collection || !Array.isArray(data)) return res.status(400).json({ error: 'collection and data[] required' });
  const count = DB.bulkInsert(collection, data);
  res.json({ success: true, imported: count, collection });
});

router.post('/replace', (req, res) => {
  const { collection, data } = req.body;
  if (!collection || !Array.isArray(data)) return res.status(400).json({ error: 'collection and data[] required' });
  const count = DB.replaceCollection(collection, data);
  res.json({ success: true, count, collection });
});

module.exports = router;
