import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { initializeApp, listTasks, createTask, getTaskEvents, postEvent } from '#/api/functions'

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

interface Project { id: string; name: string; description: string | null }
interface Chat { id: string; title: string; description: string | null; status: string; assigneeId: string | null; createdBy: string; createdAt: Date | null; updatedAt: Date | null }
interface ChatEvent { id: string; type: string; content: string; metadata: string | null; userId: string; userName: string; userType: string; createdAt: Date | null }
type Theme = 'light' | 'dark'

function HomePage() {
  const loaderData = Route.useLoaderData()
  const projects = loaderData?.projects ?? []
  const currentUser = loaderData?.currentUser ?? null

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('hive-theme') as Theme) || 'light'
    return 'light'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || '')
  const [chatList, setChatList] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [chatEvents, setChatEvents] = useState<ChatEvent[]>([])
  const [input, setInput] = useState('')
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const activeProject = projects.find((p: Project) => p.id === activeProjectId)
  const activeChat = chatList.find(c => c.id === activeChatId)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    if (typeof window !== 'undefined') localStorage.setItem('hive-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!activeProjectId) return
    const load = async () => {
      try {
        const result = await listTasks({ data: { projectId: activeProjectId } })
        setChatList(result as Chat[])
      } catch {}
    }
    load()
    pollRef.current = setInterval(load, 3000)
    return () => clearInterval(pollRef.current)
  }, [activeProjectId])

  useEffect(() => {
    if (!activeChatId) return
    const load = async () => {
      try {
        const result = await getTaskEvents({ data: { taskId: activeChatId } })
        setChatEvents(result as ChatEvent[])
      } catch {}
    }
    load()
    const interval = setInterval(load, 2000)
    return () => clearInterval(interval)
  }, [activeChatId])

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatEvents.length])

  const handleNewChat = async (title: string) => {
    if (!title.trim() || !activeProjectId || !currentUser) return
    const chat = await createTask({ data: { projectId: activeProjectId, title: title.trim(), createdBy: currentUser.id } })
    if (chat) {
      const result = await listTasks({ data: { projectId: activeProjectId } })
      setChatList(result as Chat[])
      setActiveChatId((chat as Chat).id)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !activeChatId || !currentUser) return
    const content = input.trim()
    setInput('')
    await postEvent({ data: { taskId: activeChatId, userId: currentUser.id, type: 'message', content } })
    const result = await getTaskEvents({ data: { taskId: activeChatId } })
    setChatEvents(result as ChatEvent[])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-56 bg-gray-50 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-3 space-y-0.5">
          <SidebarItem icon={<IconEdit />} label="New Chat" onClick={() => { setActiveChatId(null); setSidebarOpen(false) }} />
          <SidebarItem icon={<IconSearch />} label="Search" />
        </div>

        {/* Projects */}
        <div className="px-3 mt-1">
          <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-1">Projects</div>
          {projects.map((p: Project) => (
            <div
              key={p.id}
              onClick={() => { setActiveProjectId(p.id); setActiveChatId(null); setSidebarOpen(false) }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer mb-0.5 ${p.id === activeProjectId ? 'bg-gray-200/60 dark:bg-gray-800 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}
            >
              <IconFolder />
              <span className="truncate">{p.name}</span>
            </div>
          ))}
        </div>

        {/* Chats */}
        <div className="flex-1 overflow-y-auto px-3 mt-3">
          <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-1">Chats</div>
          {chatList.map(c => (
            <div
              key={c.id}
              onClick={() => { setActiveChatId(c.id); setSidebarOpen(false) }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer mb-0.5 ${c.id === activeChatId ? 'bg-gray-200/60 dark:bg-gray-800 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}
            >
              <span className="truncate">{c.title}</span>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-0.5">
          <SidebarItem
            icon={theme === 'dark' ? <IconSun /> : <IconMoon />}
            label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
          <SidebarItem icon={<IconSettings />} label="Settings" />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-11 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 shrink-0 gap-3">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          </button>
          {activeChat && (
            <span className="text-sm font-medium truncate">{activeChat.title}</span>
          )}
        </header>

        {/* Content */}
        {activeChat ? (
          <ChatView
            events={chatEvents}
            currentUser={currentUser}
            input={input}
            setInput={setInput}
            onSend={handleSendMessage}
            onKeyDown={handleKeyDown}
            eventsEndRef={eventsEndRef}
          />
        ) : (
          <HomeView
            project={activeProject}
            onNewChat={handleNewChat}
          />
        )}
      </main>
    </div>
  )
}

/* ── Sidebar Components ── */

function SidebarItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer">
      <span className="w-4 h-4 flex items-center justify-center text-gray-400 dark:text-gray-500">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

/* ── Home View (Codex-style centered input) ── */

function HomeView({ project, onNewChat }: { project?: Project; onNewChat: (title: string) => void }) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    if (!value.trim()) return
    onNewChat(value.trim())
    setValue('')
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold mb-8">What should we work on?</h1>
      <div className="w-full max-w-xl">
        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-gray-900">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder="Type anything..."
            className="w-full bg-transparent px-4 py-3.5 text-sm focus:outline-none placeholder-gray-400"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 text-gray-400">
              <span className="text-lg cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">+</span>
            </div>
            <button
              onClick={handleSubmit}
              className="w-7 h-7 rounded-full bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-white text-white dark:text-gray-900 flex items-center justify-center transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
            </button>
          </div>
        </div>
        {project && (
          <div className="mt-3 text-center text-xs text-gray-400">
            Working in <span className="font-medium text-gray-500 dark:text-gray-400">{project.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Chat View (Codex-style chat bubbles) ── */

function ChatView({ events, currentUser, input, setInput, onSend, onKeyDown, eventsEndRef }: {
  events: ChatEvent[]
  currentUser: { id: string; name: string; type: string } | null
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  eventsEndRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 md:px-16 py-6 space-y-4">
        {events.length === 0 && (
          <p className="text-center text-gray-400 mt-12 text-sm">Start the conversation...</p>
        )}
        {events.map(ev => {
          if (ev.type === 'status_change') {
            return (
              <div key={ev.id} className="flex items-center justify-center gap-2 text-xs text-gray-400 py-1">
                <span>{ev.userName} changed status to <strong className="text-gray-500">{ev.content}</strong></span>
              </div>
            )
          }

          const isUser = currentUser && ev.userId === currentUser.id && ev.userType === 'human'
          const isAgent = ev.userType === 'agent'

          if (isUser) {
            return (
              <div key={ev.id} className="flex justify-end">
                <div className="max-w-[75%]">
                  {ev.type === 'message' && (
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tr-md px-4 py-2.5 text-sm">
                      <p className="whitespace-pre-wrap break-words">{ev.content}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          // Agent or other user messages (left-aligned)
          return (
            <div key={ev.id} className="max-w-[85%]">
              {ev.type === 'terminal' ? (
                <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-[10px] text-gray-500 font-mono">Terminal</span>
                  </div>
                  <pre className="p-3 text-xs text-gray-800 dark:text-green-400 bg-gray-50 dark:bg-gray-950 font-mono overflow-x-auto whitespace-pre-wrap">{ev.content}</pre>
                </div>
              ) : ev.type === 'diff' ? (
                <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <span className="text-[10px] text-gray-500 font-mono">Code Changes</span>
                  </div>
                  <pre className="p-3 text-xs bg-gray-50 dark:bg-gray-950 font-mono overflow-x-auto whitespace-pre-wrap">
                    {ev.content.split('\n').map((line, i) => (
                      <span key={i} className={line.startsWith('+') ? 'text-emerald-600 dark:text-green-400' : line.startsWith('-') ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}>{line}{'\n'}</span>
                    ))}
                  </pre>
                </div>
              ) : (
                <>
                  {isAgent && (
                    <div className="text-xs text-gray-400 mb-1">Processed &gt;</div>
                  )}
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                    {ev.content}
                  </div>
                </>
              )}
            </div>
          )
        })}
        <div ref={eventsEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 md:px-16 pb-4 pt-2">
        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask or continue chatting..."
            className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none placeholder-gray-400"
          />
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 text-gray-400">
              <span className="text-lg cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">+</span>
            </div>
            <button
              onClick={onSend}
              className="w-7 h-7 rounded-full bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-white text-white dark:text-gray-900 flex items-center justify-center transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Icons ── */

function IconEdit() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
}
function IconSearch() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}
function IconFolder() {
  return <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
}
function IconSettings() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function IconSun() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
}
function IconMoon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
}
