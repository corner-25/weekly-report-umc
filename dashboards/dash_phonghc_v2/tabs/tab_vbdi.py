import streamlit as st
import pandas as pd

from data_loader import load_data_from_github, load_processed_data
from utils import create_outgoing_pivot_table, create_outgoing_docs_charts
from config import render_date_range


def render():
    st.markdown('<div class="tab-header">📤 Quản lý Văn bản Đi</div>', unsafe_allow_html=True)

    # ── Fast path: dữ liệu đã xử lý sẵn ──
    processed, is_processed = load_processed_data('vanbanphathanh.json')
    if is_processed and processed and processed.get("records"):
        df_out = pd.DataFrame(processed["records"])
        df_out['datetime'] = pd.to_datetime(df_out['datetime'])
    else:
        # ── Slow path: load raw JSON rồi xử lý ──
        df_out = load_data_from_github('vanbanphathanh.json')

        if df_out is not None:
            # Flatten nested structure để tạo các cột _total
            for index, row in df_out.iterrows():
                # Extract totals from nested objects
                if 'contracts' in row and isinstance(row['contracts'], dict):
                    df_out.loc[index, 'contracts_total'] = row['contracts'].get('total', 0)
                if 'decisions' in row and isinstance(row['decisions'], dict):
                    df_out.loc[index, 'decisions_total'] = row['decisions'].get('total', 0)
                if 'regulations' in row and isinstance(row['regulations'], dict):
                    df_out.loc[index, 'regulations_total'] = row['regulations'].get('total', 0)
                if 'rules' in row and isinstance(row['rules'], dict):
                    df_out.loc[index, 'rules_total'] = row['rules'].get('total', 0)
                if 'procedures' in row and isinstance(row['procedures'], dict):
                    df_out.loc[index, 'procedures_total'] = row['procedures'].get('total', 0)
                if 'instruct' in row and isinstance(row['instruct'], dict):
                    df_out.loc[index, 'instruct_total'] = row['instruct'].get('total', 0)

            # Xử lý datetime
            if 'datetime' not in df_out.columns:
                if all(col in df_out.columns for col in ['year', 'month', 'date']):
                    df_out['datetime'] = pd.to_datetime(df_out[['year', 'month', 'date']].rename(columns={'date': 'day'}))
                elif all(col in df_out.columns for col in ['Year', 'Month', 'Date']):
                    df_out['datetime'] = pd.to_datetime(df_out[['Year', 'Month', 'Date']].rename(columns={'Date': 'day'}))

            # Thêm các cột cần thiết
            df_out['weekday'] = df_out['datetime'].dt.day_name()
            df_out['weekday_vi'] = df_out['weekday'].map({
                'Monday': 'Thứ 2', 'Tuesday': 'Thứ 3', 'Wednesday': 'Thứ 4',
                'Thursday': 'Thứ 5', 'Friday': 'Thứ 6', 'Saturday': 'Thứ 7', 'Sunday': 'Chủ nhật'
            })
            df_out['year'] = df_out['datetime'].dt.year
            df_out['month'] = df_out['datetime'].dt.month
            df_out['week'] = df_out['datetime'].dt.isocalendar().week

            # Tính total_outgoing (tổng các loại văn bản bao gồm cả documents)
            total_columns = ['documents', 'contracts_total', 'decisions_total', 'regulations_total',
                           'rules_total', 'procedures_total', 'instruct_total']
            for col in total_columns:
                if col not in df_out.columns:
                    df_out[col] = 0

            df_out['total_outgoing'] = df_out[total_columns].sum(axis=1)

    if df_out is not None:

        render_date_range(df_out)

        # Thống kê tổng quan
        st.markdown("### 📊 Thống kê tổng quan văn bản đi")

        # Hàng 1: Thống kê chính
        col1, col2, col3, col4, col5 = st.columns(5)

        with col1:
            # Tính tổng tất cả các loại văn bản đi (bao gồm cả documents)
            total_docs = df_out['documents'].sum() if 'documents' in df_out.columns else 0
            total_contracts = df_out['contracts_total'].sum() if 'contracts_total' in df_out.columns else 0
            total_decisions = df_out['decisions_total'].sum() if 'decisions_total' in df_out.columns else 0
            total_regulations = df_out['regulations_total'].sum() if 'regulations_total' in df_out.columns else 0
            total_rules = df_out['rules_total'].sum() if 'rules_total' in df_out.columns else 0
            total_procedures = df_out['procedures_total'].sum() if 'procedures_total' in df_out.columns else 0
            total_instruct = df_out['instruct_total'].sum() if 'instruct_total' in df_out.columns else 0

            total_outgoing = total_docs + total_contracts + total_decisions + total_regulations + total_rules + total_procedures + total_instruct
            st.metric("📄 Tổng văn bản đi", f"{int(total_outgoing):,}")

        with col2:
            st.metric("📝 Văn bản phát hành", f"{int(total_docs):,}")

        with col3:
            st.metric("📁 Hợp đồng", f"{int(total_contracts):,}")

        with col4:
            st.metric("⚖️ Quyết định", f"{int(total_decisions):,}")

        with col5:
            # Tính trung bình dựa trên tổng văn bản thực tế
            if len(df_out) > 0:
                avg_daily = total_outgoing / len(df_out)
                st.metric("📈 TB/ngày", f"{avg_daily:.1f}")
            else:
                st.metric("📈 TB/ngày", "0")

        # Hàng 2: Thống kê quy định và quy chế
        st.markdown("#### 📋 Thống kê quy định và quy chế")
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric("📜 Quy định", f"{int(total_regulations):,}")

        with col2:
            st.metric("📋 Quy chế", f"{int(total_rules):,}")

        with col3:
            st.metric("🔄 Quy trình", f"{int(total_procedures):,}")

        with col4:
            st.metric("📚 Hướng dẫn", f"{int(total_instruct):,}")

        st.markdown("---")

        # Pivot Table
        selected_period_type_out = create_outgoing_pivot_table(df_out)

        st.markdown("---")

        # Biểu đồ
        create_outgoing_docs_charts(df_out, selected_period_type_out)

        # Bảng dữ liệu chi tiết
        st.markdown("### 📋 Chi tiết dữ liệu")

        # Lọc dữ liệu
        col1, col2 = st.columns(2)
        with col1:
            date_range_out = st.date_input(
                "📅 Chọn khoảng thời gian",
                value=(df_out['datetime'].min(), df_out['datetime'].max()),
                min_value=df_out['datetime'].min(),
                max_value=df_out['datetime'].max(),
                key="outgoing_date_range"
            )

        with col2:
            min_docs_out = st.number_input("📊 Số văn bản tối thiểu", min_value=0, value=0, key="outgoing_min_docs")

        # Áp dụng filter
        if len(date_range_out) == 2:
            filtered_df_out = df_out[
                (df_out['datetime'] >= pd.to_datetime(date_range_out[0])) &
                (df_out['datetime'] <= pd.to_datetime(date_range_out[1])) &
                (df_out['documents'] >= min_docs_out)
            ]
        else:
            filtered_df_out = df_out[df_out['documents'] >= min_docs_out]
        display_cols_out = ['datetime', 'total_outgoing', 'documents', 'contracts_total', 'decisions_total',
                           'regulations_total', 'rules_total', 'procedures_total', 'instruct_total']
        # Chỉ hiển thị các cột có trong DataFrame
        display_cols_out = [col for col in display_cols_out if col in filtered_df_out.columns]

        # Thêm cột contracts, decisions detail nếu có
        detail_cols = ['contracts', 'decisions']
        for col in detail_cols:
            if col in filtered_df_out.columns:
                display_cols_out.append(col)

        st.dataframe(filtered_df_out[display_cols_out], use_container_width=True)
    else:
        st.warning("⚠️ Chưa có dữ liệu văn bản đi. Vui lòng kiểm tra kết nối GitHub.")
