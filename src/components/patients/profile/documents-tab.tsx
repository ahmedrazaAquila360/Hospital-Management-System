import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { can, type SessionUser } from "@/lib/permissions";
import type { getPatientById } from "@/server/patients/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;

export function DocumentsTab({ patient, user }: { patient: Patient; user: SessionUser }) {
  const canManage = can(user, "documents.delete");
  const canUpload = can(user, "documents.create");
  return (
    <div className="flex flex-col gap-4">
      {canUpload && (
        <div className="flex justify-end">
          <UploadDocumentDialog patientId={patient.id} />
        </div>
      )}
      <section className="surface-card @container overflow-hidden p-0">
        <DocumentList documents={patient.documents} canManage={canManage} />
      </section>
    </div>
  );
}
