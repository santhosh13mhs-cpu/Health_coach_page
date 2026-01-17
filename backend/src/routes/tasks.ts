import express from 'express'
import {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTaskStats,
  getTasksByDate,
} from '../controllers/taskController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

// All task routes require authentication
router.use(authenticate)

router.get('/', getAllTasks)
router.get('/stats/:coach_id', getTaskStats)
router.get('/by-date/:coach_id', getTasksByDate)
router.get('/:id', getTaskById)
router.post('/', authorize('COACH', 'ADMIN'), createTask)
router.put('/:id', authorize('COACH', 'ADMIN'), updateTask)
router.patch('/:id/status', updateTaskStatus)
router.delete('/:id', authorize('COACH', 'ADMIN'), deleteTask)

export default router
