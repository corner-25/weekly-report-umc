import streamlit as st
import pandas as pd

from data_loader import load_data_from_github, load_processed_data
from utils import create_pivot_table, create_incoming_docs_charts
from config import render_date_range


def render():
    st.markdown('<div class="tab-header">📥 Quản lý Văn bản Đến</div>', unsafe_allow_html=True)

    # ── Fast path: dữ liệu đã xử lý sẵn ──
    processed, is_processed = load_processed_data('vanbanden.json')
    if is_processed and processed and processed.get("records"):
        df = pd.DataFrame(processed["records"])
        df['datetime'] = pd.to_datetime(df['datetime'])
    else:
        # ── Slow path: load raw JSON rồi xử lý ──
        df = load_data_from_github('vanbanden.json')

        if df is not None:
            # Xử lý dữ liệu
            if 'datetime' not in df.columns:
                if all(col in df.columns for col in ['year', 'month', 'date']):
                    df['datetime'] = pd.to_datetime(df[['year', 'month', 'date']].rename(columns={'date': 'day'}))
                elif all(col in df.columns for col in ['Year', 'Month', 'Date']):
                    df['datetime'] = pd.to_datetime(df[['Year', 'Month', 'Date']].rename(columns={'Date': 'day'}))

            # Thêm các cột cần thiết
            df['weekday'] = df['datetime'].dt.day_name()
            df['weekday_vi'] = df['weekday'].map({
                'Monday': 'Thứ 2', 'Tuesday': 'Thứ 3', 'Wednesday': 'Thứ 4',
                'Thursday': 'Thứ 5', 'Friday': 'Thứ 6', 'Saturday': 'Thứ 7', 'Sunday': 'Chủ nhật'
            })
            df['year'] = df['datetime'].dt.year
            df['month'] = df['datetime'].dt.month
            df['week'] = df['datetime'].dt.isocalendar().week

    if df is not None:

        render_date_range(df)

        # Thống kê tổng quan
        st.markdown("### 📊 Thống kê tổng quan")

        # Hàng 1: Thống kê chính
        col1, col2, col3, col4, col5 = st.columns(5)

        with col1:
            total_docs = df['total_incoming'].sum()
            st.metric("📑 Tổng văn bản", f"{int(total_docs):,}")

        with col2:
            avg_daily = df['total_incoming'].mean()
            st.metric("📈 Trung bình/ngày", f"{avg_daily:.1f}")

        with col3:
            total_on_time = df['processed_on_time'].sum()
            st.metric("✅ Xử lý đúng hạn", f"{int(total_on_time):,}")

        with col4:
            total_late = df['processed_late'].sum()
            st.metric("⚠️ Xử lý trễ hạn", f"{int(total_late):,}")

        with col5:
            if total_docs > 0:
                on_time_rate = (total_on_time / total_docs) * 100
            else:
                on_time_rate = 0
            st.metric("📊 Tỷ lệ đúng hạn", f"{on_time_rate:.1f}%")

        # Hàng 2: Phân loại phản hồi
        st.markdown("#### 📋 Phân loại theo yêu cầu phản hồi")
        col1, col2, col3, col4, col5 = st.columns(5)

        with col1:
            no_response = df['no_response_required'].sum()
            st.metric("🔕 Không cần phản hồi", f"{int(no_response):,}")

        with col2:
            need_response = df['response_required'].sum()
            st.metric("📢 Cần phản hồi", f"{int(need_response):,}")

        with col3:
            vanban_response = df['response_required_VanBan'].sum()
            st.metric("📄 PH Văn bản", f"{int(vanban_response):,}")

        with col4:
            email_response = df['response_required_Email'].sum()
            st.metric("📧 PH Email", f"{int(email_response):,}")

        with col5:
            phone_response = df['response_required_DienThoai'].sum()
            st.metric("📞 PH Điện thoại", f"{int(phone_response):,}")

        st.markdown("---")

        # Pivot Table
        selected_period_type = create_pivot_table(df)

        st.markdown("---")

        # Biểu đồ
        create_incoming_docs_charts(df, selected_period_type)

        # Bảng dữ liệu chi tiết
        st.markdown("### 📋 Chi tiết dữ liệu")

        # Lọc dữ liệu
        col1, col2 = st.columns(2)
        with col1:
            date_range = st.date_input(
                "📅 Chọn khoảng thời gian",
                value=(df['datetime'].min(), df['datetime'].max()),
                min_value=df['datetime'].min(),
                max_value=df['datetime'].max()
            )

        with col2:
            min_docs = st.number_input("📊 Số văn bản tối thiểu", min_value=0, value=0)

        # Áp dụng filter
        if len(date_range) == 2:
            filtered_df = df[
                (df['datetime'] >= pd.to_datetime(date_range[0])) &
                (df['datetime'] <= pd.to_datetime(date_range[1])) &
                (df['total_incoming'] >= min_docs)
            ]
        else:
            filtered_df = df[df['total_incoming'] >= min_docs]

        display_cols = ['datetime', 'total_incoming', 'no_response_required', 'response_required',
                        'processed_on_time', 'processed_late']

        # Thêm các cột phản hồi nếu có
        response_cols = ['response_required_VanBan', 'response_required_Email',
                         'response_required_DienThoai', 'response_required_PhanMem']
        for col in response_cols:
            if col in filtered_df.columns:
                display_cols.append(col)

        # Thêm cột detail nếu có
        if 'total_incoming_detail' in filtered_df.columns:
            display_cols.append('total_incoming_detail')

        st.dataframe(filtered_df[display_cols], use_container_width=True)
    else:
        st.warning("⚠️ Chưa có dữ liệu văn bản đến. Vui lòng kiểm tra kết nối GitHub.")
