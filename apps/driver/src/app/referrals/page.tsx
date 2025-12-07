'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Users,
  Gift,
  Copy,
  Share2,
  Check,
  User,
  Wallet,
  TrendingUp,
  CreditCard,
  Crown,
  ChevronRight,
  Info,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface ReferralUser {
  id: string
  name: string
  avatar: string | null
  level: 1 | 2 | 3
  totalEarnings: number
  joinedAt: string
}

interface ReferralInfo {
  referralCode: string
  referralLink: string
  subscription: {
    isActive: boolean
    expiresAt: string | null
    price: number
    duration: number
  }
  levels: {
    level1: { percent: number; count: number; earnings: number }
    level2: { percent: number; count: number; earnings: number }
    level3: { percent: number; count: number; earnings: number }
  }
  stats: {
    totalReferrals: number
    totalEarnings: number
    monthlyEarnings: number
  }
  referrals: ReferralUser[]
}

export default function ReferralsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 'all'>('all')

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
      fetchReferralInfo()
    }
  }, [isAuthenticated])

  const fetchReferralInfo = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('/api/referrals/info')
      const data = response.data

      // Transform API response to match our interface
      setInfo({
        referralCode: data.referralCode || 'NO_CODE',
        referralLink: `https://driver.vibe-taxi.ru/auth?ref=${data.referralCode || ''}`,
        subscription: {
          isActive: false, // TODO: Add subscription system
          expiresAt: null,
          price: 4500,
          duration: 30,
        },
        levels: {
          level1: { percent: 15, count: data.referrals?.length || 0, earnings: data.stats?.totalEarned || 0 },
          level2: { percent: 10, count: 0, earnings: 0 },
          level3: { percent: 5, count: 0, earnings: 0 },
        },
        stats: {
          totalReferrals: data.stats?.totalReferrals || 0,
          totalEarnings: data.stats?.totalEarned || 0,
          monthlyEarnings: data.stats?.pendingPayout || 0,
        },
        referrals: (data.referrals || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          avatar: r.avatar,
          level: 1 as const,
          totalEarnings: 0,
          joinedAt: r.joinedAt,
        })),
      })
    } catch (err) {
      console.error('Failed to fetch referral info:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    // Try modern clipboard API first (works only in secure contexts)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (err) {
        console.error('Clipboard API failed:', err)
      }
    }

    // Fallback for HTTP - use textarea + execCommand
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '-9999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    } catch (err) {
      console.error('Fallback copy failed:', err)
      return false
    }
  }

  const copyCode = async () => {
    if (!info) return
    const success = await copyToClipboard(info.referralCode)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareLink = async () => {
    if (!info) return
    const shareText = `Присоединяйся к Vibe Go как водитель! 🚗\n\nИспользуй мой реферальный код: ${info.referralCode}\n\nИли перейди по ссылке: ${info.referralLink}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Vibe Go - Реферальный код',
          text: shareText,
        })
      } catch (err) {
        console.error('Failed to share:', err)
      }
    } else {
      const success = await copyToClipboard(shareText)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Не удалось загрузить данные</p>
      </div>
    )
  }

  const filteredReferrals = selectedLevel === 'all'
    ? info.referrals
    : info.referrals.filter((r) => r.level === selectedLevel)

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-500 to-primary-600 text-white pb-6">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Партнёрская программа</h1>
        </div>

        {/* Total Earnings */}
        <div className="px-4 mt-2">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm">Заработано за всё время</p>
                <p className="text-3xl font-bold mt-1">{info.stats.totalEarnings.toLocaleString()} ₽</p>
              </div>
              <div className="text-right">
                <p className="text-primary-100 text-sm">За этот месяц</p>
                <p className="text-xl font-bold mt-1 text-primary-100">+{info.stats.monthlyEarnings.toLocaleString()} ₽</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Status */}
      <div className="px-4 -mt-4">
        <div className={clsx(
          'rounded-2xl shadow-lg p-4',
          info.subscription.isActive ? 'bg-white' : 'bg-amber-50 border border-amber-200'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center',
                info.subscription.isActive ? 'bg-green-100' : 'bg-amber-100'
              )}>
                <Crown className={clsx(
                  'w-6 h-6',
                  info.subscription.isActive ? 'text-green-500' : 'text-amber-500'
                )} />
              </div>
              <div>
                <p className="font-bold">
                  {info.subscription.isActive ? 'Подписка активна' : 'Подписка неактивна'}
                </p>
                <p className="text-sm text-gray-500">
                  {info.subscription.isActive && info.subscription.expiresAt
                    ? `Осталось ${getDaysLeft(info.subscription.expiresAt)} дней`
                    : `${info.subscription.price} ₽ / ${info.subscription.duration} дней`
                  }
                </p>
              </div>
            </div>
            {!info.subscription.isActive && (
              <button className="bg-primary-500 text-white px-4 py-2 rounded-xl font-medium">
                Оплатить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Referral Code */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm text-gray-500 mb-2">Ваш реферальный код</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-100 rounded-xl px-4 py-3 font-mono text-xl font-bold text-center tracking-wider">
              {info.referralCode}
            </div>
            <button
              onClick={copyCode}
              className={clsx(
                'p-3 rounded-xl transition-colors',
                copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
              )}
            >
              {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
            </button>
            <button
              onClick={shareLink}
              className="p-3 bg-primary-500 text-white rounded-xl"
            >
              <Share2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* 3 Levels Breakdown */}
      <div className="px-4 mt-6">
        <h2 className="font-bold mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-500" />
          3 уровня дохода
        </h2>
        <div className="space-y-3">
          {/* Level 1 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-bold">1</span>
                </div>
                <div>
                  <p className="font-medium">Уровень 1 — {info.levels.level1.percent}%</p>
                  <p className="text-sm text-gray-500">Прямые приглашения</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary-600">+{info.levels.level1.earnings.toLocaleString()} ₽</p>
                <p className="text-xs text-gray-500">{info.levels.level1.count} чел.</p>
              </div>
            </div>
          </motion.div>

          {/* Level 2 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold">2</span>
                </div>
                <div>
                  <p className="font-medium">Уровень 2 — {info.levels.level2.percent}%</p>
                  <p className="text-sm text-gray-500">Приглашённые вашими рефералами</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-600">+{info.levels.level2.earnings.toLocaleString()} ₽</p>
                <p className="text-xs text-gray-500">{info.levels.level2.count} чел.</p>
              </div>
            </div>
          </motion.div>

          {/* Level 3 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-sm p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-bold">3</span>
                </div>
                <div>
                  <p className="font-medium">Уровень 3 — {info.levels.level3.percent}%</p>
                  <p className="text-sm text-gray-500">Рефералы 3-го поколения</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-purple-600">+{info.levels.level3.earnings.toLocaleString()} ₽</p>
                <p className="text-xs text-gray-500">{info.levels.level3.count} чел.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* How it works */}
      <div className="px-4 mt-6">
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-primary-800 mb-2">Как это работает?</p>
              <ul className="text-sm text-primary-700 space-y-1">
                <li>• <b>15%</b> от оплаты подписки ваших прямых рефералов</li>
                <li>• <b>10%</b> от подписок рефералов 2-го уровня</li>
                <li>• <b>5%</b> от подписок рефералов 3-го уровня</li>
                <li className="pt-2 text-primary-600 font-medium">
                  Стоимость подписки: {info.subscription.price.toLocaleString()} ₽ / {info.subscription.duration} дней
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Level Filter */}
      <div className="px-4 mt-6">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['all', 1, 2, 3] as const).map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedLevel === level ? 'bg-white shadow-sm' : 'text-gray-500'
              )}
            >
              {level === 'all' ? 'Все' : `Уровень ${level}`}
            </button>
          ))}
        </div>
      </div>

      {/* Referrals List */}
      <div className="px-4 mt-4">
        {filteredReferrals.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">Пока нет приглашённых</p>
            <p className="text-sm text-gray-400 mt-1">Поделитесь своим кодом с друзьями</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
            {filteredReferrals.map((referral) => (
              <motion.div
                key={referral.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 flex items-center gap-3"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                  {referral.avatar ? (
                    <img src={referral.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{referral.name}</p>
                  <p className="text-sm text-gray-500">Уровень {referral.level}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-600">+{referral.totalEarnings} ₽</p>
                  <p className="text-xs text-gray-400">
                    {format(new Date(referral.joinedAt), 'd MMM', { locale: ru })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
