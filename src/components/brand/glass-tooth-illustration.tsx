import { useId } from "react";
import { cn } from "@/lib/utils";

// Two-rooted molar silhouette, crown up, in a 200 × 260 box.
const MOLAR =
  "M40 70C40 35 70 22 88 34c7 5 17 5 24 0 18-12 48 1 48 36 0 30-10 48-14 70-4 25 0 60-8 92-4 16-20 18-24 0-4-22-6-52-14-64-8 12-10 42-14 64-4 18-20 16-24 0-8-32-4-67-8-92-4-22-14-40-14-70Z";

/**
 * Static blue-glass tooth, used for decoration and as the fallback when WebGL
 * (the animated {@link GlassTooth}) is unavailable.
 */
export function GlassToothIllustration({ className, glow = true }: { className?: string; glow?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <svg viewBox="0 0 200 260" className={cn("h-auto w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`gt-body-${id}`} x1="40" y1="20" x2="160" y2="250" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d6f1ff" />
          <stop offset="0.35" stopColor="#6fc6f5" />
          <stop offset="0.7" stopColor="#1f86d6" />
          <stop offset="1" stopColor="#0b4fa3" />
        </linearGradient>
        <radialGradient id={`gt-core-${id}`} cx="100" cy="95" r="70" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a5dc2" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#1676d4" stopOpacity="0.45" />
          <stop offset="1" stopColor="#1676d4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gt-shine-${id}`} x1="45" y1="40" x2="90" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`gt-blur-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={`gt-glow-${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <clipPath id={`gt-clip-${id}`}>
          <path d={MOLAR} />
        </clipPath>
      </defs>

      {glow && <path d={MOLAR} fill="#21bce8" opacity="0.35" filter={`url(#gt-glow-${id})`} />}
      <path d={MOLAR} fill={`url(#gt-body-${id})`} />
      <g clipPath={`url(#gt-clip-${id})`}>
        <ellipse cx="100" cy="105" rx="52" ry="62" fill={`url(#gt-core-${id})`} filter={`url(#gt-blur-${id})`} />
        <path d="M64 60c14 28 46 30 70 6M70 128c18-14 44-12 62 4M88 168c-4 28-8 48-14 66M112 168c4 28 8 48 14 66" stroke="#bde9ff" strokeOpacity="0.45" strokeWidth="2" fill="none" filter={`url(#gt-blur-${id})`} />
        <path d="M52 64c0-20 14-30 30-26" stroke={`url(#gt-shine-${id})`} strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M150 74c0 30-8 46-12 66" stroke="#fff" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>
      <path d={MOLAR} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" />
    </svg>
  );
}
