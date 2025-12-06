'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Phone,
  Mail,
  FileText,
  Shield,
  CreditCard,
  Car,
  MapPin,
  Star,
  Clock,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { clsx } from 'clsx'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
}

const faqItems: FAQItem[] = [
  {
    id: '1',
    category: 'orders',
    question: 'Как заказать такси?',
    answer: 'Укажите адрес отправления и назначения на главной странице, выберите класс автомобиля и нажмите "Заказать". Водитель будет найден в течение нескольких минут.',
  },
  {
    id: '2',
    category: 'orders',
    question: 'Как отменить заказ?',
    answer: 'Вы можете отменить заказ до прибытия водителя без каких-либо штрафов. После того как водитель приехал на место, отмена может повлечь комиссию.',
  },
  {
    id: '3',
    category: 'payment',
    question: 'Какие способы оплаты доступны?',
    answer: 'Вы можете оплатить поездку наличными водителю или привязать банковскую карту для автоматического списания после завершения поездки.',
  },
  {
    id: '4',
    category: 'payment',
    question: 'Как привязать банковскую карту?',
    answer: 'Перейдите в раздел "Профиль" → "Способы оплаты" и нажмите "Добавить карту". Введите данные карты и подтвердите привязку.',
  },
  {
    id: '5',
    category: 'safety',
    question: 'Как обеспечивается безопасность поездки?',
    answer: 'Все водители проходят проверку документов и истории вождения. Вы можете видеть рейтинг водителя перед поездкой и поделиться маршрутом с близкими.',
  },
  {
    id: '6',
    category: 'safety',
    question: 'Что делать в экстренной ситуации?',
    answer: 'Используйте кнопку SOS в приложении во время поездки. Ваше местоположение будет отправлено экстренным службам и нашей службе поддержки.',
  },
  {
    id: '7',
    category: 'account',
    question: 'Как изменить номер телефона?',
    answer: 'Для изменения номера телефона обратитесь в службу поддержки через чат или позвоните на горячую линию.',
  },
  {
    id: '8',
    category: 'account',
    question: 'Как удалить аккаунт?',
    answer: 'Для удаления аккаунта обратитесь в службу поддержки. Обратите внимание, что все данные о поездках будут удалены безвозвратно.',
  },
]

const categories = [
  { id: 'orders', name: 'Заказы', icon: Car },
  { id: 'payment', name: 'Оплата', icon: CreditCard },
  { id: 'safety', name: 'Безопасность', icon: Shield },
  { id: 'account', name: 'Аккаунт', icon: Star },
]

export default function HelpPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [authLoading, isAuthenticated, router])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const filteredFAQ = selectedCategory
    ? faqItems.filter(item => item.category === selectedCategory)
    : faqItems

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-500 to-primary-600 text-white pb-6">
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Помощь</h1>
        </div>

        <div className="px-4 mt-2">
          <p className="text-primary-100">Как мы можем вам помочь?</p>
        </div>
      </div>

      {/* Contact options */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-4">
          <button className="flex flex-col items-center gap-2 py-3">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary-600" />
            </div>
            <span className="text-sm font-medium">Чат</span>
          </button>
          <button className="flex flex-col items-center gap-2 py-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Phone className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium">Позвонить</span>
          </button>
          <button className="flex flex-col items-center gap-2 py-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium">Email</span>
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 mt-6">
        <h2 className="font-semibold mb-3">Категории</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              selectedCategory === null
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            )}
          >
            Все
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={clsx(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2',
                selectedCategory === cat.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              )}
            >
              <cat.icon className="w-4 h-4" />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="px-4 mt-6">
        <h2 className="font-semibold mb-3">Часто задаваемые вопросы</h2>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {filteredFAQ.map(item => (
            <div key={item.id}>
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full px-4 py-4 flex items-center justify-between text-left"
              >
                <span className="font-medium pr-4">{item.question}</span>
                {expandedId === item.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              <AnimatePresence>
                {expandedId === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-gray-600 text-sm">{item.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Legal links */}
      <div className="px-4 mt-6">
        <h2 className="font-semibold mb-3">Документы</h2>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          <button className="w-full px-4 py-4 flex items-center gap-3 text-left">
            <FileText className="w-5 h-5 text-gray-400" />
            <span className="font-medium">Пользовательское соглашение</span>
          </button>
          <button className="w-full px-4 py-4 flex items-center gap-3 text-left">
            <Shield className="w-5 h-5 text-gray-400" />
            <span className="font-medium">Политика конфиденциальности</span>
          </button>
          <button className="w-full px-4 py-4 flex items-center gap-3 text-left">
            <FileText className="w-5 h-5 text-gray-400" />
            <span className="font-medium">Правила отмены</span>
          </button>
        </div>
      </div>

      {/* App version */}
      <div className="px-4 mt-6 text-center">
        <p className="text-sm text-gray-400">Vibe Taxi v1.0.0</p>
      </div>
    </div>
  )
}
