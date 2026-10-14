import React from 'react';
import { Badge } from '../ui/Badge.jsx';
import { CheckCircle2, AlertCircle, HelpCircle, KeyRound, Sparkles } from 'lucide-react';

export function AnalysisSummary({ analysis, jobTitle }) {
  if (!analysis) return null;

  const { matchEstimate, strengths, gaps, keywordsSupported, keywordsNotEvidenced, questions, summary } =
    analysis;

  return (
    <div className="border border-line-strong rounded-lg bg-surface shadow-panel overflow-hidden text-xs my-3">
      {/* Header */}
      <div className="px-4 py-3 bg-sunken/60 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent shrink-0" />
          <h4 className="font-semibold text-ink">
            {summary || (jobTitle ? `Job Match Analysis: ${jobTitle}` : 'Resume Assessment')}
          </h4>
        </div>
        {matchEstimate && (
          <div className="flex items-center gap-2">
            <span className="text-ink-muted text-[11px]">Estimated Match:</span>
            <Badge
              variant={matchEstimate.score >= 70 ? 'ok' : matchEstimate.score >= 50 ? 'warn' : 'bad'}
              size="md"
            >
              {matchEstimate.score}%
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3.5">
        {/* Match estimate disclaimer */}
        {matchEstimate?.rationale && (
          <p className="text-[11px] text-ink-muted bg-sunken/40 p-2 rounded leading-relaxed border border-line">
            {matchEstimate.rationale}
          </p>
        )}

        {/* Strengths & Gaps 2-column */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {strengths && strengths.length > 0 && (
            <div className="space-y-1.5 p-3 rounded bg-ok-soft/30 border border-ok-line/60">
              <div className="flex items-center gap-1.5 text-ok font-medium text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Demonstrated Strengths</span>
              </div>
              <ul className="space-y-1 text-ink-soft list-disc list-inside text-[11px]">
                {strengths.map((s, i) => (
                  <li key={i} className="leading-snug">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gaps && gaps.length > 0 && (
            <div className="space-y-1.5 p-3 rounded bg-warn-soft/30 border border-warn-line/60">
              <div className="flex items-center gap-1.5 text-warn font-medium text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Gaps / Opportunities</span>
              </div>
              <ul className="space-y-1 text-ink-soft list-disc list-inside text-[11px]">
                {gaps.map((g, i) => (
                  <li key={i} className="leading-snug">
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Keywords breakdown */}
        {((keywordsSupported && keywordsSupported.length > 0) ||
          (keywordsNotEvidenced && keywordsNotEvidenced.length > 0)) && (
          <div className="space-y-2 pt-1 border-t border-line">
            <div className="flex items-center gap-1.5 text-ink-soft font-medium text-[11px]">
              <KeyRound className="w-3.5 h-3.5 shrink-0 text-accent" />
              <span>Keyword Alignment</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywordsSupported?.map((k, i) => (
                <Badge key={i} variant="ok" size="xs">
                  ✓ {k}
                </Badge>
              ))}
              {keywordsNotEvidenced?.map((k, i) => (
                <Badge key={i} variant="neutral" size="xs" className="opacity-75">
                  — {k} (not evidenced)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Questions to uncover omitted experience */}
        {questions && questions.length > 0 && (
          <div className="p-3 bg-accent-softer/50 border border-accent-line/60 rounded space-y-1.5">
            <div className="flex items-center gap-1.5 text-accent font-medium text-[11px]">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>To strengthen your resume, did you have experience in any of these?</span>
            </div>
            <ul className="space-y-1 text-ink-soft list-disc list-inside text-[11px]">
              {questions.map((q, i) => (
                <li key={i} className="leading-snug">
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-ink-faint italic pt-0.5">
              Reply in the chat with your answers, and I will integrate them into your resume content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
