'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Crown,
  Search,
  Calendar,
  User,
  Car,
  Clock,
  CheckCircle,
  XCircle,
  Gift,
  Loader2,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface Subscription {
  id: string
  status: string
  startDate: string
  endDate: string
  autoRenew: boolean
  driver: {
    id: string
    user: {
      id: string
      name: string
      phone: string
    }
    carModel: string
    carNumber: string
  }
  plan: {
    id: string
    name: string
    price: number
    durationDays: number
  }
}

interface Driver {
  id: string
  user: {
    id: string
    name: string
    phone: string
  }
  carModel: string
  carNumber: string
}

interface SubscriptionPlan {
  id: string
  name: string
  price: number
  durationDays: number
}

export default function SubscriptionsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [grantDays, setGrantDays] = useState(30)

  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const response = await api.get('/api/admin/subscriptions')
      return response.data
    },
  })

  const { data: drivers } = useQuery<Driver[]>({
    queryKey: ['admin-drivers-for-grant'],
    queryFn: async () => {
      const response = await api.get('/api/admin/drivers')
      return response.data
    },
  })

  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      const response = await api.get('/api/admin/subscription-plans')
      return response.data
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await api.patch(`/api/admin/subscriptions/${subscriptionId}/cancel`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })
    },
  })

  const grantMutation = useMutation({
    mutationFn: async (data: { driverId: string; days: number }) => {
      const response = await api.post('/api/admin/subscriptions/grant', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })
      setShowGrantModal(false)
      setSelectedDriverId('')
      setGrantDays(30)
    },
  })

  const filteredSubscriptions = subscriptions?.filter((sub) => {
    const matchesSearch =
      sub.driver.user.name.toLowerCase().includes(search.toLowerCase()) ||
      sub.driver.user.phone.includes(search) ||
      sub.driver.carNumber.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || sub.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Активна
          </span>
        )
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            Истекла
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Отменена
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            {status}
          </span>
        )
    }
  }

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Подписки</h1>
          <p className="text-gray-500">Управление подписками водителей</p>
        </div>
        <button
          onClick={() => setShowGrantModal(true)}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600"
        >
          <Gift className="w-5 h-5" />
          Выдать подписку
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по имени, телефону или номеру авто..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="expired">Истекшие</option>
            <option value="cancelled">Отмененные</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {subscriptions?.filter((s) => s.status.toLowerCase() === 'active').length || 0}
              </p>
              <p className="text-sm text-gray-500">Активных</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {subscriptions?.filter((s) => s.status.toLowerCase() === 'expired').length || 0}
              </p>
              <p className="text-sm text-gray-500">Истекших</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {subscriptions?.filter((s) => {
                  const days = getDaysRemaining(s.endDate)
                  return s.status.toLowerCase() === 'active' && days <= 7 && days > 0
                }).length || 0}
              </p>
              <p className="text-sm text-gray-500">Истекают скоро</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{subscriptions?.length || 0}</p>
              <p className="text-sm text-gray-500">Всего</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Водитель
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тариф
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Период
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Осталось
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSubscriptions?.map((sub) => {
                const daysRemaining = getDaysRemaining(sub.endDate)
                return (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{sub.driver.user.name}</p>
                          <p className="text-sm text-gray-500">{sub.driver.user.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{sub.plan.name}</p>
                          <p className="text-xs text-gray-500">
                            {sub.driver.carModel} • {sub.driver.carNumber}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <p>
                          {format(new Date(sub.startDate), 'dd.MM.yyyy', { locale: ru })}
                        </p>
                        <p className="text-gray-500">
                          до {format(new Date(sub.endDate), 'dd.MM.yyyy', { locale: ru })}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {sub.status.toLowerCase() === 'active' ? (
                        <span
                          className={clsx(
                            'text-sm font-medium',
                            daysRemaining <= 3
                              ? 'text-red-600'
                              : daysRemaining <= 7
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          )}
                        >
                          {daysRemaining} дней
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(sub.status)}</td>
                    <td className="px-4 py-4 text-right">
                      {sub.status.toLowerCase() === 'active' && (
                        <button
                          onClick={() => {
                            if (confirm('Отменить подписку?')) {
                              cancelMutation.mutate(sub.id)
                            }
                          }}
                          disabled={cancelMutation.isPending}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Отменить
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {(!filteredSubscriptions || filteredSubscriptions.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Подписки не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Выдать подписку</h3>
              <button
                onClick={() => setShowGrantModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Водитель</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Выберите водителя</option>
                  {drivers?.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.user.name} ({driver.user.phone}) - {driver.carNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Количество дней
                </label>
                <input
                  type="number"
                  value={grantDays}
                  onChange={(e) => setGrantDays(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {plans && plans.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    Стандартный тариф: {plans[0].name} - {plans[0].price}₽ за{' '}
                    {plans[0].durationDays} дней
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowGrantModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  onClick={() =>
                    grantMutation.mutate({ driverId: selectedDriverId, days: grantDays })
                  }
                  disabled={!selectedDriverId || grantMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {grantMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Выдаем...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      Выдать
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
