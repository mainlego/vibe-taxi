'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Star, MessageCircle, User, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  author?: {
    name: string
    avatar: string | null
  }
  target?: {
    name: string
    avatar: string | null
  }
  order: {
    pickupAddress: string
    dropoffAddress: string
    createdAt: string
  }
}

interface ReviewStats {
  totalReviews: number
  averageRating: number
  ratingDistribution: {
    5: number
    4: number
    3: number
    2: number
    1: number
  }
}

export default function ReviewsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<'received' | 'given'>('received')

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchReviews()
    }
  }, [isAuthenticated, user, tab])

  const fetchReviews = async () => {
    try {
      setIsLoading(true)
      if (tab === 'received' && user) {
        const response = await api.get(`/api/reviews/user/${user.id}`)
        setReviews(response.data.reviews)
        setStats(response.data.stats)
      } else {
        const response = await api.get('/api/reviews/my')
        setReviews(response.data)
        setStats(null)
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err)
    } finally {
      setIsLoading(false)
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Отзывы</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('received')}
            className={clsx(
              'flex-1 py-3 text-center font-medium transition-colors',
              tab === 'received'
                ? 'text-primary-600 border-b-2 border-primary-500'
                : 'text-gray-500'
            )}
          >
            Полученные
          </button>
          <button
            onClick={() => setTab('given')}
            className={clsx(
              'flex-1 py-3 text-center font-medium transition-colors',
              tab === 'given'
                ? 'text-primary-600 border-b-2 border-primary-500'
                : 'text-gray-500'
            )}
          >
            Оставленные
          </button>
        </div>
      </div>

      {/* Stats (only for received) */}
      {tab === 'received' && stats && (
        <div className="p-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-6 mb-6">
              <div className="text-center">
                <div className="flex items-center gap-1 text-4xl font-bold text-primary-600">
                  {stats.averageRating.toFixed(1)}
                  <Star className="w-8 h-8 text-yellow-400 fill-current" />
                </div>
                <p className="text-sm text-gray-500">{stats.totalReviews} отзывов</p>
              </div>
              <div className="flex-1 space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution]
                  const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="w-4 text-sm text-gray-500">{rating}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className="h-full bg-yellow-400 rounded-full"
                        />
                      </div>
                      <span className="w-8 text-sm text-gray-400">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reviews list */}
      <div className="p-4">
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {tab === 'received' ? 'Отзывов пока нет' : 'Вы ещё не оставляли отзывов'}
            </h2>
            <p className="text-gray-500">
              {tab === 'received'
                ? 'Здесь появятся отзывы о вас от водителей'
                : 'Здесь появятся ваши отзывы о поездках'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              // For "given" tab - show target (who you reviewed)
              // For "received" tab - show author (who reviewed you)
              const person = tab === 'given' ? review.target : review.author

              return (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                      {person?.avatar ? (
                        <img src={person.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{person?.name || 'Пользователь'}</p>
                        <p className="text-sm text-gray-400">
                          {format(new Date(review.createdAt), 'd MMM', { locale: ru })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={clsx(
                              'w-4 h-4',
                              star <= review.rating
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            )}
                          />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="text-gray-600 text-sm">{review.comment}</p>
                      )}
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          {review.order.pickupAddress.split(',')[0]} → {review.order.dropoffAddress.split(',')[0]}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
