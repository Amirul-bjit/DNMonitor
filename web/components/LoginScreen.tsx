'use client'

import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { Lock, User, Eye, EyeOff } from 'lucide-react'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  const { login } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }

    setLoading(true)
    setError('')
    
    const result = await login(username.trim(), password)
    
    setLoading(false)

    if (!result.success) {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505] relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-[#00ff41]/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#00d9ff]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-block mb-6"
          >
            <div className="relative">
              <div className="text-7xl font-bold gradient-text">DN</div>
              <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#00ff41] to-transparent"></div>
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold mb-2 text-white">
            DNMonitor
          </h1>
          <p className="text-gray-400 text-lg">
            Docker Container Management
          </p>
        </div>

        {/* Login Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="cyber-card backdrop-blur-sm bg-[#1a1a1a]/50 border-2"
        >
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="cyber-input pl-12"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="cyber-input pl-12 pr-12"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-[#00ff41] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="cyber-button w-full text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin mr-2"></div>
                  Authenticating...
                </div>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Default credentials hint */}
          <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
            <p className="text-xs text-gray-500 text-center">
              Default: admin / admin123
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center text-sm text-gray-600"
        >
          <p>Secure Docker Container Monitoring Dashboard</p>
        </motion.div>
      </motion.div>
    </div>
  )
}
