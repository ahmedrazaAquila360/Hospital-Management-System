import path from "node:path";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getInvoiceById } from "@/server/billing/queries";
import { getClinicSettings } from "@/server/settings/queries";
import { InvoicePdf } from "@/components/pdf/invoice-pdf";

/** Clinic logos are saved under public/uploads; the PDF renderer needs the file path. */
function localLogoPath(logoUrl: string | null) {
  if (!logoUrl?.startsWith("/uploads/") || !/\.(png|jpe?g)$/i.test(logoUrl)) return null;
  const file = path.join(process.cwd(), "public", path.normalize(logoUrl));
  return file.startsWith(path.join(process.cwd(), "public", "uploads")) && existsSync(file) ? file : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !can(user, "billing.view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [invoice, clinic] = await Promise.all([getInvoiceById(id), getClinicSettings()]);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(<InvoicePdf invoice={invoice} clinic={clinic} logoSrc={localLogoPath(clinic.logoUrl)} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
