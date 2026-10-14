import { NS, childElements, isW } from './package.js';

const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const TRANSPARENT = new Set(['hyperlink', 'ins', 'smartTag', 'sdt', 'sdtContent', 'fldSimple', 'customXml', 'moveTo', 'dir', 'bdo']);

const isMcFallback = (el) => el.namespaceURI === MC_NS && el.localName === 'Fallback';

/**
 * Lists every paragraph of a part in a deterministic document order.
 * `mc:Fallback` branches are skipped so text boxes are not counted twice.
 */
export function enumerateParagraphs(root) {
  const out = [];
  const walk = (node, ctx) => {
    for (const child of childElements(node)) {
      if (isMcFallback(child)) continue;
      if (isW(child, 'p')) {
        out.push({ el: child, inTable: ctx.inTable, inTextbox: ctx.inTextbox });
        walk(child, ctx);
      } else if (isW(child, 'tbl')) {
        walk(child, { ...ctx, inTable: true });
      } else if (isW(child, 'txbxContent')) {
        walk(child, { ...ctx, inTextbox: true });
      } else {
        walk(child, ctx);
      }
    }
  };
  walk(root, { inTable: false, inTextbox: false });
  return out;
}

function collectRun(run, segs) {
  for (const c of childElements(run)) {
    if (c.namespaceURI !== NS.w) continue;
    switch (c.localName) {
      case 't':
        segs.push({ kind: 't', node: c, run });
        break;
      case 'tab':
        segs.push({ kind: 'special', ch: '\t', node: c, run });
        break;
      case 'br': {
        const type = c.getAttributeNS(NS.w, 'type') || c.getAttribute('w:type');
        if (!type || type === 'textWrapping') segs.push({ kind: 'special', ch: '\n', node: c, run });
        break;
      }
      case 'cr':
        segs.push({ kind: 'special', ch: '\n', node: c, run });
        break;
      case 'noBreakHyphen':
        segs.push({ kind: 'special', ch: '-', node: c, run });
        break;
      default:
    }
  }
}

function collect(el, segs) {
  for (const c of childElements(el)) {
    if (c.namespaceURI !== NS.w) continue;
    if (c.localName === 'r') collectRun(c, segs);
    else if (TRANSPARENT.has(c.localName)) collect(c, segs);
  }
}

/** Ordered text-bearing nodes of a paragraph (this paragraph only, not nested text boxes). */
export function paragraphSegments(p) {
  const segs = [];
  collect(p, segs);
  return segs;
}

export function segmentText(seg) {
  return seg.kind === 't' ? seg.node.textContent || '' : seg.ch;
}

export function paragraphText(p) {
  return paragraphSegments(p).map(segmentText).join('');
}

export function paragraphProps(p) {
  const props = { styleId: null, isListItem: false, hasHyperlink: false, hasField: false, hasTrackedChanges: false };
  for (const c of childElements(p)) {
    if (isW(c, 'pPr')) {
      for (const pc of childElements(c)) {
        if (isW(pc, 'pStyle')) props.styleId = pc.getAttributeNS(NS.w, 'val') || pc.getAttribute('w:val');
        if (isW(pc, 'numPr')) {
          const numId = childElements(pc).find((n) => isW(n, 'numId'));
          const val = numId && (numId.getAttributeNS(NS.w, 'val') || numId.getAttribute('w:val'));
          if (val && val !== '0') props.isListItem = true;
        }
      }
    }
    if (isW(c, 'hyperlink')) props.hasHyperlink = true;
    if (isW(c, 'fldSimple')) props.hasField = true;
    if (isW(c, 'ins') || isW(c, 'del')) props.hasTrackedChanges = true;
  }
  // Complex fields live inside runs.
  const scan = (el) => {
    for (const c of childElements(el)) {
      if (isW(c, 'r')) {
        for (const rc of childElements(c)) {
          if (isW(rc, 'fldChar') || isW(rc, 'instrText')) props.hasField = true;
        }
      } else if (TRANSPARENT.has(c.localName) && c.namespaceURI === NS.w) scan(c);
    }
  };
  scan(p);
  return props;
}
