"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface GiphyImage {
  url: string;
  width: string;
  height: string;
}

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height_small: GiphyImage;
    downsized: GiphyImage;
    original: GiphyImage;
  };
}

interface GiphyPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "";
const LIMIT = 24;
const GIPHY_CDN_PATTERN = /^https:\/\/media[0-9]*\.giphy\.com\//;

function isSafeGiphyUrl(url: string): boolean {
  try {
    return GIPHY_CDN_PATTERN.test(url);
  } catch {
    return false;
  }
}

export function GiphyPicker({ onSelect, onClose }: GiphyPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchGifs = useCallback(async (q: string) => {
    if (!API_KEY) {
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({
        api_key: API_KEY,
        limit: String(LIMIT),
        rating: "g",
      });
      if (q.trim()) params.set("q", q.trim());
      const endpoint = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?${params}`
        : `https://api.giphy.com/v1/gifs/trending?${params}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`GIPHY ${res.status}`);
      const data = (await res.json()) as { data: GiphyGif[] };
      setGifs(data.data ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setError(true);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifs("");
    inputRef.current?.focus();
  }, [fetchGifs]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(val), 400);
  };

  const handleSelect = (gif: GiphyGif) => {
    const url = gif.images.downsized?.url ?? gif.images.original?.url ?? "";
    if (!isSafeGiphyUrl(url)) return;
    onSelect(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="GIF picker"
    >
      <div
        className="bg-rz-surface rounded-t-2xl sm:rounded-2xl border border-rz-border w-full sm:max-w-sm max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rz-border shrink-0">
          <span className="text-sm font-semibold text-rz-text">Add a GIF</span>
          <button
            onClick={onClose}
            className="text-rz-text-muted hover:text-rz-text transition leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-rz-surface-2"
            aria-label="Close GIF picker"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 shrink-0">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search GIPHY…"
            className="w-full rounded-lg border border-rz-border bg-rz-surface-2 px-3 py-2 text-sm text-rz-text placeholder:text-rz-text-muted focus:outline-none focus:ring-2 focus:ring-rz-red transition"
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {!API_KEY ? (
            <p className="text-xs text-rz-text-muted text-center py-10 leading-relaxed">
              GIPHY API key not configured.
              <br />
              Set <code className="font-mono">NEXT_PUBLIC_GIPHY_API_KEY</code>.
            </p>
          ) : loading ? (
            <div className="flex justify-center py-10">
              <span className="text-xs text-rz-text-muted animate-pulse">Loading GIFs…</span>
            </div>
          ) : error ? (
            <p className="text-xs text-rz-text-muted text-center py-10">
              Failed to load GIFs.{errorMsg ? ` (${errorMsg})` : ""}<br />
              Check your API key.
            </p>
          ) : gifs.length === 0 ? (
            <p className="text-xs text-rz-text-muted text-center py-10">No GIFs found.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {gifs.map((gif) => {
                const thumb = gif.images.fixed_height_small?.url ?? "";
                if (!isSafeGiphyUrl(thumb)) return null;
                return (
                  <button
                    key={gif.id}
                    onClick={() => handleSelect(gif)}
                    className="relative aspect-square rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-rz-red"
                    title={gif.title}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={gif.title}
                      className="w-full h-full object-cover group-hover:opacity-75 transition duration-150"
                      loading="lazy"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {gifs.length > 0 && (
            <p className="text-center text-[10px] text-rz-text-muted mt-3 select-none">
              Powered by GIPHY
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
