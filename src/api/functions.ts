import { createServerFn } from '@tanstack/react-start'
import { getDb } from '#/db'
import { computers, users, projects, tasks, events } from '#/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'

type TaskStatus = 'pending' | 'running' | 'in_review' | 'done'
type EventType = 'message' | 'terminal' | 'diff' | 'status_change'

export const initializeApp = createServerFn({ method: 'POST' })
  .handler(async () => {
    const db = getDb()

    const existing = await db.select().from(projects)
    if (existing.length === 0) {
      const projectId = nanoid()
      await db.insert(projects).values({
        id: projectId, name: 'default', description: 'Default project',
      })
    }

    const existingUsers = await db.select().from(users)
    if (existingUsers.length === 0) {
      await db.insert(users).values({
        id: nanoid(), name: 'User', type: 'human',
      })
    }

    const allProjects = await db.select().from(projects)
    const allUsers = await db.select({
      id: users.id, name: users.name, type: users.type,
    }).from(users)

    return { projects: allProjects, currentUser: allUsers[0] }
  })

export const listProjects = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = getDb()
    return db.select().from(projects)
  })

export const createProject = createServerFn({ method: 'POST' })
  .validator((data: { name: string; description?: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    return db.insert(projects).values({
      id: nanoid(), name: data.name, description: data.description,
    }).returning().then(r => r[0])
  })

export const listTasks = createServerFn({ method: 'GET' })
  .validator((data: { projectId: string; status?: TaskStatus }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    const where = data.status
      ? and(eq(tasks.projectId, data.projectId), eq(tasks.status, data.status as TaskStatus))
      : eq(tasks.projectId, data.projectId)
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
    return result
  })

export const createTask = createServerFn({ method: 'POST' })
  .validator((data: { projectId: string; title: string; description?: string; createdBy: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    return db.insert(tasks).values({
      id: nanoid(), projectId: data.projectId, title: data.title,
      description: data.description, createdBy: data.createdBy,
    }).returning().then(r => r[0])
  })

export const updateTaskStatus = createServerFn({ method: 'POST' })
  .validator((data: { taskId: string; status: TaskStatus; userId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    await db.update(tasks).set({ status: data.status, updatedAt: new Date() }).where(eq(tasks.id, data.taskId))
    await db.insert(events).values({
      id: nanoid(), taskId: data.taskId, userId: data.userId,
      type: 'status_change' as EventType, content: data.status,
    })
    return { ok: true }
  })

export const claimTask = createServerFn({ method: 'POST' })
  .validator((data: { taskId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    await db.update(tasks).set({ assigneeId: data.userId, status: 'running', updatedAt: new Date() }).where(eq(tasks.id, data.taskId))
    await db.insert(events).values({
      id: nanoid(), taskId: data.taskId, userId: data.userId,
      type: 'status_change' as EventType, content: 'claimed',
    })
    return { ok: true }
  })

export const getTaskEvents = createServerFn({ method: 'GET' })
  .validator((data: { taskId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    return db.select({
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
      .where(eq(events.taskId, data.taskId))
      .orderBy(events.createdAt)
  })

export const postEvent = createServerFn({ method: 'POST' })
  .validator((data: { taskId: string; userId: string; type: EventType; content: string; metadata?: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    const values: typeof events.$inferInsert = {
      id: nanoid(), taskId: data.taskId, userId: data.userId,
      type: data.type as EventType, content: data.content, metadata: data.metadata,
    }
    return db.insert(events).values(values).returning().then(r => r[0])
  })

export const registerComputer = createServerFn({ method: 'POST' })
  .validator((data: { name: string; ownerName: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    const apiKey = `hive_comp_${nanoid(32)}`
    const ownerId = nanoid()
    await db.insert(users).values({ id: ownerId, name: data.ownerName, type: 'human' })
    const computer = await db.insert(computers).values({
      id: nanoid(), name: data.name, apiKey, ownerId,
    }).returning().then(r => r[0])
    return { computer: { id: computer.id, name: computer.name }, apiKey }
  })

export const createAgent = createServerFn({ method: 'POST' })
  .validator((data: { name: string; computerId: string; computerApiKey: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    const computer = await db.select().from(computers)
      .where(eq(computers.apiKey, data.computerApiKey)).then(r => r[0])
    if (!computer || computer.id !== data.computerId) {
      throw new Error('Invalid computer credentials')
    }
    const agentApiKey = `hive_agent_${nanoid(32)}`
    const agent = await db.insert(users).values({
      id: nanoid(), name: data.name, type: 'agent', computerId: data.computerId, apiKey: agentApiKey,
    }).returning().then(r => r[0])
    return { agent: { id: agent.id, name: agent.name }, apiKey: agentApiKey }
  })

export const listComputers = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = getDb()
    return db.select({
      id: computers.id,
      name: computers.name,
      status: computers.status,
      lastSeenAt: computers.lastSeenAt,
    }).from(computers)
  })
