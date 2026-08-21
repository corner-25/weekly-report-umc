import streamlit as st
import pandas as pd
import os
import sys
import base64

# Thêm cả thư mục gốc và thư mục dash_phonghc_v2 vào sys.path
_this_dir = os.path.dirname(os.path.abspath(__file__))   # .../dash_phonghc_v2
_root_dir = os.path.dirname(_this_dir)                    # .../dashboard-chung
for _p in [_root_dir, _this_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from config import apply_css
from data_loader import GitHubDataManager, DataManager
from tabs import (
    tab_tongquan, tab_vbden, tab_vbdi,
    tab_toxe, tab_tongdai, tab_thuky, tab_baixe, tab_sukien,
    tab_congviec, tab_lichhop, tab_phonghop, tab_khac,
)

def main():
    """Entry point cho dashboard Phòng Hành chính v2"""
    pd.set_option('future.no_silent_downcasting', True)

    apply_css()

    # ── Khởi tạo managers ───────────────────────────────────────────
    if 'data_manager' not in st.session_state:
        st.session_state['data_manager'] = DataManager()
    if 'github_manager' not in st.session_state:
        st.session_state['github_manager'] = GitHubDataManager()

    data_manager = st.session_state['data_manager']
    github_manager = st.session_state['github_manager']

    # ════════════════════════════════════════════════════════════════
    # SIDEBAR
    # ════════════════════════════════════════════════════════════════

    # ── 1. Trạng thái GitHub ─────────────────────────────────────────
    connected, _ = github_manager.check_github_connection()
    if connected:
        st.sidebar.success("☁️ GitHub: Đã kết nối")
        # Tự động load data từ GitHub vào DataManager khi kết nối OK
        try:
            github_data, github_metadata = github_manager.load_current_data()
            if github_data is not None and github_metadata:
                data_manager.load_data_from_github(github_data, github_metadata)
        except Exception:
            pass
    else:
        st.sidebar.warning("☁️ GitHub: Chưa kết nối — Kiểm tra secrets")

    st.sidebar.markdown("---")

    # ── 2. Upload file thủ công ──────────────────────────────────────
    st.sidebar.markdown("### 📂 Upload dữ liệu")
    st.sidebar.caption("Dành cho tab: Tổ xe, Tổng đài, Thư ký, Bãi xe, Sự kiện, Khác")

    uploaded_file = st.sidebar.file_uploader(
        "Chọn file (Excel / CSV / JSON)",
        type=['xlsx', 'xls', 'csv', 'json'],
        key="main_upload",
    )

    if uploaded_file is not None:
        success, message = data_manager.load_data_from_file(uploaded_file)
        if success:
            st.sidebar.success(f"✅ {uploaded_file.name}")
            meta = data_manager.metadata or {}
            rows = meta.get('rows', 0)
            cats = meta.get('categories', [])
            st.sidebar.caption(f"{rows:,} dòng" + (f" · {len(cats)} danh mục" if cats else ""))
            if cats:
                with st.sidebar.expander("Danh mục trong file"):
                    for c in cats:
                        st.write(f"- {c}")
        else:
            st.sidebar.error(message)

    # Hiển thị trạng thái dữ liệu hiện tại
    if data_manager.data is not None and data_manager.metadata:
        meta = data_manager.metadata
        ftype = meta.get('file_type', '')
        fname = meta.get('filename', '')
        if ftype == 'GitHub' or meta.get('source') == 'GitHub':
            st.sidebar.info(f"☁️ Dữ liệu: {fname}")
        else:
            st.sidebar.info(f"📄 Dữ liệu: {fname}")
        if st.sidebar.button("🗑️ Xóa dữ liệu đã tải", use_container_width=True):
            data_manager.data = None
            data_manager.metadata = None
            st.rerun()
    else:
        st.sidebar.caption("Chưa có dữ liệu upload")

    st.sidebar.markdown("---")

    # ── 4. Refresh cache ─────────────────────────────────────────────
    if st.sidebar.button("🔄 Refresh dữ liệu", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    # ════════════════════════════════════════════════════════════════
    # HEADER
    # ════════════════════════════════════════════════════════════════
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        logo_base64 = ""
        for p in [
            os.path.join(script_dir, "logo.png"),
            os.path.join(script_dir, "assets", "logo.png"),
            os.path.join(os.path.dirname(script_dir), "logo.png"),
            os.path.join(os.path.dirname(script_dir), "assets", "logo.png"),
        ]:
            if os.path.exists(p):
                with open(p, "rb") as f:
                    logo_base64 = base64.b64encode(f.read()).decode()
                break
    except Exception:
        logo_base64 = ""

    logo_html = (
        f"<img src='data:image/png;base64,{logo_base64}' style='height:80px; width:auto;' />"
        if logo_base64 else "<span style='font-size:80px;'>🏢</span>"
    )

    st.markdown(f"""
    <div class="header-container">
        {logo_html}
        <div class="header-text" style="margin-left: 20px;">
            Dashboard Phòng Hành chính
        </div>
    </div>
    """, unsafe_allow_html=True)

    # ── CSS 2 hàng tab ───────────────────────────────────────────────
    st.markdown("""
    <style>
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
    }
    .stTabs [data-baseweb="tab"] {
        height: auto;
        white-space: nowrap;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
    }
    </style>
    """, unsafe_allow_html=True)

    # ════════════════════════════════════════════════════════════════
    # 12 TABS
    # ════════════════════════════════════════════════════════════════
    tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8, tab9, tab10, tab11, tab12 = st.tabs([
        "🏠 Tổng quan",
        "📥 VB Đến",
        "📤 VB Đi",
        "🚗 Tổ xe",
        "📞 Tổng đài",
        "👥 Thư ký",
        "🅿️ Bãi xe",
        "🎉 Sự kiện",
        "📋 Công việc",
        "📅 Lịch họp",
        "🏢 Phòng họp",
        "🔗 Khác"
    ])

    with tab1:
        tab_tongquan.render()
    with tab2:
        tab_vbden.render()
    with tab3:
        tab_vbdi.render()
    with tab4:
        tab_toxe.render()
    with tab5:
        tab_tongdai.render()
    with tab6:
        tab_thuky.render()
    with tab7:
        tab_baixe.render()
    with tab8:
        tab_sukien.render()
    with tab9:
        tab_congviec.render()
    with tab10:
        tab_lichhop.render()
    with tab11:
        tab_phonghop.render()
    with tab12:
        tab_khac.render()


if __name__ == "__main__":
    main()
