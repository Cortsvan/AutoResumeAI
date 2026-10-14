import React, { useState } from 'react';
import { useStore, createConversation, deleteConversation, setUi, setAuthModalOpen, signOut } from '../../app/store.js';
import { brand } from '../../app/brand.js';
import { downloadResume, duplicateResume, deleteResume } from '../../services/resumeRepo.js';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  Plus,
  MessageSquare,
  FileText,
  Settings,
  Trash2,
  Copy,
  Download,
  X,
  Target,
  Palette,
  Sparkles,
  HelpCircle,
  User,
  LogIn,
  LogOut,
  Shield,
  Infinity as InfinityIcon,
} from 'lucide-react';

export function Sidebar({
  activeConversationId,
  onSelectConversation,
  activeResumeId,
  onSelectResume,
  onOpenUploadModal,
  onOpenCreateModal,
  onOpenSettingsModal,
  onOpenRedesignModal,
  onOpenHowItWorks,
  onOpenPrivacy,
}) {
  const conversations = useStore((s) => s.conversations);
  const resumes = useStore((s) => s.resumes);
  const serverConfig = useStore((s) => s.serverConfig);
  const auth = useStore((s) => s.auth);
  const user = auth.user;
  const profile = auth.profile;
  const quota = auth.quota;
  const isAdmin = profile?.role === 'admin';
  const [tab, setTab] = useState('chats'); // 'chats' | 'resumes'

  const isAiConfigured = Boolean(serverConfig?.ai?.configured);

  const handleNewChat = () => {
    const conv = createConversation({
      context: { activeResumeId: null, creating: false },
    });
    onSelectConversation(conv.id);
  };

  return (
    <aside className="w-64 sm:w-72 bg-surface border-r border-line flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-line flex items-center justify-between">
        <a href="#/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded bg-ink flex items-center justify-center text-paper font-bold text-xs group-hover:bg-accent transition-colors">
            AR
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-xs text-ink tracking-tight">
              {brand.name}
            </span>
            <span className="text-[10px] text-ink-muted -mt-0.5">Resume Studio</span>
          </div>
        </a>

        {/* Mobile close sidebar button */}
        <button
          onClick={() => setUi({ sidebarOpen: false })}
          className="p-1 text-ink-faint hover:text-ink md:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Action Button */}
      <div className="p-3 border-b border-line">
        <Button
          variant="primary"
          icon={Plus}
          onClick={handleNewChat}
          className="w-full text-xs justify-start h-8 shadow-panel"
        >
          New Conversation
        </Button>
      </div>

      {/* Navigation tabs */}
      <div className="flex px-3 pt-2 border-b border-line gap-2 text-xs">
        <button
          onClick={() => setTab('chats')}
          className={`pb-2 px-1 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            tab === 'chats'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chats</span>
          <span className="text-[10px] text-ink-faint">({conversations.length})</span>
        </button>

        <button
          onClick={() => setTab('resumes')}
          className={`pb-2 px-1 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            tab === 'resumes'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Resumes</span>
          <span className="text-[10px] text-ink-faint">({resumes.length})</span>
        </button>
      </div>

      {/* Scrollable list area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tab === 'chats' ? (
          conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-ink-faint">
              No conversations yet. Click &quot;New Conversation&quot; to begin.
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConversationId;
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-accent-soft text-accent font-medium'
                      : 'text-ink-soft hover:bg-sunken hover:text-ink'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{c.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(c.id);
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:text-bad text-ink-faint rounded"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
              <span className="text-[11px] font-medium text-ink-muted uppercase tracking-wide">
                My Resumes
              </span>
              <div className="flex gap-1">
                <button
                  onClick={onOpenUploadModal}
                  className="text-[11px] text-accent hover:underline"
                >
                  + Upload
                </button>
                <span className="text-ink-faint">·</span>
                <button
                  onClick={onOpenCreateModal}
                  className="text-[11px] text-accent hover:underline"
                >
                  + Create
                </button>
              </div>
            </div>

            {resumes.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink-faint">
                No resumes saved yet. Upload a .docx or create one.
              </div>
            ) : (
              resumes.map((r) => {
                const isActive = r.id === activeResumeId;
                return (
                  <div
                    key={r.id}
                    onClick={() => onSelectResume(r.id)}
                    className={`group p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      isActive
                        ? 'bg-surface border-accent shadow-panel'
                        : 'bg-surface/60 border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="font-medium text-ink truncate">{r.name}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadResume(r);
                          }}
                          className="p-1 hover:text-accent text-ink-faint rounded"
                          title="Download DOCX"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateResume(r.id);
                          }}
                          className="p-1 hover:text-ink text-ink-faint rounded"
                          title="Duplicate copy"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteResume(r.id);
                          }}
                          className="p-1 hover:text-bad text-ink-faint rounded"
                          title="Delete resume"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-ink-muted">
                      <Badge variant="neutral" size="xs">
                        {r.kind === 'imported' ? 'Imported' : 'Created'}
                      </Badge>
                      {r.targetJob?.title && (
                        <Badge variant="ok" size="xs" className="truncate max-w-[110px]">
                          {r.targetJob.title}
                        </Badge>
                      )}
                      {r.kind === 'imported' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRedesignModal(r);
                          }}
                          className="ml-auto text-accent hover:underline flex items-center gap-0.5"
                          title="Redesign into a template"
                        >
                          <Palette className="w-2.5 h-2.5" />
                          Redesign
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* User Account & Quota Status Card */}
      <div className="p-3 border-t border-line bg-surface">
        {!user ? (
          <div className="p-2.5 bg-sunken rounded-lg border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                Free AI Quota
              </span>
              <span className="text-[10px] text-ink-muted">10 req/day</span>
            </div>
            <p className="text-[10.5px] text-ink-soft leading-tight">
              Sign in to unlock daily AI suggestions and isolate your private resumes.
            </p>
            <Button
              size="sm"
              variant="primary"
              icon={LogIn}
              onClick={() => setAuthModalOpen(true)}
              className="w-full h-7 text-xs justify-center shadow-panel"
            >
              Sign In / Register
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* User Info Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-full bg-accent-bg border border-accent/20 flex items-center justify-center text-accent shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-ink truncate" title={user.email}>
                    {user.email}
                  </div>
                  <div className="text-[9.5px] text-ink-faint flex items-center gap-1">
                    {isAdmin ? (
                      <span className="text-accent font-semibold flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" /> Admin
                      </span>
                    ) : (
                      <span>Standard Account</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isAdmin && (
                  <a
                    href="#/admin"
                    className="p-1 text-ink-faint hover:text-accent rounded transition-colors"
                    title="Open Administrator Dashboard"
                  >
                    <Shield className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={signOut}
                  className="p-1 text-ink-faint hover:text-danger rounded transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quota Indicator */}
            {(() => {
              const isUnlimitedQuota = Boolean(isAdmin || profile?.is_unlimited || quota?.isUnlimited);
              return (
                <div className="p-2 bg-sunken rounded-md border border-line">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-ink-muted">Daily AI Quota</span>
                    {isUnlimitedQuota ? (
                      <span className="text-accent font-medium flex items-center gap-1">
                        <InfinityIcon className="w-3 h-3" /> Unlimited
                      </span>
                    ) : (
                      <span className="font-semibold text-ink">
                        {quota?.remainingToday ?? 10} / {quota?.dailyLimit ?? 10} left
                      </span>
                    )}
                  </div>
                  {!isUnlimitedQuota && (
                    <div className="w-full h-1 bg-paper rounded-full overflow-hidden mt-1.5 border border-line/60">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              (((quota?.remainingToday ?? 10) / (quota?.dailyLimit || 10)) * 100),
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Bottom Footer Toolbar */}
      <div className="p-3 border-t border-line bg-sunken/40 space-y-2">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isAiConfigured ? 'bg-ok' : 'bg-warn'
              }`}
            />
            <span>{isAiConfigured ? 'Live AI Active' : 'Demo Mode'}</span>
          </div>

          <div className="flex items-center gap-1">
            {onOpenHowItWorks && (
              <Button
                size="sm"
                variant="ghost"
                icon={HelpCircle}
                onClick={onOpenHowItWorks}
                className="h-7 px-2 text-xs"
                title="How AutoResumeAI Works"
              >
                Help
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              icon={Settings}
              onClick={onOpenSettingsModal}
              className="h-7 px-2 text-xs"
            >
              Settings
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
