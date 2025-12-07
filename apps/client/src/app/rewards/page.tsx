'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Gift,
  Star,
  Clock,
  Check,
  X,
  Sparkles,
  Car,
  Percent,
  Zap,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface Reward {
  id: string
  name: string
  description: string
  icon: string | null
  image: string | null
  type: string
  value: number
  pointsCost: number
  expiresAt: string | null
  isLimited: boolean
  remaining: number | null
}

interface MyReward {
  id: string
  reward: {
    id: string
    name: string
    description: string
    icon: string | null
    type: string
    value: number
  }
  status: string
  expiresAt: string
  createdAt: string
}

export default function RewardsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [rewards, setRewards] = useState<Reward[]>([])
  const [myRewards, setMyRewards] = useState<MyReward[]>([])
  const [balance, setBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'available' | 'my'>('available')
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)
  const [isRedeeming, setIsRedeeming] = useState(false)

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
      const [rewardsRes, pointsRes, myRewardsRes] = await Promise.all([
        api.get('/api/rewards'),
        api.get('/api/points/me'),
        api.get('/api/rewards/my?status=active'),
      ])
      setRewards(rewardsRes.data)
      setBalance(pointsRes.data.balance)
      setMyRewards(myRewardsRes.data.rewards)
    } catch (err) {
      console.error('Failed to fetch rewards:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRedeem = async () => {
    if (!selectedReward) return
    setIsRedeeming(true)
    try {
      await api.post('/api/rewards/redeem', { rewardId: selectedReward.id })
      await fetchData()
      setSelectedReward(null)
    } catch (err: any) {
      console.error('Failed to redeem reward:', err)
      alert(err.response?.data?.error || 'Ошибка при активации подарка')
    } finally {
      setIsRedeeming(false)
    }
  }

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'FREE_TRIP':
        return <Car className="w-6 h-6" />
      case 'DISCOUNT_FIXED':
      case 'DISCOUNT_PERCENT':
        return <Percent className="w-6 h-6" />
      case 'CASHBACK':
        return <Sparkles className="w-6 h-6" />
      case 'PRIORITY_PICKUP':
        return <Zap className="w-6 h-6" />
      default:
        return <Gift className="w-6 h-6" />
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Подарки</h1>
          </div>
        </div>

        {/* Balance Card */}
        <div className="px-4 pb-6">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Ваш баланс</p>
                <p className="text-3xl font-bold">{balance} <span className="text-lg">баллов</span></p>
              </div>
              <button
                onClick={() => router.push('/points')}
                className="bg-white/20 px-4 py-2 rounded-xl text-sm font-medium"
              >
                Как заработать
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 bg-white z-10 border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('available')}
            className={clsx(
              'flex-1 py-3 text-center font-medium border-b-2 transition-colors',
              activeTab === 'available'
                ? 'text-purple-600 border-purple-600'
                : 'text-gray-500 border-transparent'
            )}
          >
            Доступные
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={clsx(
              'flex-1 py-3 text-center font-medium border-b-2 transition-colors',
              activeTab === 'my'
                ? 'text-purple-600 border-purple-600'
                : 'text-gray-500 border-transparent'
            )}
          >
            Мои подарки {myRewards.length > 0 && `(${myRewards.length})`}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'available' ? (
          rewards.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Подарки скоро появятся</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {rewards.map((reward) => (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white">
                        {reward.icon || getRewardIcon(reward.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{reward.name}</h3>
                        <p className="text-sm text-gray-500 line-clamp-2">{reward.description}</p>
                        {reward.isLimited && reward.remaining !== null && (
                          <p className="text-xs text-orange-600 mt-1">
                            Осталось: {reward.remaining}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-purple-600 font-semibold">
                        <Star className="w-4 h-4" />
                        {reward.pointsCost} баллов
                      </div>
                      <button
                        onClick={() => setSelectedReward(reward)}
                        disabled={balance < reward.pointsCost}
                        className={clsx(
                          'px-4 py-2 rounded-xl font-medium transition-colors',
                          balance >= reward.pointsCost
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-400'
                        )}
                      >
                        {balance >= reward.pointsCost ? 'Активировать' : 'Недостаточно'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : myRewards.length === 0 ? (
          <div className="text-center py-12">
            <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">У вас пока нет активных подарков</p>
            <button
              onClick={() => setActiveTab('available')}
              className="mt-4 text-purple-600 font-medium"
            >
              Посмотреть доступные
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {myRewards.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl shadow-sm p-4"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-white">
                    {item.reward.icon || getRewardIcon(item.reward.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{item.reward.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        до {formatDate(item.expiresAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redeem Modal */}
      <AnimatePresence>
        {selectedReward && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={() => !isRedeeming && setSelectedReward(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Активация подарка</h2>
                  <button
                    onClick={() => !isRedeeming && setSelectedReward(null)}
                    className="p-2 -mr-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white">
                    {selectedReward.icon || getRewardIcon(selectedReward.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{selectedReward.name}</h3>
                    <p className="text-gray-500 mt-1">{selectedReward.description}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Стоимость</span>
                    <span className="font-semibold text-purple-600">
                      {selectedReward.pointsCost} баллов
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-gray-600">Ваш баланс</span>
                    <span className="font-semibold">{balance} баллов</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                    <span className="text-gray-600">После активации</span>
                    <span className="font-semibold text-green-600">
                      {balance - selectedReward.pointsCost} баллов
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-500 mb-6">
                  После активации подарок будет действителен 30 дней. Вы сможете применить его при следующем заказе.
                </p>

                <button
                  onClick={handleRedeem}
                  disabled={isRedeeming}
                  className="btn-primary w-full bg-gradient-to-r from-purple-600 to-pink-500"
                >
                  {isRedeeming ? 'Активация...' : 'Активировать подарок'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
