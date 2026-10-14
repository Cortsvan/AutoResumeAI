import React, { useState } from 'react';
import { LiteMarkdown } from '../../utils/LiteMarkdown.jsx';
import { SuggestionCard } from './SuggestionCard.jsx';
import { AnalysisSummary } from './AnalysisSummary.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { ImageModal } from '../ui/ImageModal.jsx';
import { formatBytes, relativeTime } from '../../utils/format.js';
import { FileText, CheckCheck, Bot, User, Info, Maximize2, PlusCircle } from 'lucide-react';
import {
  acceptSuggestion,
  rejectSuggestion,
  acceptAllSuggestions,
} from '../../services/chatOrchestrator.js';

export function MessageItem({ message, conversationId, onOpenCreateModal, onOpenUploadModal }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const isUser = message.role === 'user';
  const suggestions = message.suggestions || [];
  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <div className={`flex gap-3.5 py-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Bot Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-accent" />
        </div>
      )}

      {/* Message content box */}
      <div className={`max-w-2xl w-full space-y-3 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* User / Bot Bubble */}
        <div
          className={`rounded-lg p-4 text-sm leading-relaxed ${
            isUser
              ? 'bg-ink text-paper ml-auto max-w-xl shadow-panel'
              : 'bg-surface border border-line-strong shadow-panel text-ink'
          }`}
        >
          {/* Header metadata for bot */}
          {!isUser && (
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-line text-xs">
              <span className="font-semibold text-ink text-[11px] tracking-wide uppercase">
                AutoResumeAI
              </span>
              <div className="flex items-center gap-2">
                {message.isDemo && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] text-warn bg-warn-soft/80 border border-warn-line px-1.5 py-0.5 rounded font-medium"
                    title="Live AI API is not configured on the server. Showing sample suggestions in Demo Mode."
                  >
                    <Info className="w-3 h-3" />
                    Demo Mode
                  </span>
                )}
                <span className="text-[10px] text-ink-faint">
                  {relativeTime(message.createdAt)}
                </span>
              </div>
            </div>
          )}

          {/* Attachment chip for user */}
          {message.attachment && (
            <div className="mb-2.5 flex items-center gap-2 px-3 py-1.5 bg-paper/10 border border-white/20 rounded text-xs text-paper">
              <FileText className="w-4 h-4 text-accent-soft shrink-0" />
              <span className="font-medium truncate">{message.attachment.name}</span>
              {message.attachment.size && (
                <span className="text-[11px] opacity-75 shrink-0">
                  ({formatBytes(message.attachment.size)})
                </span>
              )}
            </div>
          )}

          {/* Attached screenshot thumbnails */}
          {message.images && message.images.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {message.images.map((img, i) => (
                  <button
                    key={img.id || i}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className="group relative block overflow-hidden rounded-md border border-white/25 bg-black/20 hover:border-accent focus:outline-none transition-all shadow-sm"
                    title={`Click to enlarge ${img.name || 'screenshot'}`}
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.name || 'Screenshot'}
                      className="h-16 w-24 object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Markdown message body */}
          <LiteMarkdown text={message.content} />

          {/* Action buttons when a resume is needed */}
          {!isUser && message.needs?.includes('resume') && (
            <div className="mt-3.5 pt-3 border-t border-line flex flex-wrap items-center gap-2">
              {onOpenCreateModal && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={PlusCircle}
                  onClick={onOpenCreateModal}
                  className="text-xs !h-8"
                >
                  Create from Scratch
                </Button>
              )}
              {onOpenUploadModal && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={FileText}
                  onClick={onOpenUploadModal}
                  className="text-xs !h-8"
                >
                  Upload DOCX Resume
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Analysis Card */}
        {message.analysis && (
          <AnalysisSummary analysis={message.analysis} jobTitle={message.jobTitle} />
        )}

        {/* Suggestions section */}
        {suggestions.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink">Suggested Improvements</span>
                <Badge variant={pendingCount > 0 ? 'accent' : 'ok'} size="xs">
                  {pendingCount > 0 ? `${pendingCount} pending` : 'All reviewed'}
                </Badge>
              </div>

              {pendingCount > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={CheckCheck}
                  onClick={() => acceptAllSuggestions(conversationId, message.id)}
                  className="text-xs h-7"
                >
                  Accept all ({pendingCount})
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onAccept={(id) => acceptSuggestion(conversationId, message.id, id)}
                  onReject={(id) => rejectSuggestion(conversationId, message.id, id)}
                  onEditAndAccept={(id, text) =>
                    acceptSuggestion(conversationId, message.id, id, text)
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-sunken border border-line-strong flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-ink-soft" />
        </div>
      )}

      {/* Fullscreen Screenshot Modal */}
      <ImageModal
        isOpen={Boolean(selectedImage)}
        onClose={() => setSelectedImage(null)}
        image={selectedImage}
      />
    </div>
  );
}
