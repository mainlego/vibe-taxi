import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma, CarClass } from '@vibe-taxi/database'

const updateTariffSchema = z.object({
  baseFare: z.number().positive().optional(),
  perKm: z.number().positive().optional(),
  perMinute: z.number().positive().optional(),
  minFare: z.number().positive().optional(),
  isActive: z.boolean().optional(),
})

export const tariffRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all tariffs
  fastify.get('/', async () => {
    const tariffs = await prisma.tariff.findMany({
      where: { isActive: true },
      orderBy: { baseFare: 'asc' },
    })

    return tariffs
  })

  // Get tariff by car class
  fastify.get('/:carClass', async (request, reply) => {
    const { carClass } = request.params as { carClass: string }

    const validClasses = ['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']
    if (!validClasses.includes(carClass.toUpperCase())) {
      return reply.status(400).send({ error: 'Invalid car class' })
    }

    const tariff = await prisma.tariff.findUnique({
      where: { carClass: carClass.toUpperCase() as CarClass },
    })

    if (!tariff) {
      return reply.status(404).send({ error: 'Tariff not found' })
    }

    return tariff
  })

  // Update tariff (admin only)
  fastify.patch('/:carClass', {
    preHandler: [fastify.authenticate as any],
  }, async (request: any, reply) => {
    // Check admin role
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin access required' })
    }

    const { carClass } = request.params as { carClass: string }

    const validClasses = ['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']
    if (!validClasses.includes(carClass.toUpperCase())) {
      return reply.status(400).send({ error: 'Invalid car class' })
    }

    try {
      const data = updateTariffSchema.parse(request.body)

      const tariff = await prisma.tariff.update({
        where: { carClass: carClass.toUpperCase() as CarClass },
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

  // Calculate trip price
  fastify.post('/calculate', async (request, reply) => {
    try {
      const { distance, estimatedTime, carClass } = z.object({
        distance: z.number().positive(),
        estimatedTime: z.number().positive(),
        carClass: z.enum(['ECONOMY', 'COMFORT', 'BUSINESS', 'PREMIUM']).default('ECONOMY'),
      }).parse(request.body)

      const tariff = await prisma.tariff.findUnique({
        where: { carClass: carClass as CarClass },
      })

      if (!tariff) {
        return reply.status(400).send({ error: 'Tariff not found' })
      }

      let price = tariff.baseFare + (distance * tariff.perKm) + (estimatedTime * tariff.perMinute)
      price = Math.max(price, tariff.minFare)

      return {
        carClass,
        price: Math.round(price),
        breakdown: {
          baseFare: tariff.baseFare,
          distanceCost: Math.round(distance * tariff.perKm),
          timeCost: Math.round(estimatedTime * tariff.perMinute),
          minFare: tariff.minFare,
        },
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })

  // Calculate prices for all classes
  fastify.post('/calculate-all', async (request, reply) => {
    try {
      const { distance, estimatedTime } = z.object({
        distance: z.number().positive(),
        estimatedTime: z.number().positive(),
      }).parse(request.body)

      const tariffs = await prisma.tariff.findMany({
        where: { isActive: true },
        orderBy: { baseFare: 'asc' },
      })

      const prices = tariffs.map(tariff => {
        let price = tariff.baseFare + (distance * tariff.perKm) + (estimatedTime * tariff.perMinute)
        price = Math.max(price, tariff.minFare)

        return {
          carClass: tariff.carClass,
          price: Math.round(price),
        }
      })

      return prices
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors[0].message })
      }
      throw error
    }
  })
}
