'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Car,
  Clock,
  ChevronRight,
  DollarSign,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface EarningsStats {
  today: number
  week: number
  month: number
  total: number
  todayTrips: number
  weekTrips: number
  monthTrips: number
  totalTrips: number
  averagePerTrip: number
  averagePerDay: number
}

interface DailyEarning {
  date: string
  amount: number
  trips: number
}

export default function EarningsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [stats, setStats] = useState<EarningsStats | null>(null)
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month'>('week')

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
      fetchEarnings()
    }
  }, [isAuthenticated])

  const fetchEarnings = async () => {
    try {
      // Get completed orders to calculate earnings
      const response = await api.get('/api/drivers/me/orders')
      const orders = response.data

      // Calculate stats from orders
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - 7)
      const monthStart = new Date(todayStart)
      monthStart.setDate(monthStart.getDate() - 30)

      const completedOrders = orders.filter((o: any) => o.status === 'COMPLETED')

      const todayOrders = completedOrders.filter((o: any) => new Date(o.completedAt) >= todayStart)
      const weekOrders = completedOrders.filter((o: any) => new Date(o.completedAt) >= weekStart)
      const monthOrders = completedOrders.filter((o: any) => new Date(o.completedAt) >= monthStart)

      const calcTotal = (orders: any[]) => orders.reduce((sum, o) => sum + (o.finalPrice || o.price), 0)

      const stats: EarningsStats = {
        today: calcTotal(todayOrders),
        week: calcTotal(weekOrders),
        month: calcTotal(monthOrders),
        total: calcTotal(completedOrders),
        todayTrips: todayOrders.length,
        weekTrips: weekOrders.length,
        monthTrips: monthOrders.length,
        totalTrips: completedOrders.length,
        averagePerTrip: completedOrders.length > 0 ? Math.round(calcTotal(completedOrders) / completedOrders.length) : 0,
        averagePerDay: weekOrders.length > 0 ? Math.round(calcTotal(weekOrders) / 7) : 0,
      }

      setStats(stats)

      // Group by day for chart
      const dailyMap: Record<string, { amount: number; trips: number }> = {}
      const daysToShow = period === 'week' ? 7 : 30

      for (let i = 0; i < daysToShow; i++) {
        const date = new Date(todayStart)
        date.setDate(date.getDate() - i)
        const dateKey = date.toISOString().split('T')[0]
        dailyMap[dateKey] = { amount: 0, trips: 0 }
      }

      completedOrders.forEach((order: any) => {
        const dateKey = new Date(order.completedAt).toISOString().split('T')[0]
        if (dailyMap[dateKey]) {
          dailyMap[dateKey].amount += order.finalPrice || order.price
          dailyMap[dateKey].trips += 1
        }
      })

      const daily = Object.entries(dailyMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))

      setDailyEarnings(daily)
    } catch (err) {
      console.error('Failed to fetch earnings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  const formatWeekday = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', { weekday: 'short' })
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const maxDailyAmount = Math.max(...dailyEarnings.map(d => d.amount), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-500 to-primary-600 text-white pb-6">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Заработок</h1>
        </div>

        {/* Main stats */}
        <div className="px-4 mt-4">
          <p className="text-primary-100 text-sm mb-1">Заработано сегодня</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{stats?.today || 0}</span>
            <span className="text-2xl">₽</span>
          </div>
          <p className="text-primary-200 text-sm mt-1">
            {stats?.todayTrips || 0} поездок
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-gray-500 text-xs mb-1">За неделю</p>
            <p className="font-bold text-lg">{stats?.week || 0} ₽</p>
            <p className="text-gray-400 text-xs">{stats?.weekTrips || 0} поездок</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-gray-500 text-xs mb-1">За месяц</p>
            <p className="font-bold text-lg">{stats?.month || 0} ₽</p>
            <p className="text-gray-400 text-xs">{stats?.monthTrips || 0} поездок</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs mb-1">Всего</p>
            <p className="font-bold text-lg">{stats?.total || 0} ₽</p>
            <p className="text-gray-400 text-xs">{stats?.totalTrips || 0} поездок</p>
          </div>
        </div>
      </div>

      {/* Average stats */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <Car className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-gray-500 text-xs">Ср. за поездку</p>
                <p className="font-bold">{stats?.averagePerTrip || 0} ₽</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-gray-500 text-xs">Ср. в день</p>
                <p className="font-bold">{stats?.averagePerDay || 0} ₽</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">График заработка</h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setPeriod('week')}
                className={clsx(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  period === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                )}
              >
                Неделя
              </button>
              <button
                onClick={() => setPeriod('month')}
                className={clsx(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  period === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                )}
              >
                Месяц
              </button>
            </div>
          </div>

          {/* Bar chart */}
          <div className="flex items-end justify-between gap-1 h-32 mb-2">
            {dailyEarnings.slice(-7).map((day, index) => {
              const height = maxDailyAmount > 0 ? (day.amount / maxDailyAmount) * 100 : 0
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 4)}%` }}
                    className={clsx(
                      'w-full rounded-t-md',
                      day.amount > 0 ? 'bg-primary-500' : 'bg-gray-200'
                    )}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex justify-between gap-1">
            {dailyEarnings.slice(-7).map((day) => (
              <div key={day.date} className="flex-1 text-center">
                <p className="text-xs text-gray-400">{formatWeekday(day.date)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily breakdown */}
      <div className="px-4 mt-6">
        <h2 className="font-semibold mb-3">По дням</h2>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {dailyEarnings.slice().reverse().slice(0, 7).map((day) => (
            <div key={day.date} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{formatDate(day.date)}</p>
                <p className="text-sm text-gray-500">{day.trips} поездок</p>
              </div>
              <span className={clsx(
                'font-bold',
                day.amount > 0 ? 'text-primary-600' : 'text-gray-400'
              )}>
                {day.amount > 0 ? `+${day.amount}` : '0'} ₽
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
