"""
Đọc file sổ tiếp đoàn đã chuẩn hoá (TiepDoan_ChuanHoa_*.xlsx) → JSON cho
prisma/import-crm-tiep-doan.ts. Chỉ đọc hai sheet ToChuc và TiepDoan; giữ
nguyên giá trị, không suy diễn gì thêm.

    python3 tools/crm-import/tiepdoan_to_json.py <file.xlsx> <out.json>
"""
import datetime as dt
import json
import sys

import openpyxl


def cell(v):
    if v is None:
        return None
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, dt.time):
        return v.strftime("%H:%M")
    if isinstance(v, float) and v.is_integer():
        return int(v)
    s = str(v).strip()
    return s or None


def sheet(wb, name):
    rows = list(wb[name].iter_rows(values_only=True))
    header = [str(h).strip() for h in rows[0]]
    return [dict(zip(header, (cell(c) for c in r))) for r in rows[1:] if r and r[0] is not None]


def main():
    src, out = sys.argv[1], sys.argv[2]
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    payload = {"organizations": sheet(wb, "ToChuc"), "delegations": sheet(wb, "TiepDoan")}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print(f"{len(payload['organizations'])} tổ chức, {len(payload['delegations'])} lượt tiếp → {out}")


if __name__ == "__main__":
    main()
