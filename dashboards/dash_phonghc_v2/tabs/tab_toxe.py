import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def create_vehicle_pivot_table(df):
    st.markdown("### 📊 Bảng Pivot - Phân tích Tổ xe theo thời gian")

    # CSS cho table lớn hơn và đẹp hơn
    st.markdown("""
    <style>
    .pivot-table-vehicle {
        font-size: 16px !important;
        font-weight: 500;
    }
    .pivot-table-vehicle td {
        padding: 12px 8px !important;
        text-align: center !important;
    }
    .pivot-table-vehicle th {
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
            options=['Tuần', 'Tháng', 'Năm'],
            index=0,
            key="vehicle_period_type"
        )

    has_time_data = False
    df_period = df.copy()

    if 'Tuần' in df.columns or 'Tháng' in df.columns:
        has_time_data = True

        if period_type == 'Tuần' and 'Tuần' in df.columns:
            df_period['period'] = 'W' + df_period['Tuần'].astype(str)
            df_period['period_sort'] = pd.to_numeric(df_period['Tuần'], errors='coerce')
        elif period_type == 'Tháng' and 'Tháng' in df.columns:
            df_period['period'] = 'T' + df_period['Tháng'].astype(str)
            df_period['period_sort'] = pd.to_numeric(df_period['Tháng'], errors='coerce')
        elif period_type == 'Năm':
            df_period['period'] = '2025'
            df_period['period_sort'] = 2025
        else:
            if 'Tuần' in df.columns:
                df_period['period'] = 'W' + df_period['Tuần'].astype(str)
                df_period['period_sort'] = pd.to_numeric(df_period['Tuần'], errors='coerce')
            else:
                has_time_data = False

    elif 'datetime' in df.columns:
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
        has_time_data = False

    if has_time_data:
        vehicle_metrics = ['so_chuyen', 'km_chay', 'doanh_thu', 'nhien_lieu', 'bao_duong', 'hai_long', 'km_hanh_chinh', 'km_cuu_thuong', 'phieu_khao_sat']

        if 'Nội dung' in df_period.columns and 'Số liệu' in df_period.columns:
            df_period['Số liệu'] = pd.to_numeric(
                df_period['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(),
                errors='coerce'
            ).fillna(0)
            for metric in vehicle_metrics:
                df_period[metric] = 0

            metric_mapping = {
                'so_chuyen': ['Số chuyến xe'],
                'km_chay': ['Tổng km chạy'],
                'doanh_thu': ['Doanh thu Tổ xe'],
                'nhien_lieu': ['Tổng số nhiên liệu tiêu thụ'],
                'bao_duong': ['Chi phí bảo dưỡng'],
                'hai_long': ['Tỷ lệ hài lòng của khách hàng'],
                'km_hanh_chinh': ['Km chạy của Km chạy của xe hành chính', 'Km chạy của xe hành chính', 'Km chạy của hành chính'],
                'km_cuu_thuong': ['Km chạy của Km chạy của xe cứu thương', 'Km chạy của xe cứu thương'],
                'phieu_khao_sat': ['Số phiếu khảo sát hài lòng']
            }

            for metric, content_names in metric_mapping.items():
                for content_name in content_names:
                    mask = df_period['Nội dung'] == content_name
                    df_period.loc[mask, metric] = pd.to_numeric(df_period.loc[mask, 'Số liệu'], errors='coerce').fillna(0)

        pivot_data = df_period.groupby(['period', 'period_sort'])[vehicle_metrics].sum().reset_index()
        pivot_data = pivot_data.sort_values('period_sort', ascending=False)

        for col in vehicle_metrics:
            pivot_data[f'{col}_prev'] = pivot_data[col].shift(-1)
            pivot_data[f'{col}_change'] = pivot_data[col] - pivot_data[f'{col}_prev']
            pivot_data[f'{col}_change_pct'] = ((pivot_data[col] / pivot_data[f'{col}_prev'] - 1) * 100).round(1)
            pivot_data[f'{col}_change_pct'] = pivot_data[f'{col}_change_pct'].fillna(0)

        display_data = pivot_data.copy()

        def format_cell_with_change(row, col):
            current_val = row[col]
            change_val = row[f'{col}_change']
            change_pct = row[f'{col}_change_pct']
            prev_val = row[f'{col}_prev']

            if pd.isna(prev_val) or prev_val == 0:
                return f"{int(current_val):,}"

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

            return f"""<div style="text-align: center; line-height: 1.2;">
                <div style="font-size: 16px; font-weight: 600;">{int(current_val):,}</div>
                <div class="{color_class}" style="font-size: 12px; margin-top: 2px;">
                    {arrow} {sign}{int(change_val):,} ({change_pct:+.1f}%)
                </div>
            </div>"""

        display_columns = ['period']
        column_names = {f'period': f'{period_type}'}

        for col in vehicle_metrics:
            new_col = f'{col}_display'
            display_data[new_col] = display_data.apply(lambda row: format_cell_with_change(row, col), axis=1)
            display_columns.append(new_col)

            metric_names = {
                'so_chuyen': 'Số chuyến',
                'km_chay': 'Tổng km',
                'doanh_thu': 'Doanh thu (VNĐ)',
                'nhien_lieu': 'Nhiên liệu (L)',
                'bao_duong': 'Bảo dưỡng (VNĐ)',
                'hai_long': 'Hài lòng (%)',
                'km_hanh_chinh': 'Km hành chính',
                'km_cuu_thuong': 'Km cứu thương',
                'phieu_khao_sat': 'Phiếu khảo sát'
            }
            column_names[new_col] = metric_names.get(col, col)

        st.markdown(f"#### 📋 Tổng hợp theo {period_type} (bao gồm biến động)")

        df_display = display_data[display_columns].rename(columns=column_names)

        html_table = "<div style='max-height: 400px; overflow-y: auto; border: 1px solid #ddd;'><table class='pivot-table-vehicle' style='width: 100%; border-collapse: collapse; font-size: 16px;'>"
        html_table += "<thead><tr>"
        for col in df_display.columns:
            html_table += f"<th style='position: sticky; top: 0; padding: 15px 8px; text-align: center; background-color: #f0f2f6; font-weight: bold; font-size: 17px; border: 1px solid #ddd; z-index: 10;'>{col}</th>"
        html_table += "</tr></thead>"
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
        if 'Nội dung' in df.columns and 'Số liệu' in df.columns:
            summary_data = df[['Nội dung', 'Số liệu']].copy()
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


def create_vehicle_charts(df):
    col1, col2 = st.columns(2)

    with col1:
        revenue_data = df[df['Nội dung'] == 'Doanh thu Tổ xe']
        if not revenue_data.empty and 'Tuần' in revenue_data.columns:
            revenue_trend = revenue_data.copy()
            revenue_trend['Tuần'] = pd.to_numeric(revenue_trend['Tuần'], errors='coerce')
            revenue_trend['Doanh thu'] = pd.to_numeric(revenue_trend['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce')
            revenue_trend = revenue_trend.dropna().sort_values('Tuần')

            fig_revenue = go.Figure()
            fig_revenue.add_trace(go.Scatter(
                x=revenue_trend['Tuần'],
                y=revenue_trend['Doanh thu'],
                mode='lines+markers',
                name='Doanh thu',
                line=dict(color='#1f77b4', width=2),
                marker=dict(size=8)
            ))

            if len(revenue_trend) >= 3:
                ma_window = min(3, len(revenue_trend)//2)
                ma_trend = revenue_trend['Doanh thu'].rolling(window=ma_window, center=True).mean()
                fig_revenue.add_trace(go.Scatter(
                    x=revenue_trend['Tuần'],
                    y=ma_trend,
                    mode='lines',
                    name=f'Xu hướng ({ma_window} tuần)',
                    line=dict(color='red', width=3, dash='dash'),
                    opacity=0.8
                ))

            fig_revenue.update_layout(
                title='💰 Doanh thu theo tuần (có xu hướng)',
                xaxis_title='Tuần',
                yaxis_title='Doanh thu (VNĐ)',
                hovermode='x unified'
            )
            st.plotly_chart(fig_revenue, use_container_width=True)

    with col2:
        km_data = df[df['Nội dung'] == 'Tổng km chạy']
        if not km_data.empty and 'Tuần' in km_data.columns:
            km_trend = km_data.copy()
            km_trend['Tuần'] = pd.to_numeric(km_trend['Tuần'], errors='coerce')
            km_trend['Km chạy'] = pd.to_numeric(km_trend['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce')
            km_trend = km_trend.dropna().sort_values('Tuần')

            fig_km = go.Figure()
            fig_km.add_trace(go.Scatter(
                x=km_trend['Tuần'],
                y=km_trend['Km chạy'],
                mode='lines+markers',
                name='Km chạy',
                line=dict(color='#1f77b4', width=2),
                marker=dict(size=8)
            ))

            if len(km_trend) >= 3:
                ma_window = min(3, len(km_trend)//2)
                ma_trend = km_trend['Km chạy'].rolling(window=ma_window, center=True).mean()
                fig_km.add_trace(go.Scatter(
                    x=km_trend['Tuần'],
                    y=ma_trend,
                    mode='lines',
                    name=f'Xu hướng ({ma_window} tuần)',
                    line=dict(color='red', width=3, dash='dash'),
                    opacity=0.8
                ))

            fig_km.update_layout(
                title='🛣️ Km chạy theo tuần (có xu hướng)',
                xaxis_title='Tuần',
                yaxis_title='Km chạy',
                hovermode='x unified'
            )
            st.plotly_chart(fig_km, use_container_width=True)


def render():
    data_manager = st.session_state.get('data_manager')

    st.markdown('<div class="tab-header">🚗 Báo cáo Tổ xe</div>', unsafe_allow_html=True)

    def create_vehicle_data():
        """Tạo dữ liệu mẫu cho tổ xe từ format đã cho"""
        return pd.DataFrame({
            'Tuần': [39, 39, 39, 39, 39, 39, 39, 39, 39],
            'Tháng': [9, 9, 9, 9, 9, 9, 9, 9, 9],
            'Nội dung': [
                'Số chuyến xe',
                'Tổng số nhiên liệu tiêu thụ',
                'Tổng km chạy',
                'Km chạy của hành chính',
                'Km chạy của xe cứu thương',
                'Chi phí bảo dưỡng',
                'Doanh thu Tổ xe',
                'Số phiếu khảo sát hài lòng',
                'Tỷ lệ hài lòng của khách hàng'
            ],
            'Số liệu': [245, 1200, 8500, 5200, 3300, 15000000, 25000000, 180, 92.5]
        })

    # Load data từ DataManager hoặc dữ liệu mẫu
    df_vehicle = data_manager.get_category_data('Tổ xe')

    if df_vehicle is None:
        df_vehicle = create_vehicle_data()

    if not df_vehicle.empty:
        # Hiển thị phạm vi dữ liệu
        _tuan_col = 'Tuần' if 'Tuần' in df_vehicle.columns else None
        _thang_col = 'Tháng' if 'Tháng' in df_vehicle.columns else None
        if _tuan_col:
            _tuan_min = int(df_vehicle[_tuan_col].dropna().min())
            _tuan_max = int(df_vehicle[_tuan_col].dropna().max())
            _thang_info = f", Tháng {int(df_vehicle[_thang_col].dropna().min())}–{int(df_vehicle[_thang_col].dropna().max())}" if _thang_col else ""
            st.info(f"📅 Dữ liệu từ **Tuần {_tuan_min}** đến **Tuần {_tuan_max}**{_thang_info}")

        st.markdown('<div class="section-header">📊 Tổng quan hoạt động Tổ xe</div>', unsafe_allow_html=True)

        col1, col2, col3, col4 = st.columns(4)

        def get_metric_value(content_name):
            if 'Nội dung' not in df_vehicle.columns or 'Số liệu' not in df_vehicle.columns:
                return 0
            result = df_vehicle[df_vehicle['Nội dung'] == content_name]['Số liệu']
            if len(result) > 0:
                cleaned_result = result.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip()
                numeric_values = pd.to_numeric(cleaned_result, errors='coerce').fillna(0)
                total = numeric_values.sum()
                return total
            return 0

        so_chuyen = get_metric_value('Số chuyến xe')
        km_chay = get_metric_value('Tổng km chạy')
        doanh_thu = get_metric_value('Doanh thu Tổ xe')

        with col1:
            st.metric("🚗 Số chuyến", f"{int(so_chuyen):,}", help="Tổng số chuyến xe tất cả các tuần")
        with col2:
            st.metric("🛣️ Tổng km", f"{int(km_chay):,}", help="Tổng số kilomet đã chạy tất cả các tuần")
        with col3:
            st.metric("💰 Doanh thu", f"{int(doanh_thu):,}", help="Tổng doanh thu Tổ xe tất cả các tuần (VNĐ)")
        with col4:
            hai_long_data = df_vehicle[df_vehicle['Nội dung'] == 'Tỷ lệ hài lòng của khách hàng']['Số liệu']
            if len(hai_long_data) > 0:
                cleaned_hai_long = hai_long_data.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip()
                hai_long_numeric = pd.to_numeric(cleaned_hai_long, errors='coerce')
                hai_long_valid = hai_long_numeric[hai_long_numeric > 0]
                hai_long_avg = hai_long_valid.mean() if len(hai_long_valid) > 0 else 0
            else:
                hai_long_avg = 0
            st.metric("😊 Hài lòng", f"{hai_long_avg:.1f}%", help="Tỷ lệ hài lòng trung bình (chỉ tính tuần có khảo sát)")

        col5, col6, col7, col8 = st.columns(4)

        nhien_lieu = get_metric_value('Tổng số nhiên liệu tiêu thụ')
        km_hanh_chinh = get_metric_value('Km chạy của Km chạy của xe hành chính') or get_metric_value('Km chạy của hành chính')
        km_cuu_thuong = get_metric_value('Km chạy của Km chạy của xe cứu thương') or get_metric_value('Km chạy của xe cứu thương')
        bao_duong = get_metric_value('Chi phí bảo dưỡng')

        with col5:
            st.metric("⛽ Nhiên liệu", f"{int(nhien_lieu):,}", help="Tổng nhiên liệu tiêu thụ tất cả các tuần (lít)")
        with col6:
            st.metric("🏢 Hành chính", f"{int(km_hanh_chinh):,} km", help="Tổng km chạy hành chính tất cả các tuần")
        with col7:
            st.metric("🚑 Cứu thương", f"{int(km_cuu_thuong):,} km", help="Tổng km chạy xe cứu thương tất cả các tuần")
        with col8:
            st.metric("🔧 Bảo dưỡng", f"{int(bao_duong):,}", help="Tổng chi phí bảo dưỡng tất cả các tuần (VNĐ)")

        st.markdown("<br>", unsafe_allow_html=True)

        create_vehicle_pivot_table(df_vehicle)

        st.markdown("<br>", unsafe_allow_html=True)

        st.markdown('<div class="section-header">📈 Biểu đồ phân tích</div>', unsafe_allow_html=True)

        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            km_patterns = ['Km chạy của Km chạy của xe hành chính', 'Km chạy của Km chạy của xe cứu thương',
                          'Km chạy của hành chính', 'Km chạy của xe cứu thương']
            km_data = df_vehicle[df_vehicle['Nội dung'].isin(km_patterns)].copy()

            if not km_data.empty:
                km_data_clean = km_data.copy()
                km_data_clean['Nội dung'] = km_data_clean['Nội dung'].str.replace('Km chạy của Km chạy của xe ', '').str.replace('Km chạy của ', '')

                fig_km = px.pie(km_data_clean, values='Số liệu', names='Nội dung',
                              title='🛣️ Phân bố Km chạy theo loại xe',
                              hole=0.4)
                fig_km.update_layout(height=400)
                st.plotly_chart(fig_km, use_container_width=True)

        with col_chart2:
            finance_data = df_vehicle[df_vehicle['Nội dung'].isin(['Doanh thu Tổ xe', 'Chi phí bảo dưỡng'])].copy()
            if not finance_data.empty:
                fig_finance = px.bar(finance_data, x='Nội dung', y='Số liệu',
                                   title='💰 So sánh Doanh thu - Chi phí',
                                   color='Nội dung')
                fig_finance.update_layout(height=400)
                st.plotly_chart(fig_finance, use_container_width=True)

        st.markdown('<div class="section-header">📈 Biểu đồ phân tích chi tiết</div>', unsafe_allow_html=True)

        col_chart3, col_chart4 = st.columns(2)

        with col_chart3:
            vehicle_time_data = df_vehicle[df_vehicle['Nội dung'].isin(['Số chuyến xe', 'Doanh thu Tổ xe'])].copy()

            if not vehicle_time_data.empty and 'Tuần' in vehicle_time_data.columns:
                time_pivot = pd.pivot_table(
                    vehicle_time_data,
                    index='Tuần',
                    columns='Nội dung',
                    values='Số liệu',
                    aggfunc='sum',
                    fill_value=0
                )
                time_pivot = time_pivot.reset_index()
                time_pivot['Tuần'] = pd.to_numeric(time_pivot['Tuần'], errors='coerce')
                time_pivot = time_pivot.sort_values('Tuần')

                if 'Doanh thu Tổ xe' in time_pivot.columns and 'Số chuyến xe' in time_pivot.columns:
                    time_pivot['Doanh thu Tổ xe'] = pd.to_numeric(time_pivot['Doanh thu Tổ xe'], errors='coerce')
                    time_pivot['Số chuyến xe'] = pd.to_numeric(time_pivot['Số chuyến xe'], errors='coerce')

                    fig_trend = go.Figure()
                    fig_trend.add_trace(go.Scatter(x=time_pivot['Tuần'], y=time_pivot['Doanh thu Tổ xe'], name='Doanh thu', line=dict(color='#2ecc71', width=3), yaxis='y'))
                    fig_trend.add_trace(go.Scatter(x=time_pivot['Tuần'], y=time_pivot['Số chuyến xe'], name='Số chuyến', line=dict(color='#3498db', width=3), yaxis='y2'))
                    fig_trend.update_layout(
                        title='📈 Xu hướng doanh thu và số chuyến theo tuần', height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Doanh thu (VNĐ)', side='left', color='#2ecc71'),
                        yaxis2=dict(title='Số chuyến', side='right', overlaying='y', color='#3498db'),
                        legend=dict(orientation="h", yanchor="bottom", y=-0.35, xanchor="center", x=0.5),
                        margin=dict(b=100)
                    )
                    st.plotly_chart(fig_trend, use_container_width=True)

        with col_chart4:
            km_time_data = df_vehicle[df_vehicle['Nội dung'].isin(['Tổng km chạy', 'Tổng số nhiên liệu tiêu thụ'])].copy()

            if not km_time_data.empty and 'Tuần' in km_time_data.columns:
                km_time_data['Số liệu'] = pd.to_numeric(km_time_data['Số liệu'], errors='coerce')
                km_pivot = pd.pivot_table(km_time_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0)
                km_pivot = km_pivot.reset_index()
                km_pivot['Tuần'] = pd.to_numeric(km_pivot['Tuần'], errors='coerce')
                km_pivot = km_pivot.sort_values('Tuần')

                if 'Tổng km chạy' in km_pivot.columns and 'Tổng số nhiên liệu tiêu thụ' in km_pivot.columns:
                    km_pivot['Tổng km chạy'] = pd.to_numeric(km_pivot['Tổng km chạy'], errors='coerce')
                    km_pivot['Tổng số nhiên liệu tiêu thụ'] = pd.to_numeric(km_pivot['Tổng số nhiên liệu tiêu thụ'], errors='coerce')

                    fig_km_trend = go.Figure()
                    fig_km_trend.add_trace(go.Scatter(x=km_pivot['Tuần'], y=km_pivot['Tổng km chạy'], name='Km chạy', line=dict(color='#9b59b6', width=3), yaxis='y'))
                    fig_km_trend.add_trace(go.Scatter(x=km_pivot['Tuần'], y=km_pivot['Tổng số nhiên liệu tiêu thụ'], name='Nhiên liệu', line=dict(color='#f39c12', width=3), yaxis='y2'))
                    fig_km_trend.update_layout(
                        title='🛣️ Xu hướng km chạy và nhiên liệu theo tuần', height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Km chạy', side='left', color='#9b59b6'),
                        yaxis2=dict(title='Nhiên liệu (lít)', side='right', overlaying='y', color='#f39c12'),
                        legend=dict(orientation="h", yanchor="bottom", y=-0.35, xanchor="center", x=0.5),
                        margin=dict(b=100)
                    )
                    st.plotly_chart(fig_km_trend, use_container_width=True)

        col_chart5, col_chart6 = st.columns(2)

        with col_chart5:
            quality_time_data = df_vehicle[df_vehicle['Nội dung'].isin(['Tỷ lệ hài lòng của khách hàng', 'Số phiếu khảo sát hài lòng'])].copy()

            if not quality_time_data.empty and 'Tuần' in quality_time_data.columns:
                quality_time_data['Số liệu'] = pd.to_numeric(quality_time_data['Số liệu'], errors='coerce')
                quality_pivot = pd.pivot_table(quality_time_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0)
                quality_pivot = quality_pivot.reset_index()
                quality_pivot['Tuần'] = pd.to_numeric(quality_pivot['Tuần'], errors='coerce')
                quality_pivot = quality_pivot.sort_values('Tuần')

                if 'Tỷ lệ hài lòng của khách hàng' in quality_pivot.columns:
                    quality_pivot['Tỷ lệ hài lòng của khách hàng'] = pd.to_numeric(quality_pivot['Tỷ lệ hài lòng của khách hàng'], errors='coerce')
                    fig_quality_trend = px.line(quality_pivot, x='Tuần', y='Tỷ lệ hài lòng của khách hàng', title='😊 Xu hướng mức độ hài lòng theo tuần', line_shape='linear', color_discrete_sequence=['#27ae60'])
                    fig_quality_trend.update_layout(height=300, yaxis_title='Tỷ lệ hài lòng (%)')
                    fig_quality_trend.update_traces(line_width=3)
                    st.plotly_chart(fig_quality_trend, use_container_width=True)

        with col_chart6:
            cost_time_data = df_vehicle[df_vehicle['Nội dung'] == 'Chi phí bảo dưỡng']

            if not cost_time_data.empty and 'Tuần' in cost_time_data.columns:
                cost_time_data['Tuần'] = pd.to_numeric(cost_time_data['Tuần'], errors='coerce')
                cost_time_data['Chi phí bảo dưỡng'] = pd.to_numeric(cost_time_data['Số liệu'], errors='coerce')
                cost_time_data = cost_time_data.sort_values('Tuần')

                fig_cost_trend = px.bar(cost_time_data, x='Tuần', y='Chi phí bảo dưỡng', title='🔧 Chi phí bảo dưỡng theo tuần', color_discrete_sequence=['#e74c3c'])
                fig_cost_trend.update_layout(height=300, yaxis_title='Chi phí (VNĐ)')
                st.plotly_chart(fig_cost_trend, use_container_width=True)

        st.markdown('<div class="section-header">📈 Biểu đồ phân tích chi tiết</div>', unsafe_allow_html=True)

        col_detail1, col_detail2 = st.columns(2)

        with col_detail1:
            km_detail_data = df_vehicle[df_vehicle['Nội dung'].isin(['Km chạy của hành chính', 'Km chạy của xe cứu thương'])].copy()

            if not km_detail_data.empty and 'Tuần' in km_detail_data.columns:
                km_detail_data['Số liệu'] = pd.to_numeric(km_detail_data['Số liệu'], errors='coerce')
                km_detail_pivot = pd.pivot_table(km_detail_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0).infer_objects(copy=False)
                km_detail_pivot = km_detail_pivot.reset_index()
                km_detail_pivot['Tuần'] = pd.to_numeric(km_detail_pivot['Tuần'], errors='coerce')
                km_detail_pivot = km_detail_pivot.sort_values('Tuần')

                if 'Km chạy của hành chính' in km_detail_pivot.columns and 'Km chạy của xe cứu thương' in km_detail_pivot.columns:
                    km_detail_pivot['Km chạy của hành chính'] = pd.to_numeric(km_detail_pivot['Km chạy của hành chính'], errors='coerce')
                    km_detail_pivot['Km chạy của xe cứu thương'] = pd.to_numeric(km_detail_pivot['Km chạy của xe cứu thương'], errors='coerce')

                    fig_km_detail = go.Figure()
                    fig_km_detail.add_trace(go.Scatter(x=km_detail_pivot['Tuần'], y=km_detail_pivot['Km chạy của hành chính'], mode='lines', name='Km hành chính', line=dict(color='#3498db', width=3), yaxis='y'))
                    fig_km_detail.add_trace(go.Scatter(x=km_detail_pivot['Tuần'], y=km_detail_pivot['Km chạy của xe cứu thương'], mode='lines', name='Km cứu thương', line=dict(color='#e74c3c', width=3), yaxis='y2'))
                    fig_km_detail.update_layout(
                        title='🚗 Phân tích km chạy theo loại xe', height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Km hành chính', side='left', color='#3498db'),
                        yaxis2=dict(title='Km cứu thương', side='right', overlaying='y', color='#e74c3c'),
                        legend=dict(orientation="h", yanchor="bottom", y=-0.35, xanchor="center", x=0.5),
                        margin=dict(b=100)
                    )
                    st.plotly_chart(fig_km_detail, use_container_width=True)

        with col_detail2:
            revenue_cost_data = df_vehicle[df_vehicle['Nội dung'].isin(['Doanh thu Tổ xe', 'Chi phí bảo dưỡng'])].copy()

            if not revenue_cost_data.empty and 'Tuần' in revenue_cost_data.columns:
                revenue_cost_data['Số liệu'] = pd.to_numeric(revenue_cost_data['Số liệu'], errors='coerce')
                rc_pivot = pd.pivot_table(revenue_cost_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0).infer_objects(copy=False)
                rc_pivot = rc_pivot.reset_index()
                rc_pivot['Tuần'] = pd.to_numeric(rc_pivot['Tuần'], errors='coerce')
                rc_pivot = rc_pivot.sort_values('Tuần')

                if 'Doanh thu Tổ xe' in rc_pivot.columns and 'Chi phí bảo dưỡng' in rc_pivot.columns:
                    rc_pivot['Doanh thu Tổ xe'] = pd.to_numeric(rc_pivot['Doanh thu Tổ xe'], errors='coerce')
                    rc_pivot['Chi phí bảo dưỡng'] = pd.to_numeric(rc_pivot['Chi phí bảo dưỡng'], errors='coerce')

                    fig_revenue_cost = go.Figure()
                    fig_revenue_cost.add_trace(go.Scatter(x=rc_pivot['Tuần'], y=rc_pivot['Doanh thu Tổ xe'], mode='lines', name='Doanh thu', line=dict(color='#2ecc71', width=3), yaxis='y'))
                    fig_revenue_cost.add_trace(go.Scatter(x=rc_pivot['Tuần'], y=rc_pivot['Chi phí bảo dưỡng'], mode='lines', name='Chi phí bảo dưỡng', line=dict(color='#f39c12', width=3), yaxis='y2'))
                    fig_revenue_cost.update_layout(
                        title='💰 Phân tích doanh thu - chi phí', height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Doanh thu (VNĐ)', side='left', color='#2ecc71'),
                        yaxis2=dict(title='Chi phí (VNĐ)', side='right', overlaying='y', color='#f39c12'),
                        legend=dict(orientation="h", yanchor="bottom", y=-0.35, xanchor="center", x=0.5),
                        margin=dict(b=100)
                    )
                    st.plotly_chart(fig_revenue_cost, use_container_width=True)

        create_vehicle_charts(df_vehicle)

        # ── Heatmap + So sánh tuần ──────────────────────────────────
        st.markdown("---")
        col_heat, col_compare = st.columns(2)

        with col_heat:
            st.markdown("#### 🌡️ Heatmap: Chỉ số theo tuần")
            if 'Nội dung' in df_vehicle.columns and 'Tuần' in df_vehicle.columns and 'Số liệu' in df_vehicle.columns:
                hm_df = df_vehicle.copy()
                hm_df['Tuần'] = pd.to_numeric(hm_df['Tuần'], errors='coerce')
                hm_df['Số liệu'] = pd.to_numeric(hm_df['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce')
                hm_df = hm_df.dropna(subset=['Tuần', 'Số liệu'])
                if not hm_df.empty:
                    hm_pivot = hm_df.pivot_table(index='Nội dung', columns='Tuần', values='Số liệu', aggfunc='sum')
                    fig_hm = px.imshow(hm_pivot,
                                       labels=dict(x='Tuần', y='Chỉ số', color='Giá trị'),
                                       title='Heatmap chỉ số theo tuần',
                                       color_continuous_scale='Blues', aspect='auto')
                    fig_hm.update_layout(height=350)
                    st.plotly_chart(fig_hm, use_container_width=True)

        with col_compare:
            st.markdown("#### 📊 So sánh tuần hiện tại vs tuần trước")
            if 'Tuần' in df_vehicle.columns and 'Nội dung' in df_vehicle.columns:
                tuans = sorted(df_vehicle['Tuần'].dropna().unique())
                if len(tuans) >= 2:
                    cur_tuan = tuans[-1]
                    prev_tuan = tuans[-2]
                    df_cur = df_vehicle[df_vehicle['Tuần'] == cur_tuan]
                    df_prev = df_vehicle[df_vehicle['Tuần'] == prev_tuan]

                    def get_val(df, name):
                        r = df[df['Nội dung'] == name]['Số liệu']
                        if len(r) == 0:
                            return 0
                        return pd.to_numeric(r.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce').fillna(0).sum()

                    compare_metrics = [
                        ('🚗 Số chuyến', 'Số chuyến xe'),
                        ('🛣️ Km chạy', 'Tổng km chạy'),
                        ('💰 Doanh thu', 'Doanh thu Tổ xe'),
                        ('⛽ Nhiên liệu', 'Tổng số nhiên liệu tiêu thụ'),
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

        st.markdown('<div class="section-header">📊 Dữ liệu chi tiết</div>', unsafe_allow_html=True)

        display_df = df_vehicle.copy()
        def clean_and_format_number(x):
            cleaned = str(x).replace('\xa0', '').replace(' ', '').strip()
            numeric_val = pd.to_numeric(cleaned, errors='coerce')
            if pd.isna(numeric_val):
                return str(x)
            elif numeric_val >= 1:
                return f"{numeric_val:,.0f}"
            else:
                return f"{numeric_val:.1f}"

        display_df['Số liệu'] = display_df['Số liệu'].apply(clean_and_format_number)
        st.dataframe(display_df, use_container_width=True, hide_index=True)

    else:
        st.warning("⚠️ Chưa có dữ liệu tổ xe. Vui lòng upload file dữ liệu.")
