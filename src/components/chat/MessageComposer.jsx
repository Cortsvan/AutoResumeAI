import React, { useState, useRef } from 'react';
import { useStore, toast, setUi } from '../../app/store.js';
import { sendMessage } from '../../services/chatOrchestrator.js';
import { importDocxFile } from '../../services/resumeRepo.js';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Paperclip, Send, X, FileText, Target, ShieldCheck } from 'lucide-react';
import { validateDocxFile } from '../../utils/files.js';

export function MessageComposer({
  conversationId,
  activeResume,
  onOpenTailorModal,
  onOpenUploadModal,
}) {
  const [text, setText] = useState('');
  const [stagedFile, setStagedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const busy = useStore((s) => Boolean(s.ui.busy[conversationId]));

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = await validateDocxFile(file);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    setStagedFile(file);
    e.target.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !stagedFile) || busy || isUploading) return;

    let attachedFile = stagedFile;
    setStagedFile(null);

    // If a new DOCX file is attached with the message, import it first
    if (attachedFile) {
      setIsUploading(true);
      try {
        const imported = await importDocxFile(attachedFile);
        toast(`Imported "${attachedFile.name}" as active resume.`, 'success');
        setUi({ focusResumeId: imported.id, previewOpen: true });
      } catch (err) {
        toast(`Upload failed: ${err.message}`, 'error');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const currentText = text;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage(conversationId, currentText, attachedFile);
  };

  return (
    <div className="border-t border-line-strong bg-surface p-3 sm:p-4">
      {/* Context info bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 text-xs text-ink-muted">
        <div className="flex flex-wrap items-center gap-1.5">
          {activeResume ? (
            <Badge variant="accent" size="xs" className="gap-1">
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {activeResume.name}
              </span>
            </Badge>
          ) : (
            <button
              onClick={onOpenUploadModal}
              className="text-[11px] text-accent hover:underline flex items-center gap-1"
            >
              <Paperclip className="w-3 h-3" />
              Attach resume (.docx)
            </button>
          )}

          {activeResume?.targetJob?.title && (
            <Badge variant="ok" size="xs" className="gap-1">
              <Target className="w-3 h-3" />
              <span className="truncate max-w-[140px]">
                {activeResume.targetJob.title}
              </span>
            </Badge>
          )}

          <Badge variant="neutral" size="xs" className="gap-1 hidden sm:inline-flex">
            <ShieldCheck className="w-3 h-3 text-ok" />
            <span>Preserve design</span>
          </Badge>
        </div>

        {activeResume && (
          <button
            onClick={onOpenTailorModal}
            className="text-[11px] text-ink-soft hover:text-ink hover:underline flex items-center gap-1"
          >
            <Target className="w-3 h-3 text-accent" />
            {activeResume.targetJob?.title ? 'Edit target job' : 'Tailor to a job'}
          </button>
        )}
      </div>

      {/* Staged file chip */}
      {stagedFile && (
        <div className="mb-2 flex items-center justify-between px-3 py-1.5 bg-accent-soft/50 border border-accent-line rounded text-xs text-ink">
          <div className="flex items-center gap-2 truncate">
            <FileText className="w-4 h-4 text-accent shrink-0" />
            <span className="font-medium truncate">{stagedFile.name}</span>
            <span className="text-ink-faint text-[11px]">
              ({Math.round(stagedFile.size / 1024)} KB)
            </span>
          </div>
          <button
            onClick={() => setStagedFile(null)}
            className="p-0.5 text-ink-faint hover:text-bad"
            title="Remove attachment"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input container */}
      <div className="relative flex items-end gap-2 bg-sunken/40 border border-line-strong rounded-lg p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition-all">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
        />

        {/* Attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-ink-soft hover:text-ink hover:bg-surface rounded transition-colors shrink-0"
          title="Upload Word (.docx) resume"
          disabled={busy || isUploading}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            activeResume
              ? "Describe the job you want, paste a job description, or ask: 'Improve my bullet points'..."
              : "Ask a question, or attach a .docx resume to begin..."
          }
          className="flex-1 bg-transparent border-0 p-1 text-sm text-ink placeholder:text-ink-faint focus:outline-none resize-none max-h-40 leading-relaxed"
          disabled={busy || isUploading}
        />

        {/* Send button */}
        <Button
          type="button"
          size="sm"
          variant="primary"
          icon={Send}
          loading={busy || isUploading}
          disabled={(!text.trim() && !stagedFile) || busy || isUploading}
          onClick={handleSend}
          className="shrink-0 h-8 w-8 !p-0 rounded"
          title="Send message (Enter)"
        />
      </div>

      <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-ink-faint">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>DOCX format only</span>
      </div>
    </div>
  );
}
