import { Request, Response } from 'express'
import { getDatabase, dbAll, dbGet, dbRun, columnExists } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'
import path from 'path'
import fs from 'fs'

async function assertCanAccessUserTask(db: any, authReq: AuthRequest, userTaskId: number) {
  const userTask = await dbGet(
    db,
    `SELECT 
      ut.*,
      ucm.coach_id as mapped_coach_id
     FROM user_tasks ut
     LEFT JOIN user_coach_mapping ucm ON ut.user_id = ucm.user_id
     WHERE ut.id = ?`,
    [userTaskId]
  )

  if (!userTask) {
    throw Object.assign(new Error('User task not found'), { statusCode: 404 })
  }

  // USER can only access their own
  if (authReq.user?.role === 'USER' && userTask.user_id !== authReq.user.userId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  }

  // COACH can only access tasks for users mapped to them
  if (authReq.user?.role === 'COACH') {
    // Get the coach_id for the authenticated coach user
    const coach = await dbGet(
      db,
      'SELECT id FROM coaches WHERE LOWER(email) = LOWER(?)',
      [authReq.user.email]
    )
    
    if (!coach) {
      throw Object.assign(new Error('Coach profile not found'), { statusCode: 403 })
    }
    
    // Check if the user in this user_task is mapped to this coach
    if (!userTask.mapped_coach_id || userTask.mapped_coach_id !== coach.id) {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    }
  }

  // ADMIN can access everything
  return userTask
}

// Upload document for a task
export const uploadTaskDocument = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const authReq = req as AuthRequest
    const { task_id, user_task_id } = req.body

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    if (!task_id && !user_task_id) {
      // Delete uploaded file if task_id is missing
      if (req.file.path) {
        fs.unlinkSync(req.file.path)
      }
      return res.status(400).json({ error: 'Task ID or User Task ID is required' })
    }

    // If user_task_id is provided, scope upload to that user-task
    let resolvedTaskId = task_id ? parseInt(task_id) : null
    let resolvedUserTaskId: number | null = null
    let resolvedUserId: number | null = null

    if (user_task_id) {
      resolvedUserTaskId = parseInt(user_task_id)
      const userTask = await assertCanAccessUserTask(db, authReq, resolvedUserTaskId)
      resolvedTaskId = userTask.task_id
      resolvedUserId = userTask.user_id
    }

    // Verify task exists
    const task = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [resolvedTaskId])
    if (!task) {
      // Delete uploaded file if task doesn't exist
      if (req.file.path) {
        fs.unlinkSync(req.file.path)
      }
      return res.status(404).json({ error: 'Task not found' })
    }

    // Check if columns exist, if not, try to add them (migration on-the-fly)
    let hasUserTaskId = await columnExists('task_documents', 'user_task_id')
    let hasUserId = await columnExists('task_documents', 'user_id')
    
    // If columns don't exist, try to add them immediately
    if (!hasUserTaskId) {
      try {
        await dbRun(db, 'ALTER TABLE task_documents ADD COLUMN user_task_id INTEGER', [])
        hasUserTaskId = true
        console.log('✅ On-the-fly migration: Added user_task_id column to task_documents')
      } catch (err: any) {
        if (!err.message.includes('duplicate column')) {
          console.error('Failed to add user_task_id column:', err.message)
        }
      }
    }
    
    if (!hasUserId) {
      try {
        await dbRun(db, 'ALTER TABLE task_documents ADD COLUMN user_id INTEGER', [])
        hasUserId = true
        console.log('✅ On-the-fly migration: Added user_id column to task_documents')
      } catch (err: any) {
        if (!err.message.includes('duplicate column')) {
          console.error('Failed to add user_id column:', err.message)
        }
      }
    }
    
    let insertQuery: string
    let insertParams: any[]
    
    if (hasUserTaskId && hasUserId) {
      // New schema with user_task_id and user_id
      insertQuery = `INSERT INTO task_documents (task_id, user_task_id, user_id, file_name, file_path, file_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      insertParams = [
        resolvedTaskId,
        resolvedUserTaskId,
        resolvedUserId,
        req.file.originalname,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        authReq.user?.userId || null,
      ]
    } else {
      // Legacy schema without user_task_id and user_id
      console.warn('⚠️ Using legacy schema for task_documents (columns user_task_id/user_id missing). Please restart server to run migrations.')
      insertQuery = `INSERT INTO task_documents (task_id, file_name, file_path, file_type, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`
      insertParams = [
        resolvedTaskId,
        req.file.originalname,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        authReq.user?.userId || null,
      ]
    }
    
    // Save document record
    const result = await dbRun(db, insertQuery, insertParams)

    const document = await dbGet(
      db,
      'SELECT * FROM task_documents WHERE id = ?',
      [result.lastID]
    )

    res.json({
      message: 'Document uploaded successfully',
      document,
    })
  } catch (error: any) {
    console.error('Error uploading document:', error)
    // Clean up uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({ error: error.message || 'Failed to upload document' })
  }
}

// Get documents for a task
export const getTaskDocuments = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { taskId } = req.params

    const documents = await dbAll(
      db,
      `SELECT 
        td.*,
        u.name as uploaded_by_name
       FROM task_documents td
       LEFT JOIN users u ON td.uploaded_by = u.id
       WHERE td.task_id = ?
       ORDER BY td.created_at DESC`,
      [taskId]
    )

    res.json(documents)
  } catch (error: any) {
    console.error('Error fetching task documents:', error)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
}

// Get documents for a specific user-task assignment
export const getUserTaskDocuments = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const authReq = req as AuthRequest
    const { userTaskId } = req.params
    const resolvedUserTaskId = parseInt(userTaskId)

    await assertCanAccessUserTask(db, authReq, resolvedUserTaskId)

    const documents = await dbAll(
      db,
      `SELECT 
        td.*,
        u.name as uploaded_by_name
       FROM task_documents td
       LEFT JOIN users u ON td.uploaded_by = u.id
       WHERE td.user_task_id = ?
       ORDER BY td.created_at DESC`,
      [resolvedUserTaskId]
    )

    res.json(documents)
  } catch (error: any) {
    console.error('Error fetching user task documents:', error)
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({ error: error.message || 'Failed to fetch documents' })
  }
}

// Get document file
export const getDocumentFile = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { documentId } = req.params

    const document = await dbGet(
      db,
      'SELECT * FROM task_documents WHERE id = ?',
      [documentId]
    )

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const filePath = document.file_path
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' })
    }

    // Set appropriate content type
    const contentType = document.file_type || 'application/octet-stream'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${document.file_name}"`)

    // Send file
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error: any) {
    console.error('Error fetching document file:', error)
    res.status(500).json({ error: 'Failed to fetch document file' })
  }
}

// Delete document
export const deleteTaskDocument = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { documentId } = req.params

    const document = await dbGet(
      db,
      'SELECT * FROM task_documents WHERE id = ?',
      [documentId]
    )

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Delete file from filesystem
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path)
    }

    // Delete document record and associated report data
    await dbRun(db, 'DELETE FROM report_data WHERE document_id = ?', [documentId])
    await dbRun(db, 'DELETE FROM task_documents WHERE id = ?', [documentId])

    res.json({ message: 'Document deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting document:', error)
    res.status(500).json({ error: 'Failed to delete document', details: error.message })
  }
}

// Create or update report data
export const createOrUpdateReportData = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const authReq = req as AuthRequest
    const { taskId } = req.params
    const {
      document_id,
      user_task_id,
      report_type,
      patient_name,
      age,
      gender,
      lab_name,
      doctor_name,
      blood_sugar_fasting,
      blood_sugar_pp,
      hba1c_value,
      total_cholesterol,
      extracted_data,
    } = req.body

    const parsedTaskId = parseInt(taskId)
    const resolvedUserTaskId = user_task_id ? parseInt(user_task_id) : null
    let resolvedUserId: number | null = null

    if (resolvedUserTaskId) {
      const userTask = await assertCanAccessUserTask(db, authReq, resolvedUserTaskId)
      // Ensure the user_task matches the task
      if (userTask.task_id !== parsedTaskId) {
        return res.status(400).json({ error: 'user_task_id does not belong to this task' })
      }
      resolvedUserId = userTask.user_id
    }

    // Check if columns exist, if not, try to add them (migration on-the-fly)
    let hasReportUserTaskId = await columnExists('report_data', 'user_task_id')
    let hasReportUserId = await columnExists('report_data', 'user_id')
    let hasTotalChol = await columnExists('report_data', 'total_cholesterol')
    
    // If columns don't exist, try to add them immediately
    if (!hasReportUserTaskId) {
      try {
        await dbRun(db, 'ALTER TABLE report_data ADD COLUMN user_task_id INTEGER', [])
        hasReportUserTaskId = true
        console.log('✅ On-the-fly migration: Added user_task_id column to report_data')
      } catch (err: any) {
        if (!err.message.includes('duplicate column')) {
          console.error('Failed to add user_task_id column to report_data:', err.message)
        }
      }
    }
    
    if (!hasReportUserId) {
      try {
        await dbRun(db, 'ALTER TABLE report_data ADD COLUMN user_id INTEGER', [])
        hasReportUserId = true
        console.log('✅ On-the-fly migration: Added user_id column to report_data')
      } catch (err: any) {
        if (!err.message.includes('duplicate column')) {
          console.error('Failed to add user_id column to report_data:', err.message)
        }
      }
    }
    
    if (!hasTotalChol) {
      try {
        await dbRun(db, 'ALTER TABLE report_data ADD COLUMN total_cholesterol TEXT', [])
        hasTotalChol = true
        console.log('✅ On-the-fly migration: Added total_cholesterol column to report_data')
      } catch (err: any) {
        if (!err.message.includes('duplicate column')) {
          console.error('Failed to add total_cholesterol column to report_data:', err.message)
        }
      }
    }

    // Check if report data already exists for this user-task (preferred), else fall back to task-level for legacy
    const existing = resolvedUserTaskId && hasReportUserTaskId
      ? await dbGet(db, 'SELECT * FROM report_data WHERE user_task_id = ?', [resolvedUserTaskId])
      : await dbGet(db, 'SELECT * FROM report_data WHERE task_id = ? AND (user_task_id IS NULL OR user_task_id = ?)', [parsedTaskId, resolvedUserTaskId || null])

    if (existing) {
      // Update existing report data - build query based on available columns
      let updateQuery: string
      let updateParams: any[]
      
      if (hasReportUserTaskId && hasReportUserId && hasTotalChol) {
        updateQuery = `UPDATE report_data SET
          document_id = ?,
          user_task_id = ?,
          user_id = ?,
          report_type = ?,
          patient_name = ?,
          age = ?,
          gender = ?,
          lab_name = ?,
          doctor_name = ?,
          blood_sugar_fasting = ?,
          blood_sugar_pp = ?,
          hba1c_value = ?,
          total_cholesterol = ?,
          extracted_data = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
        updateParams = [
          document_id || null,
          resolvedUserTaskId,
          resolvedUserId,
          report_type || 'SUGAR_REPORT',
          patient_name || null,
          age || null,
          gender || null,
          lab_name || null,
          doctor_name || null,
          blood_sugar_fasting || null,
          blood_sugar_pp || null,
          hba1c_value || null,
          total_cholesterol || null,
          extracted_data || null,
          existing.id,
        ]
      } else {
        // Legacy schema
        updateQuery = `UPDATE report_data SET
          document_id = ?,
          report_type = ?,
          patient_name = ?,
          age = ?,
          gender = ?,
          lab_name = ?,
          doctor_name = ?,
          blood_sugar_fasting = ?,
          blood_sugar_pp = ?,
          hba1c_value = ?,
          extracted_data = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
        updateParams = [
          document_id || null,
          report_type || 'SUGAR_REPORT',
          patient_name || null,
          age || null,
          gender || null,
          lab_name || null,
          doctor_name || null,
          blood_sugar_fasting || null,
          blood_sugar_pp || null,
          hba1c_value || null,
          extracted_data || null,
          existing.id,
        ]
      }
      
      await dbRun(db, updateQuery, updateParams)

      const updated = await dbGet(
        db,
        'SELECT * FROM report_data WHERE id = ?',
        [existing.id]
      )

      res.json({
        message: 'Report data updated successfully',
        report_data: updated,
      })
    } else {
      // Create new report data - build query based on available columns
      let insertQuery: string
      let insertParams: any[]
      
      if (hasReportUserTaskId && hasReportUserId && hasTotalChol) {
        insertQuery = `INSERT INTO report_data (
          task_id, user_task_id, user_id, document_id, report_type, patient_name, age, gender,
          lab_name, doctor_name, blood_sugar_fasting, blood_sugar_pp,
          hba1c_value, total_cholesterol, extracted_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        insertParams = [
          parsedTaskId,
          resolvedUserTaskId,
          resolvedUserId,
          document_id || null,
          report_type || 'SUGAR_REPORT',
          patient_name || null,
          age || null,
          gender || null,
          lab_name || null,
          doctor_name || null,
          blood_sugar_fasting || null,
          blood_sugar_pp || null,
          hba1c_value || null,
          total_cholesterol || null,
          extracted_data || null,
        ]
      } else {
        // Legacy schema without user_task_id, user_id, and total_cholesterol
        console.warn('⚠️ Using legacy schema for report_data. Please restart server to run migrations.')
        insertQuery = `INSERT INTO report_data (
          task_id, document_id, report_type, patient_name, age, gender,
          lab_name, doctor_name, blood_sugar_fasting, blood_sugar_pp,
          hba1c_value, extracted_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        insertParams = [
          parsedTaskId,
          document_id || null,
          report_type || 'SUGAR_REPORT',
          patient_name || null,
          age || null,
          gender || null,
          lab_name || null,
          doctor_name || null,
          blood_sugar_fasting || null,
          blood_sugar_pp || null,
          hba1c_value || null,
          extracted_data || null,
        ]
      }
      
      const result = await dbRun(db, insertQuery, insertParams)

      const newReport = await dbGet(
        db,
        'SELECT * FROM report_data WHERE id = ?',
        [result.lastID]
      )

      res.json({
        message: 'Report data created successfully',
        report_data: newReport,
      })
    }
  } catch (error: any) {
    console.error('Error creating/updating report data:', error)
    res.status(500).json({ error: 'Failed to save report data', details: error.message })
  }
}

// Get report data for a task
export const getReportData = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { taskId } = req.params
    const { user_task_id } = req.query as any

    const parsedTaskId = parseInt(taskId)
    let reportData: any = null

    if (user_task_id) {
      const authReq = req as AuthRequest
      const userTaskId = parseInt(user_task_id)
      await assertCanAccessUserTask(db, authReq, userTaskId)
      reportData = await dbGet(
        db,
        `SELECT 
          rd.*,
          td.file_name,
          td.file_path,
          td.file_type
         FROM report_data rd
         LEFT JOIN task_documents td ON rd.document_id = td.id
         WHERE rd.user_task_id = ?`,
        [userTaskId]
      )
    } else {
      // Legacy: task-level report data (no user_task_id)
      reportData = await dbGet(
        db,
        `SELECT 
          rd.*,
          td.file_name,
          td.file_path,
          td.file_type
         FROM report_data rd
         LEFT JOIN task_documents td ON rd.document_id = td.id
         WHERE rd.task_id = ? AND rd.user_task_id IS NULL`,
        [parsedTaskId]
      )
    }

    if (!reportData) {
      return res.json(null)
    }

    res.json(reportData)
  } catch (error: any) {
    console.error('Error fetching report data:', error)
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({ error: error.message || 'Failed to fetch report data' })
  }
}

// Get report data for a specific user-task assignment
export const getUserTaskReportData = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const authReq = req as AuthRequest
    const { userTaskId } = req.params
    const resolvedUserTaskId = parseInt(userTaskId)

    await assertCanAccessUserTask(db, authReq, resolvedUserTaskId)

    const reportData = await dbGet(
      db,
      `SELECT 
        rd.*,
        td.file_name,
        td.file_path,
        td.file_type
       FROM report_data rd
       LEFT JOIN task_documents td ON rd.document_id = td.id
       WHERE rd.user_task_id = ?`,
      [resolvedUserTaskId]
    )

    if (!reportData) return res.json(null)
    res.json(reportData)
  } catch (error: any) {
    console.error('Error fetching user task report data:', error)
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({ error: error.message || 'Failed to fetch report data' })
  }
}
