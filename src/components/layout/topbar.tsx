"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { NAV_ITEMS } from "@/lib/nav";
import type { SessionUser } from "@/lib/permissions";

function currentTitle(pathname: string) {
  const match = NAV_ITEMS.flatMap((item) => [item, ...(item.children ?? [])])
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.title ?? "Hospital Hub";
}

/** The top-level section a page belongs to, when the page itself is one of its sub-pages. */
function parentSection(title: string) {
  const parent = NAV_ITEMS.find((item) => item.children?.some((child) => child.title === title));
  return parent && parent.title !== title ? parent.title : null;
}

export function Topbar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const title = currentTitle(pathname);
  const section = parentSection(title);

  // contain inline-size on <header>: a long page title (Appointments, Prescriptions…) otherwise
  // sets a minimum width that pushes the whole page into sideways scrolling on tablets.
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-white/80 px-4 backdrop-blur-md [contain:inline-size] sm:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-navy -ml-1 size-9 rounded-xl" />
      <div className="bg-border hidden h-6 w-px sm:block" aria-hidden />
      <div className="min-w-0">
        <p className="text-muted-foreground hidden items-center gap-1 text-[11px] font-medium sm:flex">
          Hospital Hub
          {section && (
            <>
              <ChevronRight className="size-3" aria-hidden />
              {section}
            </>
          )}
        </p>
        <h1 className="font-heading text-navy truncate text-base leading-tight font-semibold tracking-tight sm:text-lg">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <GlobalSearch />
        <NotificationBell />
        <div className="bg-border hidden h-8 w-px md:block" aria-hidden />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
