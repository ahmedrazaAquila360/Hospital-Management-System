"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Camera, CloudUpload, Loader2, RotateCcw, UserRound, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IMAGE_ACCEPT, IMAGE_HINT, imageFileError } from "@/lib/image-upload";
import { initialsFromName } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Building blocks shared by the full-page record forms (staff, patients): a two-column
 * layout with a photo panel on the left and titled sections on the right.
 */

/** Today in the browser's time zone (toISOString would give the UTC date). */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden>
      *
    </span>
  );
}

/** Submit button with the form's pending state (works with submitWithoutReset). */
export function SubmitButton({ label, icon }: { label: string; icon: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="flex-1 sm:flex-none" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : icon}
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function FormSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="border-border/70 px-5 py-6 not-first:border-t sm:px-7">
      <h3 className="text-navy mb-5 flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <Icon className="text-brand size-5" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The server's error summary. It sits above the fields, so after a rejected submit it is
 * scrolled into view and focused (`trigger` is the action state, so repeats re-fire).
 */
export function ErrorSummary({ message, trigger }: { message?: string; trigger: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!message) return;
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    ref.current?.focus({ preventScroll: true });
  }, [message, trigger]);

  if (!message) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="border-destructive/25 bg-destructive/5 text-destructive mx-5 mt-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm outline-none sm:mx-7"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </div>
  );
}

/**
 * Photo picker with a large preview, a click/drag-and-drop zone and an immediate type/size
 * check. It only sets the form's file input (`inputName`), which the server action already
 * handles; nothing is uploaded until the form is submitted. Below xl it collapses to a
 * compact row so the fields stay near the top on phones; the drop zone only appears where
 * drag-and-drop makes sense.
 */
export function PhotoUploadField({
  inputName,
  currentUrl,
  displayName,
  description,
  fallbackIcon: FallbackIcon = UserRound,
}: {
  inputName: string;
  currentUrl: string | null;
  /** Shown as initials until a photo exists. */
  displayName: string;
  description: string;
  fallbackIcon?: LucideIcon;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ url: string; fileName: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const preview = picked?.url ?? currentUrl;

  useEffect(() => {
    return () => {
      if (picked) URL.revokeObjectURL(picked.url);
    };
  }, [picked]);

  function accept(files: FileList | null) {
    const file = files?.[0];
    if (!file || !inputRef.current) return;
    const error = imageFileError(file);
    if (error) {
      setProblem(error);
      inputRef.current.value = "";
      setPicked(null);
      return;
    }
    // A dropped file is copied into the real input so it is submitted with the form.
    if (inputRef.current.files !== files) inputRef.current.files = files;
    setProblem(null);
    setPicked({ url: URL.createObjectURL(file), fileName: file.name });
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPicked(null);
    setProblem(null);
  }

  const initials = displayName.trim() ? initialsFromName(displayName) : null;

  return (
    <div className="flex flex-col xl:items-center xl:text-center">
      <div className="flex items-center gap-4 xl:flex-col xl:gap-0">
        <div className="relative shrink-0">
          <Avatar className="ring-pale size-20 shadow-sm ring-4 xl:size-32 xl:ring-8">
            {preview && <AvatarImage src={preview} alt="" className="object-cover" />}
            <AvatarFallback className="bg-pale text-brand text-xl font-semibold xl:text-3xl">
              {initials ?? <FallbackIcon className="size-9 xl:size-14" strokeWidth={1.5} aria-hidden />}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="bg-card text-brand ring-border hover:bg-pale absolute -right-1 bottom-0 flex size-8 cursor-pointer items-center justify-center rounded-full shadow-md ring-1 transition-colors xl:right-0 xl:bottom-1 xl:size-10"
            aria-label={preview ? "Change profile photo" : "Upload profile photo"}
          >
            <Camera className="size-4 xl:size-[1.1rem]" />
          </button>
        </div>

        <div className="min-w-0">
          <h2 className="text-navy text-base font-semibold tracking-tight xl:mt-5 xl:text-lg">Profile Photo</h2>
          <p className="text-muted-foreground mt-0.5 text-xs xl:mt-1 xl:text-sm">{description}</p>
          <p className="text-muted-foreground mt-0.5 text-xs xl:hidden">{IMAGE_HINT}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2.5 xl:hidden"
            onClick={() => inputRef.current?.click()}
          >
            <Camera /> {preview ? "Change photo" : "Upload photo"}
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
        className={cn(
          "mt-5 hidden w-full cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 transition-colors outline-none xl:flex",
          "focus-visible:ring-ring/60 focus-visible:ring-2",
          dragging ? "border-brand bg-pale" : "border-brand/25 hover:border-brand/50 hover:bg-pale/50"
        )}
      >
        <CloudUpload className="text-navy size-7" aria-hidden />
        <span className="text-navy text-sm font-semibold">Drag &amp; drop or click to upload</span>
        <span className="text-muted-foreground text-xs">{IMAGE_HINT}</span>
      </button>

      {picked && (
        <div className="bg-pale/60 mt-3 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left">
          <p className="min-w-0 text-xs">
            <span className="text-navy block truncate font-medium">{picked.fileName}</span>
            <span className="text-muted-foreground">Saved when you submit the form.</span>
          </p>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground shrink-0" onClick={clear}>
            <RotateCcw /> Undo
          </Button>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-destructive mt-3 text-xs font-medium">
          {problem}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        name={inputName}
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Profile photo"
        onChange={(e) => accept(e.target.files)}
      />
    </div>
  );
}
