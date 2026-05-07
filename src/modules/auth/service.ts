import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { sendPasswordResetEmail } from '../../utils/email.service.js';
import type { RegisterInput, LoginInput } from './schemas.js';

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    
    if (existing) {
      throw new Error('Email already registered');
    }
    
    const hashedPassword = await bcrypt.hash(input.password, 10);
    
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
      },
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
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    };
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
        preferences: true,
        createdAt: true,
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
