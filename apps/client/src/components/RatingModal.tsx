'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, Car, User } from 'lucide-react'
import { api } from '@/lib/api'

interface RatingModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string
  driverName: string
  driverAvatar?: string | null
  carModel?: string
  carNumber?: string
}

export function RatingModal({
  isOpen,
  onClose,
  orderId,
  driverName,
  driverAvatar,
  carModel,
  carNumber,
}: RatingModalProps) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const ratingDescriptions = [
    '',
    'Ужасно',
    'Плохо',
    'Нормально',
    'Хорошо',
    'Отлично!',
  ]

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await api.post('/api/reviews', {
        orderId,
        rating,
        comment: comment.trim() || undefined,
      })
      setSubmitted(true)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Failed to submit review:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-t-3xl w-full"
        >
          <div className="p-6">
            {submitted ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-10 h-10 text-green-500 fill-current" />
                </div>
                <h2 className="text-xl font-bold mb-2">Спасибо за отзыв!</h2>
                <p className="text-gray-500">Ваша оценка помогает улучшить сервис</p>
              </motion.div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Оцените поездку</h2>
                  <button onClick={onClose} className="p-2 -mr-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Driver info */}
                <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {driverAvatar ? (
                      <img src={driverAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{driverName}</p>
                    {carModel && carNumber && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Car className="w-4 h-4" />
                        <span>{carModel} • {carNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Star rating */}
                <div className="text-center mb-6">
                  <div className="flex justify-center gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-12 h-12 transition-colors ${
                            star <= rating
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-lg font-medium text-gray-700">
                    {ratingDescriptions[rating]}
                  </p>
                </div>

                {/* Comment */}
                <div className="mb-6">
                  <label className="text-sm text-gray-500 mb-2 block">
                    Комментарий (необязательно)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 min-h-[100px] resize-none focus:border-primary-500 outline-none"
                    placeholder="Расскажите о поездке..."
                  />
                </div>

                {/* Quick tips */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {['Вежливый водитель', 'Чистая машина', 'Быстро доехали', 'Хорошая музыка'].map((tip) => (
                    <button
                      key={tip}
                      onClick={() => setComment((prev) => prev ? `${prev}, ${tip.toLowerCase()}` : tip)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                    >
                      {tip}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="btn-primary w-full"
                >
                  {isSubmitting ? 'Отправка...' : 'Отправить отзыв'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
