"use client";

import { useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CloudUpload, FileImage, FileText, Info, Layers, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { IconInput } from "@/components/shared/icon-input";
import { RequiredMark } from "@/components/shared/record-form";
import { PatientCombobox } from "@/components/shared/patient-combobox";
import { createDocumentUploadAction, uploadDocumentAction } from "@/server/documents/actions";
import { DOCUMENT_TYPES } from "@/lib/validations/document";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = { XRAY: "X-Ray", REPORT: "Report", IMAGE: "Image", PDF: "PDF", OTHER: "Other" };

// Same rules the server enforces (ALLOWED_DOCUMENT_TYPES / MAX_UPLOAD_BYTES in lib/storage).
const ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function sizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileProblem(file: File) {
  if (file.size === 0) return "This file is empty.";
  if (!ACCEPT.includes(file.type)) return "Only PDF, JPG, PNG and WEBP files are supported.";
  if (file.size > MAX_BYTES) return "File must be under 10 MB.";
  return null;
}

/** PUT to the signed storage URL with real progress events (fetch has none for uploads). */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

/**
 * Upload Document modal: Patient (optional), Document Name, Type and File, with drag & drop.
 * Same two-step flow as before — a signed storage URL when R2 is configured, otherwise the
 * file goes with the form — but errors keep the dialog open with everything entered.
 */
export function UploadDocumentDialog({ patientId, variant = "outline" }: { patientId?: string; variant?: "primary" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [nameFromFile, setNameFromFile] = useState(true);
  const [type, setType] = useState("OTHER");
  const [typeTouched, setTypeTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (next) {
      setFormKey((k) => k + 1);
      setFile(null);
      setName("");
      setNameFromFile(true);
      setType("OTHER");
      setTypeTouched(false);
      setProgress(null);
      setError(null);
    }
  }

  function pick(next: File | undefined | null) {
    if (!next) return;
    const problem = fileProblem(next);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(next);
    // Suggest a name and type from the file until the user sets them.
    if (nameFromFile || !name.trim()) {
      setName(next.name.replace(/\.[^.]+$/, ""));
      setNameFromFile(true);
    }
    if (!typeTouched) setType(next.type === "application/pdf" ? "PDF" : "IMAGE");
  }

  function removeFile() {
    setFile(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (!isPending) pick(e.dataTransfer.files?.[0]);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Please choose a file to upload.");
    if (!name.trim()) return setError("Document name is required.");
    const formData = new FormData(event.currentTarget);
    formData.delete("file");
    setError(null);

    startTransition(async () => {
      try {
        const target = await createDocumentUploadAction({ name: file.name, size: file.size, type: file.type });
        if ("error" in target) return setError(target.error);
        if (target.direct) {
          setProgress(0);
          await putWithProgress(target.url, file, setProgress);
          formData.set("fileKey", target.key);
          formData.set("fileName", file.name);
        } else {
          formData.set("file", file);
        }
        const result = await uploadDocumentAction({}, formData);
        if (result.error) {
          setProgress(null);
          return setError(result.error);
        }
        toast.success(`Uploaded "${name.trim()}".`);
        setOpen(false);
        router.refresh();
      } catch {
        setProgress(null);
        setError("Upload failed. Please check your connection and try again.");
      }
    });
  }

  const FileGlyph = file?.type.startsWith("image/") ? FileImage : FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {variant === "primary" ? (
          <Button size="lg" className="rounded-full px-5">
            <Upload /> Upload Document
          </Button>
        ) : (
          <Button variant="outline">
            <Upload /> Upload Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-border/70 flex-row items-center gap-3 border-b px-6 py-5 text-left">
          <span className="bg-pale text-brand flex size-11 shrink-0 items-center justify-center rounded-2xl" aria-hidden>
            <FileText className="size-5" />
          </span>
          <div>
            <DialogTitle className="text-navy text-xl">Upload Document</DialogTitle>
            <DialogDescription>{patientId ? "Add a file to this patient's record." : "Add a file to a patient's record or the clinic files."}</DialogDescription>
          </div>
        </DialogHeader>

        <form key={formKey} onSubmit={onSubmit} className="flex flex-col">
          <div className="grid gap-5 px-6 py-5">
            {error && (
              <p role="alert" className="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
              </p>
            )}

            {patientId ? (
              <input type="hidden" name="patientId" value={patientId} />
            ) : (
              <Field>
                <FieldLabel>Patient (optional)</FieldLabel>
                <PatientCombobox name="patientId" />
              </Field>
            )}

            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Field>
                <FieldLabel htmlFor="doc-name">
                  Document Name <RequiredMark />
                </FieldLabel>
                <IconInput
                  icon={<FileText />}
                  id="doc-name"
                  name="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameFromFile(false);
                  }}
                  placeholder="e.g. Panoramic X-Ray"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="doc-type">
                  Type <RequiredMark />
                </FieldLabel>
                <input type="hidden" name="type" value={type} />
                <div className="relative">
                  <Layers className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" aria-hidden />
                  <Select
                    value={type}
                    onValueChange={(v) => {
                      setType(v);
                      setTypeTouched(true);
                    }}
                  >
                    <SelectTrigger id="doc-type" className="h-11! w-full pl-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="doc-file">
                File <RequiredMark />
              </FieldLabel>
              <input
                ref={inputRef}
                id="doc-file"
                type="file"
                accept={ACCEPT.join(",")}
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0])}
                disabled={isPending}
              />
              {file ? (
                <div className="border-border/80 bg-muted/30 rounded-2xl border p-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-pale text-brand flex size-11 shrink-0 items-center justify-center rounded-xl" aria-hidden>
                      <FileGlyph className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-navy truncate text-sm font-semibold" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {sizeLabel(file.size)}
                        {isPending && (progress === null ? " · Uploading…" : ` · Uploading ${progress}%`)}
                      </p>
                    </div>
                    {!isPending && (
                      <Button type="button" variant="ghost" size="icon" onClick={removeFile} className="text-destructive hover:bg-destructive/10 hover:text-destructive size-9 rounded-xl" aria-label="Remove file">
                        <X />
                      </Button>
                    )}
                  </div>
                  {isPending && (
                    <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full" role="progressbar" aria-valuenow={progress ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                      <div
                        className={cn("bg-brand h-full rounded-full transition-[width]", progress === null && "w-1/3 animate-pulse")}
                        style={progress === null ? undefined : { width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  aria-label="Choose a file to upload, or drop it here"
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors outline-none focus-visible:ring-4 focus-visible:ring-cyan/20",
                    dragging ? "border-brand bg-pale" : "border-[#bcd8ec] bg-pale/40 hover:border-brand/60 hover:bg-pale/70"
                  )}
                >
                  <CloudUpload className="text-brand mb-1 size-9" aria-hidden />
                  <p className="text-navy font-semibold">{dragging ? "Drop the file to add it" : "Drag & drop your file here"}</p>
                  <p className="text-muted-foreground text-sm">or click to browse from your computer</p>
                  <span className="text-navy mt-3 inline-flex h-9 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold shadow-xs">
                    <Upload className="size-4" aria-hidden /> Choose File
                  </span>
                </div>
              )}
              <p className="text-muted-foreground bg-muted/40 flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
                <Info className="size-3.5 shrink-0" aria-hidden /> Supported formats: PDF, JPG, PNG, WEBP · Max size: 10 MB
              </p>
            </Field>
          </div>

          <div className="border-border/70 flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="lg" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" disabled={isPending || !file} className="min-w-32">
              {isPending ? <Loader2 className="animate-spin" /> : <Upload />} {isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
