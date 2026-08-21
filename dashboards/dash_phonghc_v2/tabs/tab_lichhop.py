import streamlit as st
import pandas as pd

from data_loader import load_data_from_github, load_processed_data
from utils import create_meeting_pivot_table, create_meeting_charts
from config import render_date_range


def render():
    st.markdown('<div class="tab-header">📅 Quản lý Lịch Họp</div>', unsafe_allow_html=True)

    # ── Fast path: dữ liệu đã xử lý sẵn ──
    processed, is_processed = load_processed_data('lichhop.json')
    if is_processed and processed and processed.get("records"):
        df_meetings = pd.DataFrame(processed["records"])
        df_meetings['datetime'] = pd.to_datetime(df_meetings['datetime'])
    else:
        # ── Slow path: load raw JSON rồi xử lý ──
        df_meetings = load_data_from_github('lichhop.json')

        if df_meetings is not None:
            # Xử lý dữ liệu
            if 'datetime' not in df_meetings.columns:
                if all(col in df_meetings.columns for col in ['year', 'month', 'date']):
                    df_meetings['datetime'] = pd.to_datetime(df_meetings[['year', 'month', 'date']].rename(columns={'date': 'day'}))
                elif all(col in df_meetings.columns for col in ['Year', 'Month', 'Date']):
                    df_meetings['datetime'] = pd.to_datetime(df_meetings[['Year', 'Month', 'Date']].rename(columns={'Date': 'day'}))

            # Thêm các cột cần thiết
            df_meetings['weekday'] = df_meetings['datetime'].dt.day_name()
            df_meetings['weekday_vi'] = df_meetings['weekday'].map({
                'Monday': 'Thứ 2', 'Tuesday': 'Thứ 3', 'Wednesday': 'Thứ 4',
                'Thursday': 'Thứ 5', 'Friday': 'Thứ 6', 'Saturday': 'Thứ 7', 'Sunday': 'Chủ nhật'
            })
            df_meetings['year'] = df_meetings['datetime'].dt.year
            df_meetings['month'] = df_meetings['datetime'].dt.month
            df_meetings['week'] = df_meetings['datetime'].dt.isocalendar().week

            # Thêm cột day_type dựa trên weekday
            df_meetings['day_type'] = df_meetings['weekday'].map({
                'Monday': 'Ngày làm việc', 'Tuesday': 'Ngày làm việc', 'Wednesday': 'Ngày làm việc',
                'Thursday': 'Ngày làm việc', 'Friday': 'Ngày làm việc',
                'Saturday': 'Cuối tuần', 'Sunday': 'Cuối tuần'
            })

            # Đảm bảo cột meeting_schedules tồn tại
            if 'meeting_schedules' not in df_meetings.columns:
                df_meetings['meeting_schedules'] = 0

            # Thêm cột meeting_level dựa trên số lượng meeting_schedules
            df_meetings['meeting_level'] = df_meetings['meeting_schedules'].apply(lambda x:
                'Rất ít' if x <= 2 else
                'Ít' if x <= 5 else
                'Trung bình' if x <= 10 else
                'Nhiều' if x <= 20 else
                'Rất nhiều'
            )

    if df_meetings is not None:

        # Đảm bảo cột day_type tồn tại (có thể thiếu khi dùng fast path)
        if 'day_type' not in df_meetings.columns:
            weekend_days = ['Thứ 7', 'Chủ nhật']
            df_meetings['day_type'] = df_meetings['weekday_vi'].apply(
                lambda x: 'Cuối tuần' if x in weekend_days else 'Ngày làm việc'
            )

        render_date_range(df_meetings)

        # Thống kê tổng quan
        st.markdown("### 📊 Thống kê tổng quan lịch họp")

        col1, col2, col3, col4, col5 = st.columns(5)

        with col1:
            total_meetings = df_meetings['meeting_schedules'].sum()
            st.metric("📅 Tổng cuộc họp", f"{int(total_meetings):,}")

        with col2:
            avg_daily = df_meetings['meeting_schedules'].mean()
            st.metric("📈 TB/ngày", f"{avg_daily:.1f}")

        with col3:
            max_day = df_meetings['meeting_schedules'].max()
            st.metric("🔥 Nhiều nhất", f"{max_day} cuộc")

        with col4:
            min_day = df_meetings['meeting_schedules'].min()
            st.metric("🔻 Ít nhất", f"{min_day} cuộc")

        with col5:
            total_days = len(df_meetings)
            st.metric("📆 Tổng ngày", f"{total_days} ngày")

        # Hàng 2: Thống kê theo loại ngày
        st.markdown("#### 📋 Phân tích theo loại ngày")
        col1, col2, col3 = st.columns(3)

        workday_data = df_meetings[df_meetings['day_type'] == 'Ngày làm việc']
        weekend_data = df_meetings[df_meetings['day_type'] == 'Cuối tuần']

        with col1:
            workday_total = workday_data['meeting_schedules'].sum()
            workday_count = len(workday_data)
            st.metric("💼 Ngày làm việc", f"{workday_total} cuộc", f"{workday_count} ngày")

        with col2:
            weekend_total = weekend_data['meeting_schedules'].sum()
            weekend_count = len(weekend_data)
            st.metric("🏠 Cuối tuần", f"{weekend_total} cuộc", f"{weekend_count} ngày")

        with col3:
            busy_days = len(df_meetings[df_meetings['meeting_schedules'] > 10])
            st.metric("🔥 Ngày bận rộn", f"{busy_days} ngày", ">10 cuộc")

        st.markdown("---")

        # Pivot Table
        selected_period_type_meetings = create_meeting_pivot_table(df_meetings)

        st.markdown("---")

        # Tab định nghĩa mức độ bận rộn
        with st.expander("ℹ️ Định nghĩa mức độ bận rộn"):
            st.markdown("""
            #### 📊 Phân loại mức độ hoạt động lịch họp:

            | Mức độ | Số cuộc họp/ngày | Mô tả |
            |--------|------------------|-------|
            | 🟢 **Rất ít** | 0-2 cuộc | Ngày làm việc bình thường, ít hoạt động họp |
            | 🔵 **Ít** | 3-5 cuộc | Ngày có một số cuộc họp, mức độ vừa phải |
            | 🟡 **Trung bình** | 6-10 cuộc | Ngày khá bận rộn với nhiều cuộc họp |
            | 🟠 **Nhiều** | 11-20 cuộc | Ngày rất bận với mật độ họp cao |
            | 🔴 **Rất nhiều** | >20 cuộc | Ngày cực kỳ bận rộn, liên tục các cuộc họp |

            ---
            #### 📈 Các chỉ số quan trọng:
            - **Ngày bận rộn**: Ngày có >5 cuộc họp (từ mức Trung bình trở lên)
            - **Tỷ lệ ngày bận**: % ngày trong kỳ có >5 cuộc họp
            - **Xu hướng**: So sánh với kỳ trước để theo dõi biến động
            """)

        # Biểu đồ
        create_meeting_charts(df_meetings, selected_period_type_meetings)

        st.markdown("---")

        # Bảng dữ liệu chi tiết
        st.markdown("### 📋 Chi tiết dữ liệu lịch họp")

        # Lọc dữ liệu
        col1, col2 = st.columns(2)
        with col1:
            min_meetings = st.number_input("📊 Số cuộc họp tối thiểu", min_value=0, value=0, key="meetings_min")
        with col2:
            selected_level = st.selectbox(
                "📅 Mức độ bận rộn",
                options=['Tất cả'] + list(df_meetings['meeting_level'].unique()),
                key="meeting_level_filter"
            )

        # Áp dụng filter
        filtered_meetings = df_meetings[df_meetings['meeting_schedules'] >= min_meetings]
        if selected_level != 'Tất cả':
            filtered_meetings = filtered_meetings[filtered_meetings['meeting_level'] == selected_level]

        # Hiển thị bảng
        display_cols_meetings = ['datetime', 'weekday_vi', 'meeting_schedules', 'meeting_level', 'day_type']

        st.dataframe(
            filtered_meetings[display_cols_meetings].rename(columns={
                'datetime': 'Ngày',
                'weekday_vi': 'Ngày trong tuần',
                'meeting_schedules': 'Số cuộc họp',
                'meeting_level': 'Mức độ bận rộn',
                'day_type': 'Loại ngày'
            }),
            use_container_width=True
        )

        # Thống kê cuối
        st.markdown("**📊 Insights chính:**")
        insights = []

        if len(df_meetings) > 0:
            busiest_day = df_meetings.loc[df_meetings['meeting_schedules'].idxmax()]
            insights.append(f"🔥 Ngày bận rộn nhất: {busiest_day['datetime'].strftime('%d/%m/%Y')} ({busiest_day['weekday_vi']}) với {busiest_day['meeting_schedules']} cuộc họp")

            quietest_day = df_meetings.loc[df_meetings['meeting_schedules'].idxmin()]
            insights.append(f"🔻 Ngày ít họp nhất: {quietest_day['datetime'].strftime('%d/%m/%Y')} ({quietest_day['weekday_vi']}) với {quietest_day['meeting_schedules']} cuộc họp")

            most_common_level = df_meetings['meeting_level'].mode()[0] if len(df_meetings['meeting_level'].mode()) > 0 else 'Không xác định'
            insights.append(f"📊 Mức độ phổ biến nhất: {most_common_level}")

            for insight in insights:
                st.write(f"- {insight}")
    else:
        st.warning("⚠️ Chưa có dữ liệu lịch họp. Vui lòng kiểm tra kết nối GitHub.")
