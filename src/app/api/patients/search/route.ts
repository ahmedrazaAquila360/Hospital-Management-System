import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { searchPatientsForSelect } from "@/server/appointments/queries";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "patients.view") && !can(user,"billing.create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const patients = await searchPatientsForSelect(q);
  return NextResponse.json({ patients });
}
