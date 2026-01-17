# Deployment Guide

## Frontend Deployment on Vercel

### Environment Variables Setup

To deploy the frontend successfully, you need to configure the backend API URL in Vercel:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add the following variable:
   - **Variable Name**: `VITE_API_URL`
   - **Value**: Your deployed backend API URL (e.g., `https://your-backend.railway.app/api` or `https://your-backend.herokuapp.com/api`)
   - **Environment**: Production, Preview, and Development

### Without Environment Variable

If `VITE_API_URL` is not set, the frontend will default to `/api`, which requires:
- Either the backend to be deployed on the same domain (using Vercel rewrites)
- Or a separate backend deployment with API routes configured

### Backend Deployment

The backend needs to be deployed separately. You can deploy it to:
- Railway
- Heroku
- AWS
- Google Cloud
- Or any Node.js hosting service

Then update the `VITE_API_URL` environment variable to point to your deployed backend.

### Testing Locally

For local development, create a `.env` file in the `frontend` directory:

```
VITE_API_URL=http://localhost:5000/api
```

## Common Issues

### 404 Errors on API Calls

If you see 404 errors for `/api/*` endpoints:
1. Check if `VITE_API_URL` is set correctly in Vercel
2. Verify your backend is deployed and accessible
3. Ensure CORS is configured on your backend to allow requests from your Vercel domain

### Build Failures

If the build fails:
1. Ensure all dependencies are listed in `package.json`
2. Check that Node.js version is compatible (>= 18.0.0)
3. Verify TypeScript compilation passes locally before deploying
