import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default pricing for both apps
  await prisma.pricing.upsert({
    where: { app_period: { app: 'FINANCIAL_MANAGEMENT', period: 'MONTHLY' } },
    update: {},
    create: {
      app: 'FINANCIAL_MANAGEMENT',
      amount: 149000,
      period: 'MONTHLY',
      currency: 'IDR',
      isActive: true,
    },
  });

  await prisma.pricing.upsert({
    where: { app_period: { app: 'EVENT_ORGANIZER', period: 'MONTHLY' } },
    update: {},
    create: {
      app: 'EVENT_ORGANIZER',
      amount: 149000,
      period: 'MONTHLY',
      currency: 'IDR',
      isActive: true,
    },
  });

  console.log('Pricing seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });