import { prisma } from '../src/config/prisma.js';

async function resetAll() {
  console.log('🧹 Full reset - Transaction, Budget, & Account Balance\n');

  try {
    await prisma.transactionTag.deleteMany({});
    console.log('✓ Deleted transaction tags');

    await prisma.transaction.deleteMany({});
    console.log('✓ Deleted transactions');

    await prisma.budget.deleteMany({});
    console.log('✓ Deleted budgets');

    await prisma.account.updateMany({
      data: { balance: 0 },
    });
    console.log('✓ Reset all account balances to 0');

    console.log('\n✅ Full reset complete! All accounts now have balance = 0');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAll();