app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    // First, test database connection
    await pool.query('SELECT NOW()');
    
    const result = await pool.query(
      `SELECT filename, content 
       FROM documents 
       WHERE content ILIKE $1 OR filename ILIKE $1
       LIMIT 5`,
      [`%${message}%`]
    );

    if (result.rows.length === 0) {
      return res.json({ reply: "I couldn't find any relevant information in your uploaded documents. Try a different question or upload more documents." });
    }

    const context = result.rows
      .map(row => `[File: ${row.filename}]\n${row.content.substring(0, 2000)}`)
      .join('\n\n');

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a strict document‑based assistant. Answer ONLY using the context below. Do not use any outside knowledge. If the answer is not in the context, say: "I don't have that information in the uploaded documents."

Context:
${context}`
        },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 1024,
    });

    res.json({ reply: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    // Return the actual error message
    res.status(500).json({ error: error.message });
  }
});
