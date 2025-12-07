'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Navigation,
  Car,
  Clock,
  Star,
  Phone,
  MessageCircle,
  X,
  ChevronUp,
  ChevronDown,
  Locate,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useOrderStore } from '@/store/order'
import { api } from '@/lib/api'
import { connectSocket, getSocket, onSocketReady } from '@/lib/socket'
import { clsx } from 'clsx'
import { Map } from '@/components/Map'
import { AddressSearch } from '@/components/AddressSearch'
import { OrderBottomSheet, SimpleBottomSheet } from '@/components/BottomSheet'
import { useYandexMap } from '@/hooks/useYandexMap'
import { reverseGeocode, formatDistance, formatDuration, type GeocoderResult } from '@/lib/yandex-maps'

const carClasses = [
  { id: 'ECONOMY', name: 'Эконом', icon: '🚗', eta: '3-5 мин' },
  { id: 'COMFORT', name: 'Комфорт', icon: '🚙', eta: '5-7 мин' },
  { id: 'BUSINESS', name: 'Бизнес', icon: '🚘', eta: '7-10 мин' },
  { id: 'PREMIUM', name: 'Премиум', icon: '🏎️', eta: '10-15 мин' },
] as const

type OrderStep = 'input' | 'select-class' | 'searching' | 'driver-found' | 'driver-arrived' | 'in-trip' | 'completed'

export default function OrderPage() {
  const router = useRouter()
  const { user, token, isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore()
  const {
    pickup,
    dropoff,
    distance,
    estimatedTime,
    carClass,
    prices,
    currentOrder,
    driverLocation,
    setPickup,
    setDropoff,
    setDistance,
    setEstimatedTime,
    setCarClass,
    setPrices,
    setCurrentOrder,
    setDriverLocation,
    reset,
  } = useOrderStore()

  const [step, setStep] = useState<OrderStep>('input')
  const [isLoadingPrices, setIsLoadingPrices] = useState(false)
  const [error, setError] = useState('')
  const [activeInput, setActiveInput] = useState<'pickup' | 'dropoff' | null>(null)
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [driverRating, setDriverRating] = useState<number>(5)
  const [savedAddresses, setSavedAddresses] = useState<Array<{ id: string; name: string; address: string; lat: number; lng: number }>>([])
  const [recentAddresses, setRecentAddresses] = useState<string[]>([])

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<ReturnType<typeof useYandexMap> | null>(null)
  const currentOrderRef = useRef<typeof currentOrder>(null)
  const stepRef = useRef<OrderStep>('input')

  // Keep refs in sync with state
  useEffect(() => {
    currentOrderRef.current = currentOrder
  }, [currentOrder])

  useEffect(() => {
    stepRef.current = step
  }, [step])

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [authLoading, isAuthenticated, router])

  // Load active order on mount (for page refresh persistence)
  useEffect(() => {
    if (isAuthenticated && token) {
      const loadActiveOrder = async () => {
        try {
          const response = await api.get('/api/orders/active')
          if (response.data) {
            const order = response.data
            console.log('📋 Loaded active order:', order)
            setCurrentOrder(order)

            // Set pickup and dropoff from order
            setPickup({
              address: order.pickupAddress,
              lat: order.pickupLat,
              lng: order.pickupLng,
            })
            setDropoff({
              address: order.dropoffAddress,
              lat: order.dropoffLat,
              lng: order.dropoffLng,
            })
            setDistance(order.distance)
            setEstimatedTime(order.estimatedTime)
            setCarClass(order.carClass)

            // Set step based on order status
            switch (order.status) {
              case 'PENDING':
                setStep('searching')
                break
              case 'ACCEPTED':
                setStep('driver-found')
                break
              case 'ARRIVED':
                setStep('driver-arrived')
                break
              case 'IN_PROGRESS':
                setStep('in-trip')
                break
            }
          }
        } catch (err) {
          console.error('Failed to load active order:', err)
        }
      }
      loadActiveOrder()
    }
  }, [isAuthenticated, token, setCurrentOrder, setPickup, setDropoff, setDistance, setEstimatedTime, setCarClass])

  // Load saved addresses
  useEffect(() => {
    if (isAuthenticated && token) {
      const loadSavedAddresses = async () => {
        try {
          const response = await api.get('/api/users/me/addresses')
          console.log('📍 Loaded saved addresses:', response.data)
          setSavedAddresses(response.data || [])
        } catch (err) {
          console.error('Failed to load saved addresses:', err)
        }
      }
      loadSavedAddresses()

      // Load recent addresses from localStorage
      const recent = localStorage.getItem('recentAddresses')
      if (recent) {
        try {
          setRecentAddresses(JSON.parse(recent))
        } catch {}
      }
    }
  }, [isAuthenticated, token])

  // Connect socket when authenticated
  useEffect(() => {
    if (isAuthenticated && token && user) {
      connectSocket(token, user.id)

      // Setup event handlers after socket is authenticated
      const setupSocketHandlers = () => {
        const socket = getSocket()
        console.log('🔌 Setting up socket event handlers, socket ID:', socket.id)

        socket.on('order:accepted', (data) => {
          console.log('📥 Received order:accepted event:', data)
          const order = currentOrderRef.current
          if (order) {
            setCurrentOrder({ ...order, ...data, status: 'ACCEPTED' })
            setStep('driver-found')
          }
        })

        socket.on('order:status', (data) => {
          console.log('📥 Received order:status event:', data)
          if (data.status === 'ARRIVED') {
            setStep('driver-arrived')
          } else if (data.status === 'IN_PROGRESS') {
            setStep('in-trip')
          }
        })

        socket.on('order:completed', (data) => {
          console.log('📥 Received order:completed event:', data)
          console.log('📥 Socket ID when received:', socket.id)
          const order = currentOrderRef.current
          console.log('Current order ref:', order)
          if (order) {
            setCurrentOrder({ ...order, ...data, status: 'COMPLETED' })
            setStep('completed')
            console.log('✅ Set step to completed')
          } else {
            console.warn('No current order when order:completed received!')
          }
        })

        socket.on('order:cancelled', () => {
          console.log('📥 Received order:cancelled event')
          setError('Заказ отменён')
          reset()
          setStep('input')
        })

        socket.on('driver:location:update', (data) => {
          setDriverLocation({ lat: data.lat, lng: data.lng })
          if (mapRef.current) {
            mapRef.current.updateMarkerPosition('driver', [data.lat, data.lng])
          }
        })

        // Listen for all drivers locations (when not in active order)
        socket.on('drivers:locations', (drivers: Array<{ id: string; lat: number; lng: number }>) => {
          if (stepRef.current === 'input' && mapRef.current) {
            // Update driver markers on map
            drivers.forEach(driver => {
              mapRef.current?.addMarker(`driver-${driver.id}`, [driver.lat, driver.lng], {
                preset: 'islands#blueTaxiCircleIcon',
              })
            })
          }
        })
      }

      // Wait for socket to be ready before setting up handlers
      onSocketReady(setupSocketHandlers)

      return () => {
        const socket = getSocket()
        socket.off('order:accepted')
        socket.off('order:status')
        socket.off('order:completed')
        socket.off('order:cancelled')
        socket.off('driver:location:update')
        socket.off('drivers:locations')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token, user?.id])

  // Calculate distance between two points using Haversine formula
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in km
  }

  // Update route when pickup and dropoff change
  useEffect(() => {
    if (pickup && dropoff && isMapReady && mapRef.current) {
      const updateRoute = async () => {
        const result = await mapRef.current!.showRoute(
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng]
        )
        if (result) {
          const routeData = result as { distance: number; duration: number }
          setRouteInfo(routeData)
          setDistance(routeData.distance / 1000) // convert to km
          setEstimatedTime(Math.ceil(routeData.duration / 60)) // convert to minutes
        } else {
          // Fallback: calculate approximate distance if route API fails
          const straightLineDistance = calculateHaversineDistance(
            pickup.lat, pickup.lng, dropoff.lat, dropoff.lng
          )
          // Road distance is typically 1.3-1.5x straight line distance
          const estimatedRoadDistance = straightLineDistance * 1.4
          // Assume average speed of 30 km/h in city
          const estimatedDuration = (estimatedRoadDistance / 30) * 60 // minutes

          setRouteInfo({
            distance: estimatedRoadDistance * 1000, // in meters for display
            duration: estimatedDuration * 60 // in seconds for display
          })
          setDistance(estimatedRoadDistance)
          setEstimatedTime(Math.ceil(estimatedDuration))
        }
      }
      updateRoute()
    }
  }, [pickup, dropoff, isMapReady, setDistance, setEstimatedTime])

  const handleMapReady = useCallback((map: ReturnType<typeof useYandexMap>) => {
    mapRef.current = map
    setIsMapReady(true)
  }, [])

  const handleMapClick = useCallback(async (coords: [number, number], address: GeocoderResult | null) => {
    if (!activeInput) return

    const locationData = {
      address: address?.shortAddress || address?.address || 'Выбранное место',
      lat: coords[0],
      lng: coords[1],
    }

    if (activeInput === 'pickup') {
      setPickup(locationData)
      mapRef.current?.addMarker('pickup', coords, {
        preset: 'islands#greenDotIcon',
        draggable: true,
        onDragEnd: async (newCoords) => {
          const newAddress = await reverseGeocode(newCoords)
          setPickup({
            address: newAddress?.shortAddress || 'Выбранное место',
            lat: newCoords[0],
            lng: newCoords[1],
          })
        }
      })
    } else {
      setDropoff(locationData)
      mapRef.current?.addMarker('dropoff', coords, {
        preset: 'islands#redDotIcon',
        draggable: true,
        onDragEnd: async (newCoords) => {
          const newAddress = await reverseGeocode(newCoords)
          setDropoff({
            address: newAddress?.shortAddress || 'Выбранное место',
            lat: newCoords[0],
            lng: newCoords[1],
          })
        }
      })
    }
  }, [activeInput, setPickup, setDropoff])

  const handleAddressSelect = useCallback((type: 'pickup' | 'dropoff', result: GeocoderResult) => {
    const locationData = {
      address: result.shortAddress,
      lat: result.coordinates[0],
      lng: result.coordinates[1],
    }

    if (type === 'pickup') {
      setPickup(locationData)
      mapRef.current?.addMarker('pickup', result.coordinates, {
        preset: 'islands#greenDotIcon',
        draggable: true,
        onDragEnd: async (newCoords) => {
          const newAddress = await reverseGeocode(newCoords)
          setPickup({
            address: newAddress?.shortAddress || 'Выбранное место',
            lat: newCoords[0],
            lng: newCoords[1],
          })
        }
      })
      mapRef.current?.setCenter(result.coordinates, 15)
    } else {
      setDropoff(locationData)
      mapRef.current?.addMarker('dropoff', result.coordinates, {
        preset: 'islands#redDotIcon',
        draggable: true,
        onDragEnd: async (newCoords) => {
          const newAddress = await reverseGeocode(newCoords)
          setDropoff({
            address: newAddress?.shortAddress || 'Выбранное место',
            lat: newCoords[0],
            lng: newCoords[1],
          })
        }
      })
      mapRef.current?.setCenter(result.coordinates, 15)
    }

    setActiveInput(null)
  }, [setPickup, setDropoff])

  const handleCurrentLocation = useCallback(async () => {
    const coords = await mapRef.current?.getUserLocation()
    if (coords) {
      const address = await reverseGeocode(coords)
      setPickup({
        address: address?.shortAddress || 'Моё местоположение',
        lat: coords[0],
        lng: coords[1],
      })
      mapRef.current?.addMarker('pickup', coords, {
        preset: 'islands#greenDotIcon',
        draggable: true,
        onDragEnd: async (newCoords) => {
          const newAddress = await reverseGeocode(newCoords)
          setPickup({
            address: newAddress?.shortAddress || 'Выбранное место',
            lat: newCoords[0],
            lng: newCoords[1],
          })
        }
      })
    }
    setActiveInput(null)
  }, [setPickup])

  // Calculate prices when route is set
  const calculatePrices = async () => {
    if (!pickup || !dropoff) {
      setError('Пожалуйста, укажите адреса отправления и назначения')
      return
    }

    if (!distance || !estimatedTime) {
      setError('Подождите, пока маршрут будет рассчитан')
      return
    }

    setError('')
    setIsLoadingPrices(true)
    try {
      const response = await api.post('/api/tariffs/calculate-all', {
        distance,
        estimatedTime,
      })

      const pricesMap: Record<string, number> = {}
      response.data.forEach((item: { carClass: string; price: number }) => {
        pricesMap[item.carClass] = item.price
      })
      setPrices(pricesMap as any)
      setStep('select-class')
    } catch (err: any) {
      setError('Ошибка расчёта стоимости')
    } finally {
      setIsLoadingPrices(false)
    }
  }

  // Create order
  const createOrder = async () => {
    if (!pickup || !dropoff || !distance || !estimatedTime) return

    setStep('searching')
    setError('')

    try {
      const response = await api.post('/api/orders', {
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        distance,
        estimatedTime,
        carClass,
      })

      setCurrentOrder(response.data)

      // Notify server via socket
      const socket = getSocket()
      socket.emit('order:new', { orderId: response.data.id })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка создания заказа')
      setStep('select-class')
    }
  }

  // Cancel order
  const cancelOrder = async () => {
    if (!currentOrder) return

    try {
      await api.post(`/api/orders/${currentOrder.id}/cancel`, {
        reason: 'Отменено пользователем',
      })

      const socket = getSocket()
      socket.emit('order:cancel', {
        orderId: currentOrder.id,
        userId: user?.id,
        reason: 'Отменено пользователем',
      })

      reset()
      mapRef.current?.clearRoute()
      mapRef.current?.removeMarker('pickup')
      mapRef.current?.removeMarker('dropoff')
      mapRef.current?.removeMarker('driver')
      setStep('input')
    } catch (err: any) {
      setError('Ошибка отмены заказа')
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
          onMapClick={handleMapClick}
          onMapReady={handleMapReady}
          autoLocate={!pickup}
        />

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-3 bg-white rounded-full shadow-lg pr-4 pl-1 py-1"
            >
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <span className="font-medium text-gray-800 max-w-[120px] truncate">
                {user?.name || 'Гость'}
              </span>
            </button>
            <div className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-medium">{user?.rating?.toFixed(1) || '5.0'}</span>
            </div>
          </div>
        </div>

        {/* Locate button */}
        <button
          onClick={() => mapRef.current?.getUserLocation()}
          className="absolute right-4 bottom-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center z-10"
        >
          <Locate className="w-5 h-5 text-gray-700" />
        </button>

        {/* Route info overlay */}
        {routeInfo && step === 'input' && pickup && dropoff && (
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
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence mode="wait">
        {step === 'input' && (
          <OrderBottomSheet key="input" defaultExpanded={!!activeInput}>
            <div className="px-6 pb-6">
              {activeInput ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold">
                      {activeInput === 'pickup' ? 'Откуда забрать?' : 'Куда едем?'}
                    </h2>
                    <button onClick={() => setActiveInput(null)} className="p-2">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <AddressSearch
                    placeholder={activeInput === 'pickup' ? 'Адрес отправления' : 'Адрес назначения'}
                    icon={activeInput === 'pickup' ? 'from' : 'to'}
                    value={activeInput === 'pickup' ? pickup?.address : dropoff?.address}
                    onSelect={(result) => handleAddressSelect(activeInput, result)}
                    onCurrentLocation={activeInput === 'pickup' ? handleCurrentLocation : undefined}
                    savedAddresses={savedAddresses}
                    recentAddresses={recentAddresses}
                    autoFocus
                  />
                  <p className="text-sm text-gray-500 text-center mt-4">
                    Или нажмите на карту, чтобы выбрать точку
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold mb-4">Куда едем?</h2>

                  {/* Pickup */}
                  <button
                    onClick={() => setActiveInput('pickup')}
                    className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-3 text-left"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Navigation className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Откуда</p>
                      <p className="font-medium truncate">{pickup?.address || 'Укажите адрес'}</p>
                    </div>
                  </button>

                  {/* Dropoff */}
                  <button
                    onClick={() => setActiveInput('dropoff')}
                    className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-xl text-left"
                  >
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Куда</p>
                      <p className="font-medium truncate">{dropoff?.address || 'Укажите адрес'}</p>
                    </div>
                  </button>

                  {pickup && dropoff && (
                    <button
                      onClick={calculatePrices}
                      disabled={isLoadingPrices}
                      className="btn-primary w-full mt-6"
                    >
                      {isLoadingPrices ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Расчёт...
                        </div>
                      ) : (
                        'Выбрать тариф'
                      )}
                    </button>
                  )}

                  {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
                </>
              )}
            </div>
          </OrderBottomSheet>
        )}

        {step === 'select-class' && (
          <OrderBottomSheet key="select-class" defaultExpanded>
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Выберите тариф</h2>
                <button onClick={() => setStep('input')} className="p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {routeInfo && (
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Navigation className="w-4 h-4" />
                    <span>{formatDistance(routeInfo.distance)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(routeInfo.duration)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {carClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setCarClass(cls.id)}
                    className={clsx(
                      'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                      carClass === cls.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <span className="text-3xl">{cls.icon}</span>
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{cls.name}</p>
                      <p className="text-sm text-gray-500">{cls.eta}</p>
                    </div>
                    <p className="text-lg font-bold">{prices[cls.id]} ₽</p>
                  </button>
                ))}
              </div>

              <button onClick={createOrder} className="btn-primary w-full">
                Заказать за {prices[carClass]} ₽
              </button>
            </div>
          </OrderBottomSheet>
        )}

        {step === 'searching' && (
          <SimpleBottomSheet key="searching">
            <div className="p-6 text-center">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-primary-500 rounded-full opacity-20 animate-ping" />
                <div className="absolute inset-2 bg-primary-500 rounded-full opacity-40 animate-ping" style={{ animationDelay: '0.5s' }} />
                <div className="absolute inset-4 bg-primary-500 rounded-full flex items-center justify-center">
                  <Car className="w-8 h-8 text-white" />
                </div>
              </div>

              <h2 className="text-xl font-bold mb-2">Ищем водителя</h2>
              <p className="text-gray-500 mb-6">Обычно это занимает 1-3 минуты</p>

              <button onClick={cancelOrder} className="btn-secondary w-full">
                Отменить
              </button>
            </div>
          </SimpleBottomSheet>
        )}

        {(step === 'driver-found' || step === 'driver-arrived' || step === 'in-trip') && currentOrder && (
          <OrderBottomSheet key="driver-info">
            <div className="px-6 pb-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{currentOrder.driver?.name}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{currentOrder.driver?.rating?.toFixed(1)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{currentOrder.driver?.carModel}</p>
                  <p className="text-primary-500 font-bold">{currentOrder.driver?.carNumber}</p>
                </div>
              </div>

              <div className={clsx(
                'p-4 rounded-xl mb-4',
                step === 'driver-found' && 'bg-blue-50',
                step === 'driver-arrived' && 'bg-green-50',
                step === 'in-trip' && 'bg-primary-50'
              )}>
                <p className={clsx(
                  'font-semibold',
                  step === 'driver-found' && 'text-blue-600',
                  step === 'driver-arrived' && 'text-green-600',
                  step === 'in-trip' && 'text-primary-600'
                )}>
                  {step === 'driver-found' && '🚗 Водитель едет к вам'}
                  {step === 'driver-arrived' && '✅ Водитель на месте'}
                  {step === 'in-trip' && '🚀 Поездка началась'}
                </p>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 btn-secondary flex items-center justify-center gap-2">
                  <Phone className="w-5 h-5" />
                  Позвонить
                </button>
                <button className="flex-1 btn-secondary flex items-center justify-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Написать
                </button>
              </div>

              {step !== 'in-trip' && (
                <button onClick={cancelOrder} className="w-full mt-4 text-red-500 text-sm">
                  Отменить поездку
                </button>
              )}
            </div>
          </OrderBottomSheet>
        )}

        {step === 'completed' && currentOrder && (
          <SimpleBottomSheet key="completed">
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✅</span>
              </div>

              <h2 className="text-xl font-bold mb-2">Поездка завершена!</h2>
              <p className="text-3xl font-bold text-primary-500 mb-4">
                {currentOrder.finalPrice || currentOrder.price} ₽
              </p>

              <p className="text-gray-500 mb-3">Оцените водителя</p>

              {currentOrder.driver && (
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{currentOrder.driver.name}</p>
                    <p className="text-sm text-gray-500">{currentOrder.driver.carModel}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setDriverRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={clsx(
                        'w-10 h-10 transition-all',
                        star <= driverRating
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300'
                      )}
                    />
                  </button>
                ))}
              </div>

              <button
                onClick={async () => {
                  try {
                    // Submit review for driver
                    await api.post(`/api/orders/${currentOrder.id}/review`, {
                      rating: driverRating,
                      comment: ''
                    })
                  } catch (err) {
                    console.error('Failed to submit review:', err)
                  }

                  reset()
                  mapRef.current?.clearRoute()
                  mapRef.current?.removeMarker('pickup')
                  mapRef.current?.removeMarker('dropoff')
                  mapRef.current?.removeMarker('driver')
                  setDriverRating(5)
                  setStep('input')
                }}
                className="btn-primary w-full"
              >
                Готово
              </button>
            </div>
          </SimpleBottomSheet>
        )}
      </AnimatePresence>
    </div>
  )
}

function UserIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  )
}
