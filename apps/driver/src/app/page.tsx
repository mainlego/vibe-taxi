'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading, driver, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (driver) {
          router.replace('/dashboard')
        } else {
          router.replace('/register-driver')
        }
      } else {
        router.replace('/auth')
      }
    }
  }, [isAuthenticated, isLoading, driver, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-500">
      <div className="text-center text-white">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Vibe Taxi</h1>
        <p className="text-primary-100">Водитель</p>
      </div>
    </div>
  )
}
