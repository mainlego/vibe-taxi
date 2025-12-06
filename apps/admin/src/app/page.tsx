'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Car,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { api } from '@/lib/api'

interface Stats {
  totalUsers: number
  totalDrivers: number
  activeDrivers: number
  ordersToday: number
  ordersPending: number
  revenueToday: number
  ordersChange: number
  revenueChange: number
}

interface Order {
  id: string
  orderNumber: string
  price: number
  finalPrice: number | null
  status: string
  createdAt: string
  client: {
    name: string
    phone: string
  }
  driver: {
    name: string
    phone: string
  } | null
}

const statusLabels: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Ожидает', class: 'badge-warning' },
  ACCEPTED: { label: 'Принят', class: 'badge-info' },
  ARRIVED: { label: 'На месте', class: 'badge-info' },
  IN_PROGRESS: { label: 'В пути', class: 'badge-success' },
  COMPLETED: { label: 'Завершён', class: 'badge-success' },
  CANCELLED: { label: 'Отменён', class: 'badge-danger' },
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await api.get('/api/admin/stats')
      return response.data as Stats
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-recent-orders'],
    queryFn: async () => {
      const response = await api.get('/api/admin/orders?limit=10')
      return response.data as { orders: Order[] }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-gray-500">Обзор ключевых показателей</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Заказы сегодня"
          value={stats?.ordersToday || 0}
          change={stats?.ordersChange}
          icon={Package}
          color="blue"
          loading={statsLoading}
        />
        <StatCard
          title="Выручка сегодня"
          value={`${((stats?.revenueToday || 0) / 1000).toFixed(1)}K ₽`}
          change={stats?.revenueChange}
          icon={DollarSign}
          color="green"
          loading={statsLoading}
        />
        <StatCard
          title="Водителей онлайн"
          value={stats?.activeDrivers || 0}
          subtitle={`из ${stats?.totalDrivers || 0}`}
          icon={Car}
          color="yellow"
          loading={statsLoading}
        />
        <StatCard
          title="Ожидает водителя"
          value={stats?.ordersPending || 0}
          icon={Clock}
          color="purple"
          loading={statsLoading}
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/users" className="card hover:border-primary-300 transition-colors group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Пользователи</p>
                <p className="text-sm text-gray-500">{stats?.totalUsers || 0} всего</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
          </div>
        </Link>

        <Link href="/drivers" className="card hover:border-primary-300 transition-colors group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">Водители</p>
                <p className="text-sm text-gray-500">{stats?.totalDrivers || 0} всего</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
          </div>
        </Link>

        <Link href="/analytics" className="card hover:border-primary-300 transition-colors group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Аналитика</p>
                <p className="text-sm text-gray-500">Графики и отчёты</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Последние заказы</h2>
          <Link href="/orders" className="text-primary-500 text-sm font-medium flex items-center gap-1 hover:underline">
            Все заказы
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Заказ</th>
                <th className="table-header">Клиент</th>
                <th className="table-header">Водитель</th>
                <th className="table-header">Сумма</th>
                <th className="table-header">Статус</th>
                <th className="table-header">Время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ordersLoading ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-8">
                    <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : ordersData?.orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-8 text-gray-500">
                    Заказов пока нет
                  </td>
                </tr>
              ) : (
                ordersData?.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">#{order.orderNumber.slice(-6)}</td>
                    <td className="table-cell">{order.client.name}</td>
                    <td className="table-cell text-gray-500">
                      {order.driver?.name || '—'}
                    </td>
                    <td className="table-cell font-medium">
                      {(order.finalPrice || order.price).toLocaleString()} ₽
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${statusLabels[order.status]?.class || 'badge-gray'}`}>
                        {statusLabels[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 text-sm">
                      {format(new Date(order.createdAt), 'HH:mm', { locale: ru })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  change,
  subtitle,
  icon: Icon,
  color,
  loading,
}: {
  title: string
  value: string | number
  change?: number
  subtitle?: string
  icon: any
  color: 'blue' | 'green' | 'yellow' | 'purple'
  loading?: boolean
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-gray-200 rounded-lg" />
          <div className="w-16 h-5 bg-gray-200 rounded" />
        </div>
        <div className="w-20 h-8 bg-gray-200 rounded mb-1" />
        <div className="w-24 h-4 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
        {subtitle && (
          <span className="text-sm text-gray-500">{subtitle}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  )
}
