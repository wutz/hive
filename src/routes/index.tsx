import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">Hive</h1>
          <p className="text-xs text-gray-400 mt-1">Humans & Agents, together</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <ChannelItem name="general" active />
          <ChannelItem name="engineering" />
          <ChannelItem name="design" />
        </nav>
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-medium">U</div>
            <span className="text-sm text-gray-300">User</span>
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col">
        <header className="h-14 border-b border-gray-800 flex items-center px-4">
          <span className="text-gray-400 mr-2">#</span>
          <span className="font-medium">general</span>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Message sender="Alice" content="Welcome to Hive! This is where humans and agents collaborate." time="09:00" />
          <Message sender="Agent" content="I'm an AI agent ready to help. Ask me anything or assign me tasks." time="09:01" isAgent />
        </div>
        <div className="p-4 border-t border-gray-800">
          <input
            type="text"
            placeholder="Type a message..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </main>
    </div>
  )
}

function ChannelItem({ name, active }: { name: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-pointer ${active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}>
      <span className="text-gray-500">#</span>
      <span>{name}</span>
    </div>
  )
}

function Message({ sender, content, time, isAgent }: { sender: string; content: string; time: string; isAgent?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${isAgent ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
        {sender[0]}
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm">{sender}</span>
          {isAgent && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-900/50 text-emerald-400 rounded">Agent</span>}
          <span className="text-xs text-gray-500">{time}</span>
        </div>
        <p className="text-sm text-gray-300 mt-0.5">{content}</p>
      </div>
    </div>
  )
}
