"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
    type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { submitWithoutReset } from "@/lib/form-submit";
import { IMAGE_ACCEPT, IMAGE_HINT, imageFileError } from "@/lib/image-upload";

export { IconInput } from "@/components/shared/icon-input";
import type { SettingsFormState } from "@/server/settings/actions";

type SettingsAction = (prev: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;


/**
 * Submits a settings form through its server action without React 19's automatic form
 * reset (see `submitWithoutReset`). The form is reset only after a successful save, to
 * the freshly revalidated values, and `dirty` drives Cancel and the unsaved-changes hint.
 */
export function useSettingsForm(action: SettingsAction, successMessage: string) {
  const [state, formAction, pending] = useActionState(action, {});
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state.success) {
        toast.success(successMessage);
        formRef.current?.reset();
      } else if (state.error) {
        toast.error(state.error);
      }
    }
    wasPending.current = pending;
  }, [pending, state, successMessage]);

  return {
    pending,
    dirty,
    markDirty: () => setDirty(true),
    formProps: {
      ref: formRef,
      // `action` keeps pre-hydration submits on the server action (never a GET with the
      // fields in the URL); onSubmit runs it without React's post-action reset.
      action: formAction,
      onSubmit: submitWithoutReset(formAction),
      onChange(event: FormEvent<HTMLFormElement>) {
        // Radix Select keeps a hidden native <select> in sync and fires a change on it
        // (also when Cancel resets it), so selects report edits via markDirty() instead.
        if ((event.target as HTMLElement).getAttribute?.("aria-hidden") === "true") return;
        setDirty(true);
      },
      onReset: () => setDirty(false),
    },
  };
}

/** The white card that holds one settings section, with a title row. */
export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="px-5 pt-5 pb-1 sm:px-7 sm:pt-6">
        <h3 className="font-heading text-navy text-xl font-semibold tracking-tight">{title}</h3>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </header>
      {children}
    </section>
  );
}

/** A titled block inside a panel; consecutive blocks are separated by a hairline. */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-border/70 px-5 py-5 not-first:border-t sm:px-7 sm:py-6", className)}>
      {title && (
        <div className="mb-4">
          <h4 className="text-navy text-sm font-semibold">{title}</h4>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Two equal columns on wide screens, one on phones. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>;
}

export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden>
      *
    </span>
  );
}

/** Sticky-feeling footer with the unsaved-changes hint, Cancel (form reset) and Save. */
export function SettingsFooter({
  pending,
  dirty,
  submitLabel = "Save Changes",
  submitIcon = <Check />,
}: {
  pending: boolean;
  dirty: boolean;
  submitLabel?: string;
  submitIcon?: ReactNode;
}) {
  return (
    <div className="border-border/70 bg-muted/30 flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <p className="text-muted-foreground flex items-center gap-2 text-xs" aria-live="polite">
        <span className={cn("size-2 rounded-full", dirty ? "bg-warning" : "bg-success")} aria-hidden />
        {dirty ? "You have unsaved changes" : "All changes saved"}
      </p>
      <div className="flex gap-2 sm:justify-end">
        <Button type="reset" variant="outline" size="lg" className="flex-1 sm:flex-none" disabled={!dirty || pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="flex-1 sm:flex-none" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : submitIcon}
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Photo / logo picker: preview, client-side type and size check (same limits the server
 * enforces), and "Undo" to drop a picked file. Form reset restores the saved image.
 */
export function ImagePicker({
  name,
  title,
  currentUrl,
  fallback,
  alt,
  shape = "circle",
  buttonLabel,
}: {
  name: string;
  title: string;
  currentUrl: string | null;
  fallback: ReactNode;
  alt: string;
  shape?: "circle" | "square";
  buttonLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const preview = picked ?? currentUrl;

  // Drop the picked file (and its object URL) whenever the form resets — Cancel, or the
  // reset after a successful save, by which point `currentUrl` is the uploaded image.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => setPicked(null);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  useEffect(() => {
    return () => {
      if (picked) URL.revokeObjectURL(picked);
    };
  }, [picked]);

  function clearPick() {
    if (inputRef.current) inputRef.current.value = "";
    setPicked(null);
  }

  const radius = shape === "circle" ? "rounded-full" : "rounded-2xl";

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative w-fit shrink-0">
        <Avatar className={cn("ring-pale size-22 shadow-sm ring-4", radius)}>
          {preview && <AvatarImage src={preview} alt={alt} className="object-cover" />}
          <AvatarFallback
            className={cn(
              radius,
              "bg-linear-to-br from-[#4fd0f3] to-[#0b5fae] text-2xl font-semibold text-white [&_svg]:size-8"
            )}
          >
            {fallback}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="bg-card text-brand ring-border hover:bg-pale absolute -right-1 -bottom-1 flex size-8 cursor-pointer items-center justify-center rounded-full shadow-md ring-1 transition-colors"
          aria-label={buttonLabel}
        >
          <Camera className="size-4" />
        </button>
      </div>

      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-navy text-sm font-semibold">{title}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{IMAGE_HINT}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <Camera /> {buttonLabel}
          </Button>
          {picked && (
            <Button type="button" variant="ghost" className="text-muted-foreground" onClick={clearPick}>
              <RotateCcw /> Undo
            </Button>
          )}
        </div>
        {picked && <p className="text-brand text-xs font-medium">New image selected — save to apply it.</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label={buttonLabel}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const problem = imageFileError(file);
          if (problem) {
            toast.error(problem);
            clearPick();
            return;
          }
          setPicked(URL.createObjectURL(file));
        }}
      />
    </div>
  );
}
