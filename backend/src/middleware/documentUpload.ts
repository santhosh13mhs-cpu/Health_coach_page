import multer from 'multer'
import { Request } from 'express'
import path from 'path'
import fs from 'fs'

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'documents')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `task-doc-${uniqueSuffix}${ext}`)
  },
})

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ]
  
  // Also check file extension as fallback
  const fileName = file.originalname.toLowerCase()
  const hasValidExtension = fileName.endsWith('.pdf') || 
                           fileName.endsWith('.png') || 
                           fileName.endsWith('.jpg') || 
                           fileName.endsWith('.jpeg')
  
  if (allowedMimes.includes(file.mimetype) || hasValidExtension) {
    cb(null, true)
  } else {
    console.error('Invalid file type:', {
      mimetype: file.mimetype,
      originalname: file.originalname
    })
    cb(new Error('Invalid file type. Only PDF and PNG/JPEG image files are allowed.'))
  }
}

export const documentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})
