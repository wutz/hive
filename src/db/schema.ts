import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const computers = sqliteTable('computers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  apiKey: text('api_key').notNull().unique(),
  ownerId: text('owner_id').notNull(),
  status: text('status', { enum: ['online', 'offline'] }).notNull().default('offline'),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  type: text('type', { enum: ['human', 'agent'] }).notNull(),
  computerId: text('computer_id').references(() => computers.id),
  apiKey: text('api_key').unique(),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const channelMembers = sqliteTable('channel_members', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => channels.id),
  userId: text('user_id').notNull().references(() => users.id),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => channels.id),
  userId: text('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})
