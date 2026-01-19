import express from 'express'
import cors from 'cors'
import { initializeDatabase } from './database/db.js'
import authRoutes from './routes/auth.js'
import otpRoutes from './routes/otp.js'
import leadsRoutes from './routes/leads.js'
import coachesRoutes from './routes/coaches.js'
import uploadRoutes from './routes/upload.js'
import tasksRoutes from './routes/tasks.js'
import userTasksRoutes from './routes/userTasks.js'
import usersRoutes from './routes/users.js'
import documentsRoutes from './routes/documents.js'
import path from 'path'

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded documents
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// Initialize database (with migrations)
initializeDatabase().then(() => {
  console.log('Database initialization and migrations completed')
}).catch((err) => {
  console.error('Database initialization failed:', err)
  process.exit(1)
})

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      otp: '/api/otp',
      users: '/api/users',
      userTasks: '/api/user-tasks',
      leads: '/api/leads',
      coaches: '/api/coaches',
      upload: '/api/upload',
      tasks: '/api/tasks',
      documents: '/api/documents'
    },
    health: '/health'
  })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/otp', otpRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/user-tasks', userTasksRoutes)
app.use('/api/leads', leadsRoutes)
app.use('/api/coaches', coachesRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/documents', documentsRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
