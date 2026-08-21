/**
 * Seed khai báo các nguồn dữ liệu cho ingestion layer.
 *
 * Chạy được nhiều lần (upsert). Không ghi đè `cronEnabled`, `lastChecksum` và
 * các mốc thời gian nếu nguồn đã tồn tại — đó là trạng thái vận hành, không
 * phải cấu hình khai báo.
 *
 * Chạy: npx tsx prisma/seed-sync-sources.ts
 */
import { PrismaClient, SyncSourceKind, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface SourceSeed {
  id: string;
  name: string;
  kind: SyncSourceKind;
  config: Prisma.InputJsonObject;
  /** Bật cron ngay khi tạo mới. Nguồn chưa có connector thì để false. */
  cronEnabled: boolean;
}

const SOURCES: SourceSeed[] = [
  {
    id: 'dept-report-onedrive',
    name: 'Báo cáo phòng (OneDrive)',
    kind: SyncSourceKind.ONEDRIVE_SHARE,
    config: {
      shareUrlEnv: 'ONEDRIVE_DEPT_REPORT_SHARE_URL',
      // Năm của workbook. Để null thì connector suy từ tên file; nếu không suy
      // được sẽ báo lỗi thay vì đoán — xem docs/INGESTION-REFACTOR.md mục 3.2.
      year: null,
    },
    cronEnabled: false, // Giai đoạn 3
  },
  {
    id: 'hospital-report-onedrive',
    // Luồng CŨ: chỉ tách sheet rồi xếp hàng chờ người duyệt qua AiReportImportPanel.
    // Giữ làm dự phòng; luồng chính nay là 'hospital-ai-import'.
    name: 'Báo cáo bệnh viện (xếp hàng chờ duyệt thủ công)',
    kind: SyncSourceKind.ONEDRIVE_SHARE,
    config: {
      shareUrlEnv: 'ONEDRIVE_HOSPITAL_REPORT_SHARE_URL',
      year: null,
    },
    cronEnabled: false, // Giai đoạn 4
  },
  {
    id: 'hospital-ai-import',
    name: 'Báo cáo bệnh viện — tự động nạp bằng AI',
    kind: SyncSourceKind.ONEDRIVE_SHARE,
    config: {
      shareUrlEnv: 'ONEDRIVE_HOSPITAL_REPORT_SHARE_URL',
      // Đặt false khi chỉ muốn khớp nhiệm vụ, chưa cần trích số liệu.
      extractMetrics: true,
    },
    cronEnabled: false, // bật sau khi đã gom nghiệp vụ cho đủ 14 phòng
  },
  {
    id: 'fleet-google-sheets',
    name: 'Dữ liệu đội xe (Google Sheets)',
    kind: SyncSourceKind.GOOGLE_SHEETS,
    config: {
      // Thay cho manual_fleet_sync.py trong repo UMC-APP/PHONGHC/umc-dashboard:
      // đọc thẳng Sheets, không đi vòng qua GitHub nữa.
      spreadsheetId: '1sYzuvnv-lzQcv-IZjT672LTpfUrqdWCesx4pW8mIuqM',
      credentialsEnv: 'GOOGLE_SERVICE_ACCOUNT_JSON',
      // Mỗi sheet là một xe; tên sheet chính là biển số.
      sheetIsVehicleId: true,
    },
    cronEnabled: false, // Giai đoạn 2
  },
  {
    id: 'hc-officeapi',
    name: 'HC OfficeAPI (qua GitHub dashboard-storage — cầu vượt tường lửa)',
    kind: SyncSourceKind.GITHUB_JSON,
    config: {
      owner: 'corner-25',
      repo: 'dashboard-storage',
      path: 'current_dashboard_data.json',
      tokenEnv: 'GITHUB_TOKEN_PHC',
    },
    cronEnabled: false, // Giai đoạn 5
  },
];

async function main() {
  for (const s of SOURCES) {
    const existing = await prisma.syncSource.findUnique({ where: { id: s.id } });

    await prisma.syncSource.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        kind: s.kind,
        config: s.config,
        cronEnabled: s.cronEnabled,
      },
      // Chỉ cập nhật phần khai báo, giữ nguyên trạng thái vận hành.
      update: { name: s.name, kind: s.kind, config: s.config },
    });

    console.log(`${existing ? '↻ cập nhật' : '+ tạo mới'}  ${s.id}`);
  }
  console.log(`\n✓ Xong ${SOURCES.length} nguồn`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
