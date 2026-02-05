'use client'

import { X, RefreshCw, Activity, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useContainerStats } from '@/hooks/useContainerStats'
import { fetchContainerLogs, Container } from '@/lib/api'

interface LogModalProps {
  container: Container
  onClose: () => void
}

export default function LogModal({ container, onClose }: LogModalProps) {
  // Fetch logs
  const { 
    data: logsData,
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchLogs 
  } = useQuery({
    queryKey: ['containerLogs', container.name],
    queryFn: () => fetchContainerLogs(container.name, 100),
  })

  // Use WebSocket for real-time container stats
  const { stats, error: statsError, isConnected } = useContainerStats({
    containerName: container.name,
    enabled: container.state === 'running'
  })

  const logs = logsData?.logs || 'No logs available'

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="cyber-card max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-2xl font-bold gradient-text flex items-center space-x-2">
              <Activity className="w-6 h-6" />
              <span>{container.name}</span>
            </h2>
            <p className="text-sm text-gray-400 font-mono mt-1">{container.image}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Stats */}
        {statsError && container.state === 'running' && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Failed to load stats: {(statsError as unknown as Error).message}</span>
            </div>
          </div>
        )}
        {stats && container.state === 'running' && !statsError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
              <p className="text-xs text-gray-400 mb-1">CPU Usage</p>
              <p className="text-2xl font-bold text-[#00ff41]">{stats.cpu}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
              <p className="text-xs text-gray-400 mb-1">Memory</p>
              <p className="text-2xl font-bold text-[#00d9ff]">{stats.memory.percent}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.memory.used} / {stats.memory.total}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
              <p className="text-xs text-gray-400 mb-1">Network RX</p>
              <p className="text-2xl font-bold text-[#ff00ff]">{stats.network.rx}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
              <p className="text-xs text-gray-400 mb-1">Network TX</p>
              <p className="text-2xl font-bold text-[#ffaa00]">{stats.network.tx}</p>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white">Container Logs</h3>
            <button
              onClick={() => refetchLogs()}
              disabled={logsLoading}
              className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-[#00ff41]/20 hover:bg-[#00ff41]/30 text-[#00ff41] border border-[#00ff41]/30 hover:border-[#00ff41]/50 transition-all text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          
          {logsError ? (
            <div className="flex-1 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-400">Failed to load logs: {(logsError as unknown as Error).message}</p>
                <button
                  onClick={() => refetchLogs()}
                  className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-[#0a0a0a] rounded-lg p-4 overflow-auto border border-[#2a2a2a] font-mono text-sm">
              {logsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#00ff41]" />
                </div>
              ) : (
                <pre className="text-[#00ff41] whitespace-pre-wrap break-words">{logs}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
