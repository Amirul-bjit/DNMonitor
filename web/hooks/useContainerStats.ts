'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { ContainerStats } from '@/lib/api'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8080'

interface UseContainerStatsOptions {
  containerName: string
  enabled?: boolean
}

export function useContainerStats({ containerName, enabled = true }: UseContainerStatsOptions) {
  const [stats, setStats] = useState<ContainerStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!enabled || !containerName) {
      return
    }

    // Get token from localStorage
    const token = localStorage.getItem('authToken')
    if (!token) {
      setError('No authentication token found')
      return
    }

    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    })

    socketRef.current = socket

    // Socket event handlers
    socket.on('connect', () => {
      console.log('[Socket] Connected to WebSocket server')
      setIsConnected(true)
      setError(null)
      
      // Subscribe to container stats
      socket.emit('subscribe:container:stats', { containerName })
    })

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from WebSocket server')
      setIsConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
      setError(`Connection error: ${err.message}`)
      setIsConnected(false)
    })

    socket.on('container:stats', (data: ContainerStats) => {
      setStats(data)
      setError(null)
    })

    socket.on('container:stats:error', (data: { container: string; error: string }) => {
      console.error(`[Socket] Stats error for ${data.container}:`, data.error)
      setError(data.error)
      setStats(null)
    })

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe:container:stats', { containerName })
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [containerName, enabled])

  return { stats, error, isConnected }
}
