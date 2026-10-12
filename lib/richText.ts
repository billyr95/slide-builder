// Minimal, allowlist-only "rich text" support for the rare per-run italic
// override (see each *RichText field on SlideData) -- deliberately NOT a
// general rich-text editor. The only markup these fields are ever allowed
// to carry is bare <i>/</i> (no attributes, no other tags); everything else
// is escaped to plain text, both when a field is saved (EditorPanel.tsx)
// and again defensively at render time (SlideCanvas.tsx), so even a future
// bug or a hand-edited DB row can never inject anything beyond italics.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Walks the string once, splitting on exact <i>/</i> tokens (case-
// insensitive, normalized to lowercase on output) and HTML-escaping every
// other run -- simpler and safer than trying to strip disallowed tags out
// of arbitrary HTML, and can't be tricked by malformed/nested markup.
const TAG_SPLIT_RE = /(<\/i>|<i>)/gi

export function sanitizeItalicHtml(html: string): string {
  return html
    .split(TAG_SPLIT_RE)
    .map(tok => {
      if (/^<i>$/i.test(tok)) return '<i>'
      if (/^<\/i>$/i.test(tok)) return '</i>'
      return escapeHtml(tok)
    })
    .join('')
}

// Converts whatever block-level structure a contentEditable div's own Enter
// key produced (browsers differ: wrapped <div>s, <br>, occasionally <p>)
// into plain '\n' characters -- run BEFORE sanitizeItalicHtml, so that
// function only ever has to deal with text + <i> tags, nothing else.
function normalizeBreaksToNewlines(html: string): string {
  return html
    .replace(/<div><br\s*\/?><\/div>/gi, '\n') // an empty line, Chrome's own idiom for it
    .replace(/<\/div>\s*<div>/gi, '\n') // boundary between two lines
    .replace(/<\/?div>/gi, '') // the first line's opening tag / the last line's closing tag -- no boundary to mark
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')
}

// A field's plain text, with no existing rich override, as the initial
// (uncontrolled) HTML to seed the italics editor with -- escaped so any
// literal '<'/'>'/'&' in the real text can't be misread as markup once
// it's set via innerHTML. Plain '\n' characters are left as-is (the editor
// itself renders with white-space:pre-wrap, so they already display as
// line breaks without needing to become <br>).
export function plainTextToEditableHtml(plain: string): string {
  return escapeHtml(plain)
}

// The inverse of editing: takes a contentEditable div's raw .innerHTML
// after the user is done and returns both the plain text (source of truth
// for length/search/heuristics -- always kept in sync) and the sanitized
// rich HTML override, or undefined if the result has no italics left (no
// point storing an override that's identical to the plain field).
export function processEditedHtml(rawHtml: string): { plainText: string; richHtml: string | undefined } {
  const sanitized = sanitizeItalicHtml(normalizeBreaksToNewlines(rawHtml))
  const plainText = sanitized
    .replace(/<\/?i>/gi, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  const richHtml = /<i>/i.test(sanitized) ? sanitized : undefined
  return { plainText, richHtml }
}
