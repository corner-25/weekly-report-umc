#!/bin/bash

# Railway Database Setup Script
# Hướng dẫn sử dụng:
# 1. Đảm bảo đã cài Railway CLI: npm i -g @railway/cli
# 2. Login: railway login
# 3. Chạy script này: bash railway-setup.sh

echo "🚀 Railway Database Setup for Weekly Report System"
echo "=================================================="
echo ""

# Step 1: Link to project
echo "📦 Step 1: Linking to Railway project..."
echo "Project ID: 82127d1a-930c-4574-bcc7-3ce41364ac8d"
echo ""
echo "Please run this command manually:"
echo "  railway link"
echo "Then select: corner-25's Projects -> weekly-report-umc"
echo ""
read -p "Press Enter after linking the project..."

# Step 2: Check environment
echo ""
echo "🔍 Step 2: Checking environment variables..."
railway variables

# Step 3: Generate Prisma Client
echo ""
echo "⚙️  Step 3: Generating Prisma Client..."
railway run npx prisma generate

# Step 4: Push database schema
echo ""
echo "📊 Step 4: Pushing database schema to Railway..."
railway run npx prisma db push --accept-data-loss

# Step 5: Run migrations (if exists)
echo ""
echo "🔄 Step 5: Running migrations..."
railway run npx prisma migrate deploy

# Step 6: Seed database
echo ""
echo "🌱 Step 6: Seeding database with initial data..."
railway run npx prisma db seed

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Visit: https://weekly-report-umc.up.railway.app"
echo "2. Create your first admin account"
echo "3. Start using the system!"
echo ""
echo "🔍 To view database:"
echo "  railway run npx prisma studio"
