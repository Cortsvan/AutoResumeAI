import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Lock,
  Sparkles,
  Check,
  X,
} from 'lucide-react';

export function HowItWorksModal({ isOpen, onClose, onOpenUpload, onOpenCreate }) {
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'truth' | 'comparison'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="How AutoResumeAI Works"
      description="Improve your resume without losing your original design, fonts, or layout."
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-ink-muted">
            Preserves your layout, fonts, margins, and tables 100%.
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} size="sm">
              Got It
            </Button>
            {onOpenUpload && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onOpenUpload();
                }}
                size="sm"
                icon={FileText}
              >
                Upload Resume (.docx)
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Navigation Tabs */}
        <div className="flex border-b border-line gap-2">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pipeline'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            4 Simple Steps
          </button>
          <button
            onClick={() => setActiveTab('truth')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'truth'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Honesty Guarantee
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'comparison'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Why It Is Better
          </button>
        </div>

        {/* Tab 1: 4 Simple Steps */}
        {activeTab === 'pipeline' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-surface border border-line rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-accent-soft text-accent text-[11px] font-bold flex items-center justify-center">
                      1
                    </span>
                    Upload Your DOCX
                  </span>
                  <Badge variant="accent" size="xs">Safe Reading</Badge>
                </div>
                <p className="text-ink-soft text-[11px] leading-relaxed">
                  Upload your existing DOCX resume. We safely inspect its structure while keeping your original file untouched and protected.
                </p>
              </div>

              <div className="p-3.5 bg-surface border border-line rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-accent-soft text-accent text-[11px] font-bold flex items-center justify-center">
                      2
                    </span>
                    Match Any Job
                  </span>
                  <Badge variant="neutral" size="xs">Targeted</Badge>
                </div>
                <p className="text-ink-soft text-[11px] leading-relaxed">
                  Paste the job posting you want. The AI identifies top keywords and suggests impactful ways to highlight your real skills.
                </p>
              </div>

              <div className="p-3.5 bg-surface border border-line rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-accent-soft text-accent text-[11px] font-bold flex items-center justify-center">
                      3
                    </span>
                    Review Every Edit
                  </span>
                  <Badge variant="ok" size="xs">You Choose</Badge>
                </div>
                <p className="text-ink-soft text-[11px] leading-relaxed">
                  Every suggestion shows green additions and red removals. You decide what gets accepted, edited, or rejected. No surprises.
                </p>
              </div>

              <div className="p-3.5 bg-surface border border-line rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-accent-soft text-accent text-[11px] font-bold flex items-center justify-center">
                      4
                    </span>
                    Download Ready DOCX
                  </span>
                  <Badge variant="accent" size="xs">Pure DOCX</Badge>
                </div>
                <p className="text-ink-soft text-[11px] leading-relaxed">
                  Only the approved words are updated. Your fonts, margins, and design stay identical. Download your updated DOCX instantly.
                </p>
              </div>
            </div>

            <div className="p-3 bg-sunken/40 rounded-lg border border-line text-[11px] text-ink-muted flex items-center justify-between">
              <span>Works with DOCX files from any modern word processor.</span>
              <span className="text-accent font-medium">No PDF conversion messes</span>
            </div>
          </div>
        )}

        {/* Tab 2: Honesty Guarantee */}
        {activeTab === 'truth' && (
          <div className="space-y-3 pt-1">
            <div className="p-4 bg-surface border border-line-strong rounded-lg shadow-panel space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-ok" />
                <span className="font-semibold text-ink">
                  100% Honest — No Hallucinations
                </span>
              </div>
              <p className="text-ink-soft text-[11px] leading-relaxed">
                Most AI tools make up impressive-sounding statistics or job titles when they don&apos;t know the answer. AutoResumeAI follows strict honesty rules:
              </p>

              <div className="space-y-2 bg-paper p-3 rounded border border-line">
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="text-bad font-bold">✕</span>
                  <span className="text-ink-soft">
                    <strong>Never invents numbers:</strong> Will never make up percentages, metrics, or revenue numbers you didn&apos;t supply.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="text-bad font-bold">✕</span>
                  <span className="text-ink-soft">
                    <strong>Never adds fake jobs or degrees:</strong> Only includes the roles, companies, and credentials from your real resume.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="text-ok font-bold">✓</span>
                  <span className="text-ink-soft">
                    <strong>Asks when context is needed:</strong> If the job description requires a skill, the AI asks you directly in chat instead of guessing.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Comparison */}
        {activeTab === 'comparison' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-bad-soft/10 border border-bad/30 rounded-lg space-y-2">
                <span className="font-semibold text-bad text-xs">Other AI Resume Tools</span>
                <ul className="space-y-1.5 text-[11px] text-ink-soft">
                  <li>• Forces you into cookie-cutter templates</li>
                  <li>• Destroys your custom fonts, margins, and tables</li>
                  <li>• Blind rewrites with buzzwords you didn't ask for</li>
                  <li>• Risk of fabricated experience and fake metrics</li>
                </ul>
              </div>

              <div className="p-3.5 bg-ok-soft/10 border border-ok/40 rounded-lg space-y-2">
                <span className="font-semibold text-ok text-xs">AutoResumeAI</span>
                <ul className="space-y-1.5 text-[11px] text-ink">
                  <li>• Keeps your existing layout and design 100% intact</li>
                  <li>• Edits your text directly inside your DOCX file</li>
                  <li>• Clear word-by-word diff highlights before applying</li>
                  <li>• 100% faithful to your actual work history</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
