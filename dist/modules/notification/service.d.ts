import type { CreateNotificationInput } from './schemas.js';
export declare class NotificationService {
    getAll(userId: string): Promise<{
        message: string;
        type: import("@prisma/client").$Enums.NotificationType;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        isRead: boolean;
    }[]>;
    getUnread(userId: string): Promise<{
        message: string;
        type: import("@prisma/client").$Enums.NotificationType;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        isRead: boolean;
    }[]>;
    getById(id: string, userId: string): Promise<{
        message: string;
        type: import("@prisma/client").$Enums.NotificationType;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        isRead: boolean;
    }>;
    create(userId: string, input: CreateNotificationInput): Promise<{
        message: string;
        type: import("@prisma/client").$Enums.NotificationType;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        isRead: boolean;
    }>;
    markAsRead(id: string, userId: string): Promise<{
        message: string;
        type: import("@prisma/client").$Enums.NotificationType;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        isRead: boolean;
    }>;
    markAllAsRead(userId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    delete(id: string, userId: string): Promise<void>;
    getUnreadCount(userId: string): Promise<{
        count: number;
    }>;
    createBudgetWarning(userId: string, categoryName: string, percentage: number): Promise<{
        message: string;
        type: import("@prisma/client").$Enums.NotificationType;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        isRead: boolean;
    }>;
    createGoalMilestone(userId: string, goalName: string, percentage: number): Promise<{
        message: string;
        type: import("@prisma/client").$Enums.NotificationType;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        isRead: boolean;
    }>;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=service.d.ts.map