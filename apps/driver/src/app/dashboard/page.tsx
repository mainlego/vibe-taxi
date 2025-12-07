'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Navigation,
  Power,
  Star,
  Phone,
  MessageCircle,
  Clock,
  Route,
  Check,
  X,
  Locate,
  Menu,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useOrderStore } from '@/store/order'
import { api } from '@/lib/api'
import { connectSocket, getSocket, onSocketReady, startLocationUpdates, stopLocationUpdates } from '@/lib/socket'
import { clsx } from 'clsx'
import { Map } from '@/components/Map'
import { OrderBottomSheet, SimpleBottomSheet } from '@/components/BottomSheet'
import { useYandexMap } from '@/hooks/useYandexMap'
import { formatDistance, formatDuration } from '@/lib/yandex-maps'

type OrderStep = 'idle' | 'new-order' | 'accepted' | 'arrived' | 'in-progress' | 'completed'

export default function DashboardPage() {
  const router = useRouter()
  const { user, driver, token, isAuthenticated, isLoading: authLoading, checkAuth, updateDriverStatus } = useAuthStore()
  const { availableOrders, currentOrder, addAvailableOrder, removeAvailableOrder, setCurrentOrder, updateOrderStatus, reset } = useOrderStore()

  const [step, setStep] = useState<OrderStep>('idle')
  const [isOnline, setIsOnline] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<any>(null)
  const [stats, setStats] = useState({ today: { trips: 0, earnings: 0 }, week: { trips: 0, earnings: 0 } })
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null)
  const [completedOrder, setCompletedOrder] = useState<any>(null)
  const [clientRating, setClientRating] = useState<number>(5)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null)
  const [checkingSubscription, setCheckingSubscription] = useState(false)

  const mapRef = useRef<ReturnType<typeof useYandexMap> | null>(null)
  const pendingOrderRef = useRef<any>(null)
  const isOnlineRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => {
    pendingOrderRef.current = pendingOrder
  }, [pendingOrder])

  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    } else if (!authLoading && isAuthenticated && !driver) {
      router.replace('/register-driver')
    }
  }, [authLoading, isAuthenticated, driver, router])

  // Initialize isOnline from driver status and ensure socket is connected
  useEffect(() => {
    if (driver && token && user) {
      const online = driver.status === 'ONLINE' || driver.status === 'BUSY'
      setIsOnline(online)
      if (online) {
        // Make sure socket is connected when driver is online
        connectSocket(token, user.id, driver.id)
        startLocationUpdates(driver.id)
      }
    }
  }, [driver, token, user])

  // Fetch stats
  useEffect(() => {
    if (isAuthenticated && driver) {
      api.get('/api/drivers/me/stats').then((res) => setStats(res.data)).catch(() => {})
    }
  }, [isAuthenticated, driver])

  // Load active order on mount (for page refresh persistence)
  useEffect(() => {
    if (isAuthenticated && driver) {
      const loadActiveOrder = async () => {
        try {
          const response = await api.get('/api/drivers/me/active-order')
          if (response.data) {
            const order = response.data
            console.log('📋 Loaded active order for driver:', order)
            setCurrentOrder(order)

            // Set step based on order status
            switch (order.status) {
              case 'ACCEPTED':
                setStep('accepted')
                break
              case 'ARRIVED':
                setStep('arrived')
                break
              case 'IN_PROGRESS':
                setStep('in-progress')
                break
            }

            // Show route on map
            if (mapRef.current && order.pickupLat && order.pickupLng) {
              mapRef.current.addMarker('pickup', [order.pickupLat, order.pickupLng], {
                preset: 'islands#greenDotIcon'
              })
              mapRef.current.addMarker('dropoff', [order.dropoffLat, order.dropoffLng], {
                preset: 'islands#redDotIcon'
              })
            }
          }
        } catch (err) {
          console.error('Failed to load active order:', err)
        }
      }
      loadActiveOrder()
    }
  }, [isAuthenticated, driver, setCurrentOrder])

  // Socket connection
  useEffect(() => {
    if (isAuthenticated && token && user && driver) {
      connectSocket(token, user.id, driver.id)

      // Setup event handlers after socket is authenticated
      const setupSocketHandlers = () => {
        const socket = getSocket()
        console.log('🔌 Setting up driver socket event handlers, socket ID:', socket.id)

        socket.on('order:available', (order) => {
          console.log('📥 Received order:available:', order.id, 'isOnline:', isOnlineRef.current)
          // Server only sends orders to ONLINE drivers, so we accept them
          // But also check local state in case of race conditions
          setPendingOrder(order)
          setStep('new-order')
          // Show pickup location on map
          if (mapRef.current && order.pickupLat && order.pickupLng) {
            mapRef.current.addMarker('pickup', [order.pickupLat, order.pickupLng], {
              preset: 'islands#greenDotIcon'
            })
            mapRef.current.addMarker('dropoff', [order.dropoffLat, order.dropoffLng], {
              preset: 'islands#redDotIcon'
            })
            mapRef.current.fitBounds([
              [order.pickupLat, order.pickupLng],
              [order.dropoffLat, order.dropoffLng]
            ])
          }
        })

        socket.on('order:taken', ({ orderId }) => {
          console.log('📥 Received order:taken:', orderId)
          removeAvailableOrder(orderId)
          if (pendingOrderRef.current?.id === orderId) {
            setPendingOrder(null)
            setStep('idle')
            mapRef.current?.removeMarker('pickup')
            mapRef.current?.removeMarker('dropoff')
            mapRef.current?.clearRoute()
          }
        })

        socket.on('order:cancelled', () => {
          console.log('📥 Received order:cancelled')
          setCurrentOrder(null)
          setStep('idle')
          mapRef.current?.removeMarker('pickup')
          mapRef.current?.removeMarker('dropoff')
          mapRef.current?.removeMarker('client')
          mapRef.current?.clearRoute()
        })

        socket.on('order:accept:success', (data: { orderId: string; order: any }) => {
          console.log('📥 Received order:accept:success:', data.orderId)
          // Use order data from server (more reliable than local ref)
          if (data.order) {
            setCurrentOrder(data.order)
            setPendingOrder(null)
            setStep('accepted')
          } else {
            // Fallback to local ref
            const order = pendingOrderRef.current
            if (order) {
              setCurrentOrder(order)
              setPendingOrder(null)
              setStep('accepted')
            } else {
              console.error('No order data available in order:accept:success handler')
            }
          }
        })

        socket.on('order:accept:error', ({ message }) => {
          console.log('📥 Received order:accept:error:', message)
          alert(message)
          setPendingOrder(null)
          setStep('idle')
          mapRef.current?.removeMarker('pickup')
          mapRef.current?.removeMarker('dropoff')
        })
      }

      // Wait for socket to be ready before setting up handlers
      onSocketReady(setupSocketHandlers)

      return () => {
        const socket = getSocket()
        socket.off('order:available')
        socket.off('order:taken')
        socket.off('order:cancelled')
        socket.off('order:accept:success')
        socket.off('order:accept:error')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, user?.id, driver?.id])

  // Show route when order is accepted
  useEffect(() => {
    if (currentOrder && mapRef.current?.isLoaded && step === 'accepted') {
      // Show route to pickup
      navigator.geolocation.getCurrentPosition(async (position) => {
        const driverCoords: [number, number] = [position.coords.latitude, position.coords.longitude]
        const pickupCoords: [number, number] = [currentOrder.pickupLat, currentOrder.pickupLng]

        const result = await mapRef.current!.showRoute(driverCoords, pickupCoords)
        if (result) {
          setRouteInfo(result as { distance: number; duration: number })
        }
      })
    } else if (currentOrder && mapRef.current?.isLoaded && step === 'in-progress') {
      // Show route to dropoff
      const pickupCoords: [number, number] = [currentOrder.pickupLat, currentOrder.pickupLng]
      const dropoffCoords: [number, number] = [currentOrder.dropoffLat, currentOrder.dropoffLng]

      mapRef.current.showRoute(pickupCoords, dropoffCoords).then((result) => {
        if (result) {
          setRouteInfo(result as { distance: number; duration: number })
        }
      })
    }
  }, [currentOrder, step])

  const handleMapReady = useCallback((map: ReturnType<typeof useYandexMap>) => {
    mapRef.current = map
  }, [])

  // Toggle online status
  const toggleOnline = async () => {
    // If trying to go online, first check subscription
    if (!isOnline) {
      setCheckingSubscription(true)
      try {
        const subResponse = await api.get('/api/subscriptions/check')
        const { hasActiveSubscription, canGoOnline } = subResponse.data

        setHasSubscription(hasActiveSubscription)

        if (!canGoOnline) {
          // Redirect to subscription page
          router.push('/subscription')
          return
        }
      } catch (err) {
        console.error('Failed to check subscription:', err)
        // On error, redirect to subscription page to be safe
        router.push('/subscription')
        return
      } finally {
        setCheckingSubscription(false)
      }
    }

    try {
      const newStatus = isOnline ? 'OFFLINE' : 'ONLINE'
      await api.post('/api/drivers/status', { status: newStatus })

      const socket = getSocket()
      socket.emit('driver:status', { driverId: driver!.id, status: newStatus })

      if (newStatus === 'ONLINE') {
        startLocationUpdates(driver!.id)
        // Get current location and center map
        mapRef.current?.getUserLocation()
      } else {
        stopLocationUpdates()
      }

      setIsOnline(!isOnline)
      updateDriverStatus(newStatus)
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  // Accept order
  const acceptOrder = () => {
    if (!pendingOrder || !driver) return

    const socket = getSocket()
    socket.emit('order:accept', { orderId: pendingOrder.id, driverId: driver.id })
  }

  // Decline order
  const declineOrder = () => {
    setPendingOrder(null)
    setStep('idle')
    mapRef.current?.removeMarker('pickup')
    mapRef.current?.removeMarker('dropoff')
    mapRef.current?.clearRoute()
  }

  // Driver arrived
  const markArrived = async () => {
    if (!currentOrder || !driver) return

    try {
      await api.post(`/api/orders/${currentOrder.id}/arrived`)
      const socket = getSocket()
      socket.emit('order:arrived', { orderId: currentOrder.id, driverId: driver.id })
      updateOrderStatus('ARRIVED')
      setStep('arrived')
      mapRef.current?.clearRoute()
      setRouteInfo(null)
    } catch (err) {
      console.error('Failed to mark arrived:', err)
    }
  }

  // Start trip
  const startTrip = async () => {
    if (!currentOrder || !driver) return

    try {
      await api.post(`/api/orders/${currentOrder.id}/start`)
      const socket = getSocket()
      socket.emit('order:start', { orderId: currentOrder.id, driverId: driver.id })
      updateOrderStatus('IN_PROGRESS')
      setStep('in-progress')
    } catch (err) {
      console.error('Failed to start trip:', err)
    }
  }

  // Complete trip - move to completion screen
  const completeTrip = async () => {
    if (!currentOrder || !driver) return

    try {
      console.log('🏁 Completing trip for order:', currentOrder.id)
      await api.post(`/api/orders/${currentOrder.id}/complete`)
      console.log('✅ API call successful')

      const socket = getSocket()
      console.log('📤 Emitting order:complete event, socket connected:', socket.connected, 'socket ID:', socket.id)
      socket.emit('order:complete', { orderId: currentOrder.id, driverId: driver.id })
      console.log('📤 Event emitted')

      // Save order for completion screen
      setCompletedOrder(currentOrder)
      setClientRating(5)
      setPaymentConfirmed(currentOrder.paymentMethod !== 'CASH')

      setCurrentOrder(null)
      setStep('completed')
      mapRef.current?.removeMarker('pickup')
      mapRef.current?.removeMarker('dropoff')
      mapRef.current?.clearRoute()
      setRouteInfo(null)
    } catch (err) {
      console.error('Failed to complete trip:', err)
    }
  }

  // Finish completion - submit rating and go back to idle
  const finishCompletion = async () => {
    if (!completedOrder || !driver) return

    // If cash payment, check if confirmed
    if (completedOrder.paymentMethod === 'CASH' && !paymentConfirmed) {
      alert('Пожалуйста, подтвердите получение оплаты наличными')
      return
    }

    try {
      // Submit rating for client
      await api.post(`/api/orders/${completedOrder.id}/review`, {
        rating: clientRating,
        comment: ''
      })

      // Refresh stats
      const statsRes = await api.get('/api/drivers/me/stats')
      setStats(statsRes.data)

      // Reset to idle
      setCompletedOrder(null)
      setClientRating(5)
      setPaymentConfirmed(false)
      setStep('idle')
    } catch (err) {
      console.error('Failed to submit rating:', err)
      // Still go to idle even if rating fails
      setCompletedOrder(null)
      setClientRating(5)
      setPaymentConfirmed(false)
      setStep('idle')
    }
  }

  // Cancel order
  const cancelOrder = async () => {
    if (!currentOrder || !user) return

    try {
      await api.post(`/api/orders/${currentOrder.id}/cancel`, { reason: 'Отменено водителем' })
      const socket = getSocket()
      socket.emit('order:cancel', { orderId: currentOrder.id, userId: user.id, reason: 'Отменено водителем' })

      setCurrentOrder(null)
      setStep('idle')
      mapRef.current?.removeMarker('pickup')
      mapRef.current?.removeMarker('dropoff')
      mapRef.current?.clearRoute()
      setRouteInfo(null)
    } catch (err) {
      console.error('Failed to cancel order:', err)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 relative overflow-hidden">
      {/* Map */}
      <div className="flex-1 relative">
        <Map
          className="w-full h-full"
          center={[55.751574, 37.573856]}
          zoom={12}
          onMapReady={handleMapReady}
          autoLocate={isOnline}
        />

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 z-10">
          <div className="flex items-center justify-between">
            <button className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <div className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <div className={clsx('w-3 h-3 rounded-full', isOnline ? 'bg-green-500' : 'bg-gray-400')} />
              <span className="font-medium">{isOnline ? 'На линии' : 'Офлайн'}</span>
            </div>
            <div className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-medium">{user?.rating?.toFixed(1) || '5.0'}</span>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        {step === 'idle' && (
          <div className="absolute top-20 left-4 right-4 z-10">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Сегодня</p>
                  <p className="text-2xl font-bold text-primary-600">{stats.today.earnings} ₽</p>
                  <p className="text-sm text-gray-500">{stats.today.trips} поездок</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Неделя</p>
                  <p className="text-2xl font-bold">{stats.week.earnings} ₽</p>
                  <p className="text-sm text-gray-500">{stats.week.trips} поездок</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Route info overlay */}
        {routeInfo && (step === 'accepted' || step === 'in-progress') && (
          <div className="absolute top-20 left-4 right-4 bg-white rounded-xl shadow-lg p-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-gray-600">
                <Navigation className="w-4 h-4" />
                <span className="font-medium">{formatDistance(routeInfo.distance)}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{formatDuration(routeInfo.duration)}</span>
              </div>
            </div>
            <span className="text-sm text-gray-500">
              {step === 'accepted' ? 'до клиента' : 'до назначения'}
            </span>
          </div>
        )}

        {/* Locate button */}
        <button
          onClick={() => mapRef.current?.getUserLocation()}
          className="absolute right-4 bottom-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-10"
        >
          <Locate className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence mode="wait">
        {step === 'idle' && (
          <SimpleBottomSheet key="idle">
            <div className="p-6 text-center">
              <button
                onClick={toggleOnline}
                disabled={checkingSubscription}
                className={clsx(
                  'w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center transition-all',
                  isOnline
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                    : 'bg-gray-200 text-gray-600',
                  checkingSubscription && 'opacity-50'
                )}
              >
                {checkingSubscription ? (
                  <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Power className="w-10 h-10" />
                )}
              </button>
              <p className="text-lg font-semibold">
                {checkingSubscription ? 'Проверка...' : isOnline ? 'Вы на линии' : 'Выйти на линию'}
              </p>
              <p className="text-gray-500 text-sm">
                {checkingSubscription
                  ? 'Проверяем подписку'
                  : isOnline
                    ? 'Ожидание заказов...'
                    : 'Нажмите, чтобы начать принимать заказы'}
              </p>
            </div>
          </SimpleBottomSheet>
        )}

        {step === 'new-order' && pendingOrder && (
          <OrderBottomSheet key="new-order" defaultExpanded>
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Новый заказ</h2>
                <span className="text-2xl font-bold text-primary-500">{pendingOrder.price} ₽</span>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <div>
                  <p className="font-medium">{pendingOrder.client?.name}</p>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{pendingOrder.client?.rating?.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Откуда</p>
                    <p className="font-medium">{pendingOrder.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Куда</p>
                    <p className="font-medium">{pendingOrder.dropoffAddress}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                <div className="flex items-center gap-1">
                  <Route className="w-4 h-4" />
                  <span>{pendingOrder.distance} км</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>~{pendingOrder.estimatedTime} мин</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={declineOrder} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                  <X className="w-5 h-5" />
                  Отклонить
                </button>
                <button onClick={acceptOrder} className="flex-1 btn-primary flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  Принять
                </button>
              </div>
            </div>
          </OrderBottomSheet>
        )}

        {(step === 'accepted' || step === 'arrived' || step === 'in-progress') && currentOrder && (
          <OrderBottomSheet key="active-order" defaultExpanded>
            <div className="px-6 pb-6">
              <div className={clsx(
                'p-3 rounded-xl mb-4 text-center',
                step === 'accepted' && 'bg-blue-50 text-blue-600',
                step === 'arrived' && 'bg-yellow-50 text-yellow-600',
                step === 'in-progress' && 'bg-green-50 text-green-600'
              )}>
                <p className="font-semibold">
                  {step === 'accepted' && '🚗 Едем к пассажиру'}
                  {step === 'arrived' && '📍 Вы на месте'}
                  {step === 'in-progress' && '🚀 Поездка'}
                </p>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{currentOrder.client?.name}</p>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{currentOrder.client?.rating?.toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Phone className="w-5 h-5 text-gray-600" />
                  </button>
                  <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Откуда</p>
                    <p className="font-medium">{currentOrder.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Куда</p>
                    <p className="font-medium">{currentOrder.dropoffAddress}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-6 p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-500">Стоимость</span>
                <span className="text-xl font-bold">{currentOrder.price} ₽</span>
              </div>

              {step === 'accepted' && (
                <button onClick={markArrived} className="btn-primary w-full">
                  Я на месте
                </button>
              )}

              {step === 'arrived' && (
                <button onClick={startTrip} className="btn-primary w-full">
                  Начать поездку
                </button>
              )}

              {step === 'in-progress' && (
                <button onClick={completeTrip} className="btn-primary w-full bg-green-500 hover:bg-green-600">
                  Завершить поездку
                </button>
              )}

              {step !== 'in-progress' && (
                <button onClick={cancelOrder} className="w-full mt-3 text-red-500 text-sm">
                  Отменить заказ
                </button>
              )}
            </div>
          </OrderBottomSheet>
        )}

        {step === 'completed' && completedOrder && (
          <OrderBottomSheet key="completed" defaultExpanded>
            <div className="px-6 pb-6">
              <div className="p-4 rounded-xl mb-4 text-center bg-green-50">
                <div className="text-4xl mb-2">✅</div>
                <h2 className="text-xl font-bold text-green-600">Поездка завершена!</h2>
                <p className="text-green-600/80">{completedOrder.price} ₽</p>
              </div>

              {/* Payment confirmation for cash */}
              {completedOrder.paymentMethod === 'CASH' && (
                <div className="mb-6 p-4 bg-yellow-50 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">💵</span>
                    <div>
                      <p className="font-medium">Оплата наличными</p>
                      <p className="text-sm text-gray-500">Сумма: {completedOrder.price} ₽</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPaymentConfirmed(!paymentConfirmed)}
                    className={clsx(
                      'w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all',
                      paymentConfirmed
                        ? 'bg-green-500 text-white'
                        : 'bg-white border-2 border-gray-200 text-gray-700'
                    )}
                  >
                    {paymentConfirmed ? (
                      <>
                        <Check className="w-5 h-5" />
                        Оплата получена
                      </>
                    ) : (
                      'Подтвердить получение оплаты'
                    )}
                  </button>
                </div>
              )}

              {/* Client rating */}
              <div className="mb-6">
                <p className="font-medium mb-3 text-center">Оцените клиента</p>
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-3xl">👤</span>
                  </div>
                  <div>
                    <p className="font-medium">{completedOrder.client?.name || 'Клиент'}</p>
                  </div>
                </div>
                <div className="flex justify-center gap-2 mt-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setClientRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={clsx(
                          'w-10 h-10 transition-all',
                          star <= clientRating
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={finishCompletion}
                className={clsx(
                  'btn-primary w-full',
                  completedOrder.paymentMethod === 'CASH' && !paymentConfirmed && 'opacity-50'
                )}
              >
                Готово
              </button>
            </div>
          </OrderBottomSheet>
        )}
      </AnimatePresence>
    </div>
  )
}
