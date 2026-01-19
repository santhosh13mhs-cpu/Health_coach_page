# Database Setup Guide

## 🔍 The Problem

If you're seeing "Email not found. Please contact admin." error, it means the user doesn't exist in the database yet.

## ✅ Solution: Seed the Database

### Option 1: Automatic (Development Mode)

The database will automatically create a default admin user when you start the server **if no users exist** (only in development mode).

**Default Admin Credentials:**
- Email: `santhosh.13mhs@gmail.com`
- Password: `admin123` (for password login)
- For OTP login: Just use the email

### Option 2: Manual Seeding

Run the seed script to create the default admin user:

```bash
cd backend
npm run seed
```

This will:
- Initialize the database (if not already done)
- Create a default admin user if it doesn't exist
- Show you all users in the database

### Option 3: Sign Up

Users can also sign up through the frontend:
1. Go to `/signup` page
2. Fill in the form
3. The email `santhosh.13mhs@gmail.com` will automatically get ADMIN role

---

## 🚀 Quick Start

### For Local Development:

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **The default admin user will be created automatically** (if database is empty)

3. **Login with:**
   - Email: `santhosh.13mhs@gmail.com`
   - For OTP: Just enter the email
   - For Password: Use `admin123`

### For Production/Deployment:

1. **After deploying, run the seed script:**
   ```bash
   npm run seed
   ```

2. **Or manually create users** through the signup page

3. **⚠️ IMPORTANT:** Change the default password in production!

---

## 📝 Manual User Creation

You can also create users through the API:

### Signup Endpoint:
```bash
POST /api/auth/signup
Content-Type: application/json

{
  "name": "Your Name",
  "email": "your.email@example.com",
  "password": "your-password",
  "role": "USER"  // or "COACH" or "ADMIN"
}
```

**Note:** The email `santhosh.13mhs@gmail.com` automatically gets ADMIN role when signing up.

---

## 🔧 Troubleshooting

### Database file not found?

The database file (`database.sqlite`) is created automatically in the `backend` folder when the server starts.

### Users not showing up?

1. Check if the database file exists: `backend/database.sqlite`
2. Run the seed script: `npm run seed`
3. Check server logs for database initialization messages

### Still getting "Email not found"?

1. **Verify the email exists:**
   ```bash
   npm run seed
   ```
   This will list all users in the database.

2. **Check the email spelling** - it's case-insensitive but must match exactly

3. **Try signing up** with that email first

---

## 📊 Check Database Contents

To see all users in the database:

```bash
cd backend
npm run seed
```

This will show:
- Total number of users
- List of all users with their emails and roles

---

## ⚠️ Production Notes

1. **Change default password** - The default `admin123` password should be changed in production
2. **Set environment variable** `CREATE_DEFAULT_ADMIN=false` to disable automatic admin creation
3. **Use proper user management** - Create users through signup or admin panel
4. **Secure the database** - Make sure `database.sqlite` is not publicly accessible

---

## ✅ Verification

After seeding, you should be able to:
1. ✅ Login with OTP using `santhosh.13mhs@gmail.com`
2. ✅ Login with password using the same email and `admin123`
3. ✅ Access admin dashboard

---

**After running the seed script, try logging in again!** 🎉
