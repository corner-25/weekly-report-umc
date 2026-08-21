import streamlit as st
import pandas as pd

from data_loader import load_data_from_github, load_processed_data
from utils import create_room_pivot_table, create_room_charts
from config import render_date_range


def render():
    st.markdown('<div class="tab-header">🏢 Quản lý Phòng Họp</div>', unsafe_allow_html=True)

    # ── Fast path: dữ liệu đã xử lý sẵn ──
    processed, is_processed = load_processed_data('phonghop.json')
    if is_processed and processed and processed.get("records"):
        df_rooms = pd.DataFrame(processed["records"])
        df_rooms['datetime'] = pd.to_datetime(df_rooms['datetime'])
    else:
        # ── Slow path: load raw JSON rồi xử lý ──
        df_rooms = load_data_from_github('phonghop.json')

        if df_rooms is not None:
            # Tạo cột datetime
            df_rooms['datetime'] = pd.to_datetime(df_rooms[['Year', 'Month', 'Date']].rename(columns={'Date': 'day'}))
            df_rooms['weekday'] = df_rooms['datetime'].dt.day_name()
            df_rooms['weekday_vi'] = df_rooms['weekday'].map({
                'Monday': 'Thứ 2', 'Tuesday': 'Thứ 3', 'Wednesday': 'Thứ 4',
                'Thursday': 'Thứ 5', 'Friday': 'Thứ 6', 'Saturday': 'Thứ 7', 'Sunday': 'Chủ nhật'
            })
            df_rooms['month_vi'] = df_rooms['Month'].map({
                1: 'Tháng 1', 2: 'Tháng 2', 3: 'Tháng 3', 4: 'Tháng 4',
                5: 'Tháng 5', 6: 'Tháng 6', 7: 'Tháng 7', 8: 'Tháng 8',
                9: 'Tháng 9', 10: 'Tháng 10', 11: 'Tháng 11', 12: 'Tháng 12'
            })

            # Tính toán các chỉ số
            df_rooms['cancel_rate'] = (df_rooms['register_room_cancel'] / df_rooms['register_room'] * 100).fillna(0).round(1)
            df_rooms['net_bookings'] = df_rooms['register_room'] - df_rooms['register_room_cancel']
            df_rooms['is_weekend'] = df_rooms['weekday'].isin(['Saturday', 'Sunday'])
            df_rooms['day_type'] = df_rooms['is_weekend'].map({False: 'Ngày làm việc', True: 'Cuối tuần'})


    if df_rooms is not None and not df_rooms.empty:

        # Đảm bảo các cột tính toán tồn tại (có thể thiếu khi dùng fast path)
        if 'day_type' not in df_rooms.columns:
            weekend_days = ['Thứ 7', 'Chủ nhật']
            df_rooms['day_type'] = df_rooms['weekday_vi'].apply(
                lambda x: 'Cuối tuần' if x in weekend_days else 'Ngày làm việc'
            )

        render_date_range(df_rooms)

        # Metrics tổng quan
        col1, col2, col3, col4 = st.columns(4)

        total_bookings = df_rooms['register_room'].sum()
        total_cancels = df_rooms['register_room_cancel'].sum()
        avg_daily = df_rooms['register_room'].mean()
        cancel_rate_avg = (total_cancels / total_bookings * 100) if total_bookings > 0 else 0

        with col1:
            st.metric("📅 Tổng đăng ký", f"{int(total_bookings):,}")
        with col2:
            st.metric("❌ Tổng hủy", f"{int(total_cancels):,}")
        with col3:
            st.metric("📊 TB/ngày", f"{avg_daily:.1f}")
        with col4:
            st.metric("📉 Tỷ lệ hủy", f"{cancel_rate_avg:.1f}%")

        st.markdown("---")

        # Pivot Table
        selected_period_type_rooms = create_room_pivot_table(df_rooms)

        st.markdown("---")

        # Biểu đồ
        create_room_charts(df_rooms, selected_period_type_rooms)

        st.markdown("---")

        # Bảng dữ liệu chi tiết
        st.markdown("### 📋 Chi tiết dữ liệu phòng họp")

        # Lọc dữ liệu
        col1, col2 = st.columns(2)
        with col1:
            min_bookings = st.number_input("📊 Số đăng ký tối thiểu", min_value=0, value=0, key="rooms_min")
        with col2:
            selected_day_type = st.selectbox(
                "📅 Loại ngày",
                options=['Tất cả'] + list(df_rooms['day_type'].unique()),
                key="room_day_type_filter"
            )

        # Áp dụng filter
        filtered_rooms = df_rooms[df_rooms['register_room'] >= min_bookings]
        if selected_day_type != 'Tất cả':
            filtered_rooms = filtered_rooms[filtered_rooms['day_type'] == selected_day_type]

        # Hiển thị bảng
        display_cols_rooms = ['datetime', 'weekday_vi', 'register_room', 'register_room_cancel', 'net_bookings', 'cancel_rate', 'day_type']

        st.dataframe(
            filtered_rooms[display_cols_rooms].rename(columns={
                'datetime': 'Ngày',
                'weekday_vi': 'Ngày trong tuần',
                'register_room': 'Tổng đăng ký',
                'register_room_cancel': 'Tổng hủy',
                'net_bookings': 'Đăng ký thực',
                'cancel_rate': 'Tỷ lệ hủy (%)',
                'day_type': 'Loại ngày'
            }),
            use_container_width=True
        )
    else:
        st.warning("⚠️ Chưa có dữ liệu phòng họp. Vui lòng kiểm tra kết nối GitHub.")
