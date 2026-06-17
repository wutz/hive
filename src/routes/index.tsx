import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { initializeApp, listTasks, createTask, getTaskEvents, postEvent, claimTask, updateTaskStatus } from '#/api/functions'

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async () => {
    try {
      const init = await initializeApp({})
      return init
    } catch {
      return { projects: [], currentUser: null }
    }
  },
})

interface Project {
  id: string
  name: string
  description: string | null
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  assigneeId: string | null
  createdBy: string
  createdAt: Date | null
  updatedAt: Date | null
}

interface Event {
  id: string
  type: string
  content: string
  metadata: string | null
  userId: string
  userName: string
  userType: string
  createdAt: Date | null
}

type Theme = 'light' | 'dark'

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  pending: { label: 'Pending', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  running: { label: 'Running', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  in_review: { label: 'In Review', dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  done: { label: 'Done', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
}

function HomePage() {
  const loaderData = Route.useLoaderData()
  const projects = loaderData?.projects ?? []
  const currentUser = loaderData?.currentUser ?? null

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('hive-theme') as Theme) || 'light'
    }
    return 'light'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || '')
  const [taskList, setTaskList] = useState<Task[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskEvents, setTaskEvents] = useState<Event[]>([])
  const [input, setInput] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showNewTask, setShowNewTask] = useState(false)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const activeProject = projects.find((p: Project) => p.id === activeProjectId)
  const activeTask = taskList.find(t => t.id === activeTaskId)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    if (typeof window !== 'undefined') localStorage.setItem('hive-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!activeProjectId) return
    const load = async () => {
      try {
        const result = await listTasks({ data: { projectId: activeProjectId } })
        setTaskList(result as Task[])
      } catch {}
    }
    load()
    pollRef.current = setInterval(load, 3000)
    return () => clearInterval(pollRef.current)
  }, [activeProjectId])

  useEffect(() => {
    if (!activeTaskId) return
    const load = async () => {
      try {
        const result = await getTaskEvents({ data: { taskId: activeTaskId } })
        setTaskEvents(result as Event[])
      } catch {}
    }
    load()
    const interval = setInterval(load, 2000)
    return () => clearInterval(interval)
  }, [activeTaskId])

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [taskEvents.length])

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !activeProjectId || !currentUser) return
    await createTask({ data: { projectId: activeProjectId, title: newTaskTitle.trim(), createdBy: currentUser.id } })
    setNewTaskTitle('')
    setShowNewTask(false)
    const result = await listTasks({ data: { projectId: activeProjectId } })
    setTaskList(result as Task[])
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !activeTaskId || !currentUser) return
    const content = input.trim()
    setInput('')
    await postEvent({ data: { taskId: activeTaskId, userId: currentUser.id, type: 'message', content } })
    const result = await getTaskEvents({ data: { taskId: activeTaskId } })
    setTaskEvents(result as Event[])
  }

  const handleClaimTask = async (taskId: string) => {
    if (!currentUser) return
    await claimTask({ data: { taskId, userId: currentUser.id } })
    const result = await listTasks({ data: { projectId: activeProjectId } })
    setTaskList(result as Task[])
  }

  const handleUpdateStatus = async (taskId: string, status: string) => {
    if (!currentUser) return
    await updateTaskStatus({ data: { taskId, status: status as 'pending' | 'running' | 'in_review' | 'done', userId: currentUser.id } })
    const result = await listTasks({ data: { projectId: activeProjectId } })
    setTaskList(result as Task[])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (activeTaskId) handleSendMessage()
      else if (showNewTask) handleCreateTask()
    }
  }

  const runningTasks = taskList.filter(t => t.status === 'running')
  const pendingTasks = taskList.filter(t => t.status === 'pending')
  const reviewTasks = taskList.filter(t => t.status === 'in_review')
  const doneTasks = taskList.filter(t => t.status === 'done')

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-60 bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Top nav */}
        <div className="p-3 space-y-0.5">
          <SidebarButton icon="+" label="New Task" onClick={() => { setActiveTaskId(null); setShowNewTask(true); setSidebarOpen(false) }} />
          <SidebarButton icon="Q" label="Search" />
        </div>

        {/* Projects */}
        <div className="px-3 mt-2">
          <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Projects</div>
          {projects.map((p: Project) => (
            <div
              key={p.id}
              onClick={() => { setActiveProjectId(p.id); setActiveTaskId(null); setSidebarOpen(false) }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer mb-0.5 ${p.id === activeProjectId ? 'bg-gray-200/70 dark:bg-gray-800 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}
            >
              <span className="text-gray-400 dark:text-gray-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
              </span>
              <span className="truncate">{p.name}</span>
            </div>
          ))}
        </div>

        {/* Tasks */}
        {activeProjectId && taskList.length > 0 && (
          <div className="flex-1 overflow-y-auto px-3 mt-3">
            {[
              { label: 'Running', tasks: runningTasks },
              { label: 'Pending', tasks: pendingTasks },
              { label: 'In Review', tasks: reviewTasks },
              { label: 'Done', tasks: doneTasks },
            ].map(group => group.tasks.length > 0 && (
              <div key={group.label} className="mb-3">
                <div className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-1">{group.label}</div>
                {group.tasks.map(t => {
                  const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
                  return (
                    <div
                      key={t.id}
                      onClick={() => { setActiveTaskId(t.id); setSidebarOpen(false) }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer mb-0.5 ${t.id === activeTaskId ? 'bg-gray-200/70 dark:bg-gray-800 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="truncate">{t.title}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Bottom */}
        <div className="mt-auto p-3 border-t border-gray-200 dark:border-gray-800 space-y-0.5">
          <SidebarButton
            icon={theme === 'dark' ? '☀' : '☾'}
            label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-gray-500 dark:text-gray-400">
            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] text-white font-medium">
              {currentUser?.name?.[0] || 'U'}
            </div>
            <span className="truncate">{currentUser?.name || 'User'}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 shrink-0 gap-3">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          </button>
          {activeTask && (
            <div className="flex items-center gap-2.5 min-w-0">
              <StatusBadge status={activeTask.status} />
              <span className="text-sm font-medium truncate">{activeTask.title}</span>
            </div>
          )}
        </header>

        {/* Content */}
        {activeTask ? (
          <TaskDetail
            task={activeTask}
            events={taskEvents}
            input={input}
            setInput={setInput}
            onSend={handleSendMessage}
            onClaim={() => handleClaimTask(activeTask.id)}
            onSubmitReview={() => handleUpdateStatus(activeTask.id, 'in_review')}
            onApprove={() => handleUpdateStatus(activeTask.id, 'done')}
            onRequestChanges={() => handleUpdateStatus(activeTask.id, 'running')}
            onKeyDown={handleKeyDown}
            eventsEndRef={eventsEndRef}
          />
        ) : (
          <HomeView
            project={activeProject}
            showNewTask={showNewTask}
            newTaskTitle={newTaskTitle}
            setNewTaskTitle={setNewTaskTitle}
            setShowNewTask={setShowNewTask}
            onCreateTask={handleCreateTask}
            onKeyDown={handleKeyDown}
            taskList={taskList}
            onSelectTask={(id) => setActiveTaskId(id)}
          />
        )}
      </main>
    </div>
  )
}

function SidebarButton({ icon, label, onClick }: { icon: string; label: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer">
      <span className="w-4 text-center text-gray-400 dark:text-gray-500 text-sm">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium ${cfg.text} ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function HomeView({ project, showNewTask, newTaskTitle, setNewTaskTitle, setShowNewTask, onCreateTask, onKeyDown, taskList, onSelectTask }: {
  project?: Project
  showNewTask: boolean
  newTaskTitle: string
  setNewTaskTitle: (v: string) => void
  setShowNewTask: (v: boolean) => void
  onCreateTask: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  taskList: Task[]
  onSelectTask: (id: string) => void
}) {
  if (showNewTask) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <h2 className="text-lg font-semibold mb-4 text-center">New Task</h2>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="What needs to be done?"
              autoFocus
              className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none placeholder-gray-400"
            />
            <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-800">
              <button onClick={onCreateTask} className="px-3 py-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-md font-medium">Create</button>
              <button onClick={() => { setShowNewTask(false); setNewTaskTitle('') }} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold mb-6">What should we work on?</h1>
      <div className="w-full max-w-xl">
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newTaskTitle.trim()) { setShowNewTask(false); onCreateTask() } }}
            placeholder="Describe a task..."
            className="w-full bg-transparent px-4 py-3.5 text-sm focus:outline-none placeholder-gray-400"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowNewTask(true)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">+</button>
            </div>
            <button
              onClick={() => { if (newTaskTitle.trim()) { setShowNewTask(false); onCreateTask() } }}
              className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
            </button>
          </div>
        </div>
        {project && (
          <div className="mt-2 text-center text-xs text-gray-400">
            Working in <span className="font-medium text-gray-500 dark:text-gray-400">{project.name}</span>
          </div>
        )}
      </div>

      {/* Task list below */}
      {taskList.length > 0 && (
        <div className="w-full max-w-xl mt-8 space-y-1.5">
          {taskList.map(t => {
            const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending
            return (
              <div
                key={t.id}
                onClick={() => onSelectTask(t.id)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer transition-colors bg-white dark:bg-gray-900"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <span className="text-sm flex-1 truncate">{t.title}</span>
                <span className={`text-[11px] ${cfg.text}`}>{cfg.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TaskDetail({ task, events, input, setInput, onSend, onClaim, onSubmitReview, onApprove, onRequestChanges, onKeyDown, eventsEndRef }: {
  task: Task
  events: Event[]
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onClaim: () => void
  onSubmitReview: () => void
  onApprove: () => void
  onRequestChanges: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  eventsEndRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
        {task.description && (
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-300 mb-4">
            {task.description}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mb-4">
          {task.status === 'pending' && (
            <ActionButton onClick={onClaim} color="blue">Claim Task</ActionButton>
          )}
          {task.status === 'running' && (
            <ActionButton onClick={onSubmitReview} color="violet">Submit for Review</ActionButton>
          )}
          {task.status === 'in_review' && (
            <>
              <ActionButton onClick={onApprove} color="green">Approve</ActionButton>
              <ActionButton onClick={onRequestChanges} color="gray">Request Changes</ActionButton>
            </>
          )}
        </div>

        {events.length === 0 && (
          <p className="text-center text-gray-400 mt-8 text-sm">No activity yet.</p>
        )}
        {events.map(ev => (
          <EventItem key={ev.id} event={ev} />
        ))}
        <div ref={eventsEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 md:p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message..."
            className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none placeholder-gray-400"
          />
          <div className="flex items-center justify-end px-3 py-1.5 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={onSend}
              className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ActionButton({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500 hover:bg-blue-600 text-white',
    violet: 'bg-violet-500 hover:bg-violet-600 text-white',
    green: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    gray: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200',
  }
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs rounded-md font-medium ${colors[color] || colors.gray}`}>
      {children}
    </button>
  )
}

function EventItem({ event }: { event: Event }) {
  const time = event.createdAt ? new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const isAgent = event.userType === 'agent'

  if (event.type === 'status_change') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
        <span>{event.userName} changed status to <strong className="text-gray-500 dark:text-gray-400">{event.content}</strong></span>
        <span className="ml-auto">{time}</span>
      </div>
    )
  }

  if (event.type === 'terminal') {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <span className="text-[10px] text-gray-500 font-mono">Terminal</span>
          <span className="text-[10px] text-gray-400 ml-auto">{time}</span>
        </div>
        <pre className="p-3 text-xs text-gray-800 dark:text-green-400 bg-gray-50 dark:bg-gray-950 font-mono overflow-x-auto whitespace-pre-wrap">{event.content}</pre>
      </div>
    )
  }

  if (event.type === 'diff') {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <span className="text-[10px] text-gray-500 font-mono">Code Changes</span>
          <span className="text-[10px] text-gray-400 ml-auto">{time}</span>
        </div>
        <pre className="p-3 text-xs bg-gray-50 dark:bg-gray-950 font-mono overflow-x-auto whitespace-pre-wrap">
          {event.content.split('\n').map((line, i) => (
            <span key={i} className={line.startsWith('+') ? 'text-emerald-600 dark:text-green-400' : line.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}>
              {line}{'\n'}
            </span>
          ))}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 text-white ${isAgent ? 'bg-emerald-500' : 'bg-orange-500'}`}>
        {event.userName[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-sm">{event.userName}</span>
          {isAgent && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">Agent</span>}
          <span className="text-xs text-gray-400">{time}</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 break-words whitespace-pre-wrap">{event.content}</p>
      </div>
    </div>
  )
}
