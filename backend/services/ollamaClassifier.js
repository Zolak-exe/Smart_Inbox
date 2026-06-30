/**
 * Classificateur IA via Ollama (modèle local léger).
 *
 * Modèle par défaut : qwen2.5:1.5b (~1 Go) — multilingue, rapide, efficace.
 * Modèle qualité    : qwen2.5:3b    (~2 Go) — meilleure compréhension.
 *
 * Le système prompt incorpore TOUTES les informations utiles sur la
 * signification des emails, les patterns français de recrutement, les
 * domaines connus et les règles de désambiguïsation.
 */

import { query as dbQuery } from '../db/database.js';

const OLLAMA_URL = 'http://localhost:11434';

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT — enrichi avec toutes les connaissances métier
// ═══════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `Tu es un classificateur d'e-mails expert pour Clément Noël, étudiant français en cybersécurité cherchant une alternance.

## CONTEXTE UTILISATEUR
- Étudiant en Bachelor Systèmes, Réseaux & Cybersécurité à l'EPSI Toulouse (rentrée sept. 2026)
- Recherche une alternance : cybersécurité, SOC, SIEM, pentest, réseaux, sécurité opérationnelle
- Entreprises ciblées : Airbus, Thales, Sopra Steria, Capgemini, Atos, Orange Cyberdéfense, Engie, EDF, CNES, Safran, Renault, SNCF, BNP Paribas, Société Générale, Deloitte, KPMG, IBM France, Cisco, Palo Alto, Fortinet, Stormshield, Eviden
- Ses 4 adresses : clement.noel.28@proton.me · chagamings@gmail.com · 28.clement.noel@gmail.com · clement.noel.alternance@proton.me
- Utilise ProtonMail Bridge pour accéder à ses adresses Proton en IMAP local

## CATÉGORIES ET LEURS CRITÈRES EXACTS

### "Spam"
E-mails frauduleux, malveillants ou contenu adulte indésirable.
INCLUT OBLIGATOIREMENT :
- Phishing/hameçonnage : faux emails de banque, faux PayPal, fausse livraison
- Contenu adulte : MYM (mym.fans, mym.link), OnlyFans, Fansly, Fanvue, Brazzers, etc.
- Arnaques crypto : Bitcoin, Ethereum, NFT, "investissement garanti X%", "doublez vos gains"
- Loteries, héritages, princes nigerians, "vous avez gagné un iPhone"
- Médicaments illicites : Viagra, Cialis, pilules amaigrissantes
- Transferts d'argent urgents, offres d'emploi à la maison
- Domaines manifesment suspects : .xyz, .click, .loan, .work, .gdn
- Senders bizarres : "alerte-securite@banque-suspendu.net", chiffres aléatoires@

### "Social"
Notifications automatiques de réseaux sociaux et messageries collaboratives.
INCLUT :
- LinkedIn : nouvelles relations, profil consulté, messages reçus, recommandations, partages, anniversaires professionnels, alertes emploi AUTOMATIQUES (non personnalisées), "X personnes ont vu votre profil", félicitations pour un nouveau poste
- Facebook : likes, commentaires, messages, friend requests, anniversaires
- Instagram : likes, followers, mentions, stories
- Twitter/X : mentions, retweets, nouveaux followers, DMs
- Discord : messages, invitations serveur, mentions
- Reddit : karma, réponses à vos posts, messages directs, gilded
- Slack : @mentions, messages directs, résumés de canal
- YouTube : commentaires sur vos vidéos, nouveaux abonnés
- Mastodon, Twitch, Pinterest, Snapchat, TikTok, BeReal
DOMAINES : linkedin.com, facebookmail.com, twitter.com, x.com, discordapp.com, discord.com, reddit.com, redditmail.com, slack.com, youtube.com, twitch.tv, tiktok.com, snapchat.com, instagram.com
⚠️ RÈGLE CRITIQUE : "notification@linkedin.com" → SOCIAL même si le sujet parle de "connexion" ou "compte". La distinction est : notification de réseau social ≠ alerte de sécurité de compte.

### "Securite"
Alertes de sécurité authentiques, codes d'authentification, notifications de connexion suspecte.
INCLUT :
- Codes OTP/2FA/TOTP : formats "482 109", "482109", "Votre code est : 482109", "Your verification code: 482109"
- Réinitialisation de mot de passe : lien "reset your password", "réinitialisez votre mot de passe"
- Alerte de connexion depuis un NOUVEL APPAREIL ou NOUVEAU PAYS : "Nouvelle connexion détectée depuis Windows à Paris", "New sign-in from Chrome on Linux"
- Compte suspendu ou restreint pour activité suspecte
- Changement de mot de passe confirmé
- Email de vérification à la création d'un compte ("confirmez votre adresse")
- Authentification sans mot de passe, magic link
PROVIENT DE : noreply@github.com, security@twitter.com, accounts.google.com, noreply@google.com, no-reply@apple.com, account.microsoft.com, noreply@discord.com, security@linkedin.com (si alerte réelle)
DISTINCTION LinkedIn Social vs Securite :
- "Vous avez 3 nouvelles relations sur LinkedIn" → SOCIAL
- "Votre compte LinkedIn a été connecté depuis un nouvel appareil" → SECURITE
- "Airbus a consulté votre profil" → SOCIAL
- "Code de sécurité LinkedIn : 123456" → SECURITE

### "Facture"
Documents financiers légitimes : factures, reçus, confirmations de paiement.
INCLUT :
- Facture avec montant exact (13,49 €, 9,99 €/mois, etc.)
- Reçu de paiement ("Votre paiement de X€ a été traité")
- Confirmation de commande avec total ("Commande #12345 - Total : 49,99 €")
- Prélèvement automatique ("votre prélèvement mensuel de X€ aura lieu le...")
- Relevé de compte, extrait de carte bancaire
- Renouvellement d'abonnement avec montant ("votre abonnement Premium à 9,99€/mois a été renouvelé")
- Confirmation de réservation avec montant (hôtel, train, avion)
PROVIENT DE : Netflix, Spotify, Disney+, Amazon, PayPal, Stripe, banques, opérateurs téléphoniques
⚠️ NÉCESSITE : montant précis en devise + contexte transactionnel (pas juste une promo)

### "Promotion"
Emails marketing, newsletters commerciales, offres publicitaires.
INCLUT :
- Codes promo, bons de réduction, soldes, ventes flash, ventes privées
- Newsletters d'information générale ou tech (sans montant débité)
- "Offres de la semaine", "Nos meilleures ventes", "Découvrez nos nouveautés"
- Emails avec footer contenant "se désabonner", "unsubscribe", "gérer mes préférences email"
- Alertes emploi AUTOMATIQUES de LinkedIn, Indeed sans personnalisation ("5 offres correspondent à votre profil")
- Invitations à des webinars marketing, demos commerciales
- Résumés hebdomadaires de services (Glassdoor "offres similaires", Indeed digest)
SIGNAL FORT : présence d'un lien "désabonner" ou "unsubscribe" dans le contenu

### "Candidature"
Accusé de réception officiel après envoi d'une candidature à un poste.
INCLUT :
- "Nous avons bien reçu votre candidature pour le poste de [X] chez [Entreprise]"
- "Votre dossier a été enregistré - Référence : [numéro]"
- "Notre équipe de recrutement va étudier votre candidature dans les prochains jours"
- "Nous vous recontacterons dans les 2-4 semaines"
- Confirmation automatique après un Easy Apply LinkedIn, dépôt Indeed, HelloWork
- "Merci de l'intérêt que vous portez à [Entreprise]" sans entretien proposé
PROVIENT DE : recrutement@airbus.com, talent@thalesgroup.com, jobs@soprasteria.com, noreply@indeed.com, noreply@glassdoor.com
⚠️ Si l'email propose directement un entretien → ENTRETIEN (pas Candidature)

### "Entretien"
Invitation formelle à un entretien ou à un échange d'approfondissement.
INCLUT :
- "Nous serions ravis de vous rencontrer pour un entretien"
- "Seriez-vous disponible pour un entretien téléphonique/visio la semaine prochaine ?"
- Proposition de créneaux horaires précis ou lien de prise de rendez-vous (Calendly, etc.)
- Invitation à un appel Teams, Zoom, Google Meet, Skype, WebEx
- Test technique, exercice de mise en situation, assessment en ligne (HackerRank, Codility)
- "Votre profil nous intéresse, nous aimerions échanger avec vous"
- Convocation à un Assessment Center (AC)
- Lien vers un formulaire ou questionnaire pré-entretien
⚠️ Même si l'email est formulé comme une "prise de contact", si l'objectif est de discuter de la candidature = ENTRETIEN

### "Refus"
Réponse négative définitive à une candidature soumise.
INCLUT :
- "Après étude de votre dossier, nous ne pouvons donner une suite favorable"
- "Nous avons retenu d'autres profils correspondant mieux à nos critères"
- "Votre candidature n'a pas été retenue"
- "Nous regrettons de vous informer que...", "Nous sommes au regret de..."
- "Unfortunately, we will not be moving forward with your application"
- "After careful review, we regret to inform you that..."
- "We have decided to pursue other candidates"
- Encouragements à repostuler dans le futur (souvent présents dans les refus polis)
- "Nous garderons votre CV en vivier" (= refus déguisé)
⚠️ Même si le ton est très positif et encourage, si la conclusion est négative = REFUS

### "Offre"
Proposition formelle et ferme d'embauche, d'alternance ou de stage.
INCLUT :
- "Nous avons le plaisir de vous proposer le poste de [X] avec une prise de poste le [date]"
- Détails contractuels : type de contrat (CDI, CDD, alternance, stage), durée, rémunération, avantages
- "Contrat de travail", "promesse d'embauche", "lettre d'offre"
- "We are pleased to offer you the position of..."
- Demande de signature ou d'acceptation formelle dans un délai
⚠️ TRÈS RARE - seulement si l'offre est FERME avec détails contractuels. "On aimerait vous proposer un poste" sans détails = Entretien.

### "Personnel"
Échanges directs et informels entre humains (proches, amis, famille, camarades).
INCLUT :
- Emails de proches, amis, famille, copains de lycée/BTS/école
- Conversations informelles : soirées, projets communs, questions personnelles, plans du week-end
- Emails commençant par "Salut [prénom]", "Bonjour Clément", "Hey !"
- Réponses à des échanges précédents (sujet commençant par Re:, Fwd:, TR:, FW:)
- Emails depuis des domaines publics (gmail.com, hotmail.com, yahoo.fr, live.fr, outlook.fr, orange.fr, sfr.fr, free.fr, laposte.net, wanadoo.fr, icloud.com, proton.me, protonmail.com) rédigés naturellement
- Signature personnelle : "Lucas", "À plus !", "Bisous", "Cordialement, Thomas"
EXCLUT : emails automatiques depuis Gmail (newsletters, notifications), templates
SIGNAUX HUMAINS : absence de lien de désabonnement, ton conversationnel, fautes d'orthographe possibles, références personnelles

### "Professionnel"
Emails professionnels légitimes ne correspondant à aucune autre catégorie spécifique.
INCLUT :
- Notifications de GitHub (issues, PRs, CI/CD, releases, security advisories) sans code OTP
- Notifications GitLab, Bitbucket, Jira, Confluence, Trello
- Emails administratifs de l'école (EPSI, cursus, planning, convocations, documents)
- Newsletters techniques (The Hacker News, Bleeping Computer, ANSSI, CERT-FR) sans aspect commercial
- Confirmations d'inscription à un service, CGU modifiées
- Emails d'administration système, alertes de monitoring
- Communications d'institutions (Pôle Emploi/France Travail, CAF, CPAM) non urgentes
- Emails d'entreprises qui ne concernent pas une candidature

## RÈGLES D'ARBITRAGE FINALES

1. Un email de LinkedIn avec "notification@linkedin.com" → SOCIAL (jamais Sécurité sauf si c'est un code)
2. Un email d'un recruteur INDIVIDUEL (prénom.nom@entreprise.com) → selon contenu (Candidature/Entretien/Refus/Offre)
3. Lien "se désabonner" dans le footer → fort signal de Promotion (sauf si c'est obligatoire légalement = Facture peut aussi l'avoir)
4. Si l'email parle d'une candidature ET propose déjà un entretien → ENTRETIEN (pas Candidature)
5. Email vague d'une grande entreprise sans mention de poste → PROFESSIONNEL
6. En cas de doute : Spam > Securite > Entretien > Candidature > Refus > Facture > Promotion > Social > Personnel > Professionnel
7. Le sujet SEUL ne suffit pas : toujours vérifier le corps du message

## FORMAT DE RÉPONSE
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après :
{"category": "CATEGORIE", "explanation": "Explication courte en français (1-2 phrases max)", "company": "NomEntreprise ou vide"}

Les valeurs valides pour "category" sont EXACTEMENT : Spam, Social, Securite, Facture, Promotion, Candidature, Entretien, Refus, Offre, Personnel, Professionnel`;

// Schéma JSON pour forcer la structure de sortie (Ollama >= 0.5)
const JSON_SCHEMA = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: ['Spam','Social','Securite','Facture','Promotion','Candidature','Entretien','Refus','Offre','Personnel','Professionnel']
    },
    explanation: { type: 'string' },
    company: { type: 'string' }
  },
  required: ['category', 'explanation']
};

const STATUS_MAP = {
  Candidature: 'en cours',
  Entretien:   'entretien',
  Refus:       'refusé',
  Offre:       'accepté'
};

// ═══════════════════════════════════════════════════════════════════════════
// VÉRIFICATION DU STATUT OLLAMA
// ═══════════════════════════════════════════════════════════════════════════
export async function checkOllamaStatus(model = 'qwen2.5:1.5b') {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) return { running: false, modelAvailable: false };
    const data = await res.json();
    const modelBase = model.split(':')[0];
    const modelAvailable = (data.models || []).some(m => m.name.startsWith(modelBase));
    const modelInfo = modelAvailable
      ? (data.models || []).find(m => m.name.startsWith(modelBase))
      : null;
    return {
      running: true,
      modelAvailable,
      modelSize: modelInfo ? (modelInfo.size / 1024 / 1024 / 1024).toFixed(2) + ' Go' : null
    };
  } catch {
    return { running: false, modelAvailable: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSIFICATION OLLAMA (pure)
// ═══════════════════════════════════════════════════════════════════════════
export async function classifyWithOllama(email, model = 'qwen2.5:1.5b') {
  const userContent = [
    `Expéditeur: ${(email.sender || '').substring(0, 200)}`,
    `Sujet: ${(email.subject || '').substring(0, 300)}`,
    `Corps (extrait):\n${(email.body || '').substring(0, 1500)}`
  ].join('\n');

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      stream: false,
      format: JSON_SCHEMA,
      options: { temperature: 0, top_p: 1, num_predict: 100 }
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

  const data = await res.json();
  const raw = data.message?.content || data.response || '';

  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error(`Réponse Ollama non parseable : ${raw.substring(0, 100)}`);
  }

  const validCategories = ['Spam','Social','Securite','Facture','Promotion','Candidature','Entretien','Refus','Offre','Personnel','Professionnel'];
  if (!validCategories.includes(parsed.category)) {
    throw new Error(`Catégorie inconnue : ${parsed.category}`);
  }

  return {
    category: parsed.category,
    company: parsed.company || '',
    job_application_id: null,
    status_update: STATUS_MAP[parsed.category] || null,
    ai_explanation: `[IA] ${parsed.explanation || ''}`
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSIFICATEUR HYBRIDE
// Règles certaines → IA → fallback règles si IA indisponible
// ═══════════════════════════════════════════════════════════════════════════

// Domaines pour lesquels la règle est 100% certaine (pas besoin d'IA)
const CERTAIN_SOCIAL_DOMAINS = [
  'linkedin.com','linkedin.fr','facebookmail.com','fb.com','instagram.com',
  'twitter.com','x.com','discordapp.com','discord.com','reddit.com','redditmail.com',
  'pinterest.com','tiktok.com','snapchat.com','youtube.com','twitch.tv','slack.com','mastodon.'
];

const CERTAIN_SPAM_DOMAINS = [
  'mym.fans','mym.link','mymcontent.','onlyfans.','fansly.','fanvue.'
];

// Détection OTP certaine
function isCertainOtp(content) {
  return /\b\d{3}\s?\d{3}\b/.test(content) && /(code|otp|pin|token|vérif|authentif)/i.test(content);
}

// Détection lien reset certaine
function isCertainReset(content) {
  return /https?:\/\/[^\s"'<>]+(?:reset|verify|confirm|activate|password)[^\s"'<>]*/i.test(content);
}

// Charge la config IA depuis la DB
async function loadAiConfig() {
  try {
    const rows = await dbQuery('SELECT key, value FROM app_config');
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch { return {}; }
}

export async function hybridClassify(email, existingJobs = [], _ignored = [], _aiConfig = {}) {
  const { classifyEmail } = await import('./aiClassifier.js');

  // ── Chargement TOUJOURS depuis la DB (garantit la fraîcheur des règles) ──
  const [spamRules, aiConfig] = await Promise.all([
    dbQuery('SELECT * FROM spam_rules').catch(() => []),
    loadAiConfig()
  ]);

  const sender  = (email.sender  || '').toLowerCase();
  const content = (email.subject || '').toLowerCase() + ' ' + (email.body || '').toLowerCase();

  // Extrait l'adresse email brute pour la vérification de domaine
  const addrMatch = sender.match(/<([^>]+)>/) || sender.match(/([a-z0-9._%+\-]+@[a-z0-9.\-]+)/i);
  const senderAddr = addrMatch ? addrMatch[1] : sender;

  // ── 1. Blocklist personnalisée (priorité ABSOLUE — avant tout) ────────────
  for (const rule of spamRules) {
    const pattern = (rule.pattern || '').toLowerCase().trim();
    if (!pattern) continue;
    const target = rule.pattern_type === 'keyword' ? content
                 : rule.pattern_type === 'sender'  ? sender
                 : sender + ' ' + senderAddr; // 'domain' : vérifie les deux
    if (target.includes(pattern)) {
      return { category: 'Spam', company: '', job_application_id: null, status_update: null,
        ai_explanation: `Bloqué par règle personnalisée : "${rule.label || rule.pattern}".` };
    }
  }

  // ── 2. Domaines spam connus hardcodés ─────────────────────────────────────
  if (CERTAIN_SPAM_DOMAINS.some(d => sender.includes(d) || senderAddr.includes(d))) {
    return { category: 'Spam', company: '', job_application_id: null, status_update: null,
      ai_explanation: 'Domaine de contenu adulte ou spam connu.' };
  }

  // ── 3. Domaines sociaux certains (IA inutile sauf OTP) ───────────────────
  if (CERTAIN_SOCIAL_DOMAINS.some(d => sender.includes(d) || senderAddr.includes(d))) {
    if (isCertainOtp(content) || isCertainReset(content)) {
      return { category: 'Securite', company: '', job_application_id: null, status_update: null,
        ai_explanation: 'Code de sécurité ou lien de réinitialisation depuis un réseau social.' };
    }
    return { category: 'Social', company: '', job_application_id: null, status_update: null,
      ai_explanation: 'Notification provenant d\'un réseau social.' };
  }

  // ── 4. IA Ollama si activée ───────────────────────────────────────────────
  if (aiConfig.ai_enabled === 'true') {
    try {
      const result = await classifyWithOllama(email, aiConfig.ai_model || 'qwen2.5:1.5b');

      // Lier à une candidature existante si recrutement
      if (['Candidature','Entretien','Refus','Offre'].includes(result.category) && existingJobs.length > 0) {
        for (const job of existingJobs) {
          if (content.includes(job.company.toLowerCase()) ||
              senderAddr.includes(job.company.toLowerCase().replace(/\s+/g, ''))) {
            result.job_application_id = job.id;
            result.company = result.company || job.company;
            break;
          }
        }
      }

      return result;
    } catch (err) {
      console.warn('[Ollama] Échec, fallback règles :', err.message);
    }
  }

  // ── 5. Fallback : classificateur à règles ────────────────────────────────
  return classifyEmail(email, existingJobs, spamRules);
}
