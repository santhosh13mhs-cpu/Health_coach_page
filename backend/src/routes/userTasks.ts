import express from 'express'
import {
  getUserTasks,
  assignTaskToUser,
  bulkAssignTask,
  updateUserTaskStatus,
  removeUserTask,
  getUserTaskStats,
  getUserTasksByEmail,
  getAllUserTasks,
} from '../controllers/userTasksController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Get tasks for current user
router.get('/my-tasks', getUserTasks)

// Get tasks for specific user (coach/admin only)
router.get('/user/:userId', authorize('COACH', 'ADMIN'), getUserTasks)

// Get task stats for current user
router.get('/my-stats', getUserTaskStats)

// Get task stats for specific user (coach/admin only)
router.get('/stats/:userId', authorize('COACH', 'ADMIN'), getUserTaskStats)

// Get tasks by user email (for leads) - coach/admin only
router.get('/email/:email', authorize('COACH', 'ADMIN'), getUserTasksByEmail)

// Get all user tasks (for analytics) - accessible by all authenticated users
router.get('/all', getAllUserTasks)

// Assign task to user (coach/admin only)
router.post('/assign', authorize('COACH', 'ADMIN'), assignTaskToUser)

// Bulk assign task (coach/admin only)
router.post('/bulk-assign', authorize('COACH', 'ADMIN'), bulkAssignTask)

// Update task status
router.patch('/:id/status', updateUserTaskStatus)

// Remove task assignment (coach/admin only)
router.delete('/:id', authorize('COACH', 'ADMIN'), removeUserTask)

export default router
