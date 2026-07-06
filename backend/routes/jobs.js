import express from 'express';
import { query, get, run } from '../db/database.js';

const router = express.Router();

// GET all job applications
router.get('/', async (req, res) => {
  try {
    const jobs = await query('SELECT * FROM job_applications ORDER BY date_applied DESC');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single job application with its associated emails
router.get('/:id', async (req, res) => {
  try {
    const job = await get('SELECT * FROM job_applications WHERE id = ?', [req.params.id]);
    if (!job) {
      return res.status(404).json({ error: 'Offre non trouvée' });
    }
    const emails = await query('SELECT * FROM emails WHERE job_application_id = ? ORDER BY date DESC', [req.params.id]);
    res.json({ ...job, emails });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new job application manually
router.post('/', async (req, res) => {
  try {
    const { company, position, location, date_applied, status, notes, link_to_offer } = req.body;
    
    if (!company || !position) {
      return res.status(400).json({ error: 'Entreprise et intitulé du poste requis' });
    }

    const result = await run(
      `INSERT INTO job_applications (company, position, location, date_applied, status, notes, link_to_offer)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        company,
        position,
        location || '',
        date_applied || new Date().toISOString().split('T')[0],
        status || 'en cours',
        notes || '',
        link_to_offer || ''
      ]
    );

    const newJob = await get('SELECT * FROM job_applications WHERE id = ?', [result.id]);
    res.status(201).json(newJob);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update job application
router.put('/:id', async (req, res) => {
  try {
    const { company, position, location, date_applied, status, notes, link_to_offer } = req.body;
    
    if (!company || !position) {
      return res.status(400).json({ error: 'Entreprise et intitulé du poste requis' });
    }

    await run(
      `UPDATE job_applications 
       SET company = ?, position = ?, location = ?, date_applied = ?, status = ?, notes = ?, link_to_offer = ?
       WHERE id = ?`,
      [
        company,
        position,
        location,
        date_applied,
        status,
        notes,
        link_to_offer,
        req.params.id
      ]
    );

    const updatedJob = await get('SELECT * FROM job_applications WHERE id = ?', [req.params.id]);
    res.json(updatedJob);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE job application
router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM job_applications WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Candidature supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
