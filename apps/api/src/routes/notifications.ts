import { FastifyPluginAsync } from 'fastify'
import { prisma } from '@vibe-taxi/database'

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user notifications
  fastify.get('/', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const userId = request.user.userId

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return notifications
  })

  // Get unread count
  fastify.get('/unread-count', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const userId = request.user.userId

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    })

    return { count }
  })

  // Mark notification as read
  fastify.patch('/:id/read', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const userId = request.user.userId

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    })

    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found' })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    })

    return updated
  })

  // Mark all as read
  fastify.patch('/read-all', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const userId = request.user.userId

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })

    return { success: true }
  })

  // Delete notification
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const userId = request.user.userId

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    })

    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found' })
    }

    await prisma.notification.delete({
      where: { id },
    })

    return { success: true }
  })

  // Delete all notifications
  fastify.delete('/', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const userId = request.user.userId

    await prisma.notification.deleteMany({
      where: { userId },
    })

    return { success: true }
  })
}
