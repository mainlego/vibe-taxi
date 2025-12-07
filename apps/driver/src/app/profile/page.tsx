'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  User,
  Phone,
  Star,
  Car,
  Clock,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Edit2,
  Camera,
  Shield,
  FileText,
  Users,
  Gift,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface DriverProfile {
  id: string
  name: string
  phone: string
  email: string | null
  avatar: string | null
  rating: number
  carModel: string
  carNumber: string
  carColor: string
  carClass: string
  status: string
  totalTrips: number
  createdAt: string
}

const carClassLabels: Record<string, string> = {
  ECONOMY: 'Эконом',
  COMFORT: 'Комфорт',
  BUSINESS: 'Бизнес',
  PREMIUM: 'Премиум',
}

export default function DriverProfilePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, checkAuth, logout } = useAuthStore()

  const [driver, setDriver] = useState<DriverProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      fetchProfile()
    }
  }, [isAuthenticated])

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/drivers/me')
      setDriver(response.data)
      setName(response.data.name || '')
      setEmail(response.data.email || '')
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const data: { name?: string; email?: string } = {}
      if (name) data.name = name
      if (email && email.includes('@')) data.email = email

      await api.patch('/api/users/me', data)
      setIsEditing(false)
      fetchProfile()
    } catch (err) {
      console.error('Failed to update profile:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.replace('/auth')
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      alert('Допустимые форматы: JPEG, PNG, WebP, GIF')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Максимальный размер файла: 5 МБ')
      return
    }

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.post('/api/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Refresh auth to get updated avatar
      checkAuth()
      fetchProfile()
    } catch (err) {
      console.error('Failed to upload avatar:', err)
      alert('Не удалось загрузить фото')
    } finally {
      setIsUploadingAvatar(false)
      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const menuItems = [
    {
      icon: Users,
      label: 'Реферальная программа',
      description: 'Приглашайте друзей и получайте бонусы',
      href: '/referrals',
      color: 'text-primary-500',
      badge: 'Бонусы',
    },
    {
      icon: Car,
      label: 'Информация об авто',
      description: driver ? `${driver.carModel} • ${driver.carNumber}` : '',
      href: '/car-info',
      color: 'text-blue-500',
    },
    {
      icon: FileText,
      label: 'Документы',
      description: 'Права, СТС, страховка',
      href: '/documents',
      color: 'text-purple-500',
    },
    {
      icon: Shield,
      label: 'Безопасность',
      description: 'Пароль, двухфакторная аутентификация',
      href: '/security',
      color: 'text-green-500',
    },
    {
      icon: Settings,
      label: 'Настройки',
      description: 'Уведомления, звуки',
      href: '/settings',
      color: 'text-gray-500',
    },
    {
      icon: HelpCircle,
      label: 'Помощь',
      description: 'FAQ, связаться с поддержкой',
      href: '/help',
      color: 'text-orange-500',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary-500 to-primary-600 text-white pb-20">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Профиль</h1>
          <button onClick={() => setIsEditing(!isEditing)} className="p-2 -mr-2">
            <Edit2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Profile Card */}
      <div className="px-4 -mt-16 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {isUploadingAvatar ? (
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                ) : user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-gray-400" />
                )}
              </div>
              <button
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xl font-bold w-full border-b border-gray-300 focus:border-primary-500 outline-none pb-1"
                  placeholder="Ваше имя"
                />
              ) : (
                <h2 className="text-xl font-bold">{driver?.name || user?.name}</h2>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <Phone className="w-4 h-4" />
                <span>{user?.phone}</span>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-medium">{driver?.rating?.toFixed(1) || '5.0'}</span>
                </div>
                <span className="text-gray-300">•</span>
                <span className="text-sm text-gray-500">{driver?.totalTrips || 0} поездок</span>
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-primary-500 outline-none"
                  placeholder="example@email.com"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 btn-secondary"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 bg-primary-500 text-white font-semibold py-3 px-6 rounded-xl hover:bg-primary-600 transition-colors"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}

          {/* Car info badge */}
          {driver && (
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <Car className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{driver.carModel}</p>
                <p className="text-sm text-gray-500">{driver.carColor} • {driver.carNumber}</p>
              </div>
              <span className="text-sm bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-medium">
                {carClassLabels[driver.carClass] || driver.carClass}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 mt-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <Star className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-xl font-bold">{driver?.rating?.toFixed(1) || '5.0'}</p>
            <p className="text-xs text-gray-500">Рейтинг</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <Car className="w-6 h-6 text-primary-500 mx-auto mb-2" />
            <p className="text-xl font-bold">{driver?.totalTrips || 0}</p>
            <p className="text-xs text-gray-500">Поездок</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-sm">
            <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-xl font-bold">
              {driver?.createdAt ? Math.floor((Date.now() - new Date(driver.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0}
            </p>
            <p className="text-xs text-gray-500">Дней в сервисе</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={clsx(
                'w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-gray-50 transition-colors',
                index !== menuItems.length - 1 && 'border-b border-gray-100'
              )}
              whileTap={{ scale: 0.98 }}
            >
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center',
                item.color === 'text-blue-500' && 'bg-blue-100',
                item.color === 'text-purple-500' && 'bg-purple-100',
                item.color === 'text-green-500' && 'bg-green-100',
                item.color === 'text-gray-500' && 'bg-gray-100',
                item.color === 'text-orange-500' && 'bg-orange-100',
                item.color === 'text-primary-500' && 'bg-primary-100',
              )}>
                <item.icon className={clsx('w-5 h-5', item.color)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  {'badge' in item && item.badge && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Logout button */}
      <div className="px-4 mt-6 pb-8">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 text-red-500 font-medium bg-white rounded-2xl shadow-sm hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}
