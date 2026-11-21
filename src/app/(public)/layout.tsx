import type { ReactNode } from "react";
import { Navbar } from "@/components/public/navbar";
import { Footer } from "@/components/public/footer";
import { getSessionUser } from "@/lib/auth/session";
import { getClinicSettings } from "@/server/settings/queries";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [user, clinic] = await Promise.all([getSessionUser(), getClinicSettings()]);

  return (
    // The site sits in a rounded white canvas on a soft blue frame.
    <div className="flex min-h-svh flex-col bg-[linear-gradient(160deg,#a9d3f0_0%,#6fa8dd_45%,#3e7cc3_100%)] bg-fixed sm:p-2.5 lg:p-3">
      <div className="relative flex flex-1 flex-col overflow-clip bg-white shadow-[0_30px_80px_-30px_rgb(8_44_86/0.45)] sm:rounded-[28px]">
        <Navbar clinicName={clinic.clinicName} isAuthenticated={Boolean(user)} />
        <main className="flex-1">{children}</main>
        <Footer clinic={clinic} />
      </div>
    </div>
  );
}
