import { getSupabase } from '#/db'
import { nanoid } from 'nanoid'

type TaskStatus = 'pending' | 'running' | 'in_review' | 'done'
type EventType = 'message' | 'terminal' | 'diff' | 'status_change'

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
}

function getApiKey(request: Request): string | null {
  return request.headers.get('authorization')?.replace('Bearer ', '') || null
}

async function authenticateAgent(request: Request) {
  const apiKey = getApiKey(request)
  if (!apiKey) return null
  const sb = getSupabase()
  const { data } = await sb.from('users').select('*').eq('api_key', apiKey).single()
  return data || null
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  }
}

type RouteHandler = (request: Request) => Promise<Response>

const routes: Record<string, RouteHandler> = {
  // Computer management
  'POST /api/computers': async (request) => {
    const body = await request.json() as { name?: string; ownerName?: string }
    if (!body.name || !body.ownerName) {
      return json({ error: 'name and ownerName required' }, { status: 400 })
    }
    const sb = getSupabase()
    const apiKey = `hive_comp_${nanoid(32)}`
    const ownerId = nanoid()
    await sb.from('users').insert({ id: ownerId, name: body.ownerName, type: 'human' })
    const { data: computer } = await sb.from('computers').insert({
      id: nanoid(), name: body.name, api_key: apiKey, owner_id: ownerId,
    }).select().single()
    return json({ computer: { id: computer!.id, name: computer!.name }, apiKey })
  },

  // Agent management
  'POST /api/agents': async (request) => {
    const body = await request.json() as { name?: string; computerId?: string }
    const apiKey = getApiKey(request)
    if (!body.name || !body.computerId || !apiKey) {
      return json({ error: 'name, computerId, and authorization required' }, { status: 400 })
    }
    const sb = getSupabase()
    const { data: computer } = await sb.from('computers').select('*').eq('api_key', apiKey).single()
    if (!computer || computer.id !== body.computerId) {
      return json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const agentApiKey = `hive_agent_${nanoid(32)}`
    const { data: agent } = await sb.from('users').insert({
      id: nanoid(), name: body.name, type: 'agent', computer_id: body.computerId, api_key: agentApiKey,
    }).select().single()
    return json({ agent: { id: agent!.id, name: agent!.name }, apiKey: agentApiKey })
  },

  // Chat/Task operations (no project dependency)
  'GET /api/tasks': async (request) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') as TaskStatus | null
    const sb = getSupabase()
    let query = sb.from('tasks').select('*').order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) return json({ error: error.message }, { status: 500 })
    return json(data)
  },

  'POST /api/tasks': async (request) => {
    const user = await authenticateAgent(request)
    const body = await request.json() as { title?: string; description?: string; createdBy?: string; projectId?: string }
    const createdBy = user?.id || body.createdBy
    if (!body.title || !createdBy) {
      return json({ error: 'title and createdBy/auth required' }, { status: 400 })
    }
    const sb = getSupabase()
    const { data, error } = await sb.from('tasks').insert({
      id: nanoid(), title: body.title,
      description: body.description, created_by: createdBy,
      project_id: body.projectId || null,
    }).select().single()
    if (error) return json({ error: error.message }, { status: 500 })
    return json(data)
  },

  'POST /api/tasks/claim': async (request) => {
    const user = await authenticateAgent(request)
    const body = await request.json() as { taskId?: string; userId?: string }
    const userId = user?.id || body.userId
    if (!body.taskId || !userId) {
      return json({ error: 'taskId and userId/auth required' }, { status: 400 })
    }
    const sb = getSupabase()
    await sb.from('tasks').update({ assignee_id: userId, status: 'running', updated_at: new Date().toISOString() }).eq('id', body.taskId)
    await sb.from('events').insert({
      id: nanoid(), task_id: body.taskId, user_id: userId,
      type: 'status_change', content: 'claimed',
    })
    return json({ ok: true })
  },

  'POST /api/tasks/status': async (request) => {
    const user = await authenticateAgent(request)
    const body = await request.json() as { taskId?: string; status?: TaskStatus; userId?: string }
    const userId = user?.id || body.userId
    if (!body.taskId || !body.status || !userId) {
      return json({ error: 'taskId, status, and userId/auth required' }, { status: 400 })
    }
    const sb = getSupabase()
    await sb.from('tasks').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', body.taskId)
    await sb.from('events').insert({
      id: nanoid(), task_id: body.taskId, user_id: userId,
      type: 'status_change', content: body.status,
    })
    return json({ ok: true })
  },

  // Event operations
  'GET /api/events': async (request) => {
    const url = new URL(request.url)
    const taskId = url.searchParams.get('taskId')
    if (!taskId) {
      return json({ error: 'taskId required' }, { status: 400 })
    }
    const sb = getSupabase()
    const { data, error } = await sb.from('events')
      .select('id, type, content, metadata, user_id, created_at, users!inner(name, type)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    if (error) return json({ error: error.message }, { status: 500 })
    const result = (data || []).map((ev: any) => ({
      id: ev.id,
      type: ev.type,
      content: ev.content,
      metadata: ev.metadata,
      userId: ev.user_id,
      userName: ev.users?.name || 'Unknown',
      userType: ev.users?.type || 'human',
      createdAt: ev.created_at,
    }))
    return json(result)
  },

  'POST /api/events': async (request) => {
    const user = await authenticateAgent(request)
    const body = await request.json() as { taskId?: string; type?: EventType; content?: string; metadata?: string; userId?: string }
    const userId = user?.id || body.userId
    if (!body.taskId || !body.type || !body.content || !userId) {
      return json({ error: 'taskId, type, content, and userId/auth required' }, { status: 400 })
    }
    const sb = getSupabase()
    const { data, error } = await sb.from('events').insert({
      id: nanoid(), task_id: body.taskId, user_id: userId,
      type: body.type, content: body.content, metadata: body.metadata,
    }).select().single()
    if (error) return json({ error: error.message }, { status: 500 })
    return json(data)
  },

  // Computer listing
  'GET /api/computers': async () => {
    const sb = getSupabase()
    const { data, error } = await sb.from('computers').select('id, name, status, last_seen_at')
    if (error) return json({ error: error.message }, { status: 500 })
    return json(data)
  },
}

export function handleApiRequest(request: Request): Promise<Response> | null {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  if (!path.startsWith('/api/')) return null

  const key = `${method} ${path}`
  const handler = routes[key]
  if (handler) {
    return handler(request).then(res => {
      for (const [k, v] of Object.entries(corsHeaders())) {
        res.headers.set(k, v)
      }
      return res
    })
  }

  return Promise.resolve(json({ error: 'Not found' }, { status: 404 }))
}
