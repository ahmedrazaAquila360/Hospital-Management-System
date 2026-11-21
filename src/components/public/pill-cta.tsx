import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The brand's primary call to action: a bright-blue → navy pill with the icon
 * set in its own lighter disc (the "Schedule a visit" button).
 */
export function PillCta({
  href,
  children,
  icon,
  size = "md",
  className,
  ...props
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  size?: "md" | "lg";
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={cn(
        "group bg-brand-gradient focus-visible:ring-cyan/40 relative inline-flex items-center rounded-full font-semibold whitespace-nowrap text-white shadow-glow transition-[box-shadow,transform] duration-300 outline-none hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgb(8_127_196/0.7)] focus-visible:ring-4 active:translate-y-0",
        size === "lg" ? "gap-3.5 py-2 pr-7 pl-2 text-base" : "gap-3 py-1.5 pr-5 pl-1.5 text-sm",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/25 transition-transform duration-300 group-hover:rotate-[-8deg]",
          size === "lg" ? "size-11" : "size-9"
        )}
      >
        {icon ?? <CalendarDays className={size === "lg" ? "size-5" : "size-4"} />}
      </span>
      {children}
    </Link>
  );
}
