import fs from 'fs/promises'
import path from 'path'
import { SlideTemplate } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json')

// Serializes all reads/writes through one promise chain so concurrent API
// calls (POST/PUT/DELETE) can't race and clobber each other's changes.
let queue: Promise<unknown> = Promise.resolve()
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn)
  queue = result.then(() => undefined, () => undefined)
  return result
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  try {
    await fs.access(TEMPLATES_FILE)
  } catch {
    await fs.writeFile(TEMPLATES_FILE, '[]', 'utf-8')
  }
}

async function readTemplatesRaw(): Promise<SlideTemplate[]> {
  await ensureDataDir()
  const raw = await fs.readFile(TEMPLATES_FILE, 'utf-8')
  return JSON.parse(raw) as SlideTemplate[]
}

async function writeTemplatesRaw(templates: SlideTemplate[]) {
  await ensureDataDir()
  // Write-then-rename so a crash mid-write can't leave templates.json truncated/corrupt.
  const tmpFile = `${TEMPLATES_FILE}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmpFile, JSON.stringify(templates, null, 2), 'utf-8')
  await fs.rename(tmpFile, TEMPLATES_FILE)
}

export function readTemplates(): Promise<SlideTemplate[]> {
  return withLock(readTemplatesRaw)
}

export function getTemplateById(id: string): Promise<SlideTemplate | undefined> {
  return withLock(async () => {
    const templates = await readTemplatesRaw()
    return templates.find(t => t.id === id)
  })
}

export function saveTemplate(template: SlideTemplate): Promise<SlideTemplate> {
  return withLock(async () => {
    const templates = await readTemplatesRaw()
    const idx = templates.findIndex(t => t.id === template.id)
    if (idx >= 0) {
      templates[idx] = template
    } else {
      templates.unshift(template)
    }
    await writeTemplatesRaw(templates)
    return template
  })
}

export function updateTemplate(
  id: string,
  patch: Partial<Pick<SlideTemplate, 'name' | 'data'>>
): Promise<SlideTemplate | undefined> {
  return withLock(async () => {
    const templates = await readTemplatesRaw()
    const idx = templates.findIndex(t => t.id === id)
    if (idx < 0) return undefined
    const updated: SlideTemplate = {
      ...templates[idx],
      name: patch.name ?? templates[idx].name,
      data: patch.data ?? templates[idx].data,
      updatedAt: new Date().toISOString(),
    }
    templates[idx] = updated
    await writeTemplatesRaw(templates)
    return updated
  })
}

export function deleteTemplate(id: string): Promise<boolean> {
  return withLock(async () => {
    const templates = await readTemplatesRaw()
    const filtered = templates.filter(t => t.id !== id)
    if (filtered.length === templates.length) return false
    await writeTemplatesRaw(filtered)
    return true
  })
}
