"""
Cào phân hệ Quản lý công việc (office.umc.edu.vn) → file JSON đúng hợp đồng
docs/WORK-MANAGEMENT.md → đẩy lên hệ thống.

Chạy trên máy trong mạng bệnh viện (đã cài Python + playwright + Google Chrome).

Bước 1 — đăng nhập một lần (mở cửa sổ Chrome, anh/chị tự đăng nhập, phiên được lưu):
    python3 tools/qlcv-scraper/scrape.py login

Bước 2 — khảo sát (chạy một lần để lập trình viên biết dữ liệu trang trả về dạng nào):
    python3 tools/qlcv-scraper/scrape.py survey "<link trang Theo dõi chỉ đạo của BGĐ>"
    → ghi mọi phản hồi JSON của trang danh sách và trang chi tiết đầu tiên vào ~/.qlcv/survey/

Bước 3 (sau khi đã viết phần trích xuất) — cào và đẩy lên:
    python3 tools/qlcv-scraper/scrape.py run "<link>" --push
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
        ctx = open_context(p, headless=False)
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
        sys.exit("Bước run sẽ có sau khi khảo sát xong dữ liệu trang.")


if __name__ == "__main__":
    main()
