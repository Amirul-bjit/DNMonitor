'use client'

import { useAuth } from '@/contexts/AuthContext'
import LoginScreen from '@/components/LoginScreen'
import Dashboard from '@/components/Dashboard'
import { useEffect, useState } from 'react'

export default function Home() {
  const { isAuthenticated, loading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00ff41] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#00ff41] text-lg font-medium">Loading DNMonitor...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen">
      {isAuthenticated ? <Dashboard /> : <LoginScreen />}
    </main>
  )
}
