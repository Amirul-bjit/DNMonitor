'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { Container } from '@/lib/api'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8080'

export function useContainers(enabled = true) {
  const [containers, setContainers] = useState<Container[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    // Get token from localStorage
    const token = localStorage.getItem('authToken')
    if (!token) {
      setError('No authentication token found')
      setIsLoading(false)
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
      console.log('[Socket] Connected to WebSocket server for containers')
      setIsConnected(true)
      setError(null)
      
      // Subscribe to containers list
      socket.emit('subscribe:containers')
    })

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from WebSocket server')
      setIsConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message)
      setError(`Connection error: ${err.message}`)
      setIsConnected(false)
      setIsLoading(false)
    })

    socket.on('containers:list', (data: Container[]) => {
      setContainers(data)
      setError(null)
      setIsLoading(false)
    })

    socket.on('containers:error', (data: { error: string }) => {
      console.error(`[Socket] Containers error:`, data.error)
      setError(data.error)
      setContainers([])
      setIsLoading(false)
    })

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe:containers')
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [enabled])

  const refetch = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:containers')
    }
  }

  return { containers, error, isConnected, isLoading, refetch }
}
