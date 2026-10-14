import React, { useRef, useEffect } from 'react';
import { useStore, renameConversation, setUi } from '../../app/store.js';
import { MessageItem } from './MessageItem.jsx';
import { MessageComposer } from './MessageComposer.jsx';
import { Button } from '../ui/Button.jsx';
import { sendMessage } from '../../services/chatOrchestrator.js';
import {
  FileText,
  Sparkles,
  ArrowRight,
  Target,
  FileCheck,
  PlusCircle,
  Eye,
  PanelRight,
} from 'lucide-react';

export function ChatPanel({
  conversation,
  activeResume,
  onOpenUploadModal,
  onOpenCreateModal,
  onOpenTailorModal,
}) {
  const messagesEndRef = useRef(null);
  const busy = useStore((s) => Boolean(s.ui.busy[conversation?.id]));
  const previewOpen = useStore((s) => s.settings.previewOpen);

  const suggestedPrompts = [
    {
      title: 'Improve my existing resume',
      desc: 'Polish wording, strengthen action verbs, and remove repetitive phrasing.',
      icon: Sparkles,
      action: 'Improve my existing resume. Review my bullet points and make them more concise and impactful while keeping my formatting intact.',
    },
    {
      title: 'Tailor my resume to a specific job',
      desc: 'Align skills and projects with a specific job description.',
      icon: Target,
      action: 'Tailor my resume to a specific job opening. What details or job description do you need from me?',
    },
    {
      title: 'Create a resume from scratch',
      desc: 'Build a new professional resume through conversation.',
      icon: PlusCircle,
      action: 'I want to create a resume from scratch. Help me build it step by step.',
    },
    {
      title: 'Review and identify weaknesses',
      desc: 'Get an objective assessment of gaps and clarity.',
      icon: FileCheck,
      action: 'Review my resume and identify any weaknesses, missing details, or vague descriptions.',
    },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, busy]);

  const handlePromptClick = (text) => {
    if (conversation) {
      sendMessage(conversation.id, text);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-ink-muted text-sm">
        Select or start a conversation.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-paper min-w-0">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-line shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="text"
            value={conversation.title}
            onChange={(e) => renameConversation(conversation.id, e.target.value)}
            className="text-sm font-semibold text-ink bg-transparent hover:bg-sunken px-1.5 py-0.5 rounded border border-transparent hover:border-line focus:border-accent focus:bg-surface focus:outline-none truncate max-w-[200px] sm:max-w-md"
            title="Click to rename conversation"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile view toggle */}
          <div className="flex lg:hidden">
            <Button
              size="sm"
              variant="outline"
              icon={Eye}
              onClick={() => setUi({ mobileView: 'preview' })}
            >
              Resume
            </Button>
          </div>

          {/* Desktop Preview toggle */}
          <div className="hidden lg:flex">
            <Button
              size="sm"
              variant="ghost"
              icon={PanelRight}
              onClick={() => setUi({ previewOpen: !previewOpen })}
              title={previewOpen ? 'Hide resume preview' : 'Show resume preview'}
            />
          </div>
        </div>
      </div>

      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2">
        {conversation.messages.length === 0 ? (
          <div className="max-w-xl mx-auto py-8 sm:py-12 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-accent-soft text-accent mx-auto flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-ink">
                How would you like to work today?
              </h3>
              <p className="text-xs text-ink-soft max-w-md mx-auto leading-relaxed">
                Upload your existing Word (.docx) resume to improve it while preserving its design,
                or create a new one conversationally.
              </p>
            </div>

            {/* Quick action buttons if no resume */}
            {!activeResume && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" icon={FileText} onClick={onOpenUploadModal}>
                  Upload DOCX Resume
                </Button>
                <Button variant="outline" icon={PlusCircle} onClick={onOpenCreateModal}>
                  Create from Scratch
                </Button>
              </div>
            )}

            {/* Suggested prompts cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {suggestedPrompts.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handlePromptClick(p.action)}
                    className="p-3.5 text-left rounded-lg bg-surface border border-line hover:border-accent hover:shadow-panel transition-all group"
                  >
                    <div className="flex items-center gap-2 font-medium text-xs text-ink group-hover:text-accent">
                      <Icon className="w-4 h-4 text-accent shrink-0" />
                      <span>{p.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-ink-muted leading-relaxed line-clamp-2">
                      {p.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          conversation.messages.map((m) => (
            <MessageItem key={m.id} message={m} conversationId={conversation.id} />
          ))
        )}

        {/* Loading typing state */}
        {busy && (
          <div className="flex items-center gap-2 py-3 px-2 text-xs text-ink-muted animate-fade-in">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-dot" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-dot" style={{ animationDelay: '200ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-dot" style={{ animationDelay: '400ms' }} />
            </div>
            <span>AutoResumeAI is reviewing your document...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <MessageComposer
        conversationId={conversation.id}
        activeResume={activeResume}
        onOpenTailorModal={onOpenTailorModal}
        onOpenUploadModal={onOpenUploadModal}
      />
    </div>
  );
}
