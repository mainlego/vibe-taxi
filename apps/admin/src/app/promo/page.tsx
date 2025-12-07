'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  Percent,
  DollarSign,
} from 'lucide-react'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface PromoCode {
  id: string
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  maxDiscount: number | null
  minOrderAmount: number | null
  usageLimit: number | null
  usageCount: number
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  createdAt: string
}

export default function PromoPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FIXED',
    discountValue: 10,
    maxDiscount: '',
    minOrderAmount: '',
    usageLimit: '',
    validFrom: '',
    validUntil: '',
    isActive: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-promo', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const response = await api.get(`/api/admin/promo?${params}`)
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/api/admin/promo', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.patch(`/api/admin/promo/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/promo/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo'] })
    },
  })

  const openCreate = () => {
    setEditingPromo(null)
    setFormData({
      code: '',
      discountType: 'PERCENT',
      discountValue: 10,
      maxDiscount: '',
      minOrderAmount: '',
      usageLimit: '',
      validFrom: '',
      validUntil: '',
      isActive: true,
    })
    setShowModal(true)
  }

  const openEdit = (promo: PromoCode) => {
    setEditingPromo(promo)
    setFormData({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      maxDiscount: promo.maxDiscount?.toString() || '',
      minOrderAmount: promo.minOrderAmount?.toString() || '',
      usageLimit: promo.usageLimit?.toString() || '',
      validFrom: promo.validFrom ? promo.validFrom.split('T')[0] : '',
      validUntil: promo.validUntil ? promo.validUntil.split('T')[0] : '',
      isActive: promo.isActive,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPromo(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: any = {
      code: formData.code.toUpperCase(),
      discountType: formData.discountType,
      discountValue: formData.discountValue,
      isActive: formData.isActive,
    }

    if (formData.maxDiscount) data.maxDiscount = Number(formData.maxDiscount)
    if (formData.minOrderAmount) data.minOrderAmount = Number(formData.minOrderAmount)
    if (formData.usageLimit) data.usageLimit = Number(formData.usageLimit)
    if (formData.validFrom) data.validFrom = new Date(formData.validFrom).toISOString()
    if (formData.validUntil) data.validUntil = new Date(formData.validUntil).toISOString()

    if (editingPromo) {
      updateMutation.mutate({ id: editingPromo.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const toggleActive = (promo: PromoCode) => {
    updateMutation.mutate({
      id: promo.id,
      data: { isActive: !promo.isActive },
    })
  }

  const handleDelete = (promo: PromoCode) => {
    if (confirm(`Удалить промокод "${promo.code}"?`)) {
      deleteMutation.mutate(promo.id)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Промокоды</h1>
          <p className="text-gray-500">Управление скидками и акциями</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition"
        >
          <Plus className="w-5 h-5" />
          Добавить промокод
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по коду..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Код
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Скидка
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Использовано
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Срок действия
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">
                  Статус
                </th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.promoCodes?.map((promo: PromoCode) => (
                <tr key={promo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <span className="font-mono font-semibold">{promo.code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {promo.discountType === 'PERCENT' ? (
                        <>
                          <Percent className="w-4 h-4 text-green-500" />
                          <span>{promo.discountValue}%</span>
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span>{promo.discountValue} ₽</span>
                        </>
                      )}
                      {promo.maxDiscount && (
                        <span className="text-gray-400 text-sm">
                          (макс. {promo.maxDiscount} ₽)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span>
                      {promo.usageCount}
                      {promo.usageLimit && ` / ${promo.usageLimit}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {promo.validFrom || promo.validUntil ? (
                      <>
                        {promo.validFrom &&
                          format(new Date(promo.validFrom), 'dd.MM.yyyy', { locale: ru })}
                        {promo.validFrom && promo.validUntil && ' - '}
                        {promo.validUntil &&
                          format(new Date(promo.validUntil), 'dd.MM.yyyy', { locale: ru })}
                      </>
                    ) : (
                      'Бессрочно'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(promo)}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        promo.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {promo.isActive ? 'Активен' : 'Выключен'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(promo)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(promo)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.promoCodes?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Промокоды не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingPromo ? 'Редактировать промокод' : 'Новый промокод'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Код промокода
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="WELCOME20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Тип скидки
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountType: e.target.value as 'PERCENT' | 'FIXED',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="PERCENT">Процент</option>
                    <option value="FIXED">Фиксированная</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Размер скидки
                  </label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData({ ...formData, discountValue: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Макс. скидка (₽)
                  </label>
                  <input
                    type="number"
                    value={formData.maxDiscount}
                    onChange={(e) =>
                      setFormData({ ...formData, maxDiscount: e.target.value })
                    }
                    placeholder="200"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Мин. сумма заказа
                  </label>
                  <input
                    type="number"
                    value={formData.minOrderAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, minOrderAmount: e.target.value })
                    }
                    placeholder="500"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Лимит использований
                </label>
                <input
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, usageLimit: e.target.value })
                  }
                  placeholder="Без ограничений"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Действует с
                  </label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) =>
                      setFormData({ ...formData, validFrom: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Действует до
                  </label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) =>
                      setFormData({ ...formData, validUntil: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-500 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Промокод активен
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {editingPromo ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
