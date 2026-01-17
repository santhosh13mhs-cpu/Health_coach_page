# How to Set Environment Variable in Vercel

## Quick Steps:

1. **Go to Vercel Dashboard**: https://vercel.com
2. **Select Your Project**: Click on your project (e.g., `healthcoachmodule`)
3. **Navigate to Settings**: Click "Settings" tab at the top
4. **Go to Environment Variables**: Click "Environment Variables" in the left sidebar
5. **Add/Edit Variable**:
   - Click "Add New" or find existing `VITE_API_URL`
   - **Key**: `VITE_API_URL`
   - **Value**: Your backend API URL (see examples below)
   - **Environments**: Select all (Production, Preview, Development)
   - Click "Save"
6. **Redeploy**: Go to "Deployments" tab → Click "..." on latest deployment → "Redeploy"

## Example Values:

### If your backend is deployed to Railway:
```
VITE_API_URL=https://your-app-name.railway.app/api
```

### If your backend is deployed to Heroku:
```
VITE_API_URL=https://your-app-name.herokuapp.com/api
```

### If your backend is deployed to Render:
```
VITE_API_URL=https://your-app-name.onrender.com/api
```

### If your backend is on AWS/GCP:
```
VITE_API_URL=https://api.yourdomain.com/api
```

### For local development (if testing locally):
```
VITE_API_URL=http://localhost:5000/api
```

## Important Notes:

- ✅ The value must include `/api` at the end if your backend routes use `/api` prefix
- ✅ After adding/updating the variable, you **MUST** redeploy for changes to take effect
- ✅ The variable will be available in your frontend build as `import.meta.env.VITE_API_URL`
- ✅ Make sure CORS is configured on your backend to allow requests from your Vercel domain

## Troubleshooting:

- **404 errors still happening?** → Wait for deployment to finish, then hard refresh (Ctrl+Shift+R)
- **Variable not working?** → Check that you selected all environments (Production, Preview, Development)
- **Backend not accessible?** → Verify your backend is deployed and running
