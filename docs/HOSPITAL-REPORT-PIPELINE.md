# Pipeline xử lý báo cáo tuần bệnh viện — đề xuất thiết kế lại

> Trạng thái: đề xuất, chờ duyệt
> Ngày: 2026-08-20
> Dựa trên phân tích file Excel gốc: 33 sheet, 4.879 dòng nhiệm vụ, 14 phòng ban

## 1. Bốn vấn đề — đo trên dữ liệu thật

### 1.1 Cùng một nghiệp vụ, nhiều cách diễn đạt

| Phòng | Số tên nhiệm vụ khác nhau | Ổn định (≥80% tuần) | Chỉ 1 tuần |
|---|---|---|---|
| KẾ HOẠCH TỔNG HỢP | **158** | 26 | **112** |
| CÔNG NGHỆ THÔNG TIN | **143** | 16 | 53 |
| HÀNH CHÍNH | 31 | 13 | 3 |
| ĐIỀU DƯỠNG | 17 | 7 | 1 |
| TỔ CHỨC CÁN BỘ | 16 | 10 | 1 |
| CÔNG TÁC XÃ HỘI | 15 | 1 | 5 |
| BẢO HIỂM Y TẾ | 10 | 8 | 0 |
| QUẢN TRỊ TÒA NHÀ · TCKT | 6 | 6 | 0 |
| KH&ĐT · QLCL · TT TRUYỀN THÔNG · VTTB · ĐẤU THẦU | 3–5 | tất cả | 0 |

**Nhưng con số này gây hiểu nhầm.** Đọc kỹ tên nhiệm vụ mới thấy vấn đề thật:

```
CNTT — 44 dòng bắt đầu bằng "Phần mềm …", gộp lại phủ đúng 33/33 tuần:
    33/33  Phần mềm Nội trú (EMR)
    26/33  Phần mềm Bảo hiểm y tế
    13/33  Phần mềm Dược
     1/33  Phần mềm Chỉ định CLS        ← không phải "việc phát sinh"
     1/33  Phần mềm Quản lý Kho         ← cũng vậy
```

`Phần mềm Chỉ định CLS` chỉ xuất hiện một tuần **không phải vì nó là việc bất chợt**, mà vì
nghiệp vụ thường quy của phòng là *quản lý và vận hành hệ thống phần mềm* — tuần đó tình cờ
có việc với module CLS, tuần khác có việc với module Dược. **Cùng một nhiệm vụ, khác đối tượng.**

Tương tự, cùng một việc bị viết nhiều kiểu:

| Nhóm | Các biến thể | Số tuần |
|---|---|---|
| Hỗ trợ hạ tầng | `Hỗ trợ mạng` · `Hỗ trợ về mạng` · `Hỗ trợ về server` | 18 · 9 · 18 |
| Ứng dụng UMC Care | `Ứng dụng di động – UMC Care` · `Ứng dụng di động - UMC Care` | 16 · 16 |

Hai dòng UMC Care chỉ khác nhau **dấu gạch ngang** (– và -) mà thành hai nhiệm vụ riêng.

**Kết luận đúng:** không phải "hai chế độ nhập liệu", mà là **một vấn đề duy nhất — cùng một
nghiệp vụ được diễn đạt ở nhiều mức chi tiết và nhiều cách viết khác nhau**. Đếm theo chuỗi
ký tự cho ra 143 nhiệm vụ; thực chất CNTT chỉ có khoảng 5–7 nghiệp vụ thường quy:

```
Quản lý & vận hành phần mềm     ← 44 biến thể "Phần mềm X"
Hỗ trợ người dùng               ← hỗ trợ máy tính/in/scan/tivi/email/chữ ký số…
Hạ tầng mạng & máy chủ          ← hỗ trợ mạng, server, thi công mở rộng…
Ứng dụng di động                ← UMC EMR, UMC Home, UMC Care
Dự án triển khai                ← Core Switch, bảo mật, nâng cấp Windows Server…
Thống kê & xử lý dữ liệu
```

Đây chính là lý do mapping khó: pipeline cũ so khớp **tên nhiệm vụ** thay vì hiểu **nhiệm vụ
nào đang được nói tới**.

### 1.2 Định lượng bị chôn trong văn bản

Chỉ trong 3 tuần mẫu đã có **91 ô** chứa số liệu nhúng:

```
"Kiểm tra, tiếp nhận HSBA: 3.336 HSBA · In mã lưu trữ: 1.760 HSBA
 Chuyển HSBA sang kho Thành Khánh: 2.000 HSBA"

"- Phát hành: 170 văn bản đi; 105 quyết định; 285 hợp đồng
 - Tiếp nhận 278 văn bản đến, xử lý đúng hạn 277/278 (99,6%)"

"1.1. Sinh viên, học viên đang thực hành tại bệnh viện: 1.242 người
 - Sinh viên, học viên Đại học Y Dược TP. HCM: 849"

"Tính đến ngày 18/4/2026, Bệnh viện đã triển khai 09 ca ghép tim"
```

Đây là **metric thật** đang nằm dưới dạng văn bản: không lọc được, không vẽ biểu đồ được,
không so sánh giữa các tuần được.

Lưu ý: một ô chứa **nhiều metric** cùng lúc, và có cả metric tích luỹ ("Tính đến ngày...
đã triển khai 09 ca") lẫn metric theo tuần ("65 văn bản").

### 1.3 Tiến độ 100% lặp lại — bạn nghi ngờ đúng

**39 nhiệm vụ báo 100% suốt ≥8 tuần liên tục.** Trong đó 12 nhiệm vụ đủ **33/33 tuần đều 100%**:

```
[ĐIỀU DƯỠNG]     Hoạt động chuyên môn điều dưỡng      33/33 tuần = 100%
[HÀNH CHÍNH]     Tổng đài                             33/33 tuần = 100%
[HÀNH CHÍNH]     Quản lý phương tiện vận chuyển       33/33 tuần = 100%
[BẢO HIỂM Y TẾ]  Quản lý thanh toán bảo hiểm          33/33 tuần = 100%
```

Đây **không sai về nghiệp vụ** — đó là công việc thường quy, tuần nào cũng hoàn thành.
Cái sai là **dùng chung một trường `progress` cho hai loại nhiệm vụ khác hẳn nhau**:

| Loại | Ý nghĩa "100%" | Số nhiệm vụ |
|---|---|---|
| Thường quy (RECURRING) | Tuần này làm xong phần việc của tuần | ~39 |
| Tích luỹ (CUMULATIVE) | Toàn bộ dự án đã xong | ~15 |

Chỉ **15/208 nhiệm vụ** có tiến độ thay đổi thật sự.

**Một phát hiện riêng:** QLCL nhập tiến độ tăng đều 2%/tuần:
```
T1:2% T2:4% T3:6% T4:8% … T24:46% T25:48% … T32:50% T33:50% T34:50%
```
Đây là **tỷ lệ thời gian trôi qua trong năm**, không phải tiến độ công việc. Cần đánh dấu
riêng, nếu không mọi thống kê "tiến độ trung bình" sẽ bị bóp méo.

### 1.4 13% dòng không có kết quả

**672/4.879 dòng** có tên nhiệm vụ nhưng ô "Kết quả thực hiện" trống. Đây là **dòng tiêu đề
nhóm** (nhiệm vụ cha), không phải nhiệm vụ thật:

```
3   Ghép tạng                    ← dòng cha, không có kết quả
    Ghép gan       Ngày 23/4...  ← nhiệm vụ con thật
    Ghép thận      Ngày 20/4...
    Ghép tim       Tính đến...
```

Pipeline hiện tại coi tất cả là nhiệm vụ ngang hàng — làm hỏng cả việc đếm lẫn việc khớp.

## 2. Pipeline đề xuất

```
Excel gốc
   │
   ├─[1]─ Parse cấu trúc     tách cha/con, bỏ dòng tiêu đề, gắn phòng ban
   │
   ├─[2]─ Gom nghiệp vụ      AI nhìn TOÀN BỘ 33 tuần của một phòng,
   │        (một lần)          gom 143 tên → ~6 nghiệp vụ thường quy
   │
   ├─[3]─ Phân loại           RECURRING / CUMULATIVE / AD_HOC / TIME_ELAPSED
   │        (mỗi nghiệp vụ)    dựa trên lịch sử xuất hiện
   │
   ├─[4]─ Khớp từng tuần      alias trước (rẻ) → AI suy luận (khi cần)
   │        (AI, có ngưỡng)    giữ cả "nghiệp vụ" lẫn "đối tượng cụ thể"
   │
   ├─[5]─ Trích metric        AI đọc văn bản → (tên, giá trị, đơn vị, kỳ)
   │
   ├─[6]─ Kiểm tra chéo       so với tuần trước, phát hiện bất thường
   │
   └─[7]─ Người duyệt         xác nhận theo phòng, sửa được trước khi ghi
              │
              └─→ Postgres
```

### Bước 1 — Parse cấu trúc (không cần AI)

Nhận diện quan hệ cha–con bằng cột `Stt` và ô kết quả rỗng:
- `Stt` có số + kết quả rỗng + dòng dưới `Stt` rỗng → **dòng nhóm**, lưu làm `parentTask`
- `Stt` rỗng → nhiệm vụ con của nhóm gần nhất phía trên

Đây là quy tắc xác định, không cần AI, và loại được 672 dòng nhiễu.

### Bước 2+3 — Gom nghiệp vụ rồi phân loại

Gom xong mới phân loại — phân loại từng dòng thô sẽ sai, vì `Phần mềm Chỉ định CLS` nhìn riêng lẻ trông như việc phát sinh. Dựa trên lịch sử
xuất hiện qua 33 tuần — thông tin mà AI xử lý từng tuần riêng lẻ không có:

| Loại | Dấu hiệu | Cách hiểu `progress` |
|---|---|---|
| `RECURRING` | Nghiệp vụ phủ hầu hết các tuần, progress luôn 100 | "Đã làm xong phần việc tuần này" |
| `CUMULATIVE` | Progress tăng dần, có đích | "% hoàn thành toàn dự án" |
| `AD_HOC` | Sự việc một lần có mốc thời gian rõ (họp, tiếp đoàn, ban hành) | Không dùng progress |
| `TIME_ELAPSED` | Tăng đều mỗi tuần một lượng cố định | **Bỏ qua**, không phải tiến độ |

Phân loại một lần cho toàn bộ lịch sử, lưu vào `MasterTask.progressType`.

### Bước 4 — Khớp nhiệm vụ bằng suy luận ngữ nghĩa

Đây là bước quyết định chất lượng. Không so khớp chuỗi, mà để AI trả lời câu hỏi:
*"Dòng này thuộc nghiệp vụ nào của phòng?"*

**4a. Dùng danh mục nghiệp vụ đã dựng ở bước 2**

Đưa AI **tất cả** tên nhiệm vụ của một phòng kèm số tuần xuất hiện và vài kết quả mẫu, yêu
cầu gom thành các nghiệp vụ thường quy. Nhìn toàn cục mới gom đúng — AI xử lý từng tuần
riêng lẻ không thể biết `Phần mềm Chỉ định CLS` và `Phần mềm Dược` là cùng một việc.

```
Đầu vào:  143 tên nhiệm vụ của CNTT + tần suất + kết quả mẫu
Đầu ra:   6 nghiệp vụ, mỗi nghiệp vụ kèm danh sách biến thể đã gom
```

Kết quả người dùng duyệt một lần, lưu thành `MasterTask` với `aliases` chứa mọi biến thể.

**4b. Khớp từng dòng**

Với mỗi dòng: thử `aliases` trước (rẻ, tức thì). Không khớp thì gọi AI kèm **toàn bộ danh mục
nghiệp vụ của đúng phòng đó** làm ngữ cảnh, yêu cầu chọn một nghiệp vụ + độ tin cậy + đối
tượng cụ thể.

```json
{
  "masterTaskId": "cm...",
  "matchedName": "Quản lý & vận hành phần mềm",
  "subject": "Phần mềm Chỉ định CLS",
  "confidence": 0.93,
  "reasoning": "Cùng nghiệp vụ vận hành module phần mềm, khác đối tượng"
}
```

`subject` giữ nguyên đối tượng cụ thể — không mất thông tin, mà vẫn gom được về một nhiệm vụ.

**4c. Học dần**

Mỗi lần người duyệt xác nhận, biến thể đó được ghi vào `aliases`. Tuần sau khớp ngay không
cần gọi AI. Chi phí giảm dần theo thời gian.

**Ngưỡng xử lý:**

| Độ tin cậy | Hành động |
|---|---|
| ≥ 0.90 | Tự khớp, vẫn hiện cho người duyệt xem lướt |
| 0.70–0.89 | Đánh dấu vàng, cần xác nhận |
| < 0.70 | Đánh dấu đỏ, người duyệt chọn tay hoặc tạo nghiệp vụ mới |

### Bước 5 — Trích metric bằng AI

Prompt yêu cầu trả JSON, mỗi ô có thể sinh nhiều metric:

```json
{
  "metrics": [
    {"name": "Hồ sơ bệnh án tiếp nhận", "value": 3336, "unit": "HSBA", "period": "WEEK"},
    {"name": "Hồ sơ bệnh án in mã lưu trữ", "value": 1760, "unit": "HSBA", "period": "WEEK"},
    {"name": "Ca ghép tim", "value": 9, "unit": "ca", "period": "CUMULATIVE",
     "asOfDate": "2026-04-18"}
  ]
}
```

Ba điểm bắt buộc trong prompt:
1. **Phân biệt kỳ**: "65 văn bản" (tuần này) vs "Tính đến ngày… 09 ca" (tích luỹ từ đầu)
2. **Giữ nguyên đơn vị** tiếng Việt, không tự quy đổi
3. **Không suy diễn**: không có số thì trả mảng rỗng, tuyệt đối không ước lượng

### Bước 6 — Kiểm tra chéo trước khi cho người duyệt

Tự động gắn cờ:
- Metric lệch >50% so với trung bình 4 tuần trước
- Metric tích luỹ **giảm** so với tuần trước (bất khả thi)
- Nhiệm vụ `CUMULATIVE` có progress giảm
- Nhiệm vụ biến mất khỏi báo cáo sau nhiều tuần liên tục xuất hiện
- Độ tin cậy khớp `MasterTask` dưới ngưỡng

### Bước 7 — Người duyệt

AI **không bao giờ ghi thẳng** vào `Week`/`WeekTaskProgress`. Màn hình duyệt hiển thị theo
phòng ban, mỗi mục cho sửa tên nhiệm vụ khớp, giá trị metric, và loại nhiệm vụ.

## 3. Thay đổi database

### 3.1 Mở rộng `ProgressType`

```prisma
enum ProgressType {
  RECURRING     // Thường quy, lặp hàng tuần — 100% nghĩa là "xong phần việc tuần này"
  CUMULATIVE    // Tích luỹ, có đích — 100% nghĩa là "xong toàn bộ"
  AD_HOC        // Việc phát sinh, chỉ xuất hiện 1-2 tuần — KHÔNG dùng progress
  TIME_ELAPSED  // Số nhập thực chất là % thời gian trôi qua — bỏ qua khi thống kê
}
```

### 3.2 `MasterTask` — thêm quan hệ cha–con và nguồn gốc

```prisma
model MasterTask {
  // … giữ nguyên các trường hiện có

  parentId      String?      // nhóm cha (vd "Ghép tạng" ← "Ghép gan")
  parent        MasterTask?  @relation("TaskTree", fields: [parentId], references: [id])
  children      MasterTask[] @relation("TaskTree")

  aliases       String[]     // các cách viết khác của cùng nhiệm vụ, giúp khớp lần sau
  sourceType    String       @default("MANUAL")  // MANUAL | AI_EXTRACTED | IMPORTED
  firstSeenWeek Int?         // tuần đầu xuất hiện, phục vụ phân loại
  lastSeenWeek  Int?
}
```

`aliases` là chìa khoá giải bài toán 1.1: mỗi lần người duyệt xác nhận "dòng này chính là
nhiệm vụ X", cách viết đó được ghi vào `aliases` — lần sau khớp được ngay không cần AI.

### 3.3 Bảng mới: metric trích từ văn bản

```prisma
enum MetricPeriod {
  WEEK        // số liệu của riêng tuần này
  CUMULATIVE  // luỹ kế từ đầu năm/đầu dự án
  MONTH
  QUARTER
}

model ExtractedMetric {
  id             String   @id @default(cuid())
  weekId         String
  departmentId   String
  masterTaskId   String?              // nhiệm vụ sinh ra số này, nếu xác định được

  name           String   @db.Text    // "Hồ sơ bệnh án tiếp nhận"
  value          Float
  unit           String?              // "HSBA", "ca", "văn bản", "%"
  period         MetricPeriod @default(WEEK)
  asOfDate       DateTime?            // với CUMULATIVE: tính đến ngày nào

  sourceText     String   @db.Text    // đoạn văn gốc, để đối chiếu khi nghi ngờ
  confidence     Float                // 0–1, AI tự đánh giá
  reviewStatus   String   @default("PENDING")  // PENDING | APPROVED | REJECTED | EDITED
  reviewedBy     String?
  reviewedAt     DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  week           Week       @relation(fields: [weekId], references: [id], onDelete: Cascade)
  department     Department @relation(fields: [departmentId], references: [id])
  masterTask     MasterTask? @relation(fields: [masterTaskId], references: [id])

  @@index([weekId, departmentId])
  @@index([name])
  @@index([reviewStatus])
  @@map("extracted_metrics")
}
```

**Vì sao không dùng `MetricDefinition`/`WeekMetricValue` sẵn có:** hai bảng đó dành cho chỉ số
đã được định nghĩa trước, người dùng nhập tay. Metric trích từ văn bản thì tên chưa chuẩn hoá,
có độ tin cậy, cần đối chiếu văn bản gốc, và phải qua duyệt. Sau khi một metric được duyệt
nhiều lần và ổn định tên, có thể "thăng cấp" thành `MetricDefinition` chính thức.

### 3.4 `WeekTaskProgress` — thêm ngữ cảnh trích xuất

```prisma
model WeekTaskProgress {
  // … giữ nguyên

  // Đối tượng cụ thể của tuần này. Nhiệm vụ là "Quản lý & vận hành phần mềm",
  // subject là "Phần mềm Chỉ định CLS" — gom được về một nghiệp vụ mà không
  // mất chi tiết. Đây là chỗ giữ thông tin mà cách gom cũ làm mất.
  subject         String?  @db.Text

  rawTaskName     String?  @db.Text  // tên nhiệm vụ y như trong Excel
  rawResultText   String?  @db.Text  // văn bản gốc trước khi AI xử lý
  extractionModel String?            // model nào trích (zAI, deepseek…), để truy nguyên
  matchConfidence Float?             // độ tin cậy khớp MasterTask
  matchReasoning  String?  @db.Text  // AI giải thích vì sao khớp, giúp người duyệt nhanh
  reviewFlags     String[]           // ["METRIC_ANOMALY", "LOW_CONFIDENCE", …]
}
```

**`subject` giải quyết đúng vấn đề bạn nêu:** không tách `Phần mềm Chỉ định CLS` và
`Phần mềm Quản lý Kho` thành hai nhiệm vụ, nhưng cũng không gộp mất chi tiết. Một nhiệm vụ
`Quản lý & vận hành phần mềm`, mỗi tuần ghi rõ tuần đó làm với module nào.

Truy vấn được cả hai chiều:
```sql
-- Nghiệp vụ này tuần nào cũng có làm chứ?
SELECT week, subject FROM week_task_progress WHERE "masterTaskId" = '...';

-- Module Dược được đụng tới bao nhiêu lần trong năm?
SELECT count(*) FROM week_task_progress WHERE subject ILIKE '%Dược%';
```

### 3.5 Bảng theo dõi lần trích xuất

```prisma
model AiExtractionRun {
  id            String   @id @default(cuid())
  pendingId     String?              // liên kết PendingAiImport
  year          Int
  week          Int
  model         String               // "zai-…", "deepseek-chat"
  promptVersion String               // để so sánh chất lượng giữa các phiên bản prompt
  tasksFound    Int      @default(0)
  metricsFound  Int      @default(0)
  flagged       Int      @default(0)
  tokensUsed    Int?
  durationMs    Int?
  errorMessage  String?  @db.Text
  createdAt     DateTime @default(now())

  @@index([year, week])
  @@map("ai_extraction_runs")
}
```

Cần bảng này vì bạn sẽ đổi model và sửa prompt nhiều lần — không có nó thì không biết
phiên bản nào cho kết quả tốt hơn.

## 4. Làm sạch lại từ tuần 1

Bạn muốn xử lý lại toàn bộ. Đề xuất trình tự:

1. **Giữ nguyên dữ liệu cũ**, thêm cột `extractionVersion` để phân biệt bản cũ/mới
2. **Chạy phân loại nhiệm vụ trên toàn bộ 33 tuần** (bước 2) — cần nhìn toàn cục
3. **Trích xuất lại tuần 1 → 34** bằng zAI, ghi vào bảng chờ duyệt
4. **Duyệt theo phòng ban**, không theo tuần — cùng một phòng thì cách nhập giống nhau,
   duyệt liền mạch nhanh hơn nhiều
5. **Đối chiếu bản mới với bản cũ**, xem chênh ở đâu trước khi thay thế
6. Chỉ khi bạn xác nhận mới **chuyển sang dùng bản mới**

## 5. zAI — đã kiểm chứng trên dữ liệu thật

API key hoạt động. Endpoint `https://api.z.ai/api/paas/v4/chat/completions`.

### Model khả dụng

`glm-4.6` · `glm-4.5` · `glm-4.5-air` · `glm-4.5-flash` · `glm-4-plus`
(`glm-4-long` không tồn tại)

### Thử nghiệm: gom 143 tên nhiệm vụ của CNTT thành nghiệp vụ

Đưa cả 143 tên trong **một lần gọi**:

| Model | Nhóm | Phủ | Thiếu | Trùng | Bịa tên |
|---|---|---|---|---|---|
| glm-4.6 (thinking) | 4 | 138 | 5 | 0 | **2** |
| glm-4.6 (no-think) | 5 | 140 | 3 | 0 | 0 |
| glm-4.5 | 5 | 139 | 4 | 0 | 1 |
| glm-4.5-air | 8 | 134 | 9 | **17** | 1 |
| glm-4-plus | 8 | 127 | 16 | 2 | 4 |

**Không model nào phủ hết.** Đáng chú ý: bật `thinking` ở glm-4.6 lại **kém hơn** tắt —
model tiêu 3.868/4.000 token cho suy luận rồi không còn chỗ trả JSON, và khi tăng token
lên 32.000 thì gom quá thô (4 nhóm, một nhóm ôm 75 biến thể) và **bịa ra 2 tên không có
trong danh sách**. Với tác vụ phân loại có ràng buộc chặt, thinking không giúp gì.

### Cách làm cho kết quả đúng: chia nhỏ + ngữ cảnh + xét từng mục

```
GĐ1  Dựng danh mục nghiệp vụ
     → chỉ đưa các mục xuất hiện ≥8/33 tuần (nhiệm vụ cốt lõi)
     → kèm mục cha trong Excel + ví dụ kết quả thực hiện
     → AI đề xuất 6-9 nghiệp vụ, mỗi cái có "phạm vi" và "dấu hiệu nhận biết"

GĐ2  Xét TỪNG nhiệm vụ, lô 12 mục
     → mỗi mục kèm: tên + số tuần + mục cha + 2 kết quả thực tế
     → AI trả: nghiệp vụ nào, đối tượng cụ thể, độ tin cậy, lý do

GĐ3  Kiểm tra nhất quán (không dùng AI)
     → tên gần giống (độ tương đồng ≥0.85 sau khi bỏ dấu) mà khác nghiệp vụ → gắn cờ

GĐ4  AI phân xử các cặp bị gắn cờ
     → xem kết quả thực tế của cả hai rồi quyết
```

**Kết quả trên CNTT** (`glm-4.5`, không thinking):

```
GĐ1: 6 nghiệp vụ · 1.139 tokens
GĐ2: 141/141 nhiệm vụ · thiếu 0 · bịa 0 · chỉ 2 mục tin cậy <0.7 · 40.676 tokens
GĐ3: phát hiện 2 cặp bất nhất
GĐ4: 1.043 tokens

Tổng ~44.000 tokens · ~5 phút cho một phòng
```

Phân bố: Vận hành & Phát triển Phần mềm 68 · Hạ tầng Mạng 47 · Hỗ trợ Người dùng 10 ·
Lắp đặt Thiết bị 6 · Sự kiện & Ngoại viện 6 · Xử lý Dữ liệu 4

### Kiểm chứng các mục từng gây khó

| Tên gốc | Gom vào | Tin cậy |
|---|---|---|
| Phần mềm Chỉ định CLS | Vận hành & Phát triển Hệ thống Phần mềm | 0.95 |
| Phần mềm Quản lý Kho | Vận hành & Phát triển Hệ thống Phần mềm | 0.95 |
| Ứng dụng di động **-** UMC Care | Vận hành & Phát triển Hệ thống Phần mềm | 0.95 |
| Ứng dụng di động **–** UMC Care | Vận hành & Phát triển Hệ thống Phần mềm | 0.95 |

Hai dòng UMC Care khác nhau dấu gạch ngang nay về cùng một nghiệp vụ.

### GĐ3–GĐ4 bắt được lỗi thật

GĐ2 xếp `Hỗ trợ mạng` → *Hạ tầng Mạng* nhưng `Hỗ trợ về mạng` → *Hỗ trợ Người dùng*.
Cùng một việc, hai nghiệp vụ. GĐ3 phát hiện, GĐ4 sửa đúng.

Đáng chú ý ở cặp thứ hai: `Hỗ trợ kỹ thuật và lắp đặt thiết bị CNTT` vs
`Hỗ trợ lắp đặt thiết bị CNTT` — tên gần giống nhưng AI **giữ nguyên hai nghiệp vụ khác nhau**,
vì đọc kết quả thấy một cái lắp thiết bị mạng nội bộ, cái kia hỗ trợ sự kiện bên ngoài.
Quy tắc máy móc "chọn bản tin cậy cao hơn" sẽ gộp sai ở đây.

### Cấu hình đề xuất

```
Model:        glm-4.5           (glm-4.6 cho GĐ1 nếu muốn danh mục sắc hơn)
thinking:     disabled          (bật vào làm giảm chất lượng ở tác vụ này)
temperature:  0.1
max_tokens:   16000
Lô GĐ2:       12 mục            (nhỏ để mỗi mục được xét kỹ kèm ngữ cảnh)
response_format: json_object
```

### Ước tính chi phí toàn bộ

| Việc | Tokens |
|---|---|
| Gom nghiệp vụ 14 phòng (một lần) | ~250.000 |
| Khớp 33 tuần × 14 phòng | ~600.000 |
| Trích metric | ~500.000 |
| **Tổng** | **~1,4 triệu tokens** |

Với `glm-4.5` đây là chi phí nhỏ, và phần gom nghiệp vụ chỉ chạy một lần.

## 5. Việc cần bạn quyết trước khi tôi viết code

1. ~~zAI~~ — đã kiểm chứng, xem mục 5
2. ~~Ngân sách token~~ — đã đo: ~1,4 triệu tokens cho toàn bộ
3. **Danh mục nghiệp vụ**: sau khi AI gom (bước 3a), bạn duyệt một lần cho 14 phòng.
   Đây là việc tốn thời gian nhất nhưng làm một lần dùng mãi.
4. **Metric tích luỹ**: "Tính đến ngày 18/4 đã có 09 ca ghép tim" — lưu là giá trị tại thời
   điểm, hay quy về số phát sinh trong tuần?
