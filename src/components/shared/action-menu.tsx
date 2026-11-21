import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Content class for row-action menus: roomy white card, matching the reference design. */
export const ACTION_MENU_CONTENT = "w-64 rounded-2xl p-2";

const TONE: Record<"default" | "success" | "destructive", { icon: string; text: string }> = {
  default: { icon: "text-navy! group-focus/dropdown-menu-item:text-brand!", text: "text-navy" },
  success: { icon: "text-emerald-600!", text: "text-navy" },
  destructive: { icon: "text-destructive!", text: "text-destructive" },
};

/** One row of a row-action menu: an outline icon and a label. */
export function ActionMenuItemBody({
  icon: Icon,
  title,
  tone = "default",
}: {
  icon: LucideIcon | ((props: { className?: string }) => ReactNode);
  title: string;
  tone?: "default" | "success" | "destructive";
}) {
  return (
    <>
      <Icon className={cn("size-[1.15rem]! shrink-0", TONE[tone].icon)} aria-hidden />
      <span className={cn("truncate text-[0.95rem] font-medium", TONE[tone].text)}>{title}</span>
    </>
  );
}

/** Classes for a row-action menu item (taller rows, red tint for destructive ones). */
export const ACTION_MENU_ITEM = "min-h-10 gap-3.5 rounded-xl px-3 py-2.5 data-[variant=destructive]:focus:bg-destructive/8";

/** The ⋯ trigger: a soft square button that shows its open state. */
export const ActionMenuTrigger = forwardRef<HTMLButtonElement, React.ComponentProps<"button"> & { label: string; busy?: ReactNode }>(
  function ActionMenuTrigger({ label, busy, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          "text-navy hover:bg-pale data-[state=open]:bg-pale data-[state=open]:text-brand inline-flex size-9 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50",
          className
        )}
        {...props}
      >
        {busy ?? <MoreHorizontal className="size-[1.15rem]" />}
      </button>
    );
  }
);
