# Quick Deployment Checklist

## 🚀 Backend Deployment (Choose One)

### Railway (Recommended)
- [ ] Sign up at https://railway.app
- [ ] Create new project from GitHub repo
- [ ] Set Root Directory: `backend`
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm start`
- [ ] Copy backend URL: `https://your-app.railway.app`
- [ ] Test: Visit `https://your-app.railway.app/health`

### Render (Alternative)
- [ ] Sign up at https://render.com
- [ ] Create new Web Service from GitHub repo
- [ ] Root Directory: `backend`
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm start`
- [ ] Copy backend URL: `https://your-app.onrender.com`
- [ ] Test: Visit `https://your-app.onrender.com/health`

---

## 🎨 Frontend Deployment

- [ ] Sign up at https://vercel.com
- [ ] Import GitHub repository
- [ ] Root Directory: `frontend`
- [ ] Framework: Vite (auto-detected)
- [ ] Build Command: `npm install && npm run build` (auto)
- [ ] Output Directory: `dist` (auto)
- [ ] Deploy (first time)

---

## ⚙️ Environment Variables

- [ ] Go to Vercel → Settings → Environment Variables
- [ ] Add: `VITE_API_URL`
- [ ] Value: `https://your-backend-url.com/api` (use your actual backend URL)
- [ ] Select all environments (Production, Preview, Development)
- [ ] Save
- [ ] Redeploy frontend

---

## ✅ Final Verification

- [ ] Backend health check works: `/health` endpoint
- [ ] Frontend loads without errors
- [ ] Can login/signup
- [ ] API calls work (check browser console)
- [ ] No CORS errors

---

## 🔗 Your URLs

**Backend URL**: `_________________________`
**Frontend URL**: `_________________________`
**VITE_API_URL**: `_________________________/api`

---

## 🆘 Common Issues

**404 on API calls?**
→ Check `VITE_API_URL` is set correctly in Vercel
→ Make sure URL ends with `/api`
→ Redeploy frontend

**Backend not starting?**
→ Check Root Directory is `backend`
→ Verify build/start commands
→ Check build logs

**CORS errors?**
→ Backend CORS should allow your Vercel domain
→ Update `server.ts` if needed
→ Redeploy backend
