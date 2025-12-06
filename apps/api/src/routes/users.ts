import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@vibe-taxi/database'

const updateUserSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  avatar: z.string().url().optional(),
})

const addAddressSchema = z.object({
  name: z.string().min(1).max(50),
  address: z.string().min(5),
  lat: z.number(),
  lng: z.number(),
  isDefault: z.boolean().optional().default(false),
})

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user profile
  fastify.get('/:id', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        avatar: true,
        rating: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return user
  })

  // Update user profile
  fastify.patch('/me', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const data = updateUserSchema.parse(request.body)

      const user = await prisma.user.update({
        where: { id: request.user.userId },
        data,
      })

      return {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        rating: user.rating,
        role: user.role,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Get user's saved addresses
  fastify.get('/me/addresses', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const addresses = await prisma.address.findMany({
      where: { userId: request.user.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    return addresses
  })

  // Add new address
  fastify.post('/me/addresses', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const data = addAddressSchema.parse(request.body)

      // If setting as default, unset other defaults
      if (data.isDefault) {
        await prisma.address.updateMany({
          where: { userId: request.user.userId },
          data: { isDefault: false },
        })
      }

      const address = await prisma.address.create({
        data: {
          ...data,
          userId: request.user.userId,
        },
      })

      return address
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Update address
  fastify.patch('/me/addresses/:addressId', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { addressId } = request.params as { addressId: string }

    try {
      const data = addAddressSchema.partial().parse(request.body)

      // Verify ownership
      const existing = await prisma.address.findFirst({
        where: { id: addressId, userId: request.user.userId },
      })

      if (!existing) {
        return reply.status(404).send({ error: 'Address not found' })
      }

      // If setting as default, unset other defaults
      if (data.isDefault) {
        await prisma.address.updateMany({
          where: { userId: request.user.userId, id: { not: addressId } },
          data: { isDefault: false },
        })
      }

      const address = await prisma.address.update({
        where: { id: addressId },
        data,
      })

      return address
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Delete address
  fastify.delete('/me/addresses/:addressId', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { addressId } = request.params as { addressId: string }

    // Verify ownership
    const existing = await prisma.address.findFirst({
      where: { id: addressId, userId: request.user.userId },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Address not found' })
    }

    await prisma.address.delete({ where: { id: addressId } })

    return { success: true }
  })

  // Get user's order history
  fastify.get('/me/orders', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const orders = await prisma.order.findMany({
      where: { clientId: request.user.userId },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            avatar: true,
            rating: true,
          },
        },
        reviews: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return orders
  })

  // Get user's notifications
  fastify.get('/me/notifications', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return notifications
  })

  // Mark notification as read
  fastify.patch('/me/notifications/:notificationId/read', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { notificationId } = request.params as { notificationId: string }

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId: request.user.userId },
    })

    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found' })
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })

    return { success: true }
  })

  // Mark all notifications as read
  fastify.patch('/me/notifications/read-all', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    await prisma.notification.updateMany({
      where: { userId: request.user.userId, isRead: false },
      data: { isRead: true },
    })

    return { success: true }
  })
}
