import express from 'express'
import {
  getAllLeads,
  getLeadById,
  assignLead,
  bulkAssignLeads,
  deleteLead,
  bulkDeleteLeads,
} from '../controllers/leadController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

// All lead routes require authentication
router.use(authenticate)

router.get('/', getAllLeads)
router.get('/:id', getLeadById)
router.put('/:id/assign', authorize('ADMIN'), assignLead)
router.put('/bulk-assign', authorize('ADMIN'), bulkAssignLeads)
router.delete('/:id', authorize('ADMIN'), deleteLead)
router.post('/bulk/delete', authorize('ADMIN'), bulkDeleteLeads)

export default router
