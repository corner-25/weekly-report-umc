import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import json
from data_loader import load_data_from_github, load_processed_data


# ===== GLOBAL FILTER =====
def compute_summary_metrics():
    """
    Tính toán tất cả 4 metrics cho tab tổng quan một lần và cache kết quả.
    Fast path: dùng pre-processed data nếu có (không cần tính lại).
    Fallback: tính từ raw JSON như cũ.
    """
    # ── Fast path: dữ liệu đã xử lý sẵn ──
    processed, is_processed = load_processed_data('tonghop.json')
    if is_processed and processed and "summary_metrics" in processed:
        return processed["summary_metrics"]

    # ── Slow path: tính từ raw JSON (giữ nguyên) ──
    try:
        metrics = {
            'vb_den': 0,
            'vb_di': 0,
            'cv_processing': 0,
            'cuoc_hop': 0
        }

        # 1. Load tonghop.json để lấy tất cả metrics (văn bản đến, văn bản đi, cuộc họp)
        df_tonghop = load_data_from_github('tonghop.json')
        if df_tonghop is not None:
            # Tính văn bản đến
            vb_den_total = df_tonghop[df_tonghop['category'] == 'Van ban den']['count'].sum()
            metrics['vb_den'] = int(vb_den_total)

            # Tính cuộc họp
            cuoc_hop_total = df_tonghop[df_tonghop['category'] == 'Quan ly phong hop']['count'].sum()
            metrics['cuoc_hop'] = int(cuoc_hop_total)

            # Tính văn bản đi (tất cả các loại văn bản phát hành)
            van_ban_di_categories = [
                'Van ban phat hanh di',           # Văn bản phát hành đi
                'Van ban phat hanh hop dong',     # Hợp đồng
                'Van ban phat hanh quyet dinh',   # Quyết định
                'Van ban phat hanhquy dinh',      # Quy định
                'Van ban phat hanhquy che',       # Quy chế
                'Van ban phat hanhquy trinh',     # Quy trình
                'Van ban phat hanhhuong dan'      # Hướng dẫn
            ]
            vb_di_total = df_tonghop[df_tonghop['category'].isin(van_ban_di_categories)]['count'].sum()
            metrics['vb_di'] = int(vb_di_total)

        # 2. Load congviec.json để tính công việc đang xử lý
        df_cv = load_data_from_github('congviec.json')
        if df_cv is not None:
            total_cv_processing = 0
            for index, row in df_cv.iterrows():
                if 'all_departments' in row and isinstance(row['all_departments'], dict):
                    all_dept = row['all_departments']
                    tasks_processing = all_dept.get('tasks_processing', 0)
                    tasks_new = all_dept.get('tasks_new', 0)
                    total_cv_processing += (tasks_processing + tasks_new)
            metrics['cv_processing'] = int(total_cv_processing)

        return metrics

    except Exception as e:
        st.error(f"❌ Lỗi tính toán metrics: {str(e)}")
        return {
            'vb_den': 0,
            'vb_di': 0,
            'cv_processing': 0,
            'cuoc_hop': 0
        }


# ===== DATA PROCESSING FUNCTIONS =====
def prepare_period_data(df, period_type):
    """Chuẩn bị dữ liệu theo loại period (Ngày/Tuần/Tháng/Quý/Năm)"""
    df_period = df.copy()

    if period_type == 'Tuần':
        df_period['period'] = 'W' + df_period['week'].astype(str) + '-' + df_period['year'].astype(str)
        df_period['period_sort'] = df_period['year'] * 100 + df_period['week']
    elif period_type == 'Tháng':
        df_period['period'] = 'T' + df_period['month'].astype(str) + '-' + df_period['year'].astype(str)
        df_period['period_sort'] = df_period['year'] * 100 + df_period['month']
    elif period_type == 'Quý':
        df_period['quarter'] = ((df_period['month'] - 1) // 3) + 1
        df_period['period'] = 'Q' + df_period['quarter'].astype(str) + '-' + df_period['year'].astype(str)
        df_period['period_sort'] = df_period['year'] * 100 + df_period['quarter']
    elif period_type == 'Năm':
        df_period['period'] = df_period['year'].astype(str)
        df_period['period_sort'] = df_period['year']
    else:  # Ngày
        df_period['period'] = df_period['datetime'].dt.strftime('%d/%m/%Y')
        df_period['period_sort'] = df_period['datetime']

    return df_period


def prepare_chart_period(df, period_type):
    """Chuẩn bị period data cho charts, trả về (df_chart, chart_title_base, x_title)"""
    df_chart = df.copy()

    if period_type == 'Tuần':
        df_chart['period'] = 'W' + df_chart['week'].astype(str) + '-' + df_chart['year'].astype(str)
        df_chart['period_sort'] = df_chart['year'] * 100 + df_chart['week']
        chart_title_base = 'theo tuần'
        x_title = "Tuần"
    elif period_type == 'Tháng':
        df_chart['period'] = 'T' + df_chart['month'].astype(str) + '-' + df_chart['year'].astype(str)
        df_chart['period_sort'] = df_chart['year'] * 100 + df_chart['month']
        chart_title_base = 'theo tháng'
        x_title = "Tháng"
    elif period_type == 'Quý':
        df_chart['quarter'] = ((df_chart['month'] - 1) // 3) + 1
        df_chart['period'] = 'Q' + df_chart['quarter'].astype(str) + '-' + df_chart['year'].astype(str)
        df_chart['period_sort'] = df_chart['year'] * 100 + df_chart['quarter']
        chart_title_base = 'theo quý'
        x_title = "Quý"
    elif period_type == 'Năm':
        df_chart['period'] = df_chart['year'].astype(str)
        df_chart['period_sort'] = df_chart['year']
        chart_title_base = 'theo năm'
        x_title = "Năm"
    else:  # Ngày
        df_chart['period'] = df_chart['datetime'].dt.strftime('%d/%m/%Y')
        df_chart['period_sort'] = df_chart['datetime']
        chart_title_base = 'theo ngày'
        x_title = "Ngày"

    return df_chart, chart_title_base, x_title


def format_cell_with_change(row, col, rate_cols=None):
    """Hàm tổng quát tạo cell kết hợp giá trị và biến động.
    rate_cols: list of column names that are percentages (e.g. ['completion_rate', 'busy_rate'])
    """
    if rate_cols is None:
        rate_cols = []

    current_val = row[col]
    change_val = row[f'{col}_change']
    change_pct = row[f'{col}_change_pct']
    prev_val = row[f'{col}_prev']

    is_rate = col in rate_cols

    # Nếu không có dữ liệu kỳ trước, chỉ hiển thị giá trị hiện tại
    if pd.isna(prev_val) or (not is_rate and prev_val == 0):
        if is_rate:
            return f"{current_val:.1f}%"
        else:
            return f"{int(current_val):,}"

    # Định màu sắc theo chiều hướng thay đổi
    if change_val > 0:
        color = "#28a745"
        arrow = "↗"
        sign = "+"
    elif change_val < 0:
        color = "#dc3545"
        arrow = "↘"
        sign = ""
    else:
        color = "#6c757d"
        arrow = "→"
        sign = ""

    if is_rate:
        return f"""<div style="text-align: center; line-height: 1.2;">
            <div style="font-size: 16px; font-weight: 600;">{current_val:.1f}%</div>
            <div style="color: {color}; font-weight: 600; font-size: 12px; margin-top: 2px;">
                {arrow} {sign}{change_val:.1f}%
            </div>
        </div>"""
    else:
        return f"""<div style="text-align: center; line-height: 1.2;">
            <div style="font-size: 16px; font-weight: 600;">{int(current_val):,}</div>
            <div style="color: {color}; font-weight: 600; font-size: 12px; margin-top: 2px;">
                {arrow} {sign}{int(change_val):,} ({change_pct:+.1f}%)
            </div>
        </div>"""


def compute_change_columns(pivot_data, columns, rate_cols=None):
    """Tính toán biến động so với kỳ trước cho các cột."""
    if rate_cols is None:
        rate_cols = []
    for col in columns:
        pivot_data[f'{col}_prev'] = pivot_data[col].shift(-1)
        pivot_data[f'{col}_change'] = pivot_data[col] - pivot_data[f'{col}_prev']
        if col in rate_cols:
            pivot_data[f'{col}_change_pct'] = (pivot_data[col] - pivot_data[f'{col}_prev']).round(1)
        else:
            pivot_data[f'{col}_change_pct'] = ((pivot_data[col] / pivot_data[f'{col}_prev'] - 1) * 100).round(1)
        pivot_data[f'{col}_change_pct'] = pivot_data[f'{col}_change_pct'].fillna(0)
    return pivot_data


def render_html_pivot_table(df_display, table_class="pivot-table"):
    """Render HTML table với sticky header từ DataFrame."""
    html_table = f"<div style='max-height: 400px; overflow-y: auto; border: 1px solid #ddd;'><table class='{table_class}' style='width: 100%; border-collapse: collapse; font-size: 16px;'>"

    # Header với sticky positioning
    html_table += "<thead><tr>"
    for col in df_display.columns:
        html_table += f"<th style='position: sticky; top: 0; padding: 15px 8px; text-align: center; background-color: #f0f2f6; font-weight: bold; font-size: 17px; border: 1px solid #ddd; z-index: 10;'>{col}</th>"
    html_table += "</tr></thead>"

    # Body
    html_table += "<tbody>"
    for _, row in df_display.iterrows():
        html_table += "<tr>"
        for i, col in enumerate(df_display.columns):
            cell_value = row[col]
            style = "padding: 12px 8px; text-align: center; border: 1px solid #ddd; vertical-align: middle;"
            if i == 0:  # Period column
                style += " font-weight: 600; background-color: #f8f9fa;"
            html_table += f"<td style='{style}'>{cell_value}</td>"
        html_table += "</tr>"
    html_table += "</tbody></table></div>"

    st.markdown(html_table, unsafe_allow_html=True)


# ===== SPECIFIC PIVOT TABLE FUNCTIONS =====
def create_pivot_table(df):
    """Pivot table cho văn bản đến"""
    st.markdown("### 📊 Bảng Pivot - Phân tích theo thời gian")

    # CSS cho table
    st.markdown("""
    <style>
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

    # Lựa chọn mức độ tổng hợp
    col1, col2 = st.columns([1, 3])
    with col1:
        period_type = st.selectbox(
            "📅 Tổng hợp theo:",
            options=['Ngày', 'Tuần', 'Tháng', 'Quý', 'Năm'],
            index=1,
            key="pivot_period_type"
        )

    df_period = prepare_period_data(df, period_type)

    # Tạo pivot table với các chỉ số mới
    pivot_columns = ['total_incoming', 'no_response_required', 'response_required',
                    'processed_on_time', 'processed_late', 'response_required_VanBan',
                    'response_required_Email', 'response_required_DienThoai', 'response_required_PhanMem']

    available_columns = [col for col in pivot_columns if col in df_period.columns]

    pivot_data = df_period.groupby(['period', 'period_sort'])[available_columns].sum().reset_index()
    pivot_data = pivot_data.sort_values('period_sort', ascending=False)

    pivot_data = compute_change_columns(pivot_data, available_columns)

    # Tính tỷ lệ xử lý đúng hạn
    if 'total_incoming' in available_columns and 'processed_on_time' in available_columns:
        pivot_data['on_time_rate'] = (pivot_data['processed_on_time'] / pivot_data['total_incoming'] * 100).round(1)
        pivot_data['on_time_rate'] = pivot_data['on_time_rate'].fillna(0)

    # Tạo DataFrame hiển thị
    display_data = pivot_data.copy()
    display_columns = ['period']
    column_names = {f'period': f'{period_type}'}

    for col in available_columns:
        new_col = f'{col}_display'
        display_data[new_col] = display_data.apply(lambda row: format_cell_with_change(row, col), axis=1)
        display_columns.append(new_col)

        # Mapping tên cột
        if col == 'total_incoming':
            column_names[new_col] = 'Tổng VB đến'
        elif col == 'no_response_required':
            column_names[new_col] = 'Không yêu cầu phản hồi'
        elif col == 'response_required':
            column_names[new_col] = 'Yêu cầu phản hồi'
        elif col == 'processed_on_time':
            column_names[new_col] = 'Xử lý đúng hạn'
        elif col == 'processed_late':
            column_names[new_col] = 'Xử lý trễ hạn'
        elif col == 'response_required_VanBan':
            column_names[new_col] = 'PH - Văn bản'
        elif col == 'response_required_Email':
            column_names[new_col] = 'PH - Email'
        elif col == 'response_required_DienThoai':
            column_names[new_col] = 'PH - Điện thoại'
        elif col == 'response_required_PhanMem':
            column_names[new_col] = 'PH - Phần mềm'

    st.markdown(f"#### 📋 Tổng hợp theo {period_type} (bao gồm biến động)")

    df_display = display_data[display_columns].rename(columns=column_names)
    render_html_pivot_table(df_display)

    return period_type


def create_outgoing_pivot_table(df):
    """Pivot table cho văn bản đi"""
    st.markdown("### 📊 Bảng Pivot - Phân tích văn bản đi theo thời gian")

    st.markdown("""
    <style>
    .pivot-table-outgoing {
        font-size: 16px !important;
        font-weight: 500;
    }
    .pivot-table-outgoing td {
        padding: 12px 8px !important;
        text-align: center !important;
    }
    .pivot-table-outgoing th {
        padding: 15px 8px !important;
        text-align: center !important;
        background-color: #f0f2f6 !important;
        font-weight: bold !important;
        font-size: 17px !important;
    }
    </style>
    """, unsafe_allow_html=True)

    col1, col2 = st.columns([1, 3])
    with col1:
        period_type = st.selectbox(
            "📅 Tổng hợp theo:",
            options=['Ngày', 'Tuần', 'Tháng', 'Quý', 'Năm'],
            index=1,
            key="outgoing_period_type"
        )

    df_period = prepare_period_data(df, period_type)

    pivot_columns = ['documents', 'contracts_total', 'decisions_total', 'regulations_total',
                    'rules_total', 'procedures_total', 'instruct_total']

    available_columns = [col for col in pivot_columns if col in df_period.columns]

    pivot_data = df_period.groupby(['period', 'period_sort'])[available_columns].sum().reset_index()

    # Tính total_outgoing
    total_columns = ['documents', 'contracts_total', 'decisions_total', 'regulations_total',
                    'rules_total', 'procedures_total', 'instruct_total']
    existing_total_columns = [col for col in total_columns if col in pivot_data.columns]
    if existing_total_columns:
        pivot_data['total_outgoing'] = pivot_data[existing_total_columns].sum(axis=1)
    else:
        pivot_data['total_outgoing'] = 0

    available_columns = ['total_outgoing'] + available_columns
    pivot_data = pivot_data.sort_values('period_sort', ascending=False)

    pivot_data = compute_change_columns(pivot_data, available_columns)

    display_data = pivot_data.copy()
    display_columns = ['period']
    column_names = {f'period': f'{period_type}'}

    for col in available_columns:
        new_col = f'{col}_display'
        display_data[new_col] = display_data.apply(lambda row: format_cell_with_change(row, col), axis=1)
        display_columns.append(new_col)

        if col == 'total_outgoing':
            column_names[new_col] = 'Tổng VB đi'
        elif col == 'documents':
            column_names[new_col] = 'VB phát hành'
        elif col == 'contracts_total':
            column_names[new_col] = 'Hợp đồng'
        elif col == 'decisions_total':
            column_names[new_col] = 'Quyết định'
        elif col == 'regulations_total':
            column_names[new_col] = 'Quy định'
        elif col == 'rules_total':
            column_names[new_col] = 'Quy chế'
        elif col == 'procedures_total':
            column_names[new_col] = 'Quy trình'
        elif col == 'instruct_total':
            column_names[new_col] = 'Hướng dẫn'

    st.markdown(f"#### 📋 Tổng hợp theo {period_type} (bao gồm biến động)")

    df_display = display_data[display_columns].rename(columns=column_names)
    render_html_pivot_table(df_display, "pivot-table-outgoing")

    return period_type


def create_task_pivot_table(df_all, df_detail):
    """Pivot table cho quản lý công việc"""
    st.markdown("### 📊 Bảng Pivot - Phân tích công việc theo thời gian")

    col1, col2 = st.columns(2)
    with col1:
        period_type = st.selectbox(
            "📅 Tổng hợp theo:",
            options=['Ngày', 'Tuần', 'Tháng', 'Quý', 'Năm'],
            index=1,
            key="task_period"
        )

    with col2:
        data_type = st.selectbox(
            "📋 Dữ liệu:",
            options=['Tổng hợp', 'Chi tiết phòng ban'],
            index=0,
            key="task_data_type"
        )

    df = df_all if data_type == 'Tổng hợp' else df_detail
    df_period = prepare_period_data(df, period_type)

    group_cols = ['period', 'period_sort']
    if data_type == 'Chi tiết phòng ban':
        group_cols.append('department')

    pivot_columns = ['tasks_assigned', 'tasks_completed_on_time', 'tasks_new', 'tasks_processing']

    pivot_data = df_period.groupby(group_cols)[pivot_columns].sum().reset_index()
    pivot_data = pivot_data.sort_values('period_sort', ascending=False)

    # Tính lại các tỷ lệ sau khi group
    pivot_data['completion_rate'] = (pivot_data['tasks_completed_on_time'] / pivot_data['tasks_assigned'] * 100).fillna(0)
    pivot_data['processing_rate'] = (pivot_data['tasks_processing'] / pivot_data['tasks_assigned'] * 100).fillna(0)
    pivot_data['new_rate'] = (pivot_data['tasks_new'] / pivot_data['tasks_assigned'] * 100).fillna(0)

    if data_type == 'Tổng hợp':
        rate_cols = ['completion_rate']
        pivot_data = compute_change_columns(pivot_data, pivot_columns + ['completion_rate'], rate_cols)

    st.markdown(f"#### 📋 Tổng hợp theo {period_type} - {data_type}")

    if data_type == 'Tổng hợp':
        display_data = pivot_data.copy()
        display_columns = ['period']
        column_names = {f'period': f'{period_type}'}

        task_columns = ['tasks_assigned', 'tasks_completed_on_time', 'tasks_new', 'tasks_processing', 'completion_rate']
        task_names = ['Giao việc', 'Hoàn thành', 'Việc mới', 'Đang xử lý', 'Tỷ lệ hoàn thành']

        for i, col in enumerate(task_columns):
            new_col = f'{col}_display'
            display_data[new_col] = display_data.apply(
                lambda row: format_cell_with_change(row, col, rate_cols=['completion_rate']), axis=1)
            display_columns.append(new_col)
            column_names[new_col] = task_names[i]

        df_display = display_data[display_columns].rename(columns=column_names)
        render_html_pivot_table(df_display)
    else:
        display_columns = group_cols + pivot_columns + ['completion_rate']
        rename_dict = {
            'period': f'{period_type}',
            'department': 'Phòng ban',
            'tasks_assigned': 'Giao việc',
            'tasks_completed_on_time': 'Hoàn thành đúng hạn',
            'tasks_new': 'Việc mới',
            'tasks_processing': 'Đang xử lý',
            'completion_rate': 'Tỷ lệ hoàn thành (%)'
        }

        display_df = pivot_data[display_columns].copy()
        display_df['completion_rate'] = display_df['completion_rate'].round(1)
        st.dataframe(display_df.rename(columns=rename_dict), use_container_width=True)

    return period_type


def create_meeting_pivot_table(df):
    """Pivot table cho lịch họp"""
    st.markdown("### 📊 Bảng Pivot - Phân tích lịch họp theo thời gian")

    period_type = st.selectbox(
        "📅 Tổng hợp theo:",
        options=['Ngày', 'Tuần', 'Tháng', 'Quý', 'Năm'],
        index=1,
        key="meeting_period"
    )

    df_period = prepare_period_data(df, period_type)

    pivot_columns = ['meeting_schedules']
    pivot_data = df_period.groupby(['period', 'period_sort'])[pivot_columns].sum().reset_index()
    pivot_data = pivot_data.sort_values('period_sort', ascending=False)

    # Tính tỷ lệ ngày bận rộn (>5 cuộc họp)
    busy_days = df_period.groupby(['period', 'period_sort']).apply(
        lambda x: (x['meeting_schedules'] > 5).sum()
    ).reset_index(name='busy_days')

    total_days = df_period.groupby(['period', 'period_sort']).size().reset_index(name='total_days')

    pivot_data = pivot_data.merge(busy_days, on=['period', 'period_sort'])
    pivot_data = pivot_data.merge(total_days, on=['period', 'period_sort'])

    pivot_data['busy_rate'] = (pivot_data['busy_days'] / pivot_data['total_days'] * 100).fillna(0)

    rate_cols = ['busy_rate']
    pivot_data = compute_change_columns(pivot_data, ['meeting_schedules', 'busy_days', 'busy_rate'], rate_cols)

    st.markdown(f"#### 📋 Tổng hợp theo {period_type}")

    display_data = pivot_data.copy()
    display_columns = ['period']
    column_names = {f'period': f'{period_type}'}

    meeting_columns = ['meeting_schedules', 'busy_days', 'busy_rate']
    meeting_names = ['Tổng cuộc họp', 'Ngày bận rộn', 'Tỷ lệ ngày bận (%)']

    for i, col in enumerate(meeting_columns):
        new_col = f'{col}_display'
        display_data[new_col] = display_data.apply(
            lambda row: format_cell_with_change(row, col, rate_cols=['busy_rate']), axis=1)
        display_columns.append(new_col)
        column_names[new_col] = meeting_names[i]

    df_display = display_data[display_columns].rename(columns=column_names)
    render_html_pivot_table(df_display)

    return period_type


def create_room_pivot_table(df):
    """Pivot table cho quản lý phòng họp"""
    st.markdown("### 📊 Bảng Pivot - Phân tích đăng ký phòng họp theo thời gian")

    period_type = st.selectbox(
        "📅 Tổng hợp theo:",
        options=['Ngày', 'Tuần', 'Tháng', 'Quý', 'Năm'],
        index=1,
        key="room_period"
    )

    df_period = df.copy()
    df_period['year'] = df_period['datetime'].dt.year
    df_period['month'] = df_period['datetime'].dt.month
    df_period['week'] = df_period['datetime'].dt.isocalendar().week

    df_period = prepare_period_data(df_period, period_type)

    pivot_data = df_period.groupby(['period', 'period_sort']).agg({
        'register_room': 'sum',
        'register_room_cancel': 'sum',
        'net_bookings': 'sum'
    }).reset_index()
    pivot_data = pivot_data.sort_values('period_sort', ascending=False)

    pivot_data['cancel_rate'] = (pivot_data['register_room_cancel'] / pivot_data['register_room'] * 100).fillna(0)

    rate_cols = ['cancel_rate']
    pivot_data = compute_change_columns(pivot_data, ['register_room', 'register_room_cancel', 'net_bookings', 'cancel_rate'], rate_cols)

    st.markdown(f"#### 📋 Tổng hợp theo {period_type}")

    display_data = pivot_data.copy()
    display_columns = ['period']
    column_names = {f'period': f'{period_type}'}

    room_columns = ['register_room', 'register_room_cancel', 'net_bookings', 'cancel_rate']
    room_names = ['Tổng đăng ký', 'Tổng hủy', 'Đăng ký thực', 'Tỷ lệ hủy (%)']

    for i, col in enumerate(room_columns):
        new_col = f'{col}_display'
        display_data[new_col] = display_data.apply(
            lambda row: format_cell_with_change(row, col, rate_cols=['cancel_rate']), axis=1)
        display_columns.append(new_col)
        column_names[new_col] = room_names[i]

    df_display = display_data[display_columns].rename(columns=column_names)
    render_html_pivot_table(df_display)

    return period_type


# ===== CHART FUNCTIONS =====
def create_incoming_docs_charts(df, period_type='Tuần'):
    """Biểu đồ cho văn bản đến"""
    col1, col2 = st.columns(2)

    with col1:
        df_chart, chart_title_base, x_title = prepare_chart_period(df, period_type)
        chart_title = f'📈 Số lượng văn bản đến {chart_title_base}'

        period_data = df_chart.groupby(['period', 'period_sort'])['total_incoming'].sum().reset_index()
        period_data = period_data.sort_values('period_sort')

        fig_period = go.Figure()

        fig_period.add_trace(go.Scatter(
            x=period_data['period'],
            y=period_data['total_incoming'],
            mode='lines+markers',
            name='Văn bản đến',
            line=dict(color='#1f77b4', width=2),
            marker=dict(size=8)
        ))

        if len(period_data) >= 3:
            ma_window = min(3, len(period_data)//2)
            ma_trend = period_data['total_incoming'].rolling(window=ma_window, center=True).mean()
            fig_period.add_trace(go.Scatter(
                x=period_data['period'],
                y=ma_trend,
                mode='lines',
                name=f'Xu hướng ({ma_window} {period_type.lower()})',
                line=dict(color='red', width=3, dash='dash'),
                opacity=0.8
            ))

        fig_period.update_layout(
            title=f'{chart_title} (có xu hướng)',
            xaxis_title=x_title,
            yaxis_title="Số lượng văn bản",
            hovermode='x unified'
        )
        st.plotly_chart(fig_period, use_container_width=True)

        # Biểu đồ tỷ lệ xử lý đúng hạn vs trễ hạn
        processed_summary = df_chart.groupby(['period', 'period_sort']).agg({
            'processed_on_time': 'sum',
            'processed_late': 'sum'
        }).reset_index()
        processed_summary = processed_summary.sort_values('period_sort')

        fig_processed = go.Figure()
        fig_processed.add_trace(go.Scatter(x=processed_summary['period'],
                                         y=processed_summary['processed_on_time'],
                                         mode='lines', name='Đúng hạn',
                                         line=dict(color='green')))
        fig_processed.add_trace(go.Scatter(x=processed_summary['period'],
                                         y=processed_summary['processed_late'],
                                         mode='lines', name='Trễ hạn',
                                         line=dict(color='red')))
        fig_processed.update_layout(title=f'⏰ Tình hình xử lý văn bản {chart_title_base}',
                                  xaxis_title=x_title, yaxis_title="Số lượng")
        st.plotly_chart(fig_processed, use_container_width=True)

    with col2:
        # Biểu đồ phân bố theo đơn vị gửi
        def extract_sender_name(x):
            try:
                if isinstance(x, dict):
                    return x.get('send_name', 'Khác')
                elif isinstance(x, str):
                    parsed = json.loads(x)
                    return parsed.get('send_name', 'Khác')
                else:
                    return 'Khác'
            except:
                return 'Khác'

        if 'total_incoming_detail' in df.columns:
            sender_data = df['total_incoming_detail'].apply(extract_sender_name).value_counts()
            fig_sender = px.pie(values=sender_data.values, names=sender_data.index,
                               title='🏛️ Phân bố theo đơn vị gửi')
            st.plotly_chart(fig_sender, use_container_width=True)
        else:
            st.info("ℹ️ Không có dữ liệu chi tiết đơn vị gửi.")

        # Biểu đồ top đơn vị gửi theo period_type
        try:
            if 'total_incoming_detail' not in df_chart.columns:
                raise KeyError('total_incoming_detail')
            df_chart['sender'] = df_chart['total_incoming_detail'].apply(extract_sender_name)
            top_senders = df_chart['sender'].value_counts().head(5).index.tolist()

            if len(top_senders) > 0:
                fig_sender_trend = go.Figure()

                for sender in top_senders:
                    sender_data_period = df_chart[df_chart['sender'] == sender].groupby(['period', 'period_sort']).size().reset_index(name='count')
                    sender_data_period = sender_data_period.sort_values('period_sort')

                    all_periods = period_data[['period', 'period_sort']].drop_duplicates()
                    sender_data_period = all_periods.merge(sender_data_period, on=['period', 'period_sort'], how='left')
                    sender_data_period['count'] = sender_data_period['count'].fillna(0)

                    fig_sender_trend.add_trace(go.Bar(
                        name=sender,
                        x=sender_data_period['period'],
                        y=sender_data_period['count']
                    ))

                fig_sender_trend.update_layout(
                    title=f'📊 Top 5 đơn vị gửi {chart_title_base}',
                    xaxis_title=x_title,
                    yaxis_title="Số lượng văn bản",
                    barmode='stack'
                )
                st.plotly_chart(fig_sender_trend, use_container_width=True)
            else:
                st.info(f"Không có dữ liệu đơn vị gửi {chart_title_base}")
        except Exception as e:
            st.error(f"Lỗi khi tạo biểu đồ đơn vị gửi: {str(e)}")
            st.info("Hiển thị biểu đồ đơn vị gửi đơn giản thay thế")

            if 'total_incoming_detail' in df.columns:
                simple_sender_data = df['total_incoming_detail'].apply(extract_sender_name).value_counts().head(5)
                fig_simple = px.bar(
                    x=simple_sender_data.index,
                    y=simple_sender_data.values,
                    title='📊 Top 5 đơn vị gửi (tổng hợp)',
                    labels={'x': 'Đơn vị', 'y': 'Số lượng văn bản'}
                )
                st.plotly_chart(fig_simple, use_container_width=True)


def create_outgoing_docs_charts(df, period_type='Tuần'):
    """Biểu đồ cho văn bản đi - giữ nguyên logic gốc"""
    col1, col2 = st.columns(2)

    df_chart, chart_title_base, x_title = prepare_chart_period(df, period_type)
    chart_title = f'📈 Văn bản đi {chart_title_base}'

    with col1:
        business_categories = ['instruct_total', 'procedures_total']
        business_names = ['Hướng dẫn', 'Quy trình']
        business_colors = ['#1f77b4', '#ff7f0e']

        available_business_categories = [col for col in business_categories if col in df_chart.columns]

        if available_business_categories:
            business_data = df_chart.groupby(['period', 'period_sort'])[available_business_categories].sum().reset_index()
        else:
            business_data = df_chart.groupby(['period', 'period_sort']).size().reset_index(name='count')
        business_data = business_data.sort_values('period_sort')

        fig_business = go.Figure()

        for i, cat in enumerate(business_categories):
            if cat in available_business_categories and cat in business_data.columns and business_data[cat].sum() > 0:
                fig_business.add_trace(go.Scatter(
                    x=business_data['period'],
                    y=business_data[cat],
                    mode='lines+markers',
                    name=business_names[i],
                    line=dict(color=business_colors[i], width=3),
                    marker=dict(size=8)
                ))

                if len(business_data) >= 3:
                    ma_window = min(3, len(business_data)//2)
                    if ma_window > 0:
                        ma_trend = business_data[cat].rolling(window=ma_window, center=True).mean()
                        fig_business.add_trace(go.Scatter(
                            x=business_data['period'],
                            y=ma_trend,
                            mode='lines',
                            name=f'{business_names[i]} - Xu hướng',
                            line=dict(color=business_colors[i], width=2, dash='dash'),
                            opacity=0.7,
                            showlegend=False
                        ))

        fig_business.update_layout(
            title=f'📄 Hướng dẫn & Quy trình {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            hovermode='x unified'
        )
        st.plotly_chart(fig_business, use_container_width=True)

    with col2:
        admin_categories = ['regulations_total', 'rules_total']
        admin_names = ['Quy định', 'Quy chế']
        admin_colors = ['#2ca02c', '#d62728']

        available_admin_categories = [col for col in admin_categories if col in df_chart.columns]

        if available_admin_categories:
            admin_data = df_chart.groupby(['period', 'period_sort'])[available_admin_categories].sum().reset_index()
        else:
            admin_data = df_chart.groupby(['period', 'period_sort']).size().reset_index(name='count')
        admin_data = admin_data.sort_values('period_sort')

        fig_admin = go.Figure()

        for i, cat in enumerate(admin_categories):
            if cat in available_admin_categories and cat in admin_data.columns and admin_data[cat].sum() > 0:
                fig_admin.add_trace(go.Scatter(
                    x=admin_data['period'],
                    y=admin_data[cat],
                    mode='lines+markers',
                    name=admin_names[i],
                    line=dict(color=admin_colors[i], width=3),
                    marker=dict(size=8)
                ))

                if len(admin_data) >= 3:
                    ma_window = min(3, len(admin_data)//2)
                    if ma_window > 0:
                        ma_trend = admin_data[cat].rolling(window=ma_window, center=True).mean()
                        fig_admin.add_trace(go.Scatter(
                            x=admin_data['period'],
                            y=ma_trend,
                            mode='lines',
                            name=f'{admin_names[i]} - Xu hướng',
                            line=dict(color=admin_colors[i], width=2, dash='dash'),
                            opacity=0.7,
                            showlegend=False
                        ))

        fig_admin.update_layout(
            title=f'📋 Quy định & Quy chế {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            hovermode='x unified'
        )
        st.plotly_chart(fig_admin, use_container_width=True)

    # Hàng 2: Biểu đồ chi tiết
    st.markdown("#### 📊 Phân tích chi tiết theo nhóm văn bản")

    col1, col2 = st.columns(2)

    with col1:
        agg_cols = {col: 'sum' for col in ['total_outgoing', 'documents'] if col in df_chart.columns}
        if agg_cols:
            period_data = df_chart.groupby(['period', 'period_sort']).agg(agg_cols).reset_index()
        else:
            period_data = df_chart.groupby(['period', 'period_sort']).size().reset_index(name='count')
        period_data = period_data.sort_values('period_sort')

        fig_compare = go.Figure()

        if 'total_outgoing' in df.columns:
            fig_compare.add_trace(go.Scatter(
                x=period_data['period'],
                y=period_data['total_outgoing'],
                mode='lines+markers',
                name='Tổng văn bản đi',
                line=dict(color='blue', width=3),
                marker=dict(size=8)
            ))

            if len(period_data) >= 3:
                ma_window = min(3, len(period_data)//2)
                if ma_window > 0:
                    ma_trend = period_data['total_outgoing'].rolling(window=ma_window, center=True).mean()
                    fig_compare.add_trace(go.Scatter(
                        x=period_data['period'],
                        y=ma_trend,
                        mode='lines',
                        name='Xu hướng tổng',
                        line=dict(color='blue', width=2, dash='dash'),
                        opacity=0.7,
                        showlegend=False
                    ))

        fig_compare.add_trace(go.Scatter(
            x=period_data['period'],
            y=period_data['documents'],
            mode='lines+markers',
            name='Văn bản phát hành',
            line=dict(color='orange', width=3),
            marker=dict(size=8)
        ))

        if len(period_data) >= 3:
            ma_window = min(3, len(period_data)//2)
            if ma_window > 0:
                ma_trend = period_data['documents'].rolling(window=ma_window, center=True).mean()
                fig_compare.add_trace(go.Scatter(
                    x=period_data['period'],
                    y=ma_trend,
                    mode='lines',
                    name='Xu hướng phát hành',
                    line=dict(color='orange', width=2, dash='dash'),
                    opacity=0.7,
                    showlegend=False
                ))

        fig_compare.update_layout(
            title=f'{chart_title} (So sánh)',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            hovermode='x unified'
        )
        st.plotly_chart(fig_compare, use_container_width=True)

        # Stacked bar chart
        categories = ['contracts_total', 'decisions_total', 'regulations_total',
                     'rules_total', 'procedures_total', 'instruct_total']
        category_names = ['Hợp đồng', 'Quyết định', 'Quy định', 'Quy chế', 'Quy trình', 'Hướng dẫn']

        available_categories = [col for col in categories if col in df_chart.columns]

        if available_categories:
            category_data = df_chart.groupby(['period', 'period_sort'])[available_categories].sum().reset_index()
        else:
            category_data = df_chart.groupby(['period', 'period_sort']).size().reset_index(name='count')
        category_data = category_data.sort_values('period_sort')

        fig_stack = go.Figure()

        for i, cat in enumerate(categories):
            if cat in available_categories and cat in category_data.columns and category_data[cat].sum() > 0:
                fig_stack.add_trace(go.Bar(
                    name=category_names[i],
                    x=category_data['period'],
                    y=category_data[cat]
                ))

        fig_stack.update_layout(
            title=f'📊 Phân bố loại văn bản {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            barmode='stack'
        )
        st.plotly_chart(fig_stack, use_container_width=True)

    with col2:
        fig_trend = go.Figure()

        top_categories = ['contracts_total', 'decisions_total']
        top_names = ['Hợp đồng', 'Quyết định']
        colors = ['blue', 'red']

        for i, cat in enumerate(top_categories):
            if cat in df.columns and category_data[cat].sum() > 0:
                fig_trend.add_trace(go.Scatter(
                    x=category_data['period'],
                    y=category_data[cat],
                    mode='lines+markers',
                    name=top_names[i],
                    line=dict(color=colors[i], width=3),
                    marker=dict(size=8)
                ))

                if len(category_data) >= 3:
                    ma_window = min(3, len(category_data)//2)
                    if ma_window > 0:
                        ma_trend = category_data[cat].rolling(window=ma_window, center=True).mean()
                        fig_trend.add_trace(go.Scatter(
                            x=category_data['period'],
                            y=ma_trend,
                            mode='lines',
                            name=f'{top_names[i]} - Xu hướng',
                            line=dict(color=colors[i], width=2, dash='dash'),
                            opacity=0.7,
                            showlegend=False
                        ))

        fig_trend.update_layout(
            title=f'📈 Xu hướng văn bản chính {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            hovermode='x unified'
        )
        st.plotly_chart(fig_trend, use_container_width=True)

        # Pie chart
        category_totals = []
        available_names = []
        for i, cat in enumerate(categories):
            if cat in df.columns:
                total = df[cat].sum()
                if total > 0:
                    category_totals.append(total)
                    available_names.append(category_names[i])

        if category_totals:
            fig_pie = px.pie(
                values=category_totals,
                names=available_names,
                title='📊 Phân bố tổng hợp theo loại văn bản'
            )
            st.plotly_chart(fig_pie, use_container_width=True)


def create_task_management_charts(df_all, df_detail, period_type='Tuần'):
    """Biểu đồ cho quản lý công việc - giữ nguyên logic gốc"""
    # Chart tổng số lượng công việc theo phòng ban
    if len(df_detail) > 0:
        st.markdown("#### 📊 Tổng số lượng công việc theo phòng ban")

        dept_summary = df_detail.groupby('department').agg({
            'tasks_assigned': 'sum',
            'tasks_completed_on_time': 'sum',
            'tasks_processing': 'sum',
            'tasks_new': 'sum'
        }).reset_index()

        dept_summary['tasks_incomplete'] = dept_summary['tasks_processing'] + dept_summary['tasks_new']
        dept_summary = dept_summary.sort_values('tasks_assigned', ascending=False)

        dept_display = dept_summary.iloc[::-1]

        fig_dept_full = go.Figure()

        fig_dept_full.add_trace(go.Bar(
            name='Hoàn thành',
            y=dept_display['department'],
            x=dept_display['tasks_completed_on_time'],
            orientation='h',
            marker_color='#28a745'
        ))

        fig_dept_full.add_trace(go.Bar(
            name='Chưa hoàn thành',
            y=dept_display['department'],
            x=dept_display['tasks_incomplete'],
            orientation='h',
            marker_color='#dc3545'
        ))

        fig_dept_full.update_layout(
            title=f'📊 Tổng số lượng công việc theo phòng ban (Tất cả {len(dept_summary)} phòng ban)',
            xaxis_title="Số lượng",
            yaxis_title="",
            barmode='stack',
            showlegend=True,
            height=max(500, len(dept_summary) * 25 + 100),
            margin=dict(l=150, r=30, t=60, b=30)
        )

        st.plotly_chart(fig_dept_full, use_container_width=True)

        with st.expander(f"📋 Chi tiết tất cả {len(dept_summary)} phòng ban"):
            dept_display_table = dept_summary.copy()
            dept_display_table['completion_rate'] = (dept_display_table['tasks_completed_on_time'] / dept_display_table['tasks_assigned'] * 100).round(1)

            st.dataframe(
                dept_display_table[['department', 'tasks_assigned', 'tasks_completed_on_time', 'tasks_processing', 'tasks_new', 'completion_rate']].rename(columns={
                    'department': 'Phòng ban',
                    'tasks_assigned': 'Tổng giao việc',
                    'tasks_completed_on_time': 'Hoàn thành',
                    'tasks_processing': 'Đang xử lý',
                    'tasks_new': 'Việc mới',
                    'completion_rate': 'Tỷ lệ hoàn thành (%)'
                }),
                use_container_width=True
            )

        st.markdown("---")

    # Biểu đồ cumulative
    st.markdown("#### �� Xu hướng tích lũy tất cả các công việc")

    df_all_sorted = df_all.sort_values('datetime').reset_index(drop=True)

    df_all_sorted['cumulative_assigned'] = df_all_sorted['tasks_assigned'].cumsum()
    df_all_sorted['cumulative_completed'] = df_all_sorted['tasks_completed_on_time'].cumsum()
    df_all_sorted['cumulative_processing'] = df_all_sorted['tasks_processing'].cumsum()
    df_all_sorted['cumulative_new'] = df_all_sorted['tasks_new'].cumsum()

    fig_cumulative = go.Figure()

    fig_cumulative.add_trace(go.Scatter(
        x=df_all_sorted['datetime'],
        y=df_all_sorted['cumulative_assigned'],
        mode='lines+markers',
        name='📋 Tổng giao việc',
        line=dict(color='#1f77b4', width=4),
        marker=dict(size=10)
    ))

    fig_cumulative.add_trace(go.Scatter(
        x=df_all_sorted['datetime'],
        y=df_all_sorted['cumulative_completed'],
        mode='lines+markers',
        name='✅ Tổng đã hoàn thành',
        line=dict(color='#28a745', width=4),
        marker=dict(size=10)
    ))

    fig_cumulative.add_trace(go.Scatter(
        x=df_all_sorted['datetime'],
        y=df_all_sorted['cumulative_processing'],
        mode='lines+markers',
        name='🔄 Tổng đang xử lý',
        line=dict(color='#fd7e14', width=3),
        marker=dict(size=8)
    ))

    fig_cumulative.add_trace(go.Scatter(
        x=df_all_sorted['datetime'],
        y=df_all_sorted['cumulative_new'],
        mode='lines+markers',
        name='🆕 Tổng việc mới',
        line=dict(color='#dc3545', width=3),
        marker=dict(size=8)
    ))

    fig_cumulative.update_layout(
        title='📊 Tích lũy tất cả công việc theo thời gian',
        xaxis_title="Thời gian",
        yaxis_title="Số lượng tích lũy",
        hovermode='x unified',
        height=500,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="center",
            x=0.5
        )
    )

    st.plotly_chart(fig_cumulative, use_container_width=True)

    st.markdown("---")

    # Các biểu đồ chi tiết
    col1, col2 = st.columns(2)

    df_chart, chart_title_base, x_title = prepare_chart_period(df_all, period_type)

    period_data = df_chart.groupby(['period', 'period_sort']).agg({
        'tasks_assigned': 'sum',
        'tasks_completed_on_time': 'sum',
        'tasks_processing': 'sum',
        'tasks_new': 'sum'
    }).reset_index()
    period_data = period_data.sort_values('period_sort')

    with col1:
        fig_assigned = go.Figure()

        fig_assigned.add_trace(go.Scatter(
            x=period_data['period'],
            y=period_data['tasks_assigned'],
            mode='lines+markers',
            name='Giao việc',
            line=dict(color='#1f77b4', width=4),
            marker=dict(size=10)
        ))

        if len(period_data) >= 3:
            ma_window = min(3, len(period_data)//2)
            if ma_window > 0:
                ma_trend = period_data['tasks_assigned'].rolling(window=ma_window, center=True).mean()
                fig_assigned.add_trace(go.Scatter(
                    x=period_data['period'],
                    y=ma_trend,
                    mode='lines',
                    name='Xu hướng',
                    line=dict(color='#1f77b4', width=2, dash='dash'),
                    opacity=0.7,
                    showlegend=False
                ))

        fig_assigned.update_layout(
            title=f'📋 Giao việc {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            hovermode='x unified',
            height=400
        )
        st.plotly_chart(fig_assigned, use_container_width=True)

    with col2:
        fig_status = go.Figure()

        status_data = [
            ('tasks_completed_on_time', 'Hoàn thành', '#28a745'),
            ('tasks_processing', 'Đang xử lý', '#fd7e14'),
            ('tasks_new', 'Việc mới', '#dc3545')
        ]

        for col_name, name, color in status_data:
            fig_status.add_trace(go.Scatter(
                x=period_data['period'],
                y=period_data[col_name],
                mode='lines+markers',
                name=name,
                line=dict(color=color, width=3),
                marker=dict(size=8)
            ))

            if len(period_data) >= 3:
                ma_window = min(3, len(period_data)//2)
                if ma_window > 0:
                    ma_trend = period_data[col_name].rolling(window=ma_window, center=True).mean()
                    fig_status.add_trace(go.Scatter(
                        x=period_data['period'],
                        y=ma_trend,
                        mode='lines',
                        name=f'{name} - Xu hướng',
                        line=dict(color=color, width=2, dash='dash'),
                        opacity=0.7,
                        showlegend=False
                    ))

        fig_status.update_layout(
            title=f'📊 Trạng thái công việc {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            hovermode='x unified',
            height=400
        )
        st.plotly_chart(fig_status, use_container_width=True)

    # Hàng 2
    st.markdown("---")
    col3, col4 = st.columns(2)

    with col3:
        period_data['completion_rate'] = (period_data['tasks_completed_on_time'] / period_data['tasks_assigned'] * 100).fillna(0)

        fig_completion = go.Figure()
        fig_completion.add_trace(go.Scatter(
            x=period_data['period'],
            y=period_data['completion_rate'],
            mode='lines+markers',
            name='Tỷ lệ hoàn thành',
            line=dict(color='purple', width=3),
            marker=dict(size=8)
        ))

        if len(period_data) >= 3:
            ma_window = min(3, len(period_data)//2)
            if ma_window > 0:
                ma_trend = period_data['completion_rate'].rolling(window=ma_window, center=True).mean()
                fig_completion.add_trace(go.Scatter(
                    x=period_data['period'],
                    y=ma_trend,
                    mode='lines',
                    name='Xu hướng tỷ lệ',
                    line=dict(color='purple', width=2, dash='dash'),
                    opacity=0.7,
                    showlegend=False
                ))

        fig_completion.update_layout(
            title=f'📊 Tỷ lệ hoàn thành {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Tỷ lệ (%)",
            hovermode='x unified',
            height=400
        )
        st.plotly_chart(fig_completion, use_container_width=True)

    with col4:
        total_completed = period_data['tasks_completed_on_time'].sum()
        total_processing = period_data['tasks_processing'].sum()
        total_new = period_data['tasks_new'].sum()

        status_data_pie = []
        status_values = []
        status_colors = []

        if total_completed > 0:
            status_data_pie.append('Hoàn thành')
            status_values.append(total_completed)
            status_colors.append('#28a745')

        if total_processing > 0:
            status_data_pie.append('Đang xử lý')
            status_values.append(total_processing)
            status_colors.append('#fd7e14')

        if total_new > 0:
            status_data_pie.append('Việc mới')
            status_values.append(total_new)
            status_colors.append('#dc3545')

        if status_values:
            fig_pie = go.Figure(data=[go.Pie(
                labels=status_data_pie,
                values=status_values,
                hole=0.4,
                marker_colors=status_colors,
                textinfo='label+value+percent',
                textposition='auto'
            )])

            fig_pie.update_layout(
                title='📋 Tổng hợp trạng thái công việc',
                showlegend=True,
                legend=dict(orientation="v", yanchor="middle", y=0.5),
                height=400
            )

            st.plotly_chart(fig_pie, use_container_width=True)
        else:
            st.info("📋 Không có dữ liệu trạng thái công việc")


def create_meeting_charts(df, period_type='Tuần'):
    """Biểu đồ cho lịch họp - giữ nguyên logic gốc"""
    col1, col2 = st.columns(2)

    df_chart, chart_title_base, x_title = prepare_chart_period(df, period_type)

    period_data = df_chart.groupby(['period', 'period_sort']).agg({
        'meeting_schedules': 'sum'
    }).reset_index()
    period_data = period_data.sort_values('period_sort')

    with col1:
        fig_meetings = go.Figure()

        fig_meetings.add_trace(go.Scatter(
            x=period_data['period'],
            y=period_data['meeting_schedules'],
            mode='lines+markers',
            name='Cuộc họp',
            line=dict(color='#007bff', width=4),
            marker=dict(size=10)
        ))

        if len(period_data) >= 3:
            ma_window = min(3, len(period_data)//2)
            if ma_window > 0:
                ma_trend = period_data['meeting_schedules'].rolling(window=ma_window, center=True).mean()
                fig_meetings.add_trace(go.Scatter(
                    x=period_data['period'],
                    y=ma_trend,
                    mode='lines',
                    name='Xu hướng',
                    line=dict(color='#007bff', width=2, dash='dash'),
                    opacity=0.7,
                    showlegend=False
                ))

        fig_meetings.update_layout(
            title=f'📅 Cuộc họp {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            hovermode='x unified',
            height=400
        )
        st.plotly_chart(fig_meetings, use_container_width=True)

    with col2:
        weekday_summary = df.groupby('weekday_vi')['meeting_schedules'].sum().reindex([
            'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'
        ]).fillna(0)

        colors = ['#28a745' if day in ['Thứ 7', 'Chủ nhật'] else '#007bff' for day in weekday_summary.index]

        fig_weekday = px.bar(
            x=weekday_summary.index,
            y=weekday_summary.values,
            title='📅 Phân bố cuộc họp theo ngày trong tuần',
            color=weekday_summary.index,
            color_discrete_sequence=colors
        )
        fig_weekday.update_layout(
            xaxis_title="Ngày trong tuần",
            yaxis_title="Tổng số cuộc họp",
            showlegend=False,
            height=400
        )
        st.plotly_chart(fig_weekday, use_container_width=True)

    st.markdown("---")
    col3, col4 = st.columns(2)

    with col3:
        level_counts = df['meeting_level'].value_counts()
        level_order = ['Rất ít', 'Ít', 'Trung bình', 'Nhiều', 'Rất nhiều']
        level_counts = level_counts.reindex(level_order).fillna(0)

        colors_level = {'Rất ít': '#28a745', 'Ít': '#6c757d', 'Trung bình': '#ffc107',
                       'Nhiều': '#fd7e14', 'Rất nhiều': '#dc3545'}

        fig_level = px.pie(
            values=level_counts.values,
            names=level_counts.index,
            title='📊 Phân bố mức độ bận rộn',
            color=level_counts.index,
            color_discrete_map=colors_level,
            hole=0.4
        )
        fig_level.update_layout(height=400)
        st.plotly_chart(fig_level, use_container_width=True)

    with col4:
        day_type_summary = df.groupby('day_type')['meeting_schedules'].agg(['count', 'sum', 'mean']).round(1)

        fig_daytype = go.Figure()
        fig_daytype.add_trace(go.Bar(
            name='Số ngày',
            x=day_type_summary.index,
            y=day_type_summary['count'],
            marker_color='lightblue'
        ))
        fig_daytype.add_trace(go.Bar(
            name='Tổng cuộc họp',
            x=day_type_summary.index,
            y=day_type_summary['sum'],
            marker_color='darkblue'
        ))

        fig_daytype.update_layout(
            title='📊 So sánh ngày làm việc vs cuối tuần',
            xaxis_title="Loại ngày",
            yaxis_title="Số lượng",
            barmode='group',
            height=400
        )
        st.plotly_chart(fig_daytype, use_container_width=True)


def create_room_charts(df, period_type='Tuần'):
    """Biểu đồ cho quản lý phòng họp - giữ nguyên logic gốc"""
    col1, col2 = st.columns(2)

    df_chart = df.copy()
    df_chart['year'] = df_chart['datetime'].dt.year
    df_chart['month'] = df_chart['datetime'].dt.month
    df_chart['week'] = df_chart['datetime'].dt.isocalendar().week

    df_chart, chart_title_base, x_title = prepare_chart_period(df_chart, period_type)

    period_data = df_chart.groupby(['period', 'period_sort']).agg({
        'register_room': 'sum',
        'register_room_cancel': 'sum',
        'net_bookings': 'sum'
    }).reset_index()
    period_data = period_data.sort_values('period_sort')
    period_data['cancel_rate'] = (period_data['register_room_cancel'] / period_data['register_room'] * 100).fillna(0)

    with col1:
        fig_bookings = go.Figure()

        fig_bookings.add_trace(go.Scatter(
            x=period_data['period'],
            y=period_data['register_room'],
            mode='lines+markers',
            name='Đăng ký',
            line=dict(color='#007bff', width=4),
            marker=dict(size=10)
        ))

        if len(period_data) >= 3:
            ma_window = min(3, len(period_data)//2)
            if ma_window > 0:
                ma_trend = period_data['register_room'].rolling(window=ma_window, center=True).mean()
                fig_bookings.add_trace(go.Scatter(
                    x=period_data['period'],
                    y=ma_trend,
                    mode='lines',
                    name='Xu hướng',
                    line=dict(color='#007bff', width=2, dash='dash'),
                    opacity=0.7,
                    showlegend=False
                ))

        fig_bookings.update_layout(
            title=f'🏢 Đăng ký phòng {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            hovermode='x unified',
            height=400
        )
        st.plotly_chart(fig_bookings, use_container_width=True)

    with col2:
        fig_compare = go.Figure()

        fig_compare.add_trace(go.Bar(
            x=period_data['period'],
            y=period_data['register_room'],
            name='Đăng ký',
            marker_color='#28a745'
        ))

        fig_compare.add_trace(go.Bar(
            x=period_data['period'],
            y=period_data['register_room_cancel'],
            name='Hủy bỏ',
            marker_color='#dc3545'
        ))

        fig_compare.update_layout(
            title=f'📊 So sánh đăng ký vs hủy {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Số lượng",
            barmode='group',
            height=400
        )
        st.plotly_chart(fig_compare, use_container_width=True)

    st.markdown("---")
    col3, col4 = st.columns(2)

    with col3:
        fig_cancel_rate = go.Figure()

        fig_cancel_rate.add_trace(go.Scatter(
            x=period_data['period'],
            y=period_data['cancel_rate'],
            mode='lines+markers',
            name='Tỷ lệ hủy',
            line=dict(color='#ffc107', width=4),
            marker=dict(size=10)
        ))

        if len(period_data) >= 3:
            ma_window = min(3, len(period_data)//2)
            if ma_window > 0:
                ma_trend_cancel = period_data['cancel_rate'].rolling(window=ma_window, center=True).mean()
                fig_cancel_rate.add_trace(go.Scatter(
                    x=period_data['period'],
                    y=ma_trend_cancel,
                    mode='lines',
                    name='Xu hướng',
                    line=dict(color='#ffc107', width=2, dash='dash'),
                    opacity=0.7,
                    showlegend=False
                ))

        fig_cancel_rate.update_layout(
            title=f'📉 Tỷ lệ hủy {chart_title_base}',
            xaxis_title=x_title,
            yaxis_title="Tỷ lệ (%)",
            hovermode='x unified',
            height=400
        )
        st.plotly_chart(fig_cancel_rate, use_container_width=True)

    with col4:
        weekday_summary = df.groupby('weekday_vi').agg({
            'register_room': 'sum',
            'register_room_cancel': 'sum'
        }).reindex([
            'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'
        ]).fillna(0)

        fig_weekday = go.Figure()

        fig_weekday.add_trace(go.Bar(
            name='Đăng ký',
            x=weekday_summary.index,
            y=weekday_summary['register_room'],
            marker_color='#007bff'
        ))

        fig_weekday.add_trace(go.Bar(
            name='Hủy bỏ',
            x=weekday_summary.index,
            y=weekday_summary['register_room_cancel'],
            marker_color='#dc3545'
        ))

        fig_weekday.update_layout(
            title='📅 Phân bố theo ngày trong tuần',
            xaxis_title="Ngày trong tuần",
            yaxis_title="Số lượng",
            barmode='group',
            height=400
        )
        st.plotly_chart(fig_weekday, use_container_width=True)


# ===== HELPER FUNCTIONS FOR TONGHOP TABS =====
def get_metric_value(df, content_name):
    """Lấy giá trị metric từ DataFrame có cột 'Nội dung' và 'Số liệu'"""
    if 'Nội dung' not in df.columns or 'Số liệu' not in df.columns:
        return 0
    result = df[df['Nội dung'] == content_name]['Số liệu']
    if len(result) > 0:
        cleaned_result = result.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip()
        numeric_values = pd.to_numeric(cleaned_result, errors='coerce').fillna(0)
        return numeric_values.sum()
    return 0


def clean_and_format_number(x):
    """Clean and format number with commas."""
    cleaned = str(x).replace('\xa0', '').replace(' ', '').strip()
    numeric_val = pd.to_numeric(cleaned, errors='coerce')
    if pd.isna(numeric_val):
        return str(x)
    elif numeric_val >= 1:
        return f"{numeric_val:,.0f}"
    else:
        return f"{numeric_val:.1f}"


