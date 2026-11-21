import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PanelCard({
  title,
  viewAllHref,
  children,
  className,
  contentClassName,
}: {
  title: string;
  viewAllHref?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[15px]">{title}</CardTitle>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-primary group/link hover:bg-pale inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
          >
            View all
            <ArrowRight className="size-3.5 transition-transform group-hover/link:translate-x-0.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className={cn("space-y-1", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
