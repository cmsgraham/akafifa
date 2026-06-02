"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/lib/avatar";
import { RichBody, MediaPreview } from "@/lib/rich-content";
import { CommentActionBar, ReplyActionRow, computeReactionUpdate, timeAgo } from "@/lib/social-reactions";
import { TrashIcon } from "@/lib/icons";
import { useTimezone } from "@/lib/timezone-context";
import { MobilePageHeader } from "../../MobilePageHeader";
import { cropStyle } from "@/lib/image-adjuster";

/* ── Types ── */

interface PublicProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  avatar_crop: string | null;
  cover_crop: string | null;
  bio: string | null;
  total_points: number;
  exact_hits: number;
  outcome_hits: number;
  predictions_count: number;
  duel_wins: number;
  duel_losses: number;
  duel_draws: number;
  duel_total: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_own_profile: boolean;
}

interface FollowUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

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
}

interface MyPrediction {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  points: number | null;
  result_type: string | null;
  submitted_at: string;
  tournament_name: string;
  tournament_id: string;
  kickoff_utc: string;
  lock_at: string;
  match_status: string;
}

/* ── Page ── */

type Tab = "posts" | "photos" | "predictions" | "stats";

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const [showList, setShowList] = useState<"followers" | "following" | null>(null);
  const [listUsers, setListUsers] = useState<FollowUser[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [tab, setTab] = useState<Tab>("posts");

  // Posts state
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);

  // Predictions state
  const [predictions, setPredictions] = useState<MyPrediction[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [predictionsLoaded, setPredictionsLoaded] = useState(false);

  const { formatDateTime } = useTimezone();

  // Replies
  const [expandedReplies, setExpandedReplies] = useState<Record<string, Reply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  /* ── Profile fetch ── */
  useEffect(() => {
    if (!id) return;
    apiFetch<PublicProfile>(`/users/${id}/profile`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── Posts fetch ── */
  const fetchPosts = useCallback(async (cursor?: string | null) => {
    const params = new URLSearchParams({ limit: "20", author_id: id });
    if (cursor) params.set("cursor", cursor);
    if (user?.id) params.set("uid", user.id);
    return apiFetch<{
      data: FeedItem[];
      pagination: { next_cursor: string | null; has_more: boolean };
    }>(`/feed?${params}`);
  }, [id, user?.id]);

  useEffect(() => {
    if (tab === "posts" && !postsLoaded && id) {
      setPostsLoading(true);
      fetchPosts()
        .then((res) => {
          setPosts(res.data);
          setPostsHasMore(res.pagination.has_more);
          setPostsCursor(res.pagination.next_cursor);
          setPostsLoaded(true);
        })
        .catch(() => {})
        .finally(() => setPostsLoading(false));
    }
  }, [tab, postsLoaded, id, fetchPosts]);

  const loadMorePosts = async () => {
    if (!postsCursor || postsLoadingMore) return;
    setPostsLoadingMore(true);
    try {
      const res = await fetchPosts(postsCursor);
      setPosts((prev) => [...prev, ...res.data]);
      setPostsHasMore(res.pagination.has_more);
      setPostsCursor(res.pagination.next_cursor);
    } catch {}
    setPostsLoadingMore(false);
  };

  /* ── Photos derived from posts ── */
  const photos = useMemo(() => {
    // Collect all media_urls from loaded posts
    return posts.filter((p) => p.media_url).map((p) => ({
      id: p.id,
      url: p.media_url!,
      created_at: p.created_at,
    }));
  }, [posts]);

  // If on photos tab and haven't loaded posts yet, load them
  useEffect(() => {
    if (tab === "photos" && !postsLoaded && id) {
      setPostsLoading(true);
      fetchPosts()
        .then((res) => {
          setPosts(res.data);
          setPostsHasMore(res.pagination.has_more);
          setPostsCursor(res.pagination.next_cursor);
          setPostsLoaded(true);
        })
        .catch(() => {})
        .finally(() => setPostsLoading(false));
    }
  }, [tab, postsLoaded, id, fetchPosts]);

  /* ── Predictions fetch ── */
  useEffect(() => {
    if (tab === "predictions" && !predictionsLoaded && id) {
      setPredictionsLoading(true);
      apiFetch<{ data: MyPrediction[] }>(`/users/${id}/predictions`)
        .then((res) => {
          setPredictions(res.data);
          setPredictionsLoaded(true);
        })
        .catch(() => {})
        .finally(() => setPredictionsLoading(false));
    }
  }, [tab, predictionsLoaded, id]);

  /* ── Follow toggle ── */
  const toggleFollow = useCallback(async () => {
    if (!profile || toggling) return;
    setToggling(true);
    try {
      if (profile.is_following) {
        await apiFetch(`/users/${id}/follow`, { method: "DELETE" });
        setProfile((p) =>
          p ? { ...p, is_following: false, followers_count: p.followers_count - 1 } : p
        );
      } else {
        await apiFetch(`/users/${id}/follow`, { method: "POST" });
        setProfile((p) =>
          p ? { ...p, is_following: true, followers_count: p.followers_count + 1 } : p
        );
      }
    } catch {}
    setToggling(false);
  }, [profile, toggling, id]);

  /* ── Followers/following list ── */
  const loadList = async (type: "followers" | "following") => {
    setShowList(type);
    setListLoading(true);
    try {
      if (profile?.is_own_profile) {
        const res = await apiFetch<{ data: FollowUser[] }>(`/me/${type === "followers" ? "followers" : "following"}`);
        setListUsers(res.data);
      } else {
        setListUsers([]);
      }
    } catch {
      setListUsers([]);
    }
    setListLoading(false);
  };

  /* ── Reactions ── */
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
      const item = posts.find((i) => i.id === commentId);
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
      setPosts((prev) =>
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

  /* ── Replies ── */
  const toggleReplies = async (commentId: string) => {
    if (expandedReplies[commentId]) {
      setExpandedReplies((prev) => { const next = { ...prev }; delete next[commentId]; return next; });
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
      setExpandedReplies((prev) => ({ ...prev, [parentId]: [...(prev[parentId] || []), res.data] }));
      setPosts((prev) =>
        prev.map((item) => item.id === parentId ? { ...item, reply_count: item.reply_count + 1 } : item)
      );
      setReplyBody("");
      setReplyingTo(null);
    } catch {}
    setSendingReply(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this post?")) return;
    try {
      await apiFetch(`/comments/${commentId}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((i) => i.id !== commentId));
    } catch {}
  };

  /* ── Photo modal ── */
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  /* ── Loading / not found ── */
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-rz-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-rz-text-muted">User not found</p>
        <Link href="/leaderboard" className="text-rz-red text-sm mt-2 inline-block hover:underline">
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "photos", label: "Photos" },
    { key: "predictions", label: "Predictions" },
    { key: "stats", label: "Stats" },
  ];

  return (
    <div className="max-w-xl mx-auto">
      <MobilePageHeader title={profile.display_name || "Profile"} backHref="/leaderboard" backLabel="Ranking" />

      {/* ═══ PROFILE HEADER ═══ */}
      <div className="relative mb-6">
        {/* Cover photo / gradient backdrop */}
        <div className="relative h-32 sm:h-36 rounded-xl overflow-hidden">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover" style={cropStyle(profile.cover_crop)} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#7F1D1D]/40 via-[#E11D2E]/15 to-transparent" />
          )}
        </div>

        <div className="relative -mt-10 px-4 sm:px-6">
          {/* Avatar + follow/edit */}
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-rz-bg">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                  style={cropStyle(profile.avatar_crop)}
                  draggable={false}
                />
              ) : (
                <span className="w-full h-full bg-rz-red/10 flex items-center justify-center text-3xl font-bold text-rz-red">
                  {profile.display_name[0]?.toUpperCase() || "?"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{profile.display_name}</h1>
              {profile.bio && (
                <p className="text-sm text-rz-text-secondary mt-0.5 line-clamp-2">{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-5 mt-4">
            <button onClick={() => loadList("followers")} className="hover:opacity-70 transition">
              <span className="font-bold">{profile.followers_count}</span>
              <span className="text-xs text-rz-text-muted ml-1">Followers</span>
            </button>
            <button onClick={() => loadList("following")} className="hover:opacity-70 transition">
              <span className="font-bold">{profile.following_count}</span>
              <span className="text-xs text-rz-text-muted ml-1">Following</span>
            </button>
            <div className="ml-auto">
              <span className="font-bold text-rz-red">{profile.total_points}</span>
              <span className="text-xs text-rz-text-muted ml-1">pts</span>
            </div>
          </div>

          {/* Follow / Edit button */}
          <div className="mt-4">
            {profile.is_own_profile ? (
              <Link
                href="/profile"
                className="block text-center py-2 rounded-lg border border-rz-border text-sm font-medium text-rz-text-secondary hover:bg-rz-surface-2 transition"
              >
                Edit Profile
              </Link>
            ) : (
              <button
                onClick={toggleFollow}
                disabled={toggling}
                className={`w-full py-2 rounded-lg text-sm font-medium transition ${
                  profile.is_following
                    ? "bg-rz-surface-2 text-rz-text-secondary hover:bg-red-900/20 hover:text-red-400"
                    : "bg-rz-red text-white hover:bg-rz-red-hover"
                } disabled:opacity-50`}
              >
                {toggling ? "..." : profile.is_following ? "Following" : "Follow"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex border-b border-rz-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors relative ${
              tab === t.key
                ? "text-rz-red"
                : "text-rz-text-muted hover:text-rz-text"
            }`}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute bottom-0 inset-x-4 h-0.5 bg-rz-red rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ═══ POSTS TAB ═══ */}
      {tab === "posts" && (
        <div className="space-y-0 divide-y divide-rz-border">
          {postsLoading && !postsLoaded ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-rz-red border-t-transparent rounded-full" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-rz-text-muted">
              <p className="text-sm">No posts yet.</p>
            </div>
          ) : (
            <>
              {posts.map((item) => (
                <div key={item.id} className="px-0 py-3">
                  <div className="flex items-start gap-2.5">
                    <Link href={`/users/${item.user_id}`} className="shrink-0">
                      <Avatar src={item.avatar_url} name={item.display_name} size="lg" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link href={`/users/${item.user_id}`} className="text-[13px] font-semibold text-rz-text hover:text-rz-red transition">
                          {item.display_name}
                        </Link>
                        <span className="text-[10px] text-rz-text-muted">{timeAgo(item.created_at)}</span>
                      </div>
                      {item.match && (
                        <Link href={`/matches/${item.match.id}`}
                          className="inline-block mt-0.5 text-[10px] text-rz-text-muted bg-rz-surface-2 rounded px-1.5 py-0.5 hover:text-rz-red transition">
                          {item.match.home_team} vs {item.match.away_team}
                        </Link>
                      )}
                      <div className="mt-1">
                        <p className="text-sm text-rz-text leading-relaxed"><RichBody text={item.body} /></p>
                        {item.media_url && <div className="mt-2 overflow-hidden rounded-lg"><MediaPreview url={item.media_url} /></div>}
                      </div>

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
                            <p className="text-xs text-rz-text-muted">Loading replies...</p>
                          )}
                          {(expandedReplies[item.id] || []).map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <Link href={`/users/${reply.user_id}`} className="shrink-0">
                                <Avatar src={reply.avatar_url} name={reply.display_name} size="sm" />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-1.5">
                                  <Link href={`/users/${reply.user_id}`} className="text-xs font-semibold text-rz-text hover:text-rz-red transition">{reply.display_name}</Link>
                                  <span className="text-[10px] text-rz-text-muted">{timeAgo(reply.created_at)}</span>
                                </div>
                                <p className="text-xs text-rz-text-secondary leading-relaxed mt-0.5"><RichBody text={reply.body} /></p>
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
                            placeholder="Write a reply..."
                            maxLength={500}
                            className="flex-1 rounded-full border border-rz-border bg-rz-surface-2 px-3.5 py-1.5 text-xs text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red transition"
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(item.id); } }}
                          />
                          <button
                            onClick={() => handleReply(item.id)}
                            disabled={sendingReply || !replyBody.trim()}
                            className="bg-rz-red text-white px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-rz-red-hover disabled:opacity-50 transition"
                          >
                            {sendingReply ? "..." : "Reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {postsHasMore && (
                <button
                  onClick={loadMorePosts}
                  disabled={postsLoadingMore}
                  className="w-full py-3 text-sm text-rz-red hover:bg-rz-red/10 rounded-xl transition disabled:opacity-50"
                >
                  {postsLoadingMore ? "Loading..." : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ PHOTOS TAB ═══ */}
      {tab === "photos" && (
        <div>
          {postsLoading && !postsLoaded ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-rz-red border-t-transparent rounded-full" />
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12 text-rz-text-muted">
              <p className="text-sm">No photos yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setViewPhoto(photo.url)}
                  className="aspect-square overflow-hidden rounded-sm hover:opacity-80 transition"
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
          {postsHasMore && postsLoaded && (
            <button
              onClick={loadMorePosts}
              disabled={postsLoadingMore}
              className="w-full py-3 mt-4 text-sm text-rz-red hover:bg-rz-red/10 rounded-xl transition disabled:opacity-50"
            >
              {postsLoadingMore ? "Loading..." : "Load more photos"}
            </button>
          )}
        </div>
      )}

      {/* ═══ PREDICTIONS TAB ═══ */}
      {tab === "predictions" && (
        <div>
          {predictionsLoading && !predictionsLoaded ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-rz-red border-t-transparent rounded-full" />
            </div>
          ) : predictions.length === 0 ? (
            <div className="text-center py-12 text-rz-text-muted">
              <p className="text-sm">No predictions yet.</p>
            </div>
          ) : (() => {
            const groups: Record<string, { name: string; id: string; preds: MyPrediction[] }> = {};
            predictions.forEach(p => {
              if (!groups[p.tournament_id]) groups[p.tournament_id] = { name: p.tournament_name, id: p.tournament_id, preds: [] };
              groups[p.tournament_id].preds.push(p);
            });
            return Object.values(groups).map(g => (
              <div key={g.id} className="mb-6">
                <Link href={`/tournaments/${g.id}`}
                  className="text-sm font-semibold text-rz-red hover:underline mb-2 block">
                  {g.name}
                </Link>
                <div className="bg-rz-surface rounded-xl border border-rz-border overflow-hidden">
                  <div className="divide-y divide-rz-border">
                    {g.preds.map(p => (
                      <div key={p.id} className="flex items-center px-4 py-3 gap-3">
                        <Link href={`/matches/${p.match_id}`} className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.home_team} vs {p.away_team}</p>
                          <p className="text-[10px] text-rz-text-muted">{formatDateTime(p.kickoff_utc)}</p>
                        </Link>
                        <span className="font-mono font-bold text-sm text-rz-text-secondary">
                          {p.home_score} - {p.away_score}
                        </span>
                        <span className="w-10 text-right font-bold text-sm text-rz-red">
                          {p.points ?? "\u2014"}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded hidden sm:inline ${
                          p.result_type === "exact"
                            ? "bg-green-900/30 text-rz-success"
                            : p.result_type === "outcome"
                            ? "bg-yellow-900/30 text-yellow-400"
                            : "bg-rz-surface-2 text-rz-text-muted"
                        }`}>
                          {p.result_type || "pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* ═══ STATS TAB ═══ */}
      {tab === "stats" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Points" value={profile.total_points} />
            <StatCard label="Predictions" value={profile.predictions_count} />
            <StatCard label="Exact Scores" value={profile.exact_hits} />
            <StatCard label="Correct Outcome" value={profile.outcome_hits} />
          </div>

          {profile.duel_total > 0 && (
            <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
              <h2 className="text-sm font-semibold mb-3">Duel Record</h2>
              <div className="flex gap-4 text-center">
                <div className="flex-1">
                  <p className="text-lg font-bold text-rz-success">{profile.duel_wins}</p>
                  <p className="text-xs text-rz-text-muted">Wins</p>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-red-400">{profile.duel_losses}</p>
                  <p className="text-xs text-rz-text-muted">Losses</p>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-rz-text-muted">{profile.duel_draws}</p>
                  <p className="text-xs text-rz-text-muted">Draws</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PHOTO VIEWER MODAL ═══ */}
      {viewPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <button onClick={() => setViewPhoto(null)} className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-light z-10">&#x2715;</button>
          <img src={viewPhoto} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* ═══ FOLLOWERS/FOLLOWING MODAL ═══ */}
      {showList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowList(null)}>
          <div className="bg-rz-surface rounded-xl shadow-xl w-full max-w-sm max-h-[60vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-rz-border">
              <h3 className="font-semibold">{showList === "followers" ? "Followers" : "Following"}</h3>
              <button onClick={() => setShowList(null)} className="text-rz-text-muted hover:text-rz-text">&#x2715;</button>
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-2">
              {listLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-rz-red border-t-transparent rounded-full" />
                </div>
              ) : listUsers.length === 0 ? (
                <p className="text-center py-8 text-sm text-rz-text-muted">
                  {profile.is_own_profile ? "No one yet" : "List only visible on your own profile"}
                </p>
              ) : (
                listUsers.map((u) => (
                  <Link
                    key={u.id}
                    href={`/users/${u.id}`}
                    onClick={() => setShowList(null)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rz-surface-2 transition"
                  >
                    <Avatar src={u.avatar_url} name={u.display_name} />
                    <span className="text-sm font-medium">{u.display_name}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-rz-surface rounded-xl border border-rz-border p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-rz-text-muted mt-1">{label}</p>
    </div>
  );
}
