/**
 * Hằng số và bảng ánh xạ cho việc làm sạch dữ liệu Tổ Lái Xe.
 *
 * Port từ fleet_cleaning.py + manual_fleet_sync.py của repo
 * UMC-APP/PHONGHC/umc-dashboard. Trước đây các bảng này lặp lại ở ba nơi
 * (manual_fleet_sync.py, dash_toxe.py, lib/fleet/types.ts); đây là nguồn
 * chân lý duy nhất.
 */

/** Vận tốc trung bình (km/h) để suy quãng đường khi tài xế nhập sai. */
export const AVG_SPEED_KMH: Record<string, number> = {
  'Nội thành': 30,
  'Ngoại thành': 50,
};

/** Vượt ngưỡng này chắc chắn là lỗi nhập liệu. */
export const MAX_REASONABLE_SPEED = 120;

/** Giờ lái một chuyến vượt ngưỡng này = đáng ngờ (nhầm start/end). */
export const SUSPICIOUS_TRIP_HOURS = 16;

/** Quãng đường hợp lệ tối đa của một chuyến. */
export const MAX_TRIP_DISTANCE_KM = 1000;

/** Delta odometer hợp lệ tối đa giữa hai chuyến liên tiếp. */
export const MAX_ODO_DELTA_KM = 1500;

/**
 * Gom các cách viết khác nhau của "Phân loại công tác" về 12 nhóm chuẩn.
 * Từ khoá đã bỏ dấu, viết thường — so khớp bằng `includes` sau khi bỏ dấu.
 * Thứ tự có ý nghĩa: nhóm khớp đầu tiên thắng.
 */
export const WORK_CATEGORY_RULES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Cấp cứu', ['cap cuu', 'cb ccuu', 'cap.cuu', 'ccuu']],
  ['Mua máu', ['mua mau']],
  ['Lấy máu ngoại viện', ['lay mau', 'lm ngoai vien']],
  ['Cận lâm sàng', ['cls', 'can lam sang']],
  ['Đưa Ban Giám đốc', ['ban giam doc', 'bgd', 'bgđ', 'pgđ', 'pgd', 'pho giam doc']],
  ['Đón bác sĩ hội chẩn', ['hoi chan', 'don bs', 'don bac si']],
  ['Đưa đón bệnh nhân', ['dua don benh nhan', 'don benh nhan', 'dua benh nhan', 'cho benh nhan', 'cho bn', 'dbn', 'dbshc']],
  ['Đưa đón khách', ['dua don khach', 'don khach', 'tham quan', 'doan khach']],
  ['Đưa cơm', ['dua com', 'giao com']],
  ['Vận chuyển trang thiết bị', ['vat tu', 'thiet bi', 'ttbyt', 'tttb']],
];

/** Xe hành chính — phần còn lại được coi là xe cứu thương. */
export const ADMIN_VEHICLES: readonly string[] = [
  '51B-330.67', '50A-012.59', '50A-007.20', '51A-1212', '50A-004.55',
];

export const AMBULANCE_VEHICLES: readonly string[] = [
  '50A-007.39', '50M-004.37', '50A-009.44', '50A-010.67',
  '50M-002.19', '51B-509.51', '50A-019.90', '50A-018.35',
];

/**
 * Email tài xế → tên chuẩn. Một người có thể có nhiều email (đổi máy, gõ nhầm),
 * nên nhiều khoá cùng trỏ về một tên là bình thường.
 */
export const EMAIL_TO_DRIVER: Readonly<Record<string, string>> = {
  'ngochai191974@gmail.com': 'Ngọc Hải',
  'nguyenngochai709749@gmail.com': 'Ngọc Hải',
  'phongthai230177@gmail.com': 'Thái Phong',
  'ledangthaiphong@gmail.com': 'Thái Phong',
  'dunglamlong@gmail.com': 'Long Dũng',
  'trananhtuan461970@gmail.com': 'Anh Tuấn',
  'traannhtuan461970@gmail.com': 'Anh Tuấn',
  'trananhtuan74797@gmail.com': 'Anh Tuấn',
  'thanhdungvo29@gmail.com': 'Thanh Dũng',
  'dvo567947@gmail.com': 'Thanh Dũng',
  'duck79884@gmail.com': 'Đức',
  'ngohoangxuyen@gmail.com': 'Hoàng Xuyên',
  'hodinhxuyen@gmail.com': 'Đình Xuyên',
  'nvhung1981970@gmail.com': 'Văn Hùng',
  'hungnguyen1981970@gmail.com': 'Văn Hùng',
  'thanggptk21@gmail.com': 'Văn Thảo',
  'thaonguyenvan860@gmail.com': 'Văn Thảo',
  'nguyenhung091281@gmail.com': 'Nguyễn Hùng',
  'nguyenhungumc@gmail.com': 'Nguyễn Hùng',
  'nguyemthanhtrung12345@gmail.com': 'Thành Trung',
  'hoanganhsie1983@gmail.com': 'Hoàng Anh',
  'hoanganhsieumc@gmail.com': 'Hoàng Anh',
  'anhphamumc1983@gmail.com': 'Hoàng Anh',
  'dohungcuong1970@gmail.com': 'Hùng Cường',
};

/** Giá trị trả về khi không xác định được tên tài xế. */
export const UNKNOWN_DRIVER = 'Không xác định';
