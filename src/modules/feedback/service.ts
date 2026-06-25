import { prisma } from '../../config/prisma.js';
import type { CreateFeedbackInput, UpdateFeedbackStatusInput } from './schemas.js';
import { notificationService } from '../notification/service.js';

export class FeedbackService {
  async create(userId: string, input: CreateFeedbackInput) {
    const feedback = await prisma.feedback.create({
      data: {
        userId,
        type: input.type,
        subject: input.subject,
        description: input.description,
        screenshot: input.screenshot,
      },
    });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    const submitter = await prisma.user.findUnique({ where: { id: userId } });

    await Promise.all(admins.map(admin =>
      notificationService.create(admin.id, {
        type: 'SYSTEM',
        title: 'Feedback Baru',
        message: `Feedback baru dari ${submitter?.name || 'User'}: ${input.subject}`,
      })
    ));

    return feedback;
  }

  async getUserFeedback(userId: string) {
    return prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllFeedback() {
    const feedback = await prisma.feedback.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      total: feedback.length,
      open: feedback.filter(f => f.status === 'OPEN').length,
      inProgress: feedback.filter(f => f.status === 'IN_PROGRESS').length,
      resolved: feedback.filter(f => f.status === 'RESOLVED').length,
    };

    return { feedback, stats };
  }

  async updateStatus(id: string, input: UpdateFeedbackStatusInput) {
    return prisma.feedback.update({
      where: { id },
      data: {
        status: input.status,
        adminNote: input.adminNote,
      },
    });
  }
}

export const feedbackService = new FeedbackService();
