"use client";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

export function Loader({ size = "md" }: LoaderProps) {
  return (
    <>
      <img
        src="/logo-white.png"
        alt=""
        className={`${sizes[size]} animate-rz-kick hidden dark:block`}
        draggable={false}
      />
      <img
        src="/logo-black.png"
        alt=""
        className={`${sizes[size]} animate-rz-kick block dark:hidden`}
        draggable={false}
      />
    </>
  );
}
