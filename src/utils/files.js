export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Client-side pre-check. The server repeats and enforces all of this. */
export async function validateDocxFile(file, maxBytes = MAX_UPLOAD_BYTES) {
  if (!file) return 'No file selected.';
  if (!/\.docx$/i.test(file.name)) {
    return 'Only .docx files are supported. Please save or export your resume as a .docx file and try again.';
  }
  if (file.size === 0) return 'That file is empty.';
  if (file.size > maxBytes) return `That file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (!isZip) return 'This file does not look like a valid .docx document.';
  return null;
}

export function base64ToBlob(base64, type = DOCX_MIME) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
