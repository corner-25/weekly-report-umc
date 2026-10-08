/**
 * Nạp danh sách khách khám chữa bệnh (khách VIP Phòng HC dẫn khám) vào CRM:
 * mỗi khách một người liên hệ hạng VIP, mỗi buổi dẫn khám một lượt "Dẫn khách VIP khám".
 *
 *   python3 tools/crm-import/khach_kcb_to_json.py "DANH SACH KHACH KCB 2026.xlsx" /tmp/kcb.json
 *   npx tsx prisma/import-crm-khach-kcb.ts /tmp/kcb.json [--dry-run]
 *
 * Chạy lại được: khách khớp theo mã hồ sơ bệnh án (hoặc tên + ngày sinh), buổi khám
 * khớp theo mã "KCB:<mã hồ sơ>:<ngày>". Hạng, người phụ trách, ghi chú Phòng HC tự
 * sửa trên CRM không bị ghi đè; chỉ bổ sung thông tin còn trống.
 */
import { readFileSync } from 'fs';
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { toSearchKey } from '@/lib/crm/constants';
import { buildVisits, type Patient, type RawVisitRow, type Visit } from '@/lib/crm/vip-visit-import';

const prisma = new PrismaClient();
const TAG = 'Khách khám bệnh';
const STAFF = 'Phòng Hành chính';
const SESSION_HOUR: Record<string, string> = { Sáng: '08:00', Chiều: '13:30', 'Sáng - chiều': '08:00' };

const vnDay = (iso: string) => iso.split('-').reverse().join('/');

function visitFields(v: Visit, source: string) {
  const specialties = [...new Set(v.items.map((i) => i.specialty).filter((s): s is string => Boolean(s)))];
  const services = [...new Set(v.items.flatMap((i) => i.services))];
  const followUps = v.items
    .map((i) => {
      const when = i.followUp.date ? vnDay(i.followUp.date) : i.followUp.text;
      return when ? `${i.specialty ? `${i.specialty}: ` : ''}${when}` : null;
    })
    .filter(Boolean);
  const nextDate = v.items.map((i) => i.followUp.date).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
  // Nội dung hiện cho mọi người dùng CRM — không có chẩn đoán.
  const content = [
    v.visitKind,
    v.items.map((i) => [i.specialty, i.doctor && `BS ${i.doctor}`].filter(Boolean).join(' — ')).filter(Boolean).join('; '),
    services.length ? `Dịch vụ: ${services.join(', ')}` : null,
  ].filter(Boolean).join(' · ') || 'Dẫn khách khám';
  return {
    type: 'VIP_ESCORT' as const,
    status: 'DONE' as const,
    occurredAt: new Date(`${v.date}T${SESSION_HOUR[v.session ?? ''] ?? '08:00'}:00+07:00`),
    timeText: v.session,
    title: specialties.length ? `Dẫn khám ${specialties.join(', ')}` : 'Dẫn khách khám',
    content,
    destination: specialties.join(', ') || null,
    services,
    staffName: STAFF,
    referrer: v.referrer,
    visitKind: v.visitKind,
    followUp: followUps.join('; ') || null,
    followUpDate: nextDate ? new Date(`${nextDate}T00:00:00+07:00`) : null,
    visitItems: v.items as unknown as Prisma.InputJsonValue,
    note: v.note,
    needsReview: v.needsReview,
    reviewNote: v.reviewNotes.join('\n') || null,
    sourceRef: `${source} | dòng ${v.rows.join(', ')}`,
  };
}

function contactNote(p: Patient): string | null {
  const parts = [
    ...p.notes,
    p.variants.length ? `Trong file còn ghi: ${p.variants.join('; ')}` : null,
    p.birth.incomplete ? 'Ngày sinh trong file ghi thiếu năm' : null,
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : null;
}

async function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  if (!file) throw new Error('Cần đường dẫn file JSON (xem đầu file)');
  const { source, rows } = JSON.parse(readFileSync(file, 'utf8')) as { source: string; rows: RawVisitRow[] };
  const { patients, visits, skipped } = buildVisits(rows);
  console.log(`${rows.length} dòng → ${patients.length} khách, ${visits.length} buổi dẫn khám; bỏ ${skipped.length} dòng: ${skipped.map((s) => `${s.row} (${s.reason})`).join(', ')}`);
  console.log(`Cần xem lại: ${visits.filter((v) => v.needsReview).length} buổi, ${patients.filter((p) => p.variants.length || p.birth.incomplete).length} khách`);
  if (dryRun) return;

  const contactId = new Map<string, string>();
  let created = 0;
  let updated = 0;
  for (const p of patients) {
    const existing =
      (p.recordNo && (await prisma.crmContact.findFirst({ where: { patientCode: p.recordNo }, select: { id: true, note: true, phone: true, address: true, birthYear: true, tags: true } }))) ||
      // Khách không có mã hồ sơ đã nạp từ chính file này ở lần trước (để chạy lại không tạo trùng).
      (!p.recordNo &&
        (await prisma.crmContact.findFirst({
          where: { fullName: p.fullName, patientCode: null, source: { startsWith: 'Danh sách khách KCB' } },
          select: { id: true, note: true, phone: true, address: true, birthYear: true, tags: true },
        }))) ||
      // Không có mã hồ sơ: chỉ nhận người đã có khi trùng tên và đủ ngày sinh — trùng tên không đủ để là một người.
      (p.birth.day && p.birth.month && p.birth.year
        ? await prisma.crmContact.findFirst({
        where: { searchKey: { startsWith: toSearchKey(p.fullName) }, birthDay: p.birth.day, birthMonth: p.birth.month, birthYear: p.birth.year },
        select: { id: true, note: true, phone: true, address: true, birthYear: true, tags: true },
      })
        : null);
    if (existing) {
      await prisma.crmContact.update({
        where: { id: existing.id },
        data: {
          patientCode: p.recordNo,
          ...(!existing.phone && p.phone ? { phone: p.phone } : {}),
          ...(!existing.address && p.address ? { address: p.address } : {}),
          ...(!existing.birthYear && p.birth.year ? { birthYear: p.birth.year } : {}),
          ...(!existing.note && contactNote(p) ? { note: contactNote(p) } : {}),
          tags: [...new Set([...existing.tags, TAG])],
        },
      });
      contactId.set(p.key, existing.id);
      updated += 1;
      continue;
    }
    const c = await prisma.crmContact.create({
      data: {
        fullName: p.fullName,
        searchKey: toSearchKey(p.fullName, p.phone),
        birthDay: p.birth.day,
        birthMonth: p.birth.month,
        birthYear: p.birth.year,
        phone: p.phone,
        address: p.address,
        patientCode: p.recordNo,
        tier: 'VIP',
        tags: [TAG],
        source: `Danh sách khách KCB (${source})`,
        note: contactNote(p),
      },
      select: { id: true },
    });
    contactId.set(p.key, c.id);
    created += 1;
  }

  let visitsCreated = 0;
  let visitsUpdated = 0;
  for (const v of visits) {
    const fields = { ...visitFields(v, source), contactId: contactId.get(v.patientKey)! };
    const existing = await prisma.crmInteraction.findUnique({ where: { externalCode: v.externalCode }, select: { id: true } });
    if (existing) {
      await prisma.crmInteraction.update({ where: { id: existing.id }, data: fields });
      visitsUpdated += 1;
    } else {
      await prisma.crmInteraction.create({ data: { ...fields, externalCode: v.externalCode } });
      visitsCreated += 1;
    }
  }
  console.log(`Khách: ${created} mới, ${updated} đã có. Buổi dẫn khám: ${visitsCreated} mới, ${visitsUpdated} cập nhật.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
