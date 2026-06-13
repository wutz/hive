import { createServerFn } from '@tanstack/react-start'
import { getDb } from '#/db'
import { computers, users, channels, channelMembers, messages } from '#/db/schema'
import { eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// Channel operations
export const listChannels = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = getDb()
    return db.select().from(channels)
  })

export const createChannel = createServerFn({ method: 'POST' })
  .validator((data: { name: string; description?: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    return db.insert(channels).values({
      id: nanoid(), name: data.name, description: data.description,
    }).returning().then(r => r[0])
  })

// Message operations
export const getMessages = createServerFn({ method: 'GET' })
  .validator((data: { channelId: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    const result = await db.select({
      id: messages.id,
      content: messages.content,
      createdAt: messages.createdAt,
      userId: messages.userId,
      userName: users.name,
      userType: users.type,
    })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, data.channelId))
      .orderBy(desc(messages.createdAt))
      .limit(data.limit || 50)
    return result.reverse()
  })

export const sendMessage = createServerFn({ method: 'POST' })
  .validator((data: { channelId: string; userId: string; content: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    return db.insert(messages).values({
      id: nanoid(), channelId: data.channelId, userId: data.userId, content: data.content,
    }).returning().then(r => r[0])
  })

// Computer/Agent operations
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

export const joinChannel = createServerFn({ method: 'POST' })
  .validator((data: { channelId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    await db.insert(channelMembers).values({
      id: nanoid(), channelId: data.channelId, userId: data.userId,
    })
    return { ok: true }
  })

export const getChannelMembers = createServerFn({ method: 'GET' })
  .validator((data: { channelId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDb()
    return db.select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      type: users.type,
    })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, data.channelId))
  })

// Initialize with default channel and demo user
export const initializeApp = createServerFn({ method: 'POST' })
  .handler(async () => {
    const db = getDb()

    // Create default channel if none exist
    const existing = await db.select().from(channels)
    if (existing.length === 0) {
      await db.insert(channels).values({
        id: nanoid(), name: 'general', description: 'General discussion',
      })
    }

    // Create demo user if none exist
    const existingUsers = await db.select().from(users)
    if (existingUsers.length === 0) {
      await db.insert(users).values({
        id: nanoid(), name: 'User', type: 'human',
      })
    }

    const allChannels = await db.select().from(channels)
    const allUsers = await db.select({
      id: users.id, name: users.name, type: users.type,
    }).from(users)

    return { channels: allChannels, currentUser: allUsers[0] }
  })
