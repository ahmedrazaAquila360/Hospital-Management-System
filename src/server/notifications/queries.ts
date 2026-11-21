import "server-only";
import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";

export async function listNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** One page of the user's notifications, optionally limited to some types or to unread ones. */
export async function listNotificationsPage({
  userId,
  types,
  unreadOnly = false,
  page = 1,
  pageSize = 10,
}: {
  userId: string;
  types?: readonly NotificationType[];
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const where = {
    userId,
    ...(types ? { type: { in: [...types] } } : {}),
    ...(unreadOnly ? { isRead: false } : {}),
  };
  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { notifications, total, page, pageSize };
}

/** Read-only totals for the filter tabs: all, unread and per type. */
export async function getNotificationCounts(userId: string) {
  const [total, unread, byType] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.notification.groupBy({ by: ["type"], where: { userId }, _count: { _all: true } }),
  ]);
  return { total, unread, byType: Object.fromEntries(byType.map((t) => [t.type, t._count._all])) as Partial<Record<NotificationType, number>> };
}
