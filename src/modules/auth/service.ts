import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../utils/email.service.js';
import type { RegisterInput, LoginInput } from './schemas.js';

export class AuthService {
  async register(input: RegisterInput & { trial?: boolean }) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    
    if (existing) {
      throw new Error('Email already registered');
    }
    
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    const now = new Date();
    const trialEndsAt = input.trial 
      ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      : null;
    
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: hashedPassword,
        subscriptionTier: input.trial ? 'TRIAL' : 'FREE',
        trialStartedAt: input.trial ? now : null,
        trialEndsAt: trialEndsAt,
        emailVerifiedAt: null,
        emailVerificationToken: hashedToken,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        subscriptionTier: true,
        trialStartedAt: true,
        trialEndsAt: true,
        subscriptionStartAt: true,
        subscriptionEndAt: true,
      },
    });

    const verifyUrl = `${config.frontendUrl}/auth/verify-email?token=${verificationToken}`;
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
    });
    
    return user;
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    
    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }
    
    const isBcrypt = user.password?.startsWith('$2');
    let isValid = false;
    
    if (isBcrypt) {
      isValid = await bcrypt.compare(input.password, user.password);
    } else if (user.password) {
      const crypto = await import('crypto');
      const [salt, hash] = user.password.split(':');
      const newHash = crypto.createHash('sha256').update(salt + input.password).digest('hex');
      isValid = hash === newHash;
    }
    
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    if (!user.emailVerifiedAt) {
      throw new Error('Email belum diverifikasi. Silakan cek inbox email Anda.');
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    };
  }

  async verifyEmail(token: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: hashedToken,
      },
    });

    if (!user) {
      throw new Error('Token tidak valid atau sudah kedaluwarsa.');
    }

    const tokenAge = Date.now() - user.updatedAt.getTime();
    const tokenExpiry = 24 * 60 * 60 * 1000;

    if (tokenAge > tokenExpiry) {
      throw new Error('Token tidak valid atau sudah kedaluwarsa.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      },
    });

    return { message: 'Email berhasil diverifikasi' };
  }

  async resendVerification(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'Link verifikasi sudah dikirim ke email Anda.' };
    }

    if (user.emailVerifiedAt) {
      return { message: 'Link verifikasi sudah dikirim ke email Anda.' };
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(newToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: hashedToken },
    });

    const verifyUrl = `${config.frontendUrl}/auth/verify-email?token=${newToken}`;
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
    });

    return { message: 'Link verifikasi sudah dikirim ke email Anda.' };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        subscriptionTier: true,
        trialStartedAt: true,
        trialEndsAt: true,
        subscriptionStartAt: true,
        subscriptionEndAt: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user || !user.password) {
      throw new Error('Password not set. Please use login method.');
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new Error('Password saat ini salah');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Password berhasil diperbarui' };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'Jika email tersebut terdaftar, kami akan mengirim link reset password' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    return { message: 'Jika email tersebut terdaftar, kami akan mengirim link reset password' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    });

    if (!resetToken) {
      throw new Error('Token tidak valid');
    }

    if (resetToken.used) {
      throw new Error('Token sudah digunakan');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new Error('Token sudah kedaluwarsa');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    return { message: 'Password berhasil direset' };
  }

  async cleanupExpiredTokens() {
    const result = await prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { deleted: result.count };
  }
}

export const authService = new AuthService();
