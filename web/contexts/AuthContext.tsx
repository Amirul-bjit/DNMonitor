'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

interface User {
  username: string
}

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken')
      const savedUser = localStorage.getItem('user')

      if (token && savedUser) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
          await axios.get(`${API_URL}/auth/verify`)
          setUser(JSON.parse(savedUser))
          setIsAuthenticated(true)
        } catch (error) {
          localStorage.removeItem('authToken')
          localStorage.removeItem('user')
          delete axios.defaults.headers.common['Authorization']
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password,
      })

      const { token, user: userData } = response.data

      localStorage.setItem('authToken', token)
      localStorage.setItem('user', JSON.stringify(userData))
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      setUser(userData)
      setIsAuthenticated(true)

      return { success: true }
    } catch (error: any) {
      console.error('Login error:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed. Please check your credentials.',
      }
    }
  }

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`)
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      delete axios.defaults.headers.common['Authorization']
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
