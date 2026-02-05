'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import { LogOut, RefreshCw, Power, PowerOff, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ContainerCard from './ContainerCard'
import SystemStats from './SystemStats'
import LogModal from './LogModal'
import { useSystemStats } from '@/hooks/useSystemStats'
import { 
  fetchContainers, 
  composeAction,
  Container 
} from '@/lib/api'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedContainer, setSelectedContainer] = useState<Container | null>(null)
  const [showComposeMenu, setShowComposeMenu] = useState(false)

  // Fetch containers with React Query
  const { 
    data: containers = [], 
    isLoading: containersLoading,
    error: containersError,
    refetch: refetchContainers 
  } = useQuery({
    queryKey: ['containers'],
    queryFn: fetchContainers,
    refetchInterval: autoRefresh ? 5000 : false,
  })

  // Use WebSocket for real-time system stats
  const { 
    stats: systemStats,
    error: systemStatsError 
  } = useSystemStats()

  // Compose action mutation
  const composeMutation = useMutation({
    mutationFn: composeAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] })
    },
    onError: (error: Error) => {
      alert(`Compose action failed: ${error.message}`)
    }
  })

  const handleComposeAction = (action: 'up' | 'down' | 'rebuild') => {
    setShowComposeMenu(false)
    composeMutation.mutate(action)
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[#1a1a1a] border-b border-[#2a2a2a] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div>
              <div className="text-3xl font-bold gradient-text animate-pulse">&gt; DOCKER MONITOR</div>
              <div className="text-sm text-gray-400 mt-1">
                <span className="text-[#00ff41]">[</span>
                BJIT-NETWORK
                <span className="text-[#00ff41]">]</span>
                {' '}{containers.length} ACTIVE CONTAINERS
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${
                  autoRefresh
                    ? 'bg-[#00ff41]/20 border-[#00ff41]/50 text-[#00ff41]'
                    : 'bg-gray-500/20 border-gray-500/50 text-gray-400'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span className="text-xs font-mono">{autoRefresh ? 'AUTO' : 'MANUAL'}</span>
              </button>
              <div className="text-sm text-gray-400">
                Welcome, <span className="text-[#00ff41] font-medium">{user?.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Docker Compose Controls */}
        <div className="mb-6 relative">
          <button
            onClick={() => setShowComposeMenu(!showComposeMenu)}
            className="cyber-button w-full sm:w-auto"
            disabled={composeMutation.isPending}
          >
            {composeMutation.isPending ? 'PROCESSING...' : 'DOCKER COMPOSE ▼'}
          </button>
          {showComposeMenu && (
            <div className="absolute top-full left-0 mt-2 w-full sm:w-80 cyber-card z-30">
              <button
                onClick={() => handleComposeAction('up')}
                disabled={composeMutation.isPending}
                className="w-full px-4 py-3 text-left hover:bg-[#00ff41]/10 border-b border-[#2a2a2a] flex items-center space-x-2 disabled:opacity-50"
              >
                <Power className="w-4 h-4 text-[#00ff41]" />
                <span>▶ START ALL (compose up -d)</span>
              </button>
              <button
                onClick={() => handleComposeAction('rebuild')}
                disabled={composeMutation.isPending}
                className="w-full px-4 py-3 text-left hover:bg-[#00ff41]/10 border-b border-[#2a2a2a] flex items-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 text-[#00d9ff]" />
                <span>🔨 REBUILD (compose up --build -d)</span>
              </button>
              <button
                onClick={() => handleComposeAction('down')}
                disabled={composeMutation.isPending}
                className="w-full px-4 py-3 text-left hover:bg-red-500/10 flex items-center space-x-2 disabled:opacity-50"
              >
                <PowerOff className="w-4 h-4 text-red-400" />
                <span>■ STOP ALL (compose down)</span>
              </button>
            </div>
          )}
        </div>

        {/* System Stats */}
        {systemStatsError ? (
          <div className="cyber-card mb-6 border-red-500/50">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to load system stats: {systemStatsError}</span>
            </div>
          </div>
        ) : systemStats && (
          <SystemStats stats={systemStats} />
        )}

        {/* Containers */}
        {containersError ? (
          <div className="cyber-card border-red-500/50">
            <div className="flex items-center space-x-2 text-red-400 mb-4">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to load containers: {(containersError as Error).message}</span>
            </div>
            <button
              onClick={() => refetchContainers()}
              className="cyber-button"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Retry
            </button>
          </div>
        ) : containersLoading ? (
          <div className="cyber-card text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#00ff41]" />
            <p className="text-gray-400">Loading containers...</p>
          </div>
        ) : containers.length === 0 ? (
          <div className="cyber-card text-center py-8">
            <p className="text-gray-400">No containers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {containers.map((container) => (
              <ContainerCard
                key={container.id}
                container={container}
                onViewLogs={setSelectedContainer}
              />
            ))}
          </div>
        )}
      </main>

      {/* Log Modal */}
      {selectedContainer && (
        <LogModal
          container={selectedContainer}
          onClose={() => setSelectedContainer(null)}
        />
      )}
    </div>
  )
}
