import { DOCX_MIME } from '../utils/files.js';
import { getSessionToken } from './supabase.js';

function getBaseUrl() {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!raw) return '';
  let url = raw.replace(/\/+$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

const BASE = getBaseUrl();

export class ApiError extends Error {
  constructor(message, { code = 'ERROR', status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function request(path, { method = 'GET', json, form, timeoutMs = 60_000, expect = 'json' } = {}) {
  let res;
  const token = await getSessionToken();
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: json ? JSON.stringify(json) : form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError') throw new ApiError('The request timed out. Please try again.', { code: 'TIMEOUT' });
    throw new ApiError('Cannot reach the server. Make sure the API is running (npm run dev).', { code: 'NETWORK' });
  }

  if (!res.ok) {
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(payload?.error?.message || `Request failed (${res.status}).`, {
      code: payload?.error?.code || 'ERROR',
      status: res.status,
    });
  }
  return expect === 'blob' ? res.blob() : res.json();
}

function docxForm(blob, extra = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  form.append('file', new Blob([blob], { type: DOCX_MIME }), 'resume.docx');
  return form;
}

export const api = {
  getConfig: () => request('/api/config', { timeoutMs: 8000 }),

  chat: (body) => request('/api/chat', { method: 'POST', json: body, timeoutMs: 120_000 }),

  inspectDocx: (fileOrBlob) =>
    request('/api/documents/inspect', {
      method: 'POST',
      form: (() => {
        const form = new FormData();
        const name = fileOrBlob.name || 'resume.docx';
        form.append('file', new Blob([fileOrBlob], { type: DOCX_MIME }), name);
        return form;
      })(),
    }),

  applyEdits: (blob, edits) =>
    request('/api/documents/apply', { method: 'POST', form: docxForm(blob, { edits: JSON.stringify(edits) }) }),

  generateDocx: (data, template, paper) =>
    request('/api/documents/generate', { method: 'POST', json: { data, template, paper }, expect: 'blob' }),

  structureResume: (paragraphs, useAi) =>
    request('/api/resumes/structure', { method: 'POST', json: { paragraphs, useAi }, timeoutMs: 120_000 }),

  // Admin API methods
  admin: {
    getOverview: () => request('/api/admin/overview'),
    listUsers: (params = {}) => {
      const q = new URLSearchParams();
      if (params.page) q.set('page', params.page);
      if (params.limit) q.set('limit', params.limit);
      if (params.search) q.set('search', params.search);
      if (params.status) q.set('status', params.status);
      if (params.role) q.set('role', params.role);
      if (params.unlimited !== undefined) q.set('unlimited', params.unlimited);
      return request(`/api/admin/users?${q.toString()}`);
    },
    updateUser: (userId, updates) =>
      request(`/api/admin/users/${userId}`, { method: 'PATCH', json: updates }),
    revokeSessions: (userId) =>
      request(`/api/admin/users/${userId}/revoke-sessions`, { method: 'POST' }),
    getAuditLogs: (limit = 50) => request(`/api/admin/audit-logs?limit=${limit}`),
    updateBudget: (budgetData) =>
      request('/api/admin/budget', { method: 'PATCH', json: budgetData }),
  },
};
