"""
fleet_revenue.py
─────────────────────────────────────────────────────────────────────
Parser + rà soát doanh thu chuyến xe.

VÌ SAO CẦN MODULE RIÊNG
Ô "Doanh thu" trên Google Form là ô nhập tự do, tài xế gõ theo thói quen
mỗi người: "470.000", "470,000", "470000", "470k", "1.310.000". Hàm
`toNumber` ở tầng ingestion chỉ xoá dấu phẩy rồi gọi Number(), nên:

    "470.000"    -> 470          (mất 3 số 0 — dấu chấm bị hiểu là thập phân)
    "1.310"      -> 1.31         (nghìn thành lẻ)
    "2.000.000"  -> null         (Number() gặp 2 dấu chấm -> NaN)

Đó là nguồn gốc các giá trị 470, 518, 542, 1.31 trong DB và phần lẻ
".31" của tổng doanh thu.

NGUYÊN TẮC PHÂN BIỆT DẤU
Không thể đoán bằng "dấu nào xuất hiện trước". Quy tắc dùng ở đây dựa
trên hình dạng nhóm chữ số, theo thứ tự ưu tiên:

  1. Có CẢ chấm và phẩy  -> dấu xuất hiện SAU là dấu thập phân
  2. Chỉ một loại dấu, lặp nhiều lần ("1.310.000")     -> phân cách nghìn
  3. Chỉ một dấu, sau nó đúng 3 chữ số ("470.000")     -> phân cách nghìn
  4. Chỉ một dấu, sau nó 1-2 chữ số ("470.5")          -> thập phân
  5. Sau nó >3 chữ số ("470.0000")                     -> không rõ -> None

Quy tắc 3 là điểm mấu chốt: tiền VNĐ không bao giờ lẻ tới phần nghìn,
nên "470.000" luôn là bốn trăm bảy mươi nghìn, không phải 470 phẩy không.

CHÉO SOÁT VỚI KM
Chỉ xe CỨU THƯƠNG mới thu tiền; xe hành chính doanh thu phải bằng 0.
Với xe cứu thương, đối chiếu doanh thu/km với dải thực tế của đội xe để
bắt các ca thiếu/thừa số 0 mà bản thân chuỗi nhập nhìn vẫn "hợp lệ".
"""
from __future__ import annotations

import re
from typing import Any

import pandas as pd

# ═══════════════════════════════════════════════════════════════════
#                          NGƯỠNG
# ═══════════════════════════════════════════════════════════════════

# Doanh thu VNĐ luôn chẵn tới hàng nghìn. 8.245/8.282 chuyến trong DB
# (99,6%) chia hết 1000 — số lẻ hơn thế gần như chắc chắn là nhập sai.
REVENUE_ROUNDING_UNIT = 1_000

# Chuyến thu phí thấp nhất còn hợp lý. Dưới ngưỡng này là dấu hiệu
# mất số 0 ("470" đáng lẽ "470.000").
MIN_REVENUE_VND = 10_000

# Trên ngưỡng này là dấu hiệu thừa số 0.
MAX_REVENUE_VND = 20_000_000

# Dải doanh thu/km thực tế, lấy từ phân vị p05-p95 của xe cứu thương
# (doanh thu >= 10.000, km > 0): p05≈12.300, median≈42.300, p95≈165.000.
# Nới biên ra để chỉ bắt ca lệch hẳn một bậc 10 lần.
MIN_REVENUE_PER_KM = 3_000
MAX_REVENUE_PER_KM = 500_000

# Chuyến quá ngắn thì doanh thu/km nhiễu mạnh, không dùng để kết luận.
MIN_KM_FOR_RATIO_CHECK = 3

# Hậu tố tài xế hay gõ tắt.
_SUFFIX_MULTIPLIER = {'k': 1_000, 'K': 1_000, 'tr': 1_000_000, 'TR': 1_000_000}


# ═══════════════════════════════════════════════════════════════════
#                          PARSER
# ═══════════════════════════════════════════════════════════════════

def parse_revenue(value: Any) -> float | None:
    """Đọc ô doanh thu tự do thành số VNĐ. Trả None nếu không đọc được.

    Không bao giờ đoán bừa: chuỗi mơ hồ trả None để tầng rà soát gắn cờ,
    tốt hơn là âm thầm ghi một con số sai vào báo cáo.
    """
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    # Số sẵn (Excel/Sheets đã tự parse) thì dùng thẳng.
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value) if float(value) >= 0 else None

    s = str(value).strip()
    if s == '' or s.lower() in {'nan', 'none', 'null', '-', 'x', 'không'}:
        return None

    # Bỏ ký hiệu tiền tệ ở cuối. Không dùng \b vì "đ" là ký tự Unicode,
    # ranh giới từ không khớp trong "470000đ".
    s = s.replace('₫', '').strip()
    s = re.sub(r'(?i)\s*(vnđ|vnd|đồng|dong|đ|d)\.?$', '', s).strip()

    # Hậu tố k / tr: "470k", "1.5tr"
    m = re.fullmatch(r'([\d.,\s]+)\s*(k|K|tr|TR)', s)
    if m:
        base = _parse_number_part(m.group(1))
        if base is None:
            return None
        return base * _SUFFIX_MULTIPLIER[m.group(2)]

    return _parse_number_part(s)


def _parse_number_part(s: str) -> float | None:
    """Đọc phần số, tự suy ra dấu nào là nghìn / dấu nào là thập phân."""
    s = s.strip().replace(' ', '')
    if s == '':
        return None

    # Chỉ chấp nhận chữ số, dấu chấm, dấu phẩy. Có ký tự khác -> không đoán.
    if not re.fullmatch(r'[\d.,]+', s):
        return None

    has_dot = '.' in s
    has_comma = ',' in s

    if has_dot and has_comma:
        # Dấu xuất hiện SAU là dấu thập phân: "1.310,50" vs "1,310.50"
        dec_sep = '.' if s.rfind('.') > s.rfind(',') else ','
        thou_sep = ',' if dec_sep == '.' else '.'
        s = s.replace(thou_sep, '').replace(dec_sep, '.')
        return _safe_float(s)

    if not has_dot and not has_comma:
        return _safe_float(s)

    # Chỉ một loại dấu.
    sep = '.' if has_dot else ','
    parts = s.split(sep)

    # Lặp nhiều lần -> chắc chắn phân cách nghìn: "1.310.000"
    if len(parts) > 2:
        if all(len(p) == 3 for p in parts[1:]):
            return _safe_float(''.join(parts))
        return None  # "1.31.0" — hình dạng vô nghĩa

    tail = parts[1]

    # Đúng 3 chữ số sau dấu -> phân cách nghìn ("470.000").
    # Tiền VNĐ không lẻ tới phần nghìn nên đây luôn là nghìn.
    if len(tail) == 3:
        return _safe_float(parts[0] + tail)

    # 1-2 chữ số -> thập phân thật ("470.5")
    if 1 <= len(tail) <= 2:
        return _safe_float(parts[0] + '.' + tail)

    # >3 chữ số sau dấu -> không rõ ý định
    return None


def _safe_float(s: str) -> float | None:
    try:
        n = float(s)
    except (TypeError, ValueError):
        return None
    if n != n or n in (float('inf'), float('-inf')):
        return None
    return n if n >= 0 else None


# ═══════════════════════════════════════════════════════════════════
#                       RÀ SOÁT 1 CHUYẾN
# ═══════════════════════════════════════════════════════════════════

def _is_blank(value: Any) -> bool:
    """True nếu ô thực sự trống (None/NaN/rỗng/ký hiệu 'không có')."""
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except (TypeError, ValueError):
        pass
    return str(value).strip().lower() in {'', 'nan', 'none', 'null', '-', 'x', 'không'}


def _issue(severity: str, message: str, how_to_fix: str) -> dict:
    return {
        'field': 'revenue_vnd',
        'severity': severity,
        'message': message,
        'how_to_fix': how_to_fix,
    }


def check_revenue(revenue: Any, vehicle_type: Any = None,
                  distance_km: Any = None, raw: Any = None) -> list[dict]:
    """Rà soát doanh thu một chuyến, trả list issue (rỗng nếu sạch).

    `raw` là chuỗi gốc người dùng nhập, dùng để gợi ý cách sửa cho đúng.
    """
    issues: list[dict] = []
    vtype = str(vehicle_type or '').strip().lower()
    is_ambulance = 'cứu thương' in vtype
    is_admin = 'hành chính' in vtype

    rev = parse_revenue(revenue)

    # Ô trống là bình thường: phần lớn chuyến không thu phí, và xe hành
    # chính thì không bao giờ thu. Chỉ báo khi ô CÓ nội dung mà đọc không
    # ra — đó mới là nhập sai thật.
    if rev is None:
        if not _is_blank(raw):
            issues.append(_issue(
                'critical',
                f'Không đọc được doanh thu: "{raw}"',
                'Nhập số thuần, ví dụ 470000 hoặc 470.000.'))
        return issues

    # Xe hành chính không thu phí.
    if is_admin and rev > 0:
        issues.append(_issue(
            'critical',
            f'Xe hành chính có doanh thu {rev:,.0f} VNĐ',
            'Xe hành chính không thu tiền — xoá doanh thu hoặc sửa loại xe.'))
        return issues

    if rev == 0:
        return issues  # chuyến nội bộ không thu phí

    if rev < 0:
        issues.append(_issue(
            'critical', f'Doanh thu âm: {rev:,.0f} VNĐ', 'Nhập số dương.'))
        return issues

    # Thiếu số 0: quá nhỏ so với một chuyến thu phí thật.
    if rev < MIN_REVENUE_VND:
        suggest = rev * 1_000
        issues.append(_issue(
            'critical',
            f'Doanh thu quá nhỏ: {rev:,.0f} VNĐ',
            f'Nghi thiếu 3 số 0 — có phải {suggest:,.0f} VNĐ không?'))
        return issues

    if rev > MAX_REVENUE_VND:
        issues.append(_issue(
            'warning',
            f'Doanh thu rất cao: {rev:,.0f} VNĐ',
            'Kiểm tra lại — có thể thừa số 0.'))

    # Không chẵn nghìn -> dấu hiệu parse sai dấu.
    if rev % REVENUE_ROUNDING_UNIT != 0:
        issues.append(_issue(
            'warning',
            f'Doanh thu lẻ bất thường: {rev:,.2f} VNĐ',
            'Doanh thu thường chẵn tới hàng nghìn — kiểm tra dấu chấm/phẩy.'))

    # Chéo soát với km (chỉ xe cứu thương, chuyến đủ dài).
    km = None
    try:
        km = float(distance_km) if distance_km is not None else None
    except (TypeError, ValueError):
        km = None

    if is_ambulance and km and km >= MIN_KM_FOR_RATIO_CHECK:
        per_km = rev / km
        if per_km < MIN_REVENUE_PER_KM:
            issues.append(_issue(
                'warning',
                f'Doanh thu {rev:,.0f} VNĐ cho {km:,.0f} km '
                f'(chỉ {per_km:,.0f} đ/km)',
                'Thấp bất thường so với mặt bằng — nghi thiếu số 0.'))
        elif per_km > MAX_REVENUE_PER_KM:
            issues.append(_issue(
                'warning',
                f'Doanh thu {rev:,.0f} VNĐ cho {km:,.0f} km '
                f'({per_km:,.0f} đ/km)',
                'Cao bất thường so với mặt bằng — nghi thừa số 0.'))

    return issues


# ═══════════════════════════════════════════════════════════════════
#                      RÀ SOÁT CẢ BẢNG
# ═══════════════════════════════════════════════════════════════════

def audit_revenue(df: pd.DataFrame) -> pd.DataFrame:
    """Rà soát doanh thu toàn bộ dataframe.

    Trả về bảng các chuyến có vấn đề, mỗi dòng kèm mức độ và cách sửa.
    Bảng rỗng nghĩa là không phát hiện lỗi.
    """
    if df.empty:
        return pd.DataFrame()

    rows: list[dict] = []
    for idx, r in df.iterrows():
        found = check_revenue(
            r.get('revenue_vnd'),
            vehicle_type=r.get('vehicle_type'),
            distance_km=r.get('distance_km'),
            raw=r.get('revenue_vnd'),
        )
        for it in found:
            rows.append({
                'Ngày': r.get('record_date'),
                'Xe': r.get('vehicle_id'),
                'Loại xe': r.get('vehicle_type'),
                'Tài xế': r.get('driver_name'),
                'Km': r.get('distance_km'),
                'Doanh thu': r.get('revenue_vnd'),
                'Mức độ': it['severity'],
                'Vấn đề': it['message'],
                'Cách sửa': it['how_to_fix'],
                '_idx': idx,
            })

    if not rows:
        return pd.DataFrame()

    out = pd.DataFrame(rows)
    order = {'critical': 0, 'warning': 1, 'info': 2}
    out['_o'] = out['Mức độ'].map(order).fillna(3)
    out = out.sort_values(['_o', 'Ngày']).drop(columns=['_o'])
    return out
