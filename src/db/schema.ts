import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const computers = pgTable('computers', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: text('name').notNull(),
  apiKey: text('api_key').notNull().unique(),
  ownerId: varchar('owner_id', { length: 32 }).notNull(),
  status: text('status', { enum: ['online', 'offline'] }).notNull().default('offline'),
  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  type: text('type', { enum: ['human', 'agent'] }).notNull(),
  computerId: varchar('computer_id', { length: 32 }).references(() => computers.id),
  apiKey: text('api_key').unique(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const projects = pgTable('projects', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 32 }).primaryKey(),
  projectId: varchar('project_id', { length: 32 }).references(() => projects.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['pending', 'running', 'in_review', 'done'] }).notNull().default('pending'),
  assigneeId: varchar('assignee_id', { length: 32 }).references(() => users.id),
  createdBy: varchar('created_by', { length: 32 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const events = pgTable('events', {
  id: varchar('id', { length: 32 }).primaryKey(),
  taskId: varchar('task_id', { length: 32 }).notNull().references(() => tasks.id),
  userId: varchar('user_id', { length: 32 }).notNull().references(() => users.id),
  type: text('type', { enum: ['message', 'terminal', 'diff', 'status_change'] }).notNull(),
  content: text('content').notNull(),
  metadata: text('metadata'), // JSON string for additional data
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const projectMembers = pgTable('project_members', {
  id: varchar('id', { length: 32 }).primaryKey(),
  projectId: varchar('project_id', { length: 32 }).notNull().references(() => projects.id),
  userId: varchar('user_id', { length: 32 }).notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'member'] }).notNull().default('member'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
})

// Legacy tables - will be removed after migration
export const channels = pgTable('channels', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const channelMembers = pgTable('channel_members', {
  id: varchar('id', { length: 32 }).primaryKey(),
  channelId: varchar('channel_id', { length: 32 }).notNull().references(() => channels.id),
  userId: varchar('user_id', { length: 32 }).notNull().references(() => users.id),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
})

export const messages = pgTable('messages', {
  id: varchar('id', { length: 32 }).primaryKey(),
  channelId: varchar('channel_id', { length: 32 }).notNull().references(() => channels.id),
  userId: varchar('user_id', { length: 32 }).notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
