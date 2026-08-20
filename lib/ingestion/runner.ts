import { prisma } from '@/lib/prisma';
import { getConnector } from './registry';
import type { LogLevel, SyncContext, SyncRunSummary, SyncTrigger } from './types';

/** Số dòng log tối đa ghi cho một lần chạy, chặn nguồn lỗi làm ngập bảng. */
const MAX_LOGS_PER_RUN = 500;

/** Thông điệp khi nguồn chưa có connector tương ứng trong registry. */
const NO_CONNECTOR = 'Chưa có connector cho nguồn này';

/**
 * Chạy đồng bộ một nguồn: fetch → so checksum → parse → upsert.
 *
 * Luôn trả về summary, kể cả khi thất bại — lỗi được ghi vào SyncRun và SyncLog
 * chứ không ném ra ngoài, để một nguồn hỏng không chặn các nguồn còn lại.
 */
export async function runSource(
  sourceId: string,
  trigger: SyncTrigger,
  options: { force?: boolean } = {},
): Promise<SyncRunSummary> {
  const startedAt = Date.now();

  const source = await prisma.syncSource.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new Error(`Không tìm thấy nguồn "${sourceId}"`);
  }

  const connector = getConnector(sourceId);
  const run = await prisma.syncRun.create({
    data: { sourceId, trigger, status: 'RUNNING' },
  });

  const base = {
    sourceId,
    sourceName: source.name,
    runId: run.id,
    rowsRead: 0,
    rowsUpserted: 0,
    rowsSkipped: 0,
  };

  if (!connector) {
    await finishRun(run.id, 'FAILED', base, NO_CONNECTOR);
    return { ...base, status: 'FAILED', durationMs: Date.now() - startedAt, errorMessage: NO_CONNECTOR };
  }

  let logCount = 0;
  const ctx: SyncContext = {
    runId: run.id,
    source,
    prisma,
    trigger,
    async log(level: LogLevel, message: string, context?: unknown) {
      if (logCount >= MAX_LOGS_PER_RUN) return;
      logCount += 1;

      const capped = logCount === MAX_LOGS_PER_RUN;
      await prisma.syncLog.create({
        data: {
          runId: run.id,
          level: capped ? 'warn' : level,
          message: capped ? `Đã đạt giới hạn ${MAX_LOGS_PER_RUN} dòng log, các dòng sau bị bỏ qua` : message,
          context: context === undefined ? undefined : (context as object),
        },
      });
    },
  };

  try {
    const { raw, checksum } = await connector.fetch(ctx);

    // Nguồn không đổi từ lần chạy thành công trước → bỏ qua, không ghi lại DB.
    if (!options.force && checksum === source.lastChecksum) {
      await ctx.log('info', 'Nguồn không thay đổi, bỏ qua lần chạy này');
      await finishRun(run.id, 'SKIPPED', base);
      await prisma.syncSource.update({
        where: { id: sourceId },
        data: { lastRunAt: new Date() },
      });
      return { ...base, status: 'SKIPPED', durationMs: Date.now() - startedAt };
    }

    const rows = await connector.parse(raw, ctx);
    const { upserted, skipped } = await connector.upsert(rows, ctx);

    const counts = { ...base, rowsRead: rows.length, rowsUpserted: upserted, rowsSkipped: skipped };
    await finishRun(run.id, 'SUCCESS', counts);
    await prisma.syncSource.update({
      where: { id: sourceId },
      data: { lastRunAt: new Date(), lastSuccessAt: new Date(), lastChecksum: checksum },
    });

    return { ...counts, status: 'SUCCESS', durationMs: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';

    // Log lỗi là best-effort: nếu chính DB đang hỏng thì vẫn phải trả summary.
    await ctx.log('error', message, { stack: error instanceof Error ? error.stack : undefined }).catch(() => {});
    await finishRun(run.id, 'FAILED', base, message).catch(() => {});
    await prisma.syncSource
      .update({ where: { id: sourceId }, data: { lastRunAt: new Date() } })
      .catch(() => {});

    return { ...base, status: 'FAILED', durationMs: Date.now() - startedAt, errorMessage: message };
  }
}

/**
 * Chạy tuần tự mọi nguồn đang bật cron.
 *
 * Tuần tự chứ không song song: các connector đọc file Excel lớn vào bộ nhớ,
 * chạy song song dễ vượt giới hạn RAM của container.
 */
export async function runAllEnabled(trigger: SyncTrigger): Promise<SyncRunSummary[]> {
  const sources = await prisma.syncSource.findMany({
    where: { cronEnabled: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  const summaries: SyncRunSummary[] = [];
  for (const { id } of sources) {
    summaries.push(await runSource(id, trigger));
  }
  return summaries;
}

async function finishRun(
  runId: string,
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
  counts: { rowsRead: number; rowsUpserted: number; rowsSkipped: number },
  errorMessage?: string,
): Promise<void> {
  await prisma.syncRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
      rowsRead: counts.rowsRead,
      rowsUpserted: counts.rowsUpserted,
      rowsSkipped: counts.rowsSkipped,
      errorMessage,
    },
  });
}
