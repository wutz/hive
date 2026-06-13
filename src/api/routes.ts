import { getDb } from '#/db'
import { computers, users, channels, channelMembers, messages } from '#/db/schema'
import { eq, desc, and, gt } from 'drizzle-orm'
import { nanoid } from 'nanoid'

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
}

type RouteHandler = (request: Request) => Promise<Response>

const routes: Record<string, RouteHandler> = {
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

  'POST /api/agents': async (request) => {
    const body = await request.json() as { name?: string; computerId?: string }
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '')
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

  'GET /api/channels': async () => {
    const db = getDb()
    const result = await db.select().from(channels)
    return json(result)
  },

  'POST /api/channels': async (request) => {
    const body = await request.json() as { name?: string; description?: string }
    if (!body.name) {
      return json({ error: 'name required' }, { status: 400 })
    }
    const db = getDb()
    const channel = await db.insert(channels).values({
      id: nanoid(), name: body.name, description: body.description,
    }).returning().then(r => r[0])
    return json(channel)
  },

  'POST /api/channels/join': async (request) => {
    const body = await request.json() as { channelId?: string; userId?: string }
    if (!body.channelId || !body.userId) {
      return json({ error: 'channelId and userId required' }, { status: 400 })
    }
    const db = getDb()
    await db.insert(channelMembers).values({
      id: nanoid(), channelId: body.channelId, userId: body.userId,
    })
    return json({ ok: true })
  },

  'POST /api/messages': async (request) => {
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '')
    const body = await request.json() as { channelId?: string; content?: string; userId?: string }
    const db = getDb()

    let userId = body.userId
    if (apiKey && !userId) {
      const user = await db.select().from(users)
        .where(eq(users.apiKey, apiKey)).then(r => r[0])
      if (!user) return json({ error: 'Invalid credentials' }, { status: 401 })
      userId = user.id
    }
    if (!body.channelId || !body.content || !userId) {
      return json({ error: 'channelId, content, and userId/auth required' }, { status: 400 })
    }
    const message = await db.insert(messages).values({
      id: nanoid(), channelId: body.channelId, userId, content: body.content,
    }).returning().then(r => r[0])
    return json(message)
  },

  'GET /api/messages': async (request) => {
    const url = new URL(request.url)
    const channelId = url.searchParams.get('channelId')
    const after = url.searchParams.get('after')
    const limit = Number(url.searchParams.get('limit') || '50')
    if (!channelId) {
      return json({ error: 'channelId required' }, { status: 400 })
    }
    const db = getDb()
    const result = await db.select({
      id: messages.id,
      content: messages.content,
      createdAt: messages.createdAt,
      userId: messages.userId,
      userName: users.name,
      userType: users.type,
      userDisplayName: users.displayName,
    })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(
        after
          ? and(eq(messages.channelId, channelId), gt(messages.id, after))
          : eq(messages.channelId, channelId)
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit)
    return json(result.reverse())
  },

  'GET /api/channels/members': async (request) => {
    const url = new URL(request.url)
    const channelId = url.searchParams.get('channelId')
    if (!channelId) {
      return json({ error: 'channelId required' }, { status: 400 })
    }
    const db = getDb()
    const result = await db.select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      type: users.type,
    })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, channelId))
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
