# Backend Deployment Checklist - Fix 404 Error

## Issue: Getting 404 on `/health` endpoint

### Step 1: Verify Backend URL
1. Go to Render Dashboard: https://dashboard.render.com
2. Click on your backend service: `ai-diet-plan-backend`
3. Check the URL in the top section (should be like: `https://your-app.onrender.com`)
4. **Copy this exact URL** - you'll need it below

### Step 2: Check Environment Variables
1. In Render, go to **"Environment"** tab
2. Verify these variables exist:
   - ✅ `DATABASE_URL` = `postgresql://postgres.ogstjbrsovgtamhcprcl:123myhealthschool@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`
   - ✅ `NODE_ENV` = `production`
   - ✅ `PORT` = `10000` (or whatever Render assigns)

### Step 3: Check Build & Start Commands
1. Go to **"Settings"** tab in Render
2. Verify:
   - **Root Directory**: `backend` (or leave empty if using render.yaml)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### Step 4: Check Logs
1. Go to **"Logs"** tab in Render
2. Look for:
   - ✅ `Server is running on port...`
   - ✅ `✅ Connected to PostgreSQL/Supabase database`
   - ❌ Any errors (connection failures, build errors, etc.)

### Step 5: Test the Correct URL
Try these URLs (replace `your-backend-url` with your actual Render URL):

1. **Health endpoint** (should work):
   ```
   https://your-backend-url.onrender.com/health
   ```

2. **API info endpoint**:
   ```
   https://your-backend-url.onrender.com/api
   ```

3. **Root URL** (might show 404, that's OK):
   ```
   https://your-backend-url.onrender.com/
   ```

### Step 6: Manual Redeploy
If still getting 404:

1. In Render, go to **"Events"** or **"Deployments"** tab
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Wait 2-3 minutes for deployment
4. Check logs again
5. Test `/health` endpoint again

### Step 7: Verify Build Success
1. Check **"Logs"** tab during deployment
2. Look for:
   - ✅ `npm install` completed
   - ✅ `npm run build` completed
   - ✅ `npm start` executed
   - ✅ `Server is running on port...`

### Common Issues & Fixes

#### Issue: "Cannot find module" errors
**Fix**: Make sure Root Directory is set to `backend` in Render settings

#### Issue: "Port already in use"
**Fix**: Render automatically sets PORT, don't hardcode it. Use `process.env.PORT || 5000`

#### Issue: "Database connection failed"
**Fix**: 
- Verify `DATABASE_URL` is set correctly
- Check password is correct
- Ensure Supabase project is active

#### Issue: Build fails
**Fix**:
- Check Node.js version (should be 18+)
- Verify all dependencies in package.json
- Check for TypeScript errors

### Quick Test Commands

**PowerShell:**
```powershell
Invoke-WebRequest -Uri "https://your-backend-url.onrender.com/health"
```

**Browser:**
Just visit: `https://your-backend-url.onrender.com/health`

**Expected Response:**
```json
{"status":"ok","message":"Server is running"}
```

---

## If Still Not Working

1. **Share your Render backend URL** (I can help test it)
2. **Share a screenshot of Render logs** (last 50 lines)
3. **Check if backend service is "Live"** (green status in Render)

---

## Next Steps After Fix

Once `/health` works:
1. ✅ Backend is deployed correctly
2. ✅ Test your frontend (should connect to backend)
3. ✅ Verify data is coming from Supabase
4. ✅ Test login/signup functionality
