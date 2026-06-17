import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { initializeApp, listTasks, createTask, getTaskEvents, postEvent, claimTask, updateTaskStatus } from '#/api/functions'

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async () => {
    const init = await initializeApp({})
    return init
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

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  running: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-900/30' },
  in_review: { label: 'In Review', color: 'text-purple-400', bg: 'bg-purple-900/30' },
  done: { label: 'Done', color: 'text-green-400', bg: 'bg-green-900/30' },
}

function HomePage() {
  const { projects: initialProjects, currentUser } = Route.useLoaderData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [projects] = useState<Project[]>(initialProjects)
  const [activeProjectId, setActiveProjectId] = useState<string>(initialProjects[0]?.id || '')
  const [taskList, setTaskList] = useState<Task[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskEvents, setTaskEvents] = useState<Event[]>([])
  const [input, setInput] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showNewTask, setShowNewTask] = useState(false)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const activeProject = projects.find(p => p.id === activeProjectId)
  const activeTask = taskList.find(t => t.id === activeTaskId)

  useEffect(() => {
    if (!activeProjectId) return
    const load = async () => {
      const result = await listTasks({ data: { projectId: activeProjectId } })
      setTaskList(result as Task[])
    }
    load()
    pollRef.current = setInterval(load, 3000)
    return () => clearInterval(pollRef.current)
  }, [activeProjectId])

  useEffect(() => {
    if (!activeTaskId) return
    const load = async () => {
      const result = await getTaskEvents({ data: { taskId: activeTaskId } })
      setTaskEvents(result as Event[])
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
      handleSendMessage()
    }
  }

  const pendingTasks = taskList.filter(t => t.status === 'pending')
  const runningTasks = taskList.filter(t => t.status === 'running')
  const reviewTasks = taskList.filter(t => t.status === 'in_review')
  const doneTasks = taskList.filter(t => t.status === 'done')

  return (
    <div className="flex h-screen relative bg-gray-950 text-white">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-gray-950 border-r border-gray-800 flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Hive</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Humans & Agents</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {/* Projects */}
          <div className="p-3">
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Projects</div>
            {projects.map(p => (
              <div
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); setActiveTaskId(null); setSidebarOpen(false) }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-pointer mb-0.5 ${p.id === activeProjectId ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
              >
                <span className="text-gray-500 text-xs">P</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>

          {/* Tasks grouped by status */}
          {activeProjectId && (
            <div className="p-3 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Tasks</div>
                <button onClick={() => setShowNewTask(true)} className="text-gray-500 hover:text-white text-lg leading-none">+</button>
              </div>

              {[
                { label: 'Running', tasks: runningTasks, icon: '●' },
                { label: 'Pending', tasks: pendingTasks, icon: '○' },
                { label: 'In Review', tasks: reviewTasks, icon: '◐' },
                { label: 'Done', tasks: doneTasks, icon: '✓' },
              ].map(group => group.tasks.length > 0 && (
                <div key={group.label} className="mb-3">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{group.label}</div>
                  {group.tasks.map(t => (
                    <div
                      key={t.id}
                      onClick={() => { setActiveTaskId(t.id); setSidebarOpen(false) }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-pointer mb-0.5 ${t.id === activeTaskId ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
                    >
                      <span className="text-xs shrink-0">{group.icon}</span>
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-medium">
              {currentUser?.name?.[0] || 'U'}
            </div>
            <span className="text-sm text-gray-300">{currentUser?.name || 'User'}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-800 flex items-center px-4 shrink-0 gap-3">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          </button>
          {activeTask ? (
            <div className="flex items-center gap-3 min-w-0">
              <StatusBadge status={activeTask.status} />
              <span className="font-medium truncate">{activeTask.title}</span>
            </div>
          ) : (
            <span className="text-gray-400">{activeProject?.name || 'Select a project'}</span>
          )}
        </header>

        {/* Task detail / event timeline */}
        {activeTask ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Task header */}
              {activeTask.description && (
                <div className="p-3 bg-gray-900 rounded-lg border border-gray-800 text-sm text-gray-300 mb-4">
                  {activeTask.description}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mb-4">
                {activeTask.status === 'pending' && (
                  <button onClick={() => handleClaimTask(activeTask.id)} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded font-medium">
                    Claim Task
                  </button>
                )}
                {activeTask.status === 'running' && (
                  <button onClick={() => handleUpdateStatus(activeTask.id, 'in_review')} className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded font-medium">
                    Submit for Review
                  </button>
                )}
                {activeTask.status === 'in_review' && (
                  <>
                    <button onClick={() => handleUpdateStatus(activeTask.id, 'done')} className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 rounded font-medium">
                      Approve
                    </button>
                    <button onClick={() => handleUpdateStatus(activeTask.id, 'running')} className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded font-medium">
                      Request Changes
                    </button>
                  </>
                )}
              </div>

              {/* Events timeline */}
              {taskEvents.length === 0 && (
                <p className="text-center text-gray-500 mt-8">No activity yet.</p>
              )}
              {taskEvents.map(ev => (
                <EventItem key={ev.id} event={ev} />
              ))}
              <div ref={eventsEndRef} />
            </div>

            {/* Message input */}
            <div className="p-3 md:p-4 border-t border-gray-800">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        ) : (
          /* Project overview / new task */
          <div className="flex-1 overflow-y-auto p-6">
            {showNewTask ? (
              <div className="max-w-lg mx-auto mt-12">
                <h2 className="text-lg font-semibold mb-4">New Task</h2>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTask() }}
                  placeholder="What needs to be done?"
                  autoFocus
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 mb-3"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateTask} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded font-medium">
                    Create
                  </button>
                  <button onClick={() => { setShowNewTask(false); setNewTaskTitle('') }} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto mt-12">
                <h2 className="text-xl font-semibold mb-1">{activeProject?.name || 'Hive'}</h2>
                <p className="text-sm text-gray-500 mb-6">{activeProject?.description || 'Select a task or create a new one'}</p>

                <button
                  onClick={() => setShowNewTask(true)}
                  className="w-full p-4 border border-dashed border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 text-sm transition-colors mb-6"
                >
                  + New Task
                </button>

                {taskList.length > 0 && (
                  <div className="space-y-2">
                    {taskList.map(t => (
                      <div
                        key={t.id}
                        onClick={() => setActiveTaskId(t.id)}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 cursor-pointer transition-colors"
                      >
                        <StatusBadge status={t.status} />
                        <span className="text-sm flex-1 truncate">{t.title}</span>
                        <span className="text-xs text-gray-500">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.pending
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  )
}

function EventItem({ event }: { event: Event }) {
  const time = event.createdAt ? new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const isAgent = event.userType === 'agent'

  if (event.type === 'status_change') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600 shrink-0" />
        <span>{event.userName} changed status to <strong className="text-gray-400">{event.content}</strong></span>
        <span className="ml-auto">{time}</span>
      </div>
    )
  }

  if (event.type === 'terminal') {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-800">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800">
          <span className="text-[10px] text-gray-500 font-mono">Terminal</span>
          <span className="text-[10px] text-gray-600 ml-auto">{time}</span>
        </div>
        <pre className="p-3 text-xs text-green-400 bg-gray-950 font-mono overflow-x-auto whitespace-pre-wrap">{event.content}</pre>
      </div>
    )
  }

  if (event.type === 'diff') {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-800">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800">
          <span className="text-[10px] text-gray-500 font-mono">Code Changes</span>
          <span className="text-[10px] text-gray-600 ml-auto">{time}</span>
        </div>
        <pre className="p-3 text-xs bg-gray-950 font-mono overflow-x-auto whitespace-pre-wrap">
          {event.content.split('\n').map((line, i) => (
            <span key={i} className={line.startsWith('+') ? 'text-green-400' : line.startsWith('-') ? 'text-red-400' : 'text-gray-400'}>
              {line}{'\n'}
            </span>
          ))}
        </pre>
      </div>
    )
  }

  // Default: message
  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${isAgent ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
        {event.userName[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-sm">{event.userName}</span>
          {isAgent && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded">Agent</span>}
          <span className="text-xs text-gray-500">{time}</span>
        </div>
        <p className="text-sm text-gray-300 mt-0.5 break-words whitespace-pre-wrap">{event.content}</p>
      </div>
    </div>
  )
}
