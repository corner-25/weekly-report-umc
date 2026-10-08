"""
Đọc file danh sách khách khám chữa bệnh (DANH SACH KHACH KCB <năm>.xlsx) → JSON
cho prisma/import-crm-khach-kcb.ts. Giữ nguyên giá trị từng ô (ngày → YYYY-MM-DD),
bỏ dòng trống và dòng tiêu đề tuần ("TUẦN 2"); mọi chuẩn hoá làm ở lib/crm/vip-visit-import.ts.

    python3 tools/crm-import/khach_kcb_to_json.py <file.xlsx> <out.json>
"""
import datetime as dt
import json
import sys

import openpyxl

COLUMNS = [
    "stt", "date", "fullName", "birthDate", "address", "phone", "referrer", "position", "workplace", "recordNo",
    "specialty", "doctor", "diagnosis", "services", "clsTime", "newVisit", "revisit", "followUp", "note", "session",
]


def cell(v):
    if v is None:
        return None
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    s = str(v).strip()
    return s or None


def main():
    src, out = sys.argv[1], sys.argv[2]
    ws = openpyxl.load_workbook(src, read_only=True, data_only=True).active
    rows = []
    for n, r in enumerate(ws.iter_rows(values_only=True), start=1):
        if n == 1 or not any(c not in (None, "") and str(c).strip() for c in r):
            continue
        if isinstance(r[0], str) and r[0].strip().upper().startswith("TUẦN"):
            continue
        row = {k: cell(v) for k, v in zip(COLUMNS, r)}
        # Cột không tên sau "Buổi khám" đôi khi ghi quan hệ với khách VIP ("Mẹ của …").
        extra = [cell(v) for v in r[len(COLUMNS):] if cell(v)]
        row["extraNote"] = "; ".join(extra) or None
        row["row"] = n
        rows.append(row)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"source": src.rsplit("/", 1)[-1], "rows": rows}, f, ensure_ascii=False, indent=1)
    print(f"{len(rows)} dòng → {out}")


if __name__ == "__main__":
    main()
