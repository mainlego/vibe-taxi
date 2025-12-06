import '@fastify/jwt'
import { FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      role: string
      phone?: string | null
      telegramId?: string | null
    }
    user: {
      userId: string
      role: string
      phone?: string | null
      telegramId?: string | null
    }
  }
}
