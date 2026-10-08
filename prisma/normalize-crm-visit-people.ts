/** node --env-file=.env --import tsx prisma/normalize-crm-visit-people.ts [--apply]
 * Mặc định chỉ xem trước; giữ nguyên nguồn và chẩn đoán, không tự gộp tên gần giống.
 */
import { PrismaClient } from '@prisma/client';
import { normalizeVisitPeople } from '../lib/crm/normalize-visit-people';
const db = new PrismaClient();
normalizeVisitPeople(db, !process.argv.includes('--apply')).then(result => console.log(JSON.stringify(result, null, 2))).catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
