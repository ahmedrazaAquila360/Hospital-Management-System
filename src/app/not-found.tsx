import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="bg-pale text-brand flex size-16 items-center justify-center rounded-3xl ring-8 ring-pale/50">
        <FileQuestion className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-navy text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground text-sm">The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
