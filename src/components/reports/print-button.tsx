"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser print dialog (also "Save as PDF"); the page swaps to its A4 report layout. */
export function PrintReportButton() {
  return (
    <Button variant="outline" size="lg" onClick={() => window.print()} className="print:hidden">
      <Printer /> Print / Save PDF
    </Button>
  );
}
