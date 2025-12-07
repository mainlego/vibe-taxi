import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@vibe-taxi/database'
import { yooKassaService } from '../services/yookassa.js'

const purchaseSubscriptionSchema = z.object({
  planId: z.string().min(1),
})

export const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all subscription plans
  fastify.get('/plans', async (request, reply) => {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    })

    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      durationDays: plan.durationDays,
      features: plan.features
    }))
  })

  // Get driver's current subscription status
  fastify.get('/me', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId

    // Get driver
    const driver = await prisma.driver.findUnique({
      where: { userId }
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Водитель не найден' })
    }

    // Get active subscription
    const subscription = await prisma.driverSubscription.findFirst({
      where: {
        driverId: driver.id,
        status: 'ACTIVE',
        endDate: { gte: new Date() }
      },
      include: { plan: true },
      orderBy: { endDate: 'desc' }
    })

    // Get subscription history
    const history = await prisma.driverSubscription.findMany({
      where: { driverId: driver.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    return {
      hasActiveSubscription: !!subscription,
      subscription: subscription ? {
        id: subscription.id,
        plan: {
          id: subscription.plan.id,
          name: subscription.plan.name,
          description: subscription.plan.description
        },
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew
      } : null,
      daysRemaining: subscription
        ? Math.ceil((subscription.endDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0,
      history: history.map(h => ({
        id: h.id,
        plan: { id: h.plan.id, name: h.plan.name },
        status: h.status,
        startDate: h.startDate,
        endDate: h.endDate,
        amount: h.amount,
        createdAt: h.createdAt
      }))
    }
  })

  // Check if driver has active subscription (used by go-online check)
  fastify.get('/check', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const userId = request.user.userId

    const driver = await prisma.driver.findUnique({
      where: { userId }
    })

    if (!driver) {
      return { hasActiveSubscription: false, canGoOnline: false }
    }

    const subscription = await prisma.driverSubscription.findFirst({
      where: {
        driverId: driver.id,
        status: 'ACTIVE',
        endDate: { gte: new Date() }
      }
    })

    return {
      hasActiveSubscription: !!subscription,
      canGoOnline: !!subscription,
      subscriptionEndDate: subscription?.endDate || null
    }
  })

  // Purchase a subscription
  fastify.post('/purchase', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    try {
      const { planId } = purchaseSubscriptionSchema.parse(request.body)
      const userId = request.user.userId

      // Get driver
      const driver = await prisma.driver.findUnique({
        where: { userId }
      })

      if (!driver) {
        return reply.status(404).send({ error: 'Водитель не найден' })
      }

      // Get plan
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId }
      })

      if (!plan || !plan.isActive) {
        return reply.status(404).send({ error: 'Тариф не найден' })
      }

      // Create pending subscription
      const subscription = await prisma.driverSubscription.create({
        data: {
          driverId: driver.id,
          planId: plan.id,
          status: 'PENDING',
          amount: plan.price
        }
      })

      // Determine return URL based on environment
      const baseUrl = process.env.DRIVER_APP_URL || 'https://driver.vibetaxi.ru'
      const returnUrl = `${baseUrl}/subscription/success?subscriptionId=${subscription.id}`

      // Create payment in YooKassa
      const payment = await yooKassaService.createPayment({
        amount: plan.price,
        description: `Подписка "${plan.name}" - ${plan.durationDays} дней`,
        returnUrl,
        metadata: {
          subscriptionId: subscription.id,
          driverId: driver.id,
          planId: plan.id
        }
      })

      // Save payment info
      await prisma.yooKassaPayment.create({
        data: {
          yooKassaId: payment.id,
          type: 'SUBSCRIPTION',
          driverId: driver.id,
          subscriptionId: subscription.id,
          amount: plan.price,
          status: 'PENDING',
          description: `Подписка "${plan.name}"`,
          confirmationUrl: payment.confirmation?.confirmation_url,
          metadata: { planId: plan.id },
          yooKassaResponse: payment as any
        }
      })

      // Update subscription with payment ID
      await prisma.driverSubscription.update({
        where: { id: subscription.id },
        data: { paymentId: payment.id }
      })

      return {
        subscriptionId: subscription.id,
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      console.error('Subscription purchase error:', error)
      throw error
    }
  })

  // YooKassa webhook handler
  fastify.post('/webhook/yookassa', async (request, reply) => {
    try {
      const body = request.body as any
      console.log('YooKassa webhook received:', JSON.stringify(body, null, 2))

      const event = body.event
      const paymentData = body.object

      if (!paymentData || !paymentData.id) {
        return reply.status(400).send({ error: 'Invalid webhook payload' })
      }

      // Find payment record
      const payment = await prisma.yooKassaPayment.findUnique({
        where: { yooKassaId: paymentData.id }
      })

      if (!payment) {
        console.warn('Payment not found for webhook:', paymentData.id)
        return { received: true }
      }

      // Update payment status based on event
      if (event === 'payment.succeeded') {
        await prisma.yooKassaPayment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            paidAt: new Date(),
            yooKassaResponse: paymentData
          }
        })

        // Activate subscription
        if (payment.subscriptionId) {
          const subscription = await prisma.driverSubscription.findUnique({
            where: { id: payment.subscriptionId },
            include: { plan: true }
          })

          if (subscription) {
            const startDate = new Date()
            const endDate = new Date()
            endDate.setDate(endDate.getDate() + subscription.plan.durationDays)

            await prisma.driverSubscription.update({
              where: { id: subscription.id },
              data: {
                status: 'ACTIVE',
                startDate,
                endDate
              }
            })

            console.log(`Subscription ${subscription.id} activated until ${endDate}`)
          }
        }
      } else if (event === 'payment.canceled') {
        await prisma.yooKassaPayment.update({
          where: { id: payment.id },
          data: {
            status: 'CANCELED',
            yooKassaResponse: paymentData
          }
        })

        // Cancel subscription
        if (payment.subscriptionId) {
          await prisma.driverSubscription.update({
            where: { id: payment.subscriptionId },
            data: { status: 'CANCELLED' }
          })
        }
      }

      return { received: true }
    } catch (error) {
      console.error('Webhook processing error:', error)
      return reply.status(500).send({ error: 'Webhook processing failed' })
    }
  })

  // Check payment status (for polling after redirect)
  fastify.get('/payment/:paymentId/status', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { paymentId } = request.params as { paymentId: string }

    const payment = await prisma.yooKassaPayment.findUnique({
      where: { yooKassaId: paymentId }
    })

    if (!payment) {
      return reply.status(404).send({ error: 'Платёж не найден' })
    }

    // If still pending, check with YooKassa
    if (payment.status === 'PENDING') {
      try {
        const yooKassaPayment = await yooKassaService.getPayment(paymentId)

        if (yooKassaPayment.status === 'succeeded') {
          // Update payment
          await prisma.yooKassaPayment.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCEEDED',
              paidAt: new Date(),
              yooKassaResponse: yooKassaPayment as any
            }
          })

          // Activate subscription
          if (payment.subscriptionId) {
            const subscription = await prisma.driverSubscription.findUnique({
              where: { id: payment.subscriptionId },
              include: { plan: true }
            })

            if (subscription && subscription.status === 'PENDING') {
              const startDate = new Date()
              const endDate = new Date()
              endDate.setDate(endDate.getDate() + subscription.plan.durationDays)

              await prisma.driverSubscription.update({
                where: { id: subscription.id },
                data: {
                  status: 'ACTIVE',
                  startDate,
                  endDate
                }
              })
            }
          }

          return { status: 'SUCCEEDED', subscriptionActivated: true }
        } else if (yooKassaPayment.status === 'canceled') {
          await prisma.yooKassaPayment.update({
            where: { id: payment.id },
            data: { status: 'CANCELED' }
          })
          return { status: 'CANCELED' }
        }

        return { status: payment.status }
      } catch (err) {
        console.error('Failed to check payment status:', err)
        return { status: payment.status }
      }
    }

    return {
      status: payment.status,
      subscriptionActivated: payment.status === 'SUCCEEDED'
    }
  })

  // Confirm subscription activation (after successful payment redirect)
  fastify.post('/confirm/:subscriptionId', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const { subscriptionId } = request.params as { subscriptionId: string }
    const userId = request.user.userId

    const driver = await prisma.driver.findUnique({
      where: { userId }
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Водитель не найден' })
    }

    const subscription = await prisma.driverSubscription.findFirst({
      where: {
        id: subscriptionId,
        driverId: driver.id
      },
      include: { plan: true }
    })

    if (!subscription) {
      return reply.status(404).send({ error: 'Подписка не найдена' })
    }

    // If subscription is still pending, check payment
    if (subscription.status === 'PENDING' && subscription.paymentId) {
      try {
        const payment = await yooKassaService.getPayment(subscription.paymentId)

        if (payment.status === 'succeeded') {
          const startDate = new Date()
          const endDate = new Date()
          endDate.setDate(endDate.getDate() + subscription.plan.durationDays)

          await prisma.driverSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'ACTIVE',
              startDate,
              endDate
            }
          })

          await prisma.yooKassaPayment.updateMany({
            where: { yooKassaId: subscription.paymentId },
            data: { status: 'SUCCEEDED', paidAt: new Date() }
          })

          return {
            success: true,
            subscription: {
              id: subscription.id,
              status: 'ACTIVE',
              startDate,
              endDate,
              plan: subscription.plan.name
            }
          }
        }
      } catch (err) {
        console.error('Failed to confirm subscription:', err)
      }
    }

    return {
      success: subscription.status === 'ACTIVE',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        plan: subscription.plan.name
      }
    }
  })
}
