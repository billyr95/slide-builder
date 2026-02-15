import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { readTemplates, saveTemplate } from '@/lib/storage'
import { SlideTemplate } from '@/lib/types'

export async function GET() {
  const templates = readTemplates()
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const now = new Date().toISOString()

  const template: SlideTemplate = {
    id: body.id || uuidv4(),
    name: body.name || 'Untitled Template',
    createdAt: body.createdAt || now,
    updatedAt: now,
    data: body.data,
  }

  saveTemplate(template)
  return NextResponse.json(template, { status: 201 })
}
