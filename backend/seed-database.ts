import bcrypt from 'bcryptjs'
import { getDatabase, dbGet, dbAll, dbRun, initializeDatabase, initializeDatabaseConnection, getDatabaseType } from './src/database/db.js'

async function seedDatabase() {
  try {
    console.log('🌱 Initializing database...')
    
    // Initialize connection first
    initializeDatabaseConnection()
    const dbType = getDatabaseType()
    console.log(`📊 Using database: ${dbType === 'postgresql' ? 'PostgreSQL/Supabase' : 'SQLite'}`)
    
    // Then initialize schema
    await initializeDatabase()
    
    const db = getDatabase()
    console.log('✅ Database initialized')

    // Check if admin user already exists
    const adminEmail = 'santhosh.13mhs@gmail.com'
    const existingAdmin = await dbGet(db, 'SELECT * FROM users WHERE LOWER(email) = ?', [adminEmail.toLowerCase()])

    if (existingAdmin) {
      console.log('\n✅ Admin user already exists:')
      console.log('   Email:', existingAdmin.email)
      console.log('   Name:', existingAdmin.name)
      console.log('   Role:', existingAdmin.role)
      console.log('   User ID:', existingAdmin.id)
    } else {
      // Create default admin user
      const defaultPassword = 'admin123' // Change this in production!
      const hashedPassword = await bcrypt.hash(defaultPassword, 10)

      const result = await dbRun(
        db,
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Admin User', adminEmail, hashedPassword, 'ADMIN']
      )

      console.log('\n✅ Created admin user:')
      console.log('   Email:', adminEmail)
      console.log('   Password:', defaultPassword, '(⚠️ CHANGE THIS IN PRODUCTION!)')
      console.log('   Role: ADMIN')
      console.log('   User ID:', result.lastID)
    }

    // Get all users
    const allUsers = await dbAll(db, 'SELECT id, name, email, role FROM users ORDER BY created_at')
    
    console.log(`\n📊 Total users in database: ${allUsers.length}`)
    
    if (allUsers.length > 0) {
      console.log('\n👥 Users in database:')
      allUsers.forEach((user: any) => {
        console.log(`   - ${user.name} (${user.email}) - ${user.role}`)
      })
    }

    console.log('\n✅ Database seeding completed!')
    console.log('\n💡 You can now login with:')
    console.log('   Email: santhosh.13mhs@gmail.com')
    console.log('   Password: admin123 (for OTP login, use email only)')
    
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error seeding database:', error)
    console.error('Error details:', error.message, error.stack)
    process.exit(1)
  }
}

// Run seeding
seedDatabase()
