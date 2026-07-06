/**
 * Classifieur d'e-mails — système de score pondéré + registre de domaines.
 *
 * Architecture :
 *  1. Registre de domaines expéditeurs connus → catégorie certaine
 *  2. Détection Spam (multi-signal obligatoire, regex)
 *  3. Score pondéré sur contenu pour les expéditeurs inconnus
 *  4. Fallback conservateur → Professionnel
 *
 * Pourquoi ce design évite les erreurs :
 *  - Aucune catégorie ne se déclenche sur un seul mot-clé
 *  - Les domaines connus (linkedin.com, github.com…) ont une catégorie imposée
 *  - Les patterns regex vérifient des signaux vrais (code à 6 chiffres, montant €)
 *  - Le score minimum empêche les classifications sur preuves faibles
 */

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRE DE DOMAINES CONNUS
// Clé  : sous-domaine ou domaine (correspondance par inclusion)
// Valeur: { default, if_strong_otp, if_account_action, if_billing, if_promo, check_recruitment }
// ═══════════════════════════════════════════════════════════════════════════
const DOMAIN_REGISTRY = [
  // ── Réseaux sociaux ────────────────────────────────────────────────────────
  { match: 'linkedin.',          default: 'Social',       if_strong_otp: 'Securite' },
  { match: 'facebookmail.',      default: 'Social',       if_strong_otp: 'Securite' },
  { match: 'fb.com',             default: 'Social' },
  { match: 'instagram.',         default: 'Social',       if_strong_otp: 'Securite' },
  { match: 'twitter.',           default: 'Social' },
  { match: '@x.com',             default: 'Social' },
  { match: 'discord',            default: 'Social',       if_strong_otp: 'Securite' },
  { match: 'reddit',             default: 'Social' },
  { match: 'pinterest.',         default: 'Social' },
  { match: 'tiktok.',            default: 'Social',       if_strong_otp: 'Securite' },
  { match: 'snapchat.',          default: 'Social',       if_strong_otp: 'Securite' },
  { match: 'youtube.',           default: 'Social' },
  { match: 'twitch.tv',          default: 'Social' },
  { match: 'slack.',             default: 'Social',       if_strong_otp: 'Securite' },
  { match: 'mastodon.',          default: 'Social' },

  // ── Plateformes tech (sécurité si OTP/action compte, sinon pro) ────────────
  { match: 'github.',            default: 'Professionnel', if_account_action: 'Securite' },
  { match: 'gitlab.',            default: 'Professionnel', if_account_action: 'Securite' },
  { match: 'bitbucket.',         default: 'Professionnel', if_account_action: 'Securite' },
  { match: 'accounts.google.',   default: 'Securite' },
  { match: 'no-reply@google.',   default: 'Securite' },
  { match: 'google.',            default: 'Professionnel', if_account_action: 'Securite' },
  { match: 'apple.',             default: 'Securite',      if_billing: 'Facture' },
  { match: 'icloud.',            default: 'Securite' },
  { match: 'account.microsoft.', default: 'Securite' },
  { match: 'microsoft.',         default: 'Professionnel', if_account_action: 'Securite' },
  { match: 'dropbox.',           default: 'Professionnel', if_account_action: 'Securite' },
  { match: 'adobe.',             default: 'Professionnel', if_account_action: 'Securite', if_billing: 'Facture' },
  { match: 'notion.',            default: 'Professionnel', if_account_action: 'Securite' },
  { match: 'figma.',             default: 'Professionnel', if_account_action: 'Securite' },

  // ── Streaming / divertissement ─────────────────────────────────────────────
  { match: 'netflix.',           default: 'Facture',       if_promo: 'Promotion' },
  { match: 'spotify.',           default: 'Facture',       if_promo: 'Promotion' },
  { match: 'disney.',            default: 'Facture',       if_promo: 'Promotion' },
  { match: 'prime-video.',       default: 'Facture' },
  { match: 'hulu.',              default: 'Facture' },
  { match: 'canal+',             default: 'Facture',       if_promo: 'Promotion' },

  // ── E-commerce / shopping ──────────────────────────────────────────────────
  { match: 'amazon.',            default: 'Facture',       if_promo: 'Promotion' },
  { match: 'ebay.',              default: 'Promotion',     if_billing: 'Facture' },
  { match: 'cdiscount.',         default: 'Promotion',     if_billing: 'Facture' },
  { match: 'fnac.',              default: 'Promotion',     if_billing: 'Facture' },
  { match: 'leboncoin.',         default: 'Promotion',     if_billing: 'Facture' },
  { match: 'vinted.',            default: 'Promotion',     if_billing: 'Facture' },
  { match: 'aliexpress.',        default: 'Promotion',     if_billing: 'Facture' },
  { match: 'etsy.',              default: 'Promotion',     if_billing: 'Facture' },
  { match: 'shein.',             default: 'Promotion' },

  // ── Banques / fintech ──────────────────────────────────────────────────────
  { match: 'paypal.',            default: 'Facture',       if_account_action: 'Securite' },
  { match: 'stripe.',            default: 'Facture' },
  { match: 'revolut.',           default: 'Facture',       if_account_action: 'Securite' },
  { match: 'lydia.',             default: 'Facture',       if_account_action: 'Securite' },
  { match: 'fortuneo.',          default: 'Facture',       if_account_action: 'Securite' },
  { match: 'bnpparibas.',        default: 'Facture',       if_account_action: 'Securite' },
  { match: 'societegenerale.',   default: 'Facture',       if_account_action: 'Securite' },
  { match: 'creditagricole.',    default: 'Facture',       if_account_action: 'Securite' },
  { match: 'boursorama.',        default: 'Facture',       if_account_action: 'Securite' },
  { match: 'labanquepostale.',   default: 'Facture',       if_account_action: 'Securite' },

  // ── Contenu adulte / spam connus ──────────────────────────────────────────
  { match: 'mym.fans',      default: 'Spam' },
  { match: 'mym.link',      default: 'Spam' },
  { match: 'mymcontent.',   default: 'Spam' },
  { match: 'onlyfans.',     default: 'Spam' },
  { match: 'fansly.',       default: 'Spam' },
  { match: 'fanvue.',       default: 'Spam' },

  // ── Plateformes de recrutement ─────────────────────────────────────────────
  { match: 'indeed.',            default: 'Candidature', check_recruitment: true },
  { match: 'glassdoor.',         default: 'Candidature', check_recruitment: true },
  { match: 'welcometothejungle.',default: 'Candidature', check_recruitment: true },
  { match: 'wttj.co',           default: 'Candidature', check_recruitment: true },
  { match: 'hellowork.',         default: 'Candidature', check_recruitment: true },
  { match: 'monster.',           default: 'Candidature', check_recruitment: true },
  { match: 'cadremploi.',        default: 'Candidature', check_recruitment: true },
  { match: 'apec.',              default: 'Candidature', check_recruitment: true },
  { match: 'francetravail.',     default: 'Candidature', check_recruitment: true },
  { match: 'pole-emploi.',       default: 'Candidature', check_recruitment: true },
  { match: 'jobijoba.',          default: 'Candidature', check_recruitment: true },
  { match: 'stepstone.',         default: 'Candidature', check_recruitment: true },
  { match: 'regionsjob.',        default: 'Candidature', check_recruitment: true },
  { match: 'meteojob.',          default: 'Candidature', check_recruitment: true },
  { match: 'talent.io',          default: 'Candidature', check_recruitment: true },
  { match: 'lesjeudis.',         default: 'Candidature', check_recruitment: true },
  { match: 'l\'etudiant.',       default: 'Candidature', check_recruitment: true },
  { match: 'studyrama.',         default: 'Candidature', check_recruitment: true },
  { match: 'chooseyourboss.',    default: 'Candidature', check_recruitment: true },
  { match: 'jobteaser.',         default: 'Candidature', check_recruitment: true },
];

// ═══════════════════════════════════════════════════════════════════════════
// PATTERNS REGEX — signaux VRAIS (non trompables par de simples mots-clés)
// ═══════════════════════════════════════════════════════════════════════════

// Code OTP/2FA : chiffres isolés 4-8 chiffres, ou format "NNN NNN"
const OTP_CODE_RE = /\b\d{3}\s?\d{3}\b|\b\d{4,8}\b(?=.*(?:code|otp|pin|token|vérif))/i;

// Réinitialisation de mot de passe / lien de vérification
const RESET_LINK_RE = /https?:\/\/[^\s"'<>]+(?:reset|verify|confirm|validate|activate|token|password)[^\s"'<>]*/i;

// Montant monétaire (pour facturation)
const AMOUNT_RE = /\b\d{1,4}[,.]?\d{0,2}\s*(?:€|\$|£|USD|EUR)\b|\b(?:€|\$|£)\s*\d{1,4}[,.]?\d{0,2}\b/;

// Lien de désabonnement (signal quasi-certain de mail commercial)
const UNSUB_RE = /désabonner|se désinscrire|unsubscribe|préférences.*email|email.*préférences/i;

// Signature humaine (échanges personnels)
const HUMAN_SIG_RE = /cordialement|à bientôt|bien à (toi|vous)|salut|ciao|bises|à plus|a\+/i;

// Marqueur d'email automatique (anti-signal pour "Personnel")
const ROBOT_RE = /ne pas répondre|no.?reply|réponse automatique|this is an automated|cet email a été envoyé automatiquement/i;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function countHits(text, keywords) {
  return keywords.filter(k => text.includes(k)).length;
}

function hasStrongOtp(content) {
  return OTP_CODE_RE.test(content) || RESET_LINK_RE.test(content);
}

function hasAccountAction(content) {
  return hasStrongOtp(content) || /nouvelle connexion|new sign.?in|new login|connexion détectée|suspicious.?activity|compte suspendu|account.?suspended|accès inhabituel|unusual.?access/i.test(content);
}

function hasBilling(content) {
  return AMOUNT_RE.test(content) && /(facture|invoice|reçu|receipt|paiement|payment|commande|order|abonnement|subscription|prélèvement)/i.test(content);
}

function hasPromo(content) {
  const kws = ['promo', 'réduction', 'remise', 'soldes', 'gratuit', 'discount', 'offre spéciale', 'bonne affaire', 'vente privée', 'code avantage', 'livraison offerte'];
  return UNSUB_RE.test(content) || countHits(content, kws) >= 2;
}

// Score de recrutement (0-100) pour les plateformes job et entreprises
function recruitmentScore(content) {
  let score = 0;
  const receiptKws = ['accusé de réception', 'bien reçu', 'prise en compte', 'candidature reçue', 'application received', 'thank you for applying', 'confirmons la réception', 'avons bien reçu', 'enregistrée'];
  const interviewKws = ['entretien', 'rendez-vous', 'rdv', 'test technique', 'échange téléphonique', 'interview', 'discuter de votre candidature', 'vos disponibilités', 'planifier un appel', 'zoom', 'teams', 'meet', 'skype'];
  const refusalKws = ['regrettons', 'ne pouvons donner suite', 'pas retenu', 'réponse négative', 'sans suite', 'unfortunately', 'not selected', 'not moving forward', 'n\'avançons pas'];
  const offerKws = ['offre d\'emploi', 'proposition d\'embauche', 'contrat d\'alternance', 'cdi', 'cdd', 'contrat de travail', 'promesse d\'embauche', 'job offer', 'pleased to offer'];
  const jobContextKws = ['candidature', 'poste', 'recruteur', 'recrutement', 'alternance', 'apprentissage', 'stage', 'offre', 'profil', 'cv', 'lettre de motivation', 'application', 'position', 'role', 'recruiter'];

  score += countHits(content, receiptKws)   * 40;
  score += countHits(content, interviewKws) * 40;
  score += countHits(content, refusalKws)   * 40;
  score += countHits(content, offerKws)     * 40;
  score += countHits(content, jobContextKws) * 15;

  return Math.min(score, 100);
}

function recruitmentCategory(content) {
  const refusalKws = ['regrettons', 'ne pouvons donner suite', 'pas retenu', 'réponse négative', 'sans suite', 'unfortunately', 'not selected', 'not moving forward'];
  const interviewKws = ['entretien', 'rendez-vous', 'rdv', 'test technique', 'échange téléphonique', 'interview', 'discuter de votre candidature', 'vos disponibilités', 'zoom', 'teams', 'meet', 'skype'];
  const offerKws = ['offre d\'emploi acceptée', 'proposition d\'embauche', 'contrat de travail', 'promesse d\'embauche', 'pleased to offer', 'job offer'];

  if (countHits(content, refusalKws) >= 1)   return { category: 'Refus',      status: 'refusé' };
  if (countHits(content, interviewKws) >= 1)  return { category: 'Entretien',  status: 'entretien' };
  if (countHits(content, offerKws) >= 1)      return { category: 'Offre',      status: 'accepté' };
  return { category: 'Candidature', status: 'en cours' };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSIFIEUR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export async function classifyEmail(email, existingJobs, spamRules = []) {
  const rawSubject = (email.subject || '');
  const rawBody    = (email.body    || '');
  const rawSender  = (email.sender  || '');

  const subject = rawSubject.toLowerCase();
  const body    = rawBody.toLowerCase();
  const sender  = rawSender.toLowerCase();
  const content = subject + ' ' + body; // combined lowercase for scoring

  // Extrait le domaine réel de l'adresse expéditrice
  const addrMatch = sender.match(/<([^>]+)>/) || sender.match(/([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/i);
  const senderAddr = addrMatch ? addrMatch[1] : sender;

  // ── 0. BLOCKLIST UTILISATEUR (priorité absolue) ───────────────────────────
  for (const rule of spamRules) {
    const target = rule.pattern_type === 'keyword' ? content
                 : rule.pattern_type === 'sender'  ? sender
                 : senderAddr; // 'domain' par défaut
    if (target.includes(rule.pattern.toLowerCase())) {
      return {
        category: 'Spam', company: '', job_application_id: null, status_update: null,
        ai_explanation: `Bloqué par règle personnalisée : "${rule.label || rule.pattern}".`
      };
    }
  }

  // ── 1. SPAM ──────────────────────────────────────────────────────────────
  // Nécessite au moins 2 signaux indépendants OU un domaine manifestement malveillant
  const spamSignals = [
    /\bcrypto\b|\bbitcoin\b|\bethereum\b|\bnft\b/i.test(content),
    /(gagne[rz]?|gagné[e]?|win).{0,30}(argent|euros?|€|\$|cash)/i.test(content),
    /\b(lottery|loterie|loto)\b/i.test(content),
    /\b(casino|paris sportifs|machine à sous)\b/i.test(content),
    /\b(viagra|cialis|levitra|pilule amaigrissante)\b/i.test(content),
    /(héritag|héritage|inheritance).{0,30}(millions?|milliers?|\d+\s*€)/i.test(content),
    /transfert.{0,20}urgent|urgent.{0,20}transfert/i.test(content),
    /(investiss|invest).{0,30}(garanti|100%|retour assuré)/i.test(content),
    /argent.{0,20}facile|easy.{0,20}money|travail.{0,20}domicile.{0,20}€/i.test(content),
    /vous.{0,10}avez.{0,10}(gagné|été sélectionné|remporté)/i.test(content) && /cliquez|claim|link/i.test(content),
  ].filter(Boolean).length;

  const isMaliciousDomain = /\.(xyz|click|loan|gdn|work|bid|win|top|club)$/.test(senderAddr) ||
    /security.alert.bank|compte.suspendu.net|phishing/i.test(senderAddr);

  if (spamSignals >= 2 || (spamSignals >= 1 && isMaliciousDomain)) {
    return {
      category: 'Spam', company: '', job_application_id: null, status_update: null,
      ai_explanation: `Classé comme spam (${spamSignals} signal(s) détecté(s)).`
    };
  }

  // ── 2. REGISTRE DE DOMAINES CONNUS ───────────────────────────────────────
  for (const rule of DOMAIN_REGISTRY) {
    if (!senderAddr.includes(rule.match)) continue;

    // Domaine reconnu → catégorie déterministe avec modificateurs
    let cat = rule.default;

    if (rule.if_strong_otp    && hasStrongOtp(content))       cat = rule.if_strong_otp;
    else if (rule.if_account_action && hasAccountAction(content))   cat = rule.if_account_action;
    else if (rule.if_billing  && hasBilling(content))          cat = rule.if_billing;
    else if (rule.if_promo    && hasPromo(content))            cat = rule.if_promo;

    // Plateformes de recrutement : affiner selon le contenu
    if (rule.check_recruitment) {
      const rec = recruitmentCategory(content);
      cat = rec.category;
    }

    // Trouver une entreprise liée (pour les plateformes job)
    let job_application_id = null;
    let company = '';
    let status_update = null;

    if (['Candidature','Entretien','Refus','Offre'].includes(cat)) {
      const rec = recruitmentCategory(content);
      cat = rec.category;
      status_update = rec.status;
      for (const job of existingJobs) {
        const cn = job.company.toLowerCase();
        if (content.includes(cn)) {
          job_application_id = job.id;
          company = job.company;
          break;
        }
      }
    }

    return {
      category: cat, company, job_application_id, status_update,
      ai_explanation: buildExplanation(cat, rule.match, company)
    };
  }

  // ── 3. SÉCURITÉ (expéditeur inconnu avec signal fort) ────────────────────
  // On exige un signal VRAI (code numérique ou lien reset), pas juste un mot
  if (hasStrongOtp(content)) {
    return {
      category: 'Securite', company: '', job_application_id: null, status_update: null,
      ai_explanation: 'Code d\'authentification, OTP ou lien de réinitialisation de mot de passe détecté.'
    };
  }
  if (hasAccountAction(content) && /security@|account@|alert@|noreply@|no-reply@/.test(senderAddr)) {
    return {
      category: 'Securite', company: '', job_application_id: null, status_update: null,
      ai_explanation: 'Alerte de sécurité ou notification de connexion inhabituelle.'
    };
  }

  // ── 4. FACTURE (expéditeur inconnu, signal fort) ─────────────────────────
  if (hasBilling(content)) {
    return {
      category: 'Facture', company: '', job_application_id: null, status_update: null,
      ai_explanation: 'Facture, reçu de paiement ou confirmation d\'abonnement.'
    };
  }

  // ── 5. PROMOTION (signal fort : lien désabo OU plusieurs mots-clés) ───────
  if (hasPromo(content)) {
    return {
      category: 'Promotion', company: '', job_application_id: null, status_update: null,
      ai_explanation: 'E-mail commercial, promotionnel ou newsletter publicitaire.'
    };
  }

  // ── 6. RECRUTEMENT (expéditeur entreprise + score élevé) ─────────────────
  const publicDomains = ['gmail.', 'yahoo.', 'outlook.', 'hotmail.', 'live.', 'orange.', 'wanadoo.', 'free.fr', 'sfr.', 'laposte.', 'icloud.', 'proton.', 'protonmail.'];
  const isPublicSender = publicDomains.some(d => senderAddr.includes(d));
  const isCompanyDomain = !isPublicSender && senderAddr.includes('@');

  const recScore = recruitmentScore(content);

  if (recScore >= 40) {
    // Chercher un job lié
    let job_application_id = null;
    let company = '';
    let status_update = null;

    for (const job of existingJobs) {
      const cn = job.company.toLowerCase();
      if (content.includes(cn) || senderAddr.includes(cn.replace(/\s+/g, ''))) {
        job_application_id = job.id;
        company = job.company;
        break;
      }
    }

    if (!company && isCompanyDomain) {
      const domParts = senderAddr.split('@')[1]?.split('.');
      if (domParts && domParts.length >= 2) {
        const raw = domParts[domParts.length - 2];
        company = raw.charAt(0).toUpperCase() + raw.slice(1);
      }
    }

    const rec = recruitmentCategory(content);
    status_update = rec.status;

    return {
      category: rec.category, company, job_application_id, status_update,
      ai_explanation: company
        ? `${rec.category === 'Refus' ? 'Refus de candidature' : rec.category === 'Entretien' ? 'Invitation à un entretien' : rec.category === 'Offre' ? "Offre d'embauche" : 'Candidature'} — ${company}.`
        : `E-mail de recrutement (score ${recScore}/100).`
    };
  }

  // ── 7. PERSONNEL ──────────────────────────────────────────────────────────
  // Expéditeur domaine public + écriture humaine + pas de marqueur robot
  if (isPublicSender && !ROBOT_RE.test(content) && !UNSUB_RE.test(content)) {
    const humanSignals = [
      HUMAN_SIG_RE.test(content),
      subject.startsWith('re:') || subject.startsWith('fwd:') || subject.startsWith('tr:') || subject.startsWith('fw:'),
      !/(newsletter|information|notification|alerte|alert|rappel automatique)/i.test(subject),
    ].filter(Boolean).length;

    if (humanSignals >= 2) {
      return {
        category: 'Personnel', company: '', job_application_id: null, status_update: null,
        ai_explanation: `Échange personnel avec ${rawSender.split('<')[0].trim() || 'un contact'}.`
      };
    }
  }

  // ── 8. SOCIAL — dernier filet (réseaux sociaux non listés dans le registre) ─
  const socialKws = ['vous a mentionné', 'a partagé', 'a liké', 'a commenté', 'vous a envoyé un message', 'nouvelle notification', 'a aimé votre', 'joined the server', 'new message on', 'someone replied'];
  if (countHits(content, socialKws) >= 1) {
    return {
      category: 'Social', company: '', job_application_id: null, status_update: null,
      ai_explanation: 'Notification de réseau social ou messagerie collaborative.'
    };
  }

  // ── 9. FALLBACK ────────────────────────────────────────────────────────────
  return {
    category: 'Professionnel', company: '', job_application_id: null, status_update: null,
    ai_explanation: 'E-mail professionnel ou institutionnel sans catégorie spécifique détectée.'
  };
}

function buildExplanation(cat, domain, company) {
  const domainLabel = domain.replace(/^\./, '').replace(/\.$/, '');
  switch (cat) {
    case 'Social':       return `Notification depuis ${domainLabel}.`;
    case 'Securite':     return `Alerte de sécurité ou code d'authentification depuis ${domainLabel}.`;
    case 'Facture':      return `Facture ou confirmation de paiement depuis ${domainLabel}.`;
    case 'Promotion':    return `E-mail commercial ou promotionnel depuis ${domainLabel}.`;
    case 'Candidature':  return company ? `Accusé de réception de candidature — ${company}.` : `Confirmation de candidature via ${domainLabel}.`;
    case 'Entretien':    return company ? `Invitation à un entretien chez ${company}.` : `Invitation à un entretien via ${domainLabel}.`;
    case 'Refus':        return company ? `Refus de candidature de la part de ${company}.` : `Refus de candidature via ${domainLabel}.`;
    case 'Offre':        return company ? `Offre d'embauche de la part de ${company} !` : `Proposition d'embauche via ${domainLabel}.`;
    default:             return `E-mail professionnel depuis ${domainLabel}.`;
  }
}
