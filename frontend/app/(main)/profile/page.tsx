"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { apiFetch, uploadImage } from "@/lib/api";
import { useTimezone, TIMEZONE_OPTIONS } from "@/lib/timezone-context";
import { Avatar } from "@/lib/avatar";
import { RichBody, MediaPreview } from "@/lib/rich-content";
import { CommentActionBar, ReplyActionRow, computeReactionUpdate, timeAgo } from "@/lib/social-reactions";
import { CameraIcon, ImageIcon, PlusIcon, TrashIcon, XMarkIcon } from "@/lib/icons";
import { MentionInput } from "@/lib/mention-input";
import { Loader } from "@/lib/loader";
import { ImageAdjuster, cropStyle, parseCrop, CropData } from "@/lib/image-adjuster";

/* ── Types ── */

interface Profile {
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  avatar_crop: string | null;
  cover_crop: string | null;
  bio: string | null;
  timezone: string;
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

interface MyChallengeAnswer {
  id: string;
  challenge_id: string;
  title: string;
  description: string | null;
  type: string;
  scope: string;
  status: string;
  participation_cost: number;
  reward_points: number;
  selected_label: string | null;
  correct_label: string | null;
  is_correct: boolean | null;
  paid_points: number;
  reward_points_awarded: number | null;
  outcome_status: string | null;
  net_points: number | null;
  submitted_at: string;
  resolved_at: string | null;
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

/* ── Page ── */

type Tab = "posts" | "photos" | "predictions";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { timezone, setTimezone, formatDateTime } = useTimezone();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [predictions, setPredictions] = useState<MyPrediction[]>([]);
  const [challengeAnswers, setChallengeAnswers] = useState<MyChallengeAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editTz, setEditTz] = useState("");
  const [saving, setSaving] = useState(false);

  const [tab, setTab] = useState<Tab>("posts");

  // Numpad state
  const [numpadPred, setNumpadPred] = useState<MyPrediction | null>(null);
  const [npHome, setNpHome] = useState("");
  const [npAway, setNpAway] = useState("");
  const [scoreField, setScoreField] = useState<"home" | "away">("home");
  const [npSaving, setNpSaving] = useState(false);
  const [npError, setNpError] = useState("");

  const [avatarUploading, setAvatarUploading] = useState(false);

  // Cover photo state
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [showCoverMenu, setShowCoverMenu] = useState(false);

  // Image adjuster state
  const [adjustTarget, setAdjustTarget] = useState<"avatar" | "cover" | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  // Post composer state
  const [postBody, setPostBody] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postPreview, setPostPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  // Photo upload state (Photos tab)
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState("");

  // Posts state
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);

  // Replies
  const [expandedReplies, setExpandedReplies] = useState<Record<string, Reply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Photo modal
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url + "?t=" + Date.now(), avatar_crop: null } : prev);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
    setAvatarUploading(false);
    // Auto-open adjuster after upload
    setTimeout(() => setAdjustTarget("avatar"), 300);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setShowCoverMenu(false);
  };

  const handleCoverUpload = async () => {
    if (!coverFile) return;
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", coverFile);
      const res = await fetch("/api/me/cover", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, cover_url: data.cover_url + "?t=" + Date.now(), cover_crop: null } : prev);
      setCoverPreview(null);
      setCoverFile(null);
      // Auto-open adjuster after upload
      setTimeout(() => setAdjustTarget("cover"), 300);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
    setCoverUploading(false);
  };

  const handleCoverCancel = () => {
    setCoverPreview(null);
    setCoverFile(null);
  };

  const handleCoverRemove = async () => {
    setShowCoverMenu(false);
    if (!confirm("Remove cover photo?")) return;
    try {
      const res = await fetch("/api/me/cover", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove");
      setProfile(prev => prev ? { ...prev, cover_url: null, cover_crop: null } : prev);
    } catch {
      alert("Failed to remove cover photo");
    }
  };

  const handleCropSave = async (crop: CropData) => {
    if (!adjustTarget) return;
    setAdjustSaving(true);
    try {
      const res = await fetch("/api/me/image-crop", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: adjustTarget, ...crop }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const cropJson = JSON.stringify(crop);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              [adjustTarget === "avatar" ? "avatar_crop" : "cover_crop"]: cropJson,
            }
          : prev
      );
      setAdjustTarget(null);
    } catch {
      alert("Failed to save crop");
    }
    setAdjustSaving(false);
  };

  useEffect(() => {
    Promise.all([
      apiFetch<Profile>("/me/profile").catch(() => null),
      apiFetch<{ data: MyPrediction[] }>("/me/predictions").catch(() => ({ data: [] })),
      apiFetch<{ data: MyChallengeAnswer[] }>("/me/challenges").catch(() => ({ data: [] })),
    ]).then(([p, pred, chal]) => {
      setProfile(p);
      if (p) {
        setEditName(p.display_name);
        setEditBio(p.bio || "");
        setEditTz(p.timezone || "America/Costa_Rica");
      }
      setPredictions(pred?.data || []);
      setChallengeAnswers(chal?.data || []);
      setLoading(false);
    });
  }, []);

  /* ── Posts fetch ── */
  const fetchPosts = useCallback(async (cursor?: string | null) => {
    if (!user?.id) return { data: [], pagination: { next_cursor: null, has_more: false } };
    const params = new URLSearchParams({ limit: "20", author_id: user.id, uid: user.id });
    if (cursor) params.set("cursor", cursor);
    return apiFetch<{
      data: FeedItem[];
      pagination: { next_cursor: string | null; has_more: boolean };
    }>(`/feed?${params}`);
  }, [user?.id]);

  useEffect(() => {
    if ((tab === "posts" || tab === "photos") && !postsLoaded && user?.id) {
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
  }, [tab, postsLoaded, user?.id, fetchPosts]);

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

  const photos = useMemo(() => {
    return posts.filter((p) => p.media_url).map((p) => ({
      id: p.id,
      url: p.media_url!,
      created_at: p.created_at,
    }));
  }, [posts]);

  /* ── Post composer ── */
  const handlePost = async () => {
    if ((!postBody.trim() && !postFile) || posting) return;
    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      if (postFile) {
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
      setPosts((prev) => [res.data, ...prev]);
      setPostBody("");
      setPostFile(null);
      setPostPreview(null);
    } catch {}
    setUploading(false);
    setPosting(false);
  };

  /* ── Photo upload (Photos tab) ── */
  const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

  const addPhotoFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type && !ALLOWED_TYPES.includes(f.type)) {
        setPhotoError(`"${f.name}" is not a supported image format.`);
        continue;
      }
      if (f.size > MAX_PHOTO_SIZE) {
        setPhotoError(`"${f.name}" exceeds the 10 MB limit.`);
        continue;
      }
      newFiles.push(f);
      newPreviews.push(URL.createObjectURL(f));
    }
    if (newFiles.length) {
      setPhotoFiles((prev) => [...prev, ...newFiles]);
      setPhotoPreviews((prev) => [...prev, ...newPreviews]);
      setPhotoError("");
    }
  };

  const removePhotoFile = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    if (photoFiles.length <= 1) setPhotoError("");
  };

  const handlePhotoUpload = async () => {
    if (!photoFiles.length || photoUploading) return;
    setPhotoUploading(true);
    setPhotoProgress(0);
    setPhotoError("");
    const created: FeedItem[] = [];
    try {
      for (let i = 0; i < photoFiles.length; i++) {
        setPhotoProgress(i + 1);
        const mediaUrl = await uploadImage(photoFiles[i]);
        const res = await apiFetch<{ data: FeedItem }>("/feed", {
          method: "POST",
          body: JSON.stringify({ body: "", media_url: mediaUrl }),
        });
        created.push(res.data);
      }
      setPosts((prev) => [...created.reverse(), ...prev]);
      photoPreviews.forEach((u) => URL.revokeObjectURL(u));
      setPhotoFiles([]);
      setPhotoPreviews([]);
    } catch {
      setPhotoError("Some photos failed to upload. Please try again.");
    }
    setPhotoUploading(false);
    setPhotoProgress(0);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          display_name: editName || undefined,
          bio: editBio || undefined,
          timezone: editTz,
        }),
      });
      setProfile(prev => prev ? { ...prev, display_name: editName, bio: editBio, timezone: editTz } : prev);
      setTimezone(editTz);
      setEditing(false);
    } catch (err: any) {
      alert(err.message || "Failed to save");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "photos", label: "Photos" },
    { key: "predictions", label: "Predictions" },
  ];

  return (
    <div className="max-w-xl mx-auto">
      {/* ═══ PROFILE HEADER ═══ */}
      <div className="relative mb-6">
        {/* Cover photo / gradient backdrop */}
        <div className="relative h-32 sm:h-36 rounded-xl overflow-hidden">
          {coverPreview ? (
            <img src={coverPreview} alt="Cover preview" className="absolute inset-0 w-full h-full object-cover" />
          ) : profile?.cover_url ? (
            <img src={profile.cover_url} alt="Cover" className="absolute inset-0 w-full h-full object-cover" style={cropStyle(profile.cover_crop)} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#7F1D1D]/40 via-[#E11D2E]/15 to-transparent" />
          )}

          {/* Cover preview confirm/cancel */}
          {coverPreview && (
            <div className="absolute bottom-2 right-2 flex gap-2 z-10">
              <button
                onClick={handleCoverCancel}
                className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-medium backdrop-blur-sm hover:bg-black/80 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCoverUpload}
                disabled={coverUploading}
                className="px-3 py-1.5 rounded-lg bg-rz-red text-white text-xs font-medium hover:bg-rz-red-hover disabled:opacity-50 transition"
              >
                {coverUploading ? "Saving..." : "Save Cover"}
              </button>
            </div>
          )}

          {/* Cover photo change button (only when not previewing) */}
          {!coverPreview && (
            <div className="absolute bottom-2 right-2 z-10">
              <button
                onClick={() => setShowCoverMenu(!showCoverMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 text-white/80 text-[11px] font-medium backdrop-blur-sm hover:bg-black/70 hover:text-white transition"
              >
                <CameraIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Update Cover</span>
              </button>
              {showCoverMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-rz-surface border border-rz-border rounded-lg shadow-xl overflow-hidden min-w-[180px] z-20">
                  <label className="flex items-center gap-2 px-3 py-2.5 text-xs text-rz-text hover:bg-rz-surface-2 cursor-pointer transition">
                    <CameraIcon className="w-4 h-4 text-rz-text-muted" />
                    <span>Take Photo</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCoverSelect} />
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2.5 text-xs text-rz-text hover:bg-rz-surface-2 cursor-pointer transition">
                    <ImageIcon className="w-4 h-4 text-rz-text-muted" />
                    <span>
                      Choose Photo
                      <span className="block text-[9px] text-rz-text-muted font-normal">Optimal: 1500 × 500 px</span>
                    </span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverSelect} />
                  </label>
                  {profile?.cover_url && (
                    <button
                      onClick={() => { setShowCoverMenu(false); setAdjustTarget("cover"); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-rz-text hover:bg-rz-surface-2 transition"
                    >
                      <svg className="w-4 h-4 text-rz-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                      Adjust Position
                    </button>
                  )}
                  {profile?.cover_url && (
                    <button
                      onClick={handleCoverRemove}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-rz-surface-2 transition"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Remove Cover
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative -mt-10 px-4 sm:px-6">
          <div className="flex items-end gap-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-rz-bg">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                    style={cropStyle(profile.avatar_crop)}
                    draggable={false}
                  />
                ) : (
                  <span className="w-full h-full bg-rz-red/10 flex items-center justify-center text-3xl font-bold text-rz-red">
                    {(profile?.display_name || user?.email || "?")[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition z-10"
              >
                <CameraIcon className="w-5 h-5 text-white" />
              </button>
              {showAvatarMenu && (
                <div className="absolute top-full left-0 mt-1 bg-rz-surface border border-rz-border rounded-lg shadow-xl overflow-hidden min-w-[180px] z-20">
                  <label className="flex items-center gap-2 px-3 py-2.5 text-xs text-rz-text hover:bg-rz-surface-2 cursor-pointer transition">
                    <CameraIcon className="w-4 h-4 text-rz-text-muted" />
                    <span>{avatarUploading ? "Uploading..." : "Take Photo"}</span>
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { setShowAvatarMenu(false); handleAvatarUpload(e); }} disabled={avatarUploading} />
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2.5 text-xs text-rz-text hover:bg-rz-surface-2 cursor-pointer transition">
                    <ImageIcon className="w-4 h-4 text-rz-text-muted" />
                    <span>
                      {avatarUploading ? "Uploading..." : "Upload Photo"}
                      <span className="block text-[9px] text-rz-text-muted font-normal">Optimal: 512 × 512 px</span>
                    </span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { setShowAvatarMenu(false); handleAvatarUpload(e); }} disabled={avatarUploading} />
                  </label>
                  {profile?.avatar_url && (
                    <button
                      onClick={() => { setShowAvatarMenu(false); setAdjustTarget("avatar"); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-rz-text hover:bg-rz-surface-2 transition"
                    >
                      <svg className="w-4 h-4 text-rz-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                      Adjust Position
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{profile?.display_name || "User"}</h1>
              <p className="text-xs text-rz-text-muted">{user?.email}</p>
              {profile?.bio && !editing && (
                <p className="text-sm text-rz-text-secondary mt-0.5 line-clamp-2">{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-3">
            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-rz-red/10 text-rz-red">
              {user?.role}
            </span>
            <span className="text-[10px] text-rz-text-muted">
              {TIMEZONE_OPTIONS.find(t => t.value === (profile?.timezone || timezone))?.label || timezone}
            </span>
            <button onClick={() => setEditing(!editing)}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-rz-surface-2 text-rz-text-secondary hover:bg-rz-surface-2/80 transition">
              {editing ? "Cancel" : "Edit Profile"}
            </button>
          </div>

          {/* Edit form (collapsible) */}
          {editing && (
            <div className="space-y-3 mt-4 pt-4 border-t border-rz-border">
              <div>
                <label className="block text-xs font-medium text-rz-text-muted mb-1">Display Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface-2 px-3 py-2 text-sm text-rz-text" />
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-muted mb-1">Bio</label>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface-2 px-3 py-2 text-sm text-rz-text" />
              </div>
              <div>
                <label className="block text-xs font-medium text-rz-text-muted mb-1">Timezone</label>
                <select value={editTz} onChange={e => setEditTz(e.target.value)}
                  className="w-full rounded-lg border border-rz-border-strong bg-rz-surface-2 px-3 py-2 text-sm text-rz-text">
                  {TIMEZONE_OPTIONS.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="bg-rz-red text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 transition">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
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
          {/* Compose box */}
          <div className="pb-4 !border-0">
            <div className="bg-rz-surface rounded-xl border border-rz-border p-4">
              <MentionInput
                value={postBody}
                onChange={setPostBody}
                placeholder="What's on your mind? (use @ to mention)"
                maxLength={500}
                multiline
                className="w-full rounded-lg border border-rz-border bg-rz-surface-2 px-3 py-2 text-sm text-rz-text focus:outline-none focus:ring-2 focus:ring-rz-red"
              />
              {postPreview && (
                <div className="relative mt-2 inline-block">
                  <img src={postPreview} alt="Preview" className="max-h-48 rounded-lg object-cover" />
                  <button
                    onClick={() => { setPostFile(null); setPostPreview(null); }}
                    className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between mt-3">
                <label className="text-sm text-rz-text-muted hover:text-rz-red transition flex items-center gap-1.5 cursor-pointer">
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
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={handlePost}
                  disabled={posting || (!postBody.trim() && !postFile)}
                  className="bg-rz-red text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-rz-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {uploading ? "Uploading…" : posting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </div>

          {postsLoading && !postsLoaded ? (
            <div className="flex justify-center py-12">
              <Loader size="sm" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-rz-text-muted">
              <p className="text-sm">No posts yet. Head to <Link href="/feed" className="text-rz-red hover:underline">the Arena</Link> to share something!</p>
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
                        <span className="text-[13px] font-semibold text-rz-text">{item.display_name}</span>
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
                        <button onClick={() => handleDelete(item.id)} className="text-rz-text-muted hover:text-red-400 transition p-1 rounded hover:bg-red-900/20" title="Delete">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </CommentActionBar>

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
          {/* Staged previews + confirm bar */}
          {photoPreviews.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-rz-border">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    {!photoUploading && (
                      <button
                        onClick={() => removePhotoFile(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {photoUploading && photoProgress === i + 1 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                      </div>
                    )}
                    {photoUploading && photoProgress > i + 1 && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      </div>
                    )}
                  </div>
                ))}
                {/* Add more tile */}
                {!photoUploading && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-rz-border-strong flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-rz-red hover:bg-rz-red/5 transition">
                    <PlusIcon className="w-5 h-5 text-rz-text-muted" />
                    <span className="text-[10px] text-rz-text-muted">Add</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      multiple
                      className="hidden"
                      onChange={(e) => { addPhotoFiles(e.target.files); e.target.value = ""; }}
                    />
                  </label>
                )}
              </div>
              {photoError && <p className="text-xs text-red-500 mt-2">{photoError}</p>}
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-rz-text-muted">
                  {photoUploading
                    ? `Uploading ${photoProgress} of ${photoFiles.length}...`
                    : `${photoFiles.length} photo${photoFiles.length !== 1 ? "s" : ""} selected`}
                </p>
                <div className="flex gap-2">
                  {!photoUploading && (
                    <button
                      onClick={() => {
                        photoPreviews.forEach((u) => URL.revokeObjectURL(u));
                        setPhotoFiles([]);
                        setPhotoPreviews([]);
                        setPhotoError("");
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs text-rz-text-muted hover:bg-rz-surface-2 transition"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handlePhotoUpload}
                    disabled={photoUploading}
                    className="bg-rz-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-rz-red-hover disabled:opacity-50 transition"
                  >
                    {photoUploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Gallery grid */}
          {postsLoading && !postsLoaded ? (
            <div className="flex justify-center py-12">
              <Loader size="sm" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {/* Upload tile — only when no staged files */}
              {photoPreviews.length === 0 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-rz-border-strong flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-rz-red hover:bg-rz-red/5 transition">
                  <CameraIcon className="w-6 h-6 text-rz-text-muted" />
                  <span className="text-[11px] font-medium text-rz-text-muted">Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    multiple
                    className="hidden"
                    onChange={(e) => { addPhotoFiles(e.target.files); e.target.value = ""; }}
                  />
                </label>
              )}
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setViewPhoto(photo.url)}
                  className="aspect-square overflow-hidden rounded-lg hover:opacity-80 transition"
                >
                  <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
              {photos.length === 0 && photoPreviews.length === 0 && (
                <div className="col-span-2 flex items-center justify-center aspect-square text-rz-text-muted">
                  <p className="text-sm">No photos yet</p>
                </div>
              )}
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
          {predictions.length === 0 ? (
            <div className="text-center py-12 text-rz-text-muted">
              <p className="text-sm">No predictions yet. Head to a match to submit your first prediction!</p>
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
                    {g.preds.map(p => {
                      const locked = new Date(p.lock_at) <= new Date();
                      const canEdit = !locked && p.match_status === "scheduled";
                      return (
                        <div key={p.id} className="flex items-center px-4 py-3 gap-3">
                          <Link href={`/matches/${p.match_id}`} className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.home_team} vs {p.away_team}</p>
                            <p className="text-[10px] text-rz-text-muted">{formatDateTime(p.kickoff_utc)}</p>
                          </Link>
                          <button
                            onClick={() => {
                              if (canEdit) {
                                setNumpadPred(p);
                                setNpHome(String(p.home_score));
                                setNpAway(String(p.away_score));
                                setScoreField("home");
                                setNpError("");
                              }
                            }}
                            className={`flex items-center gap-1 font-mono font-bold text-sm px-2 py-1 rounded-lg transition ${
                              canEdit
                                ? "bg-rz-red/10 text-rz-red hover:bg-rz-red/20 cursor-pointer"
                                : "text-rz-text-secondary cursor-default"
                            }`}
                          >
                            {p.home_score} - {p.away_score}
                            {canEdit && <span className="text-[10px] text-rz-red">Edit</span>}
                          </button>
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
                      );
                    })}
                  </div>
                </div>
              </div>
            ));
          })()}

          {/* ── Flash Challenges ── */}
          {challengeAnswers.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-rz-red mb-3">Flash Challenges</h3>
              <div className="bg-rz-surface rounded-xl border border-rz-border overflow-hidden">
                <div className="divide-y divide-rz-border">
                  {challengeAnswers.map(c => (
                    <div key={c.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.title}</p>
                          <p className="text-[10px] text-rz-text-muted mt-0.5">
                            Your answer: <span className="text-rz-text-secondary font-medium">{c.selected_label || "—"}</span>
                            {c.correct_label && (
                              <> · Correct: <span className="text-rz-success font-medium">{c.correct_label}</span></>
                            )}
                          </p>
                        </div>
                        <span className="w-12 text-right font-bold text-sm text-rz-red">
                          {c.net_points != null ? (c.net_points > 0 ? `+${c.net_points}` : c.net_points) : "—"}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          c.outcome_status === "won"
                            ? "bg-green-900/30 text-rz-success"
                            : c.outcome_status === "lost"
                            ? "bg-red-900/30 text-red-400"
                            : c.outcome_status === "refunded"
                            ? "bg-yellow-900/30 text-yellow-400"
                            : "bg-rz-surface-2 text-rz-text-muted"
                        }`}>
                          {c.outcome_status || "pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PREDICTION NUMPAD MODAL ═══ */}
      {numpadPred && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={() => setNumpadPred(null)}>
          <div className="bg-rz-surface rounded-t-2xl sm:rounded-2xl shadow-xl p-6 w-full max-w-xs" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }} onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <p className="text-sm font-semibold">{numpadPred.home_team} vs {numpadPred.away_team}</p>
            </div>
            <div className="flex items-center justify-center gap-4 mb-5">
              <div className="text-center">
                <p className="text-[10px] text-rz-text-muted mb-1">{numpadPred.home_team}</p>
                <button onClick={() => setScoreField("home")}
                  className={`w-16 h-14 text-center font-mono font-black text-3xl rounded-xl transition ${
                    scoreField === "home"
                      ? "bg-rz-red text-white ring-2 ring-rz-red shadow-lg"
                      : "bg-rz-surface-2 text-rz-text border border-rz-border-strong"
                  }`}>
                  {npHome || "0"}
                </button>
              </div>
              <span className="text-rz-text-muted font-black text-2xl mt-4">:</span>
              <div className="text-center">
                <p className="text-[10px] text-rz-text-muted mb-1">{numpadPred.away_team}</p>
                <button onClick={() => setScoreField("away")}
                  className={`w-16 h-14 text-center font-mono font-black text-3xl rounded-xl transition ${
                    scoreField === "away"
                      ? "bg-rz-red text-white ring-2 ring-rz-red shadow-lg"
                      : "bg-rz-surface-2 text-rz-text border border-rz-border-strong"
                  }`}>
                  {npAway || "0"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} onClick={() => {
                  if (scoreField === "home") { setNpHome(String(n)); setScoreField("away"); }
                  else { setNpAway(String(n)); }
                }}
                  className="h-12 rounded-xl bg-rz-surface border border-rz-border font-mono font-bold text-xl text-rz-text hover:bg-rz-surface-2 active:bg-rz-surface-2 transition shadow-sm">
                  {n}
                </button>
              ))}
              <button onClick={() => { if (scoreField === "home") setNpHome("0"); else setNpAway("0"); }}
                className="h-12 rounded-xl bg-red-900/30 border border-red-700 font-bold text-sm text-red-400 hover:bg-red-900/50 active:bg-red-900/60 transition shadow-sm">C</button>
              <button onClick={() => {
                if (scoreField === "home") { setNpHome("0"); setScoreField("away"); }
                else { setNpAway("0"); }
              }}
                className="h-12 rounded-xl bg-rz-surface border border-rz-border font-mono font-bold text-xl text-rz-text hover:bg-rz-surface-2 active:bg-rz-surface-2 transition shadow-sm">0</button>
              <button onClick={() => setScoreField(scoreField === "home" ? "away" : "home")}
                className="h-12 rounded-xl bg-rz-red/20 border border-rz-red/30 font-bold text-xs text-rz-red hover:bg-rz-red/30 active:bg-rz-red/40 transition shadow-sm">
                {scoreField === "home" ? "Next \u2192" : "\u2190 Back"}
              </button>
            </div>
            {npError && <p className="text-xs text-red-500 text-center mb-2">{npError}</p>}
            <button onClick={async () => {
              setNpError(""); setNpSaving(true);
              const body = JSON.stringify({ home_score: parseInt(npHome || "0"), away_score: parseInt(npAway || "0") });
              try {
                await apiFetch(`/matches/${numpadPred.match_id}/prediction`, { method: "PUT", body });
                setPredictions(prev => prev.map(p =>
                  p.id === numpadPred.id ? { ...p, home_score: parseInt(npHome || "0"), away_score: parseInt(npAway || "0") } : p
                ));
                setNumpadPred(null);
              } catch (err: unknown) {
                setNpError(err instanceof Error ? err.message : "Failed to update");
              } finally { setNpSaving(false); }
            }} disabled={npSaving}
              className="w-full bg-rz-red text-white py-2.5 rounded-xl text-sm font-bold hover:bg-rz-red-hover disabled:opacity-50 transition">
              {npSaving ? "Saving..." : "Update Prediction"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ PHOTO VIEWER MODAL ═══ */}
      {viewPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
          <button onClick={() => setViewPhoto(null)} className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-light z-10">&#x2715;</button>
          <img src={viewPhoto} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Sign out */}
      <div className="mt-8 pt-6 border-t border-rz-border">
        <button
          onClick={() => logout()}
          className="px-4 py-2 rounded-lg border border-red-700 text-red-400 hover:bg-red-900/20 text-sm transition"
        >
          Sign Out
        </button>
      </div>

      {/* Image adjuster modal */}
      {adjustTarget && (
        <ImageAdjuster
          src={
            adjustTarget === "avatar"
              ? (profile?.avatar_url || "")
              : (profile?.cover_url || "")
          }
          shape={adjustTarget === "avatar" ? "circle" : "cover"}
          initialCrop={parseCrop(
            adjustTarget === "avatar" ? profile?.avatar_crop : profile?.cover_crop
          )}
          onSave={handleCropSave}
          onCancel={() => setAdjustTarget(null)}
          saving={adjustSaving}
        />
      )}
    </div>
  );
}
