import { Request, Response } from 'express'
import { getDatabase, dbAll, dbGet, dbRun } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { role } = req.query

    let query = 'SELECT id, name, email, role, created_at, updated_at FROM users WHERE 1=1'
    const params: any[] = []

    if (role) {
      query += ' AND role = ?'
      params.push(role)
    }

    query += ' ORDER BY created_at DESC'

    const users = await dbAll(db, query, params)
    res.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
}

export const getUserById = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params

    const user = await dbGet(
      db,
      'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?',
      [id]
    )

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}

export const assignCoachToUser = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { user_id, coach_id } = req.body

    if (!user_id || !coach_id) {
      return res.status(400).json({ error: 'user_id and coach_id are required' })
    }

    // Verify user exists
    const user = await dbGet(db, 'SELECT * FROM users WHERE id = ?', [user_id])
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify coach exists
    const coach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [coach_id])
    if (!coach) {
      return res.status(404).json({ error: 'Coach not found' })
    }

    // Remove existing assignment if any
    await dbRun(
      db,
      'DELETE FROM user_coach_mapping WHERE user_id = ?',
      [user_id]
    )

    // Create new assignment
    await dbRun(
      db,
      'INSERT INTO user_coach_mapping (user_id, coach_id) VALUES (?, ?)',
      [user_id, coach_id]
    )

    const mapping = await dbGet(db, `
      SELECT 
        ucm.*,
        u.name as user_name,
        u.email as user_email,
        c.name as coach_name,
        c.email as coach_email
      FROM user_coach_mapping ucm
      JOIN users u ON ucm.user_id = u.id
      JOIN coaches c ON ucm.coach_id = c.id
      WHERE ucm.user_id = ?
    `, [user_id])

    res.json(mapping)
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'User already has a coach assigned' })
    }
    console.error('Error assigning coach:', error)
    res.status(500).json({ error: 'Failed to assign coach' })
  }
}

export const getUserCoach = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const userId = req.params.userId || (req as AuthRequest).user?.userId

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    const mapping = await dbGet(db, `
      SELECT 
        ucm.*,
        c.name as coach_name,
        c.email as coach_email
      FROM user_coach_mapping ucm
      JOIN coaches c ON ucm.coach_id = c.id
      WHERE ucm.user_id = ?
    `, [userId])

    if (!mapping) {
      return res.json({ coach: null, message: 'No coach assigned' })
    }

    res.json({ coach: mapping })
  } catch (error) {
    console.error('Error fetching user coach:', error)
    res.status(500).json({ error: 'Failed to fetch coach assignment' })
  }
}

export const getUsersByCoach = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { coachId } = req.params

    const users = await dbAll(db, `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        ucm.created_at as assigned_at
      FROM users u
      JOIN user_coach_mapping ucm ON u.id = ucm.user_id
      WHERE ucm.coach_id = ?
      ORDER BY ucm.created_at DESC
    `, [coachId])

    res.json(users)
  } catch (error) {
    console.error('Error fetching users by coach:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
}

export const getUserAnalytics = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { userId } = req.params

    // Get user info
    const user = await dbGet(
      db,
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [userId]
    )

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get assigned coach
    const coachMapping = await dbGet(db, `
      SELECT c.name as coach_name, c.email as coach_email
      FROM user_coach_mapping ucm
      JOIN coaches c ON ucm.coach_id = c.id
      WHERE ucm.user_id = ?
    `, [userId])

    // Get task stats
    const taskStats = await dbGet(db, `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'INCOMPLETE' THEN 1 ELSE 0 END) as incomplete
      FROM user_tasks
      WHERE user_id = ?
    `, [userId]) as any

    res.json({
      user,
      coach: coachMapping || null,
      tasks: {
        total: taskStats.total || 0,
        completed: taskStats.completed || 0,
        incomplete: taskStats.incomplete || 0,
        completion_percentage: taskStats.total > 0
          ? Math.round((taskStats.completed / taskStats.total) * 100)
          : 0,
      },
    })
  } catch (error) {
    console.error('Error fetching user analytics:', error)
    res.status(500).json({ error: 'Failed to fetch user analytics' })
  }
}

export const getAllUsersAnalytics = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()

    const users = await dbAll(db, `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        c.name as coach_name,
        COUNT(DISTINCT ut.id) as total_tasks,
        SUM(CASE WHEN ut.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN ut.status = 'INCOMPLETE' THEN 1 ELSE 0 END) as incomplete_tasks
      FROM users u
      LEFT JOIN user_coach_mapping ucm ON u.id = ucm.user_id
      LEFT JOIN coaches c ON ucm.coach_id = c.id
      LEFT JOIN user_tasks ut ON u.id = ut.user_id
      WHERE u.role = 'USER'
      GROUP BY u.id, u.name, u.email, u.role, u.created_at, c.name
      ORDER BY u.created_at DESC
    `)

    res.json(users)
  } catch (error) {
    console.error('Error fetching all users analytics:', error)
    res.status(500).json({ error: 'Failed to fetch users analytics' })
  }
}

export const getUsersAnalyticsByCoach = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { coachId } = req.params

    const users = await dbAll(db, `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        c.name as coach_name,
        COUNT(DISTINCT ut.id) as total_tasks,
        SUM(CASE WHEN ut.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN ut.status = 'INCOMPLETE' THEN 1 ELSE 0 END) as incomplete_tasks
      FROM users u
      JOIN user_coach_mapping ucm ON u.id = ucm.user_id
      JOIN coaches c ON ucm.coach_id = c.id
      LEFT JOIN user_tasks ut ON u.id = ut.user_id
      WHERE ucm.coach_id = ? AND u.role = 'USER'
      GROUP BY u.id, u.name, u.email, u.role, u.created_at, c.name
      ORDER BY u.created_at DESC
    `, [coachId])

    res.json(users)
  } catch (error) {
    console.error('Error fetching users analytics by coach:', error)
    res.status(500).json({ error: 'Failed to fetch users analytics' })
  }
}
