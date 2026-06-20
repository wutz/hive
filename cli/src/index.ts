#!/usr/bin/env node
/**
 * Hive CLI — runs on a computer and acts on behalf of the agents hosted on it.
 *
 * `hive start`
 *   Authenticates this machine as a Hive *computer* (HIVE_API_KEY = a computer
 *   api key, hive_comp_…), marks it online, then watches for:
 *     1. new human messages in any chat that one of this computer's agents is a
 *        participant in, and
 *     2. the moment one of this computer's agents is added to a chat.
 *   When a human message needs a reply, it invokes Claude Code (with the hive
 *   MCP tools configured to post as that specific agent) to draft and post the
 *   reply.
 *
 * Flow on the platform side:
 *   - user registers a computer (gets hive_comp_… key) and runs `hive start` here
 *   - user creates an agent on the platform and picks this computer to host it
 *   - user adds one or more agents into a chat
 *   - this CLI notices and responds
 *
 * Required env:
 *   HIVE_API_KEY  — a COMPUTER api key (hive_comp_…)
 *
 * Optional env:
 *   HIVE_URL          default https://hive.wutz.workers.dev
 *   SUPABASE_URL      default (the Hive project's Supabase URL)
 *   SUPABASE_ANON_KEY default (the Hive project's anon key)
 *   HIVE_CWD          working dir for Claude Code (default process.cwd())
 *   HIVE_CLAUDE_CMD   default "claude"
 *   HIVE_MCP_SCOPE    default "user" — claude mcp add scope (user|project|local)
 */
import { createClient } from '@supabase/supabase-js'
import { spawnSync } from 'child_process'
import { randomUUID } from 'crypto'

const HIVE_URL = (process.env.HIVE_URL || 'https://hive.wutz.workers.dev').replace(/\/$/, '')
const HIVE_API_KEY = process.env.HIVE_API_KEY || ''
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://icbmhwuzmazxwsrcough.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''
const HIVE_CWD = process.env.HIVE_CWD || process.cwd()
const HIVE_CLAUDE_CMD = process.env.HIVE_CLAUDE_CMD || 'claude'
const HIVE_MCP_SCOPE = process.env.HIVE_MCP_SCOPE || 'user'

interface HostedAgent {
  id: string
  name: string
  displayName: string | null
  avatarUrl: string | null
  apiKey: string
}

interface Computer {
  id: string
  name: string
  status: string
}

interface HiveEvent {
  id: string
  type: 'message' | 'terminal' | 'diff' | 'status_change'
  content: string
  metadata: string | null
  userId: string
  userName: string
  userType: 'human' | 'agent'
  avatarUrl: string | null
  createdAt: string
}

interface Participant {
  id: string
  taskId: string
  userId: string
  name: string
  type: string
}

function log(msg: string) {
  process.stdout.write(`[hive] ${msg}\n`)
}

function die(msg: string): never {
  process.stderr.write(`[hive] error: ${msg}\n`)
  process.exit(1)
}

async function computerApi<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${HIVE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'user-agent': 'hive-cli/0.2.0',
      authorization: `Bearer ${HIVE_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Hive API ${method} ${path} returned non-JSON (${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error || `HTTP ${res.status}`
    throw new Error(`Hive API ${method} ${path} failed: ${msg}`)
  }
  return data as T
}

/** Authenticate as a computer and return the computer + the agents it hosts. */
async function authenticateComputer(): Promise<{ computer: Computer; agents: HostedAgent[] }> {
  if (!HIVE_API_KEY) die('HIVE_API_KEY is required (set it to a computer API key, hive_comp_…)')
  const data = await computerApi<{ computer: Computer; agents: HostedAgent[] }>('GET', '/api/computers/me')
  if (!data.computer) die('HIVE_API_KEY is not a valid computer API key')
  return data
}

async function heartbeat(): Promise<void> {
  await computerApi('POST', '/api/computers/heartbeat')
}

/** Events for a chat. */
async function getEvents(taskId: string): Promise<HiveEvent[]> {
  const events = await computerApi<HiveEvent[]>('GET', `/api/events?taskId=${taskId}`)
  return Array.isArray(events) ? events : []
}

/** Participants for a chat — only those whose agent is hosted on this computer. */
async function getMyParticipants(
  taskId: string,
  myAgentIds: Set<string>
): Promise<Participant[]> {
  const parts = await computerApi<Participant[]>('GET', `/api/tasks/participants?taskId=${taskId}`)
  return (Array.isArray(parts) ? parts : []).filter((p) => myAgentIds.has(p.userId))
}

/** Ensure the hive MCP server is registered for Claude Code, posting as `agent`.
 *
 * We register/replace a `hive` MCP entry whose env pins HIVE_API_KEY to this
 * agent, so the hive_get_chat_events / hive_respond / hive_post_* tools post as
 * this specific agent. The MCP server binary is the repo's `hive-mcp` package.
 */
function ensureMcpForAgent(agent: HostedAgent): void {
  const list = spawnSync(HIVE_CLAUDE_CMD, ['mcp', 'list'], { encoding: 'utf-8' })
  if (list.stdout && list.stdout.includes('hive')) {
    spawnSync(HIVE_CLAUDE_CMD, ['mcp', 'remove', 'hive'], { encoding: 'utf-8' })
  }
  spawnSync(
    HIVE_CLAUDE_CMD,
    [
      'mcp', 'add', '--scope', HIVE_MCP_SCOPE,
      '--env', `HIVE_URL=${HIVE_URL},HIVE_API_KEY=${agent.apiKey}`,
      '-t', 'stdio',
      'hive',
      HIVE_MCP_CMD, 'hive-mcp',
    ],
    { encoding: 'utf-8' }
  )
}

const HIVE_MCP_CMD = process.env.HIVE_MCP_CMD || 'npx'

/** Run Claude Code to draft and post a reply in `chatId` as `agent`. */
function respondWithClaude(agent: HostedAgent, chatId: string, triggerContent: string): void {
  // Re-point the hive MCP entry at this agent before invoking, so its tools
  // authenticate as the right agent.
  try {
    ensureMcpForAgent(agent)
  } catch {
    // Non-fatal: user may have a global hive MCP entry already configured.
  }

  const prompt =
    `A user posted a new message in a Hive chat you are participating in: "${triggerContent}".\n` +
    `Use the hive_get_chat_events tool with chatId "${chatId}" to read the full conversation context, ` +
    `then use the hive_respond tool with chatId "${chatId}" to post a concise, helpful reply as ${agent.name}. ` +
    `If you need to run commands or show work, use hive_post_terminal / hive_post_diff. ` +
    `When the task is fully resolved, use hive_complete_chat with chatId "${chatId}".`
  log(`invoking Claude Code for agent "${agent.name}" in ${HIVE_CWD}…`)
  const result = spawnSync(HIVE_CLAUDE_CMD, ['--print', prompt], {
    cwd: HIVE_CWD,
    encoding: 'utf-8',
    timeout: 180000,
  })
  if (result.error) {
    log(`Claude Code failed to run: ${result.error.message}`)
    return
  }
  if (result.status !== 0) {
    log(`Claude Code exited with status ${result.status}`)
    if (result.stderr) log(result.stderr.slice(0, 200))
    return
  }
  log(`agent "${agent.name}" finished: ${(result.stdout || '').slice(0, 100)}`)
}

/** The set of tasks this computer currently cares about (its agents participate in). */
async function discoverTasks(myAgentIds: Set<string>): Promise<Set<string>> {
  if (myAgentIds.size === 0) return new Set()
  // We don't have a direct "tasks for agent" endpoint, so scan via participants.
  // As a practical matter the realtime channel on task_participants notifies us
  // of additions; this is an initial sweep using the events table is not ideal.
  // Instead, list all tasks and filter by participants.
  const tasks = await computerApi<{ id: string; status: string }[]>('GET', '/api/tasks')
  const result = new Set<string>()
  for (const t of Array.isArray(tasks) ? tasks : []) {
    const parts = await getMyParticipants(t.id, myAgentIds)
    if (parts.length > 0) result.add(t.id)
  }
  return result
}

async function start(args: string[]): Promise<void> {
  const listenOnly = hasFlag(args, 'listen-only') || hasFlag(args, 'listen')

  log(`connecting to ${HIVE_URL}`)
  const { computer, agents } = await authenticateComputer()
  log(`authenticated as computer "${computer.name}" (id ${computer.id})`)
  if (agents.length === 0) {
    log('warning: no agents are hosted on this computer yet. Create one on the platform and pick this computer.')
  } else {
    log(`hosting ${agents.length} agent(s): ${agents.map((a) => a.name).join(', ')}`)
  }

  if (!SUPABASE_ANON_KEY) die('SUPABASE_ANON_KEY is required for realtime updates')

  await heartbeat()
  // Keep the computer marked online.
  setInterval(heartbeat, 30000)

  // Map agent userId -> agent record (for resolving who to respond as).
  const agentByUserId = new Map<string, HostedAgent>()
  for (const a of agents) agentByUserId.set(a.id, a)
  const myAgentIds = new Set(agents.map((a) => a.id))

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })

  // Messages already handled (agent id + message id) so we don't reply twice.
  const handled = new Set<string>()

  /** For a chat, find the last unanswered human message and respond with the
   *  appropriate hosted agent. */
  const checkChat = async (taskId: string) => {
    const parts = await getMyParticipants(taskId, myAgentIds)
    if (parts.length === 0) return // none of our agents are in this chat
    const responder = agentByUserId.get(parts[0].userId)
    if (!responder) return

    const events = await getEvents(taskId)
    const messages = events.filter((e) => e.type === 'message')
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.userType !== 'human') return
    if (handled.has(`${responder.id}:${last.id}`)) return

    // Skip if any agent already replied after this human message.
    const lastTime = new Date(last.createdAt).getTime()
    const answered = events.some(
      (e) =>
        e.type === 'message' &&
        e.userType === 'agent' &&
        new Date(e.createdAt).getTime() > lastTime
    )
    if (answered) {
      handled.add(`${responder.id}:${last.id}`)
      return
    }

    const preview = last.content.slice(0, 60)
    log(`chat ${taskId}: new message from ${last.userName}: "${preview}${last.content.length > 60 ? '…' : ''}"`)
    handled.add(`${responder.id}:${last.id}`)

    if (listenOnly) {
      log('(listen-only mode — not auto-responding)')
      return
    }
    try {
      respondWithClaude(responder, taskId, last.content)
    } catch (e) {
      log(`respond failed: ${(e as Error).message}`)
    }
  }

  // Initial sweep over chats our agents are already in.
  const initialTasks = await discoverTasks(myAgentIds)
  for (const taskId of initialTasks) await checkChat(taskId)
  log(`watching ${initialTasks.size} chat(s). Ctrl-C to stop.`)

  // Realtime: new messages in any chat, and new participant additions.
  supabase
    .channel(`hive-computer-${computer.id}-${randomUUID()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events' },
      (payload: { new: { task_id: string; type: string } }) => {
        const ev = payload.new
        if (ev.type === 'message') {
          setTimeout(() => checkChat(ev.task_id), 500)
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'task_participants' },
      (payload: { new: { task_id: string; user_id: string } }) => {
        if (myAgentIds.has(payload.new.user_id)) {
          log(`agent added to chat ${payload.new.task_id}`)
          setTimeout(() => checkChat(payload.new.task_id), 500)
        }
      }
    )
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') log('realtime connected')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
        log(`realtime channel status: ${status}`)
    })

  // Polling fallback.
  setInterval(async () => {
    const tasks = await discoverTasks(myAgentIds)
    for (const taskId of tasks) await checkChat(taskId)
  }, 20000)
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`)
}

function main() {
  const [, , command, ...rest] = process.argv
  if (command === 'start') {
    start(rest).catch((e) => die((e as Error).message))
  } else if (command === '--help' || command === '-h' || !command) {
    process.stdout.write(HELP)
  } else {
    die(`unknown command "${command}". Run: hive --help`)
  }
}

const HELP = `hive — Hive computer/agent CLI

Usage:
  hive start [--listen-only]
    Authenticate this machine as a Hive computer (HIVE_API_KEY = hive_comp_…),
    mark it online, then watch for human messages in chats that any of this
    computer's agents are part of, and auto-respond via Claude Code.

  hive --help
    Show this help.

How it fits together:
  1. Register a computer on the platform (POST /api/computers) → hive_comp_… key.
  2. Run \`hive start\` on that machine with HIVE_API_KEY=<that key>.
  3. On the platform, create an agent and pick this computer to host it.
  4. Add one or more agents into a chat. This CLI will respond for them.

Environment:
  HIVE_API_KEY       (required) COMPUTER api key, hive_comp_…
  HIVE_URL           (optional) Hive API base URL
  SUPABASE_URL       (optional) Supabase project URL for realtime
  SUPABASE_ANON_KEY  (optional) Supabase anon/publishable key
  HIVE_CWD           (optional) working directory for Claude Code (default: cwd)
  HIVE_CLAUDE_CMD    (optional) Claude Code binary (default: claude)
  HIVE_MCP_CMD       (optional) hive MCP server launcher (default: npx)
  HIVE_MCP_SCOPE     (optional) claude mcp add scope (default: user)

Flags:
  --listen-only      Watch and log messages without auto-responding.
`

main()
