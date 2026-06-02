/* ──────────────────────────────────────────────────────────
   Penalty Rush — Analytics Event Hooks
   Wire a handler later (e.g. PostHog, Mixpanel).
   ────────────────────────────────────────────────────────── */

export type GameEvent =
  | "game_started"
  | "shot_taken"
  | "goal_scored"
  | "saved"
  | "missed"
  | "game_finished"
  | "restart";

type Handler = (event: GameEvent, data?: Record<string, unknown>) => void;
const handlers: Handler[] = [];

export function emit(event: GameEvent, data?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log(`[PR] ${event}`, data ?? "");
  }
  for (const h of handlers) h(event, data);
}

export function onEvent(handler: Handler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}
