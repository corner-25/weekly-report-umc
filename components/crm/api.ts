/**
 * Gọi API CRM từ giao diện. Lỗi API có dạng `{ error, issues? }` — gói thành
 * `CrmApiError` để form hiện lỗi cạnh đúng trường.
 */

export interface ApiIssue {
  path: string;
  message: string;
}

export class CrmApiError extends Error {
  readonly status: number;
  readonly issues: ApiIssue[];

  constructor(message: string, status: number, issues: ApiIssue[] = []) {
    super(message);
    this.name = 'CrmApiError';
    this.status = status;
    this.issues = issues;
  }

  /** Lỗi theo trường: khoá là đoạn đầu của `path` (vd. "preferences.flowers" → "preferences.flowers" và "preferences"). */
  get fieldErrors(): Record<string, string> {
    return this.issues.reduce<Record<string, string>>((acc, issue) => {
      const key = issue.path;
      const head = key.split('.')[0];
      return {
        ...acc,
        ...(key && !acc[key] ? { [key]: issue.message } : {}),
        ...(head && !acc[head] ? { [head]: issue.message } : {}),
      };
    }, {});
  }
}

function normalizePath(path: unknown): string {
  if (Array.isArray(path)) return path.map(String).join('.');
  return typeof path === 'string' ? path : '';
}

function parseIssues(raw: unknown): ApiIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { path?: unknown; message?: unknown } => typeof item === 'object' && item !== null)
    .map((item) => ({ path: normalizePath(item.path), message: String(item.message ?? 'Giá trị không hợp lệ') }));
}

const FALLBACK_ERROR = 'Không thể kết nối máy chủ. Vui lòng thử lại.';

export async function crmFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new CrmApiError(FALLBACK_ERROR, 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const body = (data ?? {}) as { error?: unknown; issues?: unknown };
    const message = typeof body.error === 'string' && body.error ? body.error : `Lỗi máy chủ (${response.status})`;
    throw new CrmApiError(message, response.status, parseIssues(body.issues));
  }
  return data as T;
}

export function crmSend<T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return crmFetch<T>(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function errorMessage(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Chốt lịch hẹn dẫn khách/đoàn: đã xong hoặc huỷ. */
export function changeInteractionStatus(id: string, status: 'PLANNED' | 'DONE' | 'CANCELLED'): Promise<unknown> {
  return crmSend(`/api/crm/interactions/${id}/status`, 'POST', { status });
}
