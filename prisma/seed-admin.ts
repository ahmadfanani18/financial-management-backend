import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('Checking admin user...');

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!existingAdmin) {
    const hashedPassword = await hashPassword('admin123');
    await prisma.user.create({
      data: {
        email: 'admin@finova.app',
        name: 'Admin Finova',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log('Created admin user: admin@finova.app (password: admin123)');
  } else {
    console.log('Admin user already exists:', existingAdmin.email);
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });