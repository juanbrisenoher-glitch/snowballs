const express = require('express');
const router = express.Router();
const multer = require('multer');

// Simple in-memory storage for testing
const upload = multer();

// Test endpoint - just log what comes in
router.post('/', upload.array('pdfs'), (req, res) => {
  console.log('=== UPLOAD ENDPOINT HIT ===');
  console.log('Files:', req.files ? req.files.length : 0);
  
  if (!req.files || req.files.length === 0) {
    console.log('No files received');
    return res.json({ success: false, error: 'No files received' });
  }
  
  console.log('File names:', req.files.map(f => f.originalname));
  
  res.json({ 
    success: true, 
    message: `Received ${req.files.length} file(s)`,
    files: req.files.map(f => ({ name: f.originalname, size: f.size }))
  });
});

// URL import endpoint
router.post('/url', express.json(), (req, res) => {
  console.log('=== URL ENDPOINT HIT ===');
  console.log('URL:', req.body.url);
  
  if (!req.body.url) {
    return res.json({ success: false, error: 'No URL provided' });
  }
  
  res.json({ 
    success: true, 
    message: `URL received: ${req.body.url}` 
  });
});

router.get('/status', (req, res) => {
  res.json({ plans: 0 });
});

module.exports = router;
