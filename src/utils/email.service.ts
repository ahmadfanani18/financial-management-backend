import { MailtrapClient } from 'mailtrap';

const client = new MailtrapClient({
  token: process.env.MAILTRAP_API_TOKEN || 'your-api-token',
});

interface SendResetEmailOptions {
  to: string;
  name: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({ to, name, resetUrl }: SendResetEmailOptions) {
  if (process.env.SKIP_EMAIL === 'true') {
    console.log('========== EMAIL SKIPPED (SKIP_EMAIL=true) ==========');
    console.log('To:', to);
    console.log('Name:', name);
    console.log('Reset URL:', resetUrl);
    console.log('=========================================================');
    return { message: 'Email skipped for testing' };
  }

  const sender = {
    email: 'hello@demomailtrap.co',
    name: 'FinTrack',
  };

  return client.send({
    from: sender,
    to: [{ email: to }],
    subject: 'Reset Password - FinTrack',
    text: `Halo ${name},\n\nKlik link berikut untuk reset password:\n${resetUrl}\n\nLink ini berlaku 1 jam.\n\nJika Anda tidak meminta reset password, abaikan email ini.`,
    html: `
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
    `,
    category: 'Password Reset',
  });
}