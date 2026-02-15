import { NextRequest, NextResponse } from 'next/server'
import { getTemplateById, saveTemplate, deleteTemplate } from '@/lib/storage'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const template = getTemplateById(params.id)
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(template)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const existing = getTemplateById(params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = {
    ...existing,
    name: body.name ?? existing.name,
    data: body.data ?? existing.data,
    updatedAt: new Date().toISOString(),
  }
  saveTemplate(updated)
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const success = deleteTemplate(params.id)
  if (!success) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
