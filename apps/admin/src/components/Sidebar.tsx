'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Car,
  Package,
  Settings,
  DollarSign,
  BarChart3,
  Tag,
} from 'lucide-react'
import { clsx } from 'clsx'

const navigation = [
  { name: 'Дашборд', href: '/', icon: LayoutDashboard },
  { name: 'Заказы', href: '/orders', icon: Package },
  { name: 'Пользователи', href: '/users', icon: Users },
  { name: 'Водители', href: '/drivers', icon: Car },
  { name: 'Тарифы', href: '/tariffs', icon: DollarSign },
  { name: 'Промокоды', href: '/promo', icon: Tag },
  { name: 'Аналитика', href: '/analytics', icon: BarChart3 },
  { name: 'Настройки', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
      <div className="flex items-center gap-3 h-16 px-6 border-b border-gray-200">
        <img
          src="/icons/icon-96x96.png"
          alt="Vibe Go"
          className="w-10 h-10 rounded-lg"
        />
        <div>
          <h1 className="font-bold text-gray-900">Vibe Go</h1>
          <p className="text-xs text-gray-500">Админ панель</p>
        </div>
      </div>

      <nav className="p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-600 font-medium">A</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Admin</p>
            <p className="text-xs text-gray-500">admin@vibe-taxi.ru</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
