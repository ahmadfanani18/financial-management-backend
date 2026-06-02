import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUserData(email: string) {
  console.log(`Deleting data for user: ${email}`);
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found!');
    return;
  }
  
  console.log(`User ID: ${user.id}`);
  const userId = user.id;

  // Delete in order
  try {
    await prisma.notification.deleteMany({ where: { userId } });
    console.log('✓ Deleted notifications');
  } catch (e) { console.log('- notifications skipped'); }

  try {
    await prisma.transactionTag.deleteMany({
      where: { transaction: { userId } }
    });
    console.log('✓ Deleted transaction tags');
  } catch (e) { console.log('- transaction tags skipped'); }

  try {
    await prisma.transaction.deleteMany({ where: { userId } });
    console.log('✓ Deleted transactions');
  } catch (e) { console.log('- transactions skipped'); }

  try {
    await prisma.goalContribution.deleteMany({
      where: { goal: { userId } }
    });
    console.log('✓ Deleted goal contributions');
  } catch (e) { console.log('- goal contributions skipped'); }

  try {
    await prisma.milestone.deleteMany({
      where: { plan: { userId } }
    });
    console.log('✓ Deleted milestones');
  } catch (e) { console.log('- milestones skipped'); }

  try {
    await prisma.plan.deleteMany({ where: { userId } });
    console.log('✓ Deleted plans');
  } catch (e) { console.log('- plans skipped'); }

  try {
    await prisma.goal.deleteMany({ where: { userId } });
    console.log('✓ Deleted goals');
  } catch (e) { console.log('- goals skipped'); }

  try {
    await prisma.account.deleteMany({ where: { userId } });
    console.log('✓ Deleted accounts');
  } catch (e) { console.log('- accounts skipped'); }

  console.log('Done!');
}

deleteUserData('fananiapps@gmail.com')
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
