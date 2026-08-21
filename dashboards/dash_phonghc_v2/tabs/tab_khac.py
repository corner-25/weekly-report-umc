import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def render():
    data_manager = st.session_state.get('data_manager')

    st.markdown('<div class="tab-header">🔗 Dữ liệu khác</div>', unsafe_allow_html=True)


    def create_other_data():
        """Tạo dữ liệu mẫu cho các danh mục khác"""
        return pd.DataFrame({
            'Tuần': [39] * 8,
            'Tháng': [9] * 8,
            'Danh mục': ['Lễ tân', 'Tiếp khách trong nước', 'Đón tiếp khách VIP',
                        'Tổ chức cuộc họp trực tuyến', 'Trang điều hành tác nghiệp',
                        'Lễ tân', 'Tiếp khách trong nước', 'Tiếp khách trong nước'],
            'Nội dung': [
                'Hỗ trợ lễ tân cho hội nghị/hội thảo',
                'Tổng số đoàn khách trong nước, trong đó:',
                'Số lượt khách VIP được lễ tân tiếp đón, hỗ trợ khám chữa bệnh',
                'Tổng số cuộc họp trực tuyến do Phòng Hành chính chuẩn bị',
                'Số lượng tin đăng ĐHTN',
                'Tham quan, học tập',
                'Làm việc',
                'Tỷ lệ hài lòng'
            ],
            'Số liệu': [12, 35, 125, 18, 45, 28, 7, 89.5]
        })

    # Load data từ DataManager hoặc dữ liệu mẫu
    main_categories = ['Tổ xe', 'Tổng đài', 'Hệ thống thư ký Bệnh viện', 'Bãi giữ xe', 'Sự kiện']
    df_other = data_manager.get_other_categories_data(main_categories)

    if df_other is None:
        df_other = create_other_data()

    if not df_other.empty:
        # Hiển thị phạm vi dữ liệu
        _tuan_col = 'Tuần' if 'Tuần' in df_other.columns else None
        _thang_col = 'Tháng' if 'Tháng' in df_other.columns else None
        if _tuan_col:
            _tuan_min = int(df_other[_tuan_col].dropna().min())
            _tuan_max = int(df_other[_tuan_col].dropna().max())
            _thang_info = f", Tháng {int(df_other[_thang_col].dropna().min())}–{int(df_other[_thang_col].dropna().max())}" if _thang_col else ""
            st.info(f"📅 Dữ liệu từ **Tuần {_tuan_min}** đến **Tuần {_tuan_max}**{_thang_info}")

        # ── Biểu đồ tổng quan ──────────────────────────────────────
        if 'Danh mục' in df_other.columns and 'Số liệu' in df_other.columns:
            st.markdown('<div class="section-header">📊 Tổng quan theo danh mục</div>', unsafe_allow_html=True)

            # Clean numeric
            df_chart = df_other.copy()
            df_chart['Số liệu'] = pd.to_numeric(
                df_chart['Số liệu'].astype(str).str.replace('\xa0', '').str.replace(' ', '').str.strip(),
                errors='coerce'
            )
            df_chart = df_chart.dropna(subset=['Số liệu'])

            col1, col2 = st.columns(2)

            with col1:
                # Tổng hợp theo danh mục
                cat_summary = df_chart.groupby('Danh mục')['Số liệu'].sum().reset_index()
                cat_summary.columns = ['Danh mục', 'Tổng']
                cat_summary = cat_summary.sort_values('Tổng', ascending=True)

                fig_bar = px.bar(cat_summary, x='Tổng', y='Danh mục', orientation='h',
                                 title='📊 Tổng hợp theo danh mục',
                                 color='Tổng', color_continuous_scale='Blues')
                fig_bar.update_coloraxes(showscale=False)
                fig_bar.update_layout(height=380)
                st.plotly_chart(fig_bar, use_container_width=True)

            with col2:
                # Pie chart phân bố danh mục
                fig_pie = px.pie(cat_summary, values='Tổng', names='Danh mục',
                                 title='📋 Phân bố theo danh mục', hole=0.4)
                fig_pie.update_layout(height=380, legend=dict(font=dict(size=11)))
                st.plotly_chart(fig_pie, use_container_width=True)

            # ── Biểu đồ xu hướng theo tuần (nếu có cột Tuần) ──────
            if 'Tuần' in df_other.columns:
                st.markdown("---")
                st.markdown("### 📈 Xu hướng theo tuần")

                col3, col4 = st.columns(2)

                with col3:
                    # Stacked bar: danh mục × tuần
                    trend_df = df_chart.copy()
                    trend_df['Tuần'] = pd.to_numeric(trend_df['Tuần'], errors='coerce')
                    trend_df = trend_df.dropna(subset=['Tuần'])
                    trend_grouped = trend_df.groupby(['Tuần', 'Danh mục'])['Số liệu'].sum().reset_index()

                    if not trend_grouped.empty:
                        fig_trend = px.bar(trend_grouped, x='Tuần', y='Số liệu', color='Danh mục',
                                           title='📈 Hoạt động theo tuần (stacked)',
                                           barmode='stack',
                                           labels={'Số liệu': 'Tổng', 'Tuần': 'Tuần'})
                        fig_trend.update_layout(height=380,
                                                legend=dict(orientation='h', y=-0.3, font=dict(size=11)))
                        st.plotly_chart(fig_trend, use_container_width=True)

                with col4:
                    # Heatmap: Danh mục × Tuần
                    hm_df = df_chart.copy()
                    hm_df['Tuần'] = pd.to_numeric(hm_df['Tuần'], errors='coerce')
                    hm_df = hm_df.dropna(subset=['Tuần'])
                    if not hm_df.empty:
                        hm_pivot = hm_df.pivot_table(index='Danh mục', columns='Tuần', values='Số liệu', aggfunc='sum')
                        fig_hm = px.imshow(hm_pivot,
                                           labels=dict(x='Tuần', y='Danh mục', color='Giá trị'),
                                           title='🌡️ Heatmap: Danh mục × Tuần',
                                           color_continuous_scale='YlOrRd', aspect='auto')
                        fig_hm.update_layout(height=380)
                        st.plotly_chart(fig_hm, use_container_width=True)

                # ── So sánh tuần hiện tại vs tuần trước ───────────
                tuans = sorted(df_chart['Tuần'].dropna().unique())
                if len(tuans) >= 2:
                    cur_tuan = tuans[-1]
                    prev_tuan = tuans[-2]
                    df_cur = df_chart[df_chart['Tuần'] == cur_tuan]
                    df_prev = df_chart[df_chart['Tuần'] == prev_tuan]

                    cur_by_cat = df_cur.groupby('Danh mục')['Số liệu'].sum()
                    prev_by_cat = df_prev.groupby('Danh mục')['Số liệu'].sum()
                    all_cats = list(cur_by_cat.index.union(prev_by_cat.index))

                    st.markdown(f"### 📊 So sánh Tuần {int(cur_tuan)} vs Tuần {int(prev_tuan)}")
                    cols_n = min(4, len(all_cats))
                    cols_row = st.columns(cols_n) if cols_n > 0 else []
                    for i, cat in enumerate(all_cats[:4]):
                        cur_val = int(cur_by_cat.get(cat, 0))
                        prev_val = int(prev_by_cat.get(cat, 0))
                        delta = cur_val - prev_val
                        delta_pct = f"{delta/prev_val*100:+.1f}%" if prev_val > 0 else "N/A"
                        with cols_row[i % cols_n]:
                            st.metric(cat[:20], f"{cur_val:,}", delta=f"{delta:+,} ({delta_pct})")

                    compare_df = pd.DataFrame({
                        'Danh mục': all_cats,
                        f'Tuần {int(prev_tuan)}': [int(prev_by_cat.get(c, 0)) for c in all_cats],
                        f'Tuần {int(cur_tuan)}': [int(cur_by_cat.get(c, 0)) for c in all_cats],
                    }).melt(id_vars='Danh mục', var_name='Kỳ', value_name='Số lượng')

                    fig_cmp = px.bar(compare_df, x='Danh mục', y='Số lượng', color='Kỳ',
                                     barmode='group',
                                     title=f'So sánh Tuần {int(prev_tuan)} vs Tuần {int(cur_tuan)}',
                                     color_discrete_sequence=['#95a5a6', '#e67e22'])
                    fig_cmp.update_xaxes(tickangle=20)
                    fig_cmp.update_layout(height=380, legend=dict(orientation='h', y=1.05))
                    st.plotly_chart(fig_cmp, use_container_width=True)

        st.markdown("---")

    # Display by category if Danh mục column exists
    st.markdown('<div class="section-header">📊 Dữ liệu chi tiết</div>', unsafe_allow_html=True)
    if 'Danh mục' in df_other.columns:
        categories = df_other['Danh mục'].unique()
        for category in categories:
            with st.expander(f"📁 {category}", expanded=True):
                category_data = df_other[df_other['Danh mục'] == category]
                st.dataframe(category_data, use_container_width=True)
    else:
        st.subheader("📊 Chi tiết dữ liệu")
        st.dataframe(df_other, use_container_width=True)
