import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { getDatabase, dbGet, dbRun, dbAll } from '../database/db.js'
import { generateToken } from '../utils/jwt.js'
import { sendOTPEmail } from '../utils/email.js'
import { GenerateOTPInput, VerifyOTPInput } from '../models/OTP.js'

// Default OTP for development mode
const DEFAULT_OTP = '123456'

// Generate 6-digit OTP
function generateOTPCode(): string {
  // In development mode, use default OTP
  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_OTP
  }
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Rate limiting: Check if user has exceeded OTP request limit (5 per hour)
async function checkOTPRequestLimit(email: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const db = getDatabase()
  const normalizedEmail = email.toLowerCase()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  
  try {
    const recentRequests = await dbAll(
      db,
      `SELECT COUNT(*) as count FROM otp_verifications 
       WHERE email = ? AND created_at > ?`,
      [normalizedEmail, oneHourAgo]
    )
    
    const count = (recentRequests[0] as any)?.count || 0
    if (count >= 5) {
      // Find the oldest request in the last hour to calculate retry time
      const oldestRequest = await dbGet(
        db,
        `SELECT created_at FROM otp_verifications 
         WHERE email = ? AND created_at > ? 
         ORDER BY created_at ASC LIMIT 1`,
        [normalizedEmail, oneHourAgo]
      )
      
      if (oldestRequest) {
        const elapsedMinutes = Math.floor(
          (Date.now() - new Date((oldestRequest as any).created_at).getTime()) / 1000 / 60
        )
        const retryAfterMinutes = 60 - elapsedMinutes
        return { allowed: false, retryAfter: Math.max(1, retryAfterMinutes) }
      }
      
      return { allowed: false, retryAfter: 60 }
    }
    
    return { allowed: true }
  } catch (error: any) {
    console.error('Error checking OTP rate limit:', error)
    // If table doesn't exist, allow the request (table will be created)
    return { allowed: true }
  }
}

export const generateOTP = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { email }: GenerateOTPInput = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists
    const user = await dbGet(db, 'SELECT * FROM users WHERE LOWER(email) = ?', [normalizedEmail])
    if (!user) {
      return res.status(404).json({ 
        error: 'Email not found. Please contact admin.',
        emailExists: false
      })
    }

    // Check rate limiting (max 5 requests per hour)
    const rateLimit = await checkOTPRequestLimit(normalizedEmail)
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Too many OTP requests. Please try again in ${rateLimit.retryAfter} minutes.`,
        retryAfter: rateLimit.retryAfter
      })
    }

    // Generate OTP
    const otp = generateOTPCode()
    const otpHash = await bcrypt.hash(otp, 10)

    // Set expiry to 5 minutes from now
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    // Mark all previous OTPs for this email as used (only latest OTP is valid)
    await dbRun(
      db,
      'UPDATE otp_verifications SET is_used = 1 WHERE email = ? AND is_used = 0',
      [normalizedEmail]
    )

    // Save new OTP
    await dbRun(
      db,
      'INSERT INTO otp_verifications (email, otp_hash, expires_at, verification_attempts, is_used) VALUES (?, ?, ?, 0, 0)',
      [normalizedEmail, otpHash, expiresAt]
    )

    // Send OTP email
    try {
      await sendOTPEmail(normalizedEmail, otp)
      console.log(`✅ OTP generated and sent successfully for: ${normalizedEmail}`)
    } catch (emailError: any) {
      console.error('⚠️ Error sending OTP email:', emailError)
      // In development, continue even if email fails (OTP is logged to console)
      // In production, we might want to fail the request if email is critical
      if (process.env.NODE_ENV === 'production' && process.env.EMAIL_SERVICE_ENABLED === 'true') {
        return res.status(500).json({ 
          error: 'Failed to send OTP email. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
        })
      }
      // In development, log the OTP so user can still test
      console.log(`📝 Development mode: OTP for ${normalizedEmail} is: ${otp}`)
    }

    res.json({
      message: 'OTP sent to your email',
      expires_at: expiresAt,
      resend_available_at: new Date(Date.now() + 60 * 1000).toISOString(), // Can resend after 1 minute
      // In development, include the OTP in response
      ...(process.env.NODE_ENV !== 'production' && { otp: otp })
    })
  } catch (error: any) {
    console.error('❌ Error generating OTP:', error)
    console.error('Error details:', error.message, error.stack)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to generate OTP'
    if (error.message?.includes('database') || error.message?.includes('SQL')) {
      errorMessage = 'Database error. Please try again later.'
    } else if (error.message?.includes('email')) {
      errorMessage = 'Email service error. Please try again later.'
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const db = getDatabase()
    const { email, otp }: VerifyOTPInput = req.body

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find the latest unused OTP for this email
    const otpRecord = await dbGet(
      db,
      `SELECT * FROM otp_verifications 
       WHERE email = ? AND is_used = 0 
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    )

    if (!otpRecord) {
      return res.status(400).json({ error: 'No valid OTP found. Please request a new OTP.' })
    }

    // Check if OTP is expired
    const now = new Date()
    const expiresAt = new Date(otpRecord.expires_at)
    if (now > expiresAt) {
      await dbRun(
        db,
        'UPDATE otp_verifications SET is_used = 1 WHERE id = ?',
        [otpRecord.id]
      )
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' })
    }

    // Check verification attempts (max 3 attempts)
    if (otpRecord.verification_attempts >= 3) {
      await dbRun(
        db,
        'UPDATE otp_verifications SET is_used = 1 WHERE id = ?',
        [otpRecord.id]
      )
      return res.status(400).json({ error: 'Maximum verification attempts exceeded. Please request a new OTP.' })
    }

    // Verify OTP
    // In development mode, accept default OTP directly without hash check
    let isValid = false
    if (process.env.NODE_ENV !== 'production' && otp === DEFAULT_OTP) {
      // In development, accept default OTP directly
      isValid = true
    } else {
      // In production or for non-default OTPs, verify hash
      isValid = await bcrypt.compare(otp, otpRecord.otp_hash)
    }
    
    if (!isValid) {
      // Increment verification attempts
      await dbRun(
        db,
        'UPDATE otp_verifications SET verification_attempts = verification_attempts + 1 WHERE id = ?',
        [otpRecord.id]
      )

      const remainingAttempts = 3 - (otpRecord.verification_attempts + 1)
      if (remainingAttempts > 0) {
        return res.status(400).json({ 
          error: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
          remainingAttempts
        })
      } else {
        return res.status(400).json({ 
          error: 'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.' 
        })
      }
    }

    // OTP is valid - mark as used
    await dbRun(
      db,
      'UPDATE otp_verifications SET is_used = 1 WHERE id = ?',
      [otpRecord.id]
    )

    // Get user details
    const user = await dbGet(
      db,
      'SELECT id, name, email, role, created_at, updated_at FROM users WHERE LOWER(email) = ?',
      [normalizedEmail]
    )

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Generate JWT token
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
      message: 'Login successful'
    })
  } catch (error: any) {
    console.error('Error verifying OTP:', error)
    console.error('Error details:', error.message, error.stack)
    res.status(500).json({ 
      error: 'Failed to verify OTP',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}
