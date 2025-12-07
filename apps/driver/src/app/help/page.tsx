'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'

interface FAQItem {
  question: string
  answer: string
}

const faqItems: FAQItem[] = [
  {
    question: 'Как начать работать водителем?',
    answer: 'Для начала работы вам необходимо пройти регистрацию, загрузить документы (водительское удостоверение, СТС, страховку) и дождаться их проверки. После одобрения вы сможете принимать заказы.',
  },
  {
    question: 'Как работает оплата?',
    answer: 'Оплата поступает на ваш баланс после завершения каждой поездки. Вы можете вывести средства на банковскую карту в любое время. Минимальная сумма вывода — 500 рублей.',
  },
  {
    question: 'Что такое реферальная программа?',
    answer: 'Реферальная программа позволяет вам получать бонусы за привлечение новых водителей. Вы получаете процент от заработка приглашённых водителей: 15% с 1-го уровня, 10% со 2-го и 5% с 3-го.',
  },
  {
    question: 'Как отменить заказ?',
    answer: 'Вы можете отменить заказ до того, как подтвердите прибытие на место. Частые отмены могут повлиять на ваш рейтинг и доступность заказов.',
  },
  {
    question: 'Что делать при ДТП?',
    answer: 'При ДТП немедленно остановитесь, обеспечьте безопасность пассажиров, вызовите ГИБДД и скорую помощь при необходимости. Сообщите о происшествии в поддержку через приложение.',
  },
  {
    question: 'Как работает рейтинг?',
    answer: 'Рейтинг формируется на основе оценок пассажиров после каждой поездки. Чем выше ваш рейтинг, тем больше заказов вы получаете. При падении рейтинга ниже 4.5 доступ к заказам может быть ограничен.',
  },
  {
    question: 'Сколько стоит подписка?',
    answer: 'Стоимость подписки составляет 4500 рублей за 30 дней. Подписка даёт доступ к принятию заказов и всем функциям приложения для водителей.',
  },
]

export default function HelpPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold ml-2">Помощь</h1>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-6">
        <h2 className="text-lg font-bold mb-4">Связаться с нами</h2>
        <div className="grid grid-cols-2 gap-4">
          <motion.a
            href="tel:+78001234567"
            className="bg-white rounded-2xl p-4 shadow-sm text-center"
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Phone className="w-6 h-6 text-green-500" />
            </div>
            <p className="font-medium">Позвонить</p>
            <p className="text-sm text-gray-500">8 800 123-45-67</p>
          </motion.a>

          <motion.a
            href="https://t.me/vibetaxi_support"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl p-4 shadow-sm text-center"
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-6 h-6 text-blue-500" />
            </div>
            <p className="font-medium">Telegram</p>
            <p className="text-sm text-gray-500">Онлайн-чат</p>
          </motion.a>

          <motion.a
            href="mailto:support@vibetaxi.ru"
            className="bg-white rounded-2xl p-4 shadow-sm text-center"
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="w-6 h-6 text-purple-500" />
            </div>
            <p className="font-medium">Email</p>
            <p className="text-sm text-gray-500">support@vibetaxi.ru</p>
          </motion.a>

          <motion.button
            onClick={() => alert('Функция в разработке')}
            className="bg-white rounded-2xl p-4 shadow-sm text-center"
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-orange-500" />
            </div>
            <p className="font-medium">Проблема</p>
            <p className="text-sm text-gray-500">Сообщить о проблеме</p>
          </motion.button>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="px-4 pb-8">
        <h2 className="text-lg font-bold mb-4">Частые вопросы</h2>
        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <motion.div
              key={index}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-primary-500 flex-shrink-0" />
                  <span className="font-medium">{item.question}</span>
                </div>
                {expandedFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>

              <AnimatePresence>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-4 pb-4 pt-0">
                      <p className="text-gray-600 text-sm pl-8">{item.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Legal Links */}
      <div className="px-4 pb-8">
        <h2 className="text-lg font-bold mb-4">Документы</h2>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <a
            href="#"
            className="flex items-center justify-between p-4 border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <span>Пользовательское соглашение</span>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
          <a
            href="#"
            className="flex items-center justify-between p-4 border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <span>Политика конфиденциальности</span>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
          <a href="#" className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <span>Правила для водителей</span>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </a>
        </div>
      </div>
    </div>
  )
}
