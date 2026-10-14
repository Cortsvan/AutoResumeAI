import React, { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  ShieldCheck,
  Lock,
  Database,
  Trash2,
  HardDrive,
  EyeOff,
  FileCheck,
  Server,
} from 'lucide-react';

export function PrivacyModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('storage'); // 'storage' | 'ai' | 'documents'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Privacy & Document Safety"
      description="How AutoResumeAI protects your personal information, files, and privacy."
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-ink-muted flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-ok" />
            Zero remote document storage · Resumes & chats stored 100% in your browser
          </span>
          <Button variant="primary" onClick={onClose} size="sm">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Navigation Tabs */}
        <div className="flex border-b border-line gap-2">
          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'storage'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Local Browser Storage
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ai'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            AI Privacy & Data
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'documents'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            DOCX File Safety
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={`pb-2 px-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'policy'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Full Privacy Policy
          </button>
        </div>

        {/* Tab 1: Local Storage */}
        {activeTab === 'storage' && (
          <div className="space-y-3 pt-1">
            <div className="p-4 bg-surface border border-line-strong rounded-xl shadow-panel space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-accent" />
                  Your Data Stays on Your Device
                </span>
                <Badge variant="ok" size="xs">
                  IndexedDB Local
                </Badge>
              </div>

              <p className="text-ink-soft text-[11px] leading-relaxed">
                AutoResumeAI operates with a privacy-first local architecture. Your resumes,
                chat history, and tailored versions are stored directly in your browser's
                local IndexedDB database—not on a remote company database.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 bg-sunken/40 rounded-lg border border-line space-y-1">
                  <div className="font-semibold text-ink text-[11px]">User Account Isolation</div>
                  <p className="text-[10px] text-ink-muted leading-relaxed">
                    When you sign in, your local database is dynamically partitioned so your resumes and chats cannot be seen by other users on the same computer.
                  </p>
                </div>

                <div className="p-3 bg-sunken/40 rounded-lg border border-line space-y-1">
                  <div className="font-semibold text-ink text-[11px]">Complete Data Erasure</div>
                  <p className="text-[10px] text-ink-muted leading-relaxed">
                    You can wipe all stored resumes, conversation history, and versions at any time in Settings with one click.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-surface border border-line rounded-lg text-[11px] text-ink-muted flex items-center justify-between">
              <span>Zero tracking cookies · Zero behavioral analytics</span>
              <span className="text-ok font-medium">100% Private</span>
            </div>
          </div>
        )}

        {/* Tab 2: AI Privacy */}
        {activeTab === 'ai' && (
          <div className="space-y-3 pt-1">
            <div className="p-4 bg-surface border border-line-strong rounded-xl shadow-panel space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-accent" />
                  How AI Processes Your Resume
                </span>
                <Badge variant="accent" size="xs">
                  In-Memory Only
                </Badge>
              </div>

              <p className="text-ink-soft text-[11px] leading-relaxed">
                When you request resume suggestions or job tailoring, only the necessary text
                content is passed to the AI engine to generate recommendations.
              </p>

              <div className="space-y-2 bg-paper p-3 rounded-lg border border-line text-[11px]">
                <div className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span className="text-ink-soft">
                    <strong>No model training:</strong> Your resume data and personal information are not used to train public AI foundation models.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span className="text-ink-soft">
                    <strong>In-memory server processing:</strong> Documents are processed in temporary RAM memory only. No uploaded files are ever saved to the server disk.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span className="text-ink-soft">
                    <strong>Demo Mode available:</strong> You can test the entire workflow with built-in realistic suggestions without configuring any external AI keys.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-accent font-bold">ℹ</span>
                  <span className="text-ink-soft">
                    <strong>External AI Processing:</strong> When live AI is used, resume text sent to OpenRouter is processed externally under OpenRouter and the chosen upstream provider's privacy policies. No credentials or full files are retained on our servers.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: DOCX File Safety */}
        {activeTab === 'documents' && (
          <div className="space-y-3 pt-1">
            <div className="p-4 bg-surface border border-line-strong rounded-xl shadow-panel space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-accent" />
                  Your Original File is Never Overwritten
                </span>
                <Badge variant="ok" size="xs">
                  Immutable Master
                </Badge>
              </div>

              <p className="text-ink-soft text-[11px] leading-relaxed">
                When you upload a DOCX resume, AutoResumeAI locks the original file into an untouched,
                immutable record. All improvements and edits are created in separate working drafts.
              </p>

              <div className="space-y-2 bg-paper p-3 rounded-lg border border-line text-[11px]">
                <div className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span className="text-ink-soft">
                    <strong>Original file preserved:</strong> You can always view or download your original uploaded file exactly as it was.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span className="text-ink-soft">
                    <strong>Version history & undo:</strong> Every accepted suggestion creates an undo checkpoint. You can revert any edit with one click.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ok font-bold">✓</span>
                  <span className="text-ink-soft">
                    <strong>Separate job versions:</strong> Create tailored resumes for different roles without altering your main master copy.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Full Privacy Policy */}
        {activeTab === 'policy' && (
          <div className="space-y-4 pt-1 max-h-[50vh] overflow-y-auto pr-1 text-ink-soft text-[11px] leading-relaxed">
            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">1. Information We Collect</h3>
              <p>
                <strong>Account Information:</strong> When you register for an account, we collect your first name, last name, email address, and authentication credentials through Supabase Auth.
              </p>
              <p>
                <strong>Document Data:</strong> Uploaded DOCX resumes, extracted XML text, edits, and conversation logs are stored locally within your browser's IndexedDB storage.
              </p>
              <p>
                <strong>Operational Telemetry:</strong> We maintain minimal server-side operational logs including daily request counts, token usage, and quota status to enforce usage tiers and spending caps. We do not store persistent copies of your resume documents on our backend servers.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">2. In-Memory Processing Architecture</h3>
              <p>
                When a document is uploaded for structure inspection or XML diffing, it is parsed strictly in volatile memory (RAM) and immediately cleared. No files are persisted to server disks or remote object storage.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">3. External AI Data Processing (OpenRouter)</h3>
              <p>
                When you initiate an AI suggestion, job tailoring, or resume chat query, the specific resume text excerpts and instructions are transmitted to OpenRouter and its upstream model providers. These transmissions occur under zero-retention or transient processing agreements. Your document content is not used to train public foundation models.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">4. Local Storage and Multi-Account Isolation</h3>
              <p>
                AutoResumeAI is built on a local-first storage design. Data saved in your browser (resumes, drafts, version checkpoints) is keyed to your authenticated account ID, preventing accidental crossover between different users on shared devices.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">5. Data Retention and Deletion</h3>
              <p>
                You have the full right to delete your data at any time. You can wipe all locally stored documents and conversation histories in Settings with one click. To delete your account and associated server metadata, contact an administrator.
              </p>
            </section>

            <section className="space-y-1">
              <h3 className="font-semibold text-ink text-xs">6. Contact & Inquiries</h3>
              <p>
                If you have questions regarding this Privacy Policy or your personal data, please reach out to the administrator of your AutoResumeAI instance.
              </p>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}
