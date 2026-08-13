import { NextResponse } from 'next/server'
import { executeTool, MCP_TOOLS } from '@/lib/mcp'

export async function GET() {
  return NextResponse.json({ name: 'expense_tracker', tools: MCP_TOOLS })
}

export async function POST(request: Request) {
  const body = await request.json() as { tool?: string; arguments?: Record<string, unknown> }
  const tool = body.tool
  if (!tool) return NextResponse.json({ error: 'tool is required', tools: MCP_TOOLS.map((t) => t.name) }, { status: 400 })

  const result = await executeTool(tool, body.arguments ?? {})
  if (result.error) {
    return NextResponse.json({ error: result.error, tools: MCP_TOOLS.map((t) => t.name) }, { status: 404 })
  }
  return NextResponse.json(result)
}