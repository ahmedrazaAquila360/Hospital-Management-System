import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const privateRoot = process.env.HOSPITAL_UPLOAD_DIR || path.join(process.cwd(), ".hospital-files");

export function readPrivateFile(folder: "documents" | "patients", name: string) {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/.test(name)) throw new Error("Invalid file identifier.");
  return readFile(path.join(privateRoot, folder, name));
}

export async function saveUploadedFile(file: File, folder: "patients" | "documents" | "clinic") {
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw new Error("Invalid file size.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const formats = [
    { mime: "image/jpeg", ext: "jpg", matches: bytes.subarray(0,3).equals(Buffer.from([255,216,255])) },
    { mime: "image/png", ext: "png", matches: bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")) },
    { mime: "image/webp", ext: "webp", matches: bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP" },
    { mime: "application/pdf", ext: "pdf", matches: folder === "documents" && bytes.toString("ascii",0,5) === "%PDF-" },
  ];
  const format = formats.find(f => f.matches && file.type === f.mime);
  if (!format) throw new Error("File contents must match the selected file type.");
  const name = randomBytes(16).toString("hex") + "." + format.ext;
  const root = folder === "clinic" ? path.join(process.cwd(),"public","uploads") : privateRoot;
  await mkdir(path.join(root,folder), { recursive: true, mode: 0o700 });
  await writeFile(path.join(root,folder,name), bytes, { flag: "wx", mode: 0o600 });
  if (folder === "documents") return "private:" + name;
  if (folder === "patients") return "/api/patient-photos/" + name;
  return "/uploads/clinic/" + name;
}
