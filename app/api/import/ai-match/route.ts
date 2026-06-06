import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseExcelFile } from '@/lib/excel-parser';
import { getDeptHint } from '@/lib/chatbot/dept-hints';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const CUMULATIVE_RE = /ghép\s+(gan|thận|tim|phổi|giác mạc)/i;
const isCumulative = (n: string) => CUMULATIVE_RE.test(n);

interface AiTask { masterTaskId: string; taskName: string; result: string; confidence: number }
interface AiMetric { metricId: string; metricName: string; value: number | null; note: string | null; confidence: number }
interface AiNewTask { taskName: string; result: string; suggestedMasterTaskName?: string }
interface AiNewMetric { metricName: string; value: number; unit?: string; context?: string }
interface AiOut {
  tasks: AiTask[];
  metrics: AiMetric[];
  newTasks?: AiNewTask[];
  dormantTasks?: string[];
  newMetrics?: AiNewMetric[];
  unmatched?: string[];
}

async function callDeepSeek(prompt: string): Promise<AiOut> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 7500,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return JSON.parse(json.choices[0].message.content) as AiOut;
}

function buildPrompt(
  deptName: string,
  weekNumber: number,
  year: number,
  textBlob: string,
  masterTasks: Array<{ id: string; name: string }>,
  metrics: Array<{ id: string; name: string; unit: string | null }>,
): string {
  const taskList = masterTasks.map((t) => `  - id="${t.id}" | name="${t.name}"`).join('\n');
  const metricList = metrics
    .map((m) => `  - id="${m.id}" | name="${m.name}"${m.unit ? ` | unit="${m.unit}"` : ''} | type=${isCumulative(m.name) ? 'CUMULATIVE' : 'WEEKLY'}`)
    .join('\n');
  return `Bạn xử lý báo cáo tuần ${weekNumber}/${year} của ${deptName}.
${getDeptHint(deptName)}

## Master tasks (PHẢI chọn từ danh sách):
${taskList || '  (none)'}

## Metric definitions (PHẢI chọn từ danh sách):
${metricList || '  (none)'}

## Text:
\`\`\`
${textBlob}
\`\`\`

Quy tắc:
- masterTaskId/metricId PHẢI từ danh sách, KHÔNG bịa.
- type=CUMULATIVE: value = tổng tích lũy từ đầu năm.
- type=WEEKLY: value = số phát sinh tuần này.
- Không data → bỏ qua metric đó.
- Chỉ trả JSON.

Schema: {
  "tasks":[{"masterTaskId":"...","taskName":"...","result":"...","confidence":0.95}],
  "metrics":[{"metricId":"...","metricName":"...","value":110,"note":"","confidence":1.0}],
  "newTasks":[{"taskName":"...","result":"...","suggestedMasterTaskName":"..."}],
  "dormantTasks":["masterTaskId"],
  "newMetrics":[{"metricName":"...","value":42,"unit":"Lượt","context":"..."}],
  "unmatched":[]
}`;
}

function matchScore(a: string, b: string): number {
  const aw = new Set(a.split(/\s+/).filter((w) => w.length > 1));
  const bw = b.split(/\s+/).filter((w) => w.length > 1);
  let hits = 0;
  for (const w of bw) if (aw.has(w)) hits++;
  return hits / Math.max(aw.size, bw.length, 1);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const weekNumber = parseInt(String(form.get('weekNumber') ?? '0'), 10);
  const year = parseInt(String(form.get('year') ?? '0'), 10);
  const skipSheetsRaw = String(form.get('skipSheets') ?? '');
  const skipSheets = new Set(
    skipSheetsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

  if (!file || !weekNumber || !year) return new Response('Missing file/week/year', { status: 400 });

  const ab = await file.arrayBuffer();
  const parsed = parseExcelFile(ab);
  const allDbDepts = await prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const sheetsToProcess = parsed.departments.filter((d) => !skipSheets.has(d.name));
        send('parsed', {
          departments: parsed.departments.length,
          skipped: parsed.departments.length - sheetsToProcess.length,
          willProcess: sheetsToProcess.length,
        });

        const results: Array<{
          sheetName: string;
          departmentId: string;
          departmentName: string;
          masterTaskCount: number;
          metricDefCount: number;
          tasks: AiTask[];
          metrics: AiMetric[];
          newTasks: AiNewTask[];
          dormantTasks: string[];
          newMetrics: AiNewMetric[];
          unmatched: string[];
          error?: string;
        }> = [];

        for (let i = 0; i < sheetsToProcess.length; i++) {
          const sheetDept = sheetsToProcess[i];
          const sNorm = sheetDept.name.toLowerCase().replace(/^phòng\s+/, '').replace(/^trung tâm\s+/, '').replace(/^đơn vị\s+/, '');
          const ranked = allDbDepts
            .map((d) => ({ d, score: matchScore(sNorm, d.name.toLowerCase()) }))
            .filter((x) => x.score > 0.4)
            .sort((a, b) => b.score - a.score);
          const dbDept = ranked[0]?.d;
          if (!dbDept) {
            send('progress', { index: i + 1, total: sheetsToProcess.length, deptName: sheetDept.name, status: 'skipped', reason: 'no-db-match' });
            continue;
          }

          send('progress', {
            index: i + 1,
            total: sheetsToProcess.length,
            deptName: dbDept.name,
            status: 'matching',
          });

          const masterTasks = await prisma.masterTask.findMany({ where: { departmentId: dbDept.id }, select: { id: true, name: true } });
          const metricDefs = await prisma.metricDefinition.findMany({ where: { departmentId: dbDept.id, isActive: true }, select: { id: true, name: true, unit: true }, orderBy: { orderNumber: 'asc' } });
          const validTaskIds = new Set(masterTasks.map((t) => t.id));
          const validMetricIds = new Set(metricDefs.map((m) => m.id));
          const textBlob = sheetDept.tasks.map((t) => `${t.taskName}\n  → ${t.result}`).join('\n\n');

          try {
            const prompt = buildPrompt(dbDept.name, weekNumber, year, textBlob, masterTasks, metricDefs);
            const ai = await callDeepSeek(prompt);

            const cleanTasks = (ai.tasks || []).filter((t) => validTaskIds.has(t.masterTaskId));
            const cleanMetrics = (ai.metrics || []).filter((m) => validMetricIds.has(m.metricId) && m.value !== null && m.value !== undefined);
            const cleanDormant = (ai.dormantTasks || []).filter((id) => validTaskIds.has(id));

            results.push({
              sheetName: sheetDept.name,
              departmentId: dbDept.id,
              departmentName: dbDept.name,
              masterTaskCount: masterTasks.length,
              metricDefCount: metricDefs.length,
              tasks: cleanTasks,
              metrics: cleanMetrics,
              newTasks: ai.newTasks || [],
              dormantTasks: cleanDormant,
              newMetrics: ai.newMetrics || [],
              unmatched: ai.unmatched || [],
            });

            send('progress', {
              index: i + 1,
              total: sheetsToProcess.length,
              deptName: dbDept.name,
              status: 'done',
              taskCount: cleanTasks.length,
              metricCount: cleanMetrics.length,
              newTaskCount: (ai.newTasks || []).length,
              dormantTaskCount: cleanDormant.length,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'error';
            results.push({
              sheetName: sheetDept.name,
              departmentId: dbDept.id,
              departmentName: dbDept.name,
              masterTaskCount: masterTasks.length,
              metricDefCount: metricDefs.length,
              tasks: [],
              metrics: [],
              newTasks: [],
              dormantTasks: [],
              newMetrics: [],
              unmatched: [],
              error: msg,
            });
            send('progress', { index: i + 1, total: sheetsToProcess.length, deptName: dbDept.name, status: 'error', error: msg });
          }
        }

        send('complete', { results });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        send('error', { error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
