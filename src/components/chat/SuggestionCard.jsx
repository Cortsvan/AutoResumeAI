import React, { useState } from 'react';
import { DiffViewer } from '../ui/DiffViewer.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Check, X, Edit2, AlertTriangle, ArrowRight } from 'lucide-react';

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onEditAndAccept,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(suggestion.proposed);
  const [viewMode, setViewMode] = useState('inline'); // 'inline' | 'split'

  const { id, section, original, proposed, explanation, warnings, status, failMessage, appliedText } =
    suggestion;

  const handleSaveEdit = () => {
    onEditAndAccept(id, editedText);
    setIsEditing(false);
  };

  const statusBadges = {
    pending: <Badge variant="neutral">Pending Review</Badge>,
    applied: <Badge variant="ok">Applied to DOCX</Badge>,
    rejected: <Badge variant="neutral">Rejected</Badge>,
    failed: <Badge variant="bad">Could Not Apply Safely</Badge>,
  };

  return (
    <div
      className={`border rounded-md overflow-hidden transition-all text-xs ${
        status === 'applied'
          ? 'bg-ok-soft/20 border-ok-line'
          : status === 'rejected'
          ? 'bg-sunken/40 border-line opacity-60'
          : status === 'failed'
          ? 'bg-bad-soft/20 border-bad-line'
          : 'bg-surface border-line-strong shadow-panel'
      }`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-sunken/50 border-b border-line">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink uppercase tracking-wide text-[10px]">
            {section || 'Paragraph'}
          </span>
          {suggestion.kind === 'insert_after' && (
            <Badge variant="accent" size="xs">
              Insert New Bullet
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {statusBadges[status] || statusBadges.pending}
          {status === 'pending' && !isEditing && (
            <button
              onClick={() => setViewMode(viewMode === 'inline' ? 'split' : 'inline')}
              className="text-[10px] text-ink-muted hover:text-ink underline ml-1"
            >
              {viewMode === 'inline' ? 'Side-by-side' : 'Inline diff'}
            </button>
          )}
        </div>
      </div>

      {/* Body content */}
      <div className="p-3.5 space-y-3">
        {/* Diff view or Edit textarea */}
        {isEditing ? (
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ink-soft block">
              Edit proposed text before applying:
            </label>
            <textarea
              rows={3}
              className="w-full field text-xs leading-relaxed"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSaveEdit}>
                Save & Apply
              </Button>
            </div>
          </div>
        ) : (
          <DiffViewer
            oldText={original}
            newText={status === 'applied' ? appliedText || proposed : proposed}
            mode={viewMode}
          />
        )}

        {/* Explanation */}
        {explanation && (
          <p className="text-xs text-ink-soft leading-relaxed italic border-l-2 border-accent/40 pl-2.5 py-0.5">
            {explanation}
          </p>
        )}

        {/* Warnings or items requiring user confirmation */}
        {warnings && warnings.length > 0 && status === 'pending' && (
          <div className="p-2.5 bg-warn-soft/60 border border-warn-line rounded flex items-start gap-2 text-[11px] text-warn">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="leading-snug">
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failure message if application failed safely */}
        {failMessage && (
          <div className="p-2.5 bg-bad-soft border border-bad-line rounded text-[11px] text-bad">
            {failMessage}
          </div>
        )}
      </div>

      {/* Actions toolbar */}
      {status === 'pending' && !isEditing && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-sunken/30 border-t border-line">
          <Button
            size="sm"
            variant="ghost"
            icon={Edit2}
            onClick={() => setIsEditing(true)}
            className="text-[11px] h-6 px-2 text-ink-muted"
          >
            Edit
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={X}
              onClick={() => onReject(id)}
              className="text-[11px] h-6 px-2"
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={Check}
              onClick={() => onAccept(id)}
              className="text-[11px] h-6 px-2.5"
            >
              Accept & Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
