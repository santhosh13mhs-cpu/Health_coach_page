// Re-export from adapter for backward compatibility
export {
  getDatabase,
  dbRun,
  dbGet,
  dbAll,
  dbExec,
  columnExists,
  getDatabaseType,
  initializeDatabaseConnection,
  closeDatabase,
  type DatabaseConnection,
  type DatabaseType,
} from './db-adapter.js'

export async function initializeDatabase() {
  // Initialize connection (will use SQLite or PostgreSQL based on DATABASE_URL)
  initializeDatabaseConnection()
  const database = getDatabase()

  try {
    await dbExec(database, `
      -- Existing tables (preserved for backward compatibility)
      CREATE TABLE IF NOT EXISTS coaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        assigned_coach_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_coach_id) REFERENCES coaches(id)
      );
      
      -- New: Users table for authentication
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- New: Link coaches to users (coaches table now references users)
      CREATE TABLE IF NOT EXISTS coach_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (coach_id) REFERENCES coaches(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(coach_id, user_id)
      );
      
      -- New: User-Coach mapping (which coach is assigned to which user)
      CREATE TABLE IF NOT EXISTS user_coach_mapping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        coach_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (coach_id) REFERENCES coaches(id),
        UNIQUE(user_id)
      );
      
      -- Updated: Tasks table to support user assignments
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        coach_id INTEGER,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        deadline DATETIME NOT NULL,
        allow_document_upload INTEGER NOT NULL DEFAULT 0,
        report_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Migration: Add assigned_by column if it doesn't exist
    const hasAssignedBy = await columnExists('tasks', 'assigned_by')
    if (!hasAssignedBy) {
      try {
        await dbRun(database, 'ALTER TABLE tasks ADD COLUMN assigned_by INTEGER', [])
        console.log('Migration: Added assigned_by column to tasks table')
      } catch (err: any) {
        // Column might already exist or table might not exist yet
        console.log('Migration note on assigned_by:', err.message)
      }
    }

    // Migration: Add start_date and end_date columns if they don't exist
    const hasStartDate = await columnExists('tasks', 'start_date')
    if (!hasStartDate) {
      try {
        await dbRun(database, 'ALTER TABLE tasks ADD COLUMN start_date DATETIME', [])
        // Set start_date to created_at for existing tasks
        await dbRun(database, 'UPDATE tasks SET start_date = created_at WHERE start_date IS NULL', [])
        console.log('Migration: Added start_date column to tasks table')
      } catch (err: any) {
        console.log('Migration note on start_date:', err.message)
      }
    }

    const hasEndDate = await columnExists('tasks', 'end_date')
    if (!hasEndDate) {
      try {
        await dbRun(database, 'ALTER TABLE tasks ADD COLUMN end_date DATETIME', [])
        // Set end_date to deadline for existing tasks
        await dbRun(database, 'UPDATE tasks SET end_date = deadline WHERE end_date IS NULL', [])
        console.log('Migration: Added end_date column to tasks table')
      } catch (err: any) {
        console.log('Migration note on end_date:', err.message)
      }
    }

    // Migration: Add allow_document_upload and report_type columns if they don't exist
    const hasAllowDocUpload = await columnExists('tasks', 'allow_document_upload')
    if (!hasAllowDocUpload) {
      try {
        await dbRun(database, 'ALTER TABLE tasks ADD COLUMN allow_document_upload INTEGER NOT NULL DEFAULT 0', [])
        console.log('Migration: Added allow_document_upload column to tasks table')
      } catch (err: any) {
        console.log('Migration note on allow_document_upload:', err.message)
      }
    }

    const hasReportType = await columnExists('tasks', 'report_type')
    if (!hasReportType) {
      try {
        await dbRun(database, 'ALTER TABLE tasks ADD COLUMN report_type TEXT', [])
        console.log('Migration: Added report_type column to tasks table')
      } catch (err: any) {
        console.log('Migration note on report_type:', err.message)
      }
    }

    // Check for old status column (deprecated, using user_tasks.status now)
    const hasStatus = await columnExists('tasks', 'status')
    if (hasStatus) {
      console.log('Note: tasks table has old status column - using user_tasks.status instead')
    }

    // Check for old completed_at column (deprecated, using user_tasks.completed_at now)
    const hasCompletedAt = await columnExists('tasks', 'completed_at')
    if (hasCompletedAt) {
      console.log('Note: tasks table has old completed_at column - using user_tasks.completed_at instead')
    }

    // Migration: Add remarks and done_date columns if they don't exist
    const hasRemarks = await columnExists('user_tasks', 'remarks')
    if (!hasRemarks) {
      try {
        await dbRun(database, 'ALTER TABLE user_tasks ADD COLUMN remarks TEXT', [])
        console.log('Migration: Added remarks column to user_tasks table')
      } catch (err: any) {
        console.log('Migration note on remarks:', err.message)
      }
    }

    const hasDoneDate = await columnExists('user_tasks', 'done_date')
    if (!hasDoneDate) {
      try {
        await dbRun(database, 'ALTER TABLE user_tasks ADD COLUMN done_date DATETIME', [])
        console.log('Migration: Added done_date column to user_tasks table')
      } catch (err: any) {
        console.log('Migration note on done_date:', err.message)
      }
    }

    // Continue with remaining table creation
    await dbExec(database, `
      
      -- New: User-Task assignments (many-to-many: users can have multiple tasks, tasks can be assigned to multiple users)
      CREATE TABLE IF NOT EXISTS user_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'INCOMPLETE',
        completed_at DATETIME,
        remarks TEXT,
        done_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        UNIQUE(user_id, task_id)
      );
      
      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_leads_coach ON leads(assigned_coach_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_coach ON tasks(coach_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_user_coach_mapping_user ON user_coach_mapping(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_coach_mapping_coach ON user_coach_mapping(coach_id);
      CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON user_tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_tasks_task ON user_tasks(task_id);
      CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON user_tasks(status);
      
      -- OTP Verification table for password-less login
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        is_used INTEGER NOT NULL DEFAULT 0,
        verification_attempts INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Indexes for OTP table
      CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
      CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);
      CREATE INDEX IF NOT EXISTS idx_otp_used ON otp_verifications(is_used);
      
      -- Task Documents table for storing uploaded documents (PDF/PNG)
      CREATE TABLE IF NOT EXISTS task_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        user_task_id INTEGER,
        user_id INTEGER,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        uploaded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_task_id) REFERENCES user_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      );
      
      -- Report Data table for storing extracted data from blood reports
      CREATE TABLE IF NOT EXISTS report_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        user_task_id INTEGER,
        user_id INTEGER,
        document_id INTEGER,
        report_type TEXT NOT NULL DEFAULT 'SUGAR_REPORT',
        patient_name TEXT,
        age TEXT,
        gender TEXT,
        lab_name TEXT,
        doctor_name TEXT,
        blood_sugar_fasting TEXT,
        blood_sugar_pp TEXT,
        hba1c_value TEXT,
        total_cholesterol TEXT,
        extracted_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_task_id) REFERENCES user_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (document_id) REFERENCES task_documents(id) ON DELETE SET NULL
      );
      
      -- Indexes for task documents and report data
      CREATE INDEX IF NOT EXISTS idx_task_documents_task ON task_documents(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_documents_user_task ON task_documents(user_task_id);
      CREATE INDEX IF NOT EXISTS idx_report_data_task ON report_data(task_id);
      CREATE INDEX IF NOT EXISTS idx_report_data_user_task ON report_data(user_task_id);
      CREATE INDEX IF NOT EXISTS idx_report_data_document ON report_data(document_id);
    `)

    // Migrations for existing databases: add columns for per-user scoping of documents/report_data
    // Check if task_documents table exists first
    const taskDocsTableExists = await columnExists('task_documents', 'id')
    if (taskDocsTableExists) {
      const hasTaskDocsUserTaskId = await columnExists('task_documents', 'user_task_id')
      if (!hasTaskDocsUserTaskId) {
        try {
          await dbRun(database, 'ALTER TABLE task_documents ADD COLUMN user_task_id INTEGER', [])
          console.log('✅ Migration: Added user_task_id column to task_documents table')
        } catch (err: any) {
          console.error('❌ Migration error on task_documents.user_task_id:', err.message)
          // If column already exists, that's okay
          if (!err.message.includes('duplicate column') && !err.message.includes('duplicate column name')) {
            console.error('Failed to add user_task_id column. Please restart the server.')
          }
        }
      } else {
        console.log('✓ task_documents.user_task_id column already exists')
      }

      const hasTaskDocsUserId = await columnExists('task_documents', 'user_id')
      if (!hasTaskDocsUserId) {
        try {
          await dbRun(database, 'ALTER TABLE task_documents ADD COLUMN user_id INTEGER', [])
          console.log('✅ Migration: Added user_id column to task_documents table')
        } catch (err: any) {
          console.error('❌ Migration error on task_documents.user_id:', err.message)
          if (!err.message.includes('duplicate column') && !err.message.includes('duplicate column name')) {
            console.error('Failed to add user_id column. Please restart the server.')
          }
        }
      } else {
        console.log('✓ task_documents.user_id column already exists')
      }
    }

    // Check if report_data table exists first
    const reportDataTableExists = await columnExists('report_data', 'id')
    if (reportDataTableExists) {
      const hasReportUserTaskId = await columnExists('report_data', 'user_task_id')
      if (!hasReportUserTaskId) {
        try {
          await dbRun(database, 'ALTER TABLE report_data ADD COLUMN user_task_id INTEGER', [])
          console.log('✅ Migration: Added user_task_id column to report_data table')
        } catch (err: any) {
          console.error('❌ Migration error on report_data.user_task_id:', err.message)
          if (!err.message.includes('duplicate column') && !err.message.includes('duplicate column name')) {
            console.error('Failed to add user_task_id column. Please restart the server.')
          }
        }
      } else {
        console.log('✓ report_data.user_task_id column already exists')
      }

      const hasReportUserId = await columnExists('report_data', 'user_id')
      if (!hasReportUserId) {
        try {
          await dbRun(database, 'ALTER TABLE report_data ADD COLUMN user_id INTEGER', [])
          console.log('✅ Migration: Added user_id column to report_data table')
        } catch (err: any) {
          console.error('❌ Migration error on report_data.user_id:', err.message)
          if (!err.message.includes('duplicate column') && !err.message.includes('duplicate column name')) {
            console.error('Failed to add user_id column. Please restart the server.')
          }
        }
      } else {
        console.log('✓ report_data.user_id column already exists')
      }

      const hasTotalChol = await columnExists('report_data', 'total_cholesterol')
      if (!hasTotalChol) {
        try {
          await dbRun(database, 'ALTER TABLE report_data ADD COLUMN total_cholesterol TEXT', [])
          console.log('✅ Migration: Added total_cholesterol column to report_data table')
        } catch (err: any) {
          console.error('❌ Migration error on report_data.total_cholesterol:', err.message)
          if (!err.message.includes('duplicate column') && !err.message.includes('duplicate column name')) {
            console.error('Failed to add total_cholesterol column. Please restart the server.')
          }
        }
      } else {
        console.log('✓ report_data.total_cholesterol column already exists')
      }
    }

    // Migration: Ensure OTP table exists (for databases created before OTP feature)
    const otpTableExists = await columnExists('otp_verifications', 'id')
    if (!otpTableExists) {
      try {
        await dbExec(database, `
          CREATE TABLE IF NOT EXISTS otp_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            otp_hash TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            is_used INTEGER NOT NULL DEFAULT 0,
            verification_attempts INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
          CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);
          CREATE INDEX IF NOT EXISTS idx_otp_used ON otp_verifications(is_used);
        `)
        console.log('Migration: Created otp_verifications table')
      } catch (err: any) {
        console.log('Migration note on otp_verifications:', err.message)
      }
    }

    console.log('Database initialized successfully')
    
    // Optional: Create default admin user if no users exist (only in development)
    if (process.env.NODE_ENV !== 'production' && process.env.CREATE_DEFAULT_ADMIN !== 'false') {
      try {
        const userCount = await dbAll(database, 'SELECT COUNT(*) as count FROM users')
        const count = (userCount[0] as any)?.count || 0
        
        if (count === 0) {
          console.log('📝 No users found. Creating default admin user...')
          const bcrypt = await import('bcryptjs')
          const defaultEmail = 'santhosh.13mhs@gmail.com'
          const defaultPassword = 'admin123'
          const hashedPassword = await bcrypt.default.hash(defaultPassword, 10)
          
          await dbRun(
            database,
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            ['Admin User', defaultEmail, hashedPassword, 'ADMIN']
          )
          
          console.log('✅ Default admin user created:')
          console.log(`   Email: ${defaultEmail}`)
          console.log(`   Password: ${defaultPassword} (⚠️ Change this in production!)`)
        }
      } catch (seedError: any) {
        // Don't fail database initialization if seeding fails
        console.log('Note: Could not create default admin user:', seedError.message)
      }
    }
  } catch (err) {
    console.error('Error initializing database:', err)
  }
}
