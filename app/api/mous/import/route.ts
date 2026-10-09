import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handle } from '@/lib/crm/server';
import { requireImporter } from '@/lib/import-token';
import { importMouRows } from '@/lib/mou/office-import';
import { refreshMouKnowledge } from '@/lib/mou/knowledge-refresh';
import type { OfficeMouDetail, OfficeMouRow } from '@/lib/mou/office';

export const maxDuration = 300;

const bundleSchema = z.object({
  source: z.string().min(1),
  rows: z.array(z.object({ taskID: z.union([z.number(), z.string()]), taskTitle: z.string().min(1) }).passthrough()).min(1),
  details: z.record(z.string(), z.unknown()),
});

/** Nạp danh sách MOU cào từ office (script tools/qlcv-scraper/sync_all.py). Trả mã công việc → id MOU. */
export const POST = handle(async (request: Request) => {
  await requireImporter(request);
  const body = bundleSchema.parse(await request.json());
  const summary = await importMouRows(prisma, {
    source: body.source,
    rows: body.rows as unknown as OfficeMouRow[],
    details: body.details as Record<string, OfficeMouDetail>,
  });
  refreshMouKnowledge();
  return NextResponse.json(summary);
});
