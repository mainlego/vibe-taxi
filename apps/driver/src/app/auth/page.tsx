'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronLeft, Car } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

// Dynamic import to avoid hydration issues
const TelegramAuthButton = dynamic(
  () => import('@/components/TelegramAuthButton').then(mod => mod.TelegramAuthButton),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center h-14">
        <div className="animate-pulse bg-[#0088cc]/30 rounded-xl w-full h-14" />
      </div>
    )
  }
)

type Step = 'phone' | 'code' | 'register'

const TELEGRAM_BOT_USERNAME = 'vibegotaxi_bot'

export default function AuthPage() {
  const router = useRouter()
  const { setPhone, phone, login } = useAuthStore()

  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Show loading state until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length === 0) return ''
    if (digits.length <= 1) return `+7 (${digits}`
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }

  const getCleanPhone = () => {
    const digits = phoneInput.replace(/\D/g, '')
    return `+7${digits.slice(1)}`
  }

  const handlePhoneSubmit = async () => {
    const cleanPhone = getCleanPhone()
    if (cleanPhone.length !== 12) {
      setError('Введите корректный номер телефона')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await api.post('/api/auth/send-code', { phone: cleanPhone })
      setPhone(cleanPhone)
      setStep('code')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отправки кода')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeSubmit = async () => {
    if (code.length !== 4) {
      setError('Введите 4-значный код')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await api.post('/api/auth/verify', { phone, code })

      if (response.data.isNewUser) {
        setStep('register')
      } else {
        login(response.data.token, response.data.user, response.data.user.driver)
        if (response.data.user.driver) {
          router.push('/dashboard')
        } else {
          router.push('/register-driver')
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Неверный код')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterSubmit = async () => {
    if (name.length < 2) {
      setError('Введите имя (минимум 2 символа)')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await api.post('/api/auth/register', { phone, name, code, role: 'DRIVER' })
      login(response.data.token, response.data.user)
      router.push('/register-driver')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка регистрации')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTelegramAuth = async (user: any) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await api.post('/api/auth/telegram', {
        ...user,
        role: 'DRIVER',
      })
      login(response.data.token, response.data.user, response.data.user.driver)
      if (response.data.user.driver) {
        router.push('/dashboard')
      } else {
        router.push('/register-driver')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка авторизации через Telegram')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col relative overflow-hidden">
      {/* Subtle gradient accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/[0.03] rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary-600/[0.03] rounded-full blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <img
            src="/icons/icon-512x512.png"
            alt="Vibe Go"
            className="w-28 h-28"
          />
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex items-center gap-2 mb-10"
        >
          <Car className="w-4 h-4 text-dark-400" />
          <p className="text-dark-400 text-xs tracking-[0.2em] uppercase">
            Для водителей
          </p>
        </motion.div>
      </div>

      {/* Form Card */}
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="bg-white rounded-t-[2rem] px-6 pt-8 pb-10 min-h-[420px] shadow-[0_-4px_40px_rgba(0,0,0,0.06)]">
          <AnimatePresence mode="wait">
            {step === 'phone' && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-2xl font-semibold text-dark-800 mb-1">Вход</h2>
                <p className="text-dark-300 text-sm mb-8">Введите номер телефона</p>

                <div className="mb-6">
                  <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider mb-2 block">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(formatPhone(e.target.value))}
                    placeholder="+7 (___) ___-__-__"
                    className="w-full px-4 py-4 bg-[#f8f9fa] border border-dark-100/50 rounded-xl text-dark-800 placeholder:text-dark-200 focus:outline-none focus:border-primary-500 focus:bg-white transition-all text-lg"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-red-500 text-sm mb-4">{error}</p>
                )}

                <button
                  onClick={handlePhoneSubmit}
                  disabled={isLoading}
                  className="w-full py-4 bg-dark-800 text-white font-medium rounded-xl flex items-center justify-center gap-3 hover:bg-dark-700 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Продолжить
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dark-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-4 text-dark-300">или</span>
                  </div>
                </div>

                <TelegramAuthButton
                  botUsername={TELEGRAM_BOT_USERNAME}
                  onAuth={handleTelegramAuth}
                  role="DRIVER"
                />

                <p className="text-center text-dark-300 text-xs mt-8">
                  Продолжая, вы принимаете{' '}
                  <span className="text-dark-500 underline underline-offset-2 cursor-pointer">условия использования</span>
                </p>
              </motion.div>
            )}

            {step === 'code' && (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => setStep('phone')}
                  className="flex items-center gap-1 text-dark-400 text-sm mb-6 hover:text-dark-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Назад
                </button>

                <h2 className="text-2xl font-semibold text-dark-800 mb-1">Код подтверждения</h2>
                <p className="text-dark-300 text-sm mb-8">
                  Отправлен на {phone}
                </p>

                <div className="mb-6">
                  <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider mb-3 block text-center">
                    Введите код
                  </label>
                  <div className="flex gap-3 justify-center">
                    {[0, 1, 2, 3].map((i) => (
                      <input
                        key={i}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={code[i] || ''}
                        onChange={(e) => {
                          const newCode = code.split('')
                          newCode[i] = e.target.value
                          setCode(newCode.join(''))
                          if (e.target.value && e.target.nextElementSibling) {
                            (e.target.nextElementSibling as HTMLInputElement).focus()
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !code[i] && e.currentTarget.previousElementSibling) {
                            (e.currentTarget.previousElementSibling as HTMLInputElement).focus()
                          }
                        }}
                        className="w-16 h-16 text-center text-2xl font-semibold bg-[#f8f9fa] border border-dark-100/50 rounded-xl focus:outline-none focus:border-primary-500 focus:bg-white transition-all"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
                )}

                <button
                  onClick={handleCodeSubmit}
                  disabled={isLoading || code.length !== 4}
                  className="w-full py-4 bg-dark-800 text-white font-medium rounded-xl flex items-center justify-center gap-3 hover:bg-dark-700 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Подтвердить
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button className="w-full mt-4 py-3 text-dark-400 text-sm hover:text-primary-600 transition-colors">
                  Отправить код повторно
                </button>
              </motion.div>
            )}

            {step === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-2xl font-semibold text-dark-800 mb-1">Последний шаг</h2>
                <p className="text-dark-300 text-sm mb-8">Как вас зовут?</p>

                <div className="mb-6">
                  <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider mb-2 block">
                    Имя
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Введите имя"
                    className="w-full px-4 py-4 bg-[#f8f9fa] border border-dark-100/50 rounded-xl text-dark-800 placeholder:text-dark-200 focus:outline-none focus:border-primary-500 focus:bg-white transition-all text-lg"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-red-500 text-sm mb-4">{error}</p>
                )}

                <button
                  onClick={handleRegisterSubmit}
                  disabled={isLoading}
                  className="w-full py-4 bg-primary-500 text-white font-medium rounded-xl flex items-center justify-center gap-3 hover:bg-primary-600 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Продолжить
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
