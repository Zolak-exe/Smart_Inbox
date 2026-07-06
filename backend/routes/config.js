import express from 'express';
import { query, run, get } from '../db/database.js';
import imaps from 'imap-simple';

const router = express.Router();

// GET all configured email accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await query(
      `SELECT a.id, a.email, a.imap_host, a.imap_port, a.imap_user, a.imap_tls,
              a.is_active, a.last_sync, a.is_alias_of,
              p.email as primary_email
       FROM email_accounts a
       LEFT JOIN email_accounts p ON a.is_alias_of = p.id`
    ).catch(() =>
      // Fallback si la colonne is_alias_of n'existe pas encore (migration en cours)
      query('SELECT *, NULL as is_alias_of, NULL as primary_email FROM email_accounts')
    );
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a new email account
router.post('/', async (req, res) => {
  try {
    const { email, imap_host, imap_port, imap_user, imap_password, imap_tls } = req.body;
    
    if (!email || !imap_host || !imap_user || !imap_password) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (Email, Serveur, Utilisateur et Mot de passe).' });
    }

    const result = await run(
      `INSERT INTO email_accounts (email, imap_host, imap_port, imap_user, imap_password, imap_tls) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        email,
        imap_host,
        imap_port || '993',
        imap_user,
        imap_password,
        imap_tls === false || imap_tls === 'false' ? 'false' : 'true'
      ]
    );

    const newAccount = await get(
      'SELECT id, email, imap_host, imap_port, imap_user, imap_tls, is_active, last_sync FROM email_accounts WHERE id = ?',
      [result.id]
    );
    res.status(201).json(newAccount);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Cet adresse e-mail est déjà configurée.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update an email account
router.put('/:id', async (req, res) => {
  try {
    const { email, imap_host, imap_port, imap_user, imap_password, imap_tls, is_active } = req.body;

    let updateFields = [];
    let params = [];

    if (email) { updateFields.push('email = ?'); params.push(email); }
    if (imap_host) { updateFields.push('imap_host = ?'); params.push(imap_host); }
    if (imap_port) { updateFields.push('imap_port = ?'); params.push(imap_port); }
    if (imap_user) { updateFields.push('imap_user = ?'); params.push(imap_user); }
    if (is_active !== undefined) { updateFields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if ('is_alias_of' in req.body) {
      updateFields.push('is_alias_of = ?');
      params.push(req.body.is_alias_of || null);
    }
    
    if (imap_tls !== undefined) {
      updateFields.push('imap_tls = ?');
      params.push(imap_tls === false || imap_tls === 'false' ? 'false' : 'true');
    }

    // Only update password if a new one is typed (not masked placeholder)
    if (imap_password && imap_password !== '••••••••') {
      updateFields.push('imap_password = ?');
      params.push(imap_password);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
    }

    params.push(req.params.id);
    await run(`UPDATE email_accounts SET ${updateFields.join(', ')} WHERE id = ?`, params);

    const updatedAccount = await get(
      `SELECT a.id, a.email, a.imap_host, a.imap_port, a.imap_user, a.imap_tls,
              a.is_active, a.last_sync, a.is_alias_of, p.email as primary_email
       FROM email_accounts a LEFT JOIN email_accounts p ON a.is_alias_of = p.id
       WHERE a.id = ?`,
      [req.params.id]
    );
    res.json(updatedAccount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE an email account (cascade deletes its linked emails due to DB constraint)
router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM email_accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Compte e-mail supprimé avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST test IMAP credentials
router.post('/test-imap', async (req, res) => {
  try {
    const { id, imap_host, imap_port, imap_user, imap_password, imap_tls } = req.body;

    let password = imap_password;
    if (id && password === '••••••••') {
      const stored = await get('SELECT imap_password FROM email_accounts WHERE id = ?', [id]);
      password = stored?.imap_password || '';
    }

    if (!imap_host || !imap_user || !password) {
      return res.status(400).json({ error: 'Champs obligatoires manquants.' });
    }

    const testConfig = {
      imap: {
        user: imap_user,
        password: password,
        host: imap_host,
        port: parseInt(imap_port || '993', 10),
        tls: imap_tls === true || imap_tls === 'true',
        authTimeout: 6000
      }
    };

    const connection = await imaps.connect(testConfig);
    connection.end();
    
    res.json({ success: true, message: 'Connexion IMAP réussie !' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
