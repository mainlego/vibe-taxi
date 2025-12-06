import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@vibe-taxi/database'

// Referral bonus settings (could be moved to Settings table)
const REFERRAL_BONUS_REGISTRATION = 500 // Bonus for referrer when new driver registers
const REFERRAL_BONUS_FIRST_TRIP = 200 // Bonus when referred driver completes first trip
const REFERRAL_TRIPS_MILESTONE = 10 // Trips milestone for bonus
const REFERRAL_BONUS_MILESTONE = 1000 // Bonus at milestone

const applyReferralSchema = z.object({
  referralCode: z.string().min(1),
})

export const referralRoutes: FastifyPluginAsync = async (fastify) => {
  // Get driver's referral info
  fastify.get('/info', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId

    const driver = await prisma.driver.findUnique({
      where: { userId },
      include: {
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
        },
        referralPayouts: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Driver not found' })
    }

    // Calculate stats
    const totalEarned = driver.referralPayouts
      .filter(p => p.isPaid)
      .reduce((sum, p) => sum + p.amount, 0)

    const pendingPayout = driver.referralPayouts
      .filter(p => !p.isPaid)
      .reduce((sum, p) => sum + p.amount, 0)

    return {
      referralCode: driver.referralCode,
      referredBy: driver.referredBy ? {
        name: driver.referredBy.user.name
      } : null,
      referrals: driver.referrals.map(r => ({
        id: r.id,
        name: r.user.name,
        avatar: r.user.avatar,
        totalTrips: r.totalTrips,
        joinedAt: r.createdAt
      })),
      stats: {
        totalReferrals: driver.referrals.length,
        activeReferrals: driver.referrals.filter(r => r.status !== 'OFFLINE').length,
        totalEarned,
        pendingPayout,
        referralBonus: driver.referralBonus
      },
      recentPayouts: driver.referralPayouts.map(p => ({
        id: p.id,
        amount: p.amount,
        reason: p.reason,
        description: p.description,
        isPaid: p.isPaid,
        paidAt: p.paidAt,
        createdAt: p.createdAt
      })),
      bonusRates: {
        registration: REFERRAL_BONUS_REGISTRATION,
        firstTrip: REFERRAL_BONUS_FIRST_TRIP,
        milestone: REFERRAL_BONUS_MILESTONE,
        milestoneTrips: REFERRAL_TRIPS_MILESTONE
      }
    }
  })

  // Apply referral code (for new drivers)
  fastify.post('/apply', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const { referralCode } = applyReferralSchema.parse(request.body)
      const userId = request.user.userId

      const driver = await prisma.driver.findUnique({
        where: { userId }
      })

      if (!driver) {
        return reply.status(404).send({ error: 'Driver not found' })
      }

      if (driver.referredById) {
        return reply.status(400).send({ error: 'You already have a referrer' })
      }

      // Find referrer by code
      const referrer = await prisma.driver.findUnique({
        where: { referralCode }
      })

      if (!referrer) {
        return reply.status(404).send({ error: 'Invalid referral code' })
      }

      if (referrer.id === driver.id) {
        return reply.status(400).send({ error: 'You cannot use your own referral code' })
      }

      // Apply referral
      await prisma.$transaction([
        // Update driver with referrer
        prisma.driver.update({
          where: { id: driver.id },
          data: { referredById: referrer.id }
        }),
        // Create payout record for referrer
        prisma.referralPayout.create({
          data: {
            driverId: referrer.id,
            amount: REFERRAL_BONUS_REGISTRATION,
            reason: 'registration',
            description: `Новый водитель по вашей рекомендации`
          }
        }),
        // Update referrer's bonus balance
        prisma.driver.update({
          where: { id: referrer.id },
          data: {
            referralBonus: { increment: REFERRAL_BONUS_REGISTRATION }
          }
        })
      ])

      return { success: true, message: 'Referral code applied successfully' }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Get referral code by code (for validation)
  fastify.get('/validate/:code', async (request, reply) => {
    const { code } = request.params as { code: string }

    const driver = await prisma.driver.findUnique({
      where: { referralCode: code },
      include: {
        user: { select: { name: true, avatar: true, rating: true } }
      }
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Invalid referral code' })
    }

    return {
      valid: true,
      referrer: {
        name: driver.user.name,
        avatar: driver.user.avatar,
        totalTrips: driver.totalTrips,
        rating: driver.user.rating
      }
    }
  })

  // Generate new referral code (regenerate)
  fastify.post('/regenerate-code', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId

    const driver = await prisma.driver.findUnique({
      where: { userId }
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Driver not found' })
    }

    // Generate a more readable code
    const newCode = generateReadableCode()

    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: { referralCode: newCode }
    })

    return { referralCode: updated.referralCode }
  })

  // Get leaderboard
  fastify.get('/leaderboard', async () => {
    const topReferrers = await prisma.driver.findMany({
      where: {
        referrals: { some: {} } // Has at least one referral
      },
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { referrals: true } }
      },
      orderBy: {
        referralBonus: 'desc'
      },
      take: 10
    })

    return topReferrers.map((d, index) => ({
      rank: index + 1,
      name: d.user.name,
      avatar: d.user.avatar,
      referralsCount: d._count.referrals,
      totalEarned: d.referralBonus
    }))
  })
}

// Generate a readable 6-char alphanumeric code
function generateReadableCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars like O, 0, I, 1
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
