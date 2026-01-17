import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDatabase, dbAll, dbGet, dbRun } from '../database/db.js'

export const getAllLeads = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { coach_id } = req.query

    let query = `
      SELECT 
        l.*,
        c.name as coach_name,
        c.email as coach_email
      FROM leads l
      LEFT JOIN coaches c ON l.assigned_coach_id = c.id
    `
    const params: any[] = []

    if (coach_id) {
      query += ' WHERE l.assigned_coach_id = ?'
      params.push(coach_id)
    }

    query += ' ORDER BY l.created_at DESC'

    const leads = await dbAll(db, query, params)
    res.json(leads)
  } catch (error) {
    console.error('Error fetching leads:', error)
    res.status(500).json({ error: 'Failed to fetch leads' })
  }
}

export const getLeadById = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const lead = await dbGet(db, `
      SELECT 
        l.*,
        c.name as coach_name,
        c.email as coach_email
      FROM leads l
      LEFT JOIN coaches c ON l.assigned_coach_id = c.id
      WHERE l.id = ?
    `, [id])
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' })
    }
    
    res.json(lead)
  } catch (error) {
    console.error('Error fetching lead:', error)
    res.status(500).json({ error: 'Failed to fetch lead' })
  }
}

export const assignLead = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const { coach_id } = req.body

    const lead = await dbGet(db, 'SELECT * FROM leads WHERE id = ?', [id])
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    if (coach_id) {
      const coach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [coach_id])
      if (!coach) {
        return res.status(404).json({ error: 'Coach not found' })
      }
    }

    // Update lead assignment
    await dbRun(
      db,
      'UPDATE leads SET assigned_coach_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [coach_id || null, id]
    )

    // If coach is assigned, create user account and map to coach
    if (coach_id && lead.email) {
      // Check if user already exists
      let user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [lead.email.toLowerCase()])
      
      if (!user) {
        // Create user account for the lead
        const defaultPassword = lead.email.toLowerCase() + (lead.phone_number || '').slice(-4)
        const hashedPassword = await bcrypt.hash(defaultPassword, 10)

        const userResult = await dbRun(
          db,
          'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
          [lead.name, lead.email.toLowerCase(), hashedPassword, 'USER']
        )

        user = await dbGet(db, 'SELECT id, name, email, role FROM users WHERE id = ?', [userResult.lastID])
      }

      if (user) {
        // Remove existing assignment if any
        await dbRun(
          db,
          'DELETE FROM user_coach_mapping WHERE user_id = ?',
          [user.id]
        )
        // Create new assignment
        await dbRun(
          db,
          'INSERT INTO user_coach_mapping (user_id, coach_id) VALUES (?, ?)',
          [user.id, coach_id]
        )
      }
    } else if (!coach_id && lead.email) {
      // If coach is unassigned, remove user-coach mapping but keep user account
      const user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [lead.email.toLowerCase()])
      if (user) {
        await dbRun(
          db,
          'DELETE FROM user_coach_mapping WHERE user_id = ?',
          [user.id]
        )
      }
    }

    const updatedLead = await dbGet(db, `
      SELECT 
        l.*,
        c.name as coach_name,
        c.email as coach_email
      FROM leads l
      LEFT JOIN coaches c ON l.assigned_coach_id = c.id
      WHERE l.id = ?
    `, [id])

    res.json(updatedLead)
  } catch (error) {
    console.error('Error assigning lead:', error)
    res.status(500).json({ error: 'Failed to assign lead' })
  }
}

export const bulkAssignLeads = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { lead_ids, coach_id } = req.body

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids must be a non-empty array' })
    }

    if (coach_id) {
      const coach = await dbGet(db, 'SELECT * FROM coaches WHERE id = ?', [coach_id])
      if (!coach) {
        return res.status(404).json({ error: 'Coach not found' })
      }
    }

    const createdUsers: any[] = []

    // Update all leads and create user accounts if coach is assigned
    for (const leadId of lead_ids) {
      const lead = await dbGet(db, 'SELECT * FROM leads WHERE id = ?', [leadId])
      if (!lead) continue

      // Update lead assignment
      await dbRun(
        db,
        'UPDATE leads SET assigned_coach_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [coach_id || null, leadId]
      )

      // If coach is assigned, create user account and map to coach
      if (coach_id && lead.email) {
        // Check if user already exists
        let user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [lead.email.toLowerCase()])
        
        if (!user) {
          // Create user account for the lead
          const defaultPassword = lead.email.toLowerCase() + (lead.phone_number || '').slice(-4)
          const hashedPassword = await bcrypt.hash(defaultPassword, 10)

          const userResult = await dbRun(
            db,
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [lead.name, lead.email.toLowerCase(), hashedPassword, 'USER']
          )

          user = await dbGet(db, 'SELECT id, name, email, role FROM users WHERE id = ?', [userResult.lastID])
          if (user) {
            createdUsers.push(user)
          }
        }

        if (user) {
          // Remove existing assignment if any
          await dbRun(
            db,
            'DELETE FROM user_coach_mapping WHERE user_id = ?',
            [user.id]
          )
          // Create new assignment
          await dbRun(
            db,
            'INSERT INTO user_coach_mapping (user_id, coach_id) VALUES (?, ?)',
            [user.id, coach_id]
          )
        }
      } else if (!coach_id && lead.email) {
        // If coach is unassigned, remove user-coach mapping but keep user account
        const existingUser = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [lead.email.toLowerCase()])
        if (existingUser) {
          await dbRun(
            db,
            'DELETE FROM user_coach_mapping WHERE user_id = ?',
            [existingUser.id]
          )
        }
      }
    }

    const placeholders = lead_ids.map(() => '?').join(',')
    const updatedLeads = await dbAll(db, `
      SELECT 
        l.*,
        c.name as coach_name,
        c.email as coach_email
      FROM leads l
      LEFT JOIN coaches c ON l.assigned_coach_id = c.id
      WHERE l.id IN (${placeholders})
    `, lead_ids)

    res.json({
      leads: updatedLeads,
      usersCreated: createdUsers.length,
      message: `Successfully assigned ${updatedLeads.length} lead(s)${createdUsers.length > 0 ? ` and created ${createdUsers.length} user account(s)` : ''}`
    })
  } catch (error) {
    console.error('Error bulk assigning leads:', error)
    res.status(500).json({ error: 'Failed to bulk assign leads' })
  }
}

export const deleteLead = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { id } = req.params

    const lead = await dbGet(db, 'SELECT * FROM leads WHERE id = ?', [id])
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    // If lead has email, check if user exists and delete related mappings
    if (lead.email) {
      const user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [lead.email.toLowerCase()])
      if (user) {
        // Delete user-coach mapping
        await dbRun(
          db,
          'DELETE FROM user_coach_mapping WHERE user_id = ?',
          [user.id]
        )
        // Delete user tasks
        await dbRun(
          db,
          'DELETE FROM user_tasks WHERE user_id = ?',
          [user.id]
        )
        // Delete user account
        await dbRun(
          db,
          'DELETE FROM users WHERE id = ?',
          [user.id]
        )
      }
    }

    // Delete the lead
    await dbRun(db, 'DELETE FROM leads WHERE id = ?', [id])

    res.json({ message: 'Lead deleted successfully' })
  } catch (error) {
    console.error('Error deleting lead:', error)
    res.status(500).json({ error: 'Failed to delete lead' })
  }
}

export const bulkDeleteLeads = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { lead_ids } = req.body

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'lead_ids must be a non-empty array' })
    }

    let deletedCount = 0
    let usersDeletedCount = 0

    for (const leadId of lead_ids) {
      const lead = await dbGet(db, 'SELECT * FROM leads WHERE id = ?', [leadId])
      if (!lead) continue

      // If lead has email, check if user exists and delete related mappings
      if (lead.email) {
        const user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [lead.email.toLowerCase()])
        if (user) {
          // Delete user-coach mapping
          await dbRun(
            db,
            'DELETE FROM user_coach_mapping WHERE user_id = ?',
            [user.id]
          )
          // Delete user tasks
          await dbRun(
            db,
            'DELETE FROM user_tasks WHERE user_id = ?',
            [user.id]
          )
          // Delete user account
          await dbRun(
            db,
            'DELETE FROM users WHERE id = ?',
            [user.id]
          )
          usersDeletedCount++
        }
      }

      // Delete the lead
      await dbRun(db, 'DELETE FROM leads WHERE id = ?', [leadId])
      deletedCount++
    }

    res.json({
      message: `Successfully deleted ${deletedCount} lead(s)${usersDeletedCount > 0 ? ` and ${usersDeletedCount} associated user account(s)` : ''}`,
      deletedCount,
      usersDeletedCount
    })
  } catch (error) {
    console.error('Error bulk deleting leads:', error)
    res.status(500).json({ error: 'Failed to delete leads' })
  }
}
