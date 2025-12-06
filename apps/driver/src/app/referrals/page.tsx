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
  Trophy,
  TrendingUp,
  Clock,
  User,
  ChevronRight,
  Wallet,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Referral {
  id: string
  name: string
  avatar: string | null
  totalTrips: number
  joinedAt: string
}

interface Payout {
  id: string
  amount: number
  reason: string
  description: string | null
  isPaid: boolean
  paidAt: string | null
  createdAt: string
}

interface ReferralInfo {
  referralCode: string
  referredBy: { name: string } | null
  referrals: Referral[]
  stats: {
    totalReferrals: number
    activeReferrals: number
    totalEarned: number
    pendingPayout: number
    referralBonus: number
  }
  recentPayouts: Payout[]
  bonusRates: {
    registration: number
    firstTrip: number
    milestone: number
    milestoneTrips: number
  }
}

export default function ReferralsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'referrals' | 'payouts'>('referrals')

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
      setInfo(response.data)
    } catch (err) {
      console.error('Failed to fetch referral info:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const copyCode = async () => {
    if (!info) return
    try {
      await navigator.clipboard.writeText(info.referralCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const shareCode = async () => {
    if (!info) return
    const shareText = `Присоединяйся к Vibe Taxi как водитель! Используй мой реферальный код: ${info.referralCode} и получи бонус после первой поездки!`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Vibe Taxi - Реферальный код',
          text: shareText
        })
      } catch (err) {
        console.error('Failed to share:', err)
      }
    } else {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'registration':
        return 'Регистрация друга'
      case 'first_trip':
        return 'Первая поездка друга'
      case 'milestone':
        return 'Достижение'
      default:
        return reason
    }
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-500 to-primary-600 text-white pb-6">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Реферальная программа</h1>
        </div>

        {/* Stats cards */}
        <div className="px-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 text-primary-100 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm">Приглашено</span>
              </div>
              <p className="text-2xl font-bold">{info.stats.totalReferrals}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 text-primary-100 mb-1">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">Заработано</span>
              </div>
              <p className="text-2xl font-bold">{info.stats.totalEarned} ₽</p>
            </div>
          </div>
        </div>
      </div>

      {/* Referral code card */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <p className="text-sm text-gray-500 mb-2">Ваш реферальный код</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-100 rounded-xl px-4 py-3 font-mono text-xl font-bold text-center tracking-wider">
              {info.referralCode}
            </div>
            <button
              onClick={copyCode}
              className={clsx(
                'p-3 rounded-xl transition-colors',
                copied ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
              )}
            >
              {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
            </button>
            <button
              onClick={shareCode}
              className="p-3 bg-primary-500 text-white rounded-xl"
            >
              <Share2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="px-4 mt-6">
        <h2 className="font-semibold mb-3">Как это работает</h2>
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-600 font-bold">1</span>
            </div>
            <div>
              <p className="font-medium">Пригласите друга</p>
              <p className="text-sm text-gray-500">Поделитесь своим кодом с другим водителем</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-600 font-bold">2</span>
            </div>
            <div>
              <p className="font-medium">Друг регистрируется</p>
              <p className="text-sm text-gray-500">Получите {info.bonusRates.registration} ₽ после регистрации</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary-600 font-bold">3</span>
            </div>
            <div>
              <p className="font-medium">Друг совершает поездки</p>
              <p className="text-sm text-gray-500">
                +{info.bonusRates.firstTrip} ₽ за первую поездку, +{info.bonusRates.milestone} ₽ за каждые {info.bonusRates.milestoneTrips} поездок
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending payout */}
      {info.stats.pendingPayout > 0 && (
        <div className="px-4 mt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-900">К выплате</p>
                <p className="text-sm text-amber-700">{info.stats.pendingPayout} ₽</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 mt-6">
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('referrals')}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'referrals' ? 'bg-white shadow-sm' : 'text-gray-500'
            )}
          >
            Приглашённые ({info.referrals.length})
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'payouts' ? 'bg-white shadow-sm' : 'text-gray-500'
            )}
          >
            История выплат
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        {activeTab === 'referrals' ? (
          info.referrals.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">Пока нет приглашённых</p>
              <p className="text-sm text-gray-400 mt-1">Поделитесь своим кодом с друзьями</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
              {info.referrals.map((referral) => (
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
                    <p className="text-sm text-gray-500">{referral.totalTrips} поездок</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {format(new Date(referral.joinedAt), 'd MMM yyyy', { locale: ru })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          info.recentPayouts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Wallet className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">История выплат пуста</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
              {info.recentPayouts.map((payout) => (
                <motion.div
                  key={payout.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 flex items-center gap-3"
                >
                  <div className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    payout.isPaid ? 'bg-primary-100' : 'bg-amber-100'
                  )}>
                    <Gift className={clsx(
                      'w-5 h-5',
                      payout.isPaid ? 'text-primary-600' : 'text-amber-600'
                    )} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{getReasonLabel(payout.reason)}</p>
                    {payout.description && (
                      <p className="text-sm text-gray-500">{payout.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary-600">+{payout.amount} ₽</p>
                    <p className="text-xs text-gray-400">
                      {payout.isPaid ? 'Выплачено' : 'Ожидает'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Referred by info */}
      {info.referredBy && (
        <div className="px-4 mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-sm text-blue-700">
              Вы были приглашены пользователем <span className="font-medium">{info.referredBy.name}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
