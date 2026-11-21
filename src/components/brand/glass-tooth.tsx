"use client";

import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { GlassToothIllustration } from "@/components/brand/glass-tooth-illustration";
import { cn } from "@/lib/utils";

// three.js only downloads where the animated tooth is actually shown.
const GlassToothScene = dynamic(() => import("./glass-tooth-scene"), { ssr: false });

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

let webglSupport: boolean | null = null;
function detectWebGL() {
  if (webglSupport === null) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Decorative, slowly turning blue-glass molar (built from the clinical chart's tooth
 * geometry). Falls back to a static illustration without WebGL and holds still for
 * reduced-motion users. Purely presentational — hidden from assistive tech.
 */
export function GlassTooth({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const webgl = useSyncExternalStore(noopSubscribe, detectWebGL, () => false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { rootMargin: "160px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fallback = (
    <div className="absolute inset-0 flex items-center justify-center p-[8%]">
      <GlassToothIllustration className="h-full w-auto max-w-full" />
    </div>
  );

  return (
    <div ref={ref} aria-hidden className={cn("relative", className)}>
      {/* Soft glow behind the tooth while (and after) the scene loads. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-[18%] rounded-full blur-3xl",
          tone === "dark" ? "bg-cyan/30" : "bg-cyan/20"
        )}
      />
      {hydrated && !webgl && fallback}
      {hydrated && webgl && seen && (
        <SceneBoundary fallback={fallback}>
          <div className="animate-fade-up absolute inset-0">
            <GlassToothScene tone={tone} animate={!reducedMotion} active={visible} />
          </div>
        </SceneBoundary>
      )}
    </div>
  );
}
