import express from 'express';
import { query, run } from '../db/database.js';

const router = express.Router();

// GET all spam rules
router.get('/', async (req, res) => {
  try {
    res.json(await query('SELECT * FROM spam_rules ORDER BY created_at DESC'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a spam rule
router.post('/', async (req, res) => {
  try {
    const { pattern, pattern_type = 'domain', label } = req.body;
    if (!pattern?.trim()) return res.status(400).json({ error: 'Le pattern est requis.' });

    const result = await run(
      'INSERT INTO spam_rules (pattern, pattern_type, label) VALUES (?, ?, ?)',
      [pattern.trim().toLowerCase(), pattern_type, label?.trim() || null]
    );
    res.status(201).json({ id: result.id, pattern: pattern.trim().toLowerCase(), pattern_type, label: label?.trim() || null });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Ce pattern existe déjà.' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE a spam rule
router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM spam_rules WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
