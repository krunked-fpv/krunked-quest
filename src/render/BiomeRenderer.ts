/**
 * Krunked Quest — Bespoke 16-Bit Pixel-Art Biome Atmospheric Renderer
 * Renders midground and foreground atmospheric effects for all 11 Biomes using
 * exact extracted hex palettes from src/assets/palettes.ts.
 * Strict 576x324 nearest-neighbor, 1-pixel-snapped, headless-safe, ZERO per-frame allocations!
 */

import {
  PPU,
  VIEWPORT_H,
  VIEWPORT_W,
  type RoomDef,
  type SimState,
} from '../contracts/index.js';
import {
  BIOME_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  type BiomePalette,
} from '../assets/palettes.js';

const HALF_W = VIEWPORT_W * 0.5; // 288
const HALF_H = VIEWPORT_H * 0.5; // 162
const TWO_PI = Math.PI * 2;

// Precomputed 64-entry trig table for zero-allocation crisp pixel circles/gears/rings
const TRIG_STEPS = 64;
const COS_LUT = new Float32Array(TRIG_STEPS);
const SIN_LUT = new Float32Array(TRIG_STEPS);
for (let i = 0; i < TRIG_STEPS; i++) {
  const ang = (i / TRIG_STEPS) * TWO_PI;
  COS_LUT[i] = Math.cos(ang);
  SIN_LUT[i] = Math.sin(ang);
}

// Deterministic pseudo-random offsets for motes, spores, embers, sand streaks (zero allocations)
const PARTICLE_SLOTS = 28;
const SLOT_SEED_X = new Float32Array(PARTICLE_SLOTS);
const SLOT_SEED_Y = new Float32Array(PARTICLE_SLOTS);
const SLOT_SPEED = new Float32Array(PARTICLE_SLOTS);
const SLOT_PHASE = new Float32Array(PARTICLE_SLOTS);
const SLOT_SIZE = new Uint8Array(PARTICLE_SLOTS);

for (let i = 0; i < PARTICLE_SLOTS; i++) {
  const h1 = (((i * 2654435761) ^ 0x5bf03635) >>> 0) / 0x100000000;
  const h2 = ((((i + 17) * 2246822519) ^ 0x9e3779b9) >>> 0) / 0x100000000;
  const h3 = ((((i + 53) * 3266489917) ^ 0x85ebca77) >>> 0) / 0x100000000;
  SLOT_SEED_X[i] = h1 * VIEWPORT_W;
  SLOT_SEED_Y[i] = h2 * VIEWPORT_H;
  SLOT_SPEED[i] = 0.55 + h3 * 0.95;
  SLOT_PHASE[i] = (h1 + h2) * TWO_PI;
  SLOT_SIZE[i] = i % 5 === 0 ? 3 : i % 2 === 0 ? 2 : 1;
}

// 4 ancient 5x5 bitmap rune glyphs for Nightmare Spire (EVIL) — 25 bits each
const RUNE_GLYPHS: readonly Uint8Array[] = [
  new Uint8Array([
    0, 1, 1, 1, 0,
    1, 0, 1, 0, 1,
    0, 0, 1, 0, 0,
    0, 1, 0, 1, 0,
    1, 0, 1, 0, 1,
  ]),
  new Uint8Array([
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 1, 0, 0,
    0, 1, 1, 1, 0,
    0, 0, 1, 0, 0,
  ]),
  new Uint8Array([
    0, 1, 1, 1, 0,
    1, 0, 0, 0, 1,
    1, 0, 1, 0, 1,
    1, 0, 0, 0, 1,
    0, 1, 1, 1, 0,
  ]),
  new Uint8Array([
    0, 0, 1, 0, 0,
    0, 1, 0, 1, 0,
    1, 1, 1, 1, 1,
    0, 1, 0, 1, 0,
    1, 0, 1, 0, 1,
  ]),
];

// Static gear layout for Forgotten Labyrinth (LAB): [baseX, baseY, outerR, innerR, teeth, speed, parallax]
const LAB_GEARS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [112, 134, 42, 14, 12, 0.24, 0.16],
  [178, 174, 28, 9, 8, -0.36, 0.16],
  [418, 118, 50, 18, 14, -0.18, 0.12],
  [486, 178, 30, 10, 10, 0.30, 0.22],
];

// Static sacred circuit ring specs for Atomic Temple (TEMP): [baseX, baseY, radius, speed, nodes]
const TEMP_RINGS: readonly (readonly [number, number, number, number, number])[] = [
  [148, 122, 44, 0.35, 8],
  [148, 122, 28, -0.55, 6],
  [432, 136, 52, -0.28, 12],
  [432, 136, 32, 0.48, 8],
];

// Static Ghost Ship hanging lantern anchors: [baseX, topY, chainLen, swayPhase]
const GSHIP_LANTERNS: readonly (readonly [number, number, number, number])[] = [
  [104, 18, 36, 0.0],
  [288, 12, 42, 2.1],
  [472, 20, 34, 4.2],
];

// Static warm bronze shades for LAB gears (derived to pair seamlessly with LAB palette)
const BRONZE_DARK = '#3a2b42';
const BRONZE_MID = '#6b4d4a';
const BRONZE_LIGHT = '#a87d5e';
const WARM_GOLD = '#ffd24a';
const WARM_CREAM = '#fff5b8';
const HAZARD_AMBER = '#ffe84d';
const HAZARD_CRIMSON = '#ff3858';

function wrap(val: number, period: number): number {
  const m = val % period;
  return m < 0 ? m + period : m;
}

export class BiomeRenderer {
  /**
   * Midground atmospheric layer drawn AFTER parallax and BEFORE world tiles.
   * When customBgActive is true, gracefully dials back heavy procedural celestials/gears/bars
   * so extracted multi-layer origin parallax backgrounds shine cleanly without washout or clash.
   */
  public renderMidground(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    room: RoomDef,
    camX: number,
    camY: number,
    timeSec: number,
    customBgActive = false,
  ): void {
    const pal = BIOME_PALETTES[state.biome];
    const prevAlpha = ctx.globalAlpha;

    switch (state.biome) {
      case 'MLAIR':
      case 'OPOUSO':
        this.drawWarmSunbeams(ctx, pal, state.biome === 'OPOUSO', camX, timeSec, customBgActive ? 0.45 : 0.55);
        break;
      case 'TDM':
        this.drawTrailMidground(ctx, pal, camX, timeSec, true);
        break;
      case 'FLIN':
      case 'AP':
        this.drawCanopyLightShafts(ctx, pal, state.biome === 'FLIN', camX, timeSec, customBgActive ? 0.55 : 0.65);
        break;
      case 'ATVC':
        this.drawVolcanicHeatHaze(ctx, pal, camX, camY, timeSec, true);
        break;
      case 'DSI':
        this.drawDesertSunShimmer(ctx, pal, camX, room.sandstormDir ?? 0, timeSec, true);
        break;
      case 'LAB':
        this.drawLabyrinthGears(ctx, pal, camX, camY, timeSec, customBgActive ? 0.22 : 0.3);
        break;
      case 'TEMP':
        this.drawTempleCircuitRings(ctx, pal, camX, camY, timeSec, customBgActive ? 0.55 : 0.55);
        break;
      case 'EVIL':
        this.drawNightmareEclipseAndLightning(ctx, pal, camX, timeSec, false);
        break;
      case 'GSHIP':
        this.drawGhostShipLanterns(ctx, pal, state.ghostShip.hazardTier, camX, timeSec, customBgActive ? 0.72 : 0.78);
        break;
    }

    ctx.globalAlpha = prevAlpha;
  }

  /**
   * Foreground atmospheric layer drawn AFTER world entities & particles and BEFORE HUD.
   * Crisp 1px pixel-snapped atmospheric particles, wind streaks, embers, ocean swells & hazard warnings.
   */
  public renderForeground(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    room: RoomDef,
    camX: number,
    camY: number,
    timeSec: number,
    customBgActive = false,
  ): void {
    const pal = BIOME_PALETTES[state.biome];
    const prevAlpha = ctx.globalAlpha;
    const fgScale = customBgActive ? 0.85 : 1.0;

    switch (state.biome) {
      case 'MLAIR':
      case 'OPOUSO':
        this.drawGoldenDustMotes(ctx, pal, state.biome === 'OPOUSO', camX, camY, timeSec, fgScale);
        break;
      case 'TDM':
        this.drawDandelionPollenAndBreeze(ctx, pal, camX, camY, timeSec, fgScale);
        break;
      case 'FLIN':
      case 'AP':
        this.drawForestSpores(ctx, pal, state.biome === 'FLIN', camX, camY, timeSec, fgScale);
        break;
      case 'ATVC':
        this.drawVolcanicEmbersAndLavaWaves(ctx, pal, state, room, camX, camY, timeSec);
        break;
      case 'DSI':
        this.drawDesertSandstorm(ctx, pal, room.sandstormDir ?? 0, camX, timeSec);
        break;
      case 'LAB':
        this.drawForgeSparks(ctx, pal, camX, camY, timeSec);
        break;
      case 'TEMP':
        this.drawAntigravScanlines(ctx, pal, camY, timeSec, fgScale, false);
        break;
      case 'EVIL':
        this.drawFloatingVioletRunes(ctx, pal, camX, camY, timeSec, fgScale);
        break;
      case 'GSHIP':
        this.drawGhostShipSwellsAndHazardPulse(ctx, pal, state, camX, timeSec);
        break;
    }

    ctx.globalAlpha = prevAlpha;
  }

  // ==========================================================================
  // 1. MLAIR / OPOUSO — Warm Sunbeams & Drifting Golden Dust Motes
  // ==========================================================================

  private drawWarmSunbeams(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    isVillage: boolean,
    camX: number,
    timeSec: number,
    alphaScale = 1.0,
  ): void {
    const beamCount = 5;
    const parallax = Math.round(camX * PPU * 0.14);
    const beamCol = isVillage ? WARM_CREAM : pal.celestialColor;
    const coreCol = isVillage ? WARM_GOLD : pal.ambientMote;

    for (let b = 0; b < beamCount; b++) {
      const baseX = Math.round(wrap(b * 128 + 38 - parallax, VIEWPORT_W + 120) - 60);
      const beamW = 24 + (b % 3) * 10;
      const pulse = (0.075 + 0.045 * Math.sin(timeSec * 0.9 + b * 1.7)) * alphaScale;

      // Stepped 16-bit diagonal sunbeam strips (4px vertical steps, slanted +1px X per 2px Y)
      ctx.globalAlpha = pulse;
      ctx.fillStyle = beamCol;
      for (let y = 0; y < VIEWPORT_H; y += 4) {
        const sx = baseX + (y >> 1);
        if (sx + beamW < 0 || sx > VIEWPORT_W) continue;
        ctx.fillRect(sx, y, beamW, 4);
      }

      // Brighter warm inner shaft core
      ctx.globalAlpha = pulse * 0.85;
      ctx.fillStyle = coreCol;
      const innerW = Math.max(4, beamW >> 2);
      const innerOff = (beamW - innerW) >> 1;
      for (let y = 0; y < VIEWPORT_H - 36; y += 6) {
        const sx = baseX + innerOff + (y >> 1);
        if (sx + innerW < 0 || sx > VIEWPORT_W) continue;
        ctx.fillRect(sx, y, innerW, 6);
      }
    }
  }

  private drawGoldenDustMotes(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    isVillage: boolean,
    camX: number,
    camY: number,
    timeSec: number,
    alphaScale = 1.0,
  ): void {
    const count = 18;
    const parX = camX * PPU * 0.32;
    const parY = camY * PPU * 0.22;

    for (let i = 0; i < count; i++) {
      const spd = SLOT_SPEED[i]!;
      const ph = SLOT_PHASE[i]!;
      const rawX = SLOT_SEED_X[i]! + timeSec * (7 * spd) - parX + Math.sin(timeSec * 1.1 + ph) * 14;
      const rawY = SLOT_SEED_Y[i]! - timeSec * (5 * spd) + parY + Math.cos(timeSec * 0.8 + ph) * 8;
      const sx = Math.round(wrap(rawX, VIEWPORT_W));
      const sy = Math.round(wrap(rawY, VIEWPORT_H));

      const twinkle = (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(timeSec * 3.2 + ph * 2))) * alphaScale;
      ctx.globalAlpha = twinkle;

      const sz = SLOT_SIZE[i]!;
      if (sz >= 3) {
        // Twinkling golden cross mote
        ctx.fillStyle = isVillage ? WARM_GOLD : pal.ambientMote;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(sx, sy, 1, 1);
      } else {
        ctx.fillStyle = i % 2 === 0 ? WARM_GOLD : WARM_CREAM;
        ctx.fillRect(sx, sy, sz, sz);
      }
    }
  }

  // ==========================================================================
  // 2. TDM — Gentle Sunlit Dandelion Pollen & Breeze Streaks
  // ==========================================================================

  private drawTrailMidground(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    timeSec: number,
    customBgActive = false,
  ): void {
    // Soft sunlit breeze shafts
    const parX = Math.round(camX * PPU * 0.12);
    const shaftScale = customBgActive ? 0.4 : 1.0;
    ctx.fillStyle = pal.celestialColor;
    for (let b = 0; b < 3; b++) {
      const bx = Math.round(wrap(b * 204 + 64 - parX, VIEWPORT_W + 100) - 50);
      ctx.globalAlpha = (0.06 + 0.03 * Math.sin(timeSec * 1.1 + b * 2.1)) * shaftScale;
      for (let y = 0; y < VIEWPORT_H - 40; y += 6) {
        ctx.fillRect(bx + (y >> 2), y, 28, 6);
      }
    }

    // Gentle sky breeze ribbons
    ctx.fillStyle = pal.skyGlow;
    for (let r = 0; r < 5; r++) {
      const rx = Math.round(wrap(r * 131 + timeSec * (26 + r * 4) - parX, VIEWPORT_W + 90) - 45);
      const ry = 42 + r * 38 + Math.round(Math.sin(timeSec * 1.6 + r * 1.3) * 6);
      ctx.globalAlpha = customBgActive ? 0.14 : 0.22;
      ctx.fillRect(rx, ry, 26, 1);
      ctx.fillRect(rx + 22, ry - 1, 8, 1);
      ctx.fillRect(rx + 28, ry - 2, 3, 1);
    }
  }

  private drawDandelionPollenAndBreeze(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    camY: number,
    timeSec: number,
    alphaScale = 1.0,
  ): void {
    const parX = camX * PPU * 0.4;
    const parY = camY * PPU * 0.25;

    // 1. Crisp sunlit dandelion pollen tufts floating on sinusoidal breeze
    for (let i = 0; i < 16; i++) {
      const spd = SLOT_SPEED[i]!;
      const ph = SLOT_PHASE[i]!;
      const px = Math.round(wrap(SLOT_SEED_X[i]! + timeSec * (16 * spd) - parX, VIEWPORT_W + 16) - 8);
      const py = Math.round(
        wrap(SLOT_SEED_Y[i]! + Math.sin(timeSec * 1.9 + ph) * 14 - timeSec * (4 * spd) + parY, VIEWPORT_H + 16) - 8,
      );

      ctx.globalAlpha = 0.72 * alphaScale;
      // Tiny dark-stem seed + fluffy cream/yellow dandelion crown
      ctx.fillStyle = pal.capDark;
      ctx.fillRect(px, py + 1, 1, 2);
      ctx.fillStyle = i % 3 === 0 ? pal.accentAlt : HIGHLIGHT_CREAM;
      ctx.fillRect(px - 1, py, 3, 1);
      ctx.fillRect(px, py - 1, 1, 1);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = pal.ambientMote;
      ctx.fillRect(px - 2, py, 5, 1);
    }

    // 2. Intermittent playful pixel breeze curls
    ctx.fillStyle = HIGHLIGHT_CREAM;
    for (let s = 0; s < 6; s++) {
      const sx = Math.round(wrap(s * 117 + timeSec * (68 + s * 9) - parX, VIEWPORT_W + 120) - 60);
      const sy = 56 + ((s * 47) % (VIEWPORT_H - 92)) + Math.round(Math.sin(timeSec * 2.5 + s) * 5);
      const alpha = 0.16 + 0.14 * Math.max(0, Math.sin(timeSec * 2.2 + s * 1.9));
      ctx.globalAlpha = alpha;
      ctx.fillRect(sx, sy, 18, 1);
      ctx.fillRect(sx + 16, sy - 1, 6, 1);
      ctx.fillRect(sx + 20, sy - 2, 3, 1);
      ctx.fillRect(sx + 18, sy - 3, 2, 1);
    }
  }

  // ==========================================================================
  // 3. FLIN / AP — Floating Luminous Forest Spores & Canopy Light Shafts
  // ==========================================================================

  private drawCanopyLightShafts(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    isInfested: boolean,
    camX: number,
    timeSec: number,
    alphaScale = 1.0,
  ): void {
    const parX = Math.round(camX * PPU * 0.18);
    const shaftCol = isInfested ? pal.accentAlt : pal.celestialColor;
    const edgeCol = isInfested ? pal.skyGlow : pal.accent;

    for (let s = 0; s < 6; s++) {
      const sway = Math.round(Math.sin(timeSec * 0.7 + s * 1.4) * 5);
      const baseX = Math.round(wrap(s * 108 + 22 - parX, VIEWPORT_W + 96) - 48) + sway;
      const w = 16 + (s & 1) * 12;
      const alpha = (0.06 + 0.04 * Math.sin(timeSec * 1.2 + s * 2.0)) * alphaScale;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = edgeCol;
      for (let y = 0; y < VIEWPORT_H; y += 6) {
        const tilt = (y * 3) >> 3;
        ctx.fillRect(baseX + tilt, y, w, 6);
      }

      ctx.globalAlpha = alpha * 1.15;
      ctx.fillStyle = shaftCol;
      const coreW = Math.max(4, w >> 2);
      const coreOff = (w - coreW) >> 1;
      for (let y = 0; y < VIEWPORT_H - 24; y += 6) {
        const tilt = (y * 3) >> 3;
        ctx.fillRect(baseX + coreOff + tilt, y, coreW, 6);
      }
    }
  }

  private drawForestSpores(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    isInfested: boolean,
    camX: number,
    camY: number,
    timeSec: number,
    alphaScale = 1.0,
  ): void {
    const count = 22;
    const parX = camX * PPU * 0.36;
    const parY = camY * PPU * 0.28;

    for (let i = 0; i < count; i++) {
      const spd = SLOT_SPEED[i]!;
      const ph = SLOT_PHASE[i]!;
      const sx = Math.round(
        wrap(SLOT_SEED_X[i]! + Math.sin(timeSec * (0.9 * spd) + ph) * 18 - parX, VIEWPORT_W),
      );
      const sy = Math.round(
        wrap(SLOT_SEED_Y[i]! - timeSec * (7.5 * spd) + Math.cos(timeSec * 1.1 + ph) * 6 + parY, VIEWPORT_H),
      );

      const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(timeSec * 3.4 + ph * 2.5));
      const isAlt = i % 4 === 0;
      const haloCol = isAlt ? pal.accent : pal.ambientMote;
      const coreCol = isAlt ? (isInfested ? pal.accent : HIGHLIGHT_CREAM) : pal.capLight;

      // Soft pixel halo (5x5 cross)
      ctx.globalAlpha = glow * 0.24 * alphaScale;
      ctx.fillStyle = haloCol;
      ctx.fillRect(sx - 2, sy - 1, 5, 3);
      ctx.fillRect(sx - 1, sy - 2, 3, 5);

      // Luminous pixel core
      ctx.globalAlpha = (0.55 + glow * 0.4) * alphaScale;
      ctx.fillStyle = coreCol;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
      if (glow > 0.78) {
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
  }

  // ==========================================================================
  // 4. ATVC — Rising Volcanic Embers, Heat-Haze Bands, Molten Lava Surface Waves
  // ==========================================================================

  private drawVolcanicHeatHaze(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    camY: number,
    timeSec: number,
    customBgActive = false,
  ): void {
    // Stepped molten underglow bands (skip opaque washout bars over origin volcanic BG)
    if (!customBgActive) {
      ctx.fillStyle = pal.skyGlow;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(0, VIEWPORT_H - 54, VIEWPORT_W, 54);
      ctx.fillStyle = pal.capMid;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(0, VIEWPORT_H - 28, VIEWPORT_W, 28);
    }

    // Shimmering undulating pixel heat-haze bands drifting upward
    const parX = Math.round(camX * PPU * 0.2);
    const parY = Math.round(camY * PPU * 0.15);
    const hazeScale = customBgActive ? 0.55 : 1.0;
    for (let h = 0; h < 8; h++) {
      const baseY = Math.round(wrap(VIEWPORT_H - h * 40 - timeSec * 14 + parY, VIEWPORT_H));
      const alpha = (0.06 + 0.05 * Math.sin(timeSec * 3.8 + h * 1.1)) * hazeScale;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = h % 2 === 0 ? pal.capLight : pal.accentAlt;
      for (let seg = 0; seg < 12; seg++) {
        const sx = Math.round(wrap(seg * 54 + h * 19 - parX, VIEWPORT_W + 48) - 24);
        const waveY = baseY + Math.round(Math.sin(timeSec * 5.2 + seg * 0.9 + h) * 2);
        ctx.fillRect(sx, waveY, 34, 2);
      }
    }
  }

  private drawVolcanicEmbersAndLavaWaves(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    state: SimState,
    room: RoomDef,
    camX: number,
    camY: number,
    timeSec: number,
  ): void {
    // 1. Glowing molten lava surface waves
    const hasRisingLava = Boolean(room.risingLava && state.lavaY > 0);
    const waveBaseY = hasRisingLava
      ? Math.round((camY - state.lavaY) * PPU + HALF_H)
      : VIEWPORT_H - 8;

    if (waveBaseY < VIEWPORT_H + 14 && waveBaseY > -20) {
      const scrollX = Math.round(camX * PPU * 0.65);
      // Outer molten orange-red surface undulation
      ctx.globalAlpha = hasRisingLava ? 0.82 : 0.42;
      ctx.fillStyle = pal.capMid;
      for (let x = 0; x < VIEWPORT_W; x += 6) {
        const wy = waveBaseY + Math.round(Math.sin((x + scrollX) * 0.055 + timeSec * 3.6) * 2.5);
        ctx.fillRect(x, wy, 6, 5);
      }
      // Bright yellow-gold molten wave crest highlights
      ctx.globalAlpha = hasRisingLava ? 0.92 : 0.55;
      ctx.fillStyle = pal.accent;
      for (let x = 0; x < VIEWPORT_W; x += 8) {
        const phase = (x + scrollX) * 0.055 + timeSec * 3.6;
        const wy = waveBaseY + Math.round(Math.sin(phase) * 2.5);
        if (Math.cos(phase) > 0.1) {
          ctx.fillRect(x, wy - 1, 5, 2);
        }
      }
      // Hot lava bubble pops along crest
      ctx.fillStyle = HIGHLIGHT_CREAM;
      for (let b = 0; b < 6; b++) {
        const bx = Math.round(wrap(b * 103 + 27 - scrollX * 0.5, VIEWPORT_W));
        const pop = Math.sin(timeSec * 4.5 + b * 2.3);
        if (pop > 0.65) {
          const by = waveBaseY - Math.round((pop - 0.65) * 14);
          ctx.fillRect(bx, by, 2, 2);
        }
      }
    }

    // 2. Rising volcanic embers with flickering sparks
    const parX = camX * PPU * 0.42;
    const parY = camY * PPU * 0.3;
    for (let i = 0; i < 26; i++) {
      const spd = SLOT_SPEED[i]!;
      const ph = SLOT_PHASE[i]!;
      const ex = Math.round(
        wrap(
          SLOT_SEED_X[i]! + Math.sin(timeSec * 2.6 + ph) * 16 + timeSec * (6 * spd) - parX,
          VIEWPORT_W,
        ),
      );
      const ey = Math.round(
        wrap(SLOT_SEED_Y[i]! - timeSec * (26 * spd) + parY, VIEWPORT_H),
      );
      const flicker = 0.5 + 0.5 * Math.sin(timeSec * 12 + ph * 3);
      ctx.globalAlpha = 0.45 + flicker * 0.5;
      // Trailing ember tail
      ctx.fillStyle = pal.capMid;
      ctx.fillRect(ex - 1, ey + 2, 2, 2);
      // Glowing ember core
      ctx.fillStyle = i % 3 === 0 ? pal.accent : pal.capLight;
      const sz = i % 5 === 0 ? 2 : 1;
      ctx.fillRect(ex, ey, sz + 1, sz);
      if (flicker > 0.85) {
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(ex, ey, 1, 1);
      }
    }
  }

  // ==========================================================================
  // 5. DSI — Directional Pixel Sandstorm Wind Streaks & Desert Sun Shimmer
  // ==========================================================================

  private drawDesertSunShimmer(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    sandstormDir: -1 | 0 | 1,
    timeSec: number,
    customBgActive = false,
  ): void {
    // Blazing desert sun mirage halo in upper sky (Built-In only so it never doubles over origin sky)
    if (!customBgActive) {
      const sunX = Math.round(wrap(468 - camX * PPU * 0.04, VIEWPORT_W));
      const sunY = 54;
      const pulse = Math.round(Math.sin(timeSec * 2.8) * 3);

      ctx.fillStyle = pal.celestialColor;
      ctx.globalAlpha = 0.14;
      this.drawPixelRing(ctx, sunX, sunY, 34 + pulse, 2, 32);
      ctx.fillStyle = pal.celestialRing;
      ctx.globalAlpha = 0.11;
      this.drawPixelRing(ctx, sunX, sunY, 50 - pulse, 2, 32);
    }

    // Horizon sun shimmer mirage bars
    const dir = sandstormDir !== 0 ? sandstormDir : -1;
    const shimmerScale = customBgActive ? 0.5 : 1.0;
    ctx.fillStyle = pal.skyGlow;
    for (let band = 0; band < 6; band++) {
      const by = 176 + band * 22;
      const shift = Math.round(timeSec * (18 + band * 4) * dir);
      ctx.globalAlpha = (0.08 + 0.04 * Math.sin(timeSec * 4.0 + band)) * shimmerScale;
      for (let seg = 0; seg < 7; seg++) {
        const sx = Math.round(wrap(seg * 92 + band * 31 + shift, VIEWPORT_W + 70) - 35);
        const wave = Math.round(Math.sin(timeSec * 6.0 + seg + band) * 1);
        ctx.fillRect(sx, by + wave, 44, 2);
      }
    }
  }

  private drawDesertSandstorm(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    sandstormDir: -1 | 0 | 1,
    camX: number,
    timeSec: number,
  ): void {
    const activeStorm = sandstormDir !== 0;
    const dir = activeStorm ? sandstormDir : -1;
    const speedMult = activeStorm ? 1.0 : 0.36;
    const streakCount = activeStorm ? 24 : 10;
    const parX = camX * PPU * 0.45;

    // Subtle warm desert dust veil during active sandstorms
    if (activeStorm) {
      ctx.fillStyle = pal.capMid;
      ctx.globalAlpha = 0.07 + 0.03 * Math.sin(timeSec * 4.2);
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
    }

    // Directional crisp pixel sandstorm wind streaks aligned strictly with room.sandstormDir
    for (let i = 0; i < streakCount; i++) {
      const spd = (170 + (i % 5) * 42) * speedMult;
      const len = activeStorm ? 18 + (i % 4) * 11 : 10 + (i % 3) * 6;
      const rawX = SLOT_SEED_X[i % PARTICLE_SLOTS]! + timeSec * spd * dir - parX;
      const sx = Math.round(wrap(rawX, VIEWPORT_W + 80) - 40);
      const sy = Math.round(
        wrap(
          SLOT_SEED_Y[i % PARTICLE_SLOTS]! + Math.sin(timeSec * 3.5 + i * 0.9) * (activeStorm ? 10 : 4),
          VIEWPORT_H,
        ),
      );

      // Leading sand streak (tapered 2px -> 1px in wind direction)
      ctx.globalAlpha = activeStorm ? 0.44 : 0.24;
      ctx.fillStyle = i % 3 === 0 ? pal.capLight : pal.ambientMote;
      ctx.fillRect(sx, sy, len, 1);

      if (activeStorm && (i & 1) === 0) {
        const thickX = dir > 0 ? sx + (len >> 1) : sx;
        ctx.fillStyle = pal.capMid;
        ctx.globalAlpha = 0.32;
        ctx.fillRect(thickX, sy + 1, len >> 1, 1);
      }

      // Blowing pixel sand grain
      ctx.globalAlpha = activeStorm ? 0.72 : 0.42;
      ctx.fillStyle = HIGHLIGHT_CREAM;
      const tipX = dir > 0 ? sx + len : sx - 2;
      ctx.fillRect(tipX, sy, 2, 1);
    }
  }

  // ==========================================================================
  // 6. LAB — Slowly Rotating Silhouette Bronze Gears & Drifting Forge Sparks
  // ==========================================================================

  private drawLabyrinthGears(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    camY: number,
    timeSec: number,
    gearAlpha = 0.48,
  ): void {
    for (let g = 0; g < LAB_GEARS.length; g++) {
      const spec = LAB_GEARS[g]!;
      const baseX = spec[0];
      const baseY = spec[1];
      const outerR = spec[2];
      const innerR = spec[3];
      const teeth = spec[4];
      const rotSpeed = spec[5];
      const parallax = spec[6];

      const gx = Math.round(wrap(baseX - camX * PPU * parallax, VIEWPORT_W + outerR * 3) - outerR * 1.5);
      const gy = Math.round(baseY + Math.max(-28, Math.min(28, camY * 4)));
      const angle = timeSec * rotSpeed + g * 0.6;

      ctx.globalAlpha = gearAlpha;
      this.drawPixelGear(ctx, gx, gy, outerR, innerR, teeth, angle, BRONZE_DARK, BRONZE_MID, BRONZE_LIGHT);

      // Subtle arcane rivet glint at hub
      ctx.globalAlpha = (0.35 + 0.2 * Math.sin(timeSec * 3 + g)) * (gearAlpha / 0.48);
      ctx.fillStyle = g % 2 === 0 ? pal.accentAlt : pal.accent;
      ctx.fillRect(gx - 2, gy - 2, 4, 4);
    }
  }

  private drawPixelGear(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    teeth: number,
    angle: number,
    colDark: string,
    colMid: string,
    colHighlight: string,
  ): void {
    // 1. Rotating pixel gear teeth around perimeter
    const toothR = outerR + 5;
    for (let t = 0; t < teeth; t++) {
      const th = angle + (t / teeth) * TWO_PI;
      const tx = Math.round(cx + Math.cos(th) * toothR);
      const ty = Math.round(cy + Math.sin(th) * toothR);
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(tx - 4, ty - 4, 9, 9);
      ctx.fillStyle = colMid;
      ctx.fillRect(tx - 3, ty - 3, 7, 7);
      ctx.fillStyle = colHighlight;
      ctx.fillRect(tx - 3, ty - 3, 5, 2);
    }

    // 2. Outer rim ring (crisp pixel ring segments)
    ctx.fillStyle = OUTLINE_DARK;
    this.drawPixelRing(ctx, cx, cy, outerR, 7, 40);
    ctx.fillStyle = colDark;
    this.drawPixelRing(ctx, cx, cy, outerR, 5, 40);
    ctx.fillStyle = colMid;
    this.drawPixelRing(ctx, cx, cy, outerR - 1, 3, 40);
    ctx.fillStyle = colHighlight;
    this.drawPixelRing(ctx, cx, cy, outerR - 3, 1, 32);

    // 3. 4 Rotating spokes connecting hub to outer rim
    for (let s = 0; s < 4; s++) {
      const th = angle + s * (Math.PI * 0.5);
      const c = Math.cos(th);
      const sn = Math.sin(th);
      for (let d = innerR; d < outerR - 2; d += 3) {
        const px = Math.round(cx + c * d);
        const py = Math.round(cy + sn * d);
        ctx.fillStyle = colDark;
        ctx.fillRect(px - 2, py - 2, 5, 5);
        ctx.fillStyle = colMid;
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }

    // 4. Center hub
    ctx.fillStyle = OUTLINE_DARK;
    this.drawPixelRing(ctx, cx, cy, innerR, 5, 24);
    ctx.fillStyle = colMid;
    this.drawPixelRing(ctx, cx, cy, innerR, 3, 24);
  }

  private drawForgeSparks(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    camY: number,
    timeSec: number,
  ): void {
    const parX = camX * PPU * 0.38;
    const parY = camY * PPU * 0.28;

    for (let i = 0; i < 18; i++) {
      const spd = SLOT_SPEED[i]!;
      const ph = SLOT_PHASE[i]!;
      const sx = Math.round(
        wrap(SLOT_SEED_X[i]! + timeSec * (14 * spd) + Math.sin(timeSec * 3.1 + ph) * 10 - parX, VIEWPORT_W),
      );
      const sy = Math.round(
        wrap(SLOT_SEED_Y[i]! - timeSec * (18 * spd) + parY, VIEWPORT_H),
      );

      const pulse = 0.45 + 0.55 * Math.sin(timeSec * 9.5 + ph * 2);
      ctx.globalAlpha = 0.4 + pulse * 0.55;

      // Crisp forge spark + 2px pixel trail
      const isArcane = i % 4 === 0;
      ctx.fillStyle = isArcane ? pal.accent : WARM_GOLD;
      ctx.fillRect(sx - 1, sy + 2, 2, 2);
      ctx.fillStyle = isArcane ? pal.accentAlt : HIGHLIGHT_CREAM;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  // ==========================================================================
  // 7. TEMP — Pulsing Cyan Antigravity Scanlines & Rotating Sacred Circuit Rings
  // ==========================================================================

  private drawTempleCircuitRings(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    camY: number,
    timeSec: number,
    alphaScale = 1.0,
  ): void {
    const parX = camX * PPU * 0.14;
    const vShift = Math.max(-24, Math.min(24, Math.round(camY * 3.5)));

    for (let r = 0; r < TEMP_RINGS.length; r++) {
      const spec = TEMP_RINGS[r]!;
      const cx = Math.round(wrap(spec[0] - parX, VIEWPORT_W + 120) - 60);
      const cy = spec[1] + vShift;
      const rad = spec[2];
      const ang = timeSec * spec[3] + r * 0.8;
      const nodes = spec[4];

      // Sacred circuit ring circumference
      ctx.globalAlpha = (0.24 + 0.08 * Math.sin(timeSec * 2.5 + r)) * alphaScale;
      ctx.fillStyle = pal.capMid;
      this.drawPixelRing(ctx, cx, cy, rad, 2, 48);

      // Rotating circuit trace nodes & cardinal volt runes
      for (let n = 0; n < nodes; n++) {
        const th = ang + (n / nodes) * TWO_PI;
        const nx = Math.round(cx + Math.cos(th) * rad);
        const ny = Math.round(cy + Math.sin(th) * rad);
        ctx.globalAlpha = 0.42 * alphaScale;
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(nx - 2, ny - 2, 5, 5);
        ctx.globalAlpha = 0.65 * alphaScale;
        ctx.fillStyle = n % 2 === 0 ? pal.capLight : pal.accent;
        ctx.fillRect(nx - 1, ny - 1, 3, 3);

        // Short radial circuit stub extending inward/outward
        const stubR = n % 2 === 0 ? rad + 7 : rad - 7;
        const sx = Math.round(cx + Math.cos(th) * stubR);
        const sy = Math.round(cy + Math.sin(th) * stubR);
        ctx.globalAlpha = 0.36 * alphaScale;
        ctx.fillStyle = pal.ambientMote;
        ctx.fillRect((nx + sx) >> 1, (ny + sy) >> 1, 2, 2);
      }
    }
  }

  private drawAntigravScanlines(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camY: number,
    timeSec: number,
    alphaScale = 1.0,
    drawFullWidthBars = true,
  ): void {
    if (drawFullWidthBars) {
      // 1. Subtle horizontal pulsing cyan antigravity scanlines rising smoothly upward (Built-In only)
      const riseOff = Math.round(wrap(-timeSec * 22 + camY * PPU * 0.2, 16));
      const pulse = (0.06 + 0.04 * Math.sin(timeSec * 3.8)) * alphaScale;
      ctx.fillStyle = pal.ambientMote;
      ctx.globalAlpha = pulse;
      for (let y = riseOff; y < VIEWPORT_H; y += 16) {
        ctx.fillRect(0, y, VIEWPORT_W, 1);
      }

      // 2. Two brighter sweeping antigravity scan wave pulses climbing the screen (Built-In only;
      // suppressed in Custom Pack mode so no 1px horizontal line cuts across the origin TEMP sky)
      for (let w = 0; w < 2; w++) {
        const waveY = Math.round(wrap(VIEWPORT_H - timeSec * 52 + w * (VIEWPORT_H * 0.5), VIEWPORT_H));
        ctx.globalAlpha = 0.16 * alphaScale;
        ctx.fillStyle = pal.capMid;
        ctx.fillRect(0, waveY - 1, VIEWPORT_W, 3);
        ctx.globalAlpha = 0.28 * alphaScale;
        ctx.fillStyle = pal.capLight;
        ctx.fillRect(0, waveY, VIEWPORT_W, 1);
      }
    }

    // 3. Upward-drifting antigravity pixel chevrons & circuit sparks
    for (let i = 0; i < 14; i++) {
      const spd = SLOT_SPEED[i]!;
      const px = Math.round(SLOT_SEED_X[i]!);
      const py = Math.round(wrap(SLOT_SEED_Y[i]! - timeSec * (24 * spd), VIEWPORT_H));
      ctx.globalAlpha = 0.52 * alphaScale;
      ctx.fillStyle = i % 3 === 0 ? pal.accent : pal.capLight;
      // Tiny crisp upward chevron ^
      ctx.fillRect(px, py, 1, 1);
      ctx.fillRect(px - 1, py + 1, 1, 1);
      ctx.fillRect(px + 1, py + 1, 1, 1);
    }
  }

  // ==========================================================================
  // 8. EVIL — Crimson Lightning Flickers, Floating Dark Violet Runes, Eclipse Aura
  // ==========================================================================

  private drawNightmareEclipseAndLightning(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    timeSec: number,
    drawEclipseDisk = true,
  ): void {
    // 1. Massive pulsing Eclipse Aura high in the nightmare sky (skip when custom animated origin sky is active!)
    if (drawEclipseDisk) {
      const ex = Math.round(HALF_W - camX * PPU * 0.05);
      const ey = 74;
      const coronaPulse = Math.round(Math.sin(timeSec * 3.0) * 3);

      // Outer crimson-violet glow rings
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = pal.skyGlow;
      this.drawPixelDisk(ctx, ex, ey, 58 + coronaPulse);
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = pal.capMid;
      this.drawPixelRing(ctx, ex, ey, 46 + coronaPulse, 4, 48);

      // Blazing crimson eclipse rim + eldritch green spark corona
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = pal.celestialColor;
      this.drawPixelRing(ctx, ex, ey, 34, 3, 40);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = pal.celestialRing;
      for (let s = 0; s < 8; s++) {
        const th = (s / 8) * TWO_PI + timeSec * 0.5;
        const rx = Math.round(ex + Math.cos(th) * (39 + (s & 1) * 4));
        const ry = Math.round(ey + Math.sin(th) * (39 + (s & 1) * 4));
        ctx.fillRect(rx - 1, ry - 1, 2, 2);
      }

      // Pitch-void eclipsed core
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = OUTLINE_DARK;
      this.drawPixelDisk(ctx, ex, ey, 31);
    }

    // 2. Periodic deterministic crimson lightning flickers!
    const cycle = timeSec % 3.6;
    const strikeA = cycle > 0.15 && cycle < 0.34;
    const strikeB = cycle > 2.05 && cycle < 2.21;
    if (strikeA || strikeB) {
      const boltIdx = strikeA ? 0 : 1;
      const flickerOn = (((timeSec * 42) | 0) & 1) === 0;
      if (flickerOn) {
        // Brief atmospheric crimson lightning sky flash
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = pal.capLight;
        ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);

        // Jagged pixel-stepped crimson lightning bolt
        const startX = boltIdx === 0 ? 116 : 458;
        let bx = startX;
        let by = 0;
        for (let seg = 0; seg < 11; seg++) {
          const jitter = (((seg * 17 + boltIdx * 31 + ((timeSec * 12) | 0)) & 7) - 3) * 5;
          const nx = bx + jitter;
          const ny = by + 18;
          this.drawPixelSegment(ctx, bx, by, nx, ny, 3, pal.capMid, 0.75);
          this.drawPixelSegment(ctx, bx, by, nx, ny, 1, HIGHLIGHT_CREAM, 0.9);
          // Occasional short fork
          if (seg === 4 || seg === 7) {
            const fx = nx + (seg === 4 ? -18 : 16);
            this.drawPixelSegment(ctx, nx, ny, fx, ny + 18, 2, pal.capLight, 0.65);
          }
          bx = nx;
          by = ny;
        }
      }
    }
  }

  private drawFloatingVioletRunes(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    camX: number,
    camY: number,
    timeSec: number,
    alphaScale = 1.0,
  ): void {
    const parX = camX * PPU * 0.34;
    const parY = camY * PPU * 0.24;

    for (let i = 0; i < 10; i++) {
      const spd = SLOT_SPEED[i]!;
      const ph = SLOT_PHASE[i]!;
      const rx = Math.round(
        wrap(SLOT_SEED_X[i]! + Math.sin(timeSec * 0.9 + ph) * 12 - parX, VIEWPORT_W),
      );
      const ry = Math.round(
        wrap(SLOT_SEED_Y[i]! - timeSec * (11 * spd) + parY, VIEWPORT_H),
      );
      const glyph = RUNE_GLYPHS[i & 3]!;
      const pulse = (0.45 + 0.45 * Math.sin(timeSec * 3.2 + ph * 2)) * alphaScale;

      // Dark-plum 1px outline shadow behind rune
      ctx.globalAlpha = pulse * 0.65;
      ctx.fillStyle = OUTLINE_DARK;
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (glyph[gy * 5 + gx] === 1) {
            ctx.fillRect(rx + gx * 2 - 1, ry + gy * 2 - 1, 4, 4);
          }
        }
      }

      // Glowing dark-violet / crimson-magenta rune body
      ctx.globalAlpha = pulse;
      ctx.fillStyle = i % 3 === 0 ? pal.capLight : pal.earthLight;
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (glyph[gy * 5 + gx] === 1) {
            ctx.fillRect(rx + gx * 2, ry + gy * 2, 2, 2);
          }
        }
      }

      // Inner eldritch highlight pixel
      if (pulse > 0.72) {
        ctx.fillStyle = i % 2 === 0 ? pal.accent : HIGHLIGHT_CREAM;
        ctx.fillRect(rx + 4, ry + 4, 2, 2);
      }
    }
  }

  // ==========================================================================
  // 9. GSHIP — Rolling Ghostly Ocean Swells, Swaying Lantern Glow & 3-Tier Hazard Pulses
  // ==========================================================================

  private drawGhostShipLanterns(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    hazardTier: 0 | 1 | 2,
    camX: number,
    timeSec: number,
    haloScale = 1.0,
  ): void {
    const swayAmp = hazardTier === 2 ? 0.24 : hazardTier === 1 ? 0.16 : 0.1;
    const swayFreq = hazardTier === 2 ? 2.8 : hazardTier === 1 ? 2.1 : 1.5;
    const parX = Math.round(camX * PPU * 0.22);

    for (let i = 0; i < GSHIP_LANTERNS.length; i++) {
      const spec = GSHIP_LANTERNS[i]!;
      const anchorX = Math.round(wrap(spec[0] - parX, VIEWPORT_W + 64) - 32);
      const anchorY = spec[1];
      const chainLen = spec[2];
      const angle = Math.sin(timeSec * swayFreq + spec[3]) * swayAmp;
      const lx = Math.round(anchorX + Math.sin(angle) * chainLen);
      const ly = Math.round(anchorY + Math.cos(angle) * chainLen);

      // Soft stepped spectral lantern glow halo
      const flicker = 0.85 + 0.15 * Math.sin(timeSec * 9.0 + i * 2.4);
      const glowCol = hazardTier === 2 ? HAZARD_CRIMSON : pal.accent;
      ctx.fillStyle = glowCol;
      ctx.globalAlpha = 0.08 * flicker * haloScale;
      this.drawPixelDisk(ctx, lx, ly + 4, 34);
      ctx.globalAlpha = 0.14 * flicker * haloScale;
      this.drawPixelDisk(ctx, lx, ly + 4, 20);

      // Swaying pixel iron chain
      ctx.globalAlpha = 0.75;
      this.drawPixelSegment(ctx, anchorX, anchorY, lx, ly - 5, 1, OUTLINE_DARK, 0.85);
      this.drawPixelSegment(ctx, anchorX, anchorY, lx, ly - 5, 1, pal.earthLight, 0.55);

      // Crisp 1px-outlined brass ship lantern housing
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(lx - 5, ly - 5, 10, 14);
      ctx.fillStyle = pal.earthMid;
      ctx.fillRect(lx - 4, ly - 4, 8, 2);
      ctx.fillRect(lx - 4, ly + 6, 8, 2);
      ctx.fillStyle = hazardTier === 2 ? HAZARD_CRIMSON : pal.capLight;
      ctx.fillRect(lx - 3, ly - 2, 6, 8);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(lx - 1, ly, 2, 4);
    }
  }

  private drawGhostShipSwellsAndHazardPulse(
    ctx: CanvasRenderingContext2D,
    pal: BiomePalette,
    state: SimState,
    camX: number,
    timeSec: number,
  ): void {
    const tier = state.ghostShip.hazardTier;
    const scrollX = camX * PPU * 0.5;
    const chop = tier === 2 ? 5.5 : tier === 1 ? 3.8 : 2.5;
    const waveSpeed = tier === 2 ? 4.4 : tier === 1 ? 3.2 : 2.2;

    // 1. Back rolling ghostly ocean swell silhouette along deck bottom
    ctx.fillStyle = pal.capDark;
    ctx.globalAlpha = 0.45;
    for (let x = 0; x < VIEWPORT_W; x += 6) {
      const h = 11 + Math.round(Math.sin((x + scrollX * 0.6) * 0.032 + timeSec * waveSpeed) * chop);
      ctx.fillRect(x, VIEWPORT_H - h, 6, h);
    }

    // 2. Front rolling spectral wave crest + glowing ghostly foam line
    for (let x = 0; x < VIEWPORT_W; x += 4) {
      const ph = (x + scrollX) * 0.045 - timeSec * (waveSpeed * 1.15);
      const h = 7 + Math.round(Math.sin(ph) * chop);
      const topY = VIEWPORT_H - h;
      ctx.globalAlpha = 0.52;
      ctx.fillStyle = pal.skyBot;
      ctx.fillRect(x, topY + 2, 4, Math.max(0, h - 2));
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = pal.capMid;
      ctx.fillRect(x, topY, 4, 2);
      // Spectral foam pixel crest on peaks
      if (Math.sin(ph) > 0.35) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = pal.accent;
        ctx.fillRect(x, topY - 1, 3, 1);
      }
    }

    // 3. Visual 3-Tier Dynamic Hazard Warning Pulses aligned with state.ghostShip.hazardTier!
    const spikeWave = state.ghostShip.spikeTimer > 0 ? Math.sin(state.ghostShip.spikeTimer * 10) : Math.sin(timeSec * 6);
    if (tier === 0) {
      // Tier 0: Calm ghostly teal perimeter pulse (low intensity)
      const pulse = 0.06 + 0.04 * (0.5 + 0.5 * Math.sin(timeSec * 2.2));
      ctx.globalAlpha = pulse;
      ctx.fillStyle = pal.accent;
      ctx.fillRect(0, VIEWPORT_H - 3, VIEWPORT_W, 3);
      ctx.fillRect(0, 0, 2, VIEWPORT_H);
      ctx.fillRect(VIEWPORT_W - 2, 0, 2, VIEWPORT_H);
    } else if (tier === 1) {
      // Tier 1: Escalated Amber-Spectral hazard warning pulses along deck & side rails
      const pulse = 0.14 + 0.14 * (0.5 + 0.5 * spikeWave);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = HAZARD_AMBER;
      ctx.fillRect(0, 0, 3, VIEWPORT_H);
      ctx.fillRect(VIEWPORT_W - 3, 0, 3, VIEWPORT_H);
      // Scrolling caution hazard ticks along deck edge
      const tickOff = Math.round(wrap(timeSec * 36, 24));
      ctx.globalAlpha = 0.35 + 0.35 * (0.5 + 0.5 * spikeWave);
      for (let x = -tickOff; x < VIEWPORT_W; x += 24) {
        ctx.fillStyle = HAZARD_AMBER;
        ctx.fillRect(x, VIEWPORT_H - 14, 10, 2);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(x + 12, VIEWPORT_H - 14, 6, 2);
      }
    } else {
      // Tier 2: Maximum Crimson-Spectral Storm Danger Pulses + corner warning brackets!
      const fastPulse = 0.5 + 0.5 * Math.sin(timeSec * 9.5 + state.ghostShip.spikeTimer * 4);
      ctx.globalAlpha = 0.14 + 0.18 * fastPulse;
      ctx.fillStyle = HAZARD_CRIMSON;
      ctx.fillRect(0, 0, 4, VIEWPORT_H);
      ctx.fillRect(VIEWPORT_W - 4, 0, 4, VIEWPORT_H);
      ctx.fillRect(0, 0, VIEWPORT_W, 3);

      // Pulsing danger chevron band across lower deck hazard zone
      const tickOff = Math.round(wrap(timeSec * 64, 20));
      ctx.globalAlpha = 0.45 + 0.45 * fastPulse;
      for (let x = -tickOff; x < VIEWPORT_W; x += 20) {
        ctx.fillStyle = (x & 1) === 0 ? HAZARD_CRIMSON : HAZARD_AMBER;
        ctx.fillRect(x, VIEWPORT_H - 16, 10, 2);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(x + 2, VIEWPORT_H - 14, 6, 1);
      }

      // Corner hazard warning brackets (keeps clear of HUD top-left/top-right panels!)
      ctx.globalAlpha = 0.4 + 0.45 * fastPulse;
      ctx.fillStyle = HAZARD_CRIMSON;
      ctx.fillRect(4, VIEWPORT_H - 26, 14, 2);
      ctx.fillRect(4, VIEWPORT_H - 26, 2, 12);
      ctx.fillRect(VIEWPORT_W - 18, VIEWPORT_H - 26, 14, 2);
      ctx.fillRect(VIEWPORT_W - 6, VIEWPORT_H - 26, 2, 12);
    }
  }

  // ==========================================================================
  // Crisp Integer-Snapped Pixel Primitives (Zero Allocations, Zero Anti-Aliasing)
  // ==========================================================================

  private drawPixelRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    thickness: number,
    steps: number,
  ): void {
    const stride = Math.max(1, Math.floor(TRIG_STEPS / Math.min(TRIG_STEPS, steps)));
    const half = thickness >> 1;
    for (let i = 0; i < TRIG_STEPS; i += stride) {
      const px = Math.round(cx + COS_LUT[i]! * radius) - half;
      const py = Math.round(cy + SIN_LUT[i]! * radius) - half;
      ctx.fillRect(px, py, thickness, thickness);
    }
  }

  private drawPixelDisk(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
  ): void {
    const r = Math.max(1, radius | 0);
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy += 2) {
      const span = Math.floor(Math.sqrt(Math.max(0, r2 - dy * dy)));
      ctx.fillRect(cx - span, cy + dy, span * 2, 2);
    }
  }

  private drawPixelSegment(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thickness: number,
    color: string,
    alpha: number,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(2, Math.min(36, Math.round(Math.hypot(dx, dy) / 3)));
    const half = thickness >> 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t) - half;
      const py = Math.round(y0 + dy * t) - half;
      ctx.fillRect(px, py, thickness, thickness);
    }
  }
}
