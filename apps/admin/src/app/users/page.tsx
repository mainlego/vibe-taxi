'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  MoreVertical,
  User,
  Phone,
  Mail,
  Star,
  Calendar,
  Package,
  Edit2,
  Trash2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { api } from '@/lib/api'
import { clsx } from 'clsx'

interface User {
  id: string
  phone: string
  name: string
  email: string | null
  avatar: string | null
  rating: number
  role: 'CLIENT' | 'DRIVER' | 'ADMIN' | 'SUPPORT'
  isActive: boolean
  createdAt: string
  ordersCount: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const roleLabels: Record<string, { label: string; class: string }> = {
  CLIENT: { label: 'Клиент', class: 'badge-info' },
  DRIVER: { label: 'Водитель', class: 'badge-success' },
  ADMIN: { label: 'Админ', class: 'badge-danger' },
  SUPPORT: { label: 'Поддержка', class: 'badge-warning' },
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })
      if (search) params.append('search', search)
      if (roleFilter) params.append('role', roleFilter)

      const response = await api.get(`/api/admin/users?${params}`)
      return response.data as { users: User[]; pagination: Pagination }
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async (userData: { id: string; data: Partial<User> }) => {
      const response = await api.patch(`/api/admin/users/${userData.id}`, userData.data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setShowEditModal(false)
      setSelectedUser(null)
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/admin/users/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setShowEditModal(true)
    setMenuOpen(null)
  }

  const handleDelete = (user: User) => {
    if (confirm(`Деактивировать пользователя ${user.name}?`)) {
      deleteUserMutation.mutate(user.id)
    }
    setMenuOpen(null)
  }

  const handleToggleActive = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive },
    })
    setMenuOpen(null)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
        <p className="text-gray-500">Управление пользователями системы</p>
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
                placeholder="Поиск по имени, телефону, email..."
                className="input pl-10"
              />
            </div>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPage(1)
            }}
            className="input w-auto"
          >
            <option value="">Все роли</option>
            <option value="CLIENT">Клиенты</option>
            <option value="DRIVER">Водители</option>
            <option value="ADMIN">Администраторы</option>
            <option value="SUPPORT">Поддержка</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Пользователь</th>
                <th className="table-header">Телефон</th>
                <th className="table-header">Рейтинг</th>
                <th className="table-header">Роль</th>
                <th className="table-header">Заказы</th>
                <th className="table-header">Регистрация</th>
                <th className="table-header">Статус</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : data?.users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-8 text-gray-500">
                    Пользователи не найдены
                  </td>
                </tr>
              ) : (
                data?.users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          {user.email && (
                            <p className="text-sm text-gray-500">{user.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        {user.phone}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span>{user.rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${roleLabels[user.role].class}`}>
                        {roleLabels[user.role].label}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Package className="w-4 h-4" />
                        {user.ordersCount}
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">
                      {format(new Date(user.createdAt), 'd MMM yyyy', { locale: ru })}
                    </td>
                    <td className="table-cell">
                      {user.isActive ? (
                        <span className="badge badge-success">Активен</span>
                      ) : (
                        <span className="badge badge-gray">Неактивен</span>
                      )}
                    </td>
                    <td className="table-cell relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>

                      <AnimatePresence>
                        {menuOpen === user.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20 min-w-[180px]"
                          >
                            <button
                              onClick={() => handleEdit(user)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                            >
                              <Edit2 className="w-4 h-4 text-blue-500" />
                              <span>Редактировать</span>
                            </button>
                            <button
                              onClick={() => handleToggleActive(user)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                            >
                              {user.isActive ? (
                                <>
                                  <ShieldOff className="w-4 h-4 text-orange-500" />
                                  <span>Деактивировать</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-4 h-4 text-green-500" />
                                  <span>Активировать</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Удалить</span>
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
        {showEditModal && selectedUser && (
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
                  <h2 className="text-xl font-bold">Редактировать пользователя</h2>
                  <button onClick={() => setShowEditModal(false)} className="p-2 -mr-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <EditUserForm
                  user={selectedUser}
                  onSave={(data) => {
                    updateUserMutation.mutate({ id: selectedUser.id, data })
                  }}
                  isLoading={updateUserMutation.isPending}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EditUserForm({
  user,
  onSave,
  isLoading,
}: {
  user: User
  onSave: (data: Partial<User>) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email || '',
    role: user.role,
    isActive: user.isActive,
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-500 mb-1 block">Имя</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="input"
        />
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="input"
        />
      </div>

      <div>
        <label className="text-sm text-gray-500 mb-1 block">Роль</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
          className="input"
        >
          <option value="CLIENT">Клиент</option>
          <option value="DRIVER">Водитель</option>
          <option value="SUPPORT">Поддержка</option>
          <option value="ADMIN">Администратор</option>
        </select>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
        />
        <span className="text-gray-700">Активный пользователь</span>
      </label>

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
