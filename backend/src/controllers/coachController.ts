import { Request, Response } from 'express'
import { getDatabase, dbAll, dbGet, dbRun } from '../database/db.js'
import { CreateCoachInput, UpdateCoachInput } from '../models/Coach.js'

export const getAllCoaches = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const coaches = await dbAll(db, 'SELECT * FROM coaches ORDER BY created_at DESC')
    res.json(coaches)
  } catch (error) {
    console.error('Error fetching coaches:', error)
    res.status(500).json({ error: 'Failed to fetch coaches' })
  }
}

export const getCoachById = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const coach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [id])
    
    if (!coach) {
      return res.status(404).json({ error: 'Coach not found' })
    }
    
    res.json(coach)
  } catch (error) {
    console.error('Error fetching coach:', error)
    res.status(500).json({ error: 'Failed to fetch coach' })
  }
}

export const createCoach = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { name, email }: CreateCoachInput = req.body

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' })
    }

    const result = await dbRun(
      db,
      'INSERT INTO coaches (name, email) VALUES (?, ?)',
      [name, email]
    )

    const coach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [result.lastID])
    res.status(201).json(coach)
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already exists' })
    }
    console.error('Error creating coach:', error)
    res.status(500).json({ error: 'Failed to create coach' })
  }
}

export const updateCoach = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const { name, email }: UpdateCoachInput = req.body

    const existingCoach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [id])
    if (!existingCoach) {
      return res.status(404).json({ error: 'Coach not found' })
    }

    const updates: string[] = []
    const values: any[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (email !== undefined) {
      updates.push('email = ?')
      values.push(email)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    values.push(id)
    await dbRun(
      db,
      `UPDATE coaches SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    const updatedCoach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [id])
    res.json(updatedCoach)
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already exists' })
    }
    console.error('Error updating coach:', error)
    res.status(500).json({ error: 'Failed to update coach' })
  }
}

export const getCoachLeads = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const leads = await dbAll(
      db,
      'SELECT * FROM leads WHERE assigned_coach_id = ? ORDER BY created_at DESC',
      [id]
    )
    res.json(leads)
  } catch (error) {
    console.error('Error fetching coach leads:', error)
    res.status(500).json({ error: 'Failed to fetch coach leads' })
  }
}

export const getAllCoachesAnalytics = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    
    const coaches = await dbAll(db, `
      SELECT 
        c.id,
        c.name,
        c.email,
        c.created_at,
        COUNT(DISTINCT ucm.user_id) as total_users,
        COUNT(DISTINCT ut.id) as total_tasks,
        SUM(CASE WHEN ut.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN ut.status = 'INCOMPLETE' THEN 1 ELSE 0 END) as incomplete_tasks
      FROM coaches c
      LEFT JOIN user_coach_mapping ucm ON c.id = ucm.coach_id
      LEFT JOIN users u ON ucm.user_id = u.id
      LEFT JOIN user_tasks ut ON u.id = ut.user_id
      GROUP BY c.id, c.name, c.email, c.created_at
      ORDER BY c.created_at DESC
    `)

    res.json(coaches)
  } catch (error) {
    console.error('Error fetching coaches analytics:', error)
    res.status(500).json({ error: 'Failed to fetch coaches analytics' })
  }
}
