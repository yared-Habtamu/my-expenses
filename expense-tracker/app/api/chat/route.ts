import { NextResponse } from 'next/server'
import { generateText, tool, type LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGateway } from '@ai-sdk/gateway'
import { getDemoUser } from '@/lib/data'
import { executeTool, MCP_TOOLS, TOOL_SCHEMAS } from '@/lib/mcp'

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || undefined })
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || undefined })
const gateway = createGateway({ apiKey: process.env.VERCEL_API_KEY || undefined })

const INTENT_ROUTING: { pattern: RegExp; tool: string; args?: Record<string, unknown> }[] = [
  { pattern: /predict|forecast|project|projection|future|status|runway|will i run out|end of (the )?month/i, tool: 'get_financial_projection' },
  { pattern: /trend|daily|average|avg|mean|median|statistic|pattern|habit/i, tool: 'get_spending_trend' },
  { pattern: /categor|grocer|transport|dining|tag|where (did|does) (my )?money/i, tool: 'get_spending_by_category' },
  { pattern: /income|salary|credited|deposit|earning/i, tool: 'get_income_summary' },
  { pattern: /balance|account|wallet|how much (do i )?(have|own)|net worth/i, tool: 'get_account_balances' },
  { pattern: /merchant|store|shop|where do i buy/i, tool: 'get_top_merchants' },
  { pattern: /biggest|largest|highest|most expensive/i, tool: 'get_largest_transactions' },
  { pattern: /spent|spend|spending|expenses?|how much (did|have) i (spend|paid)/i, tool: 'get_spending_summary' },
  { pattern: /sms|message|text message|imported/i, tool: 'get_sms_logs' },
  { pattern: /transaction|recent|history|list|search/i, tool: 'get_transactions' },
]

const FINANCE_PATTERN =
  /balance|account|wallet|net worth|cash|money|finance|financial|currency|etb|birr|spent|spend|spending|expense|expenditure|income|salary|earning|credited|deposited|withdraw|paid|payment|purchase|bought|debit|credit|transaction|history|recent|merchant|store|shop|category|grocer|transport|dining|budget|saving|savings|loan|debt|transfer|top.?up|recharge|report|summary|trend|statement|sms|parsed|import|mcp|tool|analytics|insight|flow|calculate|calculation|math|statistic|statistical|average|mean|median|percent|\b\d+%|interest|compound|ratio|proportion|forecast|predict|project|projection|future|estimate|growth|deviation|probability|runway|model|invest|investment|return/i

const REFUSAL =
  'I can only help with questions about your money and finances — for example spending, income, balances, accounts, transactions, merchants, categories, trends, budgets, SMS-parsed data, statistical or financial math (percentages, averages, projections), and predictions about your financial status. Try asking me something like "How much did I spend this month?" or "Predict my financial status."'

function isFinanceRelated(messages: { role: 'user' | 'assistant'; content: string }[]): boolean {
  const recent = messages.slice(-2).map((m) => m.content).join(' ')
  return FINANCE_PATTERN.test(recent)
}

function buildTools(userId: string) {
  return Object.fromEntries(
    MCP_TOOLS.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: TOOL_SCHEMAS[t.name],
        execute: async (args: Record<string, unknown>) => {
          const res = await executeTool(t.name, { ...args, userId })
          return res.content[0].text
        },
      }),
    ]),
  )
}

async function runModel(model: LanguageModel, userId: string, system: string, messages: { role: 'user' | 'assistant'; content: string }[]) {
  const result = await generateText({
    model,
    system,
    messages,
    tools: buildTools(userId),
    maxRetries: 0,
  })
  if (result.text) return result.text
  for (let i = result.toolResults.length - 1; i >= 0; i--) {
    const out = result.toolResults[i].output
    if (typeof out === 'string' && out) return out
  }
  return 'Sorry, I could not answer that.'
}

export async function POST(request: Request) {
  const body = await request.json() as { messages?: { role: 'user' | 'assistant'; content: string }[] }
  const messages = body.messages ?? []
  const user = await getDemoUser()
  const latest = messages.at(-1)?.content ?? ''

  if (!isFinanceRelated(messages)) {
    return NextResponse.json({ role: 'assistant', content: REFUSAL, provider: 'guard' })
  }

  const system = `You are expense_tracker AI for user ${user.name}. You help with the user's money and finances: balances, accounts, spending, income, transactions, merchants, categories, trends, budgets, and SMS-parsed financial data, plus questions about the MCP tools available. You MAY and SHOULD perform general mathematical, statistical and financial calculations — standalone math (percentages, averages, means, medians, ratios, interest, compound interest, projections) and math applied to the user's financial data. For statistics on spending (e.g. "average daily spending"), call get_spending_trend. When asked to predict or project the user's financial status — e.g. "predict my status", "will I run out of money", "what will my balance be at month end" — call get_financial_projection and relay its forecast. When you need data, call the MCP tool that fits the question and relay its answer to the user. If a question is unrelated to money, transactions, statistics, predictions, or the MCP tools, do not answer it; politely decline and suggest a finance-related question.`

  // Primary provider first: free Gemini, then OpenAI, then the Vercel AI Gateway.
  const providers: { name: string; model: LanguageModel }[] = []
  if (process.env.GEMINI_API_KEY) providers.push({ name: 'gemini', model: google('gemini-3.5-flash') })
  if (process.env.OPENAI_API_KEY) providers.push({ name: 'openai', model: openai('gpt-4o-mini') })
  if (process.env.VERCEL_API_KEY) providers.push({ name: 'vercel-gateway', model: gateway('openai/gpt-4o-mini') })

  let lastError: unknown = null
  for (const provider of providers) {
    try {
      const content = await runModel(provider.model, user.id, system, messages)
      return NextResponse.json({ role: 'assistant', content, provider: provider.name })
    } catch (err) {
      lastError = err
      console.error(`[chat] provider ${provider.name} failed:`, err instanceof Error ? err.message : err)
    }
  }

  // No keys or every provider failed: answer from the offline MCP routing.
  const route = INTENT_ROUTING.find((r) => r.pattern.test(latest))
  if (route) {
    const result = await executeTool(route.tool, { ...route.args, userId: user.id })
    return NextResponse.json({ role: 'assistant', content: result.content[0].text, provider: 'offline' })
  }
  const tools = await executeTool('list_tools', {})
  return NextResponse.json({
    role: 'assistant',
    content: `I can answer questions about your finances, such as:
- "How much did I spend this month?"
- "What is my total balance?"
- "Where does my money go?"
- "What was my biggest transaction?"
- "What is 15% of my spending?"
- "Predict my financial status"

${tools.content[0].text}${lastError ? `\n\n(Online providers were unavailable: ${lastError instanceof Error ? lastError.message : String(lastError)})` : ''}`,
    provider: 'offline',
  })
}