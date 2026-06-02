"use client";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "base" | "lg" | "xl" | "2xl";
  active?: boolean;
  className?: string;
}

const cfg: Record<string, { box: string; text: string }> = {
  xs:   { box: "w-5 h-5",   text: "text-[9px]"  },
  sm:   { box: "w-6 h-6",   text: "text-[10px]" },
  md:   { box: "w-7 h-7",   text: "text-[10px]" },
  base: { box: "w-8 h-8",   text: "text-xs"     },
  lg:   { box: "w-9 h-9",   text: "text-xs"     },
  xl:   { box: "w-16 h-16", text: "text-2xl"    },
  "2xl":{ box: "w-20 h-20", text: "text-3xl"    },
};

export function Avatar({ src, name, size = "base", active = false, className = "" }: AvatarProps) {
  const { box, text } = cfg[size];

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {active && (
        <>
          <span className="absolute -inset-[3px] rounded-full bg-gradient-to-br from-[#E11D2E] to-[#7F1D1D] rz-avatar-ring" />
          <span className="absolute -inset-[1.5px] rounded-full bg-[var(--rz-bg)]" />
        </>
      )}
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className={`${box} rounded-full object-cover relative`}
        />
      ) : (
        <span
          className={`${box} rounded-full bg-rz-red/10 flex items-center justify-center ${text} font-bold text-rz-red relative`}
        >
          {name?.[0]?.toUpperCase() || "?"}
        </span>
      )}
    </span>
  );
}
