/**
 * Test tích hợp API CRM trên một Postgres thật.
 *
 * Chỉ chạy khi có CRM_TEST_DATABASE_URL trỏ tới một schema RIÊNG chỉ có bảng crm_*
 * (vd ...?schema=crm_test) — test xoá sạch dữ liệu CRM trong schema đó. TUYỆT ĐỐI
 * không trỏ vào database production.
 *
 *   CRM_TEST_DATABASE_URL='postgresql://...?schema=crm_test' npx vitest run lib/crm/api.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_URL = process.env.CRM_TEST_DATABASE_URL;
const session = vi.hoisted(() => ({
  current: { user: { id: 'u1', email: 'a@x', name: 'Nhân viên khác', role: 'STAFF', departmentId: null } },
}));

vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const run = TEST_URL ? describe : describe.skip;

run('API CRM (tích hợp)', { timeout: 30_000 }, () => {
  let api: Record<string, Record<string, (...args: unknown[]) => Promise<Response>>>;
  let prisma: import('@prisma/client').PrismaClient;

  const call = async (handler: (...args: unknown[]) => Promise<Response>, url: string, body?: unknown, id?: string) => {
    const req = new Request(`http://test${url}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const res = await handler(req, { params: Promise.resolve({ id: id ?? '' }) });
    return { status: res.status, json: await res.json() };
  };

  beforeAll(async () => {
    if (!TEST_URL?.includes('schema=crm_test')) throw new Error('CRM_TEST_DATABASE_URL phải trỏ tới schema crm_test');
    process.env.DATABASE_URL = TEST_URL;
    prisma = (await import('@/lib/prisma')).prisma;
    await prisma.$executeRawUnsafe(
      'TRUNCATE crm_care_tasks, crm_interaction_participants, crm_interactions, crm_important_dates, crm_relations, crm_positions, crm_contacts, crm_organizations CASCADE',
    );
    api = {
      contacts: await import('@/app/api/crm/contacts/route'),
      contact: await import('@/app/api/crm/contacts/[id]/route'),
      orgs: await import('@/app/api/crm/organizations/route'),
      interactions: await import('@/app/api/crm/interactions/route'),
      interaction: await import('@/app/api/crm/interactions/[id]/route'),
      dates: await import('@/app/api/crm/important-dates/route'),
      overview: await import('@/app/api/crm/overview/route'),
      search: await import('@/app/api/crm/search/route'),
      status: await import('@/app/api/crm/interactions/[id]/status/route'),
      positions: await import('@/app/api/crm/contacts/[id]/positions/route'),
      merge: await import('@/app/api/crm/contacts/[id]/merge/route'),
      careTasks: await import('@/app/api/crm/care-tasks/route'),
      careTask: await import('@/app/api/crm/care-tasks/[id]/route'),
      careStatus: await import('@/app/api/crm/care-tasks/[id]/status/route'),
    } as never;
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  let khachId = '';
  let thanhVienId = '';

  it('tạo cá nhân kèm chức vụ và tổ chức mới', async () => {
    const r = await call(api.contacts.POST, '/api/crm/contacts', {
      fullName: 'Nguyễn Văn A', academicTitle: 'PGS.TS.', tier: 'VIP',
      birthDay: 5, birthMonth: 10, birthYear: 1966, ownerName: 'Nguyễn Lương Bảo Châu',
      sensitiveNote: 'Kiêng đồ ngọt', tags: ['Đối tác MOU'],
      currentTitle: 'Giám đốc', currentOrganizationName: '  Bệnh viện   X ',
    });
    expect(r.status).toBe(201);
    khachId = r.json.id;
    const list = await call(api.contacts.GET, '/api/crm/contacts?search=bệnh viện x');
    expect(list.json).toHaveLength(1);
    expect(list.json[0].currentPosition.organization.name).toBe('Bệnh viện X');
  });

  it('từ chối ngày sinh thiếu tháng', async () => {
    const r = await call(api.contacts.POST, '/api/crm/contacts', { fullName: 'B', birthDay: 5 });
    expect(r.status).toBe(400);
    expect(r.json.issues[0].path).toBe('birthMonth');
  });

  it('ẩn lưu ý nhạy cảm với người không phụ trách, hiện với người phụ trách', async () => {
    const other = await call(api.contact.GET, `/api/crm/contacts/${khachId}`, undefined, khachId);
    expect(other.json.canSeeSensitive).toBe(false);
    expect('sensitiveNote' in other.json).toBe(false);

    session.current.user.name = 'Nguyễn Lương Bảo Châu';
    const owner = await call(api.contact.GET, `/api/crm/contacts/${khachId}`, undefined, khachId);
    expect(owner.json.sensitiveNote).toBe('Kiêng đồ ngọt');
    session.current.user.name = 'Nhân viên khác';
  });

  it('sửa một trường không làm mất hạng và nhãn', async () => {
    const req = new Request('http://test/x', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0901' }),
    });
    const res = await api.contact.PATCH(req, { params: Promise.resolve({ id: khachId }) });
    const updated = await res.json();
    expect(updated.tier).toBe('VIP');
    expect(updated.tags).toEqual(['Đối tác MOU']);
    expect(updated.phone).toBe('0901');
  });

  it('nhân viên không phụ trách không sửa được lưu ý nhạy cảm', async () => {
    const req = new Request('http://test/x', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sensitiveNote: 'x' }),
    });
    const res = await api.contact.PATCH(req, { params: Promise.resolve({ id: khachId }) });
    expect(res.status).toBe(403);
  });

  it('dẫn khách VIP khám: khách gõ mới được tạo hồ sơ và gắn vào đơn vị', async () => {
    const r = await call(api.interactions.POST, '/api/crm/interactions', {
      type: 'VIP_ESCORT', occurredAt: '2026-10-02T02:00:00.000Z',
      newContactName: 'Trần Thị B', newContactPhone: '0912', organizationName: 'Sở Y tế Z',
      patientName: 'Mẹ của khách', destination: 'Khoa Tim mạch', services: ['Khám bệnh', 'Xét nghiệm'],
      content: 'Dẫn khám và làm xét nghiệm', staffName: 'Nguyễn Thị Thảo Trang',
      companions: ['Nguyễn Thị Thảo Trang', 'Vũ Thị Bích Thảo'],
    });
    expect(r.status).toBe(201);
    expect(r.json.contact.fullName).toBe('Trần Thị B');
    expect(r.json.organization.name).toBe('Sở Y tế Z');
    // Người dẫn chính không lặp lại trong người đi cùng.
    expect(r.json.companions).toEqual(['Vũ Thị Bích Thảo']);
    thanhVienId = r.json.contact.id;
  });

  it('dẫn khách VIP thiếu khách thì báo lỗi đúng trường', async () => {
    const r = await call(api.interactions.POST, '/api/crm/interactions', {
      type: 'VIP_ESCORT', occurredAt: '2026-10-02T02:00:00.000Z', content: 'x', staffName: 'A',
    });
    expect(r.status).toBe(400);
    expect(r.json.issues[0].path).toBe('contactId');
  });

  it('dẫn đoàn: lượt này hiện trên hồ sơ của cả trưởng đoàn lẫn thành viên', async () => {
    const r = await call(api.interactions.POST, '/api/crm/interactions', {
      type: 'DELEGATION', occurredAt: '2026-10-01T03:00:00.000Z', contactId: khachId,
      organizationName: 'bệnh viện x', participantIds: [thanhVienId, khachId], guestCount: 12,
      purpose: 'Tham quan', destination: 'Khu A, Khoa Xét nghiệm', content: 'Tham quan mô hình', staffName: 'Nguyễn Ngọc Linh Ân',
    });
    expect(r.status).toBe(201);
    // Tên gõ khác hoa/thường vẫn nhận đúng tổ chức có sẵn, không tạo trùng.
    expect(r.json.organization.name).toBe('Bệnh viện X');
    // Trưởng đoàn không bị đếm lặp trong thành viên.
    expect(r.json.participants.map((p: { id: string }) => p.id)).toEqual([thanhVienId]);

    const member = await call(api.contact.GET, `/api/crm/contacts/${thanhVienId}`, undefined, thanhVienId);
    expect(member.json.interactions.map((i: { type: string }) => i.type).sort()).toEqual(['DELEGATION', 'VIP_ESCORT']);
  });

  it('lọc đồng thời theo nhân viên và theo khách không làm mất điều kiện nào', async () => {
    const r = await call(api.interactions.GET, `/api/crm/interactions?staffName=Vũ Thị Bích Thảo&contactId=${khachId}`);
    // Vũ Thị Bích Thảo chỉ đi cùng lượt dẫn khám Trần Thị B, không dính tới khách A.
    expect(r.json).toEqual([]);
  });

  it('ngày quan trọng không tồn tại bị chặn', async () => {
    const r = await call(api.dates.POST, '/api/crm/important-dates', {
      contactId: khachId, kind: 'APPOINTMENT', day: 31, month: 4,
    });
    expect(r.status).toBe(400);
  });

  it('tổng quan có sinh nhật sắp tới và đếm đúng lượt trong tháng', async () => {
    await call(api.dates.POST, '/api/crm/important-dates', {
      contactId: khachId, kind: 'APPOINTMENT', label: 'Nhận chức Giám đốc', day: 15, month: 10, year: 2025,
    });
    const r = await call(api.overview.GET, '/api/crm/overview?window=400');
    const kinds = r.json.upcoming.filter((u: { target: { id: string } }) => u.target.id === khachId).map((u: { kind: string }) => u.kind);
    expect(kinds).toContain('BIRTHDAY');
    expect(kinds).toContain('APPOINTMENT');
    expect(r.json.counts.contacts).toBe(2);
  });

  it('tìm nhanh cho ô chọn khách', async () => {
    const r = await call(api.search.GET, '/api/crm/search?q=nguyễn');
    expect(r.json.contacts[0].subtitle).toBe('Giám đốc, Bệnh viện X');
  });

  it('tổ chức trùng tên bị chặn', async () => {
    const r = await call(api.orgs.POST, '/api/crm/organizations', { name: 'BỆNH VIỆN X' });
    expect(r.status).toBe(409);
  });

  const send = async (handler: (...args: unknown[]) => Promise<Response>, method: string, id: string, body?: unknown, query = '') => {
    const req = new Request(`http://test/x${query}`, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const res = await handler(req, { params: Promise.resolve({ id }) });
    return { status: res.status, json: await res.json() };
  };

  it('tìm không dấu vẫn ra khách có dấu', async () => {
    const r = await call(api.contacts.GET, '/api/crm/contacts?search=tran thi b');
    expect(r.json.map((c: { id: string }) => c.id)).toEqual([thanhVienId]);
  });

  it('ghi lượt mới cho khách gõ lại cùng số điện thoại thì dùng lại hồ sơ cũ', async () => {
    const r = await call(api.interactions.POST, '/api/crm/interactions', {
      type: 'VIP_ESCORT', occurredAt: '2026-10-02T05:00:00.000Z', newContactName: 'Trần Thị B.', newContactPhone: '09 12',
      content: 'Tái khám', staffName: 'Nguyễn Thị Thảo Trang',
    });
    expect(r.status).toBe(201);
    expect(r.json.contact.id).toBe(thanhVienId);
  });

  it('lịch hẹn: không tính vào số liệu tháng cho tới khi đánh dấu đã xong', async () => {
    const before = await call(api.overview.GET, '/api/crm/overview?window=400');
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const created = await call(api.interactions.POST, '/api/crm/interactions', {
      type: 'VIP_ESCORT', status: 'PLANNED', occurredAt: future, contactId: khachId,
      content: 'Hẹn khám tổng quát', staffName: 'Nguyễn Thị Thảo Trang',
    });
    expect(created.status).toBe(201);
    expect(created.json.status).toBe('PLANNED');

    const mid = await call(api.overview.GET, '/api/crm/overview?window=400');
    expect(mid.json.planned.map((p: { id: string }) => p.id)).toContain(created.json.id);
    expect(mid.json.counts.vipEscortsThisMonth).toBe(before.json.counts.vipEscortsThisMonth);

    // Người khác trong phòng (không phải người đặt lịch) vẫn đánh dấu được.
    session.current.user.id = 'u2';
    const done = await send(api.status.POST, 'POST', created.json.id, { status: 'DONE', note: 'Khách đến đúng giờ' });
    session.current.user.id = 'u1';
    expect(done.status).toBe(200);
    expect(done.json.note).toContain('Khách đến đúng giờ');
    const planned = await call(api.interactions.GET, '/api/crm/interactions?status=PLANNED');
    expect(planned.json).toEqual([]);
  });

  it('chỉ người tạo hoặc quản trị mới sửa/xoá được lượt tương tác', async () => {
    const list = await call(api.interactions.GET, `/api/crm/interactions?contactId=${thanhVienId}`);
    const id = list.json[0].id;
    session.current.user.id = 'u2';
    expect((await send(api.interaction.DELETE, 'DELETE', id)).status).toBe(403);
    session.current.user.role = 'ADMIN';
    expect((await send(api.interaction.DELETE, 'DELETE', id)).status).toBe(200);
    session.current.user.role = 'STAFF';
    session.current.user.id = 'u1';
  });

  it('không xoá được khách đã có lịch sử, trừ quản trị xoá hẳn', async () => {
    expect((await send(api.contact.DELETE, 'DELETE', thanhVienId)).status).toBe(409);
    session.current.user.role = 'ADMIN';
    expect((await send(api.contact.DELETE, 'DELETE', thanhVienId, undefined, '?force=1')).status).toBe(200);
    session.current.user.role = 'STAFF';
  });

  it('kiêm nhiệm giữ nguyên chức vụ hiện tại cũ, chức vụ mới thường thì thay thế', async () => {
    await send(api.positions.POST, 'POST', khachId, { title: 'Trưởng Bộ môn', organizationName: 'Đại học Y', concurrent: true });
    let detail = await call(api.contact.GET, `/api/crm/contacts/${khachId}`, undefined, khachId);
    const currentTitles = () => detail.json.positions.filter((p: { isCurrent: boolean }) => p.isCurrent).map((p: { title: string }) => p.title).sort();
    expect(currentTitles()).toEqual(['Giám đốc', 'Trưởng Bộ môn']);

    await send(api.positions.POST, 'POST', khachId, { title: 'Phó Hiệu trưởng', organizationName: 'Đại học Y' });
    detail = await call(api.contact.GET, `/api/crm/contacts/${khachId}`, undefined, khachId);
    expect(currentTitles()).toEqual(['Phó Hiệu trưởng']);
  });

  it('gộp hồ sơ trùng: chuyển hết lịch sử, bổ sung thông tin, xoá bản trùng', async () => {
    const dup = await call(api.contacts.POST, '/api/crm/contacts', {
      fullName: 'Nguyen Van A', email: 'a@bvx.vn', tags: ['Cựu sinh viên'], tier: 'B',
      currentTitle: 'Giám đốc', currentOrganizationName: 'Bệnh viện X',
    });
    const dupId = dup.json.id;
    const escort = await call(api.interactions.POST, '/api/crm/interactions', {
      type: 'VIP_ESCORT', occurredAt: '2026-10-01T02:00:00.000Z', contactId: dupId, content: 'Khám', staffName: 'A',
    });
    const delegation = await call(api.interactions.POST, '/api/crm/interactions', {
      type: 'DELEGATION', occurredAt: '2026-10-01T04:00:00.000Z', contactId: khachId, participantIds: [dupId], organizationName: 'Bệnh viện X',
      content: 'Làm việc', staffName: 'A',
    });

    expect([escort.status, delegation.status], JSON.stringify([escort.json, delegation.json])).toEqual([201, 201]);
    const r = await send(api.merge.POST, 'POST', khachId, { sourceId: dupId });
    expect(r.status).toBe(200);

    const detail = await call(api.contact.GET, `/api/crm/contacts/${khachId}`, undefined, khachId);
    expect(detail.json.email).toBe('a@bvx.vn');
    expect(detail.json.tier).toBe('VIP');
    expect(detail.json.tags).toEqual(['Đối tác MOU', 'Cựu sinh viên']);
    const ids = detail.json.interactions.map((i: { id: string }) => i.id);
    expect(ids).toContain(escort.json.id);
    expect(ids).toContain(delegation.json.id);
    // Trưởng đoàn không bị đếm lại là thành viên của chính đoàn mình.
    const merged = detail.json.interactions.find((i: { id: string }) => i.id === delegation.json.id);
    expect(merged.participants).toEqual([]);
    // Chức vụ "Giám đốc @ Bệnh viện X" trùng y hệt (đã qua) nên không nhân đôi.
    expect(detail.json.positions.filter((p: { title: string }) => p.title === 'Giám đốc')).toHaveLength(1);
    expect((await call(api.contact.GET, `/api/crm/contacts/${dupId}`, undefined, dupId)).status).toBe(404);
  });

  it('đối chiếu với Excel: CRM chỉ đếm lượt đã thực hiện, tháng Excel chưa có thì để trống', async () => {
    const { todayInVietnam } = await import('@/lib/crm/upcoming');
    const [year, month] = todayInVietnam().split('-').map(Number);
    const monthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+07:00`);
    const nextMonthStart = new Date(Date.UTC(year, month, 1) - 7 * 3_600_000);
    await prisma.$executeRawUnsafe('TRUNCATE hc_metrics');
    await prisma.$executeRawUnsafe(`INSERT INTO hc_metrics (id, category, content, year, week, month, value, "sourceId", "updatedAt")
      VALUES ('t1', 'Đón tiếp khách VIP', 'Số lượt khách VIP', ${year}, 1, ${month}, 7, 's', now()),
             ('t2', 'Tiếp khách trong nước', 'Tổng số đoàn khách trong nước, trong đó:', ${year}, 1, ${month}, 1, 's', now()),
             ('t3', 'Tiếp khách trong nước', 'Làm việc', ${year}, 1, ${month}, 1, 's', now())`);
    const r = await call(api.overview.GET, '/api/crm/overview?window=7');
    const crm = await prisma.crmInteraction.groupBy({
      by: ['type'], where: { status: 'DONE', occurredAt: { gte: monthStart, lt: nextMonthStart } }, _count: true,
    });
    const count = (t: string) => crm.find((c) => c.type === t)?._count ?? 0;
    expect(r.json.reconcile[0]).toEqual({ year, month, excelVip: 7, crmVip: count('VIP_ESCORT'), excelDelegations: 1, crmDelegations: count('DELEGATION') });
    expect(r.json.reconcile[1].excelVip).toBeNull();
  });

  it('không gộp hồ sơ với chính nó', async () => {
    expect((await send(api.merge.POST, 'POST', khachId, { sourceId: khachId })).status).toBe(400);
  });

  describe('chăm sóc đối tác: quà, hoa', () => {
    let vipId = '';
    let taskId = '';
    let dueDate = '';
    const addDays = async (days: number) => {
      const { todayInVietnam } = await import('@/lib/crm/upcoming');
      return new Date(Date.parse(`${todayInVietnam()}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    };
    const careDueOf = async (contactId: string) => {
      const r = await call(api.overview.GET, '/api/crm/overview?window=7');
      return r.json.careDue.find((d: { target: { id: string } }) => d.target.id === contactId);
    };

    it('sinh nhật VIP trong 7 ngày tới hiện ở "cần chuẩn bị", hạng C chỉ hiện đúng ngày', async () => {
      const inThree = await addDays(3);
      const [, m, d] = inThree.split('-').map(Number);
      const vip = await call(api.contacts.POST, '/api/crm/contacts', { fullName: 'Lê Văn Quà', tier: 'VIP', birthDay: d, birthMonth: m });
      const plain = await call(api.contacts.POST, '/api/crm/contacts', { fullName: 'Phạm Thị Thường', tier: 'C', birthDay: d, birthMonth: m });
      vipId = vip.json.id;

      const due = await careDueOf(vipId);
      expect(due).toMatchObject({ key: `birthday:${vipId}`, kind: 'BIRTHDAY', date: inThree, daysUntil: 3, remindDays: 7, task: null });
      expect(await careDueOf(plain.json.id)).toBeUndefined();
      dueDate = due.date;
    });

    it('lên kế hoạch quà/hoa; lên lần nữa cho cùng dịp thì 409', async () => {
      const body = {
        contactId: vipId, occasionKind: 'BIRTHDAY', occasionDate: dueDate, giftType: 'FLOWERS',
        description: 'Lẵng hoa lan hồ điệp', budget: 1_500_000, assigneeName: 'Vũ Thị Bích Thảo',
      };
      const r = await call(api.careTasks.POST, '/api/crm/care-tasks', body);
      expect(r.status).toBe(201);
      expect(r.json).toMatchObject({ status: 'TODO', occasionDate: dueDate, occasionLabel: 'Sinh nhật', budget: 1_500_000 });
      taskId = r.json.id;

      expect((await call(api.careTasks.POST, '/api/crm/care-tasks', { ...body, description: 'Giỏ trái cây' })).status).toBe(409);
      expect((await careDueOf(vipId)).task.id).toBe(taskId);
    });

    it('tổ chức không có sinh nhật', async () => {
      const org = await call(api.orgs.POST, '/api/crm/organizations', { name: 'Công ty Quà Tặng' });
      const r = await call(api.careTasks.POST, '/api/crm/care-tasks', {
        organizationId: org.json.id, occasionKind: 'BIRTHDAY', occasionDate: dueDate, giftType: 'GIFT', description: 'x',
      });
      expect(r.status).toBe(400);
    });

    it('đánh dấu đã trao: ghi lượt tặng quà trên dòng thời gian, tính vào thực chi', async () => {
      expect((await send(api.careStatus.POST, 'POST', taskId, { status: 'ORDERED' })).status).toBe(200);
      const delivered = await send(api.careStatus.POST, 'POST', taskId, { status: 'DELIVERED', actualCost: 1_200_000 });
      expect(delivered.status).toBe(200);
      expect(delivered.json.status).toBe('DELIVERED');
      expect(delivered.json.deliveredAt).not.toBeNull();
      expect(delivered.json.interactionId).toBeTruthy();

      const detail = await call(api.contact.GET, `/api/crm/contacts/${vipId}`, undefined, vipId);
      const gift = detail.json.interactions.find((i: { id: string }) => i.id === delivered.json.interactionId);
      expect(gift).toMatchObject({ type: 'GIFT', status: 'DONE', content: 'Lẵng hoa lan hồ điệp', staffName: 'Vũ Thị Bích Thảo', title: 'Hoa · Sinh nhật' });
      expect(gift.occurredAt).toBe(delivered.json.deliveredAt);
      expect(detail.json.careTasks.map((t: { id: string }) => t.id)).toEqual([taskId]);

      const overview = await call(api.overview.GET, '/api/crm/overview?window=7');
      if (dueDate.slice(0, 4) === (await addDays(0)).slice(0, 4)) {
        expect(overview.json.careBudget.year).toEqual({ budget: 1_500_000, actualCost: 1_200_000 });
      }
    });

    it('đã trao thì không huỷ được', async () => {
      const r = await send(api.careStatus.POST, 'POST', taskId, { status: 'CANCELLED' });
      expect(r.status).toBe(400);
      const list = await call(api.careTasks.GET, `/api/crm/care-tasks?status=DELIVERED&contactId=${vipId}`);
      expect(list.json).toHaveLength(1);
    });

    it('gộp hồ sơ trùng chuyển cả việc quà/hoa, trùng dịp vẫn giữ đủ lịch sử', async () => {
      const [, m, d] = dueDate.split('-').map(Number);
      const dup = await call(api.contacts.POST, '/api/crm/contacts', { fullName: 'Le Van Qua', birthDay: d, birthMonth: m });
      const dupTask = await call(api.careTasks.POST, '/api/crm/care-tasks', {
        contactId: dup.json.id, occasionKind: 'BIRTHDAY', occasionDate: dueDate, giftType: 'CARD', description: 'Thiệp chúc mừng',
      });
      expect(dupTask.status).toBe(201);
      expect((await send(api.merge.POST, 'POST', vipId, { sourceId: dup.json.id })).status).toBe(200);

      const detail = await call(api.contact.GET, `/api/crm/contacts/${vipId}`, undefined, vipId);
      expect(detail.json.careTasks.map((t: { id: string }) => t.id).sort()).toEqual([taskId, dupTask.json.id].sort());
    });

    it('dịp đã qua mà quà/hoa chưa trao vẫn được nhắc ở tổng quan', async () => {
      const past = await addDays(-2);
      const r = await call(api.careTasks.POST, '/api/crm/care-tasks', {
        contactId: vipId, occasionKind: 'APPOINTMENT', occasionDate: past, giftType: 'FLOWERS', description: 'Hoa chúc mừng nhận chức',
      });
      expect(r.status).toBe(201);
      const overview = await call(api.overview.GET, '/api/crm/overview?window=7');
      expect(overview.json.careOverdue.map((t: { id: string }) => t.id)).toContain(r.json.id);
      expect(overview.json.careOverdue.map((t: { id: string }) => t.id)).not.toContain(taskId);
    });
  });
});
