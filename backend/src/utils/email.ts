// Email service for sending OTP
// In production, integrate with services like SendGrid, AWS SES, or Nodemailer

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  // TODO: Integrate with actual email service in production
  // For now, log to console (in development, check server logs for OTP)
  
  console.log('='.repeat(60))
  console.log(`📧 OTP EMAIL SENT TO: ${email}`)
  console.log(`🔑 OTP CODE: ${otp}`)
  if (otp === '123456') {
    console.log(`📝 NOTE: This is the DEFAULT OTP for development mode`)
  }
  console.log(`⏰ Valid for 5 minutes`)
  console.log('='.repeat(60))
  
  // In production, uncomment and configure:
  /*
  const nodemailer = require('nodemailer')
  const transporter = nodemailer.createTransport({
    // Configure your email service here
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  })
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
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
  */
}
