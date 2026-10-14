import { getState, getResume, patchResume, putResume, removeResumeRecord, updateConversation, setUi } from '../app/store.js';
import { applyFieldEdits, emptyResumeData, flattenResumeFields } from '../features/resume-creation/model.js';
import { api } from './api.js';
import { db } from './db.js';
import { base64ToBlob, downloadBlob, validateDocxFile } from '../utils/files.js';
import { slugify } from '../utils/format.js';
import { uid } from '../utils/ids.js';

/* ------------------------------ blobs ------------------------------ */

const blobCache = new Map();
const newBlobId = (resumeId) => `${resumeId}:${uid()}`;

export async function loadBlob(blobId) {
  if (!blobId) return null;
  if (blobCache.has(blobId)) return blobCache.get(blobId);
  const blob = await db.getBlob(blobId);
  if (blob) blobCache.set(blobId, blob);
  return blob;
}

async function saveBlob(blobId, blob) {
  await db.putBlob(blobId, blob);
  blobCache.set(blobId, blob);
}

async function dropBlobs(ids) {
  ids.filter(Boolean).forEach((id) => blobCache.delete(id));
  await db.removeBlobs(ids.filter(Boolean));
}

/** Serialises operations per resume so concurrent edits cannot overwrite each other. */
const queues = new Map();
function enqueue(resumeId, fn) {
  const prev = queues.get(resumeId) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  queues.set(resumeId, next);
  return next;
}

/* ---------------------------- selectors ---------------------------- */

export const currentVersion = (resume) => resume.versions[resume.versions.length - 1];

export function getFields(resume) {
  if (!resume) return [];
  if (resume.kind === 'created') return flattenResumeFields(resume.resumeData);
  return (resume.paragraphs || []).map((p) => ({
    id: p.id,
    section: p.section,
    text: p.text,
    isHeading: p.isHeading,
    isListItem: p.isListItem,
    editable: p.editable,
    part: p.part,
  }));
}

export function exportFileName(resume) {
  const base = resume.targetJob?.title || resume.name || 'Resume';
  const slug = slugify(base).replace(/-?Resume$/i, '') || 'Resume';
  return `${slug}-Resume.docx`;
}

/** Blob for whichever version is being viewed: 'current' | 'original' | versionId. */
export async function blobForView(resume, viewing) {
  if (!resume) return null;
  if (viewing === 'original') {
    return loadBlob(resume.kind === 'imported' ? resume.originalBlobId : resume.versions[0].blobId);
  }
  if (viewing && viewing !== 'current') {
    const v = resume.versions.find((x) => x.id === viewing);
    if (v) return loadBlob(v.blobId);
  }
  return loadBlob(currentVersion(resume).blobId);
}

/* ------------------------------ creation --------------------------- */

function baseRecord(id, partial) {
  const now = Date.now();
  return {
    id,
    name: 'Resume',
    kind: 'imported',
    source: null,
    originalBlobId: null,
    versions: [],
    paragraphs: null,
    features: null,
    notes: [],
    resumeData: null,
    template: 'classic',
    paper: getState().settings.paper || 'letter',
    mode: 'preserve',
    targetJob: null,
    parentResumeId: null,
    changes: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export async function importDocxFile(file) {
  const maxMb = getState().serverConfig?.limits?.maxUploadMb;
  const problem = await validateDocxFile(file, maxMb ? maxMb * 1024 * 1024 : undefined);
  if (problem) throw new Error(problem);

  const info = await api.inspectDocx(file);
  const id = uid('r');
  const originalBlobId = newBlobId(id);
  const workingBlobId = newBlobId(id);

  // The original upload and the working copy are stored separately; the original is never modified.
  const buffer = await file.arrayBuffer();
  const type = file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await saveBlob(originalBlobId, new Blob([buffer], { type }));
  await saveBlob(workingBlobId, new Blob([buffer], { type }));

  const record = baseRecord(id, {
    name: file.name.replace(/\.docx$/i, ''),
    kind: 'imported',
    source: { fileName: file.name, size: file.size },
    originalBlobId,
    versions: [{ id: uid('v'), label: 'Imported file (working copy)', blobId: workingBlobId, createdAt: Date.now(), kind: 'import', changeIds: [] }],
    paragraphs: info.paragraphs,
    features: info.features,
    notes: info.notes,
  });
  return putResume(record);
}

export async function createCreatedResume({ name = 'Untitled resume', data = emptyResumeData(), template = 'classic', paper, parentResumeId = null, label = 'Created' } = {}) {
  const id = uid('r');
  const paperId = paper || getState().settings.paper || 'letter';
  const blob = await api.generateDocx(data, template, paperId);
  const blobId = newBlobId(id);
  await saveBlob(blobId, blob);
  const record = baseRecord(id, {
    name,
    kind: 'created',
    resumeData: data,
    template,
    paper: paperId,
    parentResumeId,
    versions: [{ id: uid('v'), label, blobId, createdAt: Date.now(), kind: 'create', changeIds: [], data, template, paper: paperId }],
  });
  return putResume(record);
}

async function cloneBlob(resumeId, blobId) {
  const blob = await loadBlob(blobId);
  if (!blob) throw new Error('A stored document is missing, so it could not be copied.');
  const newId = newBlobId(resumeId);
  await saveBlob(newId, blob);
  return newId;
}

/** Copies a resume (current state) into a new, independent resume. */
export async function forkResume(sourceId, { name, targetJob = null, label } = {}) {
  const src = getResume(sourceId);
  if (!src) throw new Error('That resume no longer exists.');
  const id = uid('r');
  const cur = currentVersion(src);
  const blobId = await cloneBlob(id, cur.blobId);
  const originalBlobId = src.kind === 'imported' ? await cloneBlob(id, src.originalBlobId) : null;
  const record = baseRecord(id, {
    ...structuredClone({
      kind: src.kind,
      source: src.source,
      paragraphs: src.paragraphs,
      features: src.features,
      notes: src.notes,
      resumeData: src.resumeData,
      template: src.template,
      paper: src.paper,
      mode: src.mode,
    }),
    name: name || `${src.name} (copy)`,
    originalBlobId,
    targetJob,
    parentResumeId: src.id,
    versions: [
      {
        id: uid('v'),
        label: label || `Copied from "${src.name}"`,
        blobId,
        createdAt: Date.now(),
        kind: 'copy',
        changeIds: [],
        ...(src.kind === 'created' ? { data: structuredClone(src.resumeData), template: src.template, paper: src.paper } : {}),
      },
    ],
  });
  return putResume(record);
}

export const duplicateResume = (id) => forkResume(id, { label: undefined });

export function renameResume(id, name) {
  const clean = name.trim().slice(0, 120);
  if (clean) patchResume(id, { name: clean });
}

export async function deleteResume(id) {
  const resume = getResume(id);
  if (!resume) return;
  const ids = [resume.originalBlobId, ...resume.versions.map((v) => v.blobId)];
  removeResumeRecord(id);
  await dropBlobs(ids);
  if (getState().ui.focusResumeId === id) {
    setUi({ focusResumeId: null });
  }
  for (const c of getState().conversations) {
    if (c.context.activeResumeId === id) {
      updateConversation(c.id, { context: { ...c.context, activeResumeId: null } }, { touch: false });
    }
  }
}

/* ------------------------------ editing ---------------------------- */

const MAX_VERSIONS = 40;

function trimVersions(versions) {
  if (versions.length <= MAX_VERSIONS) return { versions, dropped: [] };
  const dropped = versions.slice(1, versions.length - MAX_VERSIONS + 1);
  return { versions: [versions[0], ...versions.slice(1 + dropped.length)], dropped };
}

/**
 * Applies approved edits to a resume's working copy and records a new version.
 * edits: [{ id, kind, targetId, original, text, section, source }]
 * Returns { results: [{id, status, message}], applied, versionId }
 */
export function applyEditsToResume(resumeId, edits, { label, source = 'ai' } = {}) {
  return enqueue(resumeId, async () => {
    const resume = getResume(resumeId);
    if (!resume) throw new Error('That resume no longer exists.');

    let results;
    let newBlob = null;
    let paragraphs = resume.paragraphs;
    let features = resume.features;
    let data = resume.resumeData;

    if (resume.kind === 'imported') {
      const blob = await loadBlob(currentVersion(resume).blobId);
      if (!blob) throw new Error('The working copy of this resume is missing.');
      const res = await api.applyEdits(
        blob,
        edits.map((e) => ({ id: e.id, kind: e.kind, paragraphId: e.targetId, expectedText: e.original, newText: e.text })),
      );
      results = res.results;
      if (res.changed) {
        newBlob = base64ToBlob(res.docx);
        paragraphs = res.paragraphs;
        features = res.features || features;
      }
    } else {
      const r = applyFieldEdits(resume.resumeData, edits);
      results = r.results;
      if (r.results.some((x) => x.status === 'applied')) {
        data = r.data;
        newBlob = await api.generateDocx(data, resume.template, resume.paper);
      }
    }

    const appliedIds = results.filter((r) => r.status === 'applied').map((r) => r.id);
    if (!newBlob || !appliedIds.length) return { results, applied: 0, versionId: null };

    const blobId = newBlobId(resumeId);
    await saveBlob(blobId, newBlob);
    const versionId = uid('v');
    const now = Date.now();
    const version = {
      id: versionId,
      label: label || (source === 'user' ? 'Manual edit' : 'Accepted suggestions'),
      blobId,
      createdAt: now,
      kind: source === 'user' ? 'manual' : 'suggestions',
      changeIds: appliedIds,
      ...(resume.kind === 'created' ? { data, template: resume.template, paper: resume.paper } : {}),
    };
    const changes = edits
      .filter((e) => appliedIds.includes(e.id))
      .map((e) => ({
        id: e.id,
        versionId,
        at: now,
        targetId: e.targetId,
        kind: e.kind,
        section: e.section || '',
        original: e.original,
        proposed: e.text,
        source: e.source || source,
      }));

    const fresh = getResume(resumeId);
    const { versions, dropped } = trimVersions([...fresh.versions, version]);
    patchResume(resumeId, {
      versions,
      paragraphs,
      features,
      resumeData: data,
      changes: [...fresh.changes, ...changes].slice(-400),
    });
    if (dropped.length) await dropBlobs(dropped.map((v) => v.blobId));
    return { results, applied: appliedIds.length, versionId };
  });
}

/** Manual edits of a created resume's structured data (amends the latest manual version). */
export function updateCreatedResume(resumeId, { data, template, paper }) {
  return enqueue(resumeId, async () => {
    const resume = getResume(resumeId);
    if (!resume || resume.kind !== 'created') return;
    const nextData = data || resume.resumeData;
    const nextTemplate = template || resume.template;
    const nextPaper = paper || resume.paper;
    const blob = await api.generateDocx(nextData, nextTemplate, nextPaper);
    const blobId = newBlobId(resumeId);
    await saveBlob(blobId, blob);

    const fresh = getResume(resumeId);
    const last = currentVersion(fresh);
    const snapshot = { data: structuredClone(nextData), template: nextTemplate, paper: nextPaper };
    let versions;
    if (last.kind === 'manual') {
      await dropBlobs([last.blobId]);
      versions = [...fresh.versions.slice(0, -1), { ...last, blobId, createdAt: Date.now(), ...snapshot }];
    } else {
      versions = [
        ...fresh.versions,
        { id: uid('v'), label: 'Manual edits', blobId, createdAt: Date.now(), kind: 'manual', changeIds: [], ...snapshot },
      ];
    }
    patchResume(resumeId, { versions, resumeData: nextData, template: nextTemplate, paper: nextPaper });
  });
}

/** Adds chatbot-supplied facts to a created resume as a new version. */
export function applyResumeDataUpdate(resumeId, data, label) {
  return enqueue(resumeId, async () => {
    const resume = getResume(resumeId);
    if (!resume || resume.kind !== 'created') return null;
    const blob = await api.generateDocx(data, resume.template, resume.paper);
    const blobId = newBlobId(resumeId);
    await saveBlob(blobId, blob);
    const versionId = uid('v');
    const fresh = getResume(resumeId);
    const { versions, dropped } = trimVersions([
      ...fresh.versions,
      { id: versionId, label, blobId, createdAt: Date.now(), kind: 'chat', changeIds: [], data: structuredClone(data), template: resume.template, paper: resume.paper },
    ]);
    patchResume(resumeId, { versions, resumeData: data });
    if (dropped.length) await dropBlobs(dropped.map((v) => v.blobId));
    return versionId;
  });
}

/** Reverts the latest version. Returns { label, versionId } or null when nothing can be undone. */
export function undoLastVersion(resumeId) {
  return enqueue(resumeId, async () => {
    const resume = getResume(resumeId);
    if (!resume || resume.versions.length <= 1) return null;
    const popped = currentVersion(resume);
    const versions = resume.versions.slice(0, -1);
    const prev = versions[versions.length - 1];

    const patch = {
      versions,
      changes: resume.changes.filter((c) => c.versionId !== popped.id),
    };
    if (resume.kind === 'created') {
      patch.resumeData = structuredClone(prev.data);
      patch.template = prev.template || resume.template;
      patch.paper = prev.paper || resume.paper;
    } else {
      const blob = await loadBlob(prev.blobId);
      const info = await api.inspectDocx(blob);
      patch.paragraphs = info.paragraphs;
      patch.features = info.features;
    }
    patchResume(resumeId, patch);
    await dropBlobs([popped.blobId]);

    // Suggestions that produced the undone version become pending again.
    for (const c of getState().conversations) {
      let touched = false;
      const messages = c.messages.map((m) => {
        if (!m.suggestions?.some((s) => s.versionId === popped.id)) return m;
        touched = true;
        return {
          ...m,
          suggestions: m.suggestions.map((s) =>
            s.versionId === popped.id ? { ...s, status: 'pending', versionId: null, appliedText: null, failMessage: null } : s,
          ),
        };
      });
      if (touched) updateConversation(c.id, { messages }, { touch: false });
    }
    return { label: popped.label, versionId: popped.id };
  });
}

/* ------------------------------ redesign --------------------------- */

export async function redesignResume(sourceId, { template, paper, useAi }) {
  const src = getResume(sourceId);
  if (!src || src.kind !== 'imported') throw new Error('Only imported resumes can be redesigned.');
  const { data, method } = await api.structureResume(src.paragraphs, useAi);
  const tpl = template || 'classic';
  const created = await createCreatedResume({
    name: `${src.name} (${tpl[0].toUpperCase()}${tpl.slice(1)} template)`,
    data,
    template: tpl,
    paper: paper || src.paper,
    parentResumeId: src.id,
    label: `Redesigned from "${src.name}"`,
  });
  patchResume(created.id, { targetJob: src.targetJob });
  return { resume: getResume(created.id), method };
}

/* ------------------------------ export ----------------------------- */

export async function downloadResume(resume) {
  const blob = await loadBlob(currentVersion(resume).blobId);
  if (!blob) throw new Error('The document could not be found in local storage.');
  downloadBlob(blob, exportFileName(resume));
}
