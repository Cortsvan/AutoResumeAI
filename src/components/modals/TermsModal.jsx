import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  FileText,
  ShieldCheck,
  Scale,
  Sparkles,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

export function TermsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'full'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terms of Service"
      description="Clear, fair guidelines on using AutoResumeAI, your document ownership, and AI generation policies."
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-ink-muted flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
            You retain 100% ownership of your resume content and files.
          </span>
          <Button variant="primary" onClick={onClose} size="sm">
            I Understand
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Tab switch */}
        <div className="flex border-b border-line gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'summary'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Plain-English Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('full')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'full'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Full Terms & Conditions
          </button>
        </div>

        {activeTab === 'summary' ? (
          <div className="space-y-3 pt-1">
            <div className="p-4 bg-surface border border-line-strong rounded-xl shadow-panel space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-ink flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-accent" />
                  Your Rights and Ownership
                </span>
                <Badge variant="ok" size="xs">
                  100% User Owned
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 bg-sunken/40 rounded-lg border border-line space-y-1">
                  <div className="font-semibold text-ink flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> Complete File Ownership
                  </div>
                  <p className="text-ink-muted leading-relaxed">
                    You own your resumes, job descriptions, and all edited documents. AutoResumeAI claims no copyright or proprietary rights over any text or DOCX files you import or generate.
                  </p>
                </div>

                <div className="p-3 bg-sunken/40 rounded-lg border border-line space-y-1">
                  <div className="font-semibold text-ink flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-accent" /> AI Advisory Nature
                  </div>
                  <p className="text-ink-muted leading-relaxed">
                    AI suggestions, keyword matches, and bullet enhancements are advisory recommendations. You have full review control to accept, edit, or reject any change.
                  </p>
                </div>

                <div className="p-3 bg-sunken/40 rounded-lg border border-line space-y-1">
                  <div className="font-semibold text-ink flex items-center gap-1">
                    <Scale className="w-3.5 h-3.5 text-ink-soft" /> Fair Daily Quotas
                  </div>
                  <p className="text-ink-muted leading-relaxed">
                    Standard accounts receive 10 free AI requests daily (resets 00:00 UTC). Automated abuse, credential sharing, or scraping is strictly prohibited.
                  </p>
                </div>

                <div className="p-3 bg-sunken/40 rounded-lg border border-line space-y-1">
                  <div className="font-semibold text-ink flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-warn" /> Global Budget Caps
                  </div>
                  <p className="text-ink-muted leading-relaxed">
                    To protect service viability, a global spending threshold is enforced across all accounts. If reached, paid AI calls pause safely until refreshed.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-sunken rounded-lg border border-line text-[11px] text-ink-muted leading-relaxed">
              <strong>Applicant Responsibility:</strong> You are solely responsible for ensuring the truthfulness and accuracy of all career experience, employment dates, and credentials before submitting applications to potential employers.
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-1 max-h-[50vh] overflow-y-auto pr-1 text-ink-soft text-[11px] leading-relaxed">
            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">1. Acceptance of Terms</h3>
              <p>
                By accessing or using AutoResumeAI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">2. User Documents & Intellectual Property</h3>
              <p>
                You retain all right, title, and interest in and to your original resume files, text entries, and personal career materials. We do not sell, rent, or claim ownership over any documents you process through the Service. Original uploaded DOCX files remain immutable in your browser's local storage.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">3. Use of Artificial Intelligence Providers</h3>
              <p>
                When you request resume rewrites or job-tailoring recommendations, text extracts are transmitted to our backend and routed through third-party AI provider infrastructure (OpenRouter and associated upstream LLM providers). Such processing is governed by the respective provider's terms and data use policies. When external AI keys are not configured, the Service operates in an internal Demo Mode without calling external providers.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">4. Account Quotas, Rate Limits & Global Budget</h3>
              <p>
                Standard user accounts are granted a default quota of 10 AI transformation requests per 24-hour UTC window. The Service enforces an internal global spending guard to prevent API overages. Administrators reserve the right to modify individual quotas, suspend abusive accounts, or temporarily pause AI features when spending thresholds are reached.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">5. Prohibited Conduct</h3>
              <p>
                You agree not to: (a) attempt to bypass rate limits or quota guards; (b) upload malformed files, ZIP bombs, or materials containing malicious payloads; (c) reverse-engineer or attempt to extract private API credentials; or (d) use automated bots or scripts without explicit authorization.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">6. Disclaimers & Limitation of Liability</h3>
              <p>
                The Service is provided on an "AS IS" and "AS AVAILABLE" basis. AutoResumeAI makes no guarantees regarding interview invitations, job placement, or hiring outcomes. In no event shall AutoResumeAI or its operators be liable for indirect, incidental, special, or consequential damages resulting from your use of the Service.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">7. Modifications to Terms</h3>
              <p>
                We reserve the right to revise these Terms at any time. Continued use of the Service following modifications constitutes your acceptance of the revised Terms.
              </p>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}
