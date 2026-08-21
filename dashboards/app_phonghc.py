"""Entrypoint dashboard Hành chính — service Streamlit độc lập.

Dùng bản v2 (`dash_phonghc_v2/`): lấy dữ liệu từ HC OfficeAPI qua kho trung gian
và trực quan hoá theo 13 tab nghiệp vụ. Bản cũ `dash_phonghc_old.py` giữ lại làm
tham chiếu, không còn được deploy.

Chạy local:
    streamlit run dashboards/app_phonghc.py
"""
import os
import sys

import streamlit as st

# set_page_config phải là lệnh Streamlit ĐẦU TIÊN, trước cả khi import module
# dashboard — vì module đó gọi st.* ở cấp module.
st.set_page_config(
    page_title="Dashboard Hành chính — UMC",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="expanded",
)

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
# dash_phonghc_v2 import theo tên phẳng (`from config import ...`), nên thư mục
# của nó cũng phải nằm trên sys.path.
sys.path.insert(0, os.path.join(_HERE, "dash_phonghc_v2"))

from dash_phonghc_v2.app import main  # noqa: E402  (phải import sau set_page_config)

if __name__ == "__main__":
    main()
