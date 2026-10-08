/**
 * Chuẩn hoá thông tin lãnh đạo / người giới thiệu trong CRM:
 * - Học hàm, học vị (PGS.TS.BS, GS.TS.BS...)
 * - Phân hạng: VIP
 * - Nhãn: Ban Giám đốc / Lãnh đạo Bệnh viện / Người giới thiệu
 * - Chức vụ hiện tại tại Bệnh viện ĐHYD TP.HCM hoặc ĐHYD TP.HCM
 */
import { PrismaClient } from '@prisma/client';
import { toSearchKey } from '../lib/crm/constants';

const prisma = new PrismaClient();

const UMC_HOSPITAL_NAME = 'Bệnh viện Đại học Y Dược TP. Hồ Chí Minh';
const UMC_UNI_NAME = 'Đại học Y Dược TP. Hồ Chí Minh';

interface ReferrerConfig {
  name: string;
  academicTitle: string | null;
  tier: 'VIP';
  tags: string[];
  title: string;
  orgName: string;
}

const REFERRERS: ReferrerConfig[] = [
  {
    name: 'Nguyễn Hoàng Bắc',
    academicTitle: 'PGS.TS.BS.',
    tier: 'VIP',
    tags: ['Ban Giám đốc', 'Người giới thiệu'],
    title: 'Nguyên Giám đốc Bệnh viện',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Trần Diệp Tuấn',
    academicTitle: 'GS.TS.BS.',
    tier: 'VIP',
    tags: ['Lãnh đạo Bệnh viện', 'Người giới thiệu'],
    title: 'Bí thư Đảng uỷ - Chủ tịch Hội đồng trường',
    orgName: UMC_UNI_NAME,
  },
  {
    name: 'Nguyễn Hoàng Định',
    academicTitle: 'GS.TS.BS.',
    tier: 'VIP',
    tags: ['Ban Giám đốc', 'Bác sĩ', 'Người giới thiệu'],
    title: 'Phó Giám đốc Bệnh viện',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Nguyễn Minh Anh',
    academicTitle: 'PGS.TS.BS.',
    tier: 'VIP',
    tags: ['Ban Giám đốc', 'Bác sĩ', 'Người giới thiệu'],
    title: 'Phó Giám đốc Bệnh viện',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Trương Quang Bình',
    academicTitle: 'GS.TS.BS.',
    tier: 'VIP',
    tags: ['Lãnh đạo Bệnh viện', 'Bác sĩ', 'Người giới thiệu'],
    title: 'Nguyên Phó Giám đốc Bệnh viện',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Phạm Văn Tấn',
    academicTitle: 'TS.BS.',
    tier: 'VIP',
    tags: ['Ban Giám đốc', 'Bác sĩ', 'Người giới thiệu'],
    title: 'Phó Giám đốc Bệnh viện',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Võ Tấn Sơn',
    academicTitle: 'PGS.TS.BS.',
    tier: 'VIP',
    tags: ['Lãnh đạo Bệnh viện', 'Bác sĩ', 'Người giới thiệu'],
    title: 'Nguyên Hiệu trưởng',
    orgName: UMC_UNI_NAME,
  },
  {
    name: 'Trần Thanh Hưng',
    academicTitle: 'BSCKII.',
    tier: 'VIP',
    tags: ['Bác sĩ', 'Người giới thiệu'],
    title: 'Bác sĩ chuyên khoa',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Lê Khắc Bảo',
    academicTitle: 'PGS.TS.BS.',
    tier: 'VIP',
    tags: ['Bác sĩ', 'Người giới thiệu'],
    title: 'Giám đốc Trung tâm GD Y khoa',
    orgName: UMC_UNI_NAME,
  },
  {
    name: 'Đặng Vạn Phước',
    academicTitle: 'GS.TS.BS.',
    tier: 'VIP',
    tags: ['Lãnh đạo Bệnh viện', 'Bác sĩ', 'Người giới thiệu'],
    title: 'Cố vấn chuyên môn',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Nguyễn Thị Ngọc Diệu',
    academicTitle: 'ThS.',
    tier: 'VIP',
    tags: ['Cán bộ quản lý', 'Người giới thiệu'],
    title: 'Trưởng phòng Điều dưỡng',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Nguyễn Thị Như Mai',
    academicTitle: 'ThS.',
    tier: 'VIP',
    tags: ['Cán bộ quản lý', 'Người giới thiệu'],
    title: 'Cán bộ quản lý',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Nguyễn Quang Duy',
    academicTitle: 'ThS.BS.',
    tier: 'VIP',
    tags: ['Bác sĩ', 'Người giới thiệu'],
    title: 'Bác sĩ quản lý',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Thái Hoài Nam',
    academicTitle: 'ThS.BS.',
    tier: 'VIP',
    tags: ['Bác sĩ', 'Người giới thiệu'],
    title: 'Bác sĩ',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Nguyễn Thị Hồng Tươi',
    academicTitle: 'TS.',
    tier: 'VIP',
    tags: ['Cán bộ quản lý', 'Người giới thiệu'],
    title: 'Trưởng khoa Dược',
    orgName: UMC_UNI_NAME,
  },
  {
    name: 'Phan Chiến Thắng',
    academicTitle: 'ThS.BS.',
    tier: 'VIP',
    tags: ['Bác sĩ', 'Người giới thiệu'],
    title: 'Bác sĩ',
    orgName: UMC_HOSPITAL_NAME,
  },
  {
    name: 'Lê Thị Giàu',
    academicTitle: null,
    tier: 'VIP',
    tags: ['Khách VIP', 'Người giới thiệu'],
    title: 'Chủ tịch HĐQT',
    orgName: 'Công ty Cổ phần Thực phẩm Bình Tây',
  },
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`Chế độ: ${apply ? 'GHI THẬT (--apply)' : 'XEM TRƯỚC (dry-run)'}`);

  const orgMap = new Map<string, string>();
  for (const ref of REFERRERS) {
    if (!orgMap.has(ref.orgName)) {
      let org = await prisma.crmOrganization.findFirst({ where: { name: ref.orgName } });
      if (!org) {
        if (apply) {
          org = await prisma.crmOrganization.create({
            data: {
              name: ref.orgName,
              normalizedName: ref.orgName.toLowerCase().trim(),
              searchKey: toSearchKey(ref.orgName),
            },
          });
          orgMap.set(ref.orgName, org.id);
        } else {
          orgMap.set(ref.orgName, 'mock-org-id');
        }
      } else {
        orgMap.set(ref.orgName, org.id);
      }
    }
  }

  for (const ref of REFERRERS) {
    const contacts = await prisma.crmContact.findMany({
      where: { fullName: ref.name },
      include: { positions: true },
    });

    if (contacts.length === 0) {
      console.warn(`[!] Không tìm thấy hồ sơ cho "${ref.name}"`);
      continue;
    }

    for (const c of contacts) {
      const mergedTags = [...new Set([...c.tags, ...ref.tags])].filter((t) => t !== 'Đối tác');
      const orgId = orgMap.get(ref.orgName);
      console.log(`- ${ref.academicTitle ? ref.academicTitle + ' ' : ''}${c.fullName} (id: ${c.id})`);
      console.log(`  Tier: ${ref.tier}, Tags: ${JSON.stringify(mergedTags)}`);
      console.log(`  Chức vụ: ${ref.title} @ ${ref.orgName}`);

      if (apply) {
        await prisma.crmContact.update({
          where: { id: c.id },
          data: {
            academicTitle: ref.academicTitle,
            tier: ref.tier,
            tags: mergedTags,
            searchKey: toSearchKey(ref.academicTitle, c.fullName, c.phone),
          },
        });

        // Cập nhật hoặc tạo position
        const currentPos = c.positions.find((p) => p.isCurrent);
        if (currentPos) {
          await prisma.crmPosition.update({
            where: { id: currentPos.id },
            data: {
              title: ref.title,
              organizationId: orgId,
            },
          });
        } else {
          await prisma.crmPosition.create({
            data: {
              contactId: c.id,
              title: ref.title,
              organizationId: orgId,
              isCurrent: true,
            },
          });
        }
      }
    }
  }

  console.log('Hoàn thành chuẩn hoá thông tin người giới thiệu.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

