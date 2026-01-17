import multer from 'multer'
import { Request } from 'express'

const storage = multer.memoryStorage()

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/excel',
    'application/x-excel',
  ]
  
  // Also check file extension as fallback
  const fileName = file.originalname.toLowerCase()
  const hasValidExtension = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
  
  if (allowedMimes.includes(file.mimetype) || hasValidExtension) {
    cb(null, true)
  } else {
    console.error('Invalid file type:', {
      mimetype: file.mimetype,
      originalname: file.originalname
    })
    cb(new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})
