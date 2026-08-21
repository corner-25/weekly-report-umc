# Audit hai dashboard Python

Ngày: 2026-08-21

## Đã sửa

### Dashboard Tổ Xe: 3.854 → 3.429 dòng (−425, 11%)

| Xoá | Dòng | Lý do |
|---|---|---|
| `load_large_file_via_git_api` | 87 | Đọc GitHub — nay đọc Postgres |
| `run_sync_script` | 51 | **Gọi `manual_fleet_sync.py` không còn tồn tại** |
| `load_data_from_github` | 42 | như trên |
| `process_dataframe` | 181 | Làm sạch dữ liệu — ingestion layer đã làm rồi |
| `parse_duration_to_hours` | 39 | Thay bằng `compute_driving_hours` |
| `get_github_token` | 27 | Không còn đọc GitHub |
| `COLUMN_MAPPING` | 39 | Đọc thẳng từ DB, không cần đổi tên cột |

**Lỗi thật đã sửa:** nút "🔄 Sync dữ liệu mới" trên sidebar gọi `manual_fleet_sync.py` —
file này đã bỏ khỏi repo khi chuyển sang connector. Bấm vào luôn báo lỗi. Đã gỡ nút, thay
bằng ghi chú dữ liệu đồng bộ tự động 07:00.

Cũng gỡ "📋 Column Mapping Guide" — hướng dẫn ánh xạ tên cột tiếng Việt sang tiếng Anh,
vô nghĩa khi dữ liệu đọc thẳng từ Postgres với tên cột đã chuẩn.

### Dashboard Hành chính: xoá 504 dòng chết

| File | Trước | Sau | Hàm xoá |
|---|---|---|---|
| `utils.py` | 1.951 | 1.600 | 6 hàm xử lý dữ liệu không ai gọi |
| `data_loader.py` | 397 | 277 | `load_data_from_github_optimized`, `save_cache_to_github` |
| `config.py` | 168 | 135 | `render_header` |

## Đã bổ sung

### Bảng chất lượng dữ liệu (Tổ Xe)

Pipeline mới tính ra bốn cột mà dashboard **không hiển thị gì**: `duration_confidence`,
`duration_method`, `duration_suspicious`, `distance_fix_method`.

Đây là thiếu sót đáng kể — giờ lái trong dashboard không phải lúc nào cũng là số đo thật:

```
normal                    end − start, đo trực tiếp
fixed_ampm                Tài xế nhầm AM/PM → cộng 12h
overnight                 Chuyến qua đêm → cộng 24h
estimated_no_time         Thiếu giờ → ước từ quãng đường
overnight_suspicious      Qua đêm nhưng quãng đường ngắn — đáng ngờ
```

Đã thêm mục "🔍 Chất lượng dữ liệu" hiện: số chuyến tin cậy cao/thấp, số chuyến đã sửa
quãng đường, cảnh báo chuyến giờ lái đáng ngờ, và bảng phân bố cách tính giờ.

Người xem cần biết con số nào là đo thật, con số nào là suy ra.

## Chưa làm — cần quyết định

### Dashboard Hành chính vẫn đọc GitHub

Khác dashboard Tổ Xe (đã chuyển sang Postgres), `dash_phonghc_v2` vẫn đọc 6 file JSON từ
`corner-25/dashboard-storage`.

Không thể chuyển tương tự vì **hai nguồn dữ liệu khác hẳn nhau**:

| | Nội dung | Nguồn |
|---|---|---|
| `hc_metrics` (đã có, 1.732 dòng) | Danh mục / Nội dung / Tuần / Số liệu | OneDrive |
| `dash_phonghc_v2` cần | Văn bản đến, đi, công việc, phòng họp, lịch họp, tổng hợp | HC OfficeAPI |

Muốn chuyển phải làm connector `hc-officeapi` trước — mà cái đó vướng ràng buộc mạng: API
chỉ gọi được từ trong mạng UMC, nên phải giữ GitHub làm cầu vượt tường lửa. Xem
`docs/INGESTION-REFACTOR.md` mục 3.4.

Hiện tại dashboard vẫn chạy tốt qua GitHub, nên đây là việc cải tiến chứ không phải lỗi.

### Gợi ý cải tiến hiển thị (chưa làm)

**Tổ Xe:**
- Chuyến nghi trùng đang bị loại ở tầng ingestion (`duplicatesDropped`) nhưng dashboard
  không biết con số đó — nên hiện trong mục chất lượng dữ liệu
- Bảng xếp hạng tài xế chưa loại chuyến `duration_suspicious`, có thể làm sai thứ hạng

**Hành chính:**
- 12 tab đều tải toàn bộ dữ liệu rồi mới lọc; với dữ liệu lớn dần nên cân nhắc lọc trước
- Tab "Khác" (171 dòng) gom nhiều thứ chưa phân loại — nên tách hoặc đặt tên rõ hơn
