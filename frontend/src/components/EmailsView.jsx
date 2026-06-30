import React, { useState, useRef, useEffect } from 'react';
import { Mail, Search, Sparkles, Eye, EyeOff, Link as LinkIcon, Inbox,
  Trash2, X, ChevronDown, ChevronUp, Tag, AtSign, Calendar, Clock } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#3b82f6','#8b5cf6','#ec4899','#10b981',
  '#f59e0b','#ef4444','#0ea5e9','#6366f1','#14b8a6','#f97316'
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function getAvatarColor(sender) {
  return AVATAR_COLORS[hashStr(sender) % AVATAR_COLORS.length];
}

function getInitials(sender) {
  const name = sender.replace(/<.*>/, '').trim().replace(/"/g, '');
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase() || '?';
}

function getSenderName(sender) {
  const match = sender.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  const addr = sender.match(/<([^>]+)>/);
  if (addr) return addr[1].split('@')[0];
  return sender.split('@')[0];
}

function getSenderEmail(sender) {
  const match = sender.match(/<([^>]+)>/);
  return match ? match[1] : sender;
}

function isHtml(body) {
  return /<\s*(html|body|div|p|br|span|table|a)\b/i.test(body);
}

function formatDateShort(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isThisYear = d.getFullYear() === now.getFullYear();
    if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (isThisYear) return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return dateStr; }
}

function formatDateFull(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateStr; }
}

// ── Category config ───────────────────────────────────────────────────────────
const FOLDERS = [
  { id: 'all',          label: 'Tout',            icon: '📬', color: null,                     isAll: true },
  { id: 'Candidature',  label: 'Candidatures',    icon: '📋', color: 'var(--cat-candidature)' },
  { id: 'Entretien',    label: 'Entretiens',       icon: '🤝', color: 'var(--cat-entretien)' },
  { id: 'Refus',        label: 'Refus',            icon: '❌', color: 'var(--cat-refus)' },
  { id: 'Offre',        label: 'Offres',           icon: '🎉', color: 'var(--cat-offre)' },
  { id: 'Personnel',    label: 'Personnel',        icon: '👤', color: 'var(--cat-personnel)' },
  { id: 'Professionnel',label: 'Pro',              icon: '💼', color: 'var(--cat-professionnel)' },
  { id: 'Facture',      label: 'Factures',         icon: '🧾', color: 'var(--cat-facture)' },
  { id: 'Securite',     label: 'Sécurité',         icon: '🔐', color: 'var(--cat-securite)' },
  { id: 'Promotion',    label: 'Promotions',       icon: '🏷️', color: 'var(--cat-promotion)' },
  { id: 'Social',       label: 'Social',           icon: '💬', color: 'var(--cat-social)' },
  { id: 'Spam',         label: 'Spam',             icon: '🚫', color: 'var(--cat-spam)' },
];

// ── Sanitiseur HTML ───────────────────────────────────────────────────────────
function sanitizeEmailHtml(html) {
  // Supprimer les scripts
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Supprimer les handlers inline
  html = html.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/g, '');
  // Supprimer les traqueurs pixels (images 1×1 ou masquées)
  html = html.replace(/<img\b(?=[^>]*(?:width=["']?1["']?|height=["']?1["']?))[^>]*>/gi, '');
  html = html.replace(/<img\b(?=[^>]*style=["'][^"']*display\s*:\s*none)[^>]*>/gi, '');
  // Ajouter target="_blank" sur les liens pour ouverture externe (via setWindowOpenHandler Electron)
  html = html.replace(/<a\b([^>]*)>/gi, (_, attrs) => {
    attrs = attrs.replace(/\s+target=["'][^"']*["']/gi, '');
    return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
  });
  // Rendre les images responsive
  html = html.replace(/<img\b([^>]*)>/gi, (_, attrs) => {
    attrs = attrs.replace(/\s+width=["']\d+%?["']/gi, '').replace(/\s+height=["']\d+%?["']/gi, '');
    return `<img${attrs} style="max-width:100%;height:auto;display:block">`;
  });
  return html;
}

// ── Sandboxed HTML renderer ───────────────────────────────────────────────────
function HtmlEmailFrame({ html }) {
  const ref = useRef(null);
  const clean = sanitizeEmailHtml(html);

  const doc = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; font-src https:;">
<style>
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.65; color: #d1d9e6; word-break: break-word; background: transparent; }
  a { color: #00f2fe; text-decoration: underline; text-decoration-color: rgba(0,242,254,0.35); }
  a:hover { text-decoration-color: #00f2fe; }
  img { max-width: 100% !important; height: auto !important; display: block; border-radius: 4px; }
  table { max-width: 100% !important; border-collapse: collapse; width: 100% !important; }
  td, th { padding: 6px 8px; vertical-align: top; word-break: break-word; }
  blockquote { border-left: 3px solid rgba(0,242,254,0.3); padding-left: 1rem; color: #64748b; margin: 0.75rem 0; font-style: italic; }
  pre, code { background: rgba(0,0,0,0.35); padding: 0.2em 0.5em; border-radius: 4px; font-size: 0.88em; font-family: monospace; }
  pre { padding: 1rem; overflow-x: auto; white-space: pre-wrap; }
  hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1rem 0; }
  h1,h2,h3,h4,h5,h6 { color: #e2e8f0; line-height: 1.3; }
  p { margin: 0.4rem 0; }
  div[style*="background-color"] { background-color: transparent !important; }
  div[style*="background:"] { background: transparent !important; }
  .ExternalClass, .ReadMsgBody { width: 100%; }
</style>
</head><body>${clean}</body></html>`;

  useEffect(() => {
    if (!ref.current) return;
    const frame = ref.current;
    const resize = () => {
      try {
        const h = frame.contentDocument?.documentElement?.scrollHeight || frame.contentDocument?.body?.scrollHeight;
        if (h && h > 50) frame.style.height = (h + 16) + 'px';
      } catch {}
    };
    frame.addEventListener('load', resize);
    const t = setTimeout(resize, 600);
    return () => { frame.removeEventListener('load', resize); clearTimeout(t); };
  }, [html]);

  return (
    <iframe ref={ref} srcDoc={doc} sandbox="allow-same-origin allow-popups"
      style={{ width: '100%', border: 'none', minHeight: '100px', background: 'transparent', display: 'block' }}
      title="email-body" />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EmailsView({
  emails, jobs, accounts, selectedEmail,
  onSelectEmail, onUpdateCategory, onLinkToJob, onToggleRead, onDeleteEmail,
  searchQuery, setSearchQuery
}) {
  const [activeFolder, setActiveFolder]         = useState('all');
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [deleteModal, setDeleteModal]           = useState(null);
  const [aiExpanded, setAiExpanded]             = useState(false);

  // Reset AI panel when switching emails
  useEffect(() => { setAiExpanded(false); }, [selectedEmail?.id]);

  // Pour filtrer par compte, on vérifie account_id ET recipient (pour les alias)
  const selectedAccount = selectedAccountId !== 'all'
    ? accounts.find(a => a.id === parseInt(selectedAccountId, 10))
    : null;

  const matchesAccountFilter = (email) => {
    if (selectedAccountId === 'all') return true;
    if (email.account_id === parseInt(selectedAccountId, 10)) return true;
    // Alias : email arrivé via le compte principal mais destiné à l'alias
    if (selectedAccount && email.recipient) {
      const recipLower = email.recipient.toLowerCase();
      if (recipLower.includes(selectedAccount.email.toLowerCase())) return true;
    }
    return false;
  };

  const counts = { all: 0 };
  FOLDERS.forEach(f => { if (!f.isAll) counts[f.id] = 0; });
  emails.forEach(email => {
    if (email.category === 'Spam') return; // Spam exclu du comptage global
    const ok = matchesAccountFilter(email);
    if (ok) { counts.all++; if (counts[email.category] !== undefined) counts[email.category]++; }
  });

  const filteredEmails = emails.filter(email => {
    const matchesAccount = matchesAccountFilter(email);
    // Spam : caché de "Tous les e-mails", visible uniquement via le dossier Spam
    const matchesFolder = activeFolder === 'Spam'
      ? email.category === 'Spam'
      : activeFolder === 'all'
        ? email.category !== 'Spam'
        : email.category === activeFolder;
    const sl = searchQuery.toLowerCase();
    const matchesSearch = !sl || email.subject.toLowerCase().includes(sl) ||
      email.body.toLowerCase().includes(sl) || email.sender.toLowerCase().includes(sl);
    return matchesAccount && matchesFolder && matchesSearch;
  });

  const openDeleteModal = (e, email) => {
    e.stopPropagation();
    setDeleteModal({ id: email.id, subject: email.subject });
  };

  const confirmDelete = (serverSide) => {
    if (deleteModal) { onDeleteEmail(deleteModal.id, serverSide); setDeleteModal(null); }
  };

  const currentFolder = FOLDERS.find(f => f.id === activeFolder);

  return (
    <div className="email-view-container">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="ev-sidebar">
        {/* Account filter */}
        <div className="ev-account-filter">
          <div className="ev-label">Compte</div>
          <select className="ev-select"
            value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
            <option value="all">Tous</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.email.split('@')[0]}
              </option>
            ))}
          </select>
        </div>

        {/* Folders */}
        <nav className="ev-folders">
          {FOLDERS.map(folder => (
            <button key={folder.id}
              className={`ev-folder-btn${activeFolder === folder.id ? ' active' : ''}`}
              onClick={() => setActiveFolder(folder.id)}>
              <span className="ev-folder-icon">{folder.icon}</span>
              <span className="ev-folder-label">{folder.label}</span>
              {counts[folder.id] > 0 && (
                <span className={`ev-folder-count${activeFolder === folder.id ? ' active' : ''}`}>
                  {counts[folder.id]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Email List ────────────────────────────────────────────────── */}
      <div className="ev-list-pane">
        {/* Search + header */}
        <div className="ev-list-header">
          <div className="ev-search-wrap">
            <Search size={14} className="ev-search-icon" />
            <input className="ev-search-input" placeholder="Rechercher…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="ev-list-meta">
            <span className="ev-folder-title">{currentFolder?.label}</span>
            <span className="ev-count-chip">{filteredEmails.length}</span>
          </div>
        </div>

        {/* Email rows */}
        <div className="ev-list-scroll">
          {filteredEmails.length === 0 ? (
            <div className="ev-empty">
              <Mail size={32} opacity={0.2} />
              <span>Aucun e-mail ici</span>
            </div>
          ) : filteredEmails.map(email => {
            const name  = getSenderName(email.sender);
            const color = getAvatarColor(email.sender);
            const isSelected = selectedEmail?.id === email.id;
            const isUnread   = !email.is_read;

            return (
              <div key={email.id}
                className={`ev-row${isSelected ? ' selected' : ''}${isUnread ? ' unread' : ''}`}
                onClick={() => onSelectEmail(email)}>

                {/* Avatar */}
                <div className="ev-avatar" style={{ background: color }}>
                  {getInitials(email.sender)}
                </div>

                {/* Content */}
                <div className="ev-row-body">
                  <div className="ev-row-top">
                    <span className="ev-row-from">{name}</span>
                    <div className="ev-row-right">
                      <span className="ev-row-date">{formatDateShort(email.date)}</span>
                      <button className="ev-del-btn" title="Supprimer"
                        onClick={e => openDeleteModal(e, email)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="ev-row-subject">{email.subject}</div>
                  <div className="ev-row-preview">
                    {email.body.replace(/<[^>]*>/g, '').substring(0, 90).trim()}
                  </div>
                  <div className="ev-row-footer">
                    {email.account_email && (
                      <span className="ev-account-tag">
                        <Inbox size={9} /> {email.account_email.split('@')[0]}
                      </span>
                    )}
                    <span className={`ev-cat-dot cat-${email.category.toLowerCase()}`}
                      title={email.category} />
                    {email.job_company && (
                      <span className="ev-job-tag">
                        <LinkIcon size={9} /> {email.job_company}
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread bar */}
                {isUnread && <div className="ev-unread-bar" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Reader Pane ───────────────────────────────────────────────── */}
      <div className="ev-reader">
        {selectedEmail ? (
          <>
            {/* Header */}
            <div className="ev-reader-header">
              <div className="ev-reader-avatar"
                style={{ background: getAvatarColor(selectedEmail.sender) }}>
                {getInitials(selectedEmail.sender)}
              </div>

              <div className="ev-reader-meta">
                <h2 className="ev-reader-subject">{selectedEmail.subject}</h2>
                <div className="ev-reader-from">
                  <AtSign size={12} />
                  <strong>{getSenderName(selectedEmail.sender)}</strong>
                  <span className="ev-reader-email-addr">&lt;{getSenderEmail(selectedEmail.sender)}&gt;</span>
                </div>
                <div className="ev-reader-to">
                  <span>→</span>
                  <span>{selectedEmail.recipient || selectedEmail.account_email}</span>
                </div>
                <div className="ev-reader-date">
                  <Clock size={11} />
                  {formatDateFull(selectedEmail.date)}
                </div>
              </div>

              {/* Action toolbar */}
              <div className="ev-reader-toolbar">
                <button className="ev-tool-btn" title={selectedEmail.is_read ? 'Marquer non lu' : 'Marquer lu'}
                  onClick={() => onToggleRead(selectedEmail.id, !selectedEmail.is_read)}>
                  {selectedEmail.is_read ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button className="ev-tool-btn danger" title="Supprimer"
                  onClick={() => setDeleteModal({ id: selectedEmail.id, subject: selectedEmail.subject })}>
                  <Trash2 size={15} />
                </button>
                <select className="ev-cat-select"
                  value={selectedEmail.category}
                  onChange={e => onUpdateCategory(selectedEmail.id, e.target.value)}>
                  {FOLDERS.filter(f => !f.isAll).map(f => (
                    <option key={f.id} value={f.id}>{f.icon} {f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* AI + Job strip */}
            <div className="ev-meta-strip">
              {/* Category badge */}
              <span className={`badge badge-${selectedEmail.category.toLowerCase()}`}
                style={{ fontSize: '0.7rem' }}>
                {FOLDERS.find(f => f.id === selectedEmail.category)?.icon} {selectedEmail.category}
              </span>

              {/* AI explanation (collapsible) */}
              {selectedEmail.ai_explanation && (
                <button className="ev-ai-toggle" onClick={() => setAiExpanded(v => !v)}>
                  <Sparkles size={11} style={{ color: '#c084fc' }} />
                  <span>Analyse IA</span>
                  {aiExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              )}

              <div style={{ flex: 1 }} />

              {/* Link to job */}
              <div className="ev-job-link">
                <Tag size={11} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                <select className="ev-job-select"
                  value={selectedEmail.job_application_id || ''}
                  onChange={e => onLinkToJob(selectedEmail.id, e.target.value ? parseInt(e.target.value, 10) : null)}>
                  <option value="">Lier à une candidature…</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.company} — {job.position}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* AI explanation panel */}
            {aiExpanded && selectedEmail.ai_explanation && (
              <div className="ev-ai-panel">
                <p>{selectedEmail.ai_explanation}</p>
              </div>
            )}

            {/* Email body */}
            <div className="ev-body-scroll">
              <div className="ev-body-inner">
                {isHtml(selectedEmail.body)
                  ? <HtmlEmailFrame html={selectedEmail.body} />
                  : <pre className="ev-plain-text">{selectedEmail.body}</pre>
                }
              </div>
            </div>
          </>
        ) : (
          <div className="ev-placeholder">
            <div className="ev-placeholder-icon"><Mail size={40} /></div>
            <p className="ev-placeholder-text">Sélectionnez un e-mail</p>
            <p className="ev-placeholder-sub">{filteredEmails.length} e-mail{filteredEmails.length !== 1 ? 's' : ''} dans cette vue</p>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteModal && (
        <div className="modal-overlay" style={{ zIndex: 1500 }}>
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Supprimer cet e-mail</h3>
              <button className="table-btn" onClick={() => setDeleteModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                « {deleteModal.subject.substring(0, 55)}{deleteModal.subject.length > 55 ? '…' : ''} »
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Supprimer uniquement dans Aether Mail, ou aussi sur le serveur IMAP ?
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Annuler</button>
              <button className="btn btn-outline-cyan" onClick={() => confirmDelete(false)}>Localement</button>
              <button className="btn btn-danger" onClick={() => confirmDelete(true)}>
                <Trash2 size={13} /> Local + Serveur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
