'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  MoreVertical,
  MapPin,
  User,
  Car,
  Clock,
  DollarSign,
  X,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Ban,
  Eye,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface Order {
  id: string
  orderNumber: string
  pickupAddress: string
  dropoffAddress: string
  distance: number
  estimatedTime: number
  price: number
  finalPrice: number | null
  carClass: 'ECONOMY' | 'COMFORT' | 'BUSINESS' | 'PREMIUM'
  paymentMethod: 'CASH' | 'CARD' | 'WALLET'
  status: 'PENDING' | 'ACCEPTED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  cancelReason: string | null
  createdAt: string
  completedAt: string | null
  client: {
    id: string
    name: string
    phone: string
    avatar: string | null
  }
  driver: {
    id: string
    name: string
    phone: string
    avatar: string | null
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusLabels: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Ожидает', class: 'badge-warning' },
  ACCEPTED: { label: 'Принят', class: 'badge-info' },
  ARRIVED: { label: 'На месте', class: 'badge-info' },
  IN_PROGRESS: { label: 'В пути', class: 'badge-success' },
  COMPLETED: { label: 'Завершён', class: 'badge-success' },
  CANCELLED: { label: 'Отменён', class: 'badge-danger' },
}

const carClassLabels: Record<string, string> = {
  ECONOMY: 'Эконом',
  COMFORT: 'Комфорт',
  BUSINESS: 'Бизнес',
  PREMIUM: 'Премиум',
}

const paymentLabels: Record<string, string> = {
  CASH: 'Наличные',
  CARD: 'Карта',
  WALLET: 'Кошелёк',
}

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)

      const response = await api.get(`/api/admin/orders?${params}`)
      return response.data as { orders: Order[]; pagination: Pagination }
    },
  })

  const cancelOrderMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.patch(`/api/admin/orders/${id}/cancel`, { reason })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      setShowCancelModal(false)
      setSelectedOrder(null)
      setCancelReason('')
    },
  })

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setShowDetailModal(true)
    setMenuOpen(null)
  }

  const handleCancelOrder = (order: Order) => {
    setSelectedOrder(order)
    setShowCancelModal(true)
    setMenuOpen(null)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Заказы</h1>
        <p className="text-gray-500">Управление заказами и поездками</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Поиск по номеру, адресу, клиенту..."
                className="input pl-10"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="input w-auto"
          >
            <option value="">Все статусы</option>
            <option value="PENDING">Ожидает</option>
            <option value="ACCEPTED">Принят</option>
            <option value="ARRIVED">На месте</option>
            <option value="IN_PROGRESS">В пути</option>
            <option value="COMPLETED">Завершён</option>
            <option value="CANCELLED">Отменён</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Заказ</th>
                <th className="table-header">Маршрут</th>
                <th className="table-header">Клиент</th>
                <th className="table-header">Водитель</th>
                <th className="table-header">Сумма</th>
                <th className="table-header">Статус</th>
                <th className="table-header">Дата</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : data?.orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8 text-gray-500">
                    Заказы не найдены
                  </td>
                </tr>
              ) : (
                data?.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium">#{order.orderNumber.slice(-8)}</p>
                        <p className="text-sm text-gray-500">{carClassLabels[order.carClass]}</p>
                      </div>
                    </td>
                    <td className="table-cell max-w-[200px]">
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                          <p className="text-sm truncate">{order.pickupAddress}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                          <p className="text-sm truncate">{order.dropoffAddress}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                          {order.client.avatar ? (
                            <img src={order.client.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{order.client.name}</p>
                          <p className="text-xs text-gray-500">{order.client.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      {order.driver ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                            {order.driver.avatar ? (
                              <img src={order.driver.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Car className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{order.driver.name}</p>
                            <p className="text-xs text-gray-500">{order.driver.phone}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <p className="font-medium">{(order.finalPrice || order.price).toLocaleString()} ₽</p>
                      <p className="text-xs text-gray-500">{paymentLabels[order.paymentMethod]}</p>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${statusLabels[order.status].class}`}>
                        {statusLabels[order.status].label}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 text-sm">
                      {format(new Date(order.createdAt), 'dd.MM.yy HH:mm', { locale: ru })}
                    </td>
                    <td className="table-cell relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === order.id ? null : order.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>

                      <AnimatePresence>
                        {menuOpen === order.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20 min-w-[160px]"
                          >
                            <button
                              onClick={() => handleViewDetails(order)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                              <span>Подробнее</span>
                            </button>
                            {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleCancelOrder(order)}
                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left text-red-500"
                              >
                                <Ban className="w-4 h-4" />
                                <span>Отменить</span>
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Показано {(page - 1) * 20 + 1} - {Math.min(page * 20, data.pagination.total)} из{' '}
              {data.pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={clsx(
                      'w-10 h-10 rounded-lg font-medium',
                      page === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'hover:bg-gray-100'
                    )}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.totalPages}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedOrder && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold">Заказ #{selectedOrder.orderNumber.slice(-8)}</h2>
                    <span className={`badge ${statusLabels[selectedOrder.status].class} mt-1`}>
                      {statusLabels[selectedOrder.status].label}
                    </span>
                  </div>
                  <button onClick={() => setShowDetailModal(false)} className="p-2 -mr-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Route */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-medium mb-3">Маршрут</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Откуда</p>
                          <p className="font-medium">{selectedOrder.pickupAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 mt-1" />
                        <div>
                          <p className="text-sm text-gray-500">Куда</p>
                          <p className="font-medium">{selectedOrder.dropoffAddress}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Navigation className="w-4 h-4" />
                        <span>{selectedOrder.distance.toFixed(1)} км</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>~{selectedOrder.estimatedTime} мин</span>
                      </div>
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-sm text-blue-600 mb-2">Клиент</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          {selectedOrder.client.avatar ? (
                            <img src={selectedOrder.client.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <User className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{selectedOrder.client.name}</p>
                          <p className="text-sm text-gray-500">{selectedOrder.client.phone}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="text-sm text-green-600 mb-2">Водитель</p>
                      {selectedOrder.driver ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            {selectedOrder.driver.avatar ? (
                              <img src={selectedOrder.driver.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <Car className="w-5 h-5 text-green-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{selectedOrder.driver.name}</p>
                            <p className="text-sm text-gray-500">{selectedOrder.driver.phone}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-400">Не назначен</p>
                      )}
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-medium mb-3">Оплата</h4>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500">Способ оплаты</p>
                        <p className="font-medium">{paymentLabels[selectedOrder.paymentMethod]}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Сумма</p>
                        <p className="text-2xl font-bold text-primary-600">
                          {(selectedOrder.finalPrice || selectedOrder.price).toLocaleString()} ₽
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cancel reason */}
                  {selectedOrder.status === 'CANCELLED' && selectedOrder.cancelReason && (
                    <div className="bg-red-50 rounded-xl p-4">
                      <h4 className="font-medium text-red-700 mb-2">Причина отмены</h4>
                      <p className="text-red-600">{selectedOrder.cancelReason}</p>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="text-sm text-gray-500 text-center">
                    <p>Создан: {format(new Date(selectedOrder.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}</p>
                    {selectedOrder.completedAt && (
                      <p>Завершён: {format(new Date(selectedOrder.completedAt), 'd MMMM yyyy, HH:mm', { locale: ru })}</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && selectedOrder && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Отменить заказ</h2>
                  <button onClick={() => setShowCancelModal(false)} className="p-2 -mr-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-gray-600 mb-4">
                  Вы уверены, что хотите отменить заказ #{selectedOrder.orderNumber.slice(-8)}?
                </p>

                <div className="mb-6">
                  <label className="text-sm text-gray-500 mb-1 block">Причина отмены</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="input min-h-[100px] resize-none"
                    placeholder="Укажите причину отмены..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => cancelOrderMutation.mutate({ id: selectedOrder.id, reason: cancelReason })}
                    disabled={cancelOrderMutation.isPending}
                    className="flex-1 bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 disabled:opacity-50"
                  >
                    {cancelOrderMutation.isPending ? 'Отмена...' : 'Отменить заказ'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
