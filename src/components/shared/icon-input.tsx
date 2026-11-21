"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** The app's Input with a leading icon (and optional trailing slot) inside the field. */
export function IconInput({
  icon,
  trailing,
  className,
  ...props
}: ComponentProps<typeof Input> & { icon: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="relative">
      <span
        className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center [&_svg]:size-4"
        aria-hidden
      >
        {icon}
      </span>
      <Input className={cn("h-11 pl-10", trailing && "pr-11", className)} {...props} />
      {trailing && <div className="absolute inset-y-0 right-0 flex w-11 items-center justify-center">{trailing}</div>}
    </div>
  );
}

/** Password field with a lock icon and a show/hide toggle. */
export function PasswordInput(props: Omit<ComponentProps<typeof IconInput>, "icon" | "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <IconInput
      {...props}
      icon={<LockKeyhole />}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-muted-foreground hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}
