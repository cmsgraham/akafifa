"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { AUTH } from "@/constants/strings";
import { useEffect, useState } from "react";
import { NotificationBell } from "./notifications/NotificationBell";
import { BottomNav } from "./BottomNav";
import { PageTransition } from "@/lib/page-transition";
import { SwordsIcon, TargetIcon, BookOpenIcon, CogIcon, HelpCircleIcon } from "@/lib/icons";
import { Loader } from "@/lib/loader";

const NAV_ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/feed", label: "Arena" },
  { href: "/leaderboard", label: "Table" },
  { href: "/duels", label: "Duels" },
  { href: "/challenges", label: "Challenges" },
  { href: "/rules", label: "Rules" },
  { href: "/help", label: "Help" },
];

const MOBILE_MENU_ITEMS = [
  { href: "/duels", label: "Duels", Icon: SwordsIcon },
  { href: "/challenges", label: "Challenges", Icon: TargetIcon },
  { href: "/rules", label: "Rules", Icon: BookOpenIcon },
  { href: "/help", label: "Help", Icon: HelpCircleIcon },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isFeedPage = pathname === "/feed";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-rz-bg">
        <Loader />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-rz-bg overflow-x-hidden">
      {isFeedPage ? (
        <header className="sticky top-0 z-40 bg-rz-bg/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/home" className="p-1.5 -ml-1.5 rounded-md hover:bg-rz-surface-2 transition-colors text-rz-text-secondary hover:text-rz-text">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <Link href="/home" className="flex flex-col items-center gap-0.5">
              <img src="/redzone-logo-horizontal.png" alt="REDZONE" className="w-[75vw] max-w-xs object-contain hidden dark:block" />
              <img src="/redzone-logo-horizontal-light.png" alt="REDZONE" className="w-[75vw] max-w-xs object-contain dark:hidden" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-rz-text-muted">Arena</span>
            </Link>
            <NotificationBell />
          </div>
        </header>
      ) : (
      <nav className="bg-rz-surface border-b border-rz-border sticky top-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 min-w-0">
            {/* Logo */}
            <Link href="/home" className="shrink-0">
              <img src="/redzone-logo-horizontal.png" alt="REDZONE" className="h-8 object-contain hidden dark:block" />
              <img src="/redzone-logo-horizontal-light.png" alt="REDZONE" className="h-8 object-contain dark:hidden" />
            </Link>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? "text-rz-red bg-rz-red/10"
                        : "text-rz-text-secondary hover:text-rz-text hover:bg-rz-surface-2"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Desktop user menu */}
            <div className="hidden sm:flex items-center gap-3">
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-rz-red/10 text-rz-red hover:bg-rz-red/20 transition-colors"
                >
                  Admin
                </Link>
              )}
              <NotificationBell />
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md hover:bg-rz-surface-2 transition-colors text-rz-text-secondary hover:text-rz-text"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2}/><path strokeLinecap="round" strokeWidth={2} d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>
                )}
              </button>
              <Link
                href="/profile"
                className="text-sm text-rz-text-secondary hover:text-rz-text transition-colors"
              >
                {user.email}
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm rounded-md border border-rz-border-strong text-rz-text-secondary hover:text-rz-text hover:bg-rz-surface-2 transition-colors"
              >
                {AUTH.signOut}
              </button>
            </div>

            {/* Mobile: notification bell + hamburger */}
            <div className="flex sm:hidden items-center gap-1">
              <NotificationBell />
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="p-2 rounded-md hover:bg-rz-surface-2 transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5 text-rz-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-rz-border px-4 pb-4 pt-2 space-y-1 bg-rz-surface">
            {MOBILE_MENU_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "text-rz-red bg-rz-red/10"
                      : "text-rz-text-secondary hover:text-rz-text"
                  }`}
                >
                  <item.Icon className="w-4 h-4 inline-block mr-2" /> {item.label}
                </Link>
              );
            })}
            <div className="border-t border-rz-border my-2" />
            <button
              onClick={toggleTheme}
              className="w-full text-left px-3 py-2.5 rounded-md text-sm text-rz-text-secondary hover:text-rz-text transition-colors"
            >
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="block px-3 py-2.5 rounded-md text-sm font-semibold text-rz-red"
              >
                <CogIcon className="w-4 h-4 inline-block mr-1" /> Admin Panel
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2.5 rounded-md text-sm text-rz-red hover:bg-rz-red/10 transition-colors"
            >
              {AUTH.signOut}
            </button>
          </div>
        )}
      </nav>
      )}

      {/* Page content */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pb-24 sm:pb-6 min-w-0 ${isFeedPage ? 'pt-2' : 'py-6'}`}>
        {children}
      </main>

      <BottomNav />
      <PageTransition />
    </div>
  );
}
