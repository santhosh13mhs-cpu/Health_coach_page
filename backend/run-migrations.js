// Simple script to run database migrations manually
const { initializeDatabase } = require('./dist/database/db.js')

console.log('Running database migrations...')
initializeDatabase()
  .then(() => {
    console.log('✅ Migrations completed successfully!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  })
