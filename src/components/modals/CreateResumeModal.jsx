import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { createCreatedResume } from '../../services/resumeRepo.js';
import { sampleResumeData, emptyResumeData, TEMPLATES } from '../../features/resume-creation/model.js';
import { toast, setUi, updateConversation } from '../../app/store.js';
import { FilePlus, Sparkles } from 'lucide-react';

export function CreateResumeModal({ isOpen, onClose, conversationId }) {
  const [name, setName] = useState('My Resume');
  const [template, setTemplate] = useState('classic');
  const [paper, setPaper] = useState('letter');
  const [useSample, setUseSample] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const data = useSample ? sampleResumeData() : emptyResumeData();
      if (!useSample) {
        data.contact.name = name;
      }
      const resume = await createCreatedResume({
        name: name.trim() || 'My Resume',
        data,
        template,
        paper,
        label: 'Initial draft',
      });

      if (conversationId) {
        updateConversation(conversationId, (c) => ({
          context: { ...c.context, activeResumeId: resume.id, creating: true },
        }));
      }

      setUi({ focusResumeId: resume.id, previewOpen: true, mobileView: 'preview' });
      toast(`Created new resume "${resume.name}".`, 'success');
      onClose();
    } catch (err) {
      toast(err.message || 'Error creating resume.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Resume from Scratch"
      description="Start a new resume using one of our ATS-friendly Word templates. You can refine it conversationally in the chat or through the form editor."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={loading}>
            Create Resume
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="label">Resume Title / Label</label>
          <input
            type="text"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Software Engineer Resume"
          />
        </div>

        <div>
          <label className="label">Select Built-In Template</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`p-3 text-left rounded-lg border transition-all ${
                  template === t.id
                    ? 'border-accent bg-accent-soft/40 shadow-panel ring-1 ring-accent'
                    : 'border-line bg-surface hover:bg-sunken'
                }`}
              >
                <div className="font-semibold text-ink text-xs">{t.name}</div>
                <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Paper Size</label>
            <select
              value={paper}
              onChange={(e) => setPaper(e.target.value)}
              className="field"
            >
              <option value="letter">Letter (US)</option>
              <option value="a4">A4 (International)</option>
            </select>
          </div>

          <div>
            <label className="label">Starting Content</label>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="sample-check"
                checked={useSample}
                onChange={(e) => setUseSample(e.target.checked)}
                className="rounded border-line text-accent focus:ring-accent"
              />
              <label htmlFor="sample-check" className="text-xs text-ink cursor-pointer">
                Load sample QA profile
              </label>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
