const multer = require('multer');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configure multer for file uploads (store in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Endpoint to handle document upload
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filename = req.file.originalname;
    // Convert file content to text (assuming plain text or extract text)
    let content = req.file.buffer.toString('utf-8'); // For .txt files

    // If you need PDF parsing, add pdf-parse package
    // For now, we assume .txt files

    const result = await pool.query(
      'INSERT INTO documents (filename, content) VALUES ($1, $2) RETURNING id',
      [filename, content]
    );

    res.json({ success: true, id: result.rows[0].id, message: 'Document uploaded and scanned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});
