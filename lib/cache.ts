import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';

// Cache tags — dùng để revalidate khi data thay đổi
export const CACHE_TAGS = {
  departments: 'departments',
  meetingRooms: 'meeting-rooms',
  secretaryTypes: 'secretary-types',
  metrics: 'metrics',
  dashboardStats: 'dashboard-stats',
} as const;

// Departments — cache vĩnh viễn, chỉ xóa khi có thay đổi
export const getCachedDepartments = unstable_cache(
  async () =>
    prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    }),
  [CACHE_TAGS.departments],
  { revalidate: false, tags: [CACHE_TAGS.departments] }
);

// Meeting rooms — cache vĩnh viễn
export const getCachedMeetingRooms = unstable_cache(
  async () =>
    prisma.meetingRoom.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    }),
  [CACHE_TAGS.meetingRooms],
  { revalidate: false, tags: [CACHE_TAGS.meetingRooms] }
);

// Secretary types — cache vĩnh viễn
export const getCachedSecretaryTypes = unstable_cache(
  async () =>
    prisma.secretaryType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { secretaries: true } } },
    }),
  [CACHE_TAGS.secretaryTypes],
  { revalidate: false, tags: [CACHE_TAGS.secretaryTypes] }
);

// Metrics definitions — cache vĩnh viễn
export const getCachedMetrics = unstable_cache(
  async (departmentId?: string) => {
    const where: any = { isActive: true };
    if (departmentId) where.departmentId = departmentId;
    return prisma.metricDefinition.findMany({
      where,
      select: {
        id: true,
        name: true,
        unit: true,
        description: true,
        orderNumber: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        _count: { select: { weekValues: true } },
      },
      orderBy: [{ departmentId: 'asc' }, { orderNumber: 'asc' }, { createdAt: 'asc' }],
    });
  },
  [CACHE_TAGS.metrics],
  { revalidate: false, tags: [CACHE_TAGS.metrics] }
);
