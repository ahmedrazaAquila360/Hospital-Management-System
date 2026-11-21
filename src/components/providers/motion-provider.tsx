"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/** Makes every framer-motion animation honour the visitor's reduced-motion preference. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
