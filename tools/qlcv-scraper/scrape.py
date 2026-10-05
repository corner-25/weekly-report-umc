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
    WORK_IMPORT_TOKEN=... python3 tools/qlcv-scraper/scrape.py run --push

Danh sách lấy từ API nội bộ /v1/tasks/getTasks mà chính trang gọi (bắt phản hồi
khi mở trang, không tự gọi API): đủ tiêu đề, đơn vị, người thực hiện, người theo
dõi, hạn, trạng thái, % và lịch sử "Mô tả tiến độ thực hiện".
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


def to_contract(rows: list, list_url: str) -> dict:
    items = []
    for r in rows:
        updates = parse_notes(r.get("notes"))
        item = {
            "externalId": str(r.get("taskID") or r.get("sys_TaskID")),
            "url": list_url,
            "title": (r.get("taskTitle") or "").strip(),
            "description": (r.get("description") or "").strip() or None,
            "kind": "DIRECTIVE",
            "leadUnit": r.get("assigneeDeptName"),
            "assignees": [r["assigneeName"]] if r.get("assigneeName") else [],
            "watchers": [w.strip() for w in (r.get("watcherName") or "").split(",") if w.strip()],
            "category": r.get("fN1"),
            "dueDate": day(r.get("deadline")),
            "status": r.get("statusName"),
            "progressPercent": r.get("percentDone"),
            "updates": updates,
        }
        if updates:
            item["lastUpdatedAt"] = max(updates, key=lambda u: (u["at"][6:10], u["at"][3:5], u["at"][:2], u["at"][11:]))["at"]
        items.append({k: v for k, v in item.items() if v not in (None, "")})
    return {"source": "qlcv", "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%S+07:00"), "items": items}


def cmd_run(url: str, push: bool) -> None:
    with sync_playwright() as p:
        ctx = open_context(p, headless=True)
        page = ctx.new_page()
        with page.expect_response(lambda r: "/v1/tasks/getTasks" in r.url and r.status == 200, timeout=60000) as info:
            page.goto(url)
        body = info.value.json()
        ctx.close()
    if "sign-in" in str(body)[:200] or not body.get("succeeded"):
        sys.exit("Không lấy được danh sách — phiên đăng nhập có thể đã hết, chạy lại: scrape.py login")
    rows = body["data"]["r"]
    payload = to_contract(rows, url)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"qlcv-{time.strftime('%Y%m%d-%H%M')}.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    n_updates = sum(len(i.get("updates", [])) for i in payload["items"])
    print(f"Lấy được {len(rows)} công việc, {n_updates} lần cập nhật tiến độ → {out}")
    if push:
        import urllib.request

        token = os.environ.get("WORK_IMPORT_TOKEN")
        if not token:
            sys.exit("Thiếu biến môi trường WORK_IMPORT_TOKEN để đẩy lên hệ thống")
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
