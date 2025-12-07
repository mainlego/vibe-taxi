'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Star,
  Gift,
  Users,
  Car,
  Copy,
  Check,
  Share2,
  ChevronRight,
  TrendingUp,
  Clock,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface PointsData {
  balance: number
  totalEarned: number
  totalSpent: number
  referralCode: string
  referredBy: { name: string } | null
  referrals: { id: string; name: string; avatar: string | null; joinedAt: string }[]
  referralsCount: number
  activeRewards: any[]
  recentTransactions: Transaction[]
  pointsSettings: {
    perTrip: number
    per100Rub: number
    referralBonus: number
    referralTripBonus: number
  }
}

interface Transaction {
  id: string
  amount: number
  type: string
  description: string
  createdAt: string
}

export default function PointsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [data, setData] = useState<PointsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'earn' | 'history' | 'referrals'>('earn')

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
      fetchData()
    }
  }, [isAuthenticated])

  const fetchData = async () => {
    try {
      const response = await api.get('/api/points/me')
      setData(response.data)
    } catch (err) {
      console.error('Failed to fetch points:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // Try modern Clipboard API first (requires HTTPS)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback for HTTP and older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    } catch {
      return false
    }
  }

  const handleCopyCode = async () => {
    if (data?.referralCode) {
      const success = await copyToClipboard(data.referralCode)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const handleShare = async () => {
    if (data?.referralCode) {
      const shareText = `Приглашаю тебя в Vibe Taxi! Используй мой код ${data.referralCode} и получи бонус при регистрации. Скачай приложение: https://vibetaxi.ru`
      if (navigator.share) {
        try {
          await navigator.share({ text: shareText })
        } catch (err) {
          console.error('Share failed:', err)
          // If share was cancelled, try copying
          const success = await copyToClipboard(shareText)
          if (success) {
            alert('Ссылка скопирована в буфер обмена')
          }
        }
      } else {
        const success = await copyToClipboard(shareText)
        if (success) {
          alert('Ссылка скопирована в буфер обмена')
        }
      }
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'TRIP_COMPLETE':
        return <Car className="w-5 h-5 text-green-500" />
      case 'REFERRAL_BONUS':
      case 'REFERRAL_TRIP':
        return <Users className="w-5 h-5 text-blue-500" />
      case 'REWARD_REDEMPTION':
        return <Gift className="w-5 h-5 text-purple-500" />
      case 'WELCOME_BONUS':
        return <Star className="w-5 h-5 text-yellow-500" />
      default:
        return <Star className="w-5 h-5 text-gray-500" />
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Ошибка загрузки данных</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Мои баллы</h1>
          </div>
        </div>

        {/* Balance Card */}
        <div className="px-4 pb-6">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6">
            <div className="text-center">
              <p className="text-white/80 text-sm mb-1">Ваш баланс</p>
              <p className="text-5xl font-bold mb-2">{data.balance}</p>
              <p className="text-white/80">баллов</p>
            </div>

            <div className="flex justify-between mt-6 pt-4 border-t border-white/20">
              <div className="text-center">
                <p className="text-2xl font-semibold">{data.totalEarned}</p>
                <p className="text-xs text-white/70">Заработано</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{data.totalSpent}</p>
                <p className="text-xs text-white/70">Потрачено</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{data.referralsCount}</p>
                <p className="text-xs text-white/70">Друзей</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 -mt-2">
        <button
          onClick={() => router.push('/rewards')}
          className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Gift className="w-5 h-5 text-purple-600" />
            </div>
            <span className="font-medium">Потратить баллы на подарки</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-200 mt-4">
        <div className="flex">
          {[
            { id: 'earn', label: 'Заработать' },
            { id: 'history', label: 'История' },
            { id: 'referrals', label: 'Друзья' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'flex-1 py-3 text-center font-medium border-b-2 transition-colors text-sm',
                activeTab === tab.id
                  ? 'text-amber-600 border-amber-600'
                  : 'text-gray-500 border-transparent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'earn' && (
          <div className="space-y-4">
            {/* How to earn */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-semibold mb-4">Как заработать баллы</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Car className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Поездки</p>
                    <p className="text-sm text-gray-500">
                      {data.pointsSettings.perTrip} баллов за каждую поездку + {data.pointsSettings.per100Rub} баллов за каждые 100₽
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Приглашай друзей</p>
                    <p className="text-sm text-gray-500">
                      {data.pointsSettings.referralBonus} баллов за каждого друга + {data.pointsSettings.referralTripBonus} баллов за его поездки
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Code */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
              <h3 className="font-semibold mb-2">Ваш реферальный код</h3>
              <p className="text-sm text-white/80 mb-4">
                Поделитесь кодом с друзьями и получайте баллы
              </p>

              <div className="bg-white/20 rounded-xl p-4 flex items-center justify-between mb-4">
                <span className="text-2xl font-bold tracking-wider">{data.referralCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                >
                  {copied ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>

              <button
                onClick={handleShare}
                className="w-full bg-white text-indigo-600 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Поделиться
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {data.recentTransactions.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">История пуста</p>
                <p className="text-sm text-gray-400 mt-1">
                  Совершите поездку чтобы получить баллы
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
                {data.recentTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{tx.description}</p>
                      <p className="text-sm text-gray-500">{formatDate(tx.createdAt)}</p>
                    </div>
                    <span
                      className={clsx(
                        'font-semibold',
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'referrals' && (
          <div>
            {/* Referral Stats */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Приглашённых друзей</p>
                  <p className="text-3xl font-bold text-blue-600">{data.referralsCount}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Referral Code Card */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/80">Ваш код</span>
                <span className="text-xl font-bold tracking-wider">{data.referralCode}</span>
              </div>
              <button
                onClick={handleShare}
                className="w-full bg-white text-indigo-600 py-2 rounded-xl font-medium flex items-center justify-center gap-2 text-sm"
              >
                <Share2 className="w-4 h-4" />
                Пригласить друзей
              </button>
            </div>

            {/* Referrals List */}
            {data.referrals.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Пока нет приглашённых друзей</p>
                <p className="text-sm text-gray-400 mt-1">
                  Поделитесь своим кодом и получайте баллы
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
                {data.referrals.map((ref) => (
                  <div key={ref.id} className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {ref.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{ref.name}</p>
                      <p className="text-sm text-gray-500">
                        Присоединился {formatDate(ref.joinedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
