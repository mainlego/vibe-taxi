import { create } from 'zustand'

interface Location {
  address: string
  lat: number
  lng: number
}

interface Driver {
  id: string
  name: string
  phone: string
  rating: number
  carModel: string
  carNumber: string
  carColor?: string
  lat?: number
  lng?: number
}

interface Order {
  id: string
  status: string
  pickupAddress: string
  pickupLat: number
  pickupLng: number
  dropoffAddress: string
  dropoffLat: number
  dropoffLng: number
  distance: number
  estimatedTime: number
  price: number
  finalPrice?: number
  carClass: string
  driver?: Driver
}

type CarClass = 'ECONOMY' | 'COMFORT' | 'BUSINESS' | 'PREMIUM'

interface OrderState {
  pickup: Location | null
  dropoff: Location | null
  distance: number | null
  estimatedTime: number | null
  carClass: CarClass
  prices: Record<CarClass, number>
  currentOrder: Order | null
  driverLocation: { lat: number; lng: number } | null

  setPickup: (location: Location | null) => void
  setDropoff: (location: Location | null) => void
  setDistance: (distance: number) => void
  setEstimatedTime: (time: number) => void
  setCarClass: (carClass: CarClass) => void
  setPrices: (prices: Record<CarClass, number>) => void
  setCurrentOrder: (order: Order | null) => void
  setDriverLocation: (location: { lat: number; lng: number } | null) => void
  reset: () => void
}

export const useOrderStore = create<OrderState>((set) => ({
  pickup: null,
  dropoff: null,
  distance: null,
  estimatedTime: null,
  carClass: 'ECONOMY',
  prices: { ECONOMY: 0, COMFORT: 0, BUSINESS: 0, PREMIUM: 0 },
  currentOrder: null,
  driverLocation: null,

  setPickup: (pickup) => set({ pickup }),
  setDropoff: (dropoff) => set({ dropoff }),
  setDistance: (distance) => set({ distance }),
  setEstimatedTime: (estimatedTime) => set({ estimatedTime }),
  setCarClass: (carClass) => set({ carClass }),
  setPrices: (prices) => set({ prices }),
  setCurrentOrder: (currentOrder) => set({ currentOrder }),
  setDriverLocation: (driverLocation) => set({ driverLocation }),

  reset: () =>
    set({
      pickup: null,
      dropoff: null,
      distance: null,
      estimatedTime: null,
      carClass: 'ECONOMY',
      prices: { ECONOMY: 0, COMFORT: 0, BUSINESS: 0, PREMIUM: 0 },
      currentOrder: null,
      driverLocation: null,
    }),
}))
