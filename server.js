app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    // Test database connection first
    const test = await pool.query('SELECT NOW()');
    console.log('DB connected:', test.rows[0]);

    // Search documents
    const result = await pool.query(
      `SELECT filename, content FROM documents WHERE content ILIKE $1 LIMIT 5`,
      [`%${message}%`]
    );

    if (result.rows.length === 0) {
      return res.json({ reply: `No documents match "${message}". Try a different question.` });
    }

    const context = result.rows.map(r => `[${r.filename}]\n${r.content.substring(0, 1500)}`).join('\n\n');

    const groqReply = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: `Answer using ONLY this context. If not found, say "I don't know".\n\nContext:\n${context}` },
        { role: 'user', content: message }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
    });

    res.json({ reply: groqReply.choices[0].message.content });
  } catch (err) {
    console.error(err);
    // Send the real error message to the browser
    res.status(500).json({ error: err.message });
  }
});
