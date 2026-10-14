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
  reply: z.string().min(1).max(12000).default('Here is your resume update:'),
  jobTitle: z.string().max(160).nullable().optional().default(null),
  jobDescriptionProvided: z.boolean().optional().default(false),
  needs: z.array(z.string()).optional().default([]),
  analysis: analysisSchema.nullable().optional().default(null),
  suggestions: z.union([z.array(z.unknown()), z.null()]).optional().transform((v) => (Array.isArray(v) ? v : [])),
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
  const normalized = { ...raw };

  if (Array.isArray(normalized.skills)) {
    normalized.skills = normalized.skills.map((s, idx) => ({
      id: s?.id || `sk_${idx}`,
      label: typeof s?.label === 'string' ? s.label : 'Skills',
      items: Array.isArray(s?.items) ? s.items.join(', ') : (typeof s?.items === 'string' ? s.items : ''),
    }));
  }

  if (Array.isArray(normalized.experience)) {
    normalized.experience = normalized.experience.map((e, idx) => ({
      id: e?.id || `exp_${idx}`,
      title: e?.title || '',
      company: e?.company || '',
      location: e?.location || '',
      start: e?.start || '',
      end: e?.end || '',
      bullets: Array.isArray(e?.bullets) ? e.bullets : (typeof e?.bullets === 'string' && e.bullets ? [e.bullets] : []),
    }));
  }

  if (Array.isArray(normalized.projects)) {
    normalized.projects = normalized.projects.map((p, idx) => ({
      id: p?.id || `proj_${idx}`,
      name: p?.name || '',
      link: p?.link || '',
      tech: p?.tech || '',
      description: p?.description || '',
      bullets: Array.isArray(p?.bullets) ? p.bullets : (typeof p?.bullets === 'string' && p.bullets ? [p.bullets] : []),
    }));
  }

  if (Array.isArray(normalized.education)) {
    normalized.education = normalized.education.map((ed, idx) => ({
      id: ed?.id || `edu_${idx}`,
      school: ed?.school || '',
      degree: ed?.degree || '',
      location: ed?.location || '',
      start: ed?.start || '',
      end: ed?.end || '',
      details: Array.isArray(ed?.details) ? ed.details : (typeof ed?.details === 'string' && ed.details ? [ed.details] : []),
    }));
  }

  if (Array.isArray(normalized.certifications)) {
    normalized.certifications = normalized.certifications.map((c, idx) => ({
      id: c?.id || `cert_${idx}`,
      name: c?.name || '',
      issuer: c?.issuer || '',
      date: c?.date || '',
    }));
  }

  // Allow partial objects: validate each provided key against the full schema's shape.
  const shape = resumeDataSchema.shape;
  const result = {};
  for (const key of Object.keys(shape)) {
    if (!(key in normalized)) continue;
    const parsed = shape[key].safeParse(normalized[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return Object.keys(result).length ? result : null;
}
