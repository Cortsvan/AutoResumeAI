import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';

const PAPER = {
  letter: { width: 12240, height: 15840 },
  a4: { width: 11906, height: 16838 },
};

const range = (a, b) => [a, b].filter(Boolean).join(' \u2013 ');
const join = (parts, sep) => parts.filter((p) => p && String(p).trim()).join(sep);
const has = (s) => Boolean(s && String(s).trim());
const isHttp = (u) => /^https?:\/\//i.test(u || '');

/** A run containing a tab followed by text. Tabs must live inside a run to be valid WordprocessingML. */
const tabRun = (text, opts = {}) => new TextRun({ ...opts, children: [new Tab(), text] });

function linkRuns(links, size, color) {
  const out = [];
  links.filter((l) => has(l.url) || has(l.label)).forEach((l, i) => {
    if (i > 0) out.push(new TextRun({ text: '  \u00b7  ', size, color }));
    const label = l.label || l.url;
    if (isHttp(l.url)) {
      out.push(
        new ExternalHyperlink({
          link: l.url,
          children: [new TextRun({ text: label, size, color: '1F4E9E', underline: {} })],
        }),
      );
    } else {
      out.push(new TextRun({ text: label, size, color }));
    }
  });
  return out;
}

function contactParts(c) {
  return [c.email, c.phone, c.location].filter(has);
}

/** Theme definitions. Templates differ in structure (see builders below), not only in colour. */
const THEMES = {
  classic: {
    font: 'Times New Roman',
    size: 22,
    margins: { top: 1080, right: 1260, bottom: 1080, left: 1260 },
    ink: '000000',
    muted: '404040',
    accent: '000000',
  },
  modern: {
    font: 'Calibri',
    size: 21,
    margins: { top: 1000, right: 1150, bottom: 1000, left: 1150 },
    ink: '1F2328',
    muted: '5B616B',
    accent: '34407F',
  },
  compact: {
    font: 'Arial',
    size: 19,
    margins: { top: 720, right: 800, bottom: 720, left: 800 },
    ink: '111111',
    muted: '4A4A4A',
    accent: '2B3569',
  },
};

function buildStyles(t, templateId) {
  const headingRun =
    templateId === 'classic'
      ? { bold: true, size: 22, allCaps: true, color: t.ink, font: t.font }
      : templateId === 'modern'
        ? { bold: true, size: 20, allCaps: true, characterSpacing: 30, color: t.accent, font: t.font }
        : { bold: true, size: 19, allCaps: true, color: t.accent, font: t.font };
  const headingPara =
    templateId === 'classic'
      ? { spacing: { before: 200, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, keepNext: true }
      : templateId === 'modern'
        ? { spacing: { before: 280, after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C9CDE0', space: 3 } }, keepNext: true }
        : { spacing: { before: 120, after: 50 }, shading: { type: ShadingType.CLEAR, fill: 'E9EBF4', color: 'auto' }, keepNext: true };

  const nameRun =
    templateId === 'classic'
      ? { bold: true, size: 40, smallCaps: true, color: t.ink, font: t.font }
      : templateId === 'modern'
        ? { bold: true, size: 52, color: t.accent, font: t.font }
        : { bold: true, size: 32, color: t.ink, font: t.font };

  return {
    default: { document: { run: { font: t.font, size: t.size, color: t.ink } } },
    paragraphStyles: [
      {
        id: 'Title',
        name: 'Title',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: nameRun,
        paragraph: { spacing: { before: 0, after: 40 } },
      },
      {
        id: 'Heading1',
        name: 'heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: headingRun,
        paragraph: headingPara,
      },
      {
        id: 'EntryHeader',
        name: 'Entry Header',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        paragraph: { keepNext: true, keepLines: true },
      },
    ],
  };
}

function numbering(t, templateId) {
  const left = templateId === 'compact' ? 300 : 360;
  return {
    config: [
      {
        reference: 'resume-bullets',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: templateId === 'classic' ? '\u2022' : templateId === 'modern' ? '\u2013' : '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left, hanging: 220 } } },
          },
        ],
      },
    ],
  };
}

function bulletParas(items, t, templateId) {
  const spacing = templateId === 'compact' ? { before: 0, after: 20 } : templateId === 'modern' ? { before: 0, after: 50 } : { before: 0, after: 30 };
  return items.filter(has).map(
    (text) =>
      new Paragraph({
        numbering: { reference: 'resume-bullets', level: 0 },
        spacing,
        children: [new TextRun({ text })],
      }),
  );
}

function sectionHeading(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text })] });
}

function usableWidth(paper, t) {
  return PAPER[paper].width - t.margins.left - t.margins.right;
}

/* ---------------------------- header blocks ---------------------------- */

function headerClassic(data, t, width) {
  const c = data.contact;
  const out = [
    new Paragraph({ style: 'Title', alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.name || 'Your Name' })] }),
  ];
  if (has(c.headline)) {
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: c.headline, italics: true, color: t.muted })] }));
  }
  const parts = contactParts(c);
  const runs = [new TextRun({ text: parts.join('  |  '), color: t.muted })];
  const links = linkRuns(c.links, t.size, t.muted);
  if (links.length) {
    if (parts.length) runs.push(new TextRun({ text: '  |  ', color: t.muted }));
    runs.push(...links);
  }
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: runs }));
  void width;
  return out;
}

function headerModern(data, t) {
  const c = data.contact;
  const out = [new Paragraph({ style: 'Title', children: [new TextRun({ text: c.name || 'Your Name' })] })];
  if (has(c.headline)) {
    out.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: c.headline, size: 24, color: t.muted })] }));
  }
  const runs = [new TextRun({ text: contactParts(c).join('   \u00b7   '), size: 19, color: t.muted })];
  const links = linkRuns(c.links, 19, t.muted);
  if (links.length) {
    if (contactParts(c).length) runs.push(new TextRun({ text: '   \u00b7   ', size: 19, color: t.muted }));
    runs.push(...links);
  }
  out.push(new Paragraph({ spacing: { after: 40 }, children: runs }));
  return out;
}

function headerCompact(data, t, width) {
  const c = data.contact;
  const out = [
    new Paragraph({
      style: 'Title',
      tabStops: [{ type: TabStopType.RIGHT, position: width }],
      children: [
        new TextRun({ text: c.name || 'Your Name' }),
        ...(has(c.headline) ? [tabRun(c.headline, { size: 20, color: t.muted })] : []),
      ],
    }),
  ];
  const runs = [new TextRun({ text: contactParts(c).join('  |  '), color: t.muted })];
  const links = linkRuns(c.links, t.size, t.muted);
  if (links.length) {
    if (contactParts(c).length) runs.push(new TextRun({ text: '  |  ', color: t.muted }));
    runs.push(...links);
  }
  out.push(new Paragraph({ spacing: { after: 20 }, children: runs }));
  return out;
}

/* ------------------------------ entries ------------------------------- */

function entryClassic(line1Left, dates, line2, items, t, width, templateId) {
  const out = [
    new Paragraph({
      style: 'EntryHeader',
      spacing: { before: 100, after: 0 },
      tabStops: [{ type: TabStopType.RIGHT, position: width }],
      children: [new TextRun({ text: line1Left, bold: true }), ...(has(dates) ? [tabRun(dates)] : [])],
    }),
  ];
  if (has(line2)) {
    out.push(new Paragraph({ style: 'EntryHeader', spacing: { after: 30 }, children: [new TextRun({ text: line2, italics: true })] }));
  }
  return out.concat(bulletParas(items, t, templateId));
}

function entryModern(line1Left, dates, line2, items, t, width, templateId) {
  const out = [
    new Paragraph({
      style: 'EntryHeader',
      spacing: { before: 140, after: 0 },
      tabStops: [{ type: TabStopType.RIGHT, position: width }],
      children: [
        new TextRun({ text: line1Left, bold: true, size: 22 }),
        ...(has(dates) ? [tabRun(dates, { size: 19, color: t.muted })] : []),
      ],
    }),
  ];
  if (has(line2)) {
    out.push(new Paragraph({ style: 'EntryHeader', spacing: { after: 50 }, children: [new TextRun({ text: line2, color: t.accent })] }));
  }
  return out.concat(bulletParas(items, t, templateId));
}

function entryCompact(line1Left, dates, line2, items, t, width, templateId) {
  const left = has(line2) ? `${line1Left}  \u2013  ${line2}` : line1Left;
  const first = has(line2) ? line1Left : left;
  const out = [
    new Paragraph({
      style: 'EntryHeader',
      spacing: { before: 50, after: 10 },
      tabStops: [{ type: TabStopType.RIGHT, position: width }],
      children: [
        new TextRun({ text: first, bold: true }),
        ...(has(line2) ? [new TextRun({ text: `  \u2013  ${line2}`, color: t.muted })] : []),
        ...(has(dates) ? [tabRun(dates, { color: t.muted })] : []),
      ],
    }),
  ];
  return out.concat(bulletParas(items, t, templateId));
}

const ENTRY_BUILDERS = { classic: entryClassic, modern: entryModern, compact: entryCompact };
const HEADER_BUILDERS = { classic: headerClassic, modern: headerModern, compact: headerCompact };

function body(data, templateId, t, width) {
  const entry = ENTRY_BUILDERS[templateId];
  const out = [...HEADER_BUILDERS[templateId](data, t, width)];

  if (has(data.summary)) {
    out.push(sectionHeading(templateId === 'classic' ? 'Professional Summary' : 'Summary'));
    out.push(new Paragraph({ spacing: { after: 40, line: templateId === 'compact' ? 252 : 264 }, children: [new TextRun({ text: data.summary })] }));
  }

  const exp = data.experience.filter((e) => has(e.title) || has(e.company) || e.bullets.some(has));
  if (exp.length) {
    out.push(sectionHeading('Experience'));
    for (const e of exp) {
      const line2 = templateId === 'compact' ? join([e.company, e.location], ', ') : join([e.company, e.location], ', ');
      out.push(...entry(e.title || e.company, range(e.start, e.end), e.title ? line2 : e.location, e.bullets, t, width, templateId));
    }
  }

  const proj = data.projects.filter((p) => has(p.name) || has(p.description) || p.bullets.some(has));
  if (proj.length) {
    out.push(sectionHeading('Projects'));
    for (const p of proj) {
      const sub = join([p.tech ? `Tech: ${p.tech}` : '', p.link], ' | ');
      out.push(...entry(p.name || 'Project', '', sub, [], t, width, templateId));
      if (has(p.description)) {
        out.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: p.description })] }));
      }
      out.push(...bulletParas(p.bullets, t, templateId));
    }
  }

  const edu = data.education.filter((e) => has(e.school) || has(e.degree));
  if (edu.length) {
    out.push(sectionHeading('Education'));
    for (const e of edu) {
      out.push(...entry(e.school || e.degree, range(e.start, e.end), e.school ? join([e.degree, e.location], ', ') : e.location, e.details, t, width, templateId));
    }
  }

  const skills = data.skills.filter((s) => has(s.items) || has(s.label));
  if (skills.length) {
    out.push(sectionHeading('Skills'));
    for (const s of skills) {
      out.push(
        new Paragraph({
          spacing: { after: templateId === 'compact' ? 10 : 40 },
          children: [
            ...(has(s.label) ? [new TextRun({ text: `${s.label}: `, bold: true, color: templateId === 'modern' ? t.accent : t.ink })] : []),
            new TextRun({ text: s.items }),
          ],
        }),
      );
    }
  }

  const certs = data.certifications.filter((c) => has(c.name));
  if (certs.length) {
    out.push(sectionHeading('Certifications'));
    for (const c of certs) {
      out.push(
        new Paragraph({
          spacing: { after: 30 },
          tabStops: [{ type: TabStopType.RIGHT, position: width }],
          children: [
            new TextRun({ text: c.name, bold: templateId !== 'compact' }),
            ...(has(c.issuer) ? [new TextRun({ text: `, ${c.issuer}`, color: t.muted })] : []),
            ...(has(c.date) ? [tabRun(c.date, { color: t.muted })] : []),
          ],
        }),
      );
    }
  }

  for (const a of data.additional.filter((x) => has(x.title) && x.bullets.some(has))) {
    out.push(sectionHeading(a.title));
    out.push(...bulletParas(a.bullets, t, templateId));
  }

  return out;
}

/**
 * Generates a genuine .docx file from structured resume data using one of the built-in templates.
 */
export async function generateResumeDocx(data, { template = 'classic', paper = 'letter' } = {}) {
  const templateId = THEMES[template] ? template : 'classic';
  const paperId = PAPER[paper] ? paper : 'letter';
  const t = THEMES[templateId];
  const width = usableWidth(paperId, t);

  const doc = new Document({
    creator: data.contact.name || 'AutoResumeAI',
    title: `${data.contact.name || 'Resume'} - Resume`,
    description: 'Resume generated with AutoResumeAI',
    styles: buildStyles(t, templateId),
    numbering: numbering(t, templateId),
    sections: [
      {
        properties: {
          page: {
            size: { width: PAPER[paperId].width, height: PAPER[paperId].height },
            margin: { ...t.margins, header: 400, footer: 400 },
          },
        },
        children: body(data, templateId, t, width),
      },
    ],
  });
  return Packer.toBuffer(doc);
}
