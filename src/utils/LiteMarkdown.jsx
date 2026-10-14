import { Fragment } from 'react';

/** Renders **bold** inline segments. */
function inline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
    ),
  );
}

/**
 * Minimal, safe markdown subset for chat messages: paragraphs, "-" bullets and **bold**.
 * Never uses dangerouslySetInnerHTML.
 */
export function LiteMarkdown({ text, className = '' }) {
  const blocks = [];
  let list = null;
  String(text || '')
    .split('\n')
    .forEach((raw) => {
      const line = raw.trimEnd();
      const bullet = /^\s*[-*\u2022]\s+(.*)$/.exec(line);
      if (bullet) {
        if (!list) {
          list = { type: 'ul', items: [] };
          blocks.push(list);
        }
        list.items.push(bullet[1]);
      } else if (line.trim() === '') {
        list = null;
      } else {
        list = null;
        blocks.push({ type: 'p', text: line });
      }
    });

  return (
    <div className={`chat-prose ${className}`}>
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, `${i}-${j}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{inline(b.text, String(i))}</p>
        ),
      )}
    </div>
  );
}
