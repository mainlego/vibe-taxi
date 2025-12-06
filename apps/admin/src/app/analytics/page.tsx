'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  TrendingUp,
  Package,
  DollarSign,
  Users,
  Car,
  Calendar,
  ArrowUp,
  ArrowDown,
  MapPin,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await api.get('/api/admin/stats')
      return response.data
    },
  })

  const { data: ordersData } = useQuery({
    queryKey: ['admin-analytics-orders', period],
    queryFn: async () => {
      const response = await api.get(`/api/admin/analytics/orders?period=${period}`)
      return response.data as Array<{ date: string; orders: number; revenue: number; completed: number }>
    },
  })

  const { data: revenueData } = useQuery({
    queryKey: ['admin-analytics-revenue', period],
    queryFn: async () => {
      const response = await api.get(`/api/admin/analytics/revenue?period=${period}`)
      return response.data
    },
  })

  const { data: popularRoutes } = useQuery({
    queryKey: ['admin-analytics-routes'],
    queryFn: async () => {
      const response = await api.get('/api/admin/analytics/popular-routes')
      return response.data as Array<{ route: string; count: number }>
    },
  })

  // Format chart data
  const chartData = ordersData?.map(item => ({
    ...item,
    date: format(new Date(item.date), 'd MMM', { locale: ru }),
    revenue: Math.round(item.revenue / 1000), // В тысячах
  })) || []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
          <p className="text-gray-500">Статистика и отчёты по бизнесу</p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setPeriod('week')}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              period === 'week' ? 'bg-white shadow text-primary-600' : 'text-gray-600'
            )}
          >
            Неделя
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              period === 'month' ? 'bg-white shadow text-primary-600' : 'text-gray-600'
            )}
          >
            Месяц
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Заказов сегодня"
          value={stats?.ordersToday || 0}
          change={stats?.ordersChange || 0}
          icon={Package}
          color="blue"
        />
        <MetricCard
          title="Выручка сегодня"
          value={`${((stats?.revenueToday || 0) / 1000).toFixed(1)}K ₽`}
          change={stats?.revenueChange || 0}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Водителей онлайн"
          value={stats?.activeDrivers || 0}
          subtitle={`из ${stats?.totalDrivers || 0}`}
          icon={Car}
          color="yellow"
        />
        <MetricCard
          title="Ожидает водителя"
          value={stats?.ordersPending || 0}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Orders Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Количество заказов</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOrders)"
                  name="Заказы"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Выручка (тыс. ₽)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}K ₽`, 'Выручка']}
                />
                <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} name="Выручка" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popular Routes */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Популярные маршруты</h3>
          <div className="space-y-3">
            {popularRoutes?.slice(0, 8).map((route, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="font-medium truncate">{route.route}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{route.count}</p>
                  <p className="text-xs text-gray-500">поездок</p>
                </div>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-8">Нет данных</p>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Итоги за период</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-600">Всего заказов</p>
              <p className="text-2xl font-bold text-blue-700">
                {revenueData?.orderCount || 0}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <p className="text-sm text-green-600">Общая выручка</p>
              <p className="text-2xl font-bold text-green-700">
                {((revenueData?.totalRevenue || 0) / 1000).toFixed(1)}K ₽
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl">
              <p className="text-sm text-purple-600">Средний чек</p>
              <p className="text-2xl font-bold text-purple-700">
                {Math.round(revenueData?.averageOrder || 0)} ₽
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  change,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string
  value: string | number
  change?: number
  subtitle?: string
  icon: any
  color: 'blue' | 'green' | 'yellow' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
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
