/**
 * Test tích hợp phân hệ Quản lý công việc trên Postgres thật — cùng schema RIÊNG
 * với test CRM (CRM_TEST_DATABASE_URL, ...?schema=crm_test). Test xoá sạch bảng
 * work_*, departments, secretaries trong schema đó. TUYỆT ĐỐI không trỏ production.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_URL = process.env.CRM_TEST_DATABASE_URL;
const session = vi.hoisted(() => ({
  current: { user: { id: 'u1', email: 'a@x', name: 'Nhân viên HC', role: 'STAFF', departmentId: null } },
}));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const run = TEST_URL ? describe : describe.skip;

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

run('Quản lý công việc (tích hợp)', { timeout: 30_000 }, () => {
  let prisma: import('@prisma/client').PrismaClient;
  let api: Record<string, Record<string, (...args: unknown[]) => Promise<Response>>>;
  let deptId = '';

  const call = async (handler: (...args: unknown[]) => Promise<Response>, url: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }, id = '') => {
    const req = new Request(`http://test${url}`, {
      method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...(init?.body !== undefined && { body: JSON.stringify(init.body) }),
    });
    const res = await handler(req, { params: Promise.resolve({ id }) });
    return { status: res.status, json: await res.json() };
  };

  const payload = (overrides: Record<string, unknown> = {}) => ({
    source: 'qlcv',
    scrapedAt: new Date().toISOString(),
    items: [
      {
        externalId: 'CV-001', title: 'Rà soát quy trình tiếp đón khách', kind: 'DIRECTIVE',
        directedBy: 'PGS.TS. Giám đốc', directedAt: daysFromNow(-40), leadUnit: 'Phòng Hành chính',
        dueDate: daysFromNow(-2), status: 'Đang thực hiện', progressPercent: 50,
        updates: [{ at: `${daysFromNow(-20)}T09:00:00+07:00`, author: 'Thư ký A', content: 'Đã lấy ý kiến các khoa', progressPercent: 50 }],
        ...overrides,
      },
      { externalId: 'CV-002', title: 'Chuẩn bị hội nghị', leadUnit: 'Đơn vị không có thật', dueDate: daysFromNow(30), status: 'Hoàn thành' },
      { externalId: '', title: 'Thiếu mã' },
    ],
  });

  beforeAll(async () => {
    if (!TEST_URL?.includes('schema=crm_test')) throw new Error('CRM_TEST_DATABASE_URL phải trỏ tới schema crm_test');
    process.env.DATABASE_URL = TEST_URL;
    process.env.WORK_IMPORT_TOKEN = 'token-test';
    prisma = (await import('@/lib/prisma')).prisma;
    await prisma.$executeRawUnsafe('TRUNCATE work_updates, work_items, work_import_runs, secretaries, secretary_types, departments CASCADE');
    deptId = (await prisma.department.create({ data: { name: 'Phòng Hành chính' } })).id;
    const type = await prisma.secretaryType.create({ data: { name: 'Thư ký hành chính' } });
    await prisma.secretary.create({
      data: { fullName: 'Thư ký A', email: 'thuky.a@umc.edu.vn', currentDepartmentId: deptId, secretaryTypeId: type.id } as never,
    });
    api = {
      import: await import('@/app/api/work/import/route'),
      items: await import('@/app/api/work/items/route'),
      item: await import('@/app/api/work/items/[id]/route'),
      updates: await import('@/app/api/work/items/[id]/updates/route'),
      overview: await import('@/app/api/work/overview/route'),
      reminders: await import('@/app/api/work/reminders/route'),
    } as never;
    // Không bao giờ gửi email thật khi chạy test (đặt sau import vì có module nạp lại .env).
    delete process.env.SMTP_HOST;
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  let itemId = '';

  it('script nạp bằng mã: sai mã thì 401, đúng mã thì nạp và báo dòng lỗi', async () => {
    expect((await call(api.import.POST, '/api/work/import', { body: payload(), headers: { 'x-import-token': 'sai' } })).status).toBe(401);
    const r = await call(api.import.POST, '/api/work/import', { body: payload(), headers: { 'x-import-token': 'token-test' } });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ itemsSeen: 3, itemsCreated: 2, itemsChanged: 0, updatesAdded: 1 });
    expect(r.json.problems[0].message).toContain('externalId');
  });

  it('khớp đơn vị chủ trì với phòng ban, quy đổi trạng thái', async () => {
    const list = await call(api.items.GET, '/api/work/items?view=open');
    const a = list.json.find((i: { externalId: string }) => i.externalId === 'CV-001');
    itemId = a.id;
    expect(a.department.name).toBe('Phòng Hành chính');
    expect(a.status).toBe('IN_PROGRESS');
    expect(a.health).toMatchObject({ isOverdue: true, isStale: true });
    // Việc đã hoàn thành không nằm trong danh sách đang mở.
    expect(list.json.map((i: { externalId: string }) => i.externalId)).toEqual(['CV-001']);
  });

  it('Phòng HC ghi tính chất; nạp lại file không ghi đè phần đó, không nhân đôi cập nhật', async () => {
    const patch = await call(api.item.PATCH, '', { method: 'PATCH', body: { characteristics: 'Liên quan 12 khoa', priority: 'HIGH' } }, itemId);
    expect(patch.status).toBe(200);
    expect((await call(api.item.PATCH, '', { method: 'PATCH', body: { title: 'Đổi tên' } }, itemId)).status).toBe(400);

    const again = await call(api.import.POST, '/api/work/import', {
      body: payload({ progressPercent: 70, updates: [
        { at: `${daysFromNow(-20)}T09:00:00+07:00`, author: 'Thư ký A', content: 'Đã lấy ý kiến các khoa', progressPercent: 50 },
        { at: `${daysFromNow(-1)}T10:00:00+07:00`, author: 'Thư ký A', content: 'Đã trình dự thảo', progressPercent: 70 },
      ] }),
      headers: { 'x-import-token': 'token-test' },
    });
    expect(again.json).toMatchObject({ itemsCreated: 0, itemsChanged: 1, updatesAdded: 1 });

    const detail = await call(api.item.GET, '', undefined, itemId);
    expect(detail.json).toMatchObject({ characteristics: 'Liên quan 12 khoa', priority: 'HIGH', progressPercent: 70 });
    expect(detail.json.updates.map((u: { content: string }) => u.content)).toEqual(['Đã trình dự thảo', 'Đã lấy ý kiến các khoa']);
    expect(detail.json.health.isStale).toBe(false);
  });

  it('ghi tay cập nhật và mở việc theo kế hoạch', async () => {
    expect((await call(api.updates.POST, '', { body: { content: 'Thư ký báo đang chờ ký', progressPercent: 80 } }, itemId)).status).toBe(201);
    const created = await call(api.items.POST, '/api/work/items', { body: { title: 'Kiểm kê tài sản quý IV', dueDate: daysFromNow(3), departmentId: deptId } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ source: 'MANUAL', kind: 'PLAN', health: { isDueSoon: true } });
  });

  it('bảng theo dõi và danh sách nhắc việc gom theo thư ký của đơn vị', async () => {
    const overview = await call(api.overview.GET, '/api/work/overview');
    expect(overview.json.counts).toMatchObject({ open: 2, overdue: 1, dueSoon: 1, done: 1 });
    expect(overview.json.recentUpdates[0].content).toBe('Thư ký báo đang chờ ký');
    expect(overview.json.lastImport.itemsSeen).toBe(3);

    const reminders = await call(api.reminders.GET, '/api/work/reminders');
    expect(reminders.json.canSend).toBe(false);
    expect(reminders.json.recipients).toHaveLength(1);
    expect(reminders.json.recipients[0]).toMatchObject({ email: 'thuky.a@umc.edu.vn', department: 'Phòng Hành chính' });
    expect(reminders.json.recipients[0].items.map((i: { reason: string }) => i.reason).sort()).toEqual(['due_soon', 'overdue']);
    expect((await call(api.reminders.POST, '/api/work/reminders', { body: {} })).status).toBe(403);
  });
});
