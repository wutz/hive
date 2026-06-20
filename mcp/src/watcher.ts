#!/usr/bin/env node
/**
 * Hive Agent Watcher (Node.js)
 *
 * Uses Supabase Realtime to watch for new user messages.
 * When a new message arrives, invokes Claude Code to respond.
 *
 * Usage:
 *   cd ~/Projects/wutz/hive && node mcp/dist/watcher.js
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'

const HIVE_URL = process.env.HIVE_URL || 'https://hive.wutz.workers.dev'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://icbmhwuzmazxwsrcough.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// Track processed message IDs
const processed = new Set<string>()

async function hiveApi(method: string, path: string) {
  const res = await fetch(`${HIVE_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': 'hive-watcher/0.1.0' },
  })
  return res.json()
}

async function checkAndRespond(taskId: string) {
  // Get events for this chat
  const events = await hiveApi('GET', `/api/events?taskId=${taskId}`) as any[]
  if (!Array.isArray(events) || events.length === 0) return

  const messages = events.filter(e => e.type === 'message')
  if (messages.length === 0) return

  const lastMessage = messages[messages.length - 1]

  // Only respond to human messages
  if (lastMessage.userType !== 'human') return

  // Check if already processed
  if (processed.has(lastMessage.id)) return

  // Check if there's already an agent reply after this message
  const lastMsgTime = new Date(lastMessage.createdAt).getTime()
  const hasAgentReply = events.some(
    e => e.type === 'message' && e.userType === 'agent' &&
    new Date(e.createdAt).getTime() > lastMsgTime
  )
  if (hasAgentReply) {
    processed.add(lastMessage.id)
    return
  }

  console.log(`[Hive] New message from ${lastMessage.userName}: "${lastMessage.content.slice(0, 50)}..."`)

  // Invoke Claude Code to respond
  try {
    const prompt = `A user asked in Hive chat "${lastMessage.content}". Use hive_get_chat_events with chatId "${taskId}" to see full context, then use hive_respond with chatId "${taskId}" to answer. Be concise and helpful.`
    const result = execSync(`claude --print "${prompt.replace(/"/g, '\\"')}"`, {
      cwd: '/Users/wutz/Projects/wutz/hive',
      timeout: 120000,
      encoding: 'utf-8',
    })
    console.log(`[Hive] Agent responded: ${result.slice(0, 100)}`)
  } catch (e) {
    console.error('[Hive] Failed to respond:', e.message?.slice(0, 100))
  }

  processed.add(lastMessage.id)
}

async function main() {
  console.log('[Hive Watcher] Started — watching for new messages via Supabase Realtime')

  // Subscribe to new events
  supabase
    .channel('hive-watcher')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload: any) => {
      const ev = payload.new
      if (ev && ev.type === 'message') {
        // Wait a bit for the event to be fully committed, then check
        setTimeout(() => checkAndRespond(ev.task_id), 1000)
      }
    })
    .subscribe()

  // Also poll every 30 seconds as fallback
  setInterval(async () => {
    const chats = await hiveApi('GET', '/api/tasks') as any[]
    if (!Array.isArray(chats)) return
    for (const chat of chats) {
      if (chat.status !== 'done') {
        await checkAndRespond(chat.id)
      }
    }
  }, 30000)

  // Initial check
  const chats = await hiveApi('GET', '/api/tasks') as any[]
  if (Array.isArray(chats)) {
    for (const chat of chats) {
      if (chat.status !== 'done') {
        await checkAndRespond(chat.id)
      }
    }
  }
}

main().catch(console.error)
