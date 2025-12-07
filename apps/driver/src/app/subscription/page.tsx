'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Crown,
  Check,
  Loader2,
  Calendar,
  CreditCard,
  Clock,
  Shield,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  durationDays: number
  features: string[] | null
}

interface CurrentSubscription {
  id: string
  plan: {
    id: string
    name: string
    description: string
  }
  status: string
  startDate: string
  endDate: string
  autoRenew: boolean
}

interface SubscriptionStatus {
  hasActiveSubscription: boolean
  subscription: CurrentSubscription | null
  daysRemaining: number
  history: any[]
}

export default function SubscriptionPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPurchasing, setIsPurchasing] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [authLoading, isAuthenticated, router])

  // Load plan and current subscription status
  useEffect(() => {
    if (isAuthenticated) {
      const loadData = async () => {
        setIsLoading(true)
        try {
          const [plansRes, statusRes] = await Promise.all([
            api.get('/api/subscriptions/plans'),
            api.get('/api/subscriptions/me'),
          ])
          // Get first (and only) plan
          if (plansRes.data.length > 0) {
            setPlan(plansRes.data[0])
          }
          setStatus(statusRes.data)
        } catch (err) {
          console.error('Failed to load subscription data:', err)
        } finally {
          setIsLoading(false)
        }
      }
      loadData()
    }
  }, [isAuthenticated])

  const handlePurchase = async () => {
    if (!plan) return

    setIsPurchasing(true)
    try {
      const response = await api.post('/api/subscriptions/purchase', { planId: plan.id })
      const { confirmationUrl } = response.data

      if (confirmationUrl) {
        // Redirect to YooKassa payment page
        window.location.href = confirmationUrl
      }
    } catch (err: any) {
      console.error('Failed to purchase subscription:', err)
      alert(err.response?.data?.error || 'Не удалось оформить подписку')
    } finally {
      setIsPurchasing(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-500 to-primary-600 text-white pb-16">
        <div className="flex items-center px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold ml-2">Подписка</h1>
        </div>

        <div className="px-4 text-center">
          <Crown className="w-20 h-20 mx-auto mb-4 text-yellow-300" />
          <h2 className="text-2xl font-bold mb-2">Получите доступ к заказам</h2>
          <p className="text-white/80">
            Оформите подписку, чтобы принимать заказы и зарабатывать
          </p>
        </div>
      </div>

      {/* Current subscription status */}
      {status?.hasActiveSubscription && status.subscription && (
        <div className="px-4 -mt-8 relative z-10 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">Подписка активна</p>
                <p className="text-gray-500">{status.subscription.plan.name}</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-5 h-5" />
                <span>
                  до {new Date(status.subscription.endDate).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-500" />
                <span className="font-bold text-primary-600">
                  {status.daysRemaining} дней
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan card */}
      {plan && (
        <div className={`px-4 ${!status?.hasActiveSubscription ? '-mt-8 relative z-10' : ''}`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
              <p className="text-gray-500">{plan.description}</p>
            </div>

            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold">{plan.price.toLocaleString()}</span>
                <span className="text-2xl text-gray-500">₽</span>
              </div>
              <p className="text-gray-400 mt-1">за {plan.durationDays} дней</p>
            </div>

            {plan.features && Array.isArray(plan.features) && (
              <div className="space-y-3 mb-6">
                {plan.features.map((feature: string, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center text-sm text-gray-400">
              {Math.round(plan.price / plan.durationDays)} ₽ в день
            </div>
          </motion.div>
        </div>
      )}

      {/* Info */}
      <div className="px-4 mt-6">
        <div className="bg-blue-50 rounded-xl p-4">
          <h4 className="font-medium text-blue-800 mb-2">Как это работает?</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. Оплатите подписку через ЮKassa</li>
            <li>2. Подписка активируется мгновенно</li>
            <li>3. Выходите на линию и зарабатывайте!</li>
          </ul>
        </div>
      </div>

      {/* Purchase button - fixed at bottom */}
      {plan && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <button
            onClick={handlePurchase}
            disabled={isPurchasing}
            className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-lg"
          >
            {isPurchasing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Переход к оплате...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Оплатить {plan.price.toLocaleString()} ₽
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Безопасная оплата через ЮKassa
          </p>
        </div>
      )}
    </div>
  )
}
