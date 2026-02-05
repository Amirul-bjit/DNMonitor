'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { SystemStats } from '@/lib/api'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8080'

export function useSystemStats(enabled = true) {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!enabled) {
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
      console.log('[Socket] Connected to WebSocket server for system stats')
      setIsConnected(true)
      setError(null)
      
      // Subscribe to system stats
      socket.emit('subscribe:system:stats')
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

    socket.on('system:stats', (data: SystemStats) => {
      setStats(data)
      setError(null)
    })

    socket.on('system:stats:error', (data: { error: string }) => {
      console.error(`[Socket] System stats error:`, data.error)
      setError(data.error)
      setStats(null)
    })

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe:system:stats')
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [enabled])

  return { stats, error, isConnected }
}
