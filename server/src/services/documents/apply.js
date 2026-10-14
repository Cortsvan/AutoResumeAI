import { normalizeForCompare } from '../../../../shared/textDiff.js';
import { getPart, markDirty, openDocx, saveDocx } from './package.js';
import { enumerateParagraphs, paragraphProps, paragraphText } from './paragraphs.js';
import { PARAGRAPH_ID_RE, describeFeatures, detectFeatures, listParagraphs, partNameOf } from './inspect.js';
import { insertParagraphAfter, replaceParagraphText } from './textEdit.js';

async function locate(docx, paragraphId, expectedText) {
  const m = PARAGRAPH_ID_RE.exec(paragraphId || '');
  if (!m) return { error: 'not_found', message: 'Unknown paragraph reference.' };
  const partName = partNameOf(m[1]);
  const dom = await getPart(docx, partName);
  if (!dom) return { error: 'not_found', message: 'The paragraph could not be found in the document.' };
  const hint = Number(m[2]);
  const entries = enumerateParagraphs(dom.documentElement);

  const direct = entries[hint];
  if (direct && paragraphText(direct.el) === expectedText) return { entry: direct, partName };

  // Indexes shift after inserted paragraphs; re-find by text, nearest to the original index.
  const target = normalizeForCompare(expectedText);
  let best = null;
  entries.forEach((entry, i) => {
    if (normalizeForCompare(paragraphText(entry.el)) === target) {
      const dist = Math.abs(i - hint);
      if (!best || dist < best.dist) best = { entry, dist };
    }
  });
  if (best) return { entry: best.entry, partName };
  return {
    error: 'conflict',
    message: 'This paragraph has changed since the suggestion was made, so it was not applied.',
  };
}

async function applyOne(docx, edit) {
  const found = await locate(docx, edit.paragraphId, edit.expectedText);
  if (found.error) return { status: found.error, message: found.message };

  const { entry, partName } = found;
  const props = paragraphProps(entry.el);
  if (props.hasField) {
    return { status: 'unsafe', message: 'This paragraph contains a Word field and was left untouched.' };
  }

  if (edit.kind === 'insert_after') {
    const res = insertParagraphAfter(entry.el, edit.newText);
    if (!res.ok) return { status: 'unsafe', message: res.reason };
    markDirty(docx, partName);
    return { status: 'applied' };
  }

  const res = replaceParagraphText(entry.el, edit.newText);
  if (!res.ok) return { status: 'unsafe', message: res.reason };
  if (res.changed) markDirty(docx, partName);
  return { status: 'applied' };
}

/**
 * Applies approved edits to a working copy of a DOCX. The input buffer is never mutated.
 * Returns the new buffer (or the original one if nothing could be applied).
 */
export async function applyEdits(buffer, edits) {
  const docx = await openDocx(buffer);
  const results = [];
  for (const edit of edits) {
    // eslint-disable-next-line no-await-in-loop
    const result = await applyOne(docx, edit);
    results.push({ id: edit.id, ...result });
  }

  const appliedCount = results.filter((r) => r.status === 'applied').length;
  if (appliedCount === 0 || docx.dirty.size === 0) {
    return { buffer, results, changed: false };
  }

  const out = await saveDocx(docx);

  // Integrity check: the produced package must re-open and every edited part must still parse.
  const verify = await openDocx(out);
  for (const part of docx.dirty) await getPart(verify, part);
  const paragraphs = await listParagraphs(verify);
  const features = await detectFeatures(verify);

  return { buffer: out, results, changed: true, paragraphs, features, notes: describeFeatures(features) };
}
