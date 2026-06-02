"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { apiFetch, uploadImage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RichBody, MediaPreview } from "@/lib/rich-content";
import { MentionInput } from "@/lib/mention-input";
import { CommentActionBar, ReplyActionRow, computeReactionUpdate, timeAgo } from "@/lib/social-reactions";
import { ImageIcon, TrashIcon, GifIcon } from "@/lib/icons";
import { GiphyPicker } from "@/components/ui/GiphyPicker";
import { Avatar } from "@/lib/avatar";
import { Loader } from "@/lib/loader";

interface FeedMatch {
  id: string;
  home_team: string;
  away_team: string;
  stage_name: string;
  status: string;
  kick_off: string;
}

interface Reply {
  id: string;
  body: string;
  display_name: string;
  avatar_url: string | null;
  user_id: string;
  created_at: string;
  reactions: Record<string, number>;
  my_reactions: string[];
}

interface FeedItem {
  id: string;
  body: string;
  media_url: string | null;
  display_name: string;
  avatar_url: string | null;
  user_id: string;
  created_at: string;
  match: FeedMatch | null;
  reactions: Record<string, number>;
  my_reactions: string[];
  reply_count: number;
  // Activity item fields (null for regular posts)
  activity_type?: string | null;
  activity_title?: string | null;
  activity_cta_url?: string | null;
  activity_cta_label?: string | null;
  activity_metadata?: Record<string, unknown> | null;
}

export default function FeedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [postBody, setPostBody] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreview, setPostPreview] = useState<string | null>(null);
  const [postGifUrl, setPostGifUrl] = useState<string | null>(null);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  // Replies
  const [expandedReplies, setExpandedReplies] = useState<Record<string, Reply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchFeed = useCallback(async (cursor?: string | null) => {
    const params = new URLSearchParams({ limit: "30" });
    if (cursor) params.set("cursor", cursor);
    if (user?.id) params.set("uid", user.id);
    return apiFetch<{
      data: FeedItem[];
      pagination: { next_cursor: string | null; has_more: boolean };
    }>(`/feed?${params}`);
  }, [user?.id]);

  useEffect(() => {
    fetchFeed()
      .then((res) => {
        setItems(res.data);
        setHasMore(res.pagination.has_more);
        setNextCursor(res.pagination.next_cursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchFeed]);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetchFeed();
        setItems(res.data);
        setHasMore(res.pagination.has_more);
        setNextCursor(res.pagination.next_cursor);
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchFeed(nextCursor);
      setItems((prev) => [...prev, ...res.data]);
      setHasMore(res.pagination.has_more);
      setNextCursor(res.pagination.next_cursor);
    } catch {}
    setLoadingMore(false);
  };

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const statusColor = (s: string) => {
    if (s === "live") return "bg-red-900/30 text-red-400";
    if (s === "finished" || s === "confirmed") return "bg-rz-surface-2 text-rz-text-muted";
    return "bg-rz-red/10 text-rz-red";
  };

  const handlePost = async () => {
    if ((!postBody.trim() && !postFile && !postGifUrl) || posting) return;
    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      if (postGifUrl) {
        mediaUrl = postGifUrl;
      } else if (postFile) {
        setUploading(true);
        mediaUrl = await uploadImage(postFile);
        setUploading(false);
      }
      const payload: { body: string; media_url?: string } = { body: postBody.trim() || "" };
      if (mediaUrl) payload.media_url = mediaUrl;
      const res = await apiFetch<{ data: FeedItem }>("/feed", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setItems((prev) => [res.data, ...prev]);
      setPostBody("");
      setPostFile(null);
      setPostPreview(null);
      setPostGifUrl(null);
    } catch {}
    setUploading(false);
    setPosting(false);
  };

  // ── Reaction handler (single-reaction model) ──
  const handleReact = async (commentId: string, emoji: string, isReply?: boolean, parentId?: string) => {
    if (!user) return;

    // Get current state
    let currentReactions: Record<string, number>;
    let currentMyReactions: string[];
    if (isReply && parentId) {
      const reply = (expandedReplies[parentId] || []).find((r) => r.id === commentId);
      if (!reply) return;
      currentReactions = reply.reactions || {};
      currentMyReactions = reply.my_reactions || [];
    } else {
      const item = items.find((i) => i.id === commentId);
      if (!item) return;
      currentReactions = item.reactions || {};
      currentMyReactions = item.my_reactions || [];
    }

    const { reactions: newReactions, my_reactions: newMyReactions, apiCalls } =
      computeReactionUpdate(currentReactions, currentMyReactions, emoji);

    // Optimistic update
    if (isReply && parentId) {
      setExpandedReplies((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] || []).map((r) =>
          r.id === commentId ? { ...r, reactions: newReactions, my_reactions: newMyReactions } : r
        ),
      }));
    } else {
      setItems((prev) =>
        prev.map((item) =>
          item.id === commentId ? { ...item, reactions: newReactions, my_reactions: newMyReactions } : item
        )
      );
    }

    // Fire API calls sequentially
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
      setExpandedReplies((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
      return;
    }
    setLoadingReplies(commentId);
    try {
      const params = new URLSearchParams();
      if (user?.id) params.set("uid", user.id);
      const res = await apiFetch<{ data: Reply[] }>(`/comments/${commentId}/replies?${params}`);
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
      setItems((prev) =>
        prev.map((item) => item.id === parentId ? { ...item, reply_count: item.reply_count + 1 } : item)
      );
      setReplyBody("");
      setReplyingTo(null);
    } catch {}
    setSendingReply(false);
  };

  // ── Delete ──
  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this post?")) return;
    try {
      await apiFetch(`/comments/${commentId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== commentId));
    } catch {}
  };

  // Group feed items by match so comments on the same game appear together
  const grouped = useMemo(() => {
    const groups: { match: FeedMatch | null; items: FeedItem[] }[] = [];
    const matchIndex = new Map<string, number>();
    items.forEach((item) => {
      // Activity items always get their own group (never grouped with match posts)
      if (item.activity_type) {
        groups.push({ match: null, items: [item] });
        return;
      }
      const matchId = item.match?.id;
      if (matchId && matchIndex.has(matchId)) {
        groups[matchIndex.get(matchId)!].items.push(item);
      } else {
        const idx = groups.length;
        groups.push({ match: item.match, items: [item] });
        if (matchId) matchIndex.set(matchId, idx);
      }
    });
    return groups;
  }, [items]);

  return (
    <div className="max-w-xl mx-auto">
      {/* Compose box */}
      <div className="bg-rz-surface rounded-xl border border-rz-border p-4 mb-6">
        <MentionInput
          value={postBody}
          onChange={setPostBody}
          placeholder="What's on your mind? (use @ to mention)"
          maxLength={500}
          multiline
          className="w-full rounded-lg border border-rz-border bg-rz-surface-2 px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
        />
        {(postPreview || postGifUrl) && (
          <div className="relative mt-2 inline-block">
            <img src={postPreview ?? postGifUrl!} alt="Preview" className="max-h-48 rounded-lg object-cover" />
            <button
              onClick={() => { setPostFile(null); setPostPreview(null); setPostGifUrl(null); }}
              className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition"
              type="button"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-rz-text-muted hover:text-rz-red transition flex items-center gap-1.5 cursor-pointer" title="Upload image">
              <ImageIcon className="w-5 h-5" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPostFile(f);
                    setPostPreview(URL.createObjectURL(f));
                    setPostGifUrl(null);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setShowGiphyPicker(true)}
              className="text-sm text-rz-text-muted hover:text-rz-red transition flex items-center cursor-pointer"
              title="Add a GIF"
            >
              <GifIcon className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={handlePost}
            disabled={posting || (!postBody.trim() && !postFile && !postGifUrl)}
            className="bg-rz-red text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {uploading ? "Uploading…" : posting ? "Posting…" : "Post"}
          </button>
        </div>
        {showGiphyPicker && (
          <GiphyPicker
            onSelect={(url) => {
              setPostGifUrl(url);
              setPostFile(null);
              setPostPreview(null);
              setShowGiphyPicker(false);
            }}
            onClose={() => setShowGiphyPicker(false)}
          />
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-rz-text-muted">
          <p className="text-sm">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group, gi) => (
            <div
              key={group.match?.id || `post-${group.items[0]?.id}`}
              className="bg-rz-surface rounded-xl border border-rz-border"
            >
              {/* Match header – shown once per group */}
              {group.match && (
                <Link
                  href={`/matches/${group.match.id}/lounge`}
                  className="flex items-center justify-between px-4 py-2.5 bg-rz-surface-2 hover:bg-rz-surface-2/80 transition border-b border-rz-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-rz-text-muted shrink-0">{group.match.stage_name}</span>
                    <span className="font-medium text-sm truncate">
                      {group.match.home_team} vs {group.match.away_team}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {group.items.length > 1 && (
                      <span className="text-[10px] text-rz-text-muted">{group.items.length} comments</span>
                    )}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColor(group.match.status)}`}>
                      {group.match.status}
                    </span>
                  </div>
                </Link>
              )}

              {/* Comments in this group */}
              {group.items.map((item, ii) => {
              // ── Activity card ──
              if (item.activity_type) {
                const meta = item.activity_metadata || {};
                const isChallenge = item.activity_type === "flash_challenge_published";
                const isDuel = item.activity_type === "duel_created";

                // Shared reaction/reply block for activity cards
                const activityActions = (
                  <>
                    <CommentActionBar
                      myReaction={(item.my_reactions || [])[0] || null}
                      reactionCounts={item.reactions || {}}
                      replyCount={item.reply_count}
                      onReact={(emoji) => handleReact(item.id, emoji)}
                      onReplyClick={() => {
                        if (replyingTo === item.id) { setReplyingTo(null); }
                        else { setReplyingTo(item.id); if (!expandedReplies[item.id]) toggleReplies(item.id); }
                      }}
                    />

                    {(expandedReplies[item.id] || loadingReplies === item.id) && (
                      <div className="mt-3 space-y-2">
                        {item.reply_count > 0 && !expandedReplies[item.id] && loadingReplies === item.id && (
                          <p className="text-xs text-rz-text-muted">Loading replies…</p>
                        )}
                        {(expandedReplies[item.id] || []).map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2">
                            <Link href={`/users/${reply.user_id}`} className="shrink-0">
                              <Avatar src={reply.avatar_url} name={reply.display_name} size="sm" />
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-1.5">
                                <Link href={`/users/${reply.user_id}`} className="text-xs font-semibold text-rz-text hover:text-rz-red hover:underline transition">{reply.display_name}</Link>
                                <span className="text-[10px] text-rz-text-muted">{timeAgo(reply.created_at)}</span>
                              </div>
                              <div className="mt-0.5 max-w-full">
                                <p className="text-xs text-rz-text-secondary leading-relaxed"><RichBody text={reply.body} /></p>
                              </div>
                              <ReplyActionRow
                                myReaction={(reply.my_reactions || [])[0] || null}
                                reactionCounts={reply.reactions || {}}
                                onReact={(emoji) => handleReact(reply.id, emoji, true, item.id)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {replyingTo === item.id && user && (
                      <div className="mt-2 flex gap-2 items-center">
                        <input
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Write a reply…"
                          maxLength={500}
                          className="flex-1 rounded-full border border-rz-border bg-rz-surface-2 px-3.5 py-1.5 text-xs text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red transition"
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(item.id); } }}
                        />
                        <button
                          onClick={() => handleReply(item.id)}
                          disabled={sendingReply || !replyBody.trim()}
                          className="bg-rz-red text-white px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-rz-red-hover disabled:opacity-50 transition"
                        >
                          {sendingReply ? "…" : "Reply"}
                        </button>
                      </div>
                    )}
                  </>
                );

                if (isChallenge) {
                  const metaLine = [
                    meta.participation_cost ? `${String(meta.participation_cost)} pts entry` : null,
                    meta.reward_points ? `${String(meta.reward_points)} pts reward` : null,
                    meta.tournament_name ? String(meta.tournament_name) : null,
                  ].filter(Boolean).join(" · ");

                  return (
                    <div key={item.id} className="px-4 py-4">
                      <div className="border-l-2 border-rz-red pl-4 space-y-3">
                        {/* Top row */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-rz-red">
                            ⚡ Flash Challenge
                          </span>
                          <span className="text-[11px] text-rz-text-muted">{timeAgo(item.created_at)}</span>
                        </div>

                        {/* Question */}
                        <p className="text-[15px] font-semibold leading-snug text-rz-text">
                          {String(meta.challenge_title || item.activity_title || "")}
                        </p>

                        {/* Metadata line */}
                        {metaLine ? (
                          <p className="text-xs text-rz-text-muted">{metaLine}</p>
                        ) : null}

                        {/* CTA */}
                        {item.activity_cta_url ? (
                          <Link
                            href={item.activity_cta_url}
                            className="inline-flex items-center text-xs font-semibold text-rz-red hover:text-rz-red-hover transition"
                          >
                            {item.activity_cta_label || "View"} →
                          </Link>
                        ) : null}

                        {activityActions}
                      </div>
                    </div>
                  );
                }

                if (isDuel) {
                  const matchLine = meta.match_home_team
                    ? `${String(meta.match_home_team)} vs ${String(meta.match_away_team)}`
                    : null;

                  return (
                    <div key={item.id} className="px-4 py-4">
                      <div className="border-l-2 border-rz-border-strong pl-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-rz-text-muted">
                            ⚔️ Duel
                          </span>
                          <span className="text-[11px] text-rz-text-muted">{timeAgo(item.created_at)}</span>
                        </div>

                        <p className="text-[15px] font-semibold leading-snug text-rz-text">
                          {String(item.activity_title || "")}
                        </p>

                        <p className="text-xs text-rz-text-muted">
                          {[
                            meta.stake_points ? `${String(meta.stake_points)} pts stake` : null,
                            matchLine,
                          ].filter(Boolean).join(" · ")}
                        </p>

                        {item.activity_cta_url ? (
                          <Link
                            href={item.activity_cta_url}
                            className="inline-flex items-center text-xs font-semibold text-rz-text-secondary hover:text-rz-text transition"
                          >
                            {item.activity_cta_label || "View"} →
                          </Link>
                        ) : null}

                        {activityActions}
                      </div>
                    </div>
                  );
                }

                // Generic fallback for other activity types
                return (
                  <div key={item.id} className="px-4 py-4">
                    <div className="border-l-2 border-rz-border pl-4 space-y-2">
                      <p className="text-sm text-rz-text">{String(item.activity_title || item.body)}</p>
                      <span className="text-[11px] text-rz-text-muted">{timeAgo(item.created_at)}</span>
                      {activityActions}
                    </div>
                  </div>
                );
              }

              // ── Regular post ──
              return (
              <div key={item.id} className={ii > 0 ? "border-t border-rz-border" : ""}>
                <div className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <Link href={`/users/${item.user_id}`} className="shrink-0">
                      <Avatar src={item.avatar_url} name={item.display_name} size="lg" />
                    </Link>

                    {/* Content column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link href={`/users/${item.user_id}`} className="text-[13px] font-semibold text-rz-text hover:text-rz-red hover:underline transition">
                          {item.display_name}
                        </Link>
                        <span className="text-[10px] text-rz-text-muted">{timeAgo(item.created_at)}</span>
                      </div>

                      {/* Body */}
                      <div className="mt-1 max-w-full">
                        <p className="text-sm text-rz-text leading-relaxed"><RichBody text={item.body} /></p>
                        {item.media_url && <div className="mt-2 overflow-hidden rounded-lg"><MediaPreview url={item.media_url} /></div>}
                      </div>

                      {/* Action bar (single source of truth for reactions + actions) */}
                      <CommentActionBar
                        myReaction={(item.my_reactions || [])[0] || null}
                        reactionCounts={item.reactions || {}}
                        replyCount={item.reply_count}
                        onReact={(emoji) => handleReact(item.id, emoji)}
                        onReplyClick={() => {
                          if (replyingTo === item.id) { setReplyingTo(null); }
                          else { setReplyingTo(item.id); if (!expandedReplies[item.id]) toggleReplies(item.id); }
                        }}
                      >
                        {user && (user.id === item.user_id || user.role === "admin") && (
                          <button onClick={() => handleDelete(item.id)} className="text-rz-text-muted hover:text-red-400 transition p-1 rounded hover:bg-red-900/20" title="Delete">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </CommentActionBar>

                      {/* Replies */}
                      {(expandedReplies[item.id] || loadingReplies === item.id) && (
                        <div className="mt-3 space-y-2">
                          {item.reply_count > 0 && !expandedReplies[item.id] && loadingReplies === item.id && (
                            <p className="text-xs text-rz-text-muted">Loading replies…</p>
                          )}
                          {(expandedReplies[item.id] || []).map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <Link href={`/users/${reply.user_id}`} className="shrink-0">
                                <Avatar src={reply.avatar_url} name={reply.display_name} size="sm" />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-1.5">
                                  <Link href={`/users/${reply.user_id}`} className="text-xs font-semibold text-rz-text hover:text-rz-red hover:underline transition">{reply.display_name}</Link>
                                  <span className="text-[10px] text-rz-text-muted">{timeAgo(reply.created_at)}</span>
                                </div>
                                <div className="mt-0.5 max-w-full">
                                  <p className="text-xs text-rz-text-secondary leading-relaxed"><RichBody text={reply.body} /></p>
                                </div>
                                <ReplyActionRow
                                  myReaction={(reply.my_reactions || [])[0] || null}
                                  reactionCounts={reply.reactions || {}}
                                  onReact={(emoji) => handleReact(reply.id, emoji, true, item.id)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply compose */}
                      {replyingTo === item.id && user && (
                        <div className="mt-2 flex gap-2 items-center">
                          <input
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder="Write a reply…"
                            maxLength={500}
                            className="flex-1 rounded-full border border-rz-border bg-rz-surface-2 px-3.5 py-1.5 text-xs text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red transition"
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(item.id); } }}
                          />
                          <button
                            onClick={() => handleReply(item.id)}
                            disabled={sendingReply || !replyBody.trim()}
                            className="bg-rz-red text-white px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-rz-red-hover disabled:opacity-50 transition"
                          >
                            {sendingReply ? "…" : "Reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              );
              })}
            </div>
          ))}

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && <Loader />}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
