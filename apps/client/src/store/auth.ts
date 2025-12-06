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

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  phone: string | null

  setPhone: (phone: string) => void
  setToken: (token: string) => void
  setUser: (user: User) => void
  login: (token: string, user: User) => void
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
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

      login: (token, user) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        set({ token, user, isAuthenticated: true, isLoading: false })
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization']
        set({ token: null, user: null, isAuthenticated: false, phone: null })
      },

      checkAuth: async () => {
        const { token } = get()

        if (!token) {
          set({ isLoading: false })
          return
        }

        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          const response = await api.get('/api/auth/me')
          set({ user: response.data, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ token: null, user: null, isAuthenticated: false, isLoading: false })
          delete api.defaults.headers.common['Authorization']
        }
      },
    }),
    {
      name: 'vibe-taxi-auth',
      partialize: (state) => ({ token: state.token }),
    }
  )
)
