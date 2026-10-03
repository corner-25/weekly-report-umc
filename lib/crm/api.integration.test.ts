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
      'TRUNCATE crm_interaction_participants, crm_interactions, crm_important_dates, crm_relations, crm_positions, crm_contacts, crm_organizations CASCADE',
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
});
