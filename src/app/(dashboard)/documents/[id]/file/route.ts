import { patientScope } from "@/server/patients/access";
import { readPrivateFile } from "@/lib/storage";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { documentDownloadUrl, r2KeyFromFileUrl } from "@/lib/r2";

/**
 * Opens a document after checking the session: R2 files (private bucket) get a
 * 5-minute signed link, older documents redirect to their stored URL.
 * `?download=1` saves the file instead of previewing it.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/documents/[id]/file">) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user, "documents.view")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await ctx.params;
  const doc = await prisma.document.findUnique({ where: { id }, select: { name: true, fileUrl: true, mimeType: true, patientId: true } });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  if (doc.patientId && user.role.name === "DENTIST") {
    const assigned = await prisma.patient.findFirst({ where: { id: doc.patientId, AND: [patientScope(user)] }, select: { id: true } });
    if (!assigned) return new NextResponse("Forbidden", { status: 403 });
  }
  if (doc.fileUrl.startsWith("private:")) {
    const bytes = await readPrivateFile("documents", doc.fileUrl.slice(8));
    return new Response(new Uint8Array(bytes), { headers: {
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Type": doc.mimeType,
      "Content-Disposition": (request.nextUrl.searchParams.has("download") ? "attachment" : "inline") + "; filename*=UTF-8''" + encodeURIComponent(doc.name),
      "Content-Security-Policy": "sandbox",
    } });
  }
  const key = r2KeyFromFileUrl(doc.fileUrl);
  if (!key) return NextResponse.redirect(new URL(doc.fileUrl, request.url));

  const ext = path.extname(key);
  const filename = doc.name.toLowerCase().endsWith(ext) ? doc.name : `${doc.name}${ext}`;
  const download = request.nextUrl.searchParams.has("download");
  const response = NextResponse.redirect(await documentDownloadUrl(key, filename, download));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
