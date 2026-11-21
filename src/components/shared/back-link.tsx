import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** "← Back to …" link shown above the header of every sub page (add, edit, detail). */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group text-muted-foreground hover:text-navy focus-visible:ring-ring/60 inline-flex w-fit items-center gap-2 rounded-full py-1 pr-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
        className
      )}
    >
      <span className="border-border/80 group-hover:border-brand/40 group-hover:bg-pale group-hover:text-brand flex size-8 items-center justify-center rounded-full border bg-white shadow-xs transition-colors">
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
      </span>
      {label}
    </Link>
  );
}
