import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { get, query, run } from '../db/database.js';
import { hybridClassify } from './ollamaClassifier.js';

// Build imap-simple config from an account row
function buildImapConfig(account, tlsOverride) {
  const useTls = tlsOverride !== undefined ? tlsOverride : (account.imap_tls === 'true');
  const isLocalBridge = account.imap_host === '127.0.0.1' || account.imap_host === 'localhost';
  return {
    imap: {
      user: account.imap_user,
      password: account.imap_password,
      host: account.imap_host,
      port: parseInt(account.imap_port, 10),
      tls: useTls,
      tlsOptions: {
        rejectUnauthorized: false,
        // Needed for ProtonMail Bridge self-signed cert
        ...(isLocalBridge ? { servername: 'localhost' } : {})
      },
      authTimeout: isLocalBridge ? 20000 : 10000,
      socketTimeout: isLocalBridge ? 30000 : 15000
    }
  };
}

// Connect with automatic TLS fallback for ProtonMail Bridge
async function connectWithFallback(account) {
  const primaryTls = account.imap_tls === 'true';
  try {
    return await imaps.connect(buildImapConfig(account, primaryTls));
  } catch (primaryErr) {
    const isLocalBridge = account.imap_host === '127.0.0.1' || account.imap_host === 'localhost';
    if (!isLocalBridge) throw primaryErr;

    // ProtonMail Bridge: try the opposite TLS setting
    try {
      const conn = await imaps.connect(buildImapConfig(account, !primaryTls));
      console.log(`[IMAP] Bridge TLS fallback succeeded for ${account.email} (tls=${!primaryTls})`);
      return conn;
    } catch {
      // Throw original error for clarity
      throw primaryErr;
    }
  }
}

async function emailExists(messageId) {
  const row = await get('SELECT 1 FROM emails WHERE id = ?', [messageId]);
  return !!row;
}

// Sync emails from all active IMAP accounts
export async function syncImapEmails() {
  const allAccounts = await query('SELECT * FROM email_accounts WHERE is_active = 1');
  if (allAccounts.length === 0) {
    throw new Error('Aucun compte e-mail configuré. Veuillez en ajouter un dans les paramètres.');
  }

  // Les alias ne se connectent pas en IMAP — leurs mails arrivent via le compte principal
  const accounts = allAccounts.filter(a => !a.is_alias_of);

  // Table de résolution alias : adresse email → account_id de l'alias
  const aliasMap = {};
  allAccounts.filter(a => a.is_alias_of).forEach(a => {
    aliasMap[a.email.toLowerCase()] = a.id;
  });

  let totalNewEmails = 0;
  const syncResults = [];
  const existingJobs = await query('SELECT * FROM job_applications');

  for (const account of accounts) {
    try {
      console.log(`[IMAP] Syncing: ${account.email}`);
      const connection = await connectWithFallback(account);
      await connection.openBox('INBOX');

      const since = new Date();
      since.setDate(since.getDate() - 14);
      const messages = await connection.search([['SINCE', since]], {
        bodies: [''],
        struct: true
      });
      messages.sort((a, b) => new Date(a.attributes.date) - new Date(b.attributes.date));

      let accountNewCount = 0;

      for (const message of messages) {
        const uid = message.attributes.uid;
        const allParts = message.parts.find(p => p.which === '');
        if (!allParts) continue;

        const parsed = await simpleParser(allParts.body);
        const messageId = parsed.messageId || `imap-uid-${uid}-${account.id}-${parsed.date?.getTime()}`;

        if (await emailExists(messageId)) continue;

        const recipientText = parsed.to?.text || account.email;

        // Détecter si ce mail est destiné à un alias — si oui, utiliser l'account_id de l'alias
        const toAddresses = (parsed.to?.value || []).map(a => (a.address || '').toLowerCase());
        const matchedAliasId = toAddresses.map(addr => aliasMap[addr]).find(Boolean);
        const effectiveAccountId = matchedAliasId || account.id;

        const emailData = {
          id: messageId,
          uid,
          sender: parsed.from?.text || 'Inconnu',
          recipient: recipientText,
          subject: parsed.subject || '(Sans objet)',
          body: parsed.html || parsed.text || '',
          date: parsed.date ? parsed.date.toISOString() : new Date().toISOString()
        };

        const classification = await hybridClassify(emailData, existingJobs);
        let linkedJobId = classification.job_application_id;

        if (!linkedJobId && classification.company && classification.status_update) {
          const matchingJob = existingJobs.find(
            j => j.company.toLowerCase() === classification.company.toLowerCase()
          );
          if (matchingJob) {
            linkedJobId = matchingJob.id;
          } else {
            const titleMatch = emailData.subject.match(/pour le poste de (.+?)(?:\s+chez|\s+-\s+|$)/i);
            const position = titleMatch ? titleMatch[1] : 'Poste non spécifié';
            const newJob = await run(
              `INSERT INTO job_applications (company, position, location, date_applied, status, notes)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [classification.company, position, 'Détecté automatiquement',
               emailData.date.split('T')[0], classification.status_update,
               `Créé automatiquement depuis un mail de : ${classification.company}`]
            );
            linkedJobId = newJob.id;
            existingJobs.push({ id: linkedJobId, company: classification.company, position, status: classification.status_update });
          }
        }

        if (linkedJobId && classification.status_update) {
          await run('UPDATE job_applications SET status = ? WHERE id = ?',
            [classification.status_update, linkedJobId]);
        }

        await run(
          `INSERT INTO emails (id, account_id, uid, sender, recipient, subject, body, date, category, job_application_id, ai_explanation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [emailData.id, effectiveAccountId, emailData.uid, emailData.sender, emailData.recipient,
           emailData.subject, emailData.body, emailData.date, classification.category,
           linkedJobId, classification.ai_explanation]
        );

        accountNewCount++;
        totalNewEmails++;
      }

      const now = new Date().toISOString();
      await run('UPDATE email_accounts SET last_sync = ? WHERE id = ?', [now, account.id]);
      // Mettre à jour aussi les aliases de ce compte
      await run('UPDATE email_accounts SET last_sync = ? WHERE is_alias_of = ?', [now, account.id]);
      connection.end();
      syncResults.push({ email: account.email, newEmails: accountNewCount, success: true });
    } catch (err) {
      console.error(`[IMAP] Error syncing ${account.email}:`, err.message);
      let hint = '';
      if (err.message.includes('ECONNREFUSED') && (account.imap_host === '127.0.0.1' || account.imap_host === 'localhost')) {
        hint = ' — ProtonMail Bridge ne semble pas être lancé.';
      } else if (err.message.includes('Invalid credentials') || err.message.includes('AUTHENTICATE')) {
        hint = ' — Mot de passe incorrect (utilisez le mot de passe Bridge, pas votre mot de passe ProtonMail).';
      }
      syncResults.push({ email: account.email, error: err.message + hint, success: false });
    }
  }

  return { newEmailsCount: totalNewEmails, syncResults };
}

// Delete an email on the IMAP server (flag \Deleted + expunge)
export async function deleteImapEmail(emailId) {
  const email = await get('SELECT * FROM emails WHERE id = ?', [emailId]);
  if (!email?.uid || !email?.account_id) {
    return { serverDeleted: false, reason: 'no_uid_or_account' };
  }

  const account = await get('SELECT * FROM email_accounts WHERE id = ?', [email.account_id]);
  if (!account) return { serverDeleted: false, reason: 'account_not_found' };

  const connection = await connectWithFallback(account);
  await connection.openBox('INBOX');

  await new Promise((resolve, reject) => {
    connection.imap.addFlags(email.uid, ['\\Deleted'], (err) => {
      if (err) reject(err); else resolve();
    });
  });

  await new Promise((resolve, reject) => {
    connection.imap.expunge((err) => {
      if (err) reject(err); else resolve();
    });
  });

  connection.end();
  return { serverDeleted: true };
}

// Generate mock emails for testing
export async function generateMockEmails() {
  const targetEmails = [
    'clement.noel.28@proton.me',
    'chagamings@gmail.com',
    '28.clement.noel@gmail.com',
    'clement.noel.alternance@proton.me'
  ];

  const accountsMap = {};
  for (const email of targetEmails) {
    let row = await get('SELECT id FROM email_accounts WHERE email = ?', [email]);
    if (row) {
      accountsMap[email] = row.id;
    } else {
      const host = email.endsWith('@proton.me') ? '127.0.0.1' : 'imap.gmail.com';
      const port = email.endsWith('@proton.me') ? '1143' : '993';
      const tls  = email.endsWith('@proton.me') ? 'false' : 'true';
      const res = await run(
        'INSERT INTO email_accounts (email, imap_host, imap_port, imap_user, imap_password, imap_tls, last_sync) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [email, host, port, email, '', tls, new Date().toISOString()]
      );
      accountsMap[email] = res.id;
    }
  }

  const mockTemplates = [
    {
      accountEmail: 'clement.noel.28@proton.me',
      sender: 'alerte-securite@banque-populaire-compte-suspendu.net',
      subject: "ACTION REQUISE : Tentative d'intrusion sur votre espace client",
      body: "Cher client,\n\nVotre compte bancaire a fait l'objet d'une tentative de fraude en Bitcoin. Pour votre sécurité, nous avons restreint vos accès. Veuillez cliquer sur le lien ci-dessous pour vérifier votre compte immédiatement :\nhttp://phishing-fraud-bp.com/verify\n\nL'équipe de Sécurité.",
      dateOffsetMinutes: -30
    },
    {
      accountEmail: 'clement.noel.28@proton.me',
      sender: 'info@members.netflix.com',
      subject: 'Votre reçu de facturation Netflix pour ce mois',
      body: "Bonjour Clément,\n\nMerci d'être membre Netflix. Ce courriel confirme que votre paiement mensuel de 13,49 € a été traité avec succès via votre carte de crédit.\n\nNuméro de facture : NET-98310931-2026.",
      dateOffsetMinutes: -15
    },
    {
      accountEmail: 'chagamings@gmail.com',
      sender: 'cdiscount@newsletter.cdiscount.com',
      subject: "VENTES PRIVÉES : Jusqu'à -50% sur le rayon Informatique et SSD !",
      body: "Bonjour Clément,\n\nC'est le moment d'équiper votre labo ! Retrouvez nos SSD NVMe, routeurs Wi-Fi et PC portables à prix cassés pendant 48 heures seulement.\n\nCliquez sur ce lien pour vous désabonner.",
      dateOffsetMinutes: -90
    },
    {
      accountEmail: 'chagamings@gmail.com',
      sender: 'lucas.dubois@gmail.com',
      subject: 'Soirée de fin de BTS / Fête',
      body: "Salut Clément !\n\nTu viens à la fête de fin de BTS vendredi soir après les épreuves ? On se retrouve chez Romain. Dis-moi si tu es chaud pour ramener des boissons ou de quoi grignoter. À plus !",
      dateOffsetMinutes: -60
    },
    {
      accountEmail: '28.clement.noel@gmail.com',
      sender: 'recrutement@airbus.com',
      subject: 'Candidature - Apprenti Ingénieur Cybersécurité - Clément NOEL',
      body: "Bonjour Clément,\n\nNous accusons réception de votre candidature pour le poste de Apprenti Ingénieur Cybersécurité (Opérationnel) au sein de nos équipes à Blagnac.\n\nVotre dossier va être étudié avec la plus grande attention par nos recruteurs.\n\nCordialement,\nL'équipe Recrutement Airbus",
      dateOffsetMinutes: -180
    },
    {
      accountEmail: '28.clement.noel@gmail.com',
      sender: 'notifications@linkedin.com',
      subject: 'Airbus et 3 autres recruteurs ont consulté votre profil cette semaine',
      body: "Bonjour Clément,\n\nDécouvrez qui a consulté votre profil LinkedIn récemment. Félicitations pour vos 12 nouvelles relations dans le domaine 'Cybersécurité'.",
      dateOffsetMinutes: -45
    },
    {
      accountEmail: '28.clement.noel@gmail.com',
      sender: 'noreply@github.com',
      subject: '[GitHub] Code de vérification OTP à deux facteurs : 482109',
      body: "Bonjour Clément,\n\nNous avons détecté une tentative de connexion à votre compte GitHub depuis un nouvel appareil.\n\nEntrez le code OTP suivant pour valider votre connexion : 482 109.\nCe code expire dans 10 minutes.",
      dateOffsetMinutes: -5
    },
    {
      accountEmail: 'clement.noel.alternance@proton.me',
      sender: 'contact@soprasteria.com',
      subject: 'Votre candidature chez Sopra Steria - Alternance SIEM',
      body: "Cher Monsieur Noel,\n\nSuite à l'étude de votre candidature pour le poste de Alternance Solution de sécurité (SIEM), nous avons le plaisir de vous proposer un premier échange téléphonique afin de faire connaissance et de discuter de votre projet.\n\nMerci de nous indiquer vos disponibilités pour la semaine prochaine.\n\nBien cordialement,\nSophie Durand - Chargée de recrutement",
      dateOffsetMinutes: -120
    },
    {
      accountEmail: 'clement.noel.alternance@proton.me',
      sender: 'no-reply@thalesgroup.com',
      subject: 'Candidature Thales - Apprenti Ingénieur Système & Réseaux',
      body: "Bonjour,\n\nNous vous remercions de l'intérêt que vous portez à Thales. Cependant, après étude attentive de votre profil, nous regrettons de ne pas pouvoir donner une suite favorable à votre candidature pour le poste de Apprenti(e) Ingénieur Système & Réseaux.\n\nCordialement,\nRecrutement Campus Thales",
      dateOffsetMinutes: -110
    },
    {
      accountEmail: 'clement.noel.alternance@proton.me',
      sender: 'administration@epsi.fr',
      subject: 'Modalités de rentrée - Bachelor Cybersécurité Septembre 2026',
      body: "Bonjour Clément,\n\nVous trouverez ci-joint les documents obligatoires à retourner pour finaliser votre dossier d'inscription administrative pour le Bachelor Systèmes, Réseaux et Cybersécurité pour la rentrée de septembre 2026.\n\nCordialement,\nLe secrétariat pédagogique EPSI Toulouse",
      dateOffsetMinutes: -25
    }
  ];

  const initialJobs = [
    { company: 'Airbus', position: 'Apprenti Ingénieur Cybersécurité', location: 'Blagnac', status: 'en cours' },
    { company: 'Sopra Steria', position: 'Alternance Solution de sécurité (SIEM)', location: 'Colomiers', status: 'en cours' },
    { company: 'Thales', position: 'Apprenti(e) Ingénieur Système & Réseaux', location: 'Toulouse', status: 'en cours' }
  ];

  for (const job of initialJobs) {
    const row = await get('SELECT id FROM job_applications WHERE company = ? AND position = ?', [job.company, job.position]);
    if (!row) {
      await run('INSERT INTO job_applications (company, position, location, date_applied, status) VALUES (?, ?, ?, ?, ?)',
        [job.company, job.position, job.location, new Date().toISOString().split('T')[0], job.status]);
    }
  }

  const existingJobs = await query('SELECT * FROM job_applications');
  let newEmailsCount = 0;

  for (const t of mockTemplates) {
    const mockDate = new Date(Date.now() + t.dateOffsetMinutes * 60 * 1000);
    const messageId = `mock-email-${t.sender}-${mockDate.getTime()}`;
    if (await emailExists(messageId)) continue;

    const emailData = {
      id: messageId,
      uid: Math.floor(Math.random() * 10000),
      sender: t.sender, recipient: t.accountEmail,
      subject: t.subject, body: t.body,
      date: mockDate.toISOString()
    };

    const classification = await hybridClassify(emailData, existingJobs);
    let linkedJobId = classification.job_application_id;

    if (linkedJobId && classification.status_update) {
      await run('UPDATE job_applications SET status = ? WHERE id = ?',
        [classification.status_update, linkedJobId]);
    }

    await run(
      `INSERT INTO emails (id, account_id, uid, sender, recipient, subject, body, date, category, job_application_id, ai_explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emailData.id, accountsMap[t.accountEmail], emailData.uid, emailData.sender,
       emailData.recipient, emailData.subject, emailData.body, emailData.date,
       classification.category, linkedJobId, classification.ai_explanation]
    );
    newEmailsCount++;
  }

  for (const id of Object.values(accountsMap)) {
    await run('UPDATE email_accounts SET last_sync = ? WHERE id = ?', [new Date().toISOString(), id]);
  }

  return {
    newEmailsCount,
    syncResults: targetEmails.map(email => ({
      email, success: true,
      newEmails: mockTemplates.filter(t => t.accountEmail === email).length
    }))
  };
}
