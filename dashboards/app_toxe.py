"""Entrypoint dashboard Tổ Xe — chạy như một service Streamlit độc lập.

Trước đây dashboard này nằm trong main_dashboard.py và được nạp động qua
importlib. Nay mỗi dashboard deploy riêng nên cần entrypoint gọi thẳng main().

Chạy local:
    streamlit run dashboards/app_toxe.py
"""
import os
import sys

import streamlit as st

# set_page_config phải là lệnh Streamlit ĐẦU TIÊN, trước cả khi import module
# dashboard — vì module đó gọi st.* ở cấp module.
st.set_page_config(
    page_title="Dashboard Tổ Xe — UMC",
    page_icon="🚗",
    layout="wide",
    initial_sidebar_state="expanded",
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dash_toxe import main  # noqa: E402  (phải import sau set_page_config)

if __name__ == "__main__":
    main()
