import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { TimezoneProvider } from "@/lib/timezone-context";
import { ThemeProvider } from "@/lib/theme-context";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "REDZONE",
  description: "Predict. Compete. Dominate.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <body className="min-h-screen overflow-x-hidden">
        <ThemeProvider>
          <AuthProvider>
            <TimezoneProvider>{children}</TimezoneProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
