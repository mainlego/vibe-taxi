import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@vibe-taxi/database'

const createReviewSchema = z.object({
  orderId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
})

export const reviewRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a review
  fastify.post('/', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const data = createReviewSchema.parse(request.body)
      const userId = request.user.userId

      // Get the order
      const order = await prisma.order.findUnique({
        where: { id: data.orderId },
        include: {
          client: true,
          driver: true,
        },
      })

      if (!order) {
        return reply.status(404).send({ error: 'Order not found' })
      }

      if (order.status !== 'COMPLETED') {
        return reply.status(400).send({ error: 'Can only review completed orders' })
      }

      // Check if user is part of this order
      const isClient = order.clientId === userId
      const isDriver = order.driverId === userId

      if (!isClient && !isDriver) {
        return reply.status(403).send({ error: 'You are not part of this order' })
      }

      // Determine target (who receives the review)
      const targetId = isClient ? order.driverId : order.clientId

      if (!targetId) {
        return reply.status(400).send({ error: 'No target for review' })
      }

      // Check if already reviewed
      const existingReview = await prisma.review.findUnique({
        where: {
          orderId_authorId: {
            orderId: data.orderId,
            authorId: userId,
          },
        },
      })

      if (existingReview) {
        return reply.status(400).send({ error: 'You already reviewed this order' })
      }

      // Create review
      const review = await prisma.review.create({
        data: {
          orderId: data.orderId,
          authorId: userId,
          targetId,
          rating: data.rating,
          comment: data.comment,
        },
        include: {
          author: {
            select: { name: true, avatar: true },
          },
        },
      })

      // Update target's rating
      const allReviews = await prisma.review.findMany({
        where: { targetId },
        select: { rating: true },
      })

      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length

      await prisma.user.update({
        where: { id: targetId },
        data: { rating: Math.round(avgRating * 10) / 10 }, // Round to 1 decimal
      })

      return review
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Get reviews for a user
  fastify.get('/user/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const reviews = await prisma.review.findMany({
      where: { targetId: userId },
      include: {
        author: {
          select: { name: true, avatar: true },
        },
        order: {
          select: {
            pickupAddress: true,
            dropoffAddress: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Calculate stats
    const stats = {
      totalReviews: reviews.length,
      averageRating: reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : 0,
      ratingDistribution: {
        5: reviews.filter(r => r.rating === 5).length,
        4: reviews.filter(r => r.rating === 4).length,
        3: reviews.filter(r => r.rating === 3).length,
        2: reviews.filter(r => r.rating === 2).length,
        1: reviews.filter(r => r.rating === 1).length,
      },
    }

    return { reviews, stats }
  })

  // Get my reviews (reviews I gave)
  fastify.get('/my', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const reviews = await prisma.review.findMany({
      where: { authorId: request.user.userId },
      include: {
        target: {
          select: { name: true, avatar: true },
        },
        order: {
          select: {
            pickupAddress: true,
            dropoffAddress: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reviews
  })

  // Get reviews I received
  fastify.get('/received', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any) => {
    const reviews = await prisma.review.findMany({
      where: { targetId: request.user.userId },
      include: {
        author: {
          select: { name: true, avatar: true },
        },
        order: {
          select: {
            pickupAddress: true,
            dropoffAddress: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return reviews
  })

  // Check if order can be reviewed
  fastify.get('/can-review/:orderId', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { orderId } = request.params as { orderId: string }
    const userId = request.user.userId

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' })
    }

    if (order.status !== 'COMPLETED') {
      return { canReview: false, reason: 'Order not completed' }
    }

    const isClient = order.clientId === userId
    const isDriver = order.driverId === userId

    if (!isClient && !isDriver) {
      return { canReview: false, reason: 'Not part of order' }
    }

    const existingReview = await prisma.review.findUnique({
      where: {
        orderId_authorId: {
          orderId,
          authorId: userId,
        },
      },
    })

    if (existingReview) {
      return { canReview: false, reason: 'Already reviewed' }
    }

    return { canReview: true }
  })
}
