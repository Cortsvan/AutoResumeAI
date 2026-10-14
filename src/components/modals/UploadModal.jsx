import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { importDocxFile } from '../../services/resumeRepo.js';
import { validateDocxFile } from '../../utils/files.js';
import { toast, setUi, updateConversation } from '../../app/store.js';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';

export function UploadModal({ isOpen, onClose, conversationId }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (!droppedFile) return;
    const problem = await validateDocxFile(droppedFile);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    setFile(droppedFile);
  };

  const handleSelect = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const problem = await validateDocxFile(selected);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const record = await importDocxFile(file);
      if (conversationId) {
        updateConversation(conversationId, (c) => ({
          context: { ...c.context, activeResumeId: record.id },
        }));
      }
      setUi({ focusResumeId: record.id, previewOpen: true, mobileView: 'preview' });
      toast(`Successfully imported "${file.name}".`, 'success');
      onClose();
    } catch (err) {
      toast(`Upload error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Resume (.docx)"
      description="Upload your .docx resume. Your exact layout, fonts, and formatting will be preserved."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={!file || loading}
            loading={loading}
          >
            Import Resume
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleSelect}
        />

        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-accent bg-accent-soft/40'
              : 'border-line-strong hover:border-accent hover:bg-sunken/40'
          }`}
        >
          {file ? (
            <div className="space-y-2">
              <CheckCircle2 className="w-10 h-10 text-ok mx-auto" />
              <div className="font-semibold text-sm text-ink">{file.name}</div>
              <p className="text-xs text-ink-muted">
                {Math.round(file.size / 1024)} KB · Click to change file
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <UploadCloud className="w-10 h-10 text-accent mx-auto" />
              <div className="font-semibold text-sm text-ink">
                Drag and drop your .docx file here
              </div>
              <p className="text-xs text-ink-muted">
                or click to browse your computer (Max 5 MB)
              </p>
            </div>
          )}
        </div>

        <div className="p-3 bg-sunken/50 border border-line rounded text-[11px] text-ink-muted space-y-1">
          <div className="font-medium text-ink">Standard .docx Format & Privacy:</div>
          <p>
            Supports standard .docx files from any modern word processor. PDFs are not supported. Your original file remains untouched on your machine.
          </p>
          <p className="text-[10px] text-ink-faint pt-1 border-t border-line">
            Notice: When requesting AI improvements or tailoring, selected resume text is sent to the configured AI provider (OpenRouter) and processed under that provider's data handling and privacy policies.
          </p>
        </div>
      </div>
    </Modal>
  );
}
