import { useState, useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { initializeApp, getMessages, sendMessage } from '#/api/functions'

export const Route = createFileRoute('/')({
  component: HomePage,
  loader: async () => {
    const init = await initializeApp({})
    return init
  },
})

interface Channel {
  id: string
  name: string
  description: string | null
}

interface Message {
  id: string
  content: string
  createdAt: Date | null
  userId: string
  userName: string
  userType: string
}

function HomePage() {
  const { channels: initialChannels, currentUser } = Route.useLoaderData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [channels] = useState<Channel[]>(initialChannels)
  const [activeChannelId, setActiveChannelId] = useState<string>(initialChannels[0]?.id || '')
  const [msgs, setMsgs] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const activeChannel = channels.find(c => c.id === activeChannelId)

  // Load messages for active channel
  useEffect(() => {
    if (!activeChannelId) return

    const loadMessages = async () => {
      const result = await getMessages({ data: { channelId: activeChannelId } })
      setMsgs(result as Message[])
    }

    loadMessages()

    // Poll for new messages every 2 seconds
    pollRef.current = setInterval(loadMessages, 2000)
    return () => clearInterval(pollRef.current)
  }, [activeChannelId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  const handleSend = async () => {
    if (!input.trim() || !activeChannelId || !currentUser) return

    const content = input.trim()
    setInput('')
    setLoading(true)

    await sendMessage({ data: { channelId: activeChannelId, userId: currentUser.id, content } })
    const result = await getMessages({ data: { channelId: activeChannelId } })
    setMsgs(result as Message[])
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const switchChannel = (channelId: string) => {
    setActiveChannelId(channelId)
    setMsgs([])
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen relative">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-gray-950 border-r border-gray-800 flex flex-col transform transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Hive</h1>
            <p className="text-xs text-gray-400 mt-0.5">Humans & Agents, together</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {channels.map(ch => (
            <ChannelItem
              key={ch.id}
              name={ch.name}
              active={ch.id === activeChannelId}
              onClick={() => switchChannel(ch.id)}
            />
          ))}
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

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-800 flex items-center px-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden mr-3 p-1 text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          </button>
          <span className="text-gray-400 mr-2">#</span>
          <span className="font-medium">{activeChannel?.name || 'general'}</span>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {msgs.length === 0 && (
            <p className="text-center text-gray-500 mt-8">No messages yet. Start the conversation!</p>
          )}
          {msgs.map(msg => (
            <MessageBubble
              key={msg.id}
              sender={msg.userName}
              content={msg.content}
              time={msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              isAgent={msg.userType === 'agent'}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-3 md:p-4 border-t border-gray-800">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={loading}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>
      </main>
    </div>
  )
}

function ChannelItem({ name, active, onClick }: { name: string; active?: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-pointer ${active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
    >
      <span className="text-gray-500">#</span>
      <span>{name}</span>
    </div>
  )
}

function MessageBubble({ sender, content, time, isAgent }: { sender: string; content: string; time: string; isAgent?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${isAgent ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
        {sender[0]}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-sm">{sender}</span>
          {isAgent && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded">Agent</span>}
          <span className="text-xs text-gray-500">{time}</span>
        </div>
        <p className="text-sm text-gray-300 mt-0.5 break-words whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}
