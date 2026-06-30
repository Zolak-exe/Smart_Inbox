const API_BASE_URL = 'http://localhost:5000/api';

// Retry sur les erreurs réseau uniquement (backend pas encore prêt au démarrage)
async function fetchWithRetry(url, options, maxAttempts = 5) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      // Erreur réseau (TypeError: failed to fetch) → on retry après délai croissant
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

async function fetchJson(url, options = {}) {
  const response = await fetchWithRetry(`${API_BASE_URL}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `API error: ${response.status}`);
  }
  return response.json();
}

export const emailsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category)  query.append('category',   params.category);
    if (params.search)    query.append('search',     params.search);
    if (params.accountId) query.append('accountId',  params.accountId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchJson(`/emails${qs}`);
  },

  getById: (id) => fetchJson(`/emails/${id}`),

  sync: (mode = 'auto') => fetchJson('/emails/sync', {
    method: 'POST',
    body: JSON.stringify({ mode })
  }),

  updateCategory: (id, category) => fetchJson(`/emails/${id}/category`, {
    method: 'PUT',
    body: JSON.stringify({ category })
  }),

  markAsRead: (id, is_read) => fetchJson(`/emails/${id}/read`, {
    method: 'PUT',
    body: JSON.stringify({ is_read })
  }),

  linkToJob: (id, jobId) => fetchJson(`/emails/${id}/link`, {
    method: 'POST',
    body: JSON.stringify({ job_application_id: jobId })
  }),

  delete: (id, serverSide = false) =>
    fetchJson(`/emails/${id}?serverSide=${serverSide}`, { method: 'DELETE' }),

  getStorage: () => fetchJson('/emails/storage'),

  cleanup: (keepCount) =>
    fetchJson(`/emails/cleanup?keepCount=${keepCount}`, { method: 'DELETE' }),

  reclassify: () => fetchJson('/emails/reclassify', { method: 'POST' }),

  resetAll: () => fetchJson('/emails/reset', { method: 'DELETE' })
};

export const jobsAPI = {
  getAll:  ()           => fetchJson('/jobs'),
  getById: (id)         => fetchJson(`/jobs/${id}`),
  create:  (data)       => fetchJson('/jobs',     { method: 'POST',   body: JSON.stringify(data) }),
  update:  (id, data)   => fetchJson(`/jobs/${id}`, { method: 'PUT',  body: JSON.stringify(data) }),
  delete:  (id)         => fetchJson(`/jobs/${id}`, { method: 'DELETE' })
};

export const aiAPI = {
  getStatus: () => fetchJson('/ai/status'),
  updateConfig: (data) => fetchJson('/ai/config', { method: 'PUT', body: JSON.stringify(data) })
};

export const spamRulesAPI = {
  getAll:  ()           => fetchJson('/spam-rules'),
  create:  (data)       => fetchJson('/spam-rules', { method: 'POST', body: JSON.stringify(data) }),
  delete:  (id)         => fetchJson(`/spam-rules/${id}`, { method: 'DELETE' })
};

export const accountsAPI = {
  getAll:  ()           => fetchJson('/config'),
  create:  (data)       => fetchJson('/config',     { method: 'POST',   body: JSON.stringify(data) }),
  update:  (id, data)   => fetchJson(`/config/${id}`, { method: 'PUT',  body: JSON.stringify(data) }),
  delete:  (id)         => fetchJson(`/config/${id}`, { method: 'DELETE' }),
  test:    (data)       => fetchJson('/config/test-imap', { method: 'POST', body: JSON.stringify(data) })
};
