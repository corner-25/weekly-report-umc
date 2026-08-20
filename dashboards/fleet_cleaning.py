"""
fleet_cleaning.py
─────────────────────────────────────────────────────────────────────
Bộ quy tắc làm sạch dữ liệu Tổ Lái Xe — dùng chung cho 2 chỗ:
  1. manual_fleet_sync.py — clean TRƯỚC khi push lên GitHub (data sạch tại nguồn)
  2. dash_toxe.py         — clean KHI load (fallback an toàn nếu file GitHub bị raw)

Tác giả: Phòng Hành chính, BV Đại học Y Dược TP.HCM
"""
import re
import unicodedata
import pandas as pd
import numpy as np


# ═══════════════════════════════════════════════════════════════════
#                       CONSTANTS / RULES
# ═══════════════════════════════════════════════════════════════════

# Vận tốc trung bình (km/h) để suy luận quãng đường khi nhập sai
AVG_SPEED_KMH = {'Nội thành': 30, 'Ngoại thành': 50}
MAX_REASONABLE_SPEED = 120  # km/h — vượt ngưỡng = chắc chắn lỗi

# Giờ lái 1 chuyến vượt ngưỡng này = đáng ngờ (tài xế nhập nhầm start/end)
SUSPICIOUS_TRIP_HOURS = 16  # giờ

# Gom 893 typo phân loại công tác → 12 nhóm chuẩn
WORK_CATEGORY_RULES = [
    # (Nhóm chuẩn, list từ khoá để match — lowercase, không dấu)
    ('Cấp cứu',                   ['cap cuu', 'cb ccuu', 'cap.cuu', 'ccuu']),
    ('Mua máu',                   ['mua mau']),
    ('Lấy máu ngoại viện',        ['lay mau', 'lm ngoai vien']),
    ('Cận lâm sàng',              ['cls', 'can lam sang']),
    ('Đưa Ban Giám đốc',          ['ban giam doc', 'bgd', 'bgđ', 'pgđ',
                                   'pgd', 'pho giam doc']),
    ('Đón bác sĩ hội chẩn',       ['hoi chan', 'don bs', 'don bac si']),
    ('Đưa đón bệnh nhân',         ['dua don benh nhan', 'don benh nhan',
                                   'dua benh nhan', 'cho benh nhan',
                                   'cho bn', 'dbn', 'dbshc']),
    ('Đưa đón khách',             ['dua don khach', 'don khach',
                                   'tham quan', 'doan khach']),
    ('Đưa cơm',                   ['dua com', 'giao com']),
    ('Vận chuyển trang thiết bị', ['vat tu', 'thiet bi', 'ttbyt', 'tttb']),
]


# ═══════════════════════════════════════════════════════════════════
#                         HELPERS
# ═══════════════════════════════════════════════════════════════════

def remove_vn_accents(s):
    """Bỏ dấu tiếng Việt cho fuzzy matching."""
    if not s:
        return ''
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.replace('đ', 'd').replace('Đ', 'D').lower().strip()


def parse_duration_to_hours(duration_str):
    """Chuyển 'h:mm' hoặc 'h:mm:ss AM/PM' sang số giờ thập phân.

    LƯU Ý: hàm này chỉ dùng để đọc cột 'Thời gian' cũ (đã biết là không
    đáng tin). Để tính giờ lái CHUẨN, dùng compute_driving_hours() —
    luôn tính end_time - start_time.
    """
    if pd.isna(duration_str) or duration_str == '':
        return 0.0
    s = str(duration_str).strip()
    if 'AM' in s.upper() or 'PM' in s.upper():
        s = s.split()[0]
    try:
        parts = s.split(':')
        if len(parts) == 2:
            return int(parts[0]) + int(parts[1]) / 60.0
        if len(parts) == 3:
            return int(parts[0]) + int(parts[1]) / 60.0 + int(parts[2]) / 3600.0
        return 0.0
    except (ValueError, IndexError):
        return 0.0


def parse_fuel_liters(value):
    """Parse số lít nhiên liệu từ giá trị nhập linh hoạt của tài xế.

    Pattern thực tế tài xế đã nhập (audit từ data thật):
      • "50"                  → 50
      • "50.5" / "50,5"        → 50.5
      • "25lit" / "45 lít"     → 25 / 45
      • "60 Lit 01"            → 60 (lấy số đầu, '01' bỏ qua)
      • "50 lít xăng"          → 50
      • "80 lít dầu"           → 80
      • "50lx-km 520121"       → 50 (số đầu là lít, số sau là ODO bị nhập sai cột)
      • "60 LD KM 94839"       → 60
      • "60/20500"             → 60 (format lít/odo)
      • "50/E10"               → 50 (E10 = loại xăng, lít = 50)
      • "K", "Không", "Không l" → 0 (không đổ)
      • "Cb ccuu", "Lau 6 mmau" → 0 (rác nhập sai cột)
      • "520121"               → 0 (chỉ có ODO, không có lít)
      • ""  /  None / NaN      → 0 (rỗng)

    Quy tắc:
      1. Trích SỐ ĐẦU TIÊN xuất hiện trong chuỗi
      2. Nếu số đó trong [0, 100] → là lít hợp lệ
      3. Nếu > 100 → coi như 0 (xe không đổ được quá 100 lít)
      4. Nếu không có số → 0
    """
    if value is None:
        return 0.0
    try:
        if pd.isna(value):
            return 0.0
    except (TypeError, ValueError):
        pass

    # Nếu đã là số sẵn (int/float)
    if isinstance(value, (int, float)):
        if 0 <= value <= 100:
            return float(value)
        return 0.0

    s = str(value).strip()
    if not s:
        return 0.0

    # Tìm SỐ ĐẦU TIÊN trong chuỗi (cho phép thập phân với . hoặc ,)
    # Pattern: digit(s) optionally followed by .digits or ,digits
    m = re.search(r'(-?\d+(?:[.,]\d+)?)', s)
    if not m:
        return 0.0  # "K", "Không", "Cb ccuu"...

    num_str = m.group(1).replace(',', '.')
    try:
        n = float(num_str)
    except ValueError:
        return 0.0

    # Vận hành thực tế: bình xăng xe cứu thương 60-80L, không quá 100L
    if 0 <= n <= 100:
        return round(n, 2)
    return 0.0  # > 100 = không phải lít (có thể là ODO, hoặc rác)


def parse_clock_with_ampm(s):
    """Parse mốc giờ → (minutes, ampm_flag).

    ampm_flag là 'AM' / 'PM' / None (None = format 24h).
    Cần phân biệt vì cùng-AM hoặc cùng-PM mà end < start = nhập nhầm,
    còn PM→AM hoặc 24h là qua đêm thật.
    """
    if pd.isna(s) or s == '':
        return None, None
    s = str(s).strip()
    ampm = None
    if 'AM' in s.upper():
        ampm = 'AM'
        s = re.sub(r'(?i)\s*am', '', s)
    elif 'PM' in s.upper():
        ampm = 'PM'
        s = re.sub(r'(?i)\s*pm', '', s)
    m = re.match(r'^(\d+):(\d{1,2})', s.strip())
    if not m:
        return None, None
    h, mi = int(m.group(1)), int(m.group(2))
    if ampm == 'PM' and h != 12:
        h += 12
    elif ampm == 'AM' and h == 12:
        h = 0
    if h > 23 or mi > 59:
        return None, None
    return h * 60 + mi, ampm


def parse_clock_to_minutes(s):
    """Alias chỉ trả phút (giữ tương thích ngược)."""
    minutes, _ = parse_clock_with_ampm(s)
    return minutes


def _estimate_hours_from_km(km, area_type):
    """Ước lượng giờ từ km và vận tốc trung bình theo địa bàn."""
    try:
        km = float(km)
    except (TypeError, ValueError):
        return None
    if pd.isna(km) or km <= 0 or km > 5000:
        return None
    speed = 25 if area_type == 'Nội thành' else 45  # km/h, gồm thời gian chờ
    return round(km / speed, 2)


def compute_driving_hours(start_raw, end_raw, distance_km=None,
                          area_type=None, return_meta=False):
    """Tính GIỜ LÁI thông minh = end_time - start_time, có sửa lỗi tự động.

    Pipeline auto-detect (clock là source of truth, km là sanity check):
      1. end > start                          → 'normal'
      2. end < start, cùng AM hoặc cùng PM    → 'fixed_ampm' (+12h, KHÔNG +24h)
                                                 Nếu km nhỏ mà giờ lớn → cap theo km
      3. end < start, PM→AM hoặc 24h format   → 'overnight' (+24h)
                                                 Nếu > 16h: 'overnight_long' (nếu km lớn)
                                                            'overnight_suspicious' (nếu km nhỏ)
      4. end == start hoặc thiếu giờ          → 'estimated' từ km (nếu có)

    Tham số:
        start_raw, end_raw: chuỗi giờ (24h hoặc AM/PM)
        distance_km:        số km của chuyến (sanity check, tuỳ chọn)
        area_type:          'Nội thành' / 'Ngoại thành' (cho km estimate)
        return_meta:        True → trả (hours, confidence, method)
                            False (default) → chỉ trả hours

    Trả về:
        Nếu return_meta=False: float giờ hoặc np.nan
        Nếu return_meta=True:  (hours, 'high'|'medium'|'low', method_str)
    """
    s_min, s_amp = parse_clock_with_ampm(start_raw)
    e_min, e_amp = parse_clock_with_ampm(end_raw)

    # Chuẩn hoá km
    try:
        km = float(distance_km) if distance_km not in (None, '') else None
    except (TypeError, ValueError):
        km = None
    if km is not None and (km < 0 or km > 5000):
        km = None

    def _result(hours, conf, method):
        if hours is None:
            return (np.nan, conf, method) if return_meta else np.nan
        return (round(hours, 3), conf, method) if return_meta else round(hours, 3)

    # Không có giờ → estimate từ km
    if s_min is None or e_min is None:
        return _result(_estimate_hours_from_km(km, area_type), 'low', 'estimated_no_time')

    diff = e_min - s_min  # phút

    # end == start → estimate
    if diff == 0:
        return _result(_estimate_hours_from_km(km, area_type), 'low', 'estimated_zero_diff')

    # CASE A: bình thường
    if diff > 0:
        hrs = diff / 60
        conf = _confidence_from_speed(hrs, km)
        return _result(hrs, conf, 'normal')

    # CASE B: end < start
    same_period = (s_amp is not None and e_amp is not None and s_amp == e_amp)

    if same_period:
        # CHẮC CHẮN không phải qua đêm — flip end thêm 12h
        flipped = (diff + 12 * 60) / 60
        if 0 < flipped <= 16:
            # Cross-check với km: chuyến km rất nhỏ nhưng flipped vẫn > 2h → cap
            if km is not None and km < 30 and flipped > 2:
                cap = max(km / 5, 0.5)  # vận tốc tối thiểu 5 km/h, ít nhất 30 phút
                if cap < flipped:
                    return _result(min(flipped, cap + 1), 'medium', 'fixed_ampm_km_capped')
            return _result(flipped, 'medium', 'fixed_ampm')
        # Flipped vẫn không hợp lý → estimate km
        return _result(_estimate_hours_from_km(km, area_type), 'low', 'estimated_invalid_clock')

    # CASE C: end < start, KHÁC AM/PM hoặc 24h format → qua đêm (+24h)
    overnight = (diff + 24 * 60) / 60
    if overnight <= 16:
        return _result(overnight, _confidence_from_speed(overnight, km), 'overnight')

    # overnight > 16h: phân loại theo km
    if km is not None and km > 100:
        return _result(overnight, 'medium', 'overnight_long')
    return _result(overnight, 'low', 'overnight_suspicious')


def _confidence_from_speed(hrs, km):
    """High confidence nếu vận tốc trong khoảng thực tế [5, 100] km/h."""
    if km is None or km <= 0 or hrs <= 0:
        return 'medium'
    speed = km / hrs
    return 'high' if 5 <= speed <= 100 else 'medium'


# ═══════════════════════════════════════════════════════════════════
#                  CLEANING FUNCTIONS — TỪNG CỘT
# ═══════════════════════════════════════════════════════════════════

def classify_work_category(raw):
    """Match raw category vào 1 trong 12 nhóm chuẩn (hoặc 'Khác'/'Không xác định')."""
    if pd.isna(raw) or str(raw).strip() == '':
        return 'Không xác định'
    s_clean = remove_vn_accents(str(raw))
    for group, keywords in WORK_CATEGORY_RULES:
        for kw in keywords:
            if remove_vn_accents(kw) in s_clean:
                return group
    return 'Khác'


def normalize_destination(s):
    """Chuẩn hoá: TPHCM → TP. HCM, q5/Q5/quận 5 → Q.5, title-case."""
    if pd.isna(s) or s == '':
        return ''
    s = str(s).strip()
    s = re.sub(r'\s+', ' ', s)

    # Chuẩn hoá Quận trước (để không bị TPHCM nuốt 'q5')
    def _normalize_quan(m):
        return f' Q.{m.group(1)} '
    s = re.sub(r'(?i)quận\s*(\d{1,2})', _normalize_quan, s)
    s = re.sub(r'(?i)quan\s*(\d{1,2})', _normalize_quan, s)
    s = re.sub(r'(?i)q[\.\s]*(\d{1,2})(?![\w])', _normalize_quan, s)

    # Chuẩn hoá TPHCM
    s = re.sub(r'(?i)\btphcm\s*', 'TP. HCM ', s)
    s = re.sub(r'(?i)\btp\.?\s*hcm\s*', 'TP. HCM ', s)
    s = re.sub(r'(?i)\bt\.?p\.?\s*hồ\s*chí\s*minh\s*', 'TP. HCM ', s)
    s = re.sub(r'(?i)\bho\s*chi\s*minh\s*', 'TP. HCM ', s)

    # Gom dấu phân cách
    s = re.sub(r'TP\.\s*HCM\s*[-\s]+\s*Q\.', 'TP. HCM-Q.', s)
    s = re.sub(r'\s*-\s*', '-', s)
    s = re.sub(r'\s+', ' ', s).strip()

    # Title-case (Bv → BV, gò vấp → Gò Vấp)
    def _title_part(part):
        words = part.split()
        out = []
        for w in words:
            wl = w.lower()
            if wl in ('bv', 'tmhh', 'bgd', 'bgđ', 'pgđ', 'pgd', 'umc', 'q'):
                out.append(w.upper())
            elif w.startswith('Q.'):
                out.append(w)
            else:
                out.append(w[:1].upper() + w[1:].lower() if w else w)
        return ' '.join(out)
    parts = s.split('-')
    s = '-'.join(_title_part(p) for p in parts)
    s = re.sub(r'(?i)\btp\. hcm\b', 'TP. HCM', s)
    return s


def fix_driver_name_from_email(driver_raw, email_raw, email_map):
    """Sửa tên tài xế: rỗng / dạng email / None → lookup từ Email Address."""
    raw = '' if (driver_raw is None or pd.isna(driver_raw)) else str(driver_raw).strip()
    email = '' if (email_raw is None or pd.isna(email_raw)) else str(email_raw).strip().lower()

    # Tên hợp lệ: không rỗng, không phải email
    if raw and '@' not in raw and raw.lower() not in ('nan', 'none'):
        return raw

    # Lookup từ email
    if email in email_map:
        return email_map[email]
    if '@' in raw and raw.lower() in email_map:
        return email_map[raw.lower()]
    return 'Không xác định'


def infer_area_type(row, area_col='area_type', dest_col='destination'):
    """Suy luận Nội/Ngoại thành từ Điểm đến khi rỗng."""
    cur = row.get(area_col)
    if cur and not pd.isna(cur) and str(cur).strip():
        return cur
    dest = remove_vn_accents(str(row.get(dest_col, '')))
    if 'tp. hcm' in dest or 'tphcm' in dest or 'q.' in dest:
        return 'Nội thành'
    return 'Ngoại thành'


def fix_distance_outliers(
    df,
    distance_col='distance_km',
    odo_col='odometer',
    vehicle_col='vehicle_id',
    timestamp_col='timestamp',
    hours_col='duration_hours',
    area_col='area_type',
    vehicle_type_col=None,
):
    """Chốt quãng đường cuối cùng theo một pipeline duy nhất.

    Km được giữ nguyên khi là số dương, <= 1000 và không tạo vận tốc
    vượt 120 km/h. Nếu sai/thiếu/0, kết quả cuối được ước lượng trực tiếp:
    giờ lái × tốc độ trung vị của các chuyến hợp lệ trong dữ liệu lịch sử.

    ODO không còn được dùng để sửa km vì delta ODO phụ thuộc thứ tự nhập
    chuyến và dễ lan lỗi từ một bản ghi trước đó.
    """
    if distance_col not in df.columns:
        return df

    df = df.copy()
    hours = pd.to_numeric(
        df.get(hours_col, pd.Series(np.nan, index=df.index)), errors='coerce'
    )
    km_clean = pd.to_numeric(df[distance_col], errors='coerce').copy()
    methods = pd.Series('reported', index=df.index, dtype='object')
    confidence = pd.Series('high', index=df.index, dtype='object')
    corrected = pd.Series(False, index=df.index, dtype='bool')
    reasons = pd.Series('', index=df.index, dtype='object')
    estimation_speed = pd.Series(np.nan, index=df.index, dtype='float64')
    speed_source = pd.Series('', index=df.index, dtype='object')
    speed_samples = pd.Series(0, index=df.index, dtype='int64')

    duration_conf = df.get('duration_confidence', pd.Series('low', index=df.index))

    # Tạo bộ tham chiếu từ các chuyến cũ có km nhập hợp lệ và vận tốc 5-120 km/h.
    # Ưu tiên dữ liệu trước tháng mới nhất; nếu không đủ thì dùng toàn bộ lịch sử hợp lệ.
    speeds = km_clean / hours
    valid_reference = (
        km_clean.gt(0) & km_clean.le(1000) & hours.gt(0) &
        speeds.between(5, MAX_REASONABLE_SPEED)
    )
    parsed_ts = (
        pd.to_datetime(df[timestamp_col], errors='coerce')
        if timestamp_col in df.columns else pd.Series(pd.NaT, index=df.index)
    )
    if parsed_ts.notna().any():
        latest = parsed_ts.max()
        cutoff = latest.to_period('M').start_time
        old_reference = valid_reference & parsed_ts.lt(cutoff)
        if int(old_reference.sum()) >= 30:
            valid_reference = old_reference

    if vehicle_type_col is None:
        if 'vehicle_type' in df.columns:
            vehicle_type_col = 'vehicle_type'
        elif 'Loại xe' in df.columns:
            vehicle_type_col = 'Loại xe'

    reference = pd.DataFrame(index=df.index)
    reference['speed'] = speeds
    reference['area'] = df.get(area_col, pd.Series('Không xác định', index=df.index)).fillna('Không xác định')
    reference['vehicle_type'] = (
        df.get(vehicle_type_col, pd.Series('Tất cả', index=df.index)).fillna('Tất cả')
        if vehicle_type_col else 'Tất cả'
    )
    reference = reference[valid_reference]

    def _median_with_count(mask):
        values = reference.loc[mask, 'speed']
        return (float(values.median()), int(values.count())) if not values.empty else (np.nan, 0)

    global_speed = float(reference['speed'].median()) if not reference.empty else np.nan
    global_count = int(reference['speed'].count())

    def historical_speed(area, vehicle_type):
        cohort_mask = (reference['area'] == area) & (reference['vehicle_type'] == vehicle_type)
        speed, count = _median_with_count(cohort_mask)
        if count >= 10:
            return speed, count, f'historical_vehicle_area:{vehicle_type}|{area}'
        area_speed, area_count = _median_with_count(reference['area'] == area)
        if area_count >= 10:
            return area_speed, area_count, f'historical_area:{area}'
        if global_count:
            return global_speed, global_count, 'historical_all_valid_trips'
        # Chỉ dùng khi hệ thống hoàn toàn chưa có dữ liệu lịch sử hợp lệ.
        fallback = AVG_SPEED_KMH.get(area, 30)
        return float(fallback), 0, 'fallback_no_history'

    for idx in df.index:
        km = km_clean.loc[idx]
        h = hours.loc[idx] if idx in hours.index else np.nan
        area = df.at[idx, area_col] if area_col in df.columns else 'Nội thành'

        if pd.isna(km):
            reason = 'missing_or_not_numeric'
        elif km <= 0:
            reason = 'zero_or_negative'
        elif km > 1000:
            reason = 'over_1000_km'
        else:
            reason = ''
        is_bad = bool(reason)
        if not is_bad and pd.notna(h) and h > 0 and (km / h) > MAX_REASONABLE_SPEED:
            is_bad = True
            reason = 'speed_over_120_kmh'
        if not is_bad:
            continue

        corrected.loc[idx] = True
        reasons.loc[idx] = reason
        if pd.notna(h) and h > 0:
            vehicle_type = (
                df.at[idx, vehicle_type_col]
                if vehicle_type_col and vehicle_type_col in df.columns else 'Tất cả'
            )
            speed, sample_count, source = historical_speed(area, vehicle_type)
            km_clean.loc[idx] = round(h * speed, 1)
            methods.loc[idx] = 'estimated_from_hours'
            estimation_speed.loc[idx] = round(speed, 2)
            speed_source.loc[idx] = source
            speed_samples.loc[idx] = sample_count
            d_conf = duration_conf.loc[idx] if idx in duration_conf.index else 'low'
            confidence.loc[idx] = (
                'medium' if sample_count >= 10 and d_conf in ('high', 'medium') and h <= 16
                else 'low'
            )
            continue

        methods.loc[idx] = 'unresolved_no_valid_hours'
        confidence.loc[idx] = 'low'
        km_clean.loc[idx] = np.nan

    df[distance_col] = km_clean.reindex(df.index)
    df['distance_method'] = methods
    df['distance_confidence'] = confidence
    df['distance_corrected'] = corrected
    df['distance_correction_reason'] = reasons
    df['distance_estimation_speed_kmh'] = estimation_speed
    df['distance_speed_source'] = speed_source
    df['distance_speed_sample_count'] = speed_samples
    return df


# ═══════════════════════════════════════════════════════════════════
#                  HÀM TỔNG: clean toàn bộ DataFrame
# ═══════════════════════════════════════════════════════════════════

def clean_fleet_dataframe(
    df,
    email_to_driver=None,
    keep_raw=True,
    col_names=None
):
    """
    Clean toàn bộ DataFrame Tổ Xe.

    Tham số:
        df:              DataFrame raw từ Google Sheets hoặc từ GitHub
        email_to_driver: dict {email: tên tài xế chuẩn}
        keep_raw:        Bool. True → lưu cột gốc với suffix '_raw'
        col_names:       dict tên cột. Mặc định dùng tên tiếng Việt từ Form.
                         VD khi gọi từ dash_toxe.py (sau khi rename) thì truyền:
                         {'driver': 'driver_name', 'email': 'email', ...}

    Trả về:
        DataFrame đã clean (cùng index, cùng số dòng).
    """
    if email_to_driver is None:
        email_to_driver = {}

    # Default column names = tên tiếng Việt từ Google Form
    defaults = {
        'driver':       'Tên tài xế',
        'email':        'Email Address',
        'work_cat':     'Phân loại công tác',
        'destination':  'Điểm đến',
        'area':         'Nội thành/Ngoại thành',
        'distance':     'Quãng đường',
        'duration':     'Thời gian',          # cột cũ — KHÔNG đáng tin
        'start':        'start_time',
        'end':          'end_time',
        'odo':          'Chỉ số đồng hồ sau khi kết thúc chuyến xe',
        'fuel':         'Đổ nhiên liệu (Số lít)',
        'vehicle':      'Mã xe',
        'timestamp':    'Timestamp',
        'date':         'Ngày ghi nhận',
    }
    if col_names:
        defaults.update(col_names)
    C = defaults

    df = df.copy()

    # 1. Drop cột rác
    if 'Column 1' in df.columns:
        df = df.drop(columns=['Column 1'])

    # Helper: check 1 ô có dữ liệu thật hay rỗng/sentinel
    def _is_blank(v):
        if v is None or pd.isna(v):
            return True
        txt = str(v).strip()
        return txt == '' or txt.lower() in ('nan', 'none', '0:00')

    # 1b. LOẠI DÒNG RỖNG HOÀN TOÀN
    #     Google Sheets có sẵn các hàng trống chưa ai nhập (chỉ có Mã xe,
    #     Loại xe — là metadata tự gắn theo tab). Một dòng được coi là RỖNG
    #     nếu KHÔNG có trường nào do TÀI XẾ nhập trực tiếp:
    #       ngày, giờ bắt đầu/kết thúc, điểm đến, phân loại, timestamp.
    #     LƯU Ý: KHÔNG dùng Quãng đường / Nội-Ngoại thành làm tín hiệu vì
    #     các dòng rỗng vẫn có thể chứa rác (-293769) hoặc giá trị mặc định.
    _signal_cols = [C['date'], C['start'], C['end'], C['destination'],
                    C['work_cat'], C['timestamp']]
    _signal_cols = [c for c in _signal_cols if c in df.columns]
    if _signal_cols:
        def _has_data(row):
            return any(not _is_blank(row.get(c)) for c in _signal_cols)
        mask_keep = df.apply(_has_data, axis=1)
        n_dropped = int((~mask_keep).sum())
        if n_dropped > 0:
            df = df[mask_keep].reset_index(drop=True)

    # 1c. LOẠI DÒNG KHÔNG CÓ DANH TÍNH NGƯỜI NHẬP
    #     Một số dòng có dữ liệu (ngày, điểm đến, km) NHƯNG cả ô Email lẫn
    #     ô Tên tài xế đều rỗng — thường là dữ liệu test cũ trước khi triển
    #     khai Form chính thức, hoặc nhập trực tiếp trên Sheets không kèm
    #     metadata người dùng. Các chuyến không có chủ → loại bỏ.
    #     Lưu ý: cũng coi 'Không xác định' (kết quả từ vòng sync trước) là
    #     blank để rule áp dụng được trên file đã clean một phần.
    def _no_identity(v):
        if _is_blank(v):
            return True
        return str(v).strip().lower() in ('không xác định', 'khong xac dinh')

    if C['email'] in df.columns and C['driver'] in df.columns:
        mask_keep = df.apply(
            lambda r: not (_is_blank(r.get(C['email'])) and _no_identity(r.get(C['driver']))),
            axis=1
        )
        n_dropped = int((~mask_keep).sum())
        if n_dropped > 0:
            df = df[mask_keep].reset_index(drop=True)

    # 2. Sửa Tên tài xế
    if C['driver'] in df.columns and C['email'] in df.columns:
        if keep_raw:
            df[f"{C['driver']}_raw"] = df[C['driver']]
        df[C['driver']] = df.apply(
            lambda r: fix_driver_name_from_email(
                r[C['driver']], r[C['email']], email_to_driver
            ),
            axis=1
        )

    # 3. Chuẩn hoá Phân loại công tác (893 → 12 nhóm)
    if C['work_cat'] in df.columns:
        if keep_raw:
            df[f"{C['work_cat']}_raw"] = df[C['work_cat']]
        df[C['work_cat']] = df[C['work_cat']].apply(classify_work_category)

    # 4. Chuẩn hoá Điểm đến
    if C['destination'] in df.columns:
        if keep_raw:
            df[f"{C['destination']}_raw"] = df[C['destination']]
        df[C['destination']] = df[C['destination']].apply(normalize_destination)

    # 4b. PARSE LƯỢNG NHIÊN LIỆU TỪ INPUT TỰ DO
    #     Tài xế nhập rất đa dạng: "50", "50 lít xăng", "50lx-km 520121",
    #     "60/20500", "K", "Không"... → trích số đầu tiên, chỉ chấp nhận
    #     giá trị 0-100 lít (bình xăng xe cứu thương không quá 100L).
    if C['fuel'] in df.columns:
        if keep_raw:
            df[f"{C['fuel']}_raw"] = df[C['fuel']]
        df[C['fuel']] = df[C['fuel']].apply(parse_fuel_liters)

    # 5. TÍNH GIỜ LÁI THÔNG MINH (auto-detect các trường hợp lỗi)
    #    Pipeline: clock first, km là sanity check. Trả về 3 cột:
    #      duration_hours      — số giờ (đã sửa tự động nếu phát hiện lỗi)
    #      duration_confidence — 'high' / 'medium' / 'low'
    #      duration_method     — 'normal' / 'overnight' / 'fixed_ampm' / 'estimated_*' / ...
    #    KHÔNG dùng cột 'Thời gian' của Sheets vì cột đó format sai.
    if C['start'] in df.columns and C['end'] in df.columns:
        if keep_raw and C['duration'] in df.columns:
            df[f"{C['duration']}_raw"] = df[C['duration']]  # giữ cột cũ để đối chiếu

        # Xoá các cột derived nếu đã có sẵn (file GitHub có thể được clean
        # từ vòng sync trước → tránh duplicate columns khi concat).
        for _c in ('duration_hours', 'duration_confidence',
                   'duration_method', 'duration_suspicious', 'duration_hours_tmp'):
            if _c in df.columns:
                df = df.drop(columns=[_c])

        def _compute(row):
            return compute_driving_hours(
                row[C['start']],
                row[C['end']],
                distance_km=row.get(C['distance']),
                area_type=row.get(C['area']),
                return_meta=True,
            )

        meta = df.apply(_compute, axis=1, result_type='expand')
        meta.columns = ['duration_hours', 'duration_confidence', 'duration_method']
        df = pd.concat([df, meta], axis=1)

        # Cờ "đáng ngờ": chuyến có confidence thấp HOẶC giờ > 16h
        df['duration_suspicious'] = (
            (df['duration_confidence'] == 'low') |
            (df['duration_hours'] > SUSPICIOUS_TRIP_HOURS)
        )
        # Helper col cho bước sửa quãng đường
        df['duration_hours_tmp'] = df['duration_hours']

    # 6. Suy luận Nội/Ngoại thành nếu rỗng
    if C['area'] in df.columns and C['destination'] in df.columns:
        df[C['area']] = df.apply(
            lambda r: infer_area_type(r, area_col=C['area'], dest_col=C['destination']),
            axis=1
        )

    # 7. Fallback Ngày ghi nhận từ Timestamp
    if C['date'] in df.columns and C['timestamp'] in df.columns:
        d = pd.to_datetime(df[C['date']], errors='coerce')
        ts = pd.to_datetime(df[C['timestamp']], errors='coerce')
        df[C['date']] = d.fillna(ts).dt.strftime('%-m/%-d/%Y')

    # 8. Sửa Quãng đường lỗi (cần helper hours)
    if C['distance'] in df.columns:
        if keep_raw:
            df[f"{C['distance']}_raw"] = df[C['distance']]
        df = fix_distance_outliers(
            df,
            distance_col=C['distance'],
            odo_col=C['odo'],
            vehicle_col=C['vehicle'],
            timestamp_col=C['timestamp'],
            hours_col='duration_hours_tmp',
            area_col=C['area'],
        )

    # 9. ĐÁNH CỜ CHUYẾN NGHI TRÙNG
    #    Hai chuyến được coi là nghi trùng nếu giống nhau ở TẤT CẢ:
    #    tài xế + mã xe + ngày + giờ bắt đầu + giờ kết thúc + điểm đến.
    #    Bản đầu tiên giữ is_duplicate=False, các bản sau = True.
    #    KHÔNG xoá — chỉ đánh dấu để nhân sự rà soát.
    dup_cols = [C['driver'], C['vehicle'], C['date'],
                C['start'], C['end'], C['destination']]
    dup_cols = [c for c in dup_cols if c in df.columns]
    if len(dup_cols) >= 4:
        df['is_duplicate'] = df.duplicated(subset=dup_cols, keep='first')
    else:
        df['is_duplicate'] = False

    # 10. Cleanup helper col
    if 'duration_hours_tmp' in df.columns:
        df = df.drop(columns=['duration_hours_tmp'])

    return df
