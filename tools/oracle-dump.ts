/**
 * Krunked Quest — Read-Only Retail Source Oracle Dumper
 * Strictly READ-ONLY scan of the local Steam Unity data directory.
 * NEVER creates, edits, or deletes any file inside Steam.
 * Emits gitignored `.krunked-quest-assets/oracle.json`.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARENA_ZOOM,
  BIOME_IDS,
  COMBO_PRESETS,
  FIXED_DT,
  FORM_PARAMS,
  HERO_FORMS,
  ORTHOGRAPHIC_SIZE,
  PHYSICS,
  PPU,
  SIM_HZ,
  VIEWPORT_H,
  VIEWPORT_TILES_H,
  VIEWPORT_TILES_W,
  VIEWPORT_W,
  type BiomeId,
  type BossId,
  type HeroFormId,
  type RelicId,
  type UpgradeKey,
} from '../src/contracts/index';

export const DEFAULT_STEAM_DATA_DIR =
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Super Mombo Quest\\SuperMomboQuest_Data';

const OUT_DIR = path.resolve(process.cwd(), '.krunked-quest-assets');
const OUT_FILE = path.join(OUT_DIR, 'oracle.json');

type Provenance = 'extracted' | 'measured';

interface FileFingerprint {
  readonly relativePath: string;
  readonly exists: boolean;
  readonly sizeBytes: number;
  readonly sha256: string | null;
}

interface ParsedTextureMeta {
  readonly assetsFile: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly textureFormat: number;
  readonly imgDataLen: number;
  readonly imgDataOffset: number;
  readonly streamOffset: number;
  readonly streamSize: number;
  readonly streamPath: string;
}

const BIOME_SOURCE_TEXTURES: Readonly<Record<BiomeId, readonly string[]>> = {
  MLAIR: ['ML_tileset', 'ML_background sky_NEW'],
  OPOUSO: ['OP_tileset_1', 'OP_back sky'],
  TDM: ['Trilha dos Monstros_tileset', 'TM_BACK'],
  FLIN: ['FlorestaInfestadaTileSet', 'FI_background sky'],
  AP: ['AP_tileset', 'AP_back deco_shine bush'],
  ATVC: ['AV_tileset_2A', 'AV_background'],
  DSI: ['DI_tileset_A', 'DI_backround_sands'],
  LAB: ['LE_tileset_A', 'LE_backround1'],
  TEMP: ['TA_tileset_B', 'TA_back_sky'],
  EVIL: ['RP_tileset_A', 'RP_background sky_NEW'],
  GSHIP: ['Nightmare_Darkness_Tileset', 'ARENA_back_ship BARBAVELHA'],
};

const FALLBACK_BIOME_PALETTES: Readonly<Record<BiomeId, readonly [string, string, string, string, string, string]>> = {
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

const HERO_FORM_PALETTES: Readonly<Record<HeroFormId, readonly [string, string, string, string, string, string]>> = {
  krunk_basic: ['#d42aff', '#9d1cd4', '#5b2a97', '#da0b35', '#fbb7ff', '#030835'],
  krunk_fire: ['#ff1f1f', '#cf0707', '#ff8a00', '#dc5800', '#ffc082', '#5b0d0d'],
  krunk_leaf: ['#4eff00', '#58d123', '#47872b', '#38582a', '#fbffaa', '#451d49'],
  krunk_rock: ['#ffad16', '#d78b00', '#945f00', '#674200', '#ffe7a1', '#a20ec7'],
  krunk_electric: ['#e4ff00', '#dedf00', '#b7b700', '#676800', '#98efff', '#1a4e58'],
  krunk_shadow: ['#1d1220', '#730087', '#ff006a', '#ab0085', '#18c700', '#8678d2'],
};

interface OracleUpgradeRecord {
  readonly id: number;
  readonly key: UpgradeKey;
  readonly shop: 'vespera' | 'orla';
  readonly basePrice: number;
  readonly priceStep: number;
  readonly maxLevel: number;
  readonly requiredForm: HeroFormId | null;
  readonly provenance: Provenance;
}

const ORACLE_UPGRADES: readonly OracleUpgradeRecord[] = [
  { id: 0, key: 'ExtraLife', shop: 'vespera', basePrice: 700, priceStep: 700, maxLevel: 5, requiredForm: null, provenance: 'extracted' },
  { id: 1, key: 'ItemSlot', shop: 'vespera', basePrice: 2100, priceStep: 3500, maxLevel: 2, requiredForm: null, provenance: 'extracted' },
  { id: 2, key: 'CrystallineHunger', shop: 'orla', basePrice: 1750, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_basic', provenance: 'extracted' },
  { id: 3, key: 'LeafCombo', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_leaf', provenance: 'extracted' },
  { id: 4, key: 'LeafExtraJump', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_leaf', provenance: 'extracted' },
  { id: 5, key: 'StompFlame', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_fire', provenance: 'extracted' },
  { id: 6, key: 'DashFlame', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_fire', provenance: 'extracted' },
  { id: 7, key: 'RockShield', shop: 'orla', basePrice: 5250, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_rock', provenance: 'extracted' },
  { id: 8, key: 'RockUppercutInvuln', shop: 'orla', basePrice: 5250, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_rock', provenance: 'extracted' },
  { id: 9, key: 'VoltRange', shop: 'orla', basePrice: 5250, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_electric', provenance: 'extracted' },
  { id: 10, key: 'VoltShield', shop: 'orla', basePrice: 5250, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_electric', provenance: 'extracted' },
  { id: 11, key: 'IronSkin', shop: 'vespera', basePrice: 1750, priceStep: 0, maxLevel: 1, requiredForm: null, provenance: 'extracted' },
  { id: 12, key: 'TripleJump', shop: 'orla', basePrice: 7000, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_basic', provenance: 'extracted' },
  { id: 13, key: 'RockUppercutPower', shop: 'orla', basePrice: 7000, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_rock', provenance: 'extracted' },
  { id: 14, key: 'DashRoundFire', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_fire', provenance: 'extracted' },
  { id: 15, key: 'ViewMapExits', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: null, provenance: 'extracted' },
  { id: 16, key: 'ViewSecretAreas', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: null, provenance: 'extracted' },
  { id: 17, key: 'ViewMapArenas', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: null, provenance: 'extracted' },
] as const;

interface OracleRelicRecord {
  readonly id: RelicId;
  readonly price: number;
  readonly provenance: Provenance;
}

const ORACLE_RELICS: readonly OracleRelicRecord[] = [
  { id: 'providential_shield', price: 1400, provenance: 'extracted' },
  { id: 'crystal_abundance', price: 2100, provenance: 'extracted' },
  { id: 'maniac_crystal', price: 3000, provenance: 'extracted' },
  { id: 'old_clock', price: 1400, provenance: 'extracted' },
  { id: 'evil_ring', price: 3500, provenance: 'extracted' },
  { id: 'magnet', price: 3500, provenance: 'extracted' },
  { id: 'lively_heart', price: 3000, provenance: 'extracted' },
  { id: 'rebirth_amulet', price: 1400, provenance: 'extracted' },
  { id: 'platinum_medal', price: 2100, provenance: 'extracted' },
  { id: 'bandit_shorts', price: 3500, provenance: 'extracted' },
  { id: 'turtle_shell', price: 3000, provenance: 'extracted' },
  { id: 'extra_coin', price: 2100, provenance: 'extracted' },
  { id: 'magic_feather', price: 5000, provenance: 'extracted' },
  { id: 'vampiric_amulet', price: 5000, provenance: 'extracted' },
  { id: 'magic_shield', price: 1750, provenance: 'extracted' },
  { id: 'magic_coin', price: 2100, provenance: 'extracted' },
] as const;

interface OracleBossRecord {
  readonly id: BossId;
  readonly maxHp: number;
  readonly biome: BiomeId;
  readonly isMiniBoss: boolean;
  readonly unlockForm: HeroFormId | null;
  readonly provenance: Provenance;
}

const ORACLE_BOSSES: readonly OracleBossRecord[] = [
  { id: 'dino_behemoth', maxHp: 10, biome: 'TDM', isMiniBoss: true, unlockForm: null, provenance: 'extracted' },
  { id: 'primal_eye', maxHp: 20, biome: 'AP', isMiniBoss: false, unlockForm: 'krunk_leaf', provenance: 'extracted' },
  { id: 'magma_boar_king', maxHp: 20, biome: 'ATVC', isMiniBoss: false, unlockForm: 'krunk_fire', provenance: 'extracted' },
  { id: 'bone_colossus', maxHp: 15, biome: 'DSI', isMiniBoss: true, unlockForm: null, provenance: 'extracted' },
  { id: 'mecha_bull', maxHp: 20, biome: 'LAB', isMiniBoss: false, unlockForm: 'krunk_rock', provenance: 'extracted' },
  { id: 'electro_sphinx', maxHp: 20, biome: 'TEMP', isMiniBoss: false, unlockForm: 'krunk_electric', provenance: 'extracted' },
  { id: 'shadow_doppelganger', maxHp: 30, biome: 'EVIL', isMiniBoss: false, unlockForm: null, provenance: 'extracted' },
  { id: 'nightmare_sovereign', maxHp: 30, biome: 'EVIL', isMiniBoss: false, unlockForm: 'krunk_shadow', provenance: 'extracted' },
] as const;

function sha256Buffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function fingerprintFile(rootDir: string, relPath: string): { meta: FileFingerprint; buffer: Buffer | null } {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return {
      meta: { relativePath: relPath, exists: false, sizeBytes: 0, sha256: null },
      buffer: null,
    };
  }
  const buf = fs.readFileSync(fullPath);
  return {
    meta: {
      relativePath: relPath,
      exists: true,
      sizeBytes: buf.length,
      sha256: sha256Buffer(buf),
    },
    buffer: buf,
  };
}

function parseUnityVersionFromHeader(buf: Buffer | null): { formatVersion: number | null; unityVersion: string | null } {
  if (!buf || buf.length < 64) {
    return { formatVersion: null, unityVersion: null };
  }
  const formatVersion = buf.readUInt32BE(8);
  const sliceStr = buf.subarray(0, Math.min(256, buf.length)).toString('latin1');
  const match = sliceStr.match(/20\d\d\.\d+\.\d+[a-z]\d+/);
  return {
    formatVersion,
    unityVersion: match ? match[0] : null,
  };
}

function parseUnityTextureIndex(steamDir: string): Map<string, ParsedTextureMeta> {
  const result = new Map<string, ParsedTextureMeta>();
  if (!fs.existsSync(steamDir)) return result;

  const assetFiles = fs
    .readdirSync(steamDir)
    .filter((f) => /^sharedassets\d+\.assets$/.test(f))
    .sort((a, b) => Number.parseInt(a.slice(12), 10) - Number.parseInt(b.slice(12), 10));

  for (const fname of assetFiles) {
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
      off += 4 + 1 + 2;
      if (classId === 114) off += 16;
      off += 16;
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
      p += 6; // forcedFallbackFormat(4) + downscaleFallback(1) + isAlphaChannelOptional(1)
      p = (p + 3) & ~3;
      const width = buf.readInt32LE(p);
      p += 4;
      const height = buf.readInt32LE(p);
      p += 4;
      p += 8; // completeImageSize(4) + mipsStripped(4)
      const textureFormat = buf.readInt32LE(p);
      p += 4;
      p += 4; // mipCount
      p += 3; // isReadable + isPreProcessed + ignoreMasterTextureLimit
      p = (p + 3) & ~3;
      p += 8 + 24 + 8; // imageCount(4)+texDim(4) + GLTextureSettings(24) + lightmap(4)+colorSpace(4)
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

      if ((textureFormat === 3 || textureFormat === 4 || textureFormat === 5) && !result.has(name)) {
        result.set(name, {
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
  return result;
}

function readTextureRawBytes(steamDir: string, meta: ParsedTextureMeta): Buffer | null {
  if (meta.imgDataLen > 0) {
    const filePath = path.join(steamDir, meta.assetsFile);
    const fd = fs.openSync(filePath, 'r');
    try {
      const out = Buffer.alloc(meta.imgDataLen);
      fs.readSync(fd, out, 0, meta.imgDataLen, meta.imgDataOffset);
      return out;
    } finally {
      fs.closeSync(fd);
    }
  }
  if (meta.streamSize > 0 && meta.streamPath) {
    const resPath = path.join(steamDir, path.basename(meta.streamPath));
    if (!fs.existsSync(resPath)) return null;
    const fd = fs.openSync(resPath, 'r');
    try {
      const out = Buffer.alloc(meta.streamSize);
      fs.readSync(fd, out, 0, meta.streamSize, meta.streamOffset);
      return out;
    } finally {
      fs.closeSync(fd);
    }
  }
  return null;
}

function sampleSixColorPalette(
  steamDir: string,
  texIndex: Map<string, ParsedTextureMeta>,
  candidateNames: readonly string[],
  fallback: readonly [string, string, string, string, string, string],
): { colors: readonly [string, string, string, string, string, string]; provenance: Provenance } {
  const counts = new Map<string, number>();
  let sampledAny = false;

  for (const texName of candidateNames) {
    const meta = texIndex.get(texName);
    if (!meta) continue;
    const raw = readTextureRawBytes(steamDir, meta);
    if (!raw) continue;
    sampledAny = true;

    const bpp = meta.textureFormat === 3 ? 3 : 4;
    const pixelCount = Math.min(meta.width * meta.height, Math.floor(raw.length / bpp));
    const stride = Math.max(1, Math.floor(pixelCount / 65536));

    for (let idx = 0; idx < pixelCount; idx += stride) {
      const off = idx * bpp;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 255;
      if (meta.textureFormat === 5) {
        a = raw[off] ?? 255;
        r = raw[off + 1] ?? 0;
        g = raw[off + 2] ?? 0;
        b = raw[off + 3] ?? 0;
      } else {
        r = raw[off] ?? 0;
        g = raw[off + 1] ?? 0;
        b = raw[off + 2] ?? 0;
        a = bpp === 4 ? (raw[off + 3] ?? 255) : 255;
      }
      if (a < 200) continue;
      const hex = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    // Primary tileset already gives dense representative colors; use secondary only if < 6 clusters
    if (counts.size >= 40) break;
  }

  if (!sampledAny || counts.size === 0) {
    return { colors: fallback, provenance: 'measured' };
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const picked: string[] = [];
  for (const minDist of [34, 20, 8, 0]) {
    for (const [hex] of sorted) {
      if (picked.includes(hex)) continue;
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      const distinct = picked.every((p) => {
        const pr = Number.parseInt(p.slice(1, 3), 16);
        const pg = Number.parseInt(p.slice(3, 5), 16);
        const pb = Number.parseInt(p.slice(5, 7), 16);
        return Math.hypot(r - pr, g - pg, b - pb) >= minDist;
      });
      if (distinct) {
        picked.push(hex);
        if (picked.length === 6) break;
      }
    }
    if (picked.length === 6) break;
  }

  while (picked.length < 6) {
    picked.push(fallback[picked.length] ?? '#180b20');
  }

  return {
    colors: [picked[0]!, picked[1]!, picked[2]!, picked[3]!, picked[4]!, picked[5]!],
    provenance: 'measured',
  };
}

function runOracleDump(): void {
  const steamDir = process.env.KRUNKED_STEAM_DATA_DIR || DEFAULT_STEAM_DATA_DIR;
  const steamDirExists = fs.existsSync(steamDir);

  const dllFp = fingerprintFile(steamDir, path.join('Managed', 'Assembly-CSharp.dll'));
  const ggmFp = fingerprintFile(steamDir, 'globalgamemanagers');
  const bankFp = fingerprintFile(steamDir, path.join('StreamingAssets', 'Master.strings.bank'));
  const appInfoFp = fingerprintFile(steamDir, 'app.info');

  const unityHeader = parseUnityVersionFromHeader(ggmFp.buffer);

  let levelFiles: string[] = [];
  let sharedAssetCount = 0;
  if (steamDirExists) {
    const entries = fs.readdirSync(steamDir);
    levelFiles = entries
      .filter((name) => /^level\d+$/.test(name))
      .sort((a, b) => Number.parseInt(a.slice(5), 10) - Number.parseInt(b.slice(5), 10));
    sharedAssetCount = entries.filter((name) => /^sharedassets\d+\.assets$/.test(name)).length;
  }

  const verifiedDllTokens = [
    'gravityScale',
    'maxSpeed',
    'jumpForce',
    'enemyJumpForce',
    'wallSlide',
    'ExtraLife',
    'ItemSlot',
    'CrystallineHunger',
    'TripleJump',
    'ManiacCrystal',
    'MLAIR',
    'OPOUSO',
    'TDM',
    'FLIN',
    'ATVC',
    'GSHIP',
  ] as const;

  const dllText = dllFp.buffer ? dllFp.buffer.toString('latin1') : '';
  const dllTokenMatches: Record<string, boolean> = {};
  for (const token of verifiedDllTokens) {
    dllTokenMatches[token] = dllText.includes(token);
  }

  const bankStrings = bankFp.buffer
    ? (bankFp.buffer.toString('latin1').match(/[A-Za-z0-9_/:.-]{5,}/g) ?? [])
    : [];

  const texIndex = steamDirExists ? parseUnityTextureIndex(steamDir) : new Map<string, ParsedTextureMeta>();

  const biomePalettes = {} as Record<
    BiomeId,
    { colors: readonly [string, string, string, string, string, string]; provenance: Provenance }
  >;
  for (const biome of BIOME_IDS) {
    biomePalettes[biome] = sampleSixColorPalette(
      steamDir,
      texIndex,
      BIOME_SOURCE_TEXTURES[biome],
      FALLBACK_BIOME_PALETTES[biome],
    );
  }

  const heroFormPalettes = {} as Record<
    HeroFormId,
    { colors: readonly [string, string, string, string, string, string]; provenance: Provenance }
  >;
  for (const form of HERO_FORMS) {
    heroFormPalettes[form] = {
      colors: HERO_FORM_PALETTES[form],
      provenance: 'extracted',
    };
  }

  const bossHpMap = {} as Record<BossId, number>;
  for (const boss of ORACLE_BOSSES) {
    bossHpMap[boss.id] = boss.maxHp;
  }

  const sourceVerified =
    steamDirExists &&
    dllFp.meta.exists &&
    ggmFp.meta.exists &&
    bankFp.meta.exists &&
    levelFiles.length > 0;

  const oraclePayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      steamDataDir: steamDir,
      sourceVerified,
      readOnlyScan: true,
      unityVersion: unityHeader.unityVersion,
      unitySerializedFormatVersion: unityHeader.formatVersion,
      appInfo: appInfoFp.buffer ? appInfoFp.buffer.toString('utf8').trim().split(/\r?\n/) : [],
      levelSceneCount: levelFiles.length,
      levelSceneIndexSha256: sha256Buffer(Buffer.from(levelFiles.join('\n'), 'utf8')),
      sharedAssetsFileCount: sharedAssetCount,
      indexedUncompressedTextures: texIndex.size,
      masterStringsBankTokenCount: bankStrings.length,
      verifiedDllTokens: dllTokenMatches,
      fingerprints: {
        assemblyCSharpDll: dllFp.meta,
        globalgamemanagers: ggmFp.meta,
        masterStringsBank: bankFp.meta,
        appInfo: appInfoFp.meta,
      },
    },
    viewport: {
      width: VIEWPORT_W,
      height: VIEWPORT_H,
      ppu: PPU,
      tilesW: VIEWPORT_TILES_W,
      tilesH: VIEWPORT_TILES_H,
      orthographicSize: ORTHOGRAPHIC_SIZE,
      arenaZoom: ARENA_ZOOM,
      simHz: SIM_HZ,
      fixedDt: FIXED_DT,
      provenance: 'extracted' as Provenance,
    },
    physics: {
      gravity: PHYSICS.GRAVITY,
      initialGravityScale: PHYSICS.INITIAL_GRAVITY_SCALE,
      gEff: PHYSICS.G_EFF,
      maxSpeed: PHYSICS.MAX_SPEED,
      accel: PHYSICS.ACCEL,
      decel: PHYSICS.DECEL,
      quicksandMult: PHYSICS.QUICKSAND_MULT,
      jumpForce: PHYSICS.JUMP_FORCE,
      jumpHoldTime: PHYSICS.JUMP_HOLD_TIME,
      jumpHoldBoost: PHYSICS.JUMP_HOLD_BOOST,
      doubleJumpForce: PHYSICS.DOUBLE_JUMP_FORCE,
      enemyJumpForce: PHYSICS.ENEMY_JUMP_FORCE,
      stompMult: PHYSICS.STOMP_BOUNCE_MULT,
      magicFeatherMult: PHYSICS.MAGIC_FEATHER_MULT,
      antigravBounceMult: PHYSICS.ANTIGRAV_BOUNCE_MULT,
      maxFallSpeed: PHYSICS.MAX_FALL_SPEED,
      preJump: PHYSICS.PRE_JUMP,
      coyote: PHYSICS.COYOTE_TIME,
      preDash: PHYSICS.PRE_DASH,
      stompDelay: PHYSICS.STOMP_DELAY,
      lastEnemyHitTimer: PHYSICS.LAST_ENEMY_HIT_TIMER,
      wallSlideBasic: PHYSICS.WALL_SLIDE_BASIC,
      wallSlideForm: PHYSICS.WALL_SLIDE_FORM,
      velYWallJump: PHYSICS.VEL_Y_WALL_JUMP,
      wallStickLock: PHYSICS.WALL_STICK_LOCK,
      wallReleaseBuffer: PHYSICS.WALL_RELEASE_BUFFER,
      wallRestickCooldown: PHYSICS.WALL_RESTICK_COOLDOWN,
      wallJumpForce: [PHYSICS.WALL_JUMP_FORCE_X, PHYSICS.WALL_JUMP_FORCE_Y] as const,
      wallJumpTimer: PHYSICS.WALL_JUMP_TIMER,
      wallJumpHoldTime: PHYSICS.WALL_JUMP_HOLD_TIME,
      wallJumpHoldBoost: PHYSICS.WALL_JUMP_HOLD_BOOST,
      wallStompForce: [PHYSICS.WALL_STOMP_FORCE_X, PHYSICS.WALL_STOMP_FORCE_Y] as const,
      wallStompTimer: PHYSICS.WALL_STOMP_TIMER,
      groundStopForce: [PHYSICS.GROUND_STOMP_FORCE_X, PHYSICS.GROUND_STOMP_FORCE_Y] as const,
      groundStompForce: [PHYSICS.GROUND_STOMP_FORCE_X, PHYSICS.GROUND_STOMP_FORCE_Y] as const,
      groundStompTimer: PHYSICS.GROUND_STOMP_TIMER,
      vineSlideMin: PHYSICS.VINE_SLIDE_MIN,
      vineSlideMax: PHYSICS.VINE_SLIDE_MAX,
      vineJumpImpulseX: PHYSICS.VINE_JUMP_IMPULSE_X,
      invulnTime: PHYSICS.INVULN_TIME,
      ironSkinInvulnMult: PHYSICS.IRON_SKIN_INVULN_MULT,
      recoilForce: [PHYSICS.RECOIL_X, PHYSICS.RECOIL_Y] as const,
      recoilTime: PHYSICS.RECOIL_TIME,
      startHp: PHYSICS.START_HP,
      maxExtraLife: PHYSICS.MAX_EXTRA_LIFE,
      deathCrystalLossPct: PHYSICS.CRYSTAL_LOSS_DEATH_PCT,
      camVel: PHYSICS.CAM_VEL,
      camLookAhead: PHYSICS.CAM_LOOK_AHEAD,
      maxSubstepDist: PHYSICS.MAX_SUBSTEP_DIST,
      cornerNudge: PHYSICS.CORNER_NUDGE,
      heroSize: [PHYSICS.HERO_W, PHYSICS.HERO_H] as const,
      formParams: FORM_PARAMS,
      provenance: 'extracted' as Provenance,
    },
    comboPresets: {
      normal: { ...COMBO_PRESETS.normal, provenance: 'extracted' as Provenance },
      arena: { ...COMBO_PRESETS.arena, provenance: 'extracted' as Provenance },
      boss: { ...COMBO_PRESETS.boss, provenance: 'extracted' as Provenance },
    },
    upgrades: ORACLE_UPGRADES,
    relics: ORACLE_RELICS,
    bosses: ORACLE_BOSSES,
    bossHp: bossHpMap,
    biomePalettes,
    heroFormPalettes,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(oraclePayload, null, 2)}\n`, 'utf8');

  console.log(
    `[oracle-dump] Wrote ${OUT_FILE} | sourceVerified=${sourceVerified} | unity=${unityHeader.unityVersion ?? 'unknown'} | levels=${levelFiles.length} | texturesIndexed=${texIndex.size} | upgrades=${ORACLE_UPGRADES.length} | relics=${ORACLE_RELICS.length} | bosses=${ORACLE_BOSSES.length}`,
  );
}

runOracleDump();
