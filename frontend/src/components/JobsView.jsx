import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Calendar, MapPin, Link as LinkIcon, ExternalLink, X, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function JobsView({
  jobs,
  emails,
  onCreateJob,
  onUpdateJob,
  onDeleteJob,
  onViewEmail
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedJobId, setExpandedJobId] = useState(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    location: '',
    date_applied: '',
    status: 'en cours',
    notes: '',
    link_to_offer: ''
  });

  const openAddModal = () => {
    setEditingJob(null);
    setFormData({
      company: '',
      position: '',
      location: '',
      date_applied: new Date().toISOString().split('T')[0],
      status: 'en cours',
      notes: '',
      link_to_offer: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (job) => {
    setEditingJob(job);
    setFormData({
      company: job.company,
      position: job.position,
      location: job.location || '',
      date_applied: job.date_applied || '',
      status: job.status,
      notes: job.notes || '',
      link_to_offer: job.link_to_offer || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingJob) {
      onUpdateJob(editingJob.id, formData);
    } else {
      onCreateJob(formData);
    }
    setIsModalOpen(false);
  };

  const toggleExpandJob = (jobId) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(jobId);
    }
  };

  // Filter and search jobs
  const filteredJobs = jobs.filter(job => {
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesSearch = 
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.location && job.location.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  const getLinkedEmails = (jobId) => {
    return emails.filter(e => e.job_application_id === jobId);
  };

  return (
    <div className="jobs-view-container">
      {/* Top Filter and Action Bar */}
      <div className="view-actions-bar">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="search-input-container" style={{ width: '260px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Rechercher une offre..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="jobs-filter-group">
            <button 
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Tous ({jobs.length})
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'en cours' ? 'active' : ''}`}
              onClick={() => setStatusFilter('en cours')}
            >
              En cours ({jobs.filter(j => j.status === 'en cours').length})
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'entretien' ? 'active' : ''}`}
              onClick={() => setStatusFilter('entretien')}
            >
              Entretiens ({jobs.filter(j => j.status === 'entretien').length})
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'refusé' ? 'active' : ''}`}
              onClick={() => setStatusFilter('refusé')}
            >
              Refusés ({jobs.filter(j => j.status === 'refusé').length})
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'accepté' ? 'active' : ''}`}
              onClick={() => setStatusFilter('accepté')}
            >
              Acceptés ({jobs.filter(j => j.status === 'accepté').length})
            </button>
          </div>
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Ajouter une offre
        </button>
      </div>

      {/* Main Table */}
      <div className="jobs-table-card">
        <div className="jobs-table-wrapper">
          <table className="jobs-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Entreprise</th>
                <th>Poste</th>
                <th>Lieu</th>
                <th>Date d'application</th>
                <th>Statut</th>
                <th>E-mails liés</th>
                <th style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Aucune candidature trouvée.
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => {
                  const linkedEmails = getLinkedEmails(job.id);
                  const isExpanded = expandedJobId === job.id;
                  
                  return (
                    <React.Fragment key={job.id}>
                      <tr>
                        <td>
                          <button className="table-btn" onClick={() => toggleExpandJob(job.id)}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="company-cell">{job.company}</td>
                        <td className="position-cell">{job.position}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                            <MapPin size={12} /> {job.location || 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                            <Calendar size={12} /> {job.date_applied}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill status-${job.status.replace(' ', '-')}`}>
                            <span className="status-dot" />
                            {job.status}
                          </span>
                        </td>
                        <td>
                          {linkedEmails.length > 0 ? (
                            <span 
                              className="badge badge-autre" 
                              style={{ cursor: 'pointer' }}
                              onClick={() => toggleExpandJob(job.id)}
                            >
                              {linkedEmails.length} e-mail{linkedEmails.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aucun</span>
                          )}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button className="table-btn edit" onClick={() => openEditModal(job)} title="Modifier">
                              <Edit2 size={14} />
                            </button>
                            <button className="table-btn delete" onClick={() => onDeleteJob(job.id)} title="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="8" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: '1.25rem 2rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              {job.link_to_offer && (
                                <div>
                                  <strong>Lien de l'offre : </strong>
                                  <a href={job.link_to_offer} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
                                    Voir l'annonce <ExternalLink size={12} />
                                  </a>
                                </div>
                              )}
                              {job.notes && (
                                <div>
                                  <strong>Notes / Détails :</strong>
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
                                    {job.notes}
                                  </p>
                                </div>
                              )}
                              
                              <div>
                                <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Historique des échanges e-mails liés :</strong>
                                {linkedEmails.length === 0 ? (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aucun e-mail n'est relié à cette candidature. Pour en relier un, ouvrez un e-mail dans la section Inbox et associez-le via le panneau IA.</span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {linkedEmails.map(email => (
                                      <div 
                                        key={email.id} 
                                        style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'space-between',
                                          background: 'rgba(255, 255, 255, 0.03)',
                                          padding: '0.5rem 1rem',
                                          borderRadius: '6px',
                                          border: '1px solid var(--border)'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                          <span className={`badge badge-${email.category.toLowerCase()}`}>{email.category}</span>
                                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>{email.subject}</span>
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({new Date(email.date).toLocaleDateString('fr-FR')})</span>
                                        </div>
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                          onClick={() => onViewEmail(email)}
                                        >
                                          Lire le mail
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingJob ? 'Modifier la candidature' : 'Ajouter une candidature'}</h3>
              <button className="table-btn" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Entreprise *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Ex: Airbus, Sopra Steria..."
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Intitulé du poste *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Ex: Apprenti Ingénieur Cybersécurité..."
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Lieu</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: Blagnac"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Statut</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="en cours">En cours</option>
                      <option value="entretien">Entretien</option>
                      <option value="refusé">Refusé</option>
                      <option value="accepté">Accepté</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Date de postulation</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.date_applied}
                    onChange={(e) => setFormData({ ...formData, date_applied: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Lien de l'offre</label>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="Ex: https://..."
                    value={formData.link_to_offer}
                    onChange={(e) => setFormData({ ...formData, link_to_offer: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Notes / Commentaires</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Ajoutez des détails sur les compétences demandées, la personne de contact, etc."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingJob ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
