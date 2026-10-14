import { uid } from '../../utils/ids.js';
import { normalizeForCompare } from '../../utils/textDiff.js';

export const TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional single-column layout. Centered header, ruled section headings, serif type.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Left-aligned header with an accent colour, small-caps headings, clean sans-serif type.',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Space-efficient. Name and headline on one line, shaded headings, one-line entries.',
  },
];

export const MODES = [
  {
    id: 'preserve',
    name: 'Preserve original design',
    short: 'Preserve design',
    description: 'Default. Edits only the text you approve, keeping fonts, layout, spacing and styles exactly as uploaded.',
  },
  {
    id: 'content',
    name: 'Improve content only',
    short: 'Content only',
    description: 'Wording changes only. No new paragraphs are added, so the document structure stays as it is.',
  },
  {
    id: 'redesign',
    name: 'Redesign resume',
    short: 'Redesign',
    description: 'Moves your content into one of the built-in templates as a new copy. Your original is kept.',
  },
];

export function emptyResumeData() {
  return {
    contact: { name: '', headline: '', email: '', phone: '', location: '', links: [] },
    summary: '',
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    additional: [],
  };
}

export const newEntry = {
  experience: () => ({ id: uid(), title: '', company: '', location: '', start: '', end: '', bullets: [''] }),
  education: () => ({ id: uid(), school: '', degree: '', location: '', start: '', end: '', details: [] }),
  projects: () => ({ id: uid(), name: '', link: '', tech: '', description: '', bullets: [] }),
  skills: () => ({ id: uid(), label: '', items: '' }),
  certifications: () => ({ id: uid(), name: '', issuer: '', date: '' }),
  additional: () => ({ id: uid(), title: '', bullets: [''] }),
};

const dateRange = (a, b) => [a, b].filter(Boolean).join(' - ');

/**
 * Flattens structured resume data into addressable text fields (same shape as the paragraph list
 * of imported documents) so the chatbot can work on both kinds of resume identically.
 */
export function flattenResumeFields(data) {
  const out = [];
  const add = (id, section, text, extra = {}) =>
    out.push({ id, section, text: text || '', isHeading: false, isListItem: false, editable: true, ...extra });

  if (data.summary) add('summary', 'summary', data.summary);

  data.experience.forEach((e, i) => {
    add(`experience.${i}.header`, 'experience', `${[e.title, e.company].filter(Boolean).join(' at ')} ${dateRange(e.start, e.end)}`.trim(), {
      isHeading: true,
      editable: false,
    });
    e.bullets.forEach((b, j) => add(`experience.${i}.bullets.${j}`, 'experience', b, { isListItem: true }));
  });

  data.projects.forEach((p, i) => {
    add(`projects.${i}.header`, 'projects', `${p.name}${p.tech ? ` (${p.tech})` : ''}`, { isHeading: true, editable: false });
    if (p.description) add(`projects.${i}.description`, 'projects', p.description);
    p.bullets.forEach((b, j) => add(`projects.${i}.bullets.${j}`, 'projects', b, { isListItem: true }));
  });

  data.education.forEach((e, i) => {
    add(`education.${i}.header`, 'education', `${[e.degree, e.school].filter(Boolean).join(', ')} ${dateRange(e.start, e.end)}`.trim(), {
      isHeading: true,
      editable: false,
    });
    e.details.forEach((b, j) => add(`education.${i}.details.${j}`, 'education', b, { isListItem: true }));
  });

  data.skills.forEach((s, i) => {
    if (s.label) add(`skills.${i}.header`, 'skills', s.label, { isHeading: true, editable: false });
    add(`skills.${i}.items`, 'skills', s.items);
  });

  return out.filter((f) => f.text.trim());
}

function parsePath(id) {
  const parts = id.split('.');
  return parts.map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

/**
 * Applies approved edits to structured resume data.
 * Returns { data, results } where results mirror the server's per-edit statuses.
 */
export function applyFieldEdits(data, edits) {
  const next = structuredClone(data);
  const results = [];

  for (const edit of edits) {
    const path = parsePath(edit.targetId);
    const same = (a) => normalizeForCompare(a) === normalizeForCompare(edit.original);
    let status = 'conflict';
    let message = 'This text has changed since the suggestion was made, so it was not applied.';

    if (path[0] === 'summary' && path.length === 1) {
      if (same(next.summary)) {
        next.summary = edit.text;
        status = 'applied';
      }
    } else if (path.length === 3 && typeof path[1] === 'number' && path[2] !== 'header') {
      const [section, index, key] = path;
      const entry = next[section]?.[index];
      if (entry && typeof entry[key] === 'string') {
        if (same(entry[key])) {
          entry[key] = edit.text;
          status = 'applied';
        }
      }
    } else if (path.length === 4 && typeof path[1] === 'number' && typeof path[3] === 'number') {
      const [section, index, key, at] = path;
      const list = next[section]?.[index]?.[key];
      if (Array.isArray(list)) {
        let pos = same(list[at]) ? at : list.findIndex(same);
        if (pos >= 0) {
          if (edit.kind === 'insert_after') list.splice(pos + 1, 0, edit.text);
          else list[pos] = edit.text;
          status = 'applied';
        }
        pos = -1;
      }
    }
    if (status === 'applied') message = '';
    results.push({ id: edit.id, status, message });
  }
  return { data: next, results };
}

const withIds = (list) => (Array.isArray(list) ? list.map((e) => ({ ...e, id: e.id || uid() })) : list);

/** Merges facts returned by the chatbot (resumeUpdate) into the current data. */
export function mergeResumeUpdate(data, update) {
  const next = structuredClone(data);
  const changed = [];
  for (const [key, value] of Object.entries(update)) {
    if (key === 'contact') {
      for (const [k, v] of Object.entries(value)) {
        if (k === 'links') {
          if (Array.isArray(v) && v.length) next.contact.links = v;
        } else if (typeof v === 'string' && v.trim()) next.contact[k] = v.trim();
      }
      changed.push('contact details');
    } else if (key === 'summary') {
      if (typeof value === 'string' && value.trim()) {
        next.summary = value.trim();
        changed.push('summary');
      }
    } else if (Array.isArray(value) && key in next) {
      next[key] = withIds(value);
      changed.push(key);
    }
  }
  return { data: next, changed };
}

/** Fictional demo content, clearly labelled wherever it is shown. */
export function sampleResumeData() {
  return {
    contact: {
      name: 'Sample Candidate',
      headline: 'Aspiring QA Tester',
      email: 'sample.candidate@example.com',
      phone: '+1 555 010 0199',
      location: 'Austin, TX',
      links: [{ label: 'GitHub', url: 'https://github.com/example' }],
    },
    summary: 'Recent computer science graduate who is responsible for testing web applications during university projects and an internship. Looking to utilize attention to detail in a QA role.',
    experience: [
      {
        id: uid(),
        title: 'QA Intern',
        company: 'Northwind Apps',
        location: 'Remote',
        start: 'Jun 2024',
        end: 'Aug 2024',
        bullets: [
          'Executed manual test cases for a web storefront and logged defects in Jira.',
          'Was responsible for retesting fixed bugs before each weekly release.',
          'Helped to write test cases in order to cover the checkout flow.',
        ],
      },
    ],
    projects: [
      {
        id: uid(),
        name: 'Web Test Automation Project',
        link: '',
        tech: 'Playwright, JavaScript',
        description: 'Built a small suite of automated browser tests for a class project.',
        bullets: ['Wrote automated tests for login and search features using Playwright.'],
      },
    ],
    education: [
      {
        id: uid(),
        school: 'State University',
        degree: 'B.S. Computer Science',
        location: '',
        start: '2020',
        end: '2024',
        details: ['Coursework: Software Engineering, Databases, Web Development.'],
      },
    ],
    skills: [
      { id: uid(), label: 'Testing', items: 'Manual testing, test case writing, bug reporting' },
      { id: uid(), label: 'Tools', items: 'Jira, Playwright, Git' },
    ],
    certifications: [],
    additional: [],
  };
}
