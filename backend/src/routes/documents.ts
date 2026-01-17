import express from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { documentUpload } from '../middleware/documentUpload.js'
import {
  uploadTaskDocument,
  getTaskDocuments,
  getUserTaskDocuments,
  getDocumentFile,
  deleteTaskDocument,
  createOrUpdateReportData,
  getReportData,
  getUserTaskReportData,
} from '../controllers/documentController.js'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// Handle multer errors
const handleMulterError = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
    }
    if (err.message && err.message.includes('Invalid file type')) {
      return res.status(400).json({ error: err.message })
    }
    return res.status(400).json({ error: 'File upload error: ' + (err.message || 'Unknown error') })
  }
  next()
}

// Upload document for a task (Admin and Coach only)
router.post(
  '/upload',
  authorize('ADMIN', 'COACH'),
  documentUpload.single('document'),
  handleMulterError,
  uploadTaskDocument
)

// Get documents for a task
router.get('/task/:taskId', authorize('ADMIN', 'COACH', 'USER'), getTaskDocuments)

// Get documents for a specific user-task assignment
router.get('/user-task/:userTaskId', authorize('ADMIN', 'COACH', 'USER'), getUserTaskDocuments)

// Get document file
router.get('/:documentId/file', authorize('ADMIN', 'COACH', 'USER'), getDocumentFile)

// Delete document (Admin and Coach only)
router.delete('/:documentId', authorize('ADMIN', 'COACH'), deleteTaskDocument)

// Create or update report data (Admin and Coach only)
router.post('/task/:taskId/report-data', authorize('ADMIN', 'COACH'), createOrUpdateReportData)

// Get report data for a task
router.get('/task/:taskId/report-data', authorize('ADMIN', 'COACH', 'USER'), getReportData)

// Get report data for a specific user-task assignment
router.get('/user-task/:userTaskId/report-data', authorize('ADMIN', 'COACH', 'USER'), getUserTaskReportData)

export default router
