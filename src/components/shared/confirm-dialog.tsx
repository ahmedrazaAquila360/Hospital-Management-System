"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** destructive: red button and icon (delete, discard); warning: amber (reset). */
  tone?: "default" | "warning" | "destructive";
  icon?: LucideIcon;
};

const TONE = {
  default: { tile: "bg-pale text-brand", button: "" },
  warning: { tile: "bg-amber-50 text-amber-600", button: "" },
  destructive: { tile: "bg-destructive/10 text-destructive", button: "bg-destructive bg-none text-white hover:bg-destructive/90" },
} as const;

/**
 * Styled replacement for window.confirm: `const ok = await confirm({...})`. Render `dialog`
 * once in the component. Esc, the overlay and Cancel all resolve to false.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  }

  const tone = TONE[options?.tone ?? "default"];
  const Icon = options?.icon ?? (options?.tone === "destructive" ? Trash2 : options?.tone === "warning" ? RotateCcw : AlertTriangle);

  const dialog = (
    <AlertDialog open={open} onOpenChange={(o) => !o && settle(false)}>
      <AlertDialogContent className="sm:max-w-md!">
        <AlertDialogHeader className="sm:grid-cols-[auto_1fr] sm:items-start sm:gap-x-4">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl sm:row-span-2", tone.tile)} aria-hidden>
            <Icon className="size-5" />
          </span>
          <AlertDialogTitle className="text-navy text-lg font-semibold sm:col-start-2">{options?.title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed sm:col-start-2">{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {options?.cancelLabel ?? "Cancel"}
          </Button>
          <Button className={tone.button} onClick={() => settle(true)} autoFocus>
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
