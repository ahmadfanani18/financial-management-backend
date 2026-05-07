import { getPrisma, parseBody, simpleToken, parseToken, setupCors, hashPassword, verifyPassword } from './utils.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';

export default async function handler(req, res) {
  try {
    const origin = req.headers.origin;
    setupCors(res, origin);

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    const url = (req.url || '/').split('?')[0];
    const method = req.method;

    console.log('Request:', method, url);
    
    const db = await getPrisma();

  // Health check
  if (url === '/api/health' && method === 'GET') {
    await db.$connect();
    res.status(200).send(JSON.stringify({ status: 'ok', database: 'connected' }));
    return;
  }

  // Login
  if (url === '/api/auth/login' && method === 'POST') {
    try {
      const body = parseBody(req.body);
      const { email, password } = body || {};
      if (!email || !password) {
        res.status(400).send(JSON.stringify({ message: 'Email and password required' }));
        return;
      }
      const user = await db.user.findUnique({ where: { email } });
      if (!user || !user.password) {
        res.status(401).send(JSON.stringify({ message: 'Invalid credentials' }));
        return;
      }
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        res.status(401).send(JSON.stringify({ message: 'Invalid credentials' }));
        return;
      }
      const authToken = simpleToken(user.id, user.email);
      res.status(200).send(JSON.stringify({ token: authToken, user: { id: user.id, email: user.email, name: user.name } }));
      return;
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
      return;
    }
  }

  // Register
  if (url === '/api/auth/register' && method === 'POST') {
    try {
      const body = parseBody(req.body);
      const { email, password, name } = body || {};
      if (!email || !password) {
        res.status(400).send(JSON.stringify({ message: 'Email and password required' }));
        return;
      }
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        res.status(400).send(JSON.stringify({ message: 'Email already exists' }));
        return;
      }
      const hashedPassword = await hashPassword(password);
      const user = await db.user.create({
        data: { email, password: hashedPassword, name: name || email.split('@')[0] }
      });
      const authToken = simpleToken(user.id, user.email);
      res.status(201).send(JSON.stringify({ token: authToken, user: { id: user.id, email: user.email, name: user.name } }));
      return;
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
      return;
    }
  }

  // Auth me
  const token = parseToken(req.headers.authorization);
  if (url === '/api/auth/me' && method === 'GET') {
    if (!token) {
      res.status(401).send(JSON.stringify({ message: 'Unauthorized' }));
      return;
    }
    const user = await db.user.findUnique({ where: { id: token.userId } });
    if (!user) {
      res.status(404).send(JSON.stringify({ message: 'User not found' }));
      return;
    }
    res.status(200).send(JSON.stringify({ id: user.id, email: user.email, name: user.name }));
    return;
  }

  // OAuth sync (from signIn event)
  if (url === '/api/auth/oauth' && method === 'POST') {
    try {
      const body = parseBody(req.body);
      const { email, name, avatar } = body || {};
      if (!email) {
        res.status(400).send(JSON.stringify({ message: 'Email required' }));
        return;
      }
      let user = await db.user.findUnique({ where: { email } });
      if (!user) {
        user = await db.user.create({
          data: { email, name: name || email.split('@')[0], avatar: avatar || null }
        });
      }
      const authToken = simpleToken(user.id, user.email);
      res.status(200).send(JSON.stringify({ token: authToken, user: { id: user.id, email: user.email, name: user.name } }));
      return;
    } catch (err) {
      console.error('OAuth error:', err);
      res.status(500).send(JSON.stringify({ message: 'Internal server error' }));
      return;
    }
  }

  // OAuth sync (from client after session established)
  if (url === '/api/auth/oauth-sync' && method === 'POST') {
    try {
      console.log('req.body type:', typeof req.body, req.body);
      const body = parseBody(req.body);
      console.log('parsed body:', body);
      if (!body || typeof body !== 'object') {
        res.status(400).send(JSON.stringify({ message: 'Invalid body' }));
        return;
      }
      const { email, name, image } = body;
      if (!email) {
        res.status(400).send(JSON.stringify({ message: 'Email required' }));
        return;
      }
      console.log('Creating/finding user:', email);
      let user = await db.user.findUnique({ where: { email } });
      if (!user) {
        user = await db.user.create({
          data: { email, name: name || email.split('@')[0], avatar: image || null }
        });
      }
      console.log('User found/created:', user.id);
      const authToken = simpleToken(user.id, user.email);
      res.status(200).send(JSON.stringify({ token: authToken, user: { id: user.id, email: user.email, name: user.name } }));
      return;
    } catch (err) {
      console.error('OAuth error:', err);
      res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
      return;
    }
  }

  // Forgot password
  if (url === '/api/auth/forgot-password' && method === 'POST') {
    try {
      const body = parseBody(req.body);
      const { email } = body || {};
      if (!email) {
        res.status(400).send(JSON.stringify({ message: 'Email required' }));
        return;
      }
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        res.status(200).send(JSON.stringify({ message: 'Jika email tersebut terdaftar, kami akan mengirim link reset password' }));
        return;
      }
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.passwordResetToken.create({
        data: { userId: user.id, token: tokenHash, expiresAt }
      });
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      const mailtrapToken = process.env.MAILTRAP_API_TOKEN;
      if (mailtrapToken) {
        try {
          const transport = nodemailer.createTransport(
            MailtrapTransport({
              token: mailtrapToken,
            })
          );
          const result = await transport.sendMail({
            from: { address: 'hello@demomailtrap.co', name: 'FinTrack' },
            to: [user.email],
            subject: 'Reset Password - FinTrack',
            text: `Halo ${user.name},\n\nKlik link berikut untuk reset password:\n${resetUrl}\n\nLink ini berlaku 1 jam.\n\nJika Anda tidak meminta reset password, abaikan email ini.`,
            html: `<h1>FinTrack - Reset Password</h1><p>Halo ${user.name},</p><p>Klik link berikut untuk reset password:</p><a href="${resetUrl}">Reset Password</a><p>Link ini berlaku 1 jam.</p>`
          });
          console.log('Mailtrap result:', result);
        } catch (emailErr) {
          console.error('Email send error:', emailErr);
        }
      } else {
        console.log('========== EMAIL SKIPPED (NO MAILTRAP_TOKEN) ==========');
        console.log('To:', user.email);
        console.log('Name:', user.name);
        console.log('Reset URL:', resetUrl);
        console.log('=========================================================');
      }
      res.status(200).send(JSON.stringify({ message: 'Jika email tersebut terdaftar, kami akan mengirim link reset password' }));
      return;
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
      return;
    }
  }

  // Reset password
  if (url === '/api/auth/reset-password' && method === 'POST') {
    try {
      const body = parseBody(req.body);
      const { token, password } = body || {};
      if (!token || !password) {
        res.status(400).send(JSON.stringify({ message: 'Token and password required' }));
        return;
      }
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const resetToken = await db.passwordResetToken.findUnique({
        where: { token: tokenHash },
        include: { user: true }
      });
      if (!resetToken) {
        res.status(400).send(JSON.stringify({ message: 'Token tidak valid' }));
        return;
      }
      if (resetToken.used) {
        res.status(400).send(JSON.stringify({ message: 'Token sudah digunakan' }));
        return;
      }
      if (resetToken.expiresAt < new Date()) {
        res.status(400).send(JSON.stringify({ message: 'Token sudah kedaluwarsa' }));
        return;
      }
      const hashedPassword = await hashPassword(password);
      await db.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword }
      });
      await db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      });
      res.status(200).send(JSON.stringify({ message: 'Password berhasil direset' }));
      return;
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
      return;
    }
  }

  res.status(404).send(JSON.stringify({ error: 'Not found', url, method }));
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).send(JSON.stringify({ message: 'Internal server error', error: String(err) }));
  }
}