import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { openDocx } from '../src/services/documents/package.js';
import { estimateCost } from '../src/services/ai/budgetGuard.js';
import { adminUpdateUserSchema, adminUpdateBudgetSchema } from '../src/validators/schemas.js';

console.log('🔒 Starting AutoResumeAI Security Audit Test Suite...\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function createDocxBuffer(files = {}) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Safe Resume Content</w:t></w:r></w:p></w:body></w:document>',
  );

  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }

  return await zip.generateAsync({ type: 'nodebuffer' });
}

async function main() {
  // Test 1: Baseline valid DOCX passes
  await runAsyncTest('Baseline valid DOCX opens successfully', async () => {
    const buf = await createDocxBuffer();
    const docx = await openDocx(buf);
    assert.ok(docx.names.includes('word/document.xml'));
  });

  // Test 2: Reject non-zip buffers and legacy .doc files
  await runAsyncTest('Rejects undersized file buffer (<100 bytes)', async () => {
    const tinyBuf = Buffer.from('Not a zip package.');
    await assert.rejects(
      () => openDocx(tinyBuf),
      /empty or too small/,
    );
  });

  await runAsyncTest('Rejects non-zip file buffer (>100 bytes)', async () => {
    const invalidBuf = Buffer.alloc(150, 0x41); // 'A's
    await assert.rejects(
      () => openDocx(invalidBuf),
      /not a valid \.docx package/,
    );
  });

  await runAsyncTest('Rejects legacy OLE .doc compound file header', async () => {
    const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const padding = Buffer.alloc(120, 0);
    const docBuf = Buffer.concat([oleHeader, padding]);
    await assert.rejects(
      () => openDocx(docBuf),
      /legacy \.doc or password-protected/,
    );
  });

  // Test 3: Path traversal rejection in zip entries
  await runAsyncTest('Rejects path traversal (../) in zip entry names', async () => {
    const zip = new JSZip();
    zip.file('../evil.txt', 'malicious path traversal');
    zip.file('[Content_Types].xml', 'content');
    zip.file('word/document.xml', 'doc');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await assert.rejects(
      () => openDocx(buf),
      /unsafe internal file paths/,
    );
  });

  await runAsyncTest('Rejects absolute / UNC path in zip entry names', async () => {
    const zip = new JSZip();
    zip.file('/etc/passwd', 'root:x:0:0:root:/root:/bin/bash');
    zip.file('[Content_Types].xml', 'content');
    zip.file('word/document.xml', 'doc');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await assert.rejects(
      () => openDocx(buf),
      /unsafe internal file paths/,
    );
  });

  // Test 4: Macro rejection
  await runAsyncTest('Rejects macro vbaProject.bin in zip package', async () => {
    const buf = await createDocxBuffer({ 'word/vbaProject.bin': Buffer.from('fake vba bytecode') });
    await assert.rejects(
      () => openDocx(buf),
      /Documents containing macros are not supported/,
    );
  });

  // Test 5: XXE / malicious DOCTYPE rejection
  await runAsyncTest('Rejects XML with DOCTYPE or ENTITY definitions (XXE prevention)', async () => {
    const maliciousXml = '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>';
    const buf = await createDocxBuffer({ 'word/document.xml': maliciousXml });
    await assert.rejects(
      () => openDocx(buf),
      /unsupported XML declarations/,
    );
  });

  // Test 6: Malicious relationship target SSRF / UNC path rejection
  await runAsyncTest('Rejects file:// protocol in relationship targets', async () => {
    const relsXml = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="file:///C:/Windows/win.ini" TargetMode="External"/></Relationships>';
    const buf = await createDocxBuffer({ 'word/_rels/document.xml.rels': relsXml });
    await assert.rejects(
      () => openDocx(buf),
      /unsafe external target/,
    );
  });

  await runAsyncTest('Rejects loopback and cloud metadata SSRF (169.254.x.x) in relationships', async () => {
    const ssrfRels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="http://169.254.169.254/latest/meta-data/" TargetMode="External"/></Relationships>';
    const buf = await createDocxBuffer({ 'word/_rels/document.xml.rels': ssrfRels });
    await assert.rejects(
      () => openDocx(buf),
      /unsafe external target/,
    );
  });

  // Test 7: AI Cost Estimation correctness
  runTest('Calculates accurate estimated token costs for OpenRouter Claude', () => {
    const cost = estimateCost({
      model: 'anthropic/claude-3.5-sonnet',
      promptTokens: 1000,
      completionTokens: 500,
    });
    // prompt: 1000 / 1M * $3.0 = 0.003
    // completion: 500 / 1M * $15.0 = 0.0075
    // total = 0.0105
    assert.equal(cost, 0.0105);
  });

  runTest('Respects explicit provider-reported cost when present', () => {
    const explicitCost = estimateCost({
      model: 'anthropic/claude-3.5-sonnet',
      promptTokens: 1000,
      completionTokens: 500,
      explicitCost: 0.00921,
    });
    assert.equal(explicitCost, 0.00921);
  });

  // Test 8: Admin Zod Schema validation guards against prototype pollution and invalid payloads
  runTest('Admin user update schema validates types and rejects unknown fields', () => {
    const valid = adminUpdateUserSchema.safeParse({
      is_unlimited: true,
      daily_limit: 25,
      account_status: 'active',
      role: 'admin',
    });
    assert.ok(valid.success);

    const malicious = adminUpdateUserSchema.safeParse({
      daily_limit: -5,
      __proto__: { polluted: true },
      unknown_field: 'exploit',
    });
    assert.ok(!malicious.success);
  });

  runTest('Admin budget schema validates positive bounds and rejects invalid thresholds', () => {
    const valid = adminUpdateBudgetSchema.safeParse({
      total_budget_usd: 10.0,
      hard_stop_threshold_usd: 8.0,
      reserved_balance_usd: 2.0,
      is_paused: false,
    });
    assert.ok(valid.success);

    const invalid = adminUpdateBudgetSchema.safeParse({
      total_budget_usd: -10, // negative budget
    });
    assert.ok(!invalid.success);
  });

  console.log(`\n🎉 All ${passedTests} security audit checks passed successfully!`);
}

main().catch((err) => {
  console.error('Fatal error running security audit:', err);
  process.exit(1);
});
