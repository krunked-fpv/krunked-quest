/**
 * Krunked Quest — 16-Bit Pixel-Art Mastercraft Engine
 * Pure integer Uint32Array pixel buffer toolkit for authentic SNES/GBA pixel art:
 * - Hue-shifted 16-bit color ramps & selective colored outlining (sel-out)
 * - Tileable 2D value/fBm & Voronoi cellular noise (seamless across any period)
 * - Sculpted pixel-clustered billowing cloud banks, jagged faceted mountains,
 *   lush layered pixel foliage canopies, weathered stonework arches & pillars
 * - Zero blurry canvas anti-aliasing, headless-safe, zero third-party proper nouns.
 */

import { FLASH_WHITE, hexToAbgr, mixHex } from './palettes.js';

// ============================================================================
// Fast Deterministic Hashing & Seamless Tileable Noise
// ============================================================================

export function hash2i(x: number, y: number, seed = 0): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n ^ (n >>> 16)) >>> 0;
}

export function hash2f(x: number, y: number, seed = 0): number {
  return hash2i(x, y, seed) / 4294967296;
}

function wrapInt(v: number, p: number): number {
  const m = v % p;
  return m < 0 ? m + p : m;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Seamless 2D value noise tiling cleanly over (cellsX, cellsY). */
export function tileableNoise(
  u: number,
  v: number,
  cellsX: number,
  cellsY: number,
  seed: number,
): number {
  const fx = u * cellsX;
  const fy = v * cellsY;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smoothstep(fx - x0);
  const ty = smoothstep(fy - y0);
  const ix0 = wrapInt(x0, cellsX);
  const iy0 = wrapInt(y0, cellsY);
  const ix1 = (ix0 + 1) % cellsX;
  const iy1 = (iy0 + 1) % cellsY;
  const n00 = hash2f(ix0, iy0, seed);
  const n10 = hash2f(ix1, iy0, seed);
  const n01 = hash2f(ix0, iy1, seed);
  const n11 = hash2f(ix1, iy1, seed);
  const a = n00 + (n10 - n00) * tx;
  const b = n01 + (n11 - n01) * tx;
  return a + (b - a) * ty;
}

/** Multi-octave seamless 2D fBm noise returning [0..1]. */
export function tileableFbm(
  u: number,
  v: number,
  baseCellsX: number,
  baseCellsY: number,
  octaves: number,
  seed: number,
): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let cx = baseCellsX;
  let cy = baseCellsY;
  for (let o = 0; o < octaves; o++) {
    sum += tileableNoise(u, v, cx, cy, seed + o * 137) * amp;
    norm += amp;
    amp *= 0.5;
    cx *= 2;
    cy *= 2;
  }
  return norm > 0 ? sum / norm : 0.5;
}

export interface VoronoiSample {
  readonly d1: number;
  readonly d2: number;
  readonly edge: number; // d2 - d1 (0 along seam)
  readonly dx: number; // offset from cell center [-0.5..0.5]
  readonly dy: number;
  readonly cellId: number;
}

/** Seamless tileable Voronoi cellular sample for rounded cobbles, lava rivers, bark plates & rock facets. */
export function tileableVoronoi(
  u: number,
  v: number,
  cellsX: number,
  cellsY: number,
  seed: number,
  jitter = 0.8,
): VoronoiSample {
  const fx = u * cellsX;
  const fy = v * cellsY;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);

  let d1 = 999;
  let d2 = 999;
  let bestDx = 0;
  let bestDy = 0;
  let bestId = 0;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = wrapInt(ix + ox, cellsX);
      const cy = wrapInt(iy + oy, cellsY);
      const h1 = hash2f(cx, cy, seed);
      const h2 = hash2f(cx, cy, seed + 911);
      const px = ix + ox + 0.5 + (h1 - 0.5) * jitter;
      const py = iy + oy + 0.5 + (h2 - 0.5) * jitter;
      const dx = fx - px;
      const dy = fy - py;
      const dist = Math.hypot(dx, dy);
      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        bestDx = dx;
        bestDy = dy;
        bestId = hash2i(cx, cy, seed + 37);
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }

  return { d1, d2, edge: d2 - d1, dx: bestDx, dy: bestDy, cellId: bestId };
}

// ============================================================================
// Hue-Shifted 16-Bit Color Utilities
// ============================================================================

export function rgbToAbgr(r: number, g: number, b: number, a = 255): number {
  return (
    ((a & 0xff) << 24) |
    ((Math.max(0, Math.min(255, b | 0)) & 0xff) << 16) |
    ((Math.max(0, Math.min(255, g | 0)) & 0xff) << 8) |
    (Math.max(0, Math.min(255, r | 0)) & 0xff)
  ) >>> 0;
}

export function abgrToRgb(c: number): [number, number, number, number] {
  return [c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, (c >>> 24) & 0xff];
}

/** Shifts a hex color warmer toward highlight or cooler toward shadow (authentic 16-bit pixel color theory). */
export function hueShiftHex(
  hex: string,
  amount: number,
  warmLight = '#fff6d4',
  coolShadow = '#1a0c30',
): string {
  if (amount >= 0) {
    return mixHex(hex, warmLight, Math.min(1, amount));
  }
  return mixHex(hex, coolShadow, Math.min(1, -amount));
}

export function makeRamp(hexes: readonly string[]): Uint32Array {
  const out = new Uint32Array(hexes.length);
  for (let i = 0; i < hexes.length; i++) {
    out[i] = hexToAbgr(hexes[i]!);
  }
  return out;
}

/** Crisp alpha blend of src ABGR over dst ABGR (used sparingly for atmospheric mist/glow on integer buffers). */
export function blendAbgr(dst: number, src: number, alpha01: number): number {
  if (alpha01 <= 0) return dst;
  if (alpha01 >= 1) return src;
  const dr = dst & 0xff;
  const dg = (dst >>> 8) & 0xff;
  const db = (dst >>> 16) & 0xff;
  const da = (dst >>> 24) & 0xff;
  const sr = src & 0xff;
  const sg = (src >>> 8) & 0xff;
  const sb = (src >>> 16) & 0xff;
  const r = Math.round(dr + (sr - dr) * alpha01);
  const g = Math.round(dg + (sg - dg) * alpha01);
  const b = Math.round(db + (sb - db) * alpha01);
  const a = Math.max(da, Math.round(alpha01 * 255));
  return rgbToAbgr(r, g, b, a);
}

/** Darken an opaque ABGR pixel toward a cool shadow color for automatic selective outlining! */
export function darkenForSelOut(src: number, shadowAbgr: number, strength = 0.68): number {
  const sr = src & 0xff;
  const sg = (src >>> 8) & 0xff;
  const sb = (src >>> 16) & 0xff;
  const tr = shadowAbgr & 0xff;
  const tg = (shadowAbgr >>> 8) & 0xff;
  const tb = (shadowAbgr >>> 16) & 0xff;
  const r = Math.round(sr * (1 - strength) + tr * strength * 0.45);
  const g = Math.round(sg * (1 - strength) + tg * strength * 0.45);
  const b = Math.round(sb * (1 - strength) + tb * strength * 0.55);
  return rgbToAbgr(r, g, b, 255);
}

// ============================================================================
// Integer Pixel Buffer with Rich 16-Bit Art Primitives
// ============================================================================

export class PixelCanvas {
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

  public fill(col: number): void {
    this.pixels.fill(col);
  }

  public px(x: number, y: number, col: number): void {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    this.pixels[iy * this.w + ix] = col;
  }

  public pxWrapX(x: number, y: number, col: number): void {
    const iy = y | 0;
    if (iy < 0 || iy >= this.h) return;
    const ix = wrapInt(x | 0, this.w);
    this.pixels[iy * this.w + ix] = col;
  }

  public pxBlend(x: number, y: number, col: number, alpha01: number): void {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const idx = iy * this.w + ix;
    const dst = this.pixels[idx]!;
    if (dst === 0) {
      const a = Math.round(alpha01 * 255);
      if (a > 0) this.pixels[idx] = ((col & 0x00ffffff) | ((a & 0xff) << 24)) >>> 0;
      return;
    }
    this.pixels[idx] = blendAbgr(dst, col, alpha01);
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

  public roundedRect(x: number, y: number, w: number, h: number, col: number, r = 1): void {
    if (w <= r * 2 || h <= r * 2) {
      this.rect(x, y, w, h, col);
      return;
    }
    for (let dy = 0; dy < h; dy++) {
      let inset = 0;
      if (dy < r) inset = r - dy;
      else if (dy >= h - r) inset = dy - (h - r - 1);
      if (r >= 2 && inset === r) inset = r;
      this.rect(x + inset, y + dy, w - inset * 2, 1, col);
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
    deep?: number,
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
          const shade = dx * 0.48 + dy * 0.72;
          let c = mid;
          if (spec !== undefined && dx > -0.66 && dx < -0.14 && dy > -0.76 && dy < -0.26) {
            c = spec;
          } else if (shade < -0.2) {
            c = light;
          } else if (deep !== undefined && shade > 0.62) {
            c = deep;
          } else if (shade > 0.28) {
            c = dark;
          }
          this.pixels[row + px] = c;
        }
      }
    }
  }

  public line(x0: number, y0: number, x1: number, y1: number, col: number, thickness = 1): void {
    let ix0 = x0 | 0;
    let iy0 = y0 | 0;
    const ix1 = x1 | 0;
    const iy1 = y1 | 0;
    const dx = Math.abs(ix1 - ix0);
    const dy = -Math.abs(iy1 - iy0);
    const sx = ix0 < ix1 ? 1 : -1;
    const sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    const r = Math.max(0, (thickness - 1) >> 1);
    for (;;) {
      if (thickness <= 1) {
        this.px(ix0, iy0, col);
      } else {
        this.rect(ix0 - r, iy0 - r, thickness, thickness, col);
      }
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

  /** Filled convex/concave polygon scanline rasterizer (crisp integer pixels, zero AA). */
  public poly(pts: readonly (readonly [number, number])[], col: number): void {
    if (pts.length < 3) return;
    let minY = this.h;
    let maxY = 0;
    for (let i = 0; i < pts.length; i++) {
      const y = pts[i]![1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const nodes: number[] = [];
    for (let y = y0; y <= y1; y++) {
      nodes.length = 0;
      const sy = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const yi = pts[i]![1];
        const yj = pts[j]![1];
        if ((yi < sy && yj >= sy) || (yj < sy && yi >= sy)) {
          const xi = pts[i]![0];
          const xj = pts[j]![0];
          nodes.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
        }
      }
      nodes.sort((a, b) => a - b);
      const row = y * this.w;
      for (let k = 0; k + 1 < nodes.length; k += 2) {
        const sx = Math.max(0, Math.ceil(nodes[k]!));
        const ex = Math.min(this.w - 1, Math.floor(nodes[k + 1]!));
        for (let x = sx; x <= ex; x++) {
          this.pixels[row + x] = col;
        }
      }
    }
  }

  /** Crisp 1px uniform dark outline. */
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

  /**
   * Authentic 16-bit Selective Outlining ("sel-out"):
   * Sunlit top/left border pixels get a hue-matched darkened outline, while shadowed
   * bottom/right borders get a crisp deep plum/obsidian anchor outline!
   */
  public selectiveOutline(deepShadowCol: number, strengthTop = 0.58, strengthBot = 0.86): void {
    const src = new Uint32Array(this.pixels);
    const w = this.w;
    const h = this.h;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (src[row + x] !== 0) continue;
        const up = y > 0 ? src[row - w + x]! : 0;
        const dn = y + 1 < h ? src[row + w + x]! : 0;
        const lt = x > 0 ? src[row + x - 1]! : 0;
        const rt = x + 1 < w ? src[row + x + 1]! : 0;
        const sample = dn || rt || lt || up;
        if (!sample) continue;
        // Border on the top-left of a sprite (neighbor is below or right) gets lighter sel-out
        const isSunlitEdge = (dn !== 0 || rt !== 0) && up === 0 && lt === 0;
        this.pixels[row + x] = darkenForSelOut(
          sample,
          deepShadowCol,
          isSunlitEdge ? strengthTop : strengthBot,
        );
      }
    }
  }

  /** Blit another PixelCanvas onto this one at (dx, dy), ignoring transparent pixels. */
  public blit(src: PixelCanvas, dx: number, dy: number): void {
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
// Master 16-Bit Landscape & Sky Sculptors
// ============================================================================

/**
 * Renders a clean stepped 16-bit atmospheric sky with smooth multi-stop horizontal bands
 * (zero harsh checkerboard stripes!).
 */
export function paintSteppedSky(
  buf: PixelCanvas,
  stops: readonly (readonly [number, string])[], // [yFrac 0..1, hex]
  bandSteps = 10,
): void {
  const h = buf.h;
  const w = buf.w;
  const parsed: Array<[number, string]> = stops.map(([f, c]) => [f, c]);
  const colCache = new Uint32Array(h);

  for (let y = 0; y < h; y++) {
    // Quantize height into crisp retro atmospheric bands
    const qy = Math.floor((y / h) * bandSteps) / Math.max(1, bandSteps - 1);
    let hex = parsed[parsed.length - 1]![1];
    for (let i = 0; i + 1 < parsed.length; i++) {
      const [f0, c0] = parsed[i]!;
      const [f1, c1] = parsed[i + 1]!;
      if (qy <= f1 || i + 2 === parsed.length) {
        const span = Math.max(0.0001, f1 - f0);
        const t = Math.max(0, Math.min(1, (qy - f0) / span));
        hex = mixHex(c0, c1, t);
        break;
      }
    }
    colCache[y] = hexToAbgr(hex);
  }

  for (let y = 0; y < h; y++) {
    const col = colCache[y]!;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      buf.pixels[row + x] = col;
    }
  }
}

export interface CloudBankSpec {
  readonly baseY: number; // baseline Y in pixels
  readonly ampY: number; // max rise of cumulus peaks above baseY
  readonly flatBottomY?: number; // optional flat underside Y (floating daytime cumulus)
  readonly topDown?: boolean; // true for overhanging storm-cloud pillows (EVIL)
  readonly ramp: readonly [string, string, string, string, string]; // [rim, light, mid, shadow, deep]
  readonly freqX: number; // number of major cloud masses across width
  readonly seed: number;
  readonly lightDirX?: number; // -1 (left) to +1 (right)
  readonly fadeBottomPx?: number; // optional haze blend into horizon
  readonly hazeHex?: string;
  readonly isolated?: boolean; // true for separate floating daytime clouds with gaps between them
  readonly curlSweep?: number; // optional diagonal wind shear (e.g. GSHIP painterly wind clouds)
}

/**
 * Sculpts authentic, lush 16-bit SNES/GBA PIXEL-CLUSTERED cumulus cloud banks!
 * Built from overlapping 2D rounded cumulus domes + medium billow shoulders + tiny
 * cauliflower edge tufts wrapped seamlessly across buf.w, with true 2D spherical puff
 * illumination and curled inner billow shadows quantized to a 5-tone hue-shifted ramp.
 * ZERO flat ovals and ZERO vertical stalagmite spikes!
 */
export function paintPixelCloudBank(buf: PixelCanvas, spec: CloudBankSpec): void {
  const w = buf.w;
  const h = buf.h;
  const ramp = makeRamp(spec.ramp);
  const cRim = ramp[0]!;
  const cLight = ramp[1]!;
  const cMid = ramp[2]!;
  const cShadow = ramp[3]!;
  const cDeep = ramp[4]!;
  const lightDir = spec.lightDirX ?? -0.5;
  const topDown = Boolean(spec.topDown);
  const seed = spec.seed;
  const hazeCol = spec.hazeHex ? hexToAbgr(spec.hazeHex) : 0;
  const shear = spec.curlSweep ?? 0;

  interface Puff {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    tier: number; // 0 = base body, 1 = mid billow, 2 = crest tuft
  }

  const puffs: Puff[] = [];
  const majorCount = Math.max(2, Math.round(spec.freqX * 2));
  const spacing = w / majorCount;

  for (let i = 0; i < majorCount; i++) {
    const h1 = hash2f(i, 1, seed);
    const h2 = hash2f(i, 2, seed);
    const h3 = hash2f(i, 3, seed);
    const centerX = (i + 0.5) * spacing + (h1 - 0.5) * spacing * 0.24;

    if (spec.isolated) {
      // Distinct floating cumulus cloud islands with wide flat-ish wispy tails!
      const cY = spec.baseY - h2 * spec.ampY * 0.35;
      const bodyRx = Math.max(36, spacing * (0.32 + h3 * 0.1));
      const bodyRy = Math.max(16, spec.ampY * (0.36 + h2 * 0.18));
      puffs.push({ cx: centerX, cy: cY, rx: bodyRx, ry: bodyRy, tier: 0 });
      puffs.push({ cx: centerX - bodyRx * 0.65, cy: cY + bodyRy * 0.35, rx: bodyRx * 0.62, ry: bodyRy * 0.55, tier: 0 });
      puffs.push({ cx: centerX + bodyRx * 0.72, cy: cY + bodyRy * 0.38, rx: bodyRx * 0.72, ry: bodyRy * 0.45, tier: 0 });
      // Tapered wind-swept tail tip
      puffs.push({ cx: centerX + bodyRx * 1.32, cy: cY + bodyRy * 0.52, rx: bodyRx * 0.55, ry: bodyRy * 0.22, tier: 0 });
      // Fluffy cauliflower crown domes
      const domeCnt = 5;
      for (let d = 0; d < domeCnt; d++) {
        const dt = (d / (domeCnt - 1)) - 0.5;
        const arch = Math.cos(dt * Math.PI);
        const dr = bodyRy * (0.48 + arch * 0.46 + hash2f(i, 10 + d, seed) * 0.2);
        puffs.push({
          cx: centerX + dt * bodyRx * 1.45,
          cy: cY - arch * bodyRy * 0.78 + (hash2f(i, 20 + d, seed) - 0.5) * 6,
          rx: dr * 1.15,
          ry: dr * 0.92,
          tier: 1,
        });
        // Small rim tufts hugging each dome
        puffs.push({
          cx: centerX + dt * bodyRx * 1.55 - dr * 0.45,
          cy: cY - arch * bodyRy * 0.95 - dr * 0.22,
          rx: dr * 0.55,
          ry: dr * 0.48,
          tier: 2,
        });
      }
    } else if (topDown) {
      // Overhanging coiled storm-cloud pillows hugging the top ceiling!
      const archH = spec.ampY * (0.45 + 0.55 * (i % 2 === 0 ? 1 : 0.65) * (0.75 + h2 * 0.4));
      const rx = spacing * (0.58 + h3 * 0.22);
      const ry = Math.max(14, archH * 0.55);
      puffs.push({ cx: centerX, cy: spec.baseY + archH * 0.28, rx, ry, tier: 0 });
      for (let d = 0; d < 5; d++) {
        const dt = (d / 4) - 0.5;
        const bulge = Math.cos(dt * Math.PI);
        const pr = ry * (0.45 + bulge * 0.4 + hash2f(i, 30 + d, seed) * 0.18);
        puffs.push({
          cx: centerX + dt * rx * 1.55,
          cy: spec.baseY + archH * (0.35 + bulge * 0.42),
          rx: pr * 1.25,
          ry: pr * 0.78,
          tier: 1,
        });
        puffs.push({
          cx: centerX + dt * rx * 1.5 + (d % 2 === 0 ? -5 : 5),
          cy: spec.baseY + archH * (0.42 + bulge * 0.48) + pr * 0.35,
          rx: pr * 0.62,
          ry: pr * 0.46,
          tier: 2,
        });
      }
    } else {
      // Grand rolling SNES/GBA cumulus cloud-mountain bank (broad rounded domes + fluffy cauliflower rims!)
      const moundScale = 0.55 + 0.45 * Math.sin((i / majorCount) * Math.PI * 2 + seed * 0.3) * 0.5 + 0.22 + h2 * 0.32;
      const peakLift = spec.ampY * Math.min(1.05, moundScale);
      const baseRx = spacing * (0.64 + h3 * 0.22);
      const baseRy = Math.max(22, peakLift * 0.62);
      const baseCy = spec.baseY - peakLift * 0.36;

      // Primary broad rounded cumulus body
      puffs.push({ cx: centerX, cy: baseCy, rx: baseRx, ry: baseRy, tier: 0 });

      // Secondary overlapping billowing shoulder domes
      const domeCount = 5;
      for (let d = 0; d < domeCount; d++) {
        const dt = (d / (domeCount - 1)) - 0.5;
        const arch = Math.cos(dt * Math.PI);
        const dRx = baseRx * (0.32 + arch * 0.26 + hash2f(i, 40 + d, seed) * 0.1);
        const dRy = Math.max(14, dRx * (0.72 + hash2f(i, 50 + d, seed) * 0.16));
        const dCx = centerX + dt * baseRx * 1.48;
        const dCy = spec.baseY - peakLift * (0.28 + arch * 0.62) + (hash2f(i, 60 + d, seed) - 0.5) * 10;
        puffs.push({ cx: dCx, cy: dCy, rx: dRx, ry: dRy, tier: 1 });

        // Small crisp 16-bit cauliflower edge puffs crowning the silhouette!
        for (let t = -1; t <= 1; t += 2) {
          const tR = Math.max(7, dRy * (0.42 + hash2f(i * 7 + d, 70 + t, seed) * 0.18));
          puffs.push({
            cx: dCx + t * dRx * 0.55 + (hash2f(i, 80 + d * 3 + t, seed) - 0.5) * 6,
            cy: dCy - dRy * (0.45 + (t === -1 ? 0.1 : 0.0)),
            rx: tR * 1.15,
            ry: tR * 0.88,
            tier: 2,
          });
        }
      }
    }
  }

  // Rasterize 2D silhouette & smooth spherical cloud-cluster field!
  // Track top-most / bottom-most edge per column so solid cloud banks fill cleanly to bottom (or top)
  const mask = new Uint8Array(w * h);
  const rimDist = new Float32Array(w * h);
  const puffLit = new Float32Array(w * h);
  rimDist.fill(999);
  puffLit.fill(-99);

  // Stamp all puffs with exact horizontal wrap-around into scalar field
  for (let p = 0; p < puffs.length; p++) {
    const pf = puffs[p]!;
    const y0 = Math.max(0, Math.floor(pf.cy - pf.ry - 2));
    const y1 = Math.min(h - 1, Math.ceil(pf.cy + pf.ry + 2));
    const xSpan = Math.ceil(pf.rx + 2);
    const invRx = 1 / Math.max(1, pf.rx);
    const invRy = 1 / Math.max(1, pf.ry);

    for (let y = y0; y <= y1; y++) {
      const dy = (y - pf.cy) * invRy;
      const dy2 = dy * dy;
      if (dy2 > 1.05) continue;
      const shearOff = shear !== 0 ? (spec.baseY - y) * shear : 0;
      const row = y * w;

      for (let ox = -xSpan; ox <= xSpan; ox++) {
        const dx = ox * invRx;
        const d2 = dx * dx + dy2;
        if (d2 > 1.0) continue;

        const wx = wrapInt(Math.round(pf.cx + shearOff + ox), w);
        const idx = row + wx;
        mask[idx] = 1;

        // Distance from this puff's outer boundary (in pixels) for lush sunlit rim crests!
        const edgePx = (1 - Math.sqrt(d2)) * Math.min(pf.rx, pf.ry);
        // Directional spherical lighting on THIS specific rounded puff!
        const dirY = topDown ? dy : -dy; // topDown clouds lit brightly along hanging lower edge!
        const sphereLit = dirY * 0.78 + dx * lightDir * 0.45 + pf.tier * 0.14;

        // Higher-tier foreground puffs take shading priority over deep backing domes
        if (sphereLit > puffLit[idx]!) {
          puffLit[idx] = sphereLit;
          rimDist[idx] = edgePx;
        }
      }
    }
  }

  // Fill solid backing below cloud bank (or above for topDown) unless isolated floating clouds
  if (!spec.isolated) {
    if (topDown) {
      for (let x = 0; x < w; x++) {
        let lowest = -1;
        for (let y = h - 1; y >= 0; y--) {
          if (mask[y * w + x] === 1) {
            lowest = y;
            break;
          }
        }
        if (lowest < 0) continue;
        for (let y = 0; y <= lowest; y++) {
          const idx = y * w + x;
          if (mask[idx] === 0) {
            mask[idx] = 1;
            puffLit[idx] = -0.35 - (lowest - y) / Math.max(24, spec.ampY);
          }
        }
      }
    } else {
      const botLimit = spec.flatBottomY !== undefined ? Math.min(h - 1, spec.flatBottomY) : h - 1;
      for (let x = 0; x < w; x++) {
        let highest = h;
        for (let y = 0; y <= botLimit; y++) {
          if (mask[y * w + x] === 1) {
            highest = y;
            break;
          }
        }
        if (highest >= h) continue;
        for (let y = highest; y <= botLimit; y++) {
          const idx = y * w + x;
          if (mask[idx] === 0) {
            mask[idx] = 1;
            const dFromTop = (y - highest) / Math.max(28, spec.ampY);
            puffLit[idx] = -0.15 - dFromTop * 0.75;
          }
        }
      }
    }
  }

  // Apply crisp flat wispy underside cutoff if flatBottomY is set
  if (!topDown && spec.flatBottomY !== undefined) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const cutY = Math.round(
        spec.flatBottomY +
          Math.sin(u * Math.PI * 2 * Math.max(2, Math.round(spec.freqX * 2)) + seed) * 3.5 +
          (tileableNoise(u, 0.5, 16, 4, seed + 88) - 0.5) * 6,
      );
      for (let y = Math.max(0, cutY); y < h; y++) {
        mask[y * w + x] = 0;
      }
    }
  }

  // Final crisp 5-tone 16-bit pixel-art shading pass (clean sunlit outer rims + smooth billowy interior volume, ZERO internal noodle arcs!)
  for (let y = 0; y < h; y++) {
    const v = y / h;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      if (mask[idx] === 0) continue;

      const u = x / w;
      // Measure true distance from outer sky edge vertically AND diagonally toward light source
      let distToSky = 42;
      if (topDown) {
        for (let k = 1; k <= 40; k++) {
          if (y + k >= h || mask[(y + k) * w + x] === 0) {
            distToSky = k;
            break;
          }
        }
      } else {
        for (let k = 1; k <= 40; k++) {
          if (y - k < 0 || mask[(y - k) * w + x] === 0) {
            distToSky = k;
            break;
          }
        }
      }

      // Check subtle horizontal light-side exposure for crisp SNES rim curl along sunlit shoulders
      const sideStep = lightDir < 0 ? -4 : 4;
      const sideExposed = mask[row + wrapInt(x + sideStep, w)] === 0;

      // Multi-scale pixel-cluster turbulence creates fluffy scalloped transition edges between cloud tones!
      const nMacro = tileableFbm(u, v, 8, 6, 3, seed + 401);
      const nFine = tileableNoise(u, v, 24, 16, seed + 733);
      const puffPerturb = (nMacro - 0.5) * 18 + (nFine - 0.5) * 6;
      const effDepth = distToSky + puffPerturb - (sideExposed ? 5 : 0);
      const domeShade = puffLit[idx]! * 10;

      let col: number;
      if (distToSky <= 3 || (sideExposed && distToSky <= 7)) {
        col = cRim;
      } else if (effDepth < 9 + domeShade * 0.45) {
        col = cRim;
      } else if (effDepth < 21 + domeShade * 0.6) {
        col = cLight;
      } else if (effDepth < 42 + domeShade * 0.5) {
        col = cMid;
      } else if (effDepth < 68 + domeShade * 0.35) {
        col = cShadow;
      } else {
        col = cDeep;
      }

      // Soft bottom shadow underside on isolated / flat-bottom clouds
      if (!topDown && spec.flatBottomY !== undefined) {
        let distBot = 14;
        for (let k = 1; k <= 13; k++) {
          if (y + k >= h || mask[(y + k) * w + x] === 0) {
            distBot = k;
            break;
          }
        }
        const botBand = distBot + (nFine - 0.5) * 4;
        if (botBand <= 3) col = cDeep;
        else if (botBand <= 8) col = cShadow;
      }

      // Soft atmospheric horizon mist blend near bottom of tall cloud banks
      if (!topDown && spec.fadeBottomPx && hazeCol !== 0) {
        const startFade = h - spec.fadeBottomPx;
        if (y > startFade) {
          const t = Math.min(1, (y - startFade) / spec.fadeBottomPx);
          const qT = Math.floor(t * 5) / 5;
          col = blendAbgr(col, hazeCol, qT * 0.8);
        }
      }

      buf.pixels[idx] = col;
    }
  }
}

export interface MountainRangeSpec {
  readonly baseY: number;
  readonly peaks: readonly (readonly [number, number, number])[]; // [centerX, peakY, halfWidth]
  readonly litRim: string;
  readonly litFace: string;
  readonly midFace: string;
  readonly shadowFace: string;
  readonly deepShadow: string;
  readonly snowHex?: string;
  readonly seed: number;
  readonly hazeHex?: string;
  readonly hazeHeight?: number;
}

/**
 * Paints dramatic 16-bit faceted alpine mountain peaks with sunlit left slopes,
 * jagged rocky crest ridges, deep shadowed right faces, and optional snow/mist!
 * Horizontally wraps seamlessly across buf.w.
 */
export function paintPixelMountainRange(buf: PixelCanvas, spec: MountainRangeSpec): void {
  const w = buf.w;
  const h = buf.h;
  const cRim = hexToAbgr(spec.litRim);
  const cLit = hexToAbgr(spec.litFace);
  const cMid = hexToAbgr(spec.midFace);
  const cShad = hexToAbgr(spec.shadowFace);
  const cDeep = hexToAbgr(spec.deepShadow);
  const cSnow = spec.snowHex ? hexToAbgr(spec.snowHex) : 0;
  const cHaze = spec.hazeHex ? hexToAbgr(spec.hazeHex) : 0;

  for (let p = 0; p < spec.peaks.length; p++) {
    const [cx, py, hw] = spec.peaks[p]!;
    const pSeed = spec.seed + p * 79;
    const peakH = Math.max(12, spec.baseY - py);

    for (let dx = -hw; dx <= hw; dx++) {
      const wx = wrapInt(Math.round(cx + dx), w);
      const tAbs = Math.abs(dx) / hw;
      // Stepped craggy slope with subtle rocky shoulders (NOT a smooth ruler triangle!)
      const jag =
        Math.sin(tAbs * 14 + pSeed) * 3.5 +
        Math.sin(tAbs * 29 + pSeed * 2) * 1.8;
      const slopeCurve = Math.pow(tAbs, 0.92);
      const topY = Math.round(py + slopeCurve * peakH + (tAbs > 0.06 ? jag : 0));

      // Center spine meanders organically downward so the light/shadow split looks hand-carved!
      for (let y = Math.max(0, topY); y < h; y++) {
        const yFrac = (y - py) / Math.max(1, peakH);
        const spineDx =
          Math.sin(yFrac * 6.5 + pSeed) * (hw * 0.14) +
          Math.cos(yFrac * 13.0 + pSeed * 1.7) * (hw * 0.05);
        const isLitSide = dx < spineDx;
        const distFromEdge = y - topY;
        const rockN = tileableNoise(wx / w, y / h, 24, 18, pSeed + 19);

        let col: number;
        if (cSnow !== 0 && yFrac < 0.24 + (rockN - 0.5) * 0.12) {
          col = isLitSide ? cSnow : cLit;
        } else if (isLitSide) {
          if (distFromEdge <= 2 || (dx < spineDx - 1 && dx > spineDx - 4 && rockN > 0.45)) {
            col = cRim;
          } else if (rockN > 0.62 && yFrac > 0.25) {
            col = cMid;
          } else {
            col = cLit;
          }
        } else {
          if (distFromEdge <= 2 && rockN > 0.35) {
            col = cMid;
          } else if (dx < spineDx + 6 + rockN * 8) {
            col = cShad;
          } else {
            col = rockN > 0.55 ? cDeep : cShad;
          }
        }

        if (cHaze !== 0 && spec.hazeHeight && y > h - spec.hazeHeight) {
          const ht = Math.min(1, (y - (h - spec.hazeHeight)) / spec.hazeHeight);
          col = blendAbgr(col, cHaze, Math.floor(ht * 4) / 4 * 0.7);
        }

        buf.pixels[y * w + wx] = col;
      }
    }
  }
}

/**
 * Paints a lush, pixel-clustered 16-bit foliage canopy tree (umbrella or broadleaf crown)
 * with sculpted sunlit top clusters, midtone leaf tufts, shadowed undersides, and organic trunk!
 */
export function paintPixelCanopyTree(
  buf: PixelCanvas,
  cx: number,
  groundY: number,
  trunkW: number,
  trunkH: number,
  crownRx: number,
  crownRy: number,
  colors: {
    readonly leafHi: string;
    readonly leafMid: string;
    readonly leafDark: string;
    readonly trunkHi: string;
    readonly trunkMid: string;
    readonly trunkDark: string;
  },
  seed: number,
): void {
  const cLH = hexToAbgr(colors.leafHi);
  const cLM = hexToAbgr(colors.leafMid);
  const cLD = hexToAbgr(colors.leafDark);
  const cTH = hexToAbgr(colors.trunkHi);
  const cTM = hexToAbgr(colors.trunkMid);
  const cTD = hexToAbgr(colors.trunkDark);

  // Tapered organic trunk with flared root base
  const topY = groundY - trunkH;
  for (let y = topY; y <= groundY; y++) {
    const t = (y - topY) / Math.max(1, trunkH);
    const flare = t > 0.72 ? Math.pow((t - 0.72) / 0.28, 1.6) * (trunkW * 0.55) : 0;
    const hw = Math.max(1, Math.round(trunkW * (0.42 + t * 0.14) + flare));
    const sway = Math.round(Math.sin(t * 3.1 + seed) * 1.4);
    for (let dx = -hw; dx <= hw; dx++) {
      const col = dx <= -hw + 1 ? cTH : dx >= hw - 1 ? cTD : cTM;
      buf.pxWrapX(cx + sway + dx, y, col);
    }
  }

  // Sculpted pixel-clustered multi-lobe foliage crown
  const lobes: Array<[number, number, number, number]> = [
    [0, -crownRy * 0.25, crownRx * 0.72, crownRy * 0.78],
    [-crownRx * 0.55, crownRy * 0.1, crownRx * 0.52, crownRy * 0.58],
    [crownRx * 0.55, crownRy * 0.12, crownRx * 0.5, crownRy * 0.56],
    [-crownRx * 0.24, -crownRy * 0.52, crownRx * 0.48, crownRy * 0.52],
    [crownRx * 0.28, -crownRy * 0.45, crownRx * 0.46, crownRy * 0.5],
  ];
  const cyBase = topY + 2;
  const xMin = Math.floor(-crownRx * 1.2);
  const xMax = Math.ceil(crownRx * 1.2);
  const yMin = Math.floor(-crownRy * 1.2);
  const yMax = Math.ceil(crownRy * 0.85);

  for (let dy = yMin; dy <= yMax; dy++) {
    for (let dx = xMin; dx <= xMax; dx++) {
      let minDist = 99;
      let hitLobeY = 0;
      let hitLobeX = 0;
      for (let i = 0; i < lobes.length; i++) {
        const [lx, ly, rx, ry] = lobes[i]!;
        const nd = Math.hypot((dx - lx) / rx, (dy - ly) / ry);
        if (nd < minDist) {
          minDist = nd;
          hitLobeX = (dx - lx) / rx;
          hitLobeY = (dy - ly) / ry;
        }
      }
      const tuft = (hash2f((cx + dx) >> 1, (cyBase + dy) >> 1, seed) - 0.5) * 0.24;
      if (minDist + tuft > 1.0) continue;
      const shade = hitLobeX * 0.35 + hitLobeY * 0.78 + tuft * 0.6;
      const col = shade < -0.18 ? cLH : shade > 0.34 ? cLD : cLM;
      buf.pxWrapX(cx + dx, cyBase + dy, col);
    }
  }
}

/**
 * Paints a weathered 16-bit carved stone temple/ruin pillar with individual beveled courses,
 * hairline cracks, warm sunlit left rim, and cool shadowed right face.
 */
export function paintPixelStonePillar(
  buf: PixelCanvas,
  x: number,
  yTop: number,
  width: number,
  height: number,
  colors: {
    readonly hi: string;
    readonly light: string;
    readonly mid: string;
    readonly dark: string;
    readonly mortar: string;
  },
  seed: number,
  courseH = 12,
): void {
  const cHi = hexToAbgr(colors.hi);
  const cL = hexToAbgr(colors.light);
  const cM = hexToAbgr(colors.mid);
  const cD = hexToAbgr(colors.dark);
  const cMor = hexToAbgr(colors.mortar);

  for (let py = 0; py < height; py++) {
    const wy = yTop + py;
    if (wy < 0 || wy >= buf.h) continue;
    const rowIdx = Math.floor(py / courseH);
    const ly = py % courseH;
    const brickW = Math.max(10, Math.floor(width / 3));
    const shift = (rowIdx & 1) * (brickW >> 1);

    for (let px = 0; px < width; px++) {
      const bx = (px + shift) % brickW;
      const bId = hash2i(Math.floor((px + shift) / brickW), rowIdx, seed);
      const xFrac = px / Math.max(1, width - 1);

      let col: number;
      if (ly === 0 || bx === 0 || px === 0 || px === width - 1) {
        col = cMor;
      } else if (ly === 1 && bx < brickW - 1) {
        col = xFrac < 0.45 ? cHi : xFrac < 0.8 ? cL : cM;
      } else if (bx === 1 && ly < courseH - 1) {
        col = xFrac < 0.55 ? cHi : cL;
      } else if (ly === courseH - 1 || bx === brickW - 1) {
        col = cD;
      } else {
        // Subtle per-brick warm/cool tone variation & hairline weathering
        const tone = bId % 5;
        if (xFrac < 0.32) {
          col = tone === 0 ? cHi : tone === 4 ? cM : cL;
        } else if (xFrac > 0.72) {
          col = tone === 0 ? cM : cD;
        } else {
          col = tone === 0 ? cL : tone === 3 ? cD : cM;
        }
        // Occasional crisp pixel crack
        if ((bId & 31) === 7 && ly >= 4 && ly <= 8 && bx === ((bId >> 5) % (brickW - 3)) + 2) {
          col = cMor;
        }
      }

      buf.pxWrapX(x + px, wy, col);
    }
  }
}

/**
 * Paints an authentic weathered stone coastal/gothic archway silhouette with carved voussoir blocks!
 */
export function paintPixelStoneArch(
  buf: PixelCanvas,
  cx: number,
  groundY: number,
  spanW: number,
  archH: number,
  pierW: number,
  colors: {
    readonly hi: string;
    readonly light: string;
    readonly mid: string;
    readonly dark: string;
    readonly mortar: string;
  },
  seed: number,
): void {
  const halfSpan = spanW >> 1;
  const openHalf = Math.max(8, halfSpan - pierW);
  const archR = openHalf;
  const archCenterY = groundY - (archH - archR - 14);
  const topY = groundY - archH;

  const cHi = hexToAbgr(colors.hi);
  const cL = hexToAbgr(colors.light);
  const cM = hexToAbgr(colors.mid);
  const cD = hexToAbgr(colors.dark);
  const cMor = hexToAbgr(colors.mortar);

  for (let y = topY; y < groundY; y++) {
    if (y < 0 || y >= buf.h) continue;
    const rowIdx = Math.floor((y - topY) / 9);
    const ly = (y - topY) % 9;
    const shift = (rowIdx & 1) * 7;

    for (let dx = -halfSpan; dx <= halfSpan; dx++) {
      // Carve out the arched opening
      if (y >= archCenterY && Math.abs(dx) < openHalf) continue;
      if (y < archCenterY) {
        const distOpen = Math.hypot(dx, y - archCenterY);
        if (distOpen < archR) continue;
      }
      // Subtle weathered crumbling top parapet silhouette
      const crumble =
        Math.sin((dx + seed * 3) * 0.16) * 4 +
        (hash2f((dx + 128) >> 2, 0, seed) - 0.5) * 6;
      if (y < topY + 6 + crumble) continue;

      const bx = wrapInt(dx + halfSpan + shift, 14);
      const bId = hash2i(Math.floor((dx + halfSpan + shift) / 14), rowIdx, seed);
      const distArchEdge =
        y < archCenterY ? Math.hypot(dx, y - archCenterY) - archR : Math.abs(dx) - openHalf;

      let col: number;
      if (ly === 0 || bx === 0) {
        col = cMor;
      } else if (distArchEdge < 2.2) {
        col = dx < 0 ? cD : cHi;
      } else if (ly === 1 || bx === 1) {
        col = dx < 4 ? cHi : cL;
      } else if (ly === 8 || bx === 13) {
        col = cD;
      } else {
        col = (bId % 4) === 0 ? cL : (bId % 4) === 3 ? cD : cM;
      }
      buf.pxWrapX(cx + dx, y, col);
    }
  }
}

/** Paints crisp shimmering pixel water reflections across a horizontal ocean band. */
export function paintMoonlitOcean(
  buf: PixelCanvas,
  yTop: number,
  yBot: number,
  moonX: number,
  waterColors: {
    readonly horizon: string;
    readonly deep: string;
    readonly mid: string;
    readonly shimmerA: string;
    readonly shimmerB: string;
  },
  seed: number,
): void {
  const cHor = hexToAbgr(waterColors.horizon);
  const cDeep = hexToAbgr(waterColors.deep);
  const cMid = hexToAbgr(waterColors.mid);
  const cShA = hexToAbgr(waterColors.shimmerA);
  const cShB = hexToAbgr(waterColors.shimmerB);

  for (let y = Math.max(0, yTop); y < Math.min(buf.h, yBot); y++) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    const spread = 24 + t * 92;
    for (let x = 0; x < buf.w; x++) {
      let col = y <= yTop + 1 ? cHor : t < 0.35 ? cMid : cDeep;
      const distMoon = Math.abs(x - moonX);
      const wave =
        Math.sin(x * 0.11 + y * 0.55 + seed) * 0.5 +
        Math.sin(x * 0.27 - y * 0.9) * 0.5;
      if (distMoon < spread && wave > 0.1 + (distMoon / spread) * 0.65) {
        col = distMoon < spread * 0.45 && wave > 0.45 ? cShA : cShB;
      } else if (((y & 3) === 0) && hash2f(x >> 3, y, seed) > 0.86) {
        col = cMid;
      }
      buf.px(x, y, col);
    }
  }
}
