import { randomBytes } from 'node:crypto';
import { isAiConfigured } from '../../config/index.js';
import { completeJson } from '../ai/providers/index.js';
import { buildStructureSystemPrompt, neutralize } from '../ai/prompts.js';
import { extractJson } from '../ai/chatService.js';
import { resumeDataSchema } from './schema.js';

const uid = () => randomBytes(4).toString('hex');
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE = `(?:${MONTH}\\s+\\d{4}|\\d{1,2}\\/\\d{4}|\\d{4})`;
const RANGE_RE = new RegExp(`(${DATE})\\s*(?:-|\\u2013|\\u2014|to)\\s*(${DATE}|present|current|now|ongoing)`, 'i');
const SINGLE_DATE_RE = new RegExp(`\\b(${DATE})\\b`, 'i');
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)[^\s|,;]*|https?:\/\/[^\s|,;]+)/gi;
const BULLET_RE = /^\s*[\u2022\u25AA\u25CF\u00B7*\-\u2013\u2014\u25E6\u2023]\s+/;

const cleanBullet = (t) => t.replace(BULLET_RE, '').trim();
const isBullet = (p) => p.isListItem || BULLET_RE.test(p.text);

function splitDates(line) {
  const text = line.replace(/\t/g, '  ');
  const r = RANGE_RE.exec(text);
  if (r) {
    return { rest: (text.slice(0, r.index) + ' ' + text.slice(r.index + r[0].length)).trim(), start: r[1], end: r[2] };
  }
  const s = SINGLE_DATE_RE.exec(text);
  if (s && /\d{4}/.test(s[1])) {
    return { rest: (text.slice(0, s.index) + ' ' + text.slice(s.index + s[0].length)).trim(), start: '', end: s[1] };
  }
  return { rest: text.trim(), start: '', end: '' };
}

const tidy = (s) => s.replace(/\s{2,}/g, ' ').replace(/^[\s,|\u2013\u2014-]+|[\s,|\u2013\u2014(-]+$/g, '').replace(/\s*\(\s*\)/g, '').trim();

function parseContact(lines) {
  const contact = { name: '', headline: '', email: '', phone: '', location: '', links: [] };
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (!nonEmpty.length) return contact;
  const firstParts = nonEmpty[0].split(/\t+/);
  contact.name = firstParts[0].trim();
  const leftovers = [];
  const restLines = [firstParts.slice(1).join(' ').trim(), ...nonEmpty.slice(1)].filter(Boolean);
  for (const line of restLines) {
    let rest = line;
    const email = EMAIL_RE.exec(rest);
    if (email) {
      contact.email ||= email[0];
      rest = rest.replace(email[0], '|');
    }
    for (const m of rest.matchAll(URL_RE)) {
      const url = m[0];
      const label = /linkedin/i.test(url) ? 'LinkedIn' : /github/i.test(url) ? 'GitHub' : url.replace(/^https?:\/\/(www\.)?/, '');
      if (!contact.links.some((l) => l.url === url)) contact.links.push({ label, url: /^https?:/i.test(url) ? url : `https://${url}` });
    }
    rest = rest.replace(URL_RE, '|');
    const phone = PHONE_RE.exec(rest);
    if (phone) {
      contact.phone ||= phone[0].trim();
      rest = rest.replace(phone[0], '|');
    }
    for (const piece of rest.split(/[|\u2022\u00B7\t]+/).map((s) => s.trim()).filter(Boolean)) leftovers.push(piece);
  }
  // First leftover with a comma (City, State) is the location; otherwise first short leftover headline.
  const loc = leftovers.find((l) => /,/.test(l) && l.length < 60);
  if (loc) contact.location = loc;
  const headline = leftovers.find((l) => l !== loc && l.length < 100);
  if (headline) contact.headline = headline;
  return contact;
}

function parseEntries(paragraphs, kind) {
  const entries = [];
  let cur = null;
  for (const p of paragraphs) {
    const text = p.text.trim();
    if (!text) continue;
    const bullet = isBullet(p) || (cur && cur.headerLines.length && text.length > 110);
    if (bullet) {
      if (!cur) {
        cur = { headerLines: [], bullets: [] };
        entries.push(cur);
      }
      cur.bullets.push(cleanBullet(text));
    } else if (!cur || cur.bullets.length) {
      cur = { headerLines: [text], bullets: [] };
      entries.push(cur);
    } else {
      cur.headerLines.push(text);
    }
  }

  return entries.map((e) => {
    const first = splitDates(e.headerLines[0] || '');
    const second = e.headerLines[1] ? splitDates(e.headerLines[1]) : null;
    const start = first.start || second?.start || '';
    const end = first.end || second?.end || '';
    const l1 = tidy(first.rest);
    const l2 = second ? tidy(second.rest) : '';
    if (kind === 'education') {
      return { id: uid(), school: l1, degree: l2, location: '', start, end, details: e.bullets };
    }
    if (kind === 'projects') {
      return { id: uid(), name: l1, link: '', tech: '', description: e.headerLines.slice(1).join(' '), bullets: e.bullets };
    }
    let title = l1;
    let company = l2;
    if (!l2) {
      const bits = l1.split(/\s+(?:\||\u2013|\u2014|-|at|@)\s+|,\s+/i);
      if (bits.length >= 2) [title, company] = [tidy(bits[0]), tidy(bits.slice(1).join(', '))];
    }
    return { id: uid(), title, company, location: '', start, end, bullets: e.bullets };
  });
}

/** Rule-based structuring: no AI, never invents content. The user reviews the result before use. */
export function structureHeuristically(paragraphs) {
  const body = paragraphs.filter((p) => p.part === 'body' && !p.isHeading);
  const data = resumeDataSchema.parse({});
  const bySection = new Map();
  for (const p of body) {
    if (!bySection.has(p.section)) bySection.set(p.section, []);
    if (p.text.trim()) bySection.get(p.section).push(p);
  }

  data.contact = resumeDataSchema.shape.contact.parse(parseContact((bySection.get('header') || []).map((p) => p.text)));
  data.summary = (bySection.get('summary') || []).map((p) => p.text.trim()).join(' ');
  data.experience = parseEntries(bySection.get('experience') || [], 'experience');
  data.education = parseEntries(bySection.get('education') || [], 'education');
  data.projects = parseEntries(bySection.get('projects') || [], 'projects');

  data.skills = (bySection.get('skills') || []).map((p) => {
    const t = cleanBullet(p.text);
    const m = /^([^:]{2,40}):\s*(.+)$/.exec(t);
    return m ? { id: uid(), label: m[1].trim(), items: m[2].trim() } : { id: uid(), label: '', items: t };
  });

  data.certifications = (bySection.get('certifications') || []).map((p) => {
    const t = cleanBullet(p.text);
    const d = splitDates(t);
    return { id: uid(), name: tidy(d.rest), issuer: '', date: d.end || d.start };
  });

  // Remaining headed sections ("other") become additional sections grouped by their heading.
  const extra = new Map();
  let label = '';
  for (const p of paragraphs.filter((x) => x.part === 'body')) {
    if (p.isHeading) {
      label = p.section === 'other' ? p.text.trim() : '';
    } else if (p.section === 'other' && p.text.trim() && label) {
      if (!extra.has(label)) extra.set(label, []);
      extra.get(label).push(cleanBullet(p.text));
    }
  }
  data.additional = [...extra.entries()].slice(0, 8).map(([title, bullets]) => ({ id: uid(), title, bullets }));
  return data;
}

function wordsOf(text) {
  return (String(text).toLowerCase().match(/[\p{L}\p{N}+#]+/gu) || []).filter(Boolean);
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

/** True when (almost) every word in the AI output also appears in the source text. */
function isFaithful(data, sourceText) {
  const source = new Set(wordsOf(sourceText));
  const words = collectStrings(data).flatMap(wordsOf);
  if (!words.length) return false;
  const missing = words.filter((w) => !source.has(w)).length;
  return missing / words.length <= 0.03;
}

async function structureWithAi(paragraphs) {
  const source = paragraphs
    .filter((p) => p.part === 'body' && p.text.trim())
    .map((p) => `${p.isHeading ? '## ' : p.isListItem ? '- ' : ''}${neutralize(p.text)}`)
    .join('\n');
  const res = await completeJson({
    system: buildStructureSystemPrompt(),
    messages: [{ role: 'user', content: `<resume_fields>\n${source.slice(0, 40000)}\n</resume_fields>` }],
  });
  const raw = res?.text || res;
  const parsed = resumeDataSchema.safeParse(extractJson(raw));
  if (!parsed.success) return null;
  const withIds = {
    ...parsed.data,
    experience: parsed.data.experience.map((e) => ({ ...e, id: e.id || uid() })),
    education: parsed.data.education.map((e) => ({ ...e, id: e.id || uid() })),
    projects: parsed.data.projects.map((e) => ({ ...e, id: e.id || uid() })),
    skills: parsed.data.skills.map((e) => ({ ...e, id: e.id || uid() })),
    certifications: parsed.data.certifications.map((e) => ({ ...e, id: e.id || uid() })),
    additional: parsed.data.additional.map((e) => ({ ...e, id: e.id || uid() })),
  };
  return isFaithful(withIds, source) ? withIds : null;
}

/** Structures imported paragraphs into resume data. Tries AI (when allowed and configured), falls back to rules. */
export async function structureResume(paragraphs, { useAi }) {
  if (useAi && isAiConfigured()) {
    try {
      const ai = await structureWithAi(paragraphs);
      if (ai) return { data: ai, method: 'ai' };
    } catch {
      // fall through to the rule-based parser
    }
  }
  return { data: structureHeuristically(paragraphs), method: 'rules' };
}
