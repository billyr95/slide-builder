import fs from 'fs'
import path from 'path'
import { SlideTemplate } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(TEMPLATES_FILE)) {
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify([]), 'utf-8')
  }
}

export function readTemplates(): SlideTemplate[] {
  ensureDataDir()
  const raw = fs.readFileSync(TEMPLATES_FILE, 'utf-8')
  return JSON.parse(raw) as SlideTemplate[]
}

export function writeTemplates(templates: SlideTemplate[]) {
  ensureDataDir()
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8')
}

export function getTemplateById(id: string): SlideTemplate | undefined {
  return readTemplates().find(t => t.id === id)
}

export function saveTemplate(template: SlideTemplate): SlideTemplate {
  const templates = readTemplates()
  const idx = templates.findIndex(t => t.id === template.id)
  if (idx >= 0) {
    templates[idx] = template
  } else {
    templates.unshift(template)
  }
  writeTemplates(templates)
  return template
}

export function deleteTemplate(id: string): boolean {
  const templates = readTemplates()
  const filtered = templates.filter(t => t.id !== id)
  if (filtered.length === templates.length) return false
  writeTemplates(filtered)
  return true
}
