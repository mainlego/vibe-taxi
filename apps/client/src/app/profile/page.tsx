'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  User,
  Phone,
  Star,
  History,
  MapPin,
  CreditCard,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Edit2,
  Camera,
  MessageCircle,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface UserProfile {
  id: string
  name: string
  phone: string
  email: string | null
  avatar: string | null
  rating: number
  role: string
  createdAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, checkAuth, logout } = useAuthStore()

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
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
    }
  }, [user])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const data: { name?: string; email?: string } = {}
      if (name) data.name = name
      if (email && email.includes('@')) data.email = email

      await api.patch('/api/users/me', data)
      setIsEditing(false)
      checkAuth()
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

      await api.post('/api/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Refresh auth to get updated avatar
      checkAuth()
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const menuItems = [
    {
      icon: History,
      label: 'История поездок',
      href: '/history',
      color: 'text-blue-500',
    },
    {
      icon: MessageCircle,
      label: 'Отзывы',
      href: '/reviews',
      color: 'text-orange-500',
    },
    {
      icon: MapPin,
      label: 'Сохранённые адреса',
      href: '/addresses',
      color: 'text-green-500',
    },
    {
      icon: CreditCard,
      label: 'Способы оплаты',
      href: '/payments',
      color: 'text-purple-500',
    },
    {
      icon: Bell,
      label: 'Уведомления',
      href: '/notifications',
      color: 'text-yellow-500',
    },
    {
      icon: HelpCircle,
      label: 'Помощь',
      href: '/help',
      color: 'text-gray-500',
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
                <h2 className="text-xl font-bold">{user?.name}</h2>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <Phone className="w-4 h-4" />
                <span>{user?.phone}</span>
              </div>

              <div className="flex items-center gap-1 mt-2">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{user?.rating?.toFixed(1)}</span>
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
                  className="flex-1 btn-primary"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
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
              <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center', `bg-${item.color.split('-')[1]}-100`)}>
                <item.icon className={clsx('w-5 h-5', item.color)} />
              </div>
              <span className="flex-1 font-medium">{item.label}</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Logout button */}
      <div className="px-4 mt-6 pb-8">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 text-red-500 font-medium bg-white rounded-2xl shadow-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}
