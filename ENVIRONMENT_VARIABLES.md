# Environment Variables for Vercel Deployment

## Frontend Environment Variables (Required)

Copy these variables into your Vercel project settings:

### Variable 1: VITE_API_URL

**Variable Name:**
```
VITE_API_URL
```

**Value (Replace with your backend URL):**
```
https://your-backend-url.com/api
```

**Environments:** 
- ✅ Production
- ✅ Preview  
- ✅ Development

---

## Quick Copy-Paste Template:

### For Vercel Dashboard:

**Key:**
```
VITE_API_URL
```

**Value:** (Replace the placeholder with your actual backend URL)
```
https://your-backend-url.com/api
```

**Example Values:**

**Railway Backend:**
```
https://your-app-name.railway.app/api
```

**Heroku Backend:**
```
https://your-app-name.herokuapp.com/api
```

**Render Backend:**
```
https://your-app-name.onrender.com/api
```

**Custom Domain:**
```
https://api.yourdomain.com/api
```

**Local Development (Development environment only):**
```
http://localhost:5000/api
```

---

## Step-by-Step Instructions:

1. **Open Vercel Dashboard**: https://vercel.com
2. **Select Your Project**
3. **Go to**: Settings → Environment Variables
4. **Click**: "Add New" button
5. **Paste** the following:

   **Key:** `VITE_API_URL`
   
   **Value:** `https://your-backend-url.com/api` (replace with your actual backend URL)
   
   **Environments:** Select all three (Production, Preview, Development)
   
6. **Click**: "Save"
7. **Redeploy**: Go to Deployments → Click "..." → "Redeploy"

---

## Important Notes:

- ⚠️ **Replace** `your-backend-url.com` with your actual deployed backend URL
- ✅ The URL **must end with** `/api` if your backend routes use `/api` prefix
- ✅ After adding, you **MUST** redeploy for changes to take effect
- ✅ Select **ALL** environments (Production, Preview, Development)
- ✅ The variable will be available as `import.meta.env.VITE_API_URL` in your frontend code
