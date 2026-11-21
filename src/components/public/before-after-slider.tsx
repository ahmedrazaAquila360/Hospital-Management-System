"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { MoveHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function BeforeAfterSlider({
  before,
  after,
  title,
  className,
}: {
  before: string;
  after: string;
  title: string;
  className?: string;
}) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    updateFromClientX(e.clientX);
  }
  function onPointerUp() {
    dragging.current = false;
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - step));
    else if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + step));
    else if (e.key === "Home") setPosition(0);
    else if (e.key === "End") setPosition(100);
    else return;
    e.preventDefault();
  }

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label={`${title}: before and after comparison`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`${Math.round(position)}% before`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "relative aspect-4/3 w-full cursor-ew-resize touch-none overflow-hidden rounded-[26px] bg-[#e6f2fb] outline-none select-none focus-visible:ring-4 focus-visible:ring-cyan/40",
        className
      )}
    >
      <Image src={after} alt={`${title} — after`} fill sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" draggable={false} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
        <Image src={before} alt={`${title} — before`} fill sizes="(min-width: 1024px) 45vw, 90vw" className="object-cover" draggable={false} />
      </div>

      <div className="bg-cyan absolute inset-y-0 z-10 flex w-[3px] -translate-x-1/2 shadow-[0_0_18px_rgb(33_188_232/0.8)]" style={{ left: `${position}%` }}>
        <span className="text-navy absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/55 shadow-xl backdrop-blur-md">
          <MoveHorizontal className="size-5" />
        </span>
      </div>

      <span className="absolute top-4 left-4 rounded-full border border-white/40 bg-white/25 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
        Before
      </span>
      <span className="absolute top-4 right-4 rounded-full border border-white/40 bg-white/25 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
        After
      </span>
    </div>
  );
}
