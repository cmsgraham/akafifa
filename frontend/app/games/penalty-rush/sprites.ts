/* ──────────────────────────────────────────────────────────
   Penalty Rush — Pixel-Art Sprite System
   All sprites are code-generated pixel data.
   Zero external assets. Cached to offscreen canvases.
   ────────────────────────────────────────────────────────── */

/* ─── Types ────────────────────────────────────────────── */

type PixelRow = string; // hex chars, 1 per pixel: 0=transparent

interface SpriteSheet {
  w: number;
  h: number;
  palette: Record<string, string>; // char → css colour
  frames: PixelRow[][];            // [frame][row]
}

/* ─── Cached bitmaps ───────────────────────────────────── */

const cache = new Map<string, HTMLCanvasElement[]>();

function bake(name: string, sheet: SpriteSheet, scale: number): HTMLCanvasElement[] {
  const key = `${name}_${scale}`;
  if (cache.has(key)) return cache.get(key)!;
  const out: HTMLCanvasElement[] = [];
  for (const frame of sheet.frames) {
    const c = document.createElement("canvas");
    c.width = sheet.w * scale;
    c.height = sheet.h * scale;
    const ctx = c.getContext("2d")!;
    for (let y = 0; y < frame.length; y++) {
      const row = frame[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === "0" || ch === ".") continue;
        const col = sheet.palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    out.push(c);
  }
  cache.set(key, out);
  return out;
}

/* ═══════════════════════════════════════════════════════════
   GOALKEEPER  — 18×26 sprite, 7 frames
   Frame 0: idle-1 (ready stance, staring)
   Frame 1: idle-2 (bouncing, arms wider)
   Frame 2: dive-left (dramatic stretch)
   Frame 3: dive-right (dramatic stretch)
   Frame 4: idle-3 (taunt — wagging finger)
   Frame 5: celebrate (arms up, big grin)
   Frame 6: sad (slumped, head down)

   Big head, expressive eyes, bushy mustache, oversized
   green gloves = maximum personality.

   Palette:
   1 = jersey (#E11D2E red)
   2 = shorts (#1a1a2e dark)
   3 = skin (#F5D0B0)
   4 = gloves (#22C55E green)
   5 = boots (#111)
   6 = hair (#2a1a0a)
   7 = jersey shadow (#B8162A)
   8 = shorts highlight (#2a2a4e)
   9 = skin shadow (#D4A574)
   A = eye white (#FFFFFF)
   B = pupil (#111)
   C = mustache (#3d2200)
   D = mouth / grin (#CC3333)
   E = glove highlight (#4ADE80)
   ═══════════════════════════════════════════════════════════ */

const GK_SPRITE: SpriteSheet = {
  w: 18,
  h: 26,
  palette: {
    "1": "#E11D2E",
    "2": "#1a1a2e",
    "3": "#F5D0B0",
    "4": "#22C55E",
    "5": "#111111",
    "6": "#2a1a0a",
    "7": "#B8162A",
    "8": "#2a2a4e",
    "9": "#D4A574",
    "A": "#FFFFFF",
    "B": "#111111",
    "C": "#3d2200",
    "D": "#CC3333",
    "E": "#4ADE80",
  },
  frames: [
    // Frame 0 — idle standing, wide eyes staring forward
    [
      "000000066660000000",
      "000000666660000000",
      "000006666660000000",
      "000006633660000000",
      "00000AB3BA00000000",
      "00000AB3BA00000000",
      "000003CC330000CEEC",
      "000003DD330000CEEC",
      "000003333000000000",
      "00000111100E000000",
      "00000111100E000000",
      "000E0177100E000000",
      "000E0111100E000000",
      "0000011110E0000000",
      "000001111000000000",
      "000001771000000000",
      "000001111000000000",
      "000002222000000000",
      "000002882000000000",
      "000002222000000000",
      "000002322000000000",
      "000003003000000000",
      "000003003000000000",
      "000005005000000000",
      "000005005000000000",
      "000005505500000000",
    ],
    // Frame 1 — idle bounce / arms out wider, eyes looking up
    [
      "000000666600000000",
      "000006666600000000",
      "000006666600000000",
      "000006633660000000",
      "00000AB3BA00000000",
      "00000AB3BA00000000",
      "000003CC330000CEEC",
      "000003393000000000",
      "000003333000000000",
      "0E000111100000E000",
      "0E000111100000E000",
      "0E000177100000E000",
      "00E00111100E000000",
      "000001111E00000000",
      "000001111000000000",
      "000001771000000000",
      "000001111000000000",
      "000002222000000000",
      "000002882000000000",
      "000002222000000000",
      "000002322000000000",
      "000003003000000000",
      "000030030000000000",
      "000050050000000000",
      "000050050000000000",
      "000055055000000000",
    ],
    // Frame 2 — dive left (full body lean, arms WAY out)
    [
      "000006666000000000",
      "000066666000000000",
      "000066636600000000",
      "0000AB3BA000000000",
      "0000AB3BA000000000",
      "00003CC33000000000",
      "00003D9330000000000",
      "EE003333000000000",
      "EE011110000000000",
      "E0011110000000000",
      "00011710000000000",
      "00011110000000000",
      "00001111000000000",
      "00001111000000000",
      "00001771000000000",
      "00001111000000000",
      "00002222000000000",
      "00002882000000000",
      "00002222000000000",
      "000023220000000000",
      "000030030000000000",
      "000030030000000000",
      "000050050000000000",
      "000055050000000000",
      "000055050000000000",
      "000055550000000000",
    ],
    // Frame 3 — dive right (full body lean, arms WAY out)
    [
      "000000006666000000",
      "000000006666000000",
      "000000066636600000",
      "0000000AB3BA000000",
      "0000000AB3BA000000",
      "000000033CC3000000",
      "00000003393D000000",
      "00000003333000EE00",
      "00000001111000EE00",
      "000000011110000E00",
      "000000011710000000",
      "000000011110000000",
      "000000011110000000",
      "000000011110000000",
      "000000017710000000",
      "000000011110000000",
      "000000022220000000",
      "000000028820000000",
      "000000022220000000",
      "000000022320000000",
      "000000030030000000",
      "000000030030000000",
      "000000050050000000",
      "000000050550000000",
      "000000050550000000",
      "000000055550000000",
    ],
    // Frame 4 — taunt (wagging finger, smirk, one eye bigger)
    [
      "000000066660000000",
      "000000666660000000",
      "000006666660000000",
      "000006633660000000",
      "00000AB3AB00000000",
      "00000AB3B300000000",
      "0000E3CC330000CEEC",
      "00000EDDD00000CEEC",
      "000003333000000000",
      "00000111100E000000",
      "00000111100E000000",
      "000E0177100E000000",
      "000E0111100E000000",
      "0000011110E0000000",
      "000001111000000000",
      "000001771000000000",
      "000001111000000000",
      "000002222000000000",
      "000002882000000000",
      "000002222000000000",
      "000002322000000000",
      "000003003000000000",
      "000003003000000000",
      "000005005000000000",
      "000005005000000000",
      "000005505500000000",
    ],
    // Frame 5 — celebrate (arms UP, wide open grin)
    [
      "000000066660000000",
      "000000666660000000",
      "000006666660000000",
      "000006633660000000",
      "00000AB3BA00000000",
      "00000AB3BA00000000",
      "000003CC330000CEEC",
      "00000DDDD0000CEEC0",
      "000003333000000000",
      "E00001111000000E00",
      "0E000111100000E000",
      "0E000177100000E000",
      "00E001111000E00000",
      "00E001111000E00000",
      "000001111000000000",
      "000001771000000000",
      "000001111000000000",
      "000002222000000000",
      "000002882000000000",
      "000002222000000000",
      "000002322000000000",
      "000003003000000000",
      "000030030000000000",
      "000050050000000000",
      "000050050000000000",
      "000055055000000000",
    ],
    // Frame 6 — sad / dejected (head down, slouched)
    [
      "000000000000000000",
      "000000666600000000",
      "000006666600000000",
      "000006633660000000",
      "00000993990000CEEC",
      "0000099399000CEEC0",
      "00000BCCB00000CEEC",
      "000003DD300000CEEC",
      "000003333000000000",
      "00000111100E000000",
      "00000111100E000000",
      "000E0177100E000000",
      "000E0111100E000000",
      "0000011110E0000000",
      "000001111000000000",
      "000001771000000000",
      "000001111000000000",
      "000002222000000000",
      "000002882000000000",
      "000002222000000000",
      "000002322000000000",
      "000003003000000000",
      "000003003000000000",
      "000005005000000000",
      "000005005000000000",
      "000005505500000000",
    ],
  ],
};

/* ═══════════════════════════════════════════════════════════
   BALL  — 8×8 sprite, 2 frames (rotation)
   
   Palette:
   1 = white
   2 = light gray
   3 = dark pentagon
   ═══════════════════════════════════════════════════════════ */

const BALL_SPRITE: SpriteSheet = {
  w: 8,
  h: 8,
  palette: {
    "1": "#FFFFFF",
    "2": "#D4D4D4",
    "3": "#333333",
  },
  frames: [
    [
      "00111100",
      "01133110",
      "11333311",
      "12311321",
      "12311321",
      "11333311",
      "01133110",
      "00111100",
    ],
    [
      "00111100",
      "01131110",
      "11331311",
      "13311331",
      "13311331",
      "11313311",
      "01113110",
      "00111100",
    ],
  ],
};

/* ═══════════════════════════════════════════════════════════
   STADIUM LIGHT — 6×8 floodlight tower
   ═══════════════════════════════════════════════════════════ */

const LIGHT_SPRITE: SpriteSheet = {
  w: 6,
  h: 8,
  palette: {
    "1": "#3a3a4e",
    "2": "#FFD700",
    "3": "#555566",
  },
  frames: [
    [
      "022220",
      "022220",
      "013310",
      "001100",
      "001100",
      "001100",
      "001100",
      "001100",
    ],
  ],
};

/* ═══════════════════════════════════════════════════════════
   REDZONE LOGO — 41×7 pixel text, embossed 16-bit style
   Palette: 1=main red, 2=highlight, 3=shadow, 4=white shine
   ═══════════════════════════════════════════════════════════ */

const LOGO_SPRITE: SpriteSheet = {
  w: 41,
  h: 7,
  palette: {
    "1": "#E11D2E",
    "2": "#FF5555",
    "3": "#8B1020",
    "4": "#FFFFFF",
  },
  frames: [
    [
      "42220022222042220022222002220020002042222",
      "20002020000020002000002020002022002020000",
      "10001010000010001000010010001010101010000",
      "11110011110010001000100010001010011011110",
      "10100010000010001001000010001010001010000",
      "30030030000030003030000030003030003030000",
      "30003033333033330033333003330030003033333",
    ],
  ],
};

export function getLogoFrames(scale: number): HTMLCanvasElement[] {
  return bake("logo", LOGO_SPRITE, scale);
}

export const LOGO_SIZE = { w: LOGO_SPRITE.w, h: LOGO_SPRITE.h };

/* ═══════════════════════════════════════════════════════════
   API — get baked sprites at desired pixel scale
   ═══════════════════════════════════════════════════════════ */

export function getGkFrames(scale: number): HTMLCanvasElement[] {
  return bake("gk", GK_SPRITE, scale);
}

export function getBallFrames(scale: number): HTMLCanvasElement[] {
  return bake("ball", BALL_SPRITE, scale);
}

export function getLightFrames(scale: number): HTMLCanvasElement[] {
  return bake("light", LIGHT_SPRITE, scale);
}

export const GK_SIZE = { w: GK_SPRITE.w, h: GK_SPRITE.h };
export const BALL_SIZE = { w: BALL_SPRITE.w, h: BALL_SPRITE.h };
export const LIGHT_SIZE = { w: LIGHT_SPRITE.w, h: LIGHT_SPRITE.h };

/* ═══════════════════════════════════════════════════════════
   Procedural crowd texture — generates once, caches
   ═══════════════════════════════════════════════════════════ */

let crowdCanvas: HTMLCanvasElement | null = null;

export function getCrowdTexture(w: number, h: number): HTMLCanvasElement {
  if (crowdCanvas && crowdCanvas.width === w && crowdCanvas.height === h) {
    return crowdCanvas;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const heads = [
    "#4a3728", "#3a2a1e", "#5c4033", "#2e1f14", "#6b4226",
    "#E11D2E", "#3b82f6", "#22C55E", "#EAB308", "#9333ea",
    "#f97316", "#06b6d4", "#ec4899", "#84cc16",
  ];

  const spacing = 5;
  const rows = Math.ceil(h / spacing);
  const cols = Math.ceil(w / spacing);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * spacing + (row % 2 ? spacing / 2 : 0) + (Math.random() - 0.5) * 2;
      const y = row * spacing + (Math.random() - 0.5) * 1.5;
      const c2 = heads[Math.floor(Math.random() * heads.length)];

      // Head dot
      ctx.fillStyle = c2;
      ctx.fillRect(Math.round(x), Math.round(y), 3, 3);

      // Body (smaller, darker)
      ctx.fillStyle = "rgba(20,20,30,0.6)";
      ctx.fillRect(Math.round(x), Math.round(y) + 3, 3, 2);
    }
  }
  crowdCanvas = c;
  return c;
}

/* ═══════════════════════════════════════════════════════════
   Procedural grass texture
   ═══════════════════════════════════════════════════════════ */

let grassCanvas: HTMLCanvasElement | null = null;

export function getGrassTexture(w: number, h: number): HTMLCanvasElement {
  if (grassCanvas && grassCanvas.width === w && grassCanvas.height === h) {
    return grassCanvas;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  // Base gradient
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#1a5c2e");
  g.addColorStop(1, "#145024");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Mowing stripes
  const stripeW = 14;
  for (let x = 0; x < w; x += stripeW * 2) {
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    ctx.fillRect(x, 0, stripeW, h);
  }

  // Noise dithering
  const greens = ["#1a6630", "#155c28", "#1e7a36", "#12501e"];
  for (let i = 0; i < w * h * 0.04; i++) {
    const gx = Math.random() * w;
    const gy = Math.random() * h;
    ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)];
    ctx.fillRect(Math.round(gx), Math.round(gy), 1, 1);
  }

  grassCanvas = c;
  return c;
}
