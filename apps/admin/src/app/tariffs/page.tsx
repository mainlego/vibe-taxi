'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Edit2, Save, X, Car } from 'lucide-react'
import { api } from '@/lib/api'

interface Tariff {
  id: string
  carClass: 'ECONOMY' | 'COMFORT' | 'BUSINESS' | 'PREMIUM'
  baseFare: number
  perKm: number
  perMinute: number
  minFare: number
  surgeFactor: number
}

const carClassNames: Record<string, string> = {
  ECONOMY: 'Эконом',
  COMFORT: 'Комфорт',
  BUSINESS: 'Бизнес',
  PREMIUM: 'Премиум',
}

const carClassColors: Record<string, string> = {
  ECONOMY: 'bg-green-100 text-green-700',
  COMFORT: 'bg-blue-100 text-blue-700',
  BUSINESS: 'bg-purple-100 text-purple-700',
  PREMIUM: 'bg-yellow-100 text-yellow-700',
}

export default function TariffsPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Tariff>>({})

  const { data: tariffs, isLoading } = useQuery<Tariff[]>({
    queryKey: ['admin-tariffs'],
    queryFn: async () => {
      const response = await api.get('/api/admin/tariffs')
      return response.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Tariff> }) => {
      const response = await api.patch(`/api/admin/tariffs/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] })
      setEditingId(null)
      setEditData({})
    },
  })

  const startEdit = (tariff: Tariff) => {
    setEditingId(tariff.id)
    setEditData({
      baseFare: tariff.baseFare,
      perKm: tariff.perKm,
      perMinute: tariff.perMinute,
      minFare: tariff.minFare,
      surgeFactor: tariff.surgeFactor,
    })
  }

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, data: editData })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Тарифы</h1>
          <p className="text-gray-500">Управление ценами на поездки</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {tariffs?.map((tariff) => (
          <div
            key={tariff.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${carClassColors[tariff.carClass]}`}>
                    <Car className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {carClassNames[tariff.carClass]}
                    </h3>
                    <p className="text-sm text-gray-500">{tariff.carClass}</p>
                  </div>
                </div>
                {editingId === tariff.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(tariff.id)}
                      disabled={updateMutation.isPending}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(tariff)}
                    className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Базовая ставка
                  </label>
                  {editingId === tariff.id ? (
                    <input
                      type="number"
                      value={editData.baseFare || ''}
                      onChange={(e) =>
                        setEditData({ ...editData, baseFare: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <p className="text-lg font-semibold">{tariff.baseFare} ₽</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    За километр
                  </label>
                  {editingId === tariff.id ? (
                    <input
                      type="number"
                      value={editData.perKm || ''}
                      onChange={(e) =>
                        setEditData({ ...editData, perKm: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <p className="text-lg font-semibold">{tariff.perKm} ₽/км</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    За минуту
                  </label>
                  {editingId === tariff.id ? (
                    <input
                      type="number"
                      value={editData.perMinute || ''}
                      onChange={(e) =>
                        setEditData({ ...editData, perMinute: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <p className="text-lg font-semibold">{tariff.perMinute} ₽/мин</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Мин. стоимость
                  </label>
                  {editingId === tariff.id ? (
                    <input
                      type="number"
                      value={editData.minFare || ''}
                      onChange={(e) =>
                        setEditData({ ...editData, minFare: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <p className="text-lg font-semibold">{tariff.minFare} ₽</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Коэффициент повышения</span>
                  {editingId === tariff.id ? (
                    <input
                      type="number"
                      step="0.1"
                      value={editData.surgeFactor || ''}
                      onChange={(e) =>
                        setEditData({ ...editData, surgeFactor: Number(e.target.value) })
                      }
                      className="w-20 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-center"
                    />
                  ) : (
                    <span className="font-semibold text-primary-600">
                      x{tariff.surgeFactor || 1}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 rounded-xl p-4">
        <div className="flex gap-3">
          <DollarSign className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Как рассчитывается стоимость</h4>
            <p className="text-sm text-blue-600 mt-1">
              Стоимость = Базовая ставка + (Расстояние × За км) + (Время × За минуту)
              <br />
              Если итоговая сумма меньше минимальной стоимости, применяется минимальная стоимость.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
