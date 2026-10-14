import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { config } from '../../config/index.js';
import { AppError } from '../../utils/errors.js';

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  xml: 'http://www.w3.org/XML/1998/namespace',
};

const MAIN_DOC_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  'application/vnd.ms-word.document.macroEnabledMain+xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml',
];

function invalid(message, code = 'INVALID_DOCX') {
  return new AppError(422, code, message);
}

/**
 * Opens and validates a DOCX buffer. The returned object keeps the JSZip instance
 * so untouched parts are copied byte-for-byte when the package is written again.
 */
export async function openDocx(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) throw invalid('The file is empty or too small to be a Word document.');
  if (buffer.length > config.limits.maxUploadBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'That file is larger than the allowed upload size.');
  }
  // Legacy .doc / password-protected documents are OLE compound files, not ZIP packages.
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
    throw invalid(
      'This looks like a legacy .doc or password-protected file. Please save it as a regular .docx without a password and try again.',
      'UNSUPPORTED_DOCX',
    );
  }
  if (!(buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)) {
    throw invalid('This file is not a valid .docx package.');
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  } catch {
    throw invalid('This file could not be opened as a .docx package. It may be corrupted.');
  }

  const names = Object.keys(zip.files);
  if (names.length > config.limits.maxZipEntries) throw invalid('This document contains too many internal parts.');

  let totalSize = 0;
  for (const name of names) {
    if (name.includes('..') || name.startsWith('/') || name.includes('\\') || /^[a-zA-Z]:/.test(name)) {
      throw invalid('This document contains unsafe internal file paths.', 'UNSAFE_DOCX');
    }
    const size = zip.files[name]?._data?.uncompressedSize;
    if (typeof size === 'number') totalSize += size;
  }
  if (totalSize > config.limits.maxUncompressedBytes) throw invalid('This document expands to an unreasonable size.', 'UNSAFE_DOCX');

  if (!zip.file('[Content_Types].xml')) throw invalid('Missing [Content_Types].xml - not a valid Word document.');
  if (!zip.file('word/document.xml')) throw invalid('Missing word/document.xml - not a valid Word document.');
  if (names.some((n) => /vbaProject\.bin$/i.test(n))) {
    throw invalid('Documents containing macros are not supported. Please save a macro-free .docx.', 'UNSAFE_DOCX');
  }

  const contentTypes = await zip.file('[Content_Types].xml').async('string');
  if (!MAIN_DOC_TYPES.some((t) => contentTypes.includes(t))) {
    throw invalid('This package does not contain a Word document body.');
  }
  if (contentTypes.includes('macroEnabled')) {
    throw invalid('Macro-enabled documents are not supported. Please save a macro-free .docx.', 'UNSAFE_DOCX');
  }

  // Validate relationship targets against SSRF, UNC path traversal, and dangerous protocols
  const relsNames = names.filter((n) => n.endsWith('.rels'));
  for (const relName of relsNames) {
    const relFile = zip.file(relName);
    if (!relFile) continue;
    const relXml = await relFile.async('string');
    const targetMatches = relXml.matchAll(/Target\s*=\s*["']([^"']+)["']/gi);
    for (const match of targetMatches) {
      const target = match[1]?.trim() || '';
      if (
        /^file:/i.test(target) ||
        target.startsWith('\\\\') ||
        target.startsWith('//') ||
        /^javascript:/i.test(target) ||
        /^data:/i.test(target) ||
        /(?:^|\/\/)(?:127\.|169\.254\.|10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|localhost|0\.0\.0\.0)/i.test(target)
      ) {
        throw invalid(`The document relationship ${relName} points to an unsafe external target.`, 'UNSAFE_DOCX');
      }
    }
  }

  const docx = { zip, names, parsed: new Map(), dirty: new Set() };
  // Make sure the main part is parseable up front (also enforces DOCTYPE rejection).
  await getPart(docx, 'word/document.xml');
  return docx;
}

export function parseXml(xml, label = 'part') {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw invalid(`The document part ${label} uses unsupported XML declarations.`, 'UNSAFE_DOCX');
  }
  let failed = false;
  let doc;
  try {
    const parser = new DOMParser({
      onError: (level) => {
        if (level !== 'warning') failed = true;
      },
    });
    doc = parser.parseFromString(xml, 'text/xml');
  } catch {
    failed = true;
  }
  if (failed || !doc || !doc.documentElement) throw invalid(`The document part ${label} is not valid XML.`);
  return doc;
}

export function serializeXml(doc) {
  return new XMLSerializer().serializeToString(doc);
}

/** Loads (and caches) an XML part as a DOM. */
export async function getPart(docx, name) {
  if (docx.parsed.has(name)) return docx.parsed.get(name);
  const file = docx.zip.file(name);
  if (!file) return null;
  const xml = await file.async('string');
  if (xml.length > config.limits.maxXmlPartBytes) throw invalid('A document part is unreasonably large.', 'UNSAFE_DOCX');
  const dom = parseXml(xml, name);
  docx.parsed.set(name, dom);
  return dom;
}

export function markDirty(docx, name) {
  docx.dirty.add(name);
}

/** Names of header/footer parts that can contain visible text. */
export function textPartNames(docx) {
  const out = ['word/document.xml'];
  const extras = docx.names
    .filter((n) => /^word\/(header|footer)\d*\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return out.concat(extras);
}

/** Writes dirty parts back into the zip and produces a new buffer. */
export async function saveDocx(docx) {
  for (const name of docx.dirty) {
    const dom = docx.parsed.get(name);
    if (!dom) continue;
    docx.zip.file(name, serializeXml(dom));
  }
  return docx.zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export function childElements(el) {
  const out = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n);
  return out;
}

export const isW = (el, local) => el && el.nodeType === 1 && el.namespaceURI === NS.w && el.localName === local;
