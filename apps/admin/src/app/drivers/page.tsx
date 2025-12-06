'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  MoreVertical,
  Car,
  Phone,
  Star,
  Calendar,
  Package,
  Edit2,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  MapPin,
  DollarSign,
  User,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface Driver {
  id: string
  userId: string
  carModel: string
  carNumber: string
  carColor: string | null
  carYear: number | null
  carClass: 'ECONOMY' | 'COMFORT' | 'BUSINESS' | 'PREMIUM'
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'BREAK'
  isVerified: boolean
  totalTrips: number
  totalEarnings: number
  acceptanceRate: number
  createdAt: string
  user: {
    id: string
    phone: string
    name: string
    avatar: string | null
    rating: number
    isActive: boolean
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusLabels: Record<string, { label: string; class: string }> = {
  ONLINE: { label: 'Онлайн', class: 'badge-success' },
  OFFLINE: { label: 'Оффлайн', class: 'badge-gray' },
  BUSY: { label: 'Занят', class: 'badge-warning' },
  BREAK: { label: 'Перерыв', class: 'badge-info' },
}

const carClassLabels: Record<string, string> = {
  ECONOMY: 'Эконом',
  COMFORT: 'Комфорт',
  BUSINESS: 'Бизнес',
  PREMIUM: 'Премиум',
}

export default function DriversPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-drivers', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)

      const response = await api.get(`/api/admin/drivers?${params}`)
      return response.data as { drivers: Driver[]; pagination: Pagination }
    },
  })

  const updateDriverMutation = useMutation({
    mutationFn: async (driverData: { id: string; data: Partial<Driver> }) => {
      const response = await api.patch(`/api/admin/drivers/${driverData.id}`, driverData.data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] })
      setShowEditModal(false)
      setSelectedDriver(null)
    },
  })

  const verifyDriverMutation = useMutation({
    mutationFn: async ({ id, isVerified }: { id: string; isVerified: boolean }) => {
      const response = await api.patch(`/api/admin/drivers/${id}/verify`, { isVerified })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] })
    },
  })

  const handleEdit = (driver: Driver) => {
    setSelectedDriver(driver)
    setShowEditModal(true)
    setMenuOpen(null)
  }

  const handleViewDetails = (driver: Driver) => {
    setSelectedDriver(driver)
    setShowDetailModal(true)
    setMenuOpen(null)
  }

  const handleVerify = (driver: Driver) => {
    verifyDriverMutation.mutate({ id: driver.id, isVerified: !driver.isVerified })
    setMenuOpen(null)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Водители</h1>
        <p className="text-gray-500">Управление водителями и автомобилями</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.drivers.filter(d => d.status === 'ONLINE').length || 0}</p>
              <p className="text-sm text-gray-500">Онлайн</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.drivers.filter(d => d.status === 'BUSY').length || 0}</p>
              <p className="text-sm text-gray-500">На заказе</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.drivers.filter(d => d.isVerified).length || 0}</p>
              <p className="text-sm text-gray-500">Верифицировано</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.drivers.filter(d => !d.isVerified).length || 0}</p>
              <p className="text-sm text-gray-500">Ожидает проверки</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Поиск по имени, телефону, номеру авто..."
                className="input pl-10"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="input w-auto"
          >
            <option value="">Все статусы</option>
            <option value="ONLINE">Онлайн</option>
            <option value="OFFLINE">Оффлайн</option>
            <option value="BUSY">Занят</option>
            <option value="BREAK">Перерыв</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Водитель</th>
                <th className="table-header">Автомобиль</th>
                <th className="table-header">Класс</th>
                <th className="table-header">Рейтинг</th>
                <th className="table-header">Поездок</th>
                <th className="table-header">Заработок</th>
                <th className="table-header">Статус</th>
                <th className="table-header">Верификация</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-8">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : data?.drivers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center py-8 text-gray-500">
                    Водители не найдены
                  </td>
                </tr>
              ) : (
                data?.drivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                          {driver.user.avatar ? (
                            <img src={driver.user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{driver.user.name}</p>
                          <p className="text-sm text-gray-500">{driver.user.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{driver.carModel}</p>
                          <p className="text-sm text-gray-500">{driver.carNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="badge badge-info">{carClassLabels[driver.carClass]}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span>{driver.user.rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Package className="w-4 h-4" />
                        {driver.totalTrips}
                      </div>
                    </td>
                    <td className="table-cell font-medium">
                      {driver.totalEarnings.toLocaleString()} ₽
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${statusLabels[driver.status].class}`}>
                        {statusLabels[driver.status].label}
                      </span>
                    </td>
                    <td className="table-cell">
                      {driver.isVerified ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          Да
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500">
                          <XCircle className="w-4 h-4" />
                          Нет
                        </span>
                      )}
                    </td>
                    <td className="table-cell relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === driver.id ? null : driver.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>

                      <AnimatePresence>
                        {menuOpen === driver.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20 min-w-[180px]"
                          >
                            <button
                              onClick={() => handleViewDetails(driver)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                            >
                              <User className="w-4 h-4 text-gray-500" />
                              <span>Подробнее</span>
                            </button>
                            <button
                              onClick={() => handleEdit(driver)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                            >
                              <Edit2 className="w-4 h-4 text-blue-500" />
                              <span>Редактировать</span>
                            </button>
                            <button
                              onClick={() => handleVerify(driver)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                            >
                              {driver.isVerified ? (
                                <>
                                  <XCircle className="w-4 h-4 text-red-500" />
                                  <span>Отменить верификацию</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <span>Верифицировать</span>
                                </>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Показано {(page - 1) * 20 + 1} - {Math.min(page * 20, data.pagination.total)} из{' '}
              {data.pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={clsx(
                      'w-10 h-10 rounded-lg font-medium',
                      page === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'hover:bg-gray-100'
                    )}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.totalPages}
                className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && selectedDriver && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Редактировать водителя</h2>
                  <button onClick={() => setShowEditModal(false)} className="p-2 -mr-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <EditDriverForm
                  driver={selectedDriver}
                  onSave={(data) => {
                    updateDriverMutation.mutate({ id: selectedDriver.id, data })
                  }}
                  isLoading={updateDriverMutation.isPending}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedDriver && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Информация о водителе</h2>
                  <button onClick={() => setShowDetailModal(false)} className="p-2 -mr-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Driver info */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      {selectedDriver.user.avatar ? (
                        <img src={selectedDriver.user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{selectedDriver.user.name}</h3>
                      <p className="text-gray-500">{selectedDriver.user.phone}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span>{selectedDriver.user.rating.toFixed(1)}</span>
                        <span className={`badge ${statusLabels[selectedDriver.status].class} ml-2`}>
                          {statusLabels[selectedDriver.status].label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Car info */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-medium mb-3">Автомобиль</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Модель</p>
                        <p className="font-medium">{selectedDriver.carModel}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Номер</p>
                        <p className="font-medium">{selectedDriver.carNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Цвет</p>
                        <p className="font-medium">{selectedDriver.carColor || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Год</p>
                        <p className="font-medium">{selectedDriver.carYear || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Класс</p>
                        <p className="font-medium">{carClassLabels[selectedDriver.carClass]}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                      <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-600">{selectedDriver.totalTrips}</p>
                      <p className="text-sm text-blue-500">Поездок</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-xl">
                      <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-600">{(selectedDriver.totalEarnings / 1000).toFixed(0)}K</p>
                      <p className="text-sm text-green-500">Заработок</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-xl">
                      <CheckCircle className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-600">{selectedDriver.acceptanceRate}%</p>
                      <p className="text-sm text-purple-500">Принято</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 text-center">
                    Зарегистрирован {format(new Date(selectedDriver.createdAt), 'd MMMM yyyy', { locale: ru })}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EditDriverForm({
  driver,
  onSave,
  isLoading,
}: {
  driver: Driver
  onSave: (data: Partial<Driver>) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    carModel: driver.carModel,
    carNumber: driver.carNumber,
    carColor: driver.carColor || '',
    carYear: driver.carYear || new Date().getFullYear(),
    carClass: driver.carClass,
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-500 mb-1 block">Модель автомобиля</label>
        <input
          type="text"
          value={formData.carModel}
          onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
          className="input"
        />
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">Номер автомобиля</label>
        <input
          type="text"
          value={formData.carNumber}
          onChange={(e) => setFormData({ ...formData, carNumber: e.target.value })}
          className="input"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Цвет</label>
          <input
            type="text"
            value={formData.carColor}
            onChange={(e) => setFormData({ ...formData, carColor: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Год выпуска</label>
          <input
            type="number"
            value={formData.carYear}
            onChange={(e) => setFormData({ ...formData, carYear: parseInt(e.target.value) })}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">Класс</label>
        <select
          value={formData.carClass}
          onChange={(e) => setFormData({ ...formData, carClass: e.target.value as any })}
          className="input"
        >
          <option value="ECONOMY">Эконом</option>
          <option value="COMFORT">Комфорт</option>
          <option value="BUSINESS">Бизнес</option>
          <option value="PREMIUM">Премиум</option>
        </select>
      </div>

      <button
        onClick={() => onSave(formData)}
        disabled={isLoading}
        className="btn-primary w-full mt-6"
      >
        {isLoading ? 'Сохранение...' : 'Сохранить'}
      </button>
    </div>
  )
}
