import React, { useState, useRef } from 'react';
import { useStore, toast, setUi, updateConversation } from '../../app/store.js';
import { sendMessage } from '../../services/chatOrchestrator.js';
import { importDocxFile } from '../../services/resumeRepo.js';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Paperclip, Image as ImageIcon, Send, X, FileText, Target, ShieldCheck, PlusCircle } from 'lucide-react';
import { validateDocxFile } from '../../utils/files.js';
import { processScreenshotFile, extractImagesFromClipboard } from '../../utils/images.js';

export function MessageComposer({
  conversationId,
  activeResume,
  onOpenTailorModal,
  onOpenUploadModal,
  onOpenCreateModal,
}) {
  const [text, setText] = useState('');
  const [stagedFile, setStagedFile] = useState(null);
  const [stagedImages, setStagedImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
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

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      try {
        const processed = await processScreenshotFile(file);
        setStagedImages((prev) => [...prev, processed].slice(0, 5));
      } catch (err) {
        toast(err.message, 'error');
      }
    }
    e.target.value = '';
  };

  const handlePaste = async (e) => {
    const images = extractImagesFromClipboard(e.clipboardData);
    if (images.length > 0) {
      e.preventDefault();
      for (const file of images) {
        try {
          const processed = await processScreenshotFile(file);
          setStagedImages((prev) => [...prev, processed].slice(0, 5));
          toast('Screenshot attached from clipboard.', 'info');
        } catch (err) {
          toast(err.message, 'error');
        }
      }
    }
  };

  const removeStagedImage = (id) => {
    setStagedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !stagedFile && stagedImages.length === 0) || busy || isUploading) return;

    let attachedFile = stagedFile;
    const currentImages = [...stagedImages];
    setStagedFile(null);
    setStagedImages([]);

    // If a new DOCX file is attached with the message, import it first
    if (attachedFile) {
      setIsUploading(true);
      try {
        const imported = await importDocxFile(attachedFile);
        if (conversationId) {
          updateConversation(conversationId, (c) => ({
            context: { ...c.context, activeResumeId: imported.id, creating: false },
          }));
        }
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

    await sendMessage(conversationId, currentText, attachedFile, currentImages);
  };

  const handleDetachResume = () => {
    if (conversationId) {
      updateConversation(conversationId, (c) => ({
        context: { ...c.context, activeResumeId: null },
      }));
      toast('Detached resume from this conversation.', 'info');
    }
  };

  return (
    <div className="border-t border-line-strong bg-surface p-3 sm:p-4">
      {/* Context info bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 text-xs text-ink-muted">
        <div className="flex flex-wrap items-center gap-1.5">
          {activeResume ? (
            <Badge variant="accent" size="xs" className="gap-1 pl-2 pr-1 py-0.5">
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {activeResume.name}
              </span>
              <button
                type="button"
                onClick={handleDetachResume}
                className="p-0.5 hover:text-bad text-ink-muted rounded transition-colors"
                title="Detach resume from this conversation"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
              >
                <Paperclip className="w-3 h-3" />
                Attach resume (.docx)
              </button>
              <span className="text-line-strong">•</span>
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
              >
                <PlusCircle className="w-3 h-3" />
                Create from scratch
              </button>
            </div>
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

      {/* Staged screenshots strip */}
      {stagedImages.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {stagedImages.map((img) => (
            <div
              key={img.id}
              className="group relative flex items-center gap-2 p-1.5 pr-2 bg-surface border border-line-strong rounded-lg shadow-sm text-xs text-ink"
            >
              <img
                src={img.dataUrl}
                alt={img.name}
                className="w-9 h-9 object-cover rounded border border-line"
              />
              <div className="flex flex-col min-w-0 max-w-[120px]">
                <span className="font-medium truncate text-[11px] leading-tight">{img.name}</span>
                <span className="text-[10px] text-ink-faint">
                  {Math.round(img.size / 1024)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeStagedImage(img.id)}
                className="p-1 text-ink-faint hover:text-bad hover:bg-bad-soft rounded transition-colors"
                title="Remove screenshot"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container */}
      <div className="relative flex items-end gap-2 bg-sunken/40 border border-line-strong rounded-lg p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 transition-all">
        {/* Hidden DOCX file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
        />

        {/* Hidden screenshot file input */}
        <input
          type="file"
          ref={imageInputRef}
          onChange={handleImageSelect}
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
        />

        {/* DOCX Attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-ink-soft hover:text-ink hover:bg-surface rounded transition-colors shrink-0"
          title="Upload Word (.docx) resume"
          disabled={busy || isUploading}
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Screenshot / Image attachment button */}
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="p-2 text-ink-soft hover:text-accent hover:bg-surface rounded transition-colors shrink-0"
          title="Attach screenshot or image (or paste directly with Ctrl+V)"
          disabled={busy || isUploading}
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onPaste={handlePaste}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            activeResume
              ? "Ask a question, describe details, or paste/attach screenshots of your target resume..."
              : "Ask a question, attach a .docx resume, or paste/attach a screenshot of your resume..."
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
          disabled={(!text.trim() && !stagedFile && stagedImages.length === 0) || busy || isUploading}
          onClick={handleSend}
          className="shrink-0 h-8 w-8 !p-0 rounded"
          title="Send message (Enter)"
        />
      </div>

      <div className="flex items-center justify-between mt-1.5 px-1 text-[11px] text-ink-faint">
        <span>Paste screenshots with Ctrl+V · Press Enter to send</span>
        <span>DOCX & image references supported</span>
      </div>
    </div>
  );
}
