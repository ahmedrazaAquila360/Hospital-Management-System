import { NextResponse } from "next/server";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export type SearchResult = {
  type: "patient" | "appointment" | "invoice" | "treatment";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] satisfies SearchResult[] });

  const results: SearchResult[] = [];

  if (can(user, "patients.view")) {
    const patients = await prisma.patient.findMany({
      where: { archivedAt: null, AND: [patientScope(user)],
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { patientCode: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    });
    for (const p of patients) {
      results.push({
        type: "patient",
        id: p.id,
        title: p.fullName,
        subtitle: `${p.patientCode} · ${p.phone}`,
        href: `/patients/${p.id}`,
      });
    }
  }

  if (can(user, "appointments.view")) {
    const appointments = await prisma.appointment.findMany({
      where: { ...(user.role.name === "DENTIST" && { dentistId: user.id }), patient: { fullName: { contains: q, mode: "insensitive" } } },
      include: { patient: true, dentist: true },
      take: 5,
      orderBy: { date: "desc" },
    });
    for (const a of appointments) {
      results.push({
        type: "appointment",
        id: a.id,
        title: `${a.patient.fullName} · ${a.type.replace(/_/g, " ")}`,
        subtitle: `with ${a.dentist.name} on ${a.date.toISOString().slice(0, 10)}`,
        href: `/appointments/${a.id}`,
      });
    }
  }

  if (can(user, "billing.view")) {
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { patient: { fullName: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { patient: true },
      take: 5,
    });
    for (const inv of invoices) {
      results.push({
        type: "invoice",
        id: inv.id,
        title: inv.invoiceNumber,
        subtitle: `${inv.patient.fullName} · ${inv.status.replace(/_/g, " ")}`,
        href: `/billing/invoices/${inv.id}`,
      });
    }
  }

  if (can(user, "treatments.view")) {
    const treatments = await prisma.treatment.findMany({
      where: { ...(user.role.name === "DENTIST" && { dentistId: user.id }),
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { patient: { fullName: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { patient: true },
      take: 5,
    });
    for (const t of treatments) {
      results.push({
        type: "treatment",
        id: t.id,
        title: t.name,
        subtitle: `${t.patient.fullName} · ${t.status.replace(/_/g, " ")}`,
        href: `/treatments/${t.id}`,
      });
    }
  }

  return NextResponse.json({ results });
}
