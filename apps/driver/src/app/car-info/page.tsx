'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Car,
  Palette,
  Hash,
  Award,
  Calendar,
  Edit2,
  Save,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'

interface DriverInfo {
  carModel: string
  carNumber: string
  carColor: string
  carClass: string
  carYear?: number
}

const carClassLabels: Record<string, string> = {
  ECONOMY: 'Эконом',
  COMFORT: 'Комфорт',
  BUSINESS: 'Бизнес',
  PREMIUM: 'Премиум',
}

const carClasses = ['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']

export default function CarInfoPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [driver, setDriver] = useState<DriverInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Edit form state
  const [carModel, setCarModel] = useState('')
  const [carNumber, setCarNumber] = useState('')
  const [carColor, setCarColor] = useState('')
  const [carClass, setCarClass] = useState('ECONOMY')

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
      fetchDriverInfo()
    }
  }, [isAuthenticated])

  const fetchDriverInfo = async () => {
    try {
      const response = await api.get('/api/drivers/me')
      setDriver(response.data)
      setCarModel(response.data.carModel || '')
      setCarNumber(response.data.carNumber || '')
      setCarColor(response.data.carColor || '')
      setCarClass(response.data.carClass || 'ECONOMY')
    } catch (err) {
      console.error('Failed to fetch driver info:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await api.patch('/api/drivers/me', {
        carModel,
        carNumber,
        carColor,
        carClass,
      })
      setIsEditing(false)
      fetchDriverInfo()
    } catch (err) {
      console.error('Failed to update car info:', err)
    } finally {
      setIsSaving(false)
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Информация об авто</h1>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 -mr-2"
          >
            {isEditing ? (
              <X className="w-5 h-5 text-gray-500" />
            ) : (
              <Edit2 className="w-5 h-5 text-primary-500" />
            )}
          </button>
        </div>
      </div>

      {/* Car Visual */}
      <div className="bg-gradient-to-b from-primary-500 to-primary-600 p-8">
        <div className="w-24 h-24 bg-white/20 rounded-full mx-auto flex items-center justify-center">
          <Car className="w-12 h-12 text-white" />
        </div>
        <p className="text-center text-white font-bold text-xl mt-4">
          {driver?.carModel || 'Не указано'}
        </p>
        <p className="text-center text-white/80 mt-1">
          {driver?.carNumber || 'Нет номера'}
        </p>
      </div>

      {/* Info Cards */}
      <div className="px-4 py-6 space-y-4">
        {isEditing ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-sm space-y-4"
          >
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Модель автомобиля</label>
              <input
                type="text"
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-primary-500 outline-none"
                placeholder="Например: Audi A4"
              />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Гос. номер</label>
              <input
                type="text"
                value={carNumber}
                onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-primary-500 outline-none"
                placeholder="А123БВ777"
              />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Цвет</label>
              <input
                type="text"
                value={carColor}
                onChange={(e) => setCarColor(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-primary-500 outline-none"
                placeholder="Чёрный"
              />
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Класс автомобиля</label>
              <select
                value={carClass}
                onChange={(e) => setCarClass(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-primary-500 outline-none bg-white"
              >
                {carClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {carClassLabels[cls]}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-primary-500 text-white font-semibold py-3 px-6 rounded-xl hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </motion.div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Car className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Модель</p>
                  <p className="font-medium">{driver?.carModel || 'Не указано'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Hash className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Гос. номер</p>
                  <p className="font-medium">{driver?.carNumber || 'Не указано'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Palette className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Цвет</p>
                  <p className="font-medium">{driver?.carColor || 'Не указано'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Award className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Класс</p>
                  <p className="font-medium">
                    {driver?.carClass ? carClassLabels[driver.carClass] : 'Не указано'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
