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

  // Tạo các phòng ban mẫu
  const departments = [
    { name: 'Phòng Kế hoạch Tổng hợp', description: 'Quản lý kế hoạch và tổng hợp' },
    { name: 'Phòng Điều dưỡng', description: 'Quản lý điều dưỡng và chăm sóc bệnh nhân' },
    { name: 'Phòng KHĐT', description: 'Khoa học đào tạo' },
    { name: 'Phòng QLCL BV', description: 'Quản lý chất lượng bệnh viện' },
    { name: 'Phòng Tài chính Kế toán', description: 'Quản lý tài chính' },
    { name: 'Phòng Hành chính Quản trị', description: 'Hành chính tổng hợp' },
    { name: 'Phòng Tổ chức Cán bộ', description: 'Quản lý nhân sự' },
    { name: 'Phòng Vật tư Thiết bị', description: 'Quản lý vật tư y tế' },
    { name: 'Phòng Khám bệnh', description: 'Khám và điều trị ngoại trú' },
    { name: 'Phòng Xét nghiệm', description: 'Xét nghiệm y học' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
  }

  console.log(`✓ Created ${departments.length} departments`);

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
