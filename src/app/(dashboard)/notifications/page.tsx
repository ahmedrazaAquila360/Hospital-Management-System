import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { getNotificationCounts, listNotificationsPage } from "@/server/notifications/queries";
import { NotificationCenter, type NotificationItem, type NotificationTab } from "@/components/notifications/notification-center";
import { ListFooter } from "@/components/shared/list-footer";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications";
import { DEFAULT_PAGE_SIZE, parsePage, parsePageSize } from "@/lib/pagination";
import { formatDateTime, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

type SearchParams = Promise<{ category?: string; page?: string; perPage?: string }>;

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const pageSize = parsePageSize(params.perPage);
  const counts = await getNotificationCounts(user.id);

  const category = NOTIFICATION_CATEGORIES.find((c) => c.value === params.category);
  const unreadOnly = params.category === "unread";
  const active = category?.value ?? (unreadOnly ? "unread" : "all");

  const list = await listNotificationsPage({
    userId: user.id,
    types: category?.types,
    unreadOnly,
    page: parsePage(params.page),
    pageSize,
  });

  const items: NotificationItem[] = list.notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    timeLabel: formatRelative(n.createdAt),
    fullTime: formatDateTime(n.createdAt),
  }));

  const href = (value: string) => {
    const sp = new URLSearchParams();
    if (value !== "all") sp.set("category", value);
    if (pageSize !== DEFAULT_PAGE_SIZE) sp.set("perPage", String(pageSize));
    const qs = sp.toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  };
  // All and Unread always; a category tab only when the user has notifications of that kind.
  const tabs: NotificationTab[] = [
    { value: "all", label: "All", count: counts.total },
    { value: "unread", label: "Unread", count: counts.unread },
    ...NOTIFICATION_CATEGORIES.map((c) => ({
      value: c.value,
      label: c.label,
      count: c.types.reduce((sum, t) => sum + (counts.byType[t] ?? 0), 0),
    })).filter((t) => t.count > 0 || t.value === active),
  ].map((t) => ({ ...t, href: href(t.value), active: t.value === active }));

  const emptyLabel =
    counts.total === 0
      ? { title: "No notifications yet", description: "Appointment, payment and patient updates will appear here." }
      : unreadOnly
        ? { title: "No unread notifications", description: "You're all caught up." }
        : { title: "Nothing here", description: "There are no notifications in this category." };

  return (
    <NotificationCenter
      // Remount on a new page of results so optimistic "read" marks never carry over.
      key={`${active}-${list.page}-${pageSize}`}
      items={items}
      unreadCount={counts.unread}
      tabs={tabs}
      emptyLabel={emptyLabel}
      footer={<ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} noun="notification" />}
    />
  );
}
