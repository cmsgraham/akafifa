"use client";

import { useState } from "react";
import { MobilePageHeader } from "../MobilePageHeader";

type Section = "scoring" | "predictions" | "leaderboard" | "duels" | "challenges" | "lounge";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "scoring", label: "Scoring" },
  { id: "predictions", label: "Predictions" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "duels", label: "Duels" },
  { id: "challenges", label: "Flash Challenges" },
  { id: "lounge", label: "Match Lounge" },
];

export default function RulesPage() {
  const [active, setActive] = useState<Section>("scoring");

  return (
    <div>
      <MobilePageHeader title="Rules" backHref="/home" backLabel="Home" />
      <h1 className="text-2xl font-bold tracking-tight mb-2">Rules & How to Play</h1>
      <p className="text-sm text-rz-text-muted mb-6">
        Everything you need to know about scoring points and competing.
      </p>

      {/* Section tabs — horizontal scroll on mobile */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              active === s.id
                ? "bg-rz-red text-white"
                : "bg-rz-surface text-rz-text-secondary hover:bg-rz-surface-2"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-rz-surface rounded-xl border border-rz-border p-6">
        {active === "scoring" && <ScoringSection />}
        {active === "predictions" && <PredictionsSection />}
        {active === "leaderboard" && <LeaderboardSection />}
        {active === "duels" && <DuelsSection />}
        {active === "challenges" && <ChallengesSection />}
        {active === "lounge" && <LoungeSection />}
      </div>
    </div>
  );
}

/* ── Section components ──────────────────────────────────────────────────── */

function ScoringSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-3">How Scoring Works</h2>
        <p className="text-sm text-rz-text-secondary mb-4">
          For every match, you predict the final score. After the match is
          confirmed, your prediction is scored against the actual result.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rz-border text-left">
              <th className="pb-2 font-medium text-rz-text-muted">Result</th>
              <th className="pb-2 font-medium text-rz-text-muted text-center">Points</th>
              <th className="pb-2 font-medium text-rz-text-muted">Example</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rz-border">
            <tr>
              <td className="py-3">
                <span className="font-semibold text-rz-success">Exact Score</span>
                <p className="text-xs text-rz-text-muted mt-0.5">
                  Both home and away scores match exactly
                </p>
              </td>
              <td className="py-3 text-center">
                <span className="text-xl font-bold text-rz-success">3</span>
              </td>
              <td className="py-3 text-xs text-rz-text-muted">
                You predicted 2-1, result was 2-1
              </td>
            </tr>
            <tr>
              <td className="py-3">
                <span className="font-semibold text-rz-warning">Correct Outcome</span>
                <p className="text-xs text-rz-text-muted mt-0.5">
                  Right winner (or draw) but wrong score
                </p>
              </td>
              <td className="py-3 text-center">
                <span className="text-xl font-bold text-rz-warning">1</span>
              </td>
              <td className="py-3 text-xs text-rz-text-muted">
                You predicted 2-1, result was 3-0 (both home win)
              </td>
            </tr>
            <tr>
              <td className="py-3">
                <span className="font-semibold text-rz-text-muted">Miss</span>
                <p className="text-xs text-rz-text-muted mt-0.5">
                  Wrong outcome entirely
                </p>
              </td>
              <td className="py-3 text-center">
                <span className="text-xl font-bold text-rz-text-muted">0</span>
              </td>
              <td className="py-3 text-xs text-rz-text-muted">
                You predicted 2-1, result was 0-0 (you said home win, it was a draw)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-rz-red/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-rz-red mb-1">
          Outcome Determination
        </h3>
        <ul className="text-xs text-rz-red/80 space-y-1">
          <li>• <strong>Home win:</strong> home score &gt; away score</li>
          <li>• <strong>Draw:</strong> home score = away score</li>
          <li>• <strong>Away win:</strong> home score &lt; away score</li>
        </ul>
      </div>
    </div>
  );
}

function PredictionsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-3">Predictions</h2>
        <p className="text-sm text-rz-text-secondary mb-4">
          Submit one prediction per match with your expected final score for each team.
        </p>
      </div>

      <div className="space-y-3">
        <Rule
          title="Submit Before Lock Time"
          description="Each match has a lock time (default: 1 hour before kickoff). You must submit your prediction before this time. Once locked, predictions cannot be changed."
        />
        <Rule
          title="Edit Freely Until Locked"
          description="You can create, update, or delete your prediction as many times as you want before the lock time. Only your final prediction counts."
        />
        <Rule
          title="Automatic Scoring"
          description="Once a match result is confirmed, points are calculated automatically. You don't need to do anything — just check the leaderboard!"
        />
        <Rule
          title="Score Format"
          description="Both home and away scores must be non-negative whole numbers (0, 1, 2, …). No decimals or negative numbers."
        />
      </div>

      <div className="bg-blue-900/20 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-400 mb-1">
          💡 Tip
        </h3>
        <p className="text-xs text-blue-300">
          Submit your predictions early! If a match kicks off earlier than
          expected, late predictions won&apos;t be accepted. The server enforces the
          lock time regardless of what the client shows.
        </p>
      </div>
    </div>
  );
}

function LeaderboardSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-3">Leaderboard & Rankings</h2>
        <p className="text-sm text-rz-text-secondary mb-4">
          Your standings are based on accumulated points from predictions and flash challenges.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Leaderboard Views</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="bg-rz-surface-2 rounded-lg p-3">
            <p className="text-sm font-medium">Global</p>
            <p className="text-xs text-rz-text-muted mt-1">All matches across all tournaments</p>
          </div>
          <div className="bg-rz-surface-2 rounded-lg p-3">
            <p className="text-sm font-medium">By Tournament</p>
            <p className="text-xs text-rz-text-muted mt-1">Points from one tournament only</p>
          </div>
          <div className="bg-rz-surface-2 rounded-lg p-3">
            <p className="text-sm font-medium">By Stage</p>
            <p className="text-xs text-rz-text-muted mt-1">Points from a specific round/stage</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Tie-Breaker Rules</h3>
        <p className="text-xs text-rz-text-muted mb-2">When players are tied on points, we use these rules in order:</p>
        <ol className="text-sm space-y-2">
          <li className="flex items-start gap-2">
            <span className="bg-rz-red/10 text-rz-red text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">1</span>
            <span>Highest total points</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-rz-red/10 text-rz-red text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">2</span>
            <span>Most exact-score predictions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-rz-red/10 text-rz-red text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">3</span>
            <span>Most correct-outcome predictions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-rz-red/10 text-rz-red text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">4</span>
            <span>Alphabetical by display name (final tie-breaker)</span>
          </li>
        </ol>
      </div>

      <div className="bg-blue-900/20 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-400 mb-1">
          🔒 Frozen Stages
        </h3>
        <p className="text-xs text-blue-300">
          When a tournament stage ends, an admin may freeze its leaderboard.
          Frozen stage standings are final and won&apos;t change.
        </p>
      </div>
    </div>
  );
}

function DuelsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-3">Duels (Point Staking)</h2>
        <p className="text-sm text-rz-text-secondary mb-4">
          Challenge another player to a 1-on-1 prediction showdown. Wager your earned points — the winner takes the full pot!
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">How Duels Work</h3>
        <div className="flex flex-col gap-2">
          <Step num={1} text="Choose a match, an opponent, and a stake amount (1–50 points)." />
          <Step num={2} text="Your opponent has 24 hours to accept or decline." />
          <Step num={3} text="If accepted, both players' stakes are placed in escrow (deducted from balance)." />
          <Step num={4} text="Both submit predictions through the normal system — no separate duel prediction needed." />
          <Step num={5} text="When the match result is confirmed, the player with more prediction points wins the pot (2× stake)." />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Staking & Escrow</h3>
        <div className="space-y-3">
          <Rule
            title="Stake Range"
            description="You can wager between 1 and 50 points per duel."
          />
          <Rule
            title="Escrow on Accept"
            description="When a duel is accepted, both players' stakes are deducted and held in escrow."
          />
          <Rule
            title="Winner Takes All"
            description="The winner receives the full pot (2× the stake). Net gain = stake amount."
          />
          <Rule
            title="Tie = Refund"
            description="If both players score the same prediction points, both stakes are fully refunded."
          />
          <Rule
            title="Insufficient Points"
            description="You cannot create or accept a duel if you don't have enough available points."
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Duel Rules</h3>
        <div className="space-y-3">
          <Rule
            title="One Duel Per Matchup"
            description="Only one active duel is allowed per challenger/opponent/match combination."
          />
          <Rule
            title="Standard Predictions"
            description="Both players use their regular predictions — no special duel predictions."
          />
          <Rule
            title="No Prediction = 0 Points"
            description="If a player doesn't submit a prediction for the match, they get 0 points in the duel."
          />
          <Rule
            title="24-Hour Expiry"
            description="Duel invitations expire after 24 hours if not accepted or declined. Pending duels have no escrow."
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Duel Lifecycle</h3>
        <div className="bg-rz-surface-2 rounded-lg p-4 text-xs font-mono text-center">
          {" → "}
          <span className="text-blue-600">ACTIVE</span>
          <span className="text-rz-text-muted"> (escrow)</span>
          {" → "}
          <span className="text-rz-success">COMPLETED</span>
          <span className="text-rz-text-muted"> (payout)</span>
          <br />
          <span className="text-rz-warning ml-16">↘</span>{" "}
          <span className="text-red-400">DECLINED</span>
          <br />
          <span className="text-rz-warning ml-16">↘</span>{" "}
          <span className="text-rz-text-muted">EXPIRED</span>
        </div>
      </div>
    </div>
  );
}

function ChallengesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-3">Flash Challenges (Paid Entry)</h2>
        <p className="text-sm text-rz-text-secondary mb-4">
          Quick questions created by admins during matches or tournament stages. Pay an entry
          fee from your points balance — answer correctly to win reward points!
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">How Challenges Work</h3>
        <div className="flex flex-col gap-2">
          <Step num={1} text="An admin creates a challenge with a question, entry cost, and reward points." />
          <Step num={2} text="You pay the entry cost from your available balance when you submit your first answer." />
          <Step num={3} text="You can change your answer for free as many times as you want before the challenge closes." />
          <Step num={4} text="After the event, the admin selects the correct answer and resolves the challenge." />
          <Step num={5} text="If you answered correctly, you receive the reward points. If wrong, you lose your entry fee." />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Entry & Rewards</h3>
        <div className="space-y-3">
          <Rule
            title="Paid Entry"
            description="Each challenge has an entry cost. The cost is deducted from your challenge balance when you submit your first answer."
          />
          <Rule
            title="Free Edits"
            description="After your initial entry, you can change your answer as many times as you want before close time — no extra cost."
          />
          <Rule
            title="Reward Points"
            description="If you answer correctly, you receive the reward points added to your challenge balance."
          />
          <Rule
            title="Insufficient Balance"
            description="You cannot enter a challenge if your available balance is less than the entry cost."
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Challenge Rules</h3>
        <div className="space-y-3">
          <Rule
            title="Types"
            description="Yes/No questions or multiple-choice questions with one correct answer."
          />
          <Rule
            title="Time Windows"
            description="Each challenge has an open time and a close time. You can only answer while the challenge is active and open."
          />
          <Rule
            title="Resolution"
            description="Admins manually select the correct answer after the event. Reward points are awarded immediately upon resolution."
          />
          <Rule
            title="Cancellation = Refund"
            description="If an admin cancels a challenge, all participants get their entry cost fully refunded."
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Challenge Lifecycle</h3>
        <div className="bg-rz-surface-2 rounded-lg p-4 text-xs font-mono text-center">
          <span className="text-rz-text-muted">DRAFT</span>
          {" → "}
          <span className="text-blue-400">ACTIVE</span>
          <span className="text-rz-text-muted"> (open for answers)</span>
          {" → "}
          <span className="text-rz-warning">LOCKED</span>
          {" → "}
          <span className="text-rz-success">RESOLVED</span>
          <span className="text-rz-text-muted"> (rewards paid)</span>
          <br />
          <span className="text-blue-400 ml-20">↘</span>{" "}
          <span className="text-red-400">CANCELLED</span>
          <span className="text-rz-text-muted"> (refunds issued)</span>
        </div>
      </div>

      <div className="bg-purple-900/20 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-purple-400 mb-1">
          Stay Alert!
        </h3>
        <p className="text-xs text-purple-300">
          Flash challenges can appear at any time during live matches. Check the
          Challenges tab regularly to catch them before they close! Remember, you
          can always change your mind before the deadline at no extra cost.
        </p>
      </div>
    </div>
  );
}

function LoungeSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-3">Match Lounge</h2>
        <p className="text-sm text-rz-text-secondary mb-4">
          Every match has a comment section where you can chat, react, and
          discuss with other players.
        </p>
      </div>

      <div className="space-y-3">
        <Rule
          title="Grace Period"
          description="You can edit or delete your own comments within 5 minutes of posting. After that, they're permanent."
        />
        <Rule
          title="Character Limit"
          description="Each comment can be up to 500 characters."
        />
        <Rule
          title="Mention Other Players"
          description="Type @ to mention other players in your comments. They'll be highlighted."
        />
        <Rule
          title="Be Respectful"
          description="Admins can delete any comment at any time. Keep the conversation fun and friendly!"
        />
      </div>
    </div>
  );
}

/* ── Reusable sub-components ─────────────────────────────────────────── */

function Rule({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-rz-surface-2">
      <span className="text-rz-red mt-0.5 shrink-0">✓</span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-rz-text-secondary mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-rz-red text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">
        {num}
      </span>
      <p className="text-sm text-rz-text-secondary pt-0.5">{text}</p>
    </div>
  );
}
