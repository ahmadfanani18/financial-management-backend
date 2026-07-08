import { prisma } from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await hashPassword('demo123');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const startOfMonth = new Date(currentYear, currentMonth, 1);
  const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

  // Delete existing demo user data first
  const existingDemoUser = await prisma.user.findFirst({
    where: { email: 'demo@example.com' },
  });

  if (existingDemoUser) {
    console.log('Deleting existing demo user data...');
    
    // Delete in correct order due to foreign key constraints
    await prisma.notification.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.reminder.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.goalContribution.deleteMany({ where: { goal: { userId: existingDemoUser.id } } });
    await prisma.planMilestone.deleteMany({ where: { plan: { userId: existingDemoUser.id } } });
    await prisma.plan.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.budget.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.transaction.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.goal.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.category.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.account.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.holding.deleteMany({ where: { account: { userId: existingDemoUser.id } } });
    await prisma.investmentTransaction.deleteMany({ where: { account: { userId: existingDemoUser.id } } });
    await prisma.investmentTransaction.deleteMany({ where: { holding: { account: { userId: existingDemoUser.id } } } });
    await prisma.bill.deleteMany({ where: { userId: existingDemoUser.id } });
    await prisma.user.delete({ where: { id: existingDemoUser.id } });
  }

  // Create demo user
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      name: 'Budi Santoso',
      password: hashedPassword,
      avatar: null,
      role: 'MEMBER',
      emailVerifiedAt: now,
    },
  });
  console.log('Created demo user:', demoUser.email);

  // Create admin user
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!existingAdmin) {
    const adminPassword = await hashPassword('admin123');
    await prisma.user.create({
      data: {
        email: 'admin@finova.app',
        name: 'Admin Finova',
        password: adminPassword,
        role: 'ADMIN',
        emailVerifiedAt: now,
      },
    });
    console.log('Created admin user: admin@finova.app');
  }

  // Create accounts
  const accounts = await Promise.all([
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Bank BCA',
        type: 'BANK',
        balance: '15000000',
        currency: 'IDR',
        icon: 'building-bank',
        color: '#0EA5E9',
      },
    }),
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Bank Mandiri',
        type: 'BANK',
        balance: '8500000',
        currency: 'IDR',
        icon: 'building-bank',
        color: '#F59E0B',
      },
    }),
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'GoPay',
        type: 'EWALLET',
        balance: '1500000',
        currency: 'IDR',
        icon: 'wallet',
        color: '#22C55E',
      },
    }),
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'OVO',
        type: 'EWALLET',
        balance: '500000',
        currency: 'IDR',
        icon: 'wallet',
        color: '#6366F1',
      },
    }),
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Tunai',
        type: 'CASH',
        balance: '300000',
        currency: 'IDR',
        icon: 'banknote',
        color: '#F59E0B',
      },
    }),
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Kartu Kredit',
        type: 'CREDIT_CARD',
        balance: '-1500000',
        currency: 'IDR',
        icon: 'credit-card',
        color: '#EF4444',
      },
    }),
  ]);
  console.log('Created', accounts.length, 'accounts');

  // Investment Account
  const investmentAccount = await prisma.account.create({
    data: {
      userId: demoUser.id,
      name: 'Portfolio Investasi',
      type: 'INVESTMENT',
      balance: '0',
      currency: 'IDR',
      icon: 'trending-up',
      color: '#8B5CF6',
    },
  });
  console.log('Created investment account');

  // Holdings
  const holdings = await Promise.all([
    prisma.holding.create({
      data: {
        accountId: investmentAccount.id,
        symbol: 'BBCA',
        name: 'Bank Central Asia',
        quantity: 100,
        avgBuyPrice: 8900,
        assetType: 'IDX_STOCK',
        realizedPnL: 0,
      },
    }),
    prisma.holding.create({
      data: {
        accountId: investmentAccount.id,
        symbol: 'BBRI',
        name: 'Bank Rakyat Indonesia',
        quantity: 200,
        avgBuyPrice: 4500,
        assetType: 'IDX_STOCK',
        realizedPnL: 0,
      },
    }),
    prisma.holding.create({
      data: {
        accountId: investmentAccount.id,
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quantity: 5,
        avgBuyPrice: 165.00,
        assetType: 'US_STOCK',
        realizedPnL: 0,
      },
    }),
  ]);

  // Investment Transactions
  await Promise.all([
    prisma.investmentTransaction.create({
      data: {
        holdingId: holdings[0].id,
        accountId: investmentAccount.id,
        type: 'BUY',
        symbol: 'BBCA',
        quantity: 100,
        pricePerShare: 8900,
        brokerFee: 15000,
        transactionDate: new Date(currentYear, currentMonth - 3, 15),
      },
    }),
    prisma.investmentTransaction.create({
      data: {
        holdingId: holdings[1].id,
        accountId: investmentAccount.id,
        type: 'BUY',
        symbol: 'BBRI',
        quantity: 200,
        pricePerShare: 4500,
        brokerFee: 25000,
        transactionDate: new Date(currentYear, currentMonth - 3, 20),
      },
    }),
    prisma.investmentTransaction.create({
      data: {
        holdingId: holdings[2].id,
        accountId: investmentAccount.id,
        type: 'BUY',
        symbol: 'AAPL',
        quantity: 5,
        pricePerShare: 165.00,
        brokerFee: 5.00,
        transactionDate: new Date(currentYear, currentMonth - 1, 5),
      },
    }),
  ]);
  console.log('Created', holdings.length, 'holdings with transactions');

  // Categories
  const incomeCategories = await Promise.all([
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Gaji',
        type: 'INCOME',
        icon: 'briefcase',
        color: '#10B981',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Freelance',
        type: 'INCOME',
        icon: 'laptop',
        color: '#3B82F6',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Investasi',
        type: 'INCOME',
        icon: 'trending-up',
        color: '#8B5CF6',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Bonus',
        type: 'INCOME',
        icon: 'gift',
        color: '#F59E0B',
        isDefault: true,
      },
    }),
  ]);

  const expenseCategories = await Promise.all([
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Makanan & Minuman',
        type: 'EXPENSE',
        icon: 'utensils',
        color: '#EF4444',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Transportasi',
        type: 'EXPENSE',
        icon: 'car',
        color: '#F59E0B',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Belanja',
        type: 'EXPENSE',
        icon: 'shopping-bag',
        color: '#EC4899',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Listrik',
        type: 'EXPENSE',
        icon: 'bolt',
        color: '#6366F1',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Internet',
        type: 'EXPENSE',
        icon: 'wifi',
        color: '#14B8A6',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Air/PDAM',
        type: 'EXPENSE',
        icon: 'droplet',
        color: '#0EA5E9',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Hiburan',
        type: 'EXPENSE',
        icon: 'gamepad-2',
        color: '#8B5CF6',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Kesehatan',
        type: 'EXPENSE',
        icon: 'heart',
        color: '#F43F5E',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Pulsa/Data',
        type: 'EXPENSE',
        icon: 'smartphone',
        color: '#22C55E',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Cicilan',
        type: 'EXPENSE',
        icon: 'credit-card',
        color: '#EF4444',
        isDefault: true,
      },
    }),
  ]);
  console.log('Created categories');

  // Transactions - last 3 months of data for AI insights
  const transactionsData = [];

  // Last 3 months of income
  for (let m = 2; m >= 0; m--) {
    transactionsData.push({
      userId: demoUser.id,
      accountId: accounts[0].id,
      categoryId: incomeCategories[0].id,
      type: 'INCOME' as const,
      amount: '15000000',
      description: 'Gaji Bulanan',
      date: new Date(currentYear, currentMonth - m, 1),
    });
  }

  // Freelance income (2 months ago)
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: incomeCategories[1].id,
    type: 'INCOME' as const,
    amount: '3500000',
    description: 'Proyek Website Client A',
    date: new Date(currentYear, currentMonth - 1, 15),
  });

  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: incomeCategories[1].id,
    type: 'INCOME' as const,
    amount: '2500000',
    description: 'Freelance Mobile App',
    date: new Date(currentYear, currentMonth - 2, 20),
  });

  // Monthly expenses - recurring bills (fixed every month)
  for (let m = 2; m >= 0; m--) {
    // Listrik
    transactionsData.push({
      userId: demoUser.id,
      accountId: accounts[0].id,
      categoryId: expenseCategories[3].id,
      type: 'EXPENSE' as const,
      amount: '350000',
      description: 'Token Listrik PLN',
      date: new Date(currentYear, currentMonth - m, 5),
    });
    // Internet
    transactionsData.push({
      userId: demoUser.id,
      accountId: accounts[0].id,
      categoryId: expenseCategories[4].id,
      type: 'EXPENSE' as const,
      amount: '500000',
      description: 'Internet Fiber Optic',
      date: new Date(currentYear, currentMonth - m, 15),
    });
    // Air
    transactionsData.push({
      userId: demoUser.id,
      accountId: accounts[0].id,
      categoryId: expenseCategories[5].id,
      type: 'EXPENSE' as const,
      amount: '150000',
      description: 'PDAM Bulanan',
      date: new Date(currentYear, currentMonth - m, 20),
    });
    // Cicilan Motor
    transactionsData.push({
      userId: demoUser.id,
      accountId: accounts[1].id,
      categoryId: expenseCategories[9].id,
      type: 'EXPENSE' as const,
      amount: '1500000',
      description: 'Cicilan Motor Yamaha',
      date: new Date(currentYear, currentMonth - m, 25),
    });
  }

  // Variable expenses - this month
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[0].id,
    type: 'EXPENSE' as const,
    amount: '850000',
    description: 'Makan Siang & Malam - 2 Minggu Pertama',
    date: new Date(currentYear, currentMonth, 3),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[2].id,
    categoryId: expenseCategories[0].id,
    type: 'EXPENSE' as const,
    amount: '350000',
    description: 'Grab ke Kantor',
    date: new Date(currentYear, currentMonth, 4),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[2].id,
    type: 'EXPENSE' as const,
    amount: '750000',
    description: 'Belanja Mingguan Superindo',
    date: new Date(currentYear, currentMonth, 7),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[6].id,
    type: 'EXPENSE' as const,
    amount: '250000',
    description: 'Netflix + Spotify',
    date: new Date(currentYear, currentMonth, 10),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[2].id,
    categoryId: expenseCategories[8].id,
    type: 'EXPENSE' as const,
    amount: '150000',
    description: 'Pulsa + Paket Data',
    date: new Date(currentYear, currentMonth, 12),
  });

  // Last month expenses
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[0].id,
    type: 'EXPENSE' as const,
    amount: '1200000',
    description: 'Makan Bulanan',
    date: new Date(currentYear, currentMonth - 1, 10),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[1].id,
    type: 'EXPENSE' as const,
    amount: '600000',
    description: 'Transportasi Bulanan',
    date: new Date(currentYear, currentMonth - 1, 15),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[2].id,
    type: 'EXPENSE' as const,
    amount: '900000',
    description: 'Belanja Bulanan',
    date: new Date(currentYear, currentMonth - 1, 20),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[7].id,
    type: 'EXPENSE' as const,
    amount: '400000',
    description: 'Check-up Kesehatan',
    date: new Date(currentYear, currentMonth - 1, 22),
  });

  // 2 months ago expenses
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[0].id,
    type: 'EXPENSE' as const,
    amount: '1100000',
    description: 'Makan Bulanan',
    date: new Date(currentYear, currentMonth - 2, 10),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[1].id,
    type: 'EXPENSE' as const,
    amount: '550000',
    description: 'Transportasi Bulanan',
    date: new Date(currentYear, currentMonth - 2, 15),
  });
  transactionsData.push({
    userId: demoUser.id,
    accountId: accounts[0].id,
    categoryId: expenseCategories[2].id,
    type: 'EXPENSE' as const,
    amount: '850000',
    description: 'Belanja Bulanan',
    date: new Date(currentYear, currentMonth - 2, 20),
  });

  const transactions = await Promise.all(
    transactionsData.map(tx => prisma.transaction.create({ data: tx }))
  );
  console.log('Created', transactions.length, 'transactions');

  // Budgets
  const budgets = await Promise.all([
    prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId: expenseCategories[0].id,
        amount: '1500000',
        spent: '850000',
        period: 'MONTHLY',
        startDate: startOfMonth,
        endDate: endOfMonth,
        warningThreshold: 80,
        isActive: true,
      },
    }),
    prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId: expenseCategories[1].id,
        amount: '600000',
        spent: '350000',
        period: 'MONTHLY',
        startDate: startOfMonth,
        endDate: endOfMonth,
        warningThreshold: 80,
        isActive: true,
      },
    }),
    prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId: expenseCategories[2].id,
        amount: '1000000',
        spent: '750000',
        period: 'MONTHLY',
        startDate: startOfMonth,
        endDate: endOfMonth,
        warningThreshold: 80,
        isActive: true,
      },
    }),
    prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId: expenseCategories[3].id,
        amount: '400000',
        spent: '350000',
        period: 'MONTHLY',
        startDate: startOfMonth,
        endDate: endOfMonth,
        warningThreshold: 80,
        isActive: true,
      },
    }),
    prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId: expenseCategories[4].id,
        amount: '550000',
        spent: '500000',
        period: 'MONTHLY',
        startDate: startOfMonth,
        endDate: endOfMonth,
        warningThreshold: 80,
        isActive: true,
      },
    }),
  ]);
  console.log('Created', budgets.length, 'budgets');

  // Goals
  const goals = await Promise.all([
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'Liburan ke Jepang',
        targetAmount: '50000000',
        currentAmount: '15000000',
        initialBalance: '10000000',
        deadline: new Date(currentYear + 1, 5, 1),
        icon: 'plane',
        color: '#0EA5E9',
        status: 'ACTIVE',
        isLocked: false,
        source: 'MANUAL',
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'Dana Darurat',
        targetAmount: '36000000',
        currentAmount: '24000000',
        initialBalance: '20000000',
        deadline: new Date(currentYear + 1, 11, 31),
        icon: 'shield',
        color: '#F59E0B',
        status: 'ACTIVE',
        isLocked: true,
        source: 'MANUAL',
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'Upgrade Gadget',
        targetAmount: '20000000',
        currentAmount: '8000000',
        initialBalance: '5000000',
        deadline: new Date(currentYear, currentMonth + 4, 1),
        icon: 'smartphone',
        color: '#8B5CF6',
        status: 'ACTIVE',
        isLocked: false,
        source: 'MANUAL',
      },
    }),
  ]);
  console.log('Created', goals.length, 'goals');

  // Goal Contributions
  await Promise.all([
    prisma.goalContribution.create({
      data: {
        goalId: goals[0].id,
        amount: '10000000',
        type: 'INITIAL',
        date: new Date(currentYear, currentMonth - 3, 1),
        note: 'Saldo awal dari tabungan',
        accountId: accounts[0].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[0].id,
        amount: '2500000',
        type: 'MANUAL',
        date: new Date(currentYear, currentMonth - 2, 15),
        note: 'Tabungan bulanan',
        accountId: accounts[0].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[0].id,
        amount: '2500000',
        type: 'MANUAL',
        date: new Date(currentYear, currentMonth - 1, 15),
        note: 'Tabungan bulanan',
        accountId: accounts[0].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[1].id,
        amount: '20000000',
        type: 'INITIAL',
        date: new Date(currentYear, currentMonth - 6, 1),
        note: 'Saldo awal',
        accountId: accounts[1].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[1].id,
        amount: '4000000',
        type: 'AUTO',
        date: new Date(currentYear, currentMonth - 1, 1),
        note: 'Auto transfer bulanan',
        accountId: accounts[1].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[2].id,
        amount: '5000000',
        type: 'INITIAL',
        date: new Date(currentYear, currentMonth - 2, 1),
        note: 'Saldo awal',
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[2].id,
        amount: '1500000',
        type: 'MANUAL',
        date: new Date(currentYear, currentMonth - 1, 10),
        note: 'Tabungan',
        accountId: accounts[0].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[2].id,
        amount: '1500000',
        type: 'MANUAL',
        date: new Date(currentYear, currentMonth, 10),
        note: 'Tabungan',
        accountId: accounts[0].id,
      },
    }),
  ]);
  console.log('Created goal contributions');

  // Bills (recurring monthly)
  const bills = await Promise.all([
    prisma.bill.create({
      data: {
        userId: demoUser.id,
        name: 'Listrik PLN',
        amount: '350000',
        amountType: 'VARIABLE',
        mode: 'AUTO_DEDUCT',
        dueDate: 5,
        executionDate: 4,
        accountId: accounts[0].id,
        categoryId: expenseCategories[3].id,
        isActive: true,
      },
    }),
    prisma.bill.create({
      data: {
        userId: demoUser.id,
        name: 'Internet Fiber',
        amount: '500000',
        amountType: 'FIXED',
        mode: 'AUTO_DEDUCT',
        dueDate: 15,
        executionDate: 14,
        accountId: accounts[0].id,
        categoryId: expenseCategories[4].id,
        isActive: true,
      },
    }),
    prisma.bill.create({
      data: {
        userId: demoUser.id,
        name: 'PDAM Air',
        amount: '150000',
        amountType: 'FIXED',
        mode: 'AUTO_DEDUCT',
        dueDate: 20,
        executionDate: 19,
        accountId: accounts[0].id,
        categoryId: expenseCategories[5].id,
        isActive: true,
      },
    }),
    prisma.bill.create({
      data: {
        userId: demoUser.id,
        name: 'Cicilan Motor',
        amount: '1500000',
        amountType: 'FIXED',
        mode: 'REMINDER_ONLY',
        dueDate: 25,
        executionDate: 25,
        accountId: accounts[1].id,
        categoryId: expenseCategories[9].id,
        isActive: true,
      },
    }),
    prisma.bill.create({
      data: {
        userId: demoUser.id,
        name: 'Netflix',
        amount: '159000',
        amountType: 'FIXED',
        mode: 'AUTO_DEDUCT',
        dueDate: 10,
        executionDate: 9,
        accountId: accounts[0].id,
        categoryId: expenseCategories[6].id,
        isActive: true,
      },
    }),
    prisma.bill.create({
      data: {
        userId: demoUser.id,
        name: 'Spotify',
        amount: '59000',
        amountType: 'FIXED',
        mode: 'AUTO_DEDUCT',
        dueDate: 10,
        executionDate: 9,
        accountId: accounts[0].id,
        categoryId: expenseCategories[6].id,
        isActive: true,
      },
    }),
  ]);
  console.log('Created', bills.length, 'bills');

  // Plan with milestones
  const plan = await prisma.plan.create({
    data: {
      userId: demoUser.id,
      name: 'Rencana Keuangan 2026',
      description: 'Capai semua goal keuangan tahun 2026',
      startDate: startOfMonth,
      endDate: new Date(currentYear + 1, 11, 31),
      status: 'ACTIVE',
    },
  });

  await Promise.all([
    prisma.planMilestone.create({
      data: {
        planId: plan.id,
        title: 'Tabungan 30%',
        description: 'Capai 30% dari total target tabungan',
        targetDate: new Date(currentYear, currentMonth + 3, 31),
        targetAmount: '21000000',
        isCompleted: false,
        order: 0,
      },
    }),
    prisma.planMilestone.create({
      data: {
        planId: plan.id,
        title: 'Tabungan 60%',
        description: 'Capai 60% dari total target tabungan',
        targetDate: new Date(currentYear, currentMonth + 6, 31),
        targetAmount: '42000000',
        isCompleted: false,
        order: 1,
      },
    }),
    prisma.planMilestone.create({
      data: {
        planId: plan.id,
        title: 'Capai Semua Goal',
        description: 'Liburan Jepang, Dana Darurat, dan Gadget',
        targetDate: new Date(currentYear + 1, 11, 31),
        targetAmount: '70000000',
        isCompleted: false,
        order: 2,
      },
    }),
  ]);
  console.log('Created plan with milestones');

  // Reminders
  await Promise.all([
    prisma.reminder.create({
      data: {
        userId: demoUser.id,
        title: 'Budget Mingguan',
        description: 'Cek pengeluaran makanan minggu ini',
        type: 'RECURRING',
        date: new Date(currentYear, currentMonth, now.getDate() + 2, 9, 0),
        isActive: true,
      },
    }),
    prisma.reminder.create({
      data: {
        userId: demoUser.id,
        title: 'Review Keuangan Bulanan',
        description: 'Cek progress dan atur budget bulan depan',
        type: 'RECURRING',
        date: new Date(currentYear, currentMonth + 1, 1, 10, 0),
        isActive: true,
      },
    }),
  ]);
  console.log('Created reminders');

  // Notifications
  await Promise.all([
    prisma.notification.create({
      data: {
        userId: demoUser.id,
        title: 'Selamat Datang!',
        message: 'Akun demo berhasil dibuat. Data 示例 membantu Anda menjelajahi fitur aplikasi.',
        type: 'SYSTEM',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        userId: demoUser.id,
        title: 'Budget Makanan',
        message: 'Pengeluaran makanan bulan ini sudah 56% dari budget. Tetapkan pengaturan hemat untuk kontrol lebih baik.',
        type: 'BUDGET_WARNING',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        userId: demoUser.id,
        title: 'Goal Liburan',
        message: 'Progress goal Liburan ke Jepang: 30%. Tambahkan tabungan untuk mencapai target.',
        type: 'GOAL_MILESTONE',
        isRead: false,
      },
    }),
  ]);
  console.log('Created notifications');

  // Market Prices
  const marketSymbols = ['BBCA', 'BBRI', 'AAPL', 'GOOGL', 'BTC', 'ETH'];
  const existingPrices = await prisma.marketPrice.findMany({ where: { symbol: { in: marketSymbols } } });
  if (existingPrices.length === 0) {
    await Promise.all([
      prisma.marketPrice.create({ data: { symbol: 'BBCA', name: 'Bank Central Asia', type: 'IDX_STOCK', price: '9500', currency: 'IDR' } }),
      prisma.marketPrice.create({ data: { symbol: 'BBRI', name: 'Bank Rakyat Indonesia', type: 'IDX_STOCK', price: '4800', currency: 'IDR' } }),
      prisma.marketPrice.create({ data: { symbol: 'AAPL', name: 'Apple Inc.', type: 'US_STOCK', price: '178.50', currency: 'USD' } }),
      prisma.marketPrice.create({ data: { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'US_STOCK', price: '141.25', currency: 'USD' } }),
      prisma.marketPrice.create({ data: { symbol: 'BTC', name: 'Bitcoin', type: 'CRYPTO', price: '105000000', currency: 'IDR' } }),
      prisma.marketPrice.create({ data: { symbol: 'ETH', name: 'Ethereum', type: 'CRYPTO', price: '5500000', currency: 'IDR' } }),
    ]);
    console.log('Created market prices');
  }

  console.log('\n=================================');
  console.log('Demo Account Created Successfully!');
  console.log('=================================');
  console.log('Email: demo@example.com');
  console.log('Password: demo123');
  console.log('\nData includes:');
  console.log('- 6 bank/e-wallet accounts (Rp 28.3jt total)');
  console.log('- Investment portfolio (BBCA, BBRI, AAPL)');
  console.log('- 3 months of transaction history');
  console.log('- 5 active budgets');
  console.log('- 3 goals with progress');
  console.log('- 6 recurring bills');
  console.log('- Financial plan with milestones');
  console.log('=================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
