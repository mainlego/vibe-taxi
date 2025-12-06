'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, Clock, User, MapPin } from 'lucide-react'
import { clsx } from 'clsx'
import { motion } from 'framer-motion'
import { useOrderStore } from '@/store/order'

interface NavItem {
  icon: typeof Home
  label: string
  href: string
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Главная', href: '/order' },
  { icon: Clock, label: 'История', href: '/history' },
  { icon: MapPin, label: 'Адреса', href: '/addresses' },
  { icon: User, label: 'Профиль', href: '/profile' },
]

export function BottomNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { currentOrder } = useOrderStore()

  // Hide navigation on auth page, root page, and during active order
  if (pathname === '/auth' || pathname === '/' || (pathname === '/order' && currentOrder)) {
    return null
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-50">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href === '/order' && pathname?.startsWith('/order'))

          return (
            <motion.button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={clsx(
                'flex flex-col items-center justify-center flex-1 h-full relative',
                isActive ? 'text-primary-500' : 'text-gray-400'
              )}
              whileTap={{ scale: 0.9 }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 w-12 h-1 bg-primary-500 rounded-b-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <item.icon className={clsx('w-6 h-6', isActive && 'stroke-[2.5px]')} />
              <span className={clsx(
                'text-xs mt-1',
                isActive ? 'font-semibold' : 'font-medium'
              )}>
                {item.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
