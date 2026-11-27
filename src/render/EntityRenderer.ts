/**
 * Krunked Quest — Entity, Hero, Tongue/Stomp VFX, Enemy, Boss & Collectible Renderer
 * Features:
 * - Official CustomPackEntry SpriteFrameRect + SpriteAnimClip multi-clip animation renderer
 * - Zero-allocation cached offscreen white hit-flash tinting (never falls back to blobs!)
 * - Signature elastic Tongue & Stomp visuals for all 6 forms (origin FX sheets + pixel tongue)
 * - Strict 576x324 (32 PPU) nearest-neighbor 1:1 pixel-snapped rendering, zero per-frame allocations!
 */

import {
  PPU,
  VIEWPORT_H,
  VIEWPORT_W,
  type BossRuntime,
  type CustomPackEntry,
  type HeroFormId,
  type HeroState,
  type IAssetPackManager,
  type ProjectileRuntime,
  type SimState,
} from '../contracts/index.js';
import {
  FLASH_WHITE,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
} from '../assets/palettes.js';
import {
  HERO_ACT_FRAME_H,
  HERO_ACT_FRAME_W,
  HERO_STD_FRAME_H,
  HERO_STD_FRAME_W,
  HeroActFrame,
  HeroStdFrame,
  type ProceduralPixelAtlas,
} from '../assets/ProceduralPixelAtlas.js';

const HALF_W = VIEWPORT_W * 0.5; // 288
const HALF_H = VIEWPORT_H * 0.5; // 162

// ============================================================================
// Shared Zero-Allocation Sprite-Rect & Cached White Hit-Flash Utilities
// ============================================================================

export interface SpriteSliceOut {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  pivotX: number; // Normalized [0..1] (0.5 = horizontal center)
  pivotY: number; // Normalized [0..1] TOP-DOWN (1.0 = bottom/feet)
  hasManifestRect: boolean;
  matchedClip: boolean;
}

// Module-level reusable scratch canvas for white hit-flash tinting (ZERO per-frame allocations!)
let flashScratchCanvas: HTMLCanvasElement | null = null;
let flashScratchCtx: CanvasRenderingContext2D | null = null;

function ensureFlashScratch(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const needW = Math.max(1, Math.ceil(w));
  const needH = Math.max(1, Math.ceil(h));
  if (!flashScratchCanvas) {
    flashScratchCanvas = document.createElement('canvas');
    flashScratchCanvas.width = Math.max(160, needW);
    flashScratchCanvas.height = Math.max(160, needH);
    flashScratchCtx = flashScratchCanvas.getContext('2d');
  } else if (flashScratchCanvas.width < needW || flashScratchCanvas.height < needH) {
    flashScratchCanvas.width = Math.max(flashScratchCanvas.width, needW);
    flashScratchCanvas.height = Math.max(flashScratchCanvas.height, needH);
    flashScratchCtx = flashScratchCanvas.getContext('2d');
  }
  return flashScratchCtx;
}

export function isDrawable(
  img: HTMLCanvasElement | HTMLImageElement | null | undefined,
): img is HTMLCanvasElement | HTMLImageElement {
  if (!img) return false;
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  }
  return img.width > 0 && img.height > 0;
}

export function getImageWidth(img: HTMLCanvasElement | HTMLImageElement): number {
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.naturalWidth || img.width;
  }
  return img.width;
}

export function getImageHeight(img: HTMLCanvasElement | HTMLImageElement): number {
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.naturalHeight || img.height;
  }
  return img.height;
}

/**
 * Draws a sprite sub-rectangle crisply, applying cached silhouette-accurate white hit-flash
 * when `flash` is true (zero per-frame canvas creation!).
 */
export function drawSpriteRect(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement | HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flash: boolean,
): void {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  if (!flash) {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  const sCtx = ensureFlashScratch(sw, sh);
  if (!sCtx || !flashScratchCanvas) {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  sCtx.globalCompositeOperation = 'source-over';
  sCtx.imageSmoothingEnabled = false;
  sCtx.clearRect(0, 0, sw, sh);
  sCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  sCtx.globalCompositeOperation = 'source-atop';
  sCtx.fillStyle = FLASH_WHITE;
  sCtx.fillRect(0, 0, sw, sh);
  sCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(flashScratchCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
}

/**
 * Resolves exact source sub-rect & normalized pivot from `CustomPackEntry` into pre-allocated `out`.
 * Supports:
 *  - `clipCandidates`: ordered list of clip names in `entry.clips` (e.g. `['fire_stomp', 'air_stomp', 'fall']`)
 *  - `explicitFrameIdx`: direct frame index into `entry.frames` (e.g. `ui/form_icons` 0..5, `ui/shield_icon` 0/1)
 *  - `progress01`: when >= 0, maps `[0..1)` directly across the clip/frames sequence (ideal for one-shot FX bursts!)
 *  - Safe legacy grid/strip fallback when an older manifest lacks `frames`.
 */
export function resolveCustomFrame(
  customPack: IAssetPackManager | null,
  key: string,
  img: HTMLCanvasElement | HTMLImageElement,
  animTime: number,
  defaultFps: number,
  loop: boolean,
  out: SpriteSliceOut,
  clipNameOrCandidates?: string | readonly string[],
  fallbackCols = 0,
  fallbackRows = 0,
  explicitFrameIdx = -1,
  progress01 = -1,
): void {
  const iw = getImageWidth(img);
  const ih = getImageHeight(img);

  out.sx = 0;
  out.sy = 0;
  out.sw = iw;
  out.sh = ih;
  out.pivotX = 0.5;
  out.pivotY = 1.0;
  out.hasManifestRect = false;
  out.matchedClip = false;

  const entry: CustomPackEntry | null = customPack ? customPack.getEntry(key) : null;
  const frames = entry?.frames;

  if (frames && frames.length > 0) {
    out.hasManifestRect = true;

    // A. Direct explicit frame index (e.g., ui/form_icons, ui/shield_icon)
    if (explicitFrameIdx >= 0) {
      const idx = Math.min(frames.length - 1, explicitFrameIdx);
      const r = frames[idx]!;
      out.sx = r.x;
      out.sy = r.y;
      out.sw = r.w;
      out.sh = r.h;
      out.pivotX = r.pivotX;
      out.pivotY = r.pivotY;
      out.matchedClip = true;
      return;
    }

    // B. Named clip lookup in `entry.clips`
    const clips = entry?.clips;
    if (clips && clipNameOrCandidates) {
      let chosenClip = undefined;
      if (typeof clipNameOrCandidates === 'string') {
        chosenClip = clips[clipNameOrCandidates];
      } else {
        for (let i = 0; i < clipNameOrCandidates.length; i++) {
          const cand = clips[clipNameOrCandidates[i]!];
          if (cand && cand.frames.length > 0) {
            chosenClip = cand;
            break;
          }
        }
      }

      if (chosenClip && chosenClip.frames.length > 0) {
        const len = chosenClip.frames.length;
        let slot: number;
        if (progress01 >= 0) {
          slot = Math.min(len - 1, Math.max(0, Math.floor(progress01 * len)));
        } else {
          const fps = chosenClip.fps > 0 ? chosenClip.fps : defaultFps;
          const raw = Math.floor(Math.max(0, animTime) * fps);
          slot = chosenClip.loop ? raw % len : Math.min(len - 1, raw);
        }
        const fIdx = chosenClip.frames[slot]!;
        const r = frames[fIdx % frames.length]!;
        out.sx = r.x;
        out.sy = r.y;
        out.sw = r.w;
        out.sh = r.h;
        out.pivotX = r.pivotX;
        out.pivotY = r.pivotY;
        out.matchedClip = true;
        return;
      }
    }

    // C. Fallback: animate across all `entry.frames`
    const len = frames.length;
    let idx: number;
    if (progress01 >= 0) {
      idx = Math.min(len - 1, Math.max(0, Math.floor(progress01 * len)));
    } else {
      const raw = Math.floor(Math.max(0, animTime) * defaultFps);
      idx = loop ? raw % len : Math.min(len - 1, raw);
    }
    const r = frames[idx]!;
    out.sx = r.x;
    out.sy = r.y;
    out.sw = r.w;
    out.sh = r.h;
    out.pivotX = r.pivotX;
    out.pivotY = r.pivotY;
    return;
  }

  // D. Legacy fallback grid hint (when an un-upgraded manifest lacks `frames`)
  if (fallbackCols > 0 && fallbackRows > 0) {
    const fw = Math.floor(iw / fallbackCols);
    const fh = Math.floor(ih / fallbackRows);
    const total = fallbackCols * fallbackRows;
    let idx: number;
    if (explicitFrameIdx >= 0) {
      idx = Math.min(total - 1, explicitFrameIdx);
    } else if (progress01 >= 0) {
      idx = Math.min(total - 1, Math.max(0, Math.floor(progress01 * total)));
    } else {
      const raw = Math.floor(Math.max(0, animTime) * defaultFps);
      idx = loop ? raw % total : Math.min(total - 1, raw);
    }
    out.sx = (idx % fallbackCols) * fw;
    out.sy = Math.floor(idx / fallbackCols) * fh;
    out.sw = fw;
    out.sh = fh;
    return;
  }

  // E. Legacy horizontal strip auto-detection (e.g. 512x32 hearts, 145x26 goomba)
  if (iw >= ih * 2 && ih >= 12) {
    const approxCols = Math.max(1, Math.round(iw / ih));
    const fw = Math.floor(iw / approxCols);
    let idx: number;
    if (explicitFrameIdx >= 0) {
      idx = Math.min(approxCols - 1, explicitFrameIdx);
    } else if (progress01 >= 0) {
      idx = Math.min(approxCols - 1, Math.max(0, Math.floor(progress01 * approxCols)));
    } else {
      const raw = Math.floor(Math.max(0, animTime) * defaultFps);
      idx = loop ? raw % approxCols : Math.min(approxCols - 1, raw);
    }
    out.sx = idx * fw;
    out.sy = 0;
    out.sw = fw;
    out.sh = ih;
  }
}

// ============================================================================
// Form Tongue & Action Styling Helpers
// ============================================================================

interface TonguePalette {
  readonly hi: string;
  readonly mid: string;
  readonly dark: string;
  readonly glow: string;
}

const TONGUE_PALETTES: Readonly<Record<HeroFormId, TonguePalette>> = {
  krunk_basic: { hi: '#ff5c7c', mid: '#da0b35', dark: '#780822', glow: '#fbb7ff' },
  krunk_fire: { hi: '#fff266', mid: '#ff8a00', dark: '#b83200', glow: '#ffec42' },
  krunk_leaf: { hi: '#d466ff', mid: '#8418c4', dark: '#451d49', glow: '#a8ff66' },
  krunk_rock: { hi: '#b4c2cc', mid: '#6d7882', dark: '#384047', glow: '#ffe7a1' },
  krunk_electric: { hi: '#d4ffff', mid: '#26ccff', dark: '#1248d8', glow: '#f2ff38' },
  krunk_shadow: { hi: '#88ff59', mid: '#18c700', dark: '#0c6618', glow: '#ff006a' },
};

const LEGACY_HERO_IDLE_GRIDS: Readonly<Record<HeroFormId, readonly [number, number]>> = {
  krunk_basic: [10, 1],
  krunk_fire: [10, 1],
  krunk_leaf: [10, 1],
  krunk_rock: [10, 1],
  krunk_electric: [5, 2],
  krunk_shadow: [5, 2],
};

// Pre-allocated constant candidate clip arrays (ZERO per-frame array allocations!)
const CLIPS_IDLE: readonly string[] = ['idle'];
const CLIPS_RUN: readonly string[] = ['run', 'idle'];
const CLIPS_JUMP: readonly string[] = ['jump', 'flip', 'idle'];
const CLIPS_FLIP: readonly string[] = ['flip', 'jump', 'idle'];
const CLIPS_FALL: readonly string[] = ['fall', 'jump', 'idle'];
const CLIPS_WALL_SLIDE: readonly string[] = ['wall_slide', 'fall', 'idle'];
const CLIPS_VINE_SLIDE: readonly string[] = ['vine_slide', 'wall_slide', 'idle'];
const CLIPS_GROUND_STOMP: readonly string[] = ['ground_stomp', 'air_stomp', 'flip', 'jump', 'idle'];
const CLIPS_FIRE_GROUND_STOMP: readonly string[] = ['ground_stomp', 'fire_stomp', 'air_stomp', 'flip', 'idle'];
const CLIPS_FIRE_STOMP: readonly string[] = ['fire_stomp', 'air_stomp', 'fall', 'idle'];
const CLIPS_GROUND_DASH: readonly string[] = ['ground_dash', 'flip', 'run', 'idle'];
const CLIPS_WALL_DASH: readonly string[] = ['wall_dash', 'ground_dash', 'flip', 'jump', 'idle'];
const CLIPS_AIR_STOMP: readonly string[] = ['air_stomp', 'fall', 'idle'];
const CLIPS_FIRE_DASH: readonly string[] = ['fire_dash', 'ground_dash', 'run', 'idle'];
const CLIPS_LEAF_GLIDE: readonly string[] = ['leaf_glide', 'fall', 'idle'];
const CLIPS_ROCK_UPPERCUT: readonly string[] = ['rock_uppercut', 'jump', 'idle'];
const CLIPS_VOLT_DIVE: readonly string[] = ['volt_dive', 'air_stomp', 'fall', 'idle'];
const CLIPS_VOLT_BLINK: readonly string[] = ['volt_blink', 'ground_dash', 'idle'];
const CLIPS_SHADOW_BLINK: readonly string[] = ['shadow_blink', 'ground_dash', 'idle'];
const CLIPS_HURT: readonly string[] = ['hurt', 'idle'];
const CLIPS_DEAD: readonly string[] = ['dead', 'hurt', 'idle'];

const ENEMY_CLIPS_WALK: readonly string[] = ['walk', 'idle'];
const ENEMY_CLIPS_ATTACK: readonly string[] = ['attack', 'walk', 'idle'];
const ENEMY_CLIPS_TELEGRAPH: readonly string[] = ['telegraph', 'attack', 'walk', 'idle'];

function getHeroClipCandidates(hero: HeroState): readonly string[] {
  switch (hero.action) {
    case 'idle':
      return CLIPS_IDLE;
    case 'run':
      return CLIPS_RUN;
    case 'jump':
      return hero.jumpsRemaining < hero.maxAirJumps && !hero.grounded ? CLIPS_FLIP : CLIPS_JUMP;
    case 'flip':
      return CLIPS_FLIP;
    case 'fall':
      return CLIPS_FALL;
    case 'wall_slide':
      return CLIPS_WALL_SLIDE;
    case 'vine_slide':
      return CLIPS_VINE_SLIDE;
    case 'ground_stomp':
      return hero.form === 'krunk_fire' ? CLIPS_FIRE_GROUND_STOMP : CLIPS_GROUND_STOMP;
    case 'ground_dash':
      return CLIPS_GROUND_DASH;
    case 'wall_dash':
      return CLIPS_WALL_DASH;
    case 'air_stomp':
      return hero.form === 'krunk_fire' ? CLIPS_FIRE_STOMP : CLIPS_AIR_STOMP;
    case 'fire_dash':
      return CLIPS_FIRE_DASH;
    case 'leaf_glide':
      return CLIPS_LEAF_GLIDE;
    case 'rock_uppercut':
      return CLIPS_ROCK_UPPERCUT;
    case 'volt_dive':
      return CLIPS_VOLT_DIVE;
    case 'volt_blink':
      return CLIPS_VOLT_BLINK;
    case 'shadow_blink':
      return CLIPS_SHADOW_BLINK;
    case 'hurt':
      return CLIPS_HURT;
    case 'dead':
      return CLIPS_DEAD;
  }
}

function getHeroClipFps(action: HeroState['action']): number {
  switch (action) {
    case 'run':
      return 12;
    case 'flip':
    case 'ground_stomp':
    case 'air_stomp':
    case 'ground_dash':
    case 'wall_dash':
    case 'fire_dash':
    case 'volt_dive':
    case 'volt_blink':
    case 'shadow_blink':
      return 15;
    case 'rock_uppercut':
    case 'leaf_glide':
      return 12;
    case 'hurt':
      return 10;
    default:
      return 9;
  }
}

function isHeroActionLooping(action: HeroState['action']): boolean {
  return (
    action === 'idle' ||
    action === 'run' ||
    action === 'flip' ||
    action === 'wall_slide' ||
    action === 'vine_slide' ||
    action === 'leaf_glide' ||
    action === 'ground_stomp' ||
    action === 'air_stomp' ||
    action === 'fire_dash'
  );
}

function getProjectileCustomKey(kind: ProjectileRuntime['kind']): string {
  switch (kind) {
    case 'fireball':
      return 'boss/magma_boar_fireball';
    case 'fire_wave':
      return 'fx/fire_blast';
    case 'gear':
      return 'boss/mecha_bull_gear';
    case 'thorn':
      return 'boss/primal_eye_spike';
    case 'dark_orb':
      return 'boss/nightmare_orb';
    default:
      return `fx/proj_${kind}`;
  }
}

// ============================================================================
// EntityRenderer
// ============================================================================

export class EntityRenderer {
  private readonly slice: SpriteSliceOut = {
    sx: 0,
    sy: 0,
    sw: 32,
    sh: 32,
    pivotX: 0.5,
    pivotY: 1.0,
    hasManifestRect: false,
    matchedClip: false,
  };

  public renderAll(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    this.renderCollectibles(ctx, state, camX, camY, timeSec, atlas, customPack);
    this.renderEnemies(ctx, state, camX, camY, alpha, timeSec, atlas, customPack);
    if (state.boss && !state.boss.defeated) {
      this.renderBoss(ctx, state, state.boss, camX, camY, alpha, timeSec, atlas, customPack);
    }
    this.renderHero(ctx, state, camX, camY, alpha, timeSec, atlas, customPack);
    this.renderProjectiles(ctx, state, camX, camY, alpha, timeSec, atlas, customPack);
  }

  private renderCollectibles(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const frame4 = ((timeSec * 8) | 0) & 3;

    // Crystals (`ui/crystal` — 9-frame animated origin crystal!)
    const customCrystal = customPack ? customPack.getSprite('ui/crystal') : null;
    const crystalSheet = atlas.collectibles.get('crystal');
    const hasCustomCrystal = isDrawable(customCrystal);
    if (hasCustomCrystal) {
      resolveCustomFrame(customPack, 'ui/crystal', customCrystal, timeSec, 10, true, this.slice);
    }
    const csx = this.slice.sx;
    const csy = this.slice.sy;
    const csw = this.slice.sw;
    const csh = this.slice.sh;

    for (let i = 0; i < state.crystals.length; i++) {
      const c = state.crystals[i]!;
      if (c.collected) continue;
      const bob = Math.round(Math.sin(timeSec * 5 + c.x * 2.1 + c.y) * 2);
      const sx = Math.round((c.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - c.y) * PPU + HALF_H) + bob;
      if (sx < -20 || sx > VIEWPORT_W + 20 || sy < -20 || sy > VIEWPORT_H + 20) continue;

      if (hasCustomCrystal) {
        const dw = Math.min(20, Math.max(12, csw));
        const dh = Math.min(22, Math.max(12, csh));
        ctx.drawImage(customCrystal, csx, csy, csw, csh, sx - (dw >> 1), sy - (dh >> 1), dw, dh);
      } else if (crystalSheet) {
        ctx.drawImage(crystalSheet, frame4 * 16, 0, 16, 20, sx - 8, sy - 10, 16, 20);
      }
    }

    // Coins (`ui/coin` — 17-frame spinning origin golden medallion!)
    const customCoin = customPack ? customPack.getSprite('ui/coin') : null;
    const coinSheet = atlas.collectibles.get('coin');
    const hasCustomCoin = isDrawable(customCoin);
    if (hasCustomCoin) {
      resolveCustomFrame(customPack, 'ui/coin', customCoin, timeSec, 12, true, this.slice);
    }
    const ksx = this.slice.sx;
    const ksy = this.slice.sy;
    const ksw = this.slice.sw;
    const ksh = this.slice.sh;

    for (let i = 0; i < state.coins.length; i++) {
      const coin = state.coins[i]!;
      if (coin.collected) continue;
      const bob = Math.round(Math.sin(timeSec * 4.5 + coin.x * 1.7) * 2);
      const sx = Math.round((coin.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - coin.y) * PPU + HALF_H) + bob;
      if (sx < -24 || sx > VIEWPORT_W + 24 || sy < -24 || sy > VIEWPORT_H + 24) continue;

      if (hasCustomCoin) {
        const dw = Math.min(26, Math.max(18, ksw <= 28 ? ksw : 22));
        const dh = Math.min(26, Math.max(18, ksh <= 28 ? ksh : 22));
        ctx.drawImage(customCoin, ksx, ksy, ksw, ksh, sx - (dw >> 1), sy - (dh >> 1), dw, dh);
      } else if (coinSheet) {
        ctx.drawImage(coinSheet, frame4 * 20, 0, 20, 20, sx - 10, sy - 10, 20, 20);
      }
      if (frame4 === 0) {
        ctx.fillStyle = UI_COLORS.coinLight;
        ctx.fillRect(sx + 5, sy - 9, 2, 2);
      }
    }
  }

  private renderEnemies(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i]!;
      if (!e.alive) continue;

      const wx = e.prevX + (e.x - e.prevX) * alpha;
      const wy = e.prevY + (e.y - e.prevY) * alpha;
      const footX = Math.round((wx + e.width * 0.5 - camX) * PPU + HALF_W);
      const footY = Math.round((camY - wy) * PPU + HALF_H);
      if (footX < -64 || footX > VIEWPORT_W + 64 || footY < -64 || footY > VIEWPORT_H + 72) {
        continue;
      }

      const flash = e.hitFlashTimer > 0;
      const frame = ((timeSec * 6 + i * 0.7) | 0) & 1;

      if (e.grounded) {
        ctx.fillStyle = 'rgba(24, 11, 32, 0.35)';
        ctx.fillRect(footX - 10, footY - 2, 20, 3);
      }

      const enemyKey = `enemy/${e.archetype}`;
      const customSpr = customPack ? customPack.getSprite(enemyKey) : null;

      if (isDrawable(customSpr)) {
        const clips =
          e.shootTimer > 0 && e.shootTimer < 0.25
            ? ENEMY_CLIPS_ATTACK
            : e.shootTimer >= 0.25 && e.shootTimer < 0.55
              ? ENEMY_CLIPS_TELEGRAPH
              : ENEMY_CLIPS_WALK;
        resolveCustomFrame(
          customPack,
          enemyKey,
          customSpr,
          timeSec + i * 0.21,
          8,
          true,
          this.slice,
          clips,
        );
        // Native 1:1 pixel scale when manifest SpriteFrameRects are present (clamping only runaway uncropped sheets)
        let dw = this.slice.sw;
        let dh = this.slice.sh;
        const maxDim = this.slice.hasManifestRect
          ? 112
          : Math.max(40, Math.round(Math.max(e.width, e.height) * PPU * 1.55));
        if (dw > maxDim || dh > maxDim) {
          const s = maxDim / Math.max(dw, dh);
          dw = Math.max(16, Math.round(dw * s));
          dh = Math.max(16, Math.round(dh * s));
        }
        const centerAnchored = this.slice.hasManifestRect && this.slice.pivotY <= 0.65;
        const anchorY = centerAnchored ? footY - Math.round(e.height * PPU * 0.5) : footY;
        const dx = -Math.round(dw * this.slice.pivotX);
        const dy = -Math.round(dh * this.slice.pivotY);

        ctx.save();
        ctx.translate(footX, anchorY);
        if (e.facing < 0) {
          ctx.scale(-1, 1);
        }
        drawSpriteRect(
          ctx,
          customSpr,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          dx,
          dy,
          dw,
          dh,
          flash,
        );
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(footX, footY);
        if (e.facing < 0) {
          ctx.scale(-1, 1);
        }
        const sprSet = atlas.enemies.get(e.archetype);
        if (sprSet) {
          const img = flash ? sprSet.flash : sprSet.sheet;
          ctx.drawImage(
            img,
            frame * sprSet.frameW,
            0,
            sprSet.frameW,
            sprSet.frameH,
            -(sprSet.frameW >> 1),
            -sprSet.frameH + 2,
            sprSet.frameW,
            sprSet.frameH,
          );
        }
        ctx.restore();
      }

      if (e.stunTimer > 0) {
        const stOff = Math.round(Math.sin(timeSec * 12) * 5);
        const topY = footY - Math.round(e.height * PPU) - 6;
        ctx.fillStyle = UI_COLORS.frameGold;
        ctx.fillRect(footX - 6 + stOff, topY, 2, 2);
        ctx.fillRect(footX + 4 - stOff, topY - 1, 2, 2);
      }

      if (e.maxHp > 1 && e.hp < e.maxHp) {
        const topY = footY - Math.round(e.height * PPU) - 8;
        const barW = e.maxHp * 5 + 1;
        const bx = footX - (barW >> 1);
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(bx, topY, barW, 4);
        for (let p = 0; p < e.maxHp; p++) {
          ctx.fillStyle = p < e.hp ? '#ff3858' : '#3d1c3d';
          ctx.fillRect(bx + 1 + p * 5, topY + 1, 4, 2);
        }
      }
    }
  }

  private renderBoss(
    ctx: CanvasRenderingContext2D,
    _state: SimState,
    boss: BossRuntime,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const wx = boss.prevX + (boss.x - boss.prevX) * alpha;
    const wy = boss.prevY + (boss.y - boss.prevY) * alpha;
    const cx = Math.round((wx + boss.width * 0.5 - camX) * PPU + HALF_W);
    const cy = Math.round((camY - (wy + boss.height * 0.5)) * PPU + HALF_H);
    const hover = Math.round(Math.sin(timeSec * 3.5) * 3);
    const flash = boss.hitFlashTimer > 0;
    const frame = ((timeSec * 4.5) | 0) & 1;

    const sprSet = atlas.bosses.get(boss.id);
    const bossKey = `boss/${boss.id}`;
    const customBoss = customPack ? customPack.getSprite(bossKey) : null;

    ctx.save();
    ctx.translate(cx, cy + hover);
    if (boss.facing < 0 && boss.id !== 'primal_eye') {
      ctx.scale(-1, 1);
    }

    if (isDrawable(customBoss)) {
      resolveCustomFrame(customPack, bossKey, customBoss, timeSec, 8, true, this.slice, boss.state);
      const dw = this.slice.hasManifestRect ? this.slice.sw : Math.round(boss.width * PPU);
      const dh = this.slice.hasManifestRect ? this.slice.sh : Math.round(boss.height * PPU);
      drawSpriteRect(
        ctx,
        customBoss,
        this.slice.sx,
        this.slice.sy,
        this.slice.sw,
        this.slice.sh,
        -(dw >> 1),
        -(dh >> 1),
        dw,
        dh,
        flash,
      );
    } else if (sprSet) {
      const img = flash ? sprSet.flash : sprSet.sheet;
      ctx.drawImage(
        img,
        frame * sprSet.frameW,
        0,
        sprSet.frameW,
        sprSet.frameH,
        -(sprSet.frameW >> 1),
        -(sprSet.frameH >> 1),
        sprSet.frameW,
        sprSet.frameH,
      );
    }
    ctx.restore();
  }

  private renderHero(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const hero = state.hero;
    const wx = hero.prevX + (hero.x - hero.prevX) * alpha;
    const wy = hero.prevY + (hero.y - hero.prevY) * alpha;
    const footX = Math.round((wx + hero.width * 0.5 - camX) * PPU + HALF_W);
    const footY = Math.round((camY - wy) * PPU + HALF_H);

    // Play extracted non-looping `dead` clip when defeated (instead of vanishing!)
    if (hero.action === 'dead') {
      if (customPack && isDrawable(customPack.getHeroSheet(hero.form))) {
        this.drawHeroSprite(ctx, hero, footX, footY, timeSec, atlas, customPack);
      }
      return;
    }
    const centerY = footY - Math.round(hero.height * PPU * 0.5);
    const pal = HERO_FORM_PALETTES[hero.form];

    // Wall-slide stretching glistening saliva trail anchored at `wallSalivaTopY` down to hero!
    if (hero.wallSalivaActive && (hero.onWall !== 0 || hero.wallSlideDir !== 0)) {
      const wallSide = hero.onWall !== 0 ? hero.onWall : -hero.wallSlideDir;
      const wallX = footX + wallSide * Math.round(hero.width * PPU * 0.48);
      const topY = Math.round((camY - hero.wallSalivaTopY) * PPU + HALF_H);
      const botY = centerY + 4;
      const trailH = Math.max(4, botY - topY);
      if (trailH > 2 && trailH < 240) {
        const tPal = TONGUE_PALETTES[hero.form];
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(wallX - 2, topY - 1, 5, trailH + 2);
        ctx.fillStyle = tPal.glow;
        ctx.fillRect(wallX - 1, topY, 3, trailH);
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(wallX, topY + 1, 1, Math.max(2, trailH - 2));
        // Glossy bead droplet at top anchor
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(wallX - 3, topY - 2, 6, 4);
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(wallX - 2, topY - 1, 4, 2);
      }
    }

    const invulnBlink = hero.invulnTimer > 0 && (((timeSec * 24) | 0) & 1) === 1;

    if (hero.grounded) {
      ctx.fillStyle = 'rgba(24, 11, 32, 0.42)';
      ctx.fillRect(footX - 10, footY - 1, 20, 3);
    }

    // Volt target lock-on reticle (uses origin `fx/electric_aim` when Custom Pack is active!)
    if (hero.form === 'krunk_electric' && hero.voltTargetId !== null) {
      const tx = Math.round((hero.voltTargetX - camX) * PPU + HALF_W);
      const ty = Math.round((camY - hero.voltTargetY) * PPU + HALF_H);
      this.drawPixelBeam(ctx, footX, centerY, tx, ty, '#66f7ff');
      const aimSpr = customPack ? customPack.getSprite('fx/electric_aim') : null;
      if (isDrawable(aimSpr)) {
        resolveCustomFrame(customPack, 'fx/electric_aim', aimSpr, timeSec, 12, true, this.slice);
        ctx.drawImage(
          aimSpr,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          tx - (this.slice.sw >> 1),
          ty - (this.slice.sh >> 1),
          this.slice.sw,
          this.slice.sh,
        );
      } else {
        ctx.fillStyle = '#f2ff38';
        ctx.fillRect(tx - 12, ty - 12, 5, 2);
        ctx.fillRect(tx - 12, ty - 12, 2, 5);
        ctx.fillRect(tx + 7, ty - 12, 5, 2);
        ctx.fillRect(tx + 10, ty - 12, 2, 5);
        ctx.fillRect(tx - 12, ty + 10, 5, 2);
        ctx.fillRect(tx - 12, ty + 7, 2, 5);
        ctx.fillRect(tx + 7, ty + 10, 5, 2);
        ctx.fillRect(tx + 10, ty + 7, 2, 5);
      }
    }

    // Subtle elemental aura motes behind non-basic forms
    if (hero.form !== 'krunk_basic') {
      const t = timeSec * 4;
      ctx.fillStyle = pal[4];
      for (let m = 0; m < 3; m++) {
        const ang = t + m * 2.094;
        const mx = Math.round(footX + Math.cos(ang) * 14);
        const my = Math.round(centerY + Math.sin(ang * 1.3) * 10);
        ctx.fillRect(mx, my, 2, 2);
      }
    }

    // Back kinetic ability FX (fire jet, volt arc, stomp windlines)
    this.renderHeroActionBackFx(ctx, hero, footX, footY, centerY, timeSec, atlas, customPack);

    // Draw Hero Sprite (packed multi-clip Custom Pack -> Built-In ProceduralPixelAtlas)
    let heroHasNativeOriginActionClip = false;
    if (!invulnBlink) {
      heroHasNativeOriginActionClip = this.drawHeroSprite(
        ctx,
        hero,
        footX,
        footY,
        timeSec,
        atlas,
        customPack,
      );
    }

    // SIGNATURE TONGUE & STOMP FOREGROUND VISUALS (P0!)
    this.renderHeroTongueAndStompOverlay(
      ctx,
      hero,
      camX,
      camY,
      footX,
      footY,
      centerY,
      timeSec,
      atlas,
      customPack,
      heroHasNativeOriginActionClip,
    );

    // Orbiting DashRoundFire flames when Fire form + DashRoundFire upgrade owned
    const hasRoundFire = (state.progress.upgradeLevels.DashRoundFire ?? 0) > 0;
    if (hasRoundFire && hero.form === 'krunk_fire') {
      const customFire = customPack ? customPack.getSprite('boss/magma_boar_fireball') : null;
      const fireSpr = atlas.projectiles.get('fireball');
      const fireFrame = ((timeSec * 10) | 0) & 1;
      const baseAngle = hero.dashRingAngle !== 0 ? hero.dashRingAngle : timeSec * 5;
      if (isDrawable(customFire)) {
        resolveCustomFrame(customPack, 'boss/magma_boar_fireball', customFire, timeSec, 12, true, this.slice);
      }
      for (let f = 0; f < 3; f++) {
        const ang = baseAngle + (f * Math.PI * 2) / 3;
        const fx = Math.round(footX + Math.cos(ang) * 22);
        const fy = Math.round(centerY + Math.sin(ang) * 16);
        if (isDrawable(customFire)) {
          const dw = Math.min(20, this.slice.sw);
          const dh = Math.min(20, this.slice.sh);
          ctx.drawImage(
            customFire,
            this.slice.sx,
            this.slice.sy,
            this.slice.sw,
            this.slice.sh,
            fx - (dw >> 1),
            fy - (dh >> 1),
            dw,
            dh,
          );
        } else if (fireSpr) {
          ctx.drawImage(fireSpr, fireFrame * 16, 0, 16, 16, fx - 8, fy - 8, 16, 16);
        }
      }
    }

    // RockShield overlay (origin `fx/rock_shield` when Custom Pack active -> crisp stone-gem orbit!)
    if (hero.rockShieldActive) {
      const rockFx = customPack ? customPack.getSprite('fx/rock_shield') : null;
      if (isDrawable(rockFx)) {
        resolveCustomFrame(customPack, 'fx/rock_shield', rockFx, timeSec, 10, true, this.slice);
        ctx.drawImage(
          rockFx,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          footX - (this.slice.sw >> 1),
          centerY - (this.slice.sh >> 1),
          this.slice.sw,
          this.slice.sh,
        );
      } else {
        const segs = 10;
        const r = 19;
        for (let s = 0; s < segs; s++) {
          const ang = (s / segs) * Math.PI * 2 + timeSec * 1.8;
          const bx = Math.round(footX + Math.cos(ang) * r);
          const by = Math.round(centerY + Math.sin(ang) * r);
          ctx.fillStyle = OUTLINE_DARK;
          ctx.fillRect(bx - 2, by - 2, 5, 5);
          ctx.fillStyle = s % 2 === 0 ? UI_COLORS.shieldMid : UI_COLORS.shieldGem;
          ctx.fillRect(bx - 1, by - 1, 3, 3);
        }
      }
    }

    // MagicShield overlay (origin `fx/magic_shield` when Custom Pack active -> shimmering cyan halo!)
    if (hero.magicShieldTimer > 0) {
      const magicFx = customPack ? customPack.getSprite('fx/magic_shield') : null;
      if (isDrawable(magicFx)) {
        resolveCustomFrame(customPack, 'fx/magic_shield', magicFx, timeSec, 10, true, this.slice);
        ctx.drawImage(
          magicFx,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          footX - (this.slice.sw >> 1),
          centerY - (this.slice.sh >> 1),
          this.slice.sw,
          this.slice.sh,
        );
      } else {
        const segs = 12;
        const r = 22;
        ctx.fillStyle = UI_COLORS.magicShield;
        for (let s = 0; s < segs; s++) {
          const ang = (s / segs) * Math.PI * 2 - timeSec * 3.5;
          ctx.fillRect(
            Math.round(footX + Math.cos(ang) * r) - 1,
            Math.round(centerY + Math.sin(ang) * r) - 1,
            2,
            2,
          );
        }
      }
    }
  }

  /** Returns true when a real origin non-idle action clip matched on the packed Custom Pack hero atlas. */
  private drawHeroSprite(
    ctx: CanvasRenderingContext2D,
    hero: HeroState,
    footX: number,
    footY: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): boolean {
    const flash = hero.hitFlashTimer > 0;
    const sxScale = hero.scaleX > 0.2 ? hero.scaleX : 1;
    const syScale = hero.scaleY > 0.2 ? hero.scaleY : 1;
    const drawFacing = hero.action === 'wall_slide' && hero.onWall !== 0 ? -hero.onWall : hero.facing;
    const animT = hero.animTimer > 0 ? hero.animTimer : timeSec;

    // 1. Custom Pack packed multi-clip Hero Atlas (`hero/krunk_<form>`) — NEVER reverts to procedural on flash/action!
    if (customPack) {
      const baseKey = `hero/${hero.form}`;
      const baseImg = customPack.getHeroSheet(hero.form);
      if (isDrawable(baseImg)) {
        const candidates = getHeroClipCandidates(hero);
        const legacyGrid = LEGACY_HERO_IDLE_GRIDS[hero.form];
        const fps = getHeroClipFps(hero.action);
        const loop = isHeroActionLooping(hero.action);

        resolveCustomFrame(
          customPack,
          baseKey,
          baseImg,
          animT,
          fps,
          loop,
          this.slice,
          candidates,
          legacyGrid[0],
          legacyGrid[1],
        );

        const matchedRealActionClip = this.slice.matchedClip && hero.action !== 'idle';
        let tiltRad = 0;
        let dynScaleX = sxScale;
        let dynScaleY = syScale;

        // Subtle kinetic lean/spin only if a legacy pack lacked the specific non-idle clip
        if (!this.slice.matchedClip && hero.action !== 'idle') {
          if (hero.action === 'run') {
            tiltRad = 0.08 * Math.sin(animT * 18);
          } else if (hero.action === 'flip') {
            tiltRad = (animT * 16) % (Math.PI * 2);
          } else if (hero.action === 'air_stomp' || hero.action === 'ground_stomp') {
            dynScaleX *= 0.88;
            dynScaleY *= 1.16;
          } else if (
            hero.action === 'ground_dash' ||
            hero.action === 'wall_dash' ||
            hero.action === 'fire_dash' ||
            hero.action === 'volt_blink' ||
            hero.action === 'shadow_blink'
          ) {
            tiltRad = 0.14;
            dynScaleX *= 1.14;
            dynScaleY *= 0.9;
          } else if (hero.action === 'rock_uppercut') {
            dynScaleX *= 0.9;
            dynScaleY *= 1.16;
          }
        }

        const dw = this.slice.sw;
        const dh = this.slice.sh;
        const dx = -Math.round(dw * this.slice.pivotX);
        const dy = -Math.round(dh * this.slice.pivotY);

        ctx.save();
        ctx.translate(footX, footY);
        ctx.scale(drawFacing * dynScaleX, dynScaleY);
        if (tiltRad !== 0) {
          ctx.rotate(tiltRad);
        }
        drawSpriteRect(
          ctx,
          baseImg,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          dx,
          dy,
          dw,
          dh,
          flash,
        );
        ctx.restore();
        return matchedRealActionClip;
      }
    }

    // 2. Built-In ProceduralPixelAtlas (Upgraded chunky blocky-tongue Krunk!)
    const heroSet = atlas.heroSheets.get(hero.form);
    if (!heroSet) return false;

    const useActionSheet =
      hero.action === 'air_stomp' ||
      hero.action === 'ground_stomp' ||
      hero.action === 'rock_uppercut' ||
      hero.action === 'leaf_glide' ||
      hero.action === 'ground_dash' ||
      hero.action === 'wall_dash' ||
      hero.action === 'volt_dive' ||
      hero.action === 'volt_blink' ||
      hero.action === 'shadow_blink' ||
      (hero.tongueKind !== 'none' && hero.tongueTimer > 0 && hero.tongueKind !== 'wall_slide');

    ctx.save();
    ctx.translate(footX, footY);
    ctx.scale(drawFacing * sxScale, syScale);
    if (hero.action === 'flip') {
      ctx.translate(0, -14);
      ctx.rotate((animT * 18) % (Math.PI * 2));
      ctx.translate(0, 14);
    }

    if (useActionSheet) {
      const actFrame = this.selectHeroActFrame(hero, timeSec);
      const img = flash ? heroSet.actionFlash : heroSet.action;
      ctx.drawImage(
        img,
        actFrame * HERO_ACT_FRAME_W,
        0,
        HERO_ACT_FRAME_W,
        HERO_ACT_FRAME_H,
        -(HERO_ACT_FRAME_W >> 1),
        -HERO_ACT_FRAME_H + 8,
        HERO_ACT_FRAME_W,
        HERO_ACT_FRAME_H,
      );
    } else {
      const stdFrame = this.selectHeroStdFrame(hero, timeSec);
      const img = flash ? heroSet.standardFlash : heroSet.standard;
      ctx.drawImage(
        img,
        stdFrame * HERO_STD_FRAME_W,
        0,
        HERO_STD_FRAME_W,
        HERO_STD_FRAME_H,
        -(HERO_STD_FRAME_W >> 1),
        -HERO_STD_FRAME_H + 3,
        HERO_STD_FRAME_W,
        HERO_STD_FRAME_H,
      );
    }
    ctx.restore();
    return false;
  }

  private renderHeroActionBackFx(
    ctx: CanvasRenderingContext2D,
    hero: HeroState,
    footX: number,
    footY: number,
    centerY: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const pal = HERO_FORM_PALETTES[hero.form];
    const act = hero.action;
    const f4 = ((timeSec * 16) | 0) & 3;

    if (act === 'fire_dash') {
      const fxImg = customPack ? customPack.getSprite('fx/fire_blast') : null;
      if (isDrawable(fxImg)) {
        resolveCustomFrame(customPack, 'fx/fire_blast', fxImg, timeSec, 16, true, this.slice);
        const dw = this.slice.hasManifestRect ? this.slice.sw : 48;
        const dh = this.slice.hasManifestRect ? this.slice.sh : 40;
        ctx.save();
        ctx.translate(footX - hero.facing * 10, centerY);
        if (hero.facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(
          fxImg,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          -(dw >> 1),
          -(dh >> 1),
          dw,
          dh,
        );
        ctx.restore();
      } else {
        const built = atlas.fx.get('fire_blast');
        if (built) {
          ctx.drawImage(built, f4 * 48, 0, 48, 48, footX - hero.facing * 12 - 24, centerY - 24, 48, 48);
        }
      }
      return;
    }

    if (act === 'volt_dive' || act === 'volt_blink') {
      const fxImg = customPack ? customPack.getSprite('fx/volt_arc') : null;
      if (isDrawable(fxImg)) {
        resolveCustomFrame(customPack, 'fx/volt_arc', fxImg, timeSec, 20, true, this.slice);
        const dw = this.slice.hasManifestRect ? this.slice.sw : 48;
        const dh = this.slice.hasManifestRect ? this.slice.sh : 32;
        ctx.save();
        ctx.translate(footX - hero.facing * 8, centerY);
        if (hero.facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(
          fxImg,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          -(dw >> 1),
          -(dh >> 1),
          dw,
          dh,
        );
        ctx.restore();
      } else {
        const built = atlas.fx.get('volt_arc');
        if (built) {
          ctx.drawImage(built, f4 * 48, 0, 48, 32, footX - 24, centerY - 16, 48, 32);
        }
      }
      return;
    }

    if (act === 'shadow_blink') {
      const fxImg = customPack ? customPack.getSprite('fx/evil_stomp') : null;
      if (isDrawable(fxImg)) {
        resolveCustomFrame(customPack, 'fx/evil_stomp', fxImg, timeSec, 18, true, this.slice);
        const dw = this.slice.hasManifestRect ? this.slice.sw : 48;
        const dh = this.slice.hasManifestRect ? this.slice.sh : 36;
        ctx.drawImage(
          fxImg,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          footX - (dw >> 1),
          centerY - (dh >> 1),
          dw,
          dh,
        );
      } else {
        const built = atlas.fx.get('shadow_slash');
        if (built) {
          ctx.save();
          ctx.translate(footX - hero.facing * 10, centerY);
          if (hero.facing < 0) ctx.scale(-1, 1);
          ctx.drawImage(built, f4 * 48, 0, 48, 32, -24, -16, 48, 32);
          ctx.restore();
        }
      }
      return;
    }

    if (act === 'ground_dash' || act === 'wall_dash') {
      const dir = -hero.facing;
      for (let s = 0; s < 3; s++) {
        const len = 14 + s * 6;
        const sy = centerY - 6 + s * 6;
        const sx = dir > 0 ? footX + 8 : footX - 8 - len;
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(sx - 1, sy - 1, len + 2, 4);
        ctx.fillStyle = s === 1 ? HIGHLIGHT_CREAM : pal[4];
        ctx.fillRect(sx, sy, len, 2);
      }
    } else if (act === 'air_stomp') {
      const pulse = ((timeSec * 20) | 0) & 3;
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(footX - 13, centerY - 26 + pulse, 4, 18);
      ctx.fillRect(footX + 9, centerY - 26 + pulse, 4, 18);
      ctx.fillStyle = pal[4];
      ctx.fillRect(footX - 12, centerY - 25 + pulse, 2, 16);
      ctx.fillRect(footX + 10, centerY - 25 + pulse, 2, 16);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(footX - 1, footY - 40, 2, 14);
    }
  }

  /**
   * Renders Krunk's signature elastic TONGUE & STOMP foreground visuals (P0!):
   * Directly driven by `HeroState.tongueKind`, `tongueTimer`, `tongueDuration`, `tongueOriginX/Y`, `tongueDirX/Y`!
   * Supports Ground Stomp (downward tongue launch), Air Stomp (downward anvil slam),
   * Ground Dash (elastic floor push-off), and Wall Dash (wall kick-off tongue snap)!
   */
  private renderHeroTongueAndStompOverlay(
    ctx: CanvasRenderingContext2D,
    hero: HeroState,
    camX: number,
    camY: number,
    footX: number,
    footY: number,
    centerY: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
    hasNativeOriginClip: boolean,
  ): void {
    const tPal = TONGUE_PALETTES[hero.form];
    const mouthX = footX + hero.facing * 5;
    const mouthY = centerY + 3;

    // 1. Authoritative sim-driven tongue extension (`tongueKind` + `tongueTimer`)
    if (hero.tongueKind !== 'none' && hero.tongueTimer > 0 && hero.tongueDuration > 0) {
      const prog = Math.max(0, Math.min(1, 1 - hero.tongueTimer / hero.tongueDuration));
      const origX = Math.round((hero.tongueOriginX - camX) * PPU + HALF_W);
      const origY = Math.round((camY - hero.tongueOriginY) * PPU + HALF_H);

      if (hero.tongueKind === 'ground_stomp') {
        // Elastic tongue slamming downward from Krunk's mouth straight into the floor anchor!
        const snap = Math.max(0, 1 - prog * 1.35);
        if (snap > 0.05) {
          const tipX = Math.round(footX + Math.max(-24, Math.min(24, (origX - footX) * snap)));
          const tipY = Math.round(footY + Math.min(64, Math.max(8, (origY - footY) * snap)));
          this.drawElasticPixelTongue(ctx, footX, mouthY, tipX, tipY, tPal, 8);
        }
        return;
      }

      if (hero.tongueKind === 'ground_dash' || hero.tongueKind === 'wall_dash') {
        // Elastic propulsion tongue stretching between Krunk and launch anchor during initial snap!
        const snap = Math.max(0, 1 - prog * 1.45);
        if (snap > 0.08) {
          const distToAnchor = Math.hypot(origX - mouthX, origY - mouthY);
          if (distToAnchor >= 6 && distToAnchor <= 72) {
            const tipX = Math.round(mouthX + (origX - mouthX) * snap);
            const tipY = Math.round(mouthY + (origY - mouthY) * snap);
            this.drawElasticPixelTongue(ctx, mouthX, mouthY, tipX, tipY, tPal, 6);
          } else {
            const reach = Math.round(14 + Math.sin(snap * Math.PI * 0.5) * 24);
            const dirX = hero.tongueDirX !== 0 ? hero.tongueDirX : hero.facing;
            const dirY = hero.tongueDirY;
            this.drawElasticPixelTongue(
              ctx,
              mouthX,
              mouthY,
              Math.round(mouthX + dirX * reach),
              Math.round(mouthY - dirY * reach),
              tPal,
              6,
            );
          }
        }
        return;
      }

      if (hero.tongueKind === 'air_stomp') {
        // Origin 48x48 `air_stomp` clip already shows Krunk's downward tongue-slam;
        // `Particles.ts` fires the one-shot `fx/stomp_ring` / `fx/evil_stomp` on impact!
        if (!hasNativeOriginClip) {
          const slamStretch = 14 + Math.round(Math.sin(timeSec * 28) * 2);
          const tipY = footY + slamStretch - 6;
          this.drawElasticPixelTongue(ctx, footX, centerY + 4, footX, tipY, tPal, 8);
          ctx.fillStyle = OUTLINE_DARK;
          ctx.fillRect(footX - 15, tipY + 3, 30, 5);
          ctx.fillStyle = tPal.glow;
          ctx.fillRect(footX - 14, tipY + 4, 28, 3);
          ctx.fillStyle = HIGHLIGHT_CREAM;
          ctx.fillRect(footX - 9, tipY + 5, 18, 1);
        }
        return;
      }
    }

    // 2. Fallback action-state visuals when `tongueTimer` has expired or during continuous `air_stomp`
    if (hero.action === 'air_stomp' || hero.action === 'ground_stomp') {
      if (!hasNativeOriginClip) {
        const slamStretch = 14 + Math.round(Math.sin(timeSec * 28) * 2);
        const tipY = footY + slamStretch - 6;
        this.drawElasticPixelTongue(ctx, footX, centerY + 4, footX, tipY, tPal, 8);
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(footX - 15, tipY + 3, 30, 5);
        ctx.fillStyle = tPal.glow;
        ctx.fillRect(footX - 14, tipY + 4, 28, 3);
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(footX - 9, tipY + 5, 18, 1);
      }
      return;
    }

    if (hero.action === 'ground_dash' || hero.action === 'wall_dash') {
      const dur = hero.action === 'ground_dash' ? 0.55 : 0.5;
      const rem = hero.action === 'ground_dash' ? hero.groundDashTimer : hero.wallDashTimer;
      const prog = Math.max(0, Math.min(1, rem / dur));
      if (prog > 0.2 && !hasNativeOriginClip) {
        const reach = Math.round(14 + Math.sin(prog * Math.PI) * 24);
        const tipX = mouthX + hero.facing * reach;
        const tipY = mouthY + (hero.action === 'ground_dash' ? 1 : -2);
        this.drawElasticPixelTongue(ctx, mouthX, mouthY, tipX, tipY, tPal, 6);

        if (prog > 0.65) {
          const spark = customPack ? customPack.getSprite('fx/stomp_hit') : null;
          if (isDrawable(spark)) {
            resolveCustomFrame(customPack, 'fx/stomp_hit', spark, timeSec, 18, true, this.slice);
            const dw = this.slice.hasManifestRect ? this.slice.sw : 28;
            const dh = this.slice.hasManifestRect ? this.slice.sh : 28;
            ctx.drawImage(
              spark,
              this.slice.sx,
              this.slice.sy,
              this.slice.sw,
              this.slice.sh,
              tipX - (dw >> 1),
              tipY - (dh >> 1),
              dw,
              dh,
            );
          } else {
            const builtSpark = atlas.fx.get('tongue_impact');
            if (builtSpark) {
              const sf = ((timeSec * 18) | 0) & 3;
              ctx.drawImage(builtSpark, sf * 32, 0, 32, 32, tipX - 14, tipY - 14, 28, 28);
            }
          }
        }
      }
    }
  }

  /** Draws a chunky, 1px-outlined, specular-shaded 16-bit elastic pixel tongue from (x0,y0) to (x1,y1). */
  private drawElasticPixelTongue(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    pal: TonguePalette,
    thickness: number,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) return;

    const steps = Math.max(4, Math.min(28, Math.round(dist / 2)));
    const half = thickness >> 1;

    ctx.fillStyle = OUTLINE_DARK;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px - half - 1, py - half - 1, thickness + 2, thickness + 2);
    }
    const tipR = half + 2;
    ctx.fillRect(x1 - tipR - 1, y1 - tipR, (tipR + 1) * 2, tipR * 2);
    ctx.fillRect(x1 - tipR, y1 - tipR - 1, tipR * 2, (tipR + 1) * 2);

    ctx.fillStyle = pal.dark;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px - half, py - half + 1, thickness, thickness - 1);
    }
    ctx.fillRect(x1 - tipR, y1 - tipR + 1, tipR * 2, tipR * 2 - 1);

    ctx.fillStyle = pal.mid;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px - half, py - half, thickness, Math.max(2, thickness - 1));
    }
    ctx.fillRect(x1 - tipR, y1 - tipR, tipR * 2, Math.max(3, tipR * 2 - 2));

    ctx.fillStyle = pal.hi;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px - half + 1, py - half, Math.max(1, thickness - 2), 2);
    }
    ctx.fillStyle = HIGHLIGHT_CREAM;
    ctx.fillRect(x1 - tipR + 2, y1 - tipR + 1, Math.max(2, tipR), 2);
  }

  private renderProjectiles(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const f2 = ((timeSec * 12) | 0) & 1;
    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i]!;
      const wx = p.prevX + (p.x - p.prevX) * alpha;
      const wy = p.prevY + (p.y - p.prevY) * alpha;
      const sx = Math.round((wx - camX) * PPU + HALF_W);
      const sy = Math.round((camY - wy) * PPU + HALF_H);
      if (sx < -24 || sx > VIEWPORT_W + 24 || sy < -24 || sy > VIEWPORT_H + 24) continue;

      const customKey = getProjectileCustomKey(p.kind);
      const customProj = customPack ? customPack.getSprite(customKey) : null;
      if (isDrawable(customProj)) {
        resolveCustomFrame(customPack, customKey, customProj, timeSec + i * 0.13, 12, true, this.slice);
        const maxProjDim = p.kind === 'fire_wave' ? 30 : 28;
        let dw = this.slice.sw;
        let dh = this.slice.sh;
        if (dw > maxProjDim || dh > maxProjDim) {
          const s = maxProjDim / Math.max(dw, dh);
          dw = Math.max(10, Math.round(dw * s));
          dh = Math.max(10, Math.round(dh * s));
        }
        if (p.vx < -0.1) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(-1, 1);
          ctx.drawImage(
            customProj,
            this.slice.sx,
            this.slice.sy,
            this.slice.sw,
            this.slice.sh,
            -(dw >> 1),
            -(dh >> 1),
            dw,
            dh,
          );
          ctx.restore();
        } else {
          ctx.drawImage(
            customProj,
            this.slice.sx,
            this.slice.sy,
            this.slice.sw,
            this.slice.sh,
            sx - (dw >> 1),
            sy - (dh >> 1),
            dw,
            dh,
          );
        }
        continue;
      }

      const spr = atlas.projectiles.get(p.kind) ?? (p.kind === 'fire_wave' ? atlas.projectiles.get('fireball') : undefined);
      if (spr) {
        if (p.kind === 'fire_wave' && p.vx < 0) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(-1, 1);
          ctx.drawImage(spr, f2 * 16, 0, 16, 16, -8, -8, 16, 16);
          ctx.restore();
        } else {
          ctx.drawImage(spr, f2 * 16, 0, 16, 16, sx - 8, sy - 8, 16, 16);
        }
      }
    }
  }

  private selectHeroStdFrame(hero: HeroState, timeSec: number): HeroStdFrame {
    const t = hero.animTimer > 0 ? hero.animTimer : timeSec;
    switch (hero.action) {
      case 'idle':
        return (((t * 3.2) | 0) & 1) === 0 ? HeroStdFrame.Idle0 : HeroStdFrame.Idle1;
      case 'run': {
        const step = ((t * 11) | 0) & 3;
        return (HeroStdFrame.Run0 + step) as HeroStdFrame;
      }
      case 'jump':
      case 'flip':
        return HeroStdFrame.Jump;
      case 'fall':
        return HeroStdFrame.Fall;
      case 'wall_slide':
        return HeroStdFrame.WallSlide;
      case 'vine_slide':
        return HeroStdFrame.VineSlide;
      case 'ground_stomp':
      case 'ground_dash':
      case 'wall_dash':
      case 'fire_dash':
      case 'volt_dive':
      case 'volt_blink':
      case 'shadow_blink':
        return HeroStdFrame.Dash;
      case 'hurt':
      case 'dead':
        return HeroStdFrame.Hurt;
      default:
        return HeroStdFrame.Idle0;
    }
  }

  private selectHeroActFrame(hero: HeroState, timeSec: number): HeroActFrame {
    const f = ((timeSec * 12) | 0) & 1;
    if (hero.action === 'air_stomp' || hero.action === 'ground_stomp') {
      return f === 0 ? HeroActFrame.Stomp0 : HeroActFrame.Stomp1;
    }
    if (hero.action === 'rock_uppercut') {
      return f === 0 ? HeroActFrame.Uppercut0 : HeroActFrame.Uppercut1;
    }
    if (hero.action === 'leaf_glide') {
      return f === 0 ? HeroActFrame.Glide0 : HeroActFrame.Glide1;
    }
    if (hero.action === 'volt_dive') {
      return HeroActFrame.Dive0;
    }
    if (hero.action === 'volt_blink' || hero.action === 'shadow_blink') {
      return HeroActFrame.Blink0;
    }
    return f === 0 ? HeroActFrame.Tongue0 : HeroActFrame.Tongue1;
  }

  private drawPixelBeam(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(4, Math.min(80, Math.round(Math.hypot(dx, dy) / 5)));
    ctx.fillStyle = OUTLINE_DARK;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px - 2, py - 2, 5, 5);
    }
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
    ctx.fillStyle = HIGHLIGHT_CREAM;
    for (let i = 0; i <= steps; i += 2) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px, py, 1, 1);
    }
  }
}
