/**
 * Krunked Quest — Procedural 16-Bit Pixel-Art Sprite Atlas
 * Pre-bakes crisp nearest-neighbor spritesheets at boot onto offscreen HTMLCanvasElements.
 * Handles headless/Node environments gracefully (no DOM dependency until bake()).
 * Zero third-party proper nouns.
 */

import {
  BIOME_IDS,
  HERO_FORMS,
  type BiomeId,
  type BossId,
  type EnemyArchetypeId,
  type HeroFormId,
  type ProjectileRuntime,
  type ShopId,
} from '../contracts/index.js';
import {
  BIOME_PALETTES,
  FLASH_WHITE,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
  hexToAbgr,
  mixHex,
  type BiomePalette,
} from './palettes.js';

export const HERO_STD_FRAME_W = 36;
export const HERO_STD_FRAME_H = 36;
export const HERO_STD_FRAME_COUNT = 12;

export const HERO_ACT_FRAME_W = 48;
export const HERO_ACT_FRAME_H = 48;
export const HERO_ACT_FRAME_COUNT = 6;

export const enum HeroStdFrame {
  Idle0 = 0,
  Idle1 = 1,
  Run0 = 2,
  Run1 = 3,
  Run2 = 4,
  Run3 = 5,
  Jump = 6,
  Fall = 7,
  WallSlide = 8,
  Dash = 9,
  Hurt = 10,
  VineSlide = 11,
}

export const enum HeroActFrame {
  Stomp0 = 0,
  Stomp1 = 1,
  Uppercut0 = 2,
  Uppercut1 = 3,
  Glide0 = 4,
  Glide1 = 5,
}

export interface HeroSpriteSet {
  readonly standard: HTMLCanvasElement;
  readonly standardFlash: HTMLCanvasElement;
  readonly action: HTMLCanvasElement;
  readonly actionFlash: HTMLCanvasElement;
}

export interface EnemySpriteSet {
  readonly sheet: HTMLCanvasElement;
  readonly flash: HTMLCanvasElement;
  readonly frameW: number;
  readonly frameH: number;
}

export interface BossSpriteSet {
  readonly sheet: HTMLCanvasElement;
  readonly flash: HTMLCanvasElement;
  readonly frameW: number;
  readonly frameH: number;
}

export interface BiomeParallaxSet {
  readonly sky: HTMLCanvasElement;
  readonly far: HTMLCanvasElement;
  readonly mid: HTMLCanvasElement;
  readonly near: HTMLCanvasElement;
}

// ============================================================================
// Integer Pixel Buffer Helper (Zero anti-aliasing, crisp 1px outlines)
// ============================================================================

class PixelBuf {
  public readonly w: number;
  public readonly h: number;
  public readonly pixels: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.pixels = new Uint32Array(w * h);
  }

  public clear(): void {
    this.pixels.fill(0);
  }

  public px(x: number, y: number, col: number): void {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    this.pixels[iy * this.w + ix] = col;
  }

  public get(x: number, y: number): number {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return 0;
    return this.pixels[iy * this.w + ix]!;
  }

  public rect(x: number, y: number, w: number, h: number, col: number): void {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0);
    const y1 = Math.min(this.h, (y + h) | 0);
    for (let py = y0; py < y1; py++) {
      const row = py * this.w;
      for (let px = x0; px < x1; px++) {
        this.pixels[row + px] = col;
      }
    }
  }

  public ditherRect(
    x: number,
    y: number,
    w: number,
    h: number,
    colA: number,
    colB: number,
    density = 1,
  ): void {
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0);
    const y1 = Math.min(this.h, (y + h) | 0);
    for (let py = y0; py < y1; py++) {
      const row = py * this.w;
      for (let px = x0; px < x1; px++) {
        const useB =
          density === 1
            ? ((px + py) & 1) === 0
            : density === 2
              ? (px & 1) === 0 && (py & 1) === 0
              : ((px + py) & 1) === 0 || (py & 1) === 0;
        this.pixels[row + px] = useB ? colB : colA;
      }
    }
  }

  public ellipse(cx: number, cy: number, rx: number, ry: number, col: number): void {
    if (rx <= 0 || ry <= 0) return;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    const invRx2 = 1 / (rx * rx);
    const invRy2 = 1 / (ry * ry);
    for (let py = y0; py <= y1; py++) {
      const dy = py - cy;
      const dy2 = dy * dy * invRy2;
      const row = py * this.w;
      for (let px = x0; px <= x1; px++) {
        const dx = px - cx;
        if (dx * dx * invRx2 + dy2 <= 1.0) {
          this.pixels[row + px] = col;
        }
      }
    }
  }

  public ellipseShaded(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    light: number,
    mid: number,
    dark: number,
    spec?: number,
  ): void {
    if (rx <= 0 || ry <= 0) return;
    const x0 = Math.max(0, Math.floor(cx - rx));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    const invRx2 = 1 / (rx * rx);
    const invRy2 = 1 / (ry * ry);
    for (let py = y0; py <= y1; py++) {
      const dy = (py - cy) / ry;
      const dy2 = (py - cy) * (py - cy) * invRy2;
      const row = py * this.w;
      for (let px = x0; px <= x1; px++) {
        const dx = (px - cx) / rx;
        if ((px - cx) * (px - cx) * invRx2 + dy2 <= 1.0) {
          const shade = dx * 0.45 + dy * 0.72;
          let c = mid;
          if (spec !== undefined && dx > -0.62 && dx < -0.15 && dy > -0.72 && dy < -0.28) {
            c = spec;
          } else if (shade < -0.18) {
            c = light;
          } else if (shade > 0.34) {
            c = dark;
          }
          this.pixels[row + px] = c;
        }
      }
    }
  }

  public line(x0: number, y0: number, x1: number, y1: number, col: number): void {
    let ix0 = x0 | 0;
    let iy0 = y0 | 0;
    const ix1 = x1 | 0;
    const iy1 = y1 | 0;
    const dx = Math.abs(ix1 - ix0);
    const dy = -Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(ix0, iy0, col);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = err * 2;
      if (e2 >= dy) {
        err += dy;
        ix0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        iy0 += sy;
      }
    }
  }

  public tri(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    col: number,
  ): void {
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1, y2)));
    const area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
    if (area === 0) return;
    const sgn = area > 0 ? 1 : -1;
    for (let py = minY; py <= maxY; py++) {
      const row = py * this.w;
      for (let px = minX; px <= maxX; px++) {
        const w0 = ((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)) * sgn;
        const w1 = ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)) * sgn;
        const w2 = ((x0 - x2) * (py - y2) - (y0 - y2) * (px - x2)) * sgn;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
          this.pixels[row + px] = col;
        }
      }
    }
  }

  /** Crisp 1px 4-connected dark outline around all opaque pixels. */
  public outline(outlineCol: number): void {
    const src = new Uint32Array(this.pixels);
    const w = this.w;
    const h = this.h;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (src[row + x] !== 0) continue;
        const hasN =
          (x > 0 && src[row + x - 1] !== 0) ||
          (x + 1 < w && src[row + x + 1] !== 0) ||
          (y > 0 && src[row - w + x] !== 0) ||
          (y + 1 < h && src[row + w + x] !== 0);
        if (hasN) {
          this.pixels[row + x] = outlineCol;
        }
      }
    }
  }

  /** Blit another PixelBuf onto this one at (dx, dy), ignoring transparent pixels. */
  public blit(src: PixelBuf, dx: number, dy: number): void {
    for (let sy = 0; sy < src.h; sy++) {
      const ty = dy + sy;
      if (ty < 0 || ty >= this.h) continue;
      const sRow = sy * src.w;
      const dRow = ty * this.w;
      for (let sx = 0; sx < src.w; sx++) {
        const tx = dx + sx;
        if (tx < 0 || tx >= this.w) continue;
        const c = src.pixels[sRow + sx]!;
        if (c !== 0) {
          this.pixels[dRow + tx] = c;
        }
      }
    }
  }

  public toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.pixels);
      ctx.putImageData(img, 0, 0);
    }
    return canvas;
  }

  public toWhiteFlashCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(this.w, this.h);
      const dst = new Uint32Array(img.data.buffer);
      const white = hexToAbgr(FLASH_WHITE);
      for (let i = 0; i < this.pixels.length; i++) {
        if ((this.pixels[i]! >>> 24) > 32) {
          dst[i] = white;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    return canvas;
  }
}

function hash2d(x: number, y: number, seed = 0): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n ^ (n >>> 16)) >>> 0;
}

// ============================================================================
// Hero Baking (All 6 Elemental Forms: 36x36 Standard + 48x48 Action)
// ============================================================================

function drawHeroCrest(
  b: PixelBuf,
  form: HeroFormId,
  cx: number,
  topY: number,
  p: readonly number[],
  phase: number,
): void {
  const c0 = p[0]!;
  const c2 = p[2]!;
  const c4 = p[4]!;
  const c5 = p[5]!;

  if (form === 'krunk_basic') {
    // Twin curved cute cream horns
    b.tri(cx - 7, topY + 2, cx - 10, topY - 4, cx - 3, topY + 1, c4);
    b.px(cx - 9, topY - 3, hexToAbgr(HIGHLIGHT_CREAM));
    b.tri(cx + 5, topY + 2, cx + 10, topY - 4, cx + 2, topY + 1, c4);
    b.px(cx + 8, topY - 3, hexToAbgr(HIGHLIGHT_CREAM));
  } else if (form === 'krunk_fire') {
    // Blazing jagged flame hair crest
    const sway = phase % 2 === 0 ? -1 : 1;
    b.tri(cx - 8, topY + 3, cx - 6 + sway, topY - 6, cx - 1, topY + 2, c2);
    b.tri(cx - 3, topY + 2, cx + 1 + sway, topY - 8, cx + 5, topY + 2, c0);
    b.tri(cx + 2, topY + 3, cx + 8 + sway, topY - 5, cx + 9, topY + 3, c2);
    b.tri(cx - 2, topY + 2, cx + 1, topY - 4, cx + 4, topY + 2, c4);
  } else if (form === 'krunk_leaf') {
    // Sprouting twin leaf crown + stem
    b.line(cx, topY + 2, cx, topY - 3, c2);
    b.ellipse(cx - 5, topY - 3, 5, 2.5, c0);
    b.ellipse(cx + 5, topY - 3, 5, 2.5, c0);
    b.line(cx - 7, topY - 3, cx - 2, topY - 3, c4);
    b.line(cx + 2, topY - 3, cx + 7, topY - 3, c4);
  } else if (form === 'krunk_rock') {
    // Armored golden stone crown + violet gem
    b.rect(cx - 8, topY - 2, 16, 4, c0);
    b.rect(cx - 6, topY - 5, 4, 4, c4);
    b.rect(cx + 2, topY - 5, 4, 4, c4);
    b.rect(cx - 2, topY - 4, 4, 4, c5);
    b.px(cx - 1, topY - 3, hexToAbgr(HIGHLIGHT_CREAM));
  } else if (form === 'krunk_electric') {
    // Spiky lightning-bolt crest
    const z = phase % 2 === 0 ? 0 : 1;
    b.tri(cx - 9, topY + 1, cx - 11, topY - 6 + z, cx - 3, topY, c0);
    b.tri(cx - 2, topY + 1, cx + 2, topY - 8, cx + 4, topY + 1, c4);
    b.tri(cx + 3, topY + 1, cx + 11, topY - 6 - z, cx + 8, topY + 2, c0);
  } else {
    // Shadow: twin spectral crown horns + neon emerald core
    b.tri(cx - 8, topY + 2, cx - 11, topY - 6, cx - 3, topY + 1, c1Or(p));
    b.tri(cx + 8, topY + 2, cx + 11, topY - 6, cx + 3, topY + 1, c1Or(p));
    b.ellipse(cx, topY - 3, 2.5, 2.5, c4);
  }
}

function c1Or(p: readonly number[]): number {
  return p[2]!;
}

function drawHeroCapeOrBack(
  b: PixelBuf,
  form: HeroFormId,
  cx: number,
  cy: number,
  p: readonly number[],
  flutter: number,
): void {
  const c2 = p[2]!;
  const c3 = p[3]!;
  const c4 = p[4]!;
  if (form === 'krunk_leaf') {
    b.tri(cx - 6, cy - 3, cx - 15, cy + 4 + flutter, cx - 4, cy + 7, c2);
    b.tri(cx - 6, cy - 2, cx - 13, cy + 3 + flutter, cx - 5, cy + 5, p[0]!);
  } else if (form === 'krunk_fire') {
    b.tri(cx - 7, cy - 1, cx - 15, cy + 2 + flutter, cx - 6, cy + 5, c2);
    b.tri(cx - 7, cy, cx - 13, cy + 1 + flutter, cx - 6, cy + 3, c4);
  } else if (form === 'krunk_electric') {
    // Crackling lightning tail zig-zag
    b.line(cx - 8, cy + 2, cx - 13, cy - 1 + flutter, c4);
    b.line(cx - 13, cy - 1 + flutter, cx - 11, cy + 3 + flutter, p[0]!);
    b.line(cx - 11, cy + 3 + flutter, cx - 15, cy + 2 + flutter, c4);
  } else if (form === 'krunk_shadow') {
    b.tri(cx - 6, cy - 3, cx - 15, cy + 5 + flutter, cx - 3, cy + 8, p[1]!);
    b.line(cx - 14, cy + 4 + flutter, cx - 8, cy + 6, c2);
  } else {
    // Classic flowing crimson scarf / rock cloak tail
    b.tri(cx - 6, cy + 1, cx - 14, cy + 3 + flutter, cx - 6, cy + 6, c3);
    b.line(cx - 13, cy + 3 + flutter, cx - 7, cy + 2, c4);
  }
}

function drawHeroFace(
  b: PixelBuf,
  form: HeroFormId,
  cx: number,
  cy: number,
  p: readonly number[],
  mood: 'normal' | 'happy' | 'fierce' | 'hurt',
): void {
  const white = hexToAbgr(HIGHLIGHT_CREAM);
  const dark = hexToAbgr(OUTLINE_DARK);
  const eyeGlow = form === 'krunk_shadow' ? p[2]! : form === 'krunk_electric' ? p[4]! : white;
  const pupilCol = form === 'krunk_shadow' ? p[4]! : dark;

  if (mood === 'hurt') {
    // > < squint eyes
    b.line(cx - 4, cy - 3, cx - 2, cy - 1, dark);
    b.line(cx - 4, cy + 1, cx - 2, cy - 1, dark);
    b.line(cx + 6, cy - 3, cx + 4, cy - 1, dark);
    b.line(cx + 6, cy + 1, cx + 4, cy - 1, dark);
    b.ellipse(cx + 1, cy + 3, 2, 1.5, dark);
    return;
  }

  // Expressive large pixel eyes (offset slightly forward to face right)
  // Left eye
  b.rect(cx - 4, cy - 4, 4, 5, eyeGlow);
  b.rect(cx - 2, cy - 3, 2, 4, pupilCol);
  b.px(cx - 3, cy - 3, white);
  // Right eye
  b.rect(cx + 3, cy - 4, 4, 5, eyeGlow);
  b.rect(cx + 5, cy - 3, 2, 4, pupilCol);
  b.px(cx + 4, cy - 3, white);

  if (mood === 'fierce') {
    // Angled heroic brows
    b.line(cx - 4, cy - 5, cx, cy - 3, dark);
    b.line(cx + 3, cy - 3, cx + 7, cy - 5, dark);
  }

  // Glowing rosy cheeks
  const cheek = form === 'krunk_shadow' ? p[3]! : p[3]!;
  b.rect(cx - 6, cy + 1, 2, 2, cheek);
  b.rect(cx + 7, cy + 1, 2, 2, cheek);

  // Cute grin / heroic mouth
  if (mood === 'happy') {
    b.line(cx, cy + 2, cx + 3, cy + 2, dark);
    b.px(cx + 1, cy + 3, p[3]!);
    b.px(cx + 2, cy + 3, p[3]!);
  } else {
    b.line(cx, cy + 2, cx + 3, cy + 2, dark);
  }
}

function bakeHeroForm(form: HeroFormId): HeroSpriteSet {
  const palHex = HERO_FORM_PALETTES[form];
  const p = [
    hexToAbgr(palHex[0]),
    hexToAbgr(palHex[1]),
    hexToAbgr(palHex[2]),
    hexToAbgr(palHex[3]),
    hexToAbgr(palHex[4]),
    hexToAbgr(palHex[5]),
  ];
  const outlineCol = hexToAbgr(OUTLINE_DARK);
  const isShadow = form === 'krunk_shadow';
  const bodyLight = isShadow ? p[1]! : p[0]!;
  const bodyMid = isShadow ? p[0]! : p[1]!;
  const bodyDark = isShadow ? p[3]! : p[2]!;
  const specCol = hexToAbgr(mixHex(isShadow ? palHex[5] : palHex[0], HIGHLIGHT_CREAM, 0.5));
  const bootCol = p[5]!;
  const bootLight = hexToAbgr(mixHex(palHex[5], HIGHLIGHT_CREAM, 0.35));

  // 1) Standard 12-frame 36x36 sheet
  const stdSheet = new PixelBuf(HERO_STD_FRAME_W * HERO_STD_FRAME_COUNT, HERO_STD_FRAME_H);
  const frameBuf = new PixelBuf(HERO_STD_FRAME_W, HERO_STD_FRAME_H);

  for (let f = 0; f < HERO_STD_FRAME_COUNT; f++) {
    frameBuf.clear();
    const cx = 18;
    let cy = 20;
    let rx = 9.5;
    let ry = 9.0;
    let legLdx = -4;
    let legLdy = 9;
    let legRdx = 4;
    let legRdy = 9;
    let armFdx = 9;
    let armFdy = 1;
    let flutter = 0;
    let mood: 'normal' | 'happy' | 'fierce' | 'hurt' = 'happy';

    switch (f as HeroStdFrame) {
      case HeroStdFrame.Idle0:
        cy = 20;
        flutter = 0;
        break;
      case HeroStdFrame.Idle1:
        cy = 21;
        rx = 10.0;
        ry = 8.4;
        flutter = 1;
        break;
      case HeroStdFrame.Run0:
        cy = 19;
        legLdx = -6;
        legLdy = 8;
        legRdx = 6;
        legRdy = 9;
        armFdx = 10;
        armFdy = 0;
        flutter = -1;
        mood = 'fierce';
        break;
      case HeroStdFrame.Run1:
        cy = 20;
        legLdx = -2;
        legLdy = 10;
        legRdx = 2;
        legRdy = 8;
        flutter = 1;
        mood = 'fierce';
        break;
      case HeroStdFrame.Run2:
        cy = 19;
        legLdx = 5;
        legLdy = 8;
        legRdx = -6;
        legRdy = 9;
        armFdx = 8;
        armFdy = 2;
        flutter = 0;
        mood = 'fierce';
        break;
      case HeroStdFrame.Run3:
        cy = 20;
        legLdx = -3;
        legLdy = 9;
        legRdx = 3;
        legRdy = 10;
        flutter = -1;
        mood = 'fierce';
        break;
      case HeroStdFrame.Jump:
        cy = 18;
        rx = 8.4;
        ry = 10.2;
        legLdx = -4;
        legLdy = 10;
        legRdx = 5;
        legRdy = 7;
        armFdx = 8;
        armFdy = -4;
        flutter = 2;
        mood = 'happy';
        break;
      case HeroStdFrame.Fall:
        cy = 19;
        rx = 9.4;
        ry = 9.2;
        legLdx = -5;
        legLdy = 8;
        legRdx = 5;
        legRdy = 8;
        armFdx = 9;
        armFdy = -5;
        flutter = -3;
        mood = 'normal';
        break;
      case HeroStdFrame.WallSlide:
        cy = 19;
        rx = 8.8;
        ry = 9.5;
        legLdx = -6;
        legLdy = 7;
        legRdx = 4;
        legRdy = 10;
        armFdx = -8;
        armFdy = -3;
        flutter = -2;
        mood = 'fierce';
        break;
      case HeroStdFrame.Dash:
        cy = 20;
        rx = 11.2;
        ry = 7.4;
        legLdx = -9;
        legLdy = 4;
        legRdx = -6;
        legRdy = 7;
        armFdx = 11;
        armFdy = -1;
        flutter = -1;
        mood = 'fierce';
        break;
      case HeroStdFrame.Hurt:
        cy = 20;
        rx = 9.2;
        ry = 8.8;
        legLdx = -6;
        legLdy = 7;
        legRdx = 6;
        legRdy = 7;
        armFdx = 9;
        armFdy = -4;
        flutter = -2;
        mood = 'hurt';
        break;
      case HeroStdFrame.VineSlide:
        cy = 21;
        rx = 9.4;
        ry = 8.8;
        legLdx = -4;
        legLdy = 9;
        legRdx = 5;
        legRdy = 8;
        armFdx = 4;
        armFdy = -8;
        flutter = 1;
        mood = 'fierce';
        break;
    }

    // Back cape/scarf
    drawHeroCapeOrBack(frameBuf, form, cx, cy, p, flutter);

    // Back boot
    frameBuf.ellipse(cx + legLdx, cy + legLdy, 3.6, 2.8, bootCol);
    frameBuf.px(cx + legLdx - 1, cy + legLdy - 1, bootLight);

    // Plump shaded body
    frameBuf.ellipseShaded(cx, cy, rx, ry, bodyLight, bodyMid, bodyDark, specCol);

    // Belly highlight patch
    frameBuf.ellipse(cx + 1, cy + 4, rx * 0.55, ry * 0.36, p[4]!);

    // Neck scarf collar (or rock chest rune / volt band)
    if (form === 'krunk_rock') {
      frameBuf.rect(cx - 2, cy + 3, 5, 4, p[5]!);
      frameBuf.px(cx, cy + 4, hexToAbgr(HIGHLIGHT_CREAM));
    } else if (form !== 'krunk_shadow') {
      frameBuf.rect(cx - 6, cy + 3, 13, 2, p[3]!);
    }

    // Front boot
    frameBuf.ellipse(cx + legRdx, cy + legRdy, 3.8, 2.9, bootCol);
    frameBuf.px(cx + legRdx, cy + legRdy - 1, bootLight);

    // Front arm / gauntlet (Rock form gets chunky boulder fists!)
    const armRad = form === 'krunk_rock' ? 4.2 : 2.8;
    frameBuf.ellipseShaded(
      cx + armFdx,
      cy + armFdy,
      armRad,
      armRad * 0.9,
      p[4]!,
      p[0]!,
      p[2]!,
    );

    // Head crest / horns / flame / leaves / lightning
    drawHeroCrest(frameBuf, form, cx, Math.round(cy - ry), p, f);

    // Face
    drawHeroFace(frameBuf, form, cx, cy - 1, p, mood);

    // Crisp 1px dark-plum outline
    frameBuf.outline(outlineCol);
    stdSheet.blit(frameBuf, f * HERO_STD_FRAME_W, 0);
  }

  // 2) Action 6-frame 48x48 sheet (Stomp Roll 0..1, Uppercut 2..3, Glide 4..5)
  const actSheet = new PixelBuf(HERO_ACT_FRAME_W * HERO_ACT_FRAME_COUNT, HERO_ACT_FRAME_H);
  const actBuf = new PixelBuf(HERO_ACT_FRAME_W, HERO_ACT_FRAME_H);

  for (let f = 0; f < HERO_ACT_FRAME_COUNT; f++) {
    actBuf.clear();
    const cx = 24;
    const cy = 26;

    if (f === HeroActFrame.Stomp0 || f === HeroActFrame.Stomp1) {
      // Spinning comet cannonball with blazing directional ring!
      const spin = f === HeroActFrame.Stomp0 ? 0 : 1;
      // Outer energy crescent above
      actBuf.ellipse(cx, cy - 3, 15, 16, p[4]!);
      actBuf.ellipse(cx, cy - 1, 13, 14, p[3]!);
      // Curled spinning body ball
      actBuf.ellipseShaded(cx, cy + 1, 11, 11, p[0]!, p[1]!, p[2]!, specCol);
      // Spinning speed-stripe band across sphere
      if (spin === 0) {
        actBuf.line(cx - 8, cy - 3, cx + 8, cy + 4, p[4]!);
        actBuf.line(cx - 7, cy - 2, cx + 7, cy + 5, hexToAbgr(HIGHLIGHT_CREAM));
      } else {
        actBuf.line(cx - 8, cy + 4, cx + 8, cy - 3, p[4]!);
        actBuf.line(cx - 7, cy + 5, cx + 7, cy - 2, hexToAbgr(HIGHLIGHT_CREAM));
      }
      // Small horns peeking out
      actBuf.tri(cx - 9, cy - 6, cx - 13, cy - 12, cx - 4, cy - 9, p[4]!);
      actBuf.tri(cx + 9, cy - 6, cx + 13, cy - 12, cx + 4, cy - 9, p[4]!);
    } else if (f === HeroActFrame.Uppercut0 || f === HeroActFrame.Uppercut1) {
      // Giant rising uppercut fist + heroic stretched Krunk!
      const boost = f === HeroActFrame.Uppercut1 ? -2 : 0;
      // Hero body lower
      actBuf.ellipseShaded(cx - 2, cy + 6, 8.5, 9.5, p[0]!, p[1]!, p[2]!, specCol);
      drawHeroFace(actBuf, form, cx - 2, cy + 4, p, 'fierce');
      actBuf.ellipse(cx - 6, cy + 16, 3.5, 2.5, bootCol);
      actBuf.ellipse(cx + 3, cy + 15, 3.5, 2.5, bootCol);
      // Giant glowing uppercut gauntlet thrusting skyward!
      const fy = 12 + boost;
      actBuf.ellipseShaded(cx + 4, fy, 11, 9.5, p[4]!, p[0]!, p[2]!, hexToAbgr(HIGHLIGHT_CREAM));
      // Knuckle ridges
      actBuf.rect(cx - 3, fy - 5, 4, 4, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.rect(cx + 2, fy - 6, 4, 4, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.rect(cx + 7, fy - 5, 4, 4, p[4]!);
      // Upward shockwave chevrons
      actBuf.line(cx - 7, fy - 8, cx + 4, fy - 11, p[4]!);
      actBuf.line(cx + 4, fy - 11, cx + 15, fy - 8, p[4]!);
    } else {
      // Unfurled billowing Leaf Cape / Elemental Wings glide!
      const flap = f === HeroActFrame.Glide0 ? -2 : 2;
      // Wide symmetric leafy/elemental wings
      actBuf.ellipseShaded(cx - 12, cy - 4 + flap, 11, 6, p[4]!, p[0]!, p[2]!);
      actBuf.ellipseShaded(cx + 12, cy - 4 + flap, 11, 6, p[4]!, p[0]!, p[2]!);
      // Leaf ribs
      actBuf.line(cx - 4, cy - 4 + flap, cx - 20, cy - 4 + flap, p[2]!);
      actBuf.line(cx + 4, cy - 4 + flap, cx + 20, cy - 4 + flap, p[2]!);
      // Hero hovering calmly in center
      actBuf.ellipseShaded(cx, cy + 2, 9, 8.5, p[0]!, p[1]!, p[2]!, specCol);
      actBuf.ellipse(cx - 4, cy + 11, 3.2, 2.5, bootCol);
      actBuf.ellipse(cx + 4, cy + 11, 3.2, 2.5, bootCol);
      drawHeroCrest(actBuf, form, cx, cy - 7, p, f);
      drawHeroFace(actBuf, form, cx, cy + 1, p, 'happy');
    }

    actBuf.outline(outlineCol);
    actSheet.blit(actBuf, f * HERO_ACT_FRAME_W, 0);
  }

  return {
    standard: stdSheet.toCanvas(),
    standardFlash: stdSheet.toWhiteFlashCanvas(),
    action: actSheet.toCanvas(),
    actionFlash: actSheet.toWhiteFlashCanvas(),
  };
}

// ============================================================================
// 16-Mask Autotiled Biome Tilesets (512x32) + Biome Top Deco (128x16)
// Bitmask: 1=UP, 2=RIGHT, 4=DOWN, 8=LEFT
// ============================================================================

function bakeBiomeTileset(pal: BiomePalette): HTMLCanvasElement {
  const sheet = new PixelBuf(32 * 16, 32);
  const cOutline = hexToAbgr(pal.outline);
  const cCapL = hexToAbgr(pal.capLight);
  const cCapM = hexToAbgr(pal.capMid);
  const cCapD = hexToAbgr(pal.capDark);
  const cEarL = hexToAbgr(pal.earthLight);
  const cEarM = hexToAbgr(pal.earthMid);
  const cEarD = hexToAbgr(pal.earthDark);
  const cEarDeep = hexToAbgr(pal.earthDeep);
  const cAcc = hexToAbgr(pal.accent);
  const cAccAlt = hexToAbgr(pal.accentAlt);
  const style = pal.style;

  for (let mask = 0; mask < 16; mask++) {
    const hasUp = (mask & 1) !== 0;
    const hasRight = (mask & 2) !== 0;
    const hasDown = (mask & 4) !== 0;
    const hasLeft = (mask & 8) !== 0;
    const ox = mask * 32;

    // 1. Interior biome texture
    for (let ly = 0; ly < 32; ly++) {
      for (let lx = 0; lx < 32; lx++) {
        let col = cEarM;
        const h = hash2d(lx + mask * 7, ly, 13);

        if (
          style === 'arcane_labyrinth' ||
          style === 'nightmare_spire' ||
          style === 'desert_sandstone'
        ) {
          // Carved stone brick masonry with mortar seams & top bevel
          const brickRow = (ly >> 3) & 3;
          const bx = (lx + (brickRow & 1 ? 8 : 0)) & 15;
          const by = ly & 7;
          if (by === 0 || bx === 0) {
            col = cEarDeep;
          } else if (by === 1 || bx === 1) {
            col = cEarL;
          } else if (by === 7 || bx === 15) {
            col = cEarD;
          } else {
            col = (h & 7) === 0 ? cEarD : (h & 15) === 1 ? cEarL : cEarM;
          }
          // Glowing embedded runes on labyrinth / evil / desert turquoise tiles
          if (style === 'nightmare_spire' && lx >= 13 && lx <= 18 && ly >= 13 && ly <= 18) {
            if (lx === 15 || ly === 15) col = cAccAlt;
          } else if (style === 'arcane_labyrinth' && (lx === 15 || lx === 16) && ly >= 12 && ly <= 19) {
            col = ly % 3 === 0 ? cAcc : cAccAlt;
          } else if (style === 'desert_sandstone' && lx >= 14 && lx <= 17 && ly >= 14 && ly <= 17) {
            col = cAcc;
          }
        } else if (style === 'atomic_temple') {
          // Tech alloy panel with glowing cyan circuit lines & golden rivets
          if (lx === 0 || ly === 0 || lx === 31 || ly === 31) {
            col = cEarDeep;
          } else if (lx === 1 || ly === 1) {
            col = cEarL;
          } else if ((lx === 8 && ly >= 8 && ly <= 24) || (ly === 16 && lx >= 8 && lx <= 24)) {
            col = cAccAlt;
          } else if (
            (lx === 4 || lx === 27) &&
            (ly === 4 || ly === 27)
          ) {
            col = cAcc;
          } else {
            col = ((lx + ly) & 3) === 0 ? cEarD : cEarM;
          }
        } else if (style === 'volcanic_basalt') {
          // Fractured basalt with glowing molten orange cracks
          const crack = Math.abs(((lx * 3 + ly * 2) % 19) - 9);
          if (crack === 0 && (ly > 9 || hasUp)) {
            col = (lx + ly) % 3 === 0 ? cAcc : cCapM;
          } else if (crack === 1) {
            col = cEarDeep;
          } else {
            col = (h & 3) === 0 ? cEarD : (h & 7) === 1 ? cEarL : cEarM;
          }
        } else if (style === 'ghost_timber') {
          // Horizontal ship deck planks with woodgrain & iron nails
          const py = ly & 7;
          if (py === 0) {
            col = cEarDeep;
          } else if (py === 1) {
            col = cEarL;
          } else if (py === 7) {
            col = cEarD;
          } else if ((lx === 4 || lx === 27) && (py === 3 || py === 4)) {
            col = cEarDeep;
          } else {
            col = ((lx + (ly >> 3) * 5) % 9 === 0) ? cEarD : cEarM;
          }
        } else {
          // Organic layered earth / cavern rock / primal bark with pebbles & Bayer dither
          const band = ly >> 3;
          if (band === 3 && !hasDown) {
            col = ((lx + ly) & 1) === 0 ? cEarDeep : cEarD;
          } else if (style === 'primal_bark') {
            // Vertical gnarled bark ridges
            const ridge = (lx + ((ly >> 2) & 1)) % 6;
            col = ridge === 0 ? cEarDeep : ridge === 1 ? cEarL : ridge === 5 ? cEarD : cEarM;
          } else {
            // Chunky layered pebbles + dithered strata
            const cellX = lx & 7;
            const cellY = (ly + ((lx >> 3) & 1) * 4) & 7;
            if (cellX >= 2 && cellX <= 5 && cellY >= 2 && cellY <= 4) {
              col = cellY === 2 ? cEarL : cEarM;
            } else if (cellX === 1 || cellY === 5) {
              col = cEarD;
            } else {
              col = (h & 7) === 0 ? cEarDeep : (h & 3) === 0 ? cEarD : cEarM;
            }
          }
        }

        sheet.px(ox + lx, ly, col);
      }
    }

    // 2. Lush biome TOP CAP when top is exposed (!hasUp)
    if (!hasUp) {
      for (let lx = 0; lx < 32; lx++) {
        // Organic wavy overhang depth (6..9px)
        const wave = ((lx * 5 + mask * 3) % 7 === 0 ? 2 : (lx % 4 === 0 ? 1 : 0));
        const capDepth =
          style === 'atomic_temple' || style === 'ghost_timber' ? 6 : 7 + wave;
        for (let ly = 1; ly < capDepth; ly++) {
          let c = cCapM;
          if (ly <= 2) {
            c = cCapL;
          } else if (ly >= capDepth - 2) {
            c = cCapD;
          } else if (((lx + ly) & 3) === 0) {
            c = cCapL;
          }
          sheet.px(ox + lx, ly, c);
        }
        // Crisp 1px shadow lip right under the overhang
        sheet.px(ox + lx, capDepth, cOutline);
        if (capDepth + 1 < 32) {
          sheet.px(ox + lx, capDepth + 1, cEarDeep);
        }
        // Top highlight sparkles / wildflowers / glowing moss dots
        if (lx > 3 && lx < 28 && lx % 9 === 4) {
          sheet.px(ox + lx, 3, cAcc);
          sheet.px(ox + lx + 1, 2, cAccAlt);
        }
      }
    }

    // 3. Exposed edge bevels & crisp 1px dark-plum outlines
    if (!hasUp) {
      for (let lx = 0; lx < 32; lx++) sheet.px(ox + lx, 0, cOutline);
    }
    if (!hasDown) {
      for (let lx = 0; lx < 32; lx++) {
        sheet.px(ox + lx, 30, cEarDeep);
        sheet.px(ox + lx, 31, cOutline);
      }
    }
    if (!hasLeft) {
      for (let ly = 0; ly < 32; ly++) {
        sheet.px(ox + 1, ly, ly < 7 && !hasUp ? cCapL : cEarL);
        sheet.px(ox, ly, cOutline);
      }
    }
    if (!hasRight) {
      for (let ly = 0; ly < 32; ly++) {
        sheet.px(ox + 30, ly, ly < 7 && !hasUp ? cCapD : cEarDeep);
        sheet.px(ox + 31, ly, cOutline);
      }
    }

    // 4. Rounded outer pixel corners when two adjacent sides are exposed
    if (!hasUp && !hasLeft) {
      sheet.px(ox, 0, 0);
      sheet.px(ox + 1, 1, cOutline);
    }
    if (!hasUp && !hasRight) {
      sheet.px(ox + 31, 0, 0);
      sheet.px(ox + 30, 1, cOutline);
    }
    if (!hasDown && !hasLeft) {
      sheet.px(ox, 31, 0);
      sheet.px(ox + 1, 30, cOutline);
    }
    if (!hasDown && !hasRight) {
      sheet.px(ox + 31, 31, 0);
      sheet.px(ox + 30, 30, cOutline);
    }
  }

  return sheet.toCanvas();
}

function bakeBiomeDeco(pal: BiomePalette): HTMLCanvasElement {
  // 8 tiny 16x16 surface tufts/flowers/mushrooms/crystals placed atop exposed solid tiles
  const sheet = new PixelBuf(16 * 8, 16);
  const cL = hexToAbgr(pal.capLight);
  const cM = hexToAbgr(pal.capMid);
  const cD = hexToAbgr(pal.capDark);
  const cAcc = hexToAbgr(pal.accent);
  const cAcc2 = hexToAbgr(pal.accentAlt);
  const cOut = hexToAbgr(pal.outline);
  const cell = new PixelBuf(16, 16);

  for (let v = 0; v < 8; v++) {
    cell.clear();
    if (v === 0 || v === 3 || v === 6) {
      // Lush pixel grass blades
      cell.line(4, 15, 3, 10, cM);
      cell.line(7, 15, 8, 9, cL);
      cell.line(11, 15, 13, 11, cM);
      cell.px(8, 8, cL);
    } else if (v === 1 || v === 5) {
      // Wildflower / glowing mushroom bud
      cell.line(7, 15, 7, 10, cD);
      cell.line(8, 15, 8, 10, cM);
      cell.ellipse(7.5, 8.5, 3.2, 2.5, cAcc);
      cell.px(7, 8, cAcc2);
      cell.px(8, 8, hexToAbgr(HIGHLIGHT_CREAM));
    } else if (v === 2) {
      // Twin small pebbles / crystal shards
      cell.tri(4, 15, 6, 9, 9, 15, cAcc2);
      cell.tri(9, 15, 11, 11, 13, 15, cAcc);
      cell.px(6, 10, hexToAbgr(HIGHLIGHT_CREAM));
    } else if (v === 4) {
      // Low fern cluster
      cell.ellipse(5, 13, 3, 2, cM);
      cell.ellipse(10, 13, 3, 2, cD);
      cell.ellipse(8, 11, 3, 2, cL);
    } else {
      // Tall accent sprout
      cell.line(8, 15, 7, 8, cM);
      cell.px(6, 9, cL);
      cell.px(9, 10, cL);
      cell.ellipse(7, 7, 2, 2, cAcc);
    }
    cell.outline(cOut);
    sheet.blit(cell, v * 16, 0);
  }
  return sheet.toCanvas();
}

// ============================================================================
// 3-Layer Atmospheric Pixel-Art Parallax Backdrops per Biome
// ============================================================================

function bakeBiomeParallax(pal: BiomePalette): BiomeParallaxSet {
  const sky = new PixelBuf(576, 324);
  const cTop = hexToAbgr(pal.skyTop);
  const cMid = hexToAbgr(pal.skyMid);
  const cBot = hexToAbgr(pal.skyBot);
  const cGlow = hexToAbgr(pal.skyGlow);
  const cCel = hexToAbgr(pal.celestialColor);
  const cRing = hexToAbgr(pal.celestialRing);

  // Authentic 16-bit stepped sky bands with crisp 2x2 Bayer dither transitions
  for (let y = 0; y < 324; y++) {
    for (let x = 0; x < 576; x++) {
      let col = cTop;
      if (y < 70) {
        col = cTop;
      } else if (y < 94) {
        col = ((x + y) & 1) === 0 ? cTop : cMid;
      } else if (y < 170) {
        col = cMid;
      } else if (y < 194) {
        col = ((x + y) & 1) === 0 ? cMid : cBot;
      } else if (y < 268) {
        col = cBot;
      } else if (y < 292) {
        col = ((x + y) & 1) === 0 ? cBot : cGlow;
      } else {
        col = cGlow;
      }
      sky.px(x, y, col);
    }
  }

  // Stars for dark/twilight biomes; fluffy pixel clouds for sunlit biomes
  const isDay = pal.id === 'OPOUSO' || pal.id === 'TDM' || pal.id === 'DSI';
  if (!isDay) {
    for (let i = 0; i < 65; i++) {
      const sx = hash2d(i, 1, pal.id.charCodeAt(0)) % 570;
      const sy = hash2d(i, 2, pal.id.charCodeAt(1)) % 175;
      const bright = (i & 3) === 0;
      sky.px(sx, sy, bright ? cCel : cGlow);
      if (bright) {
        sky.px(sx - 1, sy, cRing);
        sky.px(sx + 1, sy, cRing);
        sky.px(sx, sy - 1, cRing);
        sky.px(sx, sy + 1, cRing);
      }
    }
  }

  // Celestial orb (Sun / Crescent Moon / Volcanic Eclipse / Atomic Ring)
  const celX = isDay ? 445 : 430;
  const celY = isDay ? 66 : 62;
  sky.ellipse(celX, celY, 26, 26, cRing);
  sky.ellipse(celX, celY, 20, 20, cCel);
  if (pal.id === 'EVIL') {
    // Eclipse core
    sky.ellipse(celX, celY, 15, 15, hexToAbgr(pal.skyTop));
  } else if (pal.id === 'GSHIP' || pal.id === 'MLAIR') {
    // Crescent shadow bite
    sky.ellipse(celX + 8, celY - 4, 15, 15, cTop);
  } else if (pal.id === 'TEMP') {
    // Atomic rings around orb
    for (let a = 0; a < 64; a++) {
      const th = (a / 64) * Math.PI * 2;
      sky.px(celX + Math.round(Math.cos(th) * 34), celY + Math.round(Math.sin(th) * 11), cRing);
      sky.px(celX + Math.round(Math.cos(th) * 11), celY + Math.round(Math.sin(th) * 34), cRing);
    }
  }

  // Pixelated horizon clouds for sunlit/desert/haven skies
  if (isDay || pal.id === 'GSHIP') {
    const cloudHi = isDay ? hexToAbgr(HIGHLIGHT_CREAM) : hexToAbgr(pal.skyGlow);
    const cloudSh = isDay ? hexToAbgr(pal.skyBot) : hexToAbgr(pal.midSil);
    const clouds = [
      [70, 56, 30],
      [215, 42, 36],
      [350, 74, 24],
      [510, 50, 28],
    ] as const;
    for (let i = 0; i < clouds.length; i++) {
      const [cx, cy, r] = clouds[i]!;
      sky.ellipse(cx, cy + 4, r, 10, cloudSh);
      sky.ellipse(cx - 12, cy + 2, r * 0.6, 8, cloudSh);
      sky.ellipse(cx + 14, cy + 2, r * 0.55, 8, cloudSh);
      sky.ellipse(cx, cy, r * 0.9, 9, cloudHi);
      sky.ellipse(cx - 12, cy - 2, r * 0.52, 7, cloudHi);
      sky.ellipse(cx + 13, cy - 1, r * 0.48, 7, cloudHi);
    }
  }

  // Layer 1: FAR silhouettes (288x200 seamless horizontal loop)
  const far = new PixelBuf(288, 200);
  const cFar = hexToAbgr(pal.farSil);
  const cFarHi = hexToAbgr(pal.farHighlight);
  const cAcc = hexToAbgr(pal.accent);
  const cAcc2 = hexToAbgr(pal.accentAlt);

  for (let x = 0; x < 288; x++) {
    const t = (x / 288) * Math.PI * 2;
    let ridgeY = 95;
    if (pal.id === 'DSI') {
      // Sharp pyramid silhouettes
      const p1 = Math.abs(((x + 40) % 144) - 72);
      const p2 = Math.abs(((x + 110) % 144) - 72);
      ridgeY = Math.min(58 + p1 * 1.1, 74 + p2 * 0.95);
    } else if (pal.id === 'ATVC') {
      // Jagged volcanic peaks + crater dip
      ridgeY = 72 + Math.round(Math.sin(t * 2) * 28 + Math.cos(t * 5) * 12);
    } else if (pal.id === 'EVIL' || pal.id === 'TEMP' || pal.id === 'LAB') {
      // Towering spires & ancient monolithic skyline
      const tower = (x >> 4) % 3 === 0 ? 48 : (x >> 4) % 3 === 1 ? 84 : 66;
      ridgeY = tower + ((x & 15) < 3 || (x & 15) > 12 ? 12 : 0);
    } else if (pal.id === 'GSHIP') {
      // Distant haunted ship sails on misty ocean horizon
      ridgeY = 128 + Math.round(Math.sin(t * 4) * 4);
    } else {
      // Rolling pixel mountains
      ridgeY = 76 + Math.round(Math.sin(t) * 24 + Math.sin(t * 3 + 1.1) * 14);
    }
    ridgeY = Math.max(24, Math.min(170, ridgeY | 0));
    for (let y = ridgeY; y < 200; y++) {
      far.px(x, y, y < ridgeY + 3 ? cFarHi : cFar);
    }
  }
  if (pal.id === 'GSHIP') {
    // Distant phantom clipper ship silhouette
    far.rect(112, 118, 46, 12, cFar);
    far.rect(134, 62, 3, 56, cFar);
    far.tri(137, 68, 160, 96, 137, 108, cFarHi);
    far.tri(134, 74, 115, 98, 134, 108, cFarHi);
  }

  // Layer 2: MID silhouettes (288x180 seamless loop)
  const mid = new PixelBuf(288, 180);
  const cMidSil = hexToAbgr(pal.midSil);
  const cMidHi = hexToAbgr(pal.midHighlight);

  for (let x = 0; x < 288; x++) {
    const t = (x / 288) * Math.PI * 2;
    const base = 104 + Math.round(Math.sin(t * 2 + 0.7) * 16 + Math.cos(t * 4) * 8);
    for (let y = base; y < 180; y++) {
      mid.px(x, y, y < base + 2 ? cMidHi : cMidSil);
    }
  }
  // Biome-signature midground silhouettes
  if (pal.id === 'OPOUSO') {
    // Storybook village cottages & windmill silhouettes with warm lit windows
    for (let i = 0; i < 4; i++) {
      const hx = 24 + i * 72;
      mid.rect(hx, 84, 28, 36, cMidSil);
      mid.tri(hx - 4, 84, hx + 14, 66, hx + 32, 84, cMidHi);
      mid.rect(hx + 6, 94, 5, 6, cAcc);
      mid.rect(hx + 17, 94, 5, 6, cAcc);
    }
  } else if (pal.id === 'TDM' || pal.id === 'FLIN' || pal.id === 'AP') {
    // Layered pixel pine/canopy trees & glowing toadstools
    for (let i = 0; i < 7; i++) {
      const tx = 14 + i * 42;
      const th = 42 + ((i * 19) % 24);
      const top = 112 - th;
      mid.rect(tx - 3, top + 16, 6, 60, cMidSil);
      mid.tri(tx - 16, top + 34, tx, top, tx + 16, top + 34, cMidSil);
      mid.tri(tx - 12, top + 20, tx, top, tx + 12, top + 20, cMidHi);
      if (pal.id === 'FLIN' || pal.id === 'AP') {
        mid.ellipse(tx + 12, 108, 6, 4, cAcc);
      }
    }
  } else if (pal.id === 'MLAIR' || pal.id === 'LAB') {
    // Cavern stone arch pillars & glowing crystal stalactites
    for (let i = 0; i < 4; i++) {
      const px = 28 + i * 72;
      mid.rect(px, 20, 14, 150, cMidSil);
      mid.rect(px + 2, 20, 3, 150, cMidHi);
      mid.tri(px + 24, 0, px + 30, 34, px + 36, 0, cMidSil);
      mid.px(px + 6, 76, cAcc2);
      mid.px(px + 7, 76, cAcc);
    }
  } else if (pal.id === 'ATVC') {
    // Basalt columns with glowing lava waterfalls
    for (let i = 0; i < 4; i++) {
      const vx = 32 + i * 72;
      mid.rect(vx, 72, 24, 108, cMidSil);
      mid.rect(vx + 9, 76, 4, 104, cAcc2);
      mid.rect(vx + 10, 76, 2, 104, cAcc);
    }
  } else if (pal.id === 'TEMP' || pal.id === 'EVIL') {
    // Glowing monolith rings & runic pillars
    for (let i = 0; i < 4; i++) {
      const rx = 28 + i * 72;
      mid.rect(rx, 50, 18, 130, cMidSil);
      mid.rect(rx + 8, 60, 2, 90, cAcc2);
      mid.ellipse(rx + 9, 44, 7, 7, cAcc);
      mid.ellipse(rx + 9, 44, 4, 4, cMidSil);
    }
  } else if (pal.id === 'GSHIP') {
    // Looming haunted ship masts & tattered ghostly sails
    for (let i = 0; i < 2; i++) {
      const mx = 68 + i * 144;
      mid.rect(mx, 14, 5, 160, cMidSil);
      mid.rect(mx - 34, 40, 72, 4, cMidSil);
      mid.rect(mx - 28, 44, 60, 44, cMidHi);
      mid.tri(mx - 20, 88, mx - 8, 68, mx + 2, 88, 0);
    }
  }

  // Layer 3: NEAR atmospheric foliage/architecture strip (288x140 seamless loop)
  const near = new PixelBuf(288, 140);
  const cNear = hexToAbgr(pal.nearSil);
  for (let x = 0; x < 288; x++) {
    const t = (x / 288) * Math.PI * 2;
    const h = 86 + Math.round(Math.sin(t * 3) * 14 + Math.cos(t * 7) * 6);
    for (let y = h; y < 140; y++) {
      near.px(x, y, cNear);
    }
  }

  return {
    sky: sky.toCanvas(),
    far: far.toCanvas(),
    mid: mid.toCanvas(),
    near: near.toCanvas(),
  };
}

// ============================================================================
// Special Tiles (32x32 single & animated multi-frame)
// ============================================================================

function bakeSpecialTiles(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // OneWay wooden-and-iron bridge plank
  {
    const b = new PixelBuf(32, 32);
    const wHi = hexToAbgr('#e6a86a');
    const wMid = hexToAbgr('#b8743b');
    const wDark = hexToAbgr('#78421f');
    const iron = hexToAbgr('#66748c');
    b.rect(0, 1, 32, 10, wMid);
    b.rect(0, 1, 32, 2, wHi);
    b.rect(0, 9, 32, 2, wDark);
    b.rect(0, 0, 32, 1, cOut);
    b.rect(0, 11, 32, 1, cOut);
    // Plank joints & iron bolts
    for (let x = 0; x < 32; x += 8) {
      b.rect(x, 1, 1, 10, wDark);
      b.rect(x + 3, 4, 2, 2, iron);
    }
    // Support brackets underneath
    b.tri(2, 12, 8, 12, 2, 18, wDark);
    b.tri(30, 12, 24, 12, 30, 18, wDark);
    b.outline(cOut);
    map.set('oneway', b.toCanvas());
  }

  // Spikes (3 gleaming razor spikes)
  {
    const b = new PixelBuf(32, 32);
    const steelHi = hexToAbgr('#f0f8ff');
    const steelMid = hexToAbgr('#94a6bf');
    const steelDark = hexToAbgr('#4e5a75');
    const tipRed = hexToAbgr('#ff3868');
    b.rect(1, 27, 30, 4, steelDark);
    b.rect(1, 26, 30, 2, steelMid);
    for (let i = 0; i < 3; i++) {
      const sx = 5 + i * 11;
      b.tri(sx - 4, 26, sx, 7, sx + 4, 26, steelDark);
      b.tri(sx - 3, 26, sx, 9, sx, 26, steelHi);
      b.tri(sx, 26, sx, 9, sx + 3, 26, steelMid);
      b.rect(sx - 1, 8, 2, 3, tipRed);
      b.px(sx, 7, cWhite);
    }
    b.outline(cOut);
    map.set('spike', b.toCanvas());
  }

  // Breakable cracked crate
  {
    const b = new PixelBuf(32, 32);
    const hi = hexToAbgr('#f2b66d');
    const mid = hexToAbgr('#c97c3a');
    const dark = hexToAbgr('#82441c');
    b.rect(1, 1, 30, 30, mid);
    b.rect(1, 1, 30, 3, hi);
    b.rect(1, 1, 3, 30, hi);
    b.rect(1, 28, 30, 3, dark);
    b.rect(28, 1, 3, 30, dark);
    b.rect(5, 5, 22, 22, dark);
    b.rect(6, 6, 20, 20, mid);
    // Diagonal X brace + fracture cracks
    b.line(6, 6, 25, 25, hi);
    b.line(6, 7, 24, 25, dark);
    b.line(25, 6, 6, 25, hi);
    b.line(15, 7, 13, 14, cOut);
    b.line(13, 14, 18, 21, cOut);
    b.line(18, 21, 16, 25, cOut);
    b.outline(cOut);
    map.set('breakable', b.toCanvas());
  }

  // StoneOverhead (Heavy carved boulder smashable by Rock Uppercut!)
  {
    const b = new PixelBuf(32, 32);
    const sHi = hexToAbgr('#b8b2cc');
    const sMid = hexToAbgr('#787294');
    const sDark = hexToAbgr('#494366');
    const gold = hexToAbgr('#ffad16');
    const goldHi = hexToAbgr('#ffe7a1');
    b.rect(1, 1, 30, 30, sMid);
    b.rect(2, 2, 28, 3, sHi);
    b.rect(2, 27, 28, 3, sDark);
    b.rect(27, 2, 3, 28, sDark);
    // Glowing upward chevron rock rune signaling Rock Uppercut
    b.line(10, 20, 16, 11, gold);
    b.line(16, 11, 22, 20, gold);
    b.line(10, 19, 16, 10, goldHi);
    b.line(16, 10, 22, 19, goldHi);
    // Fracture lines
    b.line(4, 12, 10, 15, cOut);
    b.line(27, 18, 21, 22, cOut);
    b.outline(cOut);
    map.set('stone_overhead', b.toCanvas());
  }

  // Rubber Bounce pad (2 frames: idle & stretched)
  {
    const sheet = new PixelBuf(64, 32);
    const fBuf = new PixelBuf(32, 32);
    const bHi = hexToAbgr('#ff99e8');
    const bMid = hexToAbgr('#ff38a8');
    const bDark = hexToAbgr('#9e146b');
    const gold = hexToAbgr('#ffd84d');
    const coil = hexToAbgr('#9eb2cc');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      const squash = f === 1 ? 3 : 0;
      // Base plate + springs
      fBuf.rect(4, 26, 24, 5, hexToAbgr('#4e4666'));
      fBuf.line(9, 26, 13, 18 + squash, coil);
      fBuf.line(23, 26, 19, 18 + squash, coil);
      // Bouncy glossy mushroom cap
      fBuf.ellipseShaded(16, 14 + squash, 14, 8 - squash * 0.4, bHi, bMid, bDark, cWhite);
      fBuf.rect(8, 12 + squash, 16, 2, gold);
      fBuf.outline(cOut);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('bounce', sheet.toCanvas());
  }

  // Slippery Vine rail
  {
    const b = new PixelBuf(32, 32);
    const vHi = hexToAbgr('#7aff66');
    const vMid = hexToAbgr('#2db84c');
    const vDark = hexToAbgr('#176e38');
    const berry = hexToAbgr('#ff4da6');
    for (let y = 0; y < 32; y++) {
      const x = 15 + Math.round(Math.sin((y / 32) * Math.PI * 2) * 3);
      b.rect(x - 2, y, 5, 1, vMid);
      b.px(x - 1, y, vHi);
      b.px(x + 2, y, vDark);
    }
    // Crisp sprouting leaves & berries
    b.ellipse(9, 9, 5, 3, vHi);
    b.ellipse(23, 21, 5, 3, vMid);
    b.ellipse(12, 25, 2, 2, berry);
    b.ellipse(20, 12, 2, 2, berry);
    b.outline(cOut);
    map.set('vine', b.toCanvas());
  }

  // Acid (4 frames bubbling toxic waves)
  {
    const sheet = new PixelBuf(128, 32);
    const fBuf = new PixelBuf(32, 32);
    const foam = hexToAbgr('#d6ff7a');
    const hi = hexToAbgr('#78ff30');
    const mid = hexToAbgr('#35bf24');
    const dark = hexToAbgr('#1a7020');
    for (let f = 0; f < 4; f++) {
      fBuf.clear();
      for (let x = 0; x < 32; x++) {
        const wave = 4 + Math.round(Math.sin(((x + f * 8) / 32) * Math.PI * 2) * 2.2);
        fBuf.px(x, wave - 1, cOut);
        fBuf.px(x, wave, foam);
        fBuf.px(x, wave + 1, hi);
        for (let y = wave + 2; y < 32; y++) {
          fBuf.px(x, y, y < 16 ? mid : dark);
        }
      }
      // Rising pixel bubbles
      const bx = (6 + f * 7) % 24 + 4;
      const by = 24 - f * 4;
      fBuf.ellipse(bx, by, 2.5, 2.5, foam);
      fBuf.px(bx, by, hi);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('acid', sheet.toCanvas());
  }

  // Lava (4 frames glowing molten waves)
  {
    const sheet = new PixelBuf(128, 32);
    const fBuf = new PixelBuf(32, 32);
    const hot = hexToAbgr('#fff799');
    const hi = hexToAbgr('#ffaa1d');
    const mid = hexToAbgr('#e84514');
    const dark = hexToAbgr('#8f141c');
    for (let f = 0; f < 4; f++) {
      fBuf.clear();
      for (let x = 0; x < 32; x++) {
        const wave = 4 + Math.round(Math.sin(((x + f * 8) / 32) * Math.PI * 2) * 2.2);
        fBuf.px(x, wave - 1, cOut);
        fBuf.px(x, wave, hot);
        fBuf.px(x, wave + 1, hi);
        for (let y = wave + 2; y < 32; y++) {
          fBuf.px(x, y, y < 14 ? hi : y < 23 ? mid : dark);
        }
      }
      const bx = (10 + f * 6) % 24 + 4;
      const by = 22 - f * 3;
      fBuf.ellipse(bx, by, 3, 2, hot);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('lava', sheet.toCanvas());
  }

  // Quicksand (2 frames rippling golden strata)
  {
    const sheet = new PixelBuf(64, 32);
    const fBuf = new PixelBuf(32, 32);
    const hi = hexToAbgr('#ffe79e');
    const mid = hexToAbgr('#db9e44');
    const dark = hexToAbgr('#9c5f24');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const shift = ((y >> 2) + f * 4) * 3;
          const wave = ((x + shift) % 12) < 4;
          fBuf.px(x, y, y < 3 ? hi : wave ? mid : dark);
        }
      }
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('quicksand', sheet.toCanvas());
  }

  // Crumble fragile platform
  {
    const b = new PixelBuf(32, 32);
    const hi = hexToAbgr('#dec7ab');
    const mid = hexToAbgr('#a8876d');
    const dark = hexToAbgr('#664a3e');
    b.rect(2, 2, 28, 22, mid);
    b.rect(2, 2, 28, 3, hi);
    b.rect(2, 21, 28, 3, dark);
    // Heavy cracks + falling dust pebbles
    b.line(9, 2, 13, 12, cOut);
    b.line(13, 12, 10, 23, cOut);
    b.line(22, 3, 18, 15, cOut);
    b.line(18, 15, 24, 22, cOut);
    b.rect(7, 27, 3, 3, dark);
    b.rect(18, 28, 2, 2, mid);
    b.rect(24, 26, 3, 2, dark);
    b.outline(cOut);
    map.set('crumble', b.toCanvas());
  }

  // Explosive TNT/Bomb block (2 pulsing frames)
  {
    const sheet = new PixelBuf(64, 32);
    const fBuf = new PixelBuf(32, 32);
    const rHi = hexToAbgr('#ff7070');
    const rMid = hexToAbgr('#d91c36');
    const rDark = hexToAbgr('#7a0c24');
    const yel = hexToAbgr('#ffe640');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      fBuf.rect(2, 2, 28, 28, rMid);
      fBuf.rect(2, 2, 28, 3, rHi);
      fBuf.rect(2, 27, 28, 3, rDark);
      // Hazard band
      fBuf.rect(2, 11, 28, 10, f === 0 ? yel : cWhite);
      fBuf.rect(12, 13, 8, 6, rDark);
      // Star spark emblem
      fBuf.px(16, 15, yel);
      fBuf.px(15, 16, yel);
      fBuf.px(17, 16, yel);
      fBuf.outline(cOut);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('explosive', sheet.toCanvas());
  }

  // Antigrav emitter (2 frames)
  {
    const sheet = new PixelBuf(64, 32);
    const fBuf = new PixelBuf(32, 32);
    const vHi = hexToAbgr('#c79eff');
    const vMid = hexToAbgr('#7838e6');
    const cy = hexToAbgr('#66f7ff');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      const oy = f === 0 ? 0 : -3;
      fBuf.line(8, 22 + oy, 16, 14 + oy, cy);
      fBuf.line(16, 14 + oy, 24, 22 + oy, cy);
      fBuf.line(10, 14 + oy, 16, 8 + oy, vHi);
      fBuf.line(16, 8 + oy, 22, 14 + oy, vHi);
      fBuf.ellipse(16, 26, 6, 3, vMid);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('antigrav', sheet.toCanvas());
  }

  // Wind streams (up / left / right, 4 frames)
  const windCol1 = hexToAbgr('#e0ffff', 175);
  const windCol2 = hexToAbgr('#8cebff', 120);
  for (const dir of ['wind_up', 'wind_left', 'wind_right'] as const) {
    const sheet = new PixelBuf(128, 32);
    const fBuf = new PixelBuf(32, 32);
    for (let f = 0; f < 4; f++) {
      fBuf.clear();
      const off = f * 8;
      if (dir === 'wind_up') {
        for (let s = 0; s < 3; s++) {
          const sx = 6 + s * 10;
          const sy = (32 - ((off + s * 11) % 32)) % 32;
          for (let k = 0; k < 10; k++) {
            fBuf.px(sx + (k > 5 ? 1 : 0), (sy + k) % 32, k < 4 ? windCol1 : windCol2);
          }
        }
      } else {
        const sign = dir === 'wind_right' ? 1 : -1;
        for (let s = 0; s < 3; s++) {
          const sy = 6 + s * 10;
          const sx = (32 + sign * ((off + s * 11) % 32)) % 32;
          for (let k = 0; k < 11; k++) {
            fBuf.px((sx + k) % 32, sy, k < 4 ? windCol1 : windCol2);
          }
        }
      }
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set(dir, sheet.toCanvas());
  }

  // Secret wall telltale shimmer crack overlay
  {
    const b = new PixelBuf(32, 32);
    const crack = hexToAbgr('#ffe6ff', 145);
    b.line(12, 4, 16, 13, crack);
    b.line(16, 13, 13, 20, crack);
    b.line(13, 20, 19, 27, crack);
    map.set('secret_crack', b.toCanvas());
  }

  // Moving platform tile (32x16)
  {
    const b = new PixelBuf(32, 16);
    const hi = hexToAbgr('#ffd67a');
    const mid = hexToAbgr('#c78338');
    const dark = hexToAbgr('#6e3f1c');
    const cyan = hexToAbgr('#59f2ff');
    b.rect(1, 1, 30, 14, mid);
    b.rect(1, 1, 30, 3, hi);
    b.rect(1, 12, 30, 3, dark);
    b.rect(6, 6, 4, 4, cyan);
    b.rect(22, 6, 4, 4, cyan);
    b.outline(cOut);
    map.set('moving_platform', b.toCanvas());
  }

  // Crusher block (32x32 angry iron block with underside teeth)
  {
    const b = new PixelBuf(32, 32);
    const hi = hexToAbgr('#949eb8');
    const mid = hexToAbgr('#58607a');
    const dark = hexToAbgr('#30354a');
    const eye = hexToAbgr('#ff3858');
    b.rect(2, 2, 28, 24, mid);
    b.rect(2, 2, 28, 3, hi);
    b.rect(2, 23, 28, 3, dark);
    b.rect(8, 10, 5, 4, eye);
    b.rect(19, 10, 5, 4, eye);
    b.tri(4, 26, 8, 31, 12, 26, hi);
    b.tri(12, 26, 16, 31, 20, 26, hi);
    b.tri(20, 26, 24, 31, 28, 26, hi);
    b.outline(cOut);
    map.set('crusher', b.toCanvas());
  }

  return map;
}

// ============================================================================
// Props, Totems, Chests, Teleporters, Collectibles & Hub NPCs
// ============================================================================

function bakeProps(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // Volt Node (2 frames, 32x32)
  {
    const sheet = new PixelBuf(64, 32);
    const fBuf = new PixelBuf(32, 32);
    const vHi = hexToAbgr('#c2ffff');
    const vMid = hexToAbgr('#2be8ff');
    const vYel = hexToAbgr('#f2ff38');
    const metal = hexToAbgr('#4e5d75');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      // Orbiting electric arc pixels
      const rot = f === 0 ? 0 : 1;
      fBuf.ellipse(16, 16, 12, 12, vMid);
      fBuf.ellipse(16, 16, 10, 10, 0);
      fBuf.ellipseShaded(16, 16, 7.5, 7.5, vHi, vMid, metal, cWhite);
      // Lightning bolt emblem inside core
      fBuf.line(17, 11, 14, 16, vYel);
      fBuf.line(14, 16, 18, 16, vYel);
      fBuf.line(18, 16, 15, 21, vYel);
      // Spark prongs
      fBuf.rect(15, 2 + rot, 2, 3, vYel);
      fBuf.rect(15, 27 - rot, 2, 3, vYel);
      fBuf.rect(2 + rot, 15, 3, 2, vYel);
      fBuf.rect(27 - rot, 15, 3, 2, vYel);
      fBuf.outline(cOut);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('volt_node', sheet.toCanvas());
  }

  // Chest (closed & open, 32x28)
  {
    const woodHi = hexToAbgr('#e39c52');
    const woodMid = hexToAbgr('#a85d28');
    const woodDark = hexToAbgr('#663116');
    const gold = hexToAbgr('#ffd84d');
    const ruby = hexToAbgr('#ff3366');

    const closed = new PixelBuf(32, 28);
    closed.rect(3, 8, 26, 18, woodMid);
    closed.rect(3, 8, 26, 4, woodHi);
    closed.rect(3, 22, 26, 4, woodDark);
    closed.rect(3, 14, 26, 2, gold);
    closed.rect(7, 8, 2, 18, gold);
    closed.rect(23, 8, 2, 18, gold);
    closed.rect(13, 12, 6, 6, gold);
    closed.rect(15, 14, 2, 2, ruby);
    closed.outline(cOut);
    map.set('chest_closed', closed.toCanvas());

    const open = new PixelBuf(32, 28);
    open.rect(3, 14, 26, 12, woodMid);
    open.rect(3, 22, 26, 4, woodDark);
    open.rect(4, 3, 24, 9, woodDark);
    open.rect(5, 4, 22, 3, woodHi);
    open.rect(5, 12, 22, 3, gold);
    open.rect(13, 14, 6, 4, gold);
    open.outline(cOut);
    map.set('chest_open', open.toCanvas());
  }

  // Teleporter Gate (2 frames, 40x48)
  {
    const sheet = new PixelBuf(80, 48);
    const fBuf = new PixelBuf(40, 48);
    const stHi = hexToAbgr('#a8b0d4');
    const stMid = hexToAbgr('#636a91');
    const stDark = hexToAbgr('#393d5e');
    const pCyan = hexToAbgr('#59f2ff');
    const pMag = hexToAbgr('#d44dff');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      // Stone portal arch
      fBuf.rect(4, 42, 32, 5, stDark);
      fBuf.rect(6, 10, 6, 33, stMid);
      fBuf.rect(28, 10, 6, 33, stMid);
      fBuf.rect(6, 6, 28, 6, stHi);
      // Swirling arcane core
      fBuf.ellipse(20, 26, 9, 13, f === 0 ? pMag : pCyan);
      fBuf.ellipse(20, 26, 6, 9, f === 0 ? pCyan : pMag);
      fBuf.ellipse(20, 26, 3, 5, cWhite);
      fBuf.outline(cOut);
      sheet.blit(fBuf, f * 40, 0);
    }
    map.set('teleporter', sheet.toCanvas());
  }

  // Save Shrine (2 frames, 32x40)
  {
    const sheet = new PixelBuf(64, 40);
    const fBuf = new PixelBuf(32, 40);
    const st = hexToAbgr('#7880a6');
    const stHi = hexToAbgr('#b8c0e6');
    const flame = hexToAbgr('#ffd84d');
    const flameHot = hexToAbgr('#fff8c4');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      fBuf.rect(6, 32, 20, 6, st);
      fBuf.rect(10, 18, 12, 15, stHi);
      fBuf.rect(12, 20, 8, 11, st);
      const oy = f === 0 ? 0 : -2;
      fBuf.tri(11, 15 + oy, 16, 4 + oy, 21, 15 + oy, flame);
      fBuf.tri(13, 14 + oy, 16, 7 + oy, 19, 14 + oy, flameHot);
      fBuf.outline(cOut);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('save_shrine', sheet.toCanvas());
  }

  // Signpost (24x28)
  {
    const b = new PixelBuf(24, 28);
    const wHi = hexToAbgr('#e6ac6e');
    const wMid = hexToAbgr('#ad6e39');
    const wDark = hexToAbgr('#6b3d1d');
    b.rect(10, 13, 4, 14, wDark);
    b.rect(3, 4, 18, 11, wMid);
    b.rect(3, 4, 18, 2, wHi);
    b.rect(6, 8, 12, 1, wDark);
    b.rect(6, 11, 9, 1, wDark);
    b.outline(cOut);
    map.set('signpost', b.toCanvas());
  }

  // Animal House (48x44 cozy storybook cottage)
  {
    const b = new PixelBuf(48, 44);
    const roofHi = hexToAbgr('#ff7088');
    const roofMid = hexToAbgr('#cc3355');
    const wall = hexToAbgr('#f0d9b8');
    const wallSh = hexToAbgr('#c29f78');
    const door = hexToAbgr('#784222');
    const win = hexToAbgr('#ffe866');
    b.rect(8, 20, 32, 22, wall);
    b.rect(8, 37, 32, 5, wallSh);
    b.tri(3, 21, 24, 4, 45, 21, roofMid);
    b.tri(7, 19, 24, 6, 36, 19, roofHi);
    b.rect(19, 28, 10, 14, door);
    b.rect(11, 25, 6, 6, win);
    b.rect(31, 25, 6, 6, win);
    b.outline(cOut);
    map.set('animal_house', b.toCanvas());
  }

  // Target Switch (2 frames, 24x24)
  {
    const sheet = new PixelBuf(48, 24);
    const fBuf = new PixelBuf(24, 24);
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      fBuf.ellipseShaded(
        12,
        12,
        9,
        9,
        hexToAbgr(f === 0 ? '#ff6680' : '#7aff80'),
        hexToAbgr(f === 0 ? '#cc1f3d' : '#2db84c'),
        hexToAbgr('#4a1428'),
      );
      fBuf.ellipse(12, 12, 4, 4, cWhite);
      fBuf.ellipse(12, 12, 2, 2, hexToAbgr(f === 0 ? '#ff3355' : '#26e659'));
      fBuf.outline(cOut);
      sheet.blit(fBuf, f * 24, 0);
    }
    map.set('target_switch', sheet.toCanvas());
  }

  // Locked Target Door & Coin Door (32x64)
  for (const kind of ['door_locked', 'coin_door'] as const) {
    const b = new PixelBuf(32, 64);
    const metal = hexToAbgr(kind === 'coin_door' ? '#b87c24' : '#585c78');
    const hi = hexToAbgr(kind === 'coin_door' ? '#ffd84d' : '#949cc4');
    const dark = hexToAbgr(kind === 'coin_door' ? '#6e3f0e' : '#2e3047');
    b.rect(3, 2, 26, 60, metal);
    b.rect(3, 2, 26, 4, hi);
    b.rect(3, 58, 26, 4, dark);
    b.rect(7, 8, 18, 48, dark);
    b.rect(9, 10, 14, 44, metal);
    b.ellipse(16, 32, 6, 6, hi);
    b.ellipse(16, 32, 3, 3, dark);
    b.outline(cOut);
    map.set(kind, b.toCanvas());
  }

  // Form Totems (all 6 forms, 36x44)
  for (let i = 0; i < HERO_FORMS.length; i++) {
    const form = HERO_FORMS[i]!;
    const pal = HERO_FORM_PALETTES[form];
    const b = new PixelBuf(36, 44);
    const stHi = hexToAbgr('#aba4c7');
    const stMid = hexToAbgr('#6f688c');
    const stDark = hexToAbgr('#3f3859');
    b.rect(6, 36, 24, 6, stDark);
    b.rect(9, 20, 18, 17, stMid);
    b.rect(10, 20, 16, 3, stHi);
    b.ellipseShaded(18, 12, 9, 9, hexToAbgr(pal[4]), hexToAbgr(pal[0]), hexToAbgr(pal[2]), cWhite);
    b.outline(cOut);
    map.set(`totem_${form}`, b.toCanvas());
  }

  return map;
}

function bakeHubNpcs(): Map<ShopId, HTMLCanvasElement> {
  const map = new Map<ShopId, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  const npcSpecs: ReadonlyArray<{
    id: ShopId;
    cloakHi: string;
    cloakMid: string;
    cloakDark: string;
    skin: string;
    accent: string;
    hat: 'hood' | 'sage' | 'goggles' | 'helm' | 'tricorn' | 'tome';
  }> = [
    {
      id: 'vespera',
      cloakHi: '#b85eff',
      cloakMid: '#7629bf',
      cloakDark: '#3f126e',
      skin: '#ffd9cc',
      accent: '#ff427a',
      hat: 'hood',
    },
    {
      id: 'orla',
      cloakHi: '#59e888',
      cloakMid: '#249e58',
      cloakDark: '#125436',
      skin: '#ffe0bd',
      accent: '#ffd84d',
      hat: 'sage',
    },
    {
      id: 'barnaby',
      cloakHi: '#ffad4d',
      cloakMid: '#cc6f24',
      cloakDark: '#733512',
      skin: '#ffd4b8',
      accent: '#59f2ff',
      hat: 'goggles',
    },
    {
      id: 'garron',
      cloakHi: '#ff5268',
      cloakMid: '#bd1e38',
      cloakDark: '#690d22',
      skin: '#e6b899',
      accent: '#ffd84d',
      hat: 'helm',
    },
    {
      id: 'barnacle',
      cloakHi: '#5effcf',
      cloakMid: '#24a891',
      cloakDark: '#125259',
      skin: '#94ffe6',
      accent: '#ffd84d',
      hat: 'tricorn',
    },
    {
      id: 'codex',
      cloakHi: '#ffe066',
      cloakMid: '#d9961f',
      cloakDark: '#7d440c',
      skin: '#fff5d6',
      accent: '#59f2ff',
      hat: 'tome',
    },
  ];

  for (let i = 0; i < npcSpecs.length; i++) {
    const spec = npcSpecs[i]!;
    const sheet = new PixelBuf(72, 40);
    const b = new PixelBuf(36, 40);
    const hi = hexToAbgr(spec.cloakHi);
    const mid = hexToAbgr(spec.cloakMid);
    const dark = hexToAbgr(spec.cloakDark);
    const skin = hexToAbgr(spec.skin);
    const acc = hexToAbgr(spec.accent);

    for (let f = 0; f < 2; f++) {
      b.clear();
      const bob = f === 1 ? 1 : 0;

      if (spec.hat === 'tome') {
        // Floating sentient golden grimoire Codex!
        const hover = f === 0 ? 0 : -2;
        b.rect(8, 12 + hover, 20, 20, mid);
        b.rect(10, 14 + hover, 16, 16, skin);
        b.rect(8, 12 + hover, 4, 20, dark);
        b.rect(9, 12 + hover, 18, 2, hi);
        // Glowing wise eyes on book cover
        b.rect(13, 19 + hover, 3, 4, acc);
        b.rect(20, 19 + hover, 3, 4, acc);
        b.px(14, 20 + hover, cWhite);
        b.px(21, 20 + hover, cWhite);
        // Fluttering bookmark ribbon
        b.tri(18, 32 + hover, 15, 38, 21, 36, hexToAbgr('#ff3868'));
      } else {
        // Body cloak
        b.ellipseShaded(18, 28 + bob, 9.5, 9, hi, mid, dark);
        // Head
        b.ellipseShaded(18, 16 + bob, 7.5, 7, cWhite, skin, dark);
        // Eyes
        b.rect(14, 15 + bob, 2, 3, cOut);
        b.rect(20, 15 + bob, 2, 3, cOut);
        b.px(14, 15 + bob, cWhite);
        b.px(20, 15 + bob, cWhite);

        // Signature headgear & prop
        if (spec.hat === 'hood') {
          b.tri(9, 16 + bob, 18, 4 + bob, 27, 16 + bob, mid);
          b.tri(11, 15 + bob, 18, 6 + bob, 23, 15 + bob, hi);
          // Heart crystal staff
          b.line(29, 10, 29, 37, dark);
          b.ellipse(29, 9 + bob, 3.5, 3.5, acc);
        } else if (spec.hat === 'sage') {
          b.tri(8, 13 + bob, 18, 3 + bob, 28, 13 + bob, dark);
          b.rect(9, 11 + bob, 18, 3, acc);
          b.ellipse(29, 20 + bob, 4, 4, acc);
        } else if (spec.hat === 'goggles') {
          // Oversized relic backpack + round goggles
          b.ellipseShaded(9, 26 + bob, 6, 8, hi, mid, dark);
          b.rect(12, 11 + bob, 12, 4, dark);
          b.rect(13, 12 + bob, 4, 2, acc);
          b.rect(19, 12 + bob, 4, 2, acc);
        } else if (spec.hat === 'helm') {
          // Horned arena champion helm
          b.rect(11, 9 + bob, 14, 6, mid);
          b.tri(11, 11 + bob, 6, 4 + bob, 13, 9 + bob, acc);
          b.tri(25, 11 + bob, 30, 4 + bob, 23, 9 + bob, acc);
          b.rect(28, 12, 3, 24, dark);
          b.tri(27, 11, 34, 15, 27, 20, hi);
        } else if (spec.hat === 'tricorn') {
          // Spectral pirate captain hat + beard
          b.tri(6, 12 + bob, 18, 5 + bob, 30, 12 + bob, dark);
          b.rect(9, 11 + bob, 18, 2, acc);
          b.tri(13, 21 + bob, 18, 28 + bob, 23, 21 + bob, hi);
        }
      }
      b.outline(cOut);
      sheet.blit(b, f * 36, 0);
    }
    map.set(spec.id, sheet.toCanvas());
  }

  return map;
}

function bakeCollectibles(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // Coin (4 frames spinning 20x20)
  {
    const sheet = new PixelBuf(80, 20);
    const b = new PixelBuf(20, 20);
    const hi = hexToAbgr(UI_COLORS.coinLight);
    const mid = hexToAbgr(UI_COLORS.coinMid);
    const dark = hexToAbgr(UI_COLORS.coinDark);
    const widths = [7.5, 5.5, 2.5, 5.5] as const;
    for (let f = 0; f < 4; f++) {
      b.clear();
      const rx = widths[f]!;
      b.ellipseShaded(10, 10, rx, 7.5, hi, mid, dark, cWhite);
      if (rx >= 5) {
        b.rect(9, 6, 2, 8, hi);
        b.px(9, 7, cWhite);
      }
      b.outline(cOut);
      sheet.blit(b, f * 20, 0);
    }
    map.set('coin', sheet.toCanvas());
  }

  // Crystal (4 frames sparkling faceted gem 16x20)
  {
    const sheet = new PixelBuf(64, 20);
    const b = new PixelBuf(16, 20);
    const hi = hexToAbgr(UI_COLORS.crystalLight);
    const mid = hexToAbgr(UI_COLORS.crystalMid);
    const dark = hexToAbgr(UI_COLORS.crystalDark);
    const deep = hexToAbgr(UI_COLORS.crystalDeep);
    for (let f = 0; f < 4; f++) {
      b.clear();
      b.tri(8, 2, 2, 10, 8, 18, mid);
      b.tri(8, 2, 14, 10, 8, 18, dark);
      b.tri(8, 2, 4, 10, 8, 10, hi);
      b.tri(8, 18, 12, 10, 8, 10, deep);
      if (f === 1 || f === 3) {
        b.px(6, 6, cWhite);
        b.px(7, 5, cWhite);
        b.px(7, 7, cWhite);
      }
      b.outline(cOut);
      sheet.blit(b, f * 16, 0);
    }
    map.set('crystal', sheet.toCanvas());
  }

  // Heart Full & Empty (14x14)
  {
    const drawHeart = (hi: number, mid: number, dark: number, spec: boolean): HTMLCanvasElement => {
      const b = new PixelBuf(14, 14);
      b.ellipse(4.5, 5, 3.2, 3.0, mid);
      b.ellipse(9.5, 5, 3.2, 3.0, mid);
      b.tri(1.5, 6, 12.5, 6, 7, 12.5, mid);
      b.tri(7, 6, 12.5, 6, 7, 12.5, dark);
      b.px(4, 4, hi);
      b.px(5, 4, hi);
      if (spec) b.px(4, 3, cWhite);
      b.outline(cOut);
      return b.toCanvas();
    };
    map.set(
      'heart_full',
      drawHeart(
        hexToAbgr(UI_COLORS.heartBright),
        hexToAbgr(UI_COLORS.heartMid),
        hexToAbgr(UI_COLORS.heartDark),
        true,
      ),
    );
    map.set(
      'heart_empty',
      drawHeart(
        hexToAbgr('#4e2d66'),
        hexToAbgr(UI_COLORS.heartEmpty),
        hexToAbgr(UI_COLORS.heartEmptyInner),
        false,
      ),
    );
  }

  // RockShield & MagicShield icons (14x14)
  {
    const b = new PixelBuf(14, 14);
    b.rect(2, 2, 10, 6, hexToAbgr(UI_COLORS.shieldMid));
    b.rect(2, 2, 10, 2, hexToAbgr(UI_COLORS.shieldLight));
    b.tri(2, 8, 12, 8, 7, 12.5, hexToAbgr(UI_COLORS.shieldDark));
    b.rect(6, 4, 2, 4, hexToAbgr(UI_COLORS.shieldGem));
    b.outline(cOut);
    map.set('rock_shield', b.toCanvas());

    const m = new PixelBuf(14, 14);
    m.rect(2, 2, 10, 6, hexToAbgr(UI_COLORS.magicShield));
    m.tri(2, 8, 12, 8, 7, 12.5, hexToAbgr('#2299cc'));
    m.rect(5, 4, 4, 3, cWhite);
    m.outline(cOut);
    map.set('magic_shield', m.toCanvas());
  }

  // Elemental Form Emblem Badges (12x12 each)
  for (let i = 0; i < HERO_FORMS.length; i++) {
    const form = HERO_FORMS[i]!;
    const pal = HERO_FORM_PALETTES[form];
    const b = new PixelBuf(12, 12);
    const c0 = hexToAbgr(pal[0]);
    const c2 = hexToAbgr(pal[2]);
    const c4 = hexToAbgr(pal[4]);
    if (form === 'krunk_basic') {
      b.ellipse(6, 7, 4, 3.5, c0);
      b.tri(2, 5, 1, 1, 5, 4, c4);
      b.tri(10, 5, 11, 1, 7, 4, c4);
    } else if (form === 'krunk_fire') {
      b.tri(2, 10, 6, 1, 10, 10, c0);
      b.tri(4, 10, 6, 4, 8, 10, c4);
    } else if (form === 'krunk_leaf') {
      b.ellipse(6, 6, 4.5, 3, c0);
      b.line(2, 9, 9, 3, c4);
    } else if (form === 'krunk_rock') {
      b.rect(2, 3, 8, 7, c0);
      b.rect(3, 4, 6, 2, c4);
      b.rect(5, 6, 2, 2, hexToAbgr(pal[5]));
    } else if (form === 'krunk_electric') {
      b.line(7, 1, 3, 6, c0);
      b.line(3, 6, 8, 6, c4);
      b.line(8, 6, 4, 10, c0);
    } else {
      b.ellipse(6, 6, 4.5, 4.5, c2);
      b.ellipse(6, 6, 2.2, 2.2, c4);
    }
    b.outline(cOut);
    map.set(`form_icon_${form}`, b.toCanvas());
  }

  return map;
}

function bakeProjectiles(): Map<ProjectileRuntime['kind'], HTMLCanvasElement> {
  const map = new Map<ProjectileRuntime['kind'], HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  const kinds: readonly ProjectileRuntime['kind'][] = [
    'spit',
    'fireball',
    'gear',
    'plasma',
    'dark_orb',
    'missile',
    'shockwave',
    'thorn',
  ];

  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i]!;
    const sheet = new PixelBuf(32, 16);
    const b = new PixelBuf(16, 16);
    for (let f = 0; f < 2; f++) {
      b.clear();
      if (kind === 'spit') {
        b.ellipseShaded(8, 8, 5, 4.5, hexToAbgr('#c4ff66'), hexToAbgr('#58e624'), hexToAbgr('#1f7822'), cWhite);
      } else if (kind === 'fireball') {
        b.ellipseShaded(8, 8, 5.5, 5.5, hexToAbgr('#fff280'), hexToAbgr('#ff661a'), hexToAbgr('#b81414'), cWhite);
        b.px(3, 7 + f, hexToAbgr('#ffaa1d'));
      } else if (kind === 'gear') {
        b.ellipseShaded(8, 8, 5.5, 5.5, hexToAbgr('#dce6f2'), hexToAbgr('#8094b0'), hexToAbgr('#404d66'));
        b.rect(7, 1 + f, 2, 14 - f * 2, hexToAbgr('#dce6f2'));
        b.rect(1 + f, 7, 14 - f * 2, 2, hexToAbgr('#dce6f2'));
        b.ellipse(8, 8, 2, 2, cOut);
      } else if (kind === 'plasma') {
        b.ellipseShaded(8, 8, 5.5, 5.5, cWhite, hexToAbgr('#59f2ff'), hexToAbgr('#1e66cc'));
        b.px(8 + (f === 0 ? 5 : -5), 8, hexToAbgr('#ffe838'));
      } else if (kind === 'dark_orb') {
        b.ellipseShaded(8, 8, 5.5, 5.5, hexToAbgr('#ff3b9a'), hexToAbgr('#781499'), hexToAbgr('#220933'));
        b.ellipse(8, 8, 2, 2, hexToAbgr('#24ff78'));
      } else if (kind === 'missile') {
        b.rect(3, 5, 9, 6, hexToAbgr('#b8c4d9'));
        b.tri(12, 5, 15, 8, 12, 11, hexToAbgr('#ff3858'));
        b.rect(1, 6 + f, 3, 3, hexToAbgr('#ffaa1d'));
      } else if (kind === 'shockwave') {
        b.ellipse(8, 8, 6, 4 + f, hexToAbgr('#ffd84d'));
        b.ellipse(8, 8, 3.5, 2, cWhite);
      } else {
        // thorn
        b.tri(2, 8, 14, 4, 14, 12, hexToAbgr('#47b832'));
        b.line(3, 8, 13, 8, hexToAbgr('#c7ff66'));
      }
      b.outline(cOut);
      sheet.blit(b, f * 16, 0);
    }
    map.set(kind, sheet.toCanvas());
  }

  return map;
}

// ============================================================================
// All 34 Enemy Archetypes (Distinct 2-Frame Pixel Sprites + White Flash)
// ============================================================================

type EnemyStyle =
  | 'blob'
  | 'winged'
  | 'spitter'
  | 'beetle'
  | 'bee'
  | 'frog'
  | 'plant'
  | 'mushroom'
  | 'spikeball'
  | 'slug'
  | 'spider'
  | 'lizard'
  | 'jelly'
  | 'bomb'
  | 'pig'
  | 'bird'
  | 'turtle'
  | 'worm'
  | 'sword'
  | 'zeppelin'
  | 'eye'
  | 'mummy'
  | 'ghost';

interface EnemyVisualSpec {
  readonly style: EnemyStyle;
  readonly hi: string;
  readonly mid: string;
  readonly dark: string;
  readonly acc: string;
  readonly w?: number;
  readonly h?: number;
}

const ENEMY_VISUALS: Readonly<Record<EnemyArchetypeId, EnemyVisualSpec>> = {
  goomba: { style: 'blob', hi: '#e67855', mid: '#b84232', dark: '#6b1d24', acc: '#ffe6b8' },
  air_goomba: { style: 'winged', hi: '#b882ff', mid: '#7842cc', dark: '#421c80', acc: '#fff5e6' },
  spitter: { style: 'spitter', hi: '#a366ff', mid: '#6329b8', dark: '#36126b', acc: '#7aff38' },
  horned_beetle: { style: 'beetle', hi: '#7085d4', mid: '#3a4691', dark: '#1e2254', acc: '#ff4268' },
  guilhofly: { style: 'winged', hi: '#ff96c4', mid: '#cc3d82', dark: '#6b1447', acc: '#ffe866' },
  spikeball: { style: 'spikeball', hi: '#a8b2cc', mid: '#5c6480', dark: '#2c3045', acc: '#ff3858' },
  bee: { style: 'bee', hi: '#fff066', mid: '#f2b81d', dark: '#301c2e', acc: '#c4f7ff' },
  frog: { style: 'frog', hi: '#78ff94', mid: '#26b859', dark: '#14663d', acc: '#ffe04d' },
  ladybug: { style: 'beetle', hi: '#ff667a', mid: '#d91c38', dark: '#6e0d24', acc: '#180b20' },
  carnivorous_plant: { style: 'plant', hi: '#ff6688', mid: '#cc1f47', dark: '#660d29', acc: '#66e647', w: 36, h: 36 },
  mushroom_warrior: { style: 'mushroom', hi: '#ff6666', mid: '#d92138', dark: '#781024', acc: '#fff2cc', w: 36, h: 36 },
  toxic_slug: { style: 'slug', hi: '#a8ff59', mid: '#4ec426', dark: '#1f6e24', acc: '#ff4dd2' },
  neural_spider: { style: 'spider', hi: '#a878ff', mid: '#5e2eb8', dark: '#2b125c', acc: '#59f2ff' },
  salamander: { style: 'lizard', hi: '#ff9e42', mid: '#e04819', dark: '#7a1919', acc: '#ffe84d' },
  big_jelly: { style: 'jelly', hi: '#94f7ff', mid: '#38b8e6', dark: '#1c5899', acc: '#ff70d9', w: 38, h: 38 },
  mini_jelly: { style: 'jelly', hi: '#c2ffff', mid: '#59d2ff', dark: '#2473b8', acc: '#ffd866', w: 28, h: 28 },
  bombalon: { style: 'bomb', hi: '#707894', mid: '#3b4059', dark: '#1e2033', acc: '#ff8a1d' },
  mystic_wheel: { style: 'spikeball', hi: '#ffe066', mid: '#c7831f', dark: '#6b3b0e', acc: '#b84dff' },
  puncher_pig: { style: 'pig', hi: '#ffa8ba', mid: '#e06685', dark: '#8c2d4a', acc: '#ffd84d', w: 36, h: 36 },
  launcher_pig: { style: 'pig', hi: '#ffb8a8', mid: '#cc5247', dark: '#732124', acc: '#ff8a1d', w: 36, h: 36 },
  eagle_cannon: { style: 'bird', hi: '#ffd480', mid: '#c77c2e', dark: '#6b3614', acc: '#59f2ff', w: 38, h: 36 },
  vulture: { style: 'bird', hi: '#ba99c7', mid: '#78528c', dark: '#3d244d', acc: '#ff667a', w: 36, h: 32 },
  spike_turtle: { style: 'turtle', hi: '#82e666', mid: '#389938', dark: '#1a5228', acc: '#ffe666' },
  fire_lizard: { style: 'lizard', hi: '#ff7a4d', mid: '#cc1f2b', dark: '#6e0d1c', acc: '#ffe640' },
  sand_worm: { style: 'worm', hi: '#ffe094', mid: '#d48f3d', dark: '#7a4219', acc: '#38ebd9', w: 36, h: 36 },
  botmerang: { style: 'spikeball', hi: '#8cf2ff', mid: '#2b99cc', dark: '#144778', acc: '#ffe838' },
  floating_sword: { style: 'sword', hi: '#e6f5ff', mid: '#8fa8cc', dark: '#425273', acc: '#ff4fa3', w: 36, h: 36 },
  zeppelin: { style: 'zeppelin', hi: '#ff9670', mid: '#c74238', dark: '#6b1c24', acc: '#ffd84d', w: 40, h: 34 },
  atom_eye: { style: 'eye', hi: '#94ffff', mid: '#2bc4e6', dark: '#145880', acc: '#ffe838' },
  mummy: { style: 'mummy', hi: '#fff2d6', mid: '#cbb28c', dark: '#786047', acc: '#38ebd9', w: 32, h: 36 },
  scavenger: { style: 'bird', hi: '#d9a870', mid: '#945d32', dark: '#4d2914', acc: '#ff5268' },
  ghost_crow: { style: 'ghost', hi: '#a3ffe6', mid: '#3bc7a3', dark: '#185c5c', acc: '#ff59b8' },
  ghost_owl: { style: 'ghost', hi: '#b8ffcf', mid: '#42bf88', dark: '#1b6352', acc: '#ffe866' },
  ghost_pig: { style: 'ghost', hi: '#c2ffed', mid: '#4dd4b0', dark: '#1c6e66', acc: '#ff66a3', w: 36, h: 36 },
};

function bakeEnemy(spec: EnemyVisualSpec): EnemySpriteSet {
  const fw = spec.w ?? 32;
  const fh = spec.h ?? 32;
  const sheet = new PixelBuf(fw * 2, fh);
  const b = new PixelBuf(fw, fh);
  const hi = hexToAbgr(spec.hi);
  const mid = hexToAbgr(spec.mid);
  const dark = hexToAbgr(spec.dark);
  const acc = hexToAbgr(spec.acc);
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  const cx = fw >> 1;
  const cy = (fh >> 1) + 2;

  for (let f = 0; f < 2; f++) {
    b.clear();
    const bob = f === 1 ? -1 : 0;

    switch (spec.style) {
      case 'blob':
        b.ellipse(cx - 5 + f * 2, fh - 5, 3.5, 2.5, dark);
        b.ellipse(cx + 5 - f * 2, fh - 5, 3.5, 2.5, dark);
        b.ellipseShaded(cx, cy + bob, 10, 8.5, hi, mid, dark, cWhite);
        b.rect(cx - 5, cy - 3 + bob, 3, 4, cWhite);
        b.rect(cx + 2, cy - 3 + bob, 3, 4, cWhite);
        b.rect(cx - 4, cy - 2 + bob, 2, 3, cOut);
        b.rect(cx + 3, cy - 2 + bob, 2, 3, cOut);
        b.line(cx - 5, cy - 4 + bob, cx - 1, cy - 2 + bob, cOut);
        b.line(cx + 5, cy - 4 + bob, cx + 1, cy - 2 + bob, cOut);
        b.px(cx - 2, cy + 4 + bob, acc);
        b.px(cx + 2, cy + 4 + bob, acc);
        break;

      case 'winged': {
        const wingY = f === 0 ? -5 : 2;
        b.ellipse(cx - 10, cy - 2 + wingY, 5.5, 3.5, acc);
        b.ellipse(cx + 10, cy - 2 + wingY, 5.5, 3.5, acc);
        b.ellipseShaded(cx, cy + bob, 8.5, 7.5, hi, mid, dark, cWhite);
        b.rect(cx - 4, cy - 2 + bob, 3, 3, cWhite);
        b.rect(cx + 1, cy - 2 + bob, 3, 3, cWhite);
        b.px(cx - 3, cy - 1 + bob, cOut);
        b.px(cx + 2, cy - 1 + bob, cOut);
        break;
      }

      case 'spitter':
        b.rect(cx - 6, fh - 6, 12, 4, dark);
        b.ellipseShaded(cx, cy + bob, 9.5, 9, hi, mid, dark);
        // Puffed snout & glowing venom mouth
        b.ellipse(cx + 8, cy + bob, 4.5, 4 + f, acc);
        b.ellipse(cx + 9, cy + bob, 2, 2, cOut);
        b.rect(cx - 3, cy - 4 + bob, 3, 3, cWhite);
        b.px(cx - 2, cy - 3 + bob, cOut);
        break;

      case 'beetle':
        // Thick armored dome + gleaming curved horn!
        b.ellipseShaded(cx, cy + 1 + bob, 11, 8, hi, mid, dark, cWhite);
        b.tri(cx + 6, cy - 2 + bob, cx + 14, cy - 9 + bob, cx + 11, cy + 1 + bob, acc);
        b.tri(cx - 2, cy - 6 + bob, cx, cy - 11 + bob, cx + 2, cy - 6 + bob, acc);
        b.rect(cx + 3, cy + bob, 3, 3, cWhite);
        b.px(cx + 4, cy + 1 + bob, cOut);
        b.rect(cx - 7 + f * 2, fh - 5, 3, 3, dark);
        b.rect(cx + 4 - f * 2, fh - 5, 3, 3, dark);
        break;

      case 'bee': {
        const wy = f === 0 ? -7 : -3;
        b.ellipse(cx - 2, cy + wy, 5, 3.5, acc);
        b.ellipse(cx + 4, cy + wy, 4.5, 3, acc);
        b.ellipseShaded(cx, cy + bob, 10, 7, hi, mid, dark);
        b.rect(cx - 4, cy - 6 + bob, 3, 12, dark);
        b.rect(cx + 2, cy - 6 + bob, 3, 12, dark);
        b.tri(cx - 9, cy + 1 + bob, cx - 14, cy + 3 + bob, cx - 9, cy + 4 + bob, dark);
        b.rect(cx + 5, cy - 2 + bob, 3, 3, cWhite);
        b.px(cx + 6, cy - 1 + bob, cOut);
        break;
      }

      case 'frog':
        b.ellipse(cx - 7, fh - 5, 4, 2.5, dark);
        b.ellipse(cx + 7, fh - 5, 4, 2.5, dark);
        b.ellipseShaded(cx, cy + 2 + bob, 10, 7.5, hi, mid, dark);
        b.ellipse(cx - 4, cy - 5 + bob, 3.5, 3.5, acc);
        b.ellipse(cx + 4, cy - 5 + bob, 3.5, 3.5, acc);
        b.px(cx - 3, cy - 5 + bob, cOut);
        b.px(cx + 5, cy - 5 + bob, cOut);
        b.ellipse(cx + 1, cy + 4 + bob, 5, 2.5 + f * 0.8, acc);
        break;

      case 'plant':
        // Leafy stalk + snapping crimson toothed maw
        b.rect(cx - 3, cy + 4, 6, 12, acc);
        b.ellipse(cx - 8, fh - 6, 5, 3, acc);
        b.ellipse(cx + 8, fh - 6, 5, 3, acc);
        b.ellipseShaded(cx, cy - 4 + bob, 11, 9, hi, mid, dark);
        b.rect(cx - 8, cy - 6 + bob, 16, 4 + f * 2, cOut);
        for (let tx = -6; tx <= 6; tx += 4) {
          b.px(cx + tx, cy - 6 + bob, cWhite);
          b.px(cx + tx + 1, cy - 2 + bob + f, cWhite);
        }
        break;

      case 'mushroom':
        // Fierce spotted toadstool knight with spear & shield!
        b.ellipseShaded(cx, cy + 4 + bob, 7, 7, cWhite, acc, dark);
        b.ellipseShaded(cx, cy - 4 + bob, 12, 7.5, hi, mid, dark);
        b.ellipse(cx - 5, cy - 6 + bob, 2.2, 2, cWhite);
        b.ellipse(cx + 4, cy - 5 + bob, 2.5, 2, cWhite);
        b.rect(cx - 3, cy + 2 + bob, 2, 3, cOut);
        b.rect(cx + 2, cy + 2 + bob, 2, 3, cOut);
        // Tiny shield + spear
        b.rect(cx + 8, cy + 1 + bob, 5, 8, hi);
        b.line(cx - 10, cy - 8 + f * 2, cx - 10, fh - 4, dark);
        b.tri(cx - 12, cy - 6 + f * 2, cx - 10, cy - 13 + f * 2, cx - 8, cy - 6 + f * 2, cWhite);
        break;

      case 'spikeball':
        b.ellipseShaded(cx, cy - 1, 8.5, 8.5, hi, mid, dark, cWhite);
        for (let a = 0; a < 8; a++) {
          const th = (a / 8) * Math.PI * 2 + f * 0.35;
          const sx = cx + Math.round(Math.cos(th) * 12);
          const sy = cy - 1 + Math.round(Math.sin(th) * 12);
          b.line(cx + Math.round(Math.cos(th) * 7), cy - 1 + Math.round(Math.sin(th) * 7), sx, sy, acc);
          b.px(sx, sy, cWhite);
        }
        b.rect(cx - 3, cy - 3, 2, 3, acc);
        b.rect(cx + 2, cy - 3, 2, 3, acc);
        break;

      case 'slug':
        b.ellipseShaded(cx - 2, cy + 4, 11 + f, 5.5, hi, mid, dark);
        b.ellipseShaded(cx + 6, cy + bob, 5, 5, hi, mid, dark);
        b.line(cx + 6, cy - 4 + bob, cx + 8, cy - 9 + bob, acc);
        b.line(cx + 9, cy - 3 + bob, cx + 12, cy - 8 + bob, acc);
        b.px(cx + 8, cy - 9 + bob, cWhite);
        b.px(cx + 12, cy - 8 + bob, cWhite);
        break;

      case 'spider':
        for (let l = -1; l <= 1; l++) {
          const ly = cy + l * 3 + (f === 0 ? l : -l);
          b.line(cx - 6, cy, cx - 13, ly + 4, dark);
          b.line(cx + 6, cy, cx + 13, ly + 4, dark);
        }
        b.ellipseShaded(cx, cy + bob, 8, 7, hi, mid, dark);
        b.rect(cx - 4, cy - 1 + bob, 2, 2, acc);
        b.rect(cx, cy - 2 + bob, 2, 2, acc);
        b.rect(cx + 3, cy - 1 + bob, 2, 2, acc);
        break;

      case 'lizard':
        b.tri(cx - 6, cy + 2, cx - 14, cy + 5 - f * 2, cx - 6, cy + 6, mid);
        b.ellipseShaded(cx, cy + 2 + bob, 9.5, 6, hi, mid, dark);
        b.ellipseShaded(cx + 7, cy - 2 + bob, 5.5, 4.5, hi, mid, dark);
        b.px(cx + 9, cy - 3 + bob, acc);
        b.rect(cx - 4 + f * 2, fh - 5, 3, 3, dark);
        b.rect(cx + 5 - f * 2, fh - 5, 3, 3, dark);
        break;

      case 'jelly':
        b.ellipseShaded(cx, cy - 3 + bob, (fw * 0.34) | 0, (fh * 0.28) | 0, hi, mid, dark, cWhite);
        for (let t = -2; t <= 2; t++) {
          const tx = cx + t * 4;
          b.line(tx, cy + 3 + bob, tx + (f === 0 ? 1 : -1), fh - 3, acc);
        }
        b.rect(cx - 4, cy - 4 + bob, 2, 3, cOut);
        b.rect(cx + 2, cy - 4 + bob, 2, 3, cOut);
        break;

      case 'bomb':
        b.ellipseShaded(cx, cy + 1 + bob, 9.5, 9.5, hi, mid, dark, cWhite);
        b.rect(cx - 3, cy - 10 + bob, 6, 3, dark);
        b.line(cx, cy - 10 + bob, cx + 4, cy - 14 + bob, acc);
        b.ellipse(cx + 5, cy - 14 + bob, 2 + f, 2 + f, f === 0 ? acc : cWhite);
        b.rect(cx - 4, cy - 1 + bob, 3, 3, acc);
        b.rect(cx + 2, cy - 1 + bob, 3, 3, acc);
        break;

      case 'pig':
        b.ellipseShaded(cx, cy + 1 + bob, 11, 9.5, hi, mid, dark, cWhite);
        b.tri(cx - 8, cy - 6 + bob, cx - 11, cy - 12 + bob, cx - 3, cy - 8 + bob, mid);
        b.tri(cx + 8, cy - 6 + bob, cx + 11, cy - 12 + bob, cx + 3, cy - 8 + bob, mid);
        b.ellipse(cx + 4, cy + 2 + bob, 4.5, 3.2, hi);
        b.px(cx + 3, cy + 2 + bob, dark);
        b.px(cx + 5, cy + 2 + bob, dark);
        b.rect(cx - 2, cy - 3 + bob, 3, 3, cWhite);
        b.px(cx - 1, cy - 2 + bob, cOut);
        b.ellipse(cx + 11, cy + 3 + bob, 4, 4, acc);
        break;

      case 'bird': {
        const flap = f === 0 ? -6 : 4;
        b.tri(cx - 3, cy, cx - 15, cy + flap, cx - 3, cy + 5, dark);
        b.tri(cx + 3, cy, cx + 14, cy + flap, cx + 3, cy + 5, mid);
        b.ellipseShaded(cx, cy + bob, 8.5, 7, hi, mid, dark);
        b.tri(cx + 7, cy - 2 + bob, cx + 14, cy + 1 + bob, cx + 7, cy + 3 + bob, acc);
        b.rect(cx + 2, cy - 3 + bob, 3, 3, cWhite);
        b.px(cx + 3, cy - 2 + bob, cOut);
        break;
      }

      case 'turtle':
        b.ellipseShaded(cx - 1, cy + 1 + bob, 10, 7.5, hi, mid, dark);
        b.tri(cx - 5, cy - 5 + bob, cx - 3, cy - 11 + bob, cx - 1, cy - 5 + bob, acc);
        b.tri(cx + 1, cy - 5 + bob, cx + 3, cy - 11 + bob, cx + 5, cy - 5 + bob, acc);
        b.ellipse(cx + 9, cy + 2 + bob, 4, 3.5, hi);
        b.px(cx + 10, cy + 1 + bob, cOut);
        break;

      case 'worm':
        for (let s = 0; s < 4; s++) {
          const sy = fh - 5 - s * 6;
          const sx = cx + Math.round(Math.sin(s * 1.3 + f * 1.5) * 4);
          b.ellipseShaded(sx, sy, 6.5 - s * 0.4, 5, hi, mid, dark);
        }
        b.rect(cx - 3, 9, 2, 2, acc);
        b.rect(cx + 2, 9, 2, 2, acc);
        break;

      case 'sword':
        b.tri(cx, 3 + bob, cx - 4, 14 + bob, cx + 4, 14 + bob, hi);
        b.rect(cx - 3, 14 + bob, 6, 12, mid);
        b.rect(cx - 9, 24 + bob, 18, 3, acc);
        b.rect(cx - 2, 27 + bob, 4, 6, dark);
        b.px(cx, 25 + bob, cWhite);
        break;

      case 'zeppelin':
        b.ellipseShaded(cx, cy - 3 + bob, 15, 9, hi, mid, dark, cWhite);
        b.rect(cx - 6, cy + 6 + bob, 12, 5, dark);
        b.rect(cx - 4, cy + 7 + bob, 8, 2, acc);
        b.rect(cx - 17, cy - 5 + bob + f, 3, 6, acc);
        break;

      case 'eye':
        b.ellipseShaded(cx, cy - 1 + bob, 10, 10, cWhite, hi, mid);
        b.ellipse(cx + 2, cy - 1 + bob, 4.5, 4.5, dark);
        b.ellipse(cx + 3, cy - 1 + bob, 2, 2, acc);
        b.px(cx - 8, cy - 1 + (f === 0 ? -5 : 5), acc);
        b.px(cx + 9, cy - 1 + (f === 0 ? 5 : -5), acc);
        break;

      case 'mummy':
        b.rect(cx - 7, 10 + bob, 14, 21, mid);
        for (let y = 12; y < 29; y += 4) {
          b.rect(cx - 7, y + bob, 14, 2, hi);
        }
        b.rect(cx - 5, 13 + bob, 10, 4, dark);
        b.rect(cx - 3, 14 + bob, 2, 2, acc);
        b.rect(cx + 2, 14 + bob, 2, 2, acc);
        b.rect(cx + 6, 18 + bob, 6, 3, hi);
        break;

      case 'ghost':
        b.ellipseShaded(cx, cy - 2 + bob, 10, 9.5, hi, mid, dark, cWhite);
        b.tri(cx - 9, cy + 3 + bob, cx - 7, fh - 3 + f, cx - 3, cy + 5 + bob, mid);
        b.tri(cx - 3, cy + 5 + bob, cx, fh - 2 - f, cx + 3, cy + 5 + bob, mid);
        b.tri(cx + 3, cy + 5 + bob, cx + 7, fh - 3 + f, cx + 9, cy + 3 + bob, mid);
        b.rect(cx - 5, cy - 4 + bob, 3, 4, acc);
        b.rect(cx + 2, cy - 4 + bob, 3, 4, acc);
        break;
    }

    b.outline(cOut);
    sheet.blit(b, f * fw, 0);
  }

  return {
    sheet: sheet.toCanvas(),
    flash: sheet.toWhiteFlashCanvas(),
    frameW: fw,
    frameH: fh,
  };
}

// ============================================================================
// All 8 Bosses (Flagship Primal Eye 96x96 + Stylized 80x80..96x96 Bosses)
// ============================================================================

function bakeBosses(): {
  bosses: Map<BossId, BossSpriteSet>;
  primalEyeParts: { iris: HTMLCanvasElement; tendril: HTMLCanvasElement };
} {
  const bosses = new Map<BossId, BossSpriteSet>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // 1) PRIMAL EYE (96x96 massive pulsing organic bark-and-violet eyeball!)
  {
    const fw = 96;
    const fh = 96;
    const sheet = new PixelBuf(fw * 2, fh);
    const b = new PixelBuf(fw, fh);
    const barkHi = hexToAbgr('#c27d47');
    const barkMid = hexToAbgr('#824929');
    const barkDark = hexToAbgr('#472219');
    const mossHi = hexToAbgr('#9ef53d');
    const mossMid = hexToAbgr('#4cb828');
    const scleraHi = hexToAbgr('#fff8e6');
    const scleraMid = hexToAbgr('#ebd6b8');
    const vein = hexToAbgr('#cc3b73');

    for (let f = 0; f < 2; f++) {
      b.clear();
      const pulse = f === 1 ? 2 : 0;
      const cx = 48;
      const cy = 48;

      // Spiky ancient bark crown & root horns radiating from outer body
      for (let a = 0; a < 10; a++) {
        const th = (a / 10) * Math.PI * 2 + f * 0.08;
        const x1 = cx + Math.round(Math.cos(th - 0.18) * 32);
        const y1 = cy + Math.round(Math.sin(th - 0.18) * 32);
        const x2 = cx + Math.round(Math.cos(th + 0.18) * 32);
        const y2 = cy + Math.round(Math.sin(th + 0.18) * 32);
        const tipX = cx + Math.round(Math.cos(th) * (44 + (a % 2) * 3));
        const tipY = cy + Math.round(Math.sin(th) * (44 + (a % 2) * 3));
        b.tri(x1, y1, tipX, tipY, x2, y2, a % 2 === 0 ? barkMid : mossMid);
      }

      // Main pulsing organic eye socket shell
      b.ellipseShaded(cx, cy, 36 + pulse, 34 - pulse * 0.5, barkHi, barkMid, barkDark);
      // Lush moss crown across top brow
      b.ellipseShaded(cx, cy - 22, 28, 10, mossHi, mossMid, barkDark);
      // Glowing veined cream sclera
      b.ellipseShaded(cx, cy, 27 + pulse * 0.5, 24, scleraHi, scleraMid, hexToAbgr('#bfa091'), cWhite);
      // Organic crimson veins
      b.line(cx - 24, cy - 6, cx - 15, cy - 3, vein);
      b.line(cx - 22, cy + 8, cx - 14, cy + 5, vein);
      b.line(cx + 24, cy - 5, cx + 16, cy - 2, vein);
      b.line(cx + 21, cy + 9, cx + 14, cy + 6, vein);

      // Thick upper & lower bark eyelids
      b.ellipse(cx, cy - 23, 24, 6, barkDark);
      b.ellipse(cx, cy + 23, 22, 5, barkDark);

      b.outline(cOut);
      sheet.blit(b, f * fw, 0);
    }
    bosses.set('primal_eye', {
      sheet: sheet.toCanvas(),
      flash: sheet.toWhiteFlashCanvas(),
      frameW: fw,
      frameH: fh,
    });
  }

  // Primal Eye dynamic tracking iris (28x28) + orbiting thorny vine bulb (24x24)
  const irisBuf = new PixelBuf(28, 28);
  irisBuf.ellipseShaded(
    14,
    14,
    11,
    11,
    hexToAbgr('#c7ff4d'),
    hexToAbgr('#38cc38'),
    hexToAbgr('#125930'),
  );
  irisBuf.ellipse(14, 14, 7.5, 7.5, hexToAbgr('#ffae24'));
  // Vertical reptilian slit pupil
  irisBuf.ellipse(14, 14, 3, 8.5, cOut);
  irisBuf.rect(10, 8, 3, 3, cWhite);
  irisBuf.px(17, 17, cWhite);
  irisBuf.outline(cOut);

  const tendrilBuf = new PixelBuf(24, 24);
  tendrilBuf.ellipseShaded(
    12,
    12,
    8,
    8,
    hexToAbgr('#a8ff4d'),
    hexToAbgr('#3ca626'),
    hexToAbgr('#195420'),
    cWhite,
  );
  tendrilBuf.tri(12, 1, 9, 6, 15, 6, hexToAbgr('#ff427a'));
  tendrilBuf.tri(12, 23, 9, 18, 15, 18, hexToAbgr('#ff427a'));
  tendrilBuf.tri(1, 12, 6, 9, 6, 15, hexToAbgr('#ff427a'));
  tendrilBuf.tri(23, 12, 18, 9, 18, 15, hexToAbgr('#ff427a'));
  tendrilBuf.outline(cOut);

  // Remaining 7 Bosses (bespoke pixel silhouettes!)
  const otherBosses: ReadonlyArray<{
    id: BossId;
    hi: string;
    mid: string;
    dark: string;
    acc: string;
    eye: string;
    shape: 'dino' | 'boar' | 'skull' | 'bull' | 'sphinx' | 'shadow' | 'sovereign';
  }> = [
    {
      id: 'dino_behemoth',
      hi: '#78e659',
      mid: '#2e9938',
      dark: '#144f28',
      acc: '#ffd84d',
      eye: '#ff3858',
      shape: 'dino',
    },
    {
      id: 'magma_boar_king',
      hi: '#ff8a24',
      mid: '#cc291f',
      dark: '#4d1424',
      acc: '#ffe84d',
      eye: '#fff799',
      shape: 'boar',
    },
    {
      id: 'bone_colossus',
      hi: '#fff2d6',
      mid: '#cbb594',
      dark: '#6e5847',
      acc: '#38ebd9',
      eye: '#38ebd9',
      shape: 'skull',
    },
    {
      id: 'mecha_bull',
      hi: '#c4cfde',
      mid: '#6c7a94',
      dark: '#333b52',
      acc: '#ffad16',
      eye: '#ff2b4a',
      shape: 'bull',
    },
    {
      id: 'electro_sphinx',
      hi: '#ffe866',
      mid: '#d4961f',
      dark: '#6e4214',
      acc: '#59f2ff',
      eye: '#59f2ff',
      shape: 'sphinx',
    },
    {
      id: 'shadow_doppelganger',
      hi: '#9e38d4',
      mid: '#4d1473',
      dark: '#1d0d29',
      acc: '#ff006a',
      eye: '#24ff78',
      shape: 'shadow',
    },
    {
      id: 'nightmare_sovereign',
      hi: '#ff3b9a',
      mid: '#781480',
      dark: '#1c0829',
      acc: '#24ff78',
      eye: '#ffe838',
      shape: 'sovereign',
    },
  ];

  for (let i = 0; i < otherBosses.length; i++) {
    const spec = otherBosses[i]!;
    const fw = 84;
    const fh = 84;
    const sheet = new PixelBuf(fw * 2, fh);
    const b = new PixelBuf(fw, fh);
    const hi = hexToAbgr(spec.hi);
    const mid = hexToAbgr(spec.mid);
    const dark = hexToAbgr(spec.dark);
    const acc = hexToAbgr(spec.acc);
    const eye = hexToAbgr(spec.eye);

    for (let f = 0; f < 2; f++) {
      b.clear();
      const bob = f === 1 ? -2 : 0;
      const cx = 42;
      const cy = 44 + bob;

      if (spec.shape === 'dino') {
        b.ellipseShaded(cx - 4, cy + 6, 24, 20, hi, mid, dark);
        b.ellipseShaded(cx + 12, cy - 14, 18, 13, hi, mid, dark, cWhite);
        // Back spines + teeth
        for (let s = 0; s < 4; s++) {
          b.tri(cx - 24 + s * 6, cy - 8 - s * 3, cx - 28 + s * 6, cy - 16 - s * 3, cx - 18 + s * 6, cy - 10 - s * 3, acc);
        }
        b.rect(cx + 14, cy - 18, 5, 5, eye);
        b.rect(cx + 10, cy - 5, 16, 4, cWhite);
      } else if (spec.shape === 'boar') {
        b.ellipseShaded(cx, cy + 2, 28, 22, hi, mid, dark);
        // Blazing crown + tusks
        b.tri(cx - 14, cy - 18, cx - 8, cy - 34, cx, cy - 18, acc);
        b.tri(cx - 4, cy - 18, cx + 4, cy - 36, cx + 12, cy - 18, acc);
        b.tri(cx - 24, cy + 8, cx - 34, cy - 6, cx - 18, cy + 2, cWhite);
        b.tri(cx + 24, cy + 8, cx + 34, cy - 6, cx + 18, cy + 2, cWhite);
        b.rect(cx - 12, cy - 6, 6, 5, eye);
        b.rect(cx + 6, cy - 6, 6, 5, eye);
      } else if (spec.shape === 'skull') {
        // Towering desert skull golem with spirit flame core
        b.ellipseShaded(cx, cy - 10, 22, 18, hi, mid, dark, cWhite);
        b.rect(cx - 14, cy + 6, 28, 14, mid);
        b.rect(cx - 10, cy + 20, 20, 14, dark);
        b.ellipse(cx, cy + 24, 8, 8, acc);
        b.ellipse(cx - 9, cy - 10, 6, 6, cOut);
        b.ellipse(cx + 9, cy - 10, 6, 6, cOut);
        b.ellipse(cx - 9, cy - 10, 3, 3, eye);
        b.ellipse(cx + 9, cy - 10, 3, 3, eye);
      } else if (spec.shape === 'bull') {
        b.rect(cx - 24, cy - 14, 48, 36, mid);
        b.rect(cx - 22, cy - 12, 44, 6, hi);
        // Giant curved brass bull horns
        b.tri(cx - 24, cy - 8, cx - 38, cy - 28, cx - 18, cy - 14, acc);
        b.tri(cx + 24, cy - 8, cx + 38, cy - 28, cx + 18, cy - 14, acc);
        // Glowing red cyclops visor
        b.rect(cx - 16, cy - 4, 32, 6, cOut);
        b.rect(cx - 12 + f * 4, cy - 3, 20, 4, eye);
        b.ellipse(cx, cy + 12, 7, 5, acc);
      } else if (spec.shape === 'sphinx') {
        // Winged electric guardian sphinx
        b.tri(cx - 16, cy, cx - 40, cy - 16 + f * 6, cx - 18, cy + 14, acc);
        b.tri(cx + 16, cy, cx + 40, cy - 16 + f * 6, cx + 18, cy + 14, acc);
        b.ellipseShaded(cx, cy + 4, 22, 18, hi, mid, dark);
        b.rect(cx - 18, cy - 22, 36, 16, mid);
        b.rect(cx - 14, cy - 20, 28, 3, acc);
        b.rect(cx - 10, cy - 12, 5, 4, eye);
        b.rect(cx + 5, cy - 12, 5, 4, eye);
      } else if (spec.shape === 'shadow') {
        // Giant menacing mirror-Krunk with jagged shadow aura!
        b.ellipseShaded(cx, cy + 2, 24, 23, hi, mid, dark);
        b.tri(cx - 18, cy - 14, cx - 28, cy - 36, cx - 6, cy - 18, acc);
        b.tri(cx + 18, cy - 14, cx + 28, cy - 36, cx + 6, cy - 18, acc);
        b.rect(cx - 12, cy - 6, 8, 9, acc);
        b.rect(cx + 4, cy - 6, 8, 9, acc);
        b.rect(cx - 9, cy - 4, 4, 5, eye);
        b.rect(cx + 6, cy - 4, 4, 5, eye);
      } else {
        // Nightmare Sovereign — crowned eldritch eclipse tyrant!
        b.tri(cx - 28, cy + 28, cx, cy - 12, cx + 28, cy + 28, dark);
        b.ellipseShaded(cx, cy - 6, 24, 22, hi, mid, dark);
        // 3-point neon rift crown
        b.tri(cx - 20, cy - 22, cx - 24, cy - 38, cx - 10, cy - 24, acc);
        b.tri(cx - 8, cy - 24, cx, cy - 40, cx + 8, cy - 24, acc);
        b.tri(cx + 10, cy - 24, cx + 24, cy - 38, cx + 20, cy - 22, acc);
        // Tri-eye eldritch gaze
        b.ellipse(cx - 10, cy - 6, 5, 5, eye);
        b.ellipse(cx + 10, cy - 6, 5, 5, eye);
        b.ellipse(cx, cy - 16, 4.5, 4.5, acc);
        b.px(cx - 10, cy - 6, cOut);
        b.px(cx + 10, cy - 6, cOut);
        b.px(cx, cy - 16, cOut);
      }

      b.outline(cOut);
      sheet.blit(b, f * fw, 0);
    }

    bosses.set(spec.id, {
      sheet: sheet.toCanvas(),
      flash: sheet.toWhiteFlashCanvas(),
      frameW: fw,
      frameH: fh,
    });
  }

  return {
    bosses,
    primalEyeParts: {
      iris: irisBuf.toCanvas(),
      tendril: tendrilBuf.toCanvas(),
    },
  };
}

// ============================================================================
// ProceduralPixelAtlas Container
// ============================================================================

export class ProceduralPixelAtlas {
  public ready = false;
  public readonly heroSheets = new Map<HeroFormId, HeroSpriteSet>();
  public readonly biomeTilesets = new Map<BiomeId, HTMLCanvasElement>();
  public readonly biomeDeco = new Map<BiomeId, HTMLCanvasElement>();
  public readonly biomeParallax = new Map<BiomeId, BiomeParallaxSet>();
  public readonly specialTiles = new Map<string, HTMLCanvasElement>();
  public readonly props = new Map<string, HTMLCanvasElement>();
  public readonly npcs = new Map<ShopId, HTMLCanvasElement>();
  public readonly collectibles = new Map<string, HTMLCanvasElement>();
  public readonly projectiles = new Map<ProjectileRuntime['kind'], HTMLCanvasElement>();
  public readonly enemies = new Map<EnemyArchetypeId, EnemySpriteSet>();
  public readonly bosses = new Map<BossId, BossSpriteSet>();
  public primalEyeIris: HTMLCanvasElement | null = null;
  public primalEyeTendril: HTMLCanvasElement | null = null;

  constructor() {
    this.bakeIfBrowser();
  }

  public bakeIfBrowser(): void {
    if (this.ready || typeof document === 'undefined') return;
    this.ready = true;

    // 1. All 6 Hero Forms
    for (let i = 0; i < HERO_FORMS.length; i++) {
      const form = HERO_FORMS[i]!;
      this.heroSheets.set(form, bakeHeroForm(form));
    }

    // 2. All 11 Biome 16-Mask Tilesets + Surface Deco + 3-Layer Parallax
    for (let i = 0; i < BIOME_IDS.length; i++) {
      const biome = BIOME_IDS[i]!;
      const pal = BIOME_PALETTES[biome];
      this.biomeTilesets.set(biome, bakeBiomeTileset(pal));
      this.biomeDeco.set(biome, bakeBiomeDeco(pal));
      this.biomeParallax.set(biome, bakeBiomeParallax(pal));
    }

    // 3. Special tiles, props, NPCs, collectibles, projectiles
    for (const [k, v] of bakeSpecialTiles()) this.specialTiles.set(k, v);
    for (const [k, v] of bakeProps()) this.props.set(k, v);
    for (const [k, v] of bakeHubNpcs()) this.npcs.set(k, v);
    for (const [k, v] of bakeCollectibles()) this.collectibles.set(k, v);
    for (const [k, v] of bakeProjectiles()) this.projectiles.set(k, v);

    // 4. All 34 Enemy Archetypes
    const enemyIds = Object.keys(ENEMY_VISUALS) as EnemyArchetypeId[];
    for (let i = 0; i < enemyIds.length; i++) {
      const id = enemyIds[i]!;
      this.enemies.set(id, bakeEnemy(ENEMY_VISUALS[id]));
    }

    // 5. All 8 Bosses + Primal Eye dynamic parts
    const bakedBosses = bakeBosses();
    for (const [k, v] of bakedBosses.bosses) this.bosses.set(k, v);
    this.primalEyeIris = bakedBosses.primalEyeParts.iris;
    this.primalEyeTendril = bakedBosses.primalEyeParts.tendril;
  }
}
