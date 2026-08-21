import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def create_event_pivot_table(df):
    """Tạo pivot table cho dữ liệu sự kiện"""

    # CSS cho table
    st.markdown("""
    <style>
    .pivot-table-event {
        font-size: 16px !important;
        font-weight: 500;
    }
    .pivot-table-event td {
        padding: 12px 8px !important;
        text-align: center !important;
    }
    .pivot-table-event th {
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
            key="event_period_type"
        )

    # Xử lý dữ liệu thời gian
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

    if has_time_data:
        # Các metric cho sự kiện
        event_metrics = ['tong_su_kien', 'chu_tri', 'phoi_hop', 'quan_trong', 'hoi_nghi', 'doi_ngoai']

        # Tạo metric columns từ dữ liệu Nội dung/Số liệu
        if 'Nội dung' in df_period.columns and 'Số liệu' in df_period.columns:
            df_period['Số liệu'] = pd.to_numeric(
                df_period['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(),
                errors='coerce'
            ).fillna(0)
            for metric in event_metrics:
                df_period[metric] = 0

            # Mapping các metric từ Nội dung
            metric_mapping = {
                'tong_su_kien': ['Tổng số sự kiện hành chính của Bệnh viện'],
                'chu_tri': ['Phòng Hành chính chủ trì'],
                'phoi_hop': ['Phòng Hành chính phối hợp'],
                'quan_trong': ['Sự kiện quan trọng'],
                'hoi_nghi': ['Hội nghị hội thảo'],
                'doi_ngoai': ['Hoạt động đối ngoại']
            }

            for metric, content_names in metric_mapping.items():
                for content_name in content_names:
                    mask = df_period['Nội dung'] == content_name
                    df_period.loc[mask, metric] = pd.to_numeric(df_period.loc[mask, 'Số liệu'], errors='coerce').fillna(0)

        # Tạo pivot data
        pivot_data = df_period.groupby(['period', 'period_sort'])[event_metrics].sum().reset_index()
        pivot_data = pivot_data.sort_values('period_sort', ascending=False)

        # Tính toán biến động
        for col in event_metrics:
            pivot_data[f'{col}_prev'] = pivot_data[col].shift(-1)
            pivot_data[f'{col}_change'] = pivot_data[col] - pivot_data[f'{col}_prev']
            pivot_data[f'{col}_change_pct'] = ((pivot_data[col] / pivot_data[f'{col}_prev'] - 1) * 100).round(1)
            pivot_data[f'{col}_change_pct'] = pivot_data[f'{col}_change_pct'].fillna(0)

        # Hàm format cell với biến động
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
                <div class="{color_class}" style="font-size: 12px;">{arrow} {sign}{int(change_val):,} ({sign}{change_pct:.1f}%)</div>
            </div>"""

        # Tạo HTML table
        display_data = pivot_data.copy()

        # Tạo header
        html_table = '''
        <table class="pivot-table-event" style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 2px solid #34495e;">
            <thead>
                <tr style="background: linear-gradient(90deg, #34495e, #2c3e50); color: white;">
                    <th style="border: 1px solid #ddd; position: sticky; left: 0; background: #2c3e50; z-index: 10;">Kỳ</th>
                    <th style="border: 1px solid #ddd;">🎉 Tổng SK</th>
                    <th style="border: 1px solid #ddd;">👑 Chủ trì</th>
                    <th style="border: 1px solid #ddd;">🤝 Phối hợp</th>
                    <th style="border: 1px solid #ddd;">⭐ Quan trọng</th>
                    <th style="border: 1px solid #ddd;">🏛️ Hội nghị</th>
                    <th style="border: 1px solid #ddd;">🌍 Đối ngoại</th>
                </tr>
            </thead>
            <tbody>
        '''

        # Thêm các row dữ liệu
        for i, row in display_data.iterrows():
            period_display = row['period']

            # Alternating row colors
            row_color = "#f8f9fa" if i % 2 == 0 else "#ffffff"

            html_table += f'''
            <tr style="background-color: {row_color};">
                <td style="border: 1px solid #ddd; font-weight: bold; background-color: #ecf0f1; position: sticky; left: 0; z-index: 5;">{period_display}</td>
                <td style="border: 1px solid #ddd;">{format_cell_with_change(row, 'tong_su_kien')}</td>
                <td style="border: 1px solid #ddd;">{format_cell_with_change(row, 'chu_tri')}</td>
                <td style="border: 1px solid #ddd;">{format_cell_with_change(row, 'phoi_hop')}</td>
                <td style="border: 1px solid #ddd;">{format_cell_with_change(row, 'quan_trong')}</td>
                <td style="border: 1px solid #ddd;">{format_cell_with_change(row, 'hoi_nghi')}</td>
                <td style="border: 1px solid #ddd;">{format_cell_with_change(row, 'doi_ngoai')}</td>
            </tr>
            '''

        html_table += '''
            </tbody>
        </table>
        <div style="text-align: center; margin: 10px 0; color: #7f8c8d; font-size: 12px;">
            📈 <span style="color: #16a085;">↗ Tăng</span> |
            📉 <span style="color: #e74c3c;">↘ Giảm</span> |
            ➡️ <span style="color: #7f8c8d;">→ Không đổi</span>
        </div>
        '''

        return html_table
    else:
        return "<p style='text-align: center; color: #e74c3c;'>⚠️ Không có dữ liệu thời gian để tạo bảng pivot</p>"


def render():
    data_manager = st.session_state.get('data_manager')

    st.markdown('<div class="tab-header">🎉 Báo cáo Sự kiện</div>', unsafe_allow_html=True)

    def create_events_data():
        """Tạo dữ liệu mẫu cho sự kiện"""
        return pd.DataFrame({
            'Tuần': [39] * 8,
            'Tháng': [9] * 8,
            'Nội dung': [
                'Tổng số sự kiện hành chính của Bệnh viện',
                'Phòng Hành chính chủ trì',
                'Phòng Hành chính phối hợp',
                'Tỷ lệ thành công',
                'Sự kiện quan trọng',
                'Hội nghị hội thảo',
                'Hoạt động đối ngoại',
                'Mức độ hài lòng'
            ],
            'Số liệu': [25, 15, 10, 96.0, 8, 12, 5, 92.5]
        })

    # Load data từ DataManager hoặc dữ liệu mẫu
    df_events = data_manager.get_category_data('Sự kiện')

    if df_events is None:
        df_events = create_events_data()

    if not df_events.empty:
        # Hiển thị phạm vi dữ liệu
        _tuan_col = 'Tuần' if 'Tuần' in df_events.columns else None
        _thang_col = 'Tháng' if 'Tháng' in df_events.columns else None
        if _tuan_col:
            _tuan_min = int(df_events[_tuan_col].dropna().min())
            _tuan_max = int(df_events[_tuan_col].dropna().max())
            _thang_info = f", Tháng {int(df_events[_thang_col].dropna().min())}–{int(df_events[_thang_col].dropna().max())}" if _thang_col else ""
            st.info(f"📅 Dữ liệu từ **Tuần {_tuan_min}** đến **Tuần {_tuan_max}**{_thang_info}")

        # Metrics overview tổng quan
        st.markdown('<div class="section-header">📊 Tổng quan hoạt động Sự kiện</div>', unsafe_allow_html=True)

        col1, col2, col3, col4 = st.columns(4)

        # Tính toán metrics từ dữ liệu - CỘNG TỔNG TẤT CẢ CÁC TUẦN
        def get_event_metric_value(content_name):
            if 'Nội dung' not in df_events.columns or 'Số liệu' not in df_events.columns:
                return 0

            # Lấy tất cả các hàng có nội dung này và cộng tổng
            result = df_events[df_events['Nội dung'] == content_name]['Số liệu']
            if len(result) > 0:
                # Clean data: remove non-breaking spaces and other whitespace characters
                cleaned_result = result.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip()
                # Convert tất cả values thành numeric và cộng tổng
                numeric_values = pd.to_numeric(cleaned_result, errors='coerce').fillna(0)
                total = numeric_values.sum()
                return total
            return 0

        tong_sk = get_event_metric_value('Tổng số sự kiện hành chính của Bệnh viện')
        chu_tri = get_event_metric_value('Phòng Hành chính chủ trì')
        phoi_hop = get_event_metric_value('Phòng Hành chính phối hợp')
        thanh_cong = get_event_metric_value('Tỷ lệ thành công')

        with col1:
            st.metric("🎉 Tổng sự kiện", f"{int(tong_sk):,}", help="Tổng số sự kiện hành chính tất cả các tuần")
        with col2:
            st.metric("👑 Chủ trì", f"{int(chu_tri):,}", help="Tổng số sự kiện chủ trì tất cả các tuần")
        with col3:
            st.metric("🤝 Phối hợp", f"{int(phoi_hop):,}", help="Tổng số sự kiện phối hợp tất cả các tuần")
        with col4:
            st.metric("✅ Thành công", f"{thanh_cong:.1f}%", help="Tỷ lệ thành công trung bình tất cả các tuần")

        # Thêm hàng metrics thứ 2
        col5, col6, col7, col8 = st.columns(4)

        quan_trong = get_event_metric_value('Sự kiện quan trọng')
        hoi_nghi = get_event_metric_value('Hội nghị hội thảo')
        doi_ngoai = get_event_metric_value('Hoạt động đối ngoại')
        hai_long = get_event_metric_value('Mức độ hài lòng')

        with col5:
            st.metric("⭐ Quan trọng", f"{int(quan_trong):,}", help="Tổng số sự kiện quan trọng tất cả các tuần")
        with col6:
            st.metric("🏛️ Hội nghị", f"{int(hoi_nghi):,}", help="Tổng số hội nghị hội thảo tất cả các tuần")
        with col7:
            st.metric("🌍 Đối ngoại", f"{int(doi_ngoai):,}", help="Tổng số hoạt động đối ngoại tất cả các tuần")
        with col8:
            st.metric("😊 Hài lòng", f"{hai_long:.1f}%", help="Mức độ hài lòng trung bình tất cả các tuần")

        st.markdown("<br>", unsafe_allow_html=True)

        # Pivot Table Section - giống như Tab 4
        create_event_pivot_table(df_events)

        st.markdown("<br>", unsafe_allow_html=True)

        # Biểu đồ tổng quan
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích</div>', unsafe_allow_html=True)

        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            # Biểu đồ phân bố loại sự kiện
            event_distribution_data = pd.DataFrame({
                'Loại sự kiện': ['Chủ trì', 'Phối hợp', 'Quan trọng', 'Hội nghị', 'Đối ngoại'],
                'Số lượng': [int(chu_tri), int(phoi_hop), int(quan_trong), int(hoi_nghi), int(doi_ngoai)]
            })

            fig_event = px.pie(event_distribution_data, values='Số lượng', names='Loại sự kiện',
                              title='🎯 Phân bố loại sự kiện',
                              hole=0.4)
            fig_event.update_layout(height=400)
            st.plotly_chart(fig_event, use_container_width=True)

        with col_chart2:
            # Biểu đồ hiệu quả và hài lòng
            efficiency_data = pd.DataFrame({
                'Chỉ số': ['Tỷ lệ thành công (%)', 'Mức độ hài lòng (%)'],
                'Giá trị': [float(thanh_cong), float(hai_long)]
            })

            fig_efficiency = px.bar(efficiency_data, x='Chỉ số', y='Giá trị',
                                   title='📊 Hiệu quả tổ chức sự kiện',
                                   color='Chỉ số',
                                   color_discrete_map={'Tỷ lệ thành công (%)': '#2ecc71', 'Mức độ hài lòng (%)': '#3498db'})
            fig_efficiency.update_layout(height=400, yaxis_title='Tỷ lệ (%)')
            st.plotly_chart(fig_efficiency, use_container_width=True)

        # Biểu đồ phân tích chi tiết
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích chi tiết</div>', unsafe_allow_html=True)

        # Row 1: Biểu đồ tổng quan hoạt động
        col_detail1, col_detail2 = st.columns(2)

        with col_detail1:
            # Xu hướng tổng sự kiện và chủ trì theo tuần
            events_time_data = df_events[df_events['Nội dung'].isin(['Tổng số sự kiện hành chính của Bệnh viện', 'Phòng Hành chính chủ trì', 'Phòng Hành chính phối hợp'])].copy()

            if not events_time_data.empty and 'Tuần' in events_time_data.columns:
                # Convert Số liệu sang số trước khi pivot
                events_time_data['Số liệu'] = pd.to_numeric(events_time_data['Số liệu'], errors='coerce')
                events_pivot = pd.pivot_table(events_time_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0)
                events_pivot = events_pivot.reset_index()
                events_pivot['Tuần'] = pd.to_numeric(events_pivot['Tuần'], errors='coerce')
                events_pivot = events_pivot.sort_values('Tuần')

                # Clean data
                for col in events_pivot.columns:
                    if col != 'Tuần':
                        events_pivot[col] = pd.to_numeric(events_pivot[col], errors='coerce').fillna(0)

                # Tính tổng sự kiện do phòng hành chính thực hiện
                if 'Phòng Hành chính chủ trì' in events_pivot.columns and 'Phòng Hành chính phối hợp' in events_pivot.columns:
                    events_pivot['HC thực hiện'] = events_pivot['Phòng Hành chính chủ trì'] + events_pivot['Phòng Hành chính phối hợp']

                if 'Tổng số sự kiện hành chính của Bệnh viện' in events_pivot.columns and 'HC thực hiện' in events_pivot.columns:
                    fig_events_trend = go.Figure()

                    # Tổng sự kiện (trục trái)
                    fig_events_trend.add_trace(go.Scatter(
                        x=events_pivot['Tuần'],
                        y=events_pivot['Tổng số sự kiện hành chính của Bệnh viện'],
                        mode='lines',
                        name='Tổng sự kiện',
                        line=dict(color='#3498db', width=3),
                        yaxis='y'
                    ))

                    # HC thực hiện (trục phải)
                    fig_events_trend.add_trace(go.Scatter(
                        x=events_pivot['Tuần'],
                        y=events_pivot['HC thực hiện'],
                        mode='lines',
                        name='HC thực hiện',
                        line=dict(color='#e74c3c', width=3),
                        yaxis='y2'
                    ))

                    fig_events_trend.update_layout(
                        title='🎉 Xu hướng sự kiện theo tuần',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Tổng sự kiện', side='left', color='#3498db'),
                        yaxis2=dict(title='HC thực hiện', side='right', overlaying='y', color='#e74c3c'),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_events_trend, use_container_width=True)

        with col_detail2:
            # Phân tích hiệu quả và chất lượng
            quality_data = df_events[df_events['Nội dung'].isin(['Tỷ lệ thành công', 'Mức độ hài lòng', 'Sự kiện quan trọng'])].copy()

            if not quality_data.empty and 'Tuần' in quality_data.columns:
                # Convert Số liệu sang số trước khi pivot
                quality_data['Số liệu'] = pd.to_numeric(quality_data['Số liệu'], errors='coerce')
                quality_pivot = pd.pivot_table(quality_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0)
                quality_pivot = quality_pivot.reset_index()
                quality_pivot['Tuần'] = pd.to_numeric(quality_pivot['Tuần'], errors='coerce')
                quality_pivot = quality_pivot.sort_values('Tuần')

                # Clean data
                for col in quality_pivot.columns:
                    if col != 'Tuần':
                        quality_pivot[col] = pd.to_numeric(quality_pivot[col], errors='coerce').fillna(0)

                if 'Tỷ lệ thành công' in quality_pivot.columns and 'Mức độ hài lòng' in quality_pivot.columns:
                    fig_quality = go.Figure()

                    # Tỷ lệ thành công (trục trái)
                    fig_quality.add_trace(go.Scatter(
                        x=quality_pivot['Tuần'],
                        y=quality_pivot['Tỷ lệ thành công'],
                        mode='lines',
                        name='Thành công (%)',
                        line=dict(color='#27ae60', width=3),
                        yaxis='y'
                    ))

                    # Mức độ hài lòng (trục phải)
                    fig_quality.add_trace(go.Scatter(
                        x=quality_pivot['Tuần'],
                        y=quality_pivot['Mức độ hài lòng'],
                        mode='lines',
                        name='Hài lòng (%)',
                        line=dict(color='#f39c12', width=3),
                        yaxis='y2'
                    ))

                    # Sự kiện quan trọng (nếu có)
                    if 'Sự kiện quan trọng' in quality_pivot.columns:
                        fig_quality.add_trace(go.Bar(
                            x=quality_pivot['Tuần'],
                            y=quality_pivot['Sự kiện quan trọng'],
                            name='SK quan trọng',
                            marker_color='#9b59b6',
                            opacity=0.7,
                            yaxis='y'
                        ))

                    fig_quality.update_layout(
                        title='📊 Phân tích chất lượng và hiệu quả',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Thành công (%) / SK quan trọng', side='left', color='#27ae60'),
                        yaxis2=dict(title='Hài lòng (%)', side='right', overlaying='y', color='#f39c12'),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_quality, use_container_width=True)

        # ── Heatmap + So sánh tuần ──────────────────────────────────
        st.markdown("---")
        col_heat, col_compare = st.columns(2)

        with col_heat:
            st.markdown("#### 🌡️ Heatmap: Chỉ số theo tuần")
            if 'Nội dung' in df_events.columns and 'Tuần' in df_events.columns and 'Số liệu' in df_events.columns:
                hm_df = df_events.copy()
                hm_df['Tuần'] = pd.to_numeric(hm_df['Tuần'], errors='coerce')
                hm_df['Số liệu'] = pd.to_numeric(hm_df['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce')
                hm_df = hm_df.dropna(subset=['Tuần', 'Số liệu'])
                if not hm_df.empty:
                    hm_pivot = hm_df.pivot_table(index='Nội dung', columns='Tuần', values='Số liệu', aggfunc='sum')
                    fig_hm = px.imshow(hm_pivot,
                                       labels=dict(x='Tuần', y='Chỉ số', color='Giá trị'),
                                       title='Heatmap chỉ số theo tuần',
                                       color_continuous_scale='Oranges', aspect='auto')
                    fig_hm.update_layout(height=350)
                    st.plotly_chart(fig_hm, use_container_width=True)

        with col_compare:
            st.markdown("#### 📊 So sánh tuần hiện tại vs tuần trước")
            if 'Tuần' in df_events.columns and 'Nội dung' in df_events.columns:
                tuans = sorted(df_events['Tuần'].dropna().unique())
                if len(tuans) >= 2:
                    cur_tuan = tuans[-1]
                    prev_tuan = tuans[-2]
                    df_cur = df_events[df_events['Tuần'] == cur_tuan]
                    df_prev = df_events[df_events['Tuần'] == prev_tuan]

                    def get_val(df, name):
                        r = df[df['Nội dung'] == name]['Số liệu']
                        if len(r) == 0:
                            return 0
                        return pd.to_numeric(r.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce').fillna(0).sum()

                    compare_metrics = [
                        ('🎉 Tổng SK', 'Tổng số sự kiện hành chính của Bệnh viện'),
                        ('👑 Chủ trì', 'Phòng Hành chính chủ trì'),
                        ('🤝 Phối hợp', 'Phòng Hành chính phối hợp'),
                        ('⭐ Quan trọng', 'Sự kiện quan trọng'),
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
        display_df = df_events.copy()
        # Clean and format the data display
        def clean_and_format_event_number(x):
            # Clean non-breaking spaces and other whitespace
            cleaned = str(x).replace('\xa0', '').replace(' ', '').strip()
            numeric_val = pd.to_numeric(cleaned, errors='coerce')
            if pd.isna(numeric_val):
                return str(x)  # Return original if conversion fails
            elif numeric_val >= 1:
                return f"{numeric_val:,.0f}"
            else:
                return f"{numeric_val:.1f}"

        display_df['Số liệu'] = display_df['Số liệu'].apply(clean_and_format_event_number)
        st.dataframe(display_df, use_container_width=True, hide_index=True)

    else:
        st.warning("⚠️ Chưa có dữ liệu sự kiện. Vui lòng upload file dữ liệu.")
