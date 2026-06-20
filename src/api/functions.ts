import { createServerFn } from '@tanstack/react-start'
import { getSupabase } from '#/db'
import { nanoid } from 'nanoid'

type TaskStatus = 'pending' | 'running' | 'in_review' | 'done'
type EventType = 'message' | 'terminal' | 'diff' | 'status_change'

export const initializeApp = createServerFn({ method: 'POST' })
  .handler(async () => {
    const sb = getSupabase()

    // Ensure a default user exists
    const { data: existingUsers } = await sb.from('users').select('id, name, type').limit(1)
    if (!existingUsers || existingUsers.length === 0) {
      await sb.from('users').insert({ id: nanoid(), name: 'User', type: 'human' })
    }

    const { data: allUsers } = await sb.from('users').select('id, name, type').limit(1)
    return { currentUser: allUsers?.[0] || null }
  })

export const listTasks = createServerFn({ method: 'GET' })
  .validator((data: { status?: TaskStatus }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    let query = sb.from('tasks').select('*').order('created_at', { ascending: false })
    if (data.status) query = query.eq('status', data.status)
    const { data: result } = await query
    return result || []
  })

export const createTask = createServerFn({ method: 'POST' })
  .validator((data: { title: string; description?: string; createdBy: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    const { data: task } = await sb.from('tasks').insert({
      id: nanoid(), title: data.title,
      description: data.description, created_by: data.createdBy,
    }).select().single()
    return task
  })

export const updateTaskStatus = createServerFn({ method: 'POST' })
  .validator((data: { taskId: string; status: TaskStatus; userId: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    await sb.from('tasks').update({ status: data.status, updated_at: new Date().toISOString() }).eq('id', data.taskId)
    await sb.from('events').insert({
      id: nanoid(), task_id: data.taskId, user_id: data.userId,
      type: 'status_change', content: data.status,
    })
    return { ok: true }
  })

export const claimTask = createServerFn({ method: 'POST' })
  .validator((data: { taskId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    await sb.from('tasks').update({ assignee_id: data.userId, status: 'running', updated_at: new Date().toISOString() }).eq('id', data.taskId)
    await sb.from('events').insert({
      id: nanoid(), task_id: data.taskId, user_id: data.userId,
      type: 'status_change', content: 'claimed',
    })
    return { ok: true }
  })

export const getTaskEvents = createServerFn({ method: 'GET' })
  .validator((data: { taskId: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    const { data: result } = await sb.from('events')
      .select('id, type, content, metadata, user_id, created_at, users!inner(name, type, avatar_url)')
      .eq('task_id', data.taskId)
      .order('created_at', { ascending: true })
    return (result || []).map((ev: any) => ({
      id: ev.id,
      type: ev.type,
      content: ev.content,
      metadata: ev.metadata,
      userId: ev.user_id,
      userName: ev.users?.name || 'Unknown',
      userType: ev.users?.type || 'human',
      avatarUrl: ev.users?.avatar_url || null,
      createdAt: ev.created_at,
    }))
  })

export const postEvent = createServerFn({ method: 'POST' })
  .validator((data: { taskId: string; userId: string; type: EventType; content: string; metadata?: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    const { data: event } = await sb.from('events').insert({
      id: nanoid(), task_id: data.taskId, user_id: data.userId,
      type: data.type, content: data.content, metadata: data.metadata,
    }).select().single()
    return event
  })

export const registerComputer = createServerFn({ method: 'POST' })
  .validator((data: { name: string; ownerName: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    const apiKey = `hive_comp_${nanoid(32)}`
    const ownerId = nanoid()
    await sb.from('users').insert({ id: ownerId, name: data.ownerName, type: 'human' })
    const { data: computer } = await sb.from('computers').insert({
      id: nanoid(), name: data.name, api_key: apiKey, owner_id: ownerId,
    }).select().single()
    return { computer: { id: computer!.id, name: computer!.name }, apiKey }
  })

export const createAgent = createServerFn({ method: 'POST' })
  .validator((data: { name: string; computerId: string; computerApiKey: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    const { data: computer } = await sb.from('computers').select('*').eq('api_key', data.computerApiKey).single()
    if (!computer || computer.id !== data.computerId) {
      throw new Error('Invalid computer credentials')
    }
    const agentApiKey = `hive_agent_${nanoid(32)}`
    const { data: agent } = await sb.from('users').insert({
      id: nanoid(), name: data.name, type: 'agent', computer_id: data.computerId, api_key: agentApiKey,
    }).select().single()
    return { agent: { id: agent!.id, name: agent!.name }, apiKey: agentApiKey }
  })

export const listComputers = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sb = getSupabase()
    const { data } = await sb.from('computers').select('id, name, status, last_seen_at')
    return data || []
  })

export const listAgents = createServerFn({ method: 'GET' })
  .handler(async () => {
    const sb = getSupabase()
    const { data } = await sb.from('users')
      .select('id, name, display_name, type, computer_id, avatar_url, created_at')
      .eq('type', 'agent')
      .order('created_at', { ascending: false })
    return data || []
  })

export const addTaskParticipant = createServerFn({ method: 'POST' })
  .validator((data: { taskId: string; userId: string; addedBy?: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    const { data: existing } = await sb.from('task_participants')
      .select('id').eq('task_id', data.taskId).eq('user_id', data.userId).maybeSingle()
    if (existing) return { ok: true, already: true }
    const { data: participant } = await sb.from('task_participants').insert({
      id: nanoid(), task_id: data.taskId, user_id: data.userId,
    }).select().single()
    if (data.addedBy) {
      await sb.from('events').insert({
        id: nanoid(), task_id: data.taskId, user_id: data.addedBy,
        type: 'status_change', content: `added_participant:${data.userId}`,
      })
    }
    return { ok: true, participant: { id: participant!.id } }
  })

export const listTaskParticipants = createServerFn({ method: 'GET' })
  .validator((data: { taskId: string }) => data)
  .handler(async ({ data }) => {
    const sb = getSupabase()
    const { data: result } = await sb.from('task_participants')
      .select('id, task_id, joined_at, users!inner(id, name, display_name, type, avatar_url)')
      .eq('task_id', data.taskId)
      .order('joined_at', { ascending: true })
    return (result || []).map((p: any) => ({
      id: p.id,
      taskId: p.task_id,
      joinedAt: p.joined_at,
      userId: p.users?.id,
      name: p.users?.name,
      displayName: p.users?.display_name,
      type: p.users?.type,
      avatarUrl: p.users?.avatar_url,
    }))
  })
