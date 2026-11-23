"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { refundPayment } from "@/server/billing/actions";
import { PAYMENT_METHODS } from "@/lib/validations/invoice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RefundForm({ invoiceId, paid }: { invoiceId: string; paid: number }) {
  const requestId = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    requestId.current ??= crypto.randomUUID();
    data.set("requestId", requestId.current);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await refundPayment(data);
        if (!result.success) { setMessage(result.error ?? "Could not record refund."); return; }
        requestId.current = null;
        form.reset();
        setMessage("Refund recorded.");
        router.refresh();
      } catch {
        setMessage("Could not confirm the refund. Retry with the same details to avoid a duplicate.");
      }
    });
  }
  return <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-3">
    <input type="hidden" name="invoiceId" value={invoiceId}/>
    <label>Amount<Input name="amount" type="number" min=".01" step=".01" max={paid} required disabled={pending}/></label>
    <label>Reason<Input name="reason" required maxLength={250} disabled={pending}/></label>
    <label>Method<select name="method" className="block" disabled={pending}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</select></label>
    <Button disabled={pending}>{pending ? "Recording…" : "Record refund"}</Button>
    {message && <p role="status" className="sm:col-span-3">{message}</p>}
  </form>;
}
