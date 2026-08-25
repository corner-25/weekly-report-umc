/**
 * Sao lưu bảng trước khi script sửa dữ liệu hàng loạt.
 *
 * Mọi script dọn dữ liệu đều có `--confirm`, nhưng khi đã ghi thì không lùi
 * được. Một lỗi trong script trích lại đã xoá mất hai tuần dữ liệu và phải chạy
 * lại từ OneDrive vài tiếng mới khôi phục — nếu có bản sao thì chỉ mất vài giây.
 *
 * Không dùng `pg_dump` vì nó cần binary cùng phiên bản với server, hay lệch khi
 * chạy trên máy khác. Ở đây sao chép sang bảng cùng database bằng
 * `CREATE TABLE AS` — nhanh, không cần công cụ ngoài, và khôi phục được bằng
 * một câu lệnh.
 */
import type { PrismaClient } from '@prisma/client';

/** Tiền tố tên bảng sao lưu, để dễ nhận ra và dọn sau. */
const BACKUP_PREFIX = 'backup_';

/** Bản sao cũ hơn ngần này ngày thì có thể dọn. */
export const BACKUP_RETENTION_DAYS = 7;

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
}

export interface BackupResult {
  tableName: string;
  rowCount: number;
}

/**
 * Sao chép một bảng sang bảng mới mang dấu thời gian.
 *
 * Trả về tên bảng sao lưu để script in ra cho người dùng biết đường khôi phục.
 */
export async function backupTable(
  db: PrismaClient,
  sourceTable: string,
  label: string,
): Promise<BackupResult> {
  // Tên bảng không đến từ người dùng — script tự truyền hằng số — nhưng vẫn
  // chặn ký tự lạ để câu lệnh không bao giờ thành đường tiêm mã.
  if (!/^[a-z_][a-z0-9_]*$/i.test(sourceTable)) {
    throw new Error(`Tên bảng không hợp lệ: ${sourceTable}`);
  }
  if (!/^[a-z0-9_]+$/i.test(label)) {
    throw new Error(`Nhãn không hợp lệ: ${label}`);
  }

  const tableName = `${BACKUP_PREFIX}${sourceTable}_${label}_${timestamp()}`;

  await db.$executeRawUnsafe(
    `CREATE TABLE "${tableName}" AS SELECT * FROM "${sourceTable}"`,
  );

  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM "${tableName}"`,
  );

  return { tableName, rowCount: Number(rows[0].count) };
}

/**
 * Sao lưu nhiều bảng và in hướng dẫn khôi phục.
 *
 * Gọi ngay trước khi ghi, sau khi người dùng đã xác nhận — không sao lưu ở chế
 * độ chạy thử vì lúc đó không có gì thay đổi.
 */
export async function backupBeforeWrite(
  db: PrismaClient,
  tables: readonly string[],
  label: string,
): Promise<BackupResult[]> {
  const results: BackupResult[] = [];

  for (const table of tables) {
    const result = await backupTable(db, table, label);
    results.push(result);
    console.log(
      `  đã sao lưu ${table} → ${result.tableName} (${result.rowCount.toLocaleString('vi-VN')} dòng)`,
    );
  }

  console.log('\n  Khôi phục nếu cần:');
  for (const r of results) {
    const original = r.tableName
      .replace(new RegExp(`^${BACKUP_PREFIX}`), '')
      .replace(new RegExp(`_${label}_\\d{14}$`), '');
    console.log(
      `    TRUNCATE "${original}"; INSERT INTO "${original}" SELECT * FROM "${r.tableName}";`,
    );
  }
  console.log(
    `\n  Bản sao giữ trong database; dọn khi không cần bằng DROP TABLE.\n`,
  );

  return results;
}

/** Liệt kê bản sao đang có, kèm tuổi tính bằng ngày. */
export async function listBackups(
  db: PrismaClient,
): Promise<Array<{ tableName: string; ageDays: number }>> {
  const rows = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE ${`${BACKUP_PREFIX}%`}
    ORDER BY tablename DESC
  `;

  const now = Date.now();
  return rows.map((r) => {
    // Dấu thời gian nằm ở 14 ký tự cuối: YYYYMMDDHHmmss
    const stamp = r.tablename.slice(-14);
    const parsed = /^\d{14}$/.test(stamp)
      ? Date.parse(
          `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T` +
            `${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}Z`,
        )
      : NaN;

    return {
      tableName: r.tablename,
      ageDays: Number.isNaN(parsed) ? -1 : Math.floor((now - parsed) / 86_400_000),
    };
  });
}
