/**
 * Krunked Quest — Procedural 16-Bit Pixel-Art Sprite Atlas
 * Pre-bakes crisp nearest-neighbor spritesheets at boot onto offscreen HTMLCanvasElements.
 * Handles headless/Node environments gracefully (no DOM dependency until bake()).
 * Zero third-party proper nouns.
 */

import {
  HERO_FORMS,
  type BiomeId,
  type BossId,
  type EnemyArchetypeId,
  type HeroFormId,
  type ProjectileRuntime,
  type ShopId,
} from '../contracts/index.js';
import {
  FLASH_WHITE,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
  hexToAbgr,
  mixHex,
} from './palettes.js';
import { getBuiltInWorldArt, type BiomeParallaxSet } from './BiomeArtBaker.js';

export type { BiomeParallaxSet };

export const HERO_STD_FRAME_W = 36;
export const HERO_STD_FRAME_H = 36;
export const HERO_STD_FRAME_COUNT = 12;

export const HERO_ACT_FRAME_W = 48;
export const HERO_ACT_FRAME_H = 48;
export const HERO_ACT_FRAME_COUNT = 10;

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
  Tongue0 = 6,
  Tongue1 = 7,
  Dive0 = 8,
  Blink0 = 9,
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


// ============================================================================
// Hero Baking (All 6 Elemental Forms: 36x36 Standard + 48x48 Action)
// Authentic chunky blocky-creature silhouette with oversized glossy protruding
// tongue, expressive tall pixel eyes, buck teeth, and distinct elemental gear!
// ============================================================================

interface HeroTongueColors {
  readonly hi: number;
  readonly mid: number;
  readonly dark: number;
  readonly spec: number;
}

function getHeroTongueColors(form: HeroFormId, p: readonly number[]): HeroTongueColors {
  const white = hexToAbgr(HIGHLIGHT_CREAM);
  switch (form) {
    case 'krunk_basic':
      return {
        hi: hexToAbgr('#ff4d6d'),
        mid: hexToAbgr('#da0b35'),
        dark: hexToAbgr('#800824'),
        spec: white,
      };
    case 'krunk_fire':
      return {
        hi: hexToAbgr('#fff066'),
        mid: hexToAbgr('#ff8a00'),
        dark: hexToAbgr('#b83800'),
        spec: white,
      };
    case 'krunk_leaf':
      return {
        hi: hexToAbgr('#c84dff'),
        mid: hexToAbgr('#7a12b8'),
        dark: hexToAbgr('#451d49'),
        spec: white,
      };
    case 'krunk_rock':
      return {
        hi: hexToAbgr('#94a0a8'),
        mid: hexToAbgr('#626d75'),
        dark: hexToAbgr('#384047'),
        spec: hexToAbgr('#d8e2e8'),
      };
    case 'krunk_electric':
      return {
        hi: hexToAbgr('#c8ffff'),
        mid: hexToAbgr('#22c8ff'),
        dark: hexToAbgr('#1248d8'),
        spec: white,
      };
    case 'krunk_shadow':
      return {
        hi: hexToAbgr('#78ff4d'),
        mid: hexToAbgr('#18c700'),
        dark: hexToAbgr('#0b6b18'),
        spec: hexToAbgr('#e0ffcc'),
      };
    default:
      return { hi: p[4]!, mid: p[3]!, dark: p[2]!, spec: white };
  }
}

function drawHeroHeadgear(
  b: PixelBuf,
  form: HeroFormId,
  cx: number,
  topY: number,
  p: readonly number[],
  phase: number,
  flutter: number,
): void {
  const white = hexToAbgr(HIGHLIGHT_CREAM);
  const dark = hexToAbgr(OUTLINE_DARK);

  if (form === 'krunk_basic') {
    // Signature twin blocky notched top horns / ears (M-like silhouette notch)
    b.rect(cx - 8, topY - 2, 6, 4, p[0]!);
    b.rect(cx + 2, topY - 2, 6, 4, p[0]!);
    b.rect(cx - 7, topY - 2, 4, 1, p[4]!);
    b.rect(cx + 3, topY - 2, 4, 1, p[4]!);
    // Clear center notch
    b.rect(cx - 2, topY - 2, 4, 3, 0);
  } else if (form === 'krunk_fire') {
    // Twin roaring animated flame plumes erupting from twin head notches
    const sway = (phase & 1) === 0 ? -1 : 1;
    b.rect(cx - 8, topY - 2, 5, 3, p[0]!);
    b.rect(cx + 3, topY - 2, 5, 3, p[0]!);
    b.rect(cx - 2, topY - 2, 4, 3, 0);
    // Left flame
    b.tri(cx - 8, topY - 1, cx - 6 + sway, topY - 10, cx - 3, topY - 1, p[2]!);
    b.tri(cx - 7, topY - 1, cx - 5 + sway, topY - 7, cx - 4, topY - 1, hexToAbgr('#ffec42'));
    b.px(cx - 5 + sway, topY - 8, white);
    // Right flame
    b.tri(cx + 3, topY - 1, cx + 6 - sway, topY - 10, cx + 8, topY - 1, p[2]!);
    b.tri(cx + 4, topY - 1, cx + 6 - sway, topY - 7, cx + 7, topY - 1, hexToAbgr('#ffec42'));
    b.px(cx + 6 - sway, topY - 8, white);
  } else if (form === 'krunk_leaf') {
    // Wooden twig stem + oversized curved lush canopy leaf draping behind head
    const twig = hexToAbgr('#b8681c');
    const twigHi = hexToAbgr('#f0a848');
    const leafDark = hexToAbgr('#22481f');
    const leafMid = p[2]!;
    const leafHi = p[0]!;
    // Curved trailing giant leaf behind/above left side
    b.ellipseShaded(cx - 9, topY + 1 + flutter, 7.5, 4.5, leafHi, leafMid, leafDark);
    b.ellipseShaded(cx - 12, topY + 4 + flutter, 4.5, 5.5, leafMid, leafDark, dark);
    b.line(cx - 12, topY + 2 + flutter, cx - 3, topY - 2, leafHi);
    // Crisp forked twig stem on top
    b.line(cx + 1, topY + 1, cx - 2, topY - 5, twig);
    b.line(cx, topY - 2, cx + 4, topY - 5, twigHi);
    b.px(cx - 2, topY - 5, twigHi);
  } else if (form === 'krunk_rock') {
    // Purple martial headband across forehead + fluttering twin ribbon tails
    const bandHi = hexToAbgr('#d44dff');
    const bandMid = p[5]!;
    const bandDark = hexToAbgr('#580878');
    b.rect(cx - 8, topY - 1, 16, 4, bandMid);
    b.rect(cx - 8, topY - 1, 16, 1, bandHi);
    b.rect(cx - 8, topY + 2, 16, 1, bandDark);
    // Fluttering headband knot tails behind left side
    b.line(cx - 8, topY + 1, cx - 13, topY + 4 + flutter, bandMid);
    b.line(cx - 8, topY + 2, cx - 12, topY + 7 + flutter, bandDark);
    b.px(cx - 12, topY + 3 + flutter, bandHi);
  } else if (form === 'krunk_electric') {
    // Glossy copper-orange volt safety helmet with brim & top ridge
    const helmHi = hexToAbgr('#ff7838');
    const helmMid = hexToAbgr('#cc3314');
    const helmDark = hexToAbgr('#731208');
    b.ellipseShaded(cx, topY + 1, 9.5, 5.5, helmHi, helmMid, helmDark, white);
    b.rect(cx - 10, topY + 2, 20, 2, helmDark);
    b.rect(cx - 9, topY + 1, 18, 1, white);
    b.rect(cx - 2, topY - 5, 4, 3, helmHi);
    b.px(cx - 1, topY - 4, white);
  } else {
    // Shadow: spiky crimson-magenta demon crest + crackling emerald wisps
    const spikeHi = hexToAbgr('#ff3888');
    const spikeMid = p[2]!;
    const spikeDark = p[1]!;
    b.tri(cx - 8, topY + 2, cx - 10, topY - 6, cx - 2, topY + 1, spikeMid);
    b.tri(cx - 7, topY + 1, cx - 8, topY - 5, cx - 4, topY + 1, spikeHi);
    b.tri(cx + 1, topY + 1, cx + 6, topY - 5, cx + 8, topY + 2, spikeDark);
    b.tri(cx + 2, topY + 1, cx + 5, topY - 4, cx + 7, topY + 2, spikeHi);
    if ((phase & 1) === 0) {
      b.px(cx - 5, topY - 6, p[4]!);
      b.px(cx + 4, topY - 6, p[4]!);
    }
  }
}

function drawHeroBackGear(
  b: PixelBuf,
  form: HeroFormId,
  cx: number,
  cy: number,
  p: readonly number[],
  flutter: number,
  phase: number,
): void {
  if (form === 'krunk_shadow') {
    // Iconic dramatic high-collared silver-trimmed violet vampire cape!
    const collarHi = hexToAbgr('#f2e6ff');
    const collarMid = p[5]!;
    const capeDark = p[0]!;
    const capeMid = p[1]!;
    b.tri(cx - 7, cy + 5, cx - 15, cy - 5 + flutter, cx - 4, cy - 2, capeDark);
    b.tri(cx + 6, cy + 5, cx + 14, cy - 5 + flutter, cx + 4, cy - 2, capeDark);
    b.line(cx - 15, cy - 5 + flutter, cx - 6, cy - 2, collarHi);
    b.line(cx + 14, cy - 5 + flutter, cx + 6, cy - 2, collarHi);
    b.line(cx - 14, cy - 4 + flutter, cx - 7, cy + 4, collarMid);
    b.line(cx + 13, cy - 4 + flutter, cx + 7, cy + 4, collarMid);
    b.tri(cx - 7, cy + 2, cx - 14, cy + 9 + flutter, cx - 3, cy + 9, capeMid);
  } else if (form === 'krunk_electric') {
    // Crackling cyan electric aura arcs looping around shoulders
    const arcCol = p[4]!;
    const shift = (phase & 1) === 0 ? 0 : 1;
    b.px(cx - 13, cy - 2 + shift, arcCol);
    b.px(cx - 14, cy + shift, arcCol);
    b.px(cx - 13, cy + 3 - shift, arcCol);
    b.px(cx + 13, cy - 2 - shift, arcCol);
    b.px(cx + 14, cy + 1 - shift, arcCol);
    b.px(cx + 12, cy + 4 + shift, arcCol);
  }
}

function drawHeroFaceAndTongue(
  b: PixelBuf,
  form: HeroFormId,
  cx: number,
  cy: number,
  p: readonly number[],
  mood: 'normal' | 'happy' | 'fierce' | 'hurt',
  tongueOut = 1,
): void {
  const white = hexToAbgr(HIGHLIGHT_CREAM);
  const dark = hexToAbgr(OUTLINE_DARK);
  const tongue = getHeroTongueColors(form, p);

  if (mood === 'hurt') {
    // > < wince eyes
    b.line(cx - 5, cy - 6, cx - 2, cy - 4, dark);
    b.line(cx - 5, cy - 2, cx - 2, cy - 4, dark);
    b.line(cx + 6, cy - 6, cx + 3, cy - 4, dark);
    b.line(cx + 6, cy - 2, cx + 3, cy - 4, dark);
    // Wide shocked mouth
    b.rect(cx - 4, cy - 1, 9, 4, dark);
    b.rect(cx - 3, cy, 7, 2, tongue.mid);
    return;
  }

  // Expressive tall vertical cartoon eyes (offset slightly forward right)
  const eyeX1 = cx - 4;
  const eyeX2 = cx + 2;
  const eyeY = cy - 7;
  if (form === 'krunk_shadow') {
    // Fierce glowing neon-emerald eyes
    b.rect(eyeX1, eyeY, 4, 5, dark);
    b.rect(eyeX2, eyeY, 4, 5, dark);
    b.rect(eyeX1 + 1, eyeY + 1, 2, 4, p[4]!);
    b.rect(eyeX2 + 1, eyeY + 1, 2, 4, p[4]!);
    b.px(eyeX1 + 1, eyeY + 1, white);
    b.px(eyeX2 + 1, eyeY + 1, white);
  } else {
    const iris = form === 'krunk_leaf' ? hexToAbgr('#941458') : form === 'krunk_rock' ? hexToAbgr('#4d2c08') : dark;
    b.rect(eyeX1, eyeY, 3, 6, iris);
    b.rect(eyeX2, eyeY, 3, 6, iris);
    // Crisp bright vertical eye catchlights
    b.rect(eyeX1 + 1, eyeY + 1, 1, 3, white);
    b.rect(eyeX2 + 1, eyeY + 1, 1, 3, white);
    if (mood === 'fierce') {
      b.line(eyeX1 - 1, eyeY - 1, eyeX1 + 3, eyeY + 1, dark);
      b.line(eyeX2 - 1, eyeY + 1, eyeX2 + 3, eyeY - 1, dark);
    }
  }

  // Wide open joyful/fierce mouth interior + signature twin white buck-teeth
  const mouthY = cy - 1;
  b.rect(cx - 5, mouthY, 11, 5, dark);
  // Twin crisp white teeth along upper lip
  b.rect(cx - 4, mouthY, 3, 2, white);
  b.rect(cx + 2, mouthY, 3, 2, white);

  // SIGNATURE HUGE GLOSSY PROTRUDING TONGUE!
  if (tongueOut > 0) {
    const tRx = 5.4 + tongueOut * 0.6;
    const tRy = 4.2 + tongueOut * 0.4;
    const tCx = cx + 1 + (tongueOut > 1 ? 1 : 0);
    const tCy = mouthY + 4.2;
    b.ellipseShaded(tCx, tCy, tRx, tRy, tongue.hi, tongue.mid, tongue.dark);
    // Center tongue crease & juicy specular gleam
    b.line(tCx, mouthY + 2, tCx, mouthY + 5, tongue.dark);
    b.rect(tCx - 3, mouthY + 2, 2, 1, tongue.spec);
    b.rect(tCx + 1, mouthY + 3, 2, 1, tongue.spec);
    b.line(tCx - 4, mouthY + 6, tCx + 4, mouthY + 6, tongue.dark);
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
  const bodyLight = isShadow ? p[2]! : p[0]!;
  const bodyMid = isShadow ? p[3]! : p[1]!;
  const bodyDark = isShadow ? p[1]! : p[2]!;
  const specCol = hexToAbgr(mixHex(isShadow ? palHex[2] : palHex[0], HIGHLIGHT_CREAM, 0.42));
  const bootCol = form === 'krunk_fire' ? hexToAbgr('#4e29a8') : isShadow ? p[0]! : p[2]!;
  const bootLight = form === 'krunk_fire' ? hexToAbgr('#38e858') : p[1]!;
  const tongueCol = getHeroTongueColors(form, p);

  // 1) Standard 12-frame 36x36 sheet
  const stdSheet = new PixelBuf(HERO_STD_FRAME_W * HERO_STD_FRAME_COUNT, HERO_STD_FRAME_H);
  const frameBuf = new PixelBuf(HERO_STD_FRAME_W, HERO_STD_FRAME_H);

  for (let f = 0; f < HERO_STD_FRAME_COUNT; f++) {
    frameBuf.clear();
    const cx = 18;
    let cy = 20;
    let bw = 16;
    let bh = 18;
    let legLdx = -5;
    let legLdy = 10;
    let legRdx = 5;
    let legRdy = 10;
    let armLdx = -10;
    let armLdy = 3;
    let armRdx = 9;
    let armRdy = 3;
    let flutter = 0;
    let mood: 'normal' | 'happy' | 'fierce' | 'hurt' = 'happy';
    let tongueOut = 1;

    switch (f as HeroStdFrame) {
      case HeroStdFrame.Idle0:
        cy = 20;
        flutter = 0;
        break;
      case HeroStdFrame.Idle1:
        cy = 21;
        bw = 17;
        bh = 17;
        flutter = 1;
        break;
      case HeroStdFrame.Run0:
        cy = 19;
        legLdx = -7;
        legLdy = 9;
        legRdx = 6;
        legRdy = 11;
        armLdx = -9;
        armLdy = 1;
        armRdx = 10;
        armRdy = 4;
        flutter = -1;
        mood = 'fierce';
        break;
      case HeroStdFrame.Run1:
        cy = 20;
        legLdx = -3;
        legLdy = 11;
        legRdx = 3;
        legRdy = 9;
        flutter = 1;
        mood = 'fierce';
        break;
      case HeroStdFrame.Run2:
        cy = 19;
        legLdx = 6;
        legLdy = 9;
        legRdx = -6;
        legRdy = 11;
        armLdx = -10;
        armLdy = 4;
        armRdx = 9;
        armRdy = 1;
        flutter = 0;
        mood = 'fierce';
        break;
      case HeroStdFrame.Run3:
        cy = 20;
        legLdx = -4;
        legLdy = 10;
        legRdx = 4;
        legRdy = 11;
        flutter = -1;
        mood = 'fierce';
        break;
      case HeroStdFrame.Jump:
        cy = 18;
        bw = 14;
        bh = 20;
        legLdx = -4;
        legLdy = 11;
        legRdx = 5;
        legRdy = 8;
        armLdx = -9;
        armLdy = -2;
        armRdx = 9;
        armRdy = -3;
        flutter = 2;
        mood = 'happy';
        break;
      case HeroStdFrame.Fall:
        cy = 19;
        bw = 16;
        bh = 18;
        legLdx = -5;
        legLdy = 9;
        legRdx = 5;
        legRdy = 9;
        armLdx = -10;
        armLdy = -4;
        armRdx = 10;
        armRdy = -4;
        flutter = -2;
        mood = 'normal';
        break;
      case HeroStdFrame.WallSlide:
        cy = 19;
        bw = 15;
        bh = 19;
        legLdx = -6;
        legLdy = 8;
        legRdx = 4;
        legRdy = 11;
        armLdx = -9;
        armLdy = -2;
        armRdx = 8;
        armRdy = 3;
        flutter = -2;
        mood = 'fierce';
        break;
      case HeroStdFrame.Dash:
        cy = 20;
        bw = 18;
        bh = 15;
        legLdx = -9;
        legLdy = 6;
        legRdx = -5;
        legRdy = 9;
        armLdx = -11;
        armLdy = 2;
        armRdx = 11;
        armRdy = 0;
        flutter = -1;
        mood = 'fierce';
        tongueOut = 2;
        break;
      case HeroStdFrame.Hurt:
        cy = 20;
        bw = 16;
        bh = 17;
        legLdx = -6;
        legLdy = 9;
        legRdx = 6;
        legRdy = 9;
        armLdx = -10;
        armLdy = -3;
        armRdx = 10;
        armRdy = -3;
        flutter = -2;
        mood = 'hurt';
        tongueOut = 0;
        break;
      case HeroStdFrame.VineSlide:
        cy = 20;
        bw = 15;
        bh = 18;
        legLdx = -4;
        legLdy = 10;
        legRdx = 5;
        legRdy = 9;
        armLdx = -6;
        armLdy = -7;
        armRdx = 6;
        armRdy = -7;
        flutter = 1;
        mood = 'fierce';
        break;
    }

    // 1. Back cape / aura
    drawHeroBackGear(frameBuf, form, cx, cy, p, flutter, f);

    // 2. Stubby feet / boots
    frameBuf.rect(cx + legLdx - 3, cy + legLdy - 2, 6, 4, bootCol);
    frameBuf.rect(cx + legRdx - 3, cy + legRdy - 2, 6, 4, bootCol);
    frameBuf.px(cx + legLdx - 2, cy + legLdy - 2, bootLight);
    frameBuf.px(cx + legRdx - 2, cy + legRdy - 2, bootLight);

    // 3. Chunky upright blocky body with rich 16-bit bevel shading
    const bx = cx - (bw >> 1);
    const by = cy - (bh >> 1);
    frameBuf.rect(bx, by, bw, bh, bodyMid);
    frameBuf.rect(bx, by, bw - 2, bh - 3, bodyLight);
    frameBuf.rect(bx, by, 2, bh - 2, specCol);
    frameBuf.rect(bx + bw - 3, by + 2, 3, bh - 2, bodyDark);
    frameBuf.rect(bx + 1, by + bh - 3, bw - 1, 3, bodyDark);

    // Fire form's signature green-and-indigo shorts band along bottom of torso
    if (form === 'krunk_fire') {
      frameBuf.rect(bx + 1, by + bh - 5, bw - 2, 4, hexToAbgr('#4e29a8'));
      frameBuf.rect(bx + 1, by + bh - 5, 3, 4, hexToAbgr('#2be84d'));
      frameBuf.rect(bx + bw - 4, by + bh - 5, 3, 4, hexToAbgr('#2be84d'));
    }

    // 4. Stubby side arms (Rock form gets giant sculpted boulder fists!)
    const armRad = form === 'krunk_rock' ? 4.8 : 2.8;
    frameBuf.ellipseShaded(cx + armLdx, cy + armLdy, armRad, armRad * 0.9, bodyLight, bodyMid, bodyDark);
    frameBuf.ellipseShaded(cx + armRdx, cy + armRdy, armRad, armRad * 0.9, specCol, bodyLight, bodyDark);

    // 5. Elemental headgear / twin notched crown / flames / leaf / headband / helmet / demon spikes
    drawHeroHeadgear(frameBuf, form, cx, by, p, f, flutter);

    // 6. Expressive eyes, buck teeth & HUGE glossy protruding tongue!
    drawHeroFaceAndTongue(frameBuf, form, cx, cy, p, mood, tongueOut);

    // 7. Crisp 1px dark-plum outline
    frameBuf.outline(outlineCol);
    stdSheet.blit(frameBuf, f * HERO_STD_FRAME_W, 0);
  }

  // 2) Action 10-frame 48x48 sheet:
  //    Stomp0..1 (downward tongue anvil slam), Uppercut0..1, Glide0..1, Tongue0..1 (forward tongue whip/dash), Dive0, Blink0
  const actSheet = new PixelBuf(HERO_ACT_FRAME_W * HERO_ACT_FRAME_COUNT, HERO_ACT_FRAME_H);
  const actBuf = new PixelBuf(HERO_ACT_FRAME_W, HERO_ACT_FRAME_H);

  for (let f = 0; f < HERO_ACT_FRAME_COUNT; f++) {
    actBuf.clear();
    const cx = 24;
    const cy = 24;

    if (f === HeroActFrame.Stomp0 || f === HeroActFrame.Stomp1) {
      // SIGNATURE AIR STOMP: Krunk diving downward riding his giant hardened elastic TONGUE SLAM!
      const stretch = f === HeroActFrame.Stomp0 ? 0 : 2;
      // Kinetic downward speed crescent above head
      actBuf.line(cx - 12, cy - 16, cx - 12, cy - 4, p[4]!);
      actBuf.line(cx + 12, cy - 16, cx + 12, cy - 4, p[4]!);
      actBuf.line(cx, cy - 18, cx, cy - 10, hexToAbgr(HIGHLIGHT_CREAM));
      // Compact fierce body tucked above the slamming tongue
      actBuf.rect(cx - 8, cy - 11, 16, 15, bodyMid);
      actBuf.rect(cx - 8, cy - 11, 13, 12, bodyLight);
      drawHeroHeadgear(actBuf, form, cx, cy - 11, p, f, -2);
      // Fierce squint eyes looking straight down
      actBuf.rect(cx - 5, cy - 7, 3, 4, outlineCol);
      actBuf.rect(cx + 2, cy - 7, 3, 4, outlineCol);
      actBuf.px(cx - 4, cy - 6, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.px(cx + 3, cy - 6, hexToAbgr(HIGHLIGHT_CREAM));
      // GIANT DOWNWARD STOMP TONGUE ANVIL SLAM!
      actBuf.rect(cx - 7, cy + 2, 14, 10 + stretch, tongueCol.mid);
      actBuf.ellipseShaded(
        cx,
        cy + 12 + stretch,
        12,
        6.5,
        tongueCol.hi,
        tongueCol.mid,
        tongueCol.dark,
        tongueCol.spec,
      );
      actBuf.line(cx, cy + 4, cx, cy + 14 + stretch, tongueCol.dark);
      // Impact shock crescent underneath tongue tip
      actBuf.line(cx - 14, cy + 17 + stretch, cx + 14, cy + 17 + stretch, p[4]!);
      actBuf.line(cx - 10, cy + 19 + stretch, cx + 10, cy + 19 + stretch, hexToAbgr(HIGHLIGHT_CREAM));
    } else if (f === HeroActFrame.Uppercut0 || f === HeroActFrame.Uppercut1) {
      // Giant rising uppercut stone/elemental fist + heroic stretched Krunk!
      const boost = f === HeroActFrame.Uppercut1 ? -2 : 0;
      actBuf.rect(cx - 9, cy + 2, 14, 15, bodyMid);
      actBuf.rect(cx - 9, cy + 2, 11, 12, bodyLight);
      drawHeroFaceAndTongue(actBuf, form, cx - 2, cy + 9, p, 'fierce', 1);
      actBuf.rect(cx - 7, cy + 17, 5, 4, bootCol);
      actBuf.rect(cx + 1, cy + 16, 5, 4, bootCol);
      // Giant glowing uppercut gauntlet thrusting skyward!
      const fy = 12 + boost;
      actBuf.ellipseShaded(cx + 5, fy, 11, 9.5, p[4]!, p[0]!, p[2]!, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.rect(cx - 2, fy - 5, 4, 4, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.rect(cx + 3, fy - 6, 4, 4, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.rect(cx + 8, fy - 5, 4, 4, p[4]!);
      actBuf.line(cx - 7, fy - 8, cx + 4, fy - 11, p[4]!);
      actBuf.line(cx + 4, fy - 11, cx + 15, fy - 8, p[4]!);
    } else if (f === HeroActFrame.Glide0 || f === HeroActFrame.Glide1) {
      // Unfurled giant overhead Leaf Canopy / Elemental Glide wings!
      const flap = f === HeroActFrame.Glide0 ? -2 : 2;
      actBuf.ellipseShaded(cx - 11, cy - 9 + flap, 11, 5.5, p[4]!, p[0]!, p[2]!);
      actBuf.ellipseShaded(cx + 11, cy - 9 + flap, 11, 5.5, p[4]!, p[0]!, p[2]!);
      actBuf.line(cx - 2, cy - 9 + flap, cx - 20, cy - 9 + flap, p[2]!);
      actBuf.line(cx + 2, cy - 9 + flap, cx + 20, cy - 9 + flap, p[2]!);
      actBuf.line(cx, cy - 9 + flap, cx, cy - 2, hexToAbgr('#b8681c'));
      // Chunky Krunk hanging happily below
      actBuf.rect(cx - 7, cy - 2, 14, 16, bodyMid);
      actBuf.rect(cx - 7, cy - 2, 11, 13, bodyLight);
      actBuf.rect(cx - 6, cy + 14, 5, 4, bootCol);
      actBuf.rect(cx + 1, cy + 14, 5, 4, bootCol);
      drawHeroFaceAndTongue(actBuf, form, cx, cy + 5, p, 'happy', 1);
    } else if (f === HeroActFrame.Tongue0 || f === HeroActFrame.Tongue1) {
      // SIGNATURE TONGUE LASH / GROUND DASH LAUNCH!
      const reach = f === HeroActFrame.Tongue0 ? 15 : 19;
      // Leaning forward torso at left-center
      const bx = cx - 14;
      const by = cy - 7;
      actBuf.rect(bx, by, 16, 17, bodyMid);
      actBuf.rect(bx, by, 13, 14, bodyLight);
      actBuf.rect(bx - 1, by + 16, 6, 4, bootCol);
      actBuf.rect(bx + 9, by + 15, 6, 4, bootCol);
      drawHeroHeadgear(actBuf, form, bx + 8, by, p, f, -2);
      // Fierce eyes + wide open mouth launching tongue forward!
      actBuf.rect(bx + 5, by + 3, 3, 5, outlineCol);
      actBuf.rect(bx + 10, by + 3, 3, 5, outlineCol);
      actBuf.px(bx + 6, by + 4, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.px(bx + 11, by + 4, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.rect(bx + 8, by + 9, 8, 6, outlineCol);
      // Thick gleaming elastic tongue whipping forward!
      actBuf.rect(bx + 12, by + 10, reach, 5, tongueCol.mid);
      actBuf.rect(bx + 12, by + 10, reach, 2, tongueCol.hi);
      actBuf.rect(bx + 12, by + 14, reach, 1, tongueCol.dark);
      actBuf.ellipseShaded(
        bx + 12 + reach,
        by + 12,
        5.5,
        4.5,
        tongueCol.hi,
        tongueCol.mid,
        tongueCol.dark,
        tongueCol.spec,
      );
    } else if (f === HeroActFrame.Dive0) {
      // Diagonal Volt Dive / Electric Charge Torpedo!
      actBuf.tri(cx - 16, cy - 12, cx + 16, cy + 12, cx - 2, cy + 10, p[4]!);
      actBuf.rect(cx - 8, cy - 8, 16, 16, bodyLight);
      drawHeroHeadgear(actBuf, form, cx, cy - 8, p, f, -1);
      drawHeroFaceAndTongue(actBuf, form, cx, cy, p, 'fierce', 1);
      actBuf.line(cx - 16, cy - 14, cx - 6, cy - 6, hexToAbgr(HIGHLIGHT_CREAM));
      actBuf.line(cx + 6, cy + 6, cx + 18, cy + 14, p[4]!);
    } else {
      // High-speed Shadow / Volt Blink afterimage slash!
      actBuf.tri(cx - 20, cy + 2, cx + 18, cy - 6, cx + 18, cy + 10, p[2]!);
      actBuf.tri(cx - 16, cy + 2, cx + 14, cy - 3, cx + 14, cy + 7, p[4]!);
      actBuf.rect(cx - 7, cy - 8, 15, 16, bodyLight);
      drawHeroHeadgear(actBuf, form, cx, cy - 8, p, f, -2);
      drawHeroFaceAndTongue(actBuf, form, cx, cy, p, 'fierce', 2);
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

// Biome tilesets, deco, parallax, special tiles, props & Hub NPCs are delegated to BiomeArtBaker.ts

function bakeCollectibles(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // Coin (4 frames spinning smiling golden medallion 20x20)
  {
    const sheet = new PixelBuf(80, 20);
    const b = new PixelBuf(20, 20);
    const hi = hexToAbgr(UI_COLORS.coinLight);
    const mid = hexToAbgr(UI_COLORS.coinMid);
    const dark = hexToAbgr(UI_COLORS.coinDark);
    const deep = hexToAbgr(UI_COLORS.coinDeep);
    const widths = [7.8, 5.8, 2.8, 5.8] as const;
    for (let f = 0; f < 4; f++) {
      b.clear();
      const rx = widths[f]!;
      b.ellipseShaded(10, 10, rx, 7.8, hi, mid, dark, cWhite);
      if (rx >= 7) {
        // Charming embossed eyes + toothy grin inside golden medallion
        b.rect(7, 6, 2, 3, hi);
        b.rect(11, 6, 2, 3, hi);
        b.px(7, 8, deep);
        b.px(11, 8, deep);
        b.rect(7, 11, 6, 3, deep);
        b.rect(8, 11, 2, 1, hi);
        b.rect(11, 11, 2, 1, hi);
      } else if (rx >= 5) {
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

  // RockShield & MagicShield heart icons (14x14)
  {
    const b = new PixelBuf(14, 14);
    b.ellipse(4.5, 5, 3.2, 3.0, hexToAbgr('#788276'));
    b.ellipse(9.5, 5, 3.2, 3.0, hexToAbgr('#788276'));
    b.tri(1.5, 6, 12.5, 6, 7, 12.5, hexToAbgr('#586157'));
    b.line(7, 4, 7, 11, hexToAbgr('#343b34'));
    b.px(4, 4, hexToAbgr('#b4bfb2'));
    b.px(5, 4, hexToAbgr('#b4bfb2'));
    b.outline(cOut);
    map.set('rock_shield', b.toCanvas());

    const m = new PixelBuf(14, 14);
    m.ellipse(4.5, 5, 3.2, 3.0, hexToAbgr(UI_COLORS.magicShield));
    m.ellipse(9.5, 5, 3.2, 3.0, hexToAbgr(UI_COLORS.magicShield));
    m.tri(1.5, 6, 12.5, 6, 7, 12.5, hexToAbgr('#3899cc'));
    m.line(7, 4, 7, 11, hexToAbgr('#1f5a80'));
    m.rect(3, 3, 3, 2, cWhite);
    m.rect(8, 3, 3, 2, cWhite);
    m.outline(cOut);
    map.set('magic_shield', m.toCanvas());
  }

  // Elemental Form Emblem Badges (12x12 each — iconic silhouettes!)
  for (let i = 0; i < HERO_FORMS.length; i++) {
    const form = HERO_FORMS[i]!;
    const pal = HERO_FORM_PALETTES[form];
    const b = new PixelBuf(12, 12);
    const c0 = hexToAbgr(pal[0]);
    const c2 = hexToAbgr(pal[2]);
    const c3 = hexToAbgr(pal[3]);
    const c4 = hexToAbgr(pal[4]);
    if (form === 'krunk_basic') {
      b.rect(2, 2, 8, 7, c0);
      b.rect(5, 2, 2, 2, 0);
      b.ellipse(6, 8, 3, 2, c3);
      b.px(4, 4, cOut);
      b.px(7, 4, cOut);
    } else if (form === 'krunk_fire') {
      b.tri(2, 10, 4, 2, 7, 10, c0);
      b.tri(5, 10, 8, 2, 10, 10, c0);
      b.tri(4, 10, 6, 5, 8, 10, hexToAbgr('#ffec42'));
    } else if (form === 'krunk_leaf') {
      b.ellipse(6, 6, 4.5, 3, c0);
      b.line(2, 9, 9, 3, c4);
      b.px(9, 2, hexToAbgr('#b8681c'));
    } else if (form === 'krunk_rock') {
      b.rect(2, 3, 8, 7, c0);
      b.rect(2, 3, 8, 2, hexToAbgr(pal[5]));
      b.rect(4, 7, 4, 2, hexToAbgr('#78828a'));
    } else if (form === 'krunk_electric') {
      b.ellipse(6, 5, 4.5, 3, hexToAbgr('#e64518'));
      b.rect(2, 6, 8, 4, c0);
      b.rect(4, 8, 4, 2, c4);
    } else {
      b.tri(1, 5, 6, 2, 11, 5, c2);
      b.rect(3, 4, 6, 6, c0);
      b.px(4, 6, c4);
      b.px(7, 6, c4);
      b.rect(4, 8, 4, 2, c4);
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
    'fire_wave',
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
      } else if (kind === 'fire_wave') {
        const sway = f === 0 ? 0 : 1;
        b.tri(1, 14, 7 + sway, 2, 14, 14, hexToAbgr('#d91818'));
        b.tri(3, 14, 8 + sway, 4, 13, 14, hexToAbgr('#ff7a14'));
        b.tri(5, 14, 9 + sway, 7, 12, 14, hexToAbgr('#fff266'));
        b.px(8 + sway, 6, cWhite);
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
  goomba: { style: 'blob', hi: '#78ff66', mid: '#14a89c', dark: '#0c4f42', acc: '#ff7024' },
  air_goomba: { style: 'winged', hi: '#82f7ff', mid: '#3885d4', dark: '#1a3673', acc: '#fff2b8' },
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
      case 'blob': {
        b.ellipse(cx - 5 + f * 2, fh - 4, 3.5, 2.2, dark);
        b.ellipse(cx + 5 - f * 2, fh - 4, 3.5, 2.2, dark);
        b.ellipseShaded(cx, cy + bob, 11, 9, hi, mid, dark, cWhite);
        b.ellipse(cx, cy - 5 + bob, 7.5, 3.5, dark);
        b.line(cx - 6, cy - 7 + bob, cx + 6, cy - 7 + bob, hi);
        b.ellipseShaded(cx - 3, cy + 2 + bob, 4, 4, cWhite, hi, mid);
        b.rect(cx - 3, cy + 2 + bob, 2, 2, hexToAbgr('#a81058'));
        b.px(cx - 4, cy + bob, cWhite);
        b.tri(cx + 3, cy - 1 + bob, cx + 11, cy + 3 + bob, cx + 5, cy + 8 + bob, acc);
        b.tri(cx + 4, cy + bob, cx + 9, cy + 2 + bob, cx + 5, cy + 4 + bob, cWhite);
        break;
      }

      case 'winged': {
        const flap = f === 0 ? -6 : 3;
        b.tri(cx - 5, cy - 1, cx - 15, cy - 4 + flap, cx - 10, cy + 5 + (flap >> 1), acc);
        b.tri(cx - 5, cy, cx - 13, cy - 2 + flap, cx - 7, cy + 4, cWhite);
        b.tri(cx + 5, cy - 1, cx + 15, cy - 4 + flap, cx + 10, cy + 5 + (flap >> 1), acc);
        b.tri(cx + 5, cy, cx + 13, cy - 2 + flap, cx + 7, cy + 4, cWhite);
        b.tri(cx - 3, cy - 7 + bob, cx, cy - 12 + bob, cx + 3, cy - 7 + bob, acc);
        b.ellipseShaded(cx, cy + 1 + bob, 8.5, 7.5, hi, mid, dark, cWhite);
        b.ellipse(cx + 1, cy + 4 + bob, 5, 3, acc);
        b.rect(cx - 4, cy - 2 + bob, 3, 4, cWhite);
        b.rect(cx + 2, cy - 2 + bob, 3, 4, cWhite);
        b.rect(cx - 3, cy - 1 + bob, 2, 3, cOut);
        b.rect(cx + 3, cy - 1 + bob, 2, 3, cOut);
        b.px(cx - 3, cy - 1 + bob, cWhite);
        b.px(cx + 3, cy - 1 + bob, cWhite);
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

function bakeFx(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // 1. Stomp shockwave dust & impact ring (4 frames, 48x32)
  {
    const sheet = new PixelBuf(48 * 4, 32);
    const b = new PixelBuf(48, 32);
    const gold = hexToAbgr('#ffd84d');
    const pink = hexToAbgr('#ff59b8');
    const dust = hexToAbgr('#e6d9f2');
    for (let f = 0; f < 4; f++) {
      b.clear();
      const spread = 8 + f * 5;
      const h = Math.max(3, 12 - f * 2);
      // Left & right bursting shockwave plumes
      b.ellipseShaded(24 - spread, 25 - (h >> 1), 6 - f * 0.6, h * 0.5, cWhite, dust, pink);
      b.ellipseShaded(24 + spread, 25 - (h >> 1), 6 - f * 0.6, h * 0.5, cWhite, dust, pink);
      // Central kinetic impact arc
      b.line(24 - spread, 27, 24 + spread, 27, f < 2 ? cWhite : gold);
      b.line(24 - spread + 2, 26, 24 + spread - 2, 26, gold);
      if (f < 2) {
        b.tri(18, 25, 24, 10 + f * 4, 30, 25, gold);
        b.tri(20, 25, 24, 14 + f * 4, 28, 25, cWhite);
      }
      b.outline(cOut);
      sheet.blit(b, f * 48, 0);
    }
    map.set('stomp_ring', sheet.toCanvas());
  }

  // 2. Tongue / melee starburst impact spark (4 frames, 32x32)
  {
    const sheet = new PixelBuf(32 * 4, 32);
    const b = new PixelBuf(32, 32);
    const hi = hexToAbgr('#fff4a3');
    const mid = hexToAbgr('#ff4d88');
    for (let f = 0; f < 4; f++) {
      b.clear();
      const r = 6 + f * 3;
      for (let a = 0; a < 8; a++) {
        const th = (a / 8) * Math.PI * 2 + f * 0.25;
        const x1 = 16 + Math.round(Math.cos(th) * r);
        const y1 = 16 + Math.round(Math.sin(th) * r);
        b.line(16, 16, x1, y1, a % 2 === 0 ? hi : mid);
      }
      if (f < 2) {
        b.ellipse(16, 16, 5 - f, 5 - f, cWhite);
      }
      b.outline(cOut);
      sheet.blit(b, f * 32, 0);
    }
    map.set('tongue_impact', sheet.toCanvas());
  }

  // 3. Fire blast ring (4 frames, 48x48)
  {
    const sheet = new PixelBuf(48 * 4, 48);
    const b = new PixelBuf(48, 48);
    const hot = hexToAbgr('#fff799');
    const orange = hexToAbgr('#ff8a00');
    const red = hexToAbgr('#d91818');
    for (let f = 0; f < 4; f++) {
      b.clear();
      const r = 10 + f * 4;
      b.ellipse(24, 24, r, r, red);
      b.ellipse(24, 24, Math.max(2, r - 3), Math.max(2, r - 3), orange);
      if (f < 2) {
        b.ellipse(24, 24, Math.max(1, r - 6), Math.max(1, r - 6), hot);
      } else {
        b.ellipse(24, 24, Math.max(1, r - 6), Math.max(1, r - 6), 0);
      }
      b.outline(cOut);
      sheet.blit(b, f * 48, 0);
    }
    map.set('fire_blast', sheet.toCanvas());
  }

  // 4. Volt arc crackle (4 frames, 48x32)
  {
    const sheet = new PixelBuf(48 * 4, 32);
    const b = new PixelBuf(48, 32);
    const cyan = hexToAbgr('#59f2ff');
    const yel = hexToAbgr('#f2ff38');
    for (let f = 0; f < 4; f++) {
      b.clear();
      let px = 4;
      let py = 16;
      for (let s = 1; s <= 5; s++) {
        const nx = 4 + s * 8;
        const ny = 16 + (((s + f) & 1) === 0 ? -7 : 7);
        b.line(px, py, nx, ny, cyan);
        b.line(px, py + 1, nx, ny + 1, yel);
        px = nx;
        py = ny;
      }
      b.outline(cOut);
      sheet.blit(b, f * 48, 0);
    }
    map.set('volt_arc', sheet.toCanvas());
  }

  // 5. Shadow blink slash (4 frames, 48x32)
  {
    const sheet = new PixelBuf(48 * 4, 32);
    const b = new PixelBuf(48, 32);
    const mag = hexToAbgr('#ff006a');
    const grn = hexToAbgr('#24ff78');
    for (let f = 0; f < 4; f++) {
      b.clear();
      const ox = f * 3;
      b.tri(4 + ox, 16, 40, 6 + f * 2, 44, 16, mag);
      b.tri(8 + ox, 16, 38, 12 + f, 42, 16, grn);
      b.outline(cOut);
      sheet.blit(b, f * 48, 0);
    }
    map.set('shadow_slash', sheet.toCanvas());
  }

  return map;
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
  public readonly fx = new Map<string, HTMLCanvasElement>();
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

    // 2. Delegate Biome Tilesets, Deco, Parallax, Special Tiles, Props & Hub NPCs to BiomeArtBaker
    const worldArt = getBuiltInWorldArt();
    if (worldArt) {
      for (const [k, v] of worldArt.biomeTilesets) this.biomeTilesets.set(k, v);
      for (const [k, v] of worldArt.biomeDeco) this.biomeDeco.set(k, v);
      for (const [k, v] of worldArt.biomeParallax) this.biomeParallax.set(k, v);
      for (const [k, v] of worldArt.specialTiles) this.specialTiles.set(k, v);
      for (const [k, v] of worldArt.props) this.props.set(k, v);
      for (const [k, v] of worldArt.npcs) this.npcs.set(k, v);
    }

    // 3. Collectibles, projectiles, FX
    for (const [k, v] of bakeCollectibles()) this.collectibles.set(k, v);
    for (const [k, v] of bakeProjectiles()) this.projectiles.set(k, v);
    for (const [k, v] of bakeFx()) this.fx.set(k, v);

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
