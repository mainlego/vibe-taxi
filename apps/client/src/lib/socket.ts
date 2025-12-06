import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
let isConnecting = false
let connectionTimeout: NodeJS.Timeout | null = null
let savedToken: string | null = null
let savedUserId: string | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
  }
  return socket
}

type AuthCallback = () => void
let authCallbacks: AuthCallback[] = []
let isAuthenticated = false

export function onSocketReady(callback: AuthCallback) {
  const s = getSocket()
  if (s.connected && isAuthenticated) {
    callback()
  } else {
    authCallbacks.push(callback)
  }
}

export function connectSocket(token: string, userId: string) {
  const s = getSocket()

  // Save credentials for reconnection
  savedToken = token
  savedUserId = userId

  // If already connected, just return
  if (s.connected) {
    console.log('Socket already connected')
    return s
  }

  // If connecting, wait - but add a timeout to reset the flag if stuck
  if (isConnecting) {
    console.log('Socket connection already in progress')
    return s
  }

  isConnecting = true
  isAuthenticated = false

  // Clear any previous timeout
  if (connectionTimeout) {
    clearTimeout(connectionTimeout)
  }

  // Set a timeout to reset isConnecting if connection takes too long
  connectionTimeout = setTimeout(() => {
    if (isConnecting && !s.connected) {
      console.log('Socket connection timeout, resetting state')
      isConnecting = false
    }
  }, 10000) // 10 second timeout

  // Remove old listeners before adding new ones
  s.off('connect')
  s.off('auth:success')
  s.off('auth:error')
  s.off('disconnect')
  s.off('connect_error')

  s.on('connect', () => {
    console.log('Socket connected, authenticating...')
    // Use saved credentials for reconnection
    const authToken = savedToken || token
    const authUserId = savedUserId || userId
    s.emit('auth', { token: authToken, userId: authUserId, type: 'client' })
  })

  s.on('auth:success', () => {
    console.log('Socket authenticated as client:', savedUserId || userId)
    console.log('Socket ID after auth:', s.id)
    console.log('Socket connected status:', s.connected)
    isConnecting = false
    isAuthenticated = true
    if (connectionTimeout) {
      clearTimeout(connectionTimeout)
      connectionTimeout = null
    }
    // Call all waiting callbacks
    authCallbacks.forEach(cb => cb())
    authCallbacks = []
  })

  s.on('auth:error', (data) => {
    console.error('Socket auth error:', data)
    isConnecting = false
    if (connectionTimeout) {
      clearTimeout(connectionTimeout)
      connectionTimeout = null
    }
  })

  s.on('connect_error', (error) => {
    console.error('Socket connect error:', error)
    isConnecting = false
    if (connectionTimeout) {
      clearTimeout(connectionTimeout)
      connectionTimeout = null
    }
  })

  s.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
    isConnecting = false
    if (connectionTimeout) {
      clearTimeout(connectionTimeout)
      connectionTimeout = null
    }
  })

  console.log('Attempting socket connection for client:', userId)
  s.connect()

  return s
}

export function disconnectSocket() {
  isConnecting = false
  if (connectionTimeout) {
    clearTimeout(connectionTimeout)
    connectionTimeout = null
  }
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
