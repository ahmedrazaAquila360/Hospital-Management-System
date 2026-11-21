"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type WheelEvent } from "react";
import { ChevronRight, Hospital } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/brand/brand-logo";
import { NAV_ITEMS } from "@/lib/nav";
import { can, type SessionUser } from "@/lib/permissions";
import { initialsFromName } from "@/lib/format";
import { useNotificationsQuery } from "@/hooks/use-notifications";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const MENU_BUTTON =
  "h-10 gap-3 rounded-xl px-3 text-[13.5px] font-medium text-sidebar-foreground transition-[background-color,color,box-shadow,width,height,padding] duration-200 hover:bg-white/[0.07] hover:text-white data-active:bg-linear-to-r data-active:from-[#1288d6] data-active:to-[#0b5fae] data-active:text-white data-active:shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_10px_22px_-12px_rgb(33_188_232/0.9)] data-open:hover:bg-white/[0.07] [&_svg]:size-[18px]";

export function AppSidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  // Children carry their own permission; a group without visible children is hidden.
  const items = NAV_ITEMS.filter((item) => !item.permission || can(user, item.permission))
    .map((item) => (item.children ? { ...item, children: item.children.filter((c) => !c.permission || can(user, c.permission)) } : item))
    .filter((item) => !item.children || item.children.length > 0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Some layouts (fixed-position sidebar + a taller scrolling main column) let
  // wheel input over the sidebar fall through to the page instead of scrolling
  // the sidebar's own nav list. Capture it here and drive scrollTop directly,
  // but only while this list actually has room to move — otherwise let the
  // event bubble normally so the page can still scroll at the list's edges.
  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || el.scrollHeight <= el.clientHeight) return;
    const atTop = el.scrollTop <= 0 && event.deltaY < 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight && event.deltaY > 0;
    if (atTop || atBottom) return;
    event.preventDefault();
    el.scrollTop += event.deltaY;
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 pt-4 pb-2 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-white/[0.06]">
              <Link href="/dashboard">
                <BrandLogo name="Hospital Hub" tone="dark" subtitle="Hospital operations" markClassName="size-8!" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent ref={scrollRef} onWheel={handleWheel} className="sidebar-scroll relative">
        <SidebarGroup className="px-3 group-data-[collapsible=icon]:px-2">
          <SidebarGroupLabel className="text-[10.5px] font-semibold tracking-[0.14em] text-sidebar-foreground/55 uppercase">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                // A group is active when one of its pages is open (Patients → a patient's profile too).
                const active = item.children ? item.children.some((c) => isActive(pathname, c.href)) : isActive(pathname, item.href);

                if (!item.children) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title} className={MENU_BUTTON}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.href === "/notifications" && <UnreadBadge />}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <Collapsible key={item.href} defaultOpen={active} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={active} tooltip={item.title} className={MENU_BUTTON}>
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto size-4! opacity-70 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1 overflow-hidden">
                        <SidebarMenuSub className="mx-5 mt-1 border-white/10 py-1">
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={item.children!.filter((c) => isActive(pathname, c.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href === child.href}
                                className="h-8 rounded-lg px-2.5 text-[13px] text-sidebar-foreground hover:bg-white/[0.07] hover:text-white data-active:bg-white/10 data-active:font-medium data-active:text-white [&>svg]:text-sidebar-foreground/80 data-active:[&>svg]:text-cyan"
                              >
                                <Link href={child.href}>
                                  <child.icon />
                                  <span>{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="relative px-3 pb-4 group-data-[collapsible=icon]:px-2">
        <Hospital aria-hidden
          className="pointer-events-none absolute -top-28 -left-8 size-40 opacity-[0.12] group-data-[collapsible=icon]:hidden"
        />
        <Link
          href="/settings"
          className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-2.5 transition-colors hover:bg-white/[0.09] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
        >
          <Avatar className="size-9 shrink-0 ring-2 ring-white/15 group-data-[collapsible=icon]:size-8">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-linear-to-br from-[#4fd0f3] to-[#0b5fae] text-xs font-semibold text-white">
              {initialsFromName(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium text-white">{user.name}</span>
            <span className="truncate text-xs text-sidebar-foreground/75">{user.role.label}</span>
          </span>
        </Link>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** Unread count on the Notifications item; shares the bell's query, so both update together. */
function UnreadBadge() {
  const { data } = useNotificationsQuery();
  const count = data?.unreadCount ?? 0;
  if (!count) return null;
  return (
    <SidebarMenuBadge className="bg-destructive top-1/2! right-2.5 h-5 min-w-5 -translate-y-1/2 rounded-full px-1.5 text-[10px] font-semibold text-white!">
      <span className="sr-only">Unread notifications: </span>
      {count > 9 ? "9+" : count}
    </SidebarMenuBadge>
  );
}
