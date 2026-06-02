"use client";

import { useRef, useEffect } from "react";

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterCardsProps {
  options: FilterOption[];
  selected: string;
  onChange: (id: string) => void;
}

export function FilterCards({ options, selected, onChange }: FilterCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll selected pill into view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const idx = options.findIndex((o) => o.id === selected);
    const el = container.children[idx] as HTMLElement | undefined;
    if (!el) return;
    const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
    container.scrollTo({ left, behavior: "smooth" });
  }, [selected, options]);

  // Desktop: vertical wheel → horizontal scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex gap-1.5 overflow-x-auto scroll-smooth pb-0.5"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {options.map((opt) => {
        const isActive = opt.id === selected;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`
              flex-shrink-0 flex items-center gap-1.5
              rounded-lg px-3 py-1.5 transition-all
              text-xs font-medium select-none whitespace-nowrap
              ${isActive
                ? "bg-rz-red/10 text-rz-red border border-rz-red/40"
                : "bg-rz-surface text-rz-text-secondary border border-rz-border hover:border-rz-border-strong hover:text-rz-text"
              }
            `}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={`text-[10px] tabular-nums ${
                  isActive ? "text-rz-red/70" : "text-rz-text-muted"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
