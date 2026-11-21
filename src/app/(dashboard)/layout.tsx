import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guard";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";

export const metadata = { title: { default: "Hospital Hub", template: "%s · Hospital Hub" } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <Topbar user={user} />
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
