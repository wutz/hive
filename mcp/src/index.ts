#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const HIVE_URL = process.env.HIVE_URL || 'https://hive.wutz.workers.dev'
const HIVE_API_KEY = process.env.HIVE_API_KEY || ''

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
  version: '0.1.0',
})

// List projects
server.tool(
  'hive_list_projects',
  'List all projects in Hive',
  {},
  async () => {
    const projects = await hiveApi('GET', '/api/projects')
    return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] }
  }
)

// List tasks for a project
server.tool(
  'hive_list_tasks',
  'List tasks in a Hive project, optionally filtered by status',
  {
    projectId: z.string().describe('Project ID'),
    status: z.enum(['pending', 'running', 'in_review', 'done']).optional().describe('Filter by status'),
  },
  async ({ projectId, status }) => {
    const params = new URLSearchParams({ projectId })
    if (status) params.set('status', status)
    const tasks = await hiveApi('GET', `/api/tasks?${params}`)
    return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] }
  }
)

// Create a task
server.tool(
  'hive_create_task',
  'Create a new task in a Hive project',
  {
    projectId: z.string().describe('Project ID'),
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Task description'),
  },
  async ({ projectId, title, description }) => {
    const task = await hiveApi('POST', '/api/tasks', { projectId, title, description })
    return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] }
  }
)

// Claim a task
server.tool(
  'hive_claim_task',
  'Claim a task — sets status to running and assigns to you',
  {
    taskId: z.string().describe('Task ID to claim'),
  },
  async ({ taskId }) => {
    const result = await hiveApi('POST', '/api/tasks/claim', { taskId })
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

// Update task status
server.tool(
  'hive_update_task_status',
  'Update a task status (pending, running, in_review, done)',
  {
    taskId: z.string().describe('Task ID'),
    status: z.enum(['pending', 'running', 'in_review', 'done']).describe('New status'),
  },
  async ({ taskId, status }) => {
    const result = await hiveApi('POST', '/api/tasks/status', { taskId, status })
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
)

// Get task events
server.tool(
  'hive_get_task_events',
  'Get the event timeline for a task (messages, terminal output, diffs, status changes)',
  {
    taskId: z.string().describe('Task ID'),
  },
  async ({ taskId }) => {
    const events = await hiveApi('GET', `/api/events?taskId=${taskId}`)
    return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] }
  }
)

// Post an event to a task
server.tool(
  'hive_post_event',
  'Post an event to a task timeline (message, terminal output, code diff, or status change)',
  {
    taskId: z.string().describe('Task ID'),
    type: z.enum(['message', 'terminal', 'diff', 'status_change']).describe('Event type'),
    content: z.string().describe('Event content'),
    metadata: z.string().optional().describe('Optional JSON metadata'),
  },
  async ({ taskId, type, content, metadata }) => {
    const event = await hiveApi('POST', '/api/events', { taskId, type, content, metadata })
    return { content: [{ type: 'text', text: JSON.stringify(event, null, 2) }] }
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
