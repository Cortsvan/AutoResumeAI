/**
 * Basic end-to-end smoke test for the DOCX pipeline (no network, no AI).
 *   npm run smoke --workspace server
 */
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { openDocx } from '../src/services/documents/package.js';
import { listParagraphs, detectFeatures } from '../src/services/documents/inspect.js';
import { applyEdits } from '../src/services/documents/apply.js';
import { generateResumeDocx } from '../src/services/resumes/generate.js';
import { structureHeuristically } from '../src/services/resumes/structureResume.js';
import { resumeDataSchema } from '../src/services/resumes/schema.js';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const run = (text, rpr = '') => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (inner, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`;
const bullet = (inner) => para(inner, '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');

async function buildSample() {
  const body = [
    para(run('Jane Doe', '<w:b/><w:sz w:val="40"/>')),
    para(run('jane@example.com | ') + '<w:hyperlink r:id="rId9">' + run('linkedin.com/in/jane', '<w:color w:val="0563C1"/>') + '</w:hyperlink>'),
    para(run('EXPERIENCE', '<w:b/>')),
    para(run('QA Intern', '<w:b/>') + '<w:r><w:tab/></w:r>' + run('2023 \u2013 2024')),
    bullet(run('Tested ') + run('web appli', '<w:i/>') + run('cations and ', '<w:i/>') + run('reported bugs in Jira.')),
    bullet(run('Responsible for writing test cases.')),
    para(run('PROJECTS', '<w:b/>')),
    '<w:tbl><w:tr><w:tc>' + para(run('Test Automation Project')) + '</w:tc></w:tr></w:tbl>',
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
  ].join('');
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://linkedin.com/in/jane" TargetMode="External"/></Relationships>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

const original = await buildSample();
const docx = await openDocx(original);
const paragraphs = await listParagraphs(docx);
console.log('paragraphs:', paragraphs.map((p) => `${p.id} [${p.section}] ${JSON.stringify(p.text)}`).join('\n  '));

const bulletPara = paragraphs.find((p) => p.text.startsWith('Tested'));
const respPara = paragraphs.find((p) => p.text.startsWith('Responsible'));
const titlePara = paragraphs.find((p) => p.text.startsWith('QA Intern'));
const tablePara = paragraphs.find((p) => p.text.startsWith('Test Automation'));
assert.ok(bulletPara.isListItem, 'bullet detected');
assert.ok(tablePara.inTable, 'table paragraph detected');
assert.equal(titlePara.text, 'QA Intern\t2023 \u2013 2024');

const result = await applyEdits(original, [
  { id: 'a', kind: 'replace', paragraphId: bulletPara.id, expectedText: bulletPara.text, newText: 'Tested web applications and reported 12 bugs in Jira.' },
  { id: 'b', kind: 'replace', paragraphId: respPara.id, expectedText: respPara.text, newText: 'Wrote and maintained test cases.' },
  { id: 'c', kind: 'replace', paragraphId: titlePara.id, expectedText: titlePara.text, newText: 'QA Tester Intern\t2023 \u2013 2024' },
  { id: 'd', kind: 'insert_after', paragraphId: respPara.id, expectedText: 'Wrote and maintained test cases.', newText: 'Practised exploratory testing.' },
  { id: 'e', kind: 'replace', paragraphId: titlePara.id, expectedText: 'does not exist', newText: 'x' },
  { id: 'f', kind: 'replace', paragraphId: titlePara.id, expectedText: 'QA Tester Intern\t2023 \u2013 2024', newText: 'QA Tester Intern 2023' },
]);
console.log('results:', result.results.map((r) => `${r.id}:${r.status}`).join(' '));
assert.equal(result.results.find((r) => r.id === 'a').status, 'applied');
assert.equal(result.results.find((r) => r.id === 'b').status, 'applied');
assert.equal(result.results.find((r) => r.id === 'c').status, 'applied');
assert.equal(result.results.find((r) => r.id === 'd').status, 'applied');
assert.equal(result.results.find((r) => r.id === 'e').status, 'conflict');
assert.equal(result.results.find((r) => r.id === 'f').status, 'unsafe');

const after = result.paragraphs.map((p) => p.text);
console.log('after:', after);
assert.ok(after.includes('Tested web applications and reported 12 bugs in Jira.'));
assert.ok(after.includes('QA Tester Intern\t2023 \u2013 2024'));
assert.ok(after.includes('Practised exploratory testing.'));

const outZip = await JSZip.loadAsync(result.buffer);
const xml = await outZip.file('word/document.xml').async('string');
assert.ok(xml.includes('<w:hyperlink r:id="rId9">'), 'hyperlink preserved');
assert.ok(xml.includes('<w:i/>'), 'italic run formatting preserved');
assert.ok(xml.includes('<w:tbl>'), 'table preserved');
assert.ok(outZip.file('word/_rels/document.xml.rels'), 'relationships preserved');
// The untouched input must not have changed.
const originalAgain = await JSZip.loadAsync(original);
assert.ok((await originalAgain.file('word/document.xml').async('string')).includes('Responsible for writing test cases.'));

// Templates
for (const template of ['classic', 'modern', 'compact']) {
  const data = resumeDataSchema.parse({
    contact: { name: 'Jane Doe', headline: 'QA Tester', email: 'jane@example.com', phone: '+1 555 0100', location: 'Austin, TX', links: [{ label: 'GitHub', url: 'https://github.com/jane' }] },
    summary: 'Detail-oriented tester.',
    experience: [{ title: 'QA Intern', company: 'Acme', location: 'Remote', start: '2023', end: '2024', bullets: ['Tested things.', 'Reported bugs.'] }],
    education: [{ school: 'State University', degree: 'B.S. Computer Science', start: '2020', end: '2024', details: [] }],
    projects: [{ name: 'Test Suite', tech: 'Playwright', description: 'Automated checks.', bullets: ['Added 10 tests.'] }],
    skills: [{ label: 'Testing', items: 'Manual testing, Postman' }],
    certifications: [{ name: 'ISTQB Foundation', issuer: 'ISTQB', date: '2024' }],
  });
  const buf = await generateResumeDocx(data, { template, paper: 'a4' });
  const gen = await openDocx(buf);
  const gp = await listParagraphs(gen);
  assert.ok(gp.length > 8, `${template} generated paragraphs`);
  const features = await detectFeatures(gen);
  console.log(`template ${template}: ${buf.length} bytes, ${gp.length} paragraphs, page ${features.pageSize}`);
  const structured = structureHeuristically(gp);
  assert.equal(structured.contact.name, 'Jane Doe');
  assert.ok(structured.experience.length >= 1, `${template} structure experience`);
}

console.log('Smoke test passed.');
