'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  FileText,
  CreditCard,
  Shield,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Camera,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'

interface Document {
  id: string
  type: 'LICENSE' | 'STS' | 'INSURANCE' | 'PASSPORT'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  expiresAt?: string
  uploadedAt: string
}

const documentTypes = {
  LICENSE: {
    label: 'Водительское удостоверение',
    icon: CreditCard,
    description: 'Фото лицевой и обратной стороны',
    color: 'blue',
  },
  STS: {
    label: 'Свидетельство о регистрации (СТС)',
    icon: FileText,
    description: 'Фото лицевой и обратной стороны',
    color: 'green',
  },
  INSURANCE: {
    label: 'Страховка ОСАГО',
    icon: Shield,
    description: 'Действующий полис страхования',
    color: 'purple',
  },
  PASSPORT: {
    label: 'Паспорт',
    icon: FileText,
    description: 'Главная страница и прописка',
    color: 'orange',
  },
}

const statusLabels = {
  PENDING: { label: 'На проверке', icon: Clock, color: 'yellow' },
  APPROVED: { label: 'Подтверждён', icon: CheckCircle, color: 'green' },
  REJECTED: { label: 'Отклонён', icon: AlertCircle, color: 'red' },
}

export default function DocumentsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
      fetchDocuments()
    }
  }, [isAuthenticated])

  const fetchDocuments = async () => {
    try {
      // В реальном приложении здесь будет запрос к API
      // Пока используем моковые данные
      setDocuments([])
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getDocumentStatus = (type: keyof typeof documentTypes) => {
    const doc = documents.find((d) => d.type === type)
    return doc?.status
  }

  if (authLoading || isLoading) {
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
          <h1 className="text-xl font-bold ml-2">Документы</h1>
        </div>
      </div>

      {/* Info Banner */}
      <div className="px-4 py-4">
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <p className="text-sm text-primary-800">
            Загрузите все необходимые документы для верификации. После проверки вы сможете принимать заказы.
          </p>
        </div>
      </div>

      {/* Documents List */}
      <div className="px-4 space-y-4 pb-8">
        {Object.entries(documentTypes).map(([type, config]) => {
          const status = getDocumentStatus(type as keyof typeof documentTypes)
          const statusConfig = status ? statusLabels[status] : null
          const Icon = config.icon

          return (
            <motion.button
              key={type}
              onClick={() => {
                // В будущем здесь будет открываться модальное окно загрузки
                alert('Функция загрузки документов в разработке')
              }}
              className="w-full bg-white rounded-2xl p-4 shadow-sm text-left hover:bg-gray-50 transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    config.color === 'blue' ? 'bg-blue-100' :
                    config.color === 'green' ? 'bg-green-100' :
                    config.color === 'purple' ? 'bg-purple-100' :
                    'bg-orange-100'
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 ${
                      config.color === 'blue' ? 'text-blue-500' :
                      config.color === 'green' ? 'text-green-500' :
                      config.color === 'purple' ? 'text-purple-500' :
                      'text-orange-500'
                    }`}
                  />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{config.label}</h3>
                    {statusConfig ? (
                      <span
                        className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                          statusConfig.color === 'green' ? 'bg-green-100 text-green-700' :
                          statusConfig.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}
                      >
                        <statusConfig.icon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        Не загружен
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                </div>
              </div>

              {!status && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-center gap-2 text-primary-500">
                    <Camera className="w-5 h-5" />
                    <span className="font-medium">Загрузить фото</span>
                  </div>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Bottom Info */}
      <div className="px-4 pb-8">
        <div className="bg-gray-100 rounded-xl p-4">
          <h4 className="font-medium mb-2">Требования к фото</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Чёткое изображение без бликов</li>
            <li>• Все данные должны быть читаемы</li>
            <li>• Формат: JPG, PNG до 10 МБ</li>
            <li>• Документы должны быть действующими</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
