"use client";

import { useState, useRef, useCallback, useEffect, type MouseEvent as RMouseEvent, type TouchEvent as RTouchEvent, type CSSProperties } from "react";

/* ── Types ── */

export interface CropData {
  scale: number;
  x: number;
  y: number;
}

interface Props {
  src: string;
  shape: "circle" | "cover";
  initialCrop?: CropData | null;
  onSave: (crop: CropData) => void;
  onCancel: () => void;
  saving?: boolean;
}

/* ── Helpers ── */

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function maxTranslate(scale: number) {
  return (scale - 1) * 50;
}

function getPos(e: RMouseEvent | RTouchEvent | MouseEvent | TouchEvent) {
  if ("touches" in e && e.touches.length > 0) {
    return { cx: e.touches[0].clientX, cy: e.touches[0].clientY };
  }
  if ("clientX" in e) {
    return { cx: (e as MouseEvent).clientX, cy: (e as MouseEvent).clientY };
  }
  return { cx: 0, cy: 0 };
}

/* ── Component ── */

export function ImageAdjuster({ src, shape, initialCrop, onSave, onCancel, saving }: Props) {
  const [scale, setScale] = useState(initialCrop?.scale ?? 1);
  const [x, setX] = useState(initialCrop?.x ?? 0);
  const [y, setY] = useState(initialCrop?.y ?? 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ cx: 0, cy: 0 });

  // Clamp on scale change
  const mt = maxTranslate(scale);
  useEffect(() => {
    setX((prev) => clamp(prev, -mt, mt));
    setY((prev) => clamp(prev, -mt, mt));
  }, [mt]);

  const onPointerDown = useCallback((e: RMouseEvent | RTouchEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = getPos(e);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current || !containerRef.current) return;
      e.preventDefault();
      const pos = getPos(e);
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((pos.cx - lastPos.current.cx) / rect.width) * 100;
      const dy = ((pos.cy - lastPos.current.cy) / rect.height) * 100;
      lastPos.current = pos;
      const limit = maxTranslate(scale);
      setX((prev) => clamp(prev + dx, -limit, limit));
      setY((prev) => clamp(prev + dy, -limit, limit));
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [scale]);

  const previewCls =
    shape === "circle"
      ? "rounded-full w-48 h-48 mx-auto"
      : "rounded-xl w-full aspect-[3/1]";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-rz-surface rounded-2xl p-5 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold mb-4">Adjust Photo</h3>

        {/* Preview */}
        <div
          ref={containerRef}
          className={`relative overflow-hidden bg-black cursor-grab active:cursor-grabbing select-none ${previewCls}`}
          onMouseDown={onPointerDown}
          onTouchStart={onPointerDown}
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover pointer-events-none"
            style={{
              transformOrigin: "center",
              transform: `translate(${x}%, ${y}%) scale(${scale})`,
            }}
            draggable={false}
          />
        </div>

        <p className="text-[10px] text-rz-text-muted text-center mt-2">
          {scale > 1 ? "Drag to reposition" : "Zoom in, then drag to reposition"}
        </p>

        {/* Scale slider */}
        <div className="flex items-center gap-3 mt-3 px-2">
          {/* Zoom out icon */}
          <svg className="w-4 h-4 text-rz-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35M8 11h6" />
          </svg>
          <input
            type="range"
            min={1}
            max={5}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="flex-1 accent-rz-red h-1"
          />
          {/* Zoom in icon */}
          <svg className="w-4 h-4 text-rz-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35M11 8v6m-3-3h6" />
          </svg>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl border border-rz-border text-sm font-medium text-rz-text-secondary hover:bg-rz-surface-2 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ scale, x, y })}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl bg-rz-red text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Build inline style for rendering a cropped image. */
export function cropStyle(cropJson: string | null | undefined): CSSProperties {
  if (!cropJson) return {};
  try {
    const { scale = 1, x = 0, y = 0 } = JSON.parse(cropJson);
    if (scale === 1 && x === 0 && y === 0) return {};
    return {
      transformOrigin: "center",
      transform: `translate(${x}%, ${y}%) scale(${scale})`,
    };
  } catch {
    return {};
  }
}

/** Parse a crop JSON string into CropData. */
export function parseCrop(cropJson: string | null | undefined): CropData | null {
  if (!cropJson) return null;
  try {
    const { scale = 1, x = 0, y = 0 } = JSON.parse(cropJson);
    return { scale, x, y };
  } catch {
    return null;
  }
}
