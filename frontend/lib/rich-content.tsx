"use client";

import React from "react";
import { LinkIcon } from "./icons";

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const VIDEO_EXT = /\.(mp4|webm|mov)(\?.*)?$/i;
const MENTION_REGEX = /(@\w[\w ]*\w|@\w)/g;

export function getYouTubeId(url: string): string | null {
  const m = url.match(YOUTUBE_REGEX);
  return m ? m[1] : null;
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXT.test(url);
}

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXT.test(url);
}

export function RichBody({ text }: { text: string }) {
  // Split by URLs and @mentions
  const COMBINED = /(https?:\/\/[^\s<]+|@\w[\w ]*\w|@\w)/g;
  const parts = text.split(COMBINED);
  return (
    <>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part.length > 60 ? part.slice(0, 57) + "…" : part}
            </a>
          );
        }
        if (MENTION_REGEX.test(part)) {
          return (
            <span
              key={i}
              className="inline-block bg-rz-red/15 text-rz-red font-semibold text-xs px-1.5 py-0.5 rounded-full mx-0.5"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function MediaPreview({ url }: { url: string }) {
  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden aspect-video w-full">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}`}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="YouTube video"
        />
      </div>
    );
  }

  if (isImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block mt-2 overflow-hidden rounded-lg">
        <img
          src={url}
          alt="Shared image"
          className="block w-full h-auto max-h-96 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
          loading="lazy"
        />
      </a>
    );
  }

  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        controls
        className="mt-2 rounded-lg w-full max-h-96"
        preload="metadata"
      />
    );
  }

  // Generic link preview card
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-rz-surface-2 hover:bg-rz-surface-2 transition text-sm w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-blue-500"><LinkIcon className="w-4 h-4 inline" /></span>
      <span className="truncate text-blue-600 dark:text-blue-400">{url.replace(/^https?:\/\//, "").slice(0, 50)}</span>
    </a>
  );
}
