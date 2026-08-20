# Dashboard Streamlit (Tổ Xe / Hành chính) — deploy như service riêng trên Railway.
#
# Cùng một image dùng cho cả hai dashboard; chọn dashboard nào bằng biến môi
# trường DASHBOARD_APP (app_toxe.py hoặc app_phonghc.py).
FROM python:3.11-slim

WORKDIR /app

# Cài dependency trước, tách khỏi bước copy mã nguồn để tận dụng cache layer.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Railway cấp PORT lúc chạy; 8501 chỉ là mặc định khi chạy local.
ENV PORT=8501
ENV DASHBOARD_APP=app_toxe.py

# Streamlit ghi secrets từ biến môi trường STREAMLIT_SECRETS (Railway Variables),
# giống cách Procfile cũ làm, để không phải commit secrets.toml vào repo.
CMD mkdir -p .streamlit && \
    if [ -n "$STREAMLIT_SECRETS" ]; then printenv STREAMLIT_SECRETS > .streamlit/secrets.toml; fi && \
    streamlit run "$DASHBOARD_APP" \
      --server.port "$PORT" \
      --server.address 0.0.0.0 \
      --server.headless true \
      --server.enableCORS false \
      --server.enableXsrfProtection false
