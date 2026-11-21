"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitWithoutReset } from "@/lib/form-submit";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { forgotPasswordAction, type ForgotPasswordState } from "@/server/auth/actions";

const initialState: ForgotPasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Sending…
        </>
      ) : (
        "Send reset link"
      )}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-sm space-y-8"
    >
      <div className="space-y-2">
        <div className="bg-pale text-brand flex size-11 items-center justify-center rounded-2xl ring-1 ring-[#d3e8f5] ring-inset">
          <KeyRound className="size-5" />
        </div>
        <h2 className="text-navy text-3xl font-semibold tracking-tight">Reset your password</h2>
        <p className="text-muted-foreground text-sm">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {state.submitted ? (
        <div className="border-border bg-muted/40 flex flex-col items-center gap-3 rounded-xl border px-6 py-8 text-center">
          <MailCheck className="text-primary size-8" />
          <p className="text-sm font-medium">Check your inbox</p>
          <p className="text-muted-foreground text-sm">
            If an account exists for that email, a reset link is on its way.
          </p>
        </div>
      ) : (
        <form action={formAction} onSubmit={submitWithoutReset(formAction)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(state.error)}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" placeholder="you@clinic.com" required />
              <FieldError>{state.error}</FieldError>
            </Field>
            <SubmitButton />
          </FieldGroup>
        </form>
      )}

      <Link href="/login" className="text-muted-foreground flex items-center gap-1.5 text-sm hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </motion.div>
  );
}
