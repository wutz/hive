/**
 * Supabase database types, mirroring src/db/schema.ts.
 *
 * These describe the public schema so the Supabase client's query builders
 * are correctly typed. Regenerate from the live database with
 * `supabase gen types typescript` if the schema drifts.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Relationship = never

export type Database = {
  public: {
    Tables: {
      computers: {
        Row: {
          id: string
          name: string
          api_key: string
          owner_id: string
          status: 'online' | 'offline'
          last_seen_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          api_key: string
          owner_id: string
          status?: 'online' | 'offline'
          last_seen_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          api_key?: string
          owner_id?: string
          status?: 'online' | 'offline'
          last_seen_at?: string | null
          created_at?: string
        }
        Relationships: Relationship[]
      }
      users: {
        Row: {
          id: string
          name: string
          display_name: string | null
          type: 'human' | 'agent'
          computer_id: string | null
          api_key: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name?: string | null
          type: 'human' | 'agent'
          computer_id?: string | null
          api_key?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string | null
          type?: 'human' | 'agent'
          computer_id?: string | null
          api_key?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: Relationship[]
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: Relationship[]
      }
      tasks: {
        Row: {
          id: string
          project_id: string | null
          title: string
          description: string | null
          status: 'pending' | 'running' | 'in_review' | 'done'
          assignee_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          title: string
          description?: string | null
          status?: 'pending' | 'running' | 'in_review' | 'done'
          assignee_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          title?: string
          description?: string | null
          status?: 'pending' | 'running' | 'in_review' | 'done'
          assignee_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: Relationship[]
      }
      events: {
        Row: {
          id: string
          task_id: string
          user_id: string
          type: 'message' | 'terminal' | 'diff' | 'status_change'
          content: string
          metadata: string | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          type: 'message' | 'terminal' | 'diff' | 'status_change'
          content: string
          metadata?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          type?: 'message' | 'terminal' | 'diff' | 'status_change'
          content?: string
          metadata?: string | null
          created_at?: string
        }
        Relationships: Relationship[]
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: 'owner' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
        Relationships: Relationship[]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_type: 'human' | 'agent'
      task_status: 'pending' | 'running' | 'in_review' | 'done'
      event_type: 'message' | 'terminal' | 'diff' | 'status_change'
    }
    CompositeTypes: Record<string, never>
  }
}
