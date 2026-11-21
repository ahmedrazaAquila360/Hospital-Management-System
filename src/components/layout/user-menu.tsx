"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, ChevronDown, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/auth/actions";
import type { SessionUser } from "@/lib/permissions";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function UserAvatar({ user, className }: { user: SessionUser; className?: string }) {
  return (
    <Avatar className={cn("ring-2 ring-white shadow-sm dark:ring-white/10", className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
      <AvatarFallback className="bg-linear-to-br from-[#4fd0f3] to-[#0b5fae] text-xs font-semibold text-white">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Icon tile + title + one-line hint, shared by every row in the menu. */
function MenuRow({
  icon,
  title,
  hint,
  destructive = false,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  destructive?: boolean;
}) {
  return (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          destructive
            ? "bg-destructive/10"
            : "bg-muted text-muted-foreground group-focus/dropdown-menu-item:bg-white dark:group-focus/dropdown-menu-item:bg-white/10"
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-sm font-medium">{title}</span>
        {hint && <span className="truncate text-xs opacity-65">{hint}</span>}
      </span>
    </>
  );
}

const rowClass = "gap-3 rounded-lg px-2 py-1.5";

export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="group ring-offset-background focus-visible:ring-ring hover:bg-pale/70 data-[state=open]:bg-pale/70 flex cursor-pointer items-center gap-2.5 rounded-xl p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 md:pr-2"
        >
          <UserAvatar user={user} className="size-9" />
          <span className="hidden min-w-0 text-left leading-tight md:grid">
            <span className="text-navy max-w-36 truncate text-sm font-semibold">{user.name}</span>
            <span className="text-muted-foreground max-w-36 truncate text-xs">{user.role.label}</span>
          </span>
          <ChevronDown className="text-muted-foreground hidden size-4 transition-transform duration-200 group-data-[state=open]:rotate-180 md:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-72 rounded-2xl p-0">
        <DropdownMenuLabel className="from-pale/80 to-popover border-border/70 border-b bg-linear-to-b px-4 py-3.5 font-normal">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} className="size-11" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-navy truncate text-sm font-semibold">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">{user.email}</span>
            </div>
          </div>
          <span className="bg-primary/10 text-primary mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
            <ShieldCheck className="size-3" aria-hidden />
            {user.role.label}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem asChild className={rowClass}>
            <Link href="/settings">
              <MenuRow icon={<UserCog />} title="Account settings" hint="Profile, password and preferences" />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={rowClass}>
            <Link href="/notifications">
              <MenuRow icon={<Bell />} title="Notifications" hint="Alerts and recent activity" />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-0" />

        <form action={logoutAction} className="p-1.5">
          <DropdownMenuItem asChild variant="destructive" className={rowClass}>
            <button type="submit" className="w-full cursor-pointer text-left">
              <MenuRow icon={<LogOut />} title="Sign out" destructive />
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
