"""Tinh diem va hien thi danh gia tai xe theo thang."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import pandas as pd
import streamlit as st


CONFIG_PATH = Path(__file__).with_name("fleet_evaluation_config.json")
EFFICIENCY_MAX = {"distance_km": 24.0, "trips": 21.0, "hours": 15.0}


def load_evaluation_config(path: Path = CONFIG_PATH) -> Dict[str, Any]:
    default = {
        "targets": {"distance_km": 1000, "trips": 80, "hours": 80},
        "manual_scores": [],
    }
    try:
        with path.open("r", encoding="utf-8") as handle:
            loaded = json.load(handle)
        default.update(loaded if isinstance(loaded, dict) else {})
    except (OSError, ValueError):
        pass
    return default


def save_manual_scores(rows: pd.DataFrame, month: str, path: Path = CONFIG_PATH) -> None:
    """Luu phan cham tay, giu nguyen du lieu cua cac thang khac."""
    config = load_evaluation_config(path)
    existing = pd.DataFrame(config.get("manual_scores", []))
    if not existing.empty and "month" in existing:
        existing = existing[existing["month"].astype(str) != month]
    updated = rows.copy()
    updated["month"] = month
    combined = pd.concat([existing, updated], ignore_index=True)
    config["manual_scores"] = combined.where(pd.notna(combined), None).to_dict("records")
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _score(actual: float, target: float, maximum: float) -> float:
    if target <= 0:
        return 0.0
    # Cho phep thuong toi da 5%, nhung tong nhom van khoa o 60 diem.
    return min(actual / target, 1.05) * maximum


def _classification(total: float, capped: str | None = None) -> str:
    if capped:
        return capped
    if total >= 90:
        return "Xuất sắc"
    if total >= 80:
        return "Tốt"
    if total >= 65:
        return "Đạt"
    if total >= 50:
        return "Cần cải thiện"
    return "Không đạt"


def _is_true(value: Any) -> bool:
    """Chi chap nhan co vi pham khi gia tri duoc danh dau ro rang."""
    if value is None or pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value == 1
    return str(value).strip().lower() in {"true", "1", "yes", "y", "có", "co"}


def calculate_driver_scores(
    df: pd.DataFrame,
    month: str,
    config: Dict[str, Any] | None = None,
) -> pd.DataFrame:
    """Tra ve bang diem theo tai xe cho mot thang YYYY-MM."""
    config = config or load_evaluation_config()
    work = df.copy()
    if "record_date" not in work or "driver_name" not in work:
        return pd.DataFrame()

    work["record_date"] = pd.to_datetime(work["record_date"], errors="coerce")
    current_period = pd.Period(month, freq="M")
    previous_month = str(current_period - 1)
    history = work.copy()
    work = work[work["record_date"].dt.strftime("%Y-%m") == month]
    work = work[work["driver_name"].notna()]
    work = work[work["driver_name"].astype(str).str.strip().ne("")]
    if "is_duplicate" in work:
        work = work[~work["is_duplicate"].fillna(False)]
    if work.empty:
        return pd.DataFrame()

    for col in ("distance_km", "duration_hours"):
        if col not in work:
            work[col] = 0.0
        work[col] = pd.to_numeric(work[col], errors="coerce").fillna(0).clip(lower=0)

    # Moi tai xe duoc so voi binh quan thang truoc cua cung nhom xe.
    if "vehicle_type" not in work:
        work["vehicle_type"] = "Tất cả"
        history["vehicle_type"] = "Tất cả"
    primary_type = (
        work.groupby("driver_name")["vehicle_type"]
        .agg(lambda values: values.mode().iloc[0] if not values.mode().empty else "Tất cả")
    )
    grouped = work.groupby("driver_name", as_index=False).agg(
        distance_km=("distance_km", "sum"),
        trips=("driver_name", "size"),
        hours=("duration_hours", "sum"),
    )
    grouped["vehicle_type"] = grouped["driver_name"].map(primary_type).fillna("Tất cả")

    history = history[history["record_date"].dt.strftime("%Y-%m") == previous_month].copy()
    if "is_duplicate" in history:
        history = history[~history["is_duplicate"].fillna(False)]
    for col in ("distance_km", "duration_hours"):
        if col not in history:
            history[col] = 0.0
        history[col] = pd.to_numeric(history[col], errors="coerce").fillna(0).clip(lower=0)
    if not history.empty:
        previous_by_driver = history.groupby("driver_name", as_index=False).agg(
            distance_km=("distance_km", "sum"), trips=("driver_name", "size"), hours=("duration_hours", "sum")
        )
        overall_targets = previous_by_driver[["distance_km", "trips", "hours"]].mean().to_dict()
    else:
        overall_targets = {}

    targets = config.get("targets", {})
    def target_for(metric: str) -> float:
        # Một bộ KPI chung cho toàn đội, lấy bình quân tháng trước.
        if metric in overall_targets:
            return float(overall_targets[metric] or 0)
        return float(targets.get(metric, 0) or 0)

    for metric, maximum in EFFICIENCY_MAX.items():
        grouped[f"target_{metric}"] = target_for(metric)
        grouped[f"score_{metric}"] = grouped.apply(
            lambda row: _score(row[metric], row[f"target_{metric}"], maximum), axis=1
        )

    score_cols = [f"score_{metric}" for metric in EFFICIENCY_MAX]
    grouped["efficiency_score"] = grouped[score_cols].sum(axis=1).clip(upper=60)
    grouped["target_month"] = previous_month

    manual = pd.DataFrame(config.get("manual_scores", []))
    required = {"month", "driver_name"}
    if not manual.empty and required.issubset(manual.columns):
        manual = manual[manual["month"].astype(str) == month].copy()
        for col, maximum in (("safety", 10), ("service", 10), ("compliance", 20)):
            if col not in manual:
                manual[col] = pd.NA
            manual[col] = pd.to_numeric(manual[col], errors="coerce").clip(0, maximum)
        keep = ["driver_name", "safety", "service", "compliance"]
        for optional in ("subjective_accident", "unauthorized_use", "note"):
            if optional in manual:
                keep.append(optional)
        manual = manual[keep].drop_duplicates("driver_name", keep="last")
        grouped = grouped.merge(manual, on="driver_name", how="left")

    for col in ("safety", "service", "compliance"):
        if col not in grouped:
            grouped[col] = pd.NA
    grouped["manual_complete"] = grouped[["safety", "service", "compliance"]].notna().all(axis=1)
    manual_numeric = grouped[["safety", "service", "compliance"]].apply(
        pd.to_numeric, errors="coerce"
    )
    grouped["manual_score"] = manual_numeric.fillna(0.0).sum(axis=1)
    grouped["total_score"] = grouped["efficiency_score"] + grouped["manual_score"]

    def classify(row: pd.Series) -> str:
        if not row["manual_complete"]:
            return "Chưa đủ đánh giá"
        if _is_true(row.get("unauthorized_use", False)):
            return "Không đạt"
        if _is_true(row.get("subjective_accident", False)):
            return "Cần cải thiện"
        return _classification(float(row["total_score"]))

    grouped["classification"] = grouped.apply(classify, axis=1)
    return grouped.sort_values(["manual_complete", "total_score"], ascending=False).reset_index(drop=True)


def render_driver_evaluation(df: pd.DataFrame) -> None:
    st.markdown("### 🏆 Đánh giá tài xế theo tháng")
    st.caption("60 điểm hiệu quả lấy tự động từ nhật trình; 40 điểm an toàn, phục vụ và tuân thủ lấy từ cấu hình đánh giá.")

    if "record_date" not in df or "driver_name" not in df:
        st.warning("Thiếu ngày ghi nhận hoặc tên tài xế để tính điểm.")
        return

    dates = pd.to_datetime(df["record_date"], errors="coerce")
    months = sorted(dates.dropna().dt.strftime("%Y-%m").unique(), reverse=True)
    if not months:
        st.warning("Không có tháng dữ liệu hợp lệ.")
        return

    config = load_evaluation_config()
    col1, col2 = st.columns([1, 2])
    with col1:
        month = st.selectbox("Tháng đánh giá", months, key="fleet_evaluation_month")
    with col2:
        previous_month = str(pd.Period(month, freq="M") - 1)
        st.info(f"KPI chung được lấy từ bình quân toàn đội tháng {previous_month}; áp dụng giống nhau cho tất cả tài xế.")

    scores = calculate_driver_scores(df, month, config)
    if scores.empty:
        st.warning("Không có dữ liệu tài xế trong tháng đã chọn.")
        return

    target_km = float(scores["target_distance_km"].iloc[0])
    target_trips = float(scores["target_trips"].iloc[0])
    target_hours = float(scores["target_hours"].iloc[0])
    st.markdown(
        f"""
        <div style="background:linear-gradient(135deg,#e8f4ff,#f3f9ff);border:2px solid #1683d8;
                    border-radius:12px;padding:16px 20px;margin:10px 0 18px 0;
                    box-shadow:0 2px 8px rgba(22,131,216,.12)">
          <div style="font-weight:700;color:#075985;font-size:1.05rem;margin-bottom:8px">
            🎯 KPI áp dụng chung cho tháng {month}
          </div>
          <div style="display:flex;gap:28px;flex-wrap:wrap;font-size:1.08rem;color:#0f3557">
            <span><b>{target_km:,.1f}</b> km</span>
            <span><b>{target_trips:,.1f}</b> chuyến</span>
            <span><b>{target_hours:,.1f}</b> giờ lái</span>
          </div>
          <div style="font-size:.86rem;color:#526779;margin-top:8px">
            Tính từ bình quân toàn đội của tháng trước và áp dụng giống nhau cho tất cả tài xế.
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    complete = int(scores["manual_complete"].sum())
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Tài xế", len(scores))
    c2.metric("Đã chấm đủ", f"{complete}/{len(scores)}")
    c3.metric("Điểm hiệu quả TB", f"{scores['efficiency_score'].mean():.1f}/60")
    official = scores[scores["manual_complete"]]
    c4.metric("Tổng điểm TB", f"{official['total_score'].mean():.1f}/100" if not official.empty else "Chưa có")

    display = scores.rename(columns={
        "driver_name": "Tài xế", "distance_km": "Km", "trips": "Chuyến",
        "hours": "Giờ lái", "efficiency_score": "Hiệu quả /60",
        "vehicle_type": "Nhóm xe",
        "safety": "An toàn /10", "service": "Phục vụ /10",
        "compliance": "Tuân thủ /20", "total_score": "Tổng /100",
        "classification": "Xếp loại",
    })
    columns = ["Tài xế", "Nhóm xe", "Km", "Chuyến", "Giờ lái", "Hiệu quả /60",
               "An toàn /10", "Phục vụ /10", "Tuân thủ /20", "Tổng /100", "Xếp loại"]
    st.dataframe(
        display[columns].style.format({
            "Km": "{:,.1f}", "Giờ lái": "{:,.1f}", "Hiệu quả /60": "{:.1f}",
            "An toàn /10": "{:.1f}", "Phục vụ /10": "{:.1f}",
            "Tuân thủ /20": "{:.1f}", "Tổng /100": "{:.1f}",
        }, na_rep="Chưa chấm"),
        use_container_width=True,
        hide_index=True,
    )

    st.download_button(
        "⬇️ Tải bảng điểm CSV",
        scores.to_csv(index=False).encode("utf-8-sig"),
        file_name=f"danh_gia_tai_xe_{month}.csv",
        mime="text/csv",
    )

    with st.expander("✍️ Nhập 40 điểm an toàn, phục vụ và tuân thủ", expanded=complete < len(scores)):
        editor = scores[["driver_name", "safety", "service", "compliance"]].copy()
        editor["subjective_accident"] = scores.get("subjective_accident", False)
        editor["unauthorized_use"] = scores.get("unauthorized_use", False)
        editor["note"] = scores.get("note", "")
        editor = editor.rename(columns={
            "driver_name": "Tài xế", "safety": "An toàn /10", "service": "Phục vụ /10",
            "compliance": "Tuân thủ /20", "subjective_accident": "Tai nạn chủ quan",
            "unauthorized_use": "Tự ý dùng xe", "note": "Ghi chú",
        })
        # Bọc trong st.form → data_editor KHÔNG reload page khi nhập từng ô.
        # Chỉ khi bấm form_submit_button, toàn bộ giá trị mới được apply + lưu.
        st.caption("💡 Nhập tất cả điểm cho các tài xế, sau đó bấm **Lưu đánh giá tháng** ở cuối để lưu 1 lần.")
        with st.form(key=f"evaluation_form_{month}", clear_on_submit=False):
            edited = st.data_editor(
                editor,
                hide_index=True,
                use_container_width=True,
                disabled=["Tài xế"],
                column_config={
                    "An toàn /10": st.column_config.NumberColumn(min_value=0, max_value=10, step=0.5),
                    "Phục vụ /10": st.column_config.NumberColumn(min_value=0, max_value=10, step=0.5),
                    "Tuân thủ /20": st.column_config.NumberColumn(min_value=0, max_value=20, step=0.5),
                },
                key=f"evaluation_editor_{month}",
            )
            submitted = st.form_submit_button("💾 Lưu đánh giá tháng", type="primary")

        if submitted:
            saved = edited.rename(columns={
                "Tài xế": "driver_name", "An toàn /10": "safety", "Phục vụ /10": "service",
                "Tuân thủ /20": "compliance", "Tai nạn chủ quan": "subjective_accident",
                "Tự ý dùng xe": "unauthorized_use", "Ghi chú": "note",
            })
            try:
                save_manual_scores(saved, month)
                st.success("✅ Đã lưu đánh giá.")
                st.rerun()
            except OSError as exc:
                st.error(f"Không lưu được file đánh giá: {exc}")
