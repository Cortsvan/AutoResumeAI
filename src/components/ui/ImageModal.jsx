import React from 'react';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { Download, ExternalLink } from 'lucide-react';

export function ImageModal({ isOpen, onClose, image }) {
  if (!image) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={image.name || 'Screenshot Preview'}
      description="Reference image attached to this message"
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-ink-muted">
            {image.width && image.height ? `${image.width} × ${image.height} px` : ''}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={image.dataUrl}
              download={image.name || 'screenshot.png'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface hover:bg-sunken border border-line rounded text-ink transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-center bg-sunken/40 rounded-lg p-2 max-h-[70vh] overflow-auto">
        <img
          src={image.dataUrl}
          alt={image.name || 'Screenshot'}
          className="max-w-full max-h-[65vh] object-contain rounded border border-line shadow-panel"
        />
      </div>
    </Modal>
  );
}
