import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { forkResume } from '../../services/resumeRepo.js';
import { patchResume, updateConversation, setUi, toast } from '../../app/store.js';
import { sendMessage } from '../../services/chatOrchestrator.js';
import { Target, Copy } from 'lucide-react';

export function TailorJobModal({ isOpen, onClose, activeResume, conversationId }) {
  const [jobTitle, setJobTitle] = useState(activeResume?.targetJob?.title || '');
  const [jobDescription, setJobDescription] = useState(activeResume?.targetJob?.description || '');
  const [createSeparateCopy, setCreateSeparateCopy] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleTailor = async () => {
    if (!jobDescription.trim() && !jobTitle.trim()) {
      toast('Please enter a target job title or paste a job description.', 'warn');
      return;
    }

    setLoading(true);
    try {
      let targetResumeId = activeResume.id;
      const targetJobObj = {
        title: jobTitle.trim() || 'Target Position',
        description: jobDescription.trim(),
        setAt: Date.now(),
      };

      if (createSeparateCopy) {
        const copyName = `${activeResume.name} - ${targetJobObj.title}`;
        const forked = await forkResume(activeResume.id, {
          name: copyName,
          targetJob: targetJobObj,
          label: `Tailored for ${targetJobObj.title}`,
        });
        targetResumeId = forked.id;
        toast(`Created separate resume version: "${copyName}".`, 'success');
      } else {
        patchResume(activeResume.id, { targetJob: targetJobObj });
      }

      if (conversationId) {
        updateConversation(conversationId, (c) => ({
          context: {
            ...c.context,
            activeResumeId: targetResumeId,
            jobDescription: targetJobObj.description,
            jobTitle: targetJobObj.title,
          },
        }));

        // Send a kick-off message to the chat
        sendMessage(
          conversationId,
          `I want to apply for this ${targetJobObj.title} position. Improve my resume to match the job requirements, emphasize my relevant projects, and preserve my current design.\n\nJob description:\n${targetJobObj.description}`,
        );
      }

      setUi({ focusResumeId: targetResumeId, previewOpen: true });
      onClose();
    } catch (err) {
      toast(`Error setting up job tailoring: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tailor Resume to a Job Opening"
      description="Paste the requirements or job posting. AutoResumeAI will identify matching qualifications, highlight gaps, and suggest targeted bullet improvements."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" icon={Target} onClick={handleTailor} loading={loading}>
            Start Tailoring
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="label">Target Job Title</label>
          <input
            type="text"
            className="field"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Junior QA Tester, Frontend Engineer"
          />
        </div>

        <div>
          <label className="label">Job Description / Requirements</label>
          <textarea
            rows={6}
            className="field leading-relaxed"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description, required qualifications, or key responsibilities here..."
          />
        </div>

        <div className="p-3 bg-sunken/60 border border-line rounded flex items-start gap-2.5">
          <input
            type="checkbox"
            id="separate-copy"
            checked={createSeparateCopy}
            onChange={(e) => setCreateSeparateCopy(e.target.checked)}
            className="mt-0.5 rounded border-line text-accent focus:ring-accent"
          />
          <label htmlFor="separate-copy" className="text-xs text-ink cursor-pointer space-y-0.5">
            <span className="font-semibold block">
              Save as a separate version for this job
            </span>
            <span className="text-[11px] text-ink-muted block leading-snug">
              Keeps your original resume and any previously tailored resumes intact so you have dedicated files for each application.
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
