/**
 * Chạy connector báo cáo bệnh viện tới khi không còn phòng nào cần nạp lại.
 *
 * Dùng một lần sau khi sửa lỗi lệch tuần (tuần 35-39 nạp từ bản chép sheet
 * tuần trước). Mỗi lần chạy giới hạn 42 lượt nạp phòng nên lặp tối đa 4 lần.
 *
 * Chạy: npx tsx prisma/rerun-hospital-import.ts
 */
import 'dotenv/config';
import { runSource } from '@/lib/ingestion/runner';

const MAX_PASSES = 8;
/** Chờ trước khi thử lại sau lần chạy lỗi — thường là mạng chập chờn. */
const RETRY_DELAY_MS = 30_000;

(async () => {
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const summary = await runSource('hospital-ai-import', 'manual', { force: true }).catch((error: unknown) => {
      console.error(`Lần ${pass}: lỗi ngoài runner —`, error instanceof Error ? error.message : error);
      return null;
    });
    if (summary) {
      console.info(`Lần ${pass}: ${summary.status} · nạp ${summary.rowsUpserted} · bỏ qua ${summary.rowsSkipped}`);
      if (summary.status === 'SUCCESS' && summary.rowsUpserted === 0) break;
      if (summary.status === 'SUCCESS') continue;
    }
    // Phòng nạp xong đã có dấu nên lần sau tự bỏ qua — thử lại là an toàn.
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
