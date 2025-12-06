import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

interface User {
  id: string
  phone: string
  name: string
  email?: string
  avatar?: string
  rating: number
  role: string
}

interface Driver {
  id: string
  carModel: string
  carNumber: string
  carColor?: string
  carClass: string
  status: string
  isVerified: boolean
  totalTrips: number
  totalEarnings: number
}

interface AuthState {
  user: User | null
  driver: Driver | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  phone: string | null

  setPhone: (phone: string) => void
  setToken: (token: string) => void
  setUser: (user: User) => void
  setDriver: (driver: Driver) => void
  login: (token: string, user: User, driver?: Driver) => void
  logout: () => void
  checkAuth: () => Promise<void>
  updateDriverStatus: (status: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      driver: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      phone: null,

      setPhone: (phone) => set({ phone }),

      setToken: (token) => {
        set({ token })
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      },

      setUser: (user) => set({ user }),
      setDriver: (driver) => set({ driver }),

      login: (token, user, driver) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        set({ token, user, driver, isAuthenticated: true, isLoading: false })
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization']
        set({ token: null, user: null, driver: null, isAuthenticated: false, phone: null })
      },

      checkAuth: async () => {
        const { token } = get()

        if (!token) {
          set({ isLoading: false })
          return
        }

        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          const [userRes, driverRes] = await Promise.all([
            api.get('/api/auth/me'),
            api.get('/api/drivers/me').catch(() => null),
          ])

          set({
            user: userRes.data,
            driver: driverRes?.data || null,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ token: null, user: null, driver: null, isAuthenticated: false, isLoading: false })
          delete api.defaults.headers.common['Authorization']
        }
      },

      updateDriverStatus: (status) => {
        const { driver } = get()
        if (driver) {
          set({ driver: { ...driver, status } })
        }
      },
    }),
    {
      name: 'vibe-taxi-driver-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
)
