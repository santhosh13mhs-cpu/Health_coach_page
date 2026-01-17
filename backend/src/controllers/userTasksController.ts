import { Request, Response } from 'express'
import { getDatabase, dbAll, dbGet, dbRun } from '../database/db.js'
import { BulkAssignTaskInput, UpdateUserTaskStatusInput } from '../models/UserTask.js'
import { AuthRequest } from '../middleware/auth.js'
import { calculateUserTaskStatus } from '../utils/taskStatus.js'

export const getUserTasks = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const authReq = req as AuthRequest
    
    // For /my-tasks route, use authenticated user's ID
    // For /user/:userId route, use the userId from params (coach/admin accessing specific user's tasks)
    const userId = req.params.userId ? parseInt(req.params.userId) : authReq.user?.userId
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    console.log('Fetching tasks for user ID:', userId)

    const tasks = await dbAll(db, `
      SELECT 
        ut.*,
        t.title as task_title,
        t.description as task_description,
        t.start_date as task_start_date,
        t.end_date as task_end_date,
        t.deadline as task_deadline,
        t.coach_id,
        t.allow_document_upload as task_allow_document_upload,
        t.report_type as task_report_type,
        COALESCE(ucm_coach.name, c.name) as coach_name,
        u.name as assigned_by_name,
        usr.name as user_name,
        usr.email as user_email
      FROM user_tasks ut
      JOIN tasks t ON ut.task_id = t.id
      LEFT JOIN users u ON t.assigned_by = u.id
      LEFT JOIN coaches c ON t.coach_id = c.id
      LEFT JOIN users usr ON ut.user_id = usr.id
      LEFT JOIN user_coach_mapping ucm ON usr.id = ucm.user_id
      LEFT JOIN coaches ucm_coach ON ucm.coach_id = ucm_coach.id
      WHERE ut.user_id = ?
      ORDER BY t.start_date ASC, ut.created_at DESC
    `, [userId])

    console.log(`Found ${tasks.length} tasks for user ${userId}`)
    
    // Calculate status for each task
    const tasksWithStatus = tasks.map((task: any) => ({
      ...task,
      task_status: calculateUserTaskStatus(
        task.task_start_date || task.task_deadline,
        task.task_end_date || task.task_deadline,
        task.status,
        task.completed_at,
        task.done_date
      )
    }))
    
    res.json(tasksWithStatus)
  } catch (error) {
    console.error('Error fetching user tasks:', error)
    res.status(500).json({ error: 'Failed to fetch user tasks' })
  }
}

export const assignTaskToUser = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { user_id, task_id } = req.body

    if (!user_id || !task_id) {
      return res.status(400).json({ error: 'user_id and task_id are required' })
    }

    // Check if user exists
    const user = await dbGet(db, 'SELECT * FROM users WHERE id = ?', [user_id])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if task exists
    const task = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [task_id])
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    // Check if already assigned
    const existing = await dbGet(
      db,
      'SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ?',
      [user_id, task_id]
    )

    if (existing) {
      return res.status(400).json({ error: 'Task already assigned to this user' })
    }

    // Assign task
    const result = await dbRun(
      db,
      'INSERT INTO user_tasks (user_id, task_id, status) VALUES (?, ?, ?)',
      [user_id, task_id, 'INCOMPLETE']
    )

    const userTask = await dbGet(db, `
      SELECT 
        ut.*,
        t.title as task_title,
        t.description as task_description,
        t.deadline as task_deadline
      FROM user_tasks ut
      JOIN tasks t ON ut.task_id = t.id
      WHERE ut.id = ?
    `, [result.lastID])

    res.status(201).json(userTask)
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Task already assigned to this user' })
    }
    console.error('Error assigning task to user:', error)
    res.status(500).json({ error: 'Failed to assign task' })
  }
}

export const bulkAssignTask = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { task_id, user_ids }: BulkAssignTaskInput = req.body

    if (!task_id || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: 'task_id and user_ids array are required' })
    }

    // Check if task exists
    const task = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [task_id])
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const assigned: any[] = []
    const errors: any[] = []

    for (const user_id of user_ids) {
      try {
        // Check if user exists
        const user = await dbGet(db, 'SELECT * FROM users WHERE id = ?', [user_id])
        if (!user) {
          errors.push({ user_id, error: 'User not found' })
          continue
        }

        // Check if already assigned
        const existing = await dbGet(
          db,
          'SELECT * FROM user_tasks WHERE user_id = ? AND task_id = ?',
          [user_id, task_id]
        )

        if (existing) {
          errors.push({ user_id, error: 'Task already assigned' })
          continue
        }

        // Assign task
        const result = await dbRun(
          db,
          'INSERT INTO user_tasks (user_id, task_id, status) VALUES (?, ?, ?)',
          [user_id, task_id, 'INCOMPLETE']
        )

        const userTask = await dbGet(db, `
          SELECT 
            ut.*,
            t.title as task_title,
            t.description as task_description,
            t.deadline as task_deadline
          FROM user_tasks ut
          JOIN tasks t ON ut.task_id = t.id
          WHERE ut.id = ?
        `, [result.lastID])

        assigned.push(userTask)
      } catch (error: any) {
        errors.push({ user_id, error: error.message })
      }
    }

    res.json({
      assigned,
      errors,
      message: `Assigned task to ${assigned.length} user(s)`,
    })
  } catch (error) {
    console.error('Error bulk assigning task:', error)
    res.status(500).json({ error: 'Failed to bulk assign task' })
  }
}

export const updateUserTaskStatus = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const { status, remarks, done_date }: UpdateUserTaskStatusInput = req.body
    const authReq = req as AuthRequest

    if (status !== 'COMPLETED' && status !== 'INCOMPLETE') {
      return res.status(400).json({ error: "Status must be 'COMPLETED' or 'INCOMPLETE'" })
    }

    // Get user task
    const userTask = await dbGet(db, 'SELECT * FROM user_tasks WHERE id = ?', [id])
    if (!userTask) {
      return res.status(404).json({ error: 'User task not found' })
    }

    // Verify user can only update their own tasks (unless admin/coach)
    if (authReq.user?.role === 'USER' && userTask.user_id !== authReq.user.userId) {
      return res.status(403).json({ error: 'You can only update your own tasks' })
    }

    // Build update query based on status
    if (status === 'COMPLETED') {
      // When marking as completed, set completed_at, done_date, and remarks
      const doneDateValue = done_date || new Date().toISOString()
      await dbRun(
        db,
        'UPDATE user_tasks SET status = ?, completed_at = CURRENT_TIMESTAMP, done_date = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, doneDateValue, remarks || null, id]
      )
    } else {
      // When marking as incomplete, clear completed_at, done_date, and remarks
      await dbRun(
        db,
        'UPDATE user_tasks SET status = ?, completed_at = NULL, done_date = NULL, remarks = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      )
    }

    const updated = await dbGet(db, `
      SELECT 
        ut.*,
        t.title as task_title,
        t.description as task_description,
        t.start_date as task_start_date,
        t.end_date as task_end_date,
        t.deadline as task_deadline,
        t.coach_id,
        COALESCE(ucm_coach.name, c.name) as coach_name,
        usr.name as user_name,
        usr.email as user_email
      FROM user_tasks ut
      JOIN tasks t ON ut.task_id = t.id
      LEFT JOIN coaches c ON t.coach_id = c.id
      LEFT JOIN users usr ON ut.user_id = usr.id
      LEFT JOIN user_coach_mapping ucm ON usr.id = ucm.user_id
      LEFT JOIN coaches ucm_coach ON ucm.coach_id = ucm_coach.id
      WHERE ut.id = ?
    `, [id])

    if (!updated) {
      return res.status(404).json({ error: 'User task not found' })
    }

    // Calculate status
    const updatedWithStatus = {
      ...updated,
      task_status: calculateUserTaskStatus(
        updated.task_start_date || updated.task_deadline,
        updated.task_end_date || updated.task_deadline,
        updated.status,
        updated.completed_at,
        updated.done_date
      )
    }

    res.json(updatedWithStatus)
  } catch (error) {
    console.error('Error updating user task status:', error)
    res.status(500).json({ error: 'Failed to update task status' })
  }
}

export const removeUserTask = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params

    const userTask = await dbGet(db, 'SELECT * FROM user_tasks WHERE id = ?', [id])
    if (!userTask) {
      return res.status(404).json({ error: 'User task not found' })
    }

    await dbRun(db, 'DELETE FROM user_tasks WHERE id = ?', [id])
    res.json({ message: 'Task assignment removed successfully' })
  } catch (error) {
    console.error('Error removing user task:', error)
    res.status(500).json({ error: 'Failed to remove task assignment' })
  }
}

export const getUserTaskStats = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const userId = req.params.userId || (req as AuthRequest).user?.userId

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    const stats = await dbGet(db, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'INCOMPLETE' THEN 1 ELSE 0 END) as incomplete
      FROM user_tasks
      WHERE user_id = ?
    `, [userId]) as any

    res.json({
      total: stats.total || 0,
      completed: stats.completed || 0,
      incomplete: stats.incomplete || 0,
      completion_percentage: stats.total > 0 
        ? Math.round((stats.completed / stats.total) * 100) 
        : 0,
    })
  } catch (error) {
    console.error('Error fetching user task stats:', error)
    res.status(500).json({ error: 'Failed to fetch task statistics' })
  }
}

// Get tasks by user email (for leads)
export const getUserTasksByEmail = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { email } = req.params

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Find user by email
    const user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase()])
    
    if (!user) {
      // User doesn't exist - check if there's a lead with this email
      const lead = await dbGet(db, 'SELECT * FROM leads WHERE email = ?', [email.toLowerCase()])
      if (lead) {
        // Return empty array with a message that user account needs to be created
        return res.json([])
      }
      return res.json([]) // Return empty array if user doesn't exist
    }

    // Get tasks for this user (from user_tasks table - these are assigned tasks)
    const tasks = await dbAll(db, `
      SELECT 
        ut.*,
        t.title as task_title,
        t.description as task_description,
        t.start_date as task_start_date,
        t.end_date as task_end_date,
        t.deadline as task_deadline,
        t.coach_id,
        COALESCE(ucm_coach.name, c.name) as coach_name,
        u.name as assigned_by_name,
        usr.name as user_name,
        usr.email as user_email
      FROM user_tasks ut
      JOIN tasks t ON ut.task_id = t.id
      LEFT JOIN users u ON t.assigned_by = u.id
      LEFT JOIN coaches c ON t.coach_id = c.id
      LEFT JOIN users usr ON ut.user_id = usr.id
      LEFT JOIN user_coach_mapping ucm ON usr.id = ucm.user_id
      LEFT JOIN coaches ucm_coach ON ucm.coach_id = ucm_coach.id
      WHERE ut.user_id = ?
      ORDER BY t.start_date ASC, ut.created_at DESC
    `, [user.id])

    // Calculate status for each task
    const tasksWithStatus = tasks.map((task: any) => ({
      ...task,
      task_status: calculateUserTaskStatus(
        task.task_start_date || task.task_deadline,
        task.task_end_date || task.task_deadline,
        task.status,
        task.completed_at,
        task.done_date
      )
    }))
    
    res.json(tasksWithStatus)
  } catch (error) {
    console.error('Error fetching user tasks by email:', error)
    res.status(500).json({ error: 'Failed to fetch user tasks' })
  }
}

// Get all user tasks (for admin/coach analytics)
export const getAllUserTasks = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const authReq = req as AuthRequest
    const { coach_id } = req.query

    let query = `
      SELECT 
        ut.*,
        t.title as task_title,
        t.description as task_description,
        t.start_date as task_start_date,
        t.end_date as task_end_date,
        t.deadline as task_deadline,
        t.coach_id,
        COALESCE(ucm_coach.name, c.name) as coach_name,
        u.name as assigned_by_name,
        usr.name as user_name,
        usr.email as user_email
      FROM user_tasks ut
      JOIN tasks t ON ut.task_id = t.id
      LEFT JOIN users u ON t.assigned_by = u.id
      LEFT JOIN coaches c ON t.coach_id = c.id
      LEFT JOIN users usr ON ut.user_id = usr.id
      LEFT JOIN user_coach_mapping ucm ON usr.id = ucm.user_id
      LEFT JOIN coaches ucm_coach ON ucm.coach_id = ucm_coach.id
      WHERE 1=1
    `
    const params: any[] = []

    // If coach_id is provided, filter by coach
    if (coach_id) {
      // Filter by users assigned to this coach via user_coach_mapping
      query += ' AND ucm.coach_id = ?'
      params.push(coach_id)
    } else if (authReq.user?.role === 'COACH') {
      // For coaches, only show tasks for their assigned users
      // First, find the coach record by matching email with the user's email (case-insensitive)
      const coach = await dbGet(
        db,
        'SELECT id FROM coaches WHERE LOWER(email) = LOWER(?)',
        [authReq.user.email]
      )
      
      if (coach) {
        // Filter by users assigned to this coach via user_coach_mapping
        query += ' AND ucm.coach_id = ?'
        params.push(coach.id)
        console.log(`Filtering tasks for coach ID: ${coach.id} (${authReq.user.email})`)
      } else {
        // Coach not found, return empty
        console.log(`Coach not found for email: ${authReq.user.email}`)
        return res.json([])
      }
    }

    query += ' ORDER BY t.start_date ASC, ut.created_at DESC'

    const tasks = await dbAll(db, query, params)

    // Calculate status for each task
    const tasksWithStatus = tasks.map((task: any) => ({
      ...task,
      task_status: calculateUserTaskStatus(
        task.task_start_date || task.task_deadline,
        task.task_end_date || task.task_deadline,
        task.status,
        task.completed_at,
        task.done_date
      )
    }))

    res.json(tasksWithStatus)
  } catch (error) {
    console.error('Error fetching all user tasks:', error)
    res.status(500).json({ error: 'Failed to fetch user tasks' })
  }
}
