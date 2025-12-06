'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  BellOff,
  Car,
  Star,
  Gift,
  Info,
  CheckCircle,
  Trash2,
  AlertCircle,
  CreditCard,
  XCircle,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  data?: Record<string, any>
}

// Map API notification types to UI types
const getNotificationType = (type: string): 'trip' | 'promo' | 'rating' | 'system' | 'payment' | 'cancel' => {
  switch (type) {
    case 'ORDER_ACCEPTED':
    case 'DRIVER_ARRIVED':
    case 'TRIP_STARTED':
    case 'TRIP_COMPLETED':
      return 'trip'
    case 'ORDER_CANCELLED':
      return 'cancel'
    case 'PAYMENT_SUCCESS':
    case 'PAYMENT_FAILED':
      return 'payment'
    case 'PROMO':
      return 'promo'
    default:
      return 'system'
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications()
    }
  }, [isAuthenticated])

  const fetchNotifications = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await api.get('/api/notifications')
      setNotifications(response.data)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
      setError('Не удалось загрузить уведомления')
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      )
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.patch('/api/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/api/notifications/${id}`)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const getIcon = (type: string) => {
    const uiType = getNotificationType(type)
    switch (uiType) {
      case 'trip':
        return <Car className="w-5 h-5 text-blue-500" />
      case 'promo':
        return <Gift className="w-5 h-5 text-purple-500" />
      case 'rating':
        return <Star className="w-5 h-5 text-yellow-500" />
      case 'payment':
        return <CreditCard className="w-5 h-5 text-green-500" />
      case 'cancel':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'system':
      default:
        return <Info className="w-5 h-5 text-gray-500" />
    }
  }

  const getIconBg = (type: string) => {
    const uiType = getNotificationType(type)
    switch (uiType) {
      case 'trip':
        return 'bg-blue-100'
      case 'promo':
        return 'bg-purple-100'
      case 'rating':
        return 'bg-yellow-100'
      case 'payment':
        return 'bg-green-100'
      case 'cancel':
        return 'bg-red-100'
      case 'system':
      default:
        return 'bg-gray-100'
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000)
      return mins <= 1 ? 'Только что' : `${mins} мин назад`
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours} ч назад`
    } else {
      const days = Math.floor(diff / 86400000)
      return `${days} дн назад`
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Уведомления</h1>
            {unreadCount > 0 && (
              <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-primary-500 text-sm font-medium"
            >
              Прочитать все
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-12 h-12 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-500 text-center mb-4">{error}</p>
          <button
            onClick={fetchNotifications}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium"
          >
            Попробовать снова
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <BellOff className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Нет уведомлений</h2>
          <p className="text-gray-500 text-center">
            Здесь появятся уведомления о поездках, акциях и новостях
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {notifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => markAsRead(notification.id)}
              className={clsx(
                'relative px-4 py-4 flex items-start gap-4 cursor-pointer transition-colors',
                notification.isRead ? 'bg-white' : 'bg-primary-50'
              )}
            >
              {!notification.isRead && (
                <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary-500 rounded-full" />
              )}

              <div className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                getIconBg(notification.type)
              )}>
                {getIcon(notification.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={clsx(
                    'font-medium',
                    !notification.isRead && 'text-gray-900'
                  )}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-gray-400 flex-shrink-0">
                    {formatTime(notification.createdAt)}
                  </p>
                </div>
                <p className="text-sm text-gray-500 mt-1">{notification.body}</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteNotification(notification.id)
                }}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
