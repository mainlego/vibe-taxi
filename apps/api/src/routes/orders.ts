import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma, OrderStatus, CarClass, PaymentMethod } from '@vibe-taxi/database'
import { getIO } from '../socket/index.js'

const createOrderSchema = z.object({
  pickupAddress: z.string().min(5),
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropoffAddress: z.string().min(5),
  dropoffLat: z.number(),
  dropoffLng: z.number(),
  distance: z.number().positive(),
  estimatedTime: z.number().positive(),
  carClass: z.enum(['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']).optional().default('ECONOMY'),
  paymentMethod: z.enum(['CASH', 'CARD', 'WALLET']).optional().default('CASH'),
  promoCode: z.string().optional(),
})

const cancelOrderSchema = z.object({
  reason: z.string().optional(),
})

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
})

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  // Calculate price for order
  fastify.post('/calculate', {
    preHandler: [fastify.authenticate as any],
  }, async (request, reply) => {
    try {
      const { distance, estimatedTime, carClass } = z.object({
        distance: z.number().positive(),
        estimatedTime: z.number().positive(),
        carClass: z.enum(['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']).default('ECONOMY'),
      }).parse(request.body)

      const tariff = await prisma.tariff.findUnique({
        where: { carClass: carClass as CarClass },
      })

      if (!tariff) {
        return reply.status(400).send({ error: 'Tariff not found' })
      }

      // Calculate price
      let price = tariff.baseFare + (distance * tariff.perKm) + (estimatedTime * tariff.perMinute)
      price = Math.max(price, tariff.minFare)

      // TODO: Apply surge pricing if needed

      return {
        price: Math.round(price),
        baseFare: tariff.baseFare,
        perKm: tariff.perKm,
        perMinute: tariff.perMinute,
        minFare: tariff.minFare,
        surge: 1.0,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Create new order
  fastify.post('/', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const data = createOrderSchema.parse(request.body)

      // Get tariff
      const tariff = await prisma.tariff.findUnique({
        where: { carClass: data.carClass as CarClass },
      })

      if (!tariff) {
        return reply.status(400).send({ error: 'Tariff not found' })
      }

      // Calculate price
      let price = tariff.baseFare + (data.distance * tariff.perKm) + (data.estimatedTime * tariff.perMinute)
      price = Math.max(price, tariff.minFare)

      // Apply promo code if provided
      let discount = 0
      if (data.promoCode) {
        const promo = await prisma.promoCode.findFirst({
          where: {
            code: data.promoCode.toUpperCase(),
            isActive: true,
            OR: [
              { validUntil: null },
              { validUntil: { gte: new Date() } },
            ],
            OR: [
              { usageLimit: null },
              { usageCount: { lt: prisma.promoCode.fields.usageLimit } },
            ],
          },
        })

        if (promo) {
          if (promo.discountType === 'PERCENT') {
            discount = price * (promo.discountValue / 100)
            if (promo.maxDiscount) {
              discount = Math.min(discount, promo.maxDiscount)
            }
          } else {
            discount = promo.discountValue
          }

          // Increment usage
          await prisma.promoCode.update({
            where: { id: promo.id },
            data: { usageCount: { increment: 1 } },
          })
        }
      }

      const finalPrice = Math.round(Math.max(price - discount, 0))

      // Create order
      const order = await prisma.order.create({
        data: {
          clientId: request.user.userId,
          pickupAddress: data.pickupAddress,
          pickupLat: data.pickupLat,
          pickupLng: data.pickupLng,
          dropoffAddress: data.dropoffAddress,
          dropoffLat: data.dropoffLat,
          dropoffLng: data.dropoffLng,
          distance: data.distance,
          estimatedTime: data.estimatedTime,
          price: finalPrice,
          carClass: data.carClass as CarClass,
          paymentMethod: data.paymentMethod as PaymentMethod,
          status: OrderStatus.PENDING,
          statusHistory: {
            create: {
              status: OrderStatus.PENDING,
            },
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
      })

      return order
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Get active order for client
  fastify.get('/active', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const order = await prisma.order.findFirst({
      where: {
        clientId: request.user.userId,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.ACCEPTED, OrderStatus.ARRIVED, OrderStatus.IN_PROGRESS],
        },
      },
      include: {
        currentDriver: {
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                rating: true,
              },
            },
          },
        },
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

    if (!order) {
      return null
    }

    return {
      ...order,
      driver: order.currentDriver ? {
        id: order.currentDriver.id,
        name: order.currentDriver.user.name,
        phone: order.currentDriver.user.phone,
        rating: order.currentDriver.user.rating,
        carModel: order.currentDriver.carModel,
        carNumber: order.currentDriver.carNumber,
        carColor: order.currentDriver.carColor,
        lat: order.currentDriver.currentLat,
        lng: order.currentDriver.currentLng,
      } : null,
    }
  })

  // Get my orders (client history)
  fastify.get('/my', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const orders = await prisma.order.findMany({
      where: { clientId: request.user.userId },
      include: {
        currentDriver: {
          include: {
            user: {
              select: {
                name: true,
                rating: true,
              },
            },
          },
        },
        reviews: {
          where: { authorId: request.user.userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return orders.map(order => ({
      ...order,
      driver: order.currentDriver ? {
        id: order.currentDriver.id,
        name: order.currentDriver.user.name,
        rating: order.currentDriver.user.rating,
        carModel: order.currentDriver.carModel,
        carNumber: order.currentDriver.carNumber,
      } : null,
    }))
  })

  // Get order by ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
            avatar: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            rating: true,
            avatar: true,
          },
        },
        currentDriver: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        reviews: true,
      },
    })

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' })
    }

    // Check access
    if (order.clientId !== request.user.userId && order.driverId !== request.user.userId) {
      if (request.user.role !== 'ADMIN' && request.user.role !== 'SUPPORT') {
        return reply.status(403).send({ error: 'Access denied' })
      }
    }

    return order
  })

  // Get available orders (for drivers)
  fastify.get('/available', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    if (request.user.role !== 'DRIVER') {
      return reply.status(403).send({ error: 'Only drivers can view available orders' })
    }

    const driver = await prisma.driver.findUnique({
      where: { userId: request.user.userId },
    })

    if (!driver) {
      return reply.status(400).send({ error: 'Driver profile not found' })
    }

    const orders = await prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        carClass: driver.carClass,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return orders
  })

  // Accept order (driver)
  fastify.post('/:id/accept', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    if (request.user.role !== 'DRIVER') {
      return reply.status(403).send({ error: 'Only drivers can accept orders' })
    }

    const driver = await prisma.driver.findUnique({
      where: { userId: request.user.userId },
    })

    if (!driver) {
      return reply.status(400).send({ error: 'Driver profile not found' })
    }

    const order = await prisma.order.findUnique({ where: { id } })

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' })
    }

    if (order.status !== OrderStatus.PENDING) {
      return reply.status(400).send({ error: 'Order is not available' })
    }

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        driverId: request.user.userId,
        currentDriverId: driver.id,
        status: OrderStatus.ACCEPTED,
        acceptedAt: new Date(),
        statusHistory: {
          create: {
            status: OrderStatus.ACCEPTED,
          },
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
        currentDriver: true,
      },
    })

    // Update driver status
    await prisma.driver.update({
      where: { id: driver.id },
      data: { status: 'BUSY' },
    })

    return updatedOrder
  })

  // Driver arrived
  fastify.post('/:id/arrived', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    const order = await prisma.order.findUnique({ where: { id } })

    if (!order || order.driverId !== request.user.userId) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    if (order.status !== OrderStatus.ACCEPTED) {
      return reply.status(400).send({ error: 'Invalid order status' })
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.ARRIVED,
        arrivedAt: new Date(),
        statusHistory: {
          create: {
            status: OrderStatus.ARRIVED,
          },
        },
      },
    })

    // Notify client via socket
    const io = getIO()
    if (io) {
      io.to(`user:${order.clientId}`).emit('order:status', {
        orderId: id,
        status: 'ARRIVED',
      })
    }

    return updatedOrder
  })

  // Start trip
  fastify.post('/:id/start', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    const order = await prisma.order.findUnique({ where: { id } })

    if (!order || order.driverId !== request.user.userId) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    if (order.status !== OrderStatus.ARRIVED) {
      return reply.status(400).send({ error: 'Invalid order status' })
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.IN_PROGRESS,
        startedAt: new Date(),
        statusHistory: {
          create: {
            status: OrderStatus.IN_PROGRESS,
          },
        },
      },
    })

    // Notify client via socket
    const io = getIO()
    if (io) {
      io.to(`user:${order.clientId}`).emit('order:status', {
        orderId: id,
        status: 'IN_PROGRESS',
      })
    }

    return updatedOrder
  })

  // Complete trip
  fastify.post('/:id/complete', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { currentDriver: true },
    })

    if (!order || order.driverId !== request.user.userId) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    if (order.status !== OrderStatus.IN_PROGRESS) {
      return reply.status(400).send({ error: 'Invalid order status' })
    }

    // Calculate final price (could include actual distance/time)
    const finalPrice = order.price

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.COMPLETED,
        completedAt: new Date(),
        finalPrice,
        duration: order.startedAt
          ? Math.round((Date.now() - order.startedAt.getTime()) / 60000)
          : null,
        statusHistory: {
          create: {
            status: OrderStatus.COMPLETED,
          },
        },
      },
    })

    // Update driver stats and status
    if (order.currentDriver) {
      await prisma.driver.update({
        where: { id: order.currentDriver.id },
        data: {
          status: 'ONLINE',
          totalTrips: { increment: 1 },
          totalEarnings: { increment: finalPrice },
          currentOrder: { disconnect: true },
        },
      })
    }

    // Create payment record
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

    // Notify client via socket that order is completed
    const io = getIO()
    if (io) {
      const roomName = `user:${order.clientId}`
      console.log(`📤 API: Emitting order:completed to ${roomName}`)
      io.to(roomName).emit('order:completed', {
        orderId: id,
        finalPrice,
      })
    }

    return updatedOrder
  })

  // Cancel order
  fastify.post('/:id/cancel', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    try {
      const { reason } = cancelOrderSchema.parse(request.body)

      const order = await prisma.order.findUnique({
        where: { id },
        include: { currentDriver: true },
      })

      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      // Check access
      const isClient = order.clientId === request.user.userId
      const isDriver = order.driverId === request.user.userId
      const isAdmin = request.user.role === 'ADMIN'

      if (!isClient && !isDriver && !isAdmin) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      // Can only cancel if not completed
      if (order.status === OrderStatus.COMPLETED) {
        return reply.status(400).send({ error: 'Cannot cancel completed order' })
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
          cancelledBy: isClient ? 'client' : isDriver ? 'driver' : 'system',
          statusHistory: {
            create: {
              status: OrderStatus.CANCELLED,
              comment: reason,
            },
          },
        },
      })

      // Reset driver status
      if (order.currentDriver) {
        await prisma.driver.update({
          where: { id: order.currentDriver.id },
          data: { status: 'ONLINE' },
        })
      }

      return updatedOrder
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Add review
  fastify.post('/:id/review', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    try {
      const { rating, comment } = reviewSchema.parse(request.body)

      const order = await prisma.order.findUnique({
        where: { id },
        include: { reviews: true },
      })

      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      if (order.status !== OrderStatus.COMPLETED) {
        return reply.status(400).send({ error: 'Can only review completed orders' })
      }

      // Determine who is reviewing whom
      const isClient = order.clientId === request.user.userId
      const isDriver = order.driverId === request.user.userId

      if (!isClient && !isDriver) {
        return reply.status(403).send({ error: 'Access denied' })
      }

      const targetId = isClient ? order.driverId : order.clientId

      if (!targetId) {
        return reply.status(400).send({ error: 'No target for review' })
      }

      // Check if already reviewed
      const existingReview = order.reviews.find(r => r.authorId === request.user.userId)
      if (existingReview) {
        return reply.status(400).send({ error: 'Already reviewed' })
      }

      const review = await prisma.review.create({
        data: {
          orderId: id,
          authorId: request.user.userId,
          targetId,
          rating,
          comment,
        },
      })

      // Update target's rating
      const targetReviews = await prisma.review.findMany({
        where: { targetId },
        select: { rating: true },
      })

      const avgRating = targetReviews.reduce((sum, r) => sum + r.rating, 0) / targetReviews.length

      await prisma.user.update({
        where: { id: targetId },
        data: { rating: Math.round(avgRating * 10) / 10 },
      })

      return review
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })
}
