"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { markNotificationsRead, useNotificationsQuery, useRefreshNotificationBadge } from "@/hooks/use-notifications";

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useNotificationsQuery();
  const refreshBadge = useRefreshNotificationBadge();
  const unreadCount = data?.unreadCount ?? 0;

  // Keep the Notifications page in step when it is the page underneath the bell.
  function afterChange() {
    refreshBadge();
    if (pathname === "/notifications") router.refresh();
  }

  async function markAllRead() {
    await markNotificationsRead().catch(() => undefined);
    afterChange();
  }

  /** Opening an unread notification marks it read. */
  function openNotification(id: string, isRead: boolean) {
    if (!isRead) markNotificationsRead(id).then(afterChange, () => undefined);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="text-muted-foreground relative size-10 rounded-xl"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <Badge className="bg-destructive absolute -top-1.5 -right-1.5 h-5 min-w-5 justify-center rounded-full border-2 border-white px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-heading text-navy text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-primary text-xs font-medium hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <Separator />
        <div className="max-h-80 overflow-y-auto">
          {!data?.notifications.length && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">You&apos;re all caught up.</p>
          )}
          {data?.notifications.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "/notifications"}
              onClick={() => openNotification(n.id, n.isRead)}
              className="hover:bg-pale/70 flex flex-col gap-0.5 border-b border-border/70 px-4 py-3 text-sm transition-colors last:border-0"
            >
              <span className="flex items-center gap-2 font-medium">
                {!n.isRead && <span className="bg-cyan size-2 shrink-0 rounded-full ring-2 ring-cyan/20" />}
                {n.title}
              </span>
              <span className="text-muted-foreground text-xs">{n.message}</span>
              <span className="text-muted-foreground text-[11px]">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </span>
            </Link>
          ))}
        </div>
        <Separator />
        <Link
          href="/notifications"
          className="text-primary hover:bg-pale/60 block px-4 py-3 text-center text-xs font-semibold transition-colors"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
