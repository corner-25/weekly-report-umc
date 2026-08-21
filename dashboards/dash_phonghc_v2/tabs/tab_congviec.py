import streamlit as st
import pandas as pd

from data_loader import load_data_from_github, load_processed_data
from utils import create_task_pivot_table, create_task_management_charts
from config import render_date_range


def render():
    st.markdown('<div class="tab-header">📋 Quản lý Công Việc</div>', unsafe_allow_html=True)

    # ── Fast path: dữ liệu đã xử lý sẵn ──
    processed, is_processed = load_processed_data('congviec.json')
    if is_processed and processed and processed.get("all_dept_records"):
        df_all_tasks = pd.DataFrame(processed["all_dept_records"])
        df_all_tasks['datetime'] = pd.to_datetime(df_all_tasks['datetime'])
        if processed.get("dept_detail_records"):
            df_detail_tasks = pd.DataFrame(processed["dept_detail_records"])
            df_detail_tasks['datetime'] = pd.to_datetime(df_detail_tasks['datetime'])
        else:
            df_detail_tasks = pd.DataFrame()
    else:
        # ── Slow path: load raw JSON rồi xử lý ──
        df = load_data_from_github('congviec.json')

        if df is not None:
            # Flatten nested structure từ all_departments
            for index, row in df.iterrows():
                if 'all_departments' in row and isinstance(row['all_departments'], dict):
                    all_dept = row['all_departments']
                    df.loc[index, 'tasks_assigned'] = all_dept.get('tasks_assigned', 0)
                    df.loc[index, 'tasks_completed_on_time'] = all_dept.get('tasks_completed_on_time', 0)
                    df.loc[index, 'tasks_completed_on_time_rate'] = all_dept.get('tasks_completed_on_time_rate', 0)
                    df.loc[index, 'tasks_new'] = all_dept.get('tasks_new', 0)
                    df.loc[index, 'tasks_new_rate'] = all_dept.get('tasks_new_rate', 0)
                    df.loc[index, 'tasks_processing'] = all_dept.get('tasks_processing', 0)
                    df.loc[index, 'tasks_processing_rate'] = all_dept.get('tasks_processing_rate', 0)

            # Xử lý datetime
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

            # Đảm bảo các cột task tồn tại với giá trị mặc định
            task_columns = ['tasks_assigned', 'tasks_completed_on_time', 'tasks_completed_on_time_rate',
                           'tasks_new', 'tasks_new_rate', 'tasks_processing', 'tasks_processing_rate']
            for col in task_columns:
                if col not in df.columns:
                    df[col] = 0

            # Tính completion_rate cho mỗi hàng
            df['completion_rate'] = df.apply(lambda row:
                (row['tasks_completed_on_time'] / row['tasks_assigned'] * 100)
                if row['tasks_assigned'] > 0 else 0, axis=1)

            # Tạo DataFrame riêng cho detail_departments
            detail_rows = []
            for index, row in df.iterrows():
                if 'detail_departments' in row and isinstance(row['detail_departments'], list):
                    for dept in row['detail_departments']:
                        if isinstance(dept, dict):
                            detail_row = {
                                'Date': row.get('Date', row.get('date', '')),
                                'Month': row.get('Month', row.get('month', '')),
                                'Year': row.get('Year', row.get('year', '')),
                                'datetime': row.get('datetime', ''),
                                'weekday': row.get('weekday', ''),
                                'weekday_vi': row.get('weekday_vi', ''),
                                'year': row.get('year', ''),
                                'month': row.get('month', ''),
                                'week': row.get('week', ''),
                                'department': dept.get('Name', ''),
                                'tasks_assigned': dept.get('tasks_assigned', 0),
                                'tasks_completed_on_time': dept.get('tasks_completed_on_time', 0),
                                'tasks_completed_on_time_rate': dept.get('tasks_completed_on_time_rate', 0),
                                'tasks_new': dept.get('tasks_new', 0),
                                'tasks_new_rate': dept.get('tasks_new_rate', 0),
                                'tasks_processing': dept.get('tasks_processing', 0),
                                'tasks_processing_rate': dept.get('tasks_processing_rate', 0)
                            }
                            detail_rows.append(detail_row)

            # Return both dataframes
            df_all_tasks = df
            if detail_rows:
                df_detail_tasks = pd.DataFrame(detail_rows)
                # Tính completion_rate cho detail
                df_detail_tasks['completion_rate'] = df_detail_tasks.apply(lambda row:
                    (row['tasks_completed_on_time'] / row['tasks_assigned'] * 100)
                    if row['tasks_assigned'] > 0 else 0, axis=1)
            else:
                df_detail_tasks = pd.DataFrame()
        else:
            df_all_tasks = None
            df_detail_tasks = None

    if df_all_tasks is not None and df_detail_tasks is not None:

        render_date_range(df_all_tasks)

        # Thống kê tổng quan
        st.markdown("### 📊 Thống kê tổng quan công việc")

        # Hàng 1: Thống kê chính
        col1, col2, col3, col4, col5 = st.columns(5)

        with col1:
            total_assigned = df_all_tasks['tasks_assigned'].sum()
            st.metric("📋 Tổng giao việc", total_assigned)

        with col2:
            total_completed = df_all_tasks['tasks_completed_on_time'].sum()
            st.metric("✅ Hoàn thành", total_completed)

        with col3:
            total_processing = df_all_tasks['tasks_processing'].sum()
            st.metric("🔄 Đang xử lý", total_processing)

        with col4:
            total_new = df_all_tasks['tasks_new'].sum()
            st.metric("🆕 Việc mới", total_new)

        with col5:
            # Tính tỷ lệ hoàn thành: (completed / assigned) * 100
            total_assigned_all = df_all_tasks['tasks_assigned'].sum()
            total_completed_all = df_all_tasks['tasks_completed_on_time'].sum()
            if total_assigned_all > 0:
                avg_completion = (total_completed_all / total_assigned_all) * 100
                st.metric("📊 Tỷ lệ hoàn thành", f"{avg_completion:.1f}%")
            else:
                st.metric("📊 Tỷ lệ hoàn thành", "0%")

        # Hàng 2: Thống kê phòng ban
        st.markdown("#### 📋 Thống kê theo phòng ban")
        if len(df_detail_tasks) > 0:
            dept_summary = df_detail_tasks.groupby('department').agg({
                'tasks_assigned': 'sum',
                'tasks_completed_on_time': 'sum',
                'tasks_processing': 'sum',
                'tasks_new': 'sum'
            }).reset_index()
            dept_summary['completion_rate'] = (dept_summary['tasks_completed_on_time'] / dept_summary['tasks_assigned'] * 100).fillna(0)

            # Top 3 phòng ban theo tổng số công việc được giao
            top_depts = dept_summary.nlargest(3, 'tasks_assigned')

            col1, col2, col3 = st.columns(3)
            for i, (idx, dept) in enumerate(top_depts.iterrows()):
                with [col1, col2, col3][i]:
                    completion_rate = (dept['tasks_completed_on_time'] / dept['tasks_assigned'] * 100) if dept['tasks_assigned'] > 0 else 0
                    st.metric(f"🏆 {dept['department']}",
                            f"{dept['tasks_completed_on_time']}/{dept['tasks_assigned']} việc",
                            f"Tỷ lệ: {completion_rate:.1f}%")

        st.markdown("---")

        # Pivot Table
        selected_period_type_tasks = create_task_pivot_table(df_all_tasks, df_detail_tasks)

        st.markdown("---")

        # Biểu đồ
        create_task_management_charts(df_all_tasks, df_detail_tasks, selected_period_type_tasks)

        # Bảng dữ liệu chi tiết
        st.markdown("### 📋 Chi tiết dữ liệu")

        # Chọn loại dữ liệu hiển thị
        detail_type = st.selectbox(
            "📊 Hiển thị dữ liệu:",
            options=['Tổng hợp tất cả phòng ban', 'Chi tiết từng phòng ban'],
            key="task_detail_type"
        )

        display_df = df_all_tasks if detail_type == 'Tổng hợp tất cả phòng ban' else df_detail_tasks

        # Lọc thêm theo số việc tối thiểu
        min_tasks = st.number_input("📊 Số việc tối thiểu", min_value=0, value=0, key="tasks_min")
        filtered_df_tasks = display_df[display_df['tasks_assigned'] >= min_tasks]

        # Các cột hiển thị
        display_cols_tasks = ['datetime', 'tasks_assigned', 'tasks_completed_on_time',
                             'tasks_processing', 'tasks_new', 'completion_rate']

        if detail_type == 'Chi tiết từng phòng ban':
            display_cols_tasks.insert(1, 'department')

        # Format completion_rate
        filtered_df_display = filtered_df_tasks[display_cols_tasks].copy()
        filtered_df_display['completion_rate'] = filtered_df_display['completion_rate'].round(1)

        st.dataframe(
            filtered_df_display.rename(columns={
                'datetime': 'Ngày',
                'department': 'Phòng ban',
                'tasks_assigned': 'Giao việc',
                'tasks_completed_on_time': 'Hoàn thành',
                'tasks_processing': 'Đang xử lý',
                'tasks_new': 'Việc mới',
                'completion_rate': 'Tỷ lệ hoàn thành (%)'
            }),
            use_container_width=True
        )
    else:
        st.warning("⚠️ Chưa có dữ liệu công việc. Vui lòng kiểm tra kết nối GitHub.")
