/**
 * Trả JSON có nén gzip cho route handler.
 *
 * Next tự nén trang HTML nhưng KHÔNG nén JSON trả từ route handler, và Railway
 * cũng không nén hộ: /api/master-tasks?includeProgress=true đi nguyên 5,6 MB qua
 * đường Việt Nam ↔ Mỹ. JSON nén còn khoảng 1/8–1/10.
 */
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
/** Dưới mức này nén không bõ công. */
const MIN_BYTES = 8 * 1024;

export async function compressedJson(request: Request, data: unknown, init: ResponseInit = {}): Promise<Response> {
  const body = JSON.stringify(data);
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.append('Vary', 'Accept-Encoding');
  const acceptsGzip = /\bgzip\b/.test(request.headers.get('accept-encoding') ?? '');
  if (!acceptsGzip || Buffer.byteLength(body) < MIN_BYTES) {
    return new Response(body, { ...init, headers });
  }
  const compressed = await gzipAsync(body, { level: 6 });
  headers.set('Content-Encoding', 'gzip');
  return new Response(new Uint8Array(compressed), { ...init, headers });
}
