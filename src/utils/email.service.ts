import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendResetEmailOptions {
  to: string;
  name: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({ to, name, resetUrl }: SendResetEmailOptions) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 30px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">FinTrack</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
        <h2 style="color: #111; margin-top: 0;">Halo ${name},</h2>
        <p style="color: #666;">Kami menerima permintaan untuk mereset password akun FinTrack Anda.</p>
        <p style="color: #666;">Klik tombol di bawah untuk mereset password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #0d9488; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #999; font-size: 14px;">Link ini akan kedaluwarsa dalam 1 jam.</p>
        <p style="color: #999; font-size: 14px;">Jika Anda tidak meminta reset password, abaikan email ini.</p>
        <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; color: #999; font-size: 12px;">
          <p style="margin: 0;">Email ini dikirim secara otomatis oleh FinTrack.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: process.env.SMTP_FROM || '"FinTrack" <noreply@fintrack.app>',
    to,
    subject: 'Reset Password - FinTrack',
    html: htmlContent,
  });
}