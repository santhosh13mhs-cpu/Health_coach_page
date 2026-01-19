# Complete Deployment Guide - Frontend & Backend

This guide will walk you through deploying both the frontend and backend of your AI Diet Plan application.

## 📋 Prerequisites

- GitHub account (for code hosting)
- Vercel account (for frontend - free)
- Railway account (for backend - recommended, free tier available) OR Render account (free alternative)

---

## 🚀 Part 1: Deploy Backend

### Option A: Deploy Backend on Railway (Recommended - Easiest)

#### Step 1: Prepare Your Backend

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

#### Step 2: Deploy on Railway

1. **Go to Railway**: https://railway.app
2. **Sign up/Login** with your GitHub account
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your repository** (`Ai Diet Plan`)
6. **Railway will auto-detect** your backend folder

#### Step 3: Configure Railway Settings

1. **Set Root Directory**:
   - Go to Settings → Source
   - Set Root Directory to: `backend`

2. **Configure Build & Start Commands**:
   - Go to Settings → Deploy
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

3. **Set Environment Variables** (if needed):
   - Go to Variables tab
   - Add any required variables (your backend might not need any for basic setup)

4. **Get Your Backend URL**:
   - Go to Settings → Networking
   - Railway will generate a URL like: `https://your-app-name.railway.app`
   - **Copy this URL** - you'll need it for the frontend!

#### Step 4: Verify Backend is Running

1. Visit: `https://your-backend-url.railway.app/health`
2. You should see: `{"status":"ok","message":"Server is running"}`
3. If it works, your backend is deployed! ✅

---

### Option B: Deploy Backend on Render (Free Alternative)

#### Step 1: Prepare Your Backend

1. **Push your code to GitHub** (if not already done)

#### Step 2: Deploy on Render

1. **Go to Render**: https://render.com
2. **Sign up/Login** with your GitHub account
3. **Click "New +" → "Web Service"**
4. **Connect your GitHub repository**
5. **Configure the service**:
   - **Name**: `ai-diet-plan-backend` (or any name)
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if you prefer)

6. **Click "Create Web Service"**

#### Step 3: Get Your Backend URL

1. Wait for deployment to complete (2-3 minutes)
2. Render will provide a URL like: `https://your-app-name.onrender.com`
3. **Copy this URL** - you'll need it for the frontend!

#### Step 4: Verify Backend is Running

1. Visit: `https://your-backend-url.onrender.com/health`
2. You should see: `{"status":"ok","message":"Server is running"}`
3. If it works, your backend is deployed! ✅

---

## 🎨 Part 2: Deploy Frontend on Vercel

### Step 1: Prepare Your Frontend

1. **Make sure your code is pushed to GitHub**

### Step 2: Deploy on Vercel

1. **Go to Vercel**: https://vercel.com
2. **Sign up/Login** with your GitHub account
3. **Click "Add New..." → "Project"**
4. **Import your GitHub repository** (`Ai Diet Plan`)
5. **Configure Project Settings**:
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `frontend` (click "Edit" and set to `frontend`)
   - **Build Command**: `npm install && npm run build` (should auto-fill)
   - **Output Directory**: `dist` (should auto-fill)
   - **Install Command**: `npm install` (should auto-fill)

6. **Click "Deploy"** (don't add environment variables yet - we'll do that after)

### Step 3: Set Environment Variables in Vercel

**IMPORTANT**: You must set this after your backend is deployed!

1. **Go to your project** in Vercel Dashboard
2. **Click "Settings"** tab
3. **Click "Environment Variables"** in the left sidebar
4. **Click "Add New"**
5. **Add the following variable**:
   - **Key**: `VITE_API_URL`
   - **Value**: 
     - If using Railway: `https://your-backend-url.railway.app/api`
     - If using Render: `https://your-backend-url.onrender.com/api`
     - **Replace with your actual backend URL!**
   - **Environments**: Select all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
6. **Click "Save"**

### Step 4: Redeploy Frontend

1. **Go to "Deployments"** tab
2. **Click the "..." menu** on your latest deployment
3. **Click "Redeploy"**
4. **Wait for deployment to complete** (1-2 minutes)

### Step 5: Verify Frontend is Working

1. **Visit your Vercel URL** (e.g., `https://your-app.vercel.app`)
2. **Try to login or access the app**
3. **Check browser console** (F12) for any errors
4. **If you see API errors**, double-check your `VITE_API_URL` is correct

---

## 🔧 Part 3: Configure CORS (Important!)

Your backend needs to allow requests from your Vercel frontend domain.

### Update Backend CORS Configuration

1. **Check your backend `server.ts`** - it should already have CORS enabled:
   ```typescript
   app.use(cors())
   ```

2. **If you need to restrict CORS** to only your Vercel domain**, update it to:
   ```typescript
   app.use(cors({
     origin: [
       'https://your-frontend.vercel.app',
       'http://localhost:3000' // for local development
     ],
     credentials: true
   }))
   ```

3. **Redeploy your backend** after making changes

---

## ✅ Part 4: Final Checklist

- [ ] Backend deployed and accessible at `/health` endpoint
- [ ] Frontend deployed on Vercel
- [ ] `VITE_API_URL` environment variable set in Vercel
- [ ] Frontend redeployed after setting environment variable
- [ ] CORS configured on backend (if needed)
- [ ] Test login/signup functionality
- [ ] Test API calls from frontend

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Backend returns 404 or doesn't start
- **Solution**: Check that Root Directory is set to `backend` in Railway/Render
- **Solution**: Verify build command is `npm install && npm run build`
- **Solution**: Verify start command is `npm start`

**Problem**: Database errors
- **Solution**: SQLite database file should be created automatically on first run
- **Solution**: Check that `uploads` folder exists (it will be created automatically)

### Frontend Issues

**Problem**: 404 errors on API calls
- **Solution**: Verify `VITE_API_URL` is set correctly in Vercel
- **Solution**: Make sure URL ends with `/api`
- **Solution**: Redeploy frontend after setting environment variable

**Problem**: CORS errors
- **Solution**: Update backend CORS to allow your Vercel domain
- **Solution**: Redeploy backend after CORS changes

**Problem**: Build fails on Vercel
- **Solution**: Check that Root Directory is set to `frontend`
- **Solution**: Verify Node.js version (should be >= 18.0.0)
- **Solution**: Check build logs in Vercel for specific errors

### Connection Issues

**Problem**: Frontend can't connect to backend
- **Solution**: Test backend URL directly: `https://your-backend-url.com/health`
- **Solution**: Verify `VITE_API_URL` includes `/api` at the end
- **Solution**: Check that backend is actually running (not sleeping on free tier)

---

## 📝 Quick Reference

### Backend URLs
- **Railway**: `https://your-app.railway.app`
- **Render**: `https://your-app.onrender.com`

### Frontend URLs
- **Vercel**: `https://your-app.vercel.app`

### Environment Variables

**Vercel (Frontend)**:
```
VITE_API_URL=https://your-backend-url.com/api
```

**Railway/Render (Backend)**:
- Usually no environment variables needed for basic setup
- Add any custom variables if your backend requires them

---

## 🎉 Success!

Once everything is deployed:
1. Your frontend will be live on Vercel
2. Your backend will be live on Railway/Render
3. They will communicate via the `VITE_API_URL` environment variable
4. Users can access your app from anywhere!

---

## 📞 Need Help?

If you encounter issues:
1. Check the build logs in Railway/Render/Vercel
2. Check browser console for frontend errors
3. Test backend endpoints directly using the `/health` endpoint
4. Verify all environment variables are set correctly
