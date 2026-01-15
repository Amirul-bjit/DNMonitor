'use client'

import { useState } from 'react'
import { Play, Square, RotateCw, Trash2, Eye, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ConfirmModal from './ConfirmModal'
import { 
  fetchContainerStats, 
  containerAction, 
  deleteContainer,
  Container,
  ContainerStats 
} from '@/lib/api'

interface ContainerCardProps {
  container: Container
  onViewLogs: (container: Container) => void
}

type ConfirmAction = {
  type: 'start' | 'stop' | 'restart' | 'delete'
  title: string
  message: string
  confirmText: string
  color: 'green' | 'yellow' | 'red' | 'blue'
} | null

export default function ContainerCard({ container, onViewLogs }: ContainerCardProps) {
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  // Fetch container stats
  const { 
    data: stats,
    error: statsError 
  } = useQuery<ContainerStats>({
    queryKey: ['containerStats', container.name],
    queryFn: () => fetchContainerStats(container.name),
    enabled: container.state === 'running',
    refetchInterval: container.state === 'running' ? 2000 : false,
  })

  // Container action mutation
  const actionMutation = useMutation({
    mutationFn: ({ action }: { action: 'start' | 'stop' | 'restart' }) => 
      containerAction(container.name, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] })
      setConfirmAction(null)
    },
    onError: (error: Error) => {
      alert(`Action failed: ${error.message}`)
    }
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteContainer(container.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] })
      setConfirmAction(null)
    },
    onError: (error: Error) => {
      alert(`Delete failed: ${error.message}`)
    }
  })

  const handleActionClick = (type: 'start' | 'stop' | 'restart' | 'delete') => {
    const actions = {
      start: {
        type: 'start' as const,
        title: 'START CONTAINER',
        message: `Start ${container.name}?\n\nThe container will be started and begin running.`,
        confirmText: 'Start',
        color: 'green' as const
      },
      stop: {
        type: 'stop' as const,
        title: 'STOP CONTAINER',
        message: `Stop ${container.name}?\n\nThe container will be stopped but not removed.\nYou can start it again later.`,
        confirmText: 'Stop',
        color: 'yellow' as const
      },
      restart: {
        type: 'restart' as const,
        title: 'RESTART CONTAINER',
        message: `Restart ${container.name}?\n\nThe container will be stopped and started again.\nThis may cause brief downtime.`,
        confirmText: 'Restart',
        color: 'blue' as const
      },
      delete: {
        type: 'delete' as const,
        title: 'DELETE CONTAINER',
        message: `⚠️ Are you sure you want to delete ${container.name}?\n\nThis will permanently remove the container and all its volumes.\nThis action cannot be undone.`,
        confirmText: 'Delete Forever',
        color: 'red' as const
      }
    }
    setConfirmAction(actions[type])
  }

  const handleConfirm = () => {
    if (!confirmAction) return

    if (confirmAction.type === 'delete') {
      deleteMutation.mutate()
    } else {
      actionMutation.mutate({ action: confirmAction.type })
    }
  }

  const getContainerIcon = (name: string) => {
    if (name.includes('express')) return { icon: 'EXP', name: 'Express API', color: '#00ff41' }
    if (name.includes('dotnet')) return { icon: 'NET', name: '.NET Core', color: '#00d9ff' }
    if (name.includes('nextjs')) return { icon: 'NXT', name: 'Next.js', color: '#00ffff' }
    if (name.includes('mongodb')) return { icon: 'MDB', name: 'MongoDB', color: '#00ff88' }
    if (name.includes('postgresql')) return { icon: 'PG', name: 'PostgreSQL', color: '#00b4ff' }
    if (name.includes('nginx')) return { icon: 'NGX', name: 'Nginx', color: '#00ff41' }
    if (name.includes('web')) return { icon: 'WEB', name: 'Web App', color: '#ff00ff' }
    if (name.includes('backend')) return { icon: 'API', name: 'Backend', color: '#00ff41' }
    return { icon: 'CNT', name: name, color: '#00ff41' }
  }

  const statusColor = (state: string) => {
    if (state === 'running') return 'bg-green-500 border-green-500 shadow-green-500/50'
    if (state === 'exited') return 'bg-red-500 border-red-500 shadow-red-500/50'
    if (state === 'restarting') return 'bg-yellow-500 border-yellow-500 shadow-yellow-500/50'
    return 'bg-gray-500 border-gray-500'
  }

  const parsePercentage = (percentStr?: string) => {
    return parseFloat(percentStr?.replace('%', '') || '0')
  }

  const containerInfo = getContainerIcon(container.name)
  const isRunning = container.state === 'running'
  const isLoading = actionMutation.isPending || deleteMutation.isPending

  return (
    <div className={`cyber-card hover:border-[#00ff41]/50 transition-all ${isRunning ? 'border-[#00ff41]/30' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg"
            style={{
              backgroundColor: containerInfo.color,
              boxShadow: isRunning ? `0 0 20px ${containerInfo.color}` : 'none'
            }}
          >
            {containerInfo.icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{containerInfo.name}</h3>
            <p className="text-xs text-gray-400 font-mono">{container.image}</p>
          </div>
        </div>
        <div className={`status-badge ${statusColor(container.state)}`}>
          {container.state.toUpperCase()}
        </div>
      </div>

      {/* Stats */}
      {statsError && isRunning && (
        <div className="mb-4 pb-4 border-b border-[#2a2a2a]">
          <div className="flex items-center space-x-2 text-red-400 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>Failed to load stats</span>
          </div>
        </div>
      )}
      {stats && isRunning && !statsError && (
        <div className="space-y-3 mb-4 pb-4 border-b border-[#2a2a2a]">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">CPU Usage</span>
              <span
                className="font-bold"
                style={{
                  color: parsePercentage(stats.cpu) > 80 ? '#ff0040' : parsePercentage(stats.cpu) > 50 ? '#ffaa00' : '#00ff41'
                }}
              >
                {stats.cpu}
              </span>
            </div>
            <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(parsePercentage(stats.cpu), 100)}%`,
                  backgroundColor: parsePercentage(stats.cpu) > 80 ? '#ff0040' : parsePercentage(stats.cpu) > 50 ? '#ffaa00' : '#00ff41',
                  boxShadow: `0 0 10px ${parsePercentage(stats.cpu) > 80 ? '#ff0040' : parsePercentage(stats.cpu) > 50 ? '#ffaa00' : '#00ff41'}`
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Memory Usage</span>
              <span
                className="font-bold"
                style={{
                  color: parsePercentage(stats.memory.percent) > 80 ? '#ff0040' : parsePercentage(stats.memory.percent) > 50 ? '#ffaa00' : '#00ff41'
                }}
              >
                {stats.memory.percent}
              </span>
            </div>
            <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(parsePercentage(stats.memory.percent), 100)}%`,
                  backgroundColor: parsePercentage(stats.memory.percent) > 80 ? '#ff0040' : parsePercentage(stats.memory.percent) > 50 ? '#ffaa00' : '#00ff41',
                  boxShadow: `0 0 10px ${parsePercentage(stats.memory.percent) > 80 ? '#ff0040' : parsePercentage(stats.memory.percent) > 50 ? '#ffaa00' : '#00ff41'}`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Ports */}
      {container.ports && container.ports.length > 0 && (
        <div className="mb-4 pb-4 border-b border-[#2a2a2a]">
          <p className="text-xs text-gray-400 font-mono">
            PORTS: {container.ports.map(p => p.public || p.private).filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onViewLogs(container)}
          disabled={isLoading}
          className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-[#00d9ff]/20 hover:bg-[#00d9ff]/30 text-[#00d9ff] border border-[#00d9ff]/30 hover:border-[#00d9ff]/50 transition-all text-sm disabled:opacity-50"
        >
          <Eye className="w-4 h-4" />
          <span>LOGS</span>
        </button>
        {isRunning ? (
          <>
            <button
              onClick={() => handleActionClick('stop')}
              disabled={isLoading}
              className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 hover:border-yellow-500/50 transition-all text-sm disabled:opacity-50"
            >
              <Square className="w-4 h-4" />
              <span>STOP</span>
            </button>
            <button
              onClick={() => handleActionClick('restart')}
              disabled={isLoading}
              className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 transition-all text-sm disabled:opacity-50"
            >
              <RotateCw className="w-4 h-4" />
              <span>RESTART</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => handleActionClick('start')}
            disabled={isLoading}
            className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-[#00ff41]/20 hover:bg-[#00ff41]/30 text-[#00ff41] border border-[#00ff41]/30 hover:border-[#00ff41]/50 transition-all text-sm disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>START</span>
          </button>
        )}
        <button
          onClick={() => handleActionClick('delete')}
          disabled={isLoading}
          className="col-span-2 flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 transition-all text-sm disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
          <span>DELETE</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          confirmColor={confirmAction.color}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
