/** Simple molar outline icon (lucide has no tooth), sized/coloured via className like other icons. */
export function ToothIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7.5 3C5 3 3.5 5 3.5 7.6c0 2.2.9 3.6 1.5 5.4.7 2.2.8 4.4 1.3 6.3.3 1.2.8 1.7 1.5 1.7 1 0 1.3-1 1.6-2.4.4-1.8.8-3.6 2.6-3.6s2.2 1.8 2.6 3.6c.3 1.4.6 2.4 1.6 2.4.7 0 1.2-.5 1.5-1.7.5-1.9.6-4.1 1.3-6.3.6-1.8 1.5-3.2 1.5-5.4C20.5 5 19 3 16.5 3c-1.8 0-2.8 1-4.5 1S9.3 3 7.5 3Z" />
    </svg>
  );
}
