import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { brand } from '../app/brand.js';
import { useStore, setAuthModalOpen, toast } from '../app/store.js';
import { Button } from '../components/ui/Button.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import {
  FileText,
  Sparkles,
  ShieldCheck,
  Target,
  ArrowRight,
  CheckCircle2,
  Lock,
  Cpu,
  Layers,
  Download,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { HowItWorksSection } from '../components/landing/HowItWorksSection.jsx';
import { PrivacyModal } from '../components/modals/PrivacyModal.jsx';
import { TermsModal } from '../components/modals/TermsModal.jsx';

export function LandingPage({
  onStartImprove,
  onStartCreate,
  initialSection = null,
  initialOpenPrivacy = false,
}) {
  const navigate = useNavigate();
  const [privacyModalOpen, setPrivacyModalOpen] = useState(Boolean(initialOpenPrivacy));
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  React.useEffect(() => {
    if (initialSection) {
      const timer = setTimeout(() => {
        scrollToSection(initialSection);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [initialSection]);

  const auth = useStore((s) => s.auth);
  const user = auth.user;
  const profile = auth.profile;
  const isAdmin = profile?.role === 'admin';

  const requireAuthAndNavigate = (callback) => {
    if (!user) {
      setAuthModalOpen(true);
      toast('Please sign in or create an account to access the studio.', 'info');
      return;
    }
    navigate('/app');
    if (callback) callback();
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-accent-soft">
      {/* Navigation Bar */}
      <header className="border-b border-line bg-surface/80 backdrop-blur-xs sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-ink flex items-center justify-center text-paper font-bold text-xs">
              AR
            </div>
            <span className="font-semibold text-sm tracking-tight text-ink">
              {brand.name}
            </span>
          </div>

          <nav className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="text-xs text-ink-muted hover:text-ink font-medium px-2 py-1 hidden sm:inline-block cursor-pointer transition-colors"
            >
              How It Works
            </button>
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/admin')}
                className="text-xs text-accent"
              >
                Control Center
              </Button>
            )}
            {!user ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAuthModalOpen(true)}
                className="text-xs"
              >
                Sign In
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => requireAuthAndNavigate()}>
              Open Studio
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-12 sm:pt-24 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <Badge variant="accent" size="md" className="mx-auto gap-1.5 py-1 px-3">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Pure DOCX Processing · Keep Your Original Design</span>
          </Badge>

          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-ink tracking-tight leading-[1.15]">
            Improve your resume without losing its original design.
          </h1>

          <p className="text-base sm:text-lg text-ink-soft max-w-2xl mx-auto leading-relaxed">
            Upload your DOCX resume, describe the job you want, and let conversational
            AI strengthen bullet points, tailor qualifications, and propose reviewable edits while
            preserving your exact fonts, margins, tables, and layout.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <Button
              size="lg"
              variant="primary"
              icon={FileText}
              onClick={() => requireAuthAndNavigate(onStartImprove)}
              className="w-full sm:w-auto"
            >
              Improve My Resume (.docx)
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={() => requireAuthAndNavigate(onStartCreate)}
              className="w-full sm:w-auto"
            >
              Create a Resume from Scratch
            </Button>
          </div>

          <p className="text-xs text-ink-faint">
            DOCX (.docx) files only · Free account required · Private in your browser
          </p>
        </div>

        {/* Realistic Workspace Preview Mock */}
        <div className="max-w-5xl mx-auto mt-12 sm:mt-16 rounded-xl border border-line-strong bg-surface shadow-page overflow-hidden">
          {/* Mock Window Top Bar */}
          <div className="px-4 py-2.5 bg-sunken/80 border-b border-line flex items-center justify-between text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-bad/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-warn/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-ok/80" />
              <span className="ml-2 font-medium text-ink text-[11px]">
                AutoResumeAI Studio — Junior-QA-Tester-Resume.docx
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <Badge variant="ok" size="xs">
                ✓ 3 edits applied
              </Badge>
              <Badge variant="neutral" size="xs">
                Letter · 1 Page
              </Badge>
            </div>
          </div>

          {/* Mock Two-Panel Studio View */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px]">
            {/* Left Chat Conversation Mock (5 cols) */}
            <div className="md:col-span-6 border-b md:border-b-0 md:border-r border-line p-4 sm:p-5 flex flex-col justify-between bg-paper/50">
              <div className="space-y-4">
                {/* User message */}
                <div className="bg-ink text-paper p-3 rounded-lg text-xs leading-relaxed max-w-md ml-auto">
                  I want to apply for this Junior QA Tester position. Improve my resume to match the
                  requirements, emphasize my automated testing projects, and preserve my current
                  design.
                </div>

                {/* Assistant message with reviewable suggestion */}
                <div className="bg-surface border border-line-strong p-3.5 rounded-lg text-xs space-y-2.5 shadow-panel max-w-md">
                  <div className="flex items-center gap-1.5 font-semibold text-ink text-[11px] uppercase tracking-wide">
                    <Bot className="w-3.5 h-3.5 text-accent" />
                    AutoResumeAI
                  </div>
                  <p className="text-ink-soft leading-relaxed text-[11px]">
                    I analyzed your resume against the Junior QA Tester requirements. Here is a
                    targeted improvement for your experience bullet:
                  </p>

                  <div className="p-2.5 bg-sunken/40 border border-line rounded text-[11px] space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-ink-muted">
                      Original
                    </div>
                    <div className="text-bad line-through bg-bad-soft/60 px-1 py-0.5 rounded-xs">
                      Responsible for testing web applications and reporting bugs in Jira.
                    </div>
                    <div className="text-[10px] uppercase font-semibold text-ok pt-1">
                      Proposed (Action-oriented & QA tailored)
                    </div>
                    <div className="text-ok font-medium bg-ok-soft/60 px-1 py-0.5 rounded-xs">
                      Executed manual and automated web test suites in Playwright, logging 25+
                      defects in Jira with detailed reproduction steps.
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <span className="text-[10px] text-ok font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-ok" />
                      Accepted & Applied
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 text-[11px] text-ink-muted border-t border-line mt-4 flex items-center justify-between">
                <span>Working copy updated safely</span>
                <span className="text-accent font-medium">Original file untouched</span>
              </div>
            </div>

            {/* Right Live Document Preview Mock (6 cols) */}
            <div className="md:col-span-6 bg-sunken/40 p-4 sm:p-6 flex items-center justify-center">
              <div className="w-full max-w-sm bg-white p-5 rounded border border-line shadow-panel space-y-3 text-[10px] leading-relaxed select-none">
                <div className="text-center border-b border-line pb-2">
                  <div className="font-bold text-sm tracking-wide text-ink">JANE DOE</div>
                  <div className="text-ink-muted text-[10px]">
                    jane@example.com · Austin, TX · linkedin.com/in/jane
                  </div>
                </div>

                <div>
                  <div className="font-bold text-[10px] uppercase tracking-wider text-ink border-b border-ink pb-0.5 mb-1.5">
                    Experience
                  </div>
                  <div className="flex justify-between font-semibold text-ink">
                    <span>QA Intern — Northwind Apps</span>
                    <span className="text-ink-muted font-normal">2024 – Present</span>
                  </div>
                  <ul className="list-disc list-inside text-ink-soft space-y-1 mt-1 pl-1">
                    <li className="bg-ok-soft/30 px-1 rounded-xs">
                      Executed manual and automated web test suites in Playwright, logging 25+ defects
                      in Jira.
                    </li>
                    <li>Participated in daily standups and sprint planning meetings.</li>
                  </ul>
                </div>

                <div>
                  <div className="font-bold text-[10px] uppercase tracking-wider text-ink border-b border-ink pb-0.5 mb-1.5">
                    Projects
                  </div>
                  <div className="font-semibold text-ink">E-Commerce Test Automation Suite</div>
                  <p className="text-ink-soft">
                    Created an end-to-end regression testing framework covering checkout flows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorksSection
        onStartImprove={() => requireAuthAndNavigate(onStartImprove)}
        onStartCreate={() => requireAuthAndNavigate(onStartCreate)}
      />


      {/* Privacy & Standards */}
      <section id="privacy" className="py-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto bg-surface border border-line rounded-xl p-6 sm:p-8 space-y-5 shadow-panel">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-ink font-serif font-bold text-base sm:text-lg">
              <ShieldCheck className="w-5 h-5 text-ok" />
              <span>Privacy and Document Standards</span>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTermsModalOpen(true)}
                className="text-xs"
              >
                Terms of Service
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPrivacyModalOpen(true)}
                className="text-xs"
              >
                Privacy Details
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-ink-soft leading-relaxed">
            <div className="space-y-1.5">
              <h5 className="font-semibold text-ink">Private & Browser-Stored</h5>
              <p>
                All uploaded resumes, generated versions, and conversations stay directly in
                your browser's local storage. Documents are never saved to a remote server database.
              </p>
            </div>

            <div className="space-y-1.5">
              <h5 className="font-semibold text-ink">Why DOCX Only</h5>
              <p>
                Converting PDFs back and forth scrambles columns, floats tables, and loses custom fonts.
                AutoResumeAI operates exclusively on standard DOCX documents so your layout stays pixel-perfect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dedicated Privacy & Terms Modals */}
      <PrivacyModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />

      <TermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
      />

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-line bg-surface py-6 px-4 sm:px-6 text-xs text-ink-muted">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">{brand.name}</span>
            <span>·</span>
            <span>Resume Studio</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <button
              type="button"
              onClick={() => setTermsModalOpen(true)}
              className="text-ink-muted hover:text-accent transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => setPrivacyModalOpen(true)}
              className="text-ink-muted hover:text-accent transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span className="text-ink-faint">
              © {new Date().getFullYear()} {brand.name}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
