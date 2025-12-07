import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '@vibe-taxi/database'

const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  search: z.string().optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Middleware to check admin role
  const requireAdmin = async (request: any, reply: any) => {
    await request.jwtVerify()
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { role: true },
    })
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPPORT')) {
      return reply.status(403).send({ error: 'Access denied' })
    }
  }

  // ==================== AUTH ====================

  fastify.post('/login', async (request, reply) => {
    const loginSchema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })

    try {
      const { email, password } = loginSchema.parse(request.body)

      // Find user by email
      const user = await prisma.user.findFirst({
        where: {
          email,
          role: { in: ['ADMIN', 'SUPPORT'] },
        },
      })

      if (!user) {
        return reply.status(401).send({ error: 'Неверный email или пароль' })
      }

      // Check password (stored in settings or use simple check for now)
      // For simplicity, check against ADMIN_PASSWORD env or use hash
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

      // Simple password check (in production use bcrypt)
      if (password !== adminPassword) {
        return reply.status(401).send({ error: 'Неверный email или пароль' })
      }

      // Generate JWT token
      const token = fastify.jwt.sign({ userId: user.id, role: user.role })

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // ==================== DASHBOARD STATS ====================

  fastify.get('/stats', {
    preHandler: [requireAdmin],
  }, async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalUsers,
      totalDrivers,
      activeDrivers,
      ordersToday,
      revenueToday,
      ordersPending,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.driver.count(),
      prisma.driver.count({ where: { status: 'ONLINE' } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: today },
        },
        _sum: { finalPrice: true },
      }),
      prisma.order.count({ where: { status: 'PENDING' } }),
    ])

    // Get yesterday's stats for comparison
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const [ordersYesterday, revenueYesterday] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: { gte: yesterday, lt: today }
        }
      }),
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: yesterday, lt: today },
        },
        _sum: { finalPrice: true },
      }),
    ])

    const ordersChange = ordersYesterday > 0
      ? ((ordersToday - ordersYesterday) / ordersYesterday * 100).toFixed(1)
      : 0

    const todayRevenue = revenueToday._sum.finalPrice || 0
    const yesterdayRevenue = revenueYesterday._sum.finalPrice || 0
    const revenueChange = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
      : 0

    return {
      totalUsers,
      totalDrivers,
      activeDrivers,
      ordersToday,
      ordersPending,
      revenueToday: todayRevenue,
      ordersChange: Number(ordersChange),
      revenueChange: Number(revenueChange),
    }
  })

  // ==================== USERS ====================

  fastify.get('/users', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const query = paginationSchema.parse(request.query)
    const { page, limit, search, role, sortBy, sortOrder } = query

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (role) {
      where.role = role
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          avatar: true,
          rating: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              clientOrders: true,
            },
          },
        },
        orderBy: sortBy
          ? { [sortBy]: sortOrder || 'desc' }
          : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return {
      users: users.map(u => ({
        ...u,
        ordersCount: u._count.clientOrders,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  })

  fastify.get('/users/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        driver: true,
        addresses: true,
        _count: {
          select: {
            clientOrders: true,
            driverOrders: true,
            reviews: true,
          },
        },
      },
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return user
  })

  fastify.patch('/users/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const updateSchema = z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.enum(['CLIENT', 'DRIVER', 'ADMIN', 'SUPPORT']).optional(),
      isActive: z.boolean().optional(),
    })

    try {
      const data = updateSchema.parse(request.body)

      const user = await prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      })

      return user
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  fastify.delete('/users/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    // Soft delete - just deactivate
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return { success: true }
  })

  // ==================== DRIVERS ====================

  fastify.get('/drivers', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const query = paginationSchema.parse(request.query)
    const { page, limit, search, status, sortBy, sortOrder } = query

    const where: any = {}

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search } } },
        { carNumber: { contains: search, mode: 'insensitive' } },
        { carModel: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              name: true,
              avatar: true,
              rating: true,
              isActive: true,
            },
          },
        },
        orderBy: sortBy
          ? { [sortBy]: sortOrder || 'desc' }
          : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.driver.count({ where }),
    ])

    return {
      drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  })

  fastify.get('/drivers/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!driver) {
      return reply.status(404).send({ error: 'Driver not found' })
    }

    // Get driver stats
    const [completedOrders, earnings, reviews] = await Promise.all([
      prisma.order.count({
        where: { driverId: driver.userId, status: 'COMPLETED' },
      }),
      prisma.order.aggregate({
        where: { driverId: driver.userId, status: 'COMPLETED' },
        _sum: { finalPrice: true },
      }),
      prisma.review.findMany({
        where: { targetId: driver.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          author: {
            select: { name: true, avatar: true },
          },
        },
      }),
    ])

    return {
      ...driver,
      stats: {
        completedOrders,
        totalEarnings: earnings._sum.finalPrice || 0,
      },
      recentReviews: reviews,
    }
  })

  fastify.patch('/drivers/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const updateSchema = z.object({
      carModel: z.string().optional(),
      carNumber: z.string().optional(),
      carColor: z.string().optional(),
      carYear: z.number().optional(),
      carClass: z.enum(['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']).optional(),
      isVerified: z.boolean().optional(),
      status: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'BREAK']).optional(),
    })

    try {
      const data = updateSchema.parse(request.body)

      const driver = await prisma.driver.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
      })

      return driver
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  fastify.patch('/drivers/:id/verify', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { isVerified } = request.body as { isVerified: boolean }

    const driver = await prisma.driver.update({
      where: { id },
      data: { isVerified },
    })

    return driver
  })

  // ==================== ORDERS ====================

  fastify.get('/orders', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const query = paginationSchema.parse(request.query)
    const { page, limit, search, status, sortBy, sortOrder } = query

    const where: any = {}

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { phone: { contains: search } } },
        { pickupAddress: { contains: search, mode: 'insensitive' } },
        { dropoffAddress: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              phone: true,
              avatar: true,
            },
          },
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
              avatar: true,
            },
          },
        },
        orderBy: sortBy
          ? { [sortBy]: sortOrder || 'desc' }
          : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  })

  fastify.get('/orders/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        driver: true,
        payment: true,
        reviews: {
          include: {
            author: {
              select: { name: true, avatar: true },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' })
    }

    return order
  })

  fastify.patch('/orders/:id/cancel', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { reason } = request.body as { reason?: string }

    const order = await prisma.order.findUnique({ where: { id } })

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' })
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Cannot cancel this order' })
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: reason || 'Cancelled by admin',
        cancelledBy: 'system',
        cancelledAt: new Date(),
      },
    })

    // Add to status history
    await prisma.orderStatusHistory.create({
      data: {
        orderId: id,
        status: 'CANCELLED',
        comment: reason || 'Cancelled by admin',
      },
    })

    return updatedOrder
  })

  // ==================== ANALYTICS ====================

  fastify.get('/analytics/orders', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const { period } = request.query as { period?: string }
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 7

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Get daily order counts
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        createdAt: true,
        status: true,
        finalPrice: true,
        price: true,
      },
    })

    // Group by date
    const dailyData: Record<string, { orders: number; revenue: number; completed: number }> = {}

    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = date.toISOString().split('T')[0]
      dailyData[key] = { orders: 0, revenue: 0, completed: 0 }
    }

    orders.forEach(order => {
      const key = order.createdAt.toISOString().split('T')[0]
      if (dailyData[key]) {
        dailyData[key].orders++
        if (order.status === 'COMPLETED') {
          dailyData[key].completed++
          dailyData[key].revenue += order.finalPrice || order.price
        }
      }
    })

    return Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
  })

  fastify.get('/analytics/revenue', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const { period } = request.query as { period?: string }
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 7

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const revenue = await prisma.order.aggregate({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
      _sum: { finalPrice: true },
      _count: true,
      _avg: { finalPrice: true },
    })

    return {
      totalRevenue: revenue._sum.finalPrice || 0,
      orderCount: revenue._count || 0,
      averageOrder: revenue._avg.finalPrice || 0,
    }
  })

  fastify.get('/analytics/popular-routes', {
    preHandler: [requireAdmin],
  }, async () => {
    // Get most popular pickup locations
    const orders = await prisma.order.findMany({
      where: { status: 'COMPLETED' },
      select: {
        pickupAddress: true,
        dropoffAddress: true,
      },
      take: 1000,
    })

    const routeCounts: Record<string, number> = {}

    orders.forEach(order => {
      // Simplify addresses (take first part before comma)
      const pickup = order.pickupAddress.split(',')[0].trim()
      const dropoff = order.dropoffAddress.split(',')[0].trim()
      const key = `${pickup} → ${dropoff}`
      routeCounts[key] = (routeCounts[key] || 0) + 1
    })

    return Object.entries(routeCounts)
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  })

  // ==================== TARIFFS ====================

  fastify.get('/tariffs', {
    preHandler: [requireAdmin],
  }, async () => {
    const tariffs = await prisma.tariff.findMany({
      orderBy: { carClass: 'asc' },
    })
    return tariffs
  })

  fastify.patch('/tariffs/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const updateSchema = z.object({
      baseFare: z.number().optional(),
      perKm: z.number().optional(),
      perMinute: z.number().optional(),
      minFare: z.number().optional(),
      surgeFactor: z.number().optional(),
    })

    try {
      const data = updateSchema.parse(request.body)
      const tariff = await prisma.tariff.update({
        where: { id },
        data,
      })
      return tariff
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // ==================== PROMO CODES ====================

  fastify.get('/promo', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const query = paginationSchema.parse(request.query)
    const { page, limit, search } = query

    const where: any = {}

    if (search) {
      where.code = { contains: search, mode: 'insensitive' }
    }

    const [promoCodes, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.promoCode.count({ where }),
    ])

    return {
      promoCodes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  })

  fastify.post('/promo', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const createSchema = z.object({
      code: z.string().min(3).max(20).toUpperCase(),
      discountType: z.enum(['PERCENT', 'FIXED']),
      discountValue: z.number().min(1),
      maxDiscount: z.number().optional(),
      minOrderAmount: z.number().optional(),
      usageLimit: z.number().optional(),
      validFrom: z.string().datetime().optional(),
      validUntil: z.string().datetime().optional(),
      isActive: z.boolean().default(true),
    })

    try {
      const data = createSchema.parse(request.body)

      // Check if code already exists
      const existing = await prisma.promoCode.findUnique({
        where: { code: data.code },
      })

      if (existing) {
        return reply.status(400).send({ error: 'Промокод уже существует' })
      }

      const promoCode = await prisma.promoCode.create({
        data: {
          ...data,
          validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        },
      })

      return promoCode
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  fastify.patch('/promo/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const updateSchema = z.object({
      code: z.string().min(3).max(20).toUpperCase().optional(),
      discountType: z.enum(['PERCENT', 'FIXED']).optional(),
      discountValue: z.number().min(1).optional(),
      maxDiscount: z.number().nullable().optional(),
      minOrderAmount: z.number().nullable().optional(),
      usageLimit: z.number().nullable().optional(),
      validFrom: z.string().datetime().nullable().optional(),
      validUntil: z.string().datetime().nullable().optional(),
      isActive: z.boolean().optional(),
    })

    try {
      const data = updateSchema.parse(request.body)

      const updateData: Record<string, unknown> = { ...data }
      if (data.validFrom !== undefined) {
        updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null
      }
      if (data.validUntil !== undefined) {
        updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null
      }

      const promoCode = await prisma.promoCode.update({
        where: { id },
        data: updateData,
      })

      return promoCode
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  fastify.delete('/promo/:id', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const { id } = request.params as { id: string }
    await prisma.promoCode.delete({ where: { id } })
    return { success: true }
  })

  // ==================== SETTINGS ====================

  fastify.get('/settings', {
    preHandler: [requireAdmin],
  }, async () => {
    const settings = await prisma.settings.findMany()
    // Convert to object for easier use
    const settingsObj: Record<string, any> = {}
    settings.forEach(s => {
      settingsObj[s.key] = s.value
    })
    return settingsObj
  })

  fastify.patch('/settings', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const updates = request.body as Record<string, any>

    // Update each setting
    for (const [key, value] of Object.entries(updates)) {
      await prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    // Return updated settings
    const settings = await prisma.settings.findMany()
    const settingsObj: Record<string, any> = {}
    settings.forEach(s => {
      settingsObj[s.key] = s.value
    })
    return settingsObj
  })

  // ==================== SUBSCRIPTIONS ====================

  fastify.get('/subscriptions', {
    preHandler: [requireAdmin],
  }, async () => {
    const subscriptions = await prisma.driverSubscription.findMany({
      include: {
        driver: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatar: true,
              },
            },
          },
        },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return subscriptions
  })

  fastify.get('/subscription-plans', {
    preHandler: [requireAdmin],
  }, async () => {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return plans
  })

  fastify.patch('/subscription-plans/:id', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const updateSchema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      price: z.number().optional(),
      durationDays: z.number().optional(),
      features: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    })

    try {
      const data = updateSchema.parse(request.body)
      const plan = await prisma.subscriptionPlan.update({
        where: { id },
        data,
      })
      return plan
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Grant subscription manually (for testing or as bonus)
  fastify.post('/subscriptions/grant', {
    preHandler: [requireAdmin],
  }, async (request, reply) => {
    const grantSchema = z.object({
      driverId: z.string(),
      planId: z.string().optional(),
      days: z.number().optional(),
    })

    try {
      const { driverId, planId, days } = grantSchema.parse(request.body)

      // Get default plan if not specified
      let plan = planId
        ? await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
        : await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })

      if (!plan) {
        return reply.status(404).send({ error: 'Тариф не найден' })
      }

      const now = new Date()
      const endDate = new Date(now)
      endDate.setDate(endDate.getDate() + (days || plan.durationDays))

      const subscription = await prisma.driverSubscription.create({
        data: {
          driverId,
          planId: plan.id,
          status: 'ACTIVE',
          startDate: now,
          endDate,
          amount: 0, // Free grant
        },
        include: {
          driver: {
            include: {
              user: { select: { name: true, phone: true } },
            },
          },
          plan: true,
        },
      })

      return subscription
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Cancel subscription
  fastify.patch('/subscriptions/:id/cancel', {
    preHandler: [requireAdmin],
  }, async (request) => {
    const { id } = request.params as { id: string }

    const subscription = await prisma.driverSubscription.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    return subscription
  })
}
