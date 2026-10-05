"""
Cào phân hệ Quản lý công việc (office.umc.edu.vn) → file JSON đúng hợp đồng
docs/WORK-MANAGEMENT.md → đẩy lên hệ thống.

Chạy trên máy trong mạng bệnh viện (đã cài Python + playwright + Google Chrome).

Bước 1 — đăng nhập một lần (mở cửa sổ Chrome, anh/chị tự đăng nhập, phiên được lưu):
    python3 tools/qlcv-scraper/scrape.py login

Bước 2 — khảo sát (chạy một lần để lập trình viên biết dữ liệu trang trả về dạng nào):
    python3 tools/qlcv-scraper/scrape.py survey "<link trang Theo dõi chỉ đạo của BGĐ>"
    → ghi mọi phản hồi JSON của trang danh sách và trang chi tiết đầu tiên vào ~/.qlcv/survey/

Bước 3 — cào và đẩy lên (link mặc định: Theo dõi chỉ đạo của BGĐ):
    python3 tools/qlcv-scraper/scrape.py run --push
    (mã nạp dữ liệu đọc từ biến WORK_IMPORT_TOKEN hoặc file ~/.qlcv/token)

Danh sách lấy từ API nội bộ /v1/tasks/getTasks mà chính trang gọi (bắt phản hồi
khi mở trang, không tự gọi API): đủ tiêu đề, đơn vị, người thực hiện, người theo
dõi, hạn, trạng thái, %. Sau đó gọi chi tiết từng việc (chậm rãi) để lấy toàn bộ
lịch sử "Theo dõi tiến độ thực hiện" — cả việc đã hoàn thành từ 2023.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HOME = Path.home() / ".qlcv"
PROFILE = HOME / "chrome-profile"
SURVEY = HOME / "survey"
START_URL = "https://office.umc.edu.vn/"


def open_context(p, headless: bool):
    PROFILE.mkdir(parents=True, exist_ok=True)
    return p.chromium.launch_persistent_context(
        str(PROFILE), channel="chrome", headless=headless, viewport={"width": 1600, "height": 1000}
    )


def cmd_login() -> None:
    with sync_playwright() as p:
        ctx = open_context(p, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(START_URL)
        print("Đăng nhập trong cửa sổ Chrome vừa mở, mở thử trang Theo dõi chỉ đạo của BGĐ,")
        input("rồi quay lại đây bấm Enter để lưu phiên đăng nhập… ")
        ctx.close()
    print(f"Đã lưu phiên vào {PROFILE}")


def is_json(resp) -> bool:
    ctype = resp.headers.get("content-type", "")
    return "json" in ctype and resp.request.resource_type in ("xhr", "fetch")


def record(responses: list, folder: Path, label: str) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for i, (req, body) in enumerate(responses):
        name = re.sub(r"[^a-zA-Z0-9]+", "_", req["url"].split("?")[0][-60:]).strip("_")
        (folder / f"{label}_{i:03d}_{name}.json").write_text(
            json.dumps({"request": req, "response": body}, ensure_ascii=False, indent=1), encoding="utf-8"
        )


def capture(page):
    """Gom mọi phản hồi JSON (XHR/fetch) của trang."""
    bucket: list = []

    def on_response(resp):
        if not is_json(resp):
            return
        try:
            body = resp.json()
        except Exception:
            return
        req = resp.request
        bucket.append(
            (
                {"url": req.url, "method": req.method, "postData": req.post_data, "status": resp.status},
                body,
            )
        )

    page.on("response", on_response)
    return bucket


def cmd_survey(url: str) -> None:
    with sync_playwright() as p:
        ctx = open_context(p, headless=True)
        page = ctx.new_page()
        bucket = capture(page)
        page.goto(url, wait_until="networkidle")
        time.sleep(4)
        SURVEY.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SURVEY / "list.png"))
        (SURVEY / "list.html").write_text(page.content(), encoding="utf-8")
        record(list(bucket), SURVEY, "list")
        print(f"Trang danh sách: {len(bucket)} phản hồi JSON")

        # Mở công việc đầu tiên trong lưới để xem trang chi tiết gọi gì.
        bucket.clear()
        link = page.locator("kendo-grid td a, .k-grid td a, [role=gridcell] a").first
        if link.count():
            link.click()
        else:
            page.locator("kendo-grid tbody tr, .k-grid tbody tr").nth(1).dblclick()
        page.wait_for_load_state("networkidle")
        time.sleep(4)
        page.screenshot(path=str(SURVEY / "detail.png"))
        (SURVEY / "detail.html").write_text(page.content(), encoding="utf-8")
        record(list(bucket), SURVEY, "detail")
        print(f"Trang chi tiết ({page.url}): {len(bucket)} phản hồi JSON")
        ctx.close()
    print(f"Đã ghi khảo sát vào {SURVEY}")


OUT = HOME / "out"
DEFAULT_URL = "https://office.umc.edu.vn/#/M02/M02PROJECT/cHJvamVjdElEPTU%3D"  # Theo dõi chỉ đạo của Ban Giám đốc
APP_URL = os.environ.get("APP_URL", "https://umc.up.railway.app")

NOTE_HEAD = re.compile(r"^-\s*Ngày\s+(\d{1,2}/\d{1,2}/\d{4})(?:\s+(\d{1,2}:\d{2})(?::\d{2})?)?\s*$")


def parse_notes(notes: str | None) -> list:
    """Cột "Mô tả tiến độ thực hiện": các khối "- Ngày dd/mm/yyyy hh:mm:ss" + nội dung, mới nhất trước."""
    updates, current = [], None
    for line in (notes or "").splitlines():
        m = NOTE_HEAD.match(line.strip())
        if m:
            if current and current["content"].strip():
                updates.append(current)
            current = {"at": f"{m.group(1)} {m.group(2) or '00:00'}", "content": ""}
        elif current is not None:
            current["content"] += line + "\n"
    if current and current["content"].strip():
        updates.append(current)
    for u in updates:
        u["content"] = u["content"].strip()
    return updates


def day(value: str | None) -> str | None:
    return value[:10] if value else None


def person(value: str | None) -> str | None:
    """"J18-132 Nguyễn Thị Mỹ Hạnh (Phòng HC)" → "Nguyễn Thị Mỹ Hạnh (Phòng HC)"."""
    return re.sub(r"^[A-Z]\d{2}-\d{3,}\s+", "", value.strip()) if value and value.strip() else None


def unit_of(value: str | None) -> str | None:
    """Đơn vị trong ngoặc cuối tên người: "… (Phòng HC)" → "Phòng HC"."""
    m = re.search(r"\(([^()]+)\)\s*$", value or "")
    return m.group(1).strip() if m else None


def log_updates(detail: dict) -> list:
    """Bảng "Theo dõi tiến độ thực hiện" của trang chi tiết: ngày báo cáo, %, mô tả, người nhập."""
    updates = []
    for log in detail.get("logTimes") or []:
        content = (log.get("notes") or "").replace("\r\n", "\n").strip()
        at = log.get("entryDate") or log.get("createdDate")
        if not content or not at:
            continue
        update = {"at": at[:16].replace(" ", "T"), "author": person(log.get("empName")), "content": content}
        if log.get("percentDone") is not None:
            update["progressPercent"] = log["percentDone"]
        updates.append({k: v for k, v in update.items() if v is not None})
    return updates


def custom_field(detail: dict, code: str) -> dict:
    return next((f for f in detail.get("customFields") or [] if f.get("cfCode") == code), {})


def to_contract(rows: list, list_url: str, details: dict | None = None) -> dict:
    details = details or {}
    items = []
    for r in rows:
        external_id = str(r.get("taskID") or r.get("sys_TaskID"))
        detail = details.get(external_id) or {}
        # Hai nguồn lịch sử: bảng tiến độ ở trang chi tiết (việc đã báo cáo, kể cả đã xong)
        # và cột "Mô tả tiến độ thực hiện" của danh sách (ghi chú của việc đang mở).
        logged = log_updates(detail)
        seen = {u["content"] for u in logged}
        updates = logged + [u for u in parse_notes(r.get("notes")) if u["content"] not in seen]
        watchers = [person(w.get("watcherName")) for w in detail.get("watchers") or []]
        directed = custom_field(detail, "FN116")
        item = {
            "externalId": external_id,
            "url": list_url,
            "title": (r.get("taskTitle") or "").strip(),
            "description": (r.get("description") or "").strip() or None,
            "kind": "DIRECTIVE",
            "leadUnit": r.get("assigneeDeptName") or r.get("deptName") or unit_of(r.get("assigneeName")),
            "directedBy": r.get("reporterName"),
            "directedAt": day(directed.get("dateValue") or directed.get("strValue")) or day(r.get("createdDate")),
            "assignees": [r["assigneeName"]] if r.get("assigneeName") else [],
            "watchers": [w for w in watchers if w] or [w.strip() for w in (r.get("watcherName") or "").split(",") if w.strip()],
            "category": custom_field(detail, "FN1").get("strValueName") or r.get("fN1"),
            "dueDate": day(r.get("deadline")),
            "status": r.get("statusName"),
            "progressPercent": r.get("percentDone"),
            "updates": updates,
        }
        stamps = [u["at"] for u in updates if u["at"][:4].isdigit()]
        if stamps:
            item["lastUpdatedAt"] = max(stamps)
        elif updates:
            item["lastUpdatedAt"] = max(updates, key=lambda u: (u["at"][6:10], u["at"][3:5], u["at"][:2], u["at"][11:]))["at"]
        items.append({k: v for k, v in item.items() if v not in (None, "")})
    return {"source": "qlcv", "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%S+07:00"), "items": items}


def merge_rows(responses: list) -> list:
    """
    Trang gọi /v1/tasks/getTasks nhiều lần với các mẫu truy vấn khác nhau: một lần
    đủ cột (đơn vị, người theo dõi, hạn, lịch sử tiến độ) cho việc đang mở, một lần
    ít cột nhưng gồm cả việc đã hoàn thành. Gộp theo mã việc, ô nào trống thì lấy
    từ phản hồi khác — không để phản hồi ít cột xoá mất dữ liệu.
    """
    merged: dict = {}
    for body in responses:
        for r in body.get("data", {}).get("r", []) or []:
            key = str(r.get("taskID") or r.get("sys_TaskID"))
            current = merged.setdefault(key, {})
            for k, v in r.items():
                if v not in (None, "", []) and current.get(k) in (None, "", []):
                    current[k] = v
    return list(merged.values())


GET_TASKS = "https://officeapi.umc.edu.vn/v1/tasks/getTasks"
#   10252 "Dự án chỉ đạo BGĐ theo đơn vị của người thực hiện (chưa xử lý, đang xử lý)":
#         đủ cột đơn vị, người theo dõi, hạn, lịch sử mô tả tiến độ — chỉ việc đang mở.
#   65    "Xem công việc theo Đơn vị": mọi việc kể cả đã hoàn thành, có người giao,
#         ngày tạo, ngày hoàn thành — nhưng không có lịch sử tiến độ (chỉ 2026).
#   63    "Tất cả công việc": mọi việc của dự án từ 2023, ít cột.
CUSTOM_QUERIES = (10252, 65, 63)
DETAIL = "https://officeapi.umc.edu.vn/v1/m02MyTask/getM02MyTaskDetail?id={}"
# Gọi chi tiết từng việc một, nghỉ giữa các lần — tường lửa của bệnh viện cắt kết nối nếu dồn dập.
DETAIL_PAUSE_S = 0.3


def fetch_details(page, headers: dict, task_ids: list) -> dict:
    details, failed = {}, []
    for n, task_id in enumerate(task_ids, 1):
        for attempt in range(3):
            try:
                resp = page.request.get(DETAIL.format(task_id), headers=headers, timeout=30000)
                data = resp.json() if resp.ok else {}
                if data.get("succeeded") and data.get("data"):
                    details[task_id] = data["data"]
                    break
            except Exception:  # mạng chập chờn / bị tường lửa cắt — thử lại sau
                pass
            time.sleep(3 * (attempt + 1))
        else:
            failed.append(task_id)
        if n % 50 == 0:
            print(f"  chi tiết {n}/{len(task_ids)}")
        time.sleep(DETAIL_PAUSE_S)
    if failed:
        print(f"Không lấy được chi tiết {len(failed)} việc (dùng dữ liệu danh sách): {', '.join(failed[:20])}")
    return details


def cmd_run(url: str, push: bool) -> None:
    """
    Mở trang (để có phiên đăng nhập và mã xác thực trang tự gửi), rồi gọi lại
    đúng API trang dùng với hai mẫu truy vấn cố định — không phụ thuộc mẫu truy
    vấn người dùng đang chọn trên giao diện.
    """
    captured: dict = {}
    with sync_playwright() as p:
        ctx = open_context(p, headless=True)
        page = ctx.new_page()

        def on_request(req):
            if "/v1/tasks/getTasks" in req.url and "headers" not in captured:
                captured["headers"] = {k: v for k, v in req.headers.items() if k.lower() in ("authorization", "func", "content-type")}
                captured["body"] = json.loads(req.post_data or "{}")

        page.on("request", on_request)
        page.goto(url, wait_until="networkidle")
        # Danh sách được gọi sau khi trang dựng xong menu, có khi trễ vài giây.
        for _ in range(60):
            if "headers" in captured:
                break
            page.wait_for_timeout(500)
        if "headers" not in captured:
            ctx.close()
            sys.exit("Trang không gọi danh sách công việc — phiên đăng nhập có thể đã hết, chạy lại: scrape.py login")
        responses = []
        for query_id in CUSTOM_QUERIES:
            body = {**captured["body"], "CustomQueryID": query_id}
            resp = page.request.post(GET_TASKS, data=json.dumps(body), headers=captured["headers"])
            data = resp.json() if resp.ok else {}
            if data.get("succeeded"):
                responses.append(data)
                print(f"Mẫu truy vấn {query_id}: {len(data['data']['r'])} công việc")
            else:
                print(f"Mẫu truy vấn {query_id}: lỗi HTTP {resp.status}")
        rows = merge_rows(responses)
        print(f"Gộp được {len(rows)} công việc — lấy chi tiết từng việc…")
        details = fetch_details(page, captured["headers"], [str(r.get("taskID") or r.get("sys_TaskID")) for r in rows])
        ctx.close()
    if not responses:
        sys.exit("Không lấy được danh sách công việc")
    payload = to_contract(rows, url, details)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"qlcv-{time.strftime('%Y%m%d-%H%M')}.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    n_updates = sum(len(i.get("updates", [])) for i in payload["items"])
    print(f"Lấy được {len(rows)} công việc, {n_updates} lần cập nhật tiến độ → {out}")
    if push:
        import urllib.request

        token_file = HOME / "token"
        token = os.environ.get("WORK_IMPORT_TOKEN") or (token_file.read_text().strip() if token_file.exists() else "")
        if not token:
            sys.exit(f"Thiếu mã nạp dữ liệu: đặt WORK_IMPORT_TOKEN hoặc ghi vào {token_file}")
        req = urllib.request.Request(
            f"{APP_URL}/api/work/import",
            data=out.read_bytes(),
            headers={"Content-Type": "application/json", "x-import-token": token},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read())
        print(
            f"Đã nạp: {result['itemsCreated']} việc mới, {result['itemsChanged']} việc thay đổi, "
            f"{result['updatesAdded']} cập nhật mới, {len(result.get('problems', []))} dòng lỗi"
        )


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in ("login", "survey", "run"):
        print(__doc__)
        sys.exit(1)
    if sys.argv[1] == "login":
        cmd_login()
    elif sys.argv[1] == "survey":
        if len(sys.argv) < 3:
            sys.exit("Cần link trang danh sách")
        cmd_survey(sys.argv[2])
    else:
        args = [a for a in sys.argv[2:] if not a.startswith("--")]
        cmd_run(args[0] if args else DEFAULT_URL, "--push" in sys.argv)


if __name__ == "__main__":
    main()
