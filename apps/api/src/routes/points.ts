import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@vibe-taxi/database'

// Points settings
const POINTS_PER_TRIP = 10 // Points per completed trip
const POINTS_PER_100_RUB = 5 // Points per 100 rub spent
const REFERRAL_BONUS_POINTS = 100 // Points for inviting a friend
const REFERRAL_TRIP_BONUS = 20 // Points when referral completes a trip
const WELCOME_BONUS = 50 // Welcome bonus for new users

const applyReferralSchema = z.object({
  referralCode: z.string().min(1),
})

const redeemRewardSchema = z.object({
  rewardId: z.string().min(1),
})

export const pointsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get client points info
  fastify.get('/me', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId

    // Get or create client points
    let clientPoints = await prisma.clientPoints.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        redeemedRewards: {
          where: { status: 'ACTIVE' },
          include: { reward: true }
        },
        referredBy: {
          include: {
            user: { select: { name: true } }
          }
        },
        referrals: {
          include: {
            user: { select: { name: true, avatar: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    // Create if doesn't exist
    if (!clientPoints) {
      clientPoints = await prisma.clientPoints.create({
        data: {
          userId,
          balance: WELCOME_BONUS,
          totalEarned: WELCOME_BONUS,
        },
        include: {
          transactions: true,
          redeemedRewards: {
            where: { status: 'ACTIVE' },
            include: { reward: true }
          },
          referredBy: {
            include: {
              user: { select: { name: true } }
            }
          },
          referrals: {
            include: {
              user: { select: { name: true, avatar: true } }
            }
          }
        }
      })

      // Create welcome bonus transaction
      await prisma.pointTransaction.create({
        data: {
          clientPointsId: clientPoints.id,
          amount: WELCOME_BONUS,
          type: 'WELCOME_BONUS',
          description: 'Приветственный бонус'
        }
      })

      // Refetch to include the transaction
      clientPoints = await prisma.clientPoints.findUnique({
        where: { userId },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20
          },
          redeemedRewards: {
            where: { status: 'ACTIVE' },
            include: { reward: true }
          },
          referredBy: {
            include: {
              user: { select: { name: true } }
            }
          },
          referrals: {
            include: {
              user: { select: { name: true, avatar: true } }
            }
          }
        }
      })
    }

    return {
      balance: clientPoints!.balance,
      totalEarned: clientPoints!.totalEarned,
      totalSpent: clientPoints!.totalSpent,
      referralCode: clientPoints!.referralCode,
      referredBy: clientPoints!.referredBy ? {
        name: clientPoints!.referredBy.user.name
      } : null,
      referrals: clientPoints!.referrals.map(r => ({
        id: r.id,
        name: r.user.name,
        avatar: r.user.avatar,
        joinedAt: r.createdAt
      })),
      referralsCount: clientPoints!.referrals.length,
      activeRewards: clientPoints!.redeemedRewards.map(rr => ({
        id: rr.id,
        reward: {
          id: rr.reward.id,
          name: rr.reward.name,
          description: rr.reward.description,
          type: rr.reward.type,
          value: rr.reward.value,
          icon: rr.reward.icon,
        },
        expiresAt: rr.expiresAt,
        createdAt: rr.createdAt
      })),
      recentTransactions: clientPoints!.transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt
      })),
      pointsSettings: {
        perTrip: POINTS_PER_TRIP,
        per100Rub: POINTS_PER_100_RUB,
        referralBonus: REFERRAL_BONUS_POINTS,
        referralTripBonus: REFERRAL_TRIP_BONUS
      }
    }
  })

  // Get transaction history
  fastify.get('/transactions', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number }

    const clientPoints = await prisma.clientPoints.findUnique({
      where: { userId }
    })

    if (!clientPoints) {
      return { transactions: [], total: 0 }
    }

    const [transactions, total] = await Promise.all([
      prisma.pointTransaction.findMany({
        where: { clientPointsId: clientPoints.id },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset)
      }),
      prisma.pointTransaction.count({
        where: { clientPointsId: clientPoints.id }
      })
    ])

    return {
      transactions: transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt
      })),
      total
    }
  })

  // Apply referral code
  fastify.post('/referral/apply', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const { referralCode } = applyReferralSchema.parse(request.body)
      const userId = request.user.userId

      // Get or create client points
      let clientPoints = await prisma.clientPoints.findUnique({
        where: { userId }
      })

      if (!clientPoints) {
        clientPoints = await prisma.clientPoints.create({
          data: { userId }
        })
      }

      if (clientPoints.referredById) {
        return reply.status(400).send({ error: 'У вас уже есть реферер' })
      }

      // Find referrer by code
      const referrer = await prisma.clientPoints.findUnique({
        where: { referralCode },
        include: { user: { select: { name: true } } }
      })

      if (!referrer) {
        return reply.status(404).send({ error: 'Неверный реферальный код' })
      }

      if (referrer.userId === userId) {
        return reply.status(400).send({ error: 'Нельзя использовать собственный код' })
      }

      // Apply referral
      await prisma.$transaction([
        // Update client with referrer
        prisma.clientPoints.update({
          where: { id: clientPoints.id },
          data: { referredById: referrer.id }
        }),
        // Add bonus to referrer
        prisma.clientPoints.update({
          where: { id: referrer.id },
          data: {
            balance: { increment: REFERRAL_BONUS_POINTS },
            totalEarned: { increment: REFERRAL_BONUS_POINTS }
          }
        }),
        // Create transaction for referrer
        prisma.pointTransaction.create({
          data: {
            clientPointsId: referrer.id,
            amount: REFERRAL_BONUS_POINTS,
            type: 'REFERRAL_BONUS',
            description: 'Бонус за приглашённого друга'
          }
        })
      ])

      return {
        success: true,
        message: 'Реферальный код применён',
        referrerName: referrer.user.name
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Validate referral code
  fastify.get('/referral/validate/:code', async (request, reply) => {
    const { code } = request.params as { code: string }

    const clientPoints = await prisma.clientPoints.findUnique({
      where: { referralCode: code },
      include: {
        user: { select: { name: true, avatar: true } }
      }
    })

    if (!clientPoints) {
      return reply.status(404).send({ error: 'Неверный реферальный код' })
    }

    return {
      valid: true,
      referrer: {
        name: clientPoints.user.name,
        avatar: clientPoints.user.avatar
      }
    }
  })

  // Regenerate referral code
  fastify.post('/referral/regenerate', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId

    const clientPoints = await prisma.clientPoints.findUnique({
      where: { userId }
    })

    if (!clientPoints) {
      return reply.status(404).send({ error: 'Points account not found' })
    }

    const newCode = generateReadableCode()

    const updated = await prisma.clientPoints.update({
      where: { id: clientPoints.id },
      data: { referralCode: newCode }
    })

    return { referralCode: updated.referralCode }
  })
}

// Generate a readable 6-char alphanumeric code
function generateReadableCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
