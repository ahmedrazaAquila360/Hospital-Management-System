import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/shared/back-link";

/** Standard heading row for workspace pages: title, supporting line and page-level actions. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  icon,
  back,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Optional lucide icon shown in a tinted tile before the title. */
  icon?: ReactNode;
  /** Sub pages (add, edit, detail): a "← Back to …" link to the parent page. */
  back?: { href: string; label: string };
  className?: string;
}) {
  const row = (
    <div className={cn("animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", !back && className)}>
      <div className="flex min-w-0 items-center gap-4">
        {icon && (
          <span
            className="bg-pale text-brand ring-brand/10 flex size-13 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 [&_svg]:size-6"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="text-brand text-[11px] font-semibold tracking-[0.14em] uppercase">{eyebrow}</p>}
          <h2 className="font-heading text-navy text-2xl leading-tight font-semibold tracking-tight sm:text-[1.7rem]">
            {title}
          </h2>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
  if (!back) return row;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <BackLink href={back.href} label={back.label} />
      {row}
    </div>
  );
}
