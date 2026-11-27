/**
 * Krunked Quest — Read-Only Local Custom Asset Pack Extractor
 * Strictly READ-ONLY inspection of the local Steam Unity data directory.
 * Parses Unity 2021.3 SerializedFile v22 Texture2D (RGB24/RGBA32/ARGB32/DXT1/DXT5),
 * Sprite (ClassID 213) rects & pivots, AnimationClip (ClassID 74) sprite curves,
 * and Super Tilemap Editor Tileset + CarpetBrush (ClassID 114) 16-mask autotiles.
 * Packs crisp multi-clip sprite atlases, normalized 512x64 16-mask biome tilesets,
 * 4-layer parallax backdrops, all 6 hero forms, all 34 enemies, all 8 bosses + parts,
 * all 6 Hub NPCs, special tiles, world props, HUD/UI, and tongue/stomp FX.
 * Falls back to crisp clean-room 16-bit pixel synthesis when Steam data is absent.
 * Pure Node + zlib (zero extra npm dependencies).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  HERO_FORMS,
  type BiomeId,
  type CustomPackEntry,
  type CustomPackManifest,
  type HeroFormId,
  type ParallaxLayerMeta,
  type SpriteAnimClip,
  type SpriteFrameRect,
  type TileLayoutMeta,
} from '../src/contracts/index';
import {
  ALL_REQUIRED_ASSET_KEYS,
  ASSET_REGISTRY_SPECS,
  validateAssetManifest,
} from '../src/assets/AssetRegistry';

export const DEFAULT_STEAM_DATA_DIR =
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Super Mombo Quest\\SuperMomboQuest_Data';

const OUT_DIR = path.resolve(process.cwd(), '.krunked-quest-assets');
const SPRITES_DIR = path.join(OUT_DIR, 'sprites');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');

// ============================================================================
// Pure Node + zlib PNG Encoder & RGBA Pixel Operations
// ============================================================================

interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC32_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePngRgba(width: number, height: number, rgba: Uint8Array): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = width * 4;
  const rawScanlines = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const dstOff = y * (rowBytes + 1);
    rawScanlines[dstOff] = 0;
    const srcOff = y * rowBytes;
    rawScanlines.set(rgba.subarray(srcOff, srcOff + rowBytes), dstOff + 1);
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 6 });

  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createImage(width: number, height: number): RgbaImage {
  return { width, height, rgba: new Uint8Array(width * height * 4) };
}

function cropImage(src: RgbaImage, sx: number, sy: number, sw: number, sh: number): RgbaImage {
  const w = Math.max(1, Math.min(sw, src.width - Math.max(0, sx)));
  const h = Math.max(1, Math.min(sh, src.height - Math.max(0, sy)));
  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  const dst = createImage(w, h);
  for (let y = 0; y < h; y += 1) {
    const srcOff = ((y0 + y) * src.width + x0) * 4;
    const dstOff = y * w * 4;
    dst.rgba.set(src.rgba.subarray(srcOff, srcOff + w * 4), dstOff);
  }
  return dst;
}

function blitOpaque(
  dst: RgbaImage,
  src: RgbaImage,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
): void {
  for (let y = 0; y < sh; y += 1) {
    const srcY = sy + y;
    const dstY = dy + y;
    if (srcY < 0 || srcY >= src.height || dstY < 0 || dstY >= dst.height) continue;
    for (let x = 0; x < sw; x += 1) {
      const srcX = sx + x;
      const dstX = dx + x;
      if (srcX < 0 || srcX >= src.width || dstX < 0 || dstX >= dst.width) continue;
      const s = (srcY * src.width + srcX) * 4;
      const d = (dstY * dst.width + dstX) * 4;
      dst.rgba[d] = src.rgba[s]!;
      dst.rgba[d + 1] = src.rgba[s + 1]!;
      dst.rgba[d + 2] = src.rgba[s + 2]!;
      dst.rgba[d + 3] = src.rgba[s + 3]!;
    }
  }
}

function blitAlpha(
  dst: RgbaImage,
  src: RgbaImage,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
): void {
  for (let y = 0; y < sh; y += 1) {
    const srcY = sy + y;
    const dstY = dy + y;
    if (srcY < 0 || srcY >= src.height || dstY < 0 || dstY >= dst.height) continue;
    for (let x = 0; x < sw; x += 1) {
      const srcX = sx + x;
      const dstX = dx + x;
      if (srcX < 0 || srcX >= src.width || dstX < 0 || dstX >= dst.width) continue;
      const s = (srcY * src.width + srcX) * 4;
      const sa = src.rgba[s + 3]!;
      if (sa === 0) continue;
      const d = (dstY * dst.width + dstX) * 4;
      if (sa === 255 || dst.rgba[d + 3]! === 0) {
        dst.rgba[d] = src.rgba[s]!;
        dst.rgba[d + 1] = src.rgba[s + 1]!;
        dst.rgba[d + 2] = src.rgba[s + 2]!;
        dst.rgba[d + 3] = sa;
      } else {
        const inv = 255 - sa;
        dst.rgba[d] = ((src.rgba[s]! * sa + dst.rgba[d]! * inv) / 255) | 0;
        dst.rgba[d + 1] = ((src.rgba[s + 1]! * sa + dst.rgba[d + 1]! * inv) / 255) | 0;
        dst.rgba[d + 2] = ((src.rgba[s + 2]! * sa + dst.rgba[d + 2]! * inv) / 255) | 0;
        dst.rgba[d + 3] = Math.min(255, sa + ((dst.rgba[d + 3]! * inv) / 255 | 0));
      }
    }
  }
}

function rotate90CW(src: RgbaImage): RgbaImage {
  const dst = createImage(src.height, src.width);
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const s = (y * src.width + x) * 4;
      const nx = src.height - 1 - y;
      const ny = x;
      const d = (ny * dst.width + nx) * 4;
      dst.rgba[d] = src.rgba[s]!;
      dst.rgba[d + 1] = src.rgba[s + 1]!;
      dst.rgba[d + 2] = src.rgba[s + 2]!;
      dst.rgba[d + 3] = src.rgba[s + 3]!;
    }
  }
  return dst;
}

function rotate90CCW(src: RgbaImage): RgbaImage {
  const dst = createImage(src.height, src.width);
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const s = (y * src.width + x) * 4;
      const nx = y;
      const ny = src.width - 1 - x;
      const d = (ny * dst.width + nx) * 4;
      dst.rgba[d] = src.rgba[s]!;
      dst.rgba[d + 1] = src.rgba[s + 1]!;
      dst.rgba[d + 2] = src.rgba[s + 2]!;
      dst.rgba[d + 3] = src.rgba[s + 3]!;
    }
  }
  return dst;
}

function flipHorizontal(src: RgbaImage): RgbaImage {
  const dst = createImage(src.width, src.height);
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const s = (y * src.width + x) * 4;
      const d = (y * dst.width + (src.width - 1 - x)) * 4;
      dst.rgba[d] = src.rgba[s]!;
      dst.rgba[d + 1] = src.rgba[s + 1]!;
      dst.rgba[d + 2] = src.rgba[s + 2]!;
      dst.rgba[d + 3] = src.rgba[s + 3]!;
    }
  }
  return dst;
}

function flipVertical(src: RgbaImage): RgbaImage {
  const dst = createImage(src.width, src.height);
  for (let y = 0; y < src.height; y += 1) {
    const srcOff = (src.height - 1 - y) * src.width * 4;
    const dstOff = y * src.width * 4;
    dst.rgba.set(src.rgba.subarray(srcOff, srcOff + src.width * 4), dstOff);
  }
  return dst;
}

function darkenImage(src: RgbaImage, factor: number): RgbaImage {
  const dst = createImage(src.width, src.height);
  for (let i = 0; i < src.rgba.length; i += 4) {
    dst.rgba[i] = Math.round(src.rgba[i]! * factor);
    dst.rgba[i + 1] = Math.round(src.rgba[i + 1]! * factor);
    dst.rgba[i + 2] = Math.round(src.rgba[i + 2]! * factor);
    dst.rgba[i + 3] = src.rgba[i + 3]!;
  }
  return dst;
}

function scaleNearestFit(src: RgbaImage, targetW: number, targetH: number): RgbaImage {
  const dst = createImage(targetW, targetH);
  // Find opaque bounding box of src to center cleanly
  let minX = src.width;
  let minY = src.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      if (src.rgba[(y * src.width + x) * 4 + 3]! > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    minX = 0;
    minY = 0;
    maxX = src.width - 1;
    maxY = src.height - 1;
  }
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const scale = Math.min((targetW - 2) / cw, (targetH - 2) / ch, 1);
  const dw = Math.max(1, Math.round(cw * scale));
  const dh = Math.max(1, Math.round(ch * scale));
  const ox = Math.floor((targetW - dw) / 2);
  const oy = Math.floor((targetH - dh) / 2);
  for (let y = 0; y < dh; y += 1) {
    const sy = minY + Math.min(ch - 1, Math.floor((y / dh) * ch));
    for (let x = 0; x < dw; x += 1) {
      const sx = minX + Math.min(cw - 1, Math.floor((x / dw) * cw));
      const s = (sy * src.width + sx) * 4;
      const d = ((oy + y) * targetW + (ox + x)) * 4;
      dst.rgba[d] = src.rgba[s]!;
      dst.rgba[d + 1] = src.rgba[s + 1]!;
      dst.rgba[d + 2] = src.rgba[s + 2]!;
      dst.rgba[d + 3] = src.rgba[s + 3]!;
    }
  }
  return dst;
}

function hasOpaquePixels(img: RgbaImage, x0 = 0, y0 = 0, w = img.width, h = img.height): boolean {
  const xEnd = Math.min(img.width, x0 + w);
  const yEnd = Math.min(img.height, y0 + h);
  let count = 0;
  for (let y = Math.max(0, y0); y < yEnd; y += 1) {
    for (let x = Math.max(0, x0); x < xEnd; x += 1) {
      if (img.rgba[(y * img.width + x) * 4 + 3]! > 20) {
        count += 1;
        if (count >= 16) return true;
      }
    }
  }
  return false;
}

// ============================================================================
// Pure-TS DXT1 / DXT5 Block Decoder (Unity TextureFormat 10 & 12)
// ============================================================================

function decodeRgb565(c: number): readonly [number, number, number] {
  return [
    (((c >> 11) & 31) * 255) / 31 | 0,
    (((c >> 5) & 63) * 255) / 63 | 0,
    ((c & 31) * 255) / 31 | 0,
  ];
}

function decodeDxtToTopDownRgba(raw: Buffer, width: number, height: number, isDxt5: boolean): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  const bxCount = Math.max(1, (width + 3) >> 2);
  const byCount = Math.max(1, (height + 3) >> 2);
  let off = 0;
  const alphas = new Uint8Array(8);

  for (let by = 0; by < byCount; by += 1) {
    for (let bx = 0; bx < bxCount; bx += 1) {
      let aBitsLo = 0;
      let aBitsHi = 0;
      if (isDxt5) {
        const a0 = raw[off]!;
        const a1 = raw[off + 1]!;
        alphas[0] = a0;
        alphas[1] = a1;
        if (a0 > a1) {
          for (let i = 1; i <= 6; i += 1) {
            alphas[i + 1] = (((7 - i) * a0 + i * a1) / 7) | 0;
          }
        } else {
          for (let i = 1; i <= 4; i += 1) {
            alphas[i + 1] = (((5 - i) * a0 + i * a1) / 5) | 0;
          }
          alphas[6] = 0;
          alphas[7] = 255;
        }
        aBitsLo = raw[off + 2]! | (raw[off + 3]! << 8) | (raw[off + 4]! << 16);
        aBitsHi = raw[off + 5]! | (raw[off + 6]! << 8) | (raw[off + 7]! << 16);
        off += 8;
      }

      const c0 = raw.readUInt16LE(off);
      const c1 = raw.readUInt16LE(off + 2);
      const code = raw.readUInt32LE(off + 4);
      off += 8;

      const col0 = decodeRgb565(c0);
      const col1 = decodeRgb565(c1);
      const pal: Array<readonly [number, number, number, number]> = [
        [col0[0], col0[1], col0[2], 255],
        [col1[0], col1[1], col1[2], 255],
        isDxt5 || c0 > c1
          ? [((2 * col0[0] + col1[0]) / 3) | 0, ((2 * col0[1] + col1[1]) / 3) | 0, ((2 * col0[2] + col1[2]) / 3) | 0, 255]
          : [((col0[0] + col1[0]) / 2) | 0, ((col0[1] + col1[1]) / 2) | 0, ((col0[2] + col1[2]) / 2) | 0, 255],
        isDxt5 || c0 > c1
          ? [((col0[0] + 2 * col1[0]) / 3) | 0, ((col0[1] + 2 * col1[1]) / 3) | 0, ((col0[2] + 2 * col1[2]) / 3) | 0, 255]
          : [0, 0, 0, 0],
      ];

      for (let py = 0; py < 4; py += 1) {
        const y = by * 4 + py;
        if (y >= height) continue;
        const dstY = height - 1 - y; // Flip Unity bottom-up -> PNG top-down
        for (let px = 0; px < 4; px += 1) {
          const x = bx * 4 + px;
          if (x >= width) continue;
          const idx = py * 4 + px;
          const c = pal[(code >>> (idx * 2)) & 3]!;
          let a = c[3];
          if (isDxt5) {
            const ai = idx < 8 ? (aBitsLo >>> (idx * 3)) & 7 : (aBitsHi >>> ((idx - 8) * 3)) & 7;
            a = alphas[ai]!;
          }
          const d = (dstY * width + x) * 4;
          out[d] = c[0];
          out[d + 1] = c[1];
          out[d + 2] = c[2];
          out[d + 3] = a;
        }
      }
    }
  }
  return out;
}

// ============================================================================
// Read-Only Unity 2021.3 SerializedFile v22 Full Asset Database
// ============================================================================

interface UnityTextureRecord {
  readonly ref: string;
  readonly assetsFile: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly textureFormat: number; // 3=RGB24, 4=RGBA32, 5=ARGB32, 10=DXT1, 12=DXT5
  readonly imgDataLen: number;
  readonly imgDataOffset: number;
  readonly streamOffset: number;
  readonly streamSize: number;
  readonly streamPath: string;
}

interface UnitySpriteRecord {
  readonly ref: string;
  readonly name: string;
  readonly texRef: string;
  readonly texName: string;
  readonly x: number; // Top-down PNG pixel X
  readonly y: number; // Top-down PNG pixel Y
  readonly w: number;
  readonly h: number;
  readonly pivotX: number; // [0..1]
  readonly pivotY: number; // [0..1] top-down (1.0 = bottom/feet)
}

interface UnityClipRecord {
  readonly fname: string;
  readonly name: string;
  readonly sprites: readonly UnitySpriteRecord[];
  readonly texNames: readonly string[];
}

interface UnityTilesetRecord {
  readonly ref: string;
  readonly fname: string;
  readonly name: string;
  readonly texRef: string;
  readonly texName: string;
  readonly tilePxW: number;
  readonly tilePxH: number;
  readonly sliceOffX: number;
  readonly sliceOffY: number;
  readonly slicePadX: number;
  readonly slicePadY: number;
  readonly widthTiles: number;
  readonly heightTiles: number;
}

interface UnityCarpetBrushRecord {
  readonly fname: string;
  readonly name: string;
  readonly tsRef: string;
  readonly mask16: readonly number[];
  readonly diag4: readonly number[];
}

interface ParsedSerializedObject {
  readonly pathId: bigint;
  readonly objStart: number;
  readonly byteSize: number;
  readonly classId: number;
}

interface ParsedSerializedFile {
  readonly fname: string;
  readonly fl: string;
  readonly buf: Buffer;
  readonly objects: readonly ParsedSerializedObject[];
  readonly externals: readonly string[];
}

class UnityAssetDatabase {
  readonly steamDir: string;
  readonly texByRef = new Map<string, UnityTextureRecord>();
  readonly texByName = new Map<string, UnityTextureRecord[]>();
  readonly spriteByRef = new Map<string, UnitySpriteRecord>();
  readonly spritesByTexRef = new Map<string, UnitySpriteRecord[]>();
  readonly clipsByName = new Map<string, UnityClipRecord[]>();
  readonly tilesetsByRef = new Map<string, UnityTilesetRecord>();
  readonly tilesetsByName = new Map<string, UnityTilesetRecord>();
  readonly brushesByName = new Map<string, UnityCarpetBrushRecord>();
  private readonly decodedCache = new Map<string, RgbaImage | null>();

  constructor(steamDir: string) {
    this.steamDir = steamDir;
    this.loadAll();
  }

  private static readStr(buf: Buffer, p: number, end: number): { str: string; next: number } | null {
    if (p + 4 > end) return null;
    const len = buf.readInt32LE(p);
    p += 4;
    if (len < 0 || p + len > end) return null;
    const str = buf.subarray(p, p + len).toString('utf8');
    p += (len + 3) & ~3;
    return { str, next: p };
  }

  private static parseFile(fname: string, fullPath: string): ParsedSerializedFile | null {
    const buf = fs.readFileSync(fullPath);
    if (buf.length < 64 || buf.readUInt32BE(8) !== 22) return null;
    const dataOffset = Number(buf.readBigUInt64BE(32));
    const verEnd = buf.indexOf(0, 48);
    if (verEnd < 0) return null;
    let off = verEnd + 1 + 4 + 1;
    if (off + 4 > buf.length) return null;

    const typeCount = buf.readInt32LE(off);
    off += 4;
    const types: number[] = [];
    for (let i = 0; i < typeCount; i += 1) {
      const classId = buf.readInt32LE(off);
      off += 7 + (classId === 114 ? 16 : 0) + 16;
      types.push(classId);
    }

    const objCount = buf.readInt32LE(off);
    off += 4;
    const objects: ParsedSerializedObject[] = [];
    for (let i = 0; i < objCount; i += 1) {
      off = (off + 3) & ~3;
      const pathId = buf.readBigInt64LE(off);
      off += 8;
      const byteStart = Number(buf.readBigInt64LE(off));
      off += 8;
      const byteSize = buf.readUInt32LE(off);
      off += 4;
      const typeId = buf.readInt32LE(off);
      off += 4;
      objects.push({
        pathId,
        objStart: dataOffset + byteStart,
        byteSize,
        classId: types[typeId] ?? -1,
      });
    }

    const scriptCount = buf.readInt32LE(off);
    off += 4;
    for (let i = 0; i < scriptCount; i += 1) {
      off += 4;
      off = (off + 3) & ~3;
      off += 8;
    }

    const externalsCount = buf.readInt32LE(off);
    off += 4;
    const externals: string[] = [];
    for (let i = 0; i < externalsCount; i += 1) {
      const tempEnd = buf.indexOf(0, off);
      if (tempEnd < 0) break;
      off = tempEnd + 1 + 20;
      const pathEnd = buf.indexOf(0, off);
      if (pathEnd < 0) break;
      externals.push(buf.subarray(off, pathEnd).toString('utf8'));
      off = pathEnd + 1;
    }

    return { fname, fl: fname.toLowerCase(), buf, objects, externals };
  }

  private static resolveRef(sf: ParsedSerializedFile, fileId: number, pathId: bigint): string | null {
    if (fileId === 0) return `${sf.fl}:${pathId}`;
    const ext = sf.externals[fileId - 1];
    if (!ext) return null;
    return `${path.basename(ext).toLowerCase()}:${pathId}`;
  }

  private loadAll(): void {
    if (!fs.existsSync(this.steamDir)) return;
    const entries = fs.readdirSync(this.steamDir);
    const assetFiles = entries
      .filter(
        (f) =>
          f === 'globalgamemanagers.assets' ||
          f === 'resources.assets' ||
          /^sharedassets\d+\.assets$/.test(f),
      )
      .sort((a, b) => {
        const order = (n: string): number => {
          if (n === 'globalgamemanagers.assets') return -2;
          if (n === 'resources.assets') return -1;
          return Number.parseInt(n.slice(12), 10);
        };
        return order(a) - order(b);
      });

    const parsedFiles: ParsedSerializedFile[] = [];
    const scriptByRef = new Map<string, string>();

    // Pass 1: Parse headers + Texture2D (28) + MonoScript (115)
    for (const fname of assetFiles) {
      const sf = UnityAssetDatabase.parseFile(fname, path.join(this.steamDir, fname));
      if (!sf) continue;
      parsedFiles.push(sf);

      for (const obj of sf.objects) {
        const objEnd = obj.objStart + obj.byteSize;
        if (objEnd > sf.buf.length) continue;

        if (obj.classId === 28) {
          const nm = UnityAssetDatabase.readStr(sf.buf, obj.objStart, objEnd);
          if (!nm) continue;
          let p = nm.next + 6;
          p = (p + 3) & ~3;
          if (p + 56 > objEnd) continue;
          const width = sf.buf.readInt32LE(p);
          const height = sf.buf.readInt32LE(p + 4);
          p += 16; // w, h, completeImageSize, mipsStripped
          const textureFormat = sf.buf.readInt32LE(p);
          p += 4 + 4 + 3; // format, mipCount, flags
          p = (p + 3) & ~3;
          p += 8 + 24 + 8;
          if (p + 4 > objEnd) continue;
          const platformBlobLen = sf.buf.readInt32LE(p);
          p += 4 + ((platformBlobLen + 3) & ~3);
          if (p + 4 > objEnd) continue;
          const imgDataLen = sf.buf.readInt32LE(p);
          p += 4;
          const imgDataOffset = p;
          p += (imgDataLen + 3) & ~3;

          let streamOffset = 0;
          let streamSize = 0;
          let streamPath = '';
          if (p + 16 <= objEnd) {
            streamOffset = Number(sf.buf.readBigUInt64LE(p));
            streamSize = sf.buf.readUInt32LE(p + 8);
            const spLen = sf.buf.readInt32LE(p + 12);
            if (spLen > 0 && p + 16 + spLen <= objEnd) {
              streamPath = sf.buf.subarray(p + 16, p + 16 + spLen).toString('utf8');
            }
          }

          if (
            (textureFormat === 3 ||
              textureFormat === 4 ||
              textureFormat === 5 ||
              textureFormat === 10 ||
              textureFormat === 12) &&
            width > 0 &&
            height > 0
          ) {
            const ref = `${sf.fl}:${obj.pathId}`;
            const rec: UnityTextureRecord = {
              ref,
              assetsFile: fname,
              name: nm.str,
              width,
              height,
              textureFormat,
              imgDataLen,
              imgDataOffset,
              streamOffset,
              streamSize,
              streamPath,
            };
            this.texByRef.set(ref, rec);
            let list = this.texByName.get(nm.str);
            if (!list) {
              list = [];
              this.texByName.set(nm.str, list);
            }
            list.push(rec);
          }
        } else if (obj.classId === 115) {
          const nm = UnityAssetDatabase.readStr(sf.buf, obj.objStart, objEnd);
          if (nm) {
            scriptByRef.set(`${sf.fl}:${obj.pathId}`, nm.str);
          }
        }
      }
    }

    // Pass 2: Sprites (213) + STE Tilesets & CarpetBrushes (114)
    for (const sf of parsedFiles) {
      for (const obj of sf.objects) {
        const objEnd = obj.objStart + obj.byteSize;
        if (objEnd > sf.buf.length) continue;

        if (obj.classId === 213) {
          const nm = UnityAssetDatabase.readStr(sf.buf, obj.objStart, objEnd);
          if (!nm) continue;
          let p = nm.next;
          if (p + 84 > objEnd) continue;
          const rx = sf.buf.readFloatLE(p);
          const ry = sf.buf.readFloatLE(p + 4);
          const rw = sf.buf.readFloatLE(p + 8);
          const rh = sf.buf.readFloatLE(p + 12);
          p += 44; // rect(16) + offset(8) + border(16) + ppu(4)
          const px = sf.buf.readFloatLE(p);
          const py = sf.buf.readFloatLE(p + 4);
          p += 8 + 4 + 4 + 24; // pivot + extrude + isPoly + renderDataKey
          if (p + 4 > objEnd) continue;
          const tagCount = sf.buf.readInt32LE(p);
          p += 4;
          for (let t = 0; t < tagCount; t += 1) {
            const s = UnityAssetDatabase.readStr(sf.buf, p, objEnd);
            if (!s) {
              p = objEnd;
              break;
            }
            p = s.next;
          }
          if (p + 24 > objEnd) continue;
          p += 12; // spriteAtlas PPtr
          const texFileId = sf.buf.readInt32LE(p);
          const texPathId = sf.buf.readBigInt64LE(p + 4);
          const texRef = UnityAssetDatabase.resolveRef(sf, texFileId, texPathId);
          const tex = texRef ? this.texByRef.get(texRef) : undefined;
          if (!tex) continue;

          const x = Math.max(0, Math.min(tex.width - 1, Math.round(rx)));
          const y = Math.max(0, Math.min(tex.height - 1, Math.round(tex.height - ry - rh)));
          const w = Math.max(1, Math.min(tex.width - x, Math.round(rw)));
          const h = Math.max(1, Math.min(tex.height - y, Math.round(rh)));
          const spRec: UnitySpriteRecord = {
            ref: `${sf.fl}:${obj.pathId}`,
            name: nm.str,
            texRef: tex.ref,
            texName: tex.name,
            x,
            y,
            w,
            h,
            pivotX: Number(px.toFixed(4)),
            pivotY: Number((1 - py).toFixed(4)),
          };
          this.spriteByRef.set(spRec.ref, spRec);
          let list = this.spritesByTexRef.get(tex.ref);
          if (!list) {
            list = [];
            this.spritesByTexRef.set(tex.ref, list);
          }
          list.push(spRec);
        } else if (obj.classId === 114 && obj.byteSize >= 48) {
          let p = obj.objStart + 16;
          const scFileId = sf.buf.readInt32LE(p);
          const scPathId = sf.buf.readBigInt64LE(p + 4);
          p += 12;
          const scRef = UnityAssetDatabase.resolveRef(sf, scFileId, scPathId);
          const scName = scRef ? scriptByRef.get(scRef) : undefined;

          if (scName === 'Tileset') {
            const nm = UnityAssetDatabase.readStr(sf.buf, p, objEnd);
            if (!nm) continue;
            let q = nm.next;
            if (q + 76 > objEnd) continue;
            const texFileId = sf.buf.readInt32LE(q);
            const texPathId = sf.buf.readBigInt64LE(q + 4);
            q += 12;
            const texRef = UnityAssetDatabase.resolveRef(sf, texFileId, texPathId);
            const tex = texRef ? this.texByRef.get(texRef) : undefined;
            if (!tex) continue;
            const tilePxW = Math.round(sf.buf.readFloatLE(q));
            const tilePxH = Math.round(sf.buf.readFloatLE(q + 4));
            const sliceOffX = Math.round(sf.buf.readFloatLE(q + 8));
            const sliceOffY = Math.round(sf.buf.readFloatLE(q + 12));
            const slicePadX = Math.round(sf.buf.readFloatLE(q + 16));
            const slicePadY = Math.round(sf.buf.readFloatLE(q + 20));
            q += 24 + 16 + 8 + 4 + 8; // bgColor(16), visualTileSize(8), isInit(4), rowLen+dummy(8)
            const widthTiles = q + 4 <= objEnd ? sf.buf.readInt32LE(q) : 0;
            const heightTiles = q + 8 <= objEnd ? sf.buf.readInt32LE(q + 4) : 0;
            const rec: UnityTilesetRecord = {
              ref: `${sf.fl}:${obj.pathId}`,
              fname: sf.fname,
              name: nm.str,
              texRef: tex.ref,
              texName: tex.name,
              tilePxW: tilePxW > 0 ? tilePxW : 32,
              tilePxH: tilePxH > 0 ? tilePxH : 32,
              sliceOffX,
              sliceOffY,
              slicePadX,
              slicePadY,
              widthTiles: widthTiles > 0 ? widthTiles : Math.max(1, Math.floor(tex.width / 32)),
              heightTiles: heightTiles > 0 ? heightTiles : Math.max(1, Math.floor(tex.height / 32)),
            };
            this.tilesetsByRef.set(rec.ref, rec);
            this.tilesetsByName.set(rec.name, rec);
          } else if (scName === 'CarpetBrush') {
            const nm = UnityAssetDatabase.readStr(sf.buf, p, objEnd);
            if (!nm) continue;
            let q = nm.next;
            if (q + 20 > objEnd) continue;
            const tsFileId = sf.buf.readInt32LE(q);
            const tsPathId = sf.buf.readBigInt64LE(q + 4);
            q += 12;
            const tsRef = UnityAssetDatabase.resolveRef(sf, tsFileId, tsPathId);
            if (!tsRef) continue;
            for (let off = q; off + 68 <= objEnd; off += 4) {
              if (sf.buf.readInt32LE(off) === 16) {
                const mask16: number[] = [];
                let plausible = true;
                for (let i = 0; i < 16; i += 1) {
                  const v = sf.buf.readUInt32LE(off + 4 + i * 4);
                  const tid = v & 0xffff;
                  if (tid > 1000 && v !== 0xffffffff) {
                    plausible = false;
                    break;
                  }
                  mask16.push(tid);
                }
                if (plausible) {
                  const diag4: number[] = [];
                  const after = off + 68;
                  if (after + 20 <= objEnd && sf.buf.readInt32LE(after) === 4) {
                    for (let d = 0; d < 4; d += 1) {
                      diag4.push(sf.buf.readUInt32LE(after + 4 + d * 4) & 0xffff);
                    }
                  }
                  this.brushesByName.set(nm.str, {
                    fname: sf.fname,
                    name: nm.str,
                    tsRef,
                    mask16,
                    diag4,
                  });
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Pass 3: AnimationClips (74) -> extract exact Sprite sequences from tail pptrCurveMapping
    for (const sf of parsedFiles) {
      for (const obj of sf.objects) {
        if (obj.classId !== 74) continue;
        const objEnd = obj.objStart + obj.byteSize;
        if (objEnd > sf.buf.length) continue;
        const nm = UnityAssetDatabase.readStr(sf.buf, obj.objStart, objEnd);
        if (!nm) continue;
        const sub = sf.buf.subarray(obj.objStart, objEnd);
        for (let pos = sub.length - 16; pos >= 16; pos -= 4) {
          const count = sub.readInt32LE(pos);
          if (count < 1 || count > 260) continue;
          if (pos + 4 + count * 12 > sub.length) continue;
          let ok = true;
          const sprites: UnitySpriteRecord[] = [];
          for (let i = 0; i < count; i += 1) {
            const o = pos + 4 + i * 12;
            const fid = sub.readInt32LE(o);
            const pid = sub.readBigInt64LE(o + 4);
            if (fid < 0 || fid > sf.externals.length) {
              ok = false;
              break;
            }
            const ref = UnityAssetDatabase.resolveRef(sf, fid, pid);
            const sp = ref ? this.spriteByRef.get(ref) : undefined;
            if (!sp) {
              ok = false;
              break;
            }
            sprites.push(sp);
          }
          if (ok) {
            const clip: UnityClipRecord = {
              fname: sf.fname,
              name: nm.str,
              sprites,
              texNames: [...new Set(sprites.map((s) => s.texName))],
            };
            let list = this.clipsByName.get(nm.str);
            if (!list) {
              list = [];
              this.clipsByName.set(nm.str, list);
            }
            list.push(clip);
            break;
          }
        }
      }
    }
  }

  decodeTextureByRef(ref: string): RgbaImage | null {
    if (this.decodedCache.has(ref)) {
      return this.decodedCache.get(ref) ?? null;
    }
    const rec = this.texByRef.get(ref);
    if (!rec) return null;

    const neededBytes =
      rec.textureFormat === 10
        ? Math.max(1, (rec.width + 3) >> 2) * Math.max(1, (rec.height + 3) >> 2) * 8
        : rec.textureFormat === 12
          ? Math.max(1, (rec.width + 3) >> 2) * Math.max(1, (rec.height + 3) >> 2) * 16
          : rec.width * rec.height * (rec.textureFormat === 3 ? 3 : 4);

    let raw: Buffer | null = null;
    if (rec.imgDataLen >= neededBytes) {
      const fd = fs.openSync(path.join(this.steamDir, rec.assetsFile), 'r');
      try {
        raw = Buffer.alloc(neededBytes);
        fs.readSync(fd, raw, 0, neededBytes, rec.imgDataOffset);
      } finally {
        fs.closeSync(fd);
      }
    } else if (rec.streamSize >= neededBytes && rec.streamPath) {
      const resFullPath = path.join(this.steamDir, path.basename(rec.streamPath));
      if (fs.existsSync(resFullPath)) {
        const fd = fs.openSync(resFullPath, 'r');
        try {
          raw = Buffer.alloc(neededBytes);
          fs.readSync(fd, raw, 0, neededBytes, rec.streamOffset);
        } finally {
          fs.closeSync(fd);
        }
      }
    }

    if (!raw || raw.length < neededBytes) {
      this.decodedCache.set(ref, null);
      return null;
    }

    let rgba: Uint8Array;
    if (rec.textureFormat === 10 || rec.textureFormat === 12) {
      rgba = decodeDxtToTopDownRgba(raw, rec.width, rec.height, rec.textureFormat === 12);
    } else {
      const bpp = rec.textureFormat === 3 ? 3 : 4;
      rgba = new Uint8Array(rec.width * rec.height * 4);
      for (let y = 0; y < rec.height; y += 1) {
        const srcY = rec.height - 1 - y;
        for (let x = 0; x < rec.width; x += 1) {
          const s = (srcY * rec.width + x) * bpp;
          const d = (y * rec.width + x) * 4;
          if (rec.textureFormat === 4) {
            rgba[d] = raw[s]!;
            rgba[d + 1] = raw[s + 1]!;
            rgba[d + 2] = raw[s + 2]!;
            rgba[d + 3] = raw[s + 3]!;
          } else if (rec.textureFormat === 5) {
            rgba[d] = raw[s + 1]!;
            rgba[d + 1] = raw[s + 2]!;
            rgba[d + 2] = raw[s + 3]!;
            rgba[d + 3] = raw[s]!;
          } else {
            rgba[d] = raw[s]!;
            rgba[d + 1] = raw[s + 1]!;
            rgba[d + 2] = raw[s + 2]!;
            rgba[d + 3] = 255;
          }
        }
      }
    }

    const img: RgbaImage = { width: rec.width, height: rec.height, rgba };
    this.decodedCache.set(ref, img);
    return img;
  }

  findTexture(name: string, preferFile?: string): UnityTextureRecord | null {
    const list = this.texByName.get(name);
    if (!list || list.length === 0) return null;
    if (preferFile) {
      const match = list.find((t) => t.assetsFile.toLowerCase() === preferFile.toLowerCase());
      if (match) return match;
    }
    return list[0]!;
  }

  findClip(clipName: string, texFilter?: string, fileFilter?: string): UnityClipRecord | null {
    const list = this.clipsByName.get(clipName);
    if (!list || list.length === 0) return null;
    const filtered = list.filter((c) => {
      if (fileFilter && c.fname.toLowerCase() !== fileFilter.toLowerCase()) return false;
      if (texFilter && !c.texNames.includes(texFilter)) return false;
      return true;
    });
    if (filtered.length > 0) return filtered[0]!;
    if (texFilter) {
      const byTex = list.find((c) => c.texNames.includes(texFilter));
      if (byTex) return byTex;
    }
    return list[0]!;
  }

  getSortedSpritesForTex(texRef: string): UnitySpriteRecord[] {
    const list = this.spritesByTexRef.get(texRef);
    if (!list || list.length === 0) return [];
    // Sort by numeric suffix (_0, _1, ... _10) if present, else top-to-bottom, left-to-right
    return [...list].sort((a, b) => {
      const ma = /_(\d+)$/.exec(a.name);
      const mb = /_(\d+)$/.exec(b.name);
      if (ma && mb) {
        const na = Number.parseInt(ma[1]!, 10);
        const nb = Number.parseInt(mb[1]!, 10);
        if (na !== nb) return na - nb;
      }
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
  }

  cropSprite(sp: UnitySpriteRecord): RgbaImage | null {
    const tex = this.decodeTextureByRef(sp.texRef);
    if (!tex) return null;
    return cropImage(tex, sp.x, sp.y, sp.w, sp.h);
  }
}

// ============================================================================
// Multi-Clip Sprite Atlas Packer (Row-Per-Clip, Deduplicated, 1px Gutter)
// ============================================================================

interface ClipSourceSpec {
  readonly clipName: string;
  readonly fps: number;
  readonly loop: boolean;
  readonly sprites: readonly UnitySpriteRecord[];
  readonly maxFrames?: number;
  readonly pivotOverride?: readonly [number, number];
}

interface PackedAtlasResult {
  readonly image: RgbaImage;
  readonly frames: readonly SpriteFrameRect[];
  readonly clips: Readonly<Record<string, SpriteAnimClip>>;
}

function subsampleIndices(len: number, maxFrames?: number): number[] {
  if (!maxFrames || len <= maxFrames) {
    return Array.from({ length: len }, (_, i) => i);
  }
  const out: number[] = [];
  for (let i = 0; i < maxFrames; i += 1) {
    out.push(Math.floor((i * len) / maxFrames));
  }
  return out;
}

function packSpriteClips(db: UnityAssetDatabase, specs: readonly ClipSourceSpec[]): PackedAtlasResult | null {
  const uniqueFrames: Array<{
    key: string;
    img: RgbaImage;
    pivotX: number;
    pivotY: number;
  }> = [];
  const keyToIdx = new Map<string, number>();
  const clipFrameIndices = new Map<string, { indices: number[]; fps: number; loop: boolean }>();

  for (const spec of specs) {
    const picked = subsampleIndices(spec.sprites.length, spec.maxFrames);
    const indices: number[] = [];
    for (const pi of picked) {
      const sp = spec.sprites[pi]!;
      const px = spec.pivotOverride ? spec.pivotOverride[0] : sp.pivotX;
      const py = spec.pivotOverride ? spec.pivotOverride[1] : sp.pivotY;
      const frameKey = `${sp.texRef}:${sp.x},${sp.y},${sp.w},${sp.h}:${px},${py}`;
      let idx = keyToIdx.get(frameKey);
      if (idx === undefined) {
        const img = db.cropSprite(sp);
        if (!img) continue;
        idx = uniqueFrames.length;
        uniqueFrames.push({ key: frameKey, img, pivotX: px, pivotY: py });
        keyToIdx.set(frameKey, idx);
      }
      indices.push(idx);
    }
    if (indices.length > 0) {
      clipFrameIndices.set(spec.clipName, { indices, fps: spec.fps, loop: spec.loop });
    }
  }

  if (uniqueFrames.length === 0) return null;

  // Shelf-pack frames into rows capped around 1024px wide (or widest single frame)
  const maxFrameW = Math.max(...uniqueFrames.map((f) => f.img.width));
  const targetRowW = Math.max(maxFrameW, Math.min(1024, Math.max(512, maxFrameW * 8)));
  const GUTTER = 1;

  interface PlacedFrame {
    idx: number;
    x: number;
    y: number;
  }
  const placed: PlacedFrame[] = [];
  let curX = 0;
  let curY = 0;
  let rowH = 0;
  let totalW = 0;

  for (let i = 0; i < uniqueFrames.length; i += 1) {
    const f = uniqueFrames[i]!;
    if (curX > 0 && curX + f.img.width > targetRowW) {
      curY += rowH + GUTTER;
      curX = 0;
      rowH = 0;
    }
    placed.push({ idx: i, x: curX, y: curY });
    curX += f.img.width + GUTTER;
    if (curX - GUTTER > totalW) totalW = curX - GUTTER;
    if (f.img.height > rowH) rowH = f.img.height;
  }
  const totalH = Math.max(1, curY + rowH);
  totalW = Math.max(1, totalW);

  const atlas = createImage(totalW, totalH);
  const frames: SpriteFrameRect[] = new Array(uniqueFrames.length);
  for (const p of placed) {
    const f = uniqueFrames[p.idx]!;
    blitOpaque(atlas, f.img, 0, 0, f.img.width, f.img.height, p.x, p.y);
    frames[p.idx] = {
      x: p.x,
      y: p.y,
      w: f.img.width,
      h: f.img.height,
      pivotX: f.pivotX,
      pivotY: f.pivotY,
    };
  }

  const clips: Record<string, SpriteAnimClip> = {};
  for (const [name, c] of clipFrameIndices) {
    clips[name] = { frames: c.indices, fps: c.fps, loop: c.loop };
  }
  return { image: atlas, frames, clips };
}

function packImageFrames(
  items: ReadonlyArray<{ img: RgbaImage; pivotX: number; pivotY: number; clipName?: string }>,
  fps = 10,
  loop = true,
): PackedAtlasResult {
  const GUTTER = 0;
  const totalW = items.reduce((sum, it) => sum + it.img.width + GUTTER, 0);
  const totalH = Math.max(...items.map((it) => it.img.height));
  const atlas = createImage(Math.max(1, totalW), Math.max(1, totalH));
  const frames: SpriteFrameRect[] = [];
  const clipsByName = new Map<string, number[]>();
  let x = 0;
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!;
    blitOpaque(atlas, it.img, 0, 0, it.img.width, it.img.height, x, 0);
    frames.push({ x, y: 0, w: it.img.width, h: it.img.height, pivotX: it.pivotX, pivotY: it.pivotY });
    if (it.clipName) {
      let arr = clipsByName.get(it.clipName);
      if (!arr) {
        arr = [];
        clipsByName.set(it.clipName, arr);
      }
      arr.push(i);
    }
    x += it.img.width + GUTTER;
  }
  const clips: Record<string, SpriteAnimClip> = {};
  if (clipsByName.size > 0) {
    for (const [name, arr] of clipsByName) {
      clips[name] = { frames: arr, fps, loop };
    }
  } else {
    clips.idle = { frames: frames.map((_, i) => i), fps, loop };
  }
  return { image: atlas, frames, clips };
}

// ============================================================================
// Normalized 512x64 16-Mask Biome Tileset Baker (Strips STE 2px Padding!)
// ============================================================================

const STANDARD_TILE_LAYOUT: TileLayoutMeta = {
  tileSize: 32,
  format: 'strip16',
  rows: 2,
  hasInnerCorners: true,
  innerCornerRow: 1,
  variantCols: [4, 5, 6, 7],
  bgWallCols: [8, 9, 10, 11],
};

function getSteTileCrop(db: UnityAssetDatabase, ts: UnityTilesetRecord, tileId: number): RgbaImage | null {
  const tex = db.decodeTextureByRef(ts.texRef);
  if (!tex) return null;
  const col = tileId % ts.widthTiles;
  const row = Math.floor(tileId / ts.widthTiles);
  const sx = ts.sliceOffX + col * (ts.tilePxW + ts.slicePadX);
  const sy = ts.sliceOffY + row * (ts.tilePxH + ts.slicePadY);
  if (sx < 0 || sy < 0 || sx + 32 > tex.width || sy + 32 > tex.height) return null;
  return cropImage(tex, sx, sy, 32, 32);
}

interface BiomeTilesetSpec {
  readonly brushName: string;
  readonly bgBrushName?: string;
}

const BIOME_BRUSH_SPECS: Readonly<Partial<Record<BiomeId, BiomeTilesetSpec>>> = {
  MLAIR: { brushName: 'MomboLairBrush', bgBrushName: 'MLBackgroundBrush' },
  OPOUSO: { brushName: 'OPousoTMBrush', bgBrushName: 'BackgroundBrush_OP' },
  TDM: { brushName: 'BrushTrilhaDosMonstros', bgBrushName: 'BrushBackgroundTrilhaDosMonstros' },
  FLIN: { brushName: 'BrushFlorestaInfestada', bgBrushName: 'BackFLINBrush' },
  AP: { brushName: 'ArvorePrimalBrush', bgBrushName: 'BackArvorePrimalBrush' },
  ATVC: { brushName: 'AltarBrush', bgBrushName: 'AltarBack' },
  DSI: { brushName: 'DSITileBrush', bgBrushName: 'DSIBackgroundBrush' },
  LAB: { brushName: 'TEMPBrush' }, // Unity named LAB tileset TEMPTileSite/TEMPBrush -> LE_tileset_A!
  TEMP: { brushName: 'BrushTEMP_TileSet', bgBrushName: 'TEMP_BrushBackgroud' },
  EVIL: { brushName: 'BrushFINAL_TileSet 1', bgBrushName: 'FINAL_BrushBackgroud' },
};

function bakeSteBiomeTileset(db: UnityAssetDatabase, biome: BiomeId): RgbaImage | null {
  if (biome === 'GSHIP') {
    return bakeGhostShipTileset(db);
  }
  const spec = BIOME_BRUSH_SPECS[biome];
  if (!spec) return null;
  const brush = db.brushesByName.get(spec.brushName);
  if (!brush) return null;
  const ts = db.tilesetsByRef.get(brush.tsRef);
  if (!ts) return null;

  const out = createImage(512, 64);
  const tile = (mask: number): RgbaImage | null => {
    const tid = brush.mask16[mask];
    if (tid === undefined) return null;
    return getSteTileCrop(db, ts, tid);
  };

  const tTL = tile(6); // Right + Down
  const tTop = tile(14); // Left + Right + Down
  const tTR = tile(12); // Left + Down
  const tLeft = tile(7); // Up + Right + Down
  const tCenter = tile(15); // All 4
  const tRight = tile(13); // Up + Left + Down
  const tBL = tile(3); // Up + Right
  const tBot = tile(11); // Up + Left + Right
  const tBR = tile(9); // Up + Left

  if (!tCenter || !tTop) return null;

  const centerId = brush.mask16[15]!;
  // Row 0: 16 autotile masks (1=UP, 2=RIGHT, 4=DOWN, 8=LEFT)
  for (let mask = 0; mask < 16; mask += 1) {
    const dstX = mask * 32;
    const rawTid = brush.mask16[mask]!;
    const isStandardThick =
      mask === 3 ||
      mask === 6 ||
      mask === 7 ||
      mask === 9 ||
      mask === 11 ||
      mask === 12 ||
      mask === 13 ||
      mask === 14 ||
      mask === 15;

    if (isStandardThick || rawTid !== centerId) {
      const img = getSteTileCrop(db, ts, rawTid) ?? tCenter;
      blitOpaque(out, img, 0, 0, 32, 32, dstX, 0);
      continue;
    }

    // Composite clean 1-tile-thin / isolated tiles from real biome edges & corners
    const comp = createImage(32, 32);
    if (mask === 10) {
      // L+R thin horizontal ledge: top 24px of Top + bottom 8px of Bot
      blitOpaque(comp, tTop, 0, 0, 32, 24, 0, 0);
      blitOpaque(comp, tBot ?? tCenter, 0, 24, 32, 8, 0, 24);
    } else if (mask === 2) {
      // Right-only left cap of thin ledge
      blitOpaque(comp, tTL ?? tTop, 0, 0, 32, 24, 0, 0);
      blitOpaque(comp, tBL ?? tBot ?? tCenter, 0, 24, 32, 8, 0, 24);
    } else if (mask === 8) {
      // Left-only right cap of thin ledge
      blitOpaque(comp, tTR ?? tTop, 0, 0, 32, 24, 0, 0);
      blitOpaque(comp, tBR ?? tBot ?? tCenter, 0, 24, 32, 8, 0, 24);
    } else if (mask === 4) {
      // Down-only top cap of 1-wide pillar
      blitOpaque(comp, tTL ?? tTop, 0, 0, 16, 32, 0, 0);
      blitOpaque(comp, tTR ?? tTop, 16, 0, 16, 32, 16, 0);
    } else if (mask === 5) {
      // Up+Down middle of 1-wide pillar
      blitOpaque(comp, tLeft ?? tCenter, 0, 0, 16, 32, 0, 0);
      blitOpaque(comp, tRight ?? tCenter, 16, 0, 16, 32, 16, 0);
    } else if (mask === 1) {
      // Up-only bottom cap of 1-wide pillar
      blitOpaque(comp, tBL ?? tBot ?? tCenter, 0, 0, 16, 32, 0, 0);
      blitOpaque(comp, tBR ?? tBot ?? tCenter, 16, 0, 16, 32, 16, 0);
    } else {
      // mask === 0: isolated 1x1 block -> 4 exact 16x16 outer corners
      blitOpaque(comp, tTL ?? tTop, 0, 0, 16, 16, 0, 0);
      blitOpaque(comp, tTR ?? tTop, 16, 0, 16, 16, 16, 0);
      blitOpaque(comp, tBL ?? tBot ?? tCenter, 0, 16, 16, 16, 0, 16);
      blitOpaque(comp, tBR ?? tBot ?? tCenter, 16, 16, 16, 16, 16, 16);
    }
    blitOpaque(out, comp, 0, 0, 32, 32, dstX, 0);
  }

  // Row 1 cols 0..3: 4 exact STE inner corners [TR-inner, TL-inner, BR-inner, BL-inner]
  for (let d = 0; d < 4; d += 1) {
    const dtid = brush.diag4[d];
    const dimg = dtid !== undefined ? getSteTileCrop(db, ts, dtid) : null;
    blitOpaque(out, dimg && hasOpaquePixels(dimg) ? dimg : tCenter, 0, 0, 32, 32, d * 32, 32);
  }

  // Row 1 cols 4..7: 4 guaranteed seamless solid interior (mask === 15) variants
  const interiorCandidates: RgbaImage[] = [tCenter];
  // Only accept an adjacent interior tile if literally sandwiched between centerId and right edge (e.g. ML_tileset 9,10,11)
  if (brush.mask16[13] === centerId + 2) {
    const midAlt = getSteTileCrop(db, ts, centerId + 1);
    if (midAlt && hasOpaquePixels(midAlt)) {
      interiorCandidates.push(midAlt);
    }
  }
  const hFlip = flipHorizontal(tCenter);
  const vFlip = flipVertical(tCenter);
  const hvFlip = flipHorizontal(vFlip);
  for (const extra of [hFlip, vFlip, hvFlip]) {
    if (interiorCandidates.length < 4) interiorCandidates.push(extra);
  }
  for (let v = 0; v < 4; v += 1) {
    blitOpaque(out, interiorCandidates[v]!, 0, 0, 32, 32, (4 + v) * 32, 32);
  }

  // Row 1 cols 8..11: Background wall tiles (8=center, 9=top, 10=left, 11=right)
  const bgBrush = spec.bgBrushName ? db.brushesByName.get(spec.bgBrushName) : undefined;
  const bgTs = bgBrush ? db.tilesetsByRef.get(bgBrush.tsRef) : undefined;
  if (bgBrush && bgTs) {
    const bgMasks = [15, 14, 7, 13];
    for (let i = 0; i < 4; i += 1) {
      const bimg = getSteTileCrop(db, bgTs, bgBrush.mask16[bgMasks[i]!]!);
      blitOpaque(out, bimg && hasOpaquePixels(bimg) ? bimg : darkenImage(tCenter, 0.52), 0, 0, 32, 32, (8 + i) * 32, 32);
    }
  } else {
    const darkCenter = darkenImage(tCenter, 0.52);
    const darkTop = darkenImage(tTop, 0.52);
    const darkLeft = darkenImage(tLeft ?? tCenter, 0.52);
    const darkRight = darkenImage(tRight ?? tCenter, 0.52);
    blitOpaque(out, darkCenter, 0, 0, 32, 32, 8 * 32, 32);
    blitOpaque(out, darkTop, 0, 0, 32, 32, 9 * 32, 32);
    blitOpaque(out, darkLeft, 0, 0, 32, 32, 10 * 32, 32);
    blitOpaque(out, darkRight, 0, 0, 32, 32, 11 * 32, 32);
  }

  return out;
}

function bakeGhostShipTileset(db: UnityAssetDatabase): RgbaImage | null {
  const hullTexRec = db.findTexture('ARENA_BACK_TILE_2');
  const deckTexRec = db.findTexture('ARENA_platmobiles');
  const darkTexRec = db.findTexture('Nightmare_Darkness_Tileset');
  if (!hullTexRec || !deckTexRec) return null;
  const hullRaw = db.decodeTextureByRef(hullTexRec.ref);
  const deckRaw = db.decodeTextureByRef(deckTexRec.ref);
  if (!hullRaw || !deckRaw) return null;

  // Crop 32x32 riveted steel plate from ARENA_BACK_TILE_2 (62x62)
  const hullCenter = cropImage(hullRaw, 15, 15, 32, 32);
  const hullTile = createImage(32, 32);
  blitOpaque(hullTile, hullCenter, 0, 0, 32, 32, 0, 0);
  // Place crisp corner rivets from hullRaw (0..11, 50..61)
  blitOpaque(hullTile, hullRaw, 2, 2, 10, 10, 1, 1);
  blitOpaque(hullTile, hullRaw, hullRaw.width - 12, 2, 10, 10, 21, 1);
  blitOpaque(hullTile, hullRaw, 2, hullRaw.height - 12, 10, 10, 1, 21);
  blitOpaque(hullTile, hullRaw, hullRaw.width - 12, hullRaw.height - 12, 10, 10, 21, 21);

  // Top glowing amber ship timber deck from ARENA_platmobiles (96x32)
  const deckLeft = cropImage(deckRaw, 0, 0, 32, 18);
  const deckMid = cropImage(deckRaw, 32, 0, 32, 18);
  const deckRight = cropImage(deckRaw, 64, 0, 32, 18);

  const out = createImage(512, 64);
  const rimDark: readonly [number, number, number, number] = [0x1c, 0x10, 0x24, 255];
  const rimGold: readonly [number, number, number, number] = [0xd8, 0x8a, 0x28, 255];

  const setPx = (img: RgbaImage, x: number, y: number, c: readonly [number, number, number, number]) => {
    const d = (y * img.width + x) * 4;
    img.rgba[d] = c[0];
    img.rgba[d + 1] = c[1];
    img.rgba[d + 2] = c[2];
    img.rgba[d + 3] = c[3];
  };

  for (let mask = 0; mask < 16; mask += 1) {
    const up = (mask & 1) !== 0;
    const right = (mask & 2) !== 0;
    const down = (mask & 4) !== 0;
    const left = (mask & 8) !== 0;
    const cell = createImage(32, 32);
    blitOpaque(cell, hullTile, 0, 0, 32, 32, 0, 0);

    // Exposed top gets rich Ghost Ship amber timber plank cap!
    if (!up) {
      const cap = !left && right ? deckLeft : left && !right ? deckRight : deckMid;
      blitAlpha(cell, cap, 0, 0, 32, 18, 0, 0);
      for (let x = 0; x < 32; x += 1) setPx(cell, x, 0, rimDark);
    }
    if (!down) {
      for (let x = 0; x < 32; x += 1) {
        setPx(cell, x, 31, rimDark);
        setPx(cell, x, 30, rimGold);
      }
    }
    if (!left) {
      for (let y = 0; y < 32; y += 1) {
        setPx(cell, 0, y, rimDark);
        setPx(cell, 1, y, rimGold);
      }
    }
    if (!right) {
      for (let y = 0; y < 32; y += 1) {
        setPx(cell, 31, y, rimDark);
        setPx(cell, 30, y, rimGold);
      }
    }
    blitOpaque(out, cell, 0, 0, 32, 32, mask * 32, 0);
  }

  // Row 1 cols 0..3: inner corners, cols 4..7: opaque seamless hull variants
  const hullFlipH = flipHorizontal(hullTile);
  const hullFlipV = flipVertical(hullTile);
  const hullVariants = [hullTile, hullFlipH, hullFlipV, flipHorizontal(hullFlipV)];
  for (let i = 0; i < 4; i += 1) {
    blitOpaque(out, hullTile, 0, 0, 32, 32, i * 32, 32);
    blitOpaque(out, hullVariants[i]!, 0, 0, 32, 32, (4 + i) * 32, 32);
  }
  // Row 1 cols 8..11: Nightmare Darkness void wall tiles
  const darkImg = darkTexRec ? db.decodeTextureByRef(darkTexRec.ref) : null;
  for (let i = 0; i < 4; i += 1) {
    if (darkImg && darkImg.height >= 352) {
      const patch = cropImage(darkImg, (i % 6) * 32, 288, 32, 32);
      blitOpaque(out, patch, 0, 0, 32, 32, (8 + i) * 32, 32);
    } else {
      blitOpaque(out, darkenImage(hullTile, 0.5), 0, 0, 32, 32, (8 + i) * 32, 32);
    }
  }
  return out;
}

// ============================================================================
// Declarative Origin Asset Extraction Specs (Heroes, Enemies, Bosses, NPCs,
// Parallax BGs, Deco, Special Tiles, Props, HUD/UI, and FX)
// ============================================================================

interface ClipSelector {
  readonly clipName: string;
  readonly unityClip?: string;
  readonly unityClips?: readonly string[];
  readonly texName?: string;
  readonly preferFile?: string;
  readonly spriteRange?: readonly [number, number]; // inclusive [start, end] on texName's sorted sprites
  readonly fps: number;
  readonly loop: boolean;
  readonly maxFrames?: number;
  readonly pivotOverride?: readonly [number, number];
}

function resolveSelectorSprites(db: UnityAssetDatabase, sel: ClipSelector): UnitySpriteRecord[] {
  const out: UnitySpriteRecord[] = [];
  if (sel.unityClips && sel.unityClips.length > 0) {
    for (const cn of sel.unityClips) {
      const clip = db.findClip(cn, sel.texName, sel.preferFile);
      if (clip) out.push(...clip.sprites);
    }
    if (out.length > 0) return out;
  }
  if (sel.unityClip) {
    const clip = db.findClip(sel.unityClip, sel.texName, sel.preferFile);
    if (clip) return [...clip.sprites];
  }
  if (sel.texName) {
    const tex = db.findTexture(sel.texName, sel.preferFile);
    if (tex) {
      const sorted = db.getSortedSpritesForTex(tex.ref);
      if (sorted.length > 0) {
        if (sel.spriteRange) {
          const [s, e] = sel.spriteRange;
          const sliced = sorted.slice(s, e + 1);
          if (sliced.length > 0) return sliced;
        }
        return sorted;
      }
      // Single-frame texture with no Sprite object: synthesize whole-texture Sprite record
      return [
        {
          ref: `${tex.ref}:full`,
          name: tex.name,
          texRef: tex.ref,
          texName: tex.name,
          x: 0,
          y: 0,
          w: tex.width,
          h: tex.height,
          pivotX: 0.5,
          pivotY: 1.0,
        },
      ];
    }
  }
  return [];
}

function extractPackedClips(db: UnityAssetDatabase, selectors: readonly ClipSelector[]): PackedAtlasResult | null {
  const specs: ClipSourceSpec[] = [];
  for (const sel of selectors) {
    const sprites = resolveSelectorSprites(db, sel);
    if (sprites.length === 0) continue;
    specs.push({
      clipName: sel.clipName,
      fps: sel.fps,
      loop: sel.loop,
      sprites,
      maxFrames: sel.maxFrames,
      pivotOverride: sel.pivotOverride,
    });
  }
  if (specs.length === 0) return null;
  return packSpriteClips(db, specs);
}

const HERO_CLIP_SPECS: Readonly<Record<HeroFormId, readonly ClipSelector[]>> = {
  krunk_basic: [
    { clipName: 'idle', unityClip: 'Iddle', texName: 'Mombo_idle_FINAL', preferFile: 'sharedassets3.assets', fps: 10, loop: true },
    { clipName: 'run', unityClip: 'Walking', texName: 'Mombo_walking_FINAL', preferFile: 'sharedassets3.assets', fps: 12, loop: true },
    { clipName: 'jump', unityClips: ['Jumping', 'Floating'], texName: 'Mombo_UP_jumping_FINAL_1', preferFile: 'sharedassets3.assets', fps: 14, loop: false },
    { clipName: 'fall', unityClip: 'JumpFalling', texName: 'Mombo_UP_jumping_FINAL_1', preferFile: 'sharedassets3.assets', fps: 12, loop: true },
    { clipName: 'flip', unityClip: 'JumpFlipping', texName: 'Mombo_ALT_jumping', preferFile: 'sharedassets3.assets', fps: 16, loop: true },
    { clipName: 'wall_slide', unityClip: 'Sliding', texName: 'Mombo_wall sliding_FINAL', preferFile: 'sharedassets3.assets', fps: 10, loop: true },
    { clipName: 'vine_slide', unityClip: 'SlindingVine', texName: 'Mombo_sliding tyrolean', preferFile: 'sharedassets3.assets', fps: 12, loop: true },
    { clipName: 'ground_dash', unityClip: 'StompRolling', texName: 'Mombo_ALT_stomp', preferFile: 'sharedassets3.assets', fps: 18, loop: true },
    { clipName: 'ground_stomp', unityClip: 'StompRolling', texName: 'Mombo_ALT_stomp', preferFile: 'sharedassets3.assets', fps: 18, loop: true },
    { clipName: 'wall_dash', unityClip: 'StompRolling', texName: 'Mombo_ALT_stomp', preferFile: 'sharedassets3.assets', fps: 18, loop: true },
    { clipName: 'air_stomp', unityClip: 'StompRolling', texName: 'Mombo_ALT_stomp', preferFile: 'sharedassets3.assets', fps: 18, loop: true },
    { clipName: 'hurt', unityClip: 'TakingDamage', texName: 'Mombo_damage', preferFile: 'sharedassets3.assets', fps: 12, loop: false },
    { clipName: 'dead', unityClip: 'Death', texName: 'Mombo_Dying', preferFile: 'sharedassets3.assets', fps: 12, loop: false },
  ],
  krunk_fire: [
    { clipName: 'idle', unityClip: 'FireIdle', texName: 'FIRE_Mombo_idle', fps: 10, loop: true },
    { clipName: 'run', unityClip: 'FireWalking', texName: 'FIRE_Mombo_walking', fps: 12, loop: true },
    { clipName: 'jump', unityClip: 'FireJumping', texName: 'FIRE_Mombo_jumping', fps: 14, loop: false },
    { clipName: 'fall', texName: 'FIRE_Mombo_jumping', spriteRange: [10, 17], fps: 12, loop: true },
    { clipName: 'flip', unityClip: 'JumpFlipping', texName: 'FIRE_Mombo_ALT_jumping', fps: 16, loop: true },
    { clipName: 'wall_slide', unityClip: 'FireWallSliding', texName: 'FIRE_Mombo_wall sliding', fps: 10, loop: true },
    { clipName: 'vine_slide', unityClip: 'SlidingVine', texName: 'FIRE_Mombo_sliding tyrolean', fps: 12, loop: true },
    { clipName: 'ground_dash', unityClip: 'FireStompRolling', texName: 'FIRE_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'ground_stomp', unityClip: 'FireStompRolling', texName: 'FIRE_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'wall_dash', unityClip: 'FireStompRolling', texName: 'FIRE_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'air_stomp', unityClip: 'FireStomp', texName: 'FIRE_Mombo_stomp', fps: 16, loop: true },
    { clipName: 'fire_dash', unityClip: 'FireBall', texName: 'FIRE_Mombo_fireball', fps: 18, loop: true },
    { clipName: 'hurt', unityClip: 'FireTakingDamage', texName: 'FIRE_Mombo_damage', fps: 12, loop: false },
    { clipName: 'dead', unityClip: 'FireMomboDeath', texName: 'FIRE_Mombo_Dying', fps: 12, loop: false },
  ],
  krunk_leaf: [
    { clipName: 'idle', unityClip: 'Iddle', texName: 'LEAF_Mombo_idle', fps: 10, loop: true },
    { clipName: 'run', unityClip: 'Walking', texName: 'LEAF_Mombo_walking', fps: 12, loop: true },
    { clipName: 'jump', texName: 'LEAF_Mombo_jumping', spriteRange: [0, 10], fps: 14, loop: false },
    { clipName: 'fall', unityClip: 'JumpFalling', texName: 'LEAF_Mombo_jumping', fps: 12, loop: true },
    { clipName: 'flip', unityClip: 'JumpFlipping', texName: 'LEAF_Mombo_ALT_jumping', fps: 16, loop: true },
    { clipName: 'wall_slide', unityClip: 'Sliding', texName: 'LEAF_Mombo_wall sliding', fps: 10, loop: true },
    { clipName: 'vine_slide', unityClip: 'SlidingVine', texName: 'LEAF_Mombo_sliding tyrolean_FINAL', fps: 12, loop: true },
    { clipName: 'ground_dash', unityClip: 'StompRolling', texName: 'LEAF_Mombo_stomp', fps: 18, loop: true },
    { clipName: 'ground_stomp', unityClip: 'StompRolling', texName: 'LEAF_Mombo_stomp', fps: 18, loop: true },
    { clipName: 'wall_dash', unityClip: 'StompRolling', texName: 'LEAF_Mombo_stomp', fps: 18, loop: true },
    { clipName: 'air_stomp', unityClip: 'StompRolling', texName: 'LEAF_Mombo_stomp', fps: 18, loop: true },
    { clipName: 'leaf_glide', unityClip: 'Gliding', texName: 'LEAF_Mombo_gliding', fps: 12, loop: true },
    { clipName: 'hurt', unityClip: 'TakingDamage', texName: 'LEAF_Mombo_damage', fps: 12, loop: false },
    { clipName: 'dead', unityClip: 'LeafMomboDeath', texName: 'LEAF_Mombo_Dying', fps: 12, loop: false },
  ],
  krunk_rock: [
    { clipName: 'idle', unityClip: 'Iddle', texName: 'ROCK_Mombo_idle', fps: 10, loop: true },
    { clipName: 'run', unityClip: 'Walking', texName: 'ROCK_Mombo_Walking', fps: 14, loop: true },
    { clipName: 'jump', texName: 'ROCK_Mombo_jumping', spriteRange: [0, 6], fps: 14, loop: false },
    { clipName: 'fall', unityClip: 'JumpFalling', texName: 'ROCK_Mombo_jumping', fps: 12, loop: true },
    { clipName: 'flip', unityClip: 'JumpFlipping', texName: 'ROCK_Mombo_ALT_jumping', fps: 16, loop: true },
    { clipName: 'wall_slide', unityClip: 'Sliding', texName: 'ROCK_Mombo_wall sliding', fps: 10, loop: true },
    { clipName: 'vine_slide', unityClip: 'SlidingVine', texName: 'ROCK_Mombo_sliding tyrolean', fps: 12, loop: true },
    { clipName: 'ground_dash', unityClip: 'StompRolling', texName: 'ROCK_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'ground_stomp', unityClip: 'StompRolling', texName: 'ROCK_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'wall_dash', unityClip: 'StompRolling', texName: 'ROCK_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'air_stomp', unityClip: 'StompRolling', texName: 'ROCK_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'rock_uppercut', unityClips: ['Upercut', 'UpercutLoop'], texName: 'ROCK_Mombo_Shoryuken', fps: 16, loop: true },
    { clipName: 'hurt', unityClip: 'TakingDamage', texName: 'ROCK_Mombo_damage', fps: 12, loop: false },
    { clipName: 'dead', unityClip: 'RockMomboDeath', texName: 'ROCK_Mombo_Dying', fps: 12, loop: false },
  ],
  krunk_electric: [
    { clipName: 'idle', unityClip: 'Iddle', texName: 'ELECTRIC_Mombo_idle', fps: 10, loop: true },
    { clipName: 'run', unityClip: 'Walking', texName: 'ELECTRIC_Mombo_walking', fps: 12, loop: true },
    { clipName: 'jump', texName: 'ELECTRIC_Mombo_jumping', spriteRange: [0, 9], fps: 14, loop: false },
    { clipName: 'fall', unityClip: 'JumpFalling', texName: 'ELECTRIC_Mombo_jumping', fps: 12, loop: true },
    { clipName: 'flip', unityClip: 'JumpFlipping', texName: 'ELECTRIC_Mombo_ALT_jumping', fps: 16, loop: true },
    { clipName: 'wall_slide', unityClip: 'Sliding', texName: 'ELECTRIC_Mombo_wall sliding', fps: 10, loop: true },
    { clipName: 'vine_slide', unityClip: 'SlidingVine', texName: 'ELECTRIC_Mombo_sliding tyrolean', fps: 12, loop: true },
    { clipName: 'ground_dash', unityClip: 'StompRolling', texName: 'ELECTRIC_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'ground_stomp', unityClip: 'StompRolling', texName: 'ELECTRIC_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'wall_dash', unityClip: 'StompRolling', texName: 'ELECTRIC_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'air_stomp', unityClip: 'StompRolling', texName: 'ELECTRIC_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'volt_dive', unityClip: 'EletricJump', texName: 'ELECTRIC_Mombo_Shockball', fps: 18, loop: true },
    { clipName: 'volt_blink', unityClip: 'EletricJump', texName: 'ELECTRIC_Mombo_Shockball', fps: 20, loop: true },
    { clipName: 'hurt', unityClip: 'TakingDamage', texName: 'ELECTRIC_Mombo_damage', fps: 12, loop: false },
    { clipName: 'dead', unityClip: 'EletricMomboDeath', texName: 'ELECTRIC_Mombo_Dying', fps: 12, loop: false },
  ],
  krunk_shadow: [
    { clipName: 'idle', unityClip: 'EvilIddle', texName: 'DARK_Mombo_idle', fps: 10, loop: true },
    { clipName: 'run', unityClip: 'EvilWalking', texName: 'DARK_Mombo_running', fps: 12, loop: true },
    { clipName: 'jump', unityClips: ['EvilJumping', 'EvilFloating'], texName: 'DARK_Mombo_jumping', fps: 14, loop: false },
    { clipName: 'fall', unityClip: 'EvilJumpFalling', texName: 'DARK_Mombo_jumping', fps: 12, loop: true },
    { clipName: 'flip', unityClip: 'EvilJumpFlipping', texName: 'DARK_Mombo_ALT_jumping', fps: 16, loop: true },
    { clipName: 'wall_slide', unityClip: 'EvilSliding', texName: 'DARK_Mombo_wall sliding', fps: 10, loop: true },
    { clipName: 'vine_slide', unityClip: 'EvilSlidingVine', texName: 'DARK_Mombo_sliding tyrolean', fps: 12, loop: true },
    { clipName: 'ground_dash', unityClip: 'EvilStompRolling', texName: 'DARK_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'ground_stomp', unityClip: 'EvilStompRolling', texName: 'DARK_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'wall_dash', unityClip: 'EvilStompRolling', texName: 'DARK_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'air_stomp', unityClip: 'EvilStompRolling', texName: 'DARK_Mombo_ALT_stomp', fps: 18, loop: true },
    { clipName: 'shadow_blink', unityClip: 'EvilTeleport', texName: 'DARK_Mombo_TP', fps: 20, loop: false },
    { clipName: 'hurt', unityClip: 'EvilTakingDamage', texName: 'DARK_Mombo_damage', fps: 12, loop: false },
    { clipName: 'dead', unityClip: 'EvilMomboDeath', texName: 'DARK_Mombo_Dying', fps: 12, loop: false },
  ],
};

const ENEMY_CLIP_SPECS: Readonly<Record<string, readonly ClipSelector[]>> = {
  'enemy/goomba': [
    { clipName: 'walk', unityClip: 'ProtoGround', texName: 'enemy_goomba_NEW', fps: 10, loop: true },
    { clipName: 'idle', unityClip: 'ProtoGround', texName: 'enemy_goomba_NEW', fps: 8, loop: true },
  ],
  'enemy/air_goomba': [
    { clipName: 'walk', unityClip: 'ProtoFlyer', texName: 'ENEMY_fly', fps: 12, loop: true },
    { clipName: 'idle', unityClip: 'ProtoFlyer', texName: 'ENEMY_fly', fps: 12, loop: true },
  ],
  'enemy/spitter': [
    { clipName: 'walk', unityClip: 'SpitterWalking', texName: 'ENEMY_spitter_walking', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'SpitterAttacking', texName: 'ENEMY_spitter_shooting', fps: 14, loop: false, maxFrames: 12 },
  ],
  'enemy/horned_beetle': [
    { clipName: 'walk', unityClip: 'HornedBeetleWalking', texName: 'ENEMY_horned beetle_walking', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'HornedBeetleSprint', texName: 'ENEMY_horned beetle_running', fps: 14, loop: true },
    { clipName: 'telegraph', unityClip: 'HornedBeetleStoped', texName: 'ENEMY_horned beetle_alert', fps: 12, loop: false },
  ],
  'enemy/guilhofly': [
    { clipName: 'walk', unityClip: 'GuilhoflyRunning', texName: 'enemy_guilhofly', fps: 12, loop: true },
    { clipName: 'telegraph', unityClip: 'GuilhoflyPreparing', texName: 'enemy_guilhofly pre attack', fps: 14, loop: false, maxFrames: 10 },
    { clipName: 'attack', unityClip: 'GuilhoflyAtacking', texName: 'ENEMY_guilhofly_attack_OK', fps: 14, loop: true },
  ],
  'enemy/spikeball': [
    { clipName: 'walk', unityClip: 'SpikeBallAnim', texName: 'TM_floating_thorns 2', fps: 12, loop: true },
    { clipName: 'idle', unityClip: 'SpikeBallAnim', texName: 'TM_floating_thorns 2', fps: 12, loop: true },
  ],
  'enemy/bee': [
    { clipName: 'walk', unityClip: 'EnemyBee', texName: 'ENEMY_Bee_A', fps: 14, loop: true, maxFrames: 10 },
    { clipName: 'attack', unityClip: 'EnemyBeeAtacking', texName: 'ENEMY_Bee pre_attack', fps: 14, loop: false, maxFrames: 10 },
  ],
  'enemy/frog': [
    { clipName: 'walk', unityClip: 'FrogStoped', texName: 'ENEMY_Bufrog', fps: 10, loop: true, maxFrames: 10 },
    { clipName: 'attack', unityClip: 'FrogJumping', texName: 'ENEMY_Bufrog_jumpping', fps: 12, loop: false },
  ],
  'enemy/ladybug': [
    { clipName: 'walk', unityClip: 'EnemyJoaninha', texName: 'ENEMY_Jo∆oninha', fps: 12, loop: true },
    { clipName: 'idle', unityClip: 'EnemyJoaninha', texName: 'ENEMY_Jo∆oninha', fps: 10, loop: true },
  ],
  'enemy/carnivorous_plant': [
    { clipName: 'walk', unityClip: 'PlantAnim', texName: 'ENEMY_carnivoplant', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'PlantOpened', texName: 'ENEMY_carnivoplant_UP (1)', fps: 12, loop: true },
  ],
  'enemy/mushroom_warrior': [
    { clipName: 'walk', unityClip: 'EnemyMushroomWalking', texName: 'ENEMY_Mushwarrior 1', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'EnemyMushroomAtacking', texName: 'ENEMY_Mushwarrior attacking', fps: 14, loop: false, maxFrames: 12 },
  ],
  'enemy/toxic_slug': [
    { clipName: 'walk', unityClip: 'LesmaToxicaWalking', texName: 'ENEMY_Lesma Tóxica', fps: 10, loop: true },
  ],
  'enemy/neural_spider': [
    { clipName: 'walk', unityClip: 'AranhaNeural', texName: 'ENEMY_Aranha Neural', fps: 12, loop: true },
  ],
  'enemy/salamander': [
    { clipName: 'walk', unityClip: 'SalamandraWalking', texName: 'ENEMY_Salamandra_walking', fps: 12, loop: true, maxFrames: 12 },
    { clipName: 'attack', unityClip: 'SalamandraAtacking', texName: 'ENEMY_Salamandra_attacking_NO HEAD (1)', fps: 14, loop: false, maxFrames: 12 },
  ],
  'enemy/big_jelly': [
    { clipName: 'walk', unityClip: 'EnemyBigJelly', texName: 'ENEMY_Big_geleka_NEW', fps: 10, loop: true },
  ],
  'enemy/mini_jelly': [
    { clipName: 'walk', unityClip: 'EnemyMiniGeleca', texName: 'ENEMY_Littles_gelekas', fps: 12, loop: true },
  ],
  'enemy/bombalon': [
    { clipName: 'walk', unityClip: 'BombalonWalking', texName: 'ENEMY_Bombalon_walking', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'BombalonRolling', texName: 'ENEMY_Bombalon_running_OK', fps: 14, loop: true },
  ],
  'enemy/mystic_wheel': [
    { clipName: 'walk', unityClip: 'MysticWheelIdlle', texName: 'ENEMY_MysticWheel_idle', fps: 12, loop: true, maxFrames: 10 },
    { clipName: 'attack', unityClip: 'MysticWheelAtacking', texName: 'ENEMY_MysticWheel_ATTACKING', fps: 14, loop: true, maxFrames: 10 },
  ],
  'enemy/puncher_pig': [
    { clipName: 'walk', unityClip: 'PuncherPig', texName: 'ENEMY_Puncherpig', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'PuncherPigAtacking', texName: 'ENEMY_Puncherpig_attacking', fps: 14, loop: false },
  ],
  'enemy/launcher_pig': [
    { clipName: 'walk', unityClip: 'LaucherPigWalking', texName: 'ENEMY_launcherpig_walking', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'LaucherPigAtacking', texName: 'ENEMY_launcherpig_ATTACKing', fps: 14, loop: false },
  ],
  'enemy/eagle_cannon': [
    { clipName: 'walk', unityClip: 'EagleCannonShooting', texName: 'AV_firecannons_shooting', fps: 12, loop: true, maxFrames: 12, pivotOverride: [0.5, 0.9] },
    { clipName: 'attack', unityClip: 'EagleCannonShooting', texName: 'AV_firecannons_shooting', fps: 16, loop: false, maxFrames: 12, pivotOverride: [0.5, 0.9] },
  ],
  'enemy/vulture': [
    { clipName: 'walk', unityClip: 'VultureFlying', texName: 'ENEMY_vulture_flying', fps: 12, loop: true },
    { clipName: 'attack', unityClip: 'VultureFlyingAtacking', texName: 'ENEMY_vulture_attacking', fps: 14, loop: true },
  ],
  'enemy/spike_turtle': [
    { clipName: 'walk', unityClip: 'SpikeTurtleWalking', texName: 'ENEMY_spiker_walking', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'SpikeTurtleHide', texName: 'ENEMY_spiker_spike_mode', fps: 12, loop: true },
  ],
  'enemy/fire_lizard': [
    { clipName: 'walk', unityClip: 'FireLizzardWalking', texName: 'ENEMY_fire calango_walking', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'FireLizzardAtacking', texName: 'ENEMY_fire calango_attacking', fps: 14, loop: false, maxFrames: 12 },
  ],
  'enemy/sand_worm': [
    { clipName: 'walk', unityClip: 'DesertWormIddle', texName: 'ENEMY_subverm_UPorDOWN', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'DesertWormAtacking', texName: 'ENEMY_subverm_attacking_OK', fps: 14, loop: false, maxFrames: 10 },
  ],
  'enemy/botmerang': [
    { clipName: 'walk', unityClip: 'Botmerang', texName: 'ENEMY_Botmerang', fps: 12, loop: true },
    { clipName: 'attack', unityClip: 'BotMerangAtacking', texName: 'ENEMY_Botmerang_attacking', fps: 14, loop: false, maxFrames: 12 },
  ],
  'enemy/floating_sword': [
    { clipName: 'walk', unityClip: 'Sword', texName: 'ENEMY_swordcopter_idle', fps: 12, loop: true },
    { clipName: 'attack', unityClip: 'SwordAtacking', texName: 'ENEMY_swordcopter_rotating', fps: 16, loop: true },
  ],
  'enemy/zeppelin': [
    { clipName: 'walk', unityClip: 'Zepelin', texName: 'ENEMY_crazyflyer 2', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'ZepelinAttack', texName: 'ENEMY_crazyflyer_Shooting', fps: 14, loop: false, maxFrames: 10 },
  ],
  'enemy/atom_eye': [
    { clipName: 'walk', unityClip: 'AtomEyeIddle', texName: 'ENEMY_ATOM Eye', fps: 12, loop: true },
    { clipName: 'attack', unityClip: 'AtomEyeAtackFront', texName: 'ENEMY_ATOM Eye_attacking_H', fps: 14, loop: false },
  ],
  'enemy/mummy': [
    { clipName: 'walk', unityClip: 'MummyIdle', texName: 'ENEMY_The Mummy_walking', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'MummyPreAttack', texName: 'ENEMY_The Mummy_attacking_H', fps: 12, loop: false },
  ],
  'enemy/scavenger': [
    { clipName: 'walk', unityClip: 'ScavengerIdle', texName: 'ENEMY_SCAVENGER', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'ScavengerAttack', texName: 'ENEMY_SCAVENGER_attacking', fps: 14, loop: false },
  ],
  'enemy/ghost_crow': [
    { clipName: 'walk', unityClip: 'GhostCrowIddle', texName: 'CrowGhost_Walk', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'GhostCrowIAttack', texName: 'CrowGhost_AttackLoop', fps: 14, loop: true },
  ],
  'enemy/ghost_owl': [
    { clipName: 'walk', unityClip: 'OwlIddle', texName: 'GhostOwl_Walk', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'OwlAttackCicle', texName: 'GhostOwl_Shooting_Loop', fps: 14, loop: true },
  ],
  'enemy/ghost_pig': [
    { clipName: 'walk', unityClip: 'GhostPig', texName: 'GhostPig_Walk', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'GhostPigAttack', texName: 'GhostPig_Attack_Ground', fps: 14, loop: false, maxFrames: 10 },
  ],
};

const BOSS_CLIP_SPECS: Readonly<Record<string, readonly ClipSelector[]>> = {
  'boss/dino_behemoth': [
    { clipName: 'idle', unityClip: 'PreAtack', texName: 'ENEMY_MinibossSpikesaurPreAttackLoop', fps: 10, loop: true },
    { clipName: 'jump', unityClip: 'Jump', texName: 'ENEMY_MinibossSpikesaurJumpAndLoop', fps: 12, loop: true },
    { clipName: 'attack', unityClip: 'Atacking', texName: 'ENEMY_MinibossSpikesaurAttack', fps: 14, loop: true },
    { clipName: 'telegraph', unityClip: 'PreAtack', texName: 'ENEMY_MinibossSpikesaurPreAttackLoop', fps: 14, loop: true },
  ],
  'boss/primal_eye': [
    { clipName: 'idle', unityClip: 'BossAPIddle', texName: 'AP_BOSS_moving', fps: 10, loop: true },
    { clipName: 'attack', unityClip: 'BossAPSplash', texName: 'AP_BOSS_spines_attack', fps: 12, loop: true, maxFrames: 10 },
    { clipName: 'dash', unityClip: 'BossApRotating', texName: 'AP_BOSS_pursuit_attack', fps: 14, loop: true },
    { clipName: 'stomp', unityClip: 'BossStomp', texName: 'AP_BOSS_stomp_attack', fps: 14, loop: true },
  ],
  'boss/primal_eye_iris': [
    { clipName: 'idle', texName: 'AP_BOSS_moving_EYE_iris', fps: 10, loop: true, maxFrames: 12 },
  ],
  'boss/primal_eye_spike': [
    { clipName: 'idle', unityClip: 'BossSpike', texName: 'AP_BOSS_SPYKE', fps: 12, loop: true },
  ],
  'boss/magma_boar_king': [
    { clipName: 'idle', unityClip: 'BossIddle', texName: 'AV_BOSS_idle', fps: 10, loop: true, maxFrames: 10 },
    { clipName: 'move', unityClip: 'BossRunning', texName: 'AV_BOSS_running', fps: 14, loop: true },
    { clipName: 'jump', unityClip: 'BossJumping', texName: 'AV_BOSS_jumping', fps: 12, loop: false, maxFrames: 10 },
    { clipName: 'attack', unityClip: 'BossAtacking', texName: 'AV_BOSS_attacking', fps: 14, loop: false, maxFrames: 12 },
  ],
  'boss/magma_boar_fireball': [
    { clipName: 'idle', unityClip: 'FireBallBoss', texName: 'AV_BOSS_fireattack_fireball', fps: 12, loop: true },
  ],
  'boss/bone_colossus': [
    { clipName: 'idle', unityClip: 'MBSkeletonJumpLoop', texName: 'ENEMY_Miniboss2Idle', fps: 10, loop: true },
    { clipName: 'telegraph', unityClip: 'MBSkeletonPreAtack', texName: 'ENEMY_Miniboss2IdleToAtk', fps: 12, loop: false },
    { clipName: 'attack', unityClip: 'MBSkeletonAtacking', texName: 'ENEMY_Miniboss2Attack', fps: 14, loop: true },
  ],
  'boss/mecha_bull': [
    { clipName: 'idle', unityClip: 'LabBoss_Idle', texName: 'LE_BOSS_idle', fps: 10, loop: true, maxFrames: 10 },
    { clipName: 'move', unityClip: 'LabBoss_Moving', texName: 'LE_BOSS_moving', fps: 12, loop: true, maxFrames: 12 },
    { clipName: 'telegraph', unityClip: 'LabBoss_PreDrillDash', texName: 'LE_BOSS_PRE_drill dash attack', fps: 14, loop: false, maxFrames: 10 },
    { clipName: 'dash', unityClip: 'LabBoss_DrillDash', texName: 'LE_BOSS_drill dash attack', fps: 16, loop: true, maxFrames: 10 },
    { clipName: 'attack', unityClip: 'LabBoss_GearAttacking', texName: 'LE_BOSS_shooting', fps: 14, loop: false, maxFrames: 10 },
    { clipName: 'stunned', unityClip: 'LabBoss_Stunned', texName: 'LE_BOSS_stucked', fps: 12, loop: true, maxFrames: 10 },
  ],
  'boss/mecha_bull_gear': [
    { clipName: 'idle', unityClip: 'LabBossGear1', texName: 'LE_BOSS_gears_1', fps: 14, loop: true },
  ],
  'boss/electro_sphinx': [
    { clipName: 'idle', unityClip: 'BossFace', texName: 'TA_BOSS_Face', fps: 10, loop: true, maxFrames: 10 },
    { clipName: 'attack', unityClip: 'BossFace', texName: 'TA_BOSS_Face', fps: 14, loop: true, maxFrames: 10 },
  ],
  'boss/electro_sphinx_head': [
    { clipName: 'idle', unityClip: 'GemAttack', texName: 'TA_BOSS_Head_AntecipationShot', fps: 12, loop: true },
  ],
  'boss/electro_sphinx_laser': [
    { clipName: 'idle', texName: 'TA_BOSS_Laser', fps: 16, loop: true },
  ],
  'boss/electro_sphinx_shield': [
    { clipName: 'idle', unityClip: 'GemEnergizedLoop', texName: 'TA_BOSS_ShieldLoop', fps: 14, loop: true },
  ],
  'boss/shadow_doppelganger': [
    { clipName: 'idle', unityClip: 'Iddle', texName: 'Nightmare King_Mombo_Idle', preferFile: 'sharedassets3.assets', fps: 10, loop: true, maxFrames: 10 },
    { clipName: 'move', unityClip: 'Walking', texName: 'Nightmare King_Mombo_Run', preferFile: 'sharedassets3.assets', fps: 14, loop: true, maxFrames: 10 },
    { clipName: 'jump', unityClip: 'Jumping', texName: 'Nightmare King_Mombo_Jump', preferFile: 'sharedassets3.assets', fps: 12, loop: false },
    { clipName: 'dash', unityClips: ['DashStart', 'DashLoop'], texName: 'Nightmare King_Mombo_Dash', preferFile: 'sharedassets3.assets', fps: 16, loop: true },
    { clipName: 'stomp', unityClip: 'StompRolling', texName: 'Nightmare King_Mombo_Stomp_FINAL', preferFile: 'sharedassets3.assets', fps: 16, loop: true },
    { clipName: 'attack', unityClip: 'Shoot', texName: 'Nightmare King_Mombo_DARKBALL ATTACK', preferFile: 'sharedassets3.assets', fps: 14, loop: false, maxFrames: 10 },
  ],
  'boss/nightmare_sovereign': [
    { clipName: 'idle', unityClip: 'NightmareKingBossFloating', texName: 'Nightmare King_floating idle', fps: 12, loop: true, maxFrames: 12 },
    { clipName: 'dash', unityClips: ['NightmareKingBossPreDashing', 'NightmareKingBossDashing'], texName: 'Nightmare King_DASH ATACK', fps: 16, loop: true },
    { clipName: 'attack', unityClip: 'NightmareKingBossShootSequence', texName: 'Nightmare King_DARKBALL ATTACK_A', fps: 14, loop: false, maxFrames: 12 },
    { clipName: 'telegraph', unityClip: 'NightmareTeleporting', texName: 'Nightmare King_TP_FINAL', fps: 14, loop: false, maxFrames: 10 },
  ],
  'boss/nightmare_orb': [
    { clipName: 'big', unityClip: 'NightmareKingMissile', texName: 'Nightmare King_darkball_BIG', fps: 14, loop: true, maxFrames: 10 },
    { clipName: 'idle', unityClip: 'NightmareKingBullet', texName: 'Nightmare King_darkball_MED', fps: 14, loop: true },
  ],
};

const NPC_CLIP_SPECS: Readonly<Record<string, readonly ClipSelector[]>> = {
  'npc/vespera': [{ clipName: 'idle', unityClip: 'Ursula', texName: 'GUARDIAN_Ursula', fps: 10, loop: true, maxFrames: 12, pivotOverride: [0.5, 1] }],
  'npc/orla': [{ clipName: 'idle', unityClip: 'NpcTome', texName: 'GUARDIAN_TomÇ', fps: 10, loop: true, pivotOverride: [0.5, 1] }],
  'npc/barnaby': [{ clipName: 'idle', unityClip: 'AdamastorIddle', texName: 'GUARDIAN_Adamastor', fps: 10, loop: true, maxFrames: 12, pivotOverride: [0.5, 1] }],
  'npc/garron': [{ clipName: 'idle', unityClip: 'Virgulino', texName: 'GUARDIAN_Virgulino (1)', fps: 10, loop: true, maxFrames: 12, pivotOverride: [0.5, 1] }],
  'npc/barnacle': [{ clipName: 'idle', unityClip: 'BarbaVelha', texName: 'GUARDIAN_BarbaVelha', fps: 10, loop: true, maxFrames: 12, pivotOverride: [0.5, 1] }],
  'npc/codex': [{ clipName: 'idle', unityClip: 'Filomena', texName: 'GUARDIAN_Filomena', fps: 10, loop: true, maxFrames: 12, pivotOverride: [0.5, 1] }],
};

const FX_CLIP_SPECS: Readonly<Record<string, readonly ClipSelector[]>> = {
  'fx/stomp_ring': [{ clipName: 'idle', unityClip: 'DashImpact', texName: 'FX_stomp_FINAL', fps: 20, loop: false }],
  'fx/stomp_hit': [{ clipName: 'idle', unityClip: 'EnemyHitFx', texName: 'FX_stomp_hit', fps: 20, loop: false }],
  'fx/wall_stomp': [{ clipName: 'idle', unityClip: 'WallStomp', texName: 'FX_wall stomp', fps: 20, loop: false }],
  'fx/stomp_jump': [{ clipName: 'idle', texName: 'FX_stomp jump', fps: 18, loop: false }],
  'fx/fire_blast': [
    { clipName: 'idle', unityClip: 'StompExplosion', texName: 'FireMombo_StompAttackFX', fps: 20, loop: false },
    { clipName: 'trail', unityClip: 'FireBallExtra', texName: 'FIRE_Mombo_fireballextra', fps: 16, loop: true },
  ],
  'fx/volt_arc': [
    { clipName: 'idle', unityClip: 'EletricShield', texName: 'ChoqueLoopSheet', fps: 18, loop: true, maxFrames: 12 },
    { clipName: 'enter', unityClip: 'EletricShieldEnter', texName: 'ChoqueEntradsSheet', fps: 18, loop: false },
  ],
  'fx/particles': [{ clipName: 'idle', unityClip: 'CrystalShine', texName: 'FX_catching crystals', fps: 16, loop: false }],
  'fx/hit_spark': [
    { clipName: 'idle', texName: 'FX_enemy HIT 1', fps: 20, loop: false },
    { clipName: 'alt', texName: 'FX_enemy HIT 2', fps: 20, loop: false },
  ],
  'fx/jump_dust': [
    { clipName: 'idle', texName: 'FX_JUMPING', fps: 18, loop: false },
    { clipName: 'double', texName: 'FX_double jump', fps: 18, loop: false },
    { clipName: 'wall', unityClip: 'WallJump', texName: 'FX_wall_JUMPING', fps: 18, loop: false },
  ],
  'fx/land_dust': [
    { clipName: 'idle', texName: 'FX_landing', fps: 18, loop: false },
    { clipName: 'walk', unityClip: 'WalkFx', texName: 'FX_walkING_FINAL', fps: 16, loop: false },
  ],
  'fx/rock_shield': [{ clipName: 'idle', unityClip: 'RockShieldLoop', texName: 'ROCK_Mombo_ShieldFront', fps: 14, loop: true }],
  'fx/magic_shield': [{ clipName: 'idle', unityClip: 'MagicShield', texName: 'momboShield-Sheet', fps: 14, loop: true }],
  'fx/electric_aim': [{ clipName: 'idle', unityClip: 'EletricDirectionLoop', texName: 'ElectricDirection', fps: 14, loop: true }],
  'fx/evil_stomp': [{ clipName: 'idle', unityClip: 'New_Evil_StompExplosion', texName: 'Nightmare King_Mombo_Stomp_FX', fps: 20, loop: false }],
};

interface ParallaxSpec {
  readonly texName: string;
  readonly meta: ParallaxLayerMeta;
}

const BIOME_PARALLAX_SPECS: Readonly<Record<string, ParallaxSpec>> = {
  'bg/MLAIR': { texName: 'ML_background sky_NEW', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/MLAIR_far': { texName: 'ML_decoration_cloud 1', meta: { scrollX: 0.08, scrollY: 0.02, anchorY: 'top', offsetY: 16, tileX: true } },
  'bg/MLAIR_mid': { texName: 'ML_background trees_FINAL', meta: { scrollX: 0.2, scrollY: 0.05, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/MLAIR_near': { texName: 'ML_BUSH_1', meta: { scrollX: 0.4, scrollY: 0.08, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/OPOUSO': { texName: 'OP_back sky', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/OPOUSO_far': { texName: 'OP_back deco_clouds', meta: { scrollX: 0.07, scrollY: 0.02, anchorY: 'top', offsetY: 18, tileX: true } },
  'bg/OPOUSO_mid': { texName: 'OP_back lake', meta: { scrollX: 0.18, scrollY: 0.04, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/OPOUSO_near': { texName: 'OP_back_deco_stonearc', meta: { scrollX: 0.36, scrollY: 0.07, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/TDM': { texName: 'TM_BACK', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/TDM_far': { texName: 'TM_cloud_A', meta: { scrollX: 0.08, scrollY: 0.02, anchorY: 'top', offsetY: 10, tileX: true } },
  'bg/TDM_mid': { texName: 'TM_cloud_B', meta: { scrollX: 0.18, scrollY: 0.04, anchorY: 'top', offsetY: 56, tileX: true } },
  'bg/TDM_near': { texName: 'TrilhaBGObjectsUp', meta: { scrollX: 0.38, scrollY: 0.08, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/FLIN': { texName: 'FI_background sky', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/FLIN_far': { texName: 'FI_deco_trees1', meta: { scrollX: 0.1, scrollY: 0.03, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/FLIN_mid': { texName: 'FI_background_trees front2', meta: { scrollX: 0.24, scrollY: 0.05, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/FLIN_near': { texName: 'FlorestItensBG', meta: { scrollX: 0.42, scrollY: 0.08, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/AP': { texName: 'AP_background sky', meta: { scrollX: 0, scrollY: 0, anchorY: 'center', tileX: true, fillViewport: true } },
  'bg/AP_far': { texName: 'AP_back deco_ext branch', meta: { scrollX: 0.1, scrollY: 0.03, anchorY: 'top', offsetY: 20, tileX: true } },
  'bg/AP_mid': { texName: 'AP_back deco_shine bush', meta: { scrollX: 0.22, scrollY: 0.05, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/AP_near': { texName: 'AP_back deco_capilars', meta: { scrollX: 0.38, scrollY: 0.08, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/ATVC': { texName: 'AV_background', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/ATVC_far': { texName: 'AV_back 2', meta: { scrollX: 0.1, scrollY: 0.03, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/ATVC_mid': { texName: 'AV_back_lava', meta: { scrollX: 0.22, scrollY: 0.05, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/ATVC_near': { texName: 'AV_background_deco_pillar_1 (1)', meta: { scrollX: 0.4, scrollY: 0.08, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/DSI': { texName: 'DI_backround2', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/DSI_far': { texName: 'DI_background_SUN', meta: { scrollX: 0.06, scrollY: 0.02, anchorY: 'top', offsetY: 16, tileX: false } },
  'bg/DSI_mid': { texName: 'DI_backround_sands', meta: { scrollX: 0.22, scrollY: 0.05, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/DSI_near': { texName: 'BGDesertSheet', meta: { scrollX: 0.4, scrollY: 0.08, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/LAB': { texName: 'LE_backround1', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/LAB_far': { texName: 'LE_backround2', meta: { scrollX: 0.1, scrollY: 0.03, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/LAB_mid': { texName: 'LE_backround3', meta: { scrollX: 0.24, scrollY: 0.05, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/LAB_near': { texName: 'Lab_Machine01_BG', meta: { scrollX: 0.4, scrollY: 0.08, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/TEMP': { texName: 'TA_back_sky', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/TEMP_far': { texName: 'TA_back_cloud1', meta: { scrollX: 0.08, scrollY: 0.02, anchorY: 'top', offsetY: 12, tileX: true } },
  'bg/TEMP_mid': { texName: 'TA_back_cloud2', meta: { scrollX: 0.18, scrollY: 0.04, anchorY: 'center', offsetY: 16, tileX: true } },
  'bg/TEMP_near': { texName: 'TA_back_cloud3', meta: { scrollX: 0.34, scrollY: 0.07, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/EVIL': { texName: 'RP_background sky_NEW', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/EVIL_far': { texName: 'RP_background_back_deco_clouds', meta: { scrollX: 0.09, scrollY: 0.02, anchorY: 'top', offsetY: 10, tileX: true } },
  'bg/EVIL_mid': { texName: 'RP_background_back_deco_burning forest', meta: { scrollX: 0.22, scrollY: 0.05, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/EVIL_near': { texName: 'RP_background_back_deco_clouds_2', meta: { scrollX: 0.38, scrollY: 0.08, anchorY: 'bottom', offsetY: 0, tileX: true } },

  'bg/GSHIP': { texName: 'ARENA_BACK_sky', meta: { scrollX: 0, scrollY: 0, anchorY: 'top', tileX: true, fillViewport: true } },
  'bg/GSHIP_far': { texName: 'ARENA_BACK_SUBROSA', meta: { scrollX: 0.08, scrollY: 0.02, anchorY: 'bottom', offsetY: -40, tileX: true } },
  'bg/GSHIP_mid': { texName: 'ARENA_BACK_SEA', meta: { scrollX: 0.2, scrollY: 0.04, anchorY: 'bottom', offsetY: 0, tileX: true } },
  'bg/GSHIP_near': { texName: 'ARENA_BACK_NEARclouds', meta: { scrollX: 0.36, scrollY: 0.06, anchorY: 'top', offsetY: 8, tileX: true } },
};

const BIOME_DECO_TEX: Readonly<Record<BiomeId, string>> = {
  MLAIR: 'ML_GRASS',
  OPOUSO: 'OP_back_deco_stones',
  TDM: 'TrailBush01-Sheet',
  FLIN: 'FLIN_Grass01_02',
  AP: 'AP_Grass',
  ATVC: 'AV_VasesBG',
  DSI: 'Deco_Cactus01',
  LAB: 'Lab_Lamp_BG',
  TEMP: 'TA_little pyramid',
  EVIL: 'RP_deco_grass',
  GSHIP: 'ARENA_TRIDENTS',
};

// ============================================================================
// Special Tiles, World Props, and HUD/UI Builders
// ============================================================================

function extractSpecialTileOrProp(db: UnityAssetDatabase, key: string): PackedAtlasResult | null {
  switch (key) {
    case 'tile/special_tiles':
    case 'tile/spike': {
      // Extract clean unpadded 32x32 4-direction spikes (up, right, down, left) from STE Spikes (220x220, off=2, pad=4)
      const ts = db.tilesetsByName.get('Spikes');
      if (!ts) return null;
      const coords = [
        [2, 3], // up
        [3, 4], // right
        [2, 5], // down
        [3, 3], // left
      ] as const;
      const items: Array<{ img: RgbaImage; pivotX: number; pivotY: number; clipName: string }> = [];
      const names = ['up', 'right', 'down', 'left'] as const;
      for (let i = 0; i < 4; i += 1) {
        const [col, row] = coords[i]!;
        const img = getSteTileCrop(db, ts, row * ts.widthTiles + col);
        if (img) items.push({ img, pivotX: 0.5, pivotY: 1, clipName: names[i]! });
      }
      if (items.length === 0) return null;
      return packImageFrames(items, 1, false);
    }

    case 'tile/oneway': {
      const tex = db.findTexture('TM_bridge_tile_NEW FINAL');
      if (!tex) return null;
      const sprites = db.getSortedSpritesForTex(tex.ref).slice(0, 3);
      if (sprites.length === 0) return null;
      const items = sprites
        .map((sp) => db.cropSprite(sp))
        .filter((img): img is RgbaImage => img !== null)
        .map((img) => ({ img: cropImage(img, 0, 0, Math.min(32, img.width), Math.min(32, img.height)), pivotX: 0, pivotY: 0 }));
      return items.length > 0 ? packImageFrames(items, 1, false) : null;
    }

    case 'tile/breakable': {
      const tex = db.findTexture('NEW_breakable block (2)');
      if (!tex) return null;
      const img = db.decodeTextureByRef(tex.ref);
      return img ? packImageFrames([{ img: cropImage(img, 0, 0, 32, 32), pivotX: 0, pivotY: 0 }], 1, false) : null;
    }

    case 'tile/stone_overhead': {
      const tex = db.findTexture('TM_stone');
      if (!tex) return null;
      const sprites = db.getSortedSpritesForTex(tex.ref).slice(0, 4);
      const items = sprites
        .map((sp) => db.cropSprite(sp))
        .filter((img): img is RgbaImage => img !== null)
        .map((img) => ({ img, pivotX: 0, pivotY: 0 }));
      return items.length > 0 ? packImageFrames(items, 8, true) : null;
    }

    case 'tile/bounce': {
      return extractPackedClips(db, [
        { clipName: 'idle', unityClip: 'JumpBerry', texName: 'FI_jumpberry', fps: 10, loop: true, maxFrames: 8 },
        { clipName: 'bounce', unityClip: 'JumpBerryJumping', texName: 'FI_jumpberry_bouncing', fps: 16, loop: false, maxFrames: 8 },
      ]);
    }

    case 'tile/vine': {
      const tex = db.findTexture('FI_tylorean_1');
      if (!tex) return null;
      const img = db.decodeTextureByRef(tex.ref);
      if (!img) return null;
      const items = [0, 32, 64]
        .filter((x) => x + 32 <= img.width)
        .map((x) => ({ img: cropImage(img, x, 0, 32, 32), pivotX: 0, pivotY: 0 }));
      return items.length > 0 ? packImageFrames(items, 4, true) : null;
    }

    case 'tile/acid': {
      return extractPackedClips(db, [
        { clipName: 'idle', unityClip: 'AcidAnim', texName: 'FI_mudflat', fps: 10, loop: true, maxFrames: 8, pivotOverride: [0, 0] },
      ]);
    }

    case 'tile/lava': {
      const clip = db.findClip('Lava', 'AV_lava tile');
      if (!clip) return null;
      const picked = subsampleIndices(clip.sprites.length, 8);
      const items = picked
        .map((i) => db.cropSprite(clip.sprites[i]!))
        .filter((img): img is RgbaImage => img !== null)
        .map((img) => ({ img: cropImage(img, 0, 0, 32, 32), pivotX: 0, pivotY: 0 }));
      return items.length > 0 ? packImageFrames(items, 10, true) : null;
    }

    case 'tile/quicksand': {
      return extractPackedClips(db, [
        { clipName: 'idle', unityClip: 'QuickSand', texName: 'DI_quicksand', fps: 10, loop: true, maxFrames: 8, pivotOverride: [0, 0] },
      ]);
    }

    case 'tile/crumble': {
      const tex = db.findTexture('DI_sandtile_dismantling');
      if (!tex) return null;
      const sprites = db.getSortedSpritesForTex(tex.ref);
      const picked = subsampleIndices(sprites.length, 6);
      const items = picked
        .map((i) => db.cropSprite(sprites[i]!))
        .filter((img): img is RgbaImage => img !== null)
        .map((img) => ({ img: scaleNearestFit(img, 32, 32), pivotX: 0, pivotY: 0 }));
      return items.length > 0 ? packImageFrames(items, 12, false) : null;
    }

    case 'tile/explosive': {
      return extractPackedClips(db, [
        { clipName: 'idle', texName: 'AV_BOOMblock', fps: 1, loop: true, pivotOverride: [0, 0] },
        { clipName: 'countdown', unityClip: 'ExplosiveBoxCounting', texName: 'AV_BOOMblock_reg count', fps: 12, loop: true, maxFrames: 8, pivotOverride: [0, 0] },
      ]);
    }

    case 'tile/antigrav': {
      const tex = db.findTexture('TA_antigravity_block');
      const fxTex = db.findTexture('TA_antigravity_block_FX 1');
      const items: Array<{ img: RgbaImage; pivotX: number; pivotY: number }> = [];
      if (tex) {
        const img = db.decodeTextureByRef(tex.ref);
        if (img) items.push({ img: cropImage(img, 0, 0, 32, 32), pivotX: 0, pivotY: 0 });
      }
      if (fxTex) {
        const fx = db.decodeTextureByRef(fxTex.ref);
        if (fx) {
          for (let i = 0; i < 4; i += 1) {
            if (i * 33 + 32 <= fx.width) {
              items.push({ img: cropImage(fx, i * 33, 0, 32, 32), pivotX: 0, pivotY: 0 });
            }
          }
        }
      }
      return items.length > 0 ? packImageFrames(items, 10, true) : null;
    }

    case 'tile/wind_up':
    case 'tile/wind_left':
    case 'tile/wind_right': {
      const tex = db.findTexture('Wind_Tile_NEW') ?? db.findTexture('FI_wind_tileset');
      if (!tex) return null;
      const img = db.decodeTextureByRef(tex.ref);
      if (!img) return null;
      const step = tex.name === 'FI_wind_tileset' ? 33 : 32;
      const frames: RgbaImage[] = [];
      for (let i = 0; i < 4; i += 1) {
        if (i * step + 32 <= img.width) {
          let cell = cropImage(img, i * step, 0, 32, 32);
          if (key === 'tile/wind_right') cell = rotate90CW(cell);
          else if (key === 'tile/wind_left') cell = rotate90CCW(cell);
          frames.push(cell);
        }
      }
      return frames.length > 0
        ? packImageFrames(frames.map((f) => ({ img: f, pivotX: 0, pivotY: 0 })), 12, true)
        : null;
    }

    case 'tile/chest': {
      return extractPackedClips(db, [
        { clipName: 'closed', unityClip: 'GroundChest', texName: 'CHEST', fps: 10, loop: true, maxFrames: 8, pivotOverride: [0.5, 1] },
        { clipName: 'open', texName: 'CHEST_open', spriteRange: [1, 1], fps: 8, loop: false, pivotOverride: [0.5, 1] },
      ]);
    }

    case 'tile/teleporter': {
      return extractPackedClips(db, [
        { clipName: 'idle', unityClip: 'ClearTeleport', texName: 'TELeport_OK!l', fps: 10, loop: true, maxFrames: 8, pivotOverride: [0.5, 1] },
        { clipName: 'locked', unityClip: 'CorruptedTeleport', texName: 'TELeport_Evil', fps: 8, loop: true, pivotOverride: [0.5, 1] },
      ]);
    }

    case 'tile/volt_node': {
      return extractPackedClips(db, [
        { clipName: 'idle', unityClip: 'EletricTarget', texName: 'MagnetElectricPoint', fps: 12, loop: true, pivotOverride: [0.5, 0.5] },
      ]);
    }

    case 'tile/form_totem':
      return extractPackedClips(db, [{ clipName: 'idle', unityClip: 'MomboTotemBasic_Loop', texName: 'TotemBase', fps: 10, loop: true, pivotOverride: [0.5, 1] }]);
    case 'tile/form_totem_fire':
      return extractPackedClips(db, [{ clipName: 'idle', unityClip: 'MomboTotemFire_Loop', texName: 'TotemFire', fps: 10, loop: true, pivotOverride: [0.5, 1] }]);
    case 'tile/form_totem_leaf':
      return extractPackedClips(db, [{ clipName: 'idle', unityClip: 'MomboTotemLeaf_Loop', texName: 'TotemLeaf', fps: 10, loop: true, pivotOverride: [0.5, 1] }]);
    case 'tile/form_totem_rock':
      return extractPackedClips(db, [{ clipName: 'idle', unityClip: 'MomboTotemRock_Loop', texName: 'TotemRock', fps: 10, loop: true, pivotOverride: [0.5, 1] }]);
    case 'tile/form_totem_electric':
      return extractPackedClips(db, [{ clipName: 'idle', unityClip: 'MomboTotemEletric_Loop', texName: 'TotemElectric', fps: 10, loop: true, pivotOverride: [0.5, 1] }]);

    case 'tile/save_shrine':
      return extractPackedClips(db, [
        { clipName: 'idle', unityClip: 'RecoverShrine', texName: 'LifeRecover-Sheet', fps: 10, loop: true, pivotOverride: [0.5, 1] },
      ]);

    case 'tile/signpost':
      return extractPackedClips(db, [{ clipName: 'idle', texName: 'placa', fps: 1, loop: false, pivotOverride: [0.5, 1] }]);

    case 'tile/animal_house':
      return extractPackedClips(db, [{ clipName: 'idle', texName: 'SUBROSIAN_home_1', fps: 1, loop: false, pivotOverride: [0.5, 1] }]);

    case 'tile/target_switch':
      return extractPackedClips(db, [
        { clipName: 'idle', texName: 'floorButton', spriteRange: [0, 0], fps: 1, loop: false, pivotOverride: [0.5, 1] },
        { clipName: 'active', texName: 'floorButton', spriteRange: [1, 1], fps: 1, loop: false, pivotOverride: [0.5, 1] },
      ]);

    case 'tile/door_locked':
      return extractPackedClips(db, [{ clipName: 'idle', texName: 'PassageGlowRedSheet', fps: 6, loop: true, pivotOverride: [0.5, 1] }]);

    case 'tile/coin_door': {
      const tex = db.findTexture('COIN DOOR_1');
      if (!tex) return null;
      const img = db.decodeTextureByRef(tex.ref);
      return img ? packImageFrames([{ img, pivotX: 0.5, pivotY: 1 }], 1, false) : null;
    }

    case 'tile/moving_platform': {
      const tex = db.findTexture('TA_Plats 1') ?? db.findTexture('AV_lava_platform');
      if (!tex) return null;
      const img = db.decodeTextureByRef(tex.ref);
      return img ? packImageFrames([{ img, pivotX: 0, pivotY: 0 }], 1, false) : null;
    }

    case 'tile/crusher': {
      const tex = db.findTexture('LE_pistons_tileset');
      if (!tex) return null;
      const img = db.decodeTextureByRef(tex.ref);
      return img ? packImageFrames([{ img: cropImage(img, 0, 0, 32, 32), pivotX: 0, pivotY: 0 }], 1, false) : null;
    }

    default:
      return null;
  }
}

function extractUiAsset(db: UnityAssetDatabase, key: string): PackedAtlasResult | null {
  switch (key) {
    case 'ui/heart': {
      const items: Array<{ img: RgbaImage; pivotX: number; pivotY: number; clipName: string }> = [];
      const lifeTex = db.findTexture('Hud_LifeBar 1');
      if (lifeTex) {
        const img = db.decodeTextureByRef(lifeTex.ref);
        if (img) items.push({ img, pivotX: 0.5, pivotY: 0.5, clipName: 'full' });
      }
      const heartClip = db.findClip('BallonHpUp', 'HeartItem-Sheet');
      if (heartClip) {
        for (const i of subsampleIndices(heartClip.sprites.length, 8)) {
          const img = db.cropSprite(heartClip.sprites[i]!);
          if (img) items.push({ img, pivotX: 0.5, pivotY: 0.5, clipName: 'pickup' });
        }
      }
      return items.length > 0 ? packImageFrames(items, 10, true) : null;
    }

    case 'ui/combo_wheel':
      return extractPackedClips(db, [
        { clipName: 'idle', unityClip: 'ComboBarRecoverLife', texName: 'ComboBarAnimation 1', fps: 12, loop: true },
      ]);

    case 'ui/combo_bar': {
      const tex = db.findTexture('ComboBarFull');
      if (!tex) return null;
      const img = db.decodeTextureByRef(tex.ref);
      if (!img) return null;
      const sprites = db.getSortedSpritesForTex(tex.ref);
      if (sprites.length === 0) return packImageFrames([{ img, pivotX: 0, pivotY: 0 }], 1, false);
      const frames: SpriteFrameRect[] = sprites.map((s) => ({
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        pivotX: s.pivotX,
        pivotY: s.pivotY,
      }));
      const clips: Record<string, SpriteAnimClip> = {
        idle: { frames: [0], fps: 1, loop: false },
      };
      sprites.forEach((_s, idx) => {
        clips[`part_${idx}`] = { frames: [idx], fps: 1, loop: false };
      });
      return { image: img, frames, clips };
    }

    case 'ui/combo_badge':
      return extractPackedClips(db, [{ clipName: 'idle', texName: 'MomboComboBadge', fps: 1, loop: false, pivotOverride: [0.5, 0.5] }]);

    case 'ui/crystal':
      return extractPackedClips(db, [{ clipName: 'idle', unityClip: 'CollectableCrystal', texName: 'crystals3_2', fps: 12, loop: true }]);

    case 'ui/coin':
      return extractPackedClips(db, [
        { clipName: 'idle', unityClip: 'ComboMedal', texName: 'combo medal', fps: 14, loop: true, maxFrames: 12 },
        { clipName: 'static', texName: 'GoldenCoin', fps: 1, loop: false, pivotOverride: [0.5, 0.5] },
      ]);

    case 'ui/shield_icon': {
      const tex = db.findTexture('SpecialHearts');
      if (!tex) return null;
      const sprites = db.getSortedSpritesForTex(tex.ref);
      // SpecialHearts_0 = full rock shield heart (25x19), SpecialHearts_1 = full magic/ice shield heart (25x19)
      const rock = sprites.find((s) => s.name === 'SpecialHearts_0') ?? sprites[0];
      const magic = sprites.find((s) => s.name === 'SpecialHearts_1') ?? sprites[1] ?? rock;
      const items: Array<{ img: RgbaImage; pivotX: number; pivotY: number; clipName: string }> = [];
      if (rock) {
        const img = db.cropSprite(rock);
        if (img) items.push({ img, pivotX: 0.5, pivotY: 0.5, clipName: 'rock' });
      }
      if (magic) {
        const img = db.cropSprite(magic);
        if (img) items.push({ img, pivotX: 0.5, pivotY: 0.5, clipName: 'magic' });
      }
      return items.length > 0 ? packImageFrames(items, 1, false) : null;
    }

    case 'ui/title_logo': {
      const tex = db.findTexture('Title screen_logo');
      if (!tex) return null;
      const img = db.decodeTextureByRef(tex.ref);
      if (!img) return null;
      // Fit cleanly into crisp 360x216 logo (maintaining exact aspect ratio of 1172x704!)
      const fitted = scaleNearestFit(img, 360, 216);
      return packImageFrames([{ img: fitted, pivotX: 0.5, pivotY: 0.5 }], 1, false);
    }

    case 'ui/form_icons': {
      // Build a 6-frame 192x32 strip in exact HERO_FORMS order from each form's idle frame 0!
      const items: Array<{ img: RgbaImage; pivotX: number; pivotY: number; clipName: string }> = [];
      for (const form of HERO_FORMS) {
        const idleSpec = HERO_CLIP_SPECS[form][0]!;
        const sps = resolveSelectorSprites(db, idleSpec);
        const raw = sps[0] ? db.cropSprite(sps[0]) : null;
        if (!raw) return null;
        items.push({ img: scaleNearestFit(raw, 32, 32), pivotX: 0.5, pivotY: 0.5, clipName: form });
      }
      return packImageFrames(items, 1, false);
    }

    default:
      return null;
  }
}

function extractParallaxLayer(db: UnityAssetDatabase, key: string): { image: RgbaImage; parallax: ParallaxLayerMeta } | null {
  const spec = BIOME_PARALLAX_SPECS[key];
  if (!spec) return null;
  const tex = db.findTexture(spec.texName);
  if (!tex) return null;
  const fullImg = db.decodeTextureByRef(tex.ref);
  if (!fullImg) return null;

  const sprites = db.getSortedSpritesForTex(tex.ref);
  if (sprites.length > 1) {
    // Multi-frame sheet (e.g. RP_background sky_NEW 4x 576x324, OP_back lake 12x 574x108, ARENA_BACK_SEA 6x 372x181):
    // Pick the first sprite with opaque pixels!
    for (const sp of sprites) {
      const cropped = cropImage(fullImg, sp.x, sp.y, sp.w, sp.h);
      if (hasOpaquePixels(cropped)) {
        return { image: cropped, parallax: spec.meta };
      }
    }
  } else if (sprites.length === 1) {
    const sp = sprites[0]!;
    if (sp.w < fullImg.width || sp.h < fullImg.height) {
      return { image: cropImage(fullImg, sp.x, sp.y, sp.w, sp.h), parallax: spec.meta };
    }
  }
  return { image: fullImg, parallax: spec.meta };
}

function extractElectroSphinxBoss(db: UnityAssetDatabase): PackedAtlasResult | null {
  const bodyTex = db.findTexture('TA_BOSS');
  const bodyImg = bodyTex ? db.decodeTextureByRef(bodyTex.ref) : null;
  const faceSprites = resolveSelectorSprites(db, {
    clipName: 'idle',
    unityClip: 'BossFace',
    texName: 'TA_BOSS_Face',
    fps: 10,
    loop: true,
    maxFrames: 8,
  });

  if (!bodyImg && faceSprites.length === 0) return null;

  const picked = subsampleIndices(faceSprites.length, 8);
  const compFrames: Array<{ img: RgbaImage; pivotX: number; pivotY: number }> = [];

  if (picked.length > 0 && bodyImg) {
    for (const pi of picked) {
      const sp = faceSprites[pi]!;
      const faceImg = db.cropSprite(sp);
      const composed = createImage(bodyImg.width, bodyImg.height);
      blitOpaque(composed, bodyImg, 0, 0, bodyImg.width, bodyImg.height, 0, 0);
      if (faceImg) {
        const dx = Math.floor((bodyImg.width - faceImg.width) / 2);
        const dy = Math.floor((bodyImg.height - faceImg.height) / 2);
        blitAlpha(composed, faceImg, 0, 0, faceImg.width, faceImg.height, dx, dy);
      }
      compFrames.push({ img: composed, pivotX: sp.pivotX, pivotY: sp.pivotY });
    }
  } else if (bodyImg) {
    compFrames.push({ img: bodyImg, pivotX: 0.5, pivotY: 0.5 });
  } else {
    for (const pi of picked) {
      const sp = faceSprites[pi]!;
      const faceImg = db.cropSprite(sp);
      if (faceImg) compFrames.push({ img: faceImg, pivotX: sp.pivotX, pivotY: sp.pivotY });
    }
  }

  if (compFrames.length === 0) return null;

  const cols = Math.min(4, compFrames.length);
  const rows = Math.ceil(compFrames.length / cols);
  const cellW = compFrames[0]!.img.width;
  const cellH = compFrames[0]!.img.height;
  const GUTTER = 1;
  const totalW = cols * cellW + (cols - 1) * GUTTER;
  const totalH = rows * cellH + (rows - 1) * GUTTER;
  const atlas = createImage(totalW, totalH);
  const frames: SpriteFrameRect[] = [];

  for (let i = 0; i < compFrames.length; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (cellW + GUTTER);
    const y = row * (cellH + GUTTER);
    const f = compFrames[i]!;
    blitOpaque(atlas, f.img, 0, 0, f.img.width, f.img.height, x, y);
    frames.push({ x, y, w: f.img.width, h: f.img.height, pivotX: f.pivotX, pivotY: f.pivotY });
  }

  const allIdx = frames.map((_, i) => i);
  return {
    image: atlas,
    frames,
    clips: {
      idle: { frames: allIdx, fps: 10, loop: true },
      attack: { frames: allIdx, fps: 14, loop: true },
    },
  };
}

function extractBiomeDeco(db: UnityAssetDatabase, biome: BiomeId): PackedAtlasResult | null {
  const texName = BIOME_DECO_TEX[biome];
  const tex = db.findTexture(texName);
  if (!tex) return null;
  const sprites = db.getSortedSpritesForTex(tex.ref);
  if (sprites.length === 0) {
    const full = db.decodeTextureByRef(tex.ref);
    return full ? packImageFrames([{ img: full, pivotX: 0.5, pivotY: 1 }], 6, true) : null;
  }
  const picked = subsampleIndices(sprites.length, 8);
  const items = picked
    .map((i) => db.cropSprite(sprites[i]!))
    .filter((img): img is RgbaImage => img !== null && hasOpaquePixels(img))
    .map((img) => ({ img, pivotX: 0.5, pivotY: 1 }));
  return items.length > 0 ? packImageFrames(items, 6, true) : null;
}

// ============================================================================
// Crisp 16-Bit Clean-Room Synthesizer Fallback (CI / No-Steam Mode)
// ============================================================================

const BIOME_PALETTES: Readonly<Record<BiomeId, readonly [string, string, string, string, string, string]>> = {
  MLAIR: ['#975932', '#5c4a42', '#b27333', '#04e205', '#adffad', '#3a823b'],
  OPOUSO: ['#503d3f', '#d56e7b', '#7e6c6e', '#918587', '#604d5e', '#fb7f69'],
  TDM: ['#261009', '#704150', '#421b28', '#602e20', '#9f5a27', '#424310'],
  FLIN: ['#001734', '#142b48', '#d76271', '#8f4b54', '#791722', '#2c4d78'],
  AP: ['#971241', '#780000', '#c14a55', '#d3808f', '#b8dfea', '#bc0045'],
  ATVC: ['#4a0a00', '#8f2200', '#ff5019', '#ffaa2f', '#ffec42', '#130d21'],
  DSI: ['#91795a', '#e6be19', '#a7916f', '#b58850', '#e4dc3f', '#fffc06'],
  LAB: ['#d0c180', '#432c2c', '#180d36', '#998f4f', '#7b0b31', '#7e503e'],
  TEMP: ['#0042ae', '#ffffff', '#00adff', '#f3cefd', '#23376d', '#00e4ff'],
  EVIL: ['#1e1714', '#89ff97', '#b5e574', '#a4ffbd', '#eab44a', '#458951'],
  GSHIP: ['#1e0f19', '#fc143b', '#71373e', '#ffa508', '#f86517', '#3a2238'],
};

const FORM_PALETTES: Readonly<Record<HeroFormId, readonly [string, string, string, string, string, string]>> = {
  krunk_basic: ['#d42aff', '#9d1cd4', '#5b2a97', '#da0b35', '#fbb7ff', '#030835'],
  krunk_fire: ['#ff1f1f', '#cf0707', '#ff8a00', '#dc5800', '#ffc082', '#5b0d0d'],
  krunk_leaf: ['#4eff00', '#58d123', '#47872b', '#38582a', '#fbffaa', '#451d49'],
  krunk_rock: ['#ffad16', '#d78b00', '#945f00', '#674200', '#ffe7a1', '#a20ec7'],
  krunk_electric: ['#e4ff00', '#dedf00', '#b7b700', '#676800', '#98efff', '#1a4e58'],
  krunk_shadow: ['#1d1220', '#730087', '#ff006a', '#ab0085', '#18c700', '#8678d2'],
};

type RgbaTuple = readonly [number, number, number, number];
const OUTLINE_PLUM: RgbaTuple = [0x18, 0x0b, 0x20, 255];
const WHITE_PURE: RgbaTuple = [0xff, 0xff, 0xff, 255];

function hexToRgba(hex: string, alpha = 255): RgbaTuple {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16) || 0,
    Number.parseInt(clean.slice(2, 4), 16) || 0,
    Number.parseInt(clean.slice(4, 6), 16) || 0,
    alpha,
  ];
}

class PixelCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  setPixel(x: number, y: number, color: RgbaTuple): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    const off = (iy * this.width + ix) * 4;
    this.data[off] = color[0];
    this.data[off + 1] = color[1];
    this.data[off + 2] = color[2];
    this.data[off + 3] = color[3];
  }

  fillRect(x: number, y: number, w: number, h: number, color: RgbaTuple): void {
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) {
        this.setPixel(x + dx, y + dy, color);
      }
    }
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, color: RgbaTuple): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.setPixel(x, y, color);
      }
    }
  }

  applyOutline(outlineColor: RgbaTuple): void {
    const copy = new Uint8Array(this.data);
    const isOpaque = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.width && y < this.height && copy[(y * this.width + x) * 4 + 3]! > 0;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (isOpaque(x, y)) continue;
        if (isOpaque(x - 1, y) || isOpaque(x + 1, y) || isOpaque(x, y - 1) || isOpaque(x, y + 1)) {
          this.setPixel(x, y, outlineColor);
        }
      }
    }
  }
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface SynthesizedResult {
  readonly image: RgbaImage;
  readonly frames?: readonly SpriteFrameRect[];
  readonly clips?: Readonly<Record<string, SpriteAnimClip>>;
  readonly tileLayout?: TileLayoutMeta;
  readonly parallax?: ParallaxLayerMeta;
}

function synthesizeFallback(key: string, defaultW: number, defaultH: number): SynthesizedResult {
  if (key.startsWith('tiles/')) {
    const biome = key.slice(6) as BiomeId;
    const pal = (BIOME_PALETTES[biome] ?? BIOME_PALETTES.TDM).map((h) => hexToRgba(h));
    const c = new PixelCanvas(512, 64);
    for (let mask = 0; mask < 16; mask += 1) {
      const ox = mask * 32;
      const up = (mask & 1) !== 0;
      const right = (mask & 2) !== 0;
      const down = (mask & 4) !== 0;
      const left = (mask & 8) !== 0;
      c.fillRect(ox, 0, 32, 32, pal[1]!);
      if (!up) {
        c.fillRect(ox, 0, 32, 6, pal[3]!);
        c.fillRect(ox, 0, 32, 2, pal[4]!);
      }
      if (!down) c.fillRect(ox, 30, 32, 2, OUTLINE_PLUM);
      if (!left) c.fillRect(ox, 0, 2, 32, OUTLINE_PLUM);
      if (!right) c.fillRect(ox + 30, 0, 2, 32, OUTLINE_PLUM);
    }
    for (let col = 0; col < 12; col += 1) {
      c.fillRect(col * 32, 32, 32, 32, col >= 8 ? pal[0]! : pal[1]!);
    }
    return { image: { width: 512, height: 64, rgba: c.data }, tileLayout: STANDARD_TILE_LAYOUT };
  }

  if (key.startsWith('bg/')) {
    const baseKey = key.replace(/_(far|mid|near)$/, '');
    const biome = baseKey.slice(3) as BiomeId;
    const pal = (BIOME_PALETTES[biome] ?? BIOME_PALETTES.TDM).map((h) => hexToRgba(h));
    const c = new PixelCanvas(defaultW, defaultH);
    const isSky = baseKey === key;
    if (isSky) {
      for (let y = 0; y < defaultH; y += 1) {
        const band = y < defaultH * 0.45 ? pal[5]! : y < defaultH * 0.75 ? pal[1]! : pal[0]!;
        for (let x = 0; x < defaultW; x += 1) c.setPixel(x, y, band);
      }
    } else {
      for (let x = 0; x < defaultW; x += 1) {
        const ridge = Math.floor(defaultH * 0.45 + Math.sin(x * 0.03) * 18);
        for (let y = ridge; y < defaultH; y += 1) c.setPixel(x, y, pal[2]!);
      }
    }
    return {
      image: { width: defaultW, height: defaultH, rgba: c.data },
      parallax: BIOME_PARALLAX_SPECS[key]?.meta ?? { scrollX: isSky ? 0 : 0.2, scrollY: 0, anchorY: isSky ? 'top' : 'bottom', tileX: true, fillViewport: isSky },
    };
  }

  if (key.startsWith('hero/')) {
    const form = key.slice(5) as HeroFormId;
    const pal = (FORM_PALETTES[form] ?? FORM_PALETTES.krunk_basic).map((h) => hexToRgba(h));
    const c = new PixelCanvas(288, 36);
    const frames: SpriteFrameRect[] = [];
    for (let f = 0; f < 8; f += 1) {
      const ox = f * 36;
      const bob = f % 2 === 0 ? 0 : -1;
      c.fillEllipse(ox + 18, 22 + bob, 11, 10, pal[1]!);
      c.fillEllipse(ox + 17, 19 + bob, 9, 7, pal[0]!);
      c.fillEllipse(ox + 18, 25 + bob, 6, 4, pal[3]!);
      c.fillRect(ox + 13, 17 + bob, 4, 5, WHITE_PURE);
      c.fillRect(ox + 20, 17 + bob, 4, 5, WHITE_PURE);
      c.fillRect(ox + 15, 18 + bob, 2, 3, pal[5]!);
      c.fillRect(ox + 22, 18 + bob, 2, 3, pal[5]!);
      frames.push({ x: ox, y: 0, w: 36, h: 36, pivotX: 0.5, pivotY: 0.9 });
    }
    c.applyOutline(OUTLINE_PLUM);
    return {
      image: { width: 288, height: 36, rgba: c.data },
      frames,
      clips: {
        idle: { frames: [0, 1], fps: 6, loop: true },
        run: { frames: [2, 3, 4, 5], fps: 12, loop: true },
        jump: { frames: [6], fps: 10, loop: false },
        fall: { frames: [7], fps: 10, loop: true },
        air_stomp: { frames: [6, 7], fps: 16, loop: true },
      },
    };
  }

  const seed = hashSeed(key);
  const allPals = Object.values(FORM_PALETTES);
  const pickedPal = allPals[seed % allPals.length]!.map((h) => hexToRgba(h));
  const frameSize = Math.max(16, Math.min(defaultW, defaultH));
  const frameCount = Math.max(1, Math.min(8, Math.floor(defaultW / frameSize)));
  const w = frameCount * frameSize;
  const h = defaultH;
  const c = new PixelCanvas(w, h);
  const frames: SpriteFrameRect[] = [];
  for (let f = 0; f < frameCount; f += 1) {
    const cx = f * frameSize + Math.floor(frameSize / 2);
    const cy = Math.floor(h / 2);
    const r = Math.max(4, Math.floor(Math.min(frameSize, h) * 0.34));
    c.fillEllipse(cx, cy, r, r, pickedPal[1]!);
    c.fillEllipse(cx - 1, cy - 2, Math.max(2, r - 3), Math.max(2, r - 4), pickedPal[0]!);
    frames.push({ x: f * frameSize, y: 0, w: frameSize, h, pivotX: 0.5, pivotY: 1 });
  }
  c.applyOutline(OUTLINE_PLUM);
  return {
    image: { width: w, height: h, rgba: c.data },
    frames,
    clips: { idle: { frames: frames.map((_, i) => i), fps: 8, loop: true } },
  };
}

// ============================================================================
// Main Orchestrator
// ============================================================================

function runExtractAssets(): void {
  const steamDir = process.env.KRUNKED_STEAM_DATA_DIR || DEFAULT_STEAM_DATA_DIR;
  const steamVerified =
    fs.existsSync(steamDir) &&
    fs.existsSync(path.join(steamDir, 'globalgamemanagers')) &&
    fs.existsSync(path.join(steamDir, 'Managed', 'Assembly-CSharp.dll'));

  fs.mkdirSync(SPRITES_DIR, { recursive: true });

  const db = steamVerified ? new UnityAssetDatabase(steamDir) : null;
  if (db) {
    console.log(
      `[extract-assets] Indexed Unity DB: textures=${db.texByRef.size}, sprites=${db.spriteByRef.size}, clips=${db.clipsByName.size}, tilesets=${db.tilesetsByRef.size}, brushes=${db.brushesByName.size}`,
    );
  }

  const entries: Record<string, CustomPackEntry> = {};
  let extractedCount = 0;
  let synthesizedCount = 0;
  const synthesizedKeys: string[] = [];

  for (const key of ALL_REQUIRED_ASSET_KEYS) {
    const spec = ASSET_REGISTRY_SPECS[key]!;
    const outFullPath = path.join(OUT_DIR, spec.defaultPath);
    fs.mkdirSync(path.dirname(outFullPath), { recursive: true });

    let resultImage: RgbaImage | null = null;
    let frames: readonly SpriteFrameRect[] | undefined;
    let clips: Readonly<Record<string, SpriteAnimClip>> | undefined;
    let tileLayout: TileLayoutMeta | undefined;
    let parallax: ParallaxLayerMeta | undefined;

    if (db) {
      if (key.startsWith('hero/')) {
        const form = key.slice(5) as HeroFormId;
        const packed = extractPackedClips(db, HERO_CLIP_SPECS[form]);
        if (packed) {
          resultImage = packed.image;
          frames = packed.frames;
          clips = packed.clips;
        }
      } else if (key.startsWith('tiles/')) {
        const biome = key.slice(6) as BiomeId;
        const baked = bakeSteBiomeTileset(db, biome);
        if (baked) {
          resultImage = baked;
          tileLayout = STANDARD_TILE_LAYOUT;
        }
      } else if (key.startsWith('bg/')) {
        const bg = extractParallaxLayer(db, key);
        if (bg) {
          resultImage = bg.image;
          parallax = bg.parallax;
        }
      } else if (key.startsWith('deco/')) {
        const biome = key.slice(5) as BiomeId;
        const deco = extractBiomeDeco(db, biome);
        if (deco) {
          resultImage = deco.image;
          frames = deco.frames;
          clips = deco.clips;
        }
      } else if (key.startsWith('tile/')) {
        const packed = extractSpecialTileOrProp(db, key);
        if (packed) {
          resultImage = packed.image;
          frames = packed.frames;
          clips = packed.clips;
        }
      } else if (key.startsWith('npc/')) {
        const sel = NPC_CLIP_SPECS[key];
        const packed = sel ? extractPackedClips(db, sel) : null;
        if (packed) {
          resultImage = packed.image;
          frames = packed.frames;
          clips = packed.clips;
        }
      } else if (key.startsWith('enemy/')) {
        const sel = ENEMY_CLIP_SPECS[key];
        const packed = sel ? extractPackedClips(db, sel) : null;
        if (packed) {
          resultImage = packed.image;
          frames = packed.frames;
          clips = packed.clips;
        }
      } else if (key.startsWith('boss/')) {
        const packed =
          key === 'boss/electro_sphinx'
            ? extractElectroSphinxBoss(db)
            : BOSS_CLIP_SPECS[key]
              ? extractPackedClips(db, BOSS_CLIP_SPECS[key]!)
              : null;
        if (packed) {
          resultImage = packed.image;
          frames = packed.frames;
          clips = packed.clips;
        }
      } else if (key.startsWith('ui/')) {
        const packed = extractUiAsset(db, key);
        if (packed) {
          resultImage = packed.image;
          frames = packed.frames;
          clips = packed.clips;
        }
      } else if (key.startsWith('fx/')) {
        const sel = FX_CLIP_SPECS[key];
        const packed = sel ? extractPackedClips(db, sel) : null;
        if (packed) {
          resultImage = packed.image;
          frames = packed.frames;
          clips = packed.clips;
        }
      }
    }

    if (resultImage) {
      extractedCount += 1;
    } else {
      const fallback = synthesizeFallback(key, spec.width, spec.height);
      resultImage = fallback.image;
      frames = fallback.frames;
      clips = fallback.clips;
      tileLayout = fallback.tileLayout;
      parallax = fallback.parallax;
      synthesizedCount += 1;
      synthesizedKeys.push(key);
    }

    const pngBuf = encodePngRgba(resultImage.width, resultImage.height, resultImage.rgba);
    fs.writeFileSync(outFullPath, pngBuf);

    entries[key] = {
      key,
      path: spec.defaultPath,
      width: resultImage.width,
      height: resultImage.height,
      category: spec.category,
      ...(frames ? { frames } : {}),
      ...(clips ? { clips } : {}),
      ...(tileLayout ? { tileLayout } : {}),
      ...(parallax ? { parallax } : {}),
    };
  }

  const manifest: CustomPackManifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    sourceVerified: steamVerified,
    entries,
  };

  const validation = validateAssetManifest(manifest);
  if (!validation.valid) {
    throw new Error(
      `Generated manifest failed validation: ${validation.errors.join('; ')} | missing=${validation.missingKeys.join(',')} | invalid=${validation.invalidEntries.join(',')}`,
    );
  }

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `[extract-assets] Wrote ${MANIFEST_PATH} | sourceVerified=${steamVerified} | totalKeys=${ALL_REQUIRED_ASSET_KEYS.length} | decodedUnity=${extractedCount} | synthesized=${synthesizedCount}`,
  );
  if (synthesizedKeys.length > 0 && steamVerified) {
    console.warn(`[extract-assets] Synthesized keys: ${synthesizedKeys.join(', ')}`);
  }
}

runExtractAssets();
