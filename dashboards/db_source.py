"""Đọc dữ liệu dashboard từ Postgres.

Thay cho việc tải JSON từ GitHub. Ingestion layer của app Next.js đã lấy dữ liệu
từ nguồn gốc (Google Sheets, OneDrive), làm sạch và ghi vào Postgres — nên
dashboard chỉ cần đọc ra, không phải làm sạch lại.

GitHub trước đây đóng vai kho dữ liệu, nay bỏ vai đó. Xem docs/INGESTION-REFACTOR.md.
"""
from __future__ import annotations

import os

import pandas as pd
import streamlit as st

try:
    import psycopg2
except ImportError:  # pragma: no cover - chỉ xảy ra khi thiếu dependency
    psycopg2 = None


# Cache 60 giây: dữ liệu chỉ đổi khi cron chạy (mỗi ngày một lần), nhưng vẫn để
# ngắn để người dùng bấm "Làm mới" thấy ngay sau khi chạy đồng bộ thủ công.
CACHE_TTL_SECONDS = 60


class DatabaseNotConfigured(RuntimeError):
    """Chưa cấu hình DATABASE_URL — nêu rõ để người vận hành biết cách sửa."""


def get_database_url() -> str:
    """Lấy chuỗi kết nối, ưu tiên biến môi trường rồi tới Streamlit secrets."""
    url = os.getenv("DATABASE_URL")
    if url:
        return url

    try:
        url = st.secrets.get("DATABASE_URL")  # type: ignore[union-attr]
    except Exception:
        url = None

    if not url:
        raise DatabaseNotConfigured(
            "Chưa có DATABASE_URL. Trên Railway: thêm biến DATABASE_URL trỏ vào "
            "Postgres của project (dùng ${{Postgres.DATABASE_URL}} để tham chiếu)."
        )
    return url


def _connect():
    if psycopg2 is None:
        raise DatabaseNotConfigured(
            "Thiếu thư viện psycopg2-binary. Thêm vào requirements.txt rồi cài lại."
        )
    return psycopg2.connect(get_database_url())


def _read_sql(query: str, params: tuple | None = None) -> pd.DataFrame:
    conn = _connect()
    try:
        return pd.read_sql_query(query, conn, params=params)
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════
#                        DỮ LIỆU TỔ XE
# ═══════════════════════════════════════════════════════════════════

# Tên cột trong DB là camelCase (Prisma), dashboard dùng snake_case.
FLEET_QUERY = """
    SELECT
        "vehicleId"          AS vehicle_id,
        "driverName"         AS driver_name,
        "vehicleType"        AS vehicle_type,
        "recordDate"         AS record_date,
        "startTime"          AS start_time,
        "endTime"            AS end_time,
        "durationHours"      AS duration_hours,
        "durationConfidence" AS duration_confidence,
        "durationMethod"     AS duration_method,
        "durationSuspicious" AS duration_suspicious,
        odometer,
        "odometerStatus"     AS odometer_status,
        "odometerDelta"      AS odometer_delta,
        "distanceKm"         AS distance_km,
        "distanceFixMethod"  AS distance_fix_method,
        "fuelLiters"         AS fuel_liters,
        "revenueVnd"         AS revenue_vnd,
        destination,
        "workCategory"       AS work_category,
        "areaType"           AS area_type,
        "tripDetails"        AS trip_details
    FROM fleet_trips
    ORDER BY "recordDate", "vehicleId"
"""


@st.cache_data(ttl=CACHE_TTL_SECONDS)
def load_fleet_data() -> pd.DataFrame:
    """Chuyến xe đã làm sạch, ở đúng dạng dashboard mong đợi.

    Dữ liệu trong DB đã qua ingestion layer (giờ lái đã sửa nhầm AM/PM, quãng
    đường đã sửa outlier, tên tài xế đã tra từ email), nên KHÔNG chạy lại
    process_dataframe. Ở đây chỉ thêm các cột dẫn xuất mà dashboard dùng.
    """
    df = _read_sql(FLEET_QUERY)
    if df.empty:
        return df

    df["record_date"] = pd.to_datetime(df["record_date"], errors="coerce")
    df["date"] = df["record_date"].dt.date
    df["month"] = df["record_date"].dt.to_period("M").astype(str)
    df["weekday"] = df["record_date"].dt.weekday

    # Dashboard tính toán trên số; giá trị thiếu để 0 cho các phép cộng dồn.
    for col in ("distance_km", "revenue_vnd", "fuel_liters", "duration_hours"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    return df


@st.cache_data(ttl=CACHE_TTL_SECONDS)
def get_fleet_last_sync() -> dict | None:
    """Thông tin lần đồng bộ gần nhất, để hiển thị 'dữ liệu tới ngày nào'."""
    df = _read_sql(
        """
        SELECT status, "startedAt", "finishedAt", "rowsUpserted", "errorMessage"
        FROM sync_runs
        WHERE "sourceId" = 'fleet-google-sheets'
        ORDER BY "startedAt" DESC
        LIMIT 1
        """
    )
    return None if df.empty else df.iloc[0].to_dict()


# ═══════════════════════════════════════════════════════════════════
#                     DỮ LIỆU PHÒNG HÀNH CHÍNH
# ═══════════════════════════════════════════════════════════════════

HC_QUERY = """
    SELECT
        category AS "Danh mục",
        content  AS "Nội dung",
        year     AS "Năm",
        month    AS "Tháng",
        week     AS "Tuần",
        value    AS "Số liệu"
    FROM hc_metrics
    ORDER BY year, week, category, content
"""


@st.cache_data(ttl=CACHE_TTL_SECONDS)
def load_hc_data() -> pd.DataFrame:
    """Số liệu tuần của Phòng Hành chính.

    Tên cột giữ nguyên tiếng Việt như định dạng JSON cũ trên GitHub, để phần
    còn lại của dashboard không phải sửa.
    """
    df = _read_sql(HC_QUERY)
    if df.empty:
        return df

    for col in ("Năm", "Tháng", "Tuần"):
        df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
    df["Số liệu"] = pd.to_numeric(df["Số liệu"], errors="coerce")

    return df


@st.cache_data(ttl=CACHE_TTL_SECONDS)
def get_hc_metadata() -> dict:
    """Metadata tương đương gói JSON cũ, cho phần header của dashboard."""
    df = load_hc_data()
    if df.empty:
        return {"row_count": 0, "years": [], "week_number": 0, "year": 0}

    latest = df.sort_values(["Năm", "Tuần"]).iloc[-1]
    last_sync = _read_sql(
        """
        SELECT "finishedAt"
        FROM sync_runs
        WHERE "sourceId" = 'dept-report-onedrive' AND status = 'SUCCESS'
        ORDER BY "startedAt" DESC
        LIMIT 1
        """
    )

    return {
        "row_count": len(df),
        "years": sorted(df["Năm"].dropna().unique().tolist()),
        "week_number": int(latest["Tuần"]),
        "year": int(latest["Năm"]),
        "upload_time": (
            None if last_sync.empty else str(last_sync.iloc[0]["finishedAt"])
        ),
    }
