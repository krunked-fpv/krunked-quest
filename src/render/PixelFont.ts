/**
 * Krunked Quest — Sculpted Proportional 16-Bit Pixel Font Renderer
 * Pre-bakes integer-crisp 1px-outlined glyphs with 3-tone vertical bevel shading
 * and proportional kerning onto offscreen canvases at boot.
 * Zero blurry browser canvas text, zero per-frame allocations!
 */

import { OUTLINE_DARK, hexToAbgr, mixHex } from '../assets/palettes.js';

export type PixelFontColor =
  | 'white'
  | 'gold'
  | 'cyan'
  | 'magenta'
  | 'green'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'dim'
  | 'cream';

const FONT_COLOR_HEX: Readonly<Record<PixelFontColor, string>> = {
  white: '#f8f5ff',
  gold: '#ffd644',
  cyan: '#5cefff',
  magenta: '#ff5ec4',
  green: '#6ef278',
  red: '#ff5268',
  orange: '#ff9b38',
  yellow: '#f4ff54',
  dim: '#a995c4',
  cream: '#fff2d1',
};

const FONT_TOP_SHADE: Readonly<Record<PixelFontColor, string>> = {
  white: '#ffffff',
  gold: '#fff6b0',
  cyan: '#d4ffff',
  magenta: '#ffc4ee',
  green: '#d4ffc4',
  red: '#ffb8c2',
  orange: '#ffd8a3',
  yellow: '#ffffc2',
  dim: '#d4c3e8',
  cream: '#ffffff',
};

const FONT_BOT_SHADE: Readonly<Record<PixelFontColor, string>> = {
  white: '#cfc2e6',
  gold: '#e09a1e',
  cyan: '#24b8e6',
  magenta: '#cc2e98',
  green: '#38bd57',
  red: '#cc2944',
  orange: '#d46217',
  yellow: '#cbd61e',
  dim: '#7a6596',
  cream: '#e6cfa3',
};

interface GlyphDef {
  /** Visible pixel width of this glyph (1..6) */
  readonly w: number;
  /** 7 rows of left-aligned bitmasks (MSB = bit 5 for 6-bit rows) */
  readonly rows: readonly number[];
}

// Helper: turn compact 7-line ASCII strings ('#' = lit) into crisp proportional GlyphDefs
function g(lines: readonly string[]): GlyphDef {
  let w = 0;
  for (let r = 0; r < lines.length; r++) {
    if (lines[r]!.length > w) w = lines[r]!.length;
  }
  const rows: number[] = [];
  for (let r = 0; r < 7; r++) {
    const line = lines[r] ?? '';
    let bits = 0;
    for (let x = 0; x < w; x++) {
      if (line.charAt(x) === '#') {
        bits |= 1 << (5 - x);
      }
    }
    rows.push(bits);
  }
  return { w: Math.max(1, w), rows };
}

// Sculpted proportional 16-bit arcade pixel glyphs (clean SNES/GBA curves & tight widths)
const GLYPH_DATA: Readonly<Record<string, GlyphDef>> = {
  ' ': { w: 3, rows: [0, 0, 0, 0, 0, 0, 0] },
  '!': g(['##', '##', '##', '##', '##', '..', '##']),
  '"': g(['#.#', '#.#', '#.#', '...', '...', '...', '...']),
  '#': g(['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....']),
  '$': g(['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..']),
  '%': g(['##..#', '##.#.', '..#..', '.#...', '#..##', '...##', '.....']),
  '&': g(['.###.', '#...#', '.##..', '#.##.', '#..#.', '#..#.', '.##.#']),
  "'": g(['#', '#', '.', '.', '.', '.', '.']),
  '(': g(['.#', '#.', '#.', '#.', '#.', '#.', '.#']),
  ')': g(['#.', '.#', '.#', '.#', '.#', '.#', '#.']),
  '*': g(['.....', '.#.#.', '..#..', '#####', '..#..', '.#.#.', '.....']),
  '+': g(['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....']),
  ',': g(['..', '..', '..', '..', '.#', '.#', '#.']),
  '-': g(['....', '....', '....', '####', '....', '....', '....']),
  '.': g(['..', '..', '..', '..', '..', '##', '##']),
  '/': g(['...#', '...#', '..#.', '.#..', '.#..', '#...', '#...']),
  '0': g(['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.']),
  '1': g(['.##.', '###.', '.##.', '.##.', '.##.', '.##.', '####']),
  '2': g(['.###.', '##.##', '...##', '..##.', '.##..', '##...', '#####']),
  '3': g(['####.', '...##', '...##', '.###.', '...##', '...##', '####.']),
  '4': g(['..##.', '.###.', '##.##', '#####', '...##', '...##', '...##']),
  '5': g(['#####', '##...', '####.', '...##', '...##', '##.##', '.###.']),
  '6': g(['.###.', '##...', '####.', '##.##', '##.##', '##.##', '.###.']),
  '7': g(['#####', '...##', '..##.', '..##.', '.##..', '.##..', '.##..']),
  '8': g(['.###.', '##.##', '##.##', '.###.', '##.##', '##.##', '.###.']),
  '9': g(['.###.', '##.##', '##.##', '.####', '...##', '..##.', '.##..']),
  ':': g(['..', '##', '##', '..', '##', '##', '..']),
  ';': g(['..', '.#', '.#', '..', '.#', '.#', '#.']),
  '<': g(['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#']),
  '=': g(['....', '....', '####', '....', '####', '....', '....']),
  '>': g(['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...']),
  '?': g(['.###.', '##.##', '...##', '..##.', '..##.', '.....', '..##.']),
  '@': g(['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.']),
  A: g(['.###.', '##.##', '##.##', '#####', '##.##', '##.##', '##.##']),
  B: g(['####.', '##.##', '##.##', '####.', '##.##', '##.##', '####.']),
  C: g(['.####', '##...', '##...', '##...', '##...', '##...', '.####']),
  D: g(['####.', '##.##', '##.##', '##.##', '##.##', '##.##', '####.']),
  E: g(['#####', '##...', '##...', '####.', '##...', '##...', '#####']),
  F: g(['#####', '##...', '##...', '####.', '##...', '##...', '##...']),
  G: g(['.####', '##...', '##...', '##.##', '##.##', '##.##', '.###.']),
  H: g(['##.##', '##.##', '##.##', '#####', '##.##', '##.##', '##.##']),
  I: g(['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###']),
  J: g(['..###', '...##', '...##', '...##', '##.##', '##.##', '.###.']),
  K: g(['##.##', '##.##', '####.', '###..', '####.', '##.##', '##.##']),
  L: g(['##..', '##..', '##..', '##..', '##..', '##..', '####']),
  M: g(['##..##', '######', '######', '##..##', '##..##', '##..##', '##..##']),
  N: g(['##..#', '###.#', '#####', '#####', '#.###', '#..##', '#..##']),
  O: g(['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.']),
  P: g(['####.', '##.##', '##.##', '####.', '##...', '##...', '##...']),
  Q: g(['.###.', '##.##', '##.##', '##.##', '##.##', '##.#.', '.##.#']),
  R: g(['####.', '##.##', '##.##', '####.', '##.#.', '##.##', '##.##']),
  S: g(['.####', '##...', '##...', '.###.', '...##', '...##', '####.']),
  T: g(['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..']),
  U: g(['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.']),
  V: g(['##.##', '##.##', '##.##', '##.##', '##.##', '.###.', '..#..']),
  W: g(['##..##', '##..##', '##..##', '##..##', '######', '######', '##..##']),
  X: g(['##.##', '##.##', '.###.', '..#..', '.###.', '##.##', '##.##']),
  Y: g(['##.##', '##.##', '##.##', '.###.', '..#..', '..#..', '..#..']),
  Z: g(['#####', '...##', '..##.', '.##..', '##...', '##...', '#####']),
  '[': g(['###', '##.', '##.', '##.', '##.', '##.', '###']),
  '\\': g(['#...', '#...', '.#..', '..#.', '..#.', '...#', '...#']),
  ']': g(['###', '.##', '.##', '.##', '.##', '.##', '###']),
  '^': g(['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....']),
  _: g(['.....', '.....', '.....', '.....', '.....', '.....', '#####']),
  '|': g(['#', '#', '#', '#', '#', '#', '#']),
  '~': g(['.....', '.##.#', '#..#.', '.....', '.....', '.....', '.....']),
  '·': g(['..', '..', '##', '##', '..', '..', '..']),
  // Gamepad & UI symbols
  '✕': g(['##.##', '.###.', '..#..', '.###.', '##.##', '.....', '.....']),
  '□': g(['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####']),
  '○': g(['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.']),
  '△': g(['..#..', '.###.', '.#.#.', '##.##', '##.##', '#####', '.....']),
  '★': g(['..#..', '..#..', '#####', '.###.', '.###.', '#...#', '.....']),
  '◆': g(['..#..', '.###.', '#####', '.###.', '..#..', '.....', '.....']),
  '♥': g(['.#.#.', '#####', '#####', '.###.', '..#..', '.....', '.....']),
  '⚡': g(['..##.', '.##..', '####.', '..##.', '.##..', '#....', '.....']),
  '↑': g(['..#..', '.###.', '#####', '..#..', '..#..', '..#..', '.....']),
  '↓': g(['..#..', '..#..', '..#..', '#####', '.###.', '..#..', '.....']),
  '←': g(['..#..', '.##..', '#####', '.##..', '..#..', '.....', '.....']),
  '→': g(['..#..', '..##.', '#####', '..##.', '..#..', '.....', '.....']),
};

const CHARSET = Object.keys(GLYPH_DATA);
const CHAR_INDEX = new Map<string, number>();
const CHAR_WIDTHS = new Uint8Array(CHARSET.length);
for (let i = 0; i < CHARSET.length; i++) {
  const ch = CHARSET[i]!;
  CHAR_INDEX.set(ch, i);
  CHAR_WIDTHS[i] = GLYPH_DATA[ch]!.w;
}

// Each baked cell is 8x10 (up to 6px glyph + 1px outline left/right, 7px glyph + 1px top + 2px bottom drop-shadow)
export const GLYPH_ADVANCE = 6;
export const GLYPH_HEIGHT = 7;
const CELL_W = 8;
const CELL_H = 10;

function normalizeChar(rawCh: string): string {
  if (rawCh === '—' || rawCh === '–') return '-';
  if (rawCh === '’' || rawCh === '‘') return "'";
  if (rawCh === '“' || rawCh === '”') return '"';
  if (rawCh === '•') return '·';
  return rawCh >= 'a' && rawCh <= 'z' ? rawCh.toUpperCase() : rawCh;
}

export class PixelFont {
  private readonly outlinedSheets = new Map<PixelFontColor, HTMLCanvasElement>();
  private readonly plainSheets = new Map<PixelFontColor, HTMLCanvasElement>();
  private baked = false;

  constructor() {
    this.ensureBaked();
  }

  public ensureBaked(): void {
    if (this.baked || typeof document === 'undefined') return;
    this.baked = true;
    const colors = Object.keys(FONT_COLOR_HEX) as PixelFontColor[];
    for (let i = 0; i < colors.length; i++) {
      const color = colors[i]!;
      this.outlinedSheets.set(color, this.bakeSheet(color, true));
      this.plainSheets.set(color, this.bakeSheet(color, false));
    }
  }

  private bakeSheet(color: PixelFontColor, outlined: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = CHARSET.length * CELL_W;
    canvas.height = CELL_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const img = ctx.createImageData(canvas.width, canvas.height);
    const data = new Uint32Array(img.data.buffer);
    const fillMain = hexToAbgr(FONT_COLOR_HEX[color]);
    const fillTop = hexToAbgr(FONT_TOP_SHADE[color]);
    const fillBot = hexToAbgr(FONT_BOT_SHADE[color] ?? mixHex(FONT_COLOR_HEX[color], OUTLINE_DARK, 0.25));
    const outlineCol = hexToAbgr(OUTLINE_DARK);
    const w = canvas.width;

    for (let ci = 0; ci < CHARSET.length; ci++) {
      const ch = CHARSET[ci]!;
      const def = GLYPH_DATA[ch]!;
      const rows = def.rows;
      const gw = def.w;
      const ox = ci * CELL_W + 1;
      const oy = 1;

      if (outlined) {
        // 1px crisp dark-plum outline + 1px extra bottom drop shadow
        for (let ry = 0; ry < 7; ry++) {
          const bits = rows[ry]!;
          for (let rx = 0; rx < gw; rx++) {
            if ((bits & (32 >> rx)) === 0) continue;
            const px = ox + rx;
            const py = oy + ry;
            data[(py - 1) * w + px] = outlineCol;
            data[(py + 1) * w + px] = outlineCol;
            data[py * w + (px - 1)] = outlineCol;
            data[py * w + (px + 1)] = outlineCol;
            data[(py - 1) * w + (px - 1)] = outlineCol;
            data[(py - 1) * w + (px + 1)] = outlineCol;
            data[(py + 1) * w + (px - 1)] = outlineCol;
            data[(py + 1) * w + (px + 1)] = outlineCol;
            if (py + 2 < CELL_H) {
              data[(py + 2) * w + px] = outlineCol;
            }
          }
        }
      }

      // 3-tone 16-bit bevel fill (top highlight -> rich core -> subtle bottom shade)
      for (let ry = 0; ry < 7; ry++) {
        const bits = rows[ry]!;
        const col = ry < 2 ? fillTop : ry >= 5 ? fillBot : fillMain;
        for (let rx = 0; rx < gw; rx++) {
          if ((bits & (32 >> rx)) === 0) continue;
          const px = ox + rx;
          const py = oy + ry;
          data[py * w + px] = col;
        }
      }
    }

    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  public measure(text: string, scale = 1): number {
    if (text.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = normalizeChar(text.charAt(i));
      const idx = CHAR_INDEX.get(ch);
      const gw = idx !== undefined ? CHAR_WIDTHS[idx]! : 4;
      total += gw + 1;
    }
    return Math.max(0, total - 1) * scale;
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: PixelFontColor = 'white',
    scale = 1,
    align: 'left' | 'center' | 'right' = 'left',
    outlined = true,
  ): void {
    if (!this.baked || text.length === 0) return;
    const sheet = outlined ? this.outlinedSheets.get(color) : this.plainSheets.get(color);
    if (!sheet) return;

    const totalW = this.measure(text, scale);
    let drawX = Math.round(x);
    if (align === 'center') {
      drawX = Math.round(x - totalW * 0.5);
    } else if (align === 'right') {
      drawX = Math.round(x - totalW);
    }
    const drawY = Math.round(y);
    const dstH = CELL_H * scale;

    for (let i = 0; i < text.length; i++) {
      const ch = normalizeChar(text.charAt(i));
      const idx = CHAR_INDEX.get(ch);
      const gw = idx !== undefined ? CHAR_WIDTHS[idx]! : 4;
      if (idx !== undefined && ch !== ' ') {
        const srcW = gw + 2;
        ctx.drawImage(
          sheet,
          idx * CELL_W,
          0,
          srcW,
          CELL_H,
          drawX - scale,
          drawY - scale,
          srcW * scale,
          dstH,
        );
      }
      drawX += (gw + 1) * scale;
    }
  }
}
