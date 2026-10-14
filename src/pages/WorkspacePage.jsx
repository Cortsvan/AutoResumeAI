import React, { useState, useEffect } from 'react';
import { useStore, createConversation, setUi, getState } from '../app/store.js';
import { Sidebar } from '../components/layout/Sidebar.jsx';
import { ChatPanel } from '../components/chat/ChatPanel.jsx';
import { DocxPreviewPanel } from '../components/preview/DocxPreviewPanel.jsx';
import { UploadModal } from '../components/modals/UploadModal.jsx';
import { CreateResumeModal } from '../components/modals/CreateResumeModal.jsx';
import { TailorJobModal } from '../components/modals/TailorJobModal.jsx';
import { RedesignModal } from '../components/modals/RedesignModal.jsx';
import { SettingsModal } from '../components/modals/SettingsModal.jsx';
import { HowItWorksModal } from '../components/modals/HowItWorksModal.jsx';
import { PrivacyModal } from '../components/modals/PrivacyModal.jsx';
import { TermsModal } from '../components/modals/TermsModal.jsx';
import { Menu, FileText, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';

export function WorkspacePage() {
  const conversations = useStore((s) => s.conversations);
  const resumes = useStore((s) => s.resumes);
  const ui = useStore((s) => s.ui);
  const previewOpen = useStore((s) => s.settings.previewOpen);

  // Selected items state
  const [activeConversationId, setActiveConversationId] = useState(() => {
    return conversations[0]?.id || null;
  });

  const [activeResumeId, setActiveResumeId] = useState(() => {
    return ui.focusResumeId || resumes[0]?.id || null;
  });

  // Modals state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [tailorOpen, setTailorOpen] = useState(false);
  const [redesignOpen, setRedesignOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [resumeToRedesign, setResumeToRedesign] = useState(null);

  // Ensure an active conversation exists
  useEffect(() => {
    if (conversations.length === 0) {
      const created = createConversation();
      setActiveConversationId(created.id);
    } else if (!activeConversationId || !conversations.some((c) => c.id === activeConversationId)) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Keep activeResumeId synced with current conversation context or latest uploaded resume
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const currentResume =
    resumes.find((r) => r.id === (activeConversation?.context?.activeResumeId || activeResumeId)) ||
    resumes[0] ||
    null;

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv?.context?.activeResumeId) {
      setActiveResumeId(conv.context.activeResumeId);
    }
    setUi({ sidebarOpen: false });
  };

  const handleSelectResume = (id) => {
    setActiveResumeId(id);
    if (activeConversation) {
      // Connect to conversation context
      const conv = conversations.find((c) => c.id === activeConversationId);
      if (conv) {
        conv.context.activeResumeId = id;
      }
    }
    setUi({ sidebarOpen: false, focusResumeId: id });
  };

  const handleOpenRedesign = (resume) => {
    setResumeToRedesign(resume);
    setRedesignOpen(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-paper text-ink">
      {/* Mobile Sidebar Backdrop */}
      {ui.sidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/40 z-40 md:hidden"
          onClick={() => setUi({ sidebarOpen: false })}
        />
      )}

      {/* Sidebar (Desktop always, Mobile drawer) */}
      <div
        className={`fixed md:relative z-40 h-full transition-transform duration-200 md:translate-x-0 ${
          ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          activeResumeId={currentResume?.id || null}
          onSelectResume={handleSelectResume}
          onOpenUploadModal={() => setUploadOpen(true)}
          onOpenCreateModal={() => setCreateOpen(true)}
          onOpenSettingsModal={() => setSettingsOpen(true)}
          onOpenRedesignModal={handleOpenRedesign}
          onOpenHowItWorks={() => setHowItWorksOpen(true)}
          onOpenPrivacy={() => setPrivacyOpen(true)}
        />
      </div>

      {/* Main Workspace Stage */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Mobile top navigation header */}
        <div className="flex md:hidden items-center justify-between px-3 py-2 bg-surface border-b border-line shrink-0">
          <Button
            size="sm"
            variant="ghost"
            icon={Menu}
            onClick={() => setUi({ sidebarOpen: true })}
            className="h-8 w-8 !p-0"
          />

          <div className="flex items-center gap-1 bg-sunken p-0.5 rounded text-xs">
            <button
              onClick={() => setUi({ mobileView: 'chat' })}
              className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                ui.mobileView === 'chat'
                  ? 'bg-surface text-ink shadow-panel'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setUi({ mobileView: 'preview' })}
              className={`px-3 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                ui.mobileView === 'preview'
                  ? 'bg-surface text-ink shadow-panel'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Resume
            </button>
          </div>

          <div className="w-8" />
        </div>

        {/* 2-Column Desktop / Toggle Mobile Stage */}
        <div className="flex-1 flex h-full min-h-0 overflow-hidden">
          {/* Central Chat Panel (Visible on Desktop, or when MobileView === 'chat') */}
          <div
            className={`flex-1 flex flex-col h-full min-w-0 ${
              ui.mobileView === 'preview' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <ChatPanel
              conversation={activeConversation}
              activeResume={currentResume}
              onOpenUploadModal={() => setUploadOpen(true)}
              onOpenCreateModal={() => setCreateOpen(true)}
              onOpenTailorModal={() => setTailorOpen(true)}
            />
          </div>

          {/* Right Document Preview Panel (Visible on Desktop when previewOpen, or when MobileView === 'preview') */}
          {(previewOpen || ui.mobileView === 'preview') && (
            <div
              className={`w-full lg:w-[48%] xl:w-[50%] h-full flex flex-col shrink-0 ${
                ui.mobileView === 'chat' ? 'hidden md:flex' : 'flex'
              }`}
            >
              <DocxPreviewPanel
                resume={currentResume}
                onOpenRedesignModal={handleOpenRedesign}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        conversationId={activeConversationId}
      />

      <CreateResumeModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        conversationId={activeConversationId}
      />

      {currentResume && (
        <TailorJobModal
          isOpen={tailorOpen}
          onClose={() => setTailorOpen(false)}
          activeResume={currentResume}
          conversationId={activeConversationId}
        />
      )}

      {resumeToRedesign && (
        <RedesignModal
          isOpen={redesignOpen}
          onClose={() => {
            setRedesignOpen(false);
            setResumeToRedesign(null);
          }}
          resume={resumeToRedesign}
          conversationId={activeConversationId}
        />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        onOpenTerms={() => setTermsOpen(true)}
      />

      <HowItWorksModal
        isOpen={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        onOpenUpload={() => setUploadOpen(true)}
        onOpenCreate={() => setCreateOpen(true)}
      />

      <PrivacyModal
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />

      <TermsModal
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
      />
    </div>
  );
}
