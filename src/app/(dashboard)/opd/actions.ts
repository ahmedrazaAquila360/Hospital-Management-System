"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requirePermission,assertPermission} from "@/lib/auth/guard";
import {saveEncounterNote} from "@/server/clinical/notes";
export async function documentVisit(form:FormData){
 const doctor=await requirePermission("opd.edit");assertPermission(doctor,"opd.view");
 await saveEncounterNote(form,doctor);revalidatePath("/opd");revalidatePath("/appointments");
 if(form.has("previousId"))redirect("/opd?visit="+String(form.get("encounterId")));
}
