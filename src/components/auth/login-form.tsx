"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitWithoutReset } from "@/lib/form-submit";
import { motion } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { loginAction, type LoginActionState } from "@/server/auth/actions";

const initialState: LoginActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Signing in…
        </>
      ) : (
        "Sign in"
      )}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-sm space-y-8"
    >
      <div className="space-y-2">
        <div className="bg-pale text-brand flex size-11 items-center justify-center rounded-2xl ring-1 ring-[#d3e8f5] ring-inset">
          <LockKeyhole className="size-5" />
        </div>
        <h2 className="text-navy text-3xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-muted-foreground text-sm">
          Sign in to your hospital workspace to continue.
        </p>
      </div>

      <form action={formAction} onSubmit={submitWithoutReset(formAction)} noValidate>
        <FieldGroup>
          {state.error && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <AlertCircle className="size-4 shrink-0" />
              {state.error}
            </div>
          )}

          <Field data-invalid={Boolean(state.fieldErrors?.email)}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@hospital.org"
              aria-invalid={Boolean(state.fieldErrors?.email)}
              required
            />
            <FieldError>{state.fieldErrors?.email}</FieldError>
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.password)}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <a href="/forgot-password" className="text-primary text-xs font-medium hover:underline">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={Boolean(state.fieldErrors?.password)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <FieldError>{state.fieldErrors?.password}</FieldError>
          </Field>

          <Field orientation="horizontal">
            <Checkbox id="remember" name="remember" defaultChecked />
            <FieldLabel htmlFor="remember" className="font-normal">
              Remember me for 30 days
            </FieldLabel>
          </Field>

          <SubmitButton />
        </FieldGroup>
      </form>

    </motion.div>
  );
}
