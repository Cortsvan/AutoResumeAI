import React, { useState, useEffect } from 'react';
import { useStore, setUi } from '../../app/store.js';
import { blobForView, downloadResume, undoLastVersion } from '../../services/resumeRepo.js';
import { DocxViewer } from './DocxViewer.jsx';
import { ChangesList } from './ChangesList.jsx';
import { StructuredEditor } from './StructuredEditor.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  Download,
  Undo2,
  FileText,
  History,
  Edit3,
  Info,
  X,
  Layers,
  ChevronDown,
  ShieldAlert,
} from 'lucide-react';

export function DocxPreviewPanel({ resume, onOpenRedesignModal }) {
  const [tab, setTab] = useState('preview'); // 'preview' | 'changes' | 'editor' | 'info'
  const [viewing, setViewing] = useState('current'); // 'current' | 'original' | <versionId>
  const [blob, setBlob] = useState(null);
  const [loadingBlob, setLoadingBlob] = useState(true);

  // Load the appropriate blob when resume or viewing version changes
  useEffect(() => {
    let active = true;
    if (!resume) {
      setBlob(null);
      setLoadingBlob(false);
      return;
    }

    setLoadingBlob(true);
    blobForView(resume, viewing)
      .then((b) => {
        if (!active) return;
        setBlob(b);
        setLoadingBlob(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Blob load error:', err);
        setLoadingBlob(false);
      });

    return () => {
      active = false;
    };
  }, [resume?.id, resume?.versions?.length, viewing]);

  if (!resume) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink-muted bg-paper text-xs space-y-3">
        <div className="w-12 h-12 rounded-full bg-sunken border border-line flex items-center justify-center">
          <FileText className="w-6 h-6 text-ink-faint" />
        </div>
        <p className="font-medium text-ink">No resume selected for preview</p>
        <p className="max-w-xs text-ink-faint leading-relaxed">
          Upload a DOCX (.docx) resume or create one to preview it live.
        </p>
      </div>
    );
  }

  const versions = resume.versions || [];
  const features = resume.features || {};
  const notes = resume.notes || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-paper min-w-0 border-l border-line">
      {/* Top action header */}
      <div className="px-4 py-2.5 bg-surface border-b border-line shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Version Switcher */}
          <div className="relative flex items-center gap-1.5 min-w-0">
            <select
              value={viewing}
              onChange={(e) => setViewing(e.target.value)}
              className="text-xs font-semibold text-ink bg-sunken hover:bg-line-strong px-2.5 py-1.5 rounded border border-line focus:outline-none focus:border-accent cursor-pointer truncate max-w-[200px]"
              title="Switch document version to view"
            >
              <option value="current">Current Version ({versions.length})</option>
              {resume.kind === 'imported' && (
                <option value="original">Original Uploaded File</option>
              )}
              {versions.slice(0, -1).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Download & Mobile Close */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              icon={Download}
              onClick={() => downloadResume(resume)}
              title="Download .docx resume"
              className="text-xs"
            >
              Download DOCX
            </Button>

            <button
              onClick={() => setUi({ mobileView: 'chat', previewOpen: false })}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-sunken rounded lg:hidden"
              title="Back to chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 pt-1 border-t border-line text-xs">
          <button
            onClick={() => setTab('preview')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              tab === 'preview'
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:text-ink hover:bg-sunken'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setTab('changes')}
            className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1 ${
              tab === 'changes'
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:text-ink hover:bg-sunken'
            }`}
          >
            History & Changes
            {resume.changes?.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] flex items-center justify-center font-bold">
                {resume.changes.length}
              </span>
            )}
          </button>
          {resume.kind === 'created' && (
            <button
              onClick={() => setTab('editor')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                tab === 'editor'
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-muted hover:text-ink hover:bg-sunken'
              }`}
            >
              Form Editor
            </button>
          )}
          <button
            onClick={() => setTab('info')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              tab === 'info'
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:text-ink hover:bg-sunken'
            }`}
          >
            Fidelity & Details
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'preview' && (
          <DocxViewer
            blob={blob}
            resumeName={resume.name}
            isOriginal={viewing === 'original'}
          />
        )}

        {tab === 'changes' && (
          <ChangesList
            resume={resume}
            currentViewing={viewing}
            onSelectVersion={(vId) => {
              setViewing(vId);
              setTab('preview');
            }}
          />
        )}

        {tab === 'editor' && resume.kind === 'created' && (
          <StructuredEditor resume={resume} />
        )}

        {tab === 'info' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs bg-paper">
            {/* Preservation badge */}
            <div className="p-4 bg-surface border border-line-strong rounded-lg shadow-panel space-y-2">
              <div className="flex items-center gap-2 font-semibold text-ink text-sm">
                <Layers className="w-4 h-4 text-accent" />
                <span>Original Document Fidelity</span>
              </div>
              <p className="text-xs text-ink-soft leading-relaxed">
                When you import a Word document, AutoResumeAI edits only the approved text runs
                inside the underlying OpenXML package. Margins, fonts, tables, tabs, and styles are
                retained.
              </p>
            </div>

            {/* Document stats */}
            <div className="p-4 bg-surface border border-line rounded-lg shadow-panel space-y-3">
              <h4 className="font-semibold text-ink border-b border-line pb-1.5">Document Specifications</h4>
              <div className="grid grid-cols-2 gap-3 text-ink-soft">
                <div>
                  <span className="text-ink-faint block text-[10px] uppercase">Page Size</span>
                  <span className="font-medium text-ink">{features.pageSize || 'Letter'}</span>
                </div>
                <div>
                  <span className="text-ink-faint block text-[10px] uppercase">Columns</span>
                  <span className="font-medium text-ink">{features.columns || 1}</span>
                </div>
                <div>
                  <span className="text-ink-faint block text-[10px] uppercase">Tables</span>
                  <span className="font-medium text-ink">{features.tables || 0}</span>
                </div>
                <div>
                  <span className="text-ink-faint block text-[10px] uppercase">Paragraph Count</span>
                  <span className="font-medium text-ink">{resume.paragraphs?.length || 0}</span>
                </div>
              </div>

              {features.fonts && features.fonts.length > 0 && (
                <div className="pt-2 border-t border-line">
                  <span className="text-ink-faint block text-[10px] uppercase mb-1">Detected Fonts</span>
                  <div className="flex flex-wrap gap-1.5">
                    {features.fonts.map((f, i) => (
                      <Badge key={i} variant="neutral" size="xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Fidelity notes */}
            {notes.length > 0 && (
              <div className="p-4 bg-surface border border-line rounded-lg shadow-panel space-y-2">
                <h4 className="font-semibold text-ink border-b border-line pb-1.5">Preservation Notes</h4>
                <ul className="space-y-1.5 text-ink-soft list-disc list-inside">
                  {notes.map((note, i) => (
                    <li key={i} className="leading-snug">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
