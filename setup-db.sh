#!/bin/bash

echo "🚀 Setup Database cho Hệ thống Báo cáo Tuần"
echo "============================================"

# Bước 1: Khởi động PostgreSQL
echo ""
echo "📦 Bước 1: Khởi động PostgreSQL..."
brew services start postgresql@16

# Đợi PostgreSQL khởi động
sleep 3

# Bước 2: Tạo database
echo ""
echo "🗄️  Bước 2: Tạo database 'report_db'..."
/opt/homebrew/opt/postgresql@16/bin/createdb report_db 2>/dev/null || echo "Database đã tồn tại hoặc có lỗi (có thể bỏ qua nếu database đã có)"

# Bước 3: Push schema
echo ""
echo "📋 Bước 3: Push Prisma schema vào database..."
npx prisma db push

# Bước 4: Seed data
echo ""
echo "🌱 Bước 4: Seed dữ liệu mẫu..."
npx prisma db seed

echo ""
echo "✅ Setup hoàn tất!"
echo ""
echo "📧 Tài khoản mẫu:"
echo "   Email: admin@example.com"
echo "   Password: 123456"
echo ""
echo "🎯 Chạy app:"
echo "   npm run dev"
echo ""
echo "🔍 Xem database:"
echo "   npx prisma studio"
echo ""
