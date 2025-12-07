import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import { Server } from 'socket.io'
import { prisma } from '@vibe-taxi/database'

// Routes
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { orderRoutes } from './routes/orders.js'
import { driverRoutes } from './routes/drivers.js'
import { tariffRoutes } from './routes/tariffs.js'
import { adminRoutes } from './routes/admin.js'
import { reviewRoutes } from './routes/reviews.js'
import { notificationRoutes } from './routes/notifications.js'
import { referralRoutes } from './routes/referrals.js'
import { uploadRoutes } from './routes/upload.js'
import { pointsRoutes } from './routes/points.js'
import { rewardsRoutes } from './routes/rewards.js'
import { subscriptionRoutes } from './routes/subscriptions.js'

// Socket handlers
import { setupSocketHandlers } from './socket/index.js'

// Telegram bot
import { startTelegramBot } from './telegram-bot.js'

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'

async function buildServer() {
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'development',
  })

  // CORS
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'development'
      ? true
      : [
          process.env.CLIENT_URL || 'http://localhost:3000',
          process.env.DRIVER_URL || 'http://localhost:3002',
          process.env.ADMIN_URL || 'http://localhost:3003',
        ],
    credentials: true,
  })

  // JWT
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    sign: { expiresIn: '7d' },
  })

  // Cookies
  await fastify.register(cookie)

  // Auth decorator
  fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // API Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(userRoutes, { prefix: '/api/users' })
  await fastify.register(orderRoutes, { prefix: '/api/orders' })
  await fastify.register(driverRoutes, { prefix: '/api/drivers' })
  await fastify.register(tariffRoutes, { prefix: '/api/tariffs' })
  await fastify.register(adminRoutes, { prefix: '/api/admin' })
  await fastify.register(reviewRoutes, { prefix: '/api/reviews' })
  await fastify.register(notificationRoutes, { prefix: '/api/notifications' })
  await fastify.register(referralRoutes, { prefix: '/api/referrals' })
  await fastify.register(uploadRoutes, { prefix: '/api/upload' })
  await fastify.register(pointsRoutes, { prefix: '/api/points' })
  await fastify.register(rewardsRoutes, { prefix: '/api/rewards' })
  await fastify.register(subscriptionRoutes, { prefix: '/api/subscriptions' })

  return fastify
}

async function start() {
  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected')

    const fastify = await buildServer()

    // Start HTTP server
    await fastify.listen({ port: PORT, host: HOST })
    console.log(`🚀 API Server running at http://${HOST}:${PORT}`)

    // Setup Socket.IO
    const io = new Server(fastify.server, {
      cors: {
        origin: process.env.NODE_ENV === 'development' ? '*' : [
          process.env.CLIENT_URL || 'http://localhost:3000',
          process.env.DRIVER_URL || 'http://localhost:3002',
        ],
        credentials: true,
      },
    })

    setupSocketHandlers(io)
    console.log('🔌 Socket.IO initialized')

    // Start Telegram bot polling
    startTelegramBot()

  } catch (err) {
    console.error('❌ Server startup failed:', err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})

start()
