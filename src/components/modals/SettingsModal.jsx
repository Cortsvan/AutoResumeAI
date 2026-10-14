import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { useStore, clearAllData, toast } from '../../app/store.js';
import { Cpu, ShieldCheck, Database, Trash2, AlertTriangle } from 'lucide-react';

export function SettingsModal({ isOpen, onClose, onOpenPrivacy, onOpenTerms }) {
  const serverConfig = useStore((s) => s.serverConfig);
  const serverOnline = useStore((s) => s.serverOnline);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isAiConfigured = Boolean(serverConfig?.ai?.configured);

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearAllData();
      toast('All local data, resumes, and chats have been erased.', 'info');
      setConfirmClear(false);
      onClose();
    } catch (err) {
      toast(err.message || 'Error clearing data.', 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Application Settings & Privacy"
      description="Manage local storage, server AI connection, and privacy configurations."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5 text-xs">
        {/* AI Engine Status */}
        <div className="p-4 bg-surface border border-line-strong rounded-lg shadow-panel space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-accent" />
              AI Intelligence Engine
            </span>
            <Badge variant={isAiConfigured ? 'ok' : 'warn'}>
              {isAiConfigured ? 'Live AI Connected' : 'Demo Mode Active'}
            </Badge>
          </div>

          <p className="text-ink-soft leading-relaxed text-[11px]">
            {isAiConfigured ? (
              <>
                Connected to provider: <strong>{serverConfig.ai.provider}</strong> (model:{' '}
                <code>{serverConfig.ai.model}</code>).
              </>
            ) : (
              <>
                No AI API key is configured on the backend. The application runs in full{' '}
                <strong>Demo Mode</strong>, providing sample reviewable suggestions and full DOCX
                editing, generation, and downloads without calling an external service.
              </>
            )}
          </p>

          {!isAiConfigured && (
            <div className="p-2.5 bg-sunken rounded text-[11px] text-ink-muted">
              To enable live AI, set <code>AI_PROVIDER</code>, <code>AI_API_KEY</code>, and{' '}
              <code>AI_MODEL</code> in <code>server/.env</code>.
            </div>
          )}
        </div>

        {/* Local Storage & Privacy */}
        <div className="p-4 bg-surface border border-line rounded-lg shadow-panel space-y-2.5">
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            <ShieldCheck className="w-4 h-4 text-ok" />
            <span>Privacy & Legal Documentation</span>
          </div>
          <p className="text-[11px] text-ink-soft leading-relaxed">
            All your resumes, version history, and conversations are saved in your browser&apos;s
            offline <strong>IndexedDB</strong> storage. You retain 100% document ownership.
          </p>
          <div className="flex items-center gap-2 pt-1">
            {onOpenPrivacy && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onOpenPrivacy();
                }}
                className="text-[11px] h-7 px-2.5"
              >
                Privacy Policy
              </Button>
            )}
            {onOpenTerms && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onOpenTerms();
                }}
                className="text-[11px] h-7 px-2.5"
              >
                Terms of Service
              </Button>
            )}
          </div>
        </div>

        {/* Clear Data */}
        <div className="p-4 bg-bad-soft/30 border border-bad-line/70 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-bad flex items-center gap-1.5">
                <Database className="w-4 h-4 text-bad" />
                Clear Local Data
              </h4>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Permanently delete all saved resumes, DOCX blobs, and chat conversations from this browser.
              </p>
            </div>
          </div>

          {confirmClear ? (
            <div className="pt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="danger"
                icon={Trash2}
                onClick={handleClearAll}
                loading={clearing}
              >
                Yes, Delete Everything
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="pt-1">
              <Button
                size="sm"
                variant="dangerGhost"
                icon={Trash2}
                onClick={() => setConfirmClear(true)}
              >
                Erase All Saved Data
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
