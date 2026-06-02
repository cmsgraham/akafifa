"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface MobilePageHeaderProps {
  title: string;
  backHref?: string;
  backLabel?: string;
  rightAction?: React.ReactNode;
}

export function MobilePageHeader({ title, backHref, backLabel, rightAction }: MobilePageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className="flex items-center gap-3 mb-4 sm:hidden -mt-2">
      <button
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-rz-text-secondary hover:text-rz-red transition-colors shrink-0"
        aria-label={backLabel || "Go back"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {backLabel && <span>{backLabel}</span>}
      </button>
      <h1 className="text-base font-semibold text-rz-text truncate flex-1">
        {title}
      </h1>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </div>
  );
}
