import { openDB } from 'idb';

const DB_VERSION = 1;

let currentUserId = null;
let dbPromise = null;

function getDbName(userId) {
  if (!userId || userId === 'guest') return 'autoresumeai_guest';
  return `autoresumeai_${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function getDb() {
  if (!dbPromise) {
    const dbName = getDbName(currentUserId);
    dbPromise = openDB(dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('resumes')) {
          db.createObjectStore('resumes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/**
 * Switches the active IndexedDB connection to the given user ID.
 * Isolates each user's resumes and conversations from other accounts.
 */
export async function switchUserDb(userId) {
  const normalized = userId || null;
  if (currentUserId !== normalized) {
    if (dbPromise) {
      try {
        const d = await dbPromise;
        d.close();
      } catch {
        /* ignore */
      }
      dbPromise = null;
    }
    currentUserId = normalized;
  }
}

export class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

function friendly(err) {
  if (err?.name === 'QuotaExceededError') {
    return 'Your browser storage is full. Delete some resumes or conversations and try again.';
  }
  return 'Your browser could not save data locally. Private browsing or blocked storage can cause this.';
}

async function guard(fn) {
  try {
    return await fn(await getDb());
  } catch (err) {
    throw new StorageError(friendly(err), err);
  }
}

export const db = {
  loadAll: () =>
    guard(async (d) => {
      const [conversations, resumes, settingsRows] = await Promise.all([
        d.getAll('conversations'),
        d.getAll('resumes'),
        d.getAll('settings'),
      ]);
      const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
      return { conversations, resumes, settings };
    }),

  put: (store, value) => guard((d) => d.put(store, value)),
  remove: (store, key) => guard((d) => d.delete(store, key)),

  setSetting: (key, value) => guard((d) => d.put('settings', { key, value })),

  putBlob: (id, blob) =>
    guard(async (d) => {
      const data = await blob.arrayBuffer();
      await d.put('blobs', { id, data, type: blob.type, size: blob.size });
    }),

  getBlob: (id) =>
    guard(async (d) => {
      const row = await d.get('blobs', id);
      return row ? new Blob([row.data], { type: row.type }) : null;
    }),

  removeBlobs: (ids) =>
    guard(async (d) => {
      const tx = d.transaction('blobs', 'readwrite');
      await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    }),

  clearAll: () =>
    guard(async (d) => {
      const tx = d.transaction(['conversations', 'resumes', 'blobs', 'settings'], 'readwrite');
      await Promise.all([
        tx.objectStore('conversations').clear(),
        tx.objectStore('resumes').clear(),
        tx.objectStore('blobs').clear(),
        tx.objectStore('settings').clear(),
        tx.done,
      ]);
    }),
};
