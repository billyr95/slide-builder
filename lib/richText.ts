// Minimal, allowlist-only "rich text" support for the rare per-run
// italic/bold override (see each *RichText field on SlideData) --
// deliberately NOT a general rich-text editor. The only markup these
// fields are ever allowed to carry is em/i/strong/b/br (no attributes);
// everything else is escaped to plain text, both when a field is saved
// (EditorPanel.tsx/NewSlideModal.tsx's EditHtmlModal) and again
// defensively at render time (SlideCanvas.tsx), so even a future bug or a
// hand-edited DB row can never inject anything beyond this allowlist.

const ALLOWED_TAGS = ['em', 'i', 'strong', 'b', 'br'] as const
const BOLD_TAGS = new Set(['strong', 'b'])

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Matches any HTML-tag-shaped token (open, close, or self-closing) --
// walking the string once and classifying each one lets the allowlist
// logic below be a simple per-token decision, and can't be tricked by
// malformed/nested/unknown markup the way a strip-in-place regex could.
const ANY_TAG_RE = /(<\/?[a-zA-Z][a-zA-Z0-9]*\s*\/?>)/g

// Allowlist-sanitizes `html`, keeping only em/i/strong/b/br (normalized to
// lowercase, no attributes ever survive even on an allowed tag -- a token
// like `<i onmouseover=...>` doesn't match the plain-tag shape below and is
// dropped like any other disallowed tag). `allowBold` strips strong/b too
// (for a field whose current font has no bold face, e.g. 92NY Text) --
// everything else about the tag set is unconditional. Returns whether
// anything was actually dropped, so a caller can surface that to the user.
export function sanitizeFormattingHtml(html: string, allowBold: boolean): { html: string; stripped: boolean } {
  let stripped = false
  const result = html
    .split(ANY_TAG_RE)
    .map(tok => {
      const m = tok.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\s*\/?>$/)
      if (!m) {
        // Not a clean "<tag>"/"</tag>" token -- still flag as stripped if it
        // looks like a tag attempt that got neutralized (e.g. one carrying
        // attributes, like `<i onmouseover=...>`), so the caller's "removed
        // unsupported markup" note covers this too. Ordinary prose text
        // (even with a stray '<'/'>', like "5 < 10") never matches this.
        if (/<\/?[a-zA-Z]/.test(tok)) stripped = true
        return escapeHtml(tok)
      }
      const [, closing, rawTag] = m
      const tag = rawTag.toLowerCase()
      if (!(ALLOWED_TAGS as readonly string[]).includes(tag)) {
        stripped = true
        return ''
      }
      if (BOLD_TAGS.has(tag) && !allowBold) {
        stripped = true
        return ''
      }
      if (tag === 'br') return '<br>'
      return closing ? `</${tag}>` : `<${tag}>`
    })
    .join('')
  return { html: result, stripped }
}

// A field's plain text, with no existing rich override, as the initial
// value to seed the raw-HTML textarea with -- escaped so any literal
// '<'/'>'/'&' in the real text can't be misread as markup. Plain '\n'
// characters pass through as-is (a <textarea> renders them as real line
// breaks natively).
export function fieldHtmlForEditing(plainValue: string, richValue: string | undefined): string {
  return richValue ?? escapeHtml(plainValue)
}

// Takes the Edit HTML modal's raw textarea value on Save and returns both
// the plain text (source of truth for length/search/heuristics -- always
// kept in sync) and the sanitized rich HTML override, or undefined if the
// sanitized result has no formatting left (no point storing an override
// identical to the plain field). `allowBold` -- see sanitizeFormattingHtml.
export function processFieldHtml(rawHtml: string, allowBold: boolean): { plainText: string; richHtml: string | undefined; stripped: boolean } {
  const { html: sanitized, stripped } = sanitizeFormattingHtml(rawHtml, allowBold)
  const plainText = sanitized
    .replace(/<\/?(em|i|strong|b)>/gi, '')
    .replace(/<br>/gi, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
  const hasFormatting = /<(em|i|strong|b)>/i.test(sanitized)
  return { plainText, richHtml: hasFormatting ? sanitized : undefined, stripped }
}
