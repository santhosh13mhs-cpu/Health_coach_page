// Email service for sending OTP
// In production, integrate with services like SendGrid, AWS SES, or Nodemailer

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  try {
    // In development mode, just log to console
    // In production, this will send actual emails
    if (process.env.NODE_ENV === 'production' && process.env.EMAIL_SERVICE_ENABLED === 'true') {
      // Production email sending with Nodemailer or other service
      const nodemailer = await import('nodemailer')
      
      const transporter = nodemailer.default.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      })
      
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: 'Your Login OTP Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Login OTP Code</h2>
            <p>Use the following code to log in:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 5px; font-weight: bold; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code will expire in 5 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      })
      
      console.log(`✅ OTP email sent successfully to: ${email}`)
    } else {
      // Development mode: log to console
      console.log('='.repeat(60))
      console.log(`📧 OTP EMAIL SENT TO: ${email}`)
      console.log(`🔑 OTP CODE: ${otp}`)
      if (otp === '123456') {
        console.log(`📝 NOTE: This is the DEFAULT OTP for development mode`)
      }
      console.log(`⏰ Valid for 5 minutes`)
      console.log('='.repeat(60))
    }
  } catch (error: any) {
    // Log error but don't throw - we don't want email failures to break OTP generation
    console.error('⚠️ Error sending OTP email:', error.message)
    console.error('OTP code for', email, ':', otp)
    // In development, we still consider this a success since we log the OTP
    // In production, you might want to handle this differently
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Failed to send email: ${error.message}`)
    }
  }
}
