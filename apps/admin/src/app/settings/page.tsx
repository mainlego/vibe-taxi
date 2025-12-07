'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  Phone,
  Mail,
  MapPin,
  Clock,
  DollarSign,
  Save,
  Loader2,
  Crown,
  Edit2,
} from 'lucide-react'
import { api } from '@/lib/api'

interface SettingsData {
  support_phone?: { phone: string }
  support_email?: { email: string }
  company_address?: { address: string }
  surge_multiplier?: { enabled: boolean; maxMultiplier: number }
  driver_search_radius?: { km: number }
  max_order_wait_time?: { minutes: number }
  commission_rate?: { percent: number }
}

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  durationDays: number
  features: string[] | null
  isActive: boolean
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<SettingsData>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price: 0,
    durationDays: 30,
  })

  const { data: settingsData, isLoading } = useQuery<SettingsData>({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await api.get('/api/admin/settings')
      return response.data
    },
  })

  const { data: plans } = useQuery<SubscriptionPlan[]>({
    queryKey: ['admin-subscription-plans'],
    queryFn: async () => {
      const response = await api.get('/api/admin/subscription-plans')
      return response.data
    },
  })

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData)
    }
  }, [settingsData])

  const saveMutation = useMutation({
    mutationFn: async (data: SettingsData) => {
      const response = await api.patch('/api/admin/settings', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      setHasChanges(false)
    },
  })

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SubscriptionPlan> }) => {
      const response = await api.patch(`/api/admin/subscription-plans/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] })
      setEditingPlan(null)
    },
  })

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    saveMutation.mutate(settings)
  }

  const openEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setPlanForm({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      durationDays: plan.durationDays,
    })
  }

  const savePlan = () => {
    if (!editingPlan) return
    updatePlanMutation.mutate({
      id: editingPlan.id,
      data: planForm,
    })
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
          <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
          <p className="text-gray-500">Настройки приложения и сервиса</p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Сохранить изменения
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary-500" />
            Контакты
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Телефон поддержки
              </label>
              <input
                type="tel"
                value={settings.support_phone?.phone || ''}
                onChange={(e) =>
                  updateSetting('support_phone', { phone: e.target.value })
                }
                placeholder="+7 (999) 123-45-67"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email поддержки
              </label>
              <input
                type="email"
                value={settings.support_email?.email || ''}
                onChange={(e) =>
                  updateSetting('support_email', { email: e.target.value })
                }
                placeholder="support@vibe-taxi.ru"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Адрес офиса
              </label>
              <input
                type="text"
                value={settings.company_address?.address || ''}
                onChange={(e) =>
                  updateSetting('company_address', { address: e.target.value })
                }
                placeholder="г. Москва, ул. Примерная, 123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Order Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-500" />
            Параметры заказов
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Радиус поиска водителей (км)
              </label>
              <input
                type="number"
                value={settings.driver_search_radius?.km || 5}
                onChange={(e) =>
                  updateSetting('driver_search_radius', { km: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Макс. время ожидания заказа (мин)
              </label>
              <input
                type="number"
                value={settings.max_order_wait_time?.minutes || 10}
                onChange={(e) =>
                  updateSetting('max_order_wait_time', { minutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Комиссия сервиса (%)
              </label>
              <input
                type="number"
                value={settings.commission_rate?.percent || 15}
                onChange={(e) =>
                  updateSetting('commission_rate', { percent: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Surge Pricing */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary-500" />
            Повышенный спрос
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="surgeEnabled"
                checked={settings.surge_multiplier?.enabled ?? true}
                onChange={(e) =>
                  updateSetting('surge_multiplier', {
                    ...settings.surge_multiplier,
                    enabled: e.target.checked,
                  })
                }
                className="w-4 h-4 text-primary-500 rounded"
              />
              <label htmlFor="surgeEnabled" className="text-sm text-gray-700">
                Включить динамическое ценообразование
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Максимальный коэффициент
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.surge_multiplier?.maxMultiplier || 2.5}
                onChange={(e) =>
                  updateSetting('surge_multiplier', {
                    ...settings.surge_multiplier,
                    maxMultiplier: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Subscription Plan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            Тариф подписки
          </h2>

          {plans && plans.length > 0 && (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  {editingPlan?.id === plan.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={planForm.name}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, name: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Название"
                      />
                      <input
                        type="text"
                        value={planForm.description}
                        onChange={(e) =>
                          setPlanForm({ ...planForm, description: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Описание"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={planForm.price}
                          onChange={(e) =>
                            setPlanForm({ ...planForm, price: Number(e.target.value) })
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Цена"
                        />
                        <input
                          type="number"
                          value={planForm.durationDays}
                          onChange={(e) =>
                            setPlanForm({
                              ...planForm,
                              durationDays: Number(e.target.value),
                            })
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Дней"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={savePlan}
                          disabled={updatePlanMutation.isPending}
                          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => setEditingPlan(null)}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{plan.name}</h3>
                        <p className="text-sm text-gray-500">{plan.description}</p>
                        <p className="text-lg font-bold text-primary-600 mt-1">
                          {plan.price.toLocaleString()} ₽ / {plan.durationDays} дней
                        </p>
                      </div>
                      <button
                        onClick={() => openEditPlan(plan)}
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 bg-blue-50 rounded-xl p-4">
        <div className="flex gap-3">
          <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Примечание</h4>
            <p className="text-sm text-blue-600 mt-1">
              Изменения применяются сразу после сохранения. Будьте осторожны при
              изменении параметров, влияющих на ценообразование.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
