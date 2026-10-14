import { z } from 'zod';
import { normalizeForCompare } from '../../../../shared/textDiff.js';
import { resumeDataSchema } from '../resumes/schema.js';

const rawSuggestion = z.object({
  targetId: z.string().min(1).max(80),
  kind: z.enum(['replace', 'insert_after']).default('replace'),
  section: z.string().max(80).optional().default(''),
  proposed: z.string().min(1).max(3000),
  explanation: z.string().max(600).optional().default(''),
  confirm: z.array(z.string().max(300)).max(6).optional().default([]),
});

const stringList = z.array(z.string().max(400)).max(20).optional().default([]);

const analysisSchema = z.object({
  summary: z.string().max(600).optional().default(''),
  matchEstimate: z
    .object({ score: z.number().min(0).max(100), rationale: z.string().max(600).default('') })
    .nullable()
    .optional()
    .default(null),
  strengths: stringList,
  gaps: stringList,
  keywordsSupported: stringList,
  keywordsNotEvidenced: stringList,
  questions: stringList,
});

export const aiResponseSchema = z.object({
  reply: z.string().min(1).max(8000),
  jobTitle: z.string().max(160).nullable().optional().default(null),
  jobDescriptionProvided: z.boolean().optional().default(false),
  needs: z.array(z.enum(['resume', 'job_description'])).optional().default([]),
  analysis: analysisSchema.nullable().optional().default(null),
  suggestions: z.array(z.unknown()).optional().default([]),
  resumeUpdate: z.unknown().optional().default(null),
});

const NUMBER_RE = /\d[\d.,]*\+?%?/g;
const PLACEHOLDER_RE = /\[[^\]]{1,80}\]|\{[^}]{1,80}\}|\bX{2,}\b|\b_{3,}\b/;

function numbersIn(text) {
  return new Set((String(text).match(NUMBER_RE) || []).map((n) => n.replace(/[.,]+$/, '')));
}

/** Distinctive terms (proper nouns / acronyms / tools) used in the job description. */
function distinctiveJobTerms(jobDescription) {
  if (!jobDescription) return [];
  const lowerWords = new Set((jobDescription.match(/\b[a-z][a-z0-9+#]*\b/g) || []).map((w) => w));
  const found = new Set();
  for (const m of jobDescription.matchAll(/\b([A-Z][A-Za-z0-9+#./-]{1,}|[A-Za-z]+[0-9+#]+[A-Za-z0-9+#]*)\b/g)) {
    const term = m[1];
    if (term.length < 3) continue;
    if (lowerWords.has(term.toLowerCase())) continue; // also seen in lowercase: ordinary word
    found.add(term);
  }
  return [...found].slice(0, 80);
}

const specials = (s) => (s.match(/[\t\n]/g) || []).join('');

/**
 * Validates AI suggestions against the real document. The `original` text always comes from the
 * app's own data, never from the model. Returns { suggestions, dropped }.
 */
export function validateSuggestions(rawList, { fields, mode, userTexts, jobDescription }) {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const out = [];
  let dropped = 0;
  const seen = new Set();

  const knownText = [...fields.map((f) => f.text), ...userTexts].join('\n');
  const knownNumbers = numbersIn(knownText);
  const knownLower = knownText.toLowerCase();
  const jobTerms = distinctiveJobTerms(jobDescription);

  for (const item of rawList) {
    const parsed = rawSuggestion.safeParse(item);
    if (!parsed.success) {
      dropped++;
      continue;
    }
    const s = parsed.data;
    const field = byId.get(s.targetId);
    if (!field || !field.editable || field.isHeading || /^(page-header|page-footer)$/.test(field.section)) {
      dropped++;
      continue;
    }
    if (s.kind === 'insert_after' && mode === 'content') {
      dropped++;
      continue;
    }

    let proposed = s.proposed.replace(/\r/g, '');
    if (s.kind === 'replace') {
      if (specials(proposed) !== specials(field.text)) {
        dropped++;
        continue;
      }
      if (normalizeForCompare(proposed) === normalizeForCompare(field.text)) {
        dropped++;
        continue;
      }
    } else {
      proposed = proposed.replace(/[\t\n]+/g, ' ').trim();
    }
    if (!proposed.trim()) {
      dropped++;
      continue;
    }
    if (proposed.length > Math.max(field.text.length * 4, 700)) {
      dropped++;
      continue;
    }
    const key = `${s.kind}:${s.targetId}`;
    if (seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);

    // Truthfulness guards: flag (never silently accept) unsupported details.
    const warnings = [...s.confirm];
    const unknownNumbers = [...numbersIn(proposed)].filter((n) => !knownNumbers.has(n));
    if (unknownNumbers.length) {
      warnings.push(`Contains a figure (${unknownNumbers.slice(0, 3).join(', ')}) that is not in your resume or messages. Confirm it is accurate, or edit it.`);
    }
    if (PLACEHOLDER_RE.test(proposed)) warnings.push('Contains a placeholder that you need to fill in before accepting.');
    const proposedLower = proposed.toLowerCase();
    const borrowed = jobTerms.filter((t) => proposedLower.includes(t.toLowerCase()) && !knownLower.includes(t.toLowerCase()));
    if (borrowed.length) {
      warnings.push(`Mentions ${borrowed.slice(0, 3).join(', ')} from the job description, which is not evidenced elsewhere in your resume. Only accept if it is true.`);
    }

    out.push({
      targetId: s.targetId,
      kind: s.kind,
      section: s.section || field.section,
      original: field.text,
      proposed,
      explanation: s.explanation,
      warnings: [...new Set(warnings)],
      needsConfirmation: warnings.length > 0,
    });
    if (out.length >= 15) break;
  }
  return { suggestions: out, dropped };
}

export function validateResumeUpdate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // Allow partial objects: validate each provided key against the full schema's shape.
  const shape = resumeDataSchema.shape;
  const result = {};
  for (const key of Object.keys(shape)) {
    if (!(key in raw)) continue;
    const parsed = shape[key].safeParse(raw[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return Object.keys(result).length ? result : null;
}
