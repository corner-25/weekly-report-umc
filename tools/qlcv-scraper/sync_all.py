"""
Cào một lần cả hai dự án trên office.umc.edu.vn rồi đẩy thẳng lên production:

  1. Quản lý công việc (chỉ đạo BGĐ): danh sách + lịch sử tiến độ → nạp; file đính
     kèm mới → tải về, nén PDF → tải lên.
  2. MOU (theo dõi ký kết hợp tác): danh sách + tiến độ → nạp; file mới → tải, nén,
     đọc chữ (OCR) → tải lên; MOU có văn bản mới → AI đọc lại khía cạnh và đánh giá.

    python3 tools/qlcv-scraper/sync_all.py                 # làm hết
    python3 tools/qlcv-scraper/sync_all.py --chi-cong-viec # chỉ công việc
    python3 tools/qlcv-scraper/sync_all.py --chi-mou       # chỉ MOU
    python3 tools/qlcv-scraper/sync_all.py --khong-file    # bỏ file đính kèm
    python3 tools/qlcv-scraper/sync_all.py --khong-ai      # MOU không cho AI đọc lại
    python3 tools/qlcv-scraper/sync_all.py --tai-lai-file  # tải lại cả file đã có (khi đổi mức nén)

Cần: phiên đăng nhập office (scrape.py login-wait), mã nạp (~/.qlcv/token hoặc
WORK_IMPORT_TOKEN), Google Chrome, Ghostscript (nén PDF), poppler + tesseract-lang (OCR).
Phiên office hết hạn → tự đăng nhập: tài khoản lấy từ Keychain của máy Mac, chưa lưu thì
hỏi ngay ở cửa sổ dòng lệnh (có thể lưu vào Keychain cho lần sau). Không đăng nhập được
→ thoát mã 3 để file bấm chạy mở cửa sổ đăng nhập tay.

    python3 tools/qlcv-scraper/sync_all.py --quen-mat-khau  # xoá mật khẩu đã lưu trong Keychain
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import office  # noqa: E402
import scrape  # noqa: E402

WORK_URL = scrape.DEFAULT_URL
MOU_URL = "https://office.umc.edu.vn/#/M02/M02PROJECT/cHJvamVjdElEPTc2"  # projectID=76
MOU_QUERY = 10457
EXIT_LOGIN = 3
EXIT_BUSY = 4
LOCK = office.HOME / "sync.lock"


def acquire_lock() -> None:
    """Hai lượt cùng chạy sẽ tranh nhau hồ sơ Chrome (lỗi launch_persistent_context) — chặn từ đầu."""
    import os

    if LOCK.exists():
        try:
            pid = int(LOCK.read_text().strip())
            os.kill(pid, 0)
            print(f"Đang có một lượt đồng bộ khác chạy (tiến trình {pid}) — đợi lượt đó xong rồi chạy lại.")
            sys.exit(EXIT_BUSY)
        except (ValueError, ProcessLookupError, PermissionError):
            pass  # khoá cũ của lượt đã dừng
    LOCK.write_text(str(os.getpid()))


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def fetch_rows(page, session: dict, query_ids) -> list:
    responses = []
    for qid in query_ids:
        resp = page.request.post(scrape.GET_TASKS, data=json.dumps({**session["body"], "CustomQueryID": qid}), headers=session["headers"])
        data = resp.json() if resp.ok else {}
        if data.get("succeeded"):
            responses.append(data)
        else:
            log(f"  mẫu truy vấn {qid}: lỗi HTTP {resp.status}")
    return responses


def upload_new_files(page, session: dict, api: office.Api, details: dict, *, known: dict, folder: Path, endpoint: str,
                     owner_field: str, refresh: bool, ocr: bool) -> set:
    """Tải file chưa có trên hệ thống, nén, (đọc chữ), tải lên. Trả tập mã chủ (việc/MOU) có file mới."""
    folder.mkdir(parents=True, exist_ok=True)
    todo = [(owner, f) for owner, d in details.items() for f in d.get("files") or [] if refresh or str(f["attchFileID"]) not in known]
    if not todo:
        log("  không có file mới")
        return set()
    changed, failed, saved_kb, original_kb = set(), [], 0, 0
    for n, (owner, f) in enumerate(todo, 1):
        file_id = str(f["attchFileID"])
        target = folder / f"{file_id}{(f.get('extension') or '').lower()}"
        if not office.download(page, session["headers"], file_id, target):
            failed.append(f["fileName"])
            continue
        original = target.stat().st_size
        final = office.compress_pdf(target)
        text, pages = office.ocr_text(final) if ocr else (None, None)
        fields = {
            owner_field: owner,
            "attchFileID": file_id,
            "fileName": f["fileName"],
            "extension": f.get("extension"),
            "contentType": f.get("contentType"),
            "createdDate": f.get("createdDate"),
            "createdBy": f.get("createdBy"),
            "originalSize": original,
            "ocrText": text,
            "pageCount": pages,
        }
        try:
            api.post_file(endpoint, fields, final, f["fileName"])
            changed.add(owner)
            saved_kb += final.stat().st_size // 1024
            original_kb += original // 1024
            log(f"  file {n}/{len(todo)} {f['fileName']}: {original // 1024} KB → {final.stat().st_size // 1024} KB")
        except RuntimeError as e:
            failed.append(f"{f['fileName']} ({e})")
        time.sleep(office.PAUSE_S)
    log(f"  tải lên {len(todo) - len(failed)} file: {original_kb} KB → {saved_kb} KB sau nén")
    if failed:
        log(f"  KHÔNG tải được {len(failed)} file: {'; '.join(failed[:10])}")
    return changed


def open_project(page, url: str) -> dict:
    """Mở trang dự án lấy mã xác thực; phiên hết hạn thì tự đăng nhập (tài khoản lưu Keychain hoặc hỏi) rồi mở lại."""
    session = office.capture_session(page, url)
    if session:
        return session
    log("  phiên office hết hạn — đăng nhập lại")
    if office.auto_login(page, url):
        session = office.capture_session(page, url)
        if session:
            return session
    sys.exit(EXIT_LOGIN)


def sync_work(page, api: office.Api, out: Path, args: set) -> None:
    log("CÔNG VIỆC — mở trang, lấy danh sách")
    session = open_project(page, WORK_URL)
    rows = scrape.merge_rows(fetch_rows(page, session, scrape.CUSTOM_QUERIES))
    log(f"  {len(rows)} việc — lấy chi tiết từng việc (lịch sử tiến độ, file)…")
    details = scrape.fetch_details(page, session["headers"], [str(r.get("taskID") or r.get("sys_TaskID")) for r in rows])
    payload = scrape.to_contract(rows, WORK_URL, details)
    (out / "cong-viec.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    result = api.post_json("/api/work/import", payload)
    log(f"  đã nạp: {result['itemsCreated']} việc mới, {result['itemsChanged']} việc thay đổi, {result['updatesAdded']} cập nhật mới")
    if "--khong-file" in args:
        return
    known = api.get("/api/work/import/files")
    upload_new_files(page, session, api, details, known=known, folder=out / "cong-viec-files", endpoint="/api/work/import/files",
                     owner_field="externalId", refresh="--tai-lai-file" in args, ocr=False)


def sync_mou(page, api: office.Api, out: Path, args: set) -> None:
    log("MOU — mở trang dự án, lấy danh sách")
    session = open_project(page, MOU_URL)
    responses = fetch_rows(page, session, (MOU_QUERY,))
    if not responses:
        log("  không lấy được danh sách MOU")
        return
    rows = responses[0]["data"]["r"]
    log(f"  {len(rows)} MOU — lấy chi tiết…")
    details = scrape.fetch_details(page, session["headers"], [str(r["taskID"]) for r in rows])
    bundle = {"source": MOU_URL, "rows": rows, "details": details}
    (out / "mou.json").write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
    result = api.post_json("/api/mous/import", bundle)
    log(f"  đã nạp: {result['created']} MOU mới, {result['updated']} cập nhật, {result['progress']} dòng tiến độ mới")
    if "--khong-file" in args:
        return
    known = api.get("/api/mous/import/files")
    changed = upload_new_files(page, session, api, details, known=known, folder=out / "mou-files", endpoint="/api/mous/import/files",
                               owner_field="taskId", refresh="--tai-lai-file" in args, ocr=True)
    if changed and "--khong-ai" not in args:
        log(f"  AI đọc lại {len(changed)} MOU có văn bản mới (~1 phút mỗi MOU)…")
        for task_id in sorted(changed):
            try:
                r = api.post_json("/api/mous/import/ai", {"taskId": task_id}, timeout=240)
                log(f"    MOU {task_id}: {r.get('extracted') or ''} · {r.get('assessed')}")
            except RuntimeError as e:
                log(f"    MOU {task_id}: AI lỗi — {e}")


def main() -> None:
    args = set(sys.argv[1:])
    if "--quen-mat-khau" in args:
        office.forget_password()
        print("Đã xoá mật khẩu office lưu trong Keychain.")
        return
    acquire_lock()
    api = office.Api(office.load_token())
    out = scrape.OUT / f"dong-bo-{time.strftime('%Y%m%d-%H%M')}"
    out.mkdir(parents=True, exist_ok=True)
    started = time.time()
    try:
        with sync_playwright() as p:
            try:
                ctx = scrape.open_context(p, headless=True)
            except Exception as e:
                print(f"Không mở được Chrome với hồ sơ đăng nhập ({str(e).splitlines()[0]}).")
                print("Thường do một cửa sổ Chrome/lượt cào khác đang dùng hồ sơ này — đóng nó rồi chạy lại.")
                sys.exit(EXIT_BUSY)
            page = ctx.new_page()
            try:
                if "--chi-mou" not in args:
                    sync_work(page, api, out, args)
                if "--chi-cong-viec" not in args:
                    sync_mou(page, api, out, args)
            finally:
                ctx.close()
    finally:
        LOCK.unlink(missing_ok=True)
    log(f"XONG sau {int(time.time() - started) // 60} phút — bản lưu: {out}")


if __name__ == "__main__":
    main()
