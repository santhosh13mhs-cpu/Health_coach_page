import { Request, Response } from 'express'
import { getDatabase, dbAll, dbGet, dbRun } from '../database/db.js'
import {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  TaskStats,
} from '../models/Task.js'
import { AuthRequest } from '../middleware/auth.js'
import { calculateTaskStatus } from '../utils/taskStatus.js'

export const getAllTasks = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { coach_id } = req.query

    let query = 'SELECT * FROM tasks WHERE 1=1'
    const params: any[] = []

    if (coach_id) {
      query += ' AND coach_id = ?'
      params.push(coach_id)
    }

    query += ' ORDER BY start_date ASC, created_at DESC'

    const tasks = await dbAll(db, query, params)
    
    // Calculate status for each task
    const tasksWithStatus = tasks.map((task: any) => ({
      ...task,
      status: calculateTaskStatus(
        task.start_date || task.created_at,
        task.end_date || task.deadline,
        false // Tasks table doesn't have completion status, use user_tasks for that
      )
    }))
    
    res.json(tasksWithStatus)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
}

export const getTaskById = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const task = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [id])
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    
    // Handle legacy tasks that might not have start_date or end_date
    // Use created_at as fallback for start_date and deadline as fallback for end_date
    const startDate = task.start_date || task.created_at || task.deadline || new Date().toISOString()
    const endDate = task.end_date || task.deadline || new Date().toISOString()
    
    // Ensure dates are set (for legacy tasks)
    if (!task.start_date) {
      task.start_date = task.created_at || task.deadline || new Date().toISOString()
    }
    if (!task.end_date) {
      task.end_date = task.deadline || new Date().toISOString()
    }

    // Get documents and report data for this task
    const documents = await dbAll(
      db,
      `SELECT 
        td.*,
        u.name as uploaded_by_name
       FROM task_documents td
       LEFT JOIN users u ON td.uploaded_by = u.id
       WHERE td.task_id = ?
       ORDER BY td.created_at DESC`,
      [id]
    )

    const reportData = await dbGet(
      db,
      `SELECT 
        rd.*,
        td.file_name,
        td.file_path,
        td.file_type
       FROM report_data rd
       LEFT JOIN task_documents td ON rd.document_id = td.id
       WHERE rd.task_id = ?`,
      [id]
    )
    
    // Calculate status
    const taskWithStatus = {
      ...task,
      start_date: task.start_date,
      end_date: task.end_date,
      status: calculateTaskStatus(
        startDate,
        endDate,
        false // Tasks table doesn't have completion status, use user_tasks for that
      ),
      documents: documents || [],
      report_data: reportData || null,
    }
    
    res.json(taskWithStatus)
  } catch (error) {
    console.error('Error fetching task:', error)
    res.status(500).json({ error: 'Failed to fetch task' })
  }
}

export const createTask = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const authReq = req as AuthRequest
    const { title, description, coach_id, start_date, end_date, deadline, allow_document_upload, report_type }: CreateTaskInput = req.body

    if (!title || !start_date || !end_date || !deadline) {
      return res.status(400).json({ error: 'Title, start_date, end_date, and deadline are required' })
    }

    // Verify dates are valid
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)
    const deadlineDate = new Date(deadline)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(deadlineDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' })
    }

    // Verify coach exists if coach_id provided
    if (coach_id) {
      const coach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [coach_id])
      if (!coach) {
        return res.status(404).json({ error: `Coach with ID ${coach_id} not found` })
      }
    }

    // Get assigned_by from authenticated user
    const assignedBy = authReq.user?.userId || null

    if (!assignedBy) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    try {
      const result = await dbRun(
        db,
        'INSERT INTO tasks (title, description, coach_id, assigned_by, start_date, end_date, deadline, allow_document_upload, report_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          title,
          description || null,
          coach_id || null,
          assignedBy,
          start_date,
          end_date,
          deadline,
          allow_document_upload ? 1 : 0,
          report_type || null,
        ]
      )

      const task = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [result.lastID])
      
      // Calculate status
      const taskWithStatus = {
        ...task,
        status: calculateTaskStatus(task.start_date, task.end_date, false)
      }
      
      res.status(201).json(taskWithStatus)
    } catch (dbError: any) {
      console.error('Database error creating task:', dbError)
      if (dbError.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ 
          error: 'Invalid reference. Coach ID may not exist or foreign key constraint violation.',
          details: dbError.message 
        })
      }
      throw dbError
    }
  } catch (error: any) {
    console.error('Error creating task:', error)
    res.status(500).json({ 
      error: 'Failed to create task',
      details: error.message || 'Unknown error occurred'
    })
  }
}

export const updateTask = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const { title, description, start_date, end_date, deadline, allow_document_upload, report_type }: UpdateTaskInput = req.body

    const existingTask = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [id])
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const updates: string[] = []
    const values: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      values.push(title)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?')
      values.push(start_date)
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?')
      values.push(end_date)
    }
    if (deadline !== undefined) {
      updates.push('deadline = ?')
      values.push(deadline)
    }

    if (allow_document_upload !== undefined) {
      updates.push('allow_document_upload = ?')
      values.push(allow_document_upload ? 1 : 0)
    }

    if (report_type !== undefined) {
      updates.push('report_type = ?')
      values.push(report_type || null)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)

    await dbRun(
      db,
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    const updatedTask = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [id])
    res.json(updatedTask)
  } catch (error) {
    console.error('Error updating task:', error)
    res.status(500).json({ error: 'Failed to update task' })
  }
}

export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const { status }: UpdateTaskStatusInput = req.body

    if (status !== 'completed' && status !== 'incomplete') {
      return res.status(400).json({ error: "Status must be 'completed' or 'incomplete'" })
    }

    const existingTask = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [id])
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const updateQuery = status === 'completed'
      ? 'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP, completed_at = NULL WHERE id = ?'

    await dbRun(db, updateQuery, [status, id])

    const updatedTask = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [id])
    res.json(updatedTask)
  } catch (error) {
    console.error('Error updating task status:', error)
    res.status(500).json({ error: 'Failed to update task status' })
  }
}

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params

    const task = await dbGet(db, 'SELECT * FROM tasks WHERE id = ?', [id])
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    // First, delete all user_tasks entries that reference this task
    // This is necessary because of the foreign key constraint
    try {
      await dbRun(db, 'DELETE FROM user_tasks WHERE task_id = ?', [id])
      console.log(`Deleted user_tasks entries for task ${id}`)
    } catch (userTaskError: any) {
      // Log but don't fail if there are no user_tasks entries
      console.log(`No user_tasks entries found for task ${id} or already deleted`)
    }

    // Now delete the task itself
    await dbRun(db, 'DELETE FROM tasks WHERE id = ?', [id])
    res.json({ message: 'Task deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting task:', error)
    // Provide more detailed error message
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ 
        error: 'Cannot delete task due to foreign key constraint. Please remove all user assignments first.',
        details: error.message 
      })
    }
    res.status(500).json({ 
      error: 'Failed to delete task',
      details: error.message || 'Unknown error occurred'
    })
  }
}

export const getTaskStats = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { coach_id } = req.params

    const stats = await dbGet(db, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'incomplete' THEN 1 ELSE 0 END) as incomplete
      FROM tasks
      WHERE coach_id = ?
    `, [coach_id]) as TaskStats

    res.json({
      total: stats.total || 0,
      completed: stats.completed || 0,
      incomplete: stats.incomplete || 0,
    })
  } catch (error) {
    console.error('Error fetching task stats:', error)
    res.status(500).json({ error: 'Failed to fetch task stats' })
  }
}

export const getTasksByDate = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { coach_id } = req.params

    const tasks = await dbAll(db, `
      SELECT * FROM tasks
      WHERE coach_id = ?
      ORDER BY deadline ASC, created_at DESC
    `, [coach_id])

    // Group tasks by date (deadline date only, not time)
    const grouped: Record<string, any[]> = {}
    
    tasks.forEach((task: any) => {
      const deadlineDate = new Date(task.deadline).toISOString().split('T')[0]
      if (!grouped[deadlineDate]) {
        grouped[deadlineDate] = []
      }
      grouped[deadlineDate].push(task)
    })

    res.json(grouped)
  } catch (error) {
    console.error('Error fetching tasks by date:', error)
    res.status(500).json({ error: 'Failed to fetch tasks by date' })
  }
}
