import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def create_secretary_pivot_table(df):
    st.markdown("### 📊 Bảng Pivot - Phân tích Hệ thống thư ký theo thời gian")

    # CSS cho table lớn hơn và đẹp hơn
    st.markdown("""
    <style>
    .pivot-table-secretary {
        font-size: 16px !important;
        font-weight: 500;
    }
    .pivot-table-secretary td {
        padding: 12px 8px !important;
        text-align: center !important;
    }
    .pivot-table-secretary th {
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
            key="secretary_period_type"
        )

    # Dữ liệu Hệ thống thư ký có cấu trúc khác - có thể có cột tuần/tháng trực tiếp
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
        # Tạo pivot table với các chỉ số Hệ thống thư ký - mở rộng để bao gồm tất cả metrics
        secretary_metrics = ['tong_tk', 'tuyen_moi', 'nghi_viec', 'hanh_chinh', 'chuyen_mon', 'dao_tao']

        # Nếu dữ liệu không có các cột metric, tạo chúng từ Nội dung/Số liệu
        if 'Nội dung' in df_period.columns and 'Số liệu' in df_period.columns:
            df_period['Số liệu'] = pd.to_numeric(
                df_period['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(),
                errors='coerce'
            ).fillna(0)
            for metric in secretary_metrics:
                df_period[metric] = 0

            # Mapping các metric từ Nội dung - dựa trên data thực tế
            metric_mapping = {
                'tong_tk': ['Tổng số thư ký'],
                'tuyen_moi': ['Số thư ký được tuyển dụng'],
                'nghi_viec': ['Số thư ký nghỉ việc'],
                'hanh_chinh': ['- Thư ký hành chính'],
                'chuyen_mon': ['- Thư ký chuyên môn'],
                'dao_tao': ['Số buổi tập huấn, đào tạo cho thư ký']
            }

            for metric, content_names in metric_mapping.items():
                for content_name in content_names:
                    mask = df_period['Nội dung'] == content_name
                    df_period.loc[mask, metric] = pd.to_numeric(df_period.loc[mask, 'Số liệu'], errors='coerce').fillna(0)

        # Tạo pivot data
        pivot_data = df_period.groupby(['period', 'period_sort'])[secretary_metrics].sum().reset_index()
        pivot_data = pivot_data.sort_values('period_sort', ascending=False)

        # Tính toán biến động so với kỳ trước
        for col in secretary_metrics:
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
            return f"""<div style="text-align: center; line-height: 1.2;">
                <div style="font-size: 16px; font-weight: 600;">{int(current_val):,}</div>
                <div class="{color_class}" style="font-size: 12px; margin-top: 2px;">
                    {arrow} {sign}{int(change_val):,} ({change_pct:+.1f}%)
                </div>
            </div>"""

        # Tạo cột hiển thị mới
        display_columns = ['period']
        column_names = {f'period': f'{period_type}'}

        for col in secretary_metrics:
            new_col = f'{col}_display'
            display_data[new_col] = display_data.apply(lambda row: format_cell_with_change(row, col), axis=1)
            display_columns.append(new_col)

            # Mapping tên cột cho hiển thị
            metric_names = {
                'tong_tk': 'Tổng thư ký',
                'tuyen_moi': 'Tuyển mới',
                'nghi_viec': 'Nghỉ việc',
                'hanh_chinh': 'Hành chính',
                'chuyen_mon': 'Chuyên môn',
                'dao_tao': 'Đào tạo (buổi)'
            }
            column_names[new_col] = metric_names.get(col, col)

        st.markdown(f"#### 📋 Tổng hợp theo {period_type} (bao gồm biến động)")

        # Hiển thị bảng với HTML để render màu sắc
        df_display = display_data[display_columns].rename(columns=column_names)

        # Tạo HTML table với sticky header
        html_table = "<div style='max-height: 400px; overflow-y: auto; border: 1px solid #ddd;'><table class='pivot-table-secretary' style='width: 100%; border-collapse: collapse; font-size: 16px;'>"

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

    st.markdown('<div class="tab-header">👥 Hệ thống Thư ký Bệnh viện</div>', unsafe_allow_html=True)

    def create_secretary_data():
        """Tạo dữ liệu mẫu cho hệ thống thư ký"""
        return pd.DataFrame({
            'Tuần': [39] * 14,
            'Tháng': [9] * 14,
            'Nội dung': [
                'Số thư ký được sơ tuyển',
                'Số thư ký được tuyển dụng',
                'Số thư ký nhận việc',
                'Số thư ký nghỉ việc',
                'Số thư ký được điều động',
                'Tổng số thư ký',
                '- Thư ký hành chính',
                '- Thư ký chuyên môn',
                'Số buổi sinh hoạt cho thư ký',
                'Số thư ký tham gia sinh hoạt',
                'Số buổi tập huấn, đào tạo cho thư ký',
                'Số thư ký tham gia tập huấn, đào tạo',
                'Số buổi tham quan, học tập',
                'Số thư ký tham gia tham quan, học tập'
            ],
            'Số liệu': [15, 12, 10, 3, 2, 85, 45, 40, 4, 78, 6, 82, 2, 35]
        })

    # Load data từ DataManager hoặc dữ liệu mẫu
    df_secretary = data_manager.get_category_data('Hệ thống thư ký Bệnh viện')

    if df_secretary is None:
        df_secretary = create_secretary_data()

    if not df_secretary.empty:
        # Hiển thị phạm vi dữ liệu
        _tuan_col = 'Tuần' if 'Tuần' in df_secretary.columns else None
        _thang_col = 'Tháng' if 'Tháng' in df_secretary.columns else None
        if _tuan_col:
            _tuan_min = int(df_secretary[_tuan_col].dropna().min())
            _tuan_max = int(df_secretary[_tuan_col].dropna().max())
            _thang_info = f", Tháng {int(df_secretary[_thang_col].dropna().min())}–{int(df_secretary[_thang_col].dropna().max())}" if _thang_col else ""
            st.info(f"📅 Dữ liệu từ **Tuần {_tuan_min}** đến **Tuần {_tuan_max}**{_thang_info}")

        # Metrics overview tổng quan
        st.markdown('<div class="section-header">📊 Tổng quan hoạt động Hệ thống thư ký</div>', unsafe_allow_html=True)

        col1, col2, col3, col4 = st.columns(4)

        # Tính toán metrics từ dữ liệu - CỘNG TỔNG TẤT CẢ CÁC TUẦN
        def get_secretary_metric_value(content_name):
            if 'Nội dung' not in df_secretary.columns or 'Số liệu' not in df_secretary.columns:
                return 0

            # Lấy tất cả các hàng có nội dung này và cộng tổng
            result = df_secretary[df_secretary['Nội dung'] == content_name]['Số liệu']
            if len(result) > 0:
                # Clean data: remove non-breaking spaces and other whitespace characters
                cleaned_result = result.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip()
                # Convert tất cả values thành numeric và cộng tổng
                numeric_values = pd.to_numeric(cleaned_result, errors='coerce').fillna(0)
                total = numeric_values.sum()
                return total
            return 0

        tong_tk = get_secretary_metric_value('Tổng số thư ký')
        tuyen_moi = get_secretary_metric_value('Số thư ký được tuyển dụng')
        nghi_viec = get_secretary_metric_value('Số thư ký nghỉ việc')
        dao_tao = get_secretary_metric_value('Số buổi tập huấn, đào tạo cho thư ký')

        with col1:
            st.metric("👥 Tổng thư ký", f"{int(tong_tk):,}", help="Tổng số thư ký tất cả các tuần")
        with col2:
            st.metric("✅ Tuyển mới", f"{int(tuyen_moi):,}", help="Tổng số thư ký được tuyển dụng tất cả các tuần")
        with col3:
            st.metric("❌ Nghỉ việc", f"{int(nghi_viec):,}", help="Tổng số thư ký nghỉ việc tất cả các tuần")
        with col4:
            st.metric("📚 Đào tạo", f"{int(dao_tao):,} buổi", help="Tổng số buổi tập huấn, đào tạo tất cả các tuần")

        # Thêm hàng metrics thứ 2
        col5, col6, col7, col8 = st.columns(4)

        hanh_chinh = get_secretary_metric_value('- Thư ký hành chính')
        chuyen_mon = get_secretary_metric_value('- Thư ký chuyên môn')
        sinh_hoat = get_secretary_metric_value('Số buổi sinh hoạt cho thư ký')
        tham_quan = get_secretary_metric_value('Số buổi tham quan, học tập')

        with col5:
            st.metric("🏢 Hành chính", f"{int(hanh_chinh):,}", help="Tổng số thư ký hành chính tất cả các tuần")
        with col6:
            st.metric("🏥 Chuyên môn", f"{int(chuyen_mon):,}", help="Tổng số thư ký chuyên môn tất cả các tuần")
        with col7:
            st.metric("🎯 Sinh hoạt", f"{int(sinh_hoat):,} buổi", help="Tổng số buổi sinh hoạt tất cả các tuần")
        with col8:
            st.metric("🎓 Tham quan", f"{int(tham_quan):,} buổi", help="Tổng số buổi tham quan, học tập tất cả các tuần")

        st.markdown("<br>", unsafe_allow_html=True)

        # Pivot Table Section - giống như Tab 4
        create_secretary_pivot_table(df_secretary)

        st.markdown("<br>", unsafe_allow_html=True)

        # Biểu đồ tổng quan
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích</div>', unsafe_allow_html=True)

        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            # Biểu đồ phân bố thư ký theo loại
            type_data = df_secretary[df_secretary['Nội dung'].isin(['- Thư ký hành chính', '- Thư ký chuyên môn'])].copy()

            if not type_data.empty:
                # Làm sạch tên hiển thị
                type_data_clean = type_data.copy()
                type_data_clean['Nội dung'] = type_data_clean['Nội dung'].str.replace('- Thư ký ', '')

                fig_type = px.pie(type_data_clean, values='Số liệu', names='Nội dung',
                                title='👥 Phân bố thư ký theo loại',
                                hole=0.4)
                fig_type.update_layout(height=400)
                st.plotly_chart(fig_type, use_container_width=True)

        with col_chart2:
            # Biểu đồ tuyển dụng vs nghỉ việc
            hr_data = df_secretary[df_secretary['Nội dung'].isin(['Số thư ký được tuyển dụng', 'Số thư ký nghỉ việc'])].copy()
            if not hr_data.empty:
                hr_summary = pd.DataFrame({
                    'Loại': ['Tuyển dụng', 'Nghỉ việc'],
                    'Số liệu': [get_secretary_metric_value('Số thư ký được tuyển dụng'), get_secretary_metric_value('Số thư ký nghỉ việc')]
                })

                fig_hr = px.bar(hr_summary, x='Loại', y='Số liệu',
                              title='📊 Tuyển dụng vs Nghỉ việc',
                              color='Loại',
                              color_discrete_map={'Tuyển dụng': '#2ecc71', 'Nghỉ việc': '#e74c3c'})
                fig_hr.update_layout(height=400)
                st.plotly_chart(fig_hr, use_container_width=True)

        # Biểu đồ phân tích chi tiết
        st.markdown('<div class="section-header">📈 Biểu đồ phân tích chi tiết</div>', unsafe_allow_html=True)

        # Row 1: Biểu đồ tổng quan hoạt động
        col_detail1, col_detail2 = st.columns(2)

        with col_detail1:
            # Xu hướng tổng số thư ký theo tuần
            secretary_time_data = df_secretary[df_secretary['Nội dung'].isin(['Tổng số thư ký', 'Số thư ký được tuyển dụng', 'Số thư ký nghỉ việc'])].copy()

            if not secretary_time_data.empty and 'Tuần' in secretary_time_data.columns:
                # Convert Số liệu sang số trước khi pivot
                secretary_time_data['Số liệu'] = pd.to_numeric(secretary_time_data['Số liệu'], errors='coerce')
                secretary_pivot = pd.pivot_table(secretary_time_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0)
                secretary_pivot = secretary_pivot.reset_index()
                secretary_pivot['Tuần'] = pd.to_numeric(secretary_pivot['Tuần'], errors='coerce')
                secretary_pivot = secretary_pivot.sort_values('Tuần')

                # Clean data
                for col in secretary_pivot.columns:
                    if col != 'Tuần':
                        secretary_pivot[col] = pd.to_numeric(secretary_pivot[col], errors='coerce').fillna(0)

                if 'Tổng số thư ký' in secretary_pivot.columns:
                    fig_secretary_trend = go.Figure()

                    # Tổng số thư ký
                    fig_secretary_trend.add_trace(go.Scatter(
                        x=secretary_pivot['Tuần'],
                        y=secretary_pivot['Tổng số thư ký'],
                        mode='lines',
                        name='Tổng số thư ký',
                        line=dict(color='#3498db', width=3),
                        yaxis='y'
                    ))

                    # Tuyển dụng và nghỉ việc (trục phải)
                    if 'Số thư ký được tuyển dụng' in secretary_pivot.columns:
                        fig_secretary_trend.add_trace(go.Scatter(
                            x=secretary_pivot['Tuần'],
                            y=secretary_pivot['Số thư ký được tuyển dụng'],
                            mode='lines',
                            name='Tuyển dụng',
                            line=dict(color='#2ecc71', width=3),
                            yaxis='y2'
                        ))

                    if 'Số thư ký nghỉ việc' in secretary_pivot.columns:
                        fig_secretary_trend.add_trace(go.Scatter(
                            x=secretary_pivot['Tuần'],
                            y=secretary_pivot['Số thư ký nghỉ việc'],
                            mode='lines',
                            name='Nghỉ việc',
                            line=dict(color='#e74c3c', width=3),
                            yaxis='y2'
                        ))

                    fig_secretary_trend.update_layout(
                        title='👥 Xu hướng thư ký theo tuần',
                        height=350,
                        xaxis=dict(title='Tuần', title_standoff=35),
                        yaxis=dict(title='Tổng số thư ký', side='left', color='#3498db'),
                        yaxis2=dict(title='Tuyển dụng/Nghỉ việc', side='right', overlaying='y', color='#2ecc71'),
                        legend=dict(
                            orientation="h",
                            yanchor="bottom",
                            y=-0.35,
                            xanchor="center",
                            x=0.5
                        ),
                        margin=dict(b=100)
                    )

                    st.plotly_chart(fig_secretary_trend, use_container_width=True)

        with col_detail2:
            # Phân tích hoạt động đào tạo
            training_data = df_secretary[df_secretary['Nội dung'].isin(['Số buổi tập huấn, đào tạo cho thư ký', 'Số buổi sinh hoạt cho thư ký', 'Số buổi tham quan, học tập'])].copy()

            if not training_data.empty and 'Tuần' in training_data.columns:
                # Convert Số liệu sang số trước khi pivot
                training_data['Số liệu'] = pd.to_numeric(training_data['Số liệu'], errors='coerce')
                training_pivot = pd.pivot_table(training_data, index='Tuần', columns='Nội dung', values='Số liệu', aggfunc='sum', fill_value=0)
                training_pivot = training_pivot.reset_index()
                training_pivot['Tuần'] = pd.to_numeric(training_pivot['Tuần'], errors='coerce')
                training_pivot = training_pivot.sort_values('Tuần')

                # Clean data
                for col in training_pivot.columns:
                    if col != 'Tuần':
                        training_pivot[col] = pd.to_numeric(training_pivot[col], errors='coerce').fillna(0)

                # Tạo biểu đồ stacked bar
                fig_training = go.Figure()

                colors = ['#f39c12', '#9b59b6', '#1abc9c']
                color_idx = 0

                for col in training_pivot.columns:
                    if col != 'Tuần':
                        display_name = col.replace('Số buổi ', '').replace(' cho thư ký', '')
                        fig_training.add_trace(go.Bar(
                            x=training_pivot['Tuần'],
                            y=training_pivot[col],
                            name=display_name,
                            marker_color=colors[color_idx % len(colors)]
                        ))
                        color_idx += 1

                fig_training.update_layout(
                    title='📚 Hoạt động đào tạo theo tuần',
                    height=350,
                    xaxis=dict(title='Tuần', title_standoff=35),
                    yaxis_title='Số buổi',
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

                st.plotly_chart(fig_training, use_container_width=True)

        # ── Heatmap + So sánh tuần ──────────────────────────────────
        st.markdown("---")
        col_heat, col_compare = st.columns(2)

        with col_heat:
            st.markdown("#### 🌡️ Heatmap: Chỉ số theo tuần")
            if 'Nội dung' in df_secretary.columns and 'Tuần' in df_secretary.columns and 'Số liệu' in df_secretary.columns:
                hm_df = df_secretary.copy()
                hm_df['Tuần'] = pd.to_numeric(hm_df['Tuần'], errors='coerce')
                hm_df['Số liệu'] = pd.to_numeric(hm_df['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce')
                hm_df = hm_df.dropna(subset=['Tuần', 'Số liệu'])
                if not hm_df.empty:
                    hm_pivot = hm_df.pivot_table(index='Nội dung', columns='Tuần', values='Số liệu', aggfunc='sum')
                    fig_hm = px.imshow(hm_pivot,
                                       labels=dict(x='Tuần', y='Chỉ số', color='Giá trị'),
                                       title='Heatmap chỉ số theo tuần',
                                       color_continuous_scale='Purples', aspect='auto')
                    fig_hm.update_layout(height=380)
                    st.plotly_chart(fig_hm, use_container_width=True)

        with col_compare:
            st.markdown("#### 📊 So sánh tuần hiện tại vs tuần trước")
            if 'Tuần' in df_secretary.columns and 'Nội dung' in df_secretary.columns:
                tuans = sorted(df_secretary['Tuần'].dropna().unique())
                if len(tuans) >= 2:
                    cur_tuan = tuans[-1]
                    prev_tuan = tuans[-2]
                    df_cur = df_secretary[df_secretary['Tuần'] == cur_tuan]
                    df_prev = df_secretary[df_secretary['Tuần'] == prev_tuan]

                    def get_val(df, name):
                        r = df[df['Nội dung'] == name]['Số liệu']
                        if len(r) == 0:
                            return 0
                        return pd.to_numeric(r.astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(), errors='coerce').fillna(0).sum()

                    compare_metrics = [
                        ('👥 Tổng TK', 'Tổng số thư ký'),
                        ('✅ Tuyển mới', 'Số thư ký được tuyển dụng'),
                        ('❌ Nghỉ việc', 'Số thư ký nghỉ việc'),
                        ('📚 Đào tạo', 'Số buổi tập huấn, đào tạo cho thư ký'),
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
        display_df = df_secretary.copy()
        # Clean and format the data display
        def clean_and_format_secretary_number(x):
            # Clean non-breaking spaces and other whitespace
            cleaned = str(x).replace('\xa0', '').replace(' ', '').strip()
            numeric_val = pd.to_numeric(cleaned, errors='coerce')
            if pd.isna(numeric_val):
                return str(x)  # Return original if conversion fails
            elif numeric_val >= 1:
                return f"{numeric_val:,.0f}"
            else:
                return f"{numeric_val:.1f}"

        display_df['Số liệu'] = display_df['Số liệu'].apply(clean_and_format_secretary_number)
        st.dataframe(display_df, use_container_width=True, hide_index=True)

    else:
        st.warning("⚠️ Chưa có dữ liệu hệ thống thư ký. Vui lòng upload file dữ liệu.")
