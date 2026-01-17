import { Request, Response } from 'express'
import * as XLSX from 'xlsx'
import bcrypt from 'bcryptjs'
import { getDatabase, dbRun, dbGet } from '../database/db.js'

export const uploadLeads = async (req: Request, res: Response) => {
  try {
    console.log('Upload request received:', {
      hasFile: !!req.file,
      body: req.body,
      headers: req.headers['content-type']
    })

    if (!req.file) {
      console.error('No file in request:', {
        files: req.files,
        body: req.body,
        contentType: req.headers['content-type']
      })
      return res.status(400).json({ error: 'No file uploaded. Please select an Excel file.' })
    }

    // Get coach_id from body (multer adds form fields to req.body)
    const coach_id = req.body.coach_id || req.body.coachId
    const coachId = coach_id && coach_id !== '' && coach_id !== 'null' ? parseInt(coach_id.toString()) : null
    
    console.log('Coach ID from request:', coachId)

    // Verify coach exists if provided
    if (coachId) {
      const db = getDatabase()
      const coach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [coachId])
      if (!coach) {
        return res.status(404).json({ error: 'Coach not found' })
      }
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false })

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty or invalid' })
    }

    // Normalize column names (case-insensitive, handle variations)
    const normalizeColumn = (col: string): string => {
      const lower = col.toLowerCase().trim()
      if (lower.includes('name') && !lower.includes('phone') && !lower.includes('email')) {
        return 'name'
      }
      if (lower.includes('phone') || lower.includes('mobile')) {
        return 'phone_number'
      }
      if (lower.includes('email') || lower.includes('mail')) {
        return 'email'
      }
      return col
    }

    // Extract headers and normalize
    const dataArray = data as Array<Record<string, any>>
    const headers = Object.keys(dataArray[0])
    const normalizedHeaders = headers.map(normalizeColumn)
    const headerMap: Record<string, string> = {}
    headers.forEach((orig, idx) => {
      headerMap[normalizedHeaders[idx]] = orig
    })

    // Validate required columns
    const requiredColumns = ['name', 'phone_number', 'email']
    const missingColumns = requiredColumns.filter(col => !headerMap[col])

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        foundColumns: headers,
      })
    }

    const db = getDatabase()
    const inserted: any[] = []
    const createdUsers: any[] = []
    
    for (const row of dataArray) {
      const name = String(row[headerMap.name] || '').trim()
      const phone = String(row[headerMap.phone_number] || '').trim()
      const email = String(row[headerMap.email] || '').trim().toLowerCase()

      if (!name || !phone || !email) {
        continue // Skip rows with missing data
      }

      try {
        // Insert or update lead
        await dbRun(
          db,
          'INSERT OR REPLACE INTO leads (email, name, phone_number, assigned_coach_id) VALUES (?, ?, ?, ?)',
          [email, name, phone, coachId]
        )
        
        // Get the inserted/updated lead
        const lead = await dbGet(db, 'SELECT * FROM leads WHERE email = ?', [email])
        if (lead) {
          inserted.push(lead)
        }

        // Auto-create user account for the lead if it doesn't exist
        const existingUser = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [email])
        if (!existingUser) {
          // Create a default password (email + phone last 4 digits for easy reference)
          // In production, you might want to send a password reset email
          const defaultPassword = email + phone.slice(-4)
          const hashedPassword = await bcrypt.hash(defaultPassword, 10)

          const userResult = await dbRun(
            db,
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'USER']
          )

          const newUser = await dbGet(db, 'SELECT id, name, email, role FROM users WHERE id = ?', [userResult.lastID])
          if (newUser) {
            createdUsers.push(newUser)

            // If coach_id was provided, assign coach to user
            if (coachId) {
              // Remove existing assignment if any
              await dbRun(
                db,
                'DELETE FROM user_coach_mapping WHERE user_id = ?',
                [newUser.id]
              )
              // Create new assignment
              await dbRun(
                db,
                'INSERT INTO user_coach_mapping (user_id, coach_id) VALUES (?, ?)',
                [newUser.id, coachId]
              )
            }
          }
        } else if (coachId) {
          // User exists, just assign coach if provided
          await dbRun(
            db,
            'DELETE FROM user_coach_mapping WHERE user_id = ?',
            [existingUser.id]
          )
          await dbRun(
            db,
            'INSERT OR REPLACE INTO user_coach_mapping (user_id, coach_id) VALUES (?, ?)',
            [existingUser.id, coachId]
          )
        }
      } catch (error: any) {
        // Skip duplicate emails or other errors
        console.warn(`Skipping lead: ${email}`, error.message)
      }
    }

    res.json({
      message: `Successfully imported ${inserted.length} leads and created ${createdUsers.length} user accounts`,
      leads: inserted,
      users: createdUsers,
      total: data.length,
      imported: inserted.length,
      usersCreated: createdUsers.length,
    })
  } catch (error) {
    console.error('Error uploading leads:', error)
    res.status(500).json({ error: 'Failed to process Excel file' })
  }
}
