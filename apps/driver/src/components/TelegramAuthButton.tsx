'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'
import { api } from '@/lib/api'

interface TelegramAuthButtonProps {
  onAuth: (data: {
    id: number
    first_name: string
    last_name?: string
    username?: string
    photo_url?: string
    auth_date: number
    hash: string
  }) => void
  botUsername: string
  role: 'CLIENT' | 'DRIVER'
}

export function TelegramAuthButton({ onAuth, botUsername, role }: TelegramAuthButtonProps) {
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)

  // Generate unique auth token
  const generateAuthToken = useCallback(() => {
    const token = `${role}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    setAuthToken(token)
    return token
  }, [role])

  // Poll for auth result
  useEffect(() => {
    if (!authToken || !isWaiting) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/api/auth/telegram-check?token=${authToken}`)
        const data = response.data

        if (data.success && data.user) {
          clearInterval(pollInterval)
          setIsWaiting(false)
          onAuth(data.user)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 2000) // Poll every 2 seconds

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval)
      setIsWaiting(false)
      setAuthToken(null)
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(pollInterval)
      clearTimeout(timeout)
    }
  }, [authToken, isWaiting, onAuth])

  const handleClick = () => {
    const token = generateAuthToken()
    setIsWaiting(true)

    // Open Telegram bot with deep link
    const telegramUrl = `https://t.me/${botUsername}?start=auth_${token}`
    window.open(telegramUrl, '_blank')
  }

  return (
    <button
      onClick={handleClick}
      disabled={isWaiting}
      className="w-full py-4 bg-[#0088cc] hover:bg-[#0077b5] text-white font-medium rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-70"
    >
      {isWaiting ? (
        <>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Ожидание авторизации...</span>
        </>
      ) : (
        <>
          <Send className="w-5 h-5" />
          <span>Войти через Telegram</span>
        </>
      )}
    </button>
  )
}
