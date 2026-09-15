import { TrainEntry } from './trainTypes'

const MODEL = 'claude-haiku-4-5-20251001'

// The full set of visual style properties a human could plausibly supply by
// hand for an old slide. Anything already known (weights, italic, an
// explicit color) is passed to the model as ground truth instead of being
// asked for — only the remaining gaps get listed as things to estimate.
function buildPrompt(entry: TrainEntry): string {
  const known: string[] = [
    `Screen type: ${entry.screenType}`,
    `Has label/kicker line: ${entry.hasLabel}`,
    `Image count: ${entry.images.length}`,
  ]
  if (entry.hasLabel && entry.label) known.push(`Label: "${entry.label}"`)
  if (entry.title) known.push(`Title: "${entry.title}"`)
  known.push(`Title weight: ${entry.titleWeight}`)
  known.push(`Title italic: ${entry.titleItalic}`)
  if (entry.subtitle) {
    known.push(`Subtitle: "${entry.subtitle}"`)
    known.push(`Subtitle weight: ${entry.subtitleWeight}`)
  }
  if (entry.subtitle2) known.push(`Subtitle 2: "${entry.subtitle2}"`)
  if (entry.presenters) known.push(`Presenters (one per line):\n${entry.presenters}`)
  if (entry.backgroundColor) known.push(`Background color: ${entry.backgroundColor}`)
  if (entry.textColor) known.push(`Text color: ${entry.textColor}`)

  const estimate: string[] = ['Title font size, as a ratio relative to slide height']
  if (entry.subtitle) estimate.push('Subtitle font size, as a ratio relative to slide height')
  if (entry.images.length > 0) {
    estimate.push(`Position and crop for each of the ${entry.images.length} image(s) provided, in the order given`)
  }
  if (!entry.backgroundColor) estimate.push('Background color (hex)')
  if (!entry.textColor) estimate.push('Text color (hex)')

  return [
    'You are labeling a historical event slide as training data for a slide-layout generator.',
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
    screen_type: entry.screenType,
    has_label: entry.hasLabel,
    image_count: entry.images.filter(img => img.url).length,
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
