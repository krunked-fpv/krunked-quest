/**
 * Krunked Quest — Built-In 16-Bit Pixel-Art Biome, Tilemap, Parallax & Prop Baker
 * Pre-bakes crisp nearest-neighbor offscreen canvases once at boot (headless-safe).
 * Clean-room procedural pixel art mirroring the exact extracted hex palettes,
 * stonework/foliage depth, inner-corner joins, multi-layer parallax horizons,
 * special tiles, interactive world props, and animated Hub NPCs.
 * Zero per-frame allocations; zero third-party proper nouns.
 */

import {
  BIOME_IDS,
  HERO_FORMS,
  type BiomeId,
  type ShopId,
} from '../contracts/index.js';
import {
  BIOME_PALETTES,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  hexToAbgr,
  mixHex,
  type BiomePalette,
} from './palettes.js';

export interface BiomeParallaxSet {
  readonly sky: HTMLCanvasElement;
  readonly far: HTMLCanvasElement;
  readonly mid: HTMLCanvasElement;
  readonly near: HTMLCanvasElement;
}

export interface BuiltInWorldArt {
  readonly biomeTilesets: Map<BiomeId, HTMLCanvasElement>;
  readonly biomeInnerCorners: Map<BiomeId, HTMLCanvasElement>;
  readonly biomeDeco: Map<BiomeId, HTMLCanvasElement>;
  readonly biomeParallax: Map<BiomeId, BiomeParallaxSet>;
  readonly specialTiles: Map<string, HTMLCanvasElement>;
  readonly props: Map<string, HTMLCanvasElement>;
  readonly npcs: Map<ShopId, HTMLCanvasElement>;
}

// ============================================================================
// Integer Pixel Buffer (Zero Anti-Aliasing, 1px Crisp Dark-Plum Outlines)
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

  public roundedRect(x: number, y: number, w: number, h: number, col: number): void {
    if (w <= 2 || h <= 2) {
      this.rect(x, y, w, h, col);
      return;
    }
    this.rect(x + 1, y, w - 2, h, col);
    this.rect(x, y + 1, w, h - 2, col);
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
}

function hash2d(x: number, y: number, seed = 0): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n ^ (n >>> 16)) >>> 0;
}

// ============================================================================
// 1. 16-Mask Autotiled Biome Tilesets (512x96: 16 bitmasks x 3 organic rows)
//    Bitmask: 1=UP, 2=RIGHT, 4=DOWN, 8=LEFT
//    Row 0 is canonical (100% compatible with legacy 512x32 single-row reads);
//    Rows 1 & 2 provide rich deterministic stonework / detail variation.
// ============================================================================

export const BUILTIN_TILESET_VARIANTS = 3;

export function bakeBiomeTileset(pal: BiomePalette): HTMLCanvasElement {
  const sheet = new PixelBuf(32 * 16, 32 * BUILTIN_TILESET_VARIANTS);
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
  const cCapHi = hexToAbgr(mixHex(pal.capLight, HIGHLIGHT_CREAM, 0.45));
  const cEarSpec = hexToAbgr(mixHex(pal.earthLight, HIGHLIGHT_CREAM, 0.28));
  const style = pal.style;

  for (let variant = 0; variant < BUILTIN_TILESET_VARIANTS; variant++) {
    const oy = variant * 32;
    const vSeed = variant * 97 + 13;

    for (let mask = 0; mask < 16; mask++) {
      const hasUp = (mask & 1) !== 0;
      const hasRight = (mask & 2) !== 0;
      const hasDown = (mask & 4) !== 0;
      const hasLeft = (mask & 8) !== 0;
      const ox = mask * 32;

      // ----------------------------------------------------------------------
      // Step A: Rich biome-authentic interior masonry / earth / bark / tech
      // ----------------------------------------------------------------------
      for (let ly = 0; ly < 32; ly++) {
        for (let lx = 0; lx < 32; lx++) {
          let col = cEarM;
          const h = hash2d(lx + mask * 7, ly + variant * 11, vSeed);

          if (style === 'cavern_moss') {
            // Warm terracotta rounded cobblestone blocks with deep mortar & subtle twin-slot stone faces
            const row = ly >> 3;
            const shift = (row & 1) === 0 ? (variant * 4) : 6 + variant * 2;
            const bx = (lx + shift) % 12;
            const by = ly & 7;
            const corner = (bx === 0 || bx === 11) && (by === 0 || by === 7);
            if (by === 0 || bx === 0 || corner) {
              col = cEarDeep;
            } else if (by === 1 && bx > 1 && bx < 10) {
              col = (h & 7) === 0 ? cEarSpec : cEarL;
            } else if (bx === 1 && by > 1 && by < 6) {
              col = cEarL;
            } else if (by === 7 || bx === 11) {
              col = cEarD;
            } else {
              col = (h & 7) === 0 ? cEarD : (h & 15) === 3 ? cEarL : cEarM;
            }
          } else if (style === 'village_meadow') {
            // Rounded slate-plum river cobbles with warm sunlit coral-rose faceted caps
            const row = (ly + ((lx >> 3) & 1) * 4) % 9;
            const cellX = (lx + ((ly >> 3) * 5) + variant * 3) % 9;
            const dx = cellX - 4;
            const dy = row - 4;
            const d2 = dx * dx + dy * dy;
            if (d2 >= 15) {
              col = cEarDeep;
            } else if (dy <= -2 && dx <= 1) {
              col = cEarL;
            } else if (dx >= 2 && dy <= 0) {
              col = (variant === 2 && (h & 3) === 0) ? cAcc : cEarL;
            } else if (dy >= 2 || dx <= -3) {
              col = cEarD;
            } else {
              col = (h & 7) === 0 ? cEarD : cEarM;
            }
          } else if (style === 'sunlit_trail') {
            // Layered angular faceted burgundy-umber cliff boulders
            const band = (ly + ((lx >> 4) & 1) * 3) % 10;
            const seg = (lx + (ly >> 3) * 7 + variant * 5) % 14;
            const diag = (seg + band) % 14;
            if (band === 0 || seg === 0 || (band === 1 && seg === 13)) {
              col = cEarDeep;
            } else if (band === 1 || (band === 2 && seg > 1 && seg < 11)) {
              col = cEarL;
            } else if (diag === 7 && band > 3) {
              col = cEarD;
            } else if (band >= 8 || seg >= 12) {
              col = cEarD;
            } else {
              col = (h & 5) === 0 ? cEarD : cEarM;
            }
          } else if (style === 'infested_canopy') {
            // Intertwined midnight-navy forest roots with crimson-rose spore pods
            const wave = Math.round(Math.sin((lx + variant * 7) * 0.32 + (ly >> 3) * 1.4) * 3);
            const ry = (ly + wave + 32) % 10;
            const rx = (lx + (ly >> 3) * 5) % 16;
            if (ry === 0 || ry === 9) {
              col = cEarDeep;
            } else if (ry === 1 || ry === 2) {
              col = cEarL;
            } else if (ry >= 7) {
              col = cEarD;
            } else if (rx >= 6 && rx <= 8 && ry >= 4 && ry <= 5 && ((lx + ly + variant) & 1) === 0) {
              col = cAcc;
            } else {
              col = (h & 3) === 0 ? cEarD : cEarM;
            }
          } else if (style === 'primal_bark') {
            // Swirling organic crimson-rose heartwood grain & pale knot ribs
            const swirl = Math.round(Math.sin((ly + variant * 5) * 0.35) * 2.5);
            const gx = (lx + swirl + 32) % 8;
            const knot = Math.abs(lx - 16 + variant * 4) + Math.abs(ly - 16);
            if (knot === 4) {
              col = cEarDeep;
            } else if (knot === 3) {
              col = cEarL;
            } else if (gx === 0) {
              col = cEarDeep;
            } else if (gx === 1 || gx === 2) {
              col = cEarL;
            } else if (gx === 6 || gx === 7) {
              col = cEarD;
            } else {
              col = (h & 7) === 0 ? cEarD : cEarM;
            }
          } else if (style === 'volcanic_basalt') {
            // Obsidian basalt blocks split by branching incandescent magma veins
            const vx = lx + variant * 7;
            const vy = ly + variant * 5;
            const v1 = Math.abs(((vx * 3 + vy * 2 + Math.round(Math.sin(vy * 0.25) * 4)) % 23) - 11);
            const v2 = Math.abs(((vx * 2 - vy * 3 + 64) % 29) - 14);
            const crack = Math.min(v1, v2);
            if (crack === 0) {
              col = ((lx + ly) & 3) === 0 ? cAcc : cCapM;
            } else if (crack === 1) {
              col = cCapD;
            } else if (crack === 2) {
              col = cEarDeep;
            } else {
              col = (h & 3) === 0 ? cEarDeep : (h & 7) === 1 ? cEarL : cEarM;
            }
          } else if (style === 'desert_sandstone') {
            // Stacked weathered sandstone slabs with warm golden bevels & horizontal grain
            const row = (ly + variant * 2) % 8;
            const brickX = (lx + (ly >> 3) * 9 + variant * 5) % 16;
            if (row === 0 || brickX === 0) {
              col = cEarDeep;
            } else if (row === 1 || (row === 2 && brickX < 12)) {
              col = (h & 7) === 0 ? cCapL : cEarL;
            } else if (row === 7 || brickX === 15) {
              col = cEarD;
            } else {
              col = (h & 7) === 0 ? cEarD : (h & 11) === 0 ? cEarL : cEarM;
            }
          } else if (style === 'arcane_labyrinth') {
            // Ornate interlocking bronze-and-burgundy puzzle stone with antique gold trim
            const bx = (lx + variant * 4) & 15;
            const by = (ly + variant * 4) & 15;
            const isTab =
              (bx === 7 || bx === 8) && (by <= 2 || by >= 13) ||
              (by === 7 || by === 8) && (bx <= 2 || bx >= 13);
            if (bx === 0 || by === 0) {
              col = isTab ? cEarM : cEarDeep;
            } else if (bx === 1 || by === 1) {
              col = cEarL;
            } else if (bx === 15 || by === 15) {
              col = cEarD;
            } else if ((bx === 4 || bx === 11) && (by === 4 || by === 11)) {
              col = variant === 1 ? cCapM : cAcc;
            } else {
              col = (h & 7) === 0 ? cEarD : cEarM;
            }
          } else if (style === 'atomic_temple') {
            // Geometric cobalt-navy high-tech panels with glowing cyan circuits & magenta diodes
            const cx = Math.abs(lx - 15.5);
            const cy = Math.abs(ly - 15.5);
            const diamond = Math.round(cx + cy);
            if (lx === 0 || ly === 0 || lx === 31 || ly === 31) {
              col = cEarDeep;
            } else if (lx === 1 || ly === 1) {
              col = cEarL;
            } else if (diamond === 10 || diamond === 11) {
              col = diamond === 10 ? cCapM : cEarDeep;
            } else if ((lx === 15 || lx === 16) && (ly >= 6 && ly <= 25) && variant !== 1) {
              col = cCapD;
            } else if ((ly === 15 || ly === 16) && (lx >= 6 && lx <= 25) && variant === 1) {
              col = cCapD;
            } else if (cx <= 2 && cy <= 2) {
              col = cx <= 1 && cy <= 1 ? cAccAlt : cAcc;
            } else {
              col = ((lx + ly) & 3) === 0 ? cEarD : cEarM;
            }
          } else if (style === 'nightmare_spire') {
            // Dark charcoal monolith bricks with recessed gothic arch/mask reliefs
            const bx = (lx + (ly >> 4) * 8) & 15;
            const by = ly & 15;
            if (bx === 0 || by === 0) {
              col = cEarDeep;
            } else if (by === 1 || bx === 1) {
              col = cEarL;
            } else if (bx >= 5 && bx <= 10 && by >= 4 && by <= 11) {
              // Subtle haunted stone relief eyes
              if ((bx === 6 || bx === 9) && (by === 6 || by === 7)) {
                col = variant === 2 ? cAccAlt : cEarDeep;
              } else if (by === 10 && bx >= 6 && bx <= 9) {
                col = cEarDeep;
              } else {
                col = cEarD;
              }
            } else {
              col = (h & 7) === 0 ? cEarDeep : cEarM;
            }
          } else {
            // ghost_timber: Weathered haunted ship deck planks with curved grain & iron bolts
            const py = ly & 7;
            const plankIdx = (ly >> 3) + variant;
            const seamX = (plankIdx * 11 + 7) & 31;
            if (py === 0 || lx === seamX) {
              col = cEarDeep;
            } else if (py === 1) {
              col = cEarL;
            } else if (py === 7) {
              col = cEarD;
            } else if ((lx === (seamX + 3) % 32 || lx === (seamX + 29) % 32) && (py === 3 || py === 4)) {
              col = cOutline;
            } else {
              const grain = ((lx + plankIdx * 5 + ((py === 4) ? 2 : 0)) % 9) === 0;
              col = grain ? cEarD : (h & 11) === 0 ? cEarL : cEarM;
            }
          }

          sheet.px(ox + lx, oy + ly, col);
        }
      }

      // Subtle stone glyph face accent on MLAIR interior cobblestone variant 2
      if (style === 'cavern_moss' && variant === 2 && hasUp) {
        sheet.px(ox + 14, oy + 11, cEarDeep);
        sheet.px(ox + 14, oy + 12, cEarDeep);
        sheet.px(ox + 17, oy + 11, cEarDeep);
        sheet.px(ox + 17, oy + 12, cEarDeep);
      }

      // ----------------------------------------------------------------------
      // Step B: Rich biome TOP CAP overhang when top is exposed (!hasUp)
      // ----------------------------------------------------------------------
      if (!hasUp) {
        for (let lx = 0; lx < 32; lx++) {
          let capDepth = 7;
          if (style === 'atomic_temple' || style === 'arcane_labyrinth') {
            capDepth = 6;
          } else if (style === 'ghost_timber') {
            capDepth = 5 + (((lx * 3 + variant * 5) % 7 === 0) ? 2 : 0);
          } else if (style === 'volcanic_basalt') {
            capDepth = 7;
          } else {
            // Organic scalloped grass / moss / foliage overhang
            const waveA = Math.sin((lx + mask * 5 + variant * 7) * 0.45);
            const waveB = ((lx * 5 + mask * 3 + variant * 2) % 7 === 0) ? 2 : 0;
            capDepth = 6 + (waveA > 0.25 ? 2 : waveA > -0.35 ? 1 : 0) + waveB;
          }

          for (let ly = 1; ly < capDepth; ly++) {
            let c = cCapM;
            if (style === 'volcanic_basalt' && ly >= 3 && ly <= 5) {
              // Runic volcanic altar frieze band
              c = ((lx + variant) % 4 === 0 || ly === 4 && ((lx + variant) % 4 === 2)) ? cEarDeep : cCapL;
            } else if (style === 'atomic_temple') {
              c = ly === 1 ? cCapHi : ly <= 3 ? cCapL : ly === 4 ? cCapM : cCapD;
            } else if (ly === 1) {
              c = ((lx + variant) % 3 === 0) ? cCapHi : cCapL;
            } else if (ly === 2) {
              c = cCapL;
            } else if (ly >= capDepth - 2) {
              c = cCapD;
            } else if (((lx + ly) & 3) === 0) {
              c = cCapL;
            }
            sheet.px(ox + lx, oy + ly, c);
          }
          // Crisp shadow lip underneath cap overhang
          sheet.px(ox + lx, oy + capDepth, cOutline);
          if (capDepth + 1 < 32) {
            sheet.px(ox + lx, oy + capDepth + 1, cEarDeep);
          }

          // Top blade highlights / flowers / runes
          if (lx > 3 && lx < 28 && (lx + variant * 4) % 9 === 4) {
            sheet.px(ox + lx, oy + 2, cAcc);
            sheet.px(ox + lx + 1, oy + 3, cAccAlt);
          }
        }
      }

      // ----------------------------------------------------------------------
      // Step C: Exposed edge bevels, rim lighting & crisp 1px dark outlines
      // ----------------------------------------------------------------------
      const rimCol =
        style === 'atomic_temple' || style === 'nightmare_spire' || style === 'primal_bark'
          ? cAcc
          : style === 'volcanic_basalt' || style === 'arcane_labyrinth' || style === 'desert_sandstone'
            ? cCapL
            : cEarL;

      if (!hasUp) {
        for (let lx = 0; lx < 32; lx++) sheet.px(ox + lx, oy, cOutline);
      }
      if (!hasDown) {
        for (let lx = 0; lx < 32; lx++) {
          sheet.px(ox + lx, oy + 29, cEarD);
          sheet.px(ox + lx, oy + 30, cEarDeep);
          sheet.px(ox + lx, oy + 31, cOutline);
        }
      }
      if (!hasLeft) {
        for (let ly = 0; ly < 32; ly++) {
          sheet.px(ox + 2, oy + ly, ly < 7 && !hasUp ? cCapM : cEarL);
          sheet.px(ox + 1, oy + ly, ly < 7 && !hasUp ? cCapHi : rimCol);
          sheet.px(ox, oy + ly, cOutline);
        }
      }
      if (!hasRight) {
        for (let ly = 0; ly < 32; ly++) {
          sheet.px(ox + 29, oy + ly, ly < 7 && !hasUp ? cCapD : cEarD);
          sheet.px(ox + 30, oy + ly, ly < 7 && !hasUp ? cCapD : cEarDeep);
          sheet.px(ox + 31, oy + ly, cOutline);
        }
      }

      // ----------------------------------------------------------------------
      // Step D: Rounded outer pixel corners on exposed 90-degree corners
      // ----------------------------------------------------------------------
      if (!hasUp && !hasLeft) {
        sheet.px(ox, oy, 0);
        sheet.px(ox + 1, oy, cOutline);
        sheet.px(ox, oy + 1, cOutline);
        sheet.px(ox + 1, oy + 1, cOutline);
      }
      if (!hasUp && !hasRight) {
        sheet.px(ox + 31, oy, 0);
        sheet.px(ox + 30, oy, cOutline);
        sheet.px(ox + 31, oy + 1, cOutline);
        sheet.px(ox + 30, oy + 1, cOutline);
      }
      if (!hasDown && !hasLeft) {
        sheet.px(ox, oy + 31, 0);
        sheet.px(ox + 1, oy + 31, cOutline);
        sheet.px(ox, oy + 30, cOutline);
        sheet.px(ox + 1, oy + 30, cOutline);
      }
      if (!hasDown && !hasRight) {
        sheet.px(ox + 31, oy + 31, 0);
        sheet.px(ox + 30, oy + 31, cOutline);
        sheet.px(ox + 31, oy + 30, cOutline);
        sheet.px(ox + 30, oy + 30, cOutline);
      }
    }
  }

  return sheet.toCanvas();
}

/**
 * 4 crisp 8x8 concave inner-corner patches packed into a 32x8 strip:
 * [0]=Top-Left inner corner, [1]=Top-Right, [2]=Bottom-Left, [3]=Bottom-Right.
 * Drawn by TileRenderer when adjacent cardinal neighbors are solid but the diagonal is empty.
 */
export function bakeBiomeInnerCorners(pal: BiomePalette): HTMLCanvasElement {
  const sheet = new PixelBuf(32, 8);
  const cOut = hexToAbgr(pal.outline);
  const cDeep = hexToAbgr(pal.earthDeep);
  const cHi = hexToAbgr(pal.capLight);

  // [0] Top-Left inner notch (at x=0..7, y=0..7)
  sheet.rect(0, 0, 3, 3, cOut);
  sheet.px(3, 0, cOut);
  sheet.px(0, 3, cOut);
  sheet.px(3, 1, cHi);
  sheet.px(1, 3, cHi);
  sheet.px(2, 2, cHi);

  // [1] Top-Right inner notch (at x=8..15, y=0..7)
  sheet.rect(13, 0, 3, 3, cOut);
  sheet.px(12, 0, cOut);
  sheet.px(15, 3, cOut);
  sheet.px(12, 1, cDeep);
  sheet.px(14, 3, cDeep);
  sheet.px(13, 2, cDeep);

  // [2] Bottom-Left inner notch (at x=16..23, y=0..7)
  sheet.rect(16, 5, 3, 3, cOut);
  sheet.px(19, 7, cOut);
  sheet.px(16, 4, cOut);
  sheet.px(19, 6, cDeep);
  sheet.px(17, 4, cDeep);

  // [3] Bottom-Right inner notch (at x=24..31, y=0..7)
  sheet.rect(29, 5, 3, 3, cOut);
  sheet.px(28, 7, cOut);
  sheet.px(31, 4, cOut);
  sheet.px(28, 6, cDeep);
  sheet.px(30, 4, cDeep);

  return sheet.toCanvas();
}

// ============================================================================
// 2. Biome-Tailored Surface Deco Tufts/Flora/Crystals/Runes (128x16, 8x16x16)
// ============================================================================

export function bakeBiomeDeco(pal: BiomePalette): HTMLCanvasElement {
  const sheet = new PixelBuf(16 * 8, 16);
  const cL = hexToAbgr(pal.capLight);
  const cM = hexToAbgr(pal.capMid);
  const cD = hexToAbgr(pal.capDark);
  const cAcc = hexToAbgr(pal.accent);
  const cAcc2 = hexToAbgr(pal.accentAlt);
  const cEar = hexToAbgr(pal.earthLight);
  const cOut = hexToAbgr(pal.outline);
  const cCream = hexToAbgr(HIGHLIGHT_CREAM);
  const cell = new PixelBuf(16, 16);

  const isTech = pal.id === 'TEMP';
  const isVolc = pal.id === 'ATVC';
  const isDesert = pal.id === 'DSI';
  const isGothic = pal.id === 'LAB' || pal.id === 'EVIL' || pal.id === 'GSHIP';

  for (let v = 0; v < 8; v++) {
    cell.clear();

    if (isTech) {
      if (v % 3 === 0) {
        // Mini glowing neon circuit pylon
        cell.rect(6, 7, 4, 8, cD);
        cell.rect(7, 8, 2, 6, cM);
        cell.rect(6, 5, 4, 2, cL);
        cell.px(7, 4, cAcc);
      } else if (v % 3 === 1) {
        // Twin antenna prongs
        cell.line(5, 15, 5, 9, cM);
        cell.line(10, 15, 10, 7, cM);
        cell.px(5, 8, cAcc);
        cell.px(10, 6, cL);
      } else {
        // Low energy conduit node
        cell.ellipse(8, 13, 4, 2, cD);
        cell.ellipse(8, 12, 2, 1.5, cL);
      }
    } else if (isVolc) {
      if (v % 3 === 0) {
        // Volcanic obsidian shard cluster
        cell.tri(3, 15, 6, 7, 9, 15, cEar);
        cell.tri(8, 15, 11, 10, 13, 15, cD);
        cell.px(6, 9, cAcc);
      } else if (v % 3 === 1) {
        // Glowing magma vent fissure
        cell.ellipse(8, 14, 5, 2, cD);
        cell.ellipse(8, 13, 3, 1.5, cM);
        cell.px(8, 11, cAcc);
        cell.px(7, 9, cL);
      } else {
        // Small ember tuft
        cell.line(5, 15, 4, 11, cD);
        cell.line(9, 15, 11, 10, cM);
        cell.px(11, 9, cAcc);
      }
    } else if (isDesert) {
      if (v === 1 || v === 5) {
        // Mini desert cactus bud
        cell.rect(6, 7, 4, 8, hexToAbgr('#4e9e42'));
        cell.rect(3, 10, 3, 2, hexToAbgr('#4e9e42'));
        cell.rect(10, 9, 3, 2, hexToAbgr('#78c959'));
        cell.px(7, 6, cAcc);
      } else if (v === 2 || v === 6) {
        // Weathered bone / sandstone pebbles
        cell.ellipse(5, 13, 3, 2, cL);
        cell.ellipse(10, 14, 3, 1.5, cM);
        cell.px(5, 12, cCream);
      } else {
        // Dry golden desert grass blades
        cell.line(4, 15, 2, 10, cM);
        cell.line(7, 15, 8, 9, cL);
        cell.line(11, 15, 13, 11, cM);
      }
    } else if (isGothic) {
      if (v === 1 || v === 5) {
        // Flickering mini stone candle / lantern stub
        cell.rect(6, 10, 4, 5, cEar);
        cell.tri(6, 10, 8, 5, 10, 10, cAcc);
        cell.px(8, 7, cCream);
      } else if (v === 2 || v === 6) {
        // Jagged gothic thorn / nail spikes
        cell.tri(3, 15, 5, 9, 7, 15, cD);
        cell.tri(8, 15, 11, 8, 13, 15, cM);
        cell.px(11, 8, cAcc);
      } else {
        // Eerie creeping tendrils
        cell.line(4, 15, 3, 11, cD);
        cell.line(7, 15, 9, 10, cM);
        cell.px(9, 9, cL);
      }
    } else {
      // Organic lush biomes: MLAIR, OPOUSO, TDM, FLIN, AP
      if (v === 0 || v === 3 || v === 6) {
        // Layered pixel grass blades with sunlit tips
        cell.line(3, 15, 2, 10, cD);
        cell.line(5, 15, 4, 9, cM);
        cell.line(8, 15, 9, 8, cL);
        cell.line(11, 15, 13, 10, cM);
        cell.px(9, 7, cCream);
      } else if (v === 1 || v === 5) {
        // Wildflower / luminous forest mushroom
        cell.line(7, 15, 7, 10, cD);
        cell.line(8, 15, 8, 10, cM);
        cell.ellipse(7.5, 8.5, 3.6, 2.6, cAcc);
        cell.px(6, 8, cAcc2);
        cell.px(8, 7, cCream);
      } else if (v === 2) {
        // Twin sparkling crystal shards / pebbles
        cell.tri(3, 15, 6, 8, 9, 15, cAcc2);
        cell.tri(8, 15, 11, 10, 14, 15, cAcc);
        cell.px(6, 9, cCream);
      } else if (v === 4) {
        // Plump fern / bush tuft
        cell.ellipse(5, 13, 3.5, 2.5, cD);
        cell.ellipse(10, 13, 3.5, 2.5, cM);
        cell.ellipse(7.5, 11, 3.5, 2.2, cL);
      } else {
        // Tall glowing blossom sprout
        cell.line(8, 15, 7, 7, cM);
        cell.px(5, 10, cL);
        cell.px(10, 11, cL);
        cell.ellipse(7, 6, 2.4, 2.2, cAcc);
        cell.px(7, 5, cCream);
      }
    }

    cell.outline(cOut);
    sheet.blit(cell, v * 16, 0);
  }
  return sheet.toCanvas();
}

// ============================================================================
// 3. Multi-Layer Pixel-Art Parallax Backdrops per Biome (All 11 Biomes)
// ============================================================================

export function bakeBiomeParallax(pal: BiomePalette): BiomeParallaxSet {
  const sky = new PixelBuf(576, 324);
  const cTop = hexToAbgr(pal.skyTop);
  const cMid = hexToAbgr(pal.skyMid);
  const cBot = hexToAbgr(pal.skyBot);
  const cGlow = hexToAbgr(pal.skyGlow);
  const cCel = hexToAbgr(pal.celestialColor);
  const cRing = hexToAbgr(pal.celestialRing);
  const cMidTop = hexToAbgr(mixHex(pal.skyTop, pal.skyMid, 0.5));
  const cMidBot = hexToAbgr(mixHex(pal.skyMid, pal.skyBot, 0.5));

  // Smooth 16-bit stepped sky bands with fine 8px 4-level Bayer transitions (no harsh wide checker stripes)
  for (let y = 0; y < 324; y++) {
    for (let x = 0; x < 576; x++) {
      const bayer4 = (((x & 1) << 1) | (y & 1));
      let col = cTop;
      if (y < 52) {
        col = cTop;
      } else if (y < 60) {
        col = bayer4 === 0 ? cMidTop : cTop;
      } else if (y < 68) {
        col = ((x + y) & 1) === 0 ? cTop : cMidTop;
      } else if (y < 112) {
        col = cMidTop;
      } else if (y < 120) {
        col = ((x + y) & 1) === 0 ? cMidTop : cMid;
      } else if (y < 176) {
        col = cMid;
      } else if (y < 184) {
        col = ((x + y) & 1) === 0 ? cMid : cMidBot;
      } else if (y < 236) {
        col = cMidBot;
      } else if (y < 246) {
        col = ((x + y) & 1) === 0 ? cMidBot : cBot;
      } else if (y < 294) {
        col = cBot;
      } else if (y < 304) {
        col = ((x + y) & 1) === 0 ? cBot : cGlow;
      } else {
        col = cGlow;
      }
      sky.px(x, y, col);
    }
  }

  // Stars for twilight/nocturnal/space biomes
  const isDay = pal.id === 'TDM' || pal.id === 'DSI';
  if (!isDay) {
    const starCount = pal.id === 'OPOUSO' || pal.id === 'TEMP' || pal.id === 'EVIL' ? 84 : 52;
    for (let i = 0; i < starCount; i++) {
      const sx = hash2d(i, 1, pal.id.charCodeAt(0)) % 572 + 2;
      const sy = hash2d(i, 2, pal.id.charCodeAt(1)) % 180 + 4;
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

  // Biome-signature celestial focal feature (stepped concentric pixel rings!)
  const celX = pal.id === 'OPOUSO' ? 288 : pal.id === 'MLAIR' ? 236 : isDay ? 448 : 426;
  const celY = pal.id === 'OPOUSO' ? 68 : pal.id === 'MLAIR' ? 46 : isDay ? 66 : 62;

  if (pal.id === 'OPOUSO') {
    // Iconic Subrosa Haven oversized glowing concentric stepped harvest moon
    const haloSteps = [78, 64, 52, 42, 34] as const;
    for (let s = 0; s < haloSteps.length; s++) {
      const t = (s + 1) / (haloSteps.length + 1);
      sky.ellipse(celX, celY, haloSteps[s]!, haloSteps[s]!, hexToAbgr(mixHex(pal.skyTop, pal.celestialColor, t * 0.8)));
    }
    sky.ellipse(celX, celY, 27, 27, cCel);
  } else if (pal.id === 'MLAIR') {
    // Dreamy twin crescent moons
    sky.ellipse(celX, celY, 22, 22, cRing);
    sky.ellipse(celX, celY, 17, 17, cCel);
    sky.ellipse(celX + 6, celY - 3, 13, 13, cMidTop);
    sky.ellipse(celX + 22, celY - 12, 6, 6, cCel);
  } else if (pal.id === 'EVIL') {
    sky.ellipse(celX, celY, 34, 34, cRing);
    sky.ellipse(celX, celY, 25, 25, cCel);
    sky.ellipse(celX, celY, 18, 18, cTop);
  } else if (pal.id === 'TEMP') {
    sky.ellipse(celX, celY, 26, 26, cRing);
    sky.ellipse(celX, celY, 19, 19, cCel);
    for (let a = 0; a < 72; a++) {
      const th = (a / 72) * Math.PI * 2;
      sky.px(celX + Math.round(Math.cos(th) * 38), celY + Math.round(Math.sin(th) * 12), cRing);
      sky.px(celX + Math.round(Math.cos(th) * 12), celY + Math.round(Math.sin(th) * 38), cRing);
    }
  } else if (pal.id === 'ATVC') {
    // Blazing volcanic caldera dome glow on horizon
    sky.ellipse(168, 228, 86, 68, hexToAbgr(mixHex(pal.skyBot, pal.celestialColor, 0.35)));
    sky.ellipse(408, 214, 104, 84, hexToAbgr(mixHex(pal.skyBot, pal.celestialColor, 0.45)));
    sky.ellipse(408, 224, 62, 48, cCel);
  } else {
    sky.ellipse(celX, celY, 28, 28, cRing);
    sky.ellipse(celX, celY, 21, 21, cCel);
    if (pal.id === 'GSHIP') {
      sky.ellipse(celX + 8, celY - 4, 15, 15, cTop);
    }
  }

  // Volumetric layered pixel clouds for sunlit / desert / haunted sky biomes
  if (isDay || pal.id === 'GSHIP') {
    const cloudHi = isDay ? hexToAbgr(HIGHLIGHT_CREAM) : hexToAbgr(pal.skyGlow);
    const cloudSh = isDay ? hexToAbgr(pal.skyBot) : hexToAbgr(pal.midSil);
    const clouds = [
      [68, 56, 34],
      [212, 42, 40],
      [352, 74, 28],
      [506, 50, 32],
    ] as const;
    for (let i = 0; i < clouds.length; i++) {
      const [cx, cy, r] = clouds[i]!;
      sky.ellipse(cx, cy + 5, r, 11, cloudSh);
      sky.ellipse(cx - 14, cy + 3, r * 0.62, 8, cloudSh);
      sky.ellipse(cx + 15, cy + 3, r * 0.56, 8, cloudSh);
      sky.ellipse(cx, cy, r * 0.9, 9, cloudHi);
      sky.ellipse(cx - 13, cy - 2, r * 0.54, 7, cloudHi);
      sky.ellipse(cx + 14, cy - 1, r * 0.5, 7, cloudHi);
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
      const p1 = Math.abs(((x + 40) % 144) - 72);
      const p2 = Math.abs(((x + 110) % 144) - 72);
      ridgeY = Math.min(54 + p1 * 1.15, 72 + p2 * 0.95);
    } else if (pal.id === 'TDM') {
      // Dramatic twin storybook peaks!
      const peakA = Math.abs(((x + 70) % 288) - 144);
      const peakB = Math.abs(((x + 210) % 288) - 144);
      ridgeY = Math.min(36 + peakA * 1.25, 48 + peakB * 1.15, 112 + Math.round(Math.sin(t * 3) * 12));
    } else if (pal.id === 'ATVC') {
      ridgeY = 68 + Math.round(Math.sin(t * 2) * 30 + Math.cos(t * 5) * 14);
    } else if (pal.id === 'EVIL' || pal.id === 'TEMP' || pal.id === 'LAB') {
      const tower = (x >> 4) % 3 === 0 ? 44 : (x >> 4) % 3 === 1 ? 82 : 62;
      ridgeY = tower + ((x & 15) < 3 || (x & 15) > 12 ? 12 : 0);
    } else if (pal.id === 'OPOUSO') {
      // Gentle calm evening ocean wave horizon
      ridgeY = 122 + Math.round(Math.sin(t * 2) * 5 + Math.cos(t * 5) * 2);
    } else if (pal.id === 'GSHIP') {
      ridgeY = 128 + Math.round(Math.sin(t * 4) * 5);
    } else if (pal.id === 'MLAIR') {
      // Step-carved ancient cavern ruin monolith skyline
      const block = (x >> 5) % 3;
      ridgeY = block === 0 ? 58 : block === 1 ? 82 : 68;
      if ((x & 31) < 2 || (x & 31) > 29) ridgeY += 6;
    } else {
      ridgeY = 74 + Math.round(Math.sin(t) * 24 + Math.sin(t * 3 + 1.1) * 14);
    }
    ridgeY = Math.max(22, Math.min(170, ridgeY | 0));
    for (let y = ridgeY; y < 200; y++) {
      far.px(x, y, y < ridgeY + 3 ? cFarHi : cFar);
    }
  }

  // Far biome landmark accents
  if (pal.id === 'MLAIR') {
    // Distant twin-slot monolith reliefs + violet crystal clusters
    for (let i = 0; i < 3; i++) {
      const mx = 14 + i * 96;
      far.rect(mx + 6, 78, 3, 12, cFarHi);
      far.rect(mx + 13, 78, 3, 12, cFarHi);
      far.tri(mx + 38, 108, mx + 44, 86, mx + 50, 108, cAcc);
    }
  } else if (pal.id === 'DSI') {
    // Distant tilted ruined tower silhouettes
    far.rect(226, 44, 24, 72, cFarHi);
    for (let wy = 50; wy < 104; wy += 8) {
      far.rect(230, wy, 4, 4, cFar);
      far.rect(238, wy, 4, 4, cFar);
    }
  } else if (pal.id === 'GSHIP') {
    far.rect(112, 118, 46, 12, cFar);
    far.rect(134, 60, 3, 58, cFar);
    far.tri(137, 66, 162, 96, 137, 108, cFarHi);
    far.tri(134, 72, 114, 98, 134, 108, cFarHi);
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

  if (pal.id === 'OPOUSO') {
    // Storybook village cottages with pitched roofs, chimneys & warm glowing windows
    for (let i = 0; i < 4; i++) {
      const hx = 22 + i * 72;
      mid.rect(hx, 82, 30, 38, cMidSil);
      mid.rect(hx + 22, 66, 5, 16, cMidSil);
      mid.tri(hx - 5, 83, hx + 15, 62, hx + 35, 83, cMidHi);
      mid.rect(hx + 6, 92, 6, 7, cAcc);
      mid.rect(hx + 18, 92, 6, 7, cAcc);
      mid.rect(hx + 12, 104, 6, 14, hexToAbgr(pal.nearSil));
    }
  } else if (pal.id === 'TDM' || pal.id === 'FLIN' || pal.id === 'AP') {
    for (let i = 0; i < 7; i++) {
      const tx = 14 + i * 42;
      const th = 44 + ((i * 19) % 24);
      const top = 112 - th;
      if (pal.id === 'FLIN') {
        // Towering misty canopy tree trunks with hanging vine drips
        mid.rect(tx - 6, 14, 12, 140, cMidSil);
        mid.rect(tx - 5, 14, 3, 140, cMidHi);
        mid.ellipse(tx + 12, 106, 6, 4, cAcc);
      } else {
        mid.rect(tx - 3, top + 16, 6, 60, cMidSil);
        mid.tri(tx - 17, top + 36, tx, top, tx + 17, top + 36, cMidSil);
        mid.tri(tx - 13, top + 20, tx, top, tx + 13, top + 20, cMidHi);
        if (pal.id === 'AP') {
          mid.ellipse(tx + 12, 106, 6, 4, cAcc);
        }
      }
    }
  } else if (pal.id === 'MLAIR' || pal.id === 'LAB') {
    // Subterranean carved stone ruins & glowing crystal pillars grounded in terrain (no floating ceiling triangles)
    for (let i = 0; i < 4; i++) {
      const px = 26 + i * 72;
      const topY = 44 + (i % 2) * 18;
      mid.rect(px, topY, 18, 180 - topY, cMidSil);
      mid.rect(px + 2, topY, 3, 180 - topY, cMidHi);
      mid.rect(px - 3, topY - 4, 24, 6, cMidHi);
      // Glowing crystal / arcane sconce mounted to pillar face
      mid.rect(px + 7, topY + 26, 4, 5, cAcc2);
      mid.px(px + 8, topY + 27, cAcc);
      // Low glowing crystal cluster nestled beside pillar base
      mid.tri(px + 22, 118, px + 26, 98, px + 31, 118, cAcc);
      mid.tri(px + 29, 118, px + 33, 105, px + 37, 118, cAcc2);
    }
  } else if (pal.id === 'ATVC') {
    for (let i = 0; i < 4; i++) {
      const vx = 30 + i * 72;
      mid.rect(vx, 70, 26, 110, cMidSil);
      mid.rect(vx + 9, 74, 6, 106, cAcc2);
      mid.rect(vx + 11, 74, 2, 106, cAcc);
    }
  } else if (pal.id === 'DSI') {
    // Desert saguaro cacti silhouettes along mid dune ridge
    for (let i = 0; i < 4; i++) {
      const cx = 36 + i * 70;
      mid.rect(cx, 78, 5, 34, cMidHi);
      mid.rect(cx - 7, 88, 7, 4, cMidHi);
      mid.rect(cx - 7, 80, 4, 10, cMidHi);
      mid.rect(cx + 5, 92, 7, 4, cMidHi);
      mid.rect(cx + 8, 84, 4, 10, cMidHi);
    }
  } else if (pal.id === 'TEMP' || pal.id === 'EVIL') {
    for (let i = 0; i < 4; i++) {
      const rx = 28 + i * 72;
      mid.rect(rx, 48, 18, 132, cMidSil);
      mid.rect(rx + 8, 58, 2, 92, cAcc2);
      mid.ellipse(rx + 9, 42, 8, 8, cAcc);
      mid.ellipse(rx + 9, 42, 4, 4, cMidSil);
    }
  } else if (pal.id === 'GSHIP') {
    for (let i = 0; i < 2; i++) {
      const mx = 68 + i * 144;
      mid.rect(mx, 14, 5, 160, cMidSil);
      mid.rect(mx - 34, 40, 72, 4, cMidSil);
      mid.rect(mx - 28, 44, 60, 44, cMidHi);
      mid.tri(mx - 20, 88, mx - 8, 68, mx + 2, 88, 0);
    }
  }

  // Layer 3: NEAR silhouetted foliage/masonry horizon (288x140 seamless loop)
  const near = new PixelBuf(288, 140);
  const cNear = hexToAbgr(pal.nearSil);
  const cNearHi = hexToAbgr(mixHex(pal.nearSil, pal.midSil, 0.45));
  for (let x = 0; x < 288; x++) {
    const t = (x / 288) * Math.PI * 2;
    const h = 84 + Math.round(Math.sin(t * 3) * 14 + Math.cos(t * 7) * 6);
    for (let y = h; y < 140; y++) {
      near.px(x, y, y < h + 2 ? cNearHi : cNear);
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
// 4. Special Tiles (32x32 single & animated multi-frame strips)
// ============================================================================

export function bakeSpecialTiles(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  const cOut = hexToAbgr(OUTLINE_DARK);
  const cWhite = hexToAbgr(HIGHLIGHT_CREAM);

  // OneWay wooden-and-iron bridge platform
  {
    const b = new PixelBuf(32, 32);
    const wHi = hexToAbgr('#f2be7e');
    const wMid = hexToAbgr('#bd763a');
    const wDark = hexToAbgr('#783f1d');
    const iron = hexToAbgr('#6c7c96');
    const ironHi = hexToAbgr('#b4c4de');
    b.rect(0, 1, 32, 10, wMid);
    b.rect(0, 1, 32, 2, wHi);
    b.rect(0, 9, 32, 2, wDark);
    b.rect(0, 0, 32, 1, cOut);
    b.rect(0, 11, 32, 1, cOut);
    for (let x = 0; x < 32; x += 8) {
      b.rect(x, 1, 1, 10, wDark);
      b.rect(x + 3, 4, 2, 2, iron);
      b.px(x + 3, 4, ironHi);
    }
    b.tri(2, 12, 8, 12, 2, 18, wDark);
    b.tri(30, 12, 24, 12, 30, 18, wDark);
    b.outline(cOut);
    map.set('oneway', b.toCanvas());
  }

  // Spikes (3 gleaming razor thorns with crimson tips)
  {
    const b = new PixelBuf(32, 32);
    const steelHi = hexToAbgr('#f2f8ff');
    const steelMid = hexToAbgr('#94a6c2');
    const steelDark = hexToAbgr('#4a5673');
    const tipRed = hexToAbgr('#ff3868');
    b.rect(1, 27, 30, 4, steelDark);
    b.rect(1, 26, 30, 2, steelMid);
    for (let i = 0; i < 3; i++) {
      const sx = 5 + i * 11;
      b.tri(sx - 4, 26, sx, 6, sx + 4, 26, steelDark);
      b.tri(sx - 3, 26, sx, 8, sx, 26, steelHi);
      b.tri(sx, 26, sx, 8, sx + 3, 26, steelMid);
      b.rect(sx - 1, 7, 2, 3, tipRed);
      b.px(sx, 6, cWhite);
    }
    b.outline(cOut);
    map.set('spike', b.toCanvas());
  }

  // Breakable cracked wooden/stone block
  {
    const b = new PixelBuf(32, 32);
    const hi = hexToAbgr('#f5be76');
    const mid = hexToAbgr('#cc7d3b');
    const dark = hexToAbgr('#80421b');
    b.rect(1, 1, 30, 30, mid);
    b.rect(1, 1, 30, 3, hi);
    b.rect(1, 1, 3, 30, hi);
    b.rect(1, 28, 30, 3, dark);
    b.rect(28, 1, 3, 30, dark);
    b.rect(5, 5, 22, 22, dark);
    b.rect(6, 6, 20, 20, mid);
    b.line(6, 6, 25, 25, hi);
    b.line(6, 7, 24, 25, dark);
    b.line(25, 6, 6, 25, hi);
    b.line(15, 7, 13, 14, cOut);
    b.line(13, 14, 18, 21, cOut);
    b.line(18, 21, 16, 25, cOut);
    b.outline(cOut);
    map.set('breakable', b.toCanvas());
  }

  // StoneOverhead (Heavy carved boulder smashable by Rock Uppercut)
  {
    const b = new PixelBuf(32, 32);
    const sHi = hexToAbgr('#c2bcd9');
    const sMid = hexToAbgr('#787296');
    const sDark = hexToAbgr('#464063');
    const gold = hexToAbgr('#ffad16');
    const goldHi = hexToAbgr('#ffe7a1');
    b.rect(1, 1, 30, 30, sMid);
    b.rect(2, 2, 28, 3, sHi);
    b.rect(2, 27, 28, 3, sDark);
    b.rect(27, 2, 3, 28, sDark);
    b.line(10, 20, 16, 11, gold);
    b.line(16, 11, 22, 20, gold);
    b.line(10, 19, 16, 10, goldHi);
    b.line(16, 10, 22, 19, goldHi);
    b.line(4, 12, 10, 15, cOut);
    b.line(27, 18, 21, 22, cOut);
    b.outline(cOut);
    map.set('stone_overhead', b.toCanvas());
  }

  // Rubber Bounce pad (2 frames: idle & compressed)
  {
    const sheet = new PixelBuf(64, 32);
    const fBuf = new PixelBuf(32, 32);
    const bHi = hexToAbgr('#ff99e8');
    const bMid = hexToAbgr('#ff38a8');
    const bDark = hexToAbgr('#9e146b');
    const gold = hexToAbgr('#ffd84d');
    const coil = hexToAbgr('#a8bdd9');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      const squash = f === 1 ? 3 : 0;
      fBuf.rect(4, 26, 24, 5, hexToAbgr('#4e4666'));
      fBuf.line(9, 26, 13, 18 + squash, coil);
      fBuf.line(23, 26, 19, 18 + squash, coil);
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
      const bx = ((6 + f * 7) % 24) + 4;
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
      const bx = ((10 + f * 6) % 24) + 4;
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
          const wave = (x + shift) % 12 < 4;
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

  // Explosive bomb block (2 pulsing frames)
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
      fBuf.rect(2, 11, 28, 10, f === 0 ? yel : cWhite);
      fBuf.rect(12, 13, 8, 6, rDark);
      fBuf.px(16, 15, yel);
      fBuf.px(15, 16, yel);
      fBuf.px(17, 16, yel);
      fBuf.outline(cOut);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('explosive', sheet.toCanvas());
  }

  // Antigrav emitter (2 frames rising cyan diamonds)
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
    const crack = hexToAbgr('#ffe6ff', 155);
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

  // Crusher block (32x32 iron block with underside teeth)
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
// 5. Interactive World Props & Form Totems
// ============================================================================

export function bakeWorldProps(): Map<string, HTMLCanvasElement> {
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
      const rot = f === 0 ? 0 : 1;
      fBuf.ellipse(16, 16, 12, 12, vMid);
      fBuf.ellipse(16, 16, 10, 10, 0);
      fBuf.ellipseShaded(16, 16, 7.5, 7.5, vHi, vMid, metal, cWhite);
      fBuf.line(17, 11, 14, 16, vYel);
      fBuf.line(14, 16, 18, 16, vYel);
      fBuf.line(18, 16, 15, 21, vYel);
      fBuf.rect(15, 2 + rot, 2, 3, vYel);
      fBuf.rect(15, 27 - rot, 2, 3, vYel);
      fBuf.rect(2 + rot, 15, 3, 2, vYel);
      fBuf.rect(27 - rot, 15, 3, 2, vYel);
      fBuf.outline(cOut);
      sheet.blit(fBuf, f * 32, 0);
    }
    map.set('volt_node', sheet.toCanvas());
  }

  // Ornate Treasure Chest (closed & open, 32x28 — golden trim + crimson dome + keyhole)
  {
    const crimsonHi = hexToAbgr('#ff5964');
    const crimsonMid = hexToAbgr('#bd2938');
    const slate = hexToAbgr('#59648a');
    const goldHi = hexToAbgr('#fff28c');
    const goldMid = hexToAbgr('#e8b824');
    const goldDark = hexToAbgr('#8f5d14');
    const ruby = hexToAbgr('#ff2994');

    const closed = new PixelBuf(32, 28);
    closed.roundedRect(3, 7, 26, 19, slate);
    closed.roundedRect(4, 6, 24, 10, crimsonMid);
    closed.rect(5, 7, 22, 3, crimsonHi);
    closed.rect(3, 15, 26, 3, goldMid);
    closed.rect(3, 15, 26, 1, goldHi);
    closed.rect(6, 6, 3, 20, goldMid);
    closed.rect(23, 6, 3, 20, goldMid);
    closed.rect(6, 24, 20, 2, goldDark);
    closed.roundedRect(12, 11, 8, 9, goldHi);
    closed.rect(14, 13, 4, 5, cOut);
    closed.rect(15, 13, 2, 2, ruby);
    closed.outline(cOut);
    map.set('chest_closed', closed.toCanvas());

    const open = new PixelBuf(32, 28);
    open.roundedRect(3, 14, 26, 12, slate);
    open.rect(4, 3, 24, 10, crimsonMid);
    open.rect(5, 4, 22, 3, crimsonHi);
    open.rect(4, 12, 24, 3, goldMid);
    open.rect(6, 14, 3, 12, goldMid);
    open.rect(23, 14, 3, 12, goldMid);
    open.rect(12, 14, 8, 5, goldHi);
    open.outline(cOut);
    map.set('chest_open', open.toCanvas());
  }

  // Teleporter Gate (2 frames, 40x48)
  {
    const sheet = new PixelBuf(80, 48);
    const fBuf = new PixelBuf(40, 48);
    const stHi = hexToAbgr('#b8c2e6');
    const stMid = hexToAbgr('#687099');
    const stDark = hexToAbgr('#393d5e');
    const pCyan = hexToAbgr('#59f2ff');
    const pMag = hexToAbgr('#d44dff');
    for (let f = 0; f < 2; f++) {
      fBuf.clear();
      fBuf.rect(4, 42, 32, 5, stDark);
      fBuf.rect(6, 10, 6, 33, stMid);
      fBuf.rect(28, 10, 6, 33, stMid);
      fBuf.rect(6, 6, 28, 6, stHi);
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
    const stHi = hexToAbgr('#c2caf0');
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
    const wHi = hexToAbgr('#ebb273');
    const wMid = hexToAbgr('#b0703a');
    const wDark = hexToAbgr('#6b3d1d');
    b.rect(10, 13, 4, 14, wDark);
    b.rect(3, 4, 18, 11, wMid);
    b.rect(3, 4, 18, 2, wHi);
    b.rect(6, 8, 12, 1, wDark);
    b.rect(6, 11, 9, 1, wDark);
    b.outline(cOut);
    map.set('signpost', b.toCanvas());
  }

  // Animal House (48x44 cozy detailed storybook cottage with shingles, chimney & porch lantern)
  {
    const b = new PixelBuf(48, 44);
    const roofHi = hexToAbgr('#ff7890');
    const roofMid = hexToAbgr('#cc3355');
    const roofDark = hexToAbgr('#7d1836');
    const wall = hexToAbgr('#f5e0c4');
    const wallSh = hexToAbgr('#c7a47d');
    const timber = hexToAbgr('#784222');
    const timberHi = hexToAbgr('#ad6636');
    const win = hexToAbgr('#ffe866');
    const winHi = hexToAbgr('#fffbd6');
    // Chimney
    b.rect(32, 6, 6, 12, wallSh);
    b.rect(31, 5, 8, 2, timber);
    // Cottage walls with timber framing & stone foundation
    b.rect(8, 20, 32, 22, wall);
    b.rect(8, 38, 32, 4, hexToAbgr('#8a7a8f'));
    b.rect(8, 20, 32, 2, wallSh);
    b.rect(8, 20, 2, 18, timber);
    b.rect(38, 20, 2, 18, timber);
    // Shingled pitched roof with eave shadow
    b.tri(2, 22, 24, 4, 46, 22, roofDark);
    b.tri(4, 20, 24, 5, 44, 20, roofMid);
    b.tri(7, 18, 24, 6, 35, 18, roofHi);
    for (let rx = 10; rx <= 36; rx += 6) {
      b.px(rx, 15, roofDark);
      b.px(rx + 2, 12, roofDark);
    }
    // Arched wooden door + golden knob + glowing paned windows
    b.rect(19, 27, 10, 15, timber);
    b.rect(20, 28, 8, 13, timberHi);
    b.px(26, 34, win);
    b.rect(11, 25, 6, 6, timber);
    b.rect(12, 26, 4, 4, win);
    b.px(12, 26, winHi);
    b.rect(31, 25, 6, 6, timber);
    b.rect(32, 26, 4, 4, win);
    b.px(32, 26, winHi);
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
    const stHi = hexToAbgr('#b4add1');
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

// ============================================================================
// 6. Animated Hub NPCs (2-Frame 36x40 Sheets)
// ============================================================================

export function bakeHubNpcs(): Map<ShopId, HTMLCanvasElement> {
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
        // Floating ornate golden grimoire with gilded clasp, animated pages & wise glowing eyes
        const hover = f === 0 ? 0 : -2;
        b.rect(7, 11 + hover, 22, 22, dark);
        b.rect(8, 12 + hover, 20, 20, mid);
        b.rect(10, 14 + hover, 16, 16, skin);
        b.rect(8, 12 + hover, 4, 20, dark);
        b.rect(9, 12 + hover, 18, 2, hi);
        b.rect(25, 20 + hover, 3, 4, hi); // brass clasp
        // Glowing arcane eyes with highlights
        b.rect(13, 18 + hover, 3, 5, acc);
        b.rect(20, 18 + hover, 3, 5, acc);
        b.px(14, 19 + hover, cWhite);
        b.px(21, 19 + hover, cWhite);
        // Fluttering crimson bookmark ribbon
        b.tri(18, 32 + hover, 14 + f, 38, 22 + f, 36, hexToAbgr('#ff3868'));
      } else {
        // Grounded boots + layered tunic/cloak with sash & expressive character silhouette
        b.rect(12, 35, 5, 3, dark);
        b.rect(19, 35, 5, 3, dark);
        b.roundedRect(10, 21 + bob, 16, 14, mid);
        b.rect(11, 22 + bob, 5, 11, hi);
        b.rect(21, 22 + bob, 4, 12, dark);
        b.rect(10, 28 + bob, 16, 2, acc); // belt / sash
        b.rect(16, 28 + bob, 4, 3, hi); // belt buckle
        // Arms/sleeves
        b.roundedRect(7, 23 + bob, 4, 8, hi);
        b.roundedRect(25, 23 + bob, 4, 8, mid);
        // Expressive head with chin shading & rosy cheeks
        b.ellipseShaded(18, 15 + bob, 7.2, 6.8, cWhite, skin, hexToAbgr('#c28a70'));
        b.rect(13, 14 + bob, 3, 4, cWhite);
        b.rect(20, 14 + bob, 3, 4, cWhite);
        b.rect(14, 15 + bob, 2, 3, cOut);
        b.rect(21, 15 + bob, 2, 3, cOut);
        b.px(14, 15 + bob, cWhite);
        b.px(21, 15 + bob, cWhite);
        b.px(12, 18 + bob, hexToAbgr('#ff8599'));
        b.px(23, 18 + bob, hexToAbgr('#ff8599'));

        if (spec.hat === 'hood') {
          // Mystic witch/oracle pointed hood + glowing crystal staff
          b.tri(8, 14 + bob, 18, 2 + bob, 28, 14 + bob, dark);
          b.tri(10, 13 + bob, 18, 4 + bob, 25, 13 + bob, mid);
          b.line(12, 12 + bob, 18, 5 + bob, hi);
          b.rect(9, 13 + bob, 18, 2, acc);
          b.rect(29, 10, 2, 27, dark);
          b.ellipseShaded(30, 9 + bob, 3.8, 3.8, cWhite, acc, dark);
        } else if (spec.hat === 'sage') {
          // Forest scholar wide-brim hat + glowing lantern/scroll
          b.rect(6, 11 + bob, 24, 3, dark);
          b.tri(10, 11 + bob, 18, 3 + bob, 26, 11 + bob, mid);
          b.rect(11, 10 + bob, 14, 2, acc);
          b.ellipseShaded(29, 20 + bob, 4, 4, cWhite, acc, dark);
        } else if (spec.hat === 'goggles') {
          // Relic merchant oversized pack + brass goggles + beard
          b.roundedRect(3, 18 + bob, 8, 14, dark);
          b.rect(4, 19 + bob, 6, 10, hi);
          b.rect(4, 24 + bob, 6, 2, acc);
          b.rect(11, 9 + bob, 14, 5, dark);
          b.rect(12, 10 + bob, 5, 3, acc);
          b.rect(19, 10 + bob, 5, 3, acc);
          b.px(13, 10 + bob, cWhite);
          b.px(20, 10 + bob, cWhite);
        } else if (spec.hat === 'helm') {
          // Arena champion horned steel helm + halberd
          b.rect(11, 7 + bob, 14, 7, mid);
          b.rect(12, 8 + bob, 12, 2, hi);
          b.tri(11, 10 + bob, 5, 3 + bob, 13, 8 + bob, acc);
          b.tri(25, 10 + bob, 31, 3 + bob, 23, 8 + bob, acc);
          b.rect(28, 10, 3, 27, dark);
          b.tri(27, 9, 35, 14, 27, 20, hi);
        } else if (spec.hat === 'tricorn') {
          // Spectral pirate captain tricorn + golden emblem + billowing beard
          b.tri(5, 12 + bob, 18, 4 + bob, 31, 12 + bob, dark);
          b.rect(8, 10 + bob, 20, 3, mid);
          b.rect(16, 7 + bob, 4, 3, acc);
          b.tri(12, 20 + bob, 18, 29 + bob, 24, 20 + bob, hi);
        }
      }
      b.outline(cOut);
      sheet.blit(b, f * 36, 0);
    }
    map.set(spec.id, sheet.toCanvas());
  }

  return map;
}

// ============================================================================
// Lazy Headless-Safe World Art Cache (Zero Per-Frame Allocations)
// ============================================================================

let cachedWorldArt: BuiltInWorldArt | null = null;

export function getBuiltInWorldArt(): BuiltInWorldArt | null {
  if (typeof document === 'undefined') return null;
  if (cachedWorldArt) return cachedWorldArt;

  const biomeTilesets = new Map<BiomeId, HTMLCanvasElement>();
  const biomeInnerCorners = new Map<BiomeId, HTMLCanvasElement>();
  const biomeDeco = new Map<BiomeId, HTMLCanvasElement>();
  const biomeParallax = new Map<BiomeId, BiomeParallaxSet>();

  for (let i = 0; i < BIOME_IDS.length; i++) {
    const biome = BIOME_IDS[i]!;
    const pal = BIOME_PALETTES[biome];
    biomeTilesets.set(biome, bakeBiomeTileset(pal));
    biomeInnerCorners.set(biome, bakeBiomeInnerCorners(pal));
    biomeDeco.set(biome, bakeBiomeDeco(pal));
    biomeParallax.set(biome, bakeBiomeParallax(pal));
  }

  cachedWorldArt = {
    biomeTilesets,
    biomeInnerCorners,
    biomeDeco,
    biomeParallax,
    specialTiles: bakeSpecialTiles(),
    props: bakeWorldProps(),
    npcs: bakeHubNpcs(),
  };

  return cachedWorldArt;
}
