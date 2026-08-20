import { createSign } from 'crypto';

/**
 * Đọc Google Sheets bằng service account, không cần thư viện googleapis.
 *
 * Luồng OAuth 2.0 service account: tự ký JWT bằng private key rồi đổi lấy
 * access token. Chỉ cần `crypto` có sẵn của Node, tránh kéo thêm ~15MB
 * dependency chỉ để đọc vài sheet.
 *
 * Thay cho manual_fleet_sync.py (repo UMC-APP/PHONGHC/umc-dashboard), vốn phải
 * đẩy dữ liệu qua GitHub. Sheets API gọi được từ Railway nên bỏ được khâu trung gian.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

/** Access token của Google sống 1 giờ; xin token mới sớm hơn để tránh hết hạn giữa chừng. */
const TOKEN_LIFETIME_SECONDS = 3600;

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/**
 * Đọc credentials từ biến môi trường.
 *
 * Chấp nhận cả JSON thô lẫn JSON đã mã hoá base64 — Railway đôi khi làm hỏng
 * chuỗi nhiều dòng, base64 tránh được chuyện đó.
 */
export function parseCredentials(rawValue: string): ServiceAccountCredentials {
  let text = rawValue.trim();

  if (!text.startsWith('{')) {
    try {
      text = Buffer.from(text, 'base64').toString('utf8');
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ cũng không phải base64');
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON không parse được thành JSON');
  }

  const creds = parsed as Partial<ServiceAccountCredentials>;
  if (!creds.client_email || !creds.private_key) {
    throw new Error('Credentials thiếu client_email hoặc private_key');
  }

  return {
    client_email: creds.client_email,
    // Biến môi trường thường lưu xuống dòng dạng "\n" hai ký tự.
    private_key: creds.private_key.replace(/\\n/g, '\n'),
    token_uri: creds.token_uri ?? TOKEN_URL,
  };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Ký JWT rồi đổi lấy access token. */
export async function getAccessToken(creds: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: creds.token_uri ?? TOKEN_URL,
      exp: now + TOKEN_LIFETIME_SECONDS,
      iat: now,
    }),
  );

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(creds.private_key));
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(creds.token_uri ?? TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Lấy access token thất bại: HTTP ${res.status} — ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Phản hồi token không chứa access_token');
  return data.access_token;
}

export interface SheetData {
  /** Tên sheet — với dữ liệu đội xe, đây chính là biển số xe. */
  title: string;
  /** Toàn bộ ô dạng lưới, dòng đầu là header. */
  values: string[][];
}

/** Lấy danh sách tên sheet của một spreadsheet. */
async function listSheetTitles(spreadsheetId: string, token: string): Promise<string[]> {
  const url = `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });

  if (res.status === 403) {
    throw new Error(
      'Service account không có quyền đọc spreadsheet này. Hãy chia sẻ file cho ' +
        'địa chỉ email của service account với quyền Viewer.',
    );
  }
  if (res.status === 404) {
    throw new Error(`Không tìm thấy spreadsheet ${spreadsheetId} — kiểm tra lại ID`);
  }
  if (!res.ok) {
    throw new Error(`Đọc metadata spreadsheet thất bại: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
  return (data.sheets ?? []).map((s) => s.properties?.title).filter((t): t is string => Boolean(t));
}

/**
 * Đọc toàn bộ sheet của một spreadsheet.
 *
 * Dùng batchGet để lấy mọi sheet trong một request thay vì gọi từng cái —
 * spreadsheet đội xe có 13 sheet, gọi lẻ sẽ chậm và dễ chạm rate limit.
 */
export async function fetchAllSheets(
  spreadsheetId: string,
  creds: ServiceAccountCredentials,
): Promise<SheetData[]> {
  const token = await getAccessToken(creds);
  const titles = await listSheetTitles(spreadsheetId, token);

  if (titles.length === 0) return [];

  const params = new URLSearchParams();
  for (const title of titles) params.append('ranges', `'${title.replace(/'/g, "''")}'`);
  params.set('majorDimension', 'ROWS');
  params.set('valueRenderOption', 'UNFORMATTED_VALUE');
  params.set('dateTimeRenderOption', 'FORMATTED_STRING');

  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchGet?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Đọc dữ liệu sheet thất bại: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  }

  const data = (await res.json()) as { valueRanges?: Array<{ values?: unknown[][] }> };
  const ranges = data.valueRanges ?? [];

  return titles.map((title, i) => ({
    title,
    values: (ranges[i]?.values ?? []).map((row) => row.map((c) => (c === null || c === undefined ? '' : String(c)))),
  }));
}
