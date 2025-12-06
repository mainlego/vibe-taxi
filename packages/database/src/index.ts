// Database package - exports Prisma client and types
import { PrismaClient } from '@prisma/client'

// Global declaration to prevent multiple instances in development
declare global {
  var prisma: PrismaClient | undefined
}

// Create singleton instance
export const prisma = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Save to global in development to prevent hot reload issues
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

// Export Prisma client class for type usage
export { PrismaClient }

// Re-export all generated types from Prisma
export * from '@prisma/client'

// Export commonly used types
export type {
  User,
  Driver,
  Order,
  Address,
  Payment,
  Review,
  Notification,
  Tariff,
  PromoCode,
  Settings,
  OrderStatusHistory,
} from '@prisma/client'
