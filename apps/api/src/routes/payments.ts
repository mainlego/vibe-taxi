import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@vibe-taxi/database'
import { yookassa } from '../lib/yookassa'

const DRIVER_APP_URL = process.env.DRIVER_URL || 'http://localhost:3002'
const CLIENT_APP_URL = process.env.CLIENT_URL || 'http://localhost:3000'

const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  // Middleware для проверки аутентификации
  const requireAuth = async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Требуется авторизация' })
    }
  }

  // ==================== ПОДПИСКА ВОДИТЕЛЯ ====================

  /**
   * Создание платежа для подписки водителя
   * POST /api/payments/subscription
   */
  fastify.post('/subscription', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const schema = z.object({
      planId: z.string(),
    })

    try {
      const { planId } = schema.parse(request.body)
      const userId = (request.user as any).userId

      // Получаем водителя
      const driver = await prisma.driver.findUnique({
        where: { userId },
        include: { user: true },
      })

      if (!driver) {
        return reply.status(404).send({ error: 'Водитель не найден' })
      }

      // Проверяем, нет ли активной подписки
      const activeSubscription = await prisma.driverSubscription.findFirst({
        where: {
          driverId: driver.id,
          status: 'ACTIVE',
          endDate: { gt: new Date() },
        },
      })

      if (activeSubscription) {
        return reply.status(400).send({ error: 'У вас уже есть активная подписка' })
      }

      // Получаем план подписки
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      })

      if (!plan || !plan.isActive) {
        return reply.status(404).send({ error: 'Тариф не найден' })
      }

      // Создаём запись подписки в статусе PENDING
      const subscription = await prisma.driverSubscription.create({
        data: {
          driverId: driver.id,
          planId: plan.id,
          status: 'PENDING',
          amount: plan.price,
        },
      })

      // Создаём платёж в YooKassa
      const payment = await yookassa.createPayment({
        amount: plan.price,
        description: `Подписка "${plan.name}" на ${plan.durationDays} дней - Vibe Taxi`,
        returnUrl: `${DRIVER_APP_URL}/subscription/success?subscriptionId=${subscription.id}`,
        metadata: {
          type: 'subscription',
          subscriptionId: subscription.id,
          driverId: driver.id,
          planId: plan.id,
        },
      })

      // Сохраняем платёж в базу
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
          yooKassaResponse: payment as any,
        },
      })

      // Обновляем подписку с ID платежа
      await prisma.driverSubscription.update({
        where: { id: subscription.id },
        data: { paymentId: payment.id },
      })

      console.log('Created subscription payment:', {
        subscriptionId: subscription.id,
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
      })

      return {
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
        subscription: {
          id: subscription.id,
          planId: plan.id,
          planName: plan.name,
          amount: plan.price,
          durationDays: plan.durationDays,
        },
      }
    } catch (error) {
      console.error('Create subscription payment error:', error)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  /**
   * Проверка статуса платежа подписки
   * GET /api/payments/subscription/:subscriptionId/status
   */
  fastify.get('/subscription/:subscriptionId/status', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { subscriptionId } = request.params as { subscriptionId: string }
    const userId = (request.user as any).userId

    const subscription = await prisma.driverSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        driver: true,
        plan: true,
      },
    })

    if (!subscription) {
      return reply.status(404).send({ error: 'Подписка не найдена' })
    }

    if (subscription.driver.userId !== userId) {
      return reply.status(403).send({ error: 'Нет доступа' })
    }

    // Если есть paymentId и подписка в статусе PENDING, проверяем статус платежа
    if (subscription.paymentId && subscription.status === 'PENDING') {
      try {
        const paymentStatus = await yookassa.getPayment(subscription.paymentId)

        if (paymentStatus.status === 'succeeded' && paymentStatus.paid) {
          // Активируем подписку
          const now = new Date()
          const endDate = new Date(now)
          endDate.setDate(endDate.getDate() + subscription.plan.durationDays)

          const updatedSubscription = await prisma.driverSubscription.update({
            where: { id: subscriptionId },
            data: {
              status: 'ACTIVE',
              startDate: now,
              endDate,
            },
            include: { plan: true },
          })

          // Обновляем статус платежа
          await prisma.yooKassaPayment.updateMany({
            where: { yooKassaId: subscription.paymentId },
            data: {
              status: 'SUCCEEDED',
              paidAt: new Date(),
            },
          })

          return {
            status: 'active',
            subscription: updatedSubscription,
            message: 'Подписка успешно активирована!',
          }
        } else if (paymentStatus.status === 'canceled') {
          // Отменяем подписку
          await prisma.driverSubscription.update({
            where: { id: subscriptionId },
            data: { status: 'CANCELLED' },
          })

          await prisma.yooKassaPayment.updateMany({
            where: { yooKassaId: subscription.paymentId },
            data: { status: 'CANCELED' },
          })

          return {
            status: 'cancelled',
            message: 'Платёж отменён',
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error)
      }
    }

    return {
      status: subscription.status.toLowerCase(),
      subscription,
    }
  })

  // ==================== ОПЛАТА ПОЕЗДКИ ====================

  /**
   * Создание платежа для поездки (оплата картой)
   * POST /api/payments/trip
   */
  fastify.post('/trip', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string(),
    })

    try {
      const { orderId } = schema.parse(request.body)
      const userId = (request.user as any).userId

      // Получаем заказ
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          client: true,
          currentDriver: true,
        },
      })

      if (!order) {
        return reply.status(404).send({ error: 'Заказ не найден' })
      }

      if (order.clientId !== userId) {
        return reply.status(403).send({ error: 'Нет доступа' })
      }

      if (order.paymentMethod !== 'CARD') {
        return reply.status(400).send({ error: 'Заказ не оплачивается картой' })
      }

      const amount = order.finalPrice || order.price

      // Создаём платёж в YooKassa
      const payment = await yookassa.createPayment({
        amount,
        description: `Поездка ${order.orderNumber} - Vibe Taxi`,
        returnUrl: `${CLIENT_APP_URL}/order?orderId=${orderId}&payment=success`,
        metadata: {
          type: 'trip',
          orderId: order.id,
          orderNumber: order.orderNumber,
          clientId: userId,
        },
      })

      // Сохраняем платёж в базу
      await prisma.yooKassaPayment.create({
        data: {
          yooKassaId: payment.id,
          type: 'OTHER',
          amount,
          status: 'PENDING',
          description: `Поездка ${order.orderNumber}`,
          confirmationUrl: payment.confirmation?.confirmation_url,
          metadata: {
            orderId: order.id,
            clientId: userId,
          },
          yooKassaResponse: payment as any,
        },
      })

      // Создаём запись Payment для заказа
      await prisma.payment.upsert({
        where: { orderId: order.id },
        update: {
          transactionId: payment.id,
          status: 'PROCESSING',
        },
        create: {
          orderId: order.id,
          userId,
          amount,
          method: 'CARD',
          status: 'PROCESSING',
          transactionId: payment.id,
        },
      })

      console.log('Created trip payment:', {
        orderId: order.id,
        paymentId: payment.id,
        amount,
      })

      return {
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
        amount,
      }
    } catch (error) {
      console.error('Create trip payment error:', error)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  /**
   * Проверка статуса платежа поездки
   * GET /api/payments/trip/:orderId/status
   */
  fastify.get('/trip/:orderId/status', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string }
    const userId = (request.user as any).userId

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    })

    if (!order) {
      return reply.status(404).send({ error: 'Заказ не найден' })
    }

    if (order.clientId !== userId) {
      return reply.status(403).send({ error: 'Нет доступа' })
    }

    if (!order.payment?.transactionId) {
      return { status: 'not_found', message: 'Платёж не найден' }
    }

    // Проверяем статус в YooKassa
    try {
      const paymentStatus = await yookassa.getPayment(order.payment.transactionId)

      if (paymentStatus.status === 'succeeded' && paymentStatus.paid) {
        // Обновляем статус платежа
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: 'COMPLETED',
            paidAt: new Date(),
          },
        })

        await prisma.yooKassaPayment.updateMany({
          where: { yooKassaId: order.payment.transactionId },
          data: {
            status: 'SUCCEEDED',
            paidAt: new Date(),
          },
        })

        return {
          status: 'completed',
          message: 'Оплата прошла успешно',
        }
      } else if (paymentStatus.status === 'canceled') {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: { status: 'FAILED' },
        })

        await prisma.yooKassaPayment.updateMany({
          where: { yooKassaId: order.payment.transactionId },
          data: { status: 'CANCELED' },
        })

        return {
          status: 'failed',
          message: 'Платёж отменён',
        }
      }

      return {
        status: paymentStatus.status,
        paid: paymentStatus.paid,
      }
    } catch (error) {
      console.error('Error checking trip payment status:', error)
      return { status: 'error', message: 'Ошибка проверки статуса' }
    }
  })

  // ==================== ЧАЕВЫЕ ====================

  /**
   * Создание платежа для чаевых
   * POST /api/payments/tip
   */
  fastify.post('/tip', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const schema = z.object({
      orderId: z.string(),
      amount: z.number().min(10).max(10000),
    })

    try {
      const { orderId, amount } = schema.parse(request.body)
      const userId = (request.user as any).userId

      // Получаем заказ
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          client: true,
          currentDriver: {
            include: { user: true },
          },
        },
      })

      if (!order) {
        return reply.status(404).send({ error: 'Заказ не найден' })
      }

      if (order.clientId !== userId) {
        return reply.status(403).send({ error: 'Нет доступа' })
      }

      if (order.status !== 'COMPLETED') {
        return reply.status(400).send({ error: 'Можно оставить чаевые только после завершения поездки' })
      }

      const driverName = order.currentDriver?.user?.name || 'водителю'

      // Создаём платёж в YooKassa
      const payment = await yookassa.createPayment({
        amount,
        description: `Чаевые ${driverName} за поездку ${order.orderNumber} - Vibe Taxi`,
        returnUrl: `${CLIENT_APP_URL}/history?tip=success&orderId=${orderId}`,
        metadata: {
          type: 'tip',
          orderId: order.id,
          driverId: order.currentDriver?.id || '',
          clientId: userId,
        },
      })

      // Сохраняем платёж в базу
      await prisma.yooKassaPayment.create({
        data: {
          yooKassaId: payment.id,
          type: 'TIP',
          driverId: order.currentDriver?.id,
          amount,
          status: 'PENDING',
          description: `Чаевые за поездку ${order.orderNumber}`,
          confirmationUrl: payment.confirmation?.confirmation_url,
          metadata: {
            orderId: order.id,
            clientId: userId,
          },
          yooKassaResponse: payment as any,
        },
      })

      console.log('Created tip payment:', {
        orderId: order.id,
        paymentId: payment.id,
        amount,
      })

      return {
        paymentId: payment.id,
        confirmationUrl: payment.confirmation?.confirmation_url,
        amount,
      }
    } catch (error) {
      console.error('Create tip payment error:', error)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // ==================== WEBHOOK ====================

  /**
   * Webhook для уведомлений от YooKassa
   * POST /api/payments/webhook
   * https://yookassa.ru/developers/using-api/webhooks
   */
  fastify.post('/webhook', async (request, reply) => {
    console.log('YooKassa webhook received:', JSON.stringify(request.body))

    const body = request.body as {
      type: string
      event: string
      object: {
        id: string
        status: string
        paid: boolean
        amount: { value: string; currency: string }
        metadata?: Record<string, string>
      }
    }

    if (!body.type || !body.object) {
      return reply.status(400).send({ error: 'Invalid webhook payload' })
    }

    const { type, object } = body
    const paymentId = object.id
    const metadata = object.metadata || {}

    console.log('Processing webhook:', { type, paymentId, status: object.status, metadata })

    try {
      // Находим платёж в базе
      const dbPayment = await prisma.yooKassaPayment.findUnique({
        where: { yooKassaId: paymentId },
      })

      if (!dbPayment) {
        console.warn('Payment not found in database:', paymentId)
        return reply.send({ received: true })
      }

      // Обрабатываем событие
      if (type === 'notification' && object.status === 'succeeded' && object.paid) {
        console.log('Payment succeeded:', paymentId)

        // Обновляем статус платежа
        await prisma.yooKassaPayment.update({
          where: { id: dbPayment.id },
          data: {
            status: 'SUCCEEDED',
            paidAt: new Date(),
          },
        })

        // Обрабатываем в зависимости от типа
        if (metadata.type === 'subscription' && metadata.subscriptionId) {
          // Активируем подписку
          const subscription = await prisma.driverSubscription.findUnique({
            where: { id: metadata.subscriptionId },
            include: { plan: true },
          })

          if (subscription && subscription.status === 'PENDING') {
            const now = new Date()
            const endDate = new Date(now)
            endDate.setDate(endDate.getDate() + subscription.plan.durationDays)

            await prisma.driverSubscription.update({
              where: { id: subscription.id },
              data: {
                status: 'ACTIVE',
                startDate: now,
                endDate,
              },
            })

            console.log('Subscription activated:', subscription.id)
          }
        } else if (metadata.type === 'trip' && metadata.orderId) {
          // Обновляем платёж за поездку
          await prisma.payment.updateMany({
            where: { orderId: metadata.orderId },
            data: {
              status: 'COMPLETED',
              paidAt: new Date(),
            },
          })

          console.log('Trip payment completed:', metadata.orderId)
        } else if (metadata.type === 'tip' && metadata.orderId && metadata.driverId) {
          // Обновляем чаевые в заказе
          await prisma.order.update({
            where: { id: metadata.orderId },
            data: {
              tips: {
                increment: parseFloat(object.amount.value),
              },
            },
          })

          // Добавляем к заработку водителя
          await prisma.driver.update({
            where: { id: metadata.driverId },
            data: {
              totalEarnings: {
                increment: parseFloat(object.amount.value),
              },
            },
          })

          console.log('Tip processed:', {
            orderId: metadata.orderId,
            driverId: metadata.driverId,
            amount: object.amount.value,
          })
        }
      } else if (object.status === 'canceled') {
        console.log('Payment canceled:', paymentId)

        await prisma.yooKassaPayment.update({
          where: { id: dbPayment.id },
          data: { status: 'CANCELED' },
        })

        if (metadata.type === 'subscription' && metadata.subscriptionId) {
          await prisma.driverSubscription.update({
            where: { id: metadata.subscriptionId },
            data: { status: 'CANCELLED' },
          })
        } else if (metadata.type === 'trip' && metadata.orderId) {
          await prisma.payment.updateMany({
            where: { orderId: metadata.orderId },
            data: { status: 'FAILED' },
          })
        }
      }

      return reply.send({ received: true })
    } catch (error) {
      console.error('Webhook processing error:', error)
      return reply.status(500).send({ error: 'Internal error' })
    }
  })

  // ==================== ИСТОРИЯ ПЛАТЕЖЕЙ ====================

  /**
   * История платежей пользователя
   * GET /api/payments/history
   */
  fastify.get('/history', {
    preHandler: [requireAuth],
  }, async (request) => {
    const userId = (request.user as any).userId

    // Получаем водителя если есть
    const driver = await prisma.driver.findUnique({
      where: { userId },
    })

    // Платежи YooKassa
    const yooKassaPayments = await prisma.yooKassaPayment.findMany({
      where: driver ? { driverId: driver.id } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Платежи за поездки
    const tripPayments = await prisma.payment.findMany({
      where: { userId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            pickupAddress: true,
            dropoffAddress: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return {
      subscriptionPayments: yooKassaPayments.filter(p => p.type === 'SUBSCRIPTION'),
      tipPayments: yooKassaPayments.filter(p => p.type === 'TIP'),
      tripPayments,
    }
  })

  /**
   * Получение информации о платеже
   * GET /api/payments/:paymentId
   */
  fastify.get('/:paymentId', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { paymentId } = request.params as { paymentId: string }

    try {
      const payment = await yookassa.getPayment(paymentId)
      return payment
    } catch (error) {
      console.error('Get payment error:', error)
      return reply.status(404).send({ error: 'Платёж не найден' })
    }
  })
}

export default paymentsRoutes
