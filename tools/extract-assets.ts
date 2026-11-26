/**
 * Krunked Quest — Read-Only Local Custom Asset Pack Extractor
 * Strictly READ-ONLY inspection of the local Steam Unity data directory.
 * Decodes uncompressed Unity RGBA32/ARGB32/RGB24 Texture2D assets when available,
 * and synthesizes crisp 16-bit palette-matched PNG sheets for every logical key in
 * AssetRegistry using a pure Node + zlib PNG encoder (zero extra npm dependencies).
 * Writes gitignored `.krunked-quest-assets/sprites/*.png` and `manifest.json`.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { BiomeId, CustomPackEntry, CustomPackManifest, HeroFormId } from '../src/contracts/index';
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

interface UnityTextureRecord {
  readonly assetsFile: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly textureFormat: number; // 3 = RGB24, 4 = RGBA32, 5 = ARGB32
  readonly imgDataLen: number;
  readonly imgDataOffset: number;
  readonly streamOffset: number;
  readonly streamSize: number;
  readonly streamPath: string;
}

// Logical key -> preferred local Unity Texture2D asset names (read-only extraction)
const STEAM_TEXTURE_MAP: Readonly<Record<string, readonly string[]>> = {
  // Hero forms
  'hero/krunk_basic': ['Mombo_idle_FINAL'],
  'hero/krunk_fire': ['FIRE_Mombo_idle'],
  'hero/krunk_leaf': ['LEAF_Mombo_idle'],
  'hero/krunk_rock': ['ROCK_Mombo_idle'],
  'hero/krunk_electric': ['ELECTRIC_Mombo_idle'],
  'hero/krunk_shadow': ['DARK_Mombo_idle'],

  // 11 Biome tilesets
  'tiles/MLAIR': ['ML_tileset'],
  'tiles/OPOUSO': ['OP_tileset_1'],
  'tiles/TDM': ['Trilha dos Monstros_tileset'],
  'tiles/FLIN': ['FlorestaInfestadaTileSet'],
  'tiles/AP': ['AP_tileset'],
  'tiles/ATVC': ['AV_tileset_2A'],
  'tiles/DSI': ['DI_tileset_A'],
  'tiles/LAB': ['LE_tileset_A'],
  'tiles/TEMP': ['TA_tileset_B'],
  'tiles/EVIL': ['RP_tileset_A'],
  'tiles/GSHIP': ['Nightmare_Darkness_Tileset'],

  // 11 Biome skies/backgrounds
  'bg/MLAIR': ['ML_background sky_NEW'],
  'bg/OPOUSO': ['OP_back sky'],
  'bg/TDM': ['TM_BACK'],
  'bg/FLIN': ['FI_background sky'],
  'bg/AP': ['AP_back deco_shine bush'],
  'bg/ATVC': ['AV_background'],
  'bg/DSI': ['DI_backround_sands'],
  'bg/LAB': ['LE_backround1'],
  'bg/TEMP': ['TA_back_sky'],
  'bg/EVIL': ['RP_background sky_NEW'],
  'bg/GSHIP': ['ARENA_back_ship BARBAVELHA'],

  // Special tiles & interactables
  'tile/special_tiles': ['Spikes'],
  'tile/chest': ['CHEST'],
  'tile/teleporter': ['TeleportButton'],
  'tile/volt_node': ['TA_antigravity_block_FX 1'],
  'tile/form_totem': ['TA_CatTotem'],
  'tile/save_shrine': ['Mombo_the Xtra Life_ON'],

  // Hub NPCs
  'npc/vespera': ['Alfredo_TS'],
  'npc/orla': ['Tome_TS'],
  'npc/barnaby': ['Adamastor_TS'],
  'npc/garron': ['ARENA_BARBAVELHA CAMP 1'],
  'npc/barnacle': ['Big_Mombo_Pirata'],
  'npc/codex': ['FilomenaBG-Tile'],

  // UI & collectibles
  'ui/heart': ['HeartItem-Sheet'],
  'ui/combo_wheel': ['MomboComboBadge'],
  'ui/crystal': ['CrystalTile'],
  'ui/coin': ['GoldenCoin'],
  'ui/shield_icon': ['SpecialHearts'],
  'ui/title_logo': ['Title screen_logo'],

  // FX
  'fx/stomp_ring': ['Nightmare King_Mombo_Stomp_FX'],
  'fx/fire_blast': ['FireMombo_StompAttackFX'],
  'fx/volt_arc': ['ChoqueLoopSheet'],
  'fx/particles': ['FX_catching crystals'],

  // Enemies
  'enemy/goomba': ['RP_enemy_goomba'],
  'enemy/air_goomba': ['enemy_tuto_butterfly'],
  'enemy/frog': ['SUBROSIAN_frog'],
  'enemy/carnivorous_plant': ['FI_deco_plants'],
  'enemy/mushroom_warrior': ['FI_mushroons'],
  'enemy/ghost_crow': ['CrowGhost_Walk'],
  'enemy/ghost_owl': ['GhostOwl_Walk'],
  'enemy/ghost_pig': ['GhostPig_Walk'],

  // Bosses
  'boss/primal_eye': ['AP_Eye', 'AP_BOSS_TEST'],
  'boss/magma_boar_king': ['AV_BOSS_FIRE CRYSTAL'],
  'boss/mecha_bull': ['LE_BOSS_STONE CRYSTAL'],
  'boss/shadow_doppelganger': ['BigShadowMombo'],
  'boss/nightmare_sovereign': ['Nightmare King_Mombo_Idle'],
};

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

// ============================================================================
// Pure Node + zlib PNG Writer (Zero external npm dependencies)
// ============================================================================

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
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rowBytes = width * 4;
  const rawScanlines = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const dstOff = y * (rowBytes + 1);
    rawScanlines[dstOff] = 0; // Filter type 0 (None)
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

// ============================================================================
// Read-Only Unity Serialized File v22 Texture2D Parser & Decoder
// ============================================================================

function indexUnityTextures(steamDir: string): Map<string, UnityTextureRecord> {
  const index = new Map<string, UnityTextureRecord>();
  if (!fs.existsSync(steamDir)) return index;

  const files = fs
    .readdirSync(steamDir)
    .filter((f) => /^sharedassets\d+\.assets$/.test(f))
    .sort((a, b) => Number.parseInt(a.slice(12), 10) - Number.parseInt(b.slice(12), 10));

  for (const fname of files) {
    const buf = fs.readFileSync(path.join(steamDir, fname));
    if (buf.length < 64 || buf.readUInt32BE(8) !== 22) continue;
    const dataOffset = Number(buf.readBigUInt64BE(32));
    const verEnd = buf.indexOf(0, 48);
    if (verEnd < 0) continue;
    let off = verEnd + 1 + 4 + 1;
    if (off + 4 > buf.length) continue;

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
    for (let i = 0; i < objCount; i += 1) {
      off = (off + 3) & ~3;
      off += 8; // pathId
      const byteStart = Number(buf.readBigInt64LE(off));
      off += 8;
      const byteSize = buf.readUInt32LE(off);
      off += 4;
      const typeId = buf.readInt32LE(off);
      off += 4;
      if (types[typeId] !== 28) continue;

      const objStart = dataOffset + byteStart;
      const objEnd = objStart + byteSize;
      if (objEnd > buf.length) continue;

      let p = objStart;
      const nameLen = buf.readInt32LE(p);
      p += 4;
      if (nameLen < 0 || p + nameLen > objEnd) continue;
      const name = buf.subarray(p, p + nameLen).toString('utf8');
      p += (nameLen + 3) & ~3;
      p += 6;
      p = (p + 3) & ~3;
      const width = buf.readInt32LE(p);
      p += 4;
      const height = buf.readInt32LE(p);
      p += 4;
      p += 8; // completeImageSize + mipsStripped
      const textureFormat = buf.readInt32LE(p);
      p += 4;
      p += 4; // mipCount
      p += 3;
      p = (p + 3) & ~3;
      p += 8 + 24 + 8;
      const platformBlobLen = buf.readInt32LE(p);
      p += 4;
      p += (platformBlobLen + 3) & ~3;
      const imgDataLen = buf.readInt32LE(p);
      p += 4;
      const imgDataOffset = p;
      p += (imgDataLen + 3) & ~3;

      let streamOffset = 0;
      let streamSize = 0;
      let streamPath = '';
      if (p + 16 <= objEnd) {
        streamOffset = Number(buf.readBigUInt64LE(p));
        p += 8;
        streamSize = buf.readUInt32LE(p);
        p += 4;
        const spLen = buf.readInt32LE(p);
        p += 4;
        if (spLen > 0 && p + spLen <= objEnd) {
          streamPath = buf.subarray(p, p + spLen).toString('utf8');
        }
      }

      if (
        (textureFormat === 3 || textureFormat === 4 || textureFormat === 5) &&
        width > 0 &&
        height > 0 &&
        width <= 1600 &&
        height <= 1600 &&
        !index.has(name)
      ) {
        index.set(name, {
          assetsFile: fname,
          name,
          width,
          height,
          textureFormat,
          imgDataLen,
          imgDataOffset,
          streamOffset,
          streamSize,
          streamPath,
        });
      }
    }
  }
  return index;
}

function decodeUnityTextureToRgba(
  steamDir: string,
  rec: UnityTextureRecord,
): { width: number; height: number; rgba: Uint8Array } | null {
  const bpp = rec.textureFormat === 3 ? 3 : 4;
  const neededBytes = rec.width * rec.height * bpp;

  let raw: Buffer | null = null;
  if (rec.imgDataLen >= neededBytes) {
    const fd = fs.openSync(path.join(steamDir, rec.assetsFile), 'r');
    try {
      raw = Buffer.alloc(neededBytes);
      fs.readSync(fd, raw, 0, neededBytes, rec.imgDataOffset);
    } finally {
      fs.closeSync(fd);
    }
  } else if (rec.streamSize >= neededBytes && rec.streamPath) {
    const resFullPath = path.join(steamDir, path.basename(rec.streamPath));
    if (!fs.existsSync(resFullPath)) return null;
    const fd = fs.openSync(resFullPath, 'r');
    try {
      raw = Buffer.alloc(neededBytes);
      fs.readSync(fd, raw, 0, neededBytes, rec.streamOffset);
    } finally {
      fs.closeSync(fd);
    }
  }

  if (!raw || raw.length < neededBytes) {
    return null;
  }

  const rgba = new Uint8Array(rec.width * rec.height * 4);
  // Unity Texture2D pixel rows are stored bottom-up; flip vertically to PNG top-down.
  for (let y = 0; y < rec.height; y += 1) {
    const srcY = rec.height - 1 - y;
    for (let x = 0; x < rec.width; x += 1) {
      const srcOff = (srcY * rec.width + x) * bpp;
      const dstOff = (y * rec.width + x) * 4;
      if (rec.textureFormat === 4) {
        // RGBA32
        rgba[dstOff] = raw[srcOff]!;
        rgba[dstOff + 1] = raw[srcOff + 1]!;
        rgba[dstOff + 2] = raw[srcOff + 2]!;
        rgba[dstOff + 3] = raw[srcOff + 3]!;
      } else if (rec.textureFormat === 5) {
        // ARGB32 -> RGBA32
        rgba[dstOff] = raw[srcOff + 1]!;
        rgba[dstOff + 1] = raw[srcOff + 2]!;
        rgba[dstOff + 2] = raw[srcOff + 3]!;
        rgba[dstOff + 3] = raw[srcOff]!;
      } else {
        // RGB24 -> RGBA32
        rgba[dstOff] = raw[srcOff]!;
        rgba[dstOff + 1] = raw[srcOff + 1]!;
        rgba[dstOff + 2] = raw[srcOff + 2]!;
        rgba[dstOff + 3] = 255;
      }
    }
  }
  return { width: rec.width, height: rec.height, rgba };
}

// ============================================================================
// Crisp 16-Bit Palette-Matched Pixel-Art Synthesizer (Fallback / Missing Keys)
// ============================================================================

type RgbaTuple = readonly [number, number, number, number];

function hexToRgba(hex: string, alpha = 255): RgbaTuple {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16) || 0;
  const g = Number.parseInt(clean.slice(2, 4), 16) || 0;
  const b = Number.parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b, alpha];
}

const OUTLINE_PLUM: RgbaTuple = [0x18, 0x0b, 0x20, 255];
const WHITE_PURE: RgbaTuple = [0xff, 0xff, 0xff, 255];

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
        if (nx * nx + ny * ny <= 1) {
          this.setPixel(x, y, color);
        }
      }
    }
  }

  applyOutline(outlineColor: RgbaTuple): void {
    const copy = new Uint8Array(this.data);
    const isOpaque = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
      return copy[(y * this.width + x) * 4 + 3]! > 0;
    };
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

function synthesizeSheet(key: string, width: number, height: number): Uint8Array {
  const c = new PixelCanvas(width, height);

  if (key.startsWith('hero/')) {
    const form = key.slice(5) as HeroFormId;
    const pal = (FORM_PALETTES[form] ?? FORM_PALETTES.krunk_basic).map((h) => hexToRgba(h));
    const frameW = 36;
    const frames = Math.max(1, Math.floor(width / frameW));
    for (let f = 0; f < frames; f += 1) {
      const ox = f * frameW;
      const bob = f % 2 === 0 ? 0 : -1;
      // Plump horned Krunk hero silhouette with highlight, belly, horns, expressive eyes
      c.fillEllipse(ox + 18, 22 + bob, 11, 10, pal[1]!);
      c.fillEllipse(ox + 17, 19 + bob, 9, 7, pal[0]!);
      c.fillEllipse(ox + 18, 26 + bob, 6, 4, pal[4]!);
      // Horns
      c.fillRect(ox + 10, 8 + bob, 4, 5, pal[3]!);
      c.fillRect(ox + 22, 8 + bob, 4, 5, pal[3]!);
      // Feet
      c.fillRect(ox + 11 + (f % 2), 30, 5, 4, pal[2]!);
      c.fillRect(ox + 20 - (f % 2), 30, 5, 4, pal[2]!);
      // Expressive eyes
      c.fillRect(ox + 13, 18 + bob, 4, 5, WHITE_PURE);
      c.fillRect(ox + 20, 18 + bob, 4, 5, WHITE_PURE);
      c.fillRect(ox + 15, 19 + bob, 2, 3, pal[5]!);
      c.fillRect(ox + 22, 19 + bob, 2, 3, pal[5]!);
    }
    c.applyOutline(OUTLINE_PLUM);
    return c.data;
  }

  if (key.startsWith('tiles/')) {
    const biome = key.slice(6) as BiomeId;
    const pal = (BIOME_PALETTES[biome] ?? BIOME_PALETTES.TDM).map((h) => hexToRgba(h));
    const cols = Math.max(1, Math.floor(width / 32));
    const rows = Math.max(1, Math.floor(height / 32));
    for (let ty = 0; ty < rows; ty += 1) {
      for (let tx = 0; tx < cols; tx += 1) {
        const ox = tx * 32;
        const oy = ty * 32;
        c.fillRect(ox, oy, 32, 32, pal[0]!);
        c.fillRect(ox + 1, oy + 1, 30, 30, pal[1]!);
        // Biome top cap
        c.fillRect(ox + 1, oy + 1, 30, 6, pal[3]!);
        c.fillRect(ox + 1, oy + 1, 30, 2, pal[4]!);
        // Brick/stone pixel dithering
        for (let py = 8; py < 30; py += 4) {
          for (let px = 3 + ((py / 4) % 2) * 4; px < 29; px += 8) {
            c.fillRect(ox + px, oy + py, 4, 2, pal[2]!);
          }
        }
        // Crisp 1px plum border
        c.fillRect(ox, oy, 32, 1, OUTLINE_PLUM);
        c.fillRect(ox, oy + 31, 32, 1, OUTLINE_PLUM);
        c.fillRect(ox, oy, 1, 32, OUTLINE_PLUM);
        c.fillRect(ox + 31, oy, 1, 32, OUTLINE_PLUM);
      }
    }
    return c.data;
  }

  if (key.startsWith('bg/')) {
    const biome = key.slice(3) as BiomeId;
    const pal = (BIOME_PALETTES[biome] ?? BIOME_PALETTES.TDM).map((h) => hexToRgba(h));
    for (let y = 0; y < height; y += 1) {
      const band = y < height * 0.45 ? pal[5]! : y < height * 0.75 ? pal[1]! : pal[0]!;
      for (let x = 0; x < width; x += 1) {
        c.setPixel(x, y, band);
      }
    }
    // Mountain/silhouette horizon bands
    for (let x = 0; x < width; x += 1) {
      const ridge = Math.floor(height * 0.62 + Math.sin(x * 0.03) * 24 + Math.cos(x * 0.08) * 10);
      for (let y = ridge; y < height; y += 1) {
        c.setPixel(x, y, pal[2]!);
      }
    }
    return c.data;
  }

  // Generic crisp outlined pixel sprite for enemies, bosses, NPCs, props, UI, FX
  const seed = hashSeed(key);
  const allPals = Object.values(FORM_PALETTES);
  const pickedPal = allPals[seed % allPals.length]!.map((h) => hexToRgba(h));
  const frameSize = Math.min(width, height);
  const frameCount = Math.max(1, Math.floor(width / frameSize));
  for (let f = 0; f < frameCount; f += 1) {
    const cx = f * frameSize + Math.floor(frameSize / 2);
    const cy = Math.floor(height / 2);
    const r = Math.max(4, Math.floor(frameSize * 0.34));
    c.fillEllipse(cx, cy, r, r, pickedPal[1]!);
    c.fillEllipse(cx - 1, cy - 2, Math.max(2, r - 3), Math.max(2, r - 4), pickedPal[0]!);
    c.fillEllipse(cx - Math.floor(r * 0.3), cy - Math.floor(r * 0.3), Math.max(1, Math.floor(r * 0.25)), Math.max(1, Math.floor(r * 0.25)), pickedPal[4]!);
    if (key.startsWith('enemy/') || key.startsWith('boss/') || key.startsWith('npc/')) {
      const eyeSize = Math.max(2, Math.floor(r * 0.28));
      c.fillRect(cx - eyeSize - 1, cy - eyeSize, eyeSize, eyeSize, WHITE_PURE);
      c.fillRect(cx + 2, cy - eyeSize, eyeSize, eyeSize, WHITE_PURE);
      c.fillRect(cx - eyeSize, cy - eyeSize + 1, Math.max(1, eyeSize - 1), Math.max(1, eyeSize - 1), OUTLINE_PLUM);
      c.fillRect(cx + 3, cy - eyeSize + 1, Math.max(1, eyeSize - 1), Math.max(1, eyeSize - 1), OUTLINE_PLUM);
    }
  }
  c.applyOutline(OUTLINE_PLUM);
  return c.data;
}

function runExtractAssets(): void {
  const steamDir = process.env.KRUNKED_STEAM_DATA_DIR || DEFAULT_STEAM_DATA_DIR;
  const steamVerified =
    fs.existsSync(steamDir) &&
    fs.existsSync(path.join(steamDir, 'globalgamemanagers')) &&
    fs.existsSync(path.join(steamDir, 'Managed', 'Assembly-CSharp.dll'));

  fs.mkdirSync(SPRITES_DIR, { recursive: true });

  const texIndex = steamVerified ? indexUnityTextures(steamDir) : new Map<string, UnityTextureRecord>();
  const entries: Record<string, CustomPackEntry> = {};

  let extractedCount = 0;
  let synthesizedCount = 0;

  for (const key of ALL_REQUIRED_ASSET_KEYS) {
    const spec = ASSET_REGISTRY_SPECS[key]!;
    const outFullPath = path.join(OUT_DIR, spec.defaultPath);
    fs.mkdirSync(path.dirname(outFullPath), { recursive: true });

    let width = spec.width;
    let height = spec.height;
    let rgba: Uint8Array | null = null;

    if (steamVerified) {
      const candidates = STEAM_TEXTURE_MAP[key] ?? [];
      for (const texName of candidates) {
        const rec = texIndex.get(texName);
        if (!rec) continue;
        const decoded = decodeUnityTextureToRgba(steamDir, rec);
        if (decoded) {
          width = decoded.width;
          height = decoded.height;
          rgba = decoded.rgba;
          extractedCount += 1;
          break;
        }
      }
    }

    if (!rgba) {
      rgba = synthesizeSheet(key, width, height);
      synthesizedCount += 1;
    }

    const pngBuf = encodePngRgba(width, height, rgba);
    fs.writeFileSync(outFullPath, pngBuf);

    entries[key] = {
      key,
      path: spec.defaultPath,
      width,
      height,
      category: spec.category,
    };
  }

  const manifest: CustomPackManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceVerified: steamVerified,
    entries,
  };

  const validation = validateAssetManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Generated manifest failed validation: ${validation.errors.join('; ')}`);
  }

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `[extract-assets] Wrote ${MANIFEST_PATH} | sourceVerified=${steamVerified} | totalKeys=${ALL_REQUIRED_ASSET_KEYS.length} | decodedUnity=${extractedCount} | synthesized=${synthesizedCount}`,
  );
}

runExtractAssets();
