import express from 'express'
import { generateOTP, verifyOTP } from '../controllers/otpController.js'

const router = express.Router()

// Public routes (no authentication required)
router.post('/generate', generateOTP)
router.post('/verify', verifyOTP)

export default router
