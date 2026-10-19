import React, { useCallback, useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Button } from '../ui/Button.jsx';
import { ZoomIn, ZoomOut, RotateCcw, AlertCircle, FileText, Pencil, Save, Undo2 } from 'lucide-react';

/* ----------------------------- text helpers ----------------------------- */

const fuzzy = (s) =>
  (s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Plain text of a rendered paragraph; <br> becomes a newline, nbsp becomes a space. */
function domText(el) {
  let out = '';
  const walk = (node) => {
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeName === 'BR') out += '\n';
      else if (c.nodeType === 1) walk(c);
    });
  };
  walk(el);
  return out.replace(/\u00a0/g, ' ');
}

/**
 * The browser preview has no tab characters (tabs are rendered as empty spaced spans),
 * so apply the user's change onto the ORIGINAL paragraph text instead of replacing it.
 * That keeps tabs (and therefore column layouts) intact. Returns null when the rendered text
 * does not line up with the original, in which case the paragraph is not saved.
 */
function mergeIntoOriginal(orig, before, after) {
  const map = [];
  let stripped = '';
  for (let i = 0; i < orig.length; i += 1) {
    if (orig[i] === '\t') continue;
    map.push(i);
    stripped += orig[i] === '\u00a0' ? ' ' : orig[i];
  }
  if (stripped !== before) return null;

  const minLen = Math.min(before.length, after.length);
  let p = 0;
  while (p < minLen && before[p] === after[p]) p += 1;
  let q = 0;
  while (q < minLen - p && before[before.length - 1 - q] === after[after.length - 1 - q]) q += 1;

  const delStart = p;
  const delEnd = before.length - q;
  const inserted = after.slice(p, after.length - q);

  const startPos = delEnd > delStart ? map[delStart] : delStart > 0 ? map[delStart - 1] + 1 : 0;
  const endPos = delEnd < map.length ? map[delEnd] : orig.length;
  const keptTabs = orig.slice(startPos, endPos).replace(/[^\t]/g, '');
  return orig.slice(0, startPos) + inserted + keptTabs + orig.slice(endPos);
}

/** Pairs rendered body paragraphs with the parsed paragraph list (same order, text-verified). */
function matchParagraphs(domParas, bodyParas) {
  const matches = [];
  let j = 0;
  for (const el of domParas) {
    const text = fuzzy(domText(el));
    if (!text) {
      if (j < bodyParas.length && !fuzzy(bodyParas[j].text)) j += 1;
      continue;
    }
    const limit = Math.min(j + 8, bodyParas.length);
    for (let k = j; k < limit; k += 1) {
      if (fuzzy(bodyParas[k].text) === text) {
        if (bodyParas[k].editable) matches.push({ el, para: bodyParas[k] });
        j = k + 1;
        break;
      }
    }
  }
  return matches;
}

const EDIT_STYLES = `
.docx-host [data-edit-id]{cursor:text;transition:background 120ms ease,outline-color 120ms ease;outline:1px dashed transparent;outline-offset:2px;border-radius:2px}
.docx-host.is-editing [data-edit-id]:hover{outline-color:rgba(99,102,241,.55)}
.docx-host.is-editing [data-edit-id]:focus{outline:2px solid rgba(99,102,241,.85);background:rgba(99,102,241,.06)}
.docx-host [data-edit-dirty="1"]{background:rgba(250,204,21,.22)}
`;

/* -------------------------------- viewer -------------------------------- */

export function DocxViewer({
  blob,
  resumeName,
  isOriginal = false,
  paragraphs = null,
  canEdit = false,
  onSaveEdits = null,
}) {
  const containerRef = useRef(null);
  const matchesRef = useRef([]);
  const dirtyRef = useRef(new Map()); // paragraph id -> { el, para, before }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [editMode, setEditMode] = useState(true);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  const editingEnabled = Boolean(canEdit && editMode && !isOriginal);

  const applyEditable = useCallback(() => {
    for (const { el, para } of matchesRef.current) {
      if (editingEnabled) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'true');
        el.setAttribute('data-edit-id', para.id);
      } else {
        el.removeAttribute('contenteditable');
        el.removeAttribute('data-edit-id');
      }
    }
  }, [editingEnabled]);

  useEffect(() => {
    let active = true;
    if (!blob || !containerRef.current) return;

    setLoading(true);
    setError(null);
    dirtyRef.current = new Map();
    matchesRef.current = [];
    setDirtyCount(0);
    containerRef.current.innerHTML = '';

    renderAsync(blob, containerRef.current, null, {
      className: 'docx',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      experimental: false,
      useBase64URL: false,
      renderChanges: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    })
      .then(() => {
        if (!active) return;
        if (canEdit && paragraphs?.length && containerRef.current) {
          const domParas = Array.from(containerRef.current.querySelectorAll('article p'));
          const body = paragraphs.filter((p) => p.part === 'body');
          matchesRef.current = matchParagraphs(domParas, body).map((m) => ({
            ...m,
            before: domText(m.el),
          }));
        }
        applyEditable();
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Docx render error:', err);
        setError('This document could not be previewed directly in the browser. You can still download the genuine .docx file below to view it.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob, renderKey]);

  useEffect(() => {
    applyEditable();
  }, [applyEditable]);

  // Delegated listeners so typing in any rendered paragraph is tracked.
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return undefined;

    const paragraphOf = (target) => (target instanceof Element ? target.closest('[data-edit-id]') : null);

    const onInput = (e) => {
      const el = paragraphOf(e.target);
      if (!el) return;
      const match = matchesRef.current.find((m) => m.el === el);
      if (!match) return;
      const changed = domText(el) !== match.before;
      if (changed) {
        dirtyRef.current.set(match.para.id, match);
        el.setAttribute('data-edit-dirty', '1');
      } else {
        dirtyRef.current.delete(match.para.id);
        el.removeAttribute('data-edit-dirty');
      }
      setDirtyCount(dirtyRef.current.size);
    };

    const onKeyDown = (e) => {
      if (!paragraphOf(e.target)) return;
      // One rendered paragraph maps to one Word paragraph; Shift+Enter inserts a line break.
      if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
    };

    const onPaste = (e) => {
      if (!paragraphOf(e.target)) return;
      e.preventDefault();
      const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r?\n+/g, ' ');
      document.execCommand('insertText', false, text);
    };

    host.addEventListener('input', onInput);
    host.addEventListener('keydown', onKeyDown);
    host.addEventListener('paste', onPaste);
    return () => {
      host.removeEventListener('input', onInput);
      host.removeEventListener('keydown', onKeyDown);
      host.removeEventListener('paste', onPaste);
    };
  }, []);

  const handleSave = async () => {
    if (!onSaveEdits || dirtyRef.current.size === 0) return;
    const edits = [];
    dirtyRef.current.forEach(({ el, para, before }, id) => {
      const after = domText(el);
      const text = mergeIntoOriginal(para.text, before, after);
      if (text === null || text === para.text) return;
      edits.push({
        id: `u_${Date.now().toString(36)}_${edits.length}`,
        kind: 'replace',
        targetId: id,
        original: para.text,
        text,
        section: para.section || '',
        source: 'user',
      });
    });
    if (!edits.length) {
      dirtyRef.current = new Map();
      setDirtyCount(0);
      return;
    }
    setSaving(true);
    try {
      await onSaveEdits(edits);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => setRenderKey((k) => k + 1);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 15, 140));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 15, 70));
  const handleZoomReset = () => setZoom(100);

  return (
    <div className="relative flex-1 flex flex-col h-full bg-sunken/60 min-h-0 overflow-hidden">
      <style>{EDIT_STYLES}</style>

      {/* Zoom / Viewing Controls Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-line text-xs shrink-0 z-10 gap-2">
        <div className="flex items-center gap-1.5 text-ink-muted text-[11px] min-w-0">
          <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="font-medium text-ink truncate max-w-[160px]">{resumeName}</span>
          {isOriginal && (
            <span className="bg-warn-soft text-warn border border-warn-line px-1 py-0.2 rounded text-[10px]">
              Original File View
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {canEdit && !isOriginal && (
            <>
              <Button
                size="sm"
                variant={editMode ? 'secondary' : 'ghost'}
                icon={Pencil}
                onClick={() => setEditMode((v) => !v)}
                className="h-6 text-[11px] px-2"
                title={editMode ? 'Turn editing off' : 'Edit text directly in the preview'}
              >
                {editMode ? 'Editing' : 'Edit'}
              </Button>
              {dirtyCount > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Undo2}
                    onClick={handleDiscard}
                    disabled={saving}
                    className="h-6 text-[11px] px-2"
                    title="Discard unsaved changes"
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Save}
                    onClick={handleSave}
                    loading={saving}
                    className="h-6 text-[11px] px-2"
                    title="Save edits into the Word document"
                  >
                    Save ({dirtyCount})
                  </Button>
                </>
              )}
              <div className="h-4 w-px bg-line mx-1" />
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={ZoomOut}
            onClick={handleZoomOut}
            disabled={zoom <= 70}
            className="h-6 w-6 !p-0"
            title="Zoom out"
          />
          <span className="text-[11px] text-ink-muted w-9 text-center font-mono">{zoom}%</span>
          <Button
            size="sm"
            variant="ghost"
            icon={ZoomIn}
            onClick={handleZoomIn}
            disabled={zoom >= 140}
            className="h-6 w-6 !p-0"
            title="Zoom in"
          />
          <Button
            size="sm"
            variant="ghost"
            icon={RotateCcw}
            onClick={handleZoomReset}
            className="h-6 w-6 !p-0 ml-0.5"
            title="Reset zoom"
          />
        </div>
      </div>

      {/* Preview Content Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 text-ink-muted my-auto text-xs">
            <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span>Rendering Word document preview...</span>
          </div>
        )}

        {error && (
          <div className="max-w-md my-auto p-4 bg-surface border border-warn-line rounded-lg text-center space-y-2 shadow-panel">
            <AlertCircle className="w-6 h-6 text-warn mx-auto" />
            <p className="text-xs text-ink-soft leading-relaxed">{error}</p>
          </div>
        )}

        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 100ms ease-out',
          }}
          className={`docx-host ${editingEnabled ? 'is-editing' : ''} w-full flex justify-center ${loading || error ? 'hidden' : 'block'}`}
        >
          <div ref={containerRef} className="w-full max-w-[850px]" />
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1 bg-surface border-t border-line text-[10px] text-ink-faint text-center shrink-0">
        {editingEnabled
          ? 'Click any text to edit it. Shift+Enter adds a line break. Press Save to write changes into the Word file; fonts, layout and styles are preserved.'
          : 'In-browser preview approximation. Your desktop word processor will render pages and fonts with exact fidelity.'}
      </div>
    </div>
  );
}
