/**
 * Shared word-level text diff used by both the server (targeted DOCX edits)
 * and the client (change comparison UI).
 *
 * Pure functions, no dependencies.
 */

const TOKEN_RE = /[\t\n]|[^\S\t\n]+|[\p{L}\p{N}_'\u2019]+|[^\s\p{L}\p{N}_]/gu;

export function tokenize(text) {
  return text.match(TOKEN_RE) || [];
}

/**
 * Returns an array of operations: { type: 'equal' | 'delete' | 'insert', text }
 * Operations are in document order and, concatenated, reproduce both strings:
 *   equal+delete = oldText, equal+insert = newText.
 */
export function diffTokens(oldText, newText) {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  const n = a.length;
  const m = b.length;

  // Trim common prefix/suffix to keep the DP small.
  let start = 0;
  while (start < n && start < m && a[start] === b[start]) start++;
  let endA = n;
  let endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const ops = [];
  const push = (type, text) => {
    if (!text) return;
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += text;
    else ops.push({ type, text });
  };

  push('equal', a.slice(0, start).join(''));

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const rows = midA.length;
  const cols = midB.length;

  if (rows === 0 || cols === 0 || rows * cols > 4_000_000) {
    push('delete', midA.join(''));
    push('insert', midB.join(''));
  } else {
    // LCS table (Uint16 is enough: paragraphs are short, guarded above).
    const width = cols + 1;
    const table = new Uint16Array((rows + 1) * width);
    for (let i = rows - 1; i >= 0; i--) {
      for (let j = cols - 1; j >= 0; j--) {
        table[i * width + j] =
          midA[i] === midB[j]
            ? table[(i + 1) * width + j + 1] + 1
            : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < rows && j < cols) {
      if (midA[i] === midB[j]) {
        push('equal', midA[i]);
        i++;
        j++;
      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
        push('delete', midA[i]);
        i++;
      } else {
        push('insert', midB[j]);
        j++;
      }
    }
    while (i < rows) push('delete', midA[i++]);
    while (j < cols) push('insert', midB[j++]);
  }

  push('equal', a.slice(endA).join(''));
  return ops;
}

/**
 * Converts a diff into edit hunks expressed as character ranges of the old text:
 *   { start, end, insert }  -> replace old[start:end] with `insert`.
 * Hunks separated only by whitespace are merged so edits stay readable.
 */
export function diffToHunks(oldText, newText) {
  const ops = diffTokens(oldText, newText);
  const hunks = [];
  let pos = 0;
  let current = null;
  let pendingEqual = '';

  for (const op of ops) {
    if (op.type === 'equal') {
      if (current) {
        if (/^[^\S\t\n]+$/.test(op.text) && op.text.length <= 2) {
          // Whitespace-only gap: tentatively keep inside the hunk.
          pendingEqual = op.text;
        } else {
          hunks.push(current);
          current = null;
          pendingEqual = '';
        }
      }
      pos += op.text.length;
    } else {
      if (!current) {
        current = { start: pos, end: pos, insert: '' };
      } else if (pendingEqual) {
        current.end += pendingEqual.length;
        current.insert += pendingEqual;
        pendingEqual = '';
      }
      if (op.type === 'delete') {
        current.end = pos + op.text.length;
        pos += op.text.length;
      } else {
        current.insert += op.text;
      }
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

export function normalizeForCompare(text) {
  return String(text || '')
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();
}
