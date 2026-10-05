/**
 * Ghi một lượt tương tác — dùng chung cho tạo mới và sửa.
 *
 * Khách/đơn vị gõ mới trong modal được tạo hồ sơ luôn, để lần sau chọn lại được
 * và dòng thời gian của họ có lượt này. Khách mới gắn vào đơn vị nếu có.
 */
import { prisma } from '@/lib/prisma';
import type { InteractionInput } from '@/lib/crm/schemas';
import { HttpError, interactionInclude, resolveContact, resolveOrganization, toInteractionDto, CRM_TRANSACTION } from '@/lib/crm/server';

export async function saveInteraction(data: InteractionInput, options: { id?: string; createdById?: string }) {
  const {
    contactId, newContactName, newContactPhone, organizationId, organizationName, participantIds, occurredAt, ...fields
  } = data;

  const saved = await prisma.$transaction(async (tx) => {
    const orgId = await resolveOrganization(tx, { organizationId, organizationName });
    const mainContactId = await resolveContact(tx, { contactId, newContactName, newContactPhone }, orgId);

    // Thành viên đoàn: bỏ trùng và bỏ chính trưởng đoàn.
    const members = [...new Set(participantIds)].filter((pid) => pid !== mainContactId);
    if (members.length > 0) {
      const found = await tx.crmContact.count({ where: { id: { in: members } } });
      if (found !== members.length) throw new HttpError(400, 'Có thành viên đoàn không còn trong danh bạ');
    }

    // Khoa/phòng chủ trì chọn từ danh mục: kiểm tra còn tồn tại, lấy tên chuẩn.
    const host = fields.hostDepartmentId
      ? await tx.department.findFirst({ where: { id: fields.hostDepartmentId, deletedAt: null }, select: { id: true, name: true } })
      : null;
    if (fields.hostDepartmentId && !host) throw new HttpError(400, 'Khoa/phòng chủ trì đã chọn không còn trong danh mục');

    const values = {
      ...fields,
      title: fields.title ?? null,
      destination: fields.destination ?? null,
      patientName: fields.patientName ?? null,
      guestCount: fields.guestCount ?? null,
      purpose: fields.purpose ?? null,
      note: fields.note ?? null,
      endAt: fields.endAt ? new Date(`${fields.endAt}T00:00:00+07:00`) : null,
      timeText: fields.timeText ?? null,
      incomingDocNo: fields.incomingDocNo ?? null,
      hostDepartmentId: host?.id ?? null,
      hostUnit: host?.name ?? fields.hostUnit ?? null,
      hospitalAttendees: fields.hospitalAttendees ?? null,
      guestMembers: fields.guestMembers ?? null,
      giftsGiven: fields.giftsGiven ?? null,
      giftsReceived: fields.giftsReceived ?? null,
      cashReceived: fields.cashReceived ?? null,
      giftBudget: fields.giftBudget ?? null,
      giftActualCost: fields.giftActualCost ?? null,
      reviewNote: fields.reviewNote ?? null,
      // Người đi cùng không trùng người dẫn chính.
      companions: [...new Set(fields.companions)].filter((name) => name !== fields.staffName),
      occurredAt: new Date(occurredAt),
      contactId: mainContactId,
      organizationId: orgId,
    };

    if (options.id) {
      // Lượt nạp từ sổ không có ngày: người dùng đặt ngày khác thì coi như đã có ngày thật.
      const before = await tx.crmInteraction.findUnique({ where: { id: options.id }, select: { occurredAt: true, dateUnknown: true } });
      const dateUnknown = Boolean(before?.dateUnknown && before.occurredAt.getTime() === values.occurredAt.getTime());
      await tx.crmInteractionParticipant.deleteMany({ where: { interactionId: options.id } });
      return tx.crmInteraction.update({
        where: { id: options.id },
        data: { ...values, dateUnknown, participants: { create: members.map((cid) => ({ contactId: cid })) } },
        include: interactionInclude,
      });
    }
    return tx.crmInteraction.create({
      data: {
        ...values,
        createdById: options.createdById ?? null,
        participants: { create: members.map((cid) => ({ contactId: cid })) },
      },
      include: interactionInclude,
    });
  }, CRM_TRANSACTION);

  return toInteractionDto(saved);
}
