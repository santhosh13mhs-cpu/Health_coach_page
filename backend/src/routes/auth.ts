import express from 'express'
import { signup, login, forgotPassword, getCurrentUser } from '../controllers/authController.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.get('/me', authenticate, getCurrentUser)

export default router
