import type { Metadata } from "next";
import { FileImage, FileText, FolderOpen, Files, ScanLine } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getDocumentPatients, getDocumentStats, listDocuments } from "@/server/documents/queries";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentsToolbar } from "@/components/documents/documents-toolbar";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { ListFooter } from "@/components/shared/list-footer";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { can } from "@/lib/permissions";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { DOCUMENT_TYPES } from "@/lib/validations/document";
import type { DocumentType } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Documents" };

type SearchParams = Promise<{ search?: string; type?: string; patientId?: string; page?: string; perPage?: string }>;

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("documents.view");
  const params = await searchParams;
  const canManage = can(user, "documents.delete");
  const canUpload = can(user, "documents.create");
  const search = params.search?.trim() || undefined;
  // An unknown type would reach Prisma as an invalid enum and fail the page.
  const type = DOCUMENT_TYPES.find((t) => t === params.type) as DocumentType | undefined;
  const patientId = params.patientId || undefined;

  const [list, stats, patients] = await Promise.all([
    listDocuments({ search, type, patientId, page: parsePage(params.page), pageSize: parsePageSize(params.perPage) }),
    getDocumentStats(),
    getDocumentPatients(),
  ]);
  const filtered = Boolean(search || type || patientId);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader
          icon={<FolderOpen />}
          title="Documents"
          description="Manage and view patient documents, reports and files."
          actions={canUpload && <UploadDocumentDialog variant="primary" />}
        />
        <ToothOutline className="absolute -top-3 right-64 hidden xl:block" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Files} value={stats.total} label="Total Documents" />
        <StatCard icon={ScanLine} value={stats.xray} label="X-Rays" />
        <StatCard icon={FileText} value={stats.report} label="Reports" />
        <StatCard icon={FileImage} value={stats.image + stats.other} label="Images & Other Files" />
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <DocumentsToolbar patients={patients} />
        <DocumentList
          documents={list.documents}
          canManage={canManage}
          showPatient
          empty={
            filtered
              ? { title: "No matching documents", description: "Try a different name, patient or type, or reset the filters." }
              : {
                  title: "No documents yet",
                  description: canUpload
                    ? "Upload X-rays, reports, consent forms and other files to keep them with the patient record."
                    : "Uploaded X-rays, reports and files will appear here.",
                  action: canUpload ? <UploadDocumentDialog variant="primary" /> : undefined,
                }
          }
        />
        <ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={list.documents.length} noun="document" />
      </section>
    </div>
  );
}
