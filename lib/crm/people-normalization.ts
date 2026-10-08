import { toSearchKey } from './constants';

/** Chỉ chuẩn hoá cách viết; không đoán tên viết thiếu hay gộp tên gần giống. */
export function normalizeCrmPerson(raw: string | null | undefined) {
  const text = raw?.normalize('NFC').trim().replace(/\s+/g, ' ') ?? '';
  const name = text.replace(/^(?:(?:PGS|GS|TS|ThS|BSCKII|BSCKI|BS|CKII|CKI)[.\s]+)+/iu, '').trim();
  const key = toSearchKey(name);
  if (!key || !/\p{L}/u.test(name) || ['kiem toan nha nuoc', 'nieu hoc chuc nang'].includes(key)) return null;
  return { name, key };
}
