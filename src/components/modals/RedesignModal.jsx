import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { redesignResume } from '../../services/resumeRepo.js';
import { TEMPLATES } from '../../features/resume-creation/model.js';
import { setUi, toast, updateConversation } from '../../app/store.js';
import { Palette, ShieldAlert } from 'lucide-react';

export function RedesignModal({ isOpen, onClose, resume, conversationId }) {
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [loading, setLoading] = useState(false);

  const handleRedesign = async () => {
    if (!resume) return;
    setLoading(true);
    try {
      const { resume: created } = await redesignResume(resume.id, {
        template: selectedTemplate,
        useAi: false,
      });

      if (conversationId) {
        updateConversation(conversationId, (c) => ({
          context: { ...c.context, activeResumeId: created.id },
        }));
      }

      setUi({ focusResumeId: created.id, previewOpen: true });
      toast(`Created redesigned copy in the ${selectedTemplate} template.`, 'success');
      onClose();
    } catch (err) {
      toast(err.message || 'Error redesigning resume.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Redesign Resume Template"
      description="Transfer the structured content from your imported resume into one of our built-in Word templates."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" icon={Palette} onClick={handleRedesign} loading={loading}>
            Create Redesigned Copy
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 bg-accent-soft/40 border border-accent-line rounded flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-[11px] text-ink-soft leading-relaxed">
            Your original uploaded resume will <strong>never</strong> be modified. A separate new resume
            document will be created with your chosen template.
          </p>
        </div>

        <div>
          <label className="label">Choose Target Template</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplate(t.id)}
                className={`p-3 text-left rounded-lg border transition-all ${
                  selectedTemplate === t.id
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
      </div>
    </Modal>
  );
}
