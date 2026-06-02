"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Avatar } from "@/lib/avatar";

interface UserSuggestion {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  /** "textarea" or "input" mode */
  multiline?: boolean;
  className?: string;
  onSubmit?: () => void;
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  maxLength = 500,
  multiline = false,
  className = "",
  onSubmit,
}: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 1) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await apiFetch<{ data: UserSuggestion[] }>(
        `/users/search?q=${encodeURIComponent(q)}&limit=8`
      );
      setSuggestions(res.data);
      setShowDropdown(res.data.length > 0);
      setSelectedIdx(0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  const detectMention = useCallback(
    (text: string, cursorPos: number) => {
      // Look backward from cursor to find an @ that starts a mention
      const before = text.slice(0, cursorPos);
      const match = before.match(/@(\w[\w ]*)$/);
      if (match) {
        setMentionQuery(match[1]);
        setMentionStart(cursorPos - match[0].length);
        // Debounce the search
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => searchUsers(match[1]), 200);
      } else {
        setShowDropdown(false);
        setMentionQuery("");
        setMentionStart(-1);
      }
    },
    [searchUsers]
  );

  const insertMention = useCallback(
    (user: UserSuggestion) => {
      if (mentionStart < 0) return;
      const el = inputRef.current;
      const cursorPos = el?.selectionStart ?? value.length;
      const before = value.slice(0, mentionStart);
      const after = value.slice(cursorPos);
      const newValue = `${before}@${user.display_name} ${after}`;
      onChange(newValue);
      setShowDropdown(false);
      setMentionQuery("");
      setMentionStart(-1);
      // Restore cursor position after React re-render
      const newCursorPos = mentionStart + user.display_name.length + 2; // @name + space
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [mentionStart, value, onChange]
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newVal = e.target.value;
    onChange(newVal);
    detectMention(newVal, e.target.selectionStart ?? newVal.length);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[selectedIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }
    // Forward Enter (non-dropdown) to onSubmit for input mode
    if (!multiline && e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sharedProps = {
    ref: inputRef as any,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
    maxLength,
    className,
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea {...sharedProps} rows={3} style={{ resize: "none" }} />
      ) : (
        <input type="text" {...sharedProps} />
      )}

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-1 left-0 w-64 bg-rz-surface border border-rz-border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {suggestions.map((user, idx) => (
            <button
              key={user.id}
              type="button"
              onClick={() => insertMention(user)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                idx === selectedIdx
                  ? "bg-rz-red/10 text-rz-red"
                  : "hover:bg-rz-surface-2"
              }`}
            >
              <Avatar src={user.avatar_url} name={user.display_name} size="sm" />
              <span className="truncate">{user.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
