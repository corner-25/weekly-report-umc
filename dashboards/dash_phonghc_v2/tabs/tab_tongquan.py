import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from data_loader import load_data_from_github, load_processed_data
from utils import compute_summary_metrics
from config import render_date_range


def render():
    st.markdown('<div class="tab-header">📊 Tổng quan Phòng Hành chính</div>', unsafe_allow_html=True)

    weekday_order = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN']

    # ── Fast path: dùng pre-processed data ──────────────────────
    processed, is_processed = load_processed_data('tonghop.json')
    if is_processed and processed and processed.get("records"):
        df_summary = pd.DataFrame(processed["records"])
        df_summary['datetime'] = pd.to_datetime(df_summary['datetime'])
        # Các cột đã tính sẵn trong processed data
    else:
        # ── Slow path: tính từ raw JSON ──────────────────────────
        df_summary = load_data_from_github('tonghop.json')
        if df_summary is not None:
            df_summary['datetime'] = pd.to_datetime(df_summary[['year', 'month', 'date']].rename(columns={'date': 'day'}))
            df_summary['category_vi'] = df_summary['category'].map({
                'Van ban den': '📥 Văn bản đến',
                'Van ban phat hanh di': '📤 Văn bản đi',
                'Van ban phat hanh quyet dinh': '📜 Quyết định',
                'Van ban phat hanhquy dinh': '📋 Quy định',
                'Van ban phat hanhquy trinh': '📋 Quy trình',
                'Van ban phat hanh hop dong': '📝 Hợp đồng',
                'Quan ly phong hop': '🏢 Phòng họp',
                'Quan ly cong viec': '💼 Công việc'
            }).fillna('🔸 ' + df_summary['category'])
            df_summary['weekday'] = df_summary['datetime'].dt.day_name()
            df_summary['weekday_vi'] = df_summary['weekday'].map({
                'Monday': 'Thứ 2', 'Tuesday': 'Thứ 3', 'Wednesday': 'Thứ 4',
                'Thursday': 'Thứ 5', 'Friday': 'Thứ 6', 'Saturday': 'Thứ 7', 'Sunday': 'CN'
            })
            df_summary['year_month'] = df_summary['year'].astype(str) + '-' + df_summary['month'].astype(str).str.zfill(2)
            df_summary['month_year_vi'] = df_summary['month'].astype(str) + '/' + df_summary['year'].astype(str)

    # ── Display: chạy cho cả hai path ────────────────────────────
    if df_summary is not None:
        render_date_range(df_summary)

        categories_summary = df_summary.groupby('category_vi')['count'].sum().sort_values(ascending=False)

        # ── Metrics ────────────────────────────────────────────────
        metrics = compute_summary_metrics()
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("📥 Văn bản đến", f"{metrics['vb_den']:,}")
        with col2:
            st.metric("📤 Văn bản đi", f"{metrics['vb_di']:,}")
        with col3:
            st.metric("📋 Công việc đang xử lý", f"{metrics['cv_processing']:,}")
        with col4:
            st.metric("🏢 Cuộc họp", f"{metrics['cuoc_hop']:,}")

        # ── So sánh tháng hiện tại vs tháng trước ─────────────────
        st.markdown("---")
        st.markdown("### 📊 So sánh tháng hiện tại vs tháng trước")

        sorted_months = sorted(df_summary['year_month'].unique())
        if len(sorted_months) >= 2:
            cur_month = sorted_months[-1]
            prev_month = sorted_months[-2]
            df_cur = df_summary[df_summary['year_month'] == cur_month]
            df_prev = df_summary[df_summary['year_month'] == prev_month]

            cur_by_cat = df_cur.groupby('category_vi')['count'].sum()
            prev_by_cat = df_prev.groupby('category_vi')['count'].sum()
            all_cats = list(categories_summary.index)

            cols = st.columns(min(4, len(all_cats)))
            for i, cat in enumerate(all_cats[:4]):
                cur_val = int(cur_by_cat.get(cat, 0))
                prev_val = int(prev_by_cat.get(cat, 0))
                delta = cur_val - prev_val
                delta_pct = f"{delta/prev_val*100:+.1f}%" if prev_val > 0 else "N/A"
                short_cat = cat.split(' ', 1)[-1] if ' ' in cat else cat
                with cols[i % 4]:
                    st.metric(short_cat, f"{cur_val:,}", delta=f"{delta:+,} ({delta_pct})")

            # Bar chart so sánh tháng
            compare_df = pd.DataFrame({
                'Loại': all_cats,
                prev_month: [int(prev_by_cat.get(c, 0)) for c in all_cats],
                cur_month: [int(cur_by_cat.get(c, 0)) for c in all_cats],
            }).melt(id_vars='Loại', var_name='Tháng', value_name='Số lượng')

            fig_compare = px.bar(compare_df, x='Loại', y='Số lượng', color='Tháng',
                                 barmode='group',
                                 title=f'So sánh {prev_month} vs {cur_month}',
                                 color_discrete_sequence=['#95a5a6', '#2ecc71'])
            fig_compare.update_xaxes(tickangle=20)
            fig_compare.update_layout(height=380, legend=dict(orientation='h', y=1.05))
            st.plotly_chart(fig_compare, use_container_width=True)

        # ── Biểu đồ xu hướng + phân bố ────────────────────────────
        st.markdown("---")
        col1, col2 = st.columns(2)

        with col1:
            daily_summary = df_summary.groupby(['datetime', 'category_vi'])['count'].sum().reset_index()
            fig_trend = px.line(daily_summary, x='datetime', y='count', color='category_vi',
                               title='📈 Xu hướng hoạt động theo thời gian',
                               labels={'count': 'Số lượng', 'datetime': 'Ngày', 'category_vi': 'Loại'})
            fig_trend.update_layout(height=380, hovermode='x unified',
                                    legend=dict(orientation='h', y=-0.3, font=dict(size=11)))
            st.plotly_chart(fig_trend, use_container_width=True)

        with col2:
            fig_pie = px.pie(values=categories_summary.values, names=categories_summary.index,
                           title='📊 Phân bố theo loại hoạt động', hole=0.4)
            fig_pie.update_layout(height=380, legend=dict(font=dict(size=11)))
            st.plotly_chart(fig_pie, use_container_width=True)

        # ── Heatmap hoạt động theo ngày trong tuần × tháng ────────
        st.markdown("---")
        st.markdown("### 🌡️ Heatmap hoạt động theo ngày trong tuần")

        daily_total = df_summary.groupby(['datetime', 'weekday_vi', 'month_year_vi'])['count'].sum().reset_index()

        heatmap_data = daily_total.pivot_table(
            index='weekday_vi', columns='month_year_vi', values='count', aggfunc='sum'
        ).reindex(index=[d for d in weekday_order if d in daily_total['weekday_vi'].unique()])

        # Sắp xếp cột theo thời gian
        try:
            heatmap_data = heatmap_data[sorted(heatmap_data.columns, key=lambda x: pd.to_datetime(x, format='%m/%Y'))]
        except Exception:
            pass

        fig_heat = px.imshow(heatmap_data,
                             labels=dict(x='Tháng/Năm', y='Ngày trong tuần', color='Tổng hoạt động'),
                             title='Tổng hoạt động theo ngày trong tuần và tháng',
                             color_continuous_scale='Blues',
                             aspect='auto')
        fig_heat.update_layout(height=320)
        st.plotly_chart(fig_heat, use_container_width=True)

        # ── Phân tích chi tiết (subtabs) ───────────────────────────
        st.markdown("---")
        st.markdown('<div class="section-header">📈 Phân tích chi tiết</div>', unsafe_allow_html=True)

        subtab1, subtab2, subtab3 = st.tabs(["📅 Theo tháng", "📊 Theo loại", "📈 Top ngày"])

        with subtab1:
            monthly_data = df_summary.groupby(['year_month', 'month_year_vi', 'category_vi'])['count'].sum().reset_index()
            fig_monthly = px.bar(monthly_data, x='month_year_vi', y='count', color='category_vi',
                               title='Hoạt động theo tháng/năm (stacked)', barmode='stack',
                               labels={'count': 'Số lượng', 'month_year_vi': 'Tháng/Năm', 'category_vi': 'Loại'})
            fig_monthly.update_xaxes(tickangle=45)
            fig_monthly.update_layout(height=400, legend=dict(orientation='h', y=-0.3))
            st.plotly_chart(fig_monthly, use_container_width=True)

            monthly_stats = df_summary.groupby(['month_year_vi', 'category_vi'])['count'].sum().unstack(fill_value=0)
            try:
                monthly_stats = monthly_stats.sort_index(key=lambda x: pd.to_datetime(x, format='%m/%Y'))
            except Exception:
                pass
            st.dataframe(monthly_stats, use_container_width=True)

        with subtab2:
            for category in categories_summary.index[:4]:
                category_data = df_summary[df_summary['category_vi'] == category]
                daily_trend = category_data.groupby('datetime')['count'].sum()
                monthly_trend = category_data.groupby('month_year_vi')['count'].sum()

                st.markdown(f"#### {category}")
                col_a, col_b, col_c = st.columns([3, 1, 1])

                with col_a:
                    # Trendline + bars
                    fig_cat = go.Figure()
                    fig_cat.add_trace(go.Bar(x=daily_trend.index, y=daily_trend.values,
                                            name='Theo ngày', marker_color='#3498db', opacity=0.5))
                    # Rolling average
                    rolling = daily_trend.rolling(7, min_periods=1).mean()
                    fig_cat.add_trace(go.Scatter(x=rolling.index, y=rolling.values,
                                                name='TB 7 ngày', line=dict(color='#e74c3c', width=2)))
                    fig_cat.update_layout(height=260, title=f'Xu hướng {category}',
                                          showlegend=True, margin=dict(t=40, b=20))
                    st.plotly_chart(fig_cat, use_container_width=True)

                with col_b:
                    st.metric("Tổng", f"{int(category_data['count'].sum()):,}")
                with col_c:
                    st.metric("TB/ngày", f"{category_data['count'].mean():.1f}")

        with subtab3:
            daily_total_sorted = df_summary.groupby('datetime')['count'].sum().sort_values(ascending=False)

            col1, col2 = st.columns(2)
            with col1:
                st.markdown("#### 🏆 Top 10 ngày hoạt động mạnh nhất")
                top10 = daily_total_sorted.head(10).reset_index()
                top10.columns = ['Ngày', 'Tổng']
                top10['Ngày'] = top10['Ngày'].dt.strftime('%d/%m/%Y')
                fig_top = px.bar(top10, x='Tổng', y='Ngày', orientation='h',
                                 title='Top 10 ngày bận nhất',
                                 color='Tổng', color_continuous_scale='Oranges')
                fig_top.update_layout(height=380, yaxis={'categoryorder': 'total ascending'})
                fig_top.update_coloraxes(showscale=False)
                st.plotly_chart(fig_top, use_container_width=True)

            with col2:
                st.markdown("#### 📊 Hoạt động theo ngày trong tuần")
                weekday_stats = df_summary.groupby('weekday_vi')['count'].agg(['sum', 'mean']).round(1)
                weekday_stats.columns = ['Tổng', 'TB/ngày']
                weekday_stats = weekday_stats.reindex([d for d in weekday_order if d in weekday_stats.index])

                fig_weekday = px.bar(weekday_stats, y='Tổng', x=weekday_stats.index,
                                    title='Tổng hoạt động theo ngày trong tuần',
                                    color='Tổng', color_continuous_scale='Blues')
                fig_weekday.update_coloraxes(showscale=False)
                fig_weekday.update_layout(height=380)
                st.plotly_chart(fig_weekday, use_container_width=True)

    else:
        st.warning("⚠️ Chưa có dữ liệu. Vui lòng kiểm tra kết nối GitHub.")
