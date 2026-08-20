/**
 * Tải file từ OneDrive/SharePoint qua share link "Anyone with the link".
 *
 * Endpoint `download.aspx?share=<ID>` tải được file mà không cần token — đã kiểm
 * chứng trên tenant umceduvn-my.sharepoint.com. Các endpoint Graph
 * (`api.onedrive.com/shares/...`, `graph.microsoft.com/shares/...`) đều đòi xác
 * thực hoặc trả "User migrated"; xem docs/ONEDRIVE-DATA-ANALYSIS.md.
 *
 * Đây là chỗ DUY NHẤT phụ thuộc vào cách xác thực OneDrive. Nếu sau này chuyển
 * sang Power Automate hoặc app registration, chỉ file này thay đổi.
 */

/** Giới hạn kích thước file, chặn nguồn hỏng làm cạn bộ nhớ container. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** Content-Type mà SharePoint trả về cho file xlsx. */
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface OneDriveShareLink {
  /** Host tenant, vd "umceduvn-my.sharepoint.com" */
  tenantHost: string;
  /** Đường dẫn personal site, vd "personal/hanhchinh_umc_edu_vn" */
  personalPath: string;
  /** Mã share, đoạn cuối của URL trước dấu "?" */
  shareId: string;
}

/**
 * Tách share link thành các thành phần cần cho endpoint download.
 *
 * Chấp nhận URL dạng:
 *   https://<tenant>/:x:/g/personal/<user>/<SHARE_ID>?e=<...>
 *
 * Ném lỗi nếu URL không đúng dạng — thà fail rõ ràng còn hơn tải nhầm file.
 */
export function parseShareUrl(shareUrl: string): OneDriveShareLink {
  let url: URL;
  try {
    url = new URL(shareUrl);
  } catch {
    throw new Error(`Share link không phải URL hợp lệ: ${shareUrl.slice(0, 80)}`);
  }

  // /:x:/g/personal/<user>/<SHARE_ID>
  const match = /\/:[a-z]:\/[a-z]\/(personal\/[^/]+)\/([^/?]+)/i.exec(url.pathname);
  if (!match) {
    throw new Error(
      `Share link không đúng dạng OneDrive mong đợi (thiếu /personal/<user>/<id>): ${url.pathname}`,
    );
  }

  return { tenantHost: url.host, personalPath: match[1], shareId: match[2] };
}

/** Dựng URL tải trực tiếp từ share link. */
export function buildDownloadUrl(link: OneDriveShareLink): string {
  const { tenantHost, personalPath, shareId } = link;
  return `https://${tenantHost}/${personalPath}/_layouts/15/download.aspx?share=${encodeURIComponent(shareId)}`;
}

export interface DownloadedFile {
  buffer: Buffer;
  contentType: string;
  byteLength: number;
}

/**
 * Tải file từ share link. Ném lỗi kèm nguyên nhân cụ thể nếu thất bại.
 *
 * Trả HTML thay vì file nhị phân nghĩa là link đã mất chế độ công khai và
 * SharePoint chuyển hướng sang trang đăng nhập — báo lỗi rõ ràng thay vì để
 * parser phía sau nhận HTML rồi báo "file Excel hỏng".
 */
export async function downloadSharedFile(shareUrl: string): Promise<DownloadedFile> {
  const link = parseShareUrl(shareUrl);
  const downloadUrl = buildDownloadUrl(link);

  const res = await fetch(downloadUrl, {
    redirect: 'follow',
    headers: {
      // SharePoint trả trang đăng nhập cho client không giống trình duyệt.
      'User-Agent': 'Mozilla/5.0 (compatible; UMC-Ingestion/1.0)',
      Accept: '*/*',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Tải file thất bại: HTTP ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error(
      'Nhận được trang HTML thay vì file. Share link nhiều khả năng không còn ở chế độ ' +
        '"Anyone with the link" — hãy kiểm tra lại quyền chia sẻ của file.',
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `File quá lớn: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB, ` +
        `vượt giới hạn ${MAX_FILE_BYTES / 1024 / 1024}MB`,
    );
  }
  if (arrayBuffer.byteLength === 0) {
    throw new Error('File tải về rỗng');
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: contentType || XLSX_CONTENT_TYPE,
    byteLength: arrayBuffer.byteLength,
  };
}
