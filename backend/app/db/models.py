import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
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
    bio: Mapped[str | None] = mapped_column(Text)
    favorite_team_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("teams.id"), nullable=True
    )
    total_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    exact_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    outcome_hits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duel_wins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duel_losses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duel_draws: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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
    points_value: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
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
        CheckConstraint("scope IN ('match', 'stage')", name="ck_flash_scope"),
        CheckConstraint(
            "type IN ('yes_no', 'multiple_choice')", name="ck_flash_type"
        ),
        CheckConstraint(
            "resolution_method IN ('manual', 'automatic')",
            name="ck_flash_resolution_method",
        ),
        CheckConstraint(
            "status IN ('draft','open','closed','resolved','cancelled')",
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
    points_awarded: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    __table_args__ = (
        UniqueConstraint(
            "challenge_id", "user_id", name="uq_flash_answers_challenge_user"
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
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    winner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    is_draw: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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
            "status IN ('pending','accepted','declined','expired','scored')",
            name="ck_duels_status",
        ),
    )


# ── Comments ─────────────────────────────────────────────────────────────────


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    match_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("matches.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
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


# ── Notifications ────────────────────────────────────────────────────────────


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
    extra_data: Mapped[dict | None] = mapped_column(JSONB)
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
