"""
Cào dự án "Theo dõi ký kết hợp tác toàn viện" (MOU) trên office.umc.edu.vn —
cùng cơ chế với scrape.py (phiên đăng nhập lưu ở ~/.qlcv/chrome-profile).

    python3 tools/qlcv-scraper/mou.py            # cào + tải file đính kèm + nén PDF
    python3 tools/qlcv-scraper/mou.py --no-files # chỉ cào thông tin
    python3 tools/qlcv-scraper/mou.py --recompress ~/.qlcv/out/mou-<thời điểm>

Kết quả: ~/.qlcv/out/mou-<thời điểm>/mou.json và thư mục files/ (mỗi file đặt
tên theo mã file của office). Nạp vào hệ thống:

    npx tsx prisma/import-mou-office.ts ~/.qlcv/out/mou-<thời điểm>
"""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import scrape  # noqa: E402

PROJECT_URL = "https://office.umc.edu.vn/#/M02/M02PROJECT/cHJvamVjdElEPTc2"  # projectID=76
# Mẫu truy vấn "BV_Dự án theo dõi MOU toàn viện": đủ lĩnh vực (FN264), đơn vị đầu mối, người theo dõi.
MOU_QUERY = 10457
FILE_URL = "https://officeapi.umc.edu.vn/v1/tasks/viewFileTask?id={}"
# PDF nén bằng Ghostscript chỉ giữ khi nhỏ hơn bản gốc ít nhất ngần này.
MIN_SAVING = 0.1
# Bản scan văn bản: ảnh màu/xám 120 dpi, JPEG chất lượng 70 vẫn đọc rõ chữ, nhẹ
# hơn bản gốc 200–300 dpi 2–3 lần. Ảnh đen trắng giữ 300 dpi cho nét chữ ký.
SCAN_DPI = 120
GS_IMAGE_FLAGS = (
    "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true", "-dDownsampleMonoImages=true",
    f"-dColorImageResolution={SCAN_DPI}", f"-dGrayImageResolution={SCAN_DPI}", "-dMonoImageResolution=300",
    "-dColorImageDownsampleThreshold=1.0", "-dGrayImageDownsampleThreshold=1.0",
    "-dPassThroughJPEGImages=false", "-dJPEGQ=70",
)


def compress_pdf(src: Path) -> Path:
    """Nén PDF (ảnh scan về SCAN_DPI) — giữ bản gốc nếu không nhỏ hơn đáng kể hoặc nén lỗi."""
    gs = shutil.which("gs")
    if not gs:
        return src
    out = src.with_suffix(".min.pdf")
    cmd = [gs, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", "-dNOPAUSE", "-dQUIET", "-dBATCH",
           *GS_IMAGE_FLAGS, f"-sOutputFile={out}", str(src)]
    try:
        subprocess.run(cmd, check=True, timeout=180, capture_output=True)
    except (subprocess.SubprocessError, OSError):
        out.unlink(missing_ok=True)
        return src
    if out.stat().st_size < src.stat().st_size * (1 - MIN_SAVING):
        return out
    out.unlink()
    return src


def download_files(page, headers: dict, details: dict, folder: Path) -> dict:
    """Tải mọi file đính kèm; trả {attchFileID: {path, originalSize, size}}."""
    folder.mkdir(parents=True, exist_ok=True)
    saved, failed = {}, []
    files = [f for d in details.values() for f in d.get("files") or []]
    for n, f in enumerate(files, 1):
        file_id = str(f["attchFileID"])
        target = folder / f"{file_id}{(f.get('extension') or '').lower()}"
        for attempt in range(3):
            try:
                resp = page.request.get(FILE_URL.format(file_id), headers=headers, timeout=60000)
                if resp.ok and resp.body():
                    target.write_bytes(resp.body())
                    break
            except Exception:  # mạng chập chờn / tường lửa — thử lại sau
                pass
            time.sleep(3 * (attempt + 1))
        else:
            failed.append(f["fileName"])
            continue
        original = target.stat().st_size
        final = compress_pdf(target) if target.suffix == ".pdf" else target
        saved[file_id] = {"path": final.name, "originalSize": original, "size": final.stat().st_size}
        print(f"  file {n}/{len(files)} {f['fileName']}: {original // 1024} KB → {saved[file_id]['size'] // 1024} KB")
        time.sleep(scrape.DETAIL_PAUSE_S)
    if failed:
        print(f"Không tải được {len(failed)} file: {', '.join(failed)}")
    return saved


def recompress(folder: Path) -> None:
    """Nén lại PDF của một lần cào trước (khi đổi mức nén) — không tải lại từ office."""
    payload = json.loads((folder / "mou.json").read_text(encoding="utf-8"))
    for file_id, meta in payload["files"].items():
        src = folder / "files" / f"{file_id}.pdf"
        if src.exists():
            final = compress_pdf(src)
            payload["files"][file_id] = {**meta, "path": final.name, "size": final.stat().st_size}
    (folder / "mou.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    total = sum(v["size"] for v in payload["files"].values())
    print(f"Nén lại xong: {len(payload['files'])} file, {total // 1024} KB")


def main() -> None:
    if len(sys.argv) > 2 and sys.argv[1] == "--recompress":
        recompress(Path(sys.argv[2]).expanduser())
        return
    with_files = "--no-files" not in sys.argv
    captured: dict = {}
    out = scrape.OUT / f"mou-{time.strftime('%Y%m%d-%H%M')}"
    with sync_playwright() as p:
        ctx = scrape.open_context(p, headless=True)
        page = ctx.new_page()

        def on_request(req):
            if "/v1/tasks/getTasks" in req.url and "headers" not in captured:
                captured["headers"] = {k: v for k, v in req.headers.items() if k.lower() in ("authorization", "func", "content-type")}
                captured["body"] = json.loads(req.post_data or "{}")

        page.on("request", on_request)
        page.goto(PROJECT_URL, wait_until="networkidle")
        for _ in range(60):
            if "headers" in captured:
                break
            page.wait_for_timeout(500)
        if "headers" not in captured:
            ctx.close()
            sys.exit("Trang không gọi danh sách — phiên đăng nhập có thể đã hết, chạy: scrape.py login-wait " + PROJECT_URL)
        body = {**captured["body"], "CustomQueryID": MOU_QUERY}
        resp = page.request.post(scrape.GET_TASKS, data=json.dumps(body), headers=captured["headers"])
        data = resp.json() if resp.ok else {}
        if not data.get("succeeded"):
            ctx.close()
            sys.exit(f"Không lấy được danh sách MOU (HTTP {resp.status})")
        rows = data["data"]["r"]
        print(f"{len(rows)} MOU — lấy chi tiết từng MOU…")
        details = scrape.fetch_details(page, captured["headers"], [str(r["taskID"]) for r in rows])
        saved = download_files(page, captured["headers"], details, out / "files") if with_files else {}
        ctx.close()
    payload = {"source": PROJECT_URL, "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "rows": rows, "details": details, "files": saved}
    (out / "mou.json").parent.mkdir(parents=True, exist_ok=True)
    (out / "mou.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    total = sum(v["size"] for v in saved.values())
    print(f"Xong: {len(rows)} MOU, {len(saved)} file ({total // 1024} KB) → {out}")


if __name__ == "__main__":
    main()
