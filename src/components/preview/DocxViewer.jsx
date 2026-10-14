import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Button } from '../ui/Button.jsx';
import { ZoomIn, ZoomOut, RotateCcw, AlertCircle, FileText } from 'lucide-react';

export function DocxViewer({ blob, resumeName, isOriginal = false }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    let active = true;
    if (!blob || !containerRef.current) return;

    setLoading(true);
    setError(null);
    containerRef.current.innerHTML = '';

    renderAsync(blob, containerRef.current, null, {
      className: 'docx',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      experimental: false,
      useBase64URL: false,
      renderChanges: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    })
      .then(() => {
        if (!active) return;
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Docx render error:', err);
        setError('This document could not be previewed directly in the browser. You can still download the genuine .docx file below to view it.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [blob]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 15, 140));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 15, 70));
  const handleZoomReset = () => setZoom(100);

  return (
    <div className="relative flex-1 flex flex-col h-full bg-sunken/60 min-h-0 overflow-hidden">
      {/* Zoom / Viewing Controls Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-line text-xs shrink-0 z-10">
        <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
          <FileText className="w-3.5 h-3.5 text-accent" />
          <span className="font-medium text-ink truncate max-w-[160px]">{resumeName}</span>
          {isOriginal && (
            <span className="bg-warn-soft text-warn border border-warn-line px-1 py-0.2 rounded text-[10px]">
              Original File View
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={ZoomOut}
            onClick={handleZoomOut}
            disabled={zoom <= 70}
            className="h-6 w-6 !p-0"
            title="Zoom out"
          />
          <span className="text-[11px] text-ink-muted w-9 text-center font-mono">
            {zoom}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            icon={ZoomIn}
            onClick={handleZoomIn}
            disabled={zoom >= 140}
            className="h-6 w-6 !p-0"
            title="Zoom in"
          />
          <Button
            size="sm"
            variant="ghost"
            icon={RotateCcw}
            onClick={handleZoomReset}
            className="h-6 w-6 !p-0 ml-0.5"
            title="Reset zoom"
          />
        </div>
      </div>

      {/* Preview Content Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-2 text-ink-muted my-auto text-xs">
            <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span>Rendering Word document preview...</span>
          </div>
        )}

        {error && (
          <div className="max-w-md my-auto p-4 bg-surface border border-warn-line rounded-lg text-center space-y-2 shadow-panel">
            <AlertCircle className="w-6 h-6 text-warn mx-auto" />
            <p className="text-xs text-ink-soft leading-relaxed">{error}</p>
          </div>
        )}

        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 100ms ease-out',
          }}
          className={`docx-host w-full flex justify-center ${loading || error ? 'hidden' : 'block'}`}
        >
          <div ref={containerRef} className="w-full max-w-[850px]" />
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="px-3 py-1 bg-surface border-t border-line text-[10px] text-ink-faint text-center shrink-0">
        In-browser preview approximation. Your desktop word processor will render pages and fonts with exact fidelity.
      </div>
    </div>
  );
}
