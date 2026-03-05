# Logo Setup Guide

## Thêm Logo vào Sidebar

Để hiển thị logo trong sidebar, đặt file logo của bạn vào thư mục này với tên:

```
/public/logo.png
```

### Yêu cầu:
- **Định dạng:** PNG (có nền trong suốt tốt nhất)
- **Kích thước:** Ảnh ngang (landscape), ví dụ: 200x60px, 300x90px
- **Tên file:** `logo.png` (chữ thường)

### Vị trí hiển thị:
Logo sẽ xuất hiện trong sidebar, ngay trên menu "Tổng quan"

### Chiều cao hiển thị:
Logo sẽ được scale về chiều cao 64px (h-16), chiều rộng tự động theo tỷ lệ

### Nếu không có logo:
Sidebar vẫn hoạt động bình thường, chỉ không hiển thị phần logo

---

## Ví dụ cấu trúc file:

```
report-app/
├── public/
│   ├── logo.png          ← Đặt logo vào đây
│   ├── LOGO_README.md    ← File này
│   └── uploads/
```

---

## Cách thêm logo:

1. Chuẩn bị file logo (PNG, JPG, hoặc SVG)
2. Đổi tên thành `logo.png`
3. Copy vào `/public/logo.png`
4. Refresh trình duyệt

Hoặc qua Railway:
1. Upload logo vào repository GitHub
2. Railway sẽ tự động deploy và hiển thị logo
