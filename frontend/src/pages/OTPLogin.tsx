import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { otpAPI } from '../services/api'

type Step = 'email' | 'otp' | 'success'

export default function OTPLogin() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [shake, setShake] = useState(false)
  const otpInputRef = useRef<HTMLInputElement>(null)
  const { loginWithOTP } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  useEffect(() => {
    if (otpExpiresAt) {
      const interval = setInterval(() => {
        const now = new Date()
        if (now >= otpExpiresAt) {
          setOtpExpiresAt(null)
          setError('OTP has expired. Please request a new one.')
        }
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [otpExpiresAt])

  useEffect(() => {
    if (step === 'otp' && otpInputRef.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (otpInputRef.current) {
            otpInputRef.current.focus()
            otpInputRef.current.select()
          }
        }, 100)
      })
    }
  }, [step])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await otpAPI.generateOTP(email)
      setStep('otp')
      setResendCooldown(60)
      if (response.data.expires_at) {
        setOtpExpiresAt(new Date(response.data.expires_at))
      }
      setError('')
    } catch (err: any) {
      console.error('OTP generation error:', err)
      
      let errorMessage = 'Failed to send OTP'
      
      if (err.response) {
        // Server responded with error
        errorMessage = err.response.data?.error || 'Failed to send OTP'
        
        if (err.response.status === 404) {
          errorMessage = err.response.data?.error || 'Email not found. Please contact admin.'
        } else if (err.response.status === 429) {
          errorMessage = err.response.data?.error || 'Too many requests. Please try again later.'
          if (err.response.data?.retryAfter) {
            setResendCooldown(err.response.data.retryAfter * 60)
          }
        } else if (err.response.status === 500) {
          errorMessage = err.response.data?.error || 'Server error. Please try again later.'
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = 'Unable to connect to server. Please check your internet connection.'
        console.error('Network error - no response from server:', err.message)
      } else {
        // Something else happened
        errorMessage = err.message || 'An unexpected error occurred. Please try again.'
        console.error('Unexpected error:', err)
      }
      
      setError(errorMessage)
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP')
      triggerShake()
      return
    }

    setError('')
    setLoading(true)

    try {
      const response = await otpAPI.verifyOTP(email, otp)
      const { user, token } = response.data
      
      setStep('success')
      
      setTimeout(() => {
        loginWithOTP(user, token)
        
        if (user.role === 'ADMIN') {
          navigate('/admin')
        } else if (user.role === 'COACH') {
          navigate('/coach-dashboard')
        } else {
          navigate('/user-dashboard')
        }
      }, 1500)
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to verify OTP'
      setError(errorMessage)
      triggerShake()
      
      if (err.response?.data?.remainingAttempts !== undefined) {
        setRemainingAttempts(err.response.data.remainingAttempts)
      }
      
      setOtp('')
      if (otpInputRef.current) {
        otpInputRef.current.focus()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return
    
    setError('')
    setLoading(true)
    setOtp('')

    try {
      const response = await otpAPI.generateOTP(email)
      setResendCooldown(60)
      if (response.data.expires_at) {
        setOtpExpiresAt(new Date(response.data.expires_at))
      }
      setRemainingAttempts(null)
      setError('')
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to resend OTP'
      setError(errorMessage)
      
      if (err.response?.status === 429 && err.response?.data?.retryAfter) {
        setResendCooldown(err.response.data.retryAfter * 60)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBackToEmail = () => {
    setStep('email')
    setOtp('')
    setError('')
    setOtpExpiresAt(null)
    setRemainingAttempts(null)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getOTPTimeRemaining = (): string => {
    if (!otpExpiresAt) return ''
    const now = new Date()
    const diff = Math.max(0, Math.floor((otpExpiresAt.getTime() - now.getTime()) / 1000))
    if (diff === 0) return 'Expired'
    const mins = Math.floor(diff / 60)
    const secs = diff % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-md w-full"
      >
        {/* White Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          {/* Success Screen */}
          <AnimatePresence mode="wait">
            {step === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center"
                >
                  <motion.svg
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <motion.path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </motion.svg>
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-gray-900 mb-2"
                >
                  Login Successful!
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-600"
                >
                  Redirecting to your dashboard...
                </motion.p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header */}
                <div className="text-center">
                  <motion.h2
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-3xl font-bold text-purple-600"
                  >
                    {step === 'email' ? 'Sign in with OTP' : 'Enter OTP'}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="mt-2 text-sm text-gray-600"
                  >
                    {step === 'email'
                      ? 'Enter your email to receive a one-time password'
                      : `OTP sent to ${email}`}
                  </motion.p>
                </div>

                {/* Email Form */}
                {step === 'email' && (
                  <motion.form
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="mt-8 space-y-6"
                    onSubmit={handleEmailSubmit}
                  >
                    {/* Error Message */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg"
                        >
                          <p className="text-sm font-medium">{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email Input */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <motion.input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        whileFocus={{ scale: 1.01 }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none text-gray-900 placeholder-gray-400"
                        placeholder="your.email@example.com"
                      />
                    </div>

                    {/* Send OTP Button */}
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={!loading ? { x: 4, scale: 1.01 } : {}}
                      whileTap={!loading ? { scale: 0.99 } : {}}
                      className="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-base font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md"
                    >
                      {loading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                      ) : (
                        <>
                          <span>Send OTP</span>
                          <motion.svg
                            className="ml-2 w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            initial={{ x: 0 }}
                            whileHover={{ x: 4 }}
                            transition={{ type: 'spring', stiffness: 400 }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </motion.svg>
                        </>
                      )}
                    </motion.button>

                    {/* Password Login Link */}
                    <div className="text-center text-sm">
                      <span className="text-gray-600">Prefer password login? </span>
                      <Link
                        to="/login"
                        className="font-semibold text-purple-600 hover:text-purple-700 transition-colors duration-200"
                      >
                        Use password
                      </Link>
                    </div>
                  </motion.form>
                )}

                {/* OTP Form */}
                {step === 'otp' && (
                  <motion.form
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-8 space-y-6"
                    onSubmit={handleOTPSubmit}
                  >
                    {/* Error Message */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className={`px-4 py-3 rounded-lg ${
                            error.includes('expired') || error.includes('attempts exceeded')
                              ? 'bg-red-50 border-l-4 border-red-500 text-red-700'
                              : 'bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700'
                          }`}
                        >
                          <p className="text-sm font-medium">{error}</p>
                          {remainingAttempts !== null && remainingAttempts > 0 && (
                            <p className="mt-1 text-xs">
                              {remainingAttempts} attempt(s) remaining
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Default OTP Banner */}
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 text-center"
                      >
                        <div className="font-semibold mb-2 text-green-800">🔑 Default OTP Code</div>
                        <div className="text-2xl font-mono font-bold tracking-widest bg-white px-4 py-2 rounded text-green-700 mb-2">
                          123456
                        </div>
                        <div className="text-xs text-green-700">Development Mode - Use this code to log in</div>
                      </motion.div>
                    </AnimatePresence>

                    {/* OTP Expiry Timer */}
                    <AnimatePresence>
                      {otpExpiresAt && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm text-center"
                        >
                          ⏰ OTP expires in: <span className="font-bold">{getOTPTimeRemaining()}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* OTP Input */}
                    <div className="relative">
                      <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                        Enter 6-digit OTP
                      </label>
                      <input
                        ref={otpInputRef}
                        id="otp"
                        name="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        value={otp}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                          setOtp(value)
                        }}
                        onKeyDown={(e) => {
                          if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                            (e.keyCode === 65 && e.ctrlKey === true) ||
                            (e.keyCode === 67 && e.ctrlKey === true) ||
                            (e.keyCode === 86 && e.ctrlKey === true) ||
                            (e.keyCode === 88 && e.ctrlKey === true) ||
                            (e.keyCode >= 35 && e.keyCode <= 39)) {
                            return
                          }
                          if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                            e.preventDefault()
                          }
                        }}
                        maxLength={6}
                        className={`w-full px-4 py-4 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 outline-none text-center text-3xl tracking-[0.5em] font-mono text-gray-900 placeholder-gray-300 bg-white cursor-text ${shake ? 'animate-shake border-red-500' : ''}`}
                        placeholder="123456"
                        autoFocus={step === 'otp'}
                        style={{ 
                          display: 'block',
                          visibility: 'visible',
                          opacity: 1
                        }}
                      />
                      <div className="mt-2 text-xs text-gray-500 text-center">
                        💡 Quick fill: Click{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setOtp('123456')
                            if (otpInputRef.current) {
                              otpInputRef.current.focus()
                            }
                          }}
                          className="text-purple-600 hover:text-purple-800 font-semibold underline transition-colors"
                        >
                          here
                        </button>{' '}
                        to use default code
                      </div>
                    </div>

                    {/* Verify Button */}
                    <motion.button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      whileHover={!loading && otp.length === 6 ? { x: 4, scale: 1.01 } : {}}
                      whileTap={!loading && otp.length === 6 ? { scale: 0.99 } : {}}
                      className="group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-base font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-md"
                    >
                      {loading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                      ) : (
                        <>
                          <span>Verify OTP</span>
                          <motion.svg
                            className="ml-2 w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            initial={{ x: 0 }}
                            whileHover={{ x: 4 }}
                            transition={{ type: 'spring', stiffness: 400 }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </motion.svg>
                        </>
                      )}
                    </motion.button>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-2">
                      <motion.button
                        type="button"
                        onClick={handleBackToEmail}
                        whileHover={{ x: -4 }}
                        whileTap={{ scale: 0.95 }}
                        className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200 flex items-center"
                      >
                        <motion.svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          initial={{ x: 0 }}
                          whileHover={{ x: -4 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </motion.svg>
                        Change email
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={resendCooldown > 0 || loading}
                        whileHover={resendCooldown === 0 && !loading ? { x: 4 } : {}}
                        whileTap={resendCooldown === 0 && !loading ? { scale: 0.95 } : {}}
                        className="text-sm font-semibold text-purple-600 hover:text-purple-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        {resendCooldown > 0
                          ? `Resend in ${formatTime(resendCooldown)}`
                          : 'Resend OTP'}
                      </motion.button>
                    </div>

                    {/* Password Login Link */}
                    <div className="text-center text-sm pt-2">
                      <span className="text-gray-600">Prefer password login? </span>
                      <Link
                        to="/login"
                        className="font-semibold text-purple-600 hover:text-purple-700 transition-colors duration-200"
                      >
                        Use password
                      </Link>
                    </div>
                  </motion.form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
