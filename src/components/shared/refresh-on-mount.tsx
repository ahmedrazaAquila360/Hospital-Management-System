"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the whole page tree once. Next keeps the shared dashboard layout between
 * navigations, so after someone's permissions change the sidebar can still show links they
 * can no longer open; landing here redraws it with their current permissions.
 */
export function RefreshOnMount() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);
  return null;
}
