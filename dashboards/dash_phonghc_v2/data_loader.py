import streamlit as st
import pandas as pd
import json
import os
import base64
import requests
import toml
from datetime import datetime
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Tắt SettingWithCopyWarning — các tab dùng .copy() và .loc đúng cách
pd.options.mode.chained_assignment = None


def _clean_nbsp(df):
    """Thay thế ký tự non-breaking space (\xa0) trong các cột object để tránh lỗi Arrow."""
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].str.replace('\xa0', ' ', regex=False)
    return df


# Load secrets từ file nếu st.secrets không có
def load_secrets():
    """Load secrets từ nhiều vị trí có thể"""
    try:
        # Thử lấy từ st.secrets trước
        github_token = st.secrets.get("github_token", "")
        github_owner = st.secrets.get("github_owner", "")
        github_repo = st.secrets.get("github_repo", "")

        if github_token and github_owner and github_repo:
            return github_token, github_owner, github_repo
    except:
        pass

    # Thử đọc từ file .streamlit/secrets.toml (local development)
    try:
        _this_dir = os.path.dirname(os.path.abspath(__file__))
        secrets_paths = [
            os.path.join(_this_dir, ".streamlit", "secrets.toml"),
            os.path.join(os.path.dirname(_this_dir), ".streamlit", "secrets.toml"),
        ]
        for path in secrets_paths:
            if os.path.exists(path):
                secrets = toml.load(path)
                token = secrets.get("github_token", "")
                owner = secrets.get("github_owner", "")
                repo = secrets.get("github_repo", "")
                if token and owner and repo:
                    return token, owner, repo
    except Exception:
        pass

    return "", "", ""


@st.cache_data(ttl=3600, show_spinner=False)
def load_processed_data(filename):
    """
    Tải pre-processed JSON từ GitHub (processed_{filename}).
    Dùng raw URL thay vì Contents API — nhanh hơn ~4x (không cần base64 decode).
    Trả về (data_dict, True) nếu tìm thấy, (None, False) nếu không.
    """
    try:
        result = load_secrets()
        if not result or not isinstance(result, tuple) or len(result) != 3:
            return None, False
        github_token, github_owner, github_repo = result

        processed_name = f"processed_{filename}"
        # raw.githubusercontent.com: 1 request, không base64, nhanh nhất
        url = f"https://raw.githubusercontent.com/{github_owner}/{github_repo}/main/{processed_name}"
        headers = {"Authorization": f"token {github_token}"}
        response = requests.get(url, headers=headers, verify=False, timeout=30)

        if response.status_code != 200:
            return None, False

        data = response.json()

        if isinstance(data, dict) and "data" in data:
            return data["data"], True
        return None, False

    except Exception:
        return None, False


@st.cache_data(ttl=3600, show_spinner=False)
def load_data_from_github_optimized(filename, use_cache=True, max_rows=None):
    """Load dữ liệu tối ưu - Nhanh hơn 6-10 lần"""
    try:
        result = load_secrets()
        if not result or not isinstance(result, tuple) or len(result) != 3:
            st.error("❌ Không thể load GitHub credentials")
            return None

        github_token, github_owner, github_repo = result

        headers = {"Authorization": f"token {github_token}"}
        progress_bar = st.progress(0, text=f"⏳ Đang load {filename}...")

        # Download
        url = f"https://api.github.com/repos/{github_owner}/{github_repo}/contents/{filename}"
        response = requests.get(url, headers=headers, verify=False, timeout=30)
        progress_bar.progress(30, text="⏳ Đang download...")

        if response.status_code != 200:
            progress_bar.empty()
            st.warning(f"⚠️ Không tìm thấy {filename}")
            return None

        # Decode & Parse
        content = response.json()
        file_content = base64.b64decode(content["content"]).decode('utf-8')
        progress_bar.progress(60, text="⏳ Đang parse JSON...")

        data = json.loads(file_content)
        if isinstance(data, dict) and "data" in data:
            records = data["data"]
        else:
            records = data

        # Limit rows if needed
        if max_rows and len(records) > max_rows:
            st.warning(f"⚠️ File có {len(records):,} records. Chỉ load {max_rows:,} đầu.")
            records = records[:max_rows]

        progress_bar.progress(90, text="⏳ Tạo DataFrame...")

        # Create DataFrame
        df = pd.DataFrame(records)

        # Clean non-breaking spaces để tránh lỗi Arrow serialization
        df = _clean_nbsp(df)

        # Optimize memory
        for col in df.select_dtypes(include=['object']).columns:
            try:
                df[col] = pd.to_numeric(df[col], errors='ignore')
            except:
                pass
            if df[col].dtype == 'object':
                unique_ratio = df[col].nunique() / len(df)
                if unique_ratio < 0.5:
                    df[col] = df[col].astype('category')

        progress_bar.progress(100, text="✅ Hoàn thành!")
        progress_bar.empty()
        return df

    except Exception as e:
        st.error(f"❌ Lỗi: {str(e)}")
        return None


# Hàm lưu cache lên GitHub
def save_cache_to_github(filename, data_df, original_sha=None):
    """Lưu cache DataFrame lên GitHub repo"""
    try:
        # Sử dụng hàm load_secrets để lấy credentials
        result = load_secrets()
        if not result or not isinstance(result, tuple) or len(result) != 3:
            st.warning("⚠️ Không thể lưu cache: Không có GitHub credentials")
            return False

        github_token, github_owner, github_repo = result

        cache_filename = f"cache_{filename}"
        cache_data = {
            "data": data_df.to_dict('records'),
            "cached_at": datetime.now().isoformat(),
            "original_file": filename,
            "original_sha": original_sha or ""  # Lưu SHA của file gốc
        }

        url = f"https://api.github.com/repos/{github_owner}/{github_repo}/contents/{cache_filename}"
        headers = {"Authorization": f"token {github_token}"}

        # Check if cache file exists
        response = requests.get(url, headers=headers, verify=False)

        content_encoded = base64.b64encode(json.dumps(cache_data).encode()).decode()

        if response.status_code == 200:
            # Update existing cache
            sha = response.json()['sha']
            payload = {
                "message": f"🔄 Update cache for {filename}",
                "content": content_encoded,
                "sha": sha
            }
        else:
            # Create new cache
            payload = {
                "message": f"💾 Create cache for {filename}",
                "content": content_encoded
            }

        put_response = requests.put(url, headers=headers, json=payload, verify=False)
        if put_response.status_code in [200, 201]:
            return True
    except Exception as e:
        st.warning(f"⚠️ Không thể lưu cache: {str(e)}")
    return False


# Hàm tiện ích để load dữ liệu từ GitHub với cache trên GitHub
@st.cache_data(ttl=3600, show_spinner=False)
def load_data_from_github(filename, use_cache=True):
    """Load dữ liệu từ GitHub private repo, có Streamlit cache 1 giờ."""
    try:
        result = load_secrets()
        if not result or not isinstance(result, tuple) or len(result) != 3:
            st.error(f"❌ Không thể load GitHub credentials để load {filename}")
            return None

        github_token, github_owner, github_repo = result

        if not all([github_token, github_owner, github_repo]):
            st.error(f"❌ Chưa cấu hình GitHub để load {filename}")
            return None

        headers = {"Authorization": f"token {github_token}"}

        url = f"https://raw.githubusercontent.com/{github_owner}/{github_repo}/main/{filename}"
        response = requests.get(url, headers=headers, verify=False, timeout=30)

        if response.status_code != 200:
            st.warning(f"⚠️ Không tìm thấy {filename} trên GitHub")
            return None

        data = response.json()

        if isinstance(data, dict) and "data" in data:
            df = pd.DataFrame(data["data"])
        else:
            df = pd.DataFrame(data)

        # Clean non-breaking spaces để tránh lỗi Arrow serialization
        df = _clean_nbsp(df)

        return df

    except Exception as e:
        st.error(f"❌ Lỗi load {filename} từ GitHub: {str(e)}")
        return None


# ===== GITHUB MANAGER CLASS =====
class GitHubDataManager:
    def __init__(self):
        try:
            # Sử dụng hàm load_secrets đã định nghĩa ở trên
            result = load_secrets()
            if result and isinstance(result, tuple) and len(result) == 3:
                self.github_token, self.github_owner, self.github_repo = result
            else:
                self.github_token = ""
                self.github_owner = ""
                self.github_repo = ""
        except Exception as e:
            # Nếu không có secrets, sử dụng giá trị mặc định
            self.github_token = ""
            self.github_owner = ""
            self.github_repo = ""

    def check_github_connection(self):
        """Kiểm tra kết nối GitHub"""
        if not all([self.github_token, self.github_owner, self.github_repo]):
            return False, "❌ Chưa cấu hình GitHub credentials"

        try:
            headers = {"Authorization": f"token {self.github_token}"}
            url = f"https://api.github.com/repos/{self.github_owner}/{self.github_repo}"
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                return True, "✅ Kết nối GitHub thành công"
            else:
                return False, f"❌ Lỗi kết nối GitHub: {response.status_code}"
        except Exception as e:
            return False, f"❌ Lỗi kết nối: {str(e)}"

    def load_current_data(_self):
        """Tải dữ liệu hiện tại từ GitHub"""
        try:
            headers = {"Authorization": f"token {_self.github_token}"}

            # Tải file current_dashboard_data.json
            file_url = f"https://api.github.com/repos/{_self.github_owner}/{_self.github_repo}/contents/current_dashboard_data.json"
            response = requests.get(file_url, headers=headers)

            if response.status_code == 200:
                file_info = response.json()
                download_url = file_info['download_url']

                # Tải và đọc file JSON
                file_response = requests.get(download_url)
                if file_response.status_code == 200:
                    json_data = file_response.json()

                    # Chuyển JSON thành DataFrame
                    if isinstance(json_data, dict) and 'data' in json_data:
                        df = pd.DataFrame(json_data['data'])
                    elif isinstance(json_data, list):
                        df = pd.DataFrame(json_data)
                    else:
                        df = pd.DataFrame(json_data)

                    metadata = {
                        'filename': 'current_dashboard_data.json',
                        'source': 'GitHub',
                        'sha': file_info['sha'],
                        'last_modified': file_info.get('last_modified', 'N/A'),
                        'size': file_info['size']
                    }

                    return df, metadata
            else:
                return None, None

        except Exception as e:
            st.error(f"Lỗi tải dữ liệu từ GitHub: {str(e)}")
            return None, None


# ===== DATA MANAGER CLASS =====
class DataManager:
    def __init__(self):
        self.data = None
        self.metadata = None

    def load_data_from_file(self, file):
        """Load dữ liệu từ file upload"""
        try:
            if file.name.endswith('.csv'):
                df = pd.read_csv(file)
            elif file.name.endswith('.json'):
                df = pd.read_json(file)
            elif file.name.endswith(('.xlsx', '.xls')):
                # Đọc Excel, nếu có nhiều sheet thì lấy sheet đầu tiên
                try:
                    df = pd.read_excel(file, sheet_name=0)
                except Exception as e:
                    # Nếu lỗi, thử đọc với engine khác
                    df = pd.read_excel(file, engine='openpyxl' if file.name.endswith('.xlsx') else 'xlrd')
            else:
                return False, "❌ Format file không hỗ trợ. Chỉ hỗ trợ CSV, JSON, Excel (.xlsx, .xls)"

            self.data = df
            self.metadata = {
                'filename': file.name,
                'file_type': file.name.split('.')[-1].upper(),
                'rows': len(df),
                'columns': list(df.columns),
                'categories': df['Danh mục'].unique().tolist() if 'Danh mục' in df.columns else [],
                'upload_time': pd.Timestamp.now()
            }

            return True, "✅ Tải dữ liệu thành công"

        except Exception as e:
            return False, f"❌ Lỗi đọc file: {str(e)}"

    def load_data_from_github(self, data, metadata):
        """Set dữ liệu từ GitHub vào DataManager"""
        try:
            self.data = data
            self.metadata = metadata
            return True, "✅ Load GitHub data thành công"
        except Exception as e:
            return False, f"❌ Lỗi: {str(e)}"

    def get_category_data(self, category_name):
        """Lấy dữ liệu theo danh mục"""
        if self.data is None:
            return None

        if 'Danh mục' not in self.data.columns:
            return self.data  # Trả về toàn bộ nếu không có cột Danh mục

        filtered_data = self.data[self.data['Danh mục'] == category_name]
        return filtered_data if not filtered_data.empty else None

    def get_other_categories_data(self, excluded_categories):
        """Lấy dữ liệu cho các danh mục không thuộc danh sách loại trừ"""
        if self.data is None:
            return None

        if 'Danh mục' not in self.data.columns:
            return self.data

        filtered_data = self.data[~self.data['Danh mục'].isin(excluded_categories)]
        return filtered_data if not filtered_data.empty else None
