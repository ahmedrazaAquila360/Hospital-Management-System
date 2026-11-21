"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RotateCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Debounced search box that writes `param` to the URL (and drops `page`), so the server
 * re-renders the list. Optional Refresh button re-fetches without changing the URL.
 */
export function ListSearch({
  placeholder,
  param = "q",
  showRefresh = false,
  className,
}: {
  placeholder: string;
  param?: string;
  showRefresh?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Follow URL changes made elsewhere (Reset, Back) without fighting our own debounced writes.
  const [seenUrl, setSeenUrl] = useState(urlValue);
  const [pushed, setPushed] = useState(urlValue);
  if (urlValue !== seenUrl) {
    setSeenUrl(urlValue);
    if (urlValue !== pushed) {
      setValue(urlValue);
      setPushed(urlValue);
    }
  }

  function apply(next: string) {
    setPushed(next.trim());
    const params = new URLSearchParams(window.location.search);
    if (next.trim()) params.set(param, next.trim());
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply(next), 300);
  }

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <div className="relative min-w-0 flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 rounded-xl pr-16 pl-10 [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {isPending && <Loader2 className="text-brand size-4 animate-spin" aria-label="Searching" />}
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-muted-foreground hover:text-foreground flex size-7 cursor-pointer items-center justify-center rounded-md"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
      {showRefresh && (
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl"
          onClick={() => startTransition(() => router.refresh())}
          disabled={isPending}
        >
          <RotateCw className={cn(isPending && "animate-spin")} /> <span className="hidden sm:inline">Refresh</span>
        </Button>
      )}
    </div>
  );
}
