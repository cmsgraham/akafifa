"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, uploadImage } from "@/lib/api";
import { RichBody, MediaPreview } from "@/lib/rich-content";
import { MentionInput } from "@/lib/mention-input";
import { useAuth } from "@/lib/auth-context";
import { useTimezone } from "@/lib/timezone-context";
import { CommentActionBar, ReplyActionRow, computeReactionUpdate, timeAgo } from "@/lib/social-reactions";
import { MobilePageHeader } from "../../../MobilePageHeader";
import { ImageIcon, TrashIcon, PencilIcon } from "@/lib/icons";
import { Loader } from "@/lib/loader";

interface Reply {
  id: string;
  body: string;
  display_name: string;
  user_id: string;
  created_at: string;
  reactions: Record<string, number>;
  my_reactions: string[];
}

interface Comment {
  id: string;
  match_id: string;
  user_id: string;
  display_name: string;
  body: string;
  media_url: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  reactions: Record<string, number>;
  my_reactions: string[];
  reply_count: number;
}

interface MatchInfo {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kick_off: string;
  status: string;
  stage_name: string;
}

export default function LoungePage({
  params,
}: {
  params: { id: string };
}) {
  const { user } = useAuth();
  const { formatDate, formatTime } = useTimezone();
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const currentUserId = user?.id ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reactions & replies
  const [expandedReplies, setExpandedReplies] = useState<Record<string, Reply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    apiFetch<MatchInfo>(`/matches/${params.id}`)
      .then((res) => setMatch(res))
      .catch(() => {});
  }, [params.id]);

  const fetchComments = async (cursor?: string | null) => {
    const qs = new URLSearchParams({ limit: "50" });
    if (cursor) qs.set("cursor", cursor);
    if (currentUserId) qs.set("uid", currentUserId);
    const res = await apiFetch<{
      data: Comment[];
      pagination: { next_cursor: string | null; has_more: boolean };
    }>(`/matches/${params.id}/comments?${qs}`);
    return res;
  };

  useEffect(() => {
    fetchComments()
      .then((res) => {
        setComments(res.data.reverse());
        setHasMore(res.pagination.has_more);
        setNextCursor(res.pagination.next_cursor);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  // Poll for new comments every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetchComments();
        setComments(res.data.reverse());
        setHasMore(res.pagination.has_more);
        setNextCursor(res.pagination.next_cursor);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [params.id]);

  const loadOlder = async () => {
    if (!nextCursor) return;
    const res = await fetchComments(nextCursor);
    setComments((prev) => [...res.data.reverse(), ...prev]);
    setHasMore(res.pagination.has_more);
    setNextCursor(res.pagination.next_cursor);
  };

  const handleSend = async () => {
    if ((!body.trim() && !mediaFile) || sending) return;
    setSending(true);
    try {
      let uploadedUrl: string | undefined;
      if (mediaFile) {
        setUploading(true);
        uploadedUrl = await uploadImage(mediaFile);
        setUploading(false);
      }
      const payload: { body: string; media_url?: string } = { body: body.trim() || "Photo" };
      if (uploadedUrl) payload.media_url = uploadedUrl;
      const res = await apiFetch<{ data: Comment }>(`/matches/${params.id}/comments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setComments((prev) => [...prev, res.data]);
      setBody("");
      setMediaFile(null);
      setMediaPreview(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {
    } finally {
      setUploading(false);
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/comments/${id}`, { method: "DELETE" });
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_deleted: true, body: "[deleted]" } : c))
      );
    } catch {}
  };

  // ── Reaction handler (single-reaction model) ──
  const handleReact = async (commentId: string, emoji: string, isReply?: boolean, parentId?: string) => {
    if (!user) return;

    let currentReactions: Record<string, number>;
    let currentMyReactions: string[];
    if (isReply && parentId) {
      const reply = (expandedReplies[parentId] || []).find((r) => r.id === commentId);
      if (!reply) return;
      currentReactions = reply.reactions || {};
      currentMyReactions = reply.my_reactions || [];
    } else {
      const item = comments.find((c) => c.id === commentId);
      if (!item) return;
      currentReactions = item.reactions || {};
      currentMyReactions = item.my_reactions || [];
    }

    const { reactions: newReactions, my_reactions: newMyReactions, apiCalls } =
      computeReactionUpdate(currentReactions, currentMyReactions, emoji);

    if (isReply && parentId) {
      setExpandedReplies((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] || []).map((r) =>
          r.id === commentId ? { ...r, reactions: newReactions, my_reactions: newMyReactions } : r
        ),
      }));
    } else {
      setComments((prev) =>
        prev.map((item) =>
          item.id === commentId ? { ...item, reactions: newReactions, my_reactions: newMyReactions } : item
        )
      );
    }

    try {
      for (const apiEmoji of apiCalls) {
        await apiFetch(`/comments/${commentId}/reactions`, {
          method: "POST",
          body: JSON.stringify({ emoji: apiEmoji }),
        });
      }
    } catch {}
  };

  // ── Replies ──
  const toggleReplies = async (commentId: string) => {
    if (expandedReplies[commentId]) {
      setExpandedReplies((prev) => { const next = { ...prev }; delete next[commentId]; return next; });
      return;
    }
    setLoadingReplies(commentId);
    try {
      const qs = new URLSearchParams();
      if (currentUserId) qs.set("uid", currentUserId);
      const res = await apiFetch<{ data: Reply[] }>(`/comments/${commentId}/replies?${qs}`);
      setExpandedReplies((prev) => ({ ...prev, [commentId]: res.data }));
    } catch {}
    setLoadingReplies(null);
  };

  const handleReply = async (parentId: string) => {
    if (!replyBody.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await apiFetch<{ data: Reply }>(`/comments/${parentId}/replies`, {
        method: "POST",
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      setExpandedReplies((prev) => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), res.data],
      }));
      setComments((prev) =>
        prev.map((c) => c.id === parentId ? { ...c, reply_count: c.reply_count + 1 } : c)
      );
      setReplyBody("");
      setReplyingTo(null);
    } catch {}
    setSendingReply(false);
  };

  const handleEdit = async (id: string) => {
    if (!editBody.trim()) return;
    try {
      await apiFetch(`/comments/${id}`, {
        method: "PUT",
        body: JSON.stringify({ body: editBody.trim() }),
      });
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, body: editBody.trim() } : c))
      );
      setEditingId(null);
      setEditBody("");
    } catch {}
  };

  const canEditOrDelete = (c: Comment) => {
    if (c.is_deleted || c.user_id !== currentUserId) return false;
    const elapsed = (Date.now() - new Date(c.created_at).getTime()) / 1000;
    return elapsed <= 300;
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col h-[calc(100vh-8rem)] sm:h-[calc(100vh-8rem)]">
      <MobilePageHeader title="Match Lounge" backHref={`/matches/${params.id}`} backLabel="Match" />
      <div className="hidden sm:flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Match Lounge</h1>
        <Link
          href={`/matches/${params.id}`}
          className="text-sm text-rz-red hover:underline"
        >
          ← Back to match
        </Link>
      </div>

      {match && (
        <div className="bg-rz-surface-2 rounded-lg px-4 py-3 mb-3 text-center">
          <span className="text-xs text-rz-text-muted">{match.stage_name}</span>
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="font-medium text-sm">{match.home_team}</span>
            <span className="font-mono font-bold text-lg">
              {match.home_score ?? "?"} - {match.away_score ?? "?"}
            </span>
            <span className="font-medium text-sm">{match.away_team}</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-[10px] text-rz-text-muted">
              {formatDate(match.kick_off)} at{" "}
              {formatTime(match.kick_off)}
            </span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                match.status === "live"
                  ? "bg-red-900/30 text-red-400"
                  : match.status === "finished" || match.status === "confirmed"
                  ? "bg-rz-surface-2 text-rz-text-muted"
                  : "bg-rz-red/10 text-rz-red"
              }`}
            >
              {match.status}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-rz-surface rounded-xl border border-rz-border p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : (
          <>
            {hasMore && (
              <button
                onClick={loadOlder}
                className="block mx-auto text-xs text-rz-red hover:underline mb-2"
              >
                Load older messages
              </button>
            )}
            {comments.length === 0 ? (
              <div className="text-center py-12 text-rz-text-muted">
                <p className="text-sm">No comments yet. Be the first to say something!</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 overflow-hidden ${
                      c.user_id === currentUserId
                        ? "bg-rz-red/10 ml-8 rounded-br-sm"
                        : "bg-rz-surface-2 mr-8 rounded-bl-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-rz-text">
                        {c.display_name}
                      </span>
                      <span className="text-[10px] text-rz-text-muted">
                        {formatTime(c.created_at)}
                      </span>
                    </div>
                    {editingId === c.id ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="flex-1 text-sm bg-rz-surface border border-rz-border rounded-lg px-2.5 py-1"
                          maxLength={500}
                        />
                        <button onClick={() => handleEdit(c.id)} className="text-xs text-rz-red font-medium">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-rz-text-muted">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <p className={`text-sm ${c.is_deleted ? "italic text-rz-text-muted" : "text-rz-text"}`}>
                          {c.is_deleted ? c.body : <RichBody text={c.body} />}
                        </p>
                        {c.media_url && !c.is_deleted && <MediaPreview url={c.media_url} />}
                      </>
                    )}

                    {/* Action bar */}
                    {!c.is_deleted && editingId !== c.id && (
                      <CommentActionBar
                        myReaction={(c.my_reactions || [])[0] || null}
                        reactionCounts={c.reactions || {}}
                        replyCount={c.reply_count || 0}
                        onReact={(emoji) => handleReact(c.id, emoji)}
                        onReplyClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyBody(""); if (!expandedReplies[c.id] && (c.reply_count || 0) > 0) toggleReplies(c.id); }}
                      >
                        {canEditOrDelete(c) && (
                          <>
                            <button onClick={() => { setEditingId(c.id); setEditBody(c.body); }}
                              className="text-rz-text-muted hover:text-blue-400 transition p-1 rounded hover:bg-blue-900/20" title="Edit"><PencilIcon className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDelete(c.id)}
                              className="text-rz-text-muted hover:text-red-400 transition p-1 rounded hover:bg-red-900/20" title="Delete"><TrashIcon className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </CommentActionBar>
                    )}
                  </div>

                  {/* Replies */}
                  {(c.reply_count || 0) > 0 && !expandedReplies[c.id] && replyingTo !== c.id && (
                    <button onClick={() => toggleReplies(c.id)}
                      className="ml-10 mt-1 text-[10px] text-rz-red hover:underline">
                      {loadingReplies === c.id ? "Loading…" : `View ${c.reply_count} ${c.reply_count === 1 ? "reply" : "replies"}`}
                    </button>
                  )}
                  {expandedReplies[c.id] && (
                    <div className="ml-6 mt-1.5 space-y-1.5">
                      {expandedReplies[c.id].map(r => (
                        <div key={r.id} className="bg-rz-surface-2 rounded-2xl rounded-tl-sm px-3 py-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-rz-text">{r.display_name}</span>
                            <span className="text-[10px] text-rz-text-muted">{timeAgo(r.created_at)}</span>
                          </div>
                          <p className="text-xs text-rz-text-secondary"><RichBody text={r.body} /></p>
                          <ReplyActionRow
                            myReaction={(r.my_reactions || [])[0] || null}
                            reactionCounts={r.reactions || {}}
                            onReact={(emoji) => handleReact(r.id, emoji, true, c.id)}
                          />
                        </div>
                      ))}
                      <button onClick={() => toggleReplies(c.id)} className="text-[10px] text-rz-text-muted hover:underline">Hide replies</button>
                    </div>
                  )}

                  {/* Reply input */}
                  {replyingTo === c.id && (
                    <div className="ml-6 mt-1.5 flex gap-2 items-center">
                      <input value={replyBody} onChange={e => setReplyBody(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(c.id); }}}
                        placeholder="Write a reply…" maxLength={500}
                        className="flex-1 text-xs bg-rz-surface border border-rz-border rounded-full px-3.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rz-red transition" />
                      <button onClick={() => handleReply(c.id)} disabled={sendingReply || !replyBody.trim()}
                        className="bg-rz-red text-white px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
                        {sendingReply ? "…" : "Send"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {mediaPreview && (
          <div className="relative inline-block">
            <img src={mediaPreview} alt="Preview" className="max-h-32 rounded-lg object-cover" />
            <button
              onClick={() => { setMediaFile(null); setMediaPreview(null); }}
              className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <label
            className="px-2 py-2 rounded-lg border border-rz-border hover:bg-rz-surface-2 transition cursor-pointer flex items-center"
            title="Attach photo"
          >
            <ImageIcon className="w-5 h-5 text-rz-text-muted" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setMediaFile(f);
                  setMediaPreview(URL.createObjectURL(f));
                }
                e.target.value = "";
              }}
            />
          </label>
          <MentionInput
            value={body}
            onChange={setBody}
            onSubmit={handleSend}
            placeholder="Type a message… (use @ to mention)"
            maxLength={500}
            className="flex-1 rounded-lg border border-rz-border bg-rz-surface px-4 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
          />
          <button
            onClick={handleSend}
            disabled={sending || (!body.trim() && !mediaFile)}
            className="bg-rz-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {uploading ? "Uploading…" : sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
