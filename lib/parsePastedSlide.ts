export interface ParsedSlideFields {
  label: string
  title: string
  subtitle: string
  subtitle2: string
  presenters: string // newline-joined, one per line -- matches SlideData.presenters' own format
  seriesName: string
}

const LINE_PATTERNS: [Exclude<keyof ParsedSlideFields, 'presenters'>, RegExp][] = [
  ['label', /^label:\s*(.*)$/i],
  ['title', /^title:\s*(.*)$/i],
  // Checked before the plain "subtitle:" pattern isn't actually necessary --
  // "subtitle2:" doesn't match /^subtitle:/i since the "2" sits before the
  // colon -- but keeping it first reads more clearly next to its sibling.
  ['subtitle2', /^subtitle\s*2:\s*(.*)$/i],
  ['subtitle', /^subtitle:\s*(.*)$/i],
  ['seriesName', /^series:\s*(.*)$/i],
]

const PRESENTERS_PATTERN = /^presenters?:\s*(.*)$/i

// Simple line-based pattern matching (regex on "Label:", "Title:", etc.) --
// not an AI call, so this stays free and instant. A freeform/unlabeled paste
// (no recognizable "Label:"-style prefixes) would need a server-side LLM
// call to parse reliably; that's not implemented here.
export function parsePastedSlide(text: string): ParsedSlideFields {
  const fields: ParsedSlideFields = { label: '', title: '', subtitle: '', subtitle2: '', presenters: '', seriesName: '' }
  const presenterLines: string[] = []
  let inPresenters = false

  function addPresenterText(raw: string) {
    presenterLines.push(...raw.split(';').map(s => s.trim()).filter(Boolean))
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      inPresenters = false
      continue
    }

    const presenterMatch = PRESENTERS_PATTERN.exec(line)
    if (presenterMatch) {
      inPresenters = true
      if (presenterMatch[1].trim()) addPresenterText(presenterMatch[1])
      continue
    }

    const fieldMatch = LINE_PATTERNS.find(([, pattern]) => pattern.test(line))
    if (fieldMatch) {
      const [key, pattern] = fieldMatch
      fields[key] = (pattern.exec(line)?.[1] ?? '').trim()
      inPresenters = false
      continue
    }

    // Unlabeled line directly after "Presenters:" -- treat as another name,
    // so "one per line" works without repeating the label (same convention
    // the /train prompt's "Presenters (one per line)" bullet already uses).
    if (inPresenters) {
      addPresenterText(line)
      continue
    }

    // Doesn't match any recognized label and isn't a presenters continuation
    // -- ignored, per spec.
  }

  fields.presenters = presenterLines.join('\n')
  return fields
}
