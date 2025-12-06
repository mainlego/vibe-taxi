import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma, UserRole } from '@vibe-taxi/database'

// Validation schemas
const sendCodeSchema = z.object({
  phone: z.string().regex(/^\+7\d{10}$/, 'Invalid phone format'),
})

const verifyCodeSchema = z.object({
  phone: z.string().regex(/^\+7\d{10}$/),
  code: z.string().length(4),
})

const registerSchema = z.object({
  phone: z.string().regex(/^\+7\d{10}$/),
  name: z.string().min(2).max(50),
  code: z.string().length(4),
  role: z.enum(['CLIENT', 'DRIVER']).optional().default('CLIENT'),
})

const telegramAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
  role: z.enum(['CLIENT', 'DRIVER']).optional().default('CLIENT'),
})

// Verify Telegram login data
function verifyTelegramAuth(data: Record<string, any>, botToken: string): boolean {
  const { hash, ...authData } = data

  // Create check string
  const checkArr = Object.keys(authData)
    .filter(key => key !== 'role') // exclude our custom role field
    .sort()
    .map(key => `${key}=${authData[key]}`)
  const checkString = checkArr.join('\n')

  // Create secret key from bot token
  const secretKey = crypto.createHash('sha256').update(botToken).digest()

  // Calculate HMAC
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex')

  return hmac === hash
}

// In-memory codes storage (use Redis in production)
const verificationCodes = new Map<string, { code: string; expiresAt: Date }>()

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Send verification code
  fastify.post('/send-code', async (request, reply) => {
    try {
      const { phone } = sendCodeSchema.parse(request.body)

      // Generate code (in dev mode, always use 1234)
      const code = process.env.NODE_ENV === 'development' ? '1234' : generateCode()

      verificationCodes.set(phone, {
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      })

      // In production, send SMS via provider
      console.log(`📱 Verification code for ${phone}: ${code}`)

      return { success: true, message: 'Code sent' }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Verify code and login
  fastify.post('/verify', async (request, reply) => {
    try {
      const { phone, code } = verifyCodeSchema.parse(request.body)

      const storedData = verificationCodes.get(phone)
      if (!storedData || storedData.code !== code) {
        return reply.status(400).send({ error: 'Invalid code' })
      }

      if (new Date() > storedData.expiresAt) {
        verificationCodes.delete(phone)
        return reply.status(400).send({ error: 'Code expired' })
      }

      verificationCodes.delete(phone)

      // Find user
      const user = await prisma.user.findUnique({
        where: { phone },
        include: { driver: true },
      })

      if (!user) {
        return { success: true, isNewUser: true, phone }
      }

      // Generate token
      const token = fastify.jwt.sign({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      })

      return {
        success: true,
        isNewUser: false,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          rating: user.rating,
          role: user.role,
          driver: user.driver,
        },
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Register new user
  fastify.post('/register', async (request, reply) => {
    try {
      const { phone, name, code, role } = registerSchema.parse(request.body)

      // Verify code again
      const storedData = verificationCodes.get(phone)
      if (!storedData || storedData.code !== code) {
        return reply.status(400).send({ error: 'Invalid code' })
      }

      verificationCodes.delete(phone)

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { phone } })
      if (existingUser) {
        return reply.status(400).send({ error: 'User already exists' })
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          phone,
          name,
          role: role as UserRole,
        },
      })

      // Generate token
      const token = fastify.jwt.sign({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      })

      return {
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          rating: user.rating,
        },
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Get current user
  fastify.get('/me', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      include: { driver: true },
    })

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      rating: user.rating,
      role: user.role,
      driver: user.driver,
    }
  })

  // Telegram login
  fastify.post('/telegram', async (request, reply) => {
    try {
      const data = telegramAuthSchema.parse(request.body)

      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (!botToken) {
        return reply.status(500).send({ error: 'Telegram bot not configured' })
      }

      // Verify Telegram auth data
      if (!verifyTelegramAuth(data, botToken)) {
        return reply.status(400).send({ error: 'Invalid Telegram auth data' })
      }

      // Check if auth_date is not too old (1 day)
      const authAge = Date.now() / 1000 - data.auth_date
      if (authAge > 86400) {
        return reply.status(400).send({ error: 'Auth data expired' })
      }

      // Find or create user by Telegram ID
      let user = await prisma.user.findFirst({
        where: { telegramId: data.id.toString() },
        include: { driver: true },
      })

      const telegramName = data.last_name
        ? `${data.first_name} ${data.last_name}`
        : data.first_name

      if (!user) {
        // Create new user
        user = await prisma.user.create({
          data: {
            telegramId: data.id.toString(),
            name: telegramName,
            avatar: data.photo_url,
            role: data.role as UserRole,
          },
          include: { driver: true },
        })
        console.log(`📱 New Telegram user created: ${user.id} (@${data.username || 'no-username'})`)
      } else {
        // Update user info
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: telegramName,
            avatar: data.photo_url,
          },
          include: { driver: true },
        })
      }

      // Generate token
      const token = fastify.jwt.sign({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      })

      return {
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          rating: user.rating,
          role: user.role,
          driver: user.driver,
        },
      }
    } catch (error) {
      console.error('Telegram auth error:', error)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Logout (just for client-side token removal notification)
  fastify.post('/logout', async () => {
    return { success: true }
  })
}
