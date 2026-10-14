import { NS, childElements, getPart, isW, textPartNames } from './package.js';
import { enumerateParagraphs, paragraphProps, paragraphSegments, segmentText } from './paragraphs.js';

const SECTION_PATTERNS = [
  ['summary', /^(professional |career |executive )?(summary|profile|objective|about( me)?|personal statement|summary of qualifications)$/],
  [
    'experience',
    /^((professional|work|relevant|employment|internship|industry) )?(experience|history)$|^employment$|^internships?$|^work experience & internships$/,
  ],
  ['education', /^(education( and training| & training)?|academic (background|qualifications)|academics)$/],
  ['projects', /^((personal|academic|selected|relevant|key|technical) )?projects?( & .+)?$/],
  [
    'skills',
    /^((technical|key|core|professional|relevant|soft|hard) )?(skills?|competenc(y|ies)|technologies|tools|areas of expertise|skills (& |and )?(tools|technologies|abilities|strengths))$/,
  ],
  ['certifications', /^(certifications?|licenses?( & certifications?)?|certificates?|courses|training|awards?|honou?rs( & awards?)?|achievements|accomplishments)$/],
  ['other', /^(languages?|interests|hobbies|volunteer(ing)?( experience)?|references|publications|activities|extracurricular( activities)?|leadership|affiliations|additional information)$/],
];

function normalizeHeading(text) {
  return text
    .toLowerCase()
    .replace(/[:\u2013\u2014\-_|]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchSectionHeading(text) {
  const t = normalizeHeading(text);
  if (!t || t.length > 48) return null;
  for (const [key, re] of SECTION_PATTERNS) if (re.test(t)) return key;
  return null;
}

async function loadStyleNames(docx) {
  const dom = await getPart(docx, 'word/styles.xml');
  const map = new Map();
  if (!dom) return map;
  for (const style of dom.getElementsByTagNameNS(NS.w, 'style')) {
    const id = style.getAttributeNS(NS.w, 'styleId');
    const nameEl = childElements(style).find((c) => isW(c, 'name'));
    const name = nameEl && nameEl.getAttributeNS(NS.w, 'val');
    if (id) map.set(id, name || id);
  }
  return map;
}

export const partKeyOf = (partName) => {
  if (partName === 'word/document.xml') return 'body';
  return partName.replace(/^word\//, '').replace(/\.xml$/, '');
};

export const partNameOf = (key) => (key === 'body' ? 'word/document.xml' : `word/${key}.xml`);

export const PARAGRAPH_ID_RE = /^(body|header\d*|footer\d*)#(\d+)$/;

/** Returns lightweight structured information about every paragraph of the document. */
export async function listParagraphs(docx) {
  const styleNames = await loadStyleNames(docx);
  const paragraphs = [];

  for (const partName of textPartNames(docx)) {
    const dom = await getPart(docx, partName);
    if (!dom) continue;
    const key = partKeyOf(partName);
    const isBody = key === 'body';
    const entries = enumerateParagraphs(dom.documentElement);
    let section = isBody ? 'header' : key.startsWith('header') ? 'page-header' : 'page-footer';
    let sectionLabel = '';

    entries.forEach((entry, index) => {
      const segs = paragraphSegments(entry.el);
      const text = segs.map(segmentText).join('');
      const props = paragraphProps(entry.el);
      const styleName = props.styleId ? styleNames.get(props.styleId) || props.styleId : '';
      const trimmed = text.trim();

      let isHeading = false;
      if (isBody && trimmed) {
        const matched = matchSectionHeading(trimmed);
        const headingStyle = /^(heading \d|title)/i.test(styleName);
        if (matched) {
          isHeading = true;
          section = matched;
          sectionLabel = trimmed;
        } else if (headingStyle && index > 0 && trimmed.length <= 60 && !props.isListItem) {
          isHeading = true;
          section = 'other';
          sectionLabel = trimmed;
        }
      }

      const hasTextNode = segs.some((s) => s.kind === 't');
      let editable = hasTextNode && trimmed.length > 0;
      let note = '';
      if (editable && props.hasField) {
        editable = false;
        note = 'Contains a Word field (e.g. page number or reference), left untouched.';
      } else if (editable && isHeading) {
        note = 'Section heading';
      }

      paragraphs.push({
        id: `${key}#${index}`,
        part: key,
        index,
        text,
        section,
        sectionLabel: isHeading ? trimmed : sectionLabel,
        isHeading,
        style: styleName,
        isListItem: props.isListItem,
        hasHyperlink: props.hasHyperlink,
        inTable: entry.inTable,
        inTextbox: entry.inTextbox,
        editable,
        note,
      });
    });
  }
  return paragraphs;
}

/** Inspects document-level features that influence how faithfully we can edit/preview. */
export async function detectFeatures(docx) {
  const features = {};
  const docDom = await getPart(docx, 'word/document.xml');
  const xml = (await docx.zip.file('word/document.xml').async('string')) || '';
  const count = (re) => (xml.match(re) || []).length;

  features.tables = count(/<w:tbl[ >]/g);
  features.textBoxes = count(/<w:txbxContent[ >]/g);
  features.images = count(/<w:drawing[ >]|<w:pict[ >]/g);
  features.trackedChanges = count(/<w:ins [^>]*>|<w:del [^>]*>/g);
  features.contentControls = count(/<w:sdt[ >]/g);
  features.fields = count(/<w:fldChar |<w:fldSimple /g);
  features.sectionBreaks = Math.max(0, count(/<w:sectPr[ >]/g) - 1);
  features.pageBreaks = count(/<w:br [^>]*w:type="page"/g);
  features.columns = 1;
  for (const m of xml.matchAll(/<w:cols [^>]*w:num="(\d+)"/g)) features.columns = Math.max(features.columns, Number(m[1]));
  features.comments = Boolean(docx.zip.file('word/comments.xml'));
  features.headers = docx.names.filter((n) => /^word\/header\d*\.xml$/i.test(n)).length;
  features.footers = docx.names.filter((n) => /^word\/footer\d*\.xml$/i.test(n)).length;

  const pg = xml.match(/<w:pgSz [^>]*>/);
  if (pg) {
    const w = Number((pg[0].match(/w:w="(\d+)"/) || [])[1]);
    const h = Number((pg[0].match(/w:h="(\d+)"/) || [])[1]);
    if (w && h) {
      const [short, long] = [Math.min(w, h), Math.max(w, h)];
      const near = (a, b) => Math.abs(a - b) < 60;
      features.pageSize = near(short, 12240) && near(long, 15840) ? 'Letter' : near(short, 11906) && near(long, 16838) ? 'A4' : `${(w / 1440).toFixed(2)} x ${(h / 1440).toFixed(2)} in`;
    }
  }

  const fonts = new Map();
  const collectFonts = (src) => {
    for (const m of src.matchAll(/<w:rFonts [^>]*w:ascii="([^"]+)"/g)) fonts.set(m[1], (fonts.get(m[1]) || 0) + 1);
  };
  collectFonts(xml);
  const styles = docx.zip.file('word/styles.xml');
  if (styles) collectFonts(await styles.async('string'));
  features.fonts = [...fonts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => f);

  void docDom;
  return features;
}

/** Human-readable fidelity notes shown to the user. */
export function describeFeatures(features) {
  const notes = [];
  if (features.columns > 1) notes.push('Multi-column layout detected. Edits keep the columns, but text order can differ between the preview and Word.');
  if (features.tables > 0) notes.push(`${features.tables} table${features.tables > 1 ? 's' : ''} detected. Text inside tables can be edited; table structure is never changed.`);
  if (features.textBoxes > 0) notes.push('Text boxes detected. Their text can be edited, but the browser preview may not position them exactly like Word.');
  if (features.images > 0) notes.push('Images or shapes detected. They are preserved untouched.');
  if (features.trackedChanges > 0) notes.push('Tracked changes detected. Deleted text is ignored and existing revisions are left as they are.');
  if (features.fields > 0) notes.push('Word fields (page numbers, references) detected. Paragraphs containing fields are never edited.');
  if (features.contentControls > 0) notes.push('Content controls detected. Their text can be edited; the controls themselves are preserved.');
  if (features.comments) notes.push('Comments detected. They are preserved but not shown in the preview.');
  return notes;
}
