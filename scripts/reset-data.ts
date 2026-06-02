import { prisma } from '../src/config/prisma.js';

async function resetData() {
  console.log('🧹 Resetting budget and transaction data...\n');

  try {
    await prisma.transactionTag.deleteMany({});
    console.log('✓ Deleted transaction tags');

    await prisma.transaction.deleteMany({});
    console.log('✓ Deleted transactions');

    await prisma.budget.deleteMany({});
    console.log('✓ Deleted budgets');

    console.log('\n✅ Reset complete! Ready for fresh testing.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetData();