"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "./api";
import { useAuth } from "./auth-context";

interface TimezoneContextType {
  timezone: string;
  setTimezone: (tz: string) => void;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  formatDateTime: (iso: string) => string;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export const TIMEZONE_OPTIONS = [
  { value: "America/Costa_Rica", label: "🇨🇷 Costa Rica (CST)" },
  { value: "America/Mexico_City", label: "🇲🇽 Mexico City (CST/CDT)" },
  { value: "America/New_York", label: "🇺🇸 New York (EST/EDT)" },
  { value: "America/Chicago", label: "🇺🇸 Chicago (CST/CDT)" },
  { value: "America/Denver", label: "🇺🇸 Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "🇺🇸 Los Angeles (PST/PDT)" },
  { value: "America/Bogota", label: "🇨🇴 Bogotá (COT)" },
  { value: "America/Lima", label: "🇵🇪 Lima (PET)" },
  { value: "America/Buenos_Aires", label: "🇦🇷 Buenos Aires (ART)" },
  { value: "America/Sao_Paulo", label: "🇧🇷 São Paulo (BRT)" },
  { value: "Europe/London", label: "🇬🇧 London (GMT/BST)" },
  { value: "Europe/Madrid", label: "🇪🇸 Madrid (CET/CEST)" },
  { value: "Europe/Paris", label: "🇫🇷 Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "🇩🇪 Berlin (CET/CEST)" },
  { value: "Asia/Tokyo", label: "🇯🇵 Tokyo (JST)" },
  { value: "Asia/Dubai", label: "🇦🇪 Dubai (GST)" },
  { value: "UTC", label: "🌐 UTC" },
];

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [timezone, setTimezoneState] = useState("America/Costa_Rica");

  useEffect(() => {
    if (user) {
      apiFetch<{ timezone: string }>("/me/profile")
        .then((p) => {
          if (p.timezone) setTimezoneState(p.timezone);
        })
        .catch(() => {});
    }
  }, [user]);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
  }, []);

  const formatDate = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleDateString("es-CR", { timeZone: timezone });
      } catch {
        return new Date(iso).toLocaleDateString();
      }
    },
    [timezone]
  );

  const formatTime = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleTimeString("es-CR", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
    },
    [timezone]
  );

  const formatDateTime = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleString("es-CR", {
          timeZone: timezone,
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return new Date(iso).toLocaleString();
      }
    },
    [timezone]
  );

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, formatDate, formatTime, formatDateTime }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const ctx = useContext(TimezoneContext);
  if (!ctx) throw new Error("useTimezone must be used within TimezoneProvider");
  return ctx;
}
