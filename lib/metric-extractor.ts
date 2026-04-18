import { parseVietnameseNumber } from './excel-parser';

export interface MetricDefinitionRef {
  id: string;
  name: string;
  unit: string | null;
  departmentId: string;
  departmentName: string;
  orderNumber: number;
}

export interface ExtractedMetric {
  metricId: string;
  metricName: string;
  value: number | null;
  note: string | null;
  confidence: 'exact' | 'extracted' | 'missing';
  departmentName: string;
}

/**
 * Extract metric values from task results for each department.
 */
export function extractMetrics(
  departmentResults: Map<string, string[]>,
  metricDefs: MetricDefinitionRef[]
): ExtractedMetric[] {
  const extracted: ExtractedMetric[] = [];

  const metricsByDept = new Map<string, MetricDefinitionRef[]>();
  for (const md of metricDefs) {
    const list = metricsByDept.get(md.departmentId) || [];
    list.push(md);
    metricsByDept.set(md.departmentId, list);
  }

  for (const [deptId, metrics] of metricsByDept) {
    const results = departmentResults.get(deptId) || [];
    // Build line index with section context (e.g., "- Facebook:", "Ngoại trú:")
    const lines: LineEntry[] = [];
    for (let i = 0; i < results.length; i++) {
      const taskLines = results[i].split('\n');
      let lastSection = '';
      let lastSubSection = ''; // e.g., "kho hoá chất sát khuẩn", "trong nước"
      for (const line of taskLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Detect social media section headers
        const sectionMatch = trimmed.match(/^[-\s]*(Facebook|Website|Zalo|Youtube|TikTok)\s*:/i);
        if (sectionMatch) {
          lastSection = sectionMatch[1].toLowerCase();
        }
        // Detect warehouse sub-sections: "Công tác quản lý kho XXX"
        const warehouseMatch = trimmed.match(/[Cc]ông tác quản lý kho\s+(.+)/i);
        if (warehouseMatch) {
          lastSubSection = warehouseMatch[1].toLowerCase().replace(/\s+/g, ' ').trim();
        }
        // Detect in/out country sub-sections
        if (/^\+?\s*(trong nước|ngoài nước|nước ngoài)\s*:/i.test(trimmed)) {
          // keep lastSubSection as-is, the text itself has the context
        }
        lines.push({ text: trimmed, taskIdx: i, section: lastSection, subSection: lastSubSection });
      }
    }

    for (const metric of metrics) {
      const value = extractValueForMetric(metric, lines);
      extracted.push({
        metricId: metric.id,
        metricName: metric.name,
        value: value?.value ?? null,
        note: value?.note ?? null,
        confidence: value ? (value.exact ? 'exact' : 'extracted') : 'missing',
        departmentName: metric.departmentName,
      });
    }
  }

  return extracted;
}

interface LineEntry {
  text: string;
  taskIdx: number;
  section: string; // e.g., 'facebook', 'website', 'zalo', 'youtube', 'tiktok', ''
  subSection: string; // e.g., 'hoá chất sát khuẩn', 'vật tư thông dụng', etc.
}

interface ExtractResult {
  value: number;
  note: string | null;
  exact: boolean;
}

function extractValueForMetric(
  metric: MetricDefinitionRef,
  lines: LineEntry[]
): ExtractResult | null {
  const metricLower = metric.name.toLowerCase();
  const keyTerms = extractKeyTerms(metricLower);
  if (keyTerms.length === 0) return null;

  // 1. Check for department-suffix metrics first (e.g., "Soát xét ... từ Phòng KHTH")
  const deptSuffix = extractDepartmentSuffix(metric.name);
  if (deptSuffix) {
    const result = extractFromDeptSuffix(deptSuffix, lines);
    if (result) return result;
  }

  // 2. Warehouse metrics (Nhập kho / Xuất kho with subSection context)
  const warehouseCtx = extractWarehouseContext(metricLower);
  if (warehouseCtx) {
    const result = extractFromWarehouseLines(warehouseCtx, metricLower, lines, metric.unit);
    if (result) return result;
  }

  // 3. NCKH breakdown in parentheses: "224 đề tài (59 TS, 74 ThS, 07 BS CKII, 39 BSNT, 45 SV-khác)"
  const nckhKey = extractNCKHKey(metricLower);
  if (nckhKey) {
    const result = extractFromNCKHBreakdown(nckhKey, lines);
    if (result) return result;
  }

  // 4. Bảo trì TBYT: "Tổng số công việc tiếp nhận: 201", "Đã hoàn thành: 101"
  const btKey = extractBaoTriKey(metricLower);
  if (btKey) {
    for (const { text } of lines) {
      const lineLower = text.toLowerCase();
      if (lineLower.includes(btKey)) {
        const numbers = extractCleanNumbers(text);
        if (numbers.length > 0) return { value: numbers[0], note: text.substring(0, 200), exact: true };
      }
    }
  }

  // 5. Header-context sub-item matching (e.g., "đào tạo" header + "+ Trong nước: 32")
  const headerCtx = extractHeaderContext(metricLower);
  if (headerCtx) {
    const result = extractFromHeaderSubItem(headerCtx, lines);
    if (result) return result;
  }

  // 6. Determine required context filters
  const requiredPlatform = extractPlatformContext(metricLower);
  const requiredPrefix = extractPrefixContext(metricLower); // 'ngoại trú' | 'nội trú' | null
  const isCommercial = metricLower.includes('thương mại');

  // 6. Iterate lines with context filtering
  for (const entry of lines) {
    const { text, section } = entry;
    const lineLower = text.toLowerCase();

    // Platform filter: if metric is for Facebook, only match lines in Facebook section
    if (requiredPlatform && section !== requiredPlatform) continue;

    // For insurance metrics with ngoại trú / nội trú prefix
    if (requiredPrefix) {
      // Commercial insurance has different data format
      if (isCommercial) {
        if (!lineLower.startsWith(requiredPrefix + ':') && !lineLower.startsWith(requiredPrefix + ' :')) continue;
        if (lineLower.includes('bhyt')) continue;

        const result = extractFromInsuranceLine(text, metric, metricLower);
        if (result) return result;
        continue;
      }

      // BHYT metrics: line must start with the right prefix
      if (!lineLower.startsWith(requiredPrefix)) continue;

      const result = extractFromInsuranceLine(text, metric, metricLower);
      if (result) return result;
      continue;
    }

    // Check distinguishing terms — if metric has them, the line must contain at least one
    const distinguishing = getDistinguishingTerms(metricLower);
    if (distinguishing.length > 0) {
      const hasDistinguishing = distinguishing.some(dt => lineLower.includes(dt));
      if (!hasDistinguishing) continue;
    }

    // For segmented lines (with ;), try segment-level matching
    if (text.includes(';')) {
      const result = extractFromSegmentedLine(text, metric, keyTerms, metricLower);
      if (result) return result;
    }

    // Regular line matching
    const matchScore = scoreLineMatch(keyTerms, lineLower);

    // For platform-filtered lines, use alias matching for precision
    if (requiredPlatform) {
      const aliasResult = matchPlatformAlias(metricLower, lineLower);
      // If alias returns false explicitly (line has exclusion keywords), skip this line
      if (!aliasResult && matchScore < 0.6) continue;
      if (!aliasResult) continue; // platform metrics should use alias matching
    } else {
      if (matchScore < 0.6) continue;
    }

    const value = extractNumberFromLine(text, metricLower, metric.unit);
    if (value !== null) {
      return { value, note: text.substring(0, 200), exact: matchScore >= 0.8 };
    }
  }

  // Fallback: exact name match with "NAME: NUMBER" pattern
  const escapedName = escapeRegex(metric.name);
  for (const { text } of lines) {
    const match = text.match(new RegExp(escapedName + '\\s*[:\\-=]\\s*([\\d][\\d.,]*)', 'i'));
    if (match) {
      const num = parseCleanNumber(match[1]);
      if (num !== null) {
        return { value: num, note: text.substring(0, 200), exact: true };
      }
    }
  }

  return null;
}

/**
 * Extract from insurance data lines like:
 * "Ngoại trú: Số lượt KCB BHYT là 4.631 lượt ..., Chi phí KCB BHYT thanh toán là 6.714.514.713 đồng ..."
 * "Ngoại trú: 226 lượt; tổng viện phí: 380.059.063 đồng; số tiền được bảo lãnh: 280.637.005 đồng"
 */
function extractFromInsuranceLine(
  line: string,
  metric: MetricDefinitionRef,
  metricLower: string
): ExtractResult | null {
  const isCost = metricLower.includes('chi phí');
  const isCount = metricLower.includes('lượt');
  const isFeeGuaranteed = metricLower.includes('bảo lãnh') || metricLower.includes('kinh phí');
  const isManagementCost = metricLower.includes('quản lý');

  // For commercial insurance with semicolons
  if (line.includes(';')) {
    const segments = line.split(';').map(s => s.trim());

    // Check specific types first (management cost, fee guaranteed) before general cost
    if (isManagementCost) {
      for (const seg of segments) {
        if (seg.toLowerCase().includes('quản lý')) {
          const moneyMatch = seg.match(/([\d.,]+)\s*(?:đồng|đ|VND)/i);
          if (moneyMatch) {
            const val = parseMoneyNumber(moneyMatch[1]);
            if (val !== null) return { value: val, note: line.substring(0, 200), exact: true };
          }
        }
      }
    }
    if (isFeeGuaranteed) {
      for (const seg of segments) {
        if (seg.toLowerCase().includes('bảo lãnh')) {
          const moneyMatch = seg.match(/([\d.,]+)\s*(?:đồng|đ|VND)/i);
          if (moneyMatch) {
            const val = parseMoneyNumber(moneyMatch[1]);
            if (val !== null) return { value: val, note: line.substring(0, 200), exact: true };
          }
        }
      }
    }

    for (const seg of segments) {
      const segLower = seg.toLowerCase();

      if (isCount && (segLower.includes('lượt') || segLower.match(/^\d/))) {
        const numbers = extractCleanNumbers(seg);
        if (numbers.length > 0) return { value: numbers[0], note: line.substring(0, 200), exact: true };
      }
      // General cost check — only if not management or guaranteed fee (already handled above)
      if (isCost && !isManagementCost && !isFeeGuaranteed && (segLower.includes('viện phí') || segLower.includes('tổng'))) {
        const moneyMatch = seg.match(/([\d.,]+)\s*(?:đồng|đ|VND)/i);
        if (moneyMatch) {
          const val = parseMoneyNumber(moneyMatch[1]);
          if (val !== null) return { value: val, note: line.substring(0, 200), exact: true };
        }
      }
    }
  }

  // For BHYT lines: "Số lượt KCB BHYT là 4.631 lượt ..., Chi phí KCB BHYT thanh toán là 6.714.514.713 đồng"
  if (isCost) {
    const costMatch = line.match(/[Cc]hi phí[^,]*?(?:là|:)\s*([\d][\d.,]*)\s*(?:đồng|đ)/);
    if (costMatch) {
      const val = parseMoneyNumber(costMatch[1]);
      if (val !== null) return { value: val, note: line.substring(0, 200), exact: true };
    }
  }

  if (isCount) {
    const countMatch = line.match(/[Ss]ố lượt[^,]*?(?:là|:)\s*([\d][\d.,]*)\s*lượt/);
    if (countMatch) {
      const val = parseCleanNumber(countMatch[1]);
      if (val !== null) return { value: val, note: line.substring(0, 200), exact: true };
    }
    // Also try just the first number before "lượt"
    const simpleLuot = line.match(/([\d][\d.,]*)\s*lượt/);
    if (simpleLuot) {
      const val = parseCleanNumber(simpleLuot[1]);
      if (val !== null) return { value: val, note: line.substring(0, 200), exact: true };
    }
  }

  return null;
}

/**
 * Extract from department-suffix metrics.
 * Raw text format:
 *   "1.1\tSoát xét pháp lý hồ sơ trình ký: 71 hồ sơ"
 *   "-\tPhòng KHTH: 01"
 *   "-\tPhòng KH&ĐT: 38"
 */
function extractFromDeptSuffix(deptLabel: string, lines: LineEntry[]): ExtractResult | null {
  if (!deptLabel) return null;

  for (const { text } of lines) {
    // Only match lines where the label is followed by a colon and number
    // e.g., "-\tPhòng KHTH: 01" or "-\tCơ sở 2: 01"
    const match = text.match(new RegExp(escapeRegex(deptLabel) + '\\s*:\\s*(\\d[\\d.,]*)', 'i'));
    if (match) {
      const val = parseCleanNumber(match[1]);
      if (val !== null) return { value: val, note: text.substring(0, 200), exact: true };
    }
  }
  return null;
}

/**
 * Extract from segmented lines (with ;)
 * e.g., "125 văn bản đi; 75 quyết định; 195 hợp đồng"
 * e.g., "1042 cuộc gọi đến; nhỡ do từ chối: 54 cuộc; nhỡ do không bắt máy: 177 cuộc"
 */
function extractFromSegmentedLine(
  line: string,
  metric: MetricDefinitionRef,
  keyTerms: string[],
  metricLower: string
): ExtractResult | null {
  const segments = line.split(';').map(s => s.trim());
  const distinguishing = getDistinguishingTerms(metricLower);

  for (const segment of segments) {
    if (!segment) continue;
    const segLower = segment.toLowerCase();

    // If we have distinguishing terms, require at least one to match
    if (distinguishing.length > 0) {
      const hasMatch = distinguishing.some(dt => segLower.includes(dt));
      if (!hasMatch) continue;
    } else {
      // No distinguishing terms - use key term matching
      const score = scoreLineMatch(keyTerms, segLower);
      if (score < 0.5) continue;
    }

    // For money metrics, look for money patterns
    if (metric.unit === 'đồng') {
      const moneyMatch = segment.match(/([\d.,]+)\s*(?:VND|đồng|đ)/i);
      if (moneyMatch) {
        const val = parseMoneyNumber(moneyMatch[1]);
        if (val !== null) return { value: val, note: line.substring(0, 200), exact: true };
      }
    }

    const numbers = extractCleanNumbers(segment);
    if (numbers.length > 0) {
      return { value: numbers[0], note: line.substring(0, 200), exact: true };
    }
  }

  return null;
}

/**
 * Extract the department label that appears in raw data.
 * "Soát xét pháp lý hồ sơ trình ký từ Phòng KHTH" → "Phòng KHTH"
 */
function extractDepartmentSuffix(metricName: string): string | null {
  const match = metricName.match(/từ\s+(.+)$/i);
  if (!match) return null;
  const suffix = match[1].trim();

  // Map metric names to what appears in the raw text lines
  const abbrevMap: Record<string, string> = {
    'Phòng KHTH': 'Phòng KHTH',
    'Phòng Hành chính': 'Phòng HC',
    'Phòng CTXH': 'Phòng CTXH',
    'Trung tâm TT': 'Trung tâm TT',
    'Phòng TCKT': 'Phòng TCKT',
    'Đơn vị QLĐT': 'Đơn vị QLĐT',
    'Phòng QTTN': 'Phòng QTTN',
    'Phòng CNTT': 'Phòng CNTT',
    'Phòng KHĐT': 'Phòng KH&ĐT',
    'Phòng VTTB': 'Phòng VTTB',
    'Phòng TCCB': 'Phòng TCCB',
    'Phòng Điều dưỡng': 'Phòng Điều dưỡng',
    'Khoa KSKTYC': 'Khoa KSKTYC',
    'CS2': 'Cơ sở 2',
    'CS3': 'Cơ sở 3',
    'Các đơn vị khác': '', // no specific label in data
  };

  return abbrevMap[suffix] ?? suffix;
}

/**
 * Extract platform context from metric name.
 * "Số tin đăng Facebook" → 'facebook'
 */
function extractPlatformContext(metricLower: string): string | null {
  if (metricLower.includes('facebook')) return 'facebook';
  if (metricLower.includes('website')) return 'website';
  if (metricLower.includes('zalo')) return 'zalo';
  if (metricLower.includes('youtube')) return 'youtube';
  if (metricLower.includes('tiktok')) return 'tiktok';
  return null;
}

/**
 * Extract prefix context: 'ngoại trú' or 'nội trú'
 */
function extractPrefixContext(metricLower: string): string | null {
  if (metricLower.includes('ngoại trú')) return 'ngoại trú';
  if (metricLower.includes('nội trú')) return 'nội trú';
  return null;
}

/**
 * Get distinguishing terms for disambiguation.
 */
function getDistinguishingTerms(metricLower: string): string[] {
  const terms: string[] = [];

  if (metricLower.includes('quyết định')) terms.push('quyết định');
  if (metricLower.includes('hợp đồng')) terms.push('hợp đồng');
  if (metricLower.includes('văn bản đi')) terms.push('văn bản đi');
  if (metricLower.includes('văn bản đến')) terms.push('văn bản đến');
  if (metricLower.includes('từ chối')) terms.push('từ chối');
  if (metricLower.includes('không bắt máy')) terms.push('không bắt máy');
  if (metricLower.includes('đường dây nóng')) terms.push('đường dây nóng');

  // Revenue: distinguish tổ xe vs bãi xe by line content
  if (metricLower.includes('bãi xe')) terms.push('bãi xe');
  if (metricLower.includes('tổ xe') && !metricLower.includes('bãi xe')) terms.push('doanh thu');

  // Country context: trong nước / ngoài nước
  if (metricLower.includes('trong nước')) terms.push('trong nước');
  if (metricLower.includes('ngoài nước') || metricLower.includes('nước ngoài')) terms.push('nước ngoài', 'ngoài nước');

  return terms;
}

/**
 * Detect metrics that need header-context matching.
 * Pattern: a header line contains context keywords, followed by sub-items with "trong nước" / "ngoài nước".
 * e.g., "VC-NLĐ tham gia chương trình đào tạo trong nước" →
 *   headerKeywords: ["đào tạo"], subItemKey: "trong nước"
 */
function extractHeaderContext(metricLower: string): { headerKeywords: string[]; subItemKey: string } | null {
  // Only for VC-NLĐ metrics with country context
  if (!metricLower.includes('vc-nlđ')) return null;

  let subItemKey: string | null = null;
  if (metricLower.includes('trong nước')) subItemKey = 'trong nước';
  else if (metricLower.includes('ngoài nước') || metricLower.includes('nước ngoài')) subItemKey = 'nước ngoài';
  if (!subItemKey) return null;

  const headerKeywords: string[] = [];
  if (metricLower.includes('đào tạo')) headerKeywords.push('đào tạo');
  if (metricLower.includes('tham quan')) headerKeywords.push('tham quan');
  if (headerKeywords.length === 0) return null;

  return { headerKeywords, subItemKey };
}

/**
 * Extract value from sub-items that follow a header line.
 * Looks for a header containing headerKeywords, then finds a "+ Trong nước: 32" sub-item after it.
 */
function extractFromHeaderSubItem(
  ctx: { headerKeywords: string[]; subItemKey: string },
  lines: LineEntry[]
): ExtractResult | null {
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].text.toLowerCase();
    // Check if this line is a header containing our context keywords
    const isHeader = ctx.headerKeywords.every(kw => lineLower.includes(kw));
    if (!isHeader) continue;
    // Must look like a header (ends with : or contains "hồ sơ cử" / "cử viên chức")
    if (!lineLower.includes(':') && !lineLower.includes('cử') && !lineLower.includes('tham gia')) continue;

    // Look at subsequent lines in the same task for the sub-item
    for (let j = i + 1; j < lines.length && j <= i + 5; j++) {
      // Stop if we hit a different task
      if (lines[j].taskIdx !== lines[i].taskIdx) break;
      const subLower = lines[j].text.toLowerCase();
      // Match "trong nước" or "nước ngoài" / "ngoài nước"
      if (ctx.subItemKey === 'trong nước' && subLower.includes('trong nước')) {
        const numbers = extractCleanNumbers(lines[j].text);
        if (numbers.length > 0) return { value: numbers[0], note: lines[j].text.substring(0, 200), exact: true };
      }
      if (ctx.subItemKey === 'nước ngoài' && (subLower.includes('ngoài nước') || subLower.includes('nước ngoài'))) {
        const numbers = extractCleanNumbers(lines[j].text);
        if (numbers.length > 0) return { value: numbers[0], note: lines[j].text.substring(0, 200), exact: true };
      }
    }
  }
  return null;
}

/**
 * Extract number from a simple line.
 */
function extractNumberFromLine(
  line: string,
  _metricNameLower: string,
  unit: string | null
): number | null {
  const numbers = extractCleanNumbers(line);
  if (numbers.length === 0) return null;

  if (unit === 'đồng') {
    const moneyMatch = line.match(/([\d.,]+)\s*(?:VND|đồng|đ)/i);
    if (moneyMatch) {
      const val = parseMoneyNumber(moneyMatch[1]);
      if (val !== null) return val;
    }
    return Math.max(...numbers);
  }

  if (unit === '%') {
    const pctMatch = line.match(/([\d.,]+)\s*%/);
    if (pctMatch) {
      const val = parseCleanNumber(pctMatch[1]);
      if (val !== null) return val;
    }
    for (const num of numbers) {
      if (num >= 0 && num <= 100) return num;
    }
  }

  return numbers[0];
}

/**
 * Extract clean numbers from text, filtering out dates, section numbers, etc.
 */
function extractCleanNumbers(text: string): number[] {
  const numbers: number[] = [];

  let cleaned = text.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' ');
  cleaned = cleaned.replace(/\d{1,2}[gh:]\d{0,2}/gi, ' ');
  cleaned = cleaned.replace(/\b20[12]\d\b/g, ' ');
  cleaned = cleaned.replace(/\d+\/[A-ZĐ]+[\-A-Z]*/gi, ' ');
  cleaned = cleaned.replace(/^\d+\.\d+\.?\s/g, ' ');
  cleaned = cleaned.replace(/(?:giảm|tăng)\s+\d+%/gi, ' ');

  const numPattern = /(?:^|[\s:=\-(/])(\d[\d.,]*\d|\d)(?=[\s%):;,.\-/đVND]|$)/g;
  let match;
  while ((match = numPattern.exec(cleaned)) !== null) {
    const numStr = match[1];
    if (/^\d\.\d$/.test(numStr)) continue;
    if (/^\d+\.\d{1}$/.test(numStr) && parseFloat(numStr) < 20) continue;

    const val = parseCleanNumber(numStr);
    if (val !== null && val >= 0) {
      numbers.push(val);
    }
  }

  return numbers;
}

/**
 * Parse a money number string like "97,720,000" or "6.714.514.713"
 * Money numbers use comma as thousands separator in some contexts.
 */
function parseMoneyNumber(str: string): number | null {
  if (!str) return null;
  let cleaned = str.trim().replace(/VND$/i, '').replace(/đ$/i, '').trim();

  // If it has commas and digits between commas are groups of 3, commas are thousands separators
  // e.g., "97,720,000" → 97720000
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length > 1 && parts.slice(1).every(p => p.length === 3 && /^\d+$/.test(p))) {
      cleaned = cleaned.replace(/,/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }
  }

  // Fall back to Vietnamese number parser
  return parseVietnameseNumber(cleaned);
}

function parseCleanNumber(str: string): number | null {
  if (!str) return null;
  let cleaned = str.trim().replace(/VND$/i, '').trim();
  return parseVietnameseNumber(cleaned);
}

function extractKeyTerms(metricNameLower: string): string[] {
  const stopWords = new Set([
    'số', 'các', 'của', 'cho', 'tại', 'trong', 'theo', 'từ', 'đến',
    'và', 'là', 'có', 'được', 'về', 'với', 'trên', 'đã', 'đang',
    'bệnh', 'viện', 'lượt', 'đồng', 'người', 'hồ', 'sơ',
  ]);

  return metricNameLower
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !stopWords.has(t));
}

function scoreLineMatch(keyTerms: string[], lineLower: string): number {
  if (keyTerms.length === 0) return 0;
  const matched = keyTerms.filter(term => lineLower.includes(term)).length;
  return matched / keyTerms.length;
}

/**
 * Extract warehouse context from metric name.
 * "Nhập kho hoá chất sát khuẩn" → { action: 'nhập kho', warehouse: 'hoá chất sát khuẩn' }
 * "Xuất kho Vật tư thông dụng" → { action: 'xuất kho', warehouse: 'vật tư thông dụng' }
 */
function extractWarehouseContext(metricLower: string): { action: string; warehouse: string } | null {
  const match = metricLower.match(/(nhập kho|xuất kho)\s+(.+)/);
  if (!match) return null;
  return { action: match[1], warehouse: match[2].trim() };
}

/**
 * Extract value from warehouse lines using subSection context.
 * Data: "Nhập kho từ ngày 13/03/2026 đến 19/03/2026: 350.505.560VND"
 * under subSection "hoá chất sát khuẩn"
 */
function extractFromWarehouseLines(
  ctx: { action: string; warehouse: string },
  _metricLower: string,
  lines: LineEntry[],
  unit: string | null
): ExtractResult | null {
  for (const { text, subSection } of lines) {
    // subSection must match warehouse type
    if (!subSection.includes(ctx.warehouse) && !ctx.warehouse.includes(subSection)) {
      // Try fuzzy: "vật tư thông dụng" vs "vật tư thông dụng"
      const warehouseTerms = ctx.warehouse.split(/\s+/).filter(t => t.length > 2);
      const subTerms = subSection.split(/\s+/);
      const overlap = warehouseTerms.filter(t => subTerms.some(st => st.includes(t) || t.includes(st))).length;
      if (overlap < warehouseTerms.length * 0.5) continue;
    }

    const lineLower = text.toLowerCase();
    if (!lineLower.includes(ctx.action)) continue;

    // Look for money value: "350.505.560VND" or ": NUMBER VND"
    const moneyMatch = text.match(/([\d.,]+)\s*VND/i);
    if (moneyMatch) {
      const val = parseMoneyNumber(moneyMatch[1]);
      if (val !== null) return { value: val, note: text.substring(0, 200), exact: true };
    }

    if (unit === 'đồng') {
      const moneyMatch2 = text.match(/([\d.,]+)\s*(?:đồng|đ)/i);
      if (moneyMatch2) {
        const val = parseMoneyNumber(moneyMatch2[1]);
        if (val !== null) return { value: val, note: text.substring(0, 200), exact: true };
      }
    }

    const numbers = extractCleanNumbers(text);
    if (numbers.length > 0) {
      return { value: numbers[numbers.length - 1], note: text.substring(0, 200), exact: true };
    }
  }
  return null;
}

/**
 * Extract NCKH key for breakdown in parentheses.
 * "Cung cấp số liệu NCKH cho đề tài TS" → 'TS'
 * "Cung cấp số liệu NCKH cho đề tài ThS" → 'ThS'
 * "Đề tài NCKH cấp tỉnh đang thực hiện" → 'cấp tỉnh'
 */
function extractNCKHKey(metricLower: string): string | null {
  if (!metricLower.includes('nckh') && !metricLower.includes('nghiên cứu')) return null;

  // "Cung cấp số liệu NCKH cho đề tài XXX"
  const deMatch = metricLower.match(/đề tài\s+(ts|ths|ck2|bsnt|sinh viên|khác|sv)/i);
  if (deMatch) return deMatch[1].toLowerCase();

  // "Đề tài NCKH cấp tỉnh đang thực hiện"
  if (metricLower.includes('cấp tỉnh')) return 'cấp tỉnh';

  return null;
}

/**
 * Extract from NCKH breakdown.
 * "- 224 đề tài (59 TS, 74 ThS, 07 BS CKII, 39 BSNT, 45 SV-khác)"
 * "- Cấp tỉnh (Sở KHCN TPHCM): 05 đề tài"
 */
function extractFromNCKHBreakdown(key: string, lines: LineEntry[]): ExtractResult | null {
  if (key === 'cấp tỉnh') {
    for (const { text } of lines) {
      if (text.toLowerCase().includes('cấp tỉnh')) {
        const numbers = extractCleanNumbers(text);
        if (numbers.length > 0) return { value: numbers[0], note: text.substring(0, 200), exact: true };
      }
    }
    return null;
  }

  // Look for parenthesized breakdown: "(59 TS, 74 ThS, 07 BS CKII, 39 BSNT, 45 SV-khác)"
  for (const { text } of lines) {
    const parenMatch = text.match(/\(([^)]+)\)/);
    if (!parenMatch) continue;
    const inside = parenMatch[1];

    // Map keys to what appears in parentheses
    const keyMap: Record<string, RegExp> = {
      'ts': /(\d+)\s*TS\b/i,
      'ths': /(\d+)\s*ThS\b/i,
      'ck2': /(\d+)\s*(?:BS\s*)?CK\s*II/i,
      'bsnt': /(\d+)\s*BSNT/i,
      'sinh viên': /(\d+)\s*SV/i,
      'khác': /(\d+)\s*(?:SV[- ]?khác|khác)/i,
      'sv': /(\d+)\s*SV/i,
    };

    const pattern = keyMap[key];
    if (!pattern) continue;

    const match = inside.match(pattern);
    if (match) {
      const val = parseInt(match[1], 10);
      return { value: val, note: text.substring(0, 200), exact: true };
    }
  }
  return null;
}

/**
 * Extract bảo trì key for TBYT metrics.
 * "Đề nghị, công tác bảo trì bảo dưỡng TBYT phát sinh" → 'tiếp nhận'
 * "Đề nghị, công tác bảo trì bảo dưỡng TBYT đã hoàn thành" → 'hoàn thành'
 */
function extractBaoTriKey(metricLower: string): string | null {
  if (!metricLower.includes('bảo trì') && !metricLower.includes('thanh lý')) return null;

  if (metricLower.includes('phát sinh') || metricLower.includes('nhận được') || metricLower.includes('tiếp nhận')) return 'tiếp nhận';
  if (metricLower.includes('hoàn thành') || metricLower.includes('đã hoàn')) return 'hoàn thành';
  return null;
}

/**
 * Match platform metric names to line content using keyword aliases.
 * e.g., "Số tin đăng Facebook" should match "Đăng bài viết trên Fanpage: 10 bài"
 */
function matchPlatformAlias(metricLower: string, lineLower: string): boolean {
  // Order matters: more specific patterns first to avoid false matches
  const aliases: [RegExp, string[], string[]][] = [
    // [metric pattern, MUST match in line, must NOT match in line]
    // "Số tin đăng" → đăng bài (NOT tin nhắn)
    [/tin đăng/, ['đăng bài'], ['tin nhắn']],
    // "Số lượt xem bài viết" → lượt xem bài viết, tổng số lượt xem
    [/lượt xem bài/, ['lượt xem'], []],
    // "Số lượt xem" (generic) → lượt xem
    [/lượt xem/, ['lượt xem'], []],
    // "Số lượt theo dõi" → theo dõi trang, người theo dõi
    [/lượt theo dõi/, ['theo dõi'], ['đăng ký']],
    // "Số lượt đăng ký" → đăng ký theo dõi (NOT video đăng tải)
    [/đăng ký/, ['đăng ký'], ['video']],
    // "Số lượt thích" → lượt thích
    [/lượt thích/, ['lượt thích'], []],
    // "Số lượt quan tâm" → quan tâm
    [/quan tâm/, ['quan tâm'], []],
    // "Lượt tương tác bài viết" → tương tác bài viết
    [/tương tác/, ['tương tác'], []],
    // "Số video đăng" → video đăng tải
    [/video đăng/, ['video đăng'], []],
    // "Số lượt truy cập" → lượt truy cập
    [/truy cập/, ['truy cập'], []],
  ];

  for (const [pattern, mustMatch, mustNotMatch] of aliases) {
    if (pattern.test(metricLower)) {
      const hasMatch = mustMatch.some(kw => lineLower.includes(kw));
      const hasExclude = mustNotMatch.length > 0 && mustNotMatch.some(kw => lineLower.includes(kw));
      return hasMatch && !hasExclude;
    }
  }
  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
