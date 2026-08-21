import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def create_parking_pivot_table(df):
    st.markdown("### 📊 Bảng Pivot - Phân tích Bãi giữ xe theo thời gian")

    # CSS cho table lớn hơn và đẹp hơn
    st.markdown("""
    <style>
    .pivot-table-parking {
        font-size: 16px !important;
        font-weight: 500;
    }
    .pivot-table-parking td {
        padding: 12px 8px !important;
        text-align: center !important;
    }
    .pivot-table-parking th {
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
            key="parking_period_type"
        )

    # Dữ liệu Bãi giữ xe có cấu trúc khác - có thể có cột tuần/tháng trực tiếp
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
        # Tạo pivot table với các chỉ số Bãi giữ xe - mở rộng để bao gồm tất cả metrics
        parking_metrics = ['ve_ngay', 've_thang', 'doanh_thu', 'cong_suat', 'ty_le_su_dung', 'khieu_nai']

        # Nếu dữ liệu không có các cột metric, tạo chúng từ Nội dung/Số liệu
        if 'Nội dung' in df_period.columns and 'Số liệu' in df_period.columns:
            df_period['Số liệu'] = pd.to_numeric(
                df_period['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(),
                errors='coerce'
            ).fillna(0)
            for metric in parking_metrics:
                df_period[metric] = 0

            # Mapping các metric từ Nội dung - dựa trên data thực tế
            metric_mapping = {
                've_ngay': ['Tổng số lượt vé ngày'],
                've_thang': ['Tổng số lượt vé tháng'],
                'doanh_thu': ['Doanh thu'],
                'cong_suat': ['Công suất trung bình/ngày'],
                'ty_le_su_dung': ['Tỷ lệ sử dụng'],
                'khieu_nai': ['Số phản ánh khiếu nại']
            }

            for metric, content_names in metric_mapping.items():
                for content_name in content_names:
                    mask = df_period['Nội dung'] == content_name
                    df_period.loc[mask, metric] = pd.to_numeric(df_period.loc[mask, 'Số liệu'], errors='coerce').fillna(0)

        # Tạo pivot data
        pivot_data = df_period.groupby(['period', 'period_sort'])[parking_metrics].sum().reset_index()
        pivot_data = pivot_data.sort_values('period_sort', ascending=False)

        # Tính toán biến động so với kỳ trước
        for col in parking_metrics:
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
                if col == 'ty_le_su_dung':
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
            if col == 'ty_le_su_dung':
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

        for col in parking_metrics:
            new_col = f'{col}_display'
            display_data[new_col] = display_data.apply(lambda row: format_cell_with_change(row, col), axis=1)
            display_columns.append(new_col)

            # Mapping tên cột cho hiển thị
            metric_names = {
                've_ngay': 'Vé ngày',
                've_thang': 'Vé tháng',
                'doanh_thu': 'Doanh thu (VND)',
                'cong_suat': 'Công suất',
                'ty_le_su_dung': 'Tỷ lệ SD (%)',
                'khieu_nai': 'Khiếu nại'
            }
            column_names[new_col] = metric_names.get(col, col)

        st.markdown(f"#### 📋 Tổng hợp theo {period_type} (bao gồm biến động)")

        # Hiển thị bảng với HTML để render màu sắc
        df_display = display_data[display_columns].rename(columns=column_names)

        # Tạo HTML table với sticky header
        html_table = "<div style='max-height: 400px; overflow-y: auto; border: 1px solid #ddd;'><table class='pivot-table-parking' style='width: 100%; border-collapse: collapse; font-size: 16px;'>"

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

    st.markdown('<div class="tab-header">🅿️ Báo cáo Bãi giữ xe</div>', unsafe_allow_html=True)

    def create_parking_data():
        """Tạo dữ liệu mẫu cho bãi giữ xe"""
        return pd.DataFrame({
            'Tuần': [39] * 6,
            'Tháng': [9] * 6,
            'Nội dung': [
                'Tổng số lượt vé ngày',
                'Tổng số lượt vé tháng',
                'Công suất trung bình/ngày',
                'Doanh thu',
                'Số phản ánh khiếu nại',
                'Tỷ lệ sử dụng'
            ],
            'Số liệu': [1850, 145, 265, 18500000, 8, 78.5]
        })

    # Load data từ DataManager hoặc dữ liệu mẫu
    df_parking = data_manager.get_category_data('Bãi giữ xe')

    if df_parking is None:
        df_parking = create_parking_data()

    if not df_parking.empty:
        # Hiển thị phạm vi dữ liệu
        _tuan_col = 'Tuần' if 'Tuần' in df_parking.columns else None
        _thang_col = 'Tháng' if 'Tháng' in df_parking.columns else None
        if _tuan_col:
            _tuan_min = int(df_parking[_tuan_col].dropna().min())
            _tuan_max = int(df_parking[_tuan_col].dropna().max())
            _thang_info = f", Tháng {int(df_parking[_thang_col].dropna().min())}–{int(df_parking[_thang_col].dropna().max())}" if _thang_col else ""
            st.info(f"📅 Dữ liệu từ **Tuần {_tuan_min}** đến **Tuần {_tuan_max}**{_thang_info}")

        # Metrics overview tổng quan
        st.markdown('<div class="section-header">📊 Tổng quan hoạt động Bãi giữ xe</div>', unsafe_allow_html=True)

        col1, col2, col3, col4 = st.columns(4)

        # Tính toán metrics từ dữ liệu - CỘNG TỔNG TẤT CẢ CÁC TUẦN
        def get_parking_metric_value(content_name):
            if 'Nội dung' not in df_parking.columns or 'Số liệu' not in df_parking.columns:
                return 0

            # Lấy tất cả các hàng có nội dung này và cộng tổng
            result = df_parking[df_parking['Nội dung'] == content_name]['Số liệu']
            if len(result) > 0:
                # Clean data: remove non-breaking spaces and other whitespace characters
                cleaned_result = result.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip()
                # Convert tất cả values thành numeric và cộng tổng
                numeric_values = pd.to_numeric(cleaned_result, errors='coerce').fillna(0)
                total = numeric_values.sum()
                return total
            return 0

        ve_ngay = get_parking_metric_value('Tổng số lượt vé ngày')
        ve_thang = get_parking_metric_value('Tổng số lượt vé tháng')
        doanh_thu = get_parking_metric_value('Doanh thu')
        khieu_nai = get_parking_metric_value('Số phản ánh khiếu nại')

        with col1:
            st.metric("🎫 Vé ngày", f"{int(ve_ngay):,}", help="Tổng số lượt vé ngày tất cả các tuần")
        with col2:
            st.metric("📅 Vé tháng", f"{int(ve_thang):,}", help="Tổng số lượt vé tháng tất cả các tuần")
        with col3:
            st.metric("💰 Doanh thu", f"{int(doanh_thu):,} VND", help="Tổng doanh thu tất cả các tuần")
        with col4:
            st.metric("📢 Khiếu nại", f"{int(khieu_nai):,}", help="Tổng số phản ánh khiếu nại tất cả các tuần")

        # Thêm hàng metrics thứ 2
        col5, col6, col7, col8 = st.columns(4)

        cong_suat = get_parking_metric_value('Công suất trung bình/ngày')
        ty_le_su_dung = get_parking_metric_value('Tỷ lệ sử dụng')
        # Tính tổng vé (ngày + tháng)
        tong_ve = ve_ngay + ve_thang
        # Tính doanh thu trung bình mỗi vé
        doanh_thu_per_ve = (doanh_thu / tong_ve) if tong_ve > 0 else 0

        with col5:
            st.metric("⚡ Công suất", f"{int(cong_suat):,} xe/ngày", help="Công suất trung bình mỗi ngày tất cả các tuần")
        with col6:
            st.metric("📊 Tỷ lệ SD", f"{ty_le_su_dung:.1f}%", help="Tỷ lệ sử dụng trung bình tất cả các tuần")
        with col7:
            st.metric("📝 Tổng vé", f"{int(tong_ve):,}", help="Tổng tất cả vé (ngày + tháng)")
        with col8:
            st.metric("💵 DT/vé", f"{int(doanh_thu_per_ve):,} VND", help="Doanh thu trung bình mỗi vé")

        st.markdown("<br>", unsafe_allow_html=True)

        # Pivot Table Section - giống như Tab 4
        create_parking_pivot_table(df_parking)

        st.markdown("<br>", unsafe_allow_html=True)

        # Biểu đồ tổng quan
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích</div>', unsafe_allow_html=True)

        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            # Biểu đồ phân bố vé ngày vs vé tháng
            ticket_data = df_parking[df_parking['Nội dung'].isin(['Tổng số lượt vé ngày', 'Tổng số lượt vé tháng'])].copy()

            if not ticket_data.empty:
                # Làm sạch tên hiển thị
                ticket_data_clean = ticket_data.copy()
                ticket_data_clean['Nội dung'] = ticket_data_clean['Nội dung'].str.replace('Tổng số lượt ', '')

                fig_ticket = px.pie(ticket_data_clean, values='Số liệu', names='Nội dung',
                                  title='🎫 Phân bố loại vé',
                                  hole=0.4)
                fig_ticket.update_layout(height=400)
                st.plotly_chart(fig_ticket, use_container_width=True)

        with col_chart2:
            # Biểu đồ doanh thu và khiếu nại
            summary_data = pd.DataFrame({
                'Chỉ số': ['Doanh thu (triệu VND)', 'Khiếu nại'],
                'Giá trị': [doanh_thu/1000000, khieu_nai]  # Doanh thu tính theo triệu
            })

            fig_summary = px.bar(summary_data, x='Chỉ số', y='Giá trị',
                               title='💰 Doanh thu và Khiếu nại',
                               color='Chỉ số',
                               color_discrete_map={'Doanh thu (triệu VND)': '#2ecc71', 'Khiếu nại': '#e74c3c'})
            fig_summary.update_layout(height=400, yaxis_title='Giá trị')
            st.plotly_chart(fig_summary, use_container_width=True)

        # Biểu đồ phân tích chi tiết
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích chi tiết</div>', unsafe_allow_html=True)

        # Row 1: Biểu đồ tổng quan hoạt động
        col_detail1, col_detail2 = st.columns(2)

        with col_detail1:
            # Xu hướng doanh thu và số vé theo tuần
            parking_time_data = df_parking[df_parking['Nội dung'].isin(['Doanh thu', 'Tổng số lượt vé ngày', 'Tổng số lượt vé tháng'])].copy()

            if not parking_time_data.empty and 'Tuần' in parking_time_data.columns:
                # Convert Số liệu sang số trước khi pivot
                parking_time_data['Số liệu'] = pd.to_numeric(parking_time_data['Số liệu'], errors='coerce')
                parking_pivot = pd.pivot_table(parking_time_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0).infer_objects(copy=False)
                parking_pivot = parking_pivot.reset_index()
                parking_pivot['Tuần'] = pd.to_numeric(parking_pivot['Tuần'], errors='coerce')
                parking_pivot = parking_pivot.sort_values('Tuần')

                # Clean data
                for col in parking_pivot.columns:
                    if col != 'Tuần':
                        parking_pivot[col] = pd.to_numeric(parking_pivot[col], errors='coerce').fillna(0)

                # Tính tổng vé
                if 'Tổng số lượt vé ngày' in parking_pivot.columns and 'Tổng số lượt vé tháng' in parking_pivot.columns:
                    parking_pivot['Tổng vé'] = parking_pivot['Tổng số lượt vé ngày'] + parking_pivot['Tổng số lượt vé tháng']

                if 'Doanh thu' in parking_pivot.columns and 'Tổng vé' in parking_pivot.columns:
                    fig_parking_trend = go.Figure()

                    # Doanh thu (trục trái)
                    fig_parking_trend.add_trace(go.Scatter(
                        x=parking_pivot['Tuần'],
                        y=parking_pivot['Doanh thu'],
                        mode='lines',
                        name='Doanh thu',
                        line=dict(color='#2ecc71', width=3),
                        yaxis='y'
                    ))

                    # Tổng vé (trục phải)
                    fig_parking_trend.add_trace(go.Scatter(
                        x=parking_pivot['Tuần'],
                        y=parking_pivot['Tổng vé'],
                        mode='lines',
                        name='Tổng vé',
                        line=dict(color='#3498db', width=3),
                        yaxis='y2'
                    ))

                    fig_parking_trend.update_layout(
                        title='💰 Xu hướng doanh thu và số vé theo tuần',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Doanh thu (VND)', side='left', color='#2ecc71'),
                        yaxis2=dict(title='Số vé', side='right', overlaying='y', color='#3498db'),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_parking_trend, use_container_width=True)

        with col_detail2:
            # Phân tích công suất và tỷ lệ sử dụng
            capacity_data = df_parking[df_parking['Nội dung'].isin(['Công suất trung bình/ngày', 'Tỷ lệ sử dụng', 'Số phản ánh khiếu nại'])].copy()

            if not capacity_data.empty and 'Tuần' in capacity_data.columns:
                # Convert Số liệu sang số trước khi pivot
                capacity_data['Số liệu'] = pd.to_numeric(capacity_data['Số liệu'], errors='coerce')
                capacity_pivot = pd.pivot_table(capacity_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0).infer_objects(copy=False)
                capacity_pivot = capacity_pivot.reset_index()
                capacity_pivot['Tuần'] = pd.to_numeric(capacity_pivot['Tuần'], errors='coerce')
                capacity_pivot = capacity_pivot.sort_values('Tuần')

                # Clean data
                for col in capacity_pivot.columns:
                    if col != 'Tuần':
                        capacity_pivot[col] = pd.to_numeric(capacity_pivot[col], errors='coerce').fillna(0)

                if 'Công suất trung bình/ngày' in capacity_pivot.columns and 'Tỷ lệ sử dụng' in capacity_pivot.columns:
                    fig_capacity = go.Figure()

                    # Công suất (trục trái)
                    fig_capacity.add_trace(go.Scatter(
                        x=capacity_pivot['Tuần'],
                        y=capacity_pivot['Công suất trung bình/ngày'],
                        mode='lines',
                        name='Công suất',
                        line=dict(color='#9b59b6', width=3),
                        yaxis='y'
                    ))

                    # Tỷ lệ sử dụng (trục phải)
                    fig_capacity.add_trace(go.Scatter(
                        x=capacity_pivot['Tuần'],
                        y=capacity_pivot['Tỷ lệ sử dụng'],
                        mode='lines',
                        name='Tỷ lệ sử dụng (%)',
                        line=dict(color='#f39c12', width=3),
                        yaxis='y2'
                    ))

                    # Khiếu nại (nếu có)
                    if 'Số phản ánh khiếu nại' in capacity_pivot.columns:
                        fig_capacity.add_trace(go.Bar(
                            x=capacity_pivot['Tuần'],
                            y=capacity_pivot['Số phản ánh khiếu nại'],
                            name='Khiếu nại',
                            marker_color='#e74c3c',
                            opacity=0.7,
                            yaxis='y'
                        ))

                    fig_capacity.update_layout(
                        title='⚡ Phân tích công suất và chất lượng',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Công suất / Khiếu nại', side='left', color='#9b59b6'),
                        yaxis2=dict(title='Tỷ lệ sử dụng (%)', side='right', overlaying='y', color='#f39c12'),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_capacity, use_container_width=True)

        # ── Heatmap + So sánh tuần ──────────────────────────────────
        st.markdown("---")
        col_heat, col_compare = st.columns(2)

        with col_heat:
            st.markdown("#### 🌡️ Heatmap: Chỉ số theo tuần")
            if 'Nội dung' in df_parking.columns and 'Tuần' in df_parking.columns and 'Số liệu' in df_parking.columns:
                hm_df = df_parking.copy()
                hm_df['Tuần'] = pd.to_numeric(hm_df['Tuần'], errors='coerce')
                hm_df['Số liệu'] = pd.to_numeric(hm_df['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce')
                hm_df = hm_df.dropna(subset=['Tuần', 'Số liệu'])
                if not hm_df.empty:
                    hm_pivot = hm_df.pivot_table(index='Nội dung', columns='Tuần', values='Số liệu', aggfunc='sum')
                    fig_hm = px.imshow(hm_pivot,
                                       labels=dict(x='Tuần', y='Chỉ số', color='Giá trị'),
                                       title='Heatmap chỉ số theo tuần',
                                       color_continuous_scale='Greens', aspect='auto')
                    fig_hm.update_layout(height=350)
                    st.plotly_chart(fig_hm, use_container_width=True)

        with col_compare:
            st.markdown("#### 📊 So sánh tuần hiện tại vs tuần trước")
            if 'Tuần' in df_parking.columns and 'Nội dung' in df_parking.columns:
                tuans = sorted(df_parking['Tuần'].dropna().unique())
                if len(tuans) >= 2:
                    cur_tuan = tuans[-1]
                    prev_tuan = tuans[-2]
                    df_cur = df_parking[df_parking['Tuần'] == cur_tuan]
                    df_prev = df_parking[df_parking['Tuần'] == prev_tuan]

                    def get_val(df, name):
                        r = df[df['Nội dung'] == name]['Số liệu']
                        if len(r) == 0:
                            return 0
                        return pd.to_numeric(r.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce').fillna(0).sum()

                    compare_metrics = [
                        ('🎫 Vé ngày', 'Tổng số lượt vé ngày'),
                        ('📅 Vé tháng', 'Tổng số lượt vé tháng'),
                        ('💰 Doanh thu', 'Doanh thu'),
                        ('📢 Khiếu nại', 'Số phản ánh khiếu nại'),
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
        display_df = df_parking.copy()
        # Clean and format the data display
        def clean_and_format_parking_number(x):
            # Clean non-breaking spaces and other whitespace
            cleaned = str(x).replace('\xa0', '').replace(' ', '').strip()
            numeric_val = pd.to_numeric(cleaned, errors='coerce')
            if pd.isna(numeric_val):
                return str(x)  # Return original if conversion fails
            elif numeric_val >= 1:
                return f"{numeric_val:,.0f}"
            else:
                return f"{numeric_val:.1f}"

        display_df['Số liệu'] = display_df['Số liệu'].apply(clean_and_format_parking_number)
        st.dataframe(display_df, use_container_width=True, hide_index=True)

    else:
        st.warning("⚠️ Chưa có dữ liệu bãi giữ xe. Vui lòng upload file dữ liệu.")
