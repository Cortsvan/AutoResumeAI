import { diffToHunks } from '../../../../shared/textDiff.js';
import { NS, childElements, isW } from './package.js';
import { paragraphSegments, segmentText } from './paragraphs.js';

const specialsOf = (s) => s.match(/[\t\n]/g) || [];

function markPreserve(node) {
  node.setAttributeNS(NS.xml, 'xml:space', 'preserve');
}

/**
 * Replaces the visible text of a paragraph using a word-level diff, editing only the
 * w:t nodes whose text actually changes. Runs, run properties, hyperlinks, tabs,
 * line breaks and everything else in the paragraph are left untouched.
 *
 * Returns { ok, changed, reason? }. When `ok` is false the paragraph is unchanged.
 */
export function replaceParagraphText(p, newTextRaw) {
  const newText = String(newTextRaw).replace(/\r/g, '');
  const segs = paragraphSegments(p);
  const oldText = segs.map(segmentText).join('');

  if (oldText === newText) return { ok: true, changed: false };
  if (!segs.some((s) => s.kind === 't')) return { ok: false, reason: 'This paragraph has no editable text.' };

  const oldSpecials = specialsOf(oldText);
  const newSpecials = specialsOf(newText);
  if (oldSpecials.length !== newSpecials.length || oldSpecials.some((c, i) => c !== newSpecials[i])) {
    return {
      ok: false,
      reason: 'The replacement changes tabs or line breaks in this paragraph, which could alter the layout.',
    };
  }

  // Character ranges of every segment in the old text.
  const ranges = [];
  let pos = 0;
  for (const seg of segs) {
    const len = segmentText(seg).length;
    ranges.push({ seg, start: pos, end: pos + len });
    pos += len;
  }

  const hunks = diffToHunks(oldText, newText);

  // Dry run: refuse to delete tabs / breaks.
  for (const h of hunks) {
    if (h.end > h.start) {
      const hitsSpecial = ranges.some((r) => r.seg.kind === 'special' && r.end > h.start && r.start < h.end);
      if (hitsSpecial) {
        return { ok: false, reason: 'The change would remove a tab or line break from this paragraph.' };
      }
    }
  }

  // Snapshot so we can restore if post-verification fails.
  const snapshot = segs.filter((s) => s.kind === 't').map((s) => ({ node: s.node, text: s.node.textContent || '' }));
  const touched = new Set();

  const setNodeText = (node, text) => {
    while (node.firstChild) node.removeChild(node.firstChild);
    node.appendChild(node.ownerDocument.createTextNode(text));
    touched.add(node);
  };

  for (const h of [...hunks].sort((a, b) => b.start - a.start)) {
    let target = null;
    let offset = 0;

    const overlapped = h.end > h.start ? ranges.filter((r) => r.end > h.start && r.start < h.end) : [];
    for (const r of overlapped) {
      const a = Math.max(h.start, r.start) - r.start;
      const b = Math.min(h.end, r.end) - r.start;
      const text = r.seg.node.textContent || '';
      setNodeText(r.seg.node, text.slice(0, a) + text.slice(b));
      if (!target) {
        target = r.seg.node;
        offset = a;
      }
    }

    if (h.insert) {
      if (!target) {
        const prev = ranges.find((r) => r.seg.kind === 't' && r.start < h.start && r.end >= h.start);
        if (prev) {
          target = prev.seg.node;
          offset = h.start - prev.start;
        } else {
          const next = ranges.find((r) => r.seg.kind === 't' && r.start >= h.start);
          if (next) {
            target = next.seg.node;
            offset = 0;
          } else {
            const lastT = [...ranges].reverse().find((r) => r.seg.kind === 't');
            target = lastT.seg.node;
            offset = (target.textContent || '').length;
          }
        }
      }
      const text = target.textContent || '';
      setNodeText(target, text.slice(0, offset) + h.insert + text.slice(offset));
    }
  }

  for (const node of touched) markPreserve(node);

  const verify = paragraphSegments(p).map(segmentText).join('');
  if (verify !== newText) {
    for (const s of snapshot) {
      while (s.node.firstChild) s.node.removeChild(s.node.firstChild);
      s.node.appendChild(s.node.ownerDocument.createTextNode(s.text));
    }
    return { ok: false, reason: 'The edit could not be mapped safely onto the formatting of this paragraph.' };
  }
  return { ok: true, changed: true };
}

const DROP_IN_CLONE = new Set([
  'bookmarkStart',
  'bookmarkEnd',
  'commentRangeStart',
  'commentRangeEnd',
  'del',
  'moveFrom',
  'proofErr',
  'permStart',
  'permEnd',
]);
const DROP_RUN_IF_HAS = new Set([
  'drawing',
  'pict',
  'object',
  'fldChar',
  'instrText',
  'footnoteReference',
  'endnoteReference',
  'commentReference',
  'AlternateContent',
  'sym',
]);

function sanitizeClone(root) {
  // Attributes that must be unique per paragraph.
  const attrs = [...(root.attributes ? Array.from(root.attributes) : [])];
  for (const a of attrs) if (a.localName === 'paraId' || a.localName === 'textId') root.removeAttributeNode(a);

  for (const child of childElements(root)) {
    if (child.namespaceURI === NS.w && DROP_IN_CLONE.has(child.localName)) {
      root.removeChild(child);
    } else if (isW(child, 'hyperlink')) {
      sanitizeClone(child);
      while (child.firstChild) root.insertBefore(child.firstChild, child);
      root.removeChild(child);
    } else if (isW(child, 'r')) {
      const hasDropped = childElements(child).some((c) => DROP_RUN_IF_HAS.has(c.localName));
      const hasPageBreak = childElements(child).some(
        (c) => isW(c, 'br') && (c.getAttributeNS(NS.w, 'type') || c.getAttribute('w:type')) === 'page',
      );
      if (hasDropped || hasPageBreak) root.removeChild(child);
    } else if (isW(child, 'pPr')) {
      for (const pc of childElements(child)) {
        if (isW(pc, 'sectPr') || isW(pc, 'pageBreakBefore')) child.removeChild(pc);
      }
    } else if (isW(child, 'ins') || isW(child, 'sdt') || isW(child, 'sdtContent') || isW(child, 'smartTag') || isW(child, 'fldSimple')) {
      sanitizeClone(child);
    }
  }
}

/**
 * Inserts a new paragraph after `anchor`, cloned from the anchor so it inherits the same
 * paragraph properties, numbering (bullets) and run formatting.
 */
export function insertParagraphAfter(anchor, newTextRaw) {
  const clone = anchor.cloneNode(true);
  sanitizeClone(clone);
  const segs = paragraphSegments(clone);
  if (!segs.some((s) => s.kind === 't')) {
    return { ok: false, reason: 'The neighbouring paragraph has no text formatting to reuse for a new paragraph.' };
  }
  // Keep only the first text-bearing run so the new paragraph has uniform formatting.
  const firstT = segs.find((s) => s.kind === 't');
  for (const s of segs) {
    if (s.run !== firstT.run && s.node.parentNode) s.node.parentNode.removeChild(s.node);
  }
  for (const s of segs) {
    if (s.run === firstT.run && s.kind === 'special') s.node.parentNode.removeChild(s.node);
  }
  // Collapse multiple w:t in the first run.
  const ts = childElements(firstT.run).filter((c) => isW(c, 't'));
  ts.slice(1).forEach((t) => firstT.run.removeChild(t));

  const text = String(newTextRaw).replace(/[\r\n\t]+/g, ' ');
  const res = replaceParagraphText(clone, text);
  if (!res.ok) return res;
  anchor.parentNode.insertBefore(clone, anchor.nextSibling);
  return { ok: true, changed: true, element: clone };
}
