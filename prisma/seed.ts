import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return salt + ':' + hash;
}

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await hashPassword('demo123');

  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
      avatar: null,
      role: 'MEMBER',
    },
  });

  console.log('Created demo user:', demoUser.email);

  const accounts = await Promise.all([
    prisma.account.create({
      data: {
        userId: demoUser.id,
        name: 'Bank BCA',
        type: 'BANK',
        balance: 15000000,
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
        balance: 2500000,
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
        balance: 500000,
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
        balance: -2500000,
        currency: 'IDR',
        icon: 'credit-card',
        color: '#EF4444',
      },
    }),
  ]);

  console.log('Created', accounts.length, 'accounts');

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

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const transactions = await Promise.all([
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[0].id,
        categoryId: incomeCategories[0].id,
        type: 'INCOME',
        amount: 12000000,
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
        amount: 250000,
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
        amount: 150000,
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
        amount: 500000,
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
        amount: 1500000,
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
        amount: 3000000,
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
        amount: 200000,
        description: 'Nonton Film',
        date: new Date(now.getFullYear(), now.getMonth(), 15),
      },
    }),
    prisma.transaction.create({
      data: {
        userId: demoUser.id,
        accountId: accounts[0].id,
        accountId: accounts[0].id,
        categoryId: expenseCategories[3].id,
        type: 'EXPENSE',
        amount: 350000,
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
        amount: 2000000,
        spent: 250000,
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
        amount: 500000,
        spent: 150000,
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
        amount: 1000000,
        spent: 500000,
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
        targetAmount: 25000000,
        currentAmount: 8500000,
        deadline: new Date(now.getFullYear() + 1, 5, 1),
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
        name: 'Beli Laptop Baru',
        targetAmount: 15000000,
        currentAmount: 7000000,
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
        targetAmount: 30000000,
        currentAmount: 18000000,
        deadline: new Date(now.getFullYear() + 2, 0, 1),
        icon: 'shield',
        color: '#F59E0B',
        status: 'ACTIVE',
        isLocked: true,
        source: 'MANUAL',
      },
    }),
  ]);

  console.log('Created', goals.length, 'goals');

  await Promise.all([
    prisma.goalContribution.create({
      data: {
        goalId: goals[0].id,
        amount: 5000000,
        date: new Date(now.getFullYear(), now.getMonth() - 1, 15),
        note: 'Tabungan bulanan',
        accountId: accounts[0].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[0].id,
        amount: 3500000,
        date: new Date(now.getFullYear(), now.getMonth(), 10),
        note: 'Bonus proyek',
        accountId: accounts[0].id,
      },
    }),
    prisma.goalContribution.create({
      data: {
        goalId: goals[1].id,
        amount: 7000000,
        date: new Date(now.getFullYear(), now.getMonth(), 5),
        note: 'Dari tabungan',
        accountId: accounts[0].id,
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
        targetAmount: 21000000,
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
        targetAmount: 42000000,
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
        targetAmount: 70000000,
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