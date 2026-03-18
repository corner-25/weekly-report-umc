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
 * Metrics are embedded as numbers in the task result text.
 *
 * Strategy: for each metric definition in a department, search through
 * all task results in that department for matching numbers/patterns.
 */
export function extractMetrics(
  departmentResults: Map<string, string[]>, // deptId → array of result texts
  metricDefs: MetricDefinitionRef[]
): ExtractedMetric[] {
  const extracted: ExtractedMetric[] = [];

  // Group metric definitions by department
  const metricsByDept = new Map<string, MetricDefinitionRef[]>();
  for (const md of metricDefs) {
    const list = metricsByDept.get(md.departmentId) || [];
    list.push(md);
    metricsByDept.set(md.departmentId, list);
  }

  for (const [deptId, metrics] of metricsByDept) {
    const results = departmentResults.get(deptId) || [];
    const allText = results.join('\n');

    for (const metric of metrics) {
      const value = extractValueForMetric(metric, allText);
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

interface ExtractResult {
  value: number;
  note: string | null;
  exact: boolean;
}

/**
 * Try to extract a numeric value for a specific metric from the combined result text.
 */
function extractValueForMetric(
  metric: MetricDefinitionRef,
  text: string
): ExtractResult | null {
  const metricName = metric.name.toLowerCase();

  // Strategy 1: Look for patterns like "metricName: NUMBER" or "metricName là NUMBER"
  const patterns = buildSearchPatterns(metricName);

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numStr = match[1] || match[2];
      if (numStr) {
        const value = parseVietnameseNumber(numStr);
        if (value !== null) {
          return { value, note: null, exact: true };
        }
      }
    }
  }

  // Strategy 2: Look for the metric name keyword near a number
  const keywordValue = searchByKeyword(metricName, text);
  if (keywordValue !== null) {
    return { value: keywordValue.value, note: keywordValue.note, exact: false };
  }

  return null;
}

function buildSearchPatterns(metricName: string): RegExp[] {
  // Escape special regex characters
  const escaped = metricName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns: RegExp[] = [];

  // "metric name: NUMBER" or "metric name: NUMBER unit"
  patterns.push(new RegExp(escaped + '\\s*[:\\-]\\s*([\\d.,]+)', 'i'));
  // "metric name là NUMBER"
  patterns.push(new RegExp(escaped + '\\s+là\\s+([\\d.,]+)', 'i'));
  // "NUMBER metric name"
  patterns.push(new RegExp('([\\d.,]+)\\s+' + escaped, 'i'));
  // "metric name ... NUMBER" (within same line)
  patterns.push(new RegExp(escaped + '[^\\n]{0,50}?([\\d][\\d.,]*)', 'i'));

  return patterns;
}

function searchByKeyword(
  metricName: string,
  text: string
): { value: number; note: string | null } | null {
  // Extract key tokens from metric name
  const tokens = metricName
    .split(/\s+/)
    .filter(t => t.length > 2)
    .filter(t => !['số', 'các', 'của', 'cho', 'tại', 'trong', 'theo'].includes(t));

  if (tokens.length === 0) return null;

  // Find lines containing most of the key tokens
  const lines = text.split('\n');
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const matchCount = tokens.filter(t => lineLower.includes(t)).length;

    if (matchCount >= Math.ceil(tokens.length * 0.6)) {
      // Extract the first number from this line
      const numMatch = line.match(/([\d][[\d.,]*[\d]|[\d])/);
      if (numMatch) {
        const value = parseVietnameseNumber(numMatch[0]);
        if (value !== null) {
          return { value, note: line.trim().substring(0, 200) };
        }
      }
    }
  }

  return null;
}
