import express from 'express';
import fs from 'fs';
import { query, get, run, dbPath } from '../db/database.js';
import { syncImapEmails, generateMockEmails, deleteImapEmail } from '../services/imapService.js';
import { hybridClassify } from '../services/ollamaClassifier.js';

const router = express.Router();

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

// GET all emails
router.get('/', async (req, res) => {
  try {
    const { category, search, accountId } = req.query;
    let sql = `
      SELECT e.*, j.company as job_company, j.position as job_position, a.email as account_email
      FROM emails e
      LEFT JOIN job_applications j ON e.job_application_id = j.id
      LEFT JOIN email_accounts a ON e.account_id = a.id
    `;
    const params = [];
    const conditions = [];

    if (category) { conditions.push('e.category = ?'); params.push(category); }
    if (accountId) { conditions.push('e.account_id = ?'); params.push(accountId); }
    if (search) {
      conditions.push('(e.subject LIKE ? OR e.body LIKE ? OR e.sender LIKE ?)');
      const p = `%${search}%`;
      params.push(p, p, p);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY e.date DESC';

    res.json(await query(sql, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET storage info
router.get('/storage', async (req, res) => {
  try {
    const row = await get(`
      SELECT
        COUNT(*) as email_count,
        SUM(LENGTH(COALESCE(body,'')) + LENGTH(COALESCE(subject,'')) + LENGTH(COALESCE(sender,''))) as content_bytes,
        MIN(date) as oldest_email_date
      FROM emails
    `);

    const contentBytes = row?.content_bytes || 0;
    const dbBytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const usedBytes = Math.max(contentBytes, dbBytes);

    res.json({
      email_count: row?.email_count || 0,
      used_bytes: usedBytes,
      used_gb: (usedBytes / 1024 / 1024 / 1024).toFixed(3),
      limit_bytes: STORAGE_LIMIT_BYTES,
      limit_gb: 5,
      percent_used: Math.min(100, ((usedBytes / STORAGE_LIMIT_BYTES) * 100).toFixed(1)),
      oldest_email_date: row?.oldest_email_date || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE tous les emails (reset complet de la boîte)
router.delete('/reset', async (req, res) => {
  try {
    const result = await run('DELETE FROM emails');
    // Remet à zéro les dates de sync des comptes
    await run('UPDATE email_accounts SET last_sync = NULL');
    res.json({ deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE oldest emails to free space (keeps the N most recent)
router.delete('/cleanup', async (req, res) => {
  try {
    const keepCount = parseInt(req.query.keepCount || '500', 10);
    const result = await run(`
      DELETE FROM emails WHERE id IN (
        SELECT id FROM emails ORDER BY date ASC LIMIT MAX(0, (SELECT COUNT(*) FROM emails) - ?)
      )
    `, [keepCount]);
    res.json({ deleted: result.changes, kept: keepCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST re-classify all existing emails (repart de zéro : reset catégories puis re-classe)
router.post('/reclassify', async (req, res) => {
  try {
    // 1. Reset toutes les classifications avant de re-classer
    await run('UPDATE emails SET category = \'Professionnel\', ai_explanation = NULL, job_application_id = NULL');

    const emails = await query('SELECT * FROM emails');
    const existingJobs = await query('SELECT * FROM job_applications');
    let updated = 0;

    for (const email of emails) {
      const classification = await hybridClassify(
        { subject: email.subject, body: email.body, sender: email.sender },
        existingJobs
      );
      await run(
        'UPDATE emails SET category = ?, ai_explanation = ? WHERE id = ?',
        [classification.category, classification.ai_explanation, email.id]
      );
      updated++;
    }

    res.json({ updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST sync trigger
router.post('/sync', async (req, res) => {
  try {
    const { mode } = req.body;
    const activeCountRow = await get('SELECT COUNT(*) as count FROM email_accounts WHERE is_active = 1');
    const canRunReal = activeCountRow?.count > 0;

    if (mode === 'real' || (mode === 'auto' && canRunReal)) {
      if (!canRunReal) {
        return res.status(400).json({ error: 'Aucun compte e-mail actif configuré.' });
      }
      return res.json({ source: 'imap', ...await syncImapEmails() });
    }
    return res.json({ source: 'mock', ...await generateMockEmails() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET email by ID
router.get('/:id', async (req, res) => {
  try {
    const email = await get(
      `SELECT e.*, j.company as job_company, j.position as job_position
       FROM emails e LEFT JOIN job_applications j ON e.job_application_id = j.id
       WHERE e.id = ?`,
      [req.params.id]
    );
    if (!email) return res.status(404).json({ error: 'Email non trouvé' });
    res.json(email);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE email (local + optionally server-side)
router.delete('/:id', async (req, res) => {
  try {
    const emailId = req.params.id;
    const serverSide = req.query.serverSide === 'true';

    let serverResult = { serverDeleted: false };
    if (serverSide) {
      try {
        serverResult = await deleteImapEmail(emailId);
      } catch (err) {
        // Server delete failed – still delete locally but report the error
        serverResult = { serverDeleted: false, serverError: err.message };
      }
    }

    await run('DELETE FROM emails WHERE id = ?', [emailId]);
    res.json({ success: true, ...serverResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update category
router.put('/:id/category', async (req, res) => {
  try {
    const { category } = req.body;
    await run('UPDATE emails SET category = ? WHERE id = ?', [category, req.params.id]);
    res.json({ success: true, category });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT mark as read/unread
router.put('/:id/read', async (req, res) => {
  try {
    const { is_read } = req.body;
    await run('UPDATE emails SET is_read = ? WHERE id = ?', [is_read ? 1 : 0, req.params.id]);
    res.json({ success: true, is_read });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST link email to job application
router.post('/:id/link', async (req, res) => {
  try {
    const { job_application_id } = req.body;
    await run('UPDATE emails SET job_application_id = ? WHERE id = ?', [job_application_id, req.params.id]);

    const email = await get('SELECT category FROM emails WHERE id = ?', [req.params.id]);
    let newStatus = null;
    if (email) {
      if (email.category === 'Refus') newStatus = 'refusé';
      else if (email.category === 'Entretien') newStatus = 'entretien';
      else if (email.category === 'Offre') newStatus = 'accepté';
      if (newStatus && job_application_id) {
        await run('UPDATE job_applications SET status = ? WHERE id = ?', [newStatus, job_application_id]);
      }
    }

    res.json({ success: true, job_application_id, updated_job_status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
