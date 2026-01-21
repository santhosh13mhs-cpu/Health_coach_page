# 🚀 Supabase Quick Start Guide

This is a step-by-step guide to set up Supabase for your AI Diet Plan application.

---

## ⚡ Quick Setup (5 Steps)

### Step 1: Create Supabase Project (2 minutes)

1. **Go to**: https://supabase.com
2. **Sign up/Login** (use GitHub for easy signup)
3. **Click "New Project"**
4. **Fill in**:
   - **Name**: `ai-diet-plan-db` (or any name you like)
   - **Database Password**: ⚠️ **Create a STRONG password and SAVE IT!**
   - **Region**: Choose closest to you (e.g., `Southeast Asia (Singapore)`)
   - **Plan**: Free (perfect for starting)
5. **Click "Create new project"**
6. **Wait 2-3 minutes** for project to initialize

---

### Step 2: Get Connection String (1 minute)

1. In your Supabase project dashboard, click **"Settings"** (gear icon ⚙️)
2. Click **"Database"** in the left sidebar
3. Scroll down to **"Connection string"** section
4. Click the **"URI"** tab
5. You'll see something like:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
6. **Copy this connection string**
7. **Replace `[PASSWORD]`** with your actual database password (the one you created in Step 1)
8. **Final format should be**:
   ```
   postgresql://postgres.[PROJECT-REF]:your-actual-password@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
9. **Save this connection string** - you'll need it in Step 4!

---

### Step 3: Run Database Migration (2 minutes)

1. In Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"** button
3. **Open** the file: `backend/supabase-migration.sql` in your project
4. **Copy ALL the contents** of that file
5. **Paste** into the SQL Editor
6. **Click "Run"** button (or press `Ctrl+Enter`)
7. **Wait for success message** - should say "Success. No rows returned"
8. **Verify tables were created**:
   - Click **"Table Editor"** in left sidebar
   - You should see tables: `users`, `coaches`, `leads`, `tasks`, etc.

---

### Step 4: Set Environment Variable

#### Option A: For Local Testing

1. **Create/Edit** file: `backend/.env`
2. **Add this line**:
   ```env
   DATABASE_URL=postgresql://postgres.[PROJECT-REF]:your-password@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   (Replace with your actual connection string from Step 2)

3. **Save the file**

#### Option B: For Production (Render/Railway)

1. **Go to your hosting platform** (Render/Railway)
2. **Navigate to**: Your Backend Service → Environment Variables
3. **Add new variable**:
   - **Key**: `DATABASE_URL`
   - **Value**: Your connection string from Step 2
4. **Save**
5. **Redeploy** your backend service

---

### Step 5: Verify Setup

#### For Local Testing:

1. **Open terminal** in the `backend` folder
2. **Run**:
   ```bash
   npm run verify-supabase
   ```
3. **You should see**:
   ```
   ✅ DATABASE_URL is set
   ✅ Connected to PostgreSQL/Supabase
   ✅ All required tables exist
   ```

#### For Production:

1. **Check your backend logs** (in Render/Railway dashboard)
2. **Look for**: `✅ Connected to PostgreSQL/Supabase database`
3. **Test API**: Visit `https://your-backend-url.com/health`
4. **Should return**: `{"status":"ok","message":"Server is running"}`

---

## 🌱 Create Admin User

After setup, create your first admin user:

### Option 1: Through Frontend (Easiest)

1. **Go to your frontend signup page**
2. **Sign up** with email: `santhosh.13mhs@gmail.com`
3. **This email automatically gets ADMIN role**

### Option 2: Through API

```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "santhosh.13mhs@gmail.com",
    "password": "your-secure-password",
    "role": "ADMIN"
  }'
```

---

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] Connection string obtained and saved
- [ ] Migration SQL script run successfully
- [ ] Tables visible in Supabase Table Editor
- [ ] `DATABASE_URL` environment variable set
- [ ] Backend connected (check logs or run `npm run verify-supabase`)
- [ ] Admin user created
- [ ] Can login successfully

---

## 🐛 Troubleshooting

### "DATABASE_URL is not set"
- Make sure you created `backend/.env` file (for local)
- Or set it in your hosting platform (for production)
- Restart your backend after setting

### "Connection refused" or "Connection error"
- Check your connection string format
- Verify password is correct (no spaces, special characters URL-encoded)
- Make sure Supabase project is active (not paused)

### "Table does not exist"
- Go back to Step 3 and run the migration SQL again
- Check Supabase Table Editor to see which tables exist

### "Still using SQLite"
- Make sure `DATABASE_URL` starts with `postgresql://`
- Restart your backend server
- Check logs for connection messages

---

## 📚 Next Steps

1. **View your data**: Go to Supabase Dashboard → Table Editor
2. **Run queries**: Use SQL Editor for custom queries
3. **Monitor usage**: Check Settings → Database → Usage
4. **Set up backups**: Settings → Database → Backups

---

## 🔒 Security Reminders

- ⚠️ **Never commit** `.env` file to git
- ⚠️ **Never share** your connection string publicly
- ✅ **Use environment variables** for all sensitive data
- ✅ **Rotate passwords** regularly

---

## 📞 Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **Your Migration File**: `backend/supabase-migration.sql`
- **Full Setup Guide**: `SUPABASE_SETUP.md`
- **Verification Script**: Run `npm run verify-supabase` in backend folder

---

**🎉 Once all steps are complete, your app is using Supabase!**
