'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Car, ArrowRight, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { clsx } from 'clsx'

const carClasses = [
  { id: 'ECONOMY', name: 'Эконом', description: 'Бюджетные авто', icon: '🚗' },
  { id: 'COMFORT', name: 'Комфорт', description: 'Авто среднего класса', icon: '🚙' },
  { id: 'BUSINESS', name: 'Бизнес', description: 'Премиальные авто', icon: '🚘' },
  { id: 'PREMIUM', name: 'Премиум', description: 'Люксовые авто', icon: '🏎️' },
]

export default function RegisterDriverPage() {
  const router = useRouter()
  const { setDriver } = useAuthStore()

  const [carModel, setCarModel] = useState('')
  const [carNumber, setCarNumber] = useState('')
  const [carColor, setCarColor] = useState('')
  const [carYear, setCarYear] = useState('')
  const [carClass, setCarClass] = useState('ECONOMY')
  const [licenseNumber, setLicenseNumber] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!carModel || !carNumber) {
      setError('Заполните обязательные поля')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await api.post('/api/drivers/register', {
        carModel,
        carNumber: carNumber.toUpperCase(),
        carColor: carColor || undefined,
        carYear: carYear ? parseInt(carYear) : undefined,
        carClass,
        licenseNumber: licenseNumber || undefined,
      })

      setDriver(response.data)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка регистрации')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary-500 pt-12 pb-8 px-6">
        <h1 className="text-2xl font-bold text-white">Регистрация водителя</h1>
        <p className="text-primary-100">Заполните данные об автомобиле</p>
      </div>

      <div className="p-6 -mt-4 bg-white rounded-t-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Car Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Марка и модель *
            </label>
            <input
              type="text"
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
              placeholder="Toyota Camry"
              className="input"
            />
          </div>

          {/* Car Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Госномер *
            </label>
            <input
              type="text"
              value={carNumber}
              onChange={(e) => setCarNumber(e.target.value.toUpperCase())}
              placeholder="А123БВ77"
              className="input uppercase"
            />
          </div>

          {/* Car Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Цвет
            </label>
            <input
              type="text"
              value={carColor}
              onChange={(e) => setCarColor(e.target.value)}
              placeholder="Белый"
              className="input"
            />
          </div>

          {/* Car Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Год выпуска
            </label>
            <input
              type="number"
              value={carYear}
              onChange={(e) => setCarYear(e.target.value)}
              placeholder="2022"
              min="1990"
              max={new Date().getFullYear() + 1}
              className="input"
            />
          </div>

          {/* License Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Номер водительского удостоверения
            </label>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="1234567890"
              className="input"
            />
          </div>

          {/* Car Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Класс автомобиля
            </label>
            <div className="grid grid-cols-2 gap-3">
              {carClasses.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setCarClass(cls.id)}
                  className={clsx(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    carClass === cls.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className="text-2xl mb-1 block">{cls.icon}</span>
                  <p className="font-semibold">{cls.name}</p>
                  <p className="text-xs text-gray-500">{cls.description}</p>
                  {carClass === cls.id && (
                    <Check className="w-5 h-5 text-primary-500 absolute top-2 right-2" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Начать работу
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            Нажимая кнопку, вы соглашаетесь с условиями использования сервиса
          </p>
        </motion.div>
      </div>
    </div>
  )
}
