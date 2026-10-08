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
    contactId, newContactName, newContactPhone, organizationId, organizationName, participantIds, occurredAt, referrerContactId, newReferrerName, relatedVipContactId, vipRelationship, doctors, autoCreatePlannedEscort, ...fields
  } = data;

  const saved = await prisma.$transaction(async (tx) => {
    const orgId = await resolveOrganization(tx, { organizationId, organizationName });
    const mainContactId = await resolveContact(tx, { contactId, newContactName, newContactPhone }, orgId);

    const referralId = referrerContactId === undefined && !newReferrerName ? undefined
      : await resolveContact(tx, { contactId: referrerContactId ?? undefined, newContactName: newReferrerName }, null);
    const vipId = relatedVipContactId === undefined ? undefined
      : await resolveContact(tx, { contactId: relatedVipContactId ?? undefined }, null);
    if (referralId && referralId === mainContactId) throw new HttpError(400, 'Khách không thể tự giới thiệu chính mình');
    if (vipId && vipId === mainContactId) throw new HttpError(400, 'Khách và VIP liên quan phải là hai người khác nhau');
    if (vipId && !vipRelationship) throw new HttpError(400, 'Chọn quan hệ với VIP');
    const doctorIds: string[] = [];
    for (const doctor of doctors ?? []) {
      const id = await resolveContact(tx, { contactId: doctor.id, newContactName: doctor.newName }, null);
      if (id && !doctorIds.includes(id)) doctorIds.push(id);
    }
    if (options.id && doctors !== undefined) await tx.crmVisitDoctor.deleteMany({ where: { interactionId: options.id } });

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
      ...(referralId !== undefined && { referrerContactId: referralId, referrer: referralId ? (await tx.crmContact.findUniqueOrThrow({ where: { id: referralId }, select: { fullName: true } })).fullName : null }),
      ...(vipId !== undefined && { relatedVipContactId: vipId, vipRelationship: vipId ? vipRelationship : null }),
      ...(doctors !== undefined && { doctors: { create: doctorIds.map(contactId => ({ contactId })) } }),
      title: fields.title ?? null,
      destination: fields.destination ?? null,
      patientName: fields.patientName ?? null,
      guestCount: fields.guestCount ?? null,
      purpose: fields.purpose ?? null,
      note: fields.note ?? null,
      followUp: fields.followUp ? fields.followUp.trim() : null,
      followUpDate: fields.followUpDate && fields.followUpDate.trim() ? new Date(fields.followUpDate) : null,
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

    let result;
    if (options.id) {
      // Lượt nạp từ sổ không có ngày: người dùng đặt ngày khác thì coi như đã có ngày thật.
      const before = await tx.crmInteraction.findUnique({ where: { id: options.id }, select: { occurredAt: true, dateUnknown: true } });
      const dateUnknown = Boolean(before?.dateUnknown && before.occurredAt.getTime() === values.occurredAt.getTime());
      await tx.crmInteractionParticipant.deleteMany({ where: { interactionId: options.id } });
      result = await tx.crmInteraction.update({
        where: { id: options.id },
        data: { ...values, dateUnknown, participants: { create: members.map((cid) => ({ contactId: cid })) } },
        include: interactionInclude,
      });
    } else {
      result = await tx.crmInteraction.create({
        data: {
          ...values,
          createdById: options.createdById ?? null,
          participants: { create: members.map((cid) => ({ contactId: cid })) },
        },
        include: interactionInclude,
      });
    }

    // Tự động lên lịch đón tiếp (PLANNED) vào ngày hẹn nếu được chọn (vd: 2 ngày nữa quay lại chụp MRI)
    if (autoCreatePlannedEscort && values.followUpDate && mainContactId) {
      const dayStart = new Date(values.followUpDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(values.followUpDate);
      dayEnd.setHours(23, 59, 59, 999);
      const existingPlanned = await tx.crmInteraction.findFirst({
        where: {
          contactId: mainContactId,
          status: 'PLANNED',
          occurredAt: { gte: dayStart, lte: dayEnd },
        },
      });
      if (!existingPlanned) {
        const plannedTitle = fields.followUp
          ? `Đón tiếp: ${fields.followUp}`
          : 'Tiếp đón & dẫn khách theo lịch hẹn';
        await tx.crmInteraction.create({
          data: {
            type: 'VIP_ESCORT',
            status: 'PLANNED',
            occurredAt: values.followUpDate,
            contactId: mainContactId,
            organizationId: orgId,
            patientName: values.patientName,
            destination: values.destination,
            title: plannedTitle,
            content: `Lịch hẹn tiếp đón khách theo dặn dò của đợt khám ngày ${new Date(occurredAt).toLocaleDateString('vi-VN')}: ${fields.followUp ?? 'Tái khám / Chụp MRI'}.`,
            referrerContactId: referralId ?? null,
            referrer: referralId ? (await tx.crmContact.findUnique({ where: { id: referralId }, select: { fullName: true } }))?.fullName ?? null : null,
            relatedVipContactId: vipId ?? null,
            vipRelationship: vipId ? vipRelationship : null,
            staffName: values.staffName,
            createdById: options.createdById ?? null,
            doctors: { create: doctorIds.map((cId) => ({ contactId: cId })) },
          },
        });
      }
    }

    return result;
  }, CRM_TRANSACTION);

  return toInteractionDto(saved);
}
