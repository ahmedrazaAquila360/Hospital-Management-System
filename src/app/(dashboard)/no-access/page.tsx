import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { Button } from "@/components/ui/button";
import { RefreshOnMount } from "@/components/shared/refresh-on-mount";
import { PERMISSION_CATALOG, can } from "@/lib/permissions";

export const metadata: Metadata = { title: "No Access" };

/** Where requirePermission sends a signed-in user who lacks a page's permission. */
export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ permission?: string }> }) {
  const [user, { permission }] = await Promise.all([requireUser(), searchParams]);
  const [module, action] = (permission ?? "").split(".");
  const mod = PERMISSION_CATALOG.find((m) => m.module === module);
  const act = mod?.actions.find((a) => a.action === action);
  const what = mod && act ? `${act.label} ${mod.label}` : null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <RefreshOnMount />
      <div className="surface-card flex max-w-lg flex-col items-center gap-4 p-8 text-center sm:p-10">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600" aria-hidden>
          <ShieldAlert className="size-8" />
        </span>
        <h2 className="font-heading text-navy text-2xl font-semibold">You don&apos;t have access to this page</h2>
        <p className="text-muted-foreground leading-relaxed">
          {what ? (
            <>
              Your account ({user.role.label}) doesn&apos;t have the <strong className="text-foreground/85">{what}</strong> permission.
            </>
          ) : (
            <>Your account ({user.role.label}) doesn&apos;t have permission to open that page.</>
          )}{" "}
          Ask a Super Admin to grant it on the Permissions page.
        </p>
        {can(user, "dashboard.view") && (
          <Button asChild size="lg" className="mt-2 rounded-xl">
            <Link href="/dashboard">
              <LayoutDashboard /> Back to Dashboard
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
