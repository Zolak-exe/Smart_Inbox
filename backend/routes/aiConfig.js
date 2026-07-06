import express from 'express';
import { query, run, get } from '../db/database.js';
import { checkOllamaStatus } from '../services/ollamaClassifier.js';

const router = express.Router();

// GET config IA + statut Ollama
router.get('/status', async (req, res) => {
  try {
    const rows = await query('SELECT key, value FROM app_config');
    const config = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const ollamaStatus = await checkOllamaStatus(config.ai_model || 'qwen2.5:1.5b');
    res.json({ ...config, ...ollamaStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT mettre à jour la config IA
router.put('/config', async (req, res) => {
  try {
    const { ai_enabled, ai_model } = req.body;
    if (ai_enabled !== undefined) {
      await run('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)', ['ai_enabled', ai_enabled ? 'true' : 'false']);
    }
    if (ai_model !== undefined) {
      await run('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)', ['ai_model', ai_model]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
