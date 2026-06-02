"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";

function majorSegment(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "matches" && parts[1]) return `matches/${parts[1]}`;
  if (parts[0] === "tournaments" && parts[1]) return `tournaments/${parts[1]}`;
  return parts[0] || "home";
}

const DURATION = 350;

export function PageTransition() {
  const pathname = usePathname();
  const prevSegment = useRef(majorSegment(pathname));
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const trigger = useCallback(() => {
    setTransitioning(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTransitioning(false), DURATION);
  }, []);

  useEffect(() => {
    const next = majorSegment(pathname);
    if (next !== prevSegment.current) {
      trigger();
      prevSegment.current = next;
    }
  }, [pathname, trigger]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div
      className={`pt-overlay ${transitioning ? "pt-active" : ""}`}
      aria-hidden="true"
    >
      <img
        src="/redzone-icon-white.png"
        alt=""
        className="pt-logo hidden dark:block"
        draggable={false}
      />
      <img
        src="/redzone-icon-black.png"
        alt=""
        className="pt-logo dark:hidden"
        draggable={false}
      />
    </div>
  );
}
