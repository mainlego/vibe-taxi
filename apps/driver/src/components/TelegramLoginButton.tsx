'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface TelegramLoginButtonProps {
  botName: string
  onAuth: (user: TelegramUser) => void
  buttonSize?: 'large' | 'medium' | 'small'
  cornerRadius?: number
  requestAccess?: 'write'
  showAvatar?: boolean
  lang?: string
}

declare global {
  interface Window {
    TelegramLoginWidget: {
      dataOnauth: (user: TelegramUser) => void
    }
  }
}

export function TelegramLoginButton({
  botName,
  onAuth,
  buttonSize = 'large',
  cornerRadius = 12,
  requestAccess = 'write',
  showAvatar = true,
  lang = 'ru',
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = useState(false)

  const handleAuth = useCallback((user: TelegramUser) => {
    onAuth(user)
  }, [onAuth])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    // Set up global callback
    window.TelegramLoginWidget = {
      dataOnauth: handleAuth,
    }

    // Create script element
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', buttonSize)
    script.setAttribute('data-radius', cornerRadius.toString())
    script.setAttribute('data-onauth', 'TelegramLoginWidget.dataOnauth(user)')
    script.setAttribute('data-request-access', requestAccess)
    if (!showAvatar) {
      script.setAttribute('data-userpic', 'false')
    }
    script.setAttribute('data-lang', lang)
    script.async = true

    // Append script to container
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(script)
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [isMounted, botName, buttonSize, cornerRadius, requestAccess, showAvatar, lang, handleAuth])

  // Don't render anything on the server to avoid hydration mismatch
  if (!isMounted) {
    return (
      <div className="flex justify-center h-10">
        <div className="animate-pulse bg-gray-200 rounded-xl w-48 h-10" />
      </div>
    )
  }

  return <div ref={containerRef} className="flex justify-center" />
}
