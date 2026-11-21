"use server";

import { revalidatePath } from "next/cache";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { saveUploadedFile, ALLOWED_DOCUMENT_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { documentUploadSchema } from "@/lib/validations/document";
import {
  createDocumentUpload,
  deleteDocumentObject,
  headDocument,
  isDocumentKey,
  isR2Configured,
  r2KeyFromFileUrl,
  R2_URL_PREFIX,
} from "@/lib/r2";

export type DocumentUploadState = { error?: string };

const NO_PERMISSION = "You don't have permission to manage documents.";

export type DocumentUploadTarget = { error: string } | { direct: false } | { direct: true; key: string; url: string };

function fileProblem(size: number, type: string) {
  if (size === 0) return "Please choose a file to upload.";
  if (size > MAX_UPLOAD_BYTES) return "File must be under 10MB.";
  if (!ALLOWED_DOCUMENT_TYPES.includes(type)) return "Only PDF, JPG, PNG, and WEBP files are supported.";
  return null;
}

/**
 * Step 1 of an upload: when R2 is configured, hands the browser a signed URL to
 * PUT the file to directly. Without R2 (e.g. local dev) the file is sent with the
 * form instead.
 */
export async function createDocumentUploadAction(file: { name: string; size: number; type: string }): Promise<DocumentUploadTarget> {
  const user = await requireUser();
  if (!can(user, "documents.create")) return { error: NO_PERMISSION };
  const problem = fileProblem(file.size, file.type);
  if (problem) return { error: problem };
  if (!isR2Configured()) return { direct: false };
  return { direct: true, ...(await createDocumentUpload(file.name, file.type)) };
}

export async function uploadDocumentAction(_prev: DocumentUploadState, formData: FormData): Promise<DocumentUploadState> {
  const user = await requireUser();
  // The upload button is only shown with documents.manage; enforce it here as well.
  if (!can(user, "documents.create")) return { error: NO_PERMISSION };

  // Either the file itself, or the R2 key the browser already uploaded it to.
  const file = formData.get("file");
  const fileKey = formData.get("fileKey");
  let upload: { fileUrl?: string; size: number; type: string; name: string };

  if (typeof fileKey === "string" && fileKey) {
    if (!isR2Configured() || !isDocumentKey(fileKey)) return { error: "Upload failed. Please try again." };
    const head = await headDocument(fileKey);
    if (!head) return { error: "Upload failed. Please try again." };
    const problem = fileProblem(head.size, head.contentType);
    if (problem) {
      await deleteDocumentObject(fileKey);
      return { error: problem };
    }
    upload = { fileUrl: `${R2_URL_PREFIX}${fileKey}`, size: head.size, type: head.contentType, name: String(formData.get("fileName") ?? "") };
  } else {
    if (!(file instanceof File)) return { error: "Please choose a file to upload." };
    const problem = fileProblem(file.size, file.type);
    if (problem) return { error: problem };
    upload = { size: file.size, type: file.type, name: file.name };
  }

  const parsed = documentUploadSchema.safeParse({
    patientId: formData.get("patientId"),
    name: formData.get("name") || upload.name,
    type: formData.get("type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid document details." };

  if (parsed.data.patientId && !await prisma.patient.findFirst({ where: { id: parsed.data.patientId, AND: [patientScope(user)] }, select: { id: true } })) return { error: "Patient unavailable." };
  const fileUrl = upload.fileUrl ?? (await saveUploadedFile(file as File, "documents"));

  await prisma.document.create({
    data: {
      patientId: parsed.data.patientId || null,
      name: parsed.data.name,
      type: parsed.data.type,
      fileUrl,
      fileSize: upload.size,
      mimeType: upload.type,
      uploadedById: user.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "UPLOAD",
      entityType: "Document",
      description: `${user.name} uploaded ${parsed.data.name}.`,
    },
  });

  if (parsed.data.patientId) revalidatePath(`/patients/${parsed.data.patientId}`);
  revalidatePath("/documents");
  return {};
}

export async function deleteDocumentAction(id: string, patientId: string | null): Promise<DocumentUploadState> {
  const user = await requireUser();
  if (!can(user, "documents.delete")) return { error: NO_PERMISSION };
  const doc = await prisma.document.delete({ where: { id, ...(user.role.name === "DENTIST" && { patient: patientScope(user) }) } }).catch(() => null);
  if (!doc) return { error: "This document no longer exists." };
  const key = r2KeyFromFileUrl(doc.fileUrl);
  if (key) await deleteDocumentObject(key).catch((err) => console.error("R2 delete failed", key, err));
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "DELETE",
      entityType: "Document",
      entityId: id,
      description: `${user.name} deleted document ${doc.name}.`,
    },
  });
  if (patientId) revalidatePath(`/patients/${patientId}`);
  revalidatePath("/documents");
  return {};
}
