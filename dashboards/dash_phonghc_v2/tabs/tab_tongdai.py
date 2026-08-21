import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def create_call_pivot_table(df):
    st.markdown("### 📊 Bảng Pivot - Phân tích Tổng đài theo thời gian")

    # CSS cho table lớn hơn và đẹp hơn
    st.markdown("""
    <style>
    .pivot-table-call {
        font-size: 16px !important;
        font-weight: 500;
    }
    .pivot-table-call td {
        padding: 12px 8px !important;
        text-align: center !important;
    }
    .pivot-table-call th {
        padding: 15px 8px !important;
        text-align: center !important;
        background-color: #f0f2f6 !important;
        font-weight: bold !important;
        font-size: 17px !important;
    }
    .increase { color: #16a085; font-weight: 600; }
    .decrease { color: #e74c3c; font-weight: 600; }
    .neutral { color: #7f8c8d; font-weight: 600; }
    </style>
    """, unsafe_allow_html=True)

    col1, col2 = st.columns([1, 1])
    with col1:
        period_type = st.selectbox(
            "📅 Tổng hợp theo:",
            options=['Tuần', 'Tháng', 'Năm'],  # Thêm Năm cho dữ liệu 2025
            index=0,  # Mặc định là Tuần
            key="call_period_type"
        )

    # Dữ liệu Tổng đài có cấu trúc khác - có thể có cột tuần/tháng trực tiếp
    has_time_data = False
    df_period = df.copy()

    # Kiểm tra các cột thời gian - data có Tuần và Tháng
    if 'Tuần' in df.columns or 'Tháng' in df.columns:
        has_time_data = True

        # Chuẩn bị dữ liệu dựa trên period_type được chọn
        if period_type == 'Tuần' and 'Tuần' in df.columns:
            df_period['period'] = 'W' + df_period['Tuần'].astype(str)
            df_period['period_sort'] = pd.to_numeric(df_period['Tuần'], errors='coerce')
        elif period_type == 'Tháng' and 'Tháng' in df.columns:
            df_period['period'] = 'T' + df_period['Tháng'].astype(str)
            df_period['period_sort'] = pd.to_numeric(df_period['Tháng'], errors='coerce')
        elif period_type == 'Năm':
            # Dữ liệu năm 2025 - tạo period năm
            df_period['period'] = '2025'
            df_period['period_sort'] = 2025
        else:
            # Fallback: sử dụng Tuần làm mặc định
            if 'Tuần' in df.columns:
                df_period['period'] = 'W' + df_period['Tuần'].astype(str)
                df_period['period_sort'] = pd.to_numeric(df_period['Tuần'], errors='coerce')
            else:
                has_time_data = False

    elif 'datetime' in df.columns:
        # Xử lý datetime nếu có
        has_time_data = True
        df_period['datetime'] = pd.to_datetime(df_period['datetime'])
        df_period['year'] = df_period['datetime'].dt.year
        df_period['month'] = df_period['datetime'].dt.month
        df_period['week'] = df_period['datetime'].dt.isocalendar().week

        if period_type == 'Tuần':
            df_period['period'] = 'W' + df_period['week'].astype(str) + '-' + df_period['year'].astype(str)
            df_period['period_sort'] = df_period['year'] * 100 + df_period['week']
        elif period_type == 'Tháng':
            df_period['period'] = 'T' + df_period['month'].astype(str) + '-' + df_period['year'].astype(str)
            df_period['period_sort'] = df_period['year'] * 100 + df_period['month']
    else:
        # Không có dữ liệu thời gian, tạo period giả lập
        has_time_data = False

    if has_time_data:
        # Tạo pivot table với các chỉ số Tổng đài - mở rộng để bao gồm tất cả metrics
        call_metrics = ['tong_goi', 'nho_tu_choi', 'nho_ko_bat', 'ty_le_tra_loi', 'hotline']

        # Nếu dữ liệu không có các cột metric, tạo chúng từ Nội dung/Số liệu
        if 'Nội dung' in df_period.columns and 'Số liệu' in df_period.columns:
            df_period['Số liệu'] = pd.to_numeric(
                df_period['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(),
                errors='coerce'
            ).fillna(0)
            for metric in call_metrics:
                df_period[metric] = 0

            # Mapping các metric từ Nội dung - dựa trên data thực tế
            metric_mapping = {
                'tong_goi': ['Tổng số cuộc gọi đến Bệnh viện'],
                'nho_tu_choi': ['Tổng số cuộc gọi nhỡ do từ chối'],
                'nho_ko_bat': ['Tổng số cuộc gọi nhỡ do không bắt máy'],
                'ty_le_tra_loi': ['Tỷ lệ trả lời'],
                'hotline': ['Hottline']
            }

            for metric, content_names in metric_mapping.items():
                for content_name in content_names:
                    mask = df_period['Nội dung'] == content_name
                    df_period.loc[mask, metric] = pd.to_numeric(df_period.loc[mask, 'Số liệu'], errors='coerce').fillna(0)

        # Tạo pivot data
        pivot_data = df_period.groupby(['period', 'period_sort'])[call_metrics].sum().reset_index()
        pivot_data = pivot_data.sort_values('period_sort', ascending=False)

        # Tính toán biến động so với kỳ trước
        for col in call_metrics:
            pivot_data[f'{col}_prev'] = pivot_data[col].shift(-1)
            pivot_data[f'{col}_change'] = pivot_data[col] - pivot_data[f'{col}_prev']
            pivot_data[f'{col}_change_pct'] = ((pivot_data[col] / pivot_data[f'{col}_prev'] - 1) * 100).round(1)
            pivot_data[f'{col}_change_pct'] = pivot_data[f'{col}_change_pct'].fillna(0)

        # Tạo DataFrame hiển thị với biến động trong cùng cell
        display_data = pivot_data.copy()

        # Hàm tạo cell kết hợp giá trị và biến động với comma formatting
        def format_cell_with_change(row, col):
            current_val = row[col]
            change_val = row[f'{col}_change']
            change_pct = row[f'{col}_change_pct']
            prev_val = row[f'{col}_prev']

            # Nếu không có dữ liệu kỳ trước, chỉ hiển thị giá trị hiện tại với comma
            if pd.isna(prev_val) or prev_val == 0:
                if col == 'ty_le_tra_loi':
                    return f"{current_val:.1f}%"
                return f"{int(current_val):,}"

            # Định màu sắc theo chiều hướng thay đổi
            if change_val > 0:
                color_class = "increase"
                arrow = "↗"
                sign = "+"
            elif change_val < 0:
                color_class = "decrease"
                arrow = "↘"
                sign = ""
            else:
                color_class = "neutral"
                arrow = "→"
                sign = ""

            # Trả về HTML với màu sắc và comma formatting
            if col == 'ty_le_tra_loi':
                return f"""<div style="text-align: center; line-height: 1.2;">
                    <div style="font-size: 16px; font-weight: 600;">{current_val:.1f}%</div>
                    <div class="{color_class}" style="font-size: 12px; margin-top: 2px;">
                        {arrow} {sign}{change_val:.1f} ({change_pct:+.1f}%)
                    </div>
                </div>"""
            else:
                return f"""<div style="text-align: center; line-height: 1.2;">
                    <div style="font-size: 16px; font-weight: 600;">{int(current_val):,}</div>
                    <div class="{color_class}" style="font-size: 12px; margin-top: 2px;">
                        {arrow} {sign}{int(change_val):,} ({change_pct:+.1f}%)
                    </div>
                </div>"""

        # Tạo cột hiển thị mới
        display_columns = ['period']
        column_names = {f'period': f'{period_type}'}

        for col in call_metrics:
            new_col = f'{col}_display'
            display_data[new_col] = display_data.apply(lambda row: format_cell_with_change(row, col), axis=1)
            display_columns.append(new_col)

            # Mapping tên cột cho hiển thị
            metric_names = {
                'tong_goi': 'Tổng cuộc gọi',
                'nho_tu_choi': 'Nhỡ (từ chối)',
                'nho_ko_bat': 'Nhỡ (không bắt)',
                'ty_le_tra_loi': 'Tỷ lệ trả lời (%)',
                'hotline': 'Hotline'
            }
            column_names[new_col] = metric_names.get(col, col)

        st.markdown(f"#### 📋 Tổng hợp theo {period_type} (bao gồm biến động)")

        # Hiển thị bảng với HTML để render màu sắc
        df_display = display_data[display_columns].rename(columns=column_names)

        # Tạo HTML table với sticky header
        html_table = "<div style='max-height: 400px; overflow-y: auto; border: 1px solid #ddd;'><table class='pivot-table-call' style='width: 100%; border-collapse: collapse; font-size: 16px;'>"

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
                style = "padding: 12px 8px; text-align: center; border: 1px solid #ddd;"
                html_table += f"<td style='{style}'>{cell_value}</td>"
            html_table += "</tr>"
        html_table += "</tbody></table></div>"

        st.markdown(html_table, unsafe_allow_html=True)

    else:
        # Hiển thị dữ liệu cơ bản với comma formatting
        if 'Nội dung' in df.columns and 'Số liệu' in df.columns:
            summary_data = df[['Nội dung', 'Số liệu']].copy()
            # Clean and format numbers with commas
            def format_summary_number(x):
                cleaned = str(x).replace('\xa0', '').replace(' ', '').strip()
                numeric_val = pd.to_numeric(cleaned, errors='coerce')
                if pd.isna(numeric_val):
                    return str(x)
                elif numeric_val >= 1:
                    return f"{numeric_val:,.0f}"
                else:
                    return f"{numeric_val:.1f}"

            summary_data['Số liệu'] = summary_data['Số liệu'].apply(format_summary_number)
            st.dataframe(summary_data, use_container_width=True, hide_index=True)

    return period_type


def render():
    data_manager = st.session_state.get('data_manager')

    st.markdown('<div class="tab-header">📞 Báo cáo Tổng đài</div>', unsafe_allow_html=True)

    def create_call_center_data():
        """Tạo dữ liệu mẫu cho tổng đài"""
        return pd.DataFrame({
            'Tuần': [39] * 12,
            'Tháng': [9] * 12,
            'Nội dung': [
                'Tổng số cuộc gọi đến Bệnh viện',
                'Tổng số cuộc gọi nhỡ do từ chối',
                'Tổng số cuộc gọi nhỡ do không bắt máy',
                'Số cuộc gọi đến (Nhánh 0-Tổng đài viên)',
                'Nhỡ do từ chối (Nhánh 0-Tổng đài viên)',
                'Nhỡ do không bắt máy (Nhánh 0-Tổng đài viên)',
                'Số cuộc gọi đến (Nhánh 1-Cấp cứu)',
                'Số cuộc gọi đến (Nhánh 2-Tư vấn Thuốc)',
                'Số cuộc gọi đến (Nhánh 3-PKQT)',
                'Số cuộc gọi đến (Nhánh 4-Vấn đề khác)',
                'Hottline',
                'Tỷ lệ trả lời'
            ],
            'Số liệu': [1250, 185, 95, 450, 65, 35, 320, 280, 150, 120, 85, 87.2]
        })

    # Load data từ DataManager hoặc dữ liệu mẫu
    df_calls = data_manager.get_category_data('Tổng đài')

    if df_calls is None:
        df_calls = create_call_center_data()

    if not df_calls.empty:
        # Hiển thị phạm vi dữ liệu
        _tuan_col = 'Tuần' if 'Tuần' in df_calls.columns else None
        _thang_col = 'Tháng' if 'Tháng' in df_calls.columns else None
        if _tuan_col:
            _tuan_min = int(df_calls[_tuan_col].dropna().min())
            _tuan_max = int(df_calls[_tuan_col].dropna().max())
            _thang_info = f", Tháng {int(df_calls[_thang_col].dropna().min())}–{int(df_calls[_thang_col].dropna().max())}" if _thang_col else ""
            st.info(f"📅 Dữ liệu từ **Tuần {_tuan_min}** đến **Tuần {_tuan_max}**{_thang_info}")

        # Metrics overview tổng quan
        st.markdown('<div class="section-header">📊 Tổng quan hoạt động Tổng đài</div>', unsafe_allow_html=True)

        col1, col2, col3, col4 = st.columns(4)

        # Tính toán metrics từ dữ liệu - CỘNG TỔNG TẤT CẢ CÁC TUẦN
        def get_call_metric_value(content_name):
            if 'Nội dung' not in df_calls.columns or 'Số liệu' not in df_calls.columns:
                return 0

            # Lấy tất cả các hàng có nội dung này và cộng tổng
            result = df_calls[df_calls['Nội dung'] == content_name]['Số liệu']
            if len(result) > 0:
                # Clean data: remove non-breaking spaces and other whitespace characters
                cleaned_result = result.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip()
                # Convert tất cả values thành numeric và cộng tổng
                numeric_values = pd.to_numeric(cleaned_result, errors='coerce').fillna(0)
                total = numeric_values.sum()
                return total
            return 0

        tong_goi = get_call_metric_value('Tổng số cuộc gọi đến Bệnh viện')
        nho_tu_choi = get_call_metric_value('Tổng số cuộc gọi nhỡ do từ chối')
        nho_ko_bat = get_call_metric_value('Tổng số cuộc gọi nhỡ do không bắt máy')
        ty_le_raw = get_call_metric_value('Tỷ lệ trả lời')

        # Tính tỷ lệ trả lời từ dữ liệu có sẵn (tổng cuộc gọi - cuộc gọi nhỡ) / tổng cuộc gọi * 100
        ty_le = 0
        if tong_goi > 0:
            tong_nho = nho_tu_choi + nho_ko_bat
            cuoc_goi_tra_loi = tong_goi - tong_nho
            ty_le = (cuoc_goi_tra_loi / tong_goi) * 100 if tong_goi > 0 else 0

        with col1:
            st.metric("📞 Tổng cuộc gọi", f"{int(tong_goi):,}", help="Tổng số cuộc gọi đến Bệnh viện tất cả các tuần")
        with col2:
            st.metric("❌ Từ chối", f"{int(nho_tu_choi):,}", help="Tổng số cuộc gọi nhỡ do từ chối tất cả các tuần")
        with col3:
            st.metric("📵 Không bắt", f"{int(nho_ko_bat):,}", help="Tổng số cuộc gọi nhỡ do không bắt máy tất cả các tuần")
        with col4:
            st.metric("✅ Tỷ lệ trả lời", f"{ty_le:.1f}%", help="Tỷ lệ trả lời trung bình")

        # Thêm hàng metrics thứ 2
        col5, col6, col7, col8 = st.columns(4)

        nhanh_0 = get_call_metric_value('Số cuộc gọi đến (Nhánh 0-Tổng đài viên)')
        nhanh_1 = get_call_metric_value('Số cuộc gọi đến (Nhánh 1-Cấp cứu)')
        nhanh_2 = get_call_metric_value('Số cuộc gọi đến (Nhánh 2-Tư vấn Thuốc)')
        hotline = get_call_metric_value('Hottline')

        with col5:
            st.metric("📞 Nhánh 0", f"{int(nhanh_0):,}", help="Tổng cuộc gọi đến Nhánh 0-Tổng đài viên tất cả các tuần")
        with col6:
            st.metric("🚑 Nhánh 1", f"{int(nhanh_1):,}", help="Tổng cuộc gọi đến Nhánh 1-Cấp cứu tất cả các tuần")
        with col7:
            st.metric("💊 Nhánh 2", f"{int(nhanh_2):,}", help="Tổng cuộc gọi đến Nhánh 2-Tư vấn Thuốc tất cả các tuần")
        with col8:
            st.metric("📞 Hotline", f"{int(hotline):,}", help="Tổng cuộc gọi Hotline tất cả các tuần")

        st.markdown("<br>", unsafe_allow_html=True)

        # Pivot Table Section - giống như Tab 4
        create_call_pivot_table(df_calls)

        st.markdown("<br>", unsafe_allow_html=True)

        # Biểu đồ tổng quan
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích</div>', unsafe_allow_html=True)

        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            # Biểu đồ phân bố cuộc gọi theo nhánh
            branch_patterns = ['Số cuộc gọi đến (Nhánh 0-Tổng đài viên)', 'Số cuộc gọi đến (Nhánh 1-Cấp cứu)',
                              'Số cuộc gọi đến (Nhánh 2-Tư vấn Thuốc)', 'Số cuộc gọi đến (Nhánh 3-PKQT)',
                              'Số cuộc gọi đến (Nhánh 4-Vấn đề khác)']
            branch_data = df_calls[df_calls['Nội dung'].isin(branch_patterns)].copy()

            if not branch_data.empty:
                # Làm sạch tên hiển thị
                branch_data_clean = branch_data.copy()
                branch_data_clean['Nội dung'] = branch_data_clean['Nội dung'].str.replace('Số cuộc gọi đến (', '').str.replace(')', '')

                fig_branch = px.pie(branch_data_clean, values='Số liệu', names='Nội dung',
                                  title='📞 Phân bố cuộc gọi theo nhánh',
                                  hole=0.4)
                fig_branch.update_layout(height=400)
                st.plotly_chart(fig_branch, use_container_width=True)

        with col_chart2:
            # Biểu đồ tỷ lệ trả lời vs cuộc gọi nhỡ
            response_data = df_calls[df_calls['Nội dung'].isin(['Tổng số cuộc gọi đến Bệnh viện', 'Tổng số cuộc gọi nhỡ do từ chối', 'Tổng số cuộc gọi nhỡ do không bắt máy'])].copy()
            if not response_data.empty:
                # Tính toán dữ liệu hiển thị
                tong_goi_chart = get_call_metric_value('Tổng số cuộc gọi đến Bệnh viện')
                nho_tu_choi_chart = get_call_metric_value('Tổng số cuộc gọi nhỡ do từ chối')
                nho_ko_bat_chart = get_call_metric_value('Tổng số cuộc gọi nhỡ do không bắt máy')
                tra_loi_chart = tong_goi_chart - nho_tu_choi_chart - nho_ko_bat_chart

                response_summary = pd.DataFrame({
                    'Loại': ['Trả lời', 'Từ chối', 'Không bắt'],
                    'Số liệu': [tra_loi_chart, nho_tu_choi_chart, nho_ko_bat_chart]
                })

                fig_response = px.bar(response_summary, x='Loại', y='Số liệu',
                                    title='📊 Tỷ lệ trả lời cuộc gọi',
                                    color='Loại',
                                    color_discrete_map={'Trả lời': '#2ecc71', 'Từ chối': '#e74c3c', 'Không bắt': '#f39c12'})
                fig_response.update_layout(height=400)
                st.plotly_chart(fig_response, use_container_width=True)

        # Biểu đồ phân tích chi tiết
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích chi tiết</div>', unsafe_allow_html=True)

        # Row 1: Biểu đồ tổng quan và phân tích nhánh
        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            # Xu hướng tổng cuộc gọi và cuộc gọi nhỡ theo tuần
            call_time_data = df_calls[df_calls['Nội dung'].isin(['Tổng số cuộc gọi đến Bệnh viện', 'Tổng số cuộc gọi nhỡ do từ chối', 'Tổng số cuộc gọi nhỡ do không bắt máy'])].copy()

            if not call_time_data.empty and 'Tuần' in call_time_data.columns:
                # Convert Số liệu sang số trước khi pivot
                call_time_data['Số liệu'] = pd.to_numeric(call_time_data['Số liệu'], errors='coerce')
                call_pivot = pd.pivot_table(call_time_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0).infer_objects(copy=False)
                call_pivot = call_pivot.reset_index()
                call_pivot['Tuần'] = pd.to_numeric(call_pivot['Tuần'], errors='coerce')
                call_pivot = call_pivot.sort_values('Tuần')

                # Clean data
                for col in call_pivot.columns:
                    if col != 'Tuần':
                        call_pivot[col] = pd.to_numeric(call_pivot[col], errors='coerce').fillna(0)

                if 'Tổng số cuộc gọi đến Bệnh viện' in call_pivot.columns:
                    fig_call_trend = go.Figure()

                    # Tổng cuộc gọi
                    fig_call_trend.add_trace(go.Scatter(
                        x=call_pivot['Tuần'],
                        y=call_pivot['Tổng số cuộc gọi đến Bệnh viện'],
                        mode='lines',
                        name='Tổng cuộc gọi',
                        line=dict(color='#2ecc71', width=3),
                        yaxis='y'
                    ))

                    # Cuộc gọi nhỡ (trục phải) - tính tổng từ chối + không bắt
                    if 'Tổng số cuộc gọi nhỡ do từ chối' in call_pivot.columns and 'Tổng số cuộc gọi nhỡ do không bắt máy' in call_pivot.columns:
                        call_pivot['Tổng cuộc gọi nhỡ'] = call_pivot['Tổng số cuộc gọi nhỡ do từ chối'] + call_pivot['Tổng số cuộc gọi nhỡ do không bắt máy']

                        fig_call_trend.add_trace(go.Scatter(
                            x=call_pivot['Tuần'],
                            y=call_pivot['Tổng cuộc gọi nhỡ'],
                            mode='lines',
                            name='Cuộc gọi nhỡ',
                            line=dict(color='#e74c3c', width=3),
                            yaxis='y2'
                        ))

                    fig_call_trend.update_layout(
                        title='📞 Xu hướng cuộc gọi theo tuần',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Tổng cuộc gọi', side='left', color='#2ecc71'),
                        yaxis2=dict(title='Cuộc gọi nhỡ', side='right', overlaying='y', color='#e74c3c'),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_call_trend, use_container_width=True)

        with col_chart2:
            # Phân tích cuộc gọi theo nhánh
            branch_data = df_calls[df_calls['Nội dung'].str.contains('Nhánh', na=False)]

            if not branch_data.empty and 'Tuần' in branch_data.columns:
                # Lọc chỉ lấy số cuộc gọi đến các nhánh (không lấy nhỡ)
                branch_call_data = branch_data[branch_data['Nội dung'].str.contains('Số cuộc gọi đến', na=False)]

                if not branch_call_data.empty:
                    # Convert Số liệu sang số trước khi pivot
                    branch_call_data['Số liệu'] = pd.to_numeric(branch_call_data['Số liệu'], errors='coerce')
                    branch_pivot = pd.pivot_table(branch_call_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0).infer_objects(copy=False)
                    branch_pivot = branch_pivot.reset_index()
                    branch_pivot['Tuần'] = pd.to_numeric(branch_pivot['Tuần'], errors='coerce')
                    branch_pivot = branch_pivot.sort_values('Tuần')

                    # Clean data
                    for col in branch_pivot.columns:
                        if col != 'Tuần':
                            branch_pivot[col] = pd.to_numeric(branch_pivot[col], errors='coerce').fillna(0)

                    # Tạo biểu đồ stacked bar
                    fig_branch = go.Figure()

                    colors = ['#3498db', '#9b59b6', '#f39c12', '#1abc9c', '#34495e']
                    color_idx = 0

                    for col in branch_pivot.columns:
                        if col != 'Tuần':
                            fig_branch.add_trace(go.Bar(
                                x=branch_pivot['Tuần'],
                                y=branch_pivot[col],
                                name=col.replace('Số cuộc gọi đến (', '').replace(')', ''),
                                marker_color=colors[color_idx % len(colors)]
                            ))
                            color_idx += 1

                    fig_branch.update_layout(
                        title='🔗 Phân bố cuộc gọi theo nhánh',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis_title='Số cuộc gọi',
                        barmode='stack',
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_branch, use_container_width=True)

        # 📈 Biểu đồ phân tích chi tiết
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích chi tiết</div>', unsafe_allow_html=True)

        # Row 2: Biểu đồ phân tích chi tiết theo format dual axis
        col_detail1, col_detail2 = st.columns(2)

        with col_detail1:
            # Biểu đồ phân tích tỷ lệ trả lời và tổng cuộc gọi
            performance_data = df_calls[df_calls['Nội dung'].isin(['Tỷ lệ trả lời', 'Tổng số cuộc gọi đến Bệnh viện'])].copy()

            if not performance_data.empty and 'Tuần' in performance_data.columns:
                # Convert Số liệu sang số trước khi pivot
                performance_data['Số liệu'] = pd.to_numeric(performance_data['Số liệu'], errors='coerce')
                perf_pivot = pd.pivot_table(performance_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0).infer_objects(copy=False)
                perf_pivot = perf_pivot.reset_index()
                perf_pivot['Tuần'] = pd.to_numeric(perf_pivot['Tuần'], errors='coerce')
                perf_pivot = perf_pivot.sort_values('Tuần')

                if 'Tỷ lệ trả lời' in perf_pivot.columns and 'Tổng số cuộc gọi đến Bệnh viện' in perf_pivot.columns:
                    perf_pivot['Tỷ lệ trả lời'] = pd.to_numeric(perf_pivot['Tỷ lệ trả lời'], errors='coerce')
                    perf_pivot['Tổng số cuộc gọi đến Bệnh viện'] = pd.to_numeric(perf_pivot['Tổng số cuộc gọi đến Bệnh viện'], errors='coerce')

                    fig_performance = go.Figure()

                    # Tỷ lệ trả lời
                    fig_performance.add_trace(go.Scatter(
                        x=perf_pivot['Tuần'],
                        y=perf_pivot['Tỷ lệ trả lời'],
                        mode='lines',
                        name='Tỷ lệ trả lời',
                        line=dict(color='#27ae60', width=3),
                        yaxis='y'
                    ))

                    # Tổng cuộc gọi (trục phải)
                    fig_performance.add_trace(go.Scatter(
                        x=perf_pivot['Tuần'],
                        y=perf_pivot['Tổng số cuộc gọi đến Bệnh viện'],
                        mode='lines',
                        name='Tổng cuộc gọi',
                        line=dict(color='#3498db', width=3),
                        yaxis='y2'
                    ))

                    fig_performance.update_layout(
                        title='📈 Tương quan tỷ lệ trả lời - tổng cuộc gọi',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Tỷ lệ trả lời (%)', side='left', color='#27ae60'),
                        yaxis2=dict(title='Tổng cuộc gọi', side='right', overlaying='y', color='#3498db'),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_performance, use_container_width=True)

        with col_detail2:
            # Biểu đồ phân tích hotline và tổng đài viên
            operator_data = df_calls[df_calls['Nội dung'].isin(['Hottline', 'Số cuộc gọi đến (Nhánh 0-Tổng đài viên)'])]

            if not operator_data.empty and 'Tuần' in operator_data.columns:
                # Convert Số liệu sang số trước khi pivot
                operator_data['Số liệu'] = pd.to_numeric(operator_data['Số liệu'], errors='coerce')
                op_pivot = pd.pivot_table(operator_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0).infer_objects(copy=False)
                op_pivot = op_pivot.reset_index()
                op_pivot['Tuần'] = pd.to_numeric(op_pivot['Tuần'], errors='coerce')
                op_pivot = op_pivot.sort_values('Tuần')

                if 'Hottline' in op_pivot.columns and 'Số cuộc gọi đến (Nhánh 0-Tổng đài viên)' in op_pivot.columns:
                    op_pivot['Hottline'] = pd.to_numeric(op_pivot['Hottline'], errors='coerce')
                    op_pivot['Số cuộc gọi đến (Nhánh 0-Tổng đài viên)'] = pd.to_numeric(op_pivot['Số cuộc gọi đến (Nhánh 0-Tổng đài viên)'], errors='coerce')

                    fig_operator = go.Figure()

                    # Hotline
                    fig_operator.add_trace(go.Scatter(
                        x=op_pivot['Tuần'],
                        y=op_pivot['Hottline'],
                        mode='lines',
                        name='Hotline',
                        line=dict(color='#e67e22', width=3),
                        yaxis='y'
                    ))

                    # Tổng đài viên (trục phải)
                    fig_operator.add_trace(go.Scatter(
                        x=op_pivot['Tuần'],
                        y=op_pivot['Số cuộc gọi đến (Nhánh 0-Tổng đài viên)'],
                        mode='lines',
                        name='Nhánh tổng đài viên',
                        line=dict(color='#8e44ad', width=3),
                        yaxis='y2'
                    ))

                    fig_operator.update_layout(
                        title='📞 Phân tích hotline - tổng đài viên',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Hotline', side='left', color='#e67e22'),
                        yaxis2=dict(title='Nhánh tổng đài viên', side='right', overlaying='y', color='#8e44ad'),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_operator, use_container_width=True)

        # ── Heatmap + So sánh tuần ──────────────────────────────────
        st.markdown("---")
        col_heat, col_compare = st.columns(2)

        with col_heat:
            st.markdown("#### 🌡️ Heatmap: Chỉ số theo tuần")
            if 'Nội dung' in df_calls.columns and 'Tuần' in df_calls.columns and 'Số liệu' in df_calls.columns:
                hm_df = df_calls.copy()
                hm_df['Tuần'] = pd.to_numeric(hm_df['Tuần'], errors='coerce')
                hm_df['Số liệu'] = pd.to_numeric(hm_df['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce')
                hm_df = hm_df.dropna(subset=['Tuần', 'Số liệu'])
                if not hm_df.empty:
                    hm_pivot = hm_df.pivot_table(index='Nội dung', columns='Tuần', values='Số liệu', aggfunc='sum')
                    fig_hm = px.imshow(hm_pivot,
                                       labels=dict(x='Tuần', y='Chỉ số', color='Giá trị'),
                                       title='Heatmap chỉ số theo tuần',
                                       color_continuous_scale='Blues', aspect='auto')
                    fig_hm.update_layout(height=380)
                    st.plotly_chart(fig_hm, use_container_width=True)

        with col_compare:
            st.markdown("#### 📊 So sánh tuần hiện tại vs tuần trước")
            if 'Tuần' in df_calls.columns and 'Nội dung' in df_calls.columns:
                tuans = sorted(df_calls['Tuần'].dropna().unique())
                if len(tuans) >= 2:
                    cur_tuan = tuans[-1]
                    prev_tuan = tuans[-2]
                    df_cur = df_calls[df_calls['Tuần'] == cur_tuan]
                    df_prev = df_calls[df_calls['Tuần'] == prev_tuan]

                    def get_val(df, name):
                        r = df[df['Nội dung'] == name]['Số liệu']
                        if len(r) == 0:
                            return 0
                        return pd.to_numeric(r.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce').fillna(0).sum()

                    compare_metrics = [
                        ('📞 Tổng gọi', 'Tổng số cuộc gọi đến Bệnh viện'),
                        ('❌ Từ chối', 'Tổng số cuộc gọi nhỡ do từ chối'),
                        ('📵 Không bắt', 'Tổng số cuộc gọi nhỡ do không bắt máy'),
                        ('📞 Hotline', 'Hottline'),
                    ]
                    c1, c2 = st.columns(2)
                    cols_cmp = [c1, c2, c1, c2]
                    for i, (label, metric) in enumerate(compare_metrics):
                        cur_val = get_val(df_cur, metric)
                        prev_val = get_val(df_prev, metric)
                        delta = cur_val - prev_val
                        delta_str = f"{delta:+,.0f}" if prev_val > 0 else "N/A"
                        with cols_cmp[i]:
                            st.metric(f"{label} (W{int(cur_tuan)})", f"{cur_val:,.0f}", delta=delta_str)

        # Bảng dữ liệu chi tiết
        st.markdown('<div class="section-header">📊 Dữ liệu chi tiết</div>', unsafe_allow_html=True)

        # Hiển thị bảng với formatting
        display_df = df_calls.copy()
        # Clean and format the data display
        def clean_and_format_call_number(x):
            # Clean non-breaking spaces and other whitespace
            cleaned = str(x).replace('\xa0', '').replace(' ', '').strip()
            numeric_val = pd.to_numeric(cleaned, errors='coerce')
            if pd.isna(numeric_val):
                return str(x)  # Return original if conversion fails
            elif numeric_val >= 1:
                return f"{numeric_val:,.0f}"
            else:
                return f"{numeric_val:.1f}"

        display_df['Số liệu'] = display_df['Số liệu'].apply(clean_and_format_call_number)
        st.dataframe(display_df, use_container_width=True, hide_index=True)

    else:
        st.warning("⚠️ Chưa có dữ liệu tổng đài. Vui lòng upload file dữ liệu.")
