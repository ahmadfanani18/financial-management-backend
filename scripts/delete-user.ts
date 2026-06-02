import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'fananiapps@gmail.com';

  console.log(`Mencari user dengan email: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: true,
      categories: true,
      tags: true,
      transactions: true,
      budgets: true,
      goals: true,
      plans: true,
      reminders: true,
      notifications: true,
      payments: true,
      subscriptions: true,
    },
  });

  if (!user) {
    console.log('User tidak ditemukan.');
    return;
  }

  console.log(`User ditemukan: ${user.name} (${user.id})`);
  console.log(`Akan menghapus ${user.transactions.length} transactions, ${user.accounts.length} accounts, dll...`);

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.reminder.deleteMany({ where: { userId: user.id } }),
    prisma.plan.deleteMany({ where: { userId: user.id } }),
    prisma.goal.deleteMany({ where: { userId: user.id } }),
    prisma.budget.deleteMany({ where: { userId: user.id } }),
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
    prisma.tag.deleteMany({ where: { userId: user.id } }),
    prisma.category.deleteMany({ where: { userId: user.id } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.payment.deleteMany({ where: { userId: user.id } }),
    prisma.subscription.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  console.log('User dan semua data terkait berhasil dihapus!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });