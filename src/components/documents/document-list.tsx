import Link from "next/link";
import { CalendarDays, FileImage, FileText, FolderOpen, UserRound } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DocumentRow = {
  id: string;
  name: string;
  type: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
  patientId: string | null;
  patient?: { fullName: string } | null;
  uploadedBy: { name: string } | null;
};

export const DOCUMENT_TYPE_LABEL: Record<string, string> = { XRAY: "X-Ray", REPORT: "Report", IMAGE: "Image", PDF: "PDF", OTHER: "Other" };

const TYPE_BADGE: Record<string, string> = {
  XRAY: "bg-violet-50 text-violet-800",
  REPORT: "bg-blue-50 text-blue-800",
  IMAGE: "bg-teal-50 text-teal-800",
  PDF: "bg-rose-50 text-rose-800",
  OTHER: "bg-slate-100 text-slate-700",
};

export function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Document table (wide containers) / cards (narrow). Used on the Documents page with a
 * Patient column and on a patient's profile without it. Must sit inside an `@container`.
 */
export function DocumentList({
  documents,
  canManage,
  showPatient = false,
  empty,
}: {
  documents: DocumentRow[];
  canManage: boolean;
  showPatient?: boolean;
  /** Replaces the default empty state (e.g. with an Upload button). */
  empty?: { title: string; description: string; action?: React.ReactNode };
}) {
  if (documents.length === 0) {
    return (
      <Empty className="w-auto border-border/70 m-4 rounded-2xl border border-dashed py-12 sm:m-5">
        <EmptyMedia variant="icon">
          <FolderOpen />
        </EmptyMedia>
        <EmptyTitle>{empty?.title ?? "No documents"}</EmptyTitle>
        <EmptyDescription>{empty?.description ?? "Uploaded X-rays, reports and files will appear here."}</EmptyDescription>
        {empty?.action && <EmptyContent>{empty.action}</EmptyContent>}
      </Empty>
    );
  }

  return (
    <>
      <div className="hidden @3xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
              <th className="py-3 pr-3 pl-5">Document Name</th>
              {showPatient && <th className="px-3 py-3">Patient</th>}
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Upload Date</th>
              <th className="py-3 pr-5 pl-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-pale/40 transition-colors">
                <td className="max-w-96 py-3 pr-3 pl-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileIcon mimeType={doc.mimeType} />
                    <div className="min-w-0">
                      <a
                        href={`/documents/${doc.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-navy hover:text-primary block truncate font-semibold"
                        title={doc.name}
                      >
                        {doc.name}
                      </a>
                      <p className="text-muted-foreground truncate text-xs">
                        {fileSizeLabel(doc.fileSize)}
                        {doc.uploadedBy && ` · by ${doc.uploadedBy.name}`}
                      </p>
                    </div>
                  </div>
                </td>
                {showPatient && (
                  <td className="px-3 py-3">
                    {doc.patient && doc.patientId ? (
                      <Link href={`/patients/${doc.patientId}`} className="text-foreground/85 hover:text-primary flex items-center gap-1.5">
                        <UserRound className="text-muted-foreground size-4 shrink-0" aria-hidden />
                        <span className="truncate">{doc.patient.fullName}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Clinic file</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-3">
                  <TypeBadge type={doc.type} />
                </td>
                <td className="text-foreground/80 px-3 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="text-muted-foreground size-4" aria-hidden /> {formatDate(doc.uploadedAt)}
                  </span>
                </td>
                <td className="py-3 pr-5 pl-3">
                  <DocumentRowActions id={doc.id} name={doc.name} patientId={doc.patientId} canManage={canManage} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border/60 divide-y @3xl:hidden">
        {documents.map((doc) => (
          <li key={doc.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <FileIcon mimeType={doc.mimeType} />
              <div className="min-w-0 space-y-1">
                <p className="text-navy truncate font-semibold">{doc.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <TypeBadge type={doc.type} />
                  <span className="text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
                  <span className="text-muted-foreground">· {fileSizeLabel(doc.fileSize)}</span>
                </div>
                {showPatient && (
                  <p className="text-muted-foreground text-xs">{doc.patient ? `Patient: ${doc.patient.fullName}` : "Clinic file"}</p>
                )}
              </div>
            </div>
            <DocumentRowActions id={doc.id} name={doc.name} patientId={doc.patientId} canManage={canManage} />
          </li>
        ))}
      </ul>
    </>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const isPdf = mimeType === "application/pdf";
  const Icon = mimeType.startsWith("image/") ? FileImage : FileText;
  return (
    <span
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", isPdf ? "bg-rose-50 text-rose-600" : "bg-pale text-brand")}
      aria-hidden
    >
      <Icon className="size-5" />
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", TYPE_BADGE[type] ?? TYPE_BADGE.OTHER)}>
      {DOCUMENT_TYPE_LABEL[type] ?? type}
    </span>
  );
}
