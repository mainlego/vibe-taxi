'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  Volume2,
  Moon,
  Globe,
  Map,
  CheckCircle,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'

interface Settings {
  notifications: {
    newOrders: boolean
    orderUpdates: boolean
    promotions: boolean
    earnings: boolean
  }
  sounds: {
    newOrder: boolean
    message: boolean
  }
  display: {
    darkMode: boolean
    mapStyle: 'standard' | 'satellite'
    language: 'ru' | 'en'
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [settings, setSettings] = useState<Settings>({
    notifications: {
      newOrders: true,
      orderUpdates: true,
      promotions: false,
      earnings: true,
    },
    sounds: {
      newOrder: true,
      message: true,
    },
    display: {
      darkMode: false,
      mapStyle: 'standard',
      language: 'ru',
    },
  })

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [authLoading, isAuthenticated, router])

  const updateSetting = (
    category: keyof Settings,
    key: string,
    value: boolean | string
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }))
    // Показываем индикатор сохранения
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const Toggle = ({
    enabled,
    onChange,
  }: {
    enabled: boolean
    onChange: (value: boolean) => void
  }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        enabled ? 'bg-primary-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
          enabled ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold ml-2">Настройки</h1>
          </div>
          {saved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-green-500"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Сохранено</span>
            </motion.div>
          )}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Notifications Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="font-bold">Уведомления</h3>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Новые заказы</p>
                <p className="text-sm text-gray-500">Уведомления о новых заказах</p>
              </div>
              <Toggle
                enabled={settings.notifications.newOrders}
                onChange={(v) => updateSetting('notifications', 'newOrders', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Обновления заказов</p>
                <p className="text-sm text-gray-500">Изменения статуса заказа</p>
              </div>
              <Toggle
                enabled={settings.notifications.orderUpdates}
                onChange={(v) => updateSetting('notifications', 'orderUpdates', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Акции и промо</p>
                <p className="text-sm text-gray-500">Специальные предложения</p>
              </div>
              <Toggle
                enabled={settings.notifications.promotions}
                onChange={(v) => updateSetting('notifications', 'promotions', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Доходы</p>
                <p className="text-sm text-gray-500">Уведомления о заработке</p>
              </div>
              <Toggle
                enabled={settings.notifications.earnings}
                onChange={(v) => updateSetting('notifications', 'earnings', v)}
              />
            </div>
          </div>
        </div>

        {/* Sounds Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-purple-500" />
            </div>
            <h3 className="font-bold">Звуки</h3>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Звук нового заказа</p>
                <p className="text-sm text-gray-500">Звуковой сигнал при новом заказе</p>
              </div>
              <Toggle
                enabled={settings.sounds.newOrder}
                onChange={(v) => updateSetting('sounds', 'newOrder', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Звук сообщений</p>
                <p className="text-sm text-gray-500">Звуковой сигнал при сообщении</p>
              </div>
              <Toggle
                enabled={settings.sounds.message}
                onChange={(v) => updateSetting('sounds', 'message', v)}
              />
            </div>
          </div>
        </div>

        {/* Display Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Moon className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="font-bold">Отображение</h3>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Тёмная тема</p>
                <p className="text-sm text-gray-500">Тёмный режим интерфейса</p>
              </div>
              <Toggle
                enabled={settings.display.darkMode}
                onChange={(v) => updateSetting('display', 'darkMode', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Map className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium">Стиль карты</p>
                  <p className="text-sm text-gray-500">
                    {settings.display.mapStyle === 'standard' ? 'Стандартная' : 'Спутник'}
                  </p>
                </div>
              </div>
              <select
                value={settings.display.mapStyle}
                onChange={(e) => updateSetting('display', 'mapStyle', e.target.value)}
                className="bg-gray-100 border-0 rounded-lg px-3 py-2 text-sm"
              >
                <option value="standard">Стандартная</option>
                <option value="satellite">Спутник</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium">Язык</p>
                  <p className="text-sm text-gray-500">
                    {settings.display.language === 'ru' ? 'Русский' : 'English'}
                  </p>
                </div>
              </div>
              <select
                value={settings.display.language}
                onChange={(e) => updateSetting('display', 'language', e.target.value)}
                className="bg-gray-100 border-0 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* Version Info */}
        <div className="text-center text-sm text-gray-400 py-4">
          <p>Vibe Go v1.0.0</p>
        </div>
      </div>
    </div>
  )
}
