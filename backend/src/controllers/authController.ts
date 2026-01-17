import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDatabase, dbGet, dbRun } from '../database/db.js'
import { generateToken } from '../utils/jwt.js'
import { CreateUserInput, LoginInput } from '../models/User.js'

export const signup = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { name, email, password, role }: CreateUserInput = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' })
    }

    // Special email gets ADMIN role automatically
    const finalRole = email.toLowerCase() === 'santhosh.13mhs@gmail.com' ? 'ADMIN' : (role || 'USER')

    if (!['ADMIN', 'COACH', 'USER'].includes(finalRole)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    // Check if user already exists
    const existingUser = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [email])
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const result = await dbRun(
      db,
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, finalRole]
    )

    const user = await dbGet(
      db,
      'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?',
      [result.lastID]
    )

    // If user is a COACH, automatically create a coach record
    if (finalRole === 'COACH') {
      try {
        // Check if coach already exists
        const existingCoach = await dbGet(db, 'SELECT * FROM coaches WHERE email = ?', [email])
        if (!existingCoach) {
          await dbRun(
            db,
            'INSERT INTO coaches (name, email) VALUES (?, ?)',
            [name, email]
          )
        }
      } catch (coachError: any) {
        // If coach creation fails, log but don't fail the signup
        console.log('Coach record creation note:', coachError.message)
      }
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    res.status(201).json({
      user,
      token,
      message: finalRole === 'ADMIN' ? 'Admin account created successfully' : 'Account created successfully'
    })
  } catch (error: any) {
    console.error('Error signing up:', error)
    res.status(500).json({ error: 'Failed to create account' })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { email, password }: LoginInput = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user by email (case-insensitive)
    const user = await dbGet(db, 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email])
    if (!user) {
      // Check if email exists in leads table (suggest they may need to sign up)
      const lead = await dbGet(db, 'SELECT * FROM leads WHERE LOWER(email) = LOWER(?)', [email])
      if (lead) {
        return res.status(401).json({ 
          error: 'Account not found. Please sign up or contact your admin to create an account.',
          emailExists: true
        })
      }
      return res.status(401).json({ 
        error: 'Email not found. Please sign up or contact your admin.',
        emailExists: false
      })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      token,
    })
  } catch (error) {
    console.error('Error logging in:', error)
    res.status(500).json({ error: 'Failed to login' })
  }
}

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Check if user exists
    const user = await dbGet(db, 'SELECT * FROM users WHERE email = ?', [email])
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'If the email exists, a reset link will be sent' })
    }

    // TODO: Implement actual email sending with reset token
    // For now, return success message
    res.json({ message: 'If the email exists, a reset link will be sent' })
  } catch (error) {
    console.error('Error in forgot password:', error)
    res.status(500).json({ error: 'Failed to process request' })
  }
}

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const authReq = req as any
    const userId = authReq.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await dbGet(
      db,
      'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    )

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  } catch (error) {
    console.error('Error fetching current user:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}
