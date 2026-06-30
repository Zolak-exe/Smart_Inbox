import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Briefcase, Settings as SettingsIcon, RefreshCw, Sparkles, CheckCircle2, AlertCircle, Wand2 } from 'lucide-react';
import { emailsAPI, jobsAPI, accountsAPI, spamRulesAPI, aiAPI } from './utils/api';
import EmailsView from './components/EmailsView';
import JobsView from './components/JobsView';
import SettingsView from './components/SettingsView';
import './App.css';

const STORAGE_WARN_PERCENT = 90; // show warning above 90%

export default function App() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [emails, setEmails]       = useState([]);
  const [jobs, setJobs]           = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [isSyncing, setIsSyncing]           = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [storageInfo, setStorageInfo]     = useState(null);
  const [spamRules, setSpamRules]         = useState([]);
  const [aiStatus, setAiStatus]           = useState(null);
  const [showStorageWarn, setShowStorageWarn] = useState(false);
  const [notification, setNotification]   = useState({ show: false, type: 'info', message: '' });

  const showNotification = useCallback((type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [emailsData, jobsData, accountsData, storage, rules, ai] = await Promise.all([
        emailsAPI.getAll(),
        jobsAPI.getAll(),
        accountsAPI.getAll(),
        emailsAPI.getStorage(),
        spamRulesAPI.getAll(),
        aiAPI.getStatus()
      ]);
      setEmails(emailsData);
      setJobs(jobsData);
      setAccounts(accountsData);
      setStorageInfo(storage);
      setSpamRules(rules);
      setAiStatus(ai);
      if (parseFloat(storage.percent_used) >= STORAGE_WARN_PERCENT) {
        setShowStorageWarn(true);
      }
    } catch (err) {
      showNotification('error', `Erreur de chargement: ${err.message}`);
    }
  }, [showNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Reclassify ───────────────────────────────────────────────────────────
  const handleReclassify = async () => {
    setIsReclassifying(true);
    showNotification('info', 'Re-classification en cours...');
    try {
      const res = await emailsAPI.reclassify();
      const updatedEmails = await emailsAPI.getAll();
      setEmails(updatedEmails);
      if (selectedEmail) {
        const refreshed = updatedEmails.find(e => e.id === selectedEmail.id);
        if (refreshed) setSelectedEmail(refreshed);
      }
      showNotification('success', `${res.updated} e-mail(s) re-classifiés avec succès.`);
    } catch (err) {
      showNotification('error', `Erreur : ${err.message}`);
    } finally {
      setIsReclassifying(false);
    }
  };

  // ── Sync ─────────────────────────────────────────────────────────────────
  const handleSync = async (mode = 'auto') => {
    setIsSyncing(true);
    showNotification('info', mode === 'real'
      ? 'Connexion aux serveurs de messagerie...'
      : 'Génération des e-mails fictifs...');
    try {
      const res = await emailsAPI.sync(mode);
      const [updatedEmails, updatedJobs, updatedAccounts, storage] = await Promise.all([
        emailsAPI.getAll(), jobsAPI.getAll(), accountsAPI.getAll(), emailsAPI.getStorage()
      ]);
      setEmails(updatedEmails);
      setJobs(updatedJobs);
      setAccounts(updatedAccounts);
      setStorageInfo(storage);
      if (parseFloat(storage.percent_used) >= STORAGE_WARN_PERCENT) setShowStorageWarn(true);

      const newCount = res.newEmailsCount || 0;
      showNotification('success', newCount > 0
        ? `${newCount} nouveau(x) e-mail(s) récupéré(s) et trié(s) automatiquement !`
        : 'Synchronisation terminée. Aucun nouvel e-mail.');
    } catch (err) {
      showNotification('error', err.message || 'La synchronisation a échoué.');
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Email actions ─────────────────────────────────────────────────────────
  const handleSelectEmail = async (email) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      try {
        await emailsAPI.markAsRead(email.id, true);
        setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_read: 1 } : e));
      } catch {}
    }
  };

  const handleToggleRead = async (id, isRead) => {
    try {
      await emailsAPI.markAsRead(id, isRead);
      setEmails(prev => prev.map(e => e.id === id ? { ...e, is_read: isRead ? 1 : 0 } : e));
      if (selectedEmail?.id === id) setSelectedEmail(prev => ({ ...prev, is_read: isRead ? 1 : 0 }));
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
    }
  };

  const handleUpdateCategory = async (id, category) => {
    try {
      await emailsAPI.updateCategory(id, category);
      setEmails(prev => prev.map(e => e.id === id ? { ...e, category } : e));
      if (selectedEmail?.id === id) setSelectedEmail(prev => ({ ...prev, category }));
      showNotification('success', 'Catégorie mise à jour.');
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
    }
  };

  const handleLinkToJob = async (id, jobId) => {
    try {
      await emailsAPI.linkToJob(id, jobId);
      const [updatedEmails, updatedJobs] = await Promise.all([emailsAPI.getAll(), jobsAPI.getAll()]);
      setEmails(updatedEmails);
      setJobs(updatedJobs);
      if (selectedEmail?.id === id) {
        const linkedJob = updatedJobs.find(j => j.id === jobId);
        setSelectedEmail({ ...selectedEmail, job_application_id: jobId,
          job_company: linkedJob?.company || null, job_position: linkedJob?.position || null });
      }
      showNotification('success', 'Liaison de candidature mise à jour.');
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
    }
  };

  const handleDeleteEmail = async (id, serverSide) => {
    try {
      const res = await emailsAPI.delete(id, serverSide);
      setEmails(prev => prev.filter(e => e.id !== id));
      if (selectedEmail?.id === id) setSelectedEmail(null);
      const storage = await emailsAPI.getStorage();
      setStorageInfo(storage);
      if (res.serverError) {
        showNotification('error', `Supprimé localement, mais erreur serveur : ${res.serverError}`);
      } else {
        showNotification('success', serverSide
          ? 'E-mail supprimé localement et sur le serveur.'
          : 'E-mail supprimé localement.');
      }
    } catch (err) {
      showNotification('error', `Erreur de suppression : ${err.message}`);
    }
  };

  // ── Reset all emails ─────────────────────────────────────────────────────
  const handleResetEmails = async () => {
    try {
      const res = await emailsAPI.resetAll();
      setEmails([]);
      setSelectedEmail(null);
      const storage = await emailsAPI.getStorage();
      setStorageInfo(storage);
      showNotification('success', `Base de mails réinitialisée (${res.deleted} e-mail(s) supprimés).`);
    } catch (err) {
      showNotification('error', `Erreur : ${err.message}`);
    }
  };

  // ── Storage cleanup ───────────────────────────────────────────────────────
  const handleCleanup = async (keepCount) => {
    try {
      const res = await emailsAPI.cleanup(keepCount);
      showNotification('success', `${res.deleted} e-mail(s) ancien(s) supprimé(s).`);
      const [updatedEmails, storage] = await Promise.all([emailsAPI.getAll(), emailsAPI.getStorage()]);
      setEmails(updatedEmails);
      setStorageInfo(storage);
      if (selectedEmail && !updatedEmails.find(e => e.id === selectedEmail.id)) setSelectedEmail(null);
      setShowStorageWarn(parseFloat(storage.percent_used) >= STORAGE_WARN_PERCENT);
    } catch (err) {
      showNotification('error', `Erreur de nettoyage : ${err.message}`);
    }
  };

  // ── Job actions ───────────────────────────────────────────────────────────
  const handleCreateJob = async (jobData) => {
    try {
      const newJob = await jobsAPI.create(jobData);
      setJobs(prev => [newJob, ...prev]);
      showNotification('success', `Candidature chez ${newJob.company} ajoutée.`);
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
    }
  };

  const handleUpdateJob = async (id, jobData) => {
    try {
      const updatedJob = await jobsAPI.update(id, jobData);
      setJobs(prev => prev.map(j => j.id === id ? updatedJob : j));
      showNotification('success', `Candidature chez ${updatedJob.company} mise à jour.`);
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
    }
  };

  const handleDeleteJob = async (id) => {
    if (!window.confirm('Supprimer cette candidature ? Les e-mails liés seront conservés.')) return;
    try {
      await jobsAPI.delete(id);
      setJobs(prev => prev.filter(j => j.id !== id));
      setEmails(await emailsAPI.getAll());
      if (selectedEmail?.job_application_id === id) {
        setSelectedEmail(prev => ({ ...prev, job_application_id: null, job_company: null, job_position: null }));
      }
      showNotification('success', 'Candidature supprimée.');
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
    }
  };

  const handleViewEmail = (email) => {
    handleSelectEmail(email);
    setActiveTab('inbox');
  };

  // ── AI config ─────────────────────────────────────────────────────────────
  const handleUpdateAiConfig = async (data) => {
    await aiAPI.updateConfig(data);
    const updated = await aiAPI.getStatus();
    setAiStatus(updated);
  };

  const handleRefreshAiStatus = async () => {
    const updated = await aiAPI.getStatus();
    setAiStatus(updated);
  };

  // ── Spam rules ────────────────────────────────────────────────────────────
  const handleAddSpamRule = async (data) => {
    try {
      const rule = await spamRulesAPI.create(data);
      setSpamRules(prev => [rule, ...prev]);
      showNotification('success', `Règle ajoutée : "${data.pattern}"`);
    } catch (err) {
      showNotification('error', err.message);
      throw err;
    }
  };

  const handleDeleteSpamRule = async (id) => {
    try {
      await spamRulesAPI.delete(id);
      setSpamRules(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      showNotification('error', err.message);
    }
  };

  // ── Account actions ───────────────────────────────────────────────────────
  const handleAddAccount = async (accountData) => {
    try {
      const newAcc = await accountsAPI.create(accountData);
      setAccounts(prev => [...prev, newAcc]);
      showNotification('success', `Compte ${newAcc.email} configuré.`);
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateAccount = async (id, accountData) => {
    try {
      const updatedAcc = await accountsAPI.update(id, accountData);
      setAccounts(prev => prev.map(a => a.id === id ? updatedAcc : a));
      showNotification('success', 'Compte e-mail mis à jour.');
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Supprimer ce compte ? Tous les e-mails synchronisés seront supprimés.')) return;
    try {
      await accountsAPI.delete(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      setEmails(await emailsAPI.getAll());
      setSelectedEmail(null);
      showNotification('success', 'Compte supprimé.');
    } catch (err) {
      showNotification('error', `Erreur: ${err.message}`);
    }
  };

  const activeAccountsCount = accounts.filter(a => a.is_active === 1).length;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <Sparkles size={24} style={{ color: 'var(--accent-cyan)' }} />
          <h1>Aether Mail</h1>
        </div>

        <nav className="nav-tabs">
          <button className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')}>
            <Mail size={16} /> Boîte Mail
          </button>
          <button className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
            <Briefcase size={16} /> Suivi Candidatures
          </button>
          <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <SettingsIcon size={16} /> Paramètres
          </button>
        </nav>

        <div className="header-actions">
          {accounts.length > 0 ? (
            <div className="sync-status-indicator">
              <div className={`sync-status-dot ${activeAccountsCount > 0 ? 'active' : 'inactive'}`} />
              <span style={{ fontSize: '0.8rem' }}>{activeAccountsCount} Compte{activeAccountsCount > 1 ? 's' : ''} IMAP</span>
            </div>
          ) : (
            <div className="sync-status-indicator">
              <div className="sync-status-dot inactive" />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Démo uniquement</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline-cyan" onClick={() => handleSync('mock')} disabled={isSyncing}
              title="Génère des e-mails fictifs pour tester l'application.">
              Simulation Multi-Comptes
            </button>
            <button className="btn btn-secondary" onClick={handleReclassify}
              disabled={isReclassifying || isSyncing}
              title="Re-classe tous les e-mails existants avec le classifieur actuel.">
              <Wand2 size={16} className={isReclassifying ? 'spin' : ''} />
              Re-classer
            </button>
            <button className="btn btn-primary" onClick={() => handleSync('real')}
              disabled={isSyncing || activeAccountsCount === 0}>
              <RefreshCw size={16} className={isSyncing ? 'spin' : ''} /> Synchroniser tout
            </button>
          </div>
        </div>
      </header>

      <main className={`dashboard-content${activeTab !== 'inbox' ? ' scrollable' : ''}`}>
        {/* Floating notification */}
        {notification.show && (
          <div className={`alert-banner ${notification.type === 'success' ? 'alert-success' : notification.type === 'error' ? 'alert-error' : 'alert-info'}`}
            style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 1000, width: '340px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease-out' }}>
            {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Storage warning modal */}
        {showStorageWarn && storageInfo && (
          <div className="modal-overlay" style={{ zIndex: 2000 }}>
            <div className="modal-content" style={{ maxWidth: '420px' }}>
              <div className="modal-header">
                <h3 style={{ color: 'var(--cat-refus)' }}>⚠ Stockage presque plein</h3>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Vous avez utilisé <strong>{storageInfo.used_gb} Go</strong> sur <strong>5 Go</strong> ({storageInfo.percent_used}%).
                  Il est recommandé de supprimer les anciens e-mails.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Vous avez <strong>{storageInfo.email_count}</strong> e-mails stockés.
                </p>
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setShowStorageWarn(false)}>
                  Plus tard
                </button>
                <button className="btn btn-outline-cyan" onClick={() => { setShowStorageWarn(false); setActiveTab('settings'); }}>
                  Voir les paramètres
                </button>
                <button className="btn btn-danger" onClick={() => { setShowStorageWarn(false); handleCleanup(500); }}>
                  Supprimer les plus anciens (garder 500)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <EmailsView
            emails={emails} jobs={jobs} accounts={accounts}
            selectedEmail={selectedEmail}
            onSelectEmail={handleSelectEmail}
            onUpdateCategory={handleUpdateCategory}
            onLinkToJob={handleLinkToJob}
            onToggleRead={handleToggleRead}
            onDeleteEmail={handleDeleteEmail}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}
        {activeTab === 'jobs' && (
          <JobsView jobs={jobs} emails={emails}
            onCreateJob={handleCreateJob} onUpdateJob={handleUpdateJob}
            onDeleteJob={handleDeleteJob} onViewEmail={handleViewEmail} />
        )}
        {activeTab === 'settings' && (
          <SettingsView accounts={accounts} storageInfo={storageInfo} spamRules={spamRules} aiStatus={aiStatus}
            onAddAccount={handleAddAccount} onUpdateAccount={handleUpdateAccount}
            onDeleteAccount={handleDeleteAccount} onTestAccount={(d) => accountsAPI.test(d)}
            onCleanup={handleCleanup} onResetEmails={handleResetEmails}
            onAddSpamRule={handleAddSpamRule} onDeleteSpamRule={handleDeleteSpamRule}
            onUpdateAiConfig={handleUpdateAiConfig} onRefreshAiStatus={handleRefreshAiStatus} />
        )}
      </main>
    </div>
  );
}
