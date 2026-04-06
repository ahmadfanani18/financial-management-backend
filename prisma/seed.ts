import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log('Created user:', user.email);

  // Create default categories (EXPENSE)
  const expenseCategories = [
    { name: 'Makanan', type: 'EXPENSE', icon: '🍔', color: '#F97316' },
    { name: 'Transportasi', type: 'EXPENSE', icon: '🚗', color: '#3B82F6' },
    { name: 'Hiburan', type: 'EXPENSE', icon: '🎬', color: '#EF4444' },
    { name: 'Belanja', type: 'EXPENSE', icon: '🛒', color: '#8B5CF6' },
    { name: 'Tagihan', type: 'EXPENSE', icon: '📄', color: '#F59E0B' },
    { name: 'Kesehatan', type: 'EXPENSE', icon: '🏥', color: '#10B981' },
    { name: 'Pendidikan', type: 'EXPENSE', icon: '📚', color: '#06B6D4' },
  ];

  // Create default categories (INCOME)
  const incomeCategories = [
    { name: 'Gaji', type: 'INCOME', icon: '💰', color: '#10B981' },
    { name: 'Freelance', type: 'INCOME', icon: '💼', color: '#06B6D4' },
    { name: 'Investasi', type: 'INCOME', icon: '📈', color: '#8B5CF6' },
    { name: 'Hadiah', type: 'INCOME', icon: '🎁', color: '#EC4899' },
    { name: 'Lainnya', type: 'INCOME', icon: '📦', color: '#6B7280' },
  ];

  for (const cat of expenseCategories) {
    await prisma.category.upsert({
      where: { id: `${cat.name.toLowerCase()}-expense` },
      update: {},
      create: {
        ...cat,
        userId: user.id,
        isDefault: true,
      },
    });
  }

  for (const cat of incomeCategories) {
    await prisma.category.upsert({
      where: { id: `${cat.name.toLowerCase()}-income` },
      update: {},
      create: {
        ...cat,
        userId: user.id,
        isDefault: true,
      },
    });
  }
  console.log('Created categories');

  // Create accounts
  const accounts = await Promise.all([
    prisma.account.upsert({
      where: { id: 'bank-bca' },
      update: {},
      create: {
        id: 'bank-bca',
        userId: user.id,
        name: 'Bank BCA',
        type: 'BANK',
        balance: 5000000,
        currency: 'IDR',
        icon: 'bank',
        color: '#3B82F6',
      },
    }),
    prisma.account.upsert({
      where: { id: 'gopay' },
      update: {},
      create: {
        id: 'gopay',
        userId: user.id,
        name: 'GoPay',
        type: 'EWALLET',
        balance: 1500000,
        currency: 'IDR',
        icon: 'wallet',
        color: '#10B981',
      },
    }),
    prisma.account.upsert({
      where: { id: 'ovo' },
      update: {},
      create: {
        id: 'ovo',
        userId: user.id,
        name: 'OVO',
        type: 'EWALLET',
        balance: 500000,
        currency: 'IDR',
        icon: 'wallet',
        color: '#8B5CF6',
      },
    }),
    prisma.account.upsert({
      where: { id: 'tunai' },
      update: {},
      create: {
        id: 'tunai',
        userId: user.id,
        name: 'Tunai',
        type: 'CASH',
        balance: 200000,
        currency: 'IDR',
        icon: 'wallet',
        color: '#F59E0B',
      },
    }),
  ]);
  console.log('Created accounts');

  // Get categories
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
  });

  const salaryCategory = categories.find((c) => c.name === 'Gaji')!;
  const foodCategory = categories.find((c) => c.name === 'Makanan')!;
  const transportCategory = categories.find((c) => c.name === 'Transportasi')!;
  const entertainmentCategory = categories.find((c) => c.name === 'Hiburan')!;

  // Create transactions
  const transactions = [
    {
      userId: user.id,
      accountId: 'bank-bca',
      categoryId: salaryCategory.id,
      type: 'INCOME' as const,
      amount: 8000000,
      description: 'Gaji Bulanan',
      date: new Date('2026-04-01'),
    },
    {
      userId: user.id,
      accountId: 'gopay',
      categoryId: foodCategory.id,
      type: 'EXPENSE' as const,
      amount: 45000,
      description: 'Makan Siang',
      date: new Date('2026-04-02'),
    },
    {
      userId: user.id,
      accountId: 'ovo',
      categoryId: transportCategory.id,
      type: 'EXPENSE' as const,
      amount: 25000,
      description: 'Grab ke Kantor',
      date: new Date('2026-04-02'),
    },
    {
      userId: user.id,
      accountId: 'bank-bca',
      categoryId: entertainmentCategory.id,
      type: 'EXPENSE' as const,
      amount: 149000,
      description: 'Netflix',
      date: new Date('2026-04-03'),
    },
    {
      userId: user.id,
      accountId: 'bank-bca',
      categoryId: salaryCategory.id,
      type: 'INCOME' as const,
      amount: 2500000,
      description: 'Freelance Project',
      date: new Date('2026-04-04'),
    },
    {
      userId: user.id,
      accountId: 'bank-bca',
      categoryId: foodCategory.id,
      type: 'EXPENSE' as const,
      amount: 150000,
      description: 'Belanja Mingguan',
      date: new Date('2026-04-05'),
    },
    {
      userId: user.id,
      accountId: 'tunai',
      categoryId: foodCategory.id,
      type: 'EXPENSE' as const,
      amount: 30000,
      description: 'Makan Malam',
      date: new Date('2026-04-05'),
    },
  ];

  for (const tx of transactions) {
    await prisma.transaction.create({
      data: tx,
    });
  }
  console.log('Created transactions');

  // Create budgets
  const budgets = await Promise.all([
    prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: foodCategory.id,
        amount: 2000000,
        period: 'MONTHLY',
        startDate: new Date('2026-04-01'),
        warningThreshold: 80,
        isActive: true,
      },
    }),
    prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: transportCategory.id,
        amount: 500000,
        period: 'MONTHLY',
        startDate: new Date('2026-04-01'),
        warningThreshold: 80,
        isActive: true,
      },
    }),
    prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: entertainmentCategory.id,
        amount: 300000,
        period: 'MONTHLY',
        startDate: new Date('2026-04-01'),
        warningThreshold: 80,
        isActive: true,
      },
    }),
  ]);
  console.log('Created budgets');

  // Create goals
  const goals = await Promise.all([
    prisma.goal.create({
      data: {
        userId: user.id,
        name: 'Liburan ke Jepang',
        targetAmount: 50000000,
        currentAmount: 35000000,
        deadline: new Date('2026-12-31'),
        icon: '✈️',
        color: '#3B82F6',
        status: 'ACTIVE',
      },
    }),
    prisma.goal.create({
      data: {
        userId: user.id,
        name: 'DP Rumah',
        targetAmount: 200000000,
        currentAmount: 85000000,
        deadline: new Date('2027-06-30'),
        icon: '🏠',
        color: '#10B981',
        status: 'ACTIVE',
      },
    }),
  ]);
  console.log('Created goals');

  // Create plan
  const plan = await prisma.plan.create({
    data: {
      userId: user.id,
      name: 'Dana Darurat',
      description: 'Membangun dana darurat 6 bulan pengeluaran',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-12-31'),
      status: 'ACTIVE',
      milestones: {
        create: [
          {
            title: 'Set up auto-debit bulanan',
            targetDate: new Date('2026-01-15'),
            isCompleted: true,
            order: 0,
          },
          {
            title: 'Kumpulkan 3 bulan pengeluaran',
            targetDate: new Date('2026-06-30'),
            isCompleted: true,
            order: 1,
          },
          {
            title: 'Kumpulkan 6 bulan pengeluaran',
            targetDate: new Date('2026-12-31'),
            isCompleted: false,
            order: 2,
          },
        ],
      },
    },
  });
  console.log('Created plan');

  console.log('✅ Seeding completed!');
  console.log('\nTest credentials:');
  console.log('  Email: demo@example.com');
  console.log('  Password: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
