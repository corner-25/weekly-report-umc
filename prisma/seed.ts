import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Tạo user mẫu
  const passwordHash = await hash('123456', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin',
    },
  });

  console.log('✓ Created user:', user.email);

  console.log('');
  console.log('✅ Seed completed!');
  console.log('');
  console.log('📧 Email: admin@example.com');
  console.log('🔑 Password: 123456');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
