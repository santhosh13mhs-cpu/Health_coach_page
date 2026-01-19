# Fix Mobile 404 Error

## 🔍 The Problem

You're seeing 404 errors on mobile devices when navigating to routes like `/user-dashboard`, `/coach-dashboard`, etc. This happens because:

1. Mobile browsers handle routing differently than desktop browsers
2. The Vercel rewrite rules might not be matching correctly on mobile
3. Caching issues on mobile browsers can persist 404 errors

## ✅ The Solution

### Step 1: Updated vercel.json Configuration

I've updated your `vercel.json` with a more reliable configuration that works on all devices including mobile:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    {
      "source": "/((?!api|_next|.*\\..*).*)",
      "destination": "/index.html"
    }
  ]
}
```

### Step 2: Verify Vercel Project Settings

1. **Go to Vercel Dashboard**: https://vercel.com
2. **Select your project**
3. **Go to**: Settings → General
4. **Check "Root Directory"**:
   - If it's set to `frontend`, then the `outputDirectory` in vercel.json should be `dist` (not `frontend/dist`)
   - If it's set to `.` (root), then keep `frontend/dist` as is
5. **Framework Preset**: Should be "Vite" or "Other"

### Step 3: Clear Mobile Browser Cache

On mobile devices:
1. **Clear browser cache** (Settings → Clear browsing data)
2. **Or use incognito/private mode** to test
3. **Hard refresh** the page

### Step 4: Redeploy

1. **Go to "Deployments"** tab in Vercel
2. **Click the "..." menu** on your latest deployment
3. **Click "Redeploy"**
4. **Wait for deployment to complete** (1-2 minutes)

### Step 5: Test on Mobile

1. **Visit your Vercel URL on mobile**
2. **Try navigating to different routes**:
   - `/login`
   - `/user-dashboard`
   - `/coach-dashboard`
   - `/admin`
3. **All routes should work without 404 errors**

---

## 🔧 Alternative Configuration (If Above Doesn't Work)

If you're still experiencing issues, try this alternative `vercel.json`:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://health-coach-page-2.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Note**: This simpler pattern will rewrite ALL requests (except API) to index.html. Vercel will automatically serve static files (JS, CSS, images) correctly.

---

## 🚨 Important Notes

1. **Root Directory Setting**: Make sure your Vercel project's root directory matches your vercel.json configuration
2. **Build Output**: The `outputDirectory` must point to where Vite outputs the build (usually `dist` or `frontend/dist`)
3. **Mobile Caching**: Mobile browsers cache more aggressively - clear cache or use incognito mode for testing
4. **Environment Variables**: Ensure `VITE_API_URL` is set correctly in Vercel (see FIX_404_ERROR.md)

---

## 🐛 Still Not Working?

### Check These:

1. **Vercel Build Logs**:
   - Go to Deployments → Click on latest deployment → View build logs
   - Check if build completed successfully
   - Verify the output directory exists

2. **Network Tab on Mobile**:
   - Open mobile browser DevTools (if available) or use remote debugging
   - Check Network tab to see what requests are failing
   - Verify the response for route requests (should be index.html, not 404)

3. **Test Direct URL**:
   - Try accessing `https://your-vercel-url.vercel.app/index.html` directly
   - If this works but routes don't, it's a routing issue
   - If this doesn't work, it's a build/deployment issue

4. **Check Vercel Function Logs**:
   - Go to Vercel Dashboard → Your Project → Functions
   - Check for any errors in the logs

---

## ✅ Quick Checklist

- [ ] `vercel.json` updated with correct configuration
- [ ] Vercel project root directory matches configuration
- [ ] Frontend redeployed after changes
- [ ] Mobile browser cache cleared
- [ ] Tested on mobile device (not just desktop mobile view)
- [ ] `VITE_API_URL` environment variable is set in Vercel
- [ ] All routes work on desktop browser
- [ ] All routes work on mobile browser

---

**After following these steps, your mobile 404 errors should be resolved!** 🎉
