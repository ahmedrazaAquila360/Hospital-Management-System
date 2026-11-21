"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Check,
  CheckCheck,
  CircleCheck,
  CircleDollarSign,
  Loader2,
  Stethoscope,
  TriangleAlert,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/shared/page-header";
import { markNotificationsRead, useRefreshNotificationBadge } from "@/hooks/use-notifications";
import { categoryOf } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/generated/prisma/enums";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  /** Formatted on the server, so the client never re-renders a different "x minutes ago". */
  timeLabel: string;
  fullTime: string;
};

export type NotificationTab = { value: string; label: string; count: number; href: string; active: boolean };

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  APPOINTMENT_NEW: CalendarCheck,
  APPOINTMENT_CANCELLED: CalendarX,
  APPOINTMENT_REMINDER: CalendarClock,
  PAYMENT_RECEIVED: CircleDollarSign,
  PAYMENT_OUTSTANDING: TriangleAlert,
  PATIENT_NEW: UserRoundPlus,
  TREATMENT_COMPLETED: Stethoscope,
  SYSTEM: Bell,
};

const CATEGORY_TILE: Record<string, string> = {
  appointments: "bg-pale text-brand",
  payments: "bg-emerald-50 text-emerald-700",
  patients: "bg-violet-50 text-violet-700",
  treatments: "bg-teal-50 text-teal-700",
  system: "bg-slate-100 text-slate-600",
};

/**
 * Notifications page body. Read state changes optimistically (the row turns "read" at once),
 * goes through the existing PATCH /api/notifications endpoint, then refreshes the navbar bell,
 * the sidebar badge and this page. A failed request puts the row back and shows an error.
 */
export function NotificationCenter({
  items,
  unreadCount,
  tabs,
  emptyLabel,
  footer,
}: {
  items: NotificationItem[];
  unreadCount: number;
  tabs: NotificationTab[];
  emptyLabel: { title: string; description: string };
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const refreshBadge = useRefreshNotificationBadge();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [allRead, setAllRead] = useState(false);
  const [isMarkingAll, startMarkAll] = useTransition();
  const [, startTransition] = useTransition();

  const isRead = (n: NotificationItem) => allRead || n.isRead || readIds.has(n.id);
  const locallyRead = items.filter((n) => !n.isRead && readIds.has(n.id)).length;
  const unread = allRead ? 0 : Math.max(0, unreadCount - locallyRead);

  function sync() {
    refreshBadge();
    router.refresh();
  }

  function markRead(id: string) {
    setReadIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        await markNotificationsRead(id);
        sync();
      } catch {
        setReadIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.error("Couldn't mark the notification as read.");
      }
    });
  }

  function markAll() {
    setAllRead(true);
    startMarkAll(async () => {
      try {
        await markNotificationsRead();
        toast.success("All notifications marked as read.");
        sync();
      } catch {
        setAllRead(false);
        toast.error("Couldn't mark notifications as read.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Bell />}
        title="Notifications"
        description={
          unread > 0 ? (
            <>
              <span className="text-navy font-semibold tabular-nums">{unread}</span> unread notification{unread === 1 ? "" : "s"}
            </>
          ) : (
            "You're all caught up."
          )
        }
        actions={
          <Button variant="outline" size="lg" onClick={markAll} disabled={unread === 0 || isMarkingAll} className="rounded-full px-5">
            {isMarkingAll ? <Loader2 className="animate-spin" /> : <CheckCheck />} Mark all as read
          </Button>
        }
      />

      <nav aria-label="Notification categories" className="bg-muted/70 flex max-w-full gap-1 self-start overflow-x-auto rounded-2xl p-1">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.href}
            scroll={false}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium whitespace-nowrap transition-colors",
              t.active ? "text-navy bg-white shadow-sm ring-1 ring-[#cfe3f2]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                t.active ? "bg-brand text-white" : "bg-white/80 text-muted-foreground"
              )}
            >
              {t.count}
            </span>
          </Link>
        ))}
      </nav>

      <section className="surface-card overflow-hidden p-0">
        {items.length === 0 ? (
          <Empty className="w-auto border-border/70 m-4 rounded-2xl border border-dashed py-14 sm:m-5">
            <EmptyMedia variant="icon">
              <BellOff />
            </EmptyMedia>
            <EmptyTitle>{emptyLabel.title}</EmptyTitle>
            <EmptyDescription>{emptyLabel.description}</EmptyDescription>
          </Empty>
        ) : (
          <ul className="divide-border/60 divide-y">
            {items.map((n) => {
              const read = isRead(n);
              const Icon = TYPE_ICON[n.type] ?? Bell;
              const body = (
                <>
                  <p className={cn("text-navy text-[0.95rem] leading-snug", read ? "font-medium" : "font-semibold")}>{n.title}</p>
                  <p className="text-foreground/75 mt-0.5 text-sm leading-relaxed">{n.message}</p>
                  <p className="text-muted-foreground mt-1 text-xs" title={n.fullTime}>
                    {n.timeLabel}
                  </p>
                </>
              );
              return (
                <li
                  key={n.id}
                  className={cn(
                    "group relative flex items-start gap-3 px-4 py-4 transition-colors sm:gap-4 sm:px-6",
                    read ? "hover:bg-pale/30" : "bg-pale/60 hover:bg-pale/80"
                  )}
                >
                  {!read && <span aria-hidden className="bg-brand absolute inset-y-2 left-0 w-1 rounded-r-full" />}
                  <span
                    className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", CATEGORY_TILE[categoryOf(n.type)])}
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => !read && markRead(n.id)}
                        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 self-center">
                    {read ? (
                      <span className="bg-success/10 text-success hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex">
                        <CircleCheck className="size-3.5" aria-hidden /> Read
                      </span>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => markRead(n.id)} className="rounded-lg" aria-label={`Mark "${n.title}" as read`}>
                          <Check /> <span className="hidden sm:inline">Mark as read</span>
                        </Button>
                        <span className="bg-brand size-2.5 rounded-full ring-4 ring-[#d9eefa]" aria-label="Unread" />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {footer}
      </section>
    </div>
  );
}
