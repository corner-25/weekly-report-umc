import { createHash } from 'crypto';

/**
 * Checksum ổn định của nội dung nguồn, dùng để bỏ qua lần chạy khi nguồn không đổi.
 *
 * Object được serialize với khoá đã sắp xếp, nên hai object cùng nội dung nhưng
 * khác thứ tự khoá vẫn cho cùng checksum.
 */
export function computeChecksum(input: unknown): string {
  const hash = createHash('sha256');

  if (typeof input === 'string') {
    hash.update(input, 'utf8');
  } else if (input instanceof ArrayBuffer) {
    hash.update(Buffer.from(input));
  } else if (Buffer.isBuffer(input)) {
    hash.update(input);
  } else {
    hash.update(stableStringify(input), 'utf8');
  }

  return hash.digest('hex');
}

/** JSON.stringify với khoá object sắp xếp theo alphabet, đệ quy. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);

  return `{${entries.join(',')}}`;
}
