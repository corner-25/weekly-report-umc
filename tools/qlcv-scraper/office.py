"""
Phần dùng chung khi cào office.umc.edu.vn: lấy mã xác thực trang tự gửi, tải file
đính kèm, nén PDF, đọc chữ (OCR) và gọi API nạp dữ liệu của hệ thống.
"""
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
import uuid
from pathlib import Path

HOME = Path.home() / ".qlcv"
APP_URL = os.environ.get("APP_URL", "https://umc.up.railway.app")
FILE_URL = "https://officeapi.umc.edu.vn/v1/tasks/viewFileTask?id={}"
PAUSE_S = 0.3

# ── Phiên office ──


def capture_session(page, url: str, timeout_s: int = 30) -> dict | None:
    """Mở trang dự án, bắt header xác thực và thân yêu cầu danh sách mà trang tự gửi."""
    captured: dict = {}

    def on_request(req):
        if "/v1/tasks/getTasks" in req.url and "headers" not in captured:
            captured["headers"] = {k: v for k, v in req.headers.items() if k.lower() in ("authorization", "func", "content-type")}
            captured["body"] = json.loads(req.post_data or "{}")

    page.on("request", on_request)
    try:
        page.goto(url, wait_until="networkidle")
        for _ in range(timeout_s * 2):
            if "headers" in captured:
                break
            page.wait_for_timeout(500)
    finally:
        page.remove_listener("request", on_request)
    return captured or None


def download(page, headers: dict, file_id: str, target: Path) -> bool:
    """Tải một file đính kèm; thử lại khi mạng chập chờn hoặc tường lửa cắt."""
    for attempt in range(3):
        try:
            resp = page.request.get(FILE_URL.format(file_id), headers=headers, timeout=60000)
            if resp.ok and resp.body():
                target.write_bytes(resp.body())
                return True
        except Exception:
            pass
        time.sleep(3 * (attempt + 1))
    return False


# ── Nén PDF ──

# Bản scan văn bản: ảnh màu/xám 120 dpi, JPEG chất lượng 70 vẫn đọc rõ chữ, nhẹ hơn
# bản gốc 200–300 dpi 2–3 lần. Ảnh đen trắng giữ 300 dpi cho nét chữ ký.
SCAN_DPI = 120
MIN_SAVING = 0.1
GS_IMAGE_FLAGS = (
    "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true", "-dDownsampleMonoImages=true",
    f"-dColorImageResolution={SCAN_DPI}", f"-dGrayImageResolution={SCAN_DPI}", "-dMonoImageResolution=300",
    "-dColorImageDownsampleThreshold=1.0", "-dGrayImageDownsampleThreshold=1.0",
    "-dPassThroughJPEGImages=false", "-dJPEGQ=70",
)


def compress_pdf(src: Path) -> Path:
    """Nén PDF bằng Ghostscript — giữ bản gốc nếu không nhỏ hơn đáng kể hoặc nén lỗi."""
    gs = shutil.which("gs")
    if not gs or src.suffix.lower() != ".pdf":
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


# ── Đọc chữ (cho AI đọc biên bản MOU) ──

MIN_TEXT_WORDS = 40


def _run(cmd: list, timeout: int = 180) -> str:
    return subprocess.run(cmd, check=True, timeout=timeout, capture_output=True, text=True).stdout


def ocr_text(path: Path) -> tuple[str | None, int | None]:
    """
    Chữ của file: PDF có lớp chữ thì lấy thẳng, trang ảnh scan thì OCR Tesseract
    (vie+eng, 200 dpi). Excel đổi ra từng dòng. Thiếu công cụ thì trả None.
    """
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        try:
            import openpyxl

            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            parts = []
            for ws in wb:
                lines = [" | ".join("" if c is None else str(c).strip() for c in r) for r in ws.iter_rows(values_only=True) if any(c is not None for c in r)]
                parts.append(f"--- Trang tính {ws.title} ---\n" + "\n".join(lines))
            return "\n\n".join(parts), len(parts)
        except Exception:
            return None, None
    if suffix != ".pdf" or not all(shutil.which(t) for t in ("pdfinfo", "pdftotext", "pdftoppm", "tesseract")):
        return None, None
    try:
        pages = int(next(l.split()[-1] for l in _run(["pdfinfo", str(path)]).splitlines() if l.startswith("Pages:")))
    except (subprocess.SubprocessError, StopIteration, ValueError):
        return None, None
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        for p in range(1, pages + 1):
            text = _run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), str(path), "-"])
            if len(text.split()) < MIN_TEXT_WORDS:
                prefix = Path(tmp) / f"p{p}"
                _run(["pdftoppm", "-r", "200", "-gray", "-png", "-f", str(p), "-l", str(p), str(path), str(prefix)])
                image = next(Path(tmp).glob(f"p{p}*.png"), None)
                if image:
                    text = _run(["tesseract", str(image), "stdout", "-l", "vie+eng", "--psm", "1"], timeout=300)
            out.append(f"--- Trang {p} ---\n{text.strip()}")
    return "\n\n".join(out), pages


# ── API hệ thống ──


def load_token() -> str:
    token_file = HOME / "token"
    token = os.environ.get("WORK_IMPORT_TOKEN") or (token_file.read_text().strip() if token_file.exists() else "")
    if not token:
        raise SystemExit(f"Thiếu mã nạp dữ liệu: đặt WORK_IMPORT_TOKEN hoặc ghi vào {token_file}")
    return token


class Api:
    def __init__(self, token: str, base: str = APP_URL):
        self.token = token
        self.base = base.rstrip("/")

    def _send(self, path: str, data: bytes | None, content_type: str | None, method: str, timeout: int):
        headers = {"x-import-token": self.token}
        if content_type:
            headers["Content-Type"] = content_type
        req = urllib.request.Request(f"{self.base}{path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read() or b"null")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"{method} {path}: HTTP {e.code} {body}") from None

    def get(self, path: str, timeout: int = 60):
        return self._send(path, None, None, "GET", timeout)

    def post_json(self, path: str, payload, timeout: int = 300):
        return self._send(path, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json", "POST", timeout)

    def post_file(self, path: str, fields: dict, file_path: Path, file_name: str, timeout: int = 180):
        boundary = uuid.uuid4().hex
        chunks = []
        for k, v in fields.items():
            if v is None:
                continue
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode("utf-8"))
        safe_name = file_name.replace('"', "'")
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{safe_name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode("utf-8"))
        chunks.append(file_path.read_bytes())
        chunks.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
        return self._send(path, b"".join(chunks), f"multipart/form-data; boundary={boundary}", "POST", timeout)


# ── Tự đăng nhập office ──

KEYCHAIN_SERVICE = "office.umc.edu.vn"
USER_FILE = HOME / "username"
SIGN_IN = "sign-in"


def _keychain_get(user: str) -> str | None:
    try:
        return subprocess.run(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", user, "-w"],
                              check=True, capture_output=True, text=True).stdout.strip() or None
    except (subprocess.SubprocessError, OSError):
        return None


def _keychain_set(user: str, password: str) -> None:
    subprocess.run(["security", "add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", user, "-w", password],
                   check=False, capture_output=True)


def forget_password() -> None:
    user = USER_FILE.read_text().strip() if USER_FILE.exists() else None
    if user:
        subprocess.run(["security", "delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", user], check=False, capture_output=True)


def credentials(ask: bool) -> tuple[str, str] | None:
    """
    Tài khoản office: lấy từ Keychain của máy Mac nếu đã lưu, không thì hỏi ngay ở cửa sổ
    dòng lệnh (mật khẩu gõ không hiện) và hỏi có lưu vào Keychain cho lần sau không.
    Chạy nền không có người gõ (ask=False) mà chưa lưu thì trả None.
    """
    import getpass
    import sys

    user = USER_FILE.read_text().strip() if USER_FILE.exists() else None
    password = _keychain_get(user) if user else None
    if user and password:
        return user, password
    if not ask or not sys.stdin.isatty():
        return None
    print("\nĐăng nhập office.umc.edu.vn (chỉ cần khi phiên đăng nhập hết hạn).")
    user = input(f"  Tài khoản{f' [{user}]' if user else ''}: ").strip() or (user or "")
    password = getpass.getpass("  Mật khẩu (gõ không hiện): ")
    if not user or not password:
        return None
    USER_FILE.write_text(user)
    if input("  Lưu mật khẩu vào Keychain của máy để lần sau tự đăng nhập? (c/k) [c]: ").strip().lower() in ("", "c", "co", "có", "y"):
        _keychain_set(user, password)
    return user, password


def auto_login(page, url: str, ask: bool = True) -> bool:
    """Điền tài khoản vào trang đăng nhập office trong chính trình duyệt đang cào (không mở cửa sổ)."""
    for attempt in range(2):
        creds = credentials(ask)
        if not creds:
            return False
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(1500)
        if SIGN_IN not in page.url:
            return True
        page.fill("input[formcontrolname='userName']", creds[0])
        page.fill("input[formcontrolname='password']", creds[1])
        page.get_by_role("button", name="Đăng nhập").click()
        for _ in range(40):
            page.wait_for_timeout(500)
            if SIGN_IN not in page.url:
                print("  Đã đăng nhập office.")
                return True
            if "không chính xác" in page.inner_text("body"):
                break
        print("  Đăng nhập không được — có thể sai mật khẩu.")
        forget_password()
    return False
