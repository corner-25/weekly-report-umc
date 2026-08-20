"""
fleet_validators.py
─────────────────────────────────────────────────────────────────────
Bộ validator cho từng trường nhập liệu của Google Form Tổ Lái Xe.

Mỗi validator nhận 1 row (dict-like) và trả về list issues. Mỗi issue:
  {
    'field':       tên cột bị lỗi,
    'severity':    'critical' / 'warning' / 'info',
    'message':     mô tả ngắn (hiển thị cho tài xế),
    'how_to_fix':  hướng dẫn sửa (vd "Sửa giờ kết thúc cho đúng định dạng h:mm")
  }

Severity:
  critical — chắc chắn sai, tài xế PHẢI sửa (trừ 25-35 điểm)
  warning  — đáng ngờ, cần kiểm tra (trừ 10-20 điểm)
  info     — nhắc nhở nhẹ (trừ 0-5 điểm)
"""
from __future__ import annotations
import re
import pandas as pd
from typing import Any


# ═══════════════════════════════════════════════════════════════════
#                          CONSTANTS
# ═══════════════════════════════════════════════════════════════════

# Ngưỡng cảnh báo
MAX_TRIP_HOURS = 16          # Chuyến > 16h = đáng ngờ
MAX_TRIP_KM = 1000           # Chuyến > 1000 km = đáng ngờ
MAX_REASONABLE_KM = 5000     # Chuyến > 5000 km = chắc chắn lỗi
MAX_FUEL_LITERS = 100        # Đổ > 100 lít/chuyến = đáng ngờ
MAX_REASONABLE_FUEL = 200    # > 200 lít = chắc chắn lỗi
MAX_REVENUE_VND = 20_000_000 # > 20 triệu/chuyến = đáng ngờ
MIN_ODO = 1000               # ODO < 1000 km = nghi nhập sai
MAX_ODO = 1_000_000          # ODO > 1 triệu = nghi thừa số 0

# Severity → điểm trừ
SEVERITY_PENALTY = {
    'critical': 30,
    'warning':  15,
    'info':      5,
}


# ═══════════════════════════════════════════════════════════════════
#                       HELPERS
# ═══════════════════════════════════════════════════════════════════

def _is_empty(value: Any) -> bool:
    """Trả True nếu value là None, NaN, hoặc chuỗi rỗng/khoảng trắng."""
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except (TypeError, ValueError):
        pass
    return str(value).strip() == ''


def _to_number(value: Any) -> float | None:
    """Convert sang float, trả None nếu không parse được."""
    if _is_empty(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _issue(field: str, severity: str, message: str, how_to_fix: str) -> dict:
    """Tạo 1 issue dict."""
    return {
        'field': field,
        'severity': severity,
        'message': message,
        'how_to_fix': how_to_fix,
    }


# ═══════════════════════════════════════════════════════════════════
#               VALIDATOR CHO TỪNG TRƯỜNG
# ═══════════════════════════════════════════════════════════════════

def validate_driver(row: dict) -> list[dict]:
    """Tên tài xế — phải có và không phải email."""
    drv = row.get('driver_name') or row.get('Tên tài xế')
    issues: list[dict] = []
    if _is_empty(drv) or str(drv).strip() == 'Không xác định':
        issues.append(_issue(
            'driver_name', 'warning',
            'Chưa xác định được tài xế',
            'Hãy đảm bảo đã đăng nhập đúng email Google khi nhập Form. '
            'Báo Tổ Xe nếu email của bạn chưa nằm trong danh sách.'
        ))
    elif '@' in str(drv):
        issues.append(_issue(
            'driver_name', 'critical',
            f'Tên tài xế đang là email ({str(drv)[:30]}...)',
            'Email của bạn chưa được khai báo trong danh sách — báo Tổ Xe '
            'cập nhật mapping email → tên.'
        ))
    return issues


def validate_vehicle(row: dict) -> list[dict]:
    """Mã xe — phải có."""
    vid = row.get('vehicle_id') or row.get('Mã xe')
    if _is_empty(vid):
        return [_issue(
            'vehicle_id', 'critical',
            'Thiếu mã xe',
            'Mỗi tab Google Sheets ứng với 1 xe — kiểm tra lại đang ở tab đúng.'
        )]
    return []


def validate_date(row: dict) -> list[dict]:
    """Ngày ghi nhận — phải có, parse được, trong khoảng hợp lý."""
    raw_date = row.get('record_date') or row.get('Ngày ghi nhận')
    if _is_empty(raw_date):
        return [_issue(
            'record_date', 'critical',
            'Thiếu Ngày ghi nhận',
            'Chọn lại ngày của chuyến trên Google Form.'
        )]
    try:
        dt = pd.to_datetime(raw_date, errors='coerce')
    except Exception:
        dt = pd.NaT
    if pd.isna(dt):
        return [_issue(
            'record_date', 'critical',
            f'Ngày không hợp lệ: {raw_date!r}',
            'Chọn lại ngày từ trình chọn ngày (calendar picker) của Form.'
        )]
    issues = []
    today = pd.Timestamp.today().normalize()
    if dt > today + pd.Timedelta(days=1):
        issues.append(_issue(
            'record_date', 'warning',
            f'Ngày {dt.strftime("%d/%m/%Y")} trong tương lai',
            'Kiểm tra lại ngày — có thể đã nhập nhầm ngày tới.'
        ))
    if dt < pd.Timestamp('2024-01-01'):
        issues.append(_issue(
            'record_date', 'warning',
            f'Ngày {dt.strftime("%d/%m/%Y")} quá cũ',
            'Kiểm tra lại năm — có thể đã nhập nhầm.'
        ))
    return issues


def validate_clock_format(value: Any, field: str) -> list[dict]:
    """Validate format giờ: h:mm hoặc h:mm:ss [AM|PM]."""
    if _is_empty(value):
        return [_issue(
            field, 'critical',
            f'Thiếu {"giờ bắt đầu" if "start" in field else "giờ kết thúc"}',
            'Nhập giờ theo định dạng h:mm (vd 8:30 hoặc 8:30 AM).'
        )]
    s = str(value).strip()
    if not re.match(r'^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$', s, re.I):
        return [_issue(
            field, 'critical',
            f'Định dạng giờ lạ: {value!r}',
            'Nhập theo dạng h:mm (vd 14:30 hoặc 2:30 PM).'
        )]
    return []


def validate_start_end_time(row: dict) -> list[dict]:
    """Giờ bắt đầu / kết thúc — format đúng + logic."""
    start = row.get('start_time')
    end = row.get('end_time')
    issues = []
    issues += validate_clock_format(start, 'start_time')
    issues += validate_clock_format(end, 'end_time')
    if issues:
        return issues

    # Phát hiện lỗi AM/PM cùng buổi mà end < start (đã tự sửa nhưng nên cảnh báo)
    method = row.get('duration_method', '')
    if method in ('fixed_ampm', 'fixed_ampm_km_capped'):
        issues.append(_issue(
            'start_time,end_time', 'warning',
            'Giờ bắt đầu và kết thúc cùng buổi sáng (AM) hoặc cùng chiều (PM) '
            'nhưng giờ kết thúc lại sớm hơn giờ bắt đầu',
            'Kiểm tra lại: nếu chuyến qua chiều/tối, đổi giờ kết thúc thành PM '
            '(hoặc ngược lại). Hệ thống đã tự sửa nhưng giá trị có thể chưa chính xác.'
        ))

    # Chuyến quá dài
    hrs = row.get('duration_hours')
    try: hrs = float(hrs)
    except (TypeError, ValueError): hrs = None
    if hrs is not None and hrs > MAX_TRIP_HOURS:
        sev = 'critical' if hrs > 20 else 'warning'
        issues.append(_issue(
            'duration_hours', sev,
            f'Chuyến dài bất thường: {hrs:.1f} giờ',
            'Nếu là chuyến đi tỉnh xa qua đêm, đây có thể đúng. '
            'Nếu không, kiểm tra lại giờ bắt đầu/kết thúc.'
        ))
    return issues


def validate_destination(row: dict) -> list[dict]:
    """Điểm đến — phải có, không quá ngắn."""
    dest = row.get('destination') or row.get('Điểm đến')
    if _is_empty(dest):
        return [_issue(
            'destination', 'critical',
            'Thiếu điểm đến',
            'Ghi rõ tên cơ sở/địa danh (vd: BV Chợ Rẫy, TP.HCM Q.5, Vũng Tàu).'
        )]
    s = str(dest).strip()
    if len(s) < 3:
        return [_issue(
            'destination', 'warning',
            f'Điểm đến quá ngắn: {s!r}',
            'Ghi đầy đủ tên địa danh để dễ tra cứu sau này.'
        )]
    return []


def validate_work_category(row: dict) -> list[dict]:
    """Phân loại công tác — phải nằm trong nhóm chuẩn."""
    wc = row.get('work_category') or row.get('Phân loại công tác')
    wc_raw = row.get('work_category_raw') or row.get('Phân loại công tác_raw') or wc
    if _is_empty(wc) or str(wc).strip() == 'Không xác định':
        return [_issue(
            'work_category', 'critical',
            'Thiếu phân loại công tác',
            'Ghi rõ loại chuyến (Cấp cứu / Mua máu / Đưa đón bệnh nhân...).'
        )]
    if str(wc).strip() == 'Khác':
        return [_issue(
            'work_category', 'info',
            f'Phân loại "{str(wc_raw)[:40]}" chưa khớp danh mục chuẩn',
            'Dùng từ khoá chuẩn để hệ thống nhận đúng: Cấp cứu, Mua máu, '
            'Lấy máu ngoại viện, Cận lâm sàng, Đưa Ban Giám đốc, '
            'Đón bác sĩ hội chẩn, Đưa đón bệnh nhân, Đưa đón khách, '
            'Đưa cơm, Vận chuyển trang thiết bị.'
        )]
    return []


def validate_area_type(row: dict) -> list[dict]:
    """Nội thành / Ngoại thành — phải chọn 1 trong 2."""
    area = row.get('area_type') or row.get('Nội thành/Ngoại thành')
    if _is_empty(area):
        return [_issue(
            'area_type', 'warning',
            'Chưa chọn Nội thành / Ngoại thành',
            'Chọn "Nội thành" nếu chuyến trong TP.HCM, "Ngoại thành" nếu đi tỉnh.'
        )]
    if str(area).strip() not in ('Nội thành', 'Ngoại thành'):
        return [_issue(
            'area_type', 'warning',
            f'Giá trị lạ: {area!r}',
            'Chỉ chọn "Nội thành" hoặc "Ngoại thành".'
        )]
    return []


def validate_distance(row: dict) -> list[dict]:
    """Quãng đường — phải là số > 0, < 1000 km."""
    km_raw = _to_number(row.get('distance_km_raw') or row.get('Quãng đường'))
    km = _to_number(row.get('distance_km'))
    issues = []

    if km_raw is None and km is None:
        return [_issue(
            'distance_km', 'critical',
            'Thiếu quãng đường',
            'Nhập số km của chuyến (chỉ số, không kèm chữ km).'
        )]

    # Lỗi trên raw — kể cả đã được pipeline tự sửa, tài xế vẫn cần biết
    if km_raw is not None:
        if km_raw < 0:
            issues.append(_issue(
                'distance_km', 'critical',
                f'Quãng đường âm: {km_raw:.0f} km',
                'Nhập số dương. Có thể bạn đã nhập "delta đồng hồ ngược" — '
                'lấy chỉ số kết thúc trừ chỉ số bắt đầu.'
            ))
        elif km_raw > MAX_REASONABLE_KM:
            issues.append(_issue(
                'distance_km', 'critical',
                f'Quãng đường quá lớn: {km_raw:.0f} km',
                'Nhập SỐ KM CỦA CHUYẾN, không phải số đồng hồ tổng. '
                'Số đồng hồ tổng đã có ô riêng "Chỉ số đồng hồ sau khi kết thúc chuyến xe".'
            ))
        elif km_raw > MAX_TRIP_KM:
            issues.append(_issue(
                'distance_km', 'warning',
                f'Quãng đường lớn: {km_raw:.0f} km',
                'Nếu là chuyến đi tỉnh xa thì OK, không thì kiểm tra lại.'
            ))
        elif km_raw == 0:
            issues.append(_issue(
                'distance_km', 'warning',
                'Quãng đường = 0',
                'Có thể chuyến chưa hoàn thành hoặc bạn quên nhập km.'
            ))

    return issues


def validate_fuel(row: dict) -> list[dict]:
    """Đổ nhiên liệu — không bắt buộc, nhưng nếu có phải hợp lý.

    Pipeline đã parse từ chuỗi tự do (vd "50 lít xăng", "50lx-km 520121")
    về số. Validator này kiểm tra trên giá trị đã parse + cảnh báo
    nếu raw có pattern "lít kèm ODO" hoặc rác cần dọn.
    """
    fuel = _to_number(row.get('fuel_liters') or row.get('Đổ nhiên liệu (Số lít)'))
    raw = row.get('fuel_liters_raw') or row.get('Đổ nhiên liệu (Số lít)_raw')
    issues: list[dict] = []

    # Cảnh báo nhập kèm ODO/chữ rác — dù pipeline đã parse được số
    if raw is not None and not _is_empty(raw):
        s = str(raw).strip()
        # Nếu raw chứa chuỗi dài có số > 1000 hoặc chữ rác
        import re
        has_odo_pattern = bool(re.search(r'\d{4,}', s)) and len(s) > 4
        has_letters = any(c.isalpha() for c in s) and not re.match(
            r'^\s*\d+\s*([lL]ít?|L|lit)\s*$', s, re.I
        )
        # Trừ trường hợp đơn vị chuẩn "50 lít" / "50L"
        clean_match = re.match(r'^\s*-?\d+([.,]\d+)?\s*([lL]ít?|[lL])?\s*(xăng|dầu)?\s*$', s, re.I)
        if not clean_match:
            if has_odo_pattern and fuel and fuel > 0:
                issues.append(_issue(
                    'fuel_liters', 'warning',
                    f'Ô nhiên liệu chứa nhiều số (raw: {s[:40]!r})',
                    'Chỉ nhập SỐ LÍT vào ô này — không kèm chỉ số đồng hồ (ODO). '
                    'Ô ODO đã có riêng. Hệ thống đã lấy số lít = '
                    f'{fuel:.0f} từ giá trị bạn nhập.'
                ))
            elif has_letters and fuel == 0:
                issues.append(_issue(
                    'fuel_liters', 'info',
                    f'Ô nhiên liệu chứa chữ không hợp lệ (raw: {s[:40]!r})',
                    'Nếu không đổ nhiên liệu, để TRỐNG ô này (không cần ghi "K", "Không").'
                ))

    if fuel is None or fuel == 0:
        return issues  # 0 = không đổ — bình thường
    if fuel > MAX_REASONABLE_FUEL:
        issues.append(_issue(
            'fuel_liters', 'critical',
            f'Đổ {fuel:.0f} lít/chuyến là bất khả thi',
            'Bình xăng xe cứu thương 60-80 lít — kiểm tra lại số nhập.'
        ))
    elif fuel > MAX_FUEL_LITERS:
        issues.append(_issue(
            'fuel_liters', 'warning',
            f'Đổ {fuel:.0f} lít — khá nhiều',
            'Kiểm tra lại nếu đây không phải chuyến đi xa.'
        ))
    if fuel < 0:
        issues.append(_issue(
            'fuel_liters', 'critical',
            f'Lượng nhiên liệu âm: {fuel} lít',
            'Nhập số dương.'
        ))
    return issues


def validate_revenue(row: dict) -> list[dict]:
    """Doanh thu — chỉ áp dụng cho xe cứu thương; > 0 nếu là chuyến thu phí."""
    rev = _to_number(row.get('revenue_vnd') or row.get('Doanh thu'))
    vehicle_type = row.get('vehicle_type') or row.get('Loại xe', '')
    if rev is None or rev == 0:
        return []  # Nhiều chuyến nội bộ không thu phí — không lỗi
    if rev < 0:
        return [_issue(
            'revenue_vnd', 'critical',
            f'Doanh thu âm: {rev:,.0f} VNĐ',
            'Nhập số dương.'
        )]
    if rev > MAX_REVENUE_VND:
        return [_issue(
            'revenue_vnd', 'warning',
            f'Doanh thu rất cao: {rev:,.0f} VNĐ',
            'Kiểm tra lại — có thể nhập nhầm thêm số 0.'
        )]
    # Xe hành chính không thu phí — nếu có doanh thu là lạ
    if str(vehicle_type).strip() == 'Hành chính' and rev > 0:
        return [_issue(
            'revenue_vnd', 'warning',
            f'Xe hành chính có doanh thu {rev:,.0f} VNĐ?',
            'Xe hành chính thường không thu phí — kiểm tra lại.'
        )]
    return []


def validate_odometer(row: dict) -> list[dict]:
    """Chỉ số đồng hồ — phải là số nguyên dương, không quá lớn."""
    odo = _to_number(row.get('odometer') or row.get('Chỉ số đồng hồ sau khi kết thúc chuyến xe'))
    if odo is None:
        return [_issue(
            'odometer', 'warning',
            'Thiếu chỉ số đồng hồ (ODO)',
            'Nhập số trên đồng hồ km tổng của xe tại thời điểm kết thúc chuyến.'
        )]
    if odo < 0:
        return [_issue(
            'odometer', 'critical',
            f'ODO âm: {odo:.0f}',
            'Nhập số dương — chỉ số đồng hồ tổng (số km xe đã chạy tích luỹ).'
        )]
    if 0 < odo < MIN_ODO:
        return [_issue(
            'odometer', 'warning',
            f'ODO quá nhỏ: {odo:.0f} km — xe mới?',
            'Kiểm tra lại — xe đã hoạt động lâu thường có ODO > 10,000 km.'
        )]
    if odo > MAX_ODO:
        return [_issue(
            'odometer', 'critical',
            f'ODO quá lớn: {odo:,.0f} km',
            'Có thể bạn đã nhập thừa 1 số 0. ODO xe cứu thương thường < 1 triệu km.'
        )]
    return []


def validate_duplicate(row: dict) -> list[dict]:
    """Chuyến nghi trùng với chuyến khác."""
    if row.get('is_duplicate', False):
        return [_issue(
            'duplicate', 'critical',
            'Chuyến này trùng với chuyến khác (cùng tài xế, ngày, giờ, điểm đến)',
            'Kiểm tra trên Google Form — có thể bạn đã bấm Submit 2 lần. '
            'Xoá 1 trong 2 bản trùng trên Google Sheets.'
        )]
    return []


# ═══════════════════════════════════════════════════════════════════
#               MAIN: validate cả row
# ═══════════════════════════════════════════════════════════════════

VALIDATORS = [
    validate_driver,
    validate_vehicle,
    validate_date,
    validate_start_end_time,
    validate_destination,
    validate_work_category,
    validate_area_type,
    validate_distance,
    validate_fuel,
    validate_revenue,
    validate_odometer,
    validate_duplicate,
]


def validate_row(row: dict) -> dict:
    """Chạy tất cả validator, trả về dict tổng hợp.

    Returns:
        {
            'score':    int 0-100,
            'issues':   list of issue dicts (mỗi cái có field/severity/message/how_to_fix),
            'severity': severity cao nhất ('critical' / 'warning' / 'info' / 'ok'),
        }
    """
    all_issues = []
    for fn in VALIDATORS:
        try:
            all_issues.extend(fn(row))
        except Exception as e:
            # Validator lỗi không nên crash dashboard
            all_issues.append(_issue(
                fn.__name__, 'info',
                f'Lỗi validator: {e}',
                'Báo Tổ Xe để kiểm tra hệ thống.'
            ))

    # Tính điểm
    score = 100
    for iss in all_issues:
        score -= SEVERITY_PENALTY.get(iss['severity'], 0)
    score = max(0, min(100, score))

    # Severity tổng
    if any(i['severity'] == 'critical' for i in all_issues):
        sev = 'critical'
    elif any(i['severity'] == 'warning' for i in all_issues):
        sev = 'warning'
    elif any(i['severity'] == 'info' for i in all_issues):
        sev = 'info'
    else:
        sev = 'ok'

    return {
        'score': score,
        'issues': all_issues,
        'severity': sev,
    }
