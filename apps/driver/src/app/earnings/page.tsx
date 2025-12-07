'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Car,
  Users,
  ChevronRight,
  Wallet,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface EarningsStats {
  // Заработок с поездок
  rides: {
    today: number
    month: number
    todayTrips: number
    monthTrips: number
  }
  // Заработок с партнёрской программы
  partner: {
    month: number
    total: number
  }
  // Общие показатели
  averagePerTrip: number
  averagePerDay: number
}

interface DailyEarning {
  date: string
  ridesAmount: number
  partnerAmount: number
  trips: number
}

export default function EarningsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [stats, setStats] = useState<EarningsStats | null>(null)
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'rides' | 'partner'>('rides')

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
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const completedOrders = orders.filter((o: any) => o.status === 'COMPLETED')

      const todayOrders = completedOrders.filter((o: any) => new Date(o.completedAt) >= todayStart)
      const monthOrders = completedOrders.filter((o: any) => new Date(o.completedAt) >= monthStart)

      const calcTotal = (orders: any[]) => orders.reduce((sum, o) => sum + (o.finalPrice || o.price), 0)

      // Моковые данные для партнёрской программы (в реальном приложении - отдельный API)
      const partnerMonth = 3500
      const partnerTotal = 8000

      const stats: EarningsStats = {
        rides: {
          today: calcTotal(todayOrders),
          month: calcTotal(monthOrders),
          todayTrips: todayOrders.length,
          monthTrips: monthOrders.length,
        },
        partner: {
          month: partnerMonth,
          total: partnerTotal,
        },
        averagePerTrip: completedOrders.length > 0 ? Math.round(calcTotal(completedOrders) / completedOrders.length) : 0,
        averagePerDay: monthOrders.length > 0 ? Math.round(calcTotal(monthOrders) / new Date().getDate()) : 0,
      }

      setStats(stats)

      // Group by day for chart (last 7 days)
      const dailyMap: Record<string, { ridesAmount: number; partnerAmount: number; trips: number }> = {}

      for (let i = 0; i < 7; i++) {
        const date = new Date(todayStart)
        date.setDate(date.getDate() - i)
        const dateKey = date.toISOString().split('T')[0]
        dailyMap[dateKey] = { ridesAmount: 0, partnerAmount: 0, trips: 0 }
      }

      completedOrders.forEach((order: any) => {
        const dateKey = new Date(order.completedAt).toISOString().split('T')[0]
        if (dailyMap[dateKey]) {
          dailyMap[dateKey].ridesAmount += order.finalPrice || order.price
          dailyMap[dateKey].trips += 1
        }
      })

      const daily = Object.entries(dailyMap)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))

      setDailyEarnings(daily)
    } catch (err) {
      console.error('Failed to fetch earnings:', err)
      // Set default stats for demo
      setStats({
        rides: { today: 0, month: 0, todayTrips: 0, monthTrips: 0 },
        partner: { month: 3500, total: 8000 },
        averagePerTrip: 0,
        averagePerDay: 0,
      })
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

  const maxDailyAmount = Math.max(...dailyEarnings.map(d => d.ridesAmount), 1)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-500 to-primary-600 text-white pb-6">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Мой заработок</h1>
        </div>

        {/* Tabs */}
        <div className="px-4 mt-2">
          <div className="flex bg-white/20 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('rides')}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                activeTab === 'rides' ? 'bg-white text-primary-600' : 'text-white/80'
              )}
            >
              <Car className="w-4 h-4" />
              С поездок
            </button>
            <button
              onClick={() => setActiveTab('partner')}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                activeTab === 'partner' ? 'bg-white text-primary-600' : 'text-white/80'
              )}
            >
              <Users className="w-4 h-4" />
              Партнёрская
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'rides' ? (
        <>
          {/* Rides earnings */}
          <div className="px-4 -mt-4">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 text-sm mb-1">Сегодня</p>
                  <p className="text-3xl font-bold">{stats?.rides.today.toLocaleString() || 0} ₽</p>
                  <p className="text-sm text-gray-400 mt-1">{stats?.rides.todayTrips || 0} поездок</p>
                </div>
                <div className="border-l border-gray-100 pl-6">
                  <p className="text-gray-500 text-sm mb-1">За месяц</p>
                  <p className="text-3xl font-bold">{stats?.rides.month.toLocaleString() || 0} ₽</p>
                  <p className="text-sm text-gray-400 mt-1">{stats?.rides.monthTrips || 0} поездок</p>
                </div>
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
              <h2 className="font-semibold mb-4">За последние 7 дней</h2>

              {/* Bar chart */}
              <div className="flex items-end justify-between gap-2 h-32 mb-2">
                {dailyEarnings.map((day) => {
                  const height = maxDailyAmount > 0 ? (day.ridesAmount / maxDailyAmount) * 100 : 0
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center">
                      <p className="text-xs text-gray-500 mb-1">
                        {day.ridesAmount > 0 ? `${day.ridesAmount}₽` : ''}
                      </p>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(height, 4)}%` }}
                        className={clsx(
                          'w-full rounded-t-md',
                          day.ridesAmount > 0 ? 'bg-primary-500' : 'bg-gray-200'
                        )}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-between gap-2">
                {dailyEarnings.map((day) => (
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
              {dailyEarnings.slice().reverse().map((day) => (
                <div key={day.date} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium">{formatDate(day.date)}</p>
                    <p className="text-sm text-gray-500">{day.trips} поездок</p>
                  </div>
                  <span className={clsx(
                    'font-bold',
                    day.ridesAmount > 0 ? 'text-primary-600' : 'text-gray-400'
                  )}>
                    {day.ridesAmount > 0 ? `+${day.ridesAmount.toLocaleString()}` : '0'} ₽
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Partner earnings */}
          <div className="px-4 -mt-4">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-500 text-sm mb-1">За месяц</p>
                  <p className="text-3xl font-bold text-primary-600">
                    +{stats?.partner.month.toLocaleString() || 0} ₽
                  </p>
                </div>
                <div className="border-l border-gray-100 pl-6">
                  <p className="text-gray-500 text-sm mb-1">За всё время</p>
                  <p className="text-3xl font-bold">
                    {stats?.partner.total.toLocaleString() || 0} ₽
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Partner info */}
          <div className="px-4 mt-6">
            <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-primary-800 mb-1">3-уровневая партнёрка</p>
                  <p className="text-sm text-primary-700">
                    Получайте 15% / 10% / 5% от подписок приглашённых водителей на трёх уровнях.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Go to referrals */}
          <div className="px-4 mt-6">
            <motion.button
              onClick={() => router.push('/referrals')}
              className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between"
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary-600" />
                </div>
                <div className="text-left">
                  <p className="font-bold">Партнёрская программа</p>
                  <p className="text-sm text-gray-500">Приглашайте и зарабатывайте</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </motion.button>
          </div>

          {/* How partner earnings work */}
          <div className="px-4 mt-6">
            <h2 className="font-semibold mb-3">Как это работает</h2>
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium">Уровень 1 — 15%</p>
                  <p className="text-sm text-gray-500">С подписок ваших прямых рефералов</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium">Уровень 2 — 10%</p>
                  <p className="text-sm text-gray-500">С подписок рефералов ваших рефералов</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium">Уровень 3 — 5%</p>
                  <p className="text-sm text-gray-500">С подписок 3-го поколения рефералов</p>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription price */}
          <div className="px-4 mt-6 pb-4">
            <div className="bg-gray-100 rounded-xl p-4 text-center">
              <p className="text-gray-600">Стоимость подписки для водителей</p>
              <p className="text-2xl font-bold mt-1">4 500 ₽ / 30 дней</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
