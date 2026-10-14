import React from 'react';
import { useStore, dismissToast } from '../../app/store.js';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);

  if (!toasts.length) return null;

  const icons = {
    info: <Info className="w-4 h-4 text-accent shrink-0" />,
    success: <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />,
    warn: <AlertTriangle className="w-4 h-4 text-warn shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-bad shrink-0" />,
  };

  const borders = {
    info: 'border-accent-line bg-surface',
    success: 'border-ok-line bg-surface',
    warn: 'border-warn-line bg-surface',
    error: 'border-bad-line bg-surface',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded border shadow-pop animate-fade-in ${
            borders[t.kind] || borders.info
          }`}
        >
          {icons[t.kind] || icons.info}
          <div className="flex-1 text-xs text-ink leading-relaxed break-words">{t.message}</div>
          <button
            onClick={() => dismissToast(t.id)}
            className="p-0.5 text-ink-faint hover:text-ink rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
