import express from 'express'
import {
  getAllCoaches,
  getCoachById,
  createCoach,
  updateCoach,
  getCoachLeads,
  getAllCoachesAnalytics,
} from '../controllers/coachController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

// Public routes (no auth needed for viewing)
router.get('/', getAllCoaches)
router.get('/:id', getCoachById)

// Protected routes
router.post('/', authenticate, authorize('ADMIN'), createCoach)
router.put('/:id', authenticate, authorize('ADMIN'), updateCoach)
router.get('/:id/leads', authenticate, authorize('COACH', 'ADMIN'), getCoachLeads)
router.get('/analytics/all', authenticate, authorize('ADMIN'), getAllCoachesAnalytics)

export default router
