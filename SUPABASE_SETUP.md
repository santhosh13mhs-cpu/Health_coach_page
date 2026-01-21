# Supabase Setup Guide

## 🎯 Overview

This guide will help you migrate from SQLite (local) to Supabase (PostgreSQL) for production deployment.

## 📋 Prerequisites

1. A Supabase account (free tier available at https://supabase.com)
2. Your backend code deployed (or ready to deploy)

---

## 🚀 Step 1: Create Supabase Project

1. **Go to Supabase**: https://supabase.com
2. **Sign up/Login** with your GitHub account
3. **Click "New Project"**
4. **Fill in details**:
   - **Name**: `ai-diet-plan-db` (or any name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
   - **Plan**: Free (or paid if you prefer)
5. **Click "Create new project"**
6. **Wait 2-3 minutes** for project to be created

---

## 🔑 Step 2: Get Database Connection String

1. **Go to your Supabase project dashboard**
2. **Click "Settings"** (gear icon) → **"Database"**
3. **Scroll down to "Connection string"**
4. **Select "URI"** tab
5. **Copy the connection string** - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
6. **Replace `[YOUR-PASSWORD]`** with your actual database password
7. **Save this connection string** - you'll need it for environment variables

---

## 📝 Step 3: Run Database Migration

1. **Go to Supabase Dashboard** → Your Project
2. **Click "SQL Editor"** in the left sidebar
3. **Click "New query"**
4. **Copy the contents** of `backend/supabase-migration.sql`
5. **Paste into the SQL Editor**
6. **Click "Run"** (or press Ctrl+Enter)
7. **Wait for success message** - all tables should be created

---

## ⚙️ Step 4: Set Environment Variable

### For Render Deployment:

1. **Go to Render Dashboard** → Your Backend Service
2. **Go to**: Environment → Environment Variables
3. **Click "Add Environment Variable"**
4. **Add**:
   - **Key**: `DATABASE_URL`
   - **Value**: Your Supabase connection string (from Step 2)
   - **Example**: `postgresql://postgres:yourpassword@db.xxxxx.supabase.co:5432/postgres`
5. **Click "Save"**
6. **Redeploy** your backend service

### For Local Testing:

Create/update `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:yourpassword@db.xxxxx.supabase.co:5432/postgres
NODE_ENV=development
```

---

## 🌱 Step 5: Seed the Database

After setting up Supabase, seed it with the default admin user:

### Option 1: Through API (Recommended)

1. **Start your backend** (with `DATABASE_URL` set)
2. **Use the signup endpoint**:
   ```bash
   curl -X POST https://your-backend-url.com/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Admin User",
       "email": "santhosh.13mhs@gmail.com",
       "password": "your-secure-password",
       "role": "ADMIN"
     }'
   ```

### Option 2: Through Frontend

1. **Go to your frontend signup page**
2. **Sign up** with `santhosh.13mhs@gmail.com`
3. **It will automatically get ADMIN role**

### Option 3: Manual SQL (Advanced)

Run this in Supabase SQL Editor:
```sql
-- Hash password: admin123 (you should change this!)
INSERT INTO users (name, email, password, role) 
VALUES (
  'Admin User',
  'santhosh.13mhs@gmail.com',
  '$2a$10$rOzJqZqZqZqZqZqZqZqZqOqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq',
  'ADMIN'
);
```

**Note**: You'll need to generate a bcrypt hash for the password. Use an online tool or run:
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(h => console.log(h))"
```

---

## ✅ Step 6: Verify Connection

1. **Check backend logs** - should show:
   ```
   ✅ Connected to PostgreSQL/Supabase database
   ```

2. **Test API endpoints**:
   - Health: `https://your-backend-url.com/health`
   - Should return: `{"status":"ok","message":"Server is running"}`

3. **Try logging in** with your admin credentials

---

## 🔄 How It Works

The backend automatically detects which database to use:

- **If `DATABASE_URL` is set** (starts with `postgres`): Uses Supabase/PostgreSQL
- **If `DATABASE_URL` is NOT set**: Uses SQLite (local development)

This means:
- ✅ **Local development**: Works with SQLite (no setup needed)
- ✅ **Production**: Uses Supabase (just set `DATABASE_URL`)

---

## 🐛 Troubleshooting

### Connection Error?

1. **Check connection string** - Make sure password is correct
2. **Check Supabase project** - Make sure it's active (not paused)
3. **Check firewall** - Supabase allows connections from anywhere by default
4. **Check logs** - Look for specific error messages

### Tables Not Found?

1. **Run migration again** - Go to SQL Editor and run `supabase-migration.sql`
2. **Check table names** - PostgreSQL is case-sensitive for quoted identifiers
3. **Verify migration** - Check Supabase Dashboard → Table Editor

### Still Using SQLite?

1. **Check environment variable** - Make sure `DATABASE_URL` is set correctly
2. **Restart backend** - Environment variables are read at startup
3. **Check logs** - Should say "Connected to PostgreSQL/Supabase database"

---

## 📊 Database Management

### View Data in Supabase:

1. **Go to Supabase Dashboard** → Your Project
2. **Click "Table Editor"** in left sidebar
3. **Browse tables** and view/edit data

### Run Queries:

1. **Go to "SQL Editor"**
2. **Write and run SQL queries**
3. **Save queries** for later use

### Backup Database:

1. **Go to Settings** → Database
2. **Click "Backups"** tab
3. **Download backup** or set up automated backups

---

## 🔒 Security Notes

1. **Never commit** `DATABASE_URL` to git
2. **Use environment variables** for all sensitive data
3. **Rotate passwords** regularly
4. **Enable Row Level Security (RLS)** in Supabase if needed
5. **Use connection pooling** (Supabase handles this automatically)

---

## 📝 Environment Variables Summary

**Required for Supabase:**
```env
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

**Optional:**
```env
NODE_ENV=production
CREATE_DEFAULT_ADMIN=false
EMAIL_SERVICE_ENABLED=true
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-email-password
EMAIL_FROM=noreply@example.com
```

---

## ✅ Checklist

- [ ] Created Supabase project
- [ ] Got database connection string
- [ ] Ran migration SQL script
- [ ] Set `DATABASE_URL` environment variable in Render
- [ ] Redeployed backend
- [ ] Verified connection in logs
- [ ] Seeded database with admin user
- [ ] Tested login functionality
- [ ] Verified data appears in Supabase Table Editor

---

**After completing these steps, your app will use Supabase for production!** 🎉
