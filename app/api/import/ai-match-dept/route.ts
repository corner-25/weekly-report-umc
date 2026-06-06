import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseExcelFile } from '@/lib/excel-parser';
import { getDeptHint } from '@/lib/chatbot/dept-hints';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CUMULATIVE_RE = /ghép\s+(gan|thận|tim|phổi|giác mạc)/i;
const isCumulative = (n: string) => CUMULATIVE_RE.test(n);

interface AiOut {
  tasks?: Array<{ masterTaskId: string; taskName: string; result: string; confidence: number }>;
  metrics?: Array<{ metricId: string; metricName: string; value: number | null; note: string | null; confidence: number }>;
  newTasks?: Array<{ taskName: string; result: string; suggestedMasterTaskName?: string }>;
  dormantTasks?: string[];
  newMetrics?: Array<{ metricName: string; value: number; unit?: string; context?: string }>;
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

## Master tasks:
${taskList || '  (none)'}

## Metric definitions:
${metricList || '  (none)'}

## Text:
\`\`\`
${textBlob}
\`\`\`

Quy tắc:
- masterTaskId/metricId PHẢI từ danh sách, KHÔNG bịa.
- type=CUMULATIVE: value = tổng tích lũy từ đầu năm.
- type=WEEKLY: value = số phát sinh tuần này.
- Không data → bỏ qua metric.
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const weekNumber = parseInt(String(form.get('weekNumber') ?? '0'), 10);
  const year = parseInt(String(form.get('year') ?? '0'), 10);
  const sheetDeptName = String(form.get('sheetDeptName') ?? '');
  const departmentId = String(form.get('departmentId') ?? '');

  if (!file || !weekNumber || !year || !sheetDeptName || !departmentId) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  }

  const ab = await file.arrayBuffer();
  const parsed = parseExcelFile(ab);

  // Match sheet by either exact name or fuzzy lowercased substring (the sheet
  // may be uppercased while we received a DB-style name from the UI).
  function normalize(s: string): string {
    return s
      .toLowerCase()
      .replace(/^phòng\s+/, '')
      .replace(/^trung tâm\s+/, '')
      .replace(/^đơn vị\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const target = normalize(sheetDeptName);
  let sheetDept = parsed.departments.find((d) => d.name === sheetDeptName);
  if (!sheetDept) sheetDept = parsed.departments.find((d) => normalize(d.name) === target);
  if (!sheetDept) {
    sheetDept = parsed.departments.find((d) => {
      const n = normalize(d.name);
      return n.includes(target) || target.includes(n);
    });
  }
  if (!sheetDept) {
    return NextResponse.json(
      {
        error: `Không tìm thấy phòng "${sheetDeptName}" trong file. Các phòng trong file: ${parsed.departments.map((d) => d.name).join(', ')}`,
      },
      { status: 404 },
    );
  }

  const dbDept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dbDept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

  const masterTasks = await prisma.masterTask.findMany({ where: { departmentId }, select: { id: true, name: true } });
  const metricDefs = await prisma.metricDefinition.findMany({
    where: { departmentId, isActive: true },
    select: { id: true, name: true, unit: true },
    orderBy: { orderNumber: 'asc' },
  });
  const validTaskIds = new Set(masterTasks.map((t) => t.id));
  const validMetricIds = new Set(metricDefs.map((m) => m.id));
  const textBlob = sheetDept.tasks.map((t) => `${t.taskName}\n  → ${t.result}`).join('\n\n');

  try {
    const prompt = buildPrompt(dbDept.name, weekNumber, year, textBlob, masterTasks, metricDefs);
    const ai = await callDeepSeek(prompt);

    const cleanTasks = (ai.tasks || []).filter((t) => validTaskIds.has(t.masterTaskId));
    const cleanMetrics = (ai.metrics || []).filter((m) => validMetricIds.has(m.metricId) && m.value !== null && m.value !== undefined);
    const cleanDormant = (ai.dormantTasks || []).filter((id) => validTaskIds.has(id));

    return NextResponse.json({
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
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
