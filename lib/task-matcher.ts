import type { ParsedDepartment } from './excel-parser';

export interface MasterTaskRef {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

export interface MatchedTask {
  orderNumber: number;
  taskName: string;        // from Excel
  result: string;
  timePeriod: string;
  progress: number | null;
  isImportant: boolean;
  masterTaskId: string | null;
  masterTaskName: string | null;
  matchConfidence: 'exact' | 'high' | 'medium' | 'low' | 'none';
  departmentName: string;
}

export interface MatchedDepartment {
  departmentId: string | null;
  departmentName: string;    // from Excel
  matchedName: string | null; // from DB
  tasks: MatchedTask[];
}

export interface MatchResult {
  departments: MatchedDepartment[];
  stats: {
    totalTasks: number;
    matchedTasks: number;
    unmatchedTasks: number;
    matchedDepartments: number;
    unmatchedDepartments: number;
  };
}

interface DepartmentRef {
  id: string;
  name: string;
}

/**
 * Match parsed Excel departments/tasks to existing DB records.
 */
export function matchTasksToMaster(
  parsed: ParsedDepartment[],
  masterTasks: MasterTaskRef[],
  departments: DepartmentRef[]
): MatchResult {
  const result: MatchedDepartment[] = [];
  let totalTasks = 0;
  let matchedTasks = 0;
  let matchedDepts = 0;

  for (const parsedDept of parsed) {
    // Match department
    const dept = matchDepartment(parsedDept.name, departments);
    const deptMasterTasks = dept
      ? masterTasks.filter(mt => mt.departmentId === dept.id)
      : [];

    if (dept) matchedDepts++;

    const matchedDept: MatchedDepartment = {
      departmentId: dept?.id ?? null,
      departmentName: parsedDept.name,
      matchedName: dept?.name ?? null,
      tasks: [],
    };

    // Track which master tasks have been used to avoid double-matching
    const usedMasterTaskIds = new Set<string>();

    for (const task of parsedDept.tasks) {
      totalTasks++;
      const match = findBestMatch(task.taskName, deptMasterTasks, usedMasterTaskIds);

      if (match) {
        usedMasterTaskIds.add(match.task.id);
        matchedTasks++;
      }

      matchedDept.tasks.push({
        orderNumber: task.orderNumber,
        taskName: task.taskName,
        result: task.result,
        timePeriod: task.timePeriod,
        progress: task.progress,
        isImportant: task.isImportant,
        masterTaskId: match?.task.id ?? null,
        masterTaskName: match?.task.name ?? null,
        matchConfidence: match?.confidence ?? 'none',
        departmentName: parsedDept.name,
      });
    }

    result.push(matchedDept);
  }

  return {
    departments: result,
    stats: {
      totalTasks,
      matchedTasks,
      unmatchedTasks: totalTasks - matchedTasks,
      matchedDepartments: matchedDepts,
      unmatchedDepartments: parsed.length - matchedDepts,
    },
  };
}

/**
 * Match Excel department name to DB department.
 * Uses normalized uppercase comparison.
 */
function matchDepartment(
  excelName: string,
  departments: DepartmentRef[]
): DepartmentRef | null {
  const normalized = normalizeName(excelName);

  // Exact match
  for (const dept of departments) {
    if (normalizeName(dept.name) === normalized) return dept;
  }

  // Contains match
  for (const dept of departments) {
    const dbNorm = normalizeName(dept.name);
    if (normalized.includes(dbNorm) || dbNorm.includes(normalized)) return dept;
  }

  // Token overlap
  const excelTokens = tokenize(normalized);
  let bestDept: DepartmentRef | null = null;
  let bestScore = 0;

  for (const dept of departments) {
    const dbTokens = tokenize(normalizeName(dept.name));
    const score = jaccardSimilarity(excelTokens, dbTokens);
    if (score > bestScore && score > 0.5) {
      bestScore = score;
      bestDept = dept;
    }
  }

  return bestDept;
}

function findBestMatch(
  taskName: string,
  masterTasks: MasterTaskRef[],
  usedIds: Set<string>
): { task: MasterTaskRef; confidence: 'exact' | 'high' | 'medium' | 'low' } | null {
  const normalized = normalizeName(taskName);
  const available = masterTasks.filter(mt => !usedIds.has(mt.id));

  // Exact match
  for (const mt of available) {
    if (normalizeName(mt.name) === normalized) {
      return { task: mt, confidence: 'exact' };
    }
  }

  // Contains match
  for (const mt of available) {
    const mtNorm = normalizeName(mt.name);
    if (normalized.includes(mtNorm) || mtNorm.includes(normalized)) {
      return { task: mt, confidence: 'high' };
    }
  }

  // Token similarity
  const taskTokens = tokenize(normalized);
  let bestMatch: MasterTaskRef | null = null;
  let bestScore = 0;

  for (const mt of available) {
    const mtTokens = tokenize(normalizeName(mt.name));
    const score = jaccardSimilarity(taskTokens, mtTokens);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = mt;
    }
  }

  if (bestMatch) {
    if (bestScore >= 0.6) return { task: bestMatch, confidence: 'medium' };
    if (bestScore >= 0.4) return { task: bestMatch, confidence: 'low' };
  }

  return null;
}

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Keep letters, numbers, spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set(['CỦA', 'VÀ', 'CÁC', 'CHO', 'TRONG', 'VỀ', 'ĐỂ', 'CÓ', 'ĐƯỢC', 'THEO', 'TẠI', 'LÀ']);
  return new Set(
    text.split(' ')
      .filter(t => t.length > 1 && !stopWords.has(t))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
