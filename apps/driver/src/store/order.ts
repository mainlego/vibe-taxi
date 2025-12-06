import { create } from 'zustand'

interface Client {
  id: string
  name: string
  phone?: string
  rating: number
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
  paymentMethod: 'CASH' | 'CARD' | 'WALLET'
  client: Client
}

interface OrderState {
  availableOrders: Order[]
  currentOrder: Order | null

  setAvailableOrders: (orders: Order[]) => void
  addAvailableOrder: (order: Order) => void
  removeAvailableOrder: (orderId: string) => void
  setCurrentOrder: (order: Order | null) => void
  updateOrderStatus: (status: string) => void
  reset: () => void
}

export const useOrderStore = create<OrderState>((set, get) => ({
  availableOrders: [],
  currentOrder: null,

  setAvailableOrders: (orders) => set({ availableOrders: orders }),

  addAvailableOrder: (order) =>
    set((state) => {
      // Don't add if already exists
      if (state.availableOrders.find((o) => o.id === order.id)) {
        return state
      }
      return { availableOrders: [order, ...state.availableOrders] }
    }),

  removeAvailableOrder: (orderId) =>
    set((state) => ({
      availableOrders: state.availableOrders.filter((o) => o.id !== orderId),
    })),

  setCurrentOrder: (order) => set({ currentOrder: order }),

  updateOrderStatus: (status) => {
    const { currentOrder } = get()
    if (currentOrder) {
      set({ currentOrder: { ...currentOrder, status } })
    }
  },

  reset: () => set({ availableOrders: [], currentOrder: null }),
}))
