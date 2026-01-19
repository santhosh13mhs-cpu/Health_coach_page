# Fix Render Deployment Error

## 🔍 The Problem

You're seeing this error on Render:
```
Error: Cannot find module '/opt/render/project/src/backend/dist/server.js'
```

This happens because Render can't find the compiled `server.js` file after the build.

## ✅ The Solution

### Option 1: Fix Render Settings (Recommended)

1. **Go to Render Dashboard**: https://render.com
2. **Select your backend service**
3. **Go to**: Settings
4. **Check/Update these settings**:
   - **Root Directory**: `backend` (must be exactly `backend`, not empty or `.`)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: `18.x` or `20.x` (check your package.json engines)

5. **Save** the settings
6. **Go to**: Manual Deploy → Clear build cache & deploy

### Option 2: Use render.yaml (Alternative)

I've created a `render.yaml` file in your project root. If Render supports it:

1. **Go to Render Dashboard**
2. **Select your service**
3. **Go to**: Settings → Blueprint
4. **Connect the render.yaml file** (if available)
5. **Or manually set the commands from render.yaml**:
   - Build: `cd backend && npm install && npm run build`
   - Start: `cd backend && npm start`

---

## 🔧 What I Fixed

1. **Updated `backend/package.json`**:
   - Added build verification script
   - Added postbuild script to check if dist/server.js exists
   - Better error messages if build fails

2. **Created `render.yaml`**:
   - Explicit configuration for Render
   - Sets correct build and start commands
   - Configures environment variables

---

## 📋 Step-by-Step Fix

### Step 1: Verify Render Settings

1. **Root Directory**: Must be `backend`
   - If it's empty or `.`, change it to `backend`
   - This tells Render to run commands from the backend folder

2. **Build Command**: `npm install && npm run build`
   - This installs dependencies and compiles TypeScript

3. **Start Command**: `npm start`
   - This runs `node dist/server.js`

### Step 2: Clear Build Cache

1. **Go to**: Manual Deploy
2. **Click**: "Clear build cache & deploy"
3. **Wait** for deployment to complete

### Step 3: Check Build Logs

After deployment, check the build logs for:
- ✅ `Build completed. Checking dist/server.js...`
- ✅ `✓ dist/server.js exists`
- ❌ If you see errors, check the logs for details

### Step 4: Verify Deployment

1. **Visit**: `https://your-app.onrender.com/health`
2. **Should see**: `{"status":"ok","message":"Server is running"}`
3. **If it works**: ✅ Your backend is fixed!

---

## 🐛 Common Issues

### Issue 1: Root Directory is Wrong

**Symptom**: Error shows path like `/opt/render/project/src/backend/...`

**Fix**: 
- Set Root Directory to `backend` (not empty, not `.`, not `src/backend`)

### Issue 2: Build Command Not Running

**Symptom**: Build completes but dist folder is empty

**Fix**:
- Make sure Build Command is: `npm install && npm run build`
- Check build logs for TypeScript compilation errors

### Issue 3: TypeScript Not Compiling

**Symptom**: No errors but dist/server.js doesn't exist

**Fix**:
- Check `backend/tsconfig.json` exists
- Verify `outDir` is set to `./dist`
- Check build logs for TypeScript errors

### Issue 4: Wrong Node Version

**Symptom**: Build fails with module errors

**Fix**:
- Set Node version to `18.x` or `20.x` in Render settings
- Check `package.json` engines field

---

## ✅ Verification Checklist

- [ ] Root Directory set to `backend` in Render
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm start`
- [ ] Build cache cleared
- [ ] Build logs show "✓ dist/server.js exists"
- [ ] Health endpoint works: `/health`
- [ ] No errors in Render logs

---

## 📝 Quick Reference

**Correct Render Settings:**
```
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm start
Node Version: 18.x or 20.x
```

**What the build should create:**
```
backend/
  ├── dist/
  │   └── server.js  ← This file must exist!
  ├── src/
  ├── package.json
  └── tsconfig.json
```

---

**After following these steps, your Render deployment should work!** 🎉
