/**
 * Kiểm tra số liệu theo danh mục chỉ số chuẩn (metric_nodes / metric_aliases).
 *
 * metric-validation.ts xét từng số liệu theo câu gốc và lịch sử tên. Module này
 * bắt những lỗi chỉ thấy được khi biết số liệu thuộc CHỈ SỐ CHUẨN nào — các lỗi
 * đã gặp thật trong tuần 36/2026, đối chiếu file gốc:
 *
 *   - Số con lớn hơn số cha (nhánh tổng đài > tổng cuộc gọi)
 *   - Tỷ lệ % bị gắn vào chỉ số đếm, hoặc ngược lại
 *   - Phòng chép nguyên số của mục này sang mục khác: Phòng VTTB ghi nhập kho
 *     hoá chất xét nghiệm = nhập kho vật tư y tế tiêu hao = 2.867.170.092 đ
 *   - Số báo cáo tuần khác số file Excel của chính phòng đó cùng tuần
 *
 * Cùng nguyên tắc với metric-validation.ts: KHÔNG tự sửa giá trị, chỉ gắn cờ.
 */
/** Giá trị từ ngưỡng này trở lên mà trùng nhau ở hai chỉ số khác nhau thì đáng ngờ. */
const COPIED_VALUE_MIN = 10_000;

/** Chênh lệch tương đối với Excel coi là khác (bỏ qua sai số làm tròn). */
const EXCEL_TOLERANCE = 0.005;

export type CatalogFlag = 'UNIT_MISMATCH' | 'CHILD_EXCEEDS_PARENT' | 'COPIED_VALUE' | 'EXCEL_MISMATCH';

export interface CatalogNodeInfo {
  unit: string | null;
  parentCode: string | null;
  aggregation: string | null;
}

export interface CatalogMetricInput {
  /** Mã chỉ số chuẩn qua bảng tên gọi; null nếu tên chưa gắn vào danh mục. */
  nodeCode: string | null;
  value: number;
  unit: string | null;
}

export type UnitClass = 'percent' | 'money' | 'time' | 'count' | 'unknown';

/**
 * Loại đơn vị. Chỉ so LOẠI chứ không so chữ: "lượt" và "người" cùng là số đếm,
 * AI viết đơn vị rất tự do — so chữ thì tuần nào cũng báo sai.
 */
export function unitClass(unit: string | null | undefined): UnitClass {
  const u = unit?.toLowerCase().trim();
  if (!u) return 'unknown';
  if (u === '%' || u.includes('phần trăm')) return 'percent';
  // Khớp CẢ đơn vị, không tìm chữ con: "hợp đồng" chứa "đồng" nhưng là số đếm.
  if (/^((nghìn|ngàn|triệu|tỷ)\s*)?(vnd|vnđ|đồng|đ)$|^(nghìn|ngàn|triệu|tỷ)$/.test(u)) return 'money';
  if (/^(giờ|phút|ngày|tuần|tháng|năm|h)$/.test(u)) return 'time';
  return 'count';
}

export interface CatalogIssue {
  flag: CatalogFlag;
  /** Giải thích cho người xem, viết sẵn bằng tiếng Việt. */
  message: string;
}

/**
 * Kiểm tra số liệu của MỘT phòng trong MỘT tuần.
 *
 * `excelValues`: số chính thức từ file Excel của phòng cùng tuần, theo mã chỉ
 * số — chỉ phòng có file số liệu (Phòng Hành chính) mới truyền.
 */
export function validateAgainstCatalog(
  metrics: readonly CatalogMetricInput[],
  nodes: ReadonlyMap<string, CatalogNodeInfo>,
  excelValues?: ReadonlyMap<string, number>,
): Map<number, CatalogIssue[]> {
  const result = new Map<number, CatalogIssue[]>();
  const add = (i: number, issue: CatalogIssue) => result.set(i, [...(result.get(i) ?? []), issue]);

  // Giá trị lớn nhất của mỗi chỉ số trong tuần — làm mốc so cha/con.
  const valueOf = new Map<string, number>();
  metrics.forEach((m) => {
    if (m.nodeCode) valueOf.set(m.nodeCode, Math.max(valueOf.get(m.nodeCode) ?? -Infinity, m.value));
  });

  metrics.forEach((m, i) => {
    const node = m.nodeCode ? nodes.get(m.nodeCode) : undefined;
    if (!m.nodeCode || !node) return;

    const expected = unitClass(node.unit);
    const actual = unitClass(m.unit);
    if (expected !== 'unknown' && actual !== 'unknown' && expected !== actual) {
      add(i, {
        flag: 'UNIT_MISMATCH',
        message: `Đơn vị "${m.unit}" không cùng loại với chỉ số chuẩn (${node.unit}) — có thể gắn nhầm chỉ số.`,
      });
    }

    // Chỉ so khi cha cộng dồn được: tỷ lệ cha không nhất thiết lớn hơn tỷ lệ con.
    const parentValue = node.parentCode ? valueOf.get(node.parentCode) : undefined;
    const parent = node.parentCode ? nodes.get(node.parentCode) : undefined;
    if (parentValue !== undefined && parent?.aggregation === 'SUM' && m.value > parentValue) {
      add(i, {
        flag: 'CHILD_EXCEEDS_PARENT',
        message: `${m.value.toLocaleString('vi-VN')} lớn hơn chỉ số tổng (${parentValue.toLocaleString('vi-VN')}) — ` +
          'hoặc số liệu sai, hoặc danh mục đặt sai quan hệ cha/con.',
      });
    }

    const official = excelValues?.get(m.nodeCode);
    if (official !== undefined && Math.abs(m.value - official) > Math.max(0.5, Math.abs(official) * EXCEL_TOLERANCE)) {
      add(i, {
        flag: 'EXCEL_MISMATCH',
        message: `Báo cáo tuần ghi ${m.value.toLocaleString('vi-VN')}, file số liệu của phòng ghi ` +
          `${official.toLocaleString('vi-VN')} — dùng số Excel, cần phòng xác nhận.`,
      });
    }
  });

  // Cùng một số lớn ở hai chỉ số KHÁC nhau.
  const byValue = new Map<number, number[]>();
  metrics.forEach((m, i) => {
    if (m.nodeCode && Math.abs(m.value) >= COPIED_VALUE_MIN) byValue.set(m.value, [...(byValue.get(m.value) ?? []), i]);
  });
  for (const [value, indexes] of byValue) {
    const distinctNodes = new Set(indexes.map((i) => metrics[i].nodeCode));
    if (distinctNodes.size < 2) continue;
    for (const i of indexes) {
      add(i, {
        flag: 'COPIED_VALUE',
        message: `${value.toLocaleString('vi-VN')} xuất hiện ở ${distinctNodes.size} chỉ số khác nhau cùng tuần — ` +
          'nhiều khả năng phòng chép số từ mục khác.',
      });
    }
  }

  return result;
}
