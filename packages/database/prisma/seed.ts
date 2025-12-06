import { PrismaClient, UserRole, DriverStatus, CarClass } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create tariffs
  const tariffs = await Promise.all([
    prisma.tariff.upsert({
      where: { carClass: CarClass.ECONOMY },
      update: {},
      create: {
        carClass: CarClass.ECONOMY,
        baseFare: 50,
        perKm: 10,
        perMinute: 3,
        minFare: 100,
      },
    }),
    prisma.tariff.upsert({
      where: { carClass: CarClass.COMFORT },
      update: {},
      create: {
        carClass: CarClass.COMFORT,
        baseFare: 80,
        perKm: 15,
        perMinute: 4,
        minFare: 150,
      },
    }),
    prisma.tariff.upsert({
      where: { carClass: CarClass.BUSINESS },
      update: {},
      create: {
        carClass: CarClass.BUSINESS,
        baseFare: 150,
        perKm: 25,
        perMinute: 6,
        minFare: 300,
      },
    }),
    prisma.tariff.upsert({
      where: { carClass: CarClass.PREMIUM },
      update: {},
      create: {
        carClass: CarClass.PREMIUM,
        baseFare: 300,
        perKm: 40,
        perMinute: 10,
        minFare: 500,
      },
    }),
  ])
  console.log(`✅ Created ${tariffs.length} tariffs`)

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { phone: '+79999999999' },
    update: {},
    create: {
      phone: '+79999999999',
      name: 'Admin',
      email: 'admin@vibe-taxi.ru',
      role: UserRole.ADMIN,
    },
  })
  console.log(`✅ Created admin user: ${admin.name}`)

  // Create test client
  const client = await prisma.user.upsert({
    where: { phone: '+79111111111' },
    update: {},
    create: {
      phone: '+79111111111',
      name: 'Тестовый Клиент',
      email: 'client@test.ru',
      role: UserRole.CLIENT,
    },
  })
  console.log(`✅ Created test client: ${client.name}`)

  // Create test driver user
  const driverUser = await prisma.user.upsert({
    where: { phone: '+79222222222' },
    update: {},
    create: {
      phone: '+79222222222',
      name: 'Тестовый Водитель',
      email: 'driver@test.ru',
      role: UserRole.DRIVER,
    },
  })

  // Create driver profile
  const driver = await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      carModel: 'Toyota Camry',
      carNumber: 'А123БВ77',
      carColor: 'Белый',
      carYear: 2022,
      carClass: CarClass.COMFORT,
      licenseNumber: '1234567890',
      isVerified: true,
      status: DriverStatus.OFFLINE,
    },
  })
  console.log(`✅ Created test driver: ${driverUser.name}`)

  // Create promo code
  const promo = await prisma.promoCode.upsert({
    where: { code: 'WELCOME' },
    update: {},
    create: {
      code: 'WELCOME',
      discountType: 'PERCENT',
      discountValue: 20,
      maxDiscount: 200,
      usageLimit: 1000,
    },
  })
  console.log(`✅ Created promo code: ${promo.code}`)

  // Create default settings
  const settings = await Promise.all([
    prisma.settings.upsert({
      where: { key: 'surge_multiplier' },
      update: {},
      create: {
        key: 'surge_multiplier',
        value: { enabled: true, maxMultiplier: 2.5 },
      },
    }),
    prisma.settings.upsert({
      where: { key: 'driver_search_radius' },
      update: {},
      create: {
        key: 'driver_search_radius',
        value: { km: 5 },
      },
    }),
    prisma.settings.upsert({
      where: { key: 'max_order_wait_time' },
      update: {},
      create: {
        key: 'max_order_wait_time',
        value: { minutes: 10 },
      },
    }),
  ])
  console.log(`✅ Created ${settings.length} settings`)

  console.log('\n🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
