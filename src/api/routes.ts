import { getDb } from '#/db'
import { computers, users, projects, tasks, events } from '#/db/schema'
import { eq, desc, and } from 'drizzle-orm'
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
  const db = getDb()
  return db.select().from(users)
    .where(eq(users.apiKey, apiKey)).then(r => r[0] || null)
}

type RouteHandler = (request: Request) => Promise<Response>

const routes: Record<string, RouteHandler> = {
  // Computer management
  'POST /api/computers': async (request) => {
    const body = await request.json() as { name?: string; ownerName?: string }
    if (!body.name || !body.ownerName) {
      return json({ error: 'name and ownerName required' }, { status: 400 })
    }
    const db = getDb()
    const apiKey = `hive_comp_${nanoid(32)}`
    const ownerId = nanoid()
    await db.insert(users).values({ id: ownerId, name: body.ownerName, type: 'human' })
    const computer = await db.insert(computers).values({
      id: nanoid(), name: body.name, apiKey, ownerId,
    }).returning().then(r => r[0])
    return json({ computer: { id: computer.id, name: computer.name }, apiKey })
  },

  // Agent management
  'POST /api/agents': async (request) => {
    const body = await request.json() as { name?: string; computerId?: string }
    const apiKey = getApiKey(request)
    if (!body.name || !body.computerId || !apiKey) {
      return json({ error: 'name, computerId, and authorization required' }, { status: 400 })
    }
    const db = getDb()
    const computer = await db.select().from(computers)
      .where(eq(computers.apiKey, apiKey)).then(r => r[0])
    if (!computer || computer.id !== body.computerId) {
      return json({ error: 'Invalid credentials' }, { status: 401 })
    }
    const agentApiKey = `hive_agent_${nanoid(32)}`
    const agent = await db.insert(users).values({
      id: nanoid(), name: body.name, type: 'agent', computerId: body.computerId, apiKey: agentApiKey,
    }).returning().then(r => r[0])
    return json({ agent: { id: agent.id, name: agent.name }, apiKey: agentApiKey })
  },

  // Project operations
  'GET /api/projects': async () => {
    const db = getDb()
    const result = await db.select().from(projects)
    return json(result)
  },

  'POST /api/projects': async (request) => {
    const body = await request.json() as { name?: string; description?: string }
    if (!body.name) {
      return json({ error: 'name required' }, { status: 400 })
    }
    const db = getDb()
    const project = await db.insert(projects).values({
      id: nanoid(), name: body.name, description: body.description,
    }).returning().then(r => r[0])
    return json(project)
  },

  // Task operations
  'GET /api/tasks': async (request) => {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('projectId')
    const status = url.searchParams.get('status') as TaskStatus | null
    if (!projectId) {
      return json({ error: 'projectId required' }, { status: 400 })
    }
    const db = getDb()
    const where = status
      ? and(eq(tasks.projectId, projectId), eq(tasks.status, status))
      : eq(tasks.projectId, projectId)
    const result = await db.select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      assigneeId: tasks.assigneeId,
      createdBy: tasks.createdBy,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
      .from(tasks)
      .where(where)
      .orderBy(desc(tasks.createdAt))
    return json(result)
  },

  'POST /api/tasks': async (request) => {
    const user = await authenticateAgent(request)
    const body = await request.json() as { projectId?: string; title?: string; description?: string; createdBy?: string }
    const createdBy = user?.id || body.createdBy
    if (!body.projectId || !body.title || !createdBy) {
      return json({ error: 'projectId, title, and createdBy/auth required' }, { status: 400 })
    }
    const db = getDb()
    const task = await db.insert(tasks).values({
      id: nanoid(), projectId: body.projectId, title: body.title,
      description: body.description, createdBy,
    }).returning().then(r => r[0])
    return json(task)
  },

  'POST /api/tasks/claim': async (request) => {
    const user = await authenticateAgent(request)
    const body = await request.json() as { taskId?: string; userId?: string }
    const userId = user?.id || body.userId
    if (!body.taskId || !userId) {
      return json({ error: 'taskId and userId/auth required' }, { status: 400 })
    }
    const db = getDb()
    await db.update(tasks).set({
      assigneeId: userId, status: 'running' as TaskStatus, updatedAt: new Date(),
    }).where(eq(tasks.id, body.taskId))
    await db.insert(events).values({
      id: nanoid(), taskId: body.taskId, userId,
      type: 'status_change' as EventType, content: 'claimed',
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
    const db = getDb()
    await db.update(tasks).set({ status: body.status, updatedAt: new Date() }).where(eq(tasks.id, body.taskId))
    await db.insert(events).values({
      id: nanoid(), taskId: body.taskId, userId,
      type: 'status_change' as EventType, content: body.status,
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
    const db = getDb()
    const result = await db.select({
      id: events.id,
      type: events.type,
      content: events.content,
      metadata: events.metadata,
      userId: events.userId,
      userName: users.name,
      userType: users.type,
      createdAt: events.createdAt,
    })
      .from(events)
      .innerJoin(users, eq(events.userId, users.id))
      .where(eq(events.taskId, taskId))
      .orderBy(events.createdAt)
    return json(result)
  },

  'POST /api/events': async (request) => {
    const user = await authenticateAgent(request)
    const body = await request.json() as { taskId?: string; type?: EventType; content?: string; metadata?: string; userId?: string }
    const userId = user?.id || body.userId
    if (!body.taskId || !body.type || !body.content || !userId) {
      return json({ error: 'taskId, type, content, and userId/auth required' }, { status: 400 })
    }
    const db = getDb()
    const event = await db.insert(events).values({
      id: nanoid(), taskId: body.taskId, userId,
      type: body.type as EventType, content: body.content, metadata: body.metadata,
    }).returning().then(r => r[0])
    return json(event)
  },

  // Computer listing
  'GET /api/computers': async () => {
    const db = getDb()
    const result = await db.select({
      id: computers.id,
      name: computers.name,
      status: computers.status,
      lastSeenAt: computers.lastSeenAt,
    }).from(computers)
    return json(result)
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
    return handler(request)
  }

  return Promise.resolve(json({ error: 'Not found' }, { status: 404 }))
}
