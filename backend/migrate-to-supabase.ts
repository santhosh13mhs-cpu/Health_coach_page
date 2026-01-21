// Script to migrate all data from SQLite to Supabase
import 'dotenv/config'
import sqlite3 from 'sqlite3'
import { Pool } from 'pg'
import { join } from 'path'
import { promisify } from 'util'
import dns from 'dns'

// Prefer IPv4 results first to avoid IPv6-only connectivity issues
try {
  dns.setDefaultResultOrder('ipv4first')
} catch {
  // ignore on older Node versions
}

// SQLite helpers
function sqliteAll(db: sqlite3.Database, query: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

function sqliteGet(db: sqlite3.Database, query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err)
      else resolve(row || null)
    })
  })
}

async function migrateToSupabase() {
  console.log('🚀 Starting SQLite to Supabase Migration...\n')

  // Check DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
    console.error('❌ DATABASE_URL environment variable is not set or invalid')
    console.error('   Please set DATABASE_URL to your Supabase connection string')
    console.error('   Example: postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres')
    process.exit(1)
  }

  // Connect to SQLite
  const sqlitePath = join(process.cwd(), 'database.sqlite')
  console.log(`📂 Opening SQLite database: ${sqlitePath}`)
  
  const sqliteDb = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Error opening SQLite database:', err.message)
      process.exit(1)
    }
  })

  // Connect to Supabase
  console.log('🔌 Connecting to Supabase...')
  const supabasePool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000, // 30 seconds
    query_timeout: 30000, // 30 seconds
    statement_timeout: 30000, // 30 seconds
    idle_in_transaction_session_timeout: 30000,
  })

  try {
    // Test Supabase connection
    await supabasePool.query('SELECT 1')
    console.log('✅ Connected to Supabase\n')

    // Check if Supabase tables exist
    console.log('📊 Checking Supabase tables...')
    const tables = await supabasePool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const tableNames = tables.rows.map((r: any) => r.table_name.toLowerCase())
    const requiredTables = ['users', 'coaches', 'leads', 'tasks', 'user_tasks', 'otp_verifications', 'task_documents', 'report_data']
    const missingTables = requiredTables.filter(t => !tableNames.includes(t))

    if (missingTables.length > 0) {
      console.error('❌ Missing tables in Supabase:', missingTables.join(', '))
      console.error('   Please run the migration SQL script first: backend/supabase-migration.sql')
      process.exit(1)
    }
    console.log('✅ All required tables exist\n')

    // Clear existing data in Supabase (optional - ask user?)
    console.log('⚠️  WARNING: This will overwrite existing data in Supabase!')
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Start migration in correct order (respecting foreign keys)
    console.log('📦 Starting data migration...\n')

    // 1. Migrate users
    console.log('1️⃣  Migrating users...')
    const users = await sqliteAll(sqliteDb, 'SELECT * FROM users ORDER BY id')
    if (users.length > 0) {
      // Clear existing users
      await supabasePool.query('DELETE FROM user_coach_mapping')
      await supabasePool.query('DELETE FROM coach_users')
      await supabasePool.query('DELETE FROM users')
      await supabasePool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1')

      for (const user of users) {
        await supabasePool.query(
          `INSERT INTO users (id, name, email, password, role, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [user.id, user.name, user.email, user.password, user.role || 'USER', user.created_at, user.updated_at || user.created_at]
        )
      }
      // Reset sequence to max id + 1
      const maxUserId = Math.max(...users.map((u: any) => u.id || 0))
      await supabasePool.query(`SELECT setval('users_id_seq', $1, true)`, [maxUserId])
      console.log(`   ✅ Migrated ${users.length} user(s)`)
    } else {
      console.log('   ℹ️  No users to migrate')
    }

    // 2. Migrate coaches
    console.log('\n2️⃣  Migrating coaches...')
    const coaches = await sqliteAll(sqliteDb, 'SELECT * FROM coaches ORDER BY id')
    if (coaches.length > 0) {
      // Clear existing coaches
      await supabasePool.query('DELETE FROM leads WHERE assigned_coach_id IS NOT NULL')
      await supabasePool.query('DELETE FROM tasks WHERE coach_id IS NOT NULL')
      await supabasePool.query('DELETE FROM coaches')
      await supabasePool.query('ALTER SEQUENCE coaches_id_seq RESTART WITH 1')

      for (const coach of coaches) {
        await supabasePool.query(
          `INSERT INTO coaches (id, name, email, created_at) 
           VALUES ($1, $2, $3, $4)`,
          [coach.id, coach.name, coach.email, coach.created_at]
        )
      }
      // Reset sequence
      const maxCoachId = Math.max(...coaches.map((c: any) => c.id || 0))
      await supabasePool.query(`SELECT setval('coaches_id_seq', $1, true)`, [maxCoachId])
      console.log(`   ✅ Migrated ${coaches.length} coach(es)`)
    } else {
      console.log('   ℹ️  No coaches to migrate')
    }

    // 3. Migrate coach_users
    console.log('\n3️⃣  Migrating coach_users...')
    const coachUsers = await sqliteAll(sqliteDb, 'SELECT * FROM coach_users ORDER BY id')
    if (coachUsers.length > 0) {
      for (const cu of coachUsers) {
        await supabasePool.query(
          `INSERT INTO coach_users (id, coach_id, user_id, created_at) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (coach_id, user_id) DO NOTHING`,
          [cu.id, cu.coach_id, cu.user_id, cu.created_at]
        )
      }
      // Reset sequence
      const maxId = Math.max(...coachUsers.map((c: any) => c.id || 0))
      await supabasePool.query(`SELECT setval('coach_users_id_seq', $1, true)`, [maxId])
      console.log(`   ✅ Migrated ${coachUsers.length} coach-user mapping(s)`)
    } else {
      console.log('   ℹ️  No coach_users to migrate')
    }

    // 4. Migrate user_coach_mapping
    console.log('\n4️⃣  Migrating user_coach_mapping...')
    const userCoachMappings = await sqliteAll(sqliteDb, 'SELECT * FROM user_coach_mapping ORDER BY id')
    if (userCoachMappings.length > 0) {
      for (const ucm of userCoachMappings) {
        await supabasePool.query(
          `INSERT INTO user_coach_mapping (id, user_id, coach_id, created_at) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET coach_id = EXCLUDED.coach_id`,
          [ucm.id, ucm.user_id, ucm.coach_id, ucm.created_at]
        )
      }
      // Reset sequence
      const maxId = Math.max(...userCoachMappings.map((u: any) => u.id || 0))
      await supabasePool.query(`SELECT setval('user_coach_mapping_id_seq', $1, true)`, [maxId])
      console.log(`   ✅ Migrated ${userCoachMappings.length} user-coach mapping(s)`)
    } else {
      console.log('   ℹ️  No user_coach_mappings to migrate')
    }

    // 5. Migrate leads
    console.log('\n5️⃣  Migrating leads...')
    const leads = await sqliteAll(sqliteDb, 'SELECT * FROM leads ORDER BY id')
    if (leads.length > 0) {
      // Clear existing leads
      await supabasePool.query('DELETE FROM leads')
      await supabasePool.query('ALTER SEQUENCE leads_id_seq RESTART WITH 1')

      for (const lead of leads) {
        await supabasePool.query(
          `INSERT INTO leads (id, name, phone_number, email, assigned_coach_id, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            lead.id,
            lead.name,
            lead.phone_number,
            lead.email,
            lead.assigned_coach_id || null,
            lead.created_at,
            lead.updated_at || lead.created_at,
          ]
        )
      }
      // Reset sequence
      const maxId = Math.max(...leads.map((l: any) => l.id || 0))
      await supabasePool.query(`SELECT setval('leads_id_seq', $1, true)`, [maxId])
      console.log(`   ✅ Migrated ${leads.length} lead(s)`)
    } else {
      console.log('   ℹ️  No leads to migrate')
    }

    // 6. Migrate tasks
    console.log('\n6️⃣  Migrating tasks...')
    // Check if tasks table has assigned_by column
    const taskColumns = await sqliteAll(sqliteDb, 'PRAGMA table_info(tasks)')
    const hasAssignedBy = taskColumns.some((col: any) => col.name === 'assigned_by')
    
    const tasks = await sqliteAll(sqliteDb, 'SELECT * FROM tasks ORDER BY id')
    if (tasks.length > 0) {
      // Clear related data first
      await supabasePool.query('DELETE FROM report_data')
      await supabasePool.query('DELETE FROM task_documents')
      await supabasePool.query('DELETE FROM user_tasks')
      await supabasePool.query('DELETE FROM tasks')
      await supabasePool.query('ALTER SEQUENCE tasks_id_seq RESTART WITH 1')

      for (const task of tasks) {
        if (hasAssignedBy && task.assigned_by) {
          await supabasePool.query(
            `INSERT INTO tasks (id, title, description, coach_id, start_date, end_date, deadline, allow_document_upload, report_type, assigned_by, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              task.id,
              task.title,
              task.description || null,
              task.coach_id || null,
              task.start_date,
              task.end_date,
              task.deadline,
              task.allow_document_upload || 0,
              task.report_type || null,
              task.assigned_by || null,
              task.created_at,
              task.updated_at || task.created_at,
            ]
          )
        } else {
          await supabasePool.query(
            `INSERT INTO tasks (id, title, description, coach_id, start_date, end_date, deadline, allow_document_upload, report_type, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              task.id,
              task.title,
              task.description || null,
              task.coach_id || null,
              task.start_date,
              task.end_date,
              task.deadline,
              task.allow_document_upload || 0,
              task.report_type || null,
              task.created_at,
              task.updated_at || task.created_at,
            ]
          )
        }
      }
      // Reset sequence
      const maxId = Math.max(...tasks.map((t: any) => t.id || 0))
      await supabasePool.query(`SELECT setval('tasks_id_seq', $1, true)`, [maxId])
      console.log(`   ✅ Migrated ${tasks.length} task(s)`)
    } else {
      console.log('   ℹ️  No tasks to migrate')
    }

    // 7. Migrate user_tasks
    console.log('\n7️⃣  Migrating user_tasks...')
    const userTasks = await sqliteAll(sqliteDb, 'SELECT * FROM user_tasks ORDER BY id')
    if (userTasks.length > 0) {
      for (const ut of userTasks) {
        await supabasePool.query(
          `INSERT INTO user_tasks (id, user_id, task_id, status, completed_at, remarks, done_date, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (user_id, task_id) DO NOTHING`,
          [
            ut.id,
            ut.user_id,
            ut.task_id,
            ut.status || 'INCOMPLETE',
            ut.completed_at || null,
            ut.remarks || null,
            ut.done_date || null,
            ut.created_at,
            ut.updated_at || ut.created_at,
          ]
        )
      }
      // Reset sequence
      const maxId = Math.max(...userTasks.map((ut: any) => ut.id || 0))
      await supabasePool.query(`SELECT setval('user_tasks_id_seq', $1, true)`, [maxId])
      console.log(`   ✅ Migrated ${userTasks.length} user-task(s)`)
    } else {
      console.log('   ℹ️  No user_tasks to migrate')
    }

    // 8. Migrate otp_verifications
    console.log('\n8️⃣  Migrating otp_verifications...')
    const otps = await sqliteAll(sqliteDb, 'SELECT * FROM otp_verifications ORDER BY id')
    if (otps.length > 0) {
      // Clear existing OTPs
      await supabasePool.query('DELETE FROM otp_verifications')
      await supabasePool.query('ALTER SEQUENCE otp_verifications_id_seq RESTART WITH 1')

      for (const otp of otps) {
        await supabasePool.query(
          `INSERT INTO otp_verifications (id, email, otp_hash, expires_at, is_used, verification_attempts, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            otp.id,
            otp.email,
            otp.otp_hash,
            otp.expires_at,
            otp.is_used || 0,
            otp.verification_attempts || 0,
            otp.created_at,
          ]
        )
      }
      // Reset sequence
      const maxId = Math.max(...otps.map((o: any) => o.id || 0))
      await supabasePool.query(`SELECT setval('otp_verifications_id_seq', $1, true)`, [maxId])
      console.log(`   ✅ Migrated ${otps.length} OTP verification(s)`)
    } else {
      console.log('   ℹ️  No OTP verifications to migrate')
    }

    // 9. Migrate task_documents
    console.log('\n9️⃣  Migrating task_documents...')
    const taskDocs = await sqliteAll(sqliteDb, 'SELECT * FROM task_documents ORDER BY id')
    if (taskDocs.length > 0) {
      for (const doc of taskDocs) {
        await supabasePool.query(
          `INSERT INTO task_documents (id, task_id, user_task_id, user_id, file_name, file_path, file_type, file_size, uploaded_by, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            doc.id,
            doc.task_id,
            doc.user_task_id || null,
            doc.user_id || null,
            doc.file_name,
            doc.file_path,
            doc.file_type,
            doc.file_size,
            doc.uploaded_by || null,
            doc.created_at,
            doc.updated_at || doc.created_at,
          ]
        )
      }
      // Reset sequence
      const maxId = Math.max(...taskDocs.map((d: any) => d.id || 0))
      await supabasePool.query(`SELECT setval('task_documents_id_seq', $1, true)`, [maxId])
      console.log(`   ✅ Migrated ${taskDocs.length} task document(s)`)
    } else {
      console.log('   ℹ️  No task documents to migrate')
    }

    // 10. Migrate report_data
    console.log('\n🔟 Migrating report_data...')
    const reportData = await sqliteAll(sqliteDb, 'SELECT * FROM report_data ORDER BY id')
    if (reportData.length > 0) {
      for (const report of reportData) {
        await supabasePool.query(
          `INSERT INTO report_data (id, task_id, user_task_id, user_id, document_id, report_type, patient_name, age, gender, lab_name, doctor_name, blood_sugar_fasting, blood_sugar_pp, hba1c_value, total_cholesterol, extracted_data, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            report.id,
            report.task_id,
            report.user_task_id || null,
            report.user_id || null,
            report.document_id || null,
            report.report_type || 'SUGAR_REPORT',
            report.patient_name || null,
            report.age || null,
            report.gender || null,
            report.lab_name || null,
            report.doctor_name || null,
            report.blood_sugar_fasting || null,
            report.blood_sugar_pp || null,
            report.hba1c_value || null,
            report.total_cholesterol || null,
            report.extracted_data || null,
            report.created_at,
            report.updated_at || report.created_at,
          ]
        )
      }
      // Reset sequence
      const maxId = Math.max(...reportData.map((r: any) => r.id || 0))
      await supabasePool.query(`SELECT setval('report_data_id_seq', $1, true)`, [maxId])
      console.log(`   ✅ Migrated ${reportData.length} report data record(s)`)
    } else {
      console.log('   ℹ️  No report data to migrate')
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Summary:')
    console.log(`   - Users: ${users.length}`)
    console.log(`   - Coaches: ${coaches.length}`)
    console.log(`   - Coach-User Mappings: ${coachUsers.length}`)
    console.log(`   - User-Coach Mappings: ${userCoachMappings.length}`)
    console.log(`   - Leads: ${leads.length}`)
    console.log(`   - Tasks: ${tasks.length}`)
    console.log(`   - User Tasks: ${userTasks.length}`)
    console.log(`   - OTP Verifications: ${otps.length}`)
    console.log(`   - Task Documents: ${taskDocs.length}`)
    console.log(`   - Report Data: ${reportData.length}`)
    console.log('\n🎉 All data has been migrated to Supabase!')
    console.log('   You can now update your DATABASE_URL and remove the SQLite database.')

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    // Close connections
    sqliteDb.close((err) => {
      if (err) console.error('Error closing SQLite:', err)
    })
    await supabasePool.end()
  }
}

migrateToSupabase()
