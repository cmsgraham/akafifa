"use client";

import React, { useRef, useCallback, useState, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { HeartIcon, ChatIcon } from "./icons";

export const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const EMOJI_LABELS: Record<string, string> = {
  "👍": "Like",
  "❤️": "Love",
  "😂": "Haha",
  "😮": "Wow",
  "😢": "Sad",
  "🔥": "Fire",
};

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function computeReactionUpdate(
  reactions: Record<string, number>,
  myReactions: string[],
  selectedEmoji: string,
): { reactions: Record<string, number>; my_reactions: string[]; apiCalls: string[] } {
  const current = myReactions[0] || null;
  const next = { ...reactions };
  const apiCalls: string[] = [];
  let nextMy: string[];

  if (current === selectedEmoji) {
    next[selectedEmoji] = Math.max(0, (next[selectedEmoji] || 0) - 1);
    if (next[selectedEmoji] === 0) delete next[selectedEmoji];
    nextMy = [];
    apiCalls.push(selectedEmoji);
  } else {
    if (current) {
      next[current] = Math.max(0, (next[current] || 0) - 1);
      if (next[current] === 0) delete next[current];
      apiCalls.push(current);
    }
    next[selectedEmoji] = (next[selectedEmoji] || 0) + 1;
    nextMy = [selectedEmoji];
    apiCalls.push(selectedEmoji);
  }

  return { reactions: next, my_reactions: nextMy, apiCalls };
}

/* ── Floating emoji tray (portal) ── */
function FloatingTray({
  onSelect,
  currentReaction,
  anchorRef,
  trayHover,
}: {
  onSelect: (emoji: string) => void;
  currentReaction: string | null;
  anchorRef: React.RefObject<HTMLElement | null>;
  trayHover: { onMouseEnter: () => void; onMouseLeave: () => void };
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ left: rect.left, top: rect.top - 6 });
    }
  }, [anchorRef]);

  if (!mounted || !pos) return null;

  return createPortal(
    <div
      style={{ position: "fixed", left: pos.left, top: pos.top, transform: "translateY(-100%)", zIndex: 9999 }}
      onMouseEnter={trayHover.onMouseEnter}
      onMouseLeave={trayHover.onMouseLeave}
    >
      <div className="flex gap-0.5 bg-rz-surface rounded-full px-2 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.25)] border border-rz-border animate-reaction-tray">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); onSelect(emoji); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(emoji); }}
            className="group relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-rz-surface-2 transition-all duration-150"
          >
            <span className={`text-lg transition-all duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${
              currentReaction === emoji ? "scale-[1.3] -translate-y-0.5" : "group-hover:scale-[1.3] group-hover:-translate-y-1"
            }`}>{emoji}</span>
          </button>
        ))}
      </div>
      <div className="w-full h-1.5" />
    </div>,
    document.body,
  );
}

/* ── Hover / long-press tray behavior ── */
function useTrayBehavior() {
  const [isOpen, setIsOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const lpTimer = useRef<ReturnType<typeof setTimeout>>();
  const didLP = useRef(false);

  const cancelClose = useCallback(() => { clearTimeout(closeTimer.current); }, []);
  const startClose = useCallback(() => {
    clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setIsOpen(false), 200);
  }, []);

  const onMouseEnter = useCallback(() => { cancelClose(); openTimer.current = setTimeout(() => setIsOpen(true), 400); }, [cancelClose]);
  const onMouseLeave = useCallback(() => { startClose(); }, [startClose]);
  const onTouchStart = useCallback(() => { didLP.current = false; lpTimer.current = setTimeout(() => { didLP.current = true; setIsOpen(true); }, 500); }, []);
  const onTouchEnd = useCallback(() => { clearTimeout(lpTimer.current); }, []);
  const onTouchMove = useCallback(() => { clearTimeout(lpTimer.current); }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const wasLP = useCallback(() => didLP.current, []);

  return {
    isOpen, close, wasLP,
    hover: { onMouseEnter, onMouseLeave },
    trayHover: { onMouseEnter: cancelClose, onMouseLeave: startClose },
    touch: { onTouchStart, onTouchEnd, onTouchMove },
  };
}

function totalReactions(r: Record<string, number>): number {
  return Object.values(r).reduce((a, b) => a + b, 0);
}

/* ── Comment Action Bar (Instagram-style icon row) ── */
export function CommentActionBar({
  myReaction,
  reactionCounts,
  replyCount,
  onReact,
  onReplyClick,
  children,
}: {
  myReaction: string | null;
  reactionCounts: Record<string, number>;
  replyCount: number;
  onReact: (emoji: string) => void;
  onReplyClick: () => void;
  children?: React.ReactNode;
}) {
  const tray = useTrayBehavior();
  const likeRef = useRef<HTMLDivElement>(null);
  const total = totalReactions(reactionCounts);
  const isLiked = !!myReaction;

  return (
    <div className="flex items-center gap-4 mt-2">
      {/* Like */}
      <div ref={likeRef} className="relative flex items-center" {...tray.hover}>
        <button
          onClick={() => { if (!tray.wasLP()) onReact(myReaction || "❤️"); }}
          {...tray.touch}
          className="flex items-center gap-1.5 group select-none"
        >
          <HeartIcon
            className={`w-[18px] h-[18px] transition-all duration-150 ${
              isLiked ? "text-rz-red scale-110" : "text-rz-text-muted group-hover:text-rz-text-secondary"
            }`}
            filled={isLiked}
          />
          {total > 0 && (
            <span className={`text-xs tabular-nums ${isLiked ? "text-rz-red font-medium" : "text-rz-text-muted"}`}>
              {total}
            </span>
          )}
        </button>
        {tray.isOpen && (
          <FloatingTray
            onSelect={(e) => { onReact(e); tray.close(); }}
            currentReaction={myReaction}
            anchorRef={likeRef}
            trayHover={tray.trayHover}
          />
        )}
      </div>

      {/* Reply */}
      <button
        onClick={onReplyClick}
        className="flex items-center gap-1.5 group select-none"
      >
        <ChatIcon className="w-[18px] h-[18px] text-rz-text-muted group-hover:text-rz-text-secondary transition" />
        {replyCount > 0 && (
          <span className="text-xs text-rz-text-muted tabular-nums">{replyCount}</span>
        )}
      </button>

      {/* Extra actions (delete, etc.) */}
      {children && <div className="flex items-center gap-1 ml-auto">{children}</div>}
    </div>
  );
}

/* ── Reply Action Row (compact) ── */
export function ReplyActionRow({
  myReaction,
  reactionCounts,
  onReact,
}: {
  myReaction: string | null;
  reactionCounts: Record<string, number>;
  onReact: (emoji: string) => void;
}) {
  const tray = useTrayBehavior();
  const likeRef = useRef<HTMLDivElement>(null);
  const total = totalReactions(reactionCounts);
  const isLiked = !!myReaction;

  return (
    <div className="flex items-center gap-2 mt-1">
      <div ref={likeRef} className="relative flex items-center" {...tray.hover}>
        <button
          onClick={() => { if (!tray.wasLP()) onReact(myReaction || "❤️"); }}
          {...tray.touch}
          className="flex items-center gap-1 group select-none"
        >
          <HeartIcon
            className={`w-3.5 h-3.5 transition-all duration-150 ${
              isLiked ? "text-rz-red" : "text-rz-text-muted group-hover:text-rz-text-secondary"
            }`}
            filled={isLiked}
          />
          {total > 0 && (
            <span className={`text-[11px] tabular-nums ${isLiked ? "text-rz-red" : "text-rz-text-muted"}`}>
              {total}
            </span>
          )}
        </button>
        {tray.isOpen && (
          <FloatingTray
            onSelect={(e) => { onReact(e); tray.close(); }}
            currentReaction={myReaction}
            anchorRef={likeRef}
            trayHover={tray.trayHover}
          />
        )}
      </div>
    </div>
  );
}
