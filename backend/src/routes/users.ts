import express from 'express'
import {
  getAllUsers,
  getUserById,
  assignCoachToUser,
  getUserCoach,
  getUsersByCoach,
  getUserAnalytics,
  getAllUsersAnalytics,
  getUsersAnalyticsByCoach,
} from '../controllers/usersController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Get all users (admin only, or coach can see their assigned users)
router.get('/', getAllUsers)

// Get all users analytics (admin only)
router.get('/analytics', authorize('ADMIN'), getAllUsersAnalytics)

// Get user by ID
router.get('/:id', getUserById)

// Get user analytics
router.get('/:userId/analytics', getUserAnalytics)

// Get user's assigned coach
router.get('/:userId/coach', getUserCoach)

// Assign coach to user (admin only)
router.post('/assign-coach', authorize('ADMIN'), assignCoachToUser)

// Get users assigned to a coach
router.get('/coach/:coachId/users', authorize('COACH', 'ADMIN'), getUsersByCoach)

// Get users analytics for a specific coach
router.get('/coach/:coachId/analytics', authorize('COACH', 'ADMIN'), getUsersAnalyticsByCoach)

export default router
