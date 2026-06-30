import React, { useState } from 'react';
import { Server, CheckCircle, AlertTriangle, Loader2, Plus, Edit2, Trash2, X, HardDrive, AlertCircle, ShieldOff, Brain, RefreshCw, Zap } from 'lucide-react';

export default function SettingsView({
  accounts, storageInfo, spamRules = [], aiStatus,
  onAddAccount, onUpdateAccount, onDeleteAccount, onTestAccount, onCleanup, onResetEmails,
  onAddSpamRule, onDeleteSpamRule, onUpdateAiConfig, onRefreshAiStatus
}) {
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    email: '', imap_host: '', imap_port: '993',
    imap_user: '', imap_password: '', imap_tls: 'true'
  });
  const [testStatus, setTestStatus] = useState({ loading: false, success: null, message: '' });
  const [saveError, setSaveError]   = useState('');
  const [cleanupCount, setCleanupCount] = useState(500);
  const [newRule, setNewRule] = useState({ pattern: '', pattern_type: 'domain', label: '' });
  const [ruleError, setRuleError] = useState('');

  const handleAddRule = async (e) => {
    e.preventDefault();
    setRuleError('');
    try {
      await onAddSpamRule(newRule);
      setNewRule({ pattern: '', pattern_type: 'domain', label: '' });
    } catch (err) {
      setRuleError(err.message);
    }
  };

  const TYPE_LABELS = { domain: 'Domaine', sender: 'Expéditeur', keyword: 'Mot-clé' };

  const MODELS = [
    { value: 'qwen2.5:1.5b', label: 'qwen2.5:1.5b — ~1 Go (rapide, recommandé)' },
    { value: 'qwen2.5:3b',   label: 'qwen2.5:3b   — ~2 Go (meilleure qualité)' },
    { value: 'phi3.5',       label: 'phi3.5        — ~2.2 Go (Microsoft, très bon en FR)' },
    { value: 'llama3.2:3b',  label: 'llama3.2:3b  — ~2 Go (Meta, polyvalent)' },
  ];

  const openAddModal = () => {
    setEditingAccount(null);
    setFormData({ email: '', imap_host: '', imap_port: '993', imap_user: '', imap_password: '', imap_tls: 'true' });
    setTestStatus({ loading: false, success: null, message: '' });
    setSaveError('');
    setIsModalOpen(true);
  };

  const openEditModal = (acc) => {
    setEditingAccount(acc);
    setFormData({ email: acc.email, imap_host: acc.imap_host, imap_port: acc.imap_port,
      imap_user: acc.imap_user, imap_password: '••••••••', imap_tls: acc.imap_tls });
    setTestStatus({ loading: false, success: null, message: '' });
    setSaveError('');
    setIsModalOpen(true);
  };

  const handleTest = async () => {
    setTestStatus({ loading: true, success: null, message: '' });
    try {
      const result = await onTestAccount({ ...formData, id: editingAccount?.id || null });
      if (result.success) {
        setTestStatus({ loading: false, success: true, message: 'Connexion IMAP réussie !' });
      } else {
        setTestStatus({ loading: false, success: false, message: result.error || 'Échec de la connexion.' });
      }
    } catch (err) {
      setTestStatus({ loading: false, success: false, message: err.message || 'Erreur lors du test.' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    try {
      if (editingAccount) await onUpdateAccount(editingAccount.id, formData);
      else await onAddAccount(formData);
      setIsModalOpen(false);
    } catch (err) {
      setSaveError(err.message || 'Une erreur est survenue.');
    }
  };

  const handleToggleActive = async (acc) => {
    try { await onUpdateAccount(acc.id, { is_active: !acc.is_active }); }
    catch (err) { alert(`Erreur : ${err.message}`); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('fr-FR') : 'Jamais synchronisé';

  const storagePct = storageInfo ? parseFloat(storageInfo.percent_used) : 0;
  const storageColor = storagePct >= 90 ? 'var(--cat-refus)' : storagePct >= 70 ? '#f5a623' : 'var(--accent-cyan)';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>

      {/* AI Section */}
      {aiStatus && (
        <div className="settings-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Brain size={20} style={{ color: 'var(--accent-purple)' }} />
              <h2 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Classification par IA locale
              </h2>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px',
                background: 'rgba(139,92,246,0.15)', color: 'var(--accent-purple)', border: '1px solid rgba(139,92,246,0.3)'
              }}>Ollama</span>
            </div>
            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
              onClick={onRefreshAiStatus} title="Rafraîchir le statut">
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Statut Ollama */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                background: aiStatus.running ? 'var(--accent-cyan)' : '#4b5563',
                boxShadow: aiStatus.running ? '0 0 8px var(--accent-cyan)' : 'none' }} />
              <span style={{ color: aiStatus.running ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                Ollama {aiStatus.running ? 'en cours' : 'non détecté'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                background: aiStatus.modelAvailable ? '#10b981' : '#4b5563',
                boxShadow: aiStatus.modelAvailable ? '0 0 8px #10b981' : 'none' }} />
              <span style={{ color: aiStatus.modelAvailable ? '#34d399' : 'var(--text-muted)' }}>
                Modèle {aiStatus.modelAvailable ? `disponible (${aiStatus.modelSize})` : 'non téléchargé'}
              </span>
            </div>
          </div>

          {/* Toggle + sélection modèle */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div className="switch-group" style={{ padding: 0, gap: '0.6rem' }}>
              <label className="switch" title={aiStatus.ai_enabled === 'true' ? 'IA activée' : 'IA désactivée'}>
                <input type="checkbox" checked={aiStatus.ai_enabled === 'true'}
                  onChange={e => onUpdateAiConfig({ ai_enabled: e.target.checked })} />
                <span className="slider" />
              </label>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                {aiStatus.ai_enabled === 'true' ? 'IA activée' : 'IA désactivée (règles uniquement)'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-control" style={{ fontSize: '0.82rem', padding: '0.4rem 0.5rem', flex: 1 }}
              value={aiStatus.ai_model || 'qwen2.5:1.5b'}
              onChange={e => onUpdateAiConfig({ ai_model: e.target.value })}>
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Installation instructions */}
          {!aiStatus.running && (
            <div className="alert-banner alert-info" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <Zap size={14} />
              <div style={{ fontSize: '0.8rem' }}>
                <strong>Ollama non détecté.</strong> Pour l'installer :{' '}
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                  curl -fsSL https://ollama.com/install.sh | sh
                </code>
              </div>
            </div>
          )}
          {aiStatus.running && !aiStatus.modelAvailable && (
            <div className="alert-banner alert-info" style={{ marginTop: '1rem', marginBottom: 0 }}>
              <Zap size={14} />
              <div style={{ fontSize: '0.8rem' }}>
                <strong>Modèle non téléchargé.</strong> Dans un terminal :{' '}
                <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                  ollama pull {aiStatus.ai_model || 'qwen2.5:1.5b'}
                </code>
                {' '}(~1 Go, à faire une seule fois)
              </div>
            </div>
          )}

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            <strong>Architecture hybride :</strong> LinkedIn/Discord/OTP sont traités instantanément par les règles certaines. L'IA prend les emails ambigus (entreprises, recrutement). Fallback automatique si Ollama est indisponible.
          </p>
        </div>
      )}

      {/* Storage Section */}
      {storageInfo && (
        <div className="settings-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <HardDrive size={20} style={{ color: storageColor }} />
            <h2 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Stockage des e-mails
            </h2>
            {storagePct >= 90 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--cat-refus)', fontSize: '0.8rem', fontWeight: 600 }}>
                <AlertCircle size={14} /> Stockage critique
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            <span>{storageInfo.email_count} e-mails stockés</span>
            <span style={{ color: storageColor, fontWeight: 600 }}>
              {storageInfo.used_gb} Go / 5 Go ({storagePct}%)
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{ width: `${Math.min(100, storagePct)}%`, height: '100%', background: storageColor, borderRadius: '4px', transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Garder les</span>
            <input type="number" min="50" max="9999" value={cleanupCount}
              onChange={e => setCleanupCount(parseInt(e.target.value, 10) || 500)}
              className="form-control"
              style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.82rem' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>e-mails les plus récents et supprimer les autres</span>
            <button className="btn btn-danger" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              onClick={() => {
                if (window.confirm(`Supprimer tous les e-mails sauf les ${cleanupCount} plus récents ?`)) {
                  onCleanup(cleanupCount);
                }
              }}>
              <Trash2 size={13} /> Nettoyer
            </button>
          </div>

          {storageInfo.oldest_email_date && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
              E-mail le plus ancien : {formatDate(storageInfo.oldest_email_date)}
            </p>
          )}

          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-danger" style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
              onClick={() => {
                if (window.confirm(`Supprimer TOUS les ${storageInfo.email_count} e-mails stockés ? Cette action est irréversible. Les comptes et candidatures ne seront pas affectés.`)) {
                  onResetEmails();
                }
              }}>
              <Trash2 size={13} /> Vider tous les e-mails
            </button>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
              Supprime tous les e-mails locaux. Les comptes IMAP et candidatures sont conservés.
            </span>
          </div>
        </div>
      )}

      {/* Spam Rules Section */}
      <div className="settings-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <ShieldOff size={20} style={{ color: 'var(--cat-spam)' }} />
          <h2 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            Règles de spam personnalisées
          </h2>
        </div>

        {/* Add rule form */}
        <form onSubmit={handleAddRule} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 180px' }}>
            <label style={{ fontSize: '0.75rem' }}>Type</label>
            <select className="form-control" style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
              value={newRule.pattern_type} onChange={e => setNewRule({ ...newRule, pattern_type: e.target.value })}>
              <option value="domain">Domaine (ex: mym.fans)</option>
              <option value="sender">Expéditeur exact (ex: promo@site.com)</option>
              <option value="keyword">Mot-clé dans le contenu</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: '2 1 200px' }}>
            <label style={{ fontSize: '0.75rem' }}>Pattern *</label>
            <input required className="form-control" style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
              placeholder={newRule.pattern_type === 'domain' ? 'ex: mym.fans' : newRule.pattern_type === 'sender' ? 'ex: promo@exemple.com' : 'ex: casino'}
              value={newRule.pattern} onChange={e => setNewRule({ ...newRule, pattern: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 120px' }}>
            <label style={{ fontSize: '0.75rem' }}>Label (optionnel)</label>
            <input className="form-control" style={{ padding: '0.4rem 0.5rem', fontSize: '0.82rem' }}
              placeholder="ex: MYM"
              value={newRule.label} onChange={e => setNewRule({ ...newRule, label: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-danger" style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            <Plus size={14} /> Bloquer
          </button>
        </form>

        {ruleError && (
          <div className="alert-banner alert-error" style={{ marginBottom: '0.75rem' }}>
            <AlertTriangle size={14} /><span style={{ fontSize: '0.8rem' }}>{ruleError}</span>
          </div>
        )}

        {/* Rules list */}
        {spamRules.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aucune règle personnalisée. Les domaines bloqués par défaut (MYM, OnlyFans…) sont gérés par le classifieur.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {spamRules.map(rule => (
              <div key={rule.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.15)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className="badge badge-spam" style={{ fontSize: '0.65rem' }}>{TYPE_LABELS[rule.pattern_type] || rule.pattern_type}</span>
                  <code style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{rule.pattern}</code>
                  {rule.label && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>— {rule.label}</span>}
                </div>
                <button className="btn btn-secondary btn-icon" style={{ padding: '0.25rem 0.4rem' }}
                  title="Supprimer cette règle" onClick={() => onDeleteSpamRule(rule.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Ces règles s'appliquent à la prochaine synchronisation et au bouton "Re-classer". Les types <strong>Domaine</strong> et <strong>Expéditeur</strong> vérifient l'adresse e-mail, <strong>Mot-clé</strong> vérifie sujet + corps.
        </p>
      </div>

      {/* Accounts Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
          Comptes Messagerie (IMAP)
        </h2>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Ajouter une adresse
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {accounts.length === 0 ? (
          <div className="settings-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Server size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Aucune adresse e-mail n'est configurée.
            </p>
            <button className="btn btn-primary" onClick={openAddModal}><Plus size={16} /> Configurer une adresse</button>
          </div>
        ) : accounts.map(acc => (
          <div key={acc.id} className="settings-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px',
                  background: acc.is_active ? 'rgba(0,242,254,0.1)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: acc.is_active ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  border: '1px solid ' + (acc.is_active ? 'rgba(0,242,254,0.2)' : 'var(--border)')
                }}>
                  <Server size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{acc.email}</h3>
                    {acc.is_alias_of && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '4px', background: 'rgba(139,92,246,0.15)', color: '#c084fc', border: '1px solid rgba(139,92,246,0.3)', whiteSpace: 'nowrap' }}>
                        Alias → {acc.primary_email}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {acc.is_alias_of
                      ? 'Sync via le compte principal — pas de connexion IMAP distincte'
                      : `${acc.imap_host}:${acc.imap_port} • TLS : ${acc.imap_tls === 'true' ? 'Oui' : 'Non'}`}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Dernière sync</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {formatDate(acc.last_sync)}
                  </span>
                </div>
                {!acc.is_alias_of && (
                  <div className="switch-group" style={{ padding: 0 }}>
                    <label className="switch" title={acc.is_active ? 'Compte actif' : 'Compte inactif'}>
                      <input type="checkbox" checked={acc.is_active === 1} onChange={() => handleToggleActive(acc)} />
                      <span className="slider" />
                    </label>
                  </div>
                )}
                <div className="table-actions">
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
                    onClick={() => openEditModal(acc)}><Edit2 size={12} /> Modifier</button>
                  <button className="btn btn-danger btn-icon" title="Supprimer le compte"
                    onClick={() => onDeleteAccount(acc.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ProtonMail Bridge help */}
      <div className="settings-card" style={{ padding: '1.25rem', marginTop: '1.5rem', borderColor: 'rgba(0,242,254,0.15)' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-cyan)' }}>
          Connexion ProtonMail
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          ProtonMail nécessite <strong>ProtonMail Bridge</strong> (application locale) pour accéder à vos mails via IMAP.
          Une fois Bridge lancé : <strong>Hôte</strong> : 127.0.0.1 • <strong>Port</strong> : 1143 • <strong>TLS</strong> : Non •
          <strong> Mot de passe</strong> : celui généré par Bridge (pas votre mot de passe ProtonMail web).
        </p>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingAccount ? "Modifier l'adresse mail" : 'Ajouter une adresse mail'}</h3>
              <button className="table-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Adresse e-mail *</label>
                  <input type="email" required className="form-control" placeholder="Ex: clement.noel@gmail.com"
                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Serveur IMAP *</label>
                  <input type="text" required className="form-control"
                    placeholder="Ex: imap.gmail.com ou 127.0.0.1 (Bridge)"
                    value={formData.imap_host} onChange={e => setFormData({ ...formData, imap_host: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Port IMAP *</label>
                    <input type="text" required className="form-control" placeholder="993"
                      value={formData.imap_port} onChange={e => setFormData({ ...formData, imap_port: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Sécurité (TLS/SSL)</label>
                    <select className="form-control" value={formData.imap_tls}
                      onChange={e => setFormData({ ...formData, imap_tls: e.target.value })}>
                      <option value="true">Activé (SSL/TLS — port 993)</option>
                      <option value="false">Désactivé (port 143 / Bridge 1143)</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Nom d'utilisateur *</label>
                  <input type="text" required className="form-control"
                    placeholder="Généralement l'adresse e-mail"
                    value={formData.imap_user} onChange={e => setFormData({ ...formData, imap_user: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Mot de passe / Clé d'application *</label>
                  <input type="password" required className="form-control"
                    placeholder={editingAccount ? '••••••••' : 'Mot de passe'}
                    value={formData.imap_password} onChange={e => setFormData({ ...formData, imap_password: e.target.value })} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Gmail : utilisez un "Mot de passe d'application". ProtonMail : utilisez le mot de passe Bridge.
                  </span>
                </div>
                {testStatus.message && (
                  <div className={`alert-banner ${testStatus.success ? 'alert-success' : 'alert-error'}`} style={{ margin: '0.5rem 0' }}>
                    {testStatus.success ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                    <span style={{ fontSize: '0.8rem' }}>{testStatus.message}</span>
                  </div>
                )}
                {saveError && (
                  <div className="alert-banner alert-error" style={{ margin: '0.5rem 0' }}>
                    <AlertTriangle size={14} />
                    <span style={{ fontSize: '0.8rem' }}>{saveError}</span>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary" disabled={testStatus.loading} onClick={handleTest}>
                  {testStatus.loading ? <Loader2 size={14} className="spin" /> : null} Tester Connexion
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary">Enregistrer</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
