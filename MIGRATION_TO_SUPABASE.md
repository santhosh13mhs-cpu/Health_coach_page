# Migration from SQLite to Supabase

## 🎯 What Changed

Your backend now supports **both SQLite (local) and Supabase/PostgreSQL (production)**!

### How It Works:

- **Local Development**: Uses SQLite (no changes needed)
- **Production**: Uses Supabase when `DATABASE_URL` environment variable is set

---

## ✅ What Was Added

1. **Database Adapter** (`backend/src/database/db-adapter.ts`)
   - Automatically detects which database to use
   - Converts SQL queries to work with both SQLite and PostgreSQL
   - Handles connection pooling for PostgreSQL

2. **Supabase Migration SQL** (`backend/supabase-migration.sql`)
   - Complete schema for all tables
   - Indexes and triggers
   - Ready to run in Supabase SQL Editor

3. **Updated Dependencies**
   - Added `pg` (PostgreSQL client)
   - Added `@types/pg` (TypeScript types)

4. **Documentation**
   - `SUPABASE_SETUP.md` - Complete setup guide
   - `MIGRATION_TO_SUPABASE.md` - This file

---

## 🚀 Quick Start

### For Production (Supabase):

1. **Follow `SUPABASE_SETUP.md`** for detailed instructions
2. **Set `DATABASE_URL`** environment variable in Render
3. **Run migration SQL** in Supabase
4. **Redeploy backend**

### For Local Development:

**No changes needed!** It will continue using SQLite automatically.

---

## 📝 Environment Variables

### Required for Supabase:

```env
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

### Optional:

```env
NODE_ENV=production
CREATE_DEFAULT_ADMIN=false
```

---

## 🔄 Backward Compatibility

✅ **All existing code works without changes**
- Controllers don't need updates
- Same API functions (`dbGet`, `dbAll`, `dbRun`, etc.)
- Automatic query conversion

---

## 📊 Database Differences Handled

| Feature | SQLite | PostgreSQL | Solution |
|---------|--------|------------|----------|
| Placeholders | `?` | `$1, $2, ...` | Auto-converted |
| Auto-increment | `AUTOINCREMENT` | `SERIAL` | Handled automatically |
| Last ID | `this.lastID` | `RETURNING id` | Auto-added to INSERT |
| Column check | `PRAGMA table_info` | `information_schema` | Different queries |
| Timestamps | `DATETIME` | `TIMESTAMP` | Compatible |

---

## ✅ Testing Checklist

After setting up Supabase:

- [ ] Backend connects to Supabase (check logs)
- [ ] Tables created successfully
- [ ] Can create users (signup works)
- [ ] Can login (OTP and password)
- [ ] Can create tasks
- [ ] Can upload documents
- [ ] All API endpoints work

---

## 🐛 Troubleshooting

### Still using SQLite in production?

- Check `DATABASE_URL` is set correctly
- Check it starts with `postgresql://`
- Restart backend after setting variable

### Connection errors?

- Verify Supabase project is active
- Check connection string format
- Verify password is correct

### Query errors?

- Check migration was run completely
- Verify table names match (case-sensitive in PostgreSQL)
- Check logs for specific error messages

---

## 📚 Next Steps

1. **Read**: `SUPABASE_SETUP.md` for detailed setup
2. **Set up**: Supabase project and get connection string
3. **Deploy**: Set `DATABASE_URL` in Render
4. **Test**: Verify everything works

---

**Your app is now ready for Supabase!** 🎉
