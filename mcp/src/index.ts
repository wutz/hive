#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const HIVE_URL = process.env.HIVE_URL || 'https://hive.wutz.workers.dev'
const HIVE_API_KEY = process.env.HIVE_API_KEY || ''
const HIVE_AGENT_ID = process.env.HIVE_AGENT_ID || ''

async function hiveApi(method: string, path: string, body?: unknown) {
  const url = `${HIVE_URL}${path}`
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'hive-mcp/0.1.0',
  }
  if (HIVE_API_KEY) headers['authorization'] = `Bearer ${HIVE_API_KEY}`

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Hive API error (${res.status}): ${text.slice(0, 200)}`)
  }
}

const server = new McpServer({
  name: 'hive',
  version: '0.2.0',
})

// List all chats
server.tool(
  'hive_list_chats',
  'List all chats in Hive, optionally filtered by status',
  {
    status: z.enum(['pending', 'running', 'in_review', 'done']).optional().describe('Filter by status'),
  },
  async ({ status }) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    const query = params.toString() ? `?${params}` : ''
    const chats = await hiveApi('GET', `/api/tasks${query}`)
    return { content: [{ type: 'text', text: JSON.stringify(chats, null, 2) }] }
  }
)

// Get chat events (the conversation history)
server.tool(
  'hive_get_chat_events',
  'Get the full conversation history for a chat (messages, terminal output, diffs, status changes)',
  {
    chatId: z.string().describe('Chat ID'),
  },
  async ({ chatId }) => {
    const events = await hiveApi('GET', `/api/events?taskId=${chatId}`)
    return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] }
  }
)

// Respond to a chat (post a message as the agent)
server.tool(
  'hive_respond',
  'Post a response message to a chat as the agent. Use this to reply to user questions.',
  {
    chatId: z.string().describe('Chat ID to respond to'),
    content: z.string().describe('The response message content'),
  },
  async ({ chatId, content }) => {
    const event = await hiveApi('POST', '/api/events', {
      taskId: chatId,
      type: 'message',
      content,
    })
    return { content: [{ type: 'text', text: `Message posted to chat ${chatId}` }] }
  }
)

// Post terminal output to a chat
server.tool(
  'hive_post_terminal',
  'Post terminal command output to a chat',
  {
    chatId: z.string().describe('Chat ID'),
    content: z.string().describe('Terminal output content'),
  },
  async ({ chatId, content }) => {
    const event = await hiveApi('POST', '/api/events', {
      taskId: chatId,
      type: 'terminal',
      content,
    })
    return { content: [{ type: 'text', text: `Terminal output posted to chat ${chatId}` }] }
  }
)

// Post code diff to a chat
server.tool(
  'hive_post_diff',
  'Post code changes/diff to a chat',
  {
    chatId: z.string().describe('Chat ID'),
    content: z.string().describe('Diff content (unified diff format)'),
  },
  async ({ chatId, content }) => {
    const event = await hiveApi('POST', '/api/events', {
      taskId: chatId,
      type: 'diff',
      content,
    })
    return { content: [{ type: 'text', text: `Code diff posted to chat ${chatId}` }] }
  }
)

// Create a new chat
server.tool(
  'hive_create_chat',
  'Create a new chat in Hive',
  {
    title: z.string().describe('Chat title'),
    description: z.string().optional().describe('Chat description'),
  },
  async ({ title, description }) => {
    const chat = await hiveApi('POST', '/api/tasks', { title, description })
    return { content: [{ type: 'text', text: JSON.stringify(chat, null, 2) }] }
  }
)

// Claim a chat (set to running, assign to agent)
server.tool(
  'hive_claim_chat',
  'Claim a chat — sets status to running and assigns it to you',
  {
    chatId: z.string().describe('Chat ID to claim'),
  },
  async ({ chatId }) => {
    const result = await hiveApi('POST', '/api/tasks/claim', { taskId: chatId })
    return { content: [{ type: 'text', text: `Chat ${chatId} claimed` }] }
  }
)

// Complete a chat (set to done)
server.tool(
  'hive_complete_chat',
  'Mark a chat as done',
  {
    chatId: z.string().describe('Chat ID'),
  },
  async ({ chatId }) => {
    const result = await hiveApi('POST', '/api/tasks/status', { taskId: chatId, status: 'done' })
    return { content: [{ type: 'text', text: `Chat ${chatId} marked as done` }] }
  }
)

// List computers
server.tool(
  'hive_list_computers',
  'List all registered computers',
  {},
  async () => {
    const computers = await hiveApi('GET', '/api/computers')
    return { content: [{ type: 'text', text: JSON.stringify(computers, null, 2) }] }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
