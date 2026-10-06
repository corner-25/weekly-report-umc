/**
 * Đọc chữ từ văn bản MOU lưu trong DB (bước 1 của "AI đọc biên bản MOU").
 *
 *   npx tsx prisma/mou-ocr.ts [--force] [--mou <id>]
 *
 * PDF có lớp chữ thì lấy thẳng (pdftotext); trang nào là ảnh scan thì OCR bằng
 * Tesseract tiếng Việt + Anh (200 dpi, ảnh xám). Excel đổi sang văn bản từng
 * dòng. Cần cài trên máy chạy: poppler (pdftotext, pdftoppm, pdfinfo) và
 * tesseract kèm gói ngôn ngữ vie — Railway không có, nên chạy từ máy Phòng HC.
 */
import { execFile } from 'child_process';
import { mkdtemp, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const run = promisify(execFile);
const prisma = new PrismaClient();

/** Trang có ít hơn ngần này từ ở lớp chữ coi như ảnh scan → OCR. */
const MIN_TEXT_WORDS = 40;
const OCR_DPI = '200';
const WORKERS = 3;

async function pageCount(pdf: string): Promise<number> {
  const { stdout } = await run('pdfinfo', [pdf]);
  return Number(stdout.match(/Pages:\s+(\d+)/)?.[1] ?? 0);
}

async function pageText(pdf: string, page: number, dir: string): Promise<string> {
  const { stdout } = await run('pdftotext', ['-layout', '-f', String(page), '-l', String(page), pdf, '-'], { maxBuffer: 20 << 20 });
  if (stdout.split(/\s+/).filter(Boolean).length >= MIN_TEXT_WORDS) return stdout;
  const prefix = join(dir, `p${page}`);
  await run('pdftoppm', ['-r', OCR_DPI, '-gray', '-png', '-f', String(page), '-l', String(page), pdf, prefix]);
  const image = (await readdir(dir)).find((f) => f.startsWith(`p${page}-`) || f === `p${page}.png`);
  if (!image) return stdout;
  const { stdout: ocr } = await run('tesseract', [join(dir, image), 'stdout', '-l', 'vie+eng', '--psm', '1'], { maxBuffer: 20 << 20 });
  return ocr;
}

const tidy = (s: string) => s.replace(/\f/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

async function readPdf(bytes: Buffer): Promise<{ text: string; pages: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'mou-ocr-'));
  try {
    const pdf = join(dir, 'doc.pdf');
    await writeFile(pdf, bytes);
    const pages = await pageCount(pdf);
    const parts: string[] = [];
    for (let p = 1; p <= pages; p += 1) parts.push(`--- Trang ${p} ---\n${tidy(await pageText(pdf, p, dir))}`);
    return { text: parts.join('\n\n'), pages };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function readSheet(bytes: Buffer): { text: string; pages: number } {
  const wb = XLSX.read(bytes, { type: 'buffer' });
  const text = wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false });
    return `--- Trang tính ${name} ---\n${rows.map((r) => r.map((c) => String(c ?? '').trim()).join(' | ')).join('\n')}`;
  }).join('\n\n');
  return { text, pages: wb.SheetNames.length };
}

async function main() {
  const force = process.argv.includes('--force');
  const mouArg = process.argv.indexOf('--mou');
  const docs = await prisma.mOUDocument.findMany({
    where: {
      data: { not: null },
      ...(force ? {} : { ocrText: null }),
      ...(mouArg > 0 ? { mouId: process.argv[mouArg + 1] } : {}),
    },
    select: { id: true, fileName: true, mimeType: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`${docs.length} văn bản cần đọc chữ`);
  let done = 0;
  let failed = 0;
  const queue = [...docs];
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      for (let doc = queue.shift(); doc; doc = queue.shift()) {
        const started = Date.now();
        try {
          const { data } = await prisma.mOUDocument.findUniqueOrThrow({ where: { id: doc.id }, select: { data: true } });
          const bytes = Buffer.from(data!);
          const result =
            doc.mimeType === 'application/pdf' ? await readPdf(bytes)
            : doc.mimeType?.includes('spreadsheet') ? readSheet(bytes)
            : null;
          if (!result) continue;
          await prisma.mOUDocument.update({ where: { id: doc.id }, data: { ocrText: result.text, pageCount: result.pages, ocrAt: new Date() } });
          done += 1;
          console.log(`  ✓ ${doc.fileName}: ${result.pages} trang, ${result.text.split(/\s+/).length} từ, ${Math.round((Date.now() - started) / 1000)} giây`);
        } catch (error) {
          failed += 1;
          console.error(`  ✗ ${doc.fileName}: ${(error as Error).message}`);
        }
      }
    }),
  );
  console.log(`Xong: ${done} văn bản, ${failed} lỗi`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
