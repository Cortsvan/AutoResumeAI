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

const stringList = z
  .union([z.array(z.unknown()), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (Array.isArray(v)) {
      return v
        .map((s) => (typeof s === 'string' ? s.slice(0, 1000) : (typeof s === 'object' && s !== null ? JSON.stringify(s).slice(0, 1000) : String(s || ''))))
        .filter(Boolean)
        .slice(0, 50);
    }
    if (typeof v === 'string' && v.trim()) return [v.slice(0, 1000)];
    return [];
  });

const analysisSchema = z
  .union([
    z.object({
      summary: z
        .union([z.string(), z.null()])
        .optional()
        .transform((v) => (typeof v === 'string' ? v.slice(0, 4000) : '')),
      matchEstimate: z
        .union([
          z.object({
            score: z.union([z.number(), z.string()]).transform((s) => {
              const n = Number(String(s).replace(/[^0-9.]/g, ''));
              return Number.isFinite(n) ? Math.min(Math.max(0, n), 100) : 0;
            }),
            rationale: z
              .union([z.string(), z.null()])
              .optional()
              .transform((v) => (typeof v === 'string' ? v.slice(0, 2000) : '')),
          }),
          z.null(),
        ])
        .optional()
        .default(null),
      strengths: stringList,
      gaps: stringList,
      keywordsSupported: stringList,
      keywordsNotEvidenced: stringList,
      questions: stringList,
    }),
    z.string().transform((str) => ({
      summary: str.slice(0, 4000),
      matchEstimate: null,
      strengths: [],
      gaps: [],
      keywordsSupported: [],
      keywordsNotEvidenced: [],
      questions: [],
    })),
    z.null(),
  ])
  .optional()
  .default(null);

export const aiResponseSchema = z.object({
  reply: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (typeof v === 'string' && v.trim()) return v.trim();
      return 'Here are your extracted resume details:';
    }),
  jobTitle: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === 'string' ? v.slice(0, 160) : null)),
  jobDescriptionProvided: z.unknown().optional().transform((v) => Boolean(v)),
  needs: z
    .union([z.array(z.string()), z.string(), z.null()])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [])),
  analysis: analysisSchema,
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

  if (normalized.contact && typeof normalized.contact === 'object') {
    const rawLinks = Array.isArray(normalized.contact.links) ? normalized.contact.links : [];
    const links = rawLinks
      .map((l) => {
        if (typeof l === 'string') return { label: 'Link', url: l.slice(0, 300) };
        if (typeof l === 'object' && l !== null) {
          return {
            label: String(l.label || l.name || l.title || 'Link').slice(0, 80),
            url: String(l.url || l.href || l.link || '').slice(0, 300),
          };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 8);

    normalized.contact = {
      name: String(normalized.contact.name || '').slice(0, 120),
      headline: String(normalized.contact.headline || '').slice(0, 160),
      email: String(normalized.contact.email || '').slice(0, 160),
      phone: String(normalized.contact.phone || '').slice(0, 60),
      location: String(normalized.contact.location || '').slice(0, 160),
      links,
    };
  }

  if (typeof normalized.summary === 'string') {
    normalized.summary = normalized.summary.slice(0, 2500);
  } else if (Array.isArray(normalized.summary)) {
    normalized.summary = normalized.summary.join('\n').slice(0, 2500);
  }

  if (Array.isArray(normalized.skills)) {
    normalized.skills = normalized.skills.slice(0, 20).map((s, idx) => ({
      id: s?.id || `sk_${idx}`,
      label: String(s?.label || 'Skills').slice(0, 120),
      items: Array.isArray(s?.items)
        ? s.items.join(', ').slice(0, 800)
        : String(s?.items || '').slice(0, 800),
    }));
  }

  if (Array.isArray(normalized.experience)) {
    normalized.experience = normalized.experience.slice(0, 20).map((e, idx) => ({
      id: e?.id || `exp_${idx}`,
      title: String(e?.title || '').slice(0, 160),
      company: String(e?.company || '').slice(0, 160),
      location: String(e?.location || '').slice(0, 160),
      start: String(e?.start || '').slice(0, 40),
      end: String(e?.end || '').slice(0, 40),
      bullets: (Array.isArray(e?.bullets) ? e.bullets : (e?.bullets ? [e.bullets] : []))
        .map((b) => String(b || '').slice(0, 1200))
        .filter(Boolean)
        .slice(0, 30),
    }));
  }

  if (Array.isArray(normalized.projects)) {
    normalized.projects = normalized.projects.slice(0, 20).map((p, idx) => ({
      id: p?.id || `proj_${idx}`,
      name: String(p?.name || '').slice(0, 160),
      link: String(p?.link || '').slice(0, 300),
      tech: String(p?.tech || '').slice(0, 300),
      description: String(p?.description || '').slice(0, 1200),
      bullets: (Array.isArray(p?.bullets) ? p.bullets : (p?.bullets ? [p.bullets] : []))
        .map((b) => String(b || '').slice(0, 1200))
        .filter(Boolean)
        .slice(0, 30),
    }));
  }

  if (Array.isArray(normalized.education)) {
    normalized.education = normalized.education.slice(0, 10).map((ed, idx) => ({
      id: ed?.id || `edu_${idx}`,
      school: String(ed?.school || '').slice(0, 200),
      degree: String(ed?.degree || '').slice(0, 200),
      location: String(ed?.location || '').slice(0, 160),
      start: String(ed?.start || '').slice(0, 40),
      end: String(ed?.end || '').slice(0, 40),
      details: (Array.isArray(ed?.details) ? ed.details : (ed?.details ? [ed.details] : []))
        .map((d) => String(d || '').slice(0, 1200))
        .filter(Boolean)
        .slice(0, 30),
    }));
  }

  if (Array.isArray(normalized.certifications)) {
    normalized.certifications = normalized.certifications.slice(0, 20).map((c, idx) => ({
      id: c?.id || `cert_${idx}`,
      name: String(c?.name || '').slice(0, 200),
      issuer: String(c?.issuer || '').slice(0, 200),
      date: String(c?.date || '').slice(0, 60),
    }));
  }

  if (Array.isArray(normalized.additional)) {
    normalized.additional = normalized.additional.slice(0, 8).map((a, idx) => ({
      id: a?.id || `add_${idx}`,
      title: String(a?.title || '').slice(0, 120),
      bullets: (Array.isArray(a?.bullets) ? a.bullets : (a?.bullets ? [a.bullets] : []))
        .map((b) => String(b || '').slice(0, 1200))
        .filter(Boolean)
        .slice(0, 30),
    }));
  }

  // Allow partial objects: validate each provided key against the full schema's shape.
  const shape = resumeDataSchema.shape;
  const result = {};
  for (const key of Object.keys(shape)) {
    if (!(key in normalized)) continue;
    const parsed = shape[key].safeParse(normalized[key]);
    if (parsed.success) {
      result[key] = parsed.data;
    } else {
      console.warn(`resumeUpdate field "${key}" failed validation:`, parsed.error.issues);
    }
  }
  return Object.keys(result).length ? result : null;
}
