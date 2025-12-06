import { Server, Socket } from 'socket.io'
import { prisma, DriverStatus, OrderStatus } from '@vibe-taxi/database'

interface DriverConnection {
  socket: Socket
  driverId: string
  userId: string
  lat?: number
  lng?: number
}

interface ClientConnection {
  socket: Socket
  userId: string
}

// In-memory connections
const drivers = new Map<string, DriverConnection>()
const clients = new Map<string, ClientConnection>()
const orderRooms = new Map<string, Set<string>>() // orderId -> Set<socketId>

// Global io instance for use in API routes
let ioInstance: Server | null = null

export function getIO(): Server | null {
  return ioInstance
}

export function setupSocketHandlers(io: Server) {
  // Store io instance for use in API routes
  ioInstance = io

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`)

    // Authenticate and register
    socket.on('auth', async (data: { token: string; type: 'client' | 'driver' }) => {
      try {
        console.log('🔐 Auth received:', JSON.stringify(data))
        // In real app, verify JWT token here
        const { userId, driverId } = data as any

        if (data.type === 'driver' && driverId) {
          drivers.set(driverId, {
            socket,
            driverId,
            userId,
          })
          socket.join(`driver:${driverId}`)
          console.log(`🚗 Driver registered: ${driverId} (user: ${userId})`)

          // Send pending orders to driver immediately after registration
          const driverData = await prisma.driver.findUnique({
            where: { id: driverId },
          })

          if (driverData && driverData.status === 'ONLINE') {
            const carClassOrder = ['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']
            const driverClassIndex = carClassOrder.indexOf(driverData.carClass)

            const pendingOrders = await prisma.order.findMany({
              where: {
                status: OrderStatus.PENDING,
              },
              include: {
                client: {
                  select: { name: true, rating: true },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 10,
            })

            // Filter orders that match driver's car class
            const matchingOrders = pendingOrders.filter(order => {
              const orderClassIndex = carClassOrder.indexOf(order.carClass)
              return driverClassIndex >= orderClassIndex
            })

            console.log(`📦 Sending ${matchingOrders.length} pending orders to driver ${driverId}`)

            for (const order of matchingOrders) {
              socket.emit('order:available', {
                id: order.id,
                pickupAddress: order.pickupAddress,
                pickupLat: order.pickupLat,
                pickupLng: order.pickupLng,
                dropoffAddress: order.dropoffAddress,
                dropoffLat: order.dropoffLat,
                dropoffLng: order.dropoffLng,
                distance: order.distance,
                price: order.price,
                carClass: order.carClass,
                client: order.client,
              })
            }
          }
        } else if (userId) {
          clients.set(userId, {
            socket,
            userId,
          })
          socket.join(`user:${userId}`)
          console.log(`👤 Client registered: ${userId}`)
        }

        socket.emit('auth:success')
      } catch (error) {
        console.error('❌ Auth error:', error)
        socket.emit('auth:error', { message: 'Authentication failed' })
      }
    })

    // Driver location update
    socket.on('driver:location', async (data: { driverId: string; lat: number; lng: number }) => {
      const driver = drivers.get(data.driverId)
      if (driver) {
        driver.lat = data.lat
        driver.lng = data.lng

        // Update in database
        await prisma.driver.update({
          where: { id: data.driverId },
          data: {
            currentLat: data.lat,
            currentLng: data.lng,
            lastLocationAt: new Date(),
          },
        })

        // If driver has active order, notify client
        const activeOrder = await prisma.order.findFirst({
          where: {
            currentDriverId: data.driverId,
            status: { in: [OrderStatus.ACCEPTED, OrderStatus.ARRIVED, OrderStatus.IN_PROGRESS] },
          },
        })

        if (activeOrder) {
          io.to(`user:${activeOrder.clientId}`).emit('driver:location:update', {
            orderId: activeOrder.id,
            lat: data.lat,
            lng: data.lng,
          })
        }
      }
    })

    // Driver status change
    socket.on('driver:status', async (data: { driverId: string; status: DriverStatus }) => {
      const driver = drivers.get(data.driverId)
      if (driver) {
        await prisma.driver.update({
          where: { id: data.driverId },
          data: { status: data.status },
        })

        console.log(`🚗 Driver ${data.driverId} status: ${data.status}`)
      }
    })

    // New order created - notify available drivers
    socket.on('order:new', async (data: { orderId: string }) => {
      console.log(`📥 Received order:new event for order: ${data.orderId}`)

      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: {
          client: {
            select: { name: true, rating: true },
          },
        },
      })

      if (!order) {
        console.log(`❌ Order ${data.orderId} not found in database`)
        return
      }

      console.log(`📋 Order details: carClass=${order.carClass}, status=${order.status}`)

      // Find available drivers with matching car class OR higher class
      const availableDrivers = await prisma.driver.findMany({
        where: {
          status: DriverStatus.ONLINE,
          isVerified: true,
        },
      })

      console.log(`🔍 Found ${availableDrivers.length} online verified drivers`)
      availableDrivers.forEach(d => {
        console.log(`   - Driver ${d.id}: carClass=${d.carClass}, connected=${drivers.has(d.id)}`)
      })

      // Filter drivers by car class (same or higher)
      const carClassOrder = ['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']
      const orderClassIndex = carClassOrder.indexOf(order.carClass)
      const matchingDrivers = availableDrivers.filter(d =>
        carClassOrder.indexOf(d.carClass) >= orderClassIndex
      )

      console.log(`✅ ${matchingDrivers.length} drivers match car class ${order.carClass} or higher`)

      // Notify each available driver
      let notifiedCount = 0
      for (const dbDriver of matchingDrivers) {
        const driverConn = drivers.get(dbDriver.id)
        if (driverConn) {
          console.log(`📤 Sending order:available to driver ${dbDriver.id}`)
          driverConn.socket.emit('order:available', {
            id: order.id,
            pickupAddress: order.pickupAddress,
            pickupLat: order.pickupLat,
            pickupLng: order.pickupLng,
            dropoffAddress: order.dropoffAddress,
            dropoffLat: order.dropoffLat,
            dropoffLng: order.dropoffLng,
            distance: order.distance,
            price: order.price,
            carClass: order.carClass,
            client: order.client,
          })
          notifiedCount++
        } else {
          console.log(`⚠️ Driver ${dbDriver.id} not connected to socket`)
        }
      }

      console.log(`📦 Order ${data.orderId} broadcasted to ${notifiedCount} connected drivers`)
    })

    // Driver accepts order
    socket.on('order:accept', async (data: { orderId: string; driverId: string }) => {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
      })

      if (!order || order.status !== OrderStatus.PENDING) {
        socket.emit('order:accept:error', { message: 'Order not available' })
        return
      }

      const driver = await prisma.driver.findUnique({
        where: { id: data.driverId },
        include: {
          user: {
            select: { name: true, phone: true, rating: true },
          },
        },
      })

      if (!driver) {
        socket.emit('order:accept:error', { message: 'Driver not found' })
        return
      }

      // Update order
      const updatedOrder = await prisma.order.update({
        where: { id: data.orderId },
        data: {
          driverId: driver.userId,
          currentDriverId: driver.id,
          status: OrderStatus.ACCEPTED,
          acceptedAt: new Date(),
          statusHistory: {
            create: { status: OrderStatus.ACCEPTED },
          },
        },
        include: {
          client: {
            select: { id: true, name: true, phone: true, rating: true },
          },
        },
      })

      // Update driver status
      await prisma.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.BUSY },
      })

      // Notify client
      io.to(`user:${order.clientId}`).emit('order:accepted', {
        orderId: order.id,
        driver: {
          id: driver.id,
          name: driver.user.name,
          phone: driver.user.phone,
          rating: driver.user.rating,
          carModel: driver.carModel,
          carNumber: driver.carNumber,
          carColor: driver.carColor,
          lat: driver.currentLat,
          lng: driver.currentLng,
        },
      })

      // Confirm to driver with full order data
      socket.emit('order:accept:success', {
        orderId: updatedOrder.id,
        order: {
          id: updatedOrder.id,
          pickupAddress: updatedOrder.pickupAddress,
          pickupLat: updatedOrder.pickupLat,
          pickupLng: updatedOrder.pickupLng,
          dropoffAddress: updatedOrder.dropoffAddress,
          dropoffLat: updatedOrder.dropoffLat,
          dropoffLng: updatedOrder.dropoffLng,
          distance: updatedOrder.distance,
          estimatedTime: updatedOrder.estimatedTime,
          price: updatedOrder.price,
          carClass: updatedOrder.carClass,
          client: updatedOrder.client,
          status: updatedOrder.status,
        },
      })

      // Notify other drivers that order is taken
      drivers.forEach((driverConn, dId) => {
        if (dId !== data.driverId) {
          driverConn.socket.emit('order:taken', { orderId: order.id })
        }
      })

      console.log(`✅ Order ${data.orderId} accepted by driver ${data.driverId}`)
    })

    // Driver arrived
    socket.on('order:arrived', async (data: { orderId: string; driverId: string }) => {
      const order = await prisma.order.findUnique({ where: { id: data.orderId } })

      if (!order || order.currentDriverId !== data.driverId) return

      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status: OrderStatus.ARRIVED,
          arrivedAt: new Date(),
          statusHistory: {
            create: { status: OrderStatus.ARRIVED },
          },
        },
      })

      io.to(`user:${order.clientId}`).emit('order:status', {
        orderId: data.orderId,
        status: 'ARRIVED',
      })

      console.log(`🚗 Driver arrived for order ${data.orderId}`)
    })

    // Trip started
    socket.on('order:start', async (data: { orderId: string; driverId: string }) => {
      const order = await prisma.order.findUnique({ where: { id: data.orderId } })

      if (!order || order.currentDriverId !== data.driverId) return

      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status: OrderStatus.IN_PROGRESS,
          startedAt: new Date(),
          statusHistory: {
            create: { status: OrderStatus.IN_PROGRESS },
          },
        },
      })

      io.to(`user:${order.clientId}`).emit('order:status', {
        orderId: data.orderId,
        status: 'IN_PROGRESS',
      })

      console.log(`🚀 Trip started for order ${data.orderId}`)
    })

    // Trip completed
    socket.on('order:complete', async (data: { orderId: string; driverId: string }) => {
      console.log(`📥 Received order:complete event from driver ${data.driverId} for order ${data.orderId}`)

      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { currentDriver: true },
      })

      if (!order) {
        console.log(`❌ Order ${data.orderId} not found`)
        return
      }

      if (order.currentDriverId !== data.driverId) {
        console.log(`❌ Driver mismatch: order has ${order.currentDriverId}, received ${data.driverId}`)
        return
      }

      const finalPrice = order.price

      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
          finalPrice,
          duration: order.startedAt
            ? Math.round((Date.now() - order.startedAt.getTime()) / 60000)
            : null,
          statusHistory: {
            create: { status: OrderStatus.COMPLETED },
          },
        },
      })

      // Update driver
      if (order.currentDriver) {
        await prisma.driver.update({
          where: { id: order.currentDriver.id },
          data: {
            status: DriverStatus.ONLINE,
            totalTrips: { increment: 1 },
            totalEarnings: { increment: finalPrice },
          },
        })
      }

      // Create payment
      await prisma.payment.create({
        data: {
          orderId: order.id,
          userId: order.clientId,
          amount: finalPrice,
          method: order.paymentMethod,
          status: order.paymentMethod === 'CASH' ? 'COMPLETED' : 'PENDING',
          paidAt: order.paymentMethod === 'CASH' ? new Date() : null,
        },
      })

      // Check if client is connected
      const clientConn = clients.get(order.clientId)
      const roomName = `user:${order.clientId}`
      const roomSockets = io.sockets.adapter.rooms.get(roomName)
      console.log(`📤 Sending order:completed to client ${order.clientId}`)
      console.log(`   - In clients Map: ${!!clientConn}`)
      console.log(`   - Room "${roomName}" exists: ${!!roomSockets}`)
      console.log(`   - Room size: ${roomSockets?.size || 0}`)
      if (roomSockets) {
        console.log(`   - Socket IDs in room: ${Array.from(roomSockets).join(', ')}`)
      }

      io.to(roomName).emit('order:completed', {
        orderId: data.orderId,
        finalPrice,
      })

      console.log(`✅ Trip completed for order ${data.orderId}, price: ${finalPrice}`)
    })

    // Order cancelled
    socket.on('order:cancel', async (data: { orderId: string; userId: string; reason?: string }) => {
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: { currentDriver: true },
      })

      if (!order) return

      const isClient = order.clientId === data.userId
      const isDriver = order.driverId === data.userId

      if (!isClient && !isDriver) return

      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: data.reason,
          cancelledBy: isClient ? 'client' : 'driver',
          statusHistory: {
            create: {
              status: OrderStatus.CANCELLED,
              comment: data.reason,
            },
          },
        },
      })

      // Reset driver status
      if (order.currentDriver) {
        await prisma.driver.update({
          where: { id: order.currentDriver.id },
          data: { status: DriverStatus.ONLINE },
        })
      }

      // Notify both parties
      if (isClient && order.driverId) {
        io.to(`user:${order.driverId}`).emit('order:cancelled', {
          orderId: data.orderId,
          cancelledBy: 'client',
          reason: data.reason,
        })
      } else if (isDriver) {
        io.to(`user:${order.clientId}`).emit('order:cancelled', {
          orderId: data.orderId,
          cancelledBy: 'driver',
          reason: data.reason,
        })
      }

      console.log(`❌ Order ${data.orderId} cancelled by ${isClient ? 'client' : 'driver'}`)
    })

    // Join order room (for tracking updates)
    socket.on('order:join', (data: { orderId: string }) => {
      socket.join(`order:${data.orderId}`)

      if (!orderRooms.has(data.orderId)) {
        orderRooms.set(data.orderId, new Set())
      }
      orderRooms.get(data.orderId)!.add(socket.id)
    })

    // Leave order room
    socket.on('order:leave', (data: { orderId: string }) => {
      socket.leave(`order:${data.orderId}`)
      orderRooms.get(data.orderId)?.delete(socket.id)
    })

    // Disconnect handler
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`)

      // Find and remove driver
      for (const [driverId, driver] of drivers.entries()) {
        if (driver.socket.id === socket.id) {
          drivers.delete(driverId)

          // Set driver offline if no active order
          const activeOrder = await prisma.order.findFirst({
            where: {
              currentDriverId: driverId,
              status: { in: [OrderStatus.ACCEPTED, OrderStatus.ARRIVED, OrderStatus.IN_PROGRESS] },
            },
          })

          if (!activeOrder) {
            await prisma.driver.update({
              where: { id: driverId },
              data: { status: DriverStatus.OFFLINE },
            })
          }

          console.log(`🚗 Driver disconnected: ${driverId}`)
          break
        }
      }

      // Find and remove client
      for (const [userId, client] of clients.entries()) {
        if (client.socket.id === socket.id) {
          clients.delete(userId)
          console.log(`👤 Client disconnected: ${userId}`)
          break
        }
      }
    })
  })

  // Periodic cleanup of stale connections
  setInterval(() => {
    drivers.forEach(async (driver, driverId) => {
      if (!driver.socket.connected) {
        drivers.delete(driverId)
        console.log(`🧹 Cleaned up stale driver connection: ${driverId}`)
      }
    })

    clients.forEach((client, userId) => {
      if (!client.socket.connected) {
        clients.delete(userId)
        console.log(`🧹 Cleaned up stale client connection: ${userId}`)
      }
    })
  }, 60000) // Every minute

  // Broadcast driver locations to all clients every 5 seconds
  setInterval(() => {
    const driversData = Array.from(drivers.values())
      .filter(d => d.lat && d.lng)
      .map(d => ({
        id: d.driverId,
        lat: d.lat,
        lng: d.lng,
      }))

    if (driversData.length > 0) {
      io.emit('drivers:locations', driversData)
    }
  }, 5000)

  return io
}

// Export for external use
export function getOnlineDrivers() {
  return Array.from(drivers.values()).map(d => ({
    driverId: d.driverId,
    lat: d.lat,
    lng: d.lng,
  }))
}

export function notifyDriver(driverId: string, event: string, data: any) {
  const driver = drivers.get(driverId)
  if (driver) {
    driver.socket.emit(event, data)
  }
}

export function notifyUser(userId: string, event: string, data: any) {
  const client = clients.get(userId)
  if (client) {
    client.socket.emit(event, data)
  }
}
