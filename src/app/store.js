import { useSyncExternalStore } from 'react';
import { db, switchUserDb } from '../services/db.js';
import { supabase, isSupabaseConfigured, fetchCurrentProfile } from '../services/supabase.js';
import { uid } from '../utils/ids.js';

export const DEFAULT_SETTINGS = {
  aiMode: 'ask', // 'ask' | 'allowed' | 'off'
  paper: 'letter',
  previewOpen: true,
};

let state = {
  ready: false,
  storageError: null,
  conversations: [],
  resumes: [],
  settings: DEFAULT_SETTINGS,
  serverConfig: null,
  serverOnline: true,
  auth: {
    user: null,
    profile: null,
    session: null,
    quota: null,
    loading: true,
    isSupabaseConfigured,
  },
  ui: {
    focusResumeId: null,
    mobileView: 'chat', // 'chat' | 'preview'
    sidebarOpen: false,
    previewTab: 'preview', // 'preview' | 'changes' | 'edit' | 'info'
    viewing: 'current', // 'current' | 'original' | <versionId>
    busy: {}, // conversationId -> boolean
    consentRequest: null,
    authModalOpen: false,
  },
  toasts: [],
};

const listeners = new Set();

export const getState = () => state;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore(selector) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/** Runs a persistence promise and surfaces failures as a toast instead of throwing. */
async function persist(promise) {
  try {
    await promise;
  } catch (err) {
    toast(err?.message || 'Could not save your changes locally.', 'error');
  }
}

export function toast(message, kind = 'info', ms = 5000) {
  const id = uid();
  setState({ toasts: [...state.toasts, { id, message, kind }] });
  setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id) {
  setState({ toasts: state.toasts.filter((t) => t.id !== id) });
}

export function setUi(patch) {
  setState({ ui: { ...state.ui, ...patch } });
}

export function setBusy(conversationId, busy) {
  const next = { ...state.ui.busy };
  if (busy) next[conversationId] = true;
  else delete next[conversationId];
  setUi({ busy: next });
}

/* ------------------------------ Auth ------------------------------ */

export function setAuthModalOpen(open) {
  setUi({ authModalOpen: open });
}

export async function refreshUserProfile() {
  const user = state.auth.user;
  if (!user) return;
  const profile = await fetchCurrentProfile(user.id);
  if (profile) {
    setState({
      auth: {
        ...state.auth,
        profile,
        quota: {
          dailyLimit: profile.daily_limit,
          isUnlimited: Boolean(profile.is_unlimited || profile.role === 'admin'),
          isAdmin: profile.role === 'admin',
          todayUsed: profile.todayUsed,
          remainingToday: profile.remainingToday,
        },
      },
    });
  }
}

export function updateQuota(quotaPatch) {
  if (!state.auth.quota) return;
  setState({
    auth: {
      ...state.auth,
      quota: { ...state.auth.quota, ...quotaPatch },
    },
  });
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, metadata = {}) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        first_name: metadata.firstName?.trim() || '',
        last_name: metadata.lastName?.trim() || '',
        full_name: `${metadata.firstName?.trim() || ''} ${metadata.lastName?.trim() || ''}`.trim(),
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (supabase) {
    await supabase.auth.signOut().catch(() => {});
  }
  await switchUserDb(null);
  const { conversations, resumes, settings } = await db.loadAll();
  setState({
    auth: {
      user: null,
      profile: null,
      session: null,
      quota: null,
      loading: false,
      isSupabaseConfigured,
    },
    conversations: conversations.sort((a, b) => b.updatedAt - a.updatedAt),
    resumes: resumes.sort((a, b) => b.updatedAt - a.updatedAt),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  });
  toast('Signed out successfully.', 'info');
}

/* ------------------------------ Init ------------------------------ */

export async function initStore() {
  let initialUser = null;
  let initialProfile = null;
  let initialSession = null;

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      initialSession = data?.session || null;
      initialUser = initialSession?.user || null;
      if (initialUser) {
        initialProfile = await fetchCurrentProfile(initialUser.id);
      }
    } catch (err) {
      console.warn('Could not restore auth session:', err);
    }
  }

  // Isolate database to active user
  await switchUserDb(initialUser?.id || null);

  try {
    const { conversations, resumes, settings } = await db.loadAll();
    setState({
      auth: {
        user: initialUser,
        profile: initialProfile,
        session: initialSession,
        quota: initialProfile
          ? {
              dailyLimit: initialProfile.daily_limit,
              isUnlimited: Boolean(initialProfile.is_unlimited || initialProfile.role === 'admin'),
              isAdmin: initialProfile.role === 'admin',
              todayUsed: initialProfile.todayUsed,
              remainingToday: initialProfile.remainingToday,
            }
          : null,
        loading: false,
        isSupabaseConfigured,
      },
      conversations: conversations.sort((a, b) => b.updatedAt - a.updatedAt),
      resumes: resumes.sort((a, b) => b.updatedAt - a.updatedAt),
      settings: { ...DEFAULT_SETTINGS, ...settings },
      ready: true,
    });
  } catch (err) {
    setState({
      ready: true,
      storageError: err?.message || 'Local storage is unavailable.',
      auth: { ...state.auth, loading: false },
    });
  }

  // Listen to auth state transitions
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user || null;
      const currentUser = state.auth.user;

      if (user?.id !== currentUser?.id) {
        // User changed or logged in/out -> switch isolated storage
        await switchUserDb(user?.id || null);
        const [loaded, profile] = await Promise.all([
          db.loadAll().catch(() => ({ conversations: [], resumes: [], settings: {} })),
          user ? fetchCurrentProfile(user.id) : Promise.resolve(null),
        ]);

        setState({
          auth: {
            user,
            profile,
            session,
            quota: profile
              ? {
                  dailyLimit: profile.daily_limit,
                  isUnlimited: Boolean(profile.is_unlimited || profile.role === 'admin'),
                  isAdmin: profile.role === 'admin',
                  todayUsed: profile.todayUsed,
                  remainingToday: profile.remainingToday,
                }
              : null,
            loading: false,
            isSupabaseConfigured,
          },
          conversations: (loaded.conversations || []).sort((a, b) => b.updatedAt - a.updatedAt),
          resumes: (loaded.resumes || []).sort((a, b) => b.updatedAt - a.updatedAt),
          settings: { ...DEFAULT_SETTINGS, ...(loaded.settings || {}) },
        });
      } else if (session) {
        // Token refreshed
        setState({
          auth: { ...state.auth, session, loading: false },
        });
      }
    });
  }
}

export function setServerConfig(serverConfig, online = true) {
  setState({ serverConfig, serverOnline: online });
}

/* ----------------------------- Settings ---------------------------- */

export function updateSettings(patch) {
  setState({ settings: { ...state.settings, ...patch } });
  for (const [k, v] of Object.entries(patch)) persist(db.setSetting(k, v));
}

/* --------------------------- Conversations ------------------------- */

export function getConversation(id) {
  return state.conversations.find((c) => c.id === id) || null;
}

export function createConversation({ title = 'New Conversation', context = {} } = {}) {
  const id = uid('c');
  const now = Date.now();
  const conv = {
    id,
    title,
    messages: [],
    context: {
      activeResumeId: null,
      jobTitle: '',
      jobDescription: '',
      ...context,
    },
    createdAt: now,
    updatedAt: now,
  };
  setState({ conversations: [conv, ...state.conversations] });
  persist(db.put('conversations', conv));
  return conv;
}

export function updateConversation(id, patchOrUpdater) {
  const convs = state.conversations.map((c) => {
    if (c.id !== id) return c;
    const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(c) : patchOrUpdater;
    const updated = { ...c, ...patch, updatedAt: Date.now() };
    persist(db.put('conversations', updated));
    return updated;
  });
  setState({ conversations: convs.sort((a, b) => b.updatedAt - a.updatedAt) });
}

export function deleteConversation(id) {
  setState({ conversations: state.conversations.filter((c) => c.id !== id) });
  persist(db.remove('conversations', id));
}

export function renameConversation(id, title) {
  updateConversation(id, { title });
}

export function appendMessage(conversationId, message) {
  const msg = {
    id: uid('m'),
    createdAt: Date.now(),
    ...message,
  };
  updateConversation(conversationId, (c) => ({
    messages: [...c.messages, msg],
  }));
  return msg;
}

export function updateMessage(conversationId, messageId, patchOrUpdater) {
  updateConversation(conversationId, (c) => ({
    messages: c.messages.map((m) => {
      if (m.id !== messageId) return m;
      const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(m) : patchOrUpdater;
      return { ...m, ...patch };
    }),
  }));
}

/* ------------------------------ Resumes ---------------------------- */

export function getResume(id) {
  return state.resumes.find((r) => r.id === id) || null;
}

export function saveResume(resume) {
  const existing = state.resumes.some((r) => r.id === resume.id);
  const now = Date.now();
  const doc = {
    ...resume,
    updatedAt: now,
    createdAt: resume.createdAt || now,
  };

  const next = existing
    ? state.resumes.map((r) => (r.id === doc.id ? doc : r))
    : [doc, ...state.resumes];

  setState({ resumes: next.sort((a, b) => b.updatedAt - a.updatedAt) });
  persist(db.put('resumes', doc));
  return doc;
}

export function updateResumeRecord(id, patchOrUpdater) {
  const resumes = state.resumes.map((r) => {
    if (r.id !== id) return r;
    const patch = typeof patchOrUpdater === 'function' ? patchOrUpdater(r) : patchOrUpdater;
    const updated = { ...r, ...patch, updatedAt: Date.now() };
    persist(db.put('resumes', updated));
    return updated;
  });
  setState({ resumes: resumes.sort((a, b) => b.updatedAt - a.updatedAt) });
}

export function removeResumeRecord(id) {
  setState({ resumes: state.resumes.filter((r) => r.id !== id) });
  persist(db.remove('resumes', id));
}

export const putResume = saveResume;
export const patchResume = updateResumeRecord;

export async function clearAllData() {
  await db.clearAll();
  setState({
    conversations: [],
    resumes: [],
    settings: DEFAULT_SETTINGS,
    ui: {
      ...state.ui,
      focusResumeId: null,
      previewTab: 'preview',
      viewing: 'current',
    },
  });
}
