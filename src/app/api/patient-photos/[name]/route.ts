import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { readPrivateFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getSessionUser();
  if (!user || !can(user, "patients.view")) return new Response(null, { status: 403 });
  const { name } = await params;
  const patient = await prisma.patient.findFirst({
    where: {
      photoUrl: "/api/patient-photos/" + name,
      ...(user.role.name === "DENTIST" && {
        OR: [
          { appointments: { some: { dentistId: user.id } } },
          { admissions: { some: { doctorId: user.id } } },
        ],
      }),
    },
    select: { id: true },
  });
  if (!patient) return new Response(null, { status: 404 });
  const file = await readPrivateFile("patients", name);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/" + (name.endsWith(".jpg") ? "jpeg" : name.split(".").pop()),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
