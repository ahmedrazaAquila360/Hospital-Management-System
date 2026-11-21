"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@/generated/prisma/client";

export type NotificationsResponse = { notifications: Notification[]; unreadCount: number };

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

/** Latest notifications + unread count for the navbar bell and the sidebar badge (one shared query). */
export function useNotificationsQuery() {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async (): Promise<NotificationsResponse> => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Failed to load notifications");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

/** Re-fetches the bell/sidebar counts, e.g. after the Notifications page marks something read. */
export function useRefreshNotificationBadge() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
}

/** Marks one notification (or, without an id, all of them) read through the existing API. */
export async function markNotificationsRead(id?: string) {
  const res = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(id ? { id } : {}),
  });
  if (!res.ok) throw new Error("Couldn't update notifications");
}
