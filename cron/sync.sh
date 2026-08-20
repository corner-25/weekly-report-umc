#!/bin/sh
# Gọi endpoint đồng bộ của app chính.
#
# Thoát khác 0 khi thất bại để Railway đánh dấu lần chạy là lỗi — có vậy mới
# nhìn ra được trên lịch sử deployment khi nguồn dữ liệu hỏng.
set -eu

: "${SYNC_URL:?Thiếu biến SYNC_URL}"
: "${CRON_SECRET:?Thiếu biến CRON_SECRET}"

echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] Bắt đầu đồng bộ: $SYNC_URL"

RESPONSE=$(curl -sS -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  --max-time 290 \
  --write-out '\n%{http_code}' \
  "$SYNC_URL")

BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -n1)

echo "$BODY"
echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] HTTP $CODE"

if [ "$CODE" != "200" ]; then
  echo "Đồng bộ thất bại (HTTP $CODE)" >&2
  exit 1
fi

# API trả success=false khi có nguồn lỗi, dù HTTP vẫn 200.
if echo "$BODY" | grep -q '"success":false'; then
  echo "Có nguồn đồng bộ thất bại — xem sync_runs và sync_logs" >&2
  exit 1
fi

echo "Đồng bộ thành công"
