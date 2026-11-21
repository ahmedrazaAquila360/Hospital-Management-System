import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="bg-pale text-brand flex size-16 items-center justify-center rounded-3xl ring-8 ring-pale/50">
        <SearchX className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-navy text-2xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          The record or page you&apos;re looking for doesn&apos;t exist, or may have been removed.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
