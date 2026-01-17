import { Request, Response, NextFunction } from 'express'
import { verifyToken, JWTPayload } from '../utils/jwt.js'

export interface AuthRequest extends Request {
  user?: JWTPayload
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Authentication failed: No token provided')
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (error: any) {
    console.error('Authentication failed:', error.message)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!roles.includes(req.user.role)) {
      console.error(`Authorization failed: User role '${req.user.role}' not in allowed roles:`, roles)
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        requiredRoles: roles,
        userRole: req.user.role
      })
    }

    next()
  }
}
