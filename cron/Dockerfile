# Cron service: gọi endpoint đồng bộ của app chính rồi thoát.
#
# Railway chạy container này theo lịch (cronSchedule trên service), mỗi lần
# chạy xong container tắt. Chỉ cần curl nên dùng image nhỏ nhất.
FROM alpine:3.20

RUN apk add --no-cache curl

COPY sync.sh /sync.sh
RUN chmod +x /sync.sh

CMD ["/sync.sh"]
