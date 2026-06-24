import { prisma } from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await hashPassword('demo123');
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const existingDemoUser = await prisma.user.findFirst({
    where: { email: 'demo@example.com' },
  });

  const demoUser = existingDemoUser || await prisma.user.create({
    data: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
      avatar: null,
      role: 'MEMBER',
    },
  });

  if (existingDemoUser) {
    console.log('Demo user already exists:', demoUser.email);
  } else {
    console.log('Created demo user:', demoUser.email);
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: 'admin@finova.app',
        name: 'Admin Finova',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log('Created admin user: admin@finova.app');
  } else {
    console.log('Admin user already exists:', existingAdmin.email);
  }

  const savingsAccount = await prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Tabungan Liburan',
        type: 'BANK',
        balance: '8500000',
        currency: 'IDR',
        icon: 'piggy-bank',
        color: '#8B5CF6',
      },
    });

    const emergencyAccount = await prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Dana Darurat',
        type: 'BANK',
        balance: '18000000',
        currency: 'IDR',
        icon: 'shield',
        color: '#F59E0B',
        isLocked: true,
      },
    });

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
        name: 'GoPay',
        type: 'EWALLET',
        balance: '2500000',
        currency: 'IDR',
        icon: 'wallet',
        color: '#22C55E',
      },
    }),
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Tunai',
        type: 'CASH',
        balance: '500000',
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
        balance: '-2500000',
        currency: 'IDR',
        icon: 'credit-card',
        color: '#EF4444',
      },
    }),
  ]);

  console.log('Created', accounts.length, 'accounts');

  // Market Prices - skip if exists
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
    console.log('Created', marketSymbols.length, 'market prices');
  } else {
    console.log('Market prices already exist, skipping');
  }

  // Investment Account - skip if exists
  let investmentAccount = await prisma.account.findFirst({
    where: { userId: demoUser.id, type: 'INVESTMENT' },
  });

  if (!investmentAccount) {
    investmentAccount = await prisma.account.create({
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
  } else {
    console.log('Investment account already exists, skipping');
  }

  // Holdings - skip if exists
  const existingHoldings = await prisma.holding.findMany({ where: { accountId: investmentAccount.id } });
  if (existingHoldings.length === 0) {
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
          quantity: 10,
          avgBuyPrice: 165.00,
          assetType: 'US_STOCK',
          realizedPnL: 0,
        },
      }),
      prisma.holding.create({
        data: {
          accountId: investmentAccount.id,
          symbol: 'BTC',
          name: 'Bitcoin',
          quantity: 0.05,
          avgBuyPrice: 95000000,
          assetType: 'CRYPTO',
          realizedPnL: 0,
        },
      }),
    ]);
    console.log('Created', holdings.length, 'holdings');

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
          transactionDate: new Date(now.getFullYear(), now.getMonth() - 2, 15),
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
          transactionDate: new Date(now.getFullYear(), now.getMonth() - 2, 20),
        },
      }),
      prisma.investmentTransaction.create({
        data: {
          holdingId: holdings[2].id,
          accountId: investmentAccount.id,
          type: 'BUY',
          symbol: 'AAPL',
          quantity: 10,
          pricePerShare: 165.00,
          brokerFee: 5.00,
          transactionDate: new Date(now.getFullYear(), now.getMonth() - 1, 5),
        },
      }),
      prisma.investmentTransaction.create({
        data: {
          holdingId: holdings[3].id,
          accountId: investmentAccount.id,
          type: 'BUY',
          symbol: 'BTC',
          quantity: 1,
          pricePerShare: 95000000,
          brokerFee: 100000,
          transactionDate: new Date(now.getFullYear(), now.getMonth() - 3, 10),
        },
      }),
    ]);
    console.log('Created 4 investment transactions');
  } else {
    console.log('Holdings already exist, skipping');
  }

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
  ]);

  const expenseCategories = await Promise.all([
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Makanan',
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
        name: 'Tagihan',
        type: 'EXPENSE',
        icon: 'receipt',
        color: '#6366F1',
        isDefault: true,
      },
    }),
    prisma.category.create({
      data: {
        userId: demoUser.id,
        name: 'Hiburan',
        type: 'EXPENSE',
        icon: 'gamepad-2',
        color: '#14B8A6',
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
  ]);

  console.log('Created categories');

  const transactions = await Promise.all([
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[0].id,
        categoryId: incomeCategories[0].id,
        type: 'INCOME',
        amount: '12000000',
        description: 'Gaji Bulan Mei',
        date: new Date(now.getFullYear(), now.getMonth(), 1),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[0].id,
        categoryId: expenseCategories[0].id,
        type: 'EXPENSE',
        amount: '250000',
        description: 'Makan Siang & Malam',
        date: new Date(now.getFullYear(), now.getMonth(), 2),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[1].id,
        categoryId: expenseCategories[1].id,
        type: 'EXPENSE',
        amount: '150000',
        description: 'Ojol ke Kantor',
        date: new Date(now.getFullYear(), now.getMonth(), 3),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[0].id,
        categoryId: expenseCategories[2].id,
        type: 'EXPENSE',
        amount: '500000',
        description: 'Belanja Bulanan',
        date: new Date(now.getFullYear(), now.getMonth(), 5),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[3].id,
        categoryId: expenseCategories[3].id,
        type: 'EXPENSE',
        amount: '1500000',
        description: 'Pembayaran Kartu Kredit',
        date: new Date(now.getFullYear(), now.getMonth(), 10),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[0].id,
        categoryId: incomeCategories[1].id,
        type: 'INCOME',
        amount: '3000000',
        description: 'Proyek Website',
        date: new Date(now.getFullYear(), now.getMonth(), 12),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[2].id,
        categoryId: expenseCategories[4].id,
        type: 'EXPENSE',
        amount: '200000',
        description: 'Nonton Film',
        date: new Date(now.getFullYear(), now.getMonth(), 15),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[0].id,
        categoryId: expenseCategories[3].id,
        type: 'EXPENSE',
        amount: '350000',
        description: 'Listrik & Internet',
        date: new Date(now.getFullYear(), now.getMonth(), 20),
      },
    }),
  ]);

  console.log('Created', transactions.length, 'transactions');

  const budgets = await Promise.all([
    prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId: expenseCategories[0].id,
        amount: '2000000',
        spent: '250000',
        period: 'MONTHLY',
        startDate: startOfMonth,
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        warningThreshold: 80,
        isActive: true,
      },
    }),
    prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId: expenseCategories[1].id,
        amount: '500000',
        spent: '150000',
        period: 'MONTHLY',
        startDate: startOfMonth,
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        warningThreshold: 80,
        isActive: true,
      },
    }),
    prisma.budget.create({
      data: {
        userId: demoUser.id,
        categoryId: expenseCategories[2].id,
        amount: '1000000',
        spent: '500000',
        period: 'MONTHLY',
        startDate: startOfMonth,
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        warningThreshold: 80,
        isActive: true,
      },
    }),
  ]);

  console.log('Created', budgets.length, 'budgets');

  const goals = await Promise.all([
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'Liburan ke Jepang',
        targetAmount: '25000000',
        currentAmount: '8500000',
        initialBalance: '5000000',
        deadline: new Date(now.getFullYear() + 1, 5, 1),
        icon: 'plane',
        color: '#0EA5E9',
        status: 'ACTIVE',
        isLocked: false,
        source: 'MANUAL',
        linkedAccountId: savingsAccount.id,
        isInitialSet: true,
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'Beli Laptop Baru',
        targetAmount: '15000000',
        currentAmount: '7000000',
        initialBalance: '5000000',
        deadline: new Date(now.getFullYear(), now.getMonth() + 6, 1),
        icon: 'laptop',
        color: '#10B981',
        status: 'ACTIVE',
        isLocked: false,
        source: 'MANUAL',
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'Dana Darurat',
        targetAmount: '30000000',
        currentAmount: '18000000',
        initialBalance: '15000000',
        deadline: new Date(now.getFullYear() + 2, 0, 1),
        icon: 'shield',
        color: '#F59E0B',
        status: 'ACTIVE',
        isLocked: true,
        source: 'MANUAL',
        linkedAccountId: emergencyAccount.id,
        isInitialSet: true,
      },
    }),
  ]);

  console.log('Created', goals.length, 'goals');

  await Promise.all([
    prisma.goalContribution.create({
      data: {
        goalId: goals[0].id,
        amount: '5000000',
        type: 'INITIAL',
        date: new Date(now.getFullYear(), now.getMonth() - 3, 1),
        note: 'Saldo awal dari akun',
        accountId: savingsAccount.id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[0].id,
        amount: '3500000',
        type: 'MANUAL',
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
        note: 'Tabungan bulanan',
        accountId: accounts[0].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[1].id,
        amount: '5000000',
        type: 'INITIAL',
        date: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        note: 'Saldo awal',
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[1].id,
        amount: '2000000',
        type: 'MANUAL',
        date: new Date(now.getFullYear(), now.getMonth(), 5),
        note: 'Dari tabungan',
        accountId: accounts[0].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[2].id,
        amount: '15000000',
        type: 'INITIAL',
        date: new Date(now.getFullYear(), now.getMonth() - 6, 1),
        note: 'Saldo awal dari akun',
        accountId: emergencyAccount.id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[2].id,
        amount: '3000000',
        type: 'AUTO',
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        note: 'Auto dari transfer',
        accountId: emergencyAccount.id,
      },
    }),
  ]);

  console.log('Created goal contributions');

  const plan = await prisma.plan.create({
    data: {
      userId: demoUser.id,
      name: 'Plan Tabungan 2026',
      description: 'Rencana tabungan untuk mencapai goal tahun 2026',
      startDate: startOfMonth,
      endDate: new Date(now.getFullYear() + 1, 11, 31),
      status: 'ACTIVE',
    },
  });

  await Promise.all([
    prisma.planMilestone.create({
      data: {
        planId: plan.id,
        title: 'Tabungan 30%',
        description: 'Capai 30% dari total target',
        targetDate: new Date(now.getFullYear(), now.getMonth() + 3, 31),
        targetAmount: '21000000',
        isCompleted: false,
        order: 0,
      },
    }),
    prisma.planMilestone.create({
      data: {
        planId: plan.id,
        title: 'Tabungan 60%',
        description: 'Capai 60% dari total target',
        targetDate: new Date(now.getFullYear(), now.getMonth() + 6, 31),
        targetAmount: '42000000',
        isCompleted: false,
        order: 1,
      },
    }),
    prisma.planMilestone.create({
      data: {
        planId: plan.id,
        title: 'Capai Semua Goal',
        description: 'Semua goal tercapai',
        targetDate: new Date(now.getFullYear() + 1, 11, 31),
        targetAmount: '70000000',
        isCompleted: false,
        order: 2,
      },
    }),
  ]);

  console.log('Created plan with milestones');

  const reminders = await Promise.all([
    prisma.reminder.create({
      data: {
        userId: demoUser.id,
        title: 'Budget Makanan Mingguan',
        description: 'Cek pengeluaran makanan minggu ini',
        type: 'RECURRING',
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0),
        isActive: true,
      },
    }),
    prisma.reminder.create({
      data: {
        userId: demoUser.id,
        title: 'Review Keuangan Bulanan',
        description: 'Cek progress bulan ini',
        type: 'RECURRING',
        date: new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0),
        isActive: true,
      },
    }),
  ]);

  console.log('Created', reminders.length, 'reminders');

  const notifications = await Promise.all([
    prisma.notification.create({
      data: {
        userId: demoUser.id,
        title: 'Selamat Datang!',
        message: 'Akun demo berhasil dibuat. Nikmati fitur pengelolaan keuangan kami.',
        type: 'SYSTEM',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        userId: demoUser.id,
        title: 'Budget Terpenuhi',
        message: 'Selamat! Budget makanan bulan ini telah terpenuhi dengan baik.',
        type: 'BUDGET_WARNING',
        isRead: false,
      },
    }),
  ]);

  console.log('Created', notifications.length, 'notifications');

  console.log('\n=== Demo Account Created ===');
  console.log('Email: demo@example.com');
  console.log('Password: demo123');
  console.log('=============================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });