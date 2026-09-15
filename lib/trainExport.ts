import { TrainEntry } from './trainTypes'

const MODEL = 'claude-haiku-4-5-20251001'

// Fields common to both entry sources, as "known: value" lines.
function commonKnownLines(entry: TrainEntry): string[] {
  const known: string[] = [
    `Screen type: ${entry.screenType}`,
    `Has label/kicker line: ${entry.hasLabel}`,
    `Has logos: ${entry.hasLogos}`,
    `Has QR code: ${entry.hasQrCode}`,
    `Image count: ${entry.imageCount}`,
  ]
  if (entry.hasLabel && entry.label) known.push(`Label: "${entry.label}"`)
  if (entry.title) known.push(`Title: "${entry.title}"`)
  known.push(`Title font: ${entry.titleFont}`)
  known.push(`Title italic: ${entry.titleItalic}`)
  if (entry.subtitle) {
    known.push(`Subtitle: "${entry.subtitle}"`)
    known.push(`Subtitle weight: ${entry.subtitleWeight}`)
  }
  if (entry.subtitle2) known.push(`Subtitle 2: "${entry.subtitle2}"`)
  if (entry.presenters) {
    known.push(`Presenters (one per line):\n${entry.presenters}`)
    known.push(`Presenters font: ${entry.presentersFont}`)
  }
  if (entry.seriesName) known.push(`Series name: "${entry.seriesName}"`)
  if (entry.listeningCredit) known.push(`Listening credit: "${entry.listeningCredit}"`)
  return known
}

// The full set of visual style properties a human could plausibly supply by
// hand for an old slide. Anything already known (weights, italic, an
// explicit color) is passed to the model as ground truth instead of being
// asked for — only the remaining gaps get listed as things to estimate.
function buildEstimatePrompt(entry: TrainEntry): string {
  const attached = entry.images.filter(img => img.url)
  const known = commonKnownLines(entry)
  if (entry.backgroundColor) known.push(`Background color: ${entry.backgroundColor}`)
  if (entry.textColor) known.push(`Text color: ${entry.textColor}`)

  const estimate: string[] = ['Title font size, as a ratio relative to slide height']
  if (entry.subtitle) estimate.push('Subtitle font size, as a ratio relative to slide height')
  if (attached.length > 0) {
    estimate.push(`Position and crop for each of the ${attached.length} attached image(s), in the order given`)
  }
  if (!entry.backgroundColor) estimate.push('Background color (hex)')
  if (!entry.textColor) estimate.push('Text color (hex)')

  // The stated image count (what actually appeared on the slide) can differ
  // from how many source image files are attached below — e.g. the original
  // images no longer exist. Call that out explicitly so the model doesn't
  // assume the two always match.
  const countNote: string[] = []
  if (entry.imageCount !== attached.length) {
    countNote.push(attached.length === 0
      ? `Note: the slide is stated to have had ${entry.imageCount} image(s), but none of the original source files are attached — estimate style from the text/layout fields only, and do not assume any image content.`
      : `Note: the slide is stated to have had ${entry.imageCount} image(s), but only ${attached.length} source file(s) are attached below. Base image position/crop estimates only on the image(s) actually attached.`)
  }

  return [
    'You are labeling a historical event slide as training data for a slide-layout generator.',
    ...countNote,
    '',
    'Known ground-truth values:',
    ...known.map(line => `- ${line}`),
    '',
    'Based on the attached image(s), estimate ONLY the following visual style properties:',
    ...estimate.map(line => `- ${line}`),
    '',
    'Respond with a single JSON object containing your estimates, keyed by the property names above.',
  ].join('\n')
}

// Live entries come straight from the editor's own state — every value is
// already exact, so there's nothing to estimate. Ask the model to sanity-check
// the image(s) against the known values instead of guessing at anything.
function buildConfirmPrompt(entry: TrainEntry): string {
  const known = commonKnownLines(entry)
  known.push(`Background color: ${entry.backgroundColor}`)
  known.push(`Text color: ${entry.textColor}`)
  if (entry.liveStyle) {
    known.push(`Additional exact style data (from the original editor state, as JSON): ${JSON.stringify(entry.liveStyle)}`)
  }

  return [
    'You are QA-checking a slide that was exported directly from a slide-layout editor.',
    'Every value below is EXACT, known ground truth taken from the editor state — nothing needs to be estimated.',
    '',
    'Known ground-truth values:',
    ...known.map(line => `- ${line}`),
    '',
    'Review the attached image(s) against these values and confirm they are visually consistent with each other.',
    'If anything looks inconsistent or wrong, briefly describe what and why; otherwise just confirm the match.',
    'Respond with a single JSON object: { "consistent": boolean, "notes": string }.',
  ].join('\n')
}

function buildPrompt(entry: TrainEntry): string {
  return entry.source === 'live' ? buildConfirmPrompt(entry) : buildEstimatePrompt(entry)
}

function dataUrlToBase64(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',')
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
}

export function buildBatchLine(entry: TrainEntry): string {
  const content: unknown[] = entry.images
    .filter(img => img.url)
    .map(img => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType || 'image/png',
        data: dataUrlToBase64(img.url),
      },
    }))

  content.push({ type: 'text', text: buildPrompt(entry) })

  const line = {
    custom_id: entry.id,
    params: {
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content }],
    },
    source: entry.source,
    screen_type: entry.screenType,
    has_label: entry.hasLabel,
    has_logos: entry.hasLogos,
    has_qr_code: entry.hasQrCode,
    series_name: entry.seriesName,
    listening_credit: entry.listeningCredit,
    image_count: entry.imageCount,
  }

  return JSON.stringify(line)
}

export function downloadJsonl(entries: TrainEntry[], filenameTag: string) {
  const lines = entries.map(buildBatchLine)
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'application/jsonl' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `training-batch-${filenameTag}-${stamp}.jsonl`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
