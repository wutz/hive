#!/usr/bin/env node
/**
 * Hive Agent Monitor
 *
 * Watches for new user messages in Hive chats and triggers Claude Code to respond.
 * Run this alongside Claude Code to make it a always-on Hive agent.
 *
 * Usage:
 *   HIVE_URL=https://hive.wutz.workers.dev \
 *   HIVE_API_KEY=hive_agent_xxx \
 *   node monitor.js
 */
import { createClient } from '@supabase/supabase-js'

const HIVE_URL = process.env.HIVE_URL || 'https://hive.wutz.workers.dev'
const HIVE_API_KEY = process.env.HIVE_API_KEY || ''
const SUPABASE_URL = 'https://icbmhwuzmazxwsrcough.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Cp0lPDleO8haCvdYLm-0zA_3GHp3pZA'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

async function hiveApi(method: string, path: string, body?: unknown) {
  const res = await fetch(`${HIVE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'hive-monitor/0.1.0',
      ...(HIVE_API_KEY ? { authorization: `Bearer ${HIVE_API_KEY}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// Track which chats we've already processed
const processedChats = new Set<string>()
// Track last event timestamp per chat to detect new messages
const lastEventTime = new Map<string, string>()

async function checkForNewMessages() {
  // Get all chats
  const chats = await hiveApi('GET', '/api/tasks') as any[]
  if (!Array.isArray(chats)) return

  for (const chat of chats) {
    if (chat.status === 'done') continue

    const events = await hiveApi('GET', `/api/events?taskId=${chat.id}`) as any[]
    if (!Array.isArray(events) || events.length === 0) continue

    // Find the last message
    const messages = events.filter(e => e.type === 'message')
    if (messages.length === 0) continue

    const lastMessage = messages[messages.length - 1]

    // Check if last message is from a human (not from agent)
    if (lastMessage.userType !== 'human') continue

    // Check if we've already seen this message
    const msgKey = `${chat.id}:${lastMessage.id}`
    if (processedChats.has(msgKey)) continue

    // Check if there's already an agent response after this message
    const lastMsgTime = new Date(lastMessage.createdAt).getTime()
    const hasAgentReply = events.some(
      e => e.type === 'message' && e.userType === 'agent' &&
      new Date(e.createdAt).getTime() > lastMsgTime
    )
    if (hasAgentReply) {
      processedChats.add(msgKey)
      continue
    }

    // New unanswered message! Write to stdout for Claude Code to pick up
    console.log(JSON.stringify({
      type: 'new_message',
      chatId: chat.id,
      chatTitle: chat.title,
      messageId: lastMessage.id,
      user: lastMessage.userName,
      content: lastMessage.content,
      timestamp: lastMessage.createdAt,
    }))

    processedChats.add(msgKey)
  }
}

async function main() {
  console.error(`[Hive Monitor] Started — watching for new messages at ${HIVE_URL}`)

  // Subscribe to realtime events
  supabase
    .channel('hive-events')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload: any) => {
      const ev = payload.new
      if (ev.type === 'message') {
        // Check if this is a user message that needs a response
        setTimeout(() => checkForNewMessages(), 500)
      }
    })
    .subscribe()

  // Also poll every 10 seconds as fallback
  setInterval(checkForNewMessages, 10000)

  // Initial check
  await checkForNewMessages()
}

main().catch(console.error)
