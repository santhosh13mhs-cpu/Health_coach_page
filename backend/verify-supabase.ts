// Script to verify Supabase connection and setup
import 'dotenv/config'
import { initializeDatabaseConnection, getDatabase, dbAll, getDatabaseType } from './src/database/db-adapter.js'

async function verifySupabase() {
  console.log('🔍 Verifying Supabase Setup...\n')

  // Check if DATABASE_URL is set
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log('❌ DATABASE_URL environment variable is not set')
    console.log('   Your app is currently using SQLite (local development mode)')
    console.log('\n📝 To use Supabase:')
    console.log('   1. Create a Supabase project at https://supabase.com')
    console.log('   2. Get your connection string from Settings → Database')
    console.log('   3. Set DATABASE_URL environment variable')
    console.log('   4. Restart this script\n')
    process.exit(1)
  }

  if (!databaseUrl.startsWith('postgres')) {
    console.log('⚠️  DATABASE_URL does not start with "postgres"')
    console.log('   Expected format: postgresql://postgres:password@host:port/database')
    process.exit(1)
  }

  console.log('✅ DATABASE_URL is set')
  console.log(`   Type: ${databaseUrl.startsWith('postgresql://') ? 'PostgreSQL/Supabase' : 'Unknown'}\n`)

  try {
    // Initialize connection
    console.log('🔌 Connecting to database...')
    initializeDatabaseConnection()
    const db = getDatabase()
    const dbType = getDatabaseType()

    if (dbType === 'sqlite') {
      console.log('⚠️  Still using SQLite - DATABASE_URL might not be recognized')
      console.log('   Make sure DATABASE_URL starts with "postgresql://"')
      process.exit(1)
    }

    console.log('✅ Connected to PostgreSQL/Supabase\n')

    // Check if tables exist
    console.log('📊 Checking database tables...')
    const tables = await dbAll(
      db,
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    )

    const expectedTables = [
      'coaches',
      'leads',
      'users',
      'coach_users',
      'user_coach_mapping',
      'tasks',
      'user_tasks',
      'otp_verifications',
      'task_documents',
      'report_data'
    ]

    console.log(`   Found ${tables.length} tables\n`)

    const existingTableNames = tables.map((t: any) => t.table_name.toLowerCase())
    const missingTables = expectedTables.filter(
      (table) => !existingTableNames.includes(table.toLowerCase())
    )

    if (missingTables.length > 0) {
      console.log('⚠️  Missing tables:')
      missingTables.forEach((table) => console.log(`   - ${table}`))
      console.log('\n📝 To fix:')
      console.log('   1. Go to Supabase Dashboard → SQL Editor')
      console.log('   2. Run the migration script: backend/supabase-migration.sql')
      console.log('   3. Verify all tables are created\n')
    } else {
      console.log('✅ All required tables exist:')
      expectedTables.forEach((table) => {
        const exists = existingTableNames.includes(table.toLowerCase())
        console.log(`   ${exists ? '✅' : '❌'} ${table}`)
      })
      console.log()
    }

    // Check if users table has data
    console.log('👥 Checking users...')
    const userCount = await dbAll(db, 'SELECT COUNT(*) as count FROM users')
    const count = (userCount[0] as any)?.count || 0
    console.log(`   Found ${count} user(s)`)

    if (count === 0) {
      console.log('\n📝 No users found. You can create an admin user:')
      console.log('   1. Use the signup API endpoint')
      console.log('   2. Or use the frontend signup page')
      console.log('   3. Email: santhosh.13mhs@gmail.com will get ADMIN role\n')
    } else {
      console.log('✅ Users table has data\n')
    }

    // Test a simple query
    console.log('🧪 Testing database queries...')
    try {
      await dbAll(db, 'SELECT 1 as test')
      console.log('✅ Database queries are working\n')
    } catch (error: any) {
      console.log(`❌ Query test failed: ${error.message}\n`)
      process.exit(1)
    }

    console.log('🎉 Supabase setup verification complete!')
    console.log('\n✅ Your backend is ready to use Supabase')
    console.log('   - Connection: Working')
    console.log('   - Tables: ' + (missingTables.length === 0 ? 'All present' : 'Some missing'))
    console.log('   - Users: ' + (count > 0 ? 'Has data' : 'Empty (create admin user)'))

  } catch (error: any) {
    console.error('\n❌ Error connecting to Supabase:')
    console.error(`   ${error.message}\n`)
    console.log('🔧 Troubleshooting:')
    console.log('   1. Check your DATABASE_URL is correct')
    console.log('   2. Verify your Supabase project is active (not paused)')
    console.log('   3. Check that your password in the connection string is correct')
    console.log('   4. Verify network connectivity\n')
    process.exit(1)
  }

  process.exit(0)
}

verifySupabase()
