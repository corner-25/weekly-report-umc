import type { Prisma } from '@prisma/client';
import { HttpError, resolveContact } from './server';
export async function contactLinks(tx: Prisma.TransactionClient, input: { referrerContactId?: string | null; newReferrerName?: string; relatedVipContactId?: string | null; vipRelationship?: string }, selfId?: string) {
  const result: { referrerContactId?: string | null; relatedVipContactId?: string | null; vipRelationship?: string | null } = {};
  if (input.referrerContactId !== undefined || input.newReferrerName) {
    result.referrerContactId = await resolveContact(tx, { contactId: input.referrerContactId ?? undefined, newContactName: input.newReferrerName }, null);
    if (selfId && result.referrerContactId === selfId) throw new HttpError(400, 'Không thể chọn chính khách làm người giới thiệu');
  }
  if (input.relatedVipContactId !== undefined) {
    result.relatedVipContactId = await resolveContact(tx, { contactId: input.relatedVipContactId ?? undefined }, null);
    if (selfId && result.relatedVipContactId === selfId) throw new HttpError(400, 'Không thể chọn quan hệ với chính khách');
    if (result.relatedVipContactId && !input.vipRelationship) throw new HttpError(400, 'Chọn quan hệ với VIP');
    result.vipRelationship = result.relatedVipContactId ? input.vipRelationship : null;
  }
  return result;
}
export const contactLinkInclude = {
  referrerContact: { select: { id: true, fullName: true } },
  relatedVipContact: { select: { id: true, fullName: true } },
} as const;
