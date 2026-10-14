import React, { useMemo } from 'react';
import { diffTokens } from '../../utils/textDiff.js';

export function DiffViewer({ oldText, newText, mode = 'inline' }) {
  const ops = useMemo(() => {
    return diffTokens(oldText || '', newText || '');
  }, [oldText, newText]);

  if (mode === 'split') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-normal">
        <div className="p-3 bg-bad-soft/40 border border-bad-line rounded">
          <div className="text-[11px] font-medium text-bad mb-1.5 uppercase tracking-wide">Original</div>
          <div className="text-ink-soft leading-relaxed whitespace-pre-wrap">{oldText}</div>
        </div>
        <div className="p-3 bg-ok-soft/40 border border-ok-line rounded">
          <div className="text-[11px] font-medium text-ok mb-1.5 uppercase tracking-wide">Proposed</div>
          <div className="text-ink leading-relaxed whitespace-pre-wrap">{newText}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-sunken/40 border border-line rounded text-xs leading-relaxed font-normal whitespace-pre-wrap">
      {ops.map((op, i) => {
        if (op.type === 'equal') {
          return <span key={i} className="text-ink-soft">{op.text}</span>;
        }
        if (op.type === 'delete') {
          return (
            <span
              key={i}
              className="bg-bad-soft text-bad line-through decoration-bad/70 px-0.5 rounded-xs"
              title="Removed"
            >
              {op.text}
            </span>
          );
        }
        if (op.type === 'insert') {
          return (
            <span
              key={i}
              className="bg-ok-soft text-ok font-medium px-0.5 rounded-xs"
              title="Added"
            >
              {op.text}
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}
