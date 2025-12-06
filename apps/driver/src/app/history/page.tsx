'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Star,
  ChevronRight,
  Car,
  Calendar,
  Clock,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface Order {
  id: string
  orderNumber: string
  pickupAddress: string
  dropoffAddress: string
  distance: number
  duration: number | null
  price: number
  finalPrice: number | null
  carClass: string
  status: string
  createdAt: string
  completedAt: string | null
  client?: {
    id: string
    name: string
    rating: number
  }
}

const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Ожидание', color: 'bg-yellow-100 text-yellow-700' },
  ACCEPTED: { label: 'Принят', color: 'bg-blue-100 text-blue-700' },
  ARRIVED: { label: 'На месте', color: 'bg-purple-100 text-purple-700' },
  IN_PROGRESS: { label: 'В пути', color: 'bg-primary-100 text-primary-700' },
  COMPLETED: { label: 'Завершён', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Отменён', color: 'bg-red-100 text-red-700' },
}

const carClassLabels: Record<string, string> = {
  ECONOMY: 'Эконом',
  COMFORT: 'Комфорт',
  BUSINESS: 'Бизнес',
  PREMIUM: 'Премиум',
}

export default function DriverHistoryPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

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
      fetchOrders()
    }
  }, [isAuthenticated])

  const fetchOrders = async () => {
    try {
      const response = await api.get('/api/drivers/me/orders')
      setOrders(response.data)
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const groupOrdersByDate = (orders: Order[]) => {
    const groups: Record<string, Order[]> = {}

    orders.forEach((order) => {
      const date = formatDate(order.createdAt)
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(order)
    })

    return groups
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const groupedOrders = groupOrdersByDate(orders)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">История поездок</h1>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Car className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Поездок пока нет</h2>
          <p className="text-gray-500 text-center mb-6">
            Выполненные поездки появятся здесь
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-primary"
          >
            Вернуться на главную
          </button>
        </div>
      ) : (
        <div className="pb-6">
          {Object.entries(groupedOrders).map(([date, dateOrders]) => (
            <div key={date}>
              <div className="px-4 py-3 bg-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">{date}</span>
                </div>
              </div>

              <div className="bg-white divide-y divide-gray-100">
                {dateOrders.map((order) => (
                  <motion.button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="w-full px-4 py-4 flex items-start gap-4 text-left hover:bg-gray-50 transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Car className="w-5 h-5 text-primary-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          {formatTime(order.createdAt)}
                        </span>
                        <span className="font-bold text-primary-600">
                          +{order.finalPrice || order.price} ₽
                        </span>
                      </div>

                      <div className="space-y-1 mb-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Navigation className="w-3 h-3 text-green-500 flex-shrink-0" />
                          <span className="truncate">{order.pickupAddress}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                          <span className="truncate">{order.dropoffAddress}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full',
                          statusLabels[order.status]?.color || 'bg-gray-100 text-gray-700'
                        )}>
                          {statusLabels[order.status]?.label || order.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {carClassLabels[order.carClass] || order.carClass}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={() => setSelectedOrder(null)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />

              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-gray-500">Заказ #{selectedOrder.orderNumber}</p>
                  <p className="text-sm text-gray-500">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <span className={clsx(
                  'px-3 py-1 rounded-full text-sm font-medium',
                  statusLabels[selectedOrder.status]?.color || 'bg-gray-100 text-gray-700'
                )}>
                  {statusLabels[selectedOrder.status]?.label || selectedOrder.status}
                </span>
              </div>

              {/* Route */}
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Откуда</p>
                    <p className="font-medium">{selectedOrder.pickupAddress}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Куда</p>
                    <p className="font-medium">{selectedOrder.dropoffAddress}</p>
                  </div>
                </div>
              </div>

              {/* Client info */}
              {selectedOrder.client && (
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-sm text-gray-500 mb-2">Пассажир</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-2xl">👤</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{selectedOrder.client.name}</p>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span>{selectedOrder.client.rating?.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Trip details */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500">Расстояние</p>
                    <p className="font-semibold">{selectedOrder.distance?.toFixed(1)} км</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Время</p>
                    <p className="font-semibold">{selectedOrder.duration || '—'} мин</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Класс</p>
                    <p className="font-semibold">{carClassLabels[selectedOrder.carClass]}</p>
                  </div>
                </div>
              </div>

              {/* Earnings */}
              <div className="flex items-center justify-between p-4 bg-primary-50 rounded-xl mb-6">
                <span className="text-gray-700">Ваш заработок</span>
                <span className="text-2xl font-bold text-primary-600">
                  +{selectedOrder.finalPrice || selectedOrder.price} ₽
                </span>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="btn-secondary w-full"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
