# Fix "Cannot GET /api" 404 Error

## 🔍 The Problem

You're seeing "Cannot GET /api" because:
1. The frontend is trying to call `/api` on your **Vercel domain** (not your backend)
2. This happens when `VITE_API_URL` environment variable is **not set** in Vercel
3. Without this variable, the frontend defaults to `/api` (relative path), which tries to use the Vercel domain

## ✅ The Solution

### Step 1: Set Environment Variable in Vercel

1. **Go to Vercel Dashboard**: https://vercel.com
2. **Select your project**
3. **Go to**: Settings → Environment Variables
4. **Click "Add New"**
5. **Add this variable**:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://health-coach-page-2.onrender.com/api`
   - **Important**: Make sure the URL ends with `/api`
   - **Environments**: Select all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
6. **Click "Save"**

### Step 2: Redeploy Frontend

1. **Go to "Deployments"** tab in Vercel
2. **Click the "..." menu** on your latest deployment
3. **Click "Redeploy"**
4. **Wait for deployment to complete** (1-2 minutes)

### Step 3: Verify It Works

1. **Visit your Vercel frontend URL**
2. **Open browser console** (F12)
3. **Check Network tab** - API calls should now go to `https://health-coach-page-2.onrender.com/api/*`
4. **The 404 error should be gone!**

---

## 🔧 What Changed

I also updated your backend to add a helpful `/api` endpoint that shows available routes. After you redeploy the backend, you can visit:
- `https://health-coach-page-2.onrender.com/api` - Shows API info
- `https://health-coach-page-2.onrender.com/health` - Health check

---

## 🚨 Important Notes

- **The environment variable MUST be set before the frontend build** - Vite reads it at build time
- **After setting the variable, you MUST redeploy** - The variable is baked into the build
- **The URL must end with `/api`** - Your backend routes are at `/api/*`

---

## ✅ Quick Checklist

- [ ] `VITE_API_URL` set in Vercel = `https://health-coach-page-2.onrender.com/api`
- [ ] All environments selected (Production, Preview, Development)
- [ ] Frontend redeployed after setting variable
- [ ] Backend redeployed (to get the new `/api` endpoint)
- [ ] Test frontend - 404 error should be gone!

---

## 🐛 Still Not Working?

1. **Check the environment variable is set correctly**:
   - Go to Vercel → Settings → Environment Variables
   - Verify `VITE_API_URL` exists and value is correct

2. **Check the build logs**:
   - In Vercel deployment logs, look for the build output
   - Make sure the variable was available during build

3. **Test backend directly**:
   - Visit: `https://health-coach-page-2.onrender.com/health`
   - Should return: `{"status":"ok","message":"Server is running"}`
   - Visit: `https://health-coach-page-2.onrender.com/api`
   - Should return API info JSON

4. **Check browser console**:
   - Open DevTools (F12) → Network tab
   - See what URL the frontend is trying to call
   - Should be `https://health-coach-page-2.onrender.com/api/*`

---

**After following these steps, your frontend should successfully connect to your backend!** 🎉
