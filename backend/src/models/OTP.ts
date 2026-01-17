export interface OTPVerification {
  id: number
  email: string
  otp_hash: string
  expires_at: string
  is_used: number // SQLite uses INTEGER for boolean (0 = false, 1 = true)
  verification_attempts: number
  created_at: string
}

export interface GenerateOTPInput {
  email: string
}

export interface VerifyOTPInput {
  email: string
  otp: string
}

export interface OTPResponse {
  message: string
  expires_at?: string
  resend_available_at?: string
}
