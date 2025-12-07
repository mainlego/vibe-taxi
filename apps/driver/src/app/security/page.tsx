'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Shield,
  Lock,
  Smartphone,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export default function SecurityPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [authLoading, isAuthenticated, router])

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Пароли не совпадают' })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Пароль должен быть не менее 6 символов' })
      return
    }

    setIsSaving(true)
    try {
      // В реальном приложении здесь будет запрос к API
      await new Promise(resolve => setTimeout(resolve, 1000))
      setMessage({ type: 'success', text: 'Пароль успешно изменён' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка при смене пароля' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle2FA = async () => {
    setIsSaving(true)
    try {
      // В реальном приложении здесь будет запрос к API
      await new Promise(resolve => setTimeout(resolve, 500))
      setTwoFactorEnabled(!twoFactorEnabled)
      setMessage({
        type: 'success',
        text: twoFactorEnabled
          ? 'Двухфакторная аутентификация отключена'
          : 'Двухфакторная аутентификация включена',
      })
    } catch (err) {
      setMessage({ type: 'error', text: 'Ошибка при изменении настроек' })
    } finally {
      setIsSaving(false)
    }
  }

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
          <h1 className="text-xl font-bold ml-2">Безопасность</h1>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="px-4 py-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            <span className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {message.text}
            </span>
          </motion.div>
        </div>
      )}

      <div className="px-4 py-6 space-y-6">
        {/* Password Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold">Изменить пароль</h3>
              <p className="text-sm text-gray-500">Обновите пароль для защиты аккаунта</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Текущий пароль</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:border-primary-500 outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Новый пароль</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:border-primary-500 outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Подтвердите пароль</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-primary-500 outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              onClick={handlePasswordChange}
              disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
              className="w-full bg-primary-500 text-white font-semibold py-3 px-6 rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Сохранение...' : 'Изменить пароль'}
            </button>
          </div>
        </div>

        {/* Two-Factor Auth Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-bold">Двухфакторная аутентификация</h3>
                <p className="text-sm text-gray-500">Дополнительная защита через SMS</p>
              </div>
            </div>

            <button
              onClick={handleToggle2FA}
              disabled={isSaving}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                twoFactorEnabled ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  twoFactorEnabled ? 'left-8' : 'left-1'
                }`}
              />
            </button>
          </div>

          {twoFactorEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-gray-100"
            >
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Двухфакторная аутентификация активна</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Session Security */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Key className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-bold">Активные сессии</h3>
              <p className="text-sm text-gray-500">Управление устройствами</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">Текущее устройство</p>
                  <p className="text-xs text-gray-500">Активно сейчас</p>
                </div>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Активно
              </span>
            </div>
          </div>

          <button className="w-full mt-4 text-red-500 font-medium py-3 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
            Выйти со всех устройств
          </button>
        </div>
      </div>
    </div>
  )
}
