import streamlit as st
import os
import base64


def apply_css():
    """Apply all CSS styles"""
    st.markdown("""
<style>
.main-header {
    font-size: 2.5rem;
    font-weight: bold;
    color: #1f77b4;
    text-align: center;
    margin-bottom: 2rem;
}

/* ── Metric cards nổi bật ── */
[data-testid="metric-container"] {
    background: linear-gradient(135deg, #ffffff 0%, #f8faff 100%);
    border: 1px solid #e0e8f0;
    border-left: 5px solid #1f77b4;
    border-radius: 12px;
    padding: 20px 18px !important;
    box-shadow: 0 2px 8px rgba(31,119,180,0.10);
    transition: box-shadow 0.2s;
}
[data-testid="metric-container"]:hover {
    box-shadow: 0 4px 16px rgba(31,119,180,0.18);
}
[data-testid="metric-container"] [data-testid="stMetricLabel"] {
    font-size: 0.92rem !important;
    font-weight: 600 !important;
    color: #5a6a7a !important;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
[data-testid="metric-container"] [data-testid="stMetricValue"] {
    font-size: 2.2rem !important;
    font-weight: 800 !important;
    color: #1a2a3a !important;
    line-height: 1.15 !important;
}
[data-testid="metric-container"] [data-testid="stMetricDelta"] {
    font-size: 0.9rem !important;
    font-weight: 600 !important;
}

/* ── Date range chip ── */
.date-range-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #eef4fd;
    border: 1px solid #b8d4f5;
    border-radius: 20px;
    padding: 5px 14px;
    margin-bottom: 14px;
    color: #2c5282;
    font-size: 0.85rem;
    font-weight: 500;
}

.metric-container {
    background-color: #f0f2f6;
    padding: 1rem;
    border-radius: 10px;
    border-left: 4px solid #1f77b4;
}
.tab-header {
    font-size: 1.8rem;
    font-weight: bold;
    color: #2c3e50;
    margin-bottom: 1rem;
}

/* Centered header container and text */
.header-container {
    text-align: center;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin-bottom: 2rem;
}
.header-text {
    font-size: 3.2rem;
    font-weight: bold;
    color: #1f77b4;
    text-align: center;
    margin-top: 0.5rem;
}

.pivot-table {
    font-size: 16px !important;
    font-weight: 500;
}
.pivot-table td {
    padding: 12px 8px !important;
    text-align: center !important;
}
.pivot-table th {
    padding: 15px 8px !important;
    text-align: center !important;
    background-color: #f0f2f6 !important;
    font-weight: bold !important;
    font-size: 17px !important;
}
.increase { color: #28a745 !important; font-weight: bold; }
.decrease { color: #dc3545 !important; font-weight: bold; }
.neutral { color: #6c757d !important; }
.new-period { color: #007bff !important; font-weight: bold; }
</style>
""", unsafe_allow_html=True)


def render_date_range(df, date_col='datetime', record_label='ngày'):
    """Hiển thị banner khoảng thời gian dữ liệu — dùng chung cho tất cả tab."""
    if df is None or df.empty or date_col not in df.columns:
        return
    try:
        import pandas as pd
        dates = pd.to_datetime(df[date_col])
        date_min = dates.min().strftime('%d/%m/%Y')
        date_max = dates.max().strftime('%d/%m/%Y')
        n = len(df)
        st.markdown(f"""
<div class="date-range-chip">
    📅 &nbsp;{date_min}&nbsp; — &nbsp;{date_max}
</div>
""", unsafe_allow_html=True)
    except Exception:
        pass


def render_header():
    """Render header with logo"""
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # Go up one level to find logo in parent directory
        parent_dir = os.path.dirname(script_dir)
        logo_base64 = ""
        for p in [
            os.path.join(parent_dir, "logo.png"),
            os.path.join(parent_dir, "assets", "logo.png"),
            os.path.join(script_dir, "logo.png"),
            os.path.join(script_dir, "assets", "logo.png"),
        ]:
            if os.path.exists(p):
                with open(p, "rb") as f:
                    logo_base64 = base64.b64encode(f.read()).decode()
                break
    except Exception:
        logo_base64 = ""

    if logo_base64:
        logo_html = f"<img src='data:image/png;base64,{logo_base64}' style='height:80px; width:auto;' />"
    else:
        logo_html = "<span style='font-size:80px;'>🏢</span>"

    st.markdown(f"""
<div class="header-container">
    {logo_html}
    <div class="header-text" style="margin-left: 20px;">
        Dashboard Phòng Hành chính
    </div>
</div>
""", unsafe_allow_html=True)
