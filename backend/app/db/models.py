import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Users ────────────────────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(
        Text, nullable=False, default="user"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    profile: Mapped["UserProfile"] = relationship(back_populates="user", uselist=False)

    __table_args__ = (
        CheckConstraint("role IN ('user', 'admin')", name="ck_users_role"),
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    avatar_path: Mapped[str | None] = mapped_column(Text)
    cover_path: Mapped[str | None] = mapped_column(Text)
    avatar_crop: Mapped[str | None] = mapped_column(Text)
    cover_crop: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(Text, nullable=False, server_default="America/Costa_Rica")
    favorite_team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("teams.id"), nullable=True
    )
    total_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    exact_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    outcome_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duel_wins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duel_losses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duel_draws: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duel_points_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    challenge_points_balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    user: Mapped["User"] = relationship(back_populates="profile")


# ── Tournament ───────────────────────────────────────────────────────────────


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    season: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="upcoming")
    external_id: Mapped[str | None] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    stages: Mapped[list["Stage"]] = relationship(back_populates="tournament")

    __table_args__ = (
        CheckConstraint(
            "status IN ('upcoming', 'active', 'completed')",
            name="ck_tournaments_status",
        ),
    )


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    short_code: Mapped[str | None] = mapped_column(Text)
    flag_url: Mapped[str | None] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )


class Stage(Base):
    __tablename__ = "stages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    is_frozen: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    frozen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    tournament: Mapped["Tournament"] = relationship(back_populates="stages")


# ── Matches ──────────────────────────────────────────────────────────────────


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stages.id"), nullable=False
    )
    home_team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teams.id"), nullable=False
    )
    away_team_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("teams.id"), nullable=False
    )
    kickoff_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    lock_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    venue: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="scheduled")
    external_id: Mapped[str | None] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    result: Mapped["MatchResult | None"] = relationship(
        back_populates="match", uselist=False
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('scheduled','live','finished','confirmed','postponed','cancelled')",
            name="ck_matches_status",
        ),
    )


class MatchResult(Base):
    __tablename__ = "match_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("matches.id"), unique=True, nullable=False
    )
    home_score: Mapped[int] = mapped_column(Integer, nullable=False)
    away_score: Mapped[int] = mapped_column(Integer, nullable=False)
    is_override: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    match: Mapped["Match"] = relationship(back_populates="result")


# ── Predictions ──────────────────────────────────────────────────────────────


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("matches.id"), nullable=False
    )
    home_score: Mapped[int] = mapped_column(Integer, nullable=False)
    away_score: Mapped[int] = mapped_column(Integer, nullable=False)
    points: Mapped[int | None] = mapped_column(Integer)
    result_type: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uq_predictions_user_match"),
        CheckConstraint("home_score >= 0", name="ck_predictions_home_score"),
        CheckConstraint("away_score >= 0", name="ck_predictions_away_score"),
        CheckConstraint(
            "result_type IN ('exact', 'outcome', 'miss')",
            name="ck_predictions_result_type",
        ),
    )


# ── Flash Challenges ─────────────────────────────────────────────────────────


class FlashChallenge(Base):
    __tablename__ = "flash_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False
    )
    match_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("matches.id"))
    stage_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stages.id"))
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    participation_cost: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reward_points: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    open_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    close_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    resolution_method: Mapped[str] = mapped_column(Text, nullable=False)
    correct_option_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("flash_challenge_options.id")
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    options: Mapped[list["FlashChallengeOption"]] = relationship(
        back_populates="challenge", foreign_keys="FlashChallengeOption.challenge_id"
    )

    __table_args__ = (
        CheckConstraint("scope IN ('match', 'stage', 'open')", name="ck_flash_scope"),
        CheckConstraint(
            "type IN ('yes_no', 'multiple_choice')", name="ck_flash_type"
        ),
        CheckConstraint(
            "resolution_method IN ('manual', 'automatic')",
            name="ck_flash_resolution_method",
        ),
        CheckConstraint(
            "status IN ('draft','active','locked','resolved','cancelled')",
            name="ck_flash_status",
        ),
    )


class FlashChallengeOption(Base):
    __tablename__ = "flash_challenge_options"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("flash_challenges.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    challenge: Mapped["FlashChallenge"] = relationship(
        back_populates="options", foreign_keys=[challenge_id]
    )


class FlashChallengeAnswer(Base):
    __tablename__ = "flash_challenge_answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("flash_challenges.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    option_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("flash_challenge_options.id"), nullable=False
    )
    paid_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reward_points_awarded: Mapped[int | None] = mapped_column(Integer)
    outcome_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        UniqueConstraint(
            "challenge_id", "user_id", name="uq_flash_answers_challenge_user"
        ),
        CheckConstraint(
            "outcome_status IN ('pending','won','lost','refunded')",
            name="ck_flash_answer_outcome",
        ),
    )


# ── Points Ledger ────────────────────────────────────────────────────────────


class PointsLedger(Base):
    __tablename__ = "points_ledger"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    transaction_type: Mapped[str] = mapped_column(Text, nullable=False)
    reference_type: Mapped[str | None] = mapped_column(Text)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    points_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, name="metadata")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        CheckConstraint(
            "transaction_type IN ('challenge_entry','challenge_reward','challenge_refund',"
            "'duel_stake','duel_win','duel_refund','admin_adjustment')",
            name="ck_ledger_transaction_type",
        ),
    )


# ── Duels ────────────────────────────────────────────────────────────────────


class DuelChallenge(Base):
    __tablename__ = "duel_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("matches.id"), nullable=False
    )
    challenger_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    opponent_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    stake_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    winner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    challenger_score: Mapped[int | None] = mapped_column(Integer)
    opponent_score: Mapped[int | None] = mapped_column(Integer)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        UniqueConstraint(
            "match_id", "challenger_id", "opponent_id",
            name="uq_duels_match_challenger_opponent",
        ),
        CheckConstraint(
            "status IN ('pending','active','declined','expired','completed')",
            name="ck_duels_status",
        ),
        CheckConstraint("stake_points >= 0", name="ck_duels_stake_positive"),
    )


# ── Comments ─────────────────────────────────────────────────────────────────


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("matches.id"), nullable=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("comments.id"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    media_url: Mapped[str | None] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        CheckConstraint(
            "char_length(body) <= 500", name="ck_comments_body_length"
        ),
    )


class CommentReaction(Base):
    __tablename__ = "comment_reactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    comment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    emoji: Mapped[str] = mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", "emoji", name="uq_reaction_per_user_emoji"),
    )


# ── Prizes ───────────────────────────────────────────────────────────────────


class Prize(Base):
    __tablename__ = "prizes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False
    )
    stage_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stages.id"))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    winner_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    awarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )


# ── Leaderboard Snapshots ────────────────────────────────────────────────────


class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False
    )
    stage_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stages.id"))
    scope: Mapped[str] = mapped_column(Text, nullable=False)
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        CheckConstraint(
            "scope IN ('global', 'tournament', 'stage')",
            name="ck_leaderboard_scope",
        ),
    )


# ── In-App Notifications ─────────────────────────────────────────────────────


class InAppNotification(Base):
    __tablename__ = "in_app_notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(Text, nullable=False, default="normal")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="unread")
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    related_entity_type: Mapped[str | None] = mapped_column(Text)
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    action_url: Mapped[str | None] = mapped_column(Text)
    data: Mapped[dict | None] = mapped_column(JSONB)
    dedup_key: Mapped[str | None] = mapped_column(Text, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        CheckConstraint(
            "category IN ('social','match','duel','challenge','system')",
            name="ck_inapp_category",
        ),
        CheckConstraint(
            "priority IN ('low','normal','high')",
            name="ck_inapp_priority",
        ),
        CheckConstraint(
            "status IN ('unread','read','archived')",
            name="ck_inapp_status",
        ),
    )


# ── Notifications (Email) ───────────────────────────────────────────────────


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(Text, nullable=False, default="email")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    extra_data: Mapped[dict | None] = mapped_column(JSONB, name="metadata")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "channel IN ('email', 'push', 'in_app')", name="ck_notification_channel"
        ),
        CheckConstraint(
            "status IN ('pending', 'sent', 'failed')", name="ck_notification_status"
        ),
    )


class OutboundEmailJob(Base):
    __tablename__ = "outbound_email_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    notification_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("notifications.id")
    )
    to_address: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_log: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','sent','failed','dead_letter')",
            name="ck_email_jobs_status",
        ),
    )


# ── Audit Logs ───────────────────────────────────────────────────────────────


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(Text, nullable=False)
    resource_type: Mapped[str | None] = mapped_column(Text)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    before_state: Mapped[dict | None] = mapped_column(JSONB)
    after_state: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )


# ── User Follows ─────────────────────────────────────────────────────────────


class UserFollow(Base):
    __tablename__ = "user_follows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    follower_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    followed_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        UniqueConstraint("follower_id", "followed_id", name="uq_user_follows_pair"),
    )


# ── Activity Items ───────────────────────────────────────────────────────────


class ActivityItem(Base):
    __tablename__ = "activity_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    activity_type: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    related_entity_type: Mapped[str | None] = mapped_column(Text)
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    visibility: Mapped[str] = mapped_column(Text, nullable=False, default="all_users")
    participant1_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    participant2_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB)
    comment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("comments.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, index=True
    )

    __table_args__ = (
        UniqueConstraint(
            "related_entity_type", "related_entity_id", "activity_type",
            name="uq_activity_entity",
        ),
        CheckConstraint(
            "visibility IN ('all_users', 'participants_only', 'participants_and_friends')",
            name="ck_activity_visibility",
        ),
    )


# ── App Settings (key-value) ────────────────────────────────────────────────


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )


# ── Support Tickets ─────────────────────────────────────────────────────────


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="general"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="open"
    )
    admin_reply: Mapped[str | None] = mapped_column(Text)
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replied_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id])

    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'in_progress', 'resolved', 'closed')",
            name="ck_ticket_status",
        ),
        CheckConstraint(
            "category IN ('general', 'bug', 'account', 'scoring', 'suggestion')",
            name="ck_ticket_category",
        ),
    )


# ── Penalty Rush Scores ─────────────────────────────────────────────────────


class PenaltyRushScore(Base):
    __tablename__ = "penalty_rush_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    best_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    accuracy_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_secs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level_reached: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        CheckConstraint("score >= 0 AND score < 100000", name="ck_pr_score_range"),
        CheckConstraint("accuracy_pct >= 0 AND accuracy_pct <= 100", name="ck_pr_accuracy"),
        CheckConstraint("duration_secs >= 5", name="ck_pr_min_duration"),
    )
