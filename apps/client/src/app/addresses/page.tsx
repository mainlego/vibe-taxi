'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  Home,
  Briefcase,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Star,
  X,
  Navigation,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface Address {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  isDefault: boolean
  createdAt: string
}

export default function AddressesPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    lat: 0,
    lng: 0,
    isDefault: false,
  })
  const [isSaving, setIsSaving] = useState(false)

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
      fetchAddresses()
    }
  }, [isAuthenticated])

  const fetchAddresses = async () => {
    try {
      const response = await api.get('/api/users/me/addresses')
      setAddresses(response.data)
    } catch (err) {
      console.error('Failed to fetch addresses:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name || !formData.address) return

    setIsSaving(true)
    try {
      if (editingAddress) {
        await api.patch(`/api/users/me/addresses/${editingAddress.id}`, formData)
      } else {
        await api.post('/api/users/me/addresses', formData)
      }
      await fetchAddresses()
      handleCloseModal()
    } catch (err) {
      console.error('Failed to save address:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/users/me/addresses/${id}`)
      setAddresses(addresses.filter((a) => a.id !== id))
    } catch (err) {
      console.error('Failed to delete address:', err)
    }
    setMenuOpen(null)
  }

  const handleSetDefault = async (id: string) => {
    try {
      await api.patch(`/api/users/me/addresses/${id}`, { isDefault: true })
      await fetchAddresses()
    } catch (err) {
      console.error('Failed to set default:', err)
    }
    setMenuOpen(null)
  }

  const handleEdit = (address: Address) => {
    setEditingAddress(address)
    setFormData({
      name: address.name,
      address: address.address,
      lat: address.lat,
      lng: address.lng,
      isDefault: address.isDefault,
    })
    setShowAddModal(true)
    setMenuOpen(null)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingAddress(null)
    setFormData({ name: '', address: '', lat: 0, lng: 0, isDefault: false })
  }

  const getIcon = (name: string) => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('дом') || lowerName.includes('home')) {
      return <Home className="w-5 h-5 text-blue-500" />
    }
    if (lowerName.includes('работ') || lowerName.includes('офис') || lowerName.includes('work')) {
      return <Briefcase className="w-5 h-5 text-purple-500" />
    }
    return <MapPin className="w-5 h-5 text-gray-500" />
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold">Сохранённые адреса</h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Адресов пока нет</h2>
          <p className="text-gray-500 text-center mb-6">
            Добавьте часто используемые адреса для быстрого заказа
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            Добавить адрес
          </button>
        </div>
      ) : (
        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
            {addresses.map((address) => (
              <div key={address.id} className="relative">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    {getIcon(address.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{address.name}</span>
                      {address.isDefault && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                          По умолчанию
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{address.address}</p>
                  </div>

                  <button
                    onClick={() => setMenuOpen(menuOpen === address.id ? null : address.id)}
                    className="p-2"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Dropdown menu */}
                <AnimatePresence>
                  {menuOpen === address.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-4 top-14 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20"
                    >
                      {!address.isDefault && (
                        <button
                          onClick={() => handleSetDefault(address.id)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
                        >
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>По умолчанию</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(address)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
                      >
                        <Edit2 className="w-4 h-4 text-blue-500" />
                        <span>Редактировать</span>
                      </button>
                      <button
                        onClick={() => handleDelete(address.id)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Удалить</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overlay for menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl w-full"
            >
              <div className="p-6 pb-24">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">
                    {editingAddress ? 'Редактировать' : 'Новый адрес'}
                  </h2>
                  <button onClick={handleCloseModal} className="p-2 -mr-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Название</label>
                    <div className="flex gap-2 mb-2">
                      {['Дом', 'Работа'].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setFormData({ ...formData, name: preset })}
                          className={clsx(
                            'px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                            formData.name === preset
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-primary-500 outline-none"
                      placeholder="Например: Дом, Работа, Спортзал"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Адрес</label>
                    <div className="relative">
                      <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 pl-12 focus:border-primary-500 outline-none"
                        placeholder="Введите адрес"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-gray-700">Использовать по умолчанию</span>
                  </label>
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.name || !formData.address}
                  className="btn-primary w-full mt-6"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
