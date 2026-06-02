const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// Auth paths that must never trigger an auto-refresh loop. /auth/refresh is
// the refresh endpoint itself; the others either don't require auth or are
// part of the login/registration flow where a 401 should propagate.
const AUTH_BYPASS_PATHS = [
  "/auth/refresh",
  "/auth/login",
  "/auth/logout",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function isAuthBypass(path: string): boolean {
  return AUTH_BYPASS_PATHS.some((p) => path.startsWith(p));
}

// Single-flight refresh: if multiple requests get 401 in parallel they all
// await the same /auth/refresh call instead of stampeding the backend.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    }
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function rawFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  let res = await rawFetch(path, options);

  // Access token may have expired — try a silent refresh and replay once.
  if (res.status === 401 && !isAuthBypass(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await rawFetch(path, options);
    } else if (typeof window !== "undefined") {
      // Refresh failed → the session is truly gone. Redirect to login so
      // the user isn't stuck staring at a page that silently fails to load.
      const here = window.location.pathname;
      if (here !== "/login" && here !== "/welcome" && !here.startsWith("/register")) {
        window.location.replace("/login");
      }
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.detail || error.message || "API error");
  }

  return res.json();
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const doUpload = () =>
    fetch(`${API_BASE}/uploads/image`, {
      method: "POST",
      credentials: "include",
      body: form,
    });

  let res = await doUpload();
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await doUpload();
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.detail || error.message || "Upload failed");
  }
  const data = await res.json();
  return data.url;
}
