import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
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
    
    const isValid = await bcrypt.compare(input.password, user.password);
    
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
}

export const authService = new AuthService();
