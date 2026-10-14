import React, { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Layers,
  Lock,
  Download,
  Bot,
  Sparkles,
  RefreshCw,
  Check,
  X,
  FileCheck2,
  Briefcase,
  SlidersHorizontal,
} from 'lucide-react';

const PIPELINE_STEPS = [
  {
    id: 'ingest',
    number: '01',
    title: 'Upload Your DOCX Resume',
    badge: 'Zero Formatting Loss',
    summary: 'Upload your existing DOCX resume. We read your file safely without touching your layout, fonts, or styling.',
    details: [
      'Works with DOCX files created in any word processor (Word, Google Docs, WPS, or LibreOffice).',
      'Keeps your font choices, page margins, tables, and spacing exactly as you designed them.',
      'Your original file is never changed; we always work on a safe copy.',
      'No need to re-type your resume or copy-paste it into a new template.',
    ],
    previewBox: {
      title: 'What Happens Behind the Scenes',
      badge: 'Safe Reading',
      items: [
        { label: 'Layout & Margins', status: 'Preserved (100%)', ok: true },
        { label: 'Font Styles & Sizes', status: 'Identical to original', ok: true },
        { label: 'Tables & Columns', status: 'Kept in place', ok: true },
        { label: 'Original File', status: 'Untouched & protected', ok: true },
      ],
      tip: 'Your original resume file remains completely safe and unchanged.',
    },
  },
  {
    id: 'align',
    number: '02',
    title: 'Target Any Job Description',
    badge: '100% Honest',
    summary: 'Tell the AI what role you want or paste a job posting. It highlights your strongest skills and finds ways to stand out.',
    details: [
      'Identifies the top skills and keywords recruiters and hiring managers look for.',
      'Suggests powerful action verbs and stronger phrasing for your bullet points.',
      'Strict anti-fabrication rules: The AI will never make up fake jobs, degrees, or metrics.',
      'If information is missing, the AI asks you for details instead of guessing.',
    ],
    previewBox: {
      title: 'AI Truthfulness Rules',
      badge: 'Strict Honesty',
      items: [
        { label: 'Fake Metrics & Numbers', status: 'Never invented', ok: true },
        { label: 'Past Employers & Titles', status: 'Never fabricated', ok: true },
        { label: 'Unverified Degrees', status: 'Never added', ok: true },
        { label: 'Missing Context', status: 'Asks you directly in chat', ok: true },
      ],
      tip: 'Your resume stays genuine, honest, and ready for background checks.',
    },
  },
  {
    id: 'diff',
    number: '03',
    title: 'Review Every Change First',
    badge: 'You Are in Control',
    summary: 'See before-and-after suggestions with clear color highlights. You decide what gets added, edited, or rejected.',
    details: [
      'Every suggestion is shown as a clear card right in your conversation.',
      'Additions are highlighted in green, and removals are shown in red strikethrough.',
      'Click Accept to apply an edit, Reject to skip it, or edit the text yourself.',
      'You can undo any change at any time with a single click.',
    ],
    previewBox: {
      title: 'Word-by-Word Comparison',
      badge: 'Clear Highlights',
      items: [
        { label: 'Removed Text', status: 'Red strikethrough', ok: false },
        { label: 'New Better Text', status: 'Green highlight', ok: true },
        { label: 'Approval Required', status: 'Nothing changes without you', ok: true },
        { label: 'Undo Support', status: 'Revert anytime in one click', ok: true },
      ],
      tip: 'Zero surprises. You inspect and approve every single edit.',
    },
  },
  {
    id: 'inject',
    number: '04',
    title: 'Download Your Ready DOCX',
    badge: 'Instant Download',
    summary: 'Your approved edits are saved directly into your DOCX resume. Preview it live in your browser and download immediately.',
    details: [
      'Only the approved words are updated—all surrounding styling remains identical.',
      'Preview your updated resume directly in your browser before downloading.',
      'Downloads as a clean, standard DOCX ready for recruiter applicant tracking systems (ATS).',
      'Create and save multiple tailored versions for different job applications.',
    ],
    previewBox: {
      title: 'Export Quality Check',
      badge: 'Ready to Send',
      items: [
        { label: 'File Format', status: 'Clean standard DOCX', ok: true },
        { label: 'ATS Compatibility', status: '100% recruiter friendly', ok: true },
        { label: 'Visual Formatting', status: 'Matches original design', ok: true },
        { label: 'Separate Versions', status: 'Saved for each job applied', ok: true },
      ],
      tip: 'Your finished resume is ready to send to employers right away.',
    },
  },
];

const SAMPLE_BULLETS = [
  {
    id: 'qa',
    role: 'QA Engineer',
    original: 'Responsible for testing web applications and reporting bugs in Jira.',
    proposed: 'Executed manual and automated web test suites using Playwright, logging 25+ defects in Jira with detailed reproduction steps.',
    reason: 'Replaces passive phrasing with specific tools, active verbs, and clear results.',
  },
  {
    id: 'swe',
    role: 'Software Engineer',
    original: 'Worked on the backend API services and helped improve database queries for users.',
    proposed: 'Built fast RESTful APIs in Node.js and optimized database queries, reducing response times by 38%.',
    reason: 'Mentions the tech stack and quantifies performance improvements.',
  },
  {
    id: 'pm',
    role: 'Operations / Business',
    original: 'Assisted team with weekly customer onboarding and fixed communication problems.',
    proposed: 'Streamlined enterprise client onboarding workflows, cutting setup time from 14 days down to 4 days across 60+ accounts.',
    reason: 'Highlights efficiency gains and measurable time savings for the business.',
  },
];

export function HowItWorksSection({ onStartImprove, onStartCreate }) {
  const [activeStepId, setActiveStepId] = useState('ingest');
  const [activeBulletIndex, setActiveBulletIndex] = useState(0);
  const [bulletStatus, setBulletStatus] = useState({});

  const currentStep = PIPELINE_STEPS.find((s) => s.id === activeStepId) || PIPELINE_STEPS[0];
  const activeBullet = SAMPLE_BULLETS[activeBulletIndex];
  const currentBulletDecision = bulletStatus[activeBullet.id] || null;

  const handleDecision = (decision) => {
    setBulletStatus((prev) => ({
      ...prev,
      [activeBullet.id]: decision,
    }));
  };

  const resetDecision = () => {
    setBulletStatus((prev) => {
      const next = { ...prev };
      delete next[activeBullet.id];
      return next;
    });
  };

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-surface border-y border-line px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <Badge variant="accent" size="md" className="mx-auto gap-1.5 py-1 px-3">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Simple & Layout-Safe</span>
          </Badge>

          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-ink tracking-tight">
            How AutoResumeAI Works
          </h2>

          <p className="text-sm sm:text-base text-ink-soft leading-relaxed">
            Unlike other AI resume tools that force you into generic templates, AutoResumeAI updates
            the text directly inside your existing DOCX file. Your fonts, margins, bullet points,
            and design stay exactly the way you made them.
          </p>
        </div>

        {/* 4 Steps Navigation Tabs */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PIPELINE_STEPS.map((step) => {
              const isActive = step.id === activeStepId;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStepId(step.id)}
                  className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between group cursor-pointer ${
                    isActive
                      ? 'bg-paper border-accent shadow-panel ring-1 ring-accent'
                      : 'bg-paper/50 border-line hover:border-line-strong hover:bg-paper'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isActive
                          ? 'bg-accent text-white'
                          : 'bg-sunken text-ink-muted group-hover:text-ink'
                      }`}
                    >
                      Step {step.number}
                    </span>
                    <Badge variant={isActive ? 'accent' : 'neutral'} size="xs">
                      {step.badge}
                    </Badge>
                  </div>
                  <div
                    className={`font-semibold text-xs leading-snug ${
                      isActive ? 'text-accent' : 'text-ink group-hover:text-accent'
                    }`}
                  >
                    {step.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Showcase Panel */}
          <div className="bg-paper border border-line-strong rounded-2xl p-6 sm:p-8 shadow-panel grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left explanation (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-accent bg-accent-soft px-2.5 py-1 rounded">
                  STEP {currentStep.number}
                </span>
                <span className="text-xs text-ink-muted">·</span>
                <span className="text-xs font-medium text-ink-muted">
                  {currentStep.badge}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-serif font-bold text-ink">
                {currentStep.title}
              </h3>

              <p className="text-sm text-ink-soft leading-relaxed">
                {currentStep.summary}
              </p>

              <div className="space-y-2.5 pt-2">
                {currentStep.details.map((detail, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-ink-soft">
                    <CheckCircle2 className="w-4 h-4 text-ok shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Summary Card (5 cols) */}
            <div className="lg:col-span-5 bg-surface border border-line-strong rounded-xl p-5 shadow-panel space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line text-xs">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  {currentStep.previewBox.title}
                </span>
                <Badge variant="ok" size="xs">
                  {currentStep.previewBox.badge}
                </Badge>
              </div>

              <div className="space-y-2.5">
                {currentStep.previewBox.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-sunken/40 text-xs"
                  >
                    <span className="text-ink-soft">{item.label}</span>
                    <span
                      className={`font-medium flex items-center gap-1 ${
                        item.ok ? 'text-ok' : 'text-bad line-through'
                      }`}
                    >
                      {item.ok ? (
                        <Check className="w-3 h-3 text-ok" />
                      ) : (
                        <X className="w-3 h-3 text-bad" />
                      )}
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-line text-[11px] text-ink-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>{currentStep.previewBox.tip}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Interactive Diff Playground */}
        <div className="rounded-2xl border border-line-strong bg-paper/60 p-6 sm:p-8 space-y-6 shadow-panel">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="text-base sm:text-lg font-serif font-bold text-ink">
                  Try It Live: See How Suggestions Work
                </h3>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Click a role below and choose whether to accept or reject the AI suggestion.
              </p>
            </div>

            {/* Role picker buttons */}
            <div className="flex items-center gap-1.5 bg-sunken p-1 rounded-lg">
              {SAMPLE_BULLETS.map((bullet, idx) => (
                <button
                  key={bullet.id}
                  onClick={() => setActiveBulletIndex(idx)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                    activeBulletIndex === idx
                      ? 'bg-surface text-ink shadow-panel'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {bullet.role}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Suggestion Box */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Diff Card (7 cols) */}
            <div className="lg:col-span-7 bg-surface border border-line rounded-xl p-5 space-y-4 shadow-panel">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="accent" size="xs">
                    Suggested Improvement
                  </Badge>
                  <span className="text-ink-muted text-[11px]">{activeBullet.role}</span>
                </div>

                {currentBulletDecision === 'accepted' && (
                  <Badge variant="ok" size="xs" className="gap-1">
                    <Check className="w-3 h-3" />
                    Accepted
                  </Badge>
                )}
                {currentBulletDecision === 'rejected' && (
                  <Badge variant="neutral" size="xs" className="gap-1">
                    <X className="w-3 h-3" />
                    Rejected
                  </Badge>
                )}
              </div>

              {/* Word Diff Box */}
              <div className="p-3.5 bg-sunken/40 rounded-lg border border-line space-y-2 text-xs">
                <div className="text-[10px] font-semibold uppercase text-ink-muted tracking-wider">
                  Original Bullet Point
                </div>
                <div className="text-bad line-through bg-bad-soft/50 px-2.5 py-1.5 rounded">
                  {activeBullet.original}
                </div>

                <div className="text-[10px] font-semibold uppercase text-ok tracking-wider pt-1">
                  Proposed Improvement
                </div>
                <div className="text-ok font-medium bg-ok-soft/50 px-2.5 py-1.5 rounded">
                  {activeBullet.proposed}
                </div>
              </div>

              <p className="text-[11px] text-ink-soft leading-relaxed">
                <strong className="text-ink">Why this helps:</strong> {activeBullet.reason}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-line">
                <div className="text-[11px] text-ink-muted">
                  {currentBulletDecision ? (
                    <button
                      onClick={resetDecision}
                      className="text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset choice
                    </button>
                  ) : (
                    <span>Make your decision:</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={currentBulletDecision === 'rejected' ? 'secondary' : 'outline'}
                    icon={XCircle}
                    onClick={() => handleDecision('rejected')}
                    className="text-xs h-7"
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={CheckCircle2}
                    onClick={() => handleDecision('accepted')}
                    className="text-xs h-7"
                  >
                    Accept Suggestion
                  </Button>
                </div>
              </div>
            </div>

            {/* Document Preview Mock (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-line rounded-xl p-5 shadow-panel space-y-3 text-[11px] select-none">
              <div className="flex items-center justify-between pb-2 border-b border-line text-ink-muted text-[10px]">
                <span className="font-semibold text-ink uppercase tracking-wider">
                  Live Resume Preview
                </span>
                <span className="text-accent font-medium">Design Preserved</span>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-xs uppercase tracking-wide text-ink border-b border-ink/30 pb-0.5">
                  Experience
                </div>
                <div className="font-semibold text-ink text-[11px]">
                  Senior Practitioner — Enterprise Solutions
                </div>

                <ul className="list-disc list-inside space-y-1.5 pl-1 text-[11px] text-ink-soft">
                  <li
                    className={`transition-all duration-200 p-1 rounded ${
                      currentBulletDecision === 'accepted'
                        ? 'bg-ok-soft/70 text-ink font-medium ring-1 ring-ok/40'
                        : currentBulletDecision === 'rejected'
                        ? 'bg-sunken text-ink-muted opacity-80'
                        : 'bg-accent-soft/40 text-ink'
                    }`}
                  >
                    {currentBulletDecision === 'accepted'
                      ? activeBullet.proposed
                      : currentBulletDecision === 'rejected'
                      ? activeBullet.original
                      : activeBullet.proposed}
                  </li>
                  <li>
                    Collaborated across teams to deliver projects on schedule.
                  </li>
                </ul>
              </div>

              <div className="pt-3 border-t border-line flex items-center justify-between text-[10px] text-ink-muted">
                <span>Fonts & Margins Intact</span>
                <Badge variant={currentBulletDecision === 'accepted' ? 'ok' : 'neutral'} size="xs">
                  {currentBulletDecision === 'accepted'
                    ? '✓ Updated'
                    : currentBulletDecision === 'rejected'
                    ? 'Original Kept'
                    : 'Previewing'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Side-by-Side Comparison: Other AI Tools vs AutoResumeAI */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-ink">
              Why AutoResumeAI is Different
            </h3>
            <p className="text-xs sm:text-sm text-ink-soft">
              Most resume tools destroy your layout. Here is how AutoResumeAI protects your work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Other Resume Tools Card */}
            <div className="p-6 rounded-xl border border-bad/30 bg-bad-soft/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm text-bad flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-bad" />
                  <span>Other AI Resume Builders</span>
                </div>
                <Badge variant="bad" size="xs">
                  Risky
                </Badge>
              </div>

              <ul className="space-y-3 text-xs text-ink-soft">
                <li className="flex items-start gap-2">
                  <span className="text-bad font-bold">✕</span>
                  <span><strong>Forces you into templates:</strong> Erases your existing formatting and dumps your resume into a generic layout everyone uses.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-bad font-bold">✕</span>
                  <span><strong>Scrambles formatting:</strong> Messes up your columns, bullet styles, margins, and custom fonts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-bad font-bold">✕</span>
                  <span><strong>Blind rewrites:</strong> Replaces entire paragraphs with generic AI buzzwords without letting you review each word.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-bad font-bold">✕</span>
                  <span><strong>Fake experience:</strong> Invents metrics, job duties, or skills you never had.</span>
                </li>
              </ul>
            </div>

            {/* AutoResumeAI Card */}
            <div className="p-6 rounded-xl border border-ok/40 bg-ok-soft/10 space-y-4 shadow-panel">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm text-ok flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-ok" />
                  <span>AutoResumeAI</span>
                </div>
                <Badge variant="ok" size="xs">
                  Safe & Honest
                </Badge>
              </div>

              <ul className="space-y-3 text-xs text-ink">
                <li className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span><strong>100% Layout Kept:</strong> Works directly inside your DOCX file so your custom layout, fonts, and tables stay unchanged.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span><strong>Word-by-word diffs:</strong> Shows exact additions in green and removals in red before anything is touched.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span><strong>Full control:</strong> Accept, reject, or tweak every suggestion yourself. Undo anytime in one click.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span><strong>Never fabricates:</strong> Strengthens your real background without making up fake employers or numbers.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Multi-Vendor DOCX Support */}
        <div className="bg-paper border border-line rounded-xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-panel">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="font-semibold text-sm text-ink">
              Works with Any Standard DOCX Resume
            </h4>
            <p className="text-xs text-ink-soft max-w-xl">
              Compatible with DOCX files exported from any popular word processor:
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
            <span className="px-3 py-1.5 rounded-lg bg-surface border border-line text-ink shadow-panel">
              Word (.docx)
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-surface border border-line text-ink shadow-panel">
              Google Docs (.docx)
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-surface border border-line text-ink shadow-panel">
              WPS Office (.docx)
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-surface border border-line text-ink shadow-panel">
              LibreOffice (.docx)
            </span>
          </div>
        </div>

        {/* Call to Action Bar */}
        <div className="text-center space-y-4 pt-4">
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-ink">
            Ready to improve your resume?
          </h3>
          <p className="text-xs sm:text-sm text-ink-soft">
            Sign in to access the studio, unlock 10 daily AI requests, and edit your DOCX files.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              size="lg"
              variant="primary"
              icon={FileText}
              onClick={onStartImprove}
              className="w-full sm:w-auto"
            >
              Improve My DOCX Resume
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={onStartCreate}
              className="w-full sm:w-auto"
            >
              Create from Scratch
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
