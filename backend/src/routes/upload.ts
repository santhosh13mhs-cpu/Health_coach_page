import express from 'express'
import { upload } from '../middleware/upload.js'
import { uploadLeads } from '../controllers/uploadController.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

// Error handler for multer
const handleMulterError = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    console.error('Multer error:', err)
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

// Upload routes require admin authentication
// Apply authenticate and authorize middleware per route to avoid conflicts with multer
router.post('/leads', 
  authenticate, 
  authorize('ADMIN'), 
  upload.single('file'),
  handleMulterError,
  uploadLeads
)

export default router
