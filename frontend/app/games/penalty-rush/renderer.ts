/* ──────────────────────────────────────────────────────────
   Penalty Rush — Canvas Renderer (Pixel-Art Arcade Edition)
   All drawing lives here. Engine stays pure logic.
   Hybrid: pixel-art gameplay + clean modern HUD.
   ────────────────────────────────────────────────────────── */

import { CFG } from "./config";
import type { GameState, Lane, Particle, TextPopup } from "./types";
import { gkCanvasX } from "./goalkeeper";
import { getPerfectZone, getGoodZone } from "./timing";
import {
  getGkFrames,
  getBallFrames,
  getLightFrames,
  getLogoFrames,
  GK_SIZE,
  BALL_SIZE,
  LIGHT_SIZE,
  LOGO_SIZE,
  getCrowdTexture,
  getGrassTexture,
} from "./sprites";

const C = CFG.colors;
const L = CFG.layout;

/* ═══════════════════════════════════════════════════════════
   Main entry — called once per frame
   ═══════════════════════════════════════════════════════════ */

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false; // crisp pixel art

  // Screen shake
  if (state.screenShake > 0) {
    const sx = (Math.random() - 0.5) * state.screenShake * 2;
    const sy = (Math.random() - 0.5) * state.screenShake * 2;
    ctx.translate(Math.round(sx), Math.round(sy));
  }

  // Camera zoom during charge — subtle pull toward goal area
  if (state.cameraZoom > 0) {
    const z = 1 + state.cameraZoom;
    const focusY = H * 0.35; // focus near goal
    ctx.translate(W / 2, focusY);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -focusY);
  }

  drawStadiumBackground(ctx, state, W, H);
  drawGrass(ctx, W, H);
  drawGoal(ctx, state, W, H);
  drawGoalkeeper(ctx, state, W, H);
  drawBall(ctx, state, W, H);

  if (
    state.phase === "charging" ||
    state.phase === "shooting" ||
    state.phase === "result"
  ) {
    drawTimingBar(ctx, state, W, H);
  }

  drawDirectionIndicators(ctx, state, W, H);
  drawShootZone(ctx, state, W, H);
  drawParticles(ctx, state.particles, W, H);
  drawTextPopups(ctx, state.textPopups, W, H);
  drawResultFlash(ctx, state, W, H);
  drawVignette(ctx, state, W, H);
  drawHUD(ctx, state, W, H);

  ctx.restore();
}

/* ── Stadium background (depth layered) ────────────────── */

function drawStadiumBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  // Sky gradient — deep dark to slightly lighter
  const skyBottom = H * 0.54;
  const g = ctx.createLinearGradient(0, 0, 0, skyBottom);
  g.addColorStop(0, C.stadiumDark);
  g.addColorStop(0.6, C.stadiumMid);
  g.addColorStop(1, "#0f1525");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, skyBottom);

  // Stadium crowd band — reduced opacity for less noise
  const crowdTop = H * 0.08;
  const crowdBottom = H * 0.42;
  const crowdH = crowdBottom - crowdTop;
  const crowd = getCrowdTexture(Math.ceil(W), Math.ceil(crowdH));
  ctx.globalAlpha = 0.3; // dimmer crowd — less visual noise
  ctx.drawImage(crowd, 0, crowdTop, W, crowdH);
  ctx.globalAlpha = 1;

  // Heavy darkening overlay on crowd — pushes it further back
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, crowdTop, W, crowdH);

  // Darker row at top of crowd (upper deck shadow)
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, crowdTop, W, crowdH * 0.2);

  // Subtle blur effect on crowd (gradient fade at edges)
  const crowdFade = ctx.createLinearGradient(0, crowdTop, 0, crowdBottom);
  crowdFade.addColorStop(0, "rgba(8,9,15,0.6)");
  crowdFade.addColorStop(0.4, "rgba(8,9,15,0.2)");
  crowdFade.addColorStop(0.8, "rgba(8,9,15,0.1)");
  crowdFade.addColorStop(1, "rgba(8,9,15,0.4)");
  ctx.fillStyle = crowdFade;
  ctx.fillRect(0, crowdTop, W, crowdH);

  // Stadium lights (pixel-art)
  const ps = Math.max(2, Math.round(W / 180));
  const lights = getLightFrames(ps);
  if (lights.length > 0) {
    const lc = lights[0];
    const positions = [W * 0.12, W * 0.3, W * 0.7, W * 0.88];
    for (const lx of positions) {
      ctx.drawImage(lc, Math.round(lx - lc.width / 2), Math.round(crowdTop - lc.height * 0.5));
    }
  }

  // Light beams — brighter, focused on goal area
  ctx.globalAlpha = 0.05;
  const beamPositions = [W * 0.12, W * 0.3, W * 0.7, W * 0.88];
  for (const bx of beamPositions) {
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(bx - 3, crowdTop);
    ctx.lineTo(bx - W * 0.1, skyBottom);
    ctx.lineTo(bx + W * 0.1, skyBottom);
    ctx.lineTo(bx + 3, crowdTop);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Brighter focus glow near goal area
  const goalGlow = ctx.createRadialGradient(
    W / 2, H * 0.35, W * 0.05,
    W / 2, H * 0.35, W * 0.5,
  );
  goalGlow.addColorStop(0, "rgba(255,255,255,0.04)");
  goalGlow.addColorStop(0.5, "rgba(255,255,255,0.01)");
  goalGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = goalGlow;
  ctx.fillRect(0, 0, W, skyBottom);

  // Stadium edge / wall
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, crowdBottom, W, 4);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, crowdBottom, W, 1);
}

/* ── Grass field (depth gradient toward goal) ──────────── */

function drawGrass(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const grassTop = H * 0.44;
  const grassH = H - grassTop;
  const grass = getGrassTexture(Math.ceil(W), Math.ceil(grassH));
  ctx.drawImage(grass, 0, grassTop, W, grassH);

  // Depth gradient — brighter near goal, darker near player
  const depthGrad = ctx.createLinearGradient(0, grassTop, 0, grassTop + grassH);
  depthGrad.addColorStop(0, "rgba(255,255,255,0.03)"); // slight brightness near goal
  depthGrad.addColorStop(0.3, "rgba(0,0,0,0)");
  depthGrad.addColorStop(1, "rgba(0,0,0,0.15)");       // darker near player
  ctx.fillStyle = depthGrad;
  ctx.fillRect(0, grassTop, W, grassH);

  // ── Penalty area white lines ──────────────────────────
  const goalLineY = H * L.goalBottom;
  const penDepth = H * 0.165;
  const sixDepth = H * 0.055;
  const penBottom = goalLineY + penDepth;
  const sixBottom = goalLineY + sixDepth;

  // Perspective widths (wider at bottom — closer to camera)
  const penTopW = W * 0.88;
  const penBotW = W * 0.94;
  const sixTopW = W * 0.76;
  const sixBotW = W * 0.80;

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;

  // 18-yard box (trapezoid for perspective)
  ctx.beginPath();
  ctx.moveTo((W - penTopW) / 2, goalLineY);
  ctx.lineTo((W + penTopW) / 2, goalLineY);
  ctx.lineTo((W + penBotW) / 2, penBottom);
  ctx.lineTo((W - penBotW) / 2, penBottom);
  ctx.closePath();
  ctx.stroke();

  // 6-yard box (trapezoid)
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.moveTo((W - sixTopW) / 2, goalLineY);
  ctx.lineTo((W + sixTopW) / 2, goalLineY);
  ctx.lineTo((W + sixBotW) / 2, sixBottom);
  ctx.lineTo((W - sixBotW) / 2, sixBottom);
  ctx.closePath();
  ctx.stroke();

  // Penalty spot
  const spotX = W / 2;
  const spotY = H * L.ballY;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.arc(spotX, spotY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Penalty arc (D-shape clipped outside box)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, penBottom, W, H - penBottom);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(spotX, spotY, H * 0.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ── Goal ──────────────────────────────────────────────── */

function goalRect(W: number, H: number) {
  const gw = W * CFG.goal.widthRatio;
  const gx = (W - gw) / 2;
  const gy = H * L.goalTop;
  const gh = H * (L.goalBottom - L.goalTop);
  return { gx, gy, gw, gh };
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  const { gx, gy, gw, gh } = goalRect(W, H);
  const pw = CFG.goal.postWidth;
  const ch = CFG.goal.crossbarHeight;
  const ns = CFG.goal.netSpacing;

  // Goal back shadow (depth)
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(gx + 3, gy + 3, gw, gh);

  // Net grid (with ripple)
  const rip = state.netRipple;
  ctx.lineWidth = 0.8;
  for (let x = gx; x <= gx + gw; x += ns) {
    ctx.strokeStyle = rip > 0.3 ? C.netHighlight : C.net;
    ctx.beginPath();
    for (let y = gy; y <= gy + gh; y += 3) {
      const off = rip > 0 ? Math.sin((y - gy) * 0.12 + x * 0.06) * rip * 4 : 0;
      y === gy ? ctx.moveTo(x + off, y) : ctx.lineTo(x + off, y);
    }
    ctx.stroke();
  }
  for (let y = gy; y <= gy + gh; y += ns) {
    ctx.strokeStyle = C.net;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
  }

  // Lane highlight when selected
  if (
    state.selectedLane &&
    (state.phase === "aiming" || state.phase === "charging")
  ) {
    const nx = CFG.lanes[state.selectedLane];
    const cx = gx + gw * ((nx + 1) / 2);
    ctx.fillStyle = "rgba(225,29,46,0.10)";
    ctx.fillRect(cx - gw / 6, gy + 2, gw / 3, gh - 4);
    // Lane marker line
    ctx.strokeStyle = "rgba(225,29,46,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, gy + gh);
    ctx.lineTo(cx, gy + gh + H * 0.18);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Posts — pixel-art style (layered for 3D feel)
  // Post shadow
  ctx.fillStyle = C.postShadow;
  ctx.fillRect(gx - pw / 2 + 2, gy + 2, pw, gh);
  ctx.fillRect(gx + gw - pw / 2 + 2, gy + 2, pw, gh);
  ctx.fillRect(gx - pw / 2 + 2, gy - ch / 2 + 2, gw + pw, ch);
  // Post body
  ctx.fillStyle = C.post;
  ctx.fillRect(gx - pw / 2, gy, pw, gh);
  ctx.fillRect(gx + gw - pw / 2, gy, pw, gh);
  // Crossbar
  ctx.fillStyle = C.post;
  ctx.fillRect(gx - pw / 2, gy - ch / 2, gw + pw, ch);
  // Highlight edge (top/left of posts)
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(gx - pw / 2, gy, 1, gh);
  ctx.fillRect(gx + gw - pw / 2, gy, 1, gh);
  ctx.fillRect(gx - pw / 2, gy - ch / 2, gw + pw, 1);
}

/* ── Goalkeeper (pixel sprite + anticipation) ──────────── */

function drawGoalkeeper(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  const { gx, gy, gw, gh } = goalRect(W, H);
  const gkCX = gkCanvasX(state.gkPosition, gx, gw);

  // Determine pixel scale based on goal size
  const targetGkH = gh * CFG.gk.heightRatio;
  const ps = Math.max(2, Math.round(targetGkH / GK_SIZE.h));

  // Pick sprite frame
  let frameIdx = state.gkAnimFrame;
  // Override with dive frame during shot/result
  if (state.phase === "shooting" || state.phase === "result") {
    if (state.selectedLane === "left") {
      frameIdx = CFG.gkAnim.diveLeftFrame;
    } else if (state.selectedLane === "right") {
      frameIdx = CFG.gkAnim.diveRightFrame;
    }
  }
  // Show celebrate on save, sad on goal scored against
  if (state.phase === "result" && state.resultTimer > 200) {
    if (state.shotResult === "save") {
      frameIdx = CFG.gkAnim.celebrateFrame;
    } else if (state.shotResult === "goal") {
      frameIdx = CFG.gkAnim.sadFrame;
    }
  }

  const frames = getGkFrames(ps);
  const sprW = GK_SIZE.w * ps;
  const sprH = GK_SIZE.h * ps;
  let gkBaseY = gy + gh - sprH;

  // Anticipation bounce during charging — small vertical bob + lean
  if (state.phase === "charging") {
    const bounce = state.gkAnticipation * ps * 1.5;
    gkBaseY += bounce;
  }

  // Shadow under GK — stretched, darker
  const shadowW = sprW * 0.5;
  const shadowH = 4;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(gkCX, gy + gh + 2, shadowW, shadowH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw sprite
  if (frames[frameIdx]) {
    ctx.drawImage(
      frames[frameIdx],
      Math.round(gkCX - sprW / 2),
      Math.round(gkBaseY),
      sprW,
      sprH,
    );
  }
}

/* ── Ball (fast acceleration + motion trail + impact) ───── */

function drawBall(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  const { gx, gy, gw, gh } = goalRect(W, H);
  const sx = W / 2;
  const sy = H * L.ballY;
  let bx = sx, by = sy, scale = 1, alpha = 1;

  const ps = Math.max(2, Math.round(CFG.ball.radius * 2 / BALL_SIZE.w));
  const ballFrames = getBallFrames(ps);
  const sprW = BALL_SIZE.w * ps;
  const sprH = BALL_SIZE.h * ps;

  if (state.phase === "shooting" || state.phase === "result") {
    if (state.selectedLane) {
      const nx = CFG.lanes[state.selectedLane];
      const tx = gx + gw * ((nx + 1) / 2);
      const ty = gy + gh * 0.35;
      // Ease-in-out: fast start + fast arrive, slight slow in middle
      const raw = Math.min(1, state.shotProgress);
      const e = raw < 0.5
        ? 4 * raw * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      bx = sx + (tx - sx) * e;
      by = sy + (ty - sy) * e;
      by += -H * 0.08 * Math.sin(e * Math.PI); // arc
      scale = 1 - e * 0.45;

      // Motion trail — elongated streaks, not just circles
      if (state.shotProgress > 0.03 && state.shotProgress < 1) {
        const trailCount = 7;
        for (let t = trailCount; t >= 1; t--) {
          const tProgress = Math.max(0, state.shotProgress - t * 0.035);
          const tRaw = Math.min(1, tProgress);
          const te = tRaw < 0.5
            ? 4 * tRaw * tRaw * tRaw
            : 1 - Math.pow(-2 * tRaw + 2, 3) / 2;
          const tx2 = sx + (tx - sx) * te;
          let ty2 = sy + (ty - sy) * te;
          ty2 += -H * 0.08 * Math.sin(te * Math.PI);
          const ts = 1 - te * 0.45;
          const ta = (1 - t / (trailCount + 1)) * 0.35 * (1 - e);
          ctx.globalAlpha = ta;
          // White-hot core + colored outer
          ctx.fillStyle = t <= 2 ? "#FFF" : "rgba(255,200,100,0.8)";
          const tr = sprW * ts * (0.35 - t * 0.03);
          if (tr > 0.5) {
            ctx.beginPath();
            ctx.arc(tx2, ty2, tr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      if (state.shotResult === "miss" && state.phase === "result") {
        by -= state.resultTimer * 0.5;
        alpha = Math.max(0, 1 - state.resultTimer / CFG.anim.resultDisplay);
      }
    }
  }

  if (alpha <= 0) return;

  // Use frame 1 during shot for spin effect
  const frameIdx = state.phase === "shooting" ? 1 : 0;

  // Shadow
  ctx.globalAlpha = 0.3 * alpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(
    bx, by + sprH * scale * 0.5 + 3,
    sprW * scale * 0.35, 2, 0, 0, Math.PI * 2,
  );
  ctx.fill();
  ctx.globalAlpha = alpha;

  // Scale the sprite
  const dw = sprW * scale;
  const dh = sprH * scale;
  if (ballFrames[frameIdx]) {
    ctx.drawImage(
      ballFrames[frameIdx],
      Math.round(bx - dw / 2),
      Math.round(by - dh / 2),
      Math.round(dw),
      Math.round(dh),
    );
  }

  // Impact flash on result — bigger, more dramatic
  if (state.phase === "result" && state.resultTimer < 120) {
    const flashA = 1 - state.resultTimer / 120;
    if (state.shotResult === "goal") {
      // Goal: warm white flash + colored ring
      ctx.globalAlpha = flashA * 0.7 * alpha;
      ctx.fillStyle = "#FFF";
      ctx.beginPath();
      ctx.arc(bx, by, dw * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = flashA * 0.4 * alpha;
      ctx.strokeStyle = C.green;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by, dw * (0.8 + (1 - flashA) * 1.5), 0, Math.PI * 2);
      ctx.stroke();
    } else if (state.shotResult === "save") {
      // Save: red impact burst
      ctx.globalAlpha = flashA * 0.6 * alpha;
      ctx.fillStyle = C.red;
      ctx.beginPath();
      ctx.arc(bx, by, dw * (0.5 + (1 - flashA) * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}

/* ── Timing Bar (with charge pulse glow) ───────────────── */

function drawTimingBar(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  const bw = W * CFG.timing.barWidthRatio;
  const bh = CFG.timing.barHeight;
  const bx = (W - bw) / 2;
  const by = H * L.timingBarY;

  const pz = getPerfectZone(state.level);
  const gz = getGoodZone(state.level);
  const cx = bx + bw / 2;
  const pzPx = pz * bw;
  const gzPx = gz * bw;

  // Pulsing glow behind bar during charging
  if (state.phase === "charging") {
    const pulse = 0.3 + Math.sin(Date.now() * 0.006) * 0.2;
    ctx.shadowColor = "rgba(255,255,255,0.5)";
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = `rgba(255,255,255,${pulse * 0.08})`;
    ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
    ctx.shadowBlur = 0;
  }

  // Track background with pixel-crisp border
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(bx, by, bw, bh);

  // Colour zones
  // Miss (red)
  ctx.fillStyle = "rgba(220,38,38,0.35)";
  ctx.fillRect(bx, by, bw, bh);
  // Good (yellow)
  ctx.fillStyle = "rgba(234,179,8,0.40)";
  ctx.fillRect(cx - gzPx, by, gzPx * 2, bh);
  // Perfect (green + glow)
  ctx.fillStyle = "rgba(34,197,94,0.55)";
  ctx.fillRect(cx - pzPx, by, pzPx * 2, bh);

  // Zone divider lines
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  for (const off of [-gzPx, gzPx, -pzPx, pzPx]) {
    ctx.beginPath();
    ctx.moveTo(cx + off, by);
    ctx.lineTo(cx + off, by + bh);
    ctx.stroke();
  }

  // Center mark
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(cx, by, 1, bh);

  // Indicator — pixel-style rectangle instead of circle
  const ix = Math.round(bx + state.timingValue * bw);
  const iw = 4;
  const ih = bh + 6;
  // Glow
  ctx.shadowColor = "#FFF";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#FFF";
  ctx.fillRect(ix - iw / 2, by - 3, iw, ih);
  ctx.shadowBlur = 0;

  // Quality label when frozen
  if (state.timingFrozen && state.timingQuality) {
    const lbl = state.timingQuality.toUpperCase();
    const col =
      state.timingQuality === "perfect" ? C.gold :
      state.timingQuality === "good" ? C.green : C.red;
    // Shadow
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillText(lbl, ix + 1, by - 7);
    // Colored text with glow
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 6;
    ctx.fillText(lbl, ix, by - 8);
    ctx.shadowBlur = 0;
  }
}

/* ── Direction indicators (subtle zone hints) ───────────── */

function drawDirectionIndicators(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  if (state.phase === "gameover" || state.phase === "shooting" || state.phase === "result") return;

  const y = H * L.directionsY;

  // Zone separators — thin vertical lines
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(W / 3, y - 20);
  ctx.lineTo(W / 3, y + 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo((W * 2) / 3, y - 20);
  ctx.lineTo((W * 2) / 3, y + 20);
  ctx.stroke();
  ctx.setLineDash([]);

  // Small arrow labels
  const items: { label: string; x: number }[] = [
    { label: "◀", x: W * 0.17 },
    { label: "▼", x: W * 0.5 },
    { label: "▶", x: W * 0.83 },
  ];
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const { label, x } of items) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(label, x, y);
  }
}

/* ── Shoot zone hint (minimal, integrated) ─────────────── */

function drawShootZone(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  if (state.phase === "gameover") return;

  const y = H * (L.shootZoneTop + 0.04);

  if (state.phase === "charging") {
    const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.3;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(34,197,94,${pulse})`;
    ctx.fillText("▲ RELEASE ▲", W / 2, y);
  } else if (state.phase === "ready") {
    retro16Text(ctx, "TAP TO SHOOT", W / 2, y, 11, "rgba(255,255,255,0.18)");
  }
}

/* ── Particles ─────────────────────────────────────────── */

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  W: number,
  H: number,
) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    // Pixel-art: square particles
    const sz = Math.max(2, Math.round(p.size * a));
    ctx.fillRect(
      Math.round(p.x * W - sz / 2),
      Math.round(p.y * H - sz / 2),
      sz, sz,
    );
  }
  ctx.globalAlpha = 1;
}

/* ── Text popups ───────────────────────────────────────── */

function drawTextPopups(
  ctx: CanvasRenderingContext2D,
  popups: TextPopup[],
  W: number,
  H: number,
) {
  for (const p of popups) {
    if (p.life <= 0) continue;
    const a = p.life / p.maxLife;
    const s = 1 + (1 - a) * 0.25;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x * W, p.y * H);
    ctx.scale(s, s);
    ctx.font = `bold ${p.fontSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Outline
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, 0, 0);
    // Text
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    // Glow for gold/green
    if (p.color === C.gold || p.color === C.green) {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fillText(p.text, 0, 0);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ── Result flash (stronger impact) ────────────────────── */

function drawResultFlash(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  if (state.phase !== "result") return;
  const t = state.resultTimer / CFG.anim.resultDisplay;
  const a = Math.max(0, 1 - t);

  if (state.shotResult === "goal") {
    // Full screen flash — strong
    ctx.fillStyle = `rgba(34,197,94,${a * 0.2})`;
    ctx.fillRect(0, 0, W, H);

    // Goal area glow
    const { gx, gy, gw, gh } = goalRect(W, H);
    const goalGlow = ctx.createRadialGradient(
      gx + gw / 2, gy + gh / 2, 0,
      gx + gw / 2, gy + gh / 2, gw * 0.6,
    );
    goalGlow.addColorStop(0, `rgba(255,255,255,${a * 0.25})`);
    goalGlow.addColorStop(0.5, `rgba(34,197,94,${a * 0.1})`);
    goalGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = goalGlow;
    ctx.fillRect(0, 0, W, H);

    // Scanline overlay on strong hits
    if (a > 0.5) {
      ctx.fillStyle = `rgba(0,0,0,${(a - 0.5) * 0.08})`;
      for (let y = 0; y < H; y += 3) {
        ctx.fillRect(0, y, W, 1);
      }
    }
  } else if (state.shotResult === "save") {
    // Save: red impact flash
    ctx.fillStyle = `rgba(225,29,46,${a * 0.18})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Miss: softer, darker
    ctx.fillStyle = `rgba(0,0,0,${a * 0.1})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ── Vignette (intensifies during charging) ────────────── */

function drawVignette(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  // Tighten vignette during charging for tunnel vision
  const zoomExtra = state.phase === "charging" ? state.cameraZoom * 3 : 0;
  const innerR = W * (0.25 - zoomExtra * 0.5);
  const outerR = W * (0.8 - zoomExtra * 0.8);
  const baseAlpha = 0.65 + zoomExtra * 0.4;

  const g = ctx.createRadialGradient(
    W / 2, H * 0.4, Math.max(innerR, W * 0.08),
    W / 2, H * 0.4, Math.max(outerR, W * 0.3),
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${Math.min(baseAlpha, 0.85)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ── HUD (Mortal Kombat–style top bar) ──────────────────── */

function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  W: number,
  H: number,
) {
  const HUD_H = Math.round(H * 0.105);
  const pad = 14;

  // Dark background with gradient
  const bg = ctx.createLinearGradient(0, 0, 0, HUD_H);
  bg.addColorStop(0, "rgba(6,6,16,0.96)");
  bg.addColorStop(0.7, "rgba(10,10,24,0.94)");
  bg.addColorStop(1, "rgba(8,8,18,0.90)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, HUD_H);

  // Top edge highlight
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, 0, W, 1);

  // Gold bottom border — ornate MK frame
  ctx.fillStyle = "#2a1e00";
  ctx.fillRect(0, HUD_H - 5, W, 5);
  ctx.fillStyle = "#B8962E";
  ctx.fillRect(0, HUD_H - 4, W, 1);
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(0, HUD_H - 3, W, 1);
  ctx.fillStyle = "#B8962E";
  ctx.fillRect(0, HUD_H - 2, W, 1);
  ctx.fillStyle = "rgba(255,215,0,0.15)";
  ctx.fillRect(0, HUD_H - 1, W, 1);

  // Corner diamonds (MK-style embellishments)
  const dSz = 5;
  for (const dx of [pad + 4, W - pad - 4]) {
    const dy = HUD_H - 5;
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(dx, dy - dSz);
    ctx.lineTo(dx + dSz, dy);
    ctx.lineTo(dx, dy + dSz);
    ctx.lineTo(dx - dSz, dy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8B6914";
    ctx.beginPath();
    ctx.moveTo(dx, dy - dSz + 2);
    ctx.lineTo(dx + dSz - 2, dy);
    ctx.lineTo(dx, dy + dSz - 2);
    ctx.lineTo(dx - dSz + 2, dy);
    ctx.closePath();
    ctx.fill();
  }

  // ── REDZONE logo centred (2× larger) ──
  const logoScale = Math.max(4, Math.min(6, Math.floor(W / 80)));
  const logoFrames = getLogoFrames(logoScale);
  if (logoFrames.length > 0) {
    const lw = LOGO_SIZE.w * logoScale;
    const lh = LOGO_SIZE.h * logoScale;
    const lx = Math.round(W / 2 - lw / 2);
    const ly = Math.round(HUD_H * 0.12);
    // Red glow behind logo
    ctx.shadowColor = "rgba(225,29,46,0.4)";
    ctx.shadowBlur = 10;
    ctx.drawImage(logoFrames[0], lx, ly, lw, lh);
    ctx.shadowBlur = 0;
  }

  // Level + streak below logo
  const labelY = HUD_H * 0.72;
  retro16Text(ctx, `LV ${state.level}`, W / 2, labelY, 10, C.gold);
  if (state.streak >= 2) {
    retro16Text(ctx, `x${state.streak}`, W / 2 + 28, labelY, 9, C.green);
  }

  // Score — left (pushed right to avoid close button)
  const scoreX = pad + 32;
  const scoreY = HUD_H * 0.36;
  retro16Text(ctx, state.score.toLocaleString(), scoreX, scoreY, 20, C.white, "left");
  retro16Text(ctx, "SCORE", scoreX, scoreY + 15, 7, "#9CA3AF", "left");

  // Lives — right (pulled left to avoid mute button)
  const heartSize = 12;
  const heartSpacing = 16;
  const livesRight = W - pad - 32;
  const startX = livesRight - (CFG.lives - 1) * heartSpacing;
  const heartY = HUD_H * 0.30;
  for (let i = 0; i < CFG.lives; i++) {
    const hx = startX + i * heartSpacing;
    if (i < state.lives) {
      drawPixelHeart(ctx, hx, heartY, heartSize, C.red);
    } else {
      drawPixelHeart(ctx, hx, heartY, heartSize, "rgba(255,255,255,0.15)");
    }
  }
  retro16Text(ctx, "LIVES", livesRight, heartY + heartSize + 8, 7, "#9CA3AF", "right");
}

/* ── Pixel heart helper ────────────────────────────────── */

function drawPixelHeart(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  const s = size / 7;
  // Heart shape pixel pattern
  //  .XX.XX.
  //  XXXXXXX
  //  XXXXXXX
  //  .XXXXX.
  //  ..XXX..
  //  ...X...
  const rows = [
    [1, 2, 4, 5],
    [0, 1, 2, 3, 4, 5, 6],
    [0, 1, 2, 3, 4, 5, 6],
    [1, 2, 3, 4, 5],
    [2, 3, 4],
    [3],
  ];
  const ox = cx - 3.5 * s;
  const oy = cy - 3 * s;
  for (let r = 0; r < rows.length; r++) {
    for (const c of rows[r]) {
      ctx.fillRect(Math.round(ox + c * s), Math.round(oy + r * s), Math.ceil(s), Math.ceil(s));
    }
  }
}

/* ── Utility ───────────────────────────────────────────── */

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/* ── 16-bit retro text helper (monospace + shadow) ─────── */

function retro16Text(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "center",
) {
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(text, x + 1, y + 1);
  // Main text
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
