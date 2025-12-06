import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma, DriverStatus, CarClass } from '@vibe-taxi/database'

const registerDriverSchema = z.object({
  carModel: z.string().min(2).max(100),
  carNumber: z.string().min(4).max(20),
  carColor: z.string().optional(),
  carYear: z.number().min(1990).max(new Date().getFullYear() + 1).optional(),
  carClass: z.enum(['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']).default('ECONOMY'),
  licenseNumber: z.string().optional(),
})

const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const updateStatusSchema = z.object({
  status: z.enum(['ONLINE', 'OFFLINE', 'BREAK', 'BUSY']),
})

export const driverRoutes: FastifyPluginAsync = async (fastify) => {
  // Register as driver
  fastify.post('/register', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const data = registerDriverSchema.parse(request.body)

      // Check if already a driver
      const existingDriver = await prisma.driver.findUnique({
        where: { userId: request.user.userId },
      })

      if (existingDriver) {
        return reply.status(400).send({ error: 'Already registered as driver' })
      }

      // Check car number uniqueness
      const existingCar = await prisma.driver.findUnique({
        where: { carNumber: data.carNumber },
      })

      if (existingCar) {
        return reply.status(400).send({ error: 'Car number already registered' })
      }

      // Create driver profile
      const driver = await prisma.driver.create({
        data: {
          userId: request.user.userId,
          carModel: data.carModel,
          carNumber: data.carNumber,
          carColor: data.carColor,
          carYear: data.carYear,
          carClass: data.carClass as CarClass,
          licenseNumber: data.licenseNumber,
          status: DriverStatus.OFFLINE,
        },
      })

      // Update user role
      await prisma.user.update({
        where: { id: request.user.userId },
        data: { role: 'DRIVER' },
      })

      return driver
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Get driver profile
  fastify.get('/me', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const driver = await prisma.driver.findUnique({
      where: { userId: request.user.userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
            avatar: true,
          },
        },
        currentOrder: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                phone: true,
                rating: true,
              },
            },
          },
        },
      },
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Driver profile not found' })
    }

    return driver
  })

  // Update driver profile
  fastify.patch('/me', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const driver = await prisma.driver.findUnique({
      where: { userId: request.user.userId },
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Driver profile not found' })
    }

    try {
      const data = registerDriverSchema.partial().parse(request.body)

      // Check car number uniqueness if changing
      if (data.carNumber && data.carNumber !== driver.carNumber) {
        const existingCar = await prisma.driver.findUnique({
          where: { carNumber: data.carNumber },
        })

        if (existingCar) {
          return reply.status(400).send({ error: 'Car number already registered' })
        }
      }

      const updatedDriver = await prisma.driver.update({
        where: { id: driver.id },
        data: {
          ...data,
          carClass: data.carClass as CarClass | undefined,
        },
      })

      return updatedDriver
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Update location
  fastify.post('/location', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const { lat, lng } = updateLocationSchema.parse(request.body)

      const driver = await prisma.driver.findUnique({
        where: { userId: request.user.userId },
      })

      if (!driver) {
        return reply.status(404).send({ error: 'Driver profile not found' })
      }

      await prisma.driver.update({
        where: { id: driver.id },
        data: {
          currentLat: lat,
          currentLng: lng,
          lastLocationAt: new Date(),
        },
      })

      return { success: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Update status
  fastify.post('/status', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      console.log('📊 Status update request:', JSON.stringify(request.body))
      const { status } = updateStatusSchema.parse(request.body)

      const driver = await prisma.driver.findUnique({
        where: { userId: request.user.userId },
        include: { currentOrder: true },
      })

      if (!driver) {
        return reply.status(404).send({ error: 'Driver profile not found' })
      }

      // Can't go offline with active order
      if (status === 'OFFLINE' && driver.currentOrder) {
        return reply.status(400).send({ error: 'Cannot go offline with active order' })
      }

      await prisma.driver.update({
        where: { id: driver.id },
        data: { status: status as DriverStatus },
      })

      return { success: true, status }
    } catch (error) {
      console.error('❌ Status update error:', error)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Get active order for driver
  fastify.get('/me/active-order', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const driver = await prisma.driver.findUnique({
      where: { userId: request.user.userId },
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Driver profile not found' })
    }

    const order = await prisma.order.findFirst({
      where: {
        currentDriverId: driver.id,
        status: {
          in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'],
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return order
  })

  // Get driver stats
  fastify.get('/me/stats', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const driver = await prisma.driver.findUnique({
      where: { userId: request.user.userId },
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Driver profile not found' })
    }

    // Get today's stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayOrders = await prisma.order.findMany({
      where: {
        driverId: request.user.userId,
        completedAt: { gte: today },
        status: 'COMPLETED',
      },
      select: {
        finalPrice: true,
      },
    })

    const todayEarnings = todayOrders.reduce((sum, o) => sum + (o.finalPrice || 0), 0)
    const todayTrips = todayOrders.length

    // Get weekly stats
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    weekAgo.setHours(0, 0, 0, 0)

    const weekOrders = await prisma.order.findMany({
      where: {
        driverId: request.user.userId,
        completedAt: { gte: weekAgo },
        status: 'COMPLETED',
      },
      select: {
        finalPrice: true,
      },
    })

    const weekEarnings = weekOrders.reduce((sum, o) => sum + (o.finalPrice || 0), 0)
    const weekTrips = weekOrders.length

    return {
      totalTrips: driver.totalTrips,
      totalEarnings: driver.totalEarnings,
      acceptanceRate: driver.acceptanceRate,
      today: {
        trips: todayTrips,
        earnings: todayEarnings,
      },
      week: {
        trips: weekTrips,
        earnings: weekEarnings,
      },
    }
  })

  // Get driver's order history
  fastify.get('/me/orders', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const orders = await prisma.order.findMany({
      where: { driverId: request.user.userId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            rating: true,
          },
        },
        reviews: {
          where: { authorId: request.user.userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return orders
  })

  // Get nearby drivers (for admin/debug)
  fastify.get('/nearby', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { lat, lng, radius } = request.query as {
      lat: string
      lng: string
      radius?: string
    }

    if (!lat || !lng) {
      return reply.status(400).send({ error: 'lat and lng required' })
    }

    const radiusKm = Number(radius) || 5

    // Get all online drivers with location
    const drivers = await prisma.driver.findMany({
      where: {
        status: 'ONLINE',
        currentLat: { not: null },
        currentLng: { not: null },
      },
      include: {
        user: {
          select: {
            name: true,
            rating: true,
          },
        },
      },
    })

    // Filter by distance (simple calculation)
    const centerLat = Number(lat)
    const centerLng = Number(lng)

    const nearbyDrivers = drivers.filter(driver => {
      if (!driver.currentLat || !driver.currentLng) return false

      // Haversine formula approximation
      const dLat = (driver.currentLat - centerLat) * Math.PI / 180
      const dLng = (driver.currentLng - centerLng) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(centerLat * Math.PI / 180) *
        Math.cos(driver.currentLat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = 6371 * c // km

      return distance <= radiusKm
    })

    return nearbyDrivers.map(d => ({
      id: d.id,
      name: d.user.name,
      rating: d.user.rating,
      carModel: d.carModel,
      carNumber: d.carNumber,
      carClass: d.carClass,
      lat: d.currentLat,
      lng: d.currentLng,
    }))
  })
}
