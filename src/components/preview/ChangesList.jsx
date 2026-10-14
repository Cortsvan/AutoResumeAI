import React from 'react';
import { relativeTime } from '../../utils/format.js';
import { undoLastVersion } from '../../services/resumeRepo.js';
import { toast, setUi } from '../../app/store.js';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { DiffViewer } from '../ui/DiffViewer.jsx';
import { History, Undo2, CheckCircle2, FileText, ArrowRight } from 'lucide-react';

export function ChangesList({ resume, currentViewing, onSelectVersion }) {
  const versions = resume.versions || [];
  const changes = resume.changes || [];

  const handleUndo = async () => {
    try {
      const undone = await undoLastVersion(resume.id);
      if (undone) {
        toast(`Undid version: "${undone.label}".`, 'info');
      } else {
        toast('No changes to undo.', 'info');
      }
    } catch (err) {
      toast(err.message || 'Error undoing last change.', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 text-xs bg-paper">
      {/* Top undo action */}
      <div className="flex items-center justify-between p-3.5 bg-surface border border-line-strong rounded-lg shadow-panel">
        <div>
          <h4 className="font-semibold text-ink flex items-center gap-1.5">
            <History className="w-4 h-4 text-accent" />
            Document Version History
          </h4>
          <p className="text-[11px] text-ink-muted mt-0.5">
            {versions.length} version{versions.length > 1 ? 's' : ''} saved locally. Your original file remains untouched.
          </p>
        </div>

        {versions.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            icon={Undo2}
            onClick={handleUndo}
            className="text-xs"
          >
            Undo Last Edit
          </Button>
        )}
      </div>

      {/* Versions timeline */}
      <div className="space-y-3">
        <h5 className="font-semibold text-ink text-xs uppercase tracking-wide px-1">
          Saved Revisions
        </h5>

        <div className="space-y-2">
          {versions
            .slice()
            .reverse()
            .map((v, idx) => {
              const isCurrent = idx === 0;
              const isViewing = currentViewing === v.id || (isCurrent && currentViewing === 'current');

              return (
                <div
                  key={v.id}
                  className={`p-3.5 rounded-lg border transition-all ${
                    isViewing
                      ? 'bg-surface border-accent ring-1 ring-accent/30 shadow-panel'
                      : 'bg-surface/80 border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent shrink-0" />
                      <span className="font-semibold text-ink">{v.label}</span>
                      {isCurrent && <Badge variant="ok" size="xs">Current Active Copy</Badge>}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-ink-faint">
                        {relativeTime(v.createdAt)}
                      </span>
                      {!isViewing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectVersion(v.id)}
                          className="h-6 px-2 text-[11px]"
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Applied Changes Log */}
      <div className="space-y-3 pt-2">
        <h5 className="font-semibold text-ink text-xs uppercase tracking-wide px-1">
          Applied Content Modifications ({changes.length})
        </h5>

        {changes.length === 0 ? (
          <div className="p-6 bg-surface border border-line rounded-lg text-center text-ink-muted text-xs">
            No AI suggestions or edits have been accepted yet. As you accept suggestions in the chat, they will be logged here with word-level diffs.
          </div>
        ) : (
          <div className="space-y-3">
            {changes
              .slice()
              .reverse()
              .map((c) => (
                <div key={c.id} className="p-3.5 bg-surface border border-line rounded-lg space-y-2 shadow-panel">
                  <div className="flex items-center justify-between border-b border-line pb-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 font-medium text-ink">
                      <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
                      <span>{c.section || 'Paragraph edit'}</span>
                    </div>
                    <span className="text-ink-faint">{relativeTime(c.at)}</span>
                  </div>

                  <DiffViewer oldText={c.original} newText={c.proposed} mode="inline" />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
