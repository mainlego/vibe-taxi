'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, Loader2, XCircle, Crown } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'

function SubscriptionSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [subscription, setSubscription] = useState<any>(null)
  const [error, setError] = useState('')

  const subscriptionId = searchParams.get('subscriptionId')

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [authLoading, isAuthenticated, router])

  // Confirm subscription
  useEffect(() => {
    if (isAuthenticated && subscriptionId) {
      const confirmSubscription = async () => {
        try {
          const response = await api.post(`/api/subscriptions/confirm/${subscriptionId}`)

          if (response.data.success) {
            setStatus('success')
            setSubscription(response.data.subscription)
          } else {
            // Subscription might still be processing
            if (response.data.subscription?.status === 'PENDING') {
              // Poll for status
              let attempts = 0
              const maxAttempts = 10

              const pollStatus = async () => {
                attempts++
                try {
                  const checkRes = await api.post(`/api/subscriptions/confirm/${subscriptionId}`)
                  if (checkRes.data.success) {
                    setStatus('success')
                    setSubscription(checkRes.data.subscription)
                    return
                  }
                } catch {}

                if (attempts < maxAttempts) {
                  setTimeout(pollStatus, 2000)
                } else {
                  setStatus('error')
                  setError('Не удалось подтвердить оплату. Пожалуйста, обратитесь в поддержку.')
                }
              }

              setTimeout(pollStatus, 2000)
            } else {
              setStatus('error')
              setError('Оплата не завершена')
            }
          }
        } catch (err: any) {
          console.error('Failed to confirm subscription:', err)
          setStatus('error')
          setError(err.response?.data?.error || 'Произошла ошибка')
        }
      }

      confirmSubscription()
    }
  }, [isAuthenticated, subscriptionId])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center"
      >
        {status === 'loading' && (
          <>
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Проверяем оплату...</h1>
            <p className="text-gray-500">Пожалуйста, подождите</p>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-12 h-12 text-green-500" />
            </motion.div>
            <h1 className="text-2xl font-bold text-green-600 mb-2">Подписка активирована!</h1>
            <p className="text-gray-500 mb-6">
              {subscription?.plan && `Тариф "${subscription.plan}" активен`}
              {subscription?.endDate && (
                <span className="block mt-1">
                  до {new Date(subscription.endDate).toLocaleDateString('ru-RU')}
                </span>
              )}
            </p>

            <div className="bg-green-50 rounded-xl p-4 mb-6">
              <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-green-700">
                Теперь вы можете выходить на линию и принимать заказы!
              </p>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary w-full"
            >
              Начать работу
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <XCircle className="w-12 h-12 text-red-500" />
            </motion.div>
            <h1 className="text-2xl font-bold text-red-600 mb-2">Ошибка</h1>
            <p className="text-gray-500 mb-6">{error}</p>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/subscription')}
                className="btn-primary w-full"
              >
                Попробовать снова
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn-secondary w-full"
              >
                Вернуться
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SubscriptionSuccessContent />
    </Suspense>
  )
}
