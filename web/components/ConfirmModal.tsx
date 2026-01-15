'use client'

import { AlertCircle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  confirmColor?: 'green' | 'yellow' | 'red' | 'blue'
  isLoading?: boolean
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  confirmColor = 'green',
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null

  const colorClasses = {
    green: 'bg-[#00ff41]/20 hover:bg-[#00ff41]/30 text-[#00ff41] border-[#00ff41]/50 hover:border-[#00ff41]',
    yellow: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/50 hover:border-yellow-500',
    red: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/50 hover:border-red-500',
    blue: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/50 hover:border-blue-500'
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="cyber-card max-w-md w-full animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#00ff41]/20 rounded-lg border border-[#00ff41]/30">
              <AlertCircle className="w-6 h-6 text-[#00ff41]" />
            </div>
            <h2 className="text-xl font-bold gradient-text">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-gray-500/20 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <div className="mb-8 bg-[#1a1a1a] rounded-lg p-4 border border-[#2a2a2a]">
          <p className="text-gray-300 whitespace-pre-line">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border border-gray-500/30 hover:border-gray-500/50 transition-all font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-6 py-2.5 rounded-lg border transition-all font-medium disabled:opacity-50 ${colorClasses[confirmColor]}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
