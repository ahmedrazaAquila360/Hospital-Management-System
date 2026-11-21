import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getPrescriptionById } from "@/server/prescriptions/queries";
import { getClinicSettings } from "@/server/settings/queries";
import { PrescriptionPdf } from "@/components/pdf/prescription-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !can(user, "prescriptions.view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [prescription, clinic] = await Promise.all([getPrescriptionById(id), getClinicSettings()]);
  if (!prescription) {
    return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
  }

  const buffer = await renderToBuffer(<PrescriptionPdf prescription={prescription} clinic={clinic} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="prescription-${prescription.patient.patientCode}-${id.slice(0, 6)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
