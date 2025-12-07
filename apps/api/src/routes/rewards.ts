import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@vibe-taxi/database'

const REWARD_EXPIRY_DAYS = 30 // Days until redeemed reward expires

const redeemRewardSchema = z.object({
  rewardId: z.string().min(1),
})

export const rewardsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all available rewards
  fastify.get('/', async (request, reply) => {
    const rewards = await prisma.reward.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      orderBy: [
        { sortOrder: 'asc' },
        { pointsCost: 'asc' }
      ]
    })

    // Manual filter for maxRedemptions (Prisma doesn't support field comparison directly)
    const availableRewards = rewards.filter(r =>
      r.maxRedemptions === null || r.currentRedemptions < r.maxRedemptions
    )

    return availableRewards.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      icon: r.icon,
      image: r.image,
      type: r.type,
      value: r.value,
      pointsCost: r.pointsCost,
      expiresAt: r.expiresAt,
      isLimited: r.maxRedemptions !== null,
      remaining: r.maxRedemptions ? r.maxRedemptions - r.currentRedemptions : null
    }))
  })

  // Get reward by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const reward = await prisma.reward.findUnique({
      where: { id }
    })

    if (!reward) {
      return reply.status(404).send({ error: 'Подарок не найден' })
    }

    return {
      id: reward.id,
      name: reward.name,
      description: reward.description,
      icon: reward.icon,
      image: reward.image,
      type: reward.type,
      value: reward.value,
      pointsCost: reward.pointsCost,
      expiresAt: reward.expiresAt,
      isLimited: reward.maxRedemptions !== null,
      remaining: reward.maxRedemptions ? reward.maxRedemptions - reward.currentRedemptions : null,
      isActive: reward.isActive
    }
  })

  // Redeem a reward
  fastify.post('/redeem', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const { rewardId } = redeemRewardSchema.parse(request.body)
      const userId = request.user.userId

      // Get client points
      const clientPoints = await prisma.clientPoints.findUnique({
        where: { userId }
      })

      if (!clientPoints) {
        return reply.status(404).send({ error: 'Аккаунт баллов не найден' })
      }

      // Get reward
      const reward = await prisma.reward.findUnique({
        where: { id: rewardId }
      })

      if (!reward) {
        return reply.status(404).send({ error: 'Подарок не найден' })
      }

      if (!reward.isActive) {
        return reply.status(400).send({ error: 'Подарок недоступен' })
      }

      if (reward.expiresAt && reward.expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Срок действия подарка истёк' })
      }

      if (reward.maxRedemptions && reward.currentRedemptions >= reward.maxRedemptions) {
        return reply.status(400).send({ error: 'Подарки закончились' })
      }

      if (clientPoints.balance < reward.pointsCost) {
        return reply.status(400).send({
          error: 'Недостаточно баллов',
          required: reward.pointsCost,
          current: clientPoints.balance
        })
      }

      // Calculate expiry date
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + REWARD_EXPIRY_DAYS)

      // Perform redemption in transaction
      const [redeemedReward] = await prisma.$transaction([
        // Create redeemed reward
        prisma.redeemedReward.create({
          data: {
            clientPointsId: clientPoints.id,
            rewardId: reward.id,
            pointsSpent: reward.pointsCost,
            expiresAt
          }
        }),
        // Deduct points
        prisma.clientPoints.update({
          where: { id: clientPoints.id },
          data: {
            balance: { decrement: reward.pointsCost },
            totalSpent: { increment: reward.pointsCost }
          }
        }),
        // Create transaction record
        prisma.pointTransaction.create({
          data: {
            clientPointsId: clientPoints.id,
            amount: -reward.pointsCost,
            type: 'REWARD_REDEMPTION',
            description: `Активация подарка: ${reward.name}`,
            redeemedRewardId: reward.id
          }
        }),
        // Increment reward redemption count
        prisma.reward.update({
          where: { id: reward.id },
          data: { currentRedemptions: { increment: 1 } }
        })
      ])

      return {
        success: true,
        redeemedReward: {
          id: redeemedReward.id,
          reward: {
            name: reward.name,
            type: reward.type,
            value: reward.value
          },
          expiresAt,
          pointsSpent: reward.pointsCost
        },
        newBalance: clientPoints.balance - reward.pointsCost
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Get user's redeemed rewards
  fastify.get('/my', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId
    const { status } = request.query as { status?: string }

    const clientPoints = await prisma.clientPoints.findUnique({
      where: { userId }
    })

    if (!clientPoints) {
      return { rewards: [] }
    }

    const whereClause: any = { clientPointsId: clientPoints.id }
    if (status) {
      whereClause.status = status.toUpperCase()
    }

    const redeemedRewards = await prisma.redeemedReward.findMany({
      where: whereClause,
      include: { reward: true },
      orderBy: { createdAt: 'desc' }
    })

    return {
      rewards: redeemedRewards.map(rr => ({
        id: rr.id,
        reward: {
          id: rr.reward.id,
          name: rr.reward.name,
          description: rr.reward.description,
          icon: rr.reward.icon,
          type: rr.reward.type,
          value: rr.reward.value
        },
        status: rr.status,
        pointsSpent: rr.pointsSpent,
        expiresAt: rr.expiresAt,
        usedAt: rr.usedAt,
        createdAt: rr.createdAt
      }))
    }
  })

  // Get active (usable) rewards for order
  fastify.get('/my/active', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId

    const clientPoints = await prisma.clientPoints.findUnique({
      where: { userId }
    })

    if (!clientPoints) {
      return { rewards: [] }
    }

    const activeRewards = await prisma.redeemedReward.findMany({
      where: {
        clientPointsId: clientPoints.id,
        status: 'ACTIVE',
        expiresAt: { gte: new Date() }
      },
      include: { reward: true },
      orderBy: { expiresAt: 'asc' }
    })

    return {
      rewards: activeRewards.map(rr => ({
        id: rr.id,
        reward: {
          id: rr.reward.id,
          name: rr.reward.name,
          description: rr.reward.description,
          icon: rr.reward.icon,
          type: rr.reward.type,
          value: rr.reward.value
        },
        expiresAt: rr.expiresAt,
        createdAt: rr.createdAt
      }))
    }
  })
}
