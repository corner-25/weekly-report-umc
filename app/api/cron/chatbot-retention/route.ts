import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function matches(provided: string, expected: string) {
  const a = Buffer.from(provided); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret');
  if (!expected || !provided || !matches(provided, expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const auditDays = Math.max(7, Number(process.env.CHATBOT_AUDIT_RETENTION_DAYS || 90));
  const proposalDays = Math.max(1, Number(process.env.CHATBOT_PROPOSAL_RETENTION_DAYS || 30));
  const auditBefore = new Date(Date.now() - auditDays * 86_400_000);
  const proposalBefore = new Date(Date.now() - proposalDays * 86_400_000);
  const [logs, proposals] = await prisma.$transaction([
    prisma.chatbotAuditLog.deleteMany({ where: { createdAt: { lt: auditBefore } } }),
    prisma.chatbotActionProposal.deleteMany({ where: { createdAt: { lt: proposalBefore }, status: { not: 'PENDING' } } }),
  ]);
  return NextResponse.json({ deletedAuditLogs: logs.count, deletedProposals: proposals.count, auditBefore, proposalBefore });
}
