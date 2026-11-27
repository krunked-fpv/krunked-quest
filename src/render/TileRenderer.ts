/**
 * Krunked Quest — Tile, Multi-Layer Parallax & Interactive Prop Renderer
 * Supports both Custom Pack origin assets (normalized 512x64 16-mask + inner-corner
 * autotiles, 4-layer ParallaxLayerMeta backdrops, biome deco, oriented spikes,
 * animated special tiles, interactive props & foot-pivoted Hub NPCs) and upgraded
 * Built-In procedural art via BiomeArtBaker.
 * Strictly 576x324 (32 PPU) nearest-neighbor, integer pixel-snapped, zero per-frame allocations!
 */

import {
  PPU,
  TileCode,
  VIEWPORT_H,
  VIEWPORT_W,
  type BiomeId,
  type CustomPackEntry,
  type DeviceGlyphMap,
  type HeroFormId,
  type IAssetPackManager,
  type InteractivePropDef,
  type ParallaxLayerMeta,
  type RoomDef,
  type ShopId,
  type SimState,
  type SpriteAnimClip,
  type SpriteFrameRect,
} from '../contracts/index.js';
import {
  BIOME_PALETTES,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
} from '../assets/palettes.js';
import { getBuiltInWorldArt } from '../assets/BiomeArtBaker.js';
import type { ProceduralPixelAtlas } from '../assets/ProceduralPixelAtlas.js';
import type { PixelFont } from './PixelFont.js';

const HALF_W = VIEWPORT_W * 0.5; // 288
const HALF_H = VIEWPORT_H * 0.5; // 162

const NPC_DISPLAY_NAMES: Readonly<Record<ShopId, string>> = {
  vespera: 'VESPERA',
  orla: 'ORLA',
  barnaby: 'BARNABY',
  garron: 'GARRON',
  barnacle: 'CAPT. BARNACLE',
  codex: 'CODEX',
};

// Precomputed logical asset keys (zero per-frame string allocations in hot render loops)
const BIOME_BG_KEYS: Readonly<Record<BiomeId, readonly [string, string, string, string]>> = {
  MLAIR: ['bg/MLAIR', 'bg/MLAIR_far', 'bg/MLAIR_mid', 'bg/MLAIR_near'],
  OPOUSO: ['bg/OPOUSO', 'bg/OPOUSO_far', 'bg/OPOUSO_mid', 'bg/OPOUSO_near'],
  TDM: ['bg/TDM', 'bg/TDM_far', 'bg/TDM_mid', 'bg/TDM_near'],
  FLIN: ['bg/FLIN', 'bg/FLIN_far', 'bg/FLIN_mid', 'bg/FLIN_near'],
  AP: ['bg/AP', 'bg/AP_far', 'bg/AP_mid', 'bg/AP_near'],
  ATVC: ['bg/ATVC', 'bg/ATVC_far', 'bg/ATVC_mid', 'bg/ATVC_near'],
  DSI: ['bg/DSI', 'bg/DSI_far', 'bg/DSI_mid', 'bg/DSI_near'],
  LAB: ['bg/LAB', 'bg/LAB_far', 'bg/LAB_mid', 'bg/LAB_near'],
  TEMP: ['bg/TEMP', 'bg/TEMP_far', 'bg/TEMP_mid', 'bg/TEMP_near'],
  EVIL: ['bg/EVIL', 'bg/EVIL_far', 'bg/EVIL_mid', 'bg/EVIL_near'],
  GSHIP: ['bg/GSHIP', 'bg/GSHIP_far', 'bg/GSHIP_mid', 'bg/GSHIP_near'],
};

const BIOME_TILE_KEYS: Readonly<Record<BiomeId, string>> = {
  MLAIR: 'tiles/MLAIR',
  OPOUSO: 'tiles/OPOUSO',
  TDM: 'tiles/TDM',
  FLIN: 'tiles/FLIN',
  AP: 'tiles/AP',
  ATVC: 'tiles/ATVC',
  DSI: 'tiles/DSI',
  LAB: 'tiles/LAB',
  TEMP: 'tiles/TEMP',
  EVIL: 'tiles/EVIL',
  GSHIP: 'tiles/GSHIP',
};

const BIOME_DECO_KEYS: Readonly<Record<BiomeId, string>> = {
  MLAIR: 'deco/MLAIR',
  OPOUSO: 'deco/OPOUSO',
  TDM: 'deco/TDM',
  FLIN: 'deco/FLIN',
  AP: 'deco/AP',
  ATVC: 'deco/ATVC',
  DSI: 'deco/DSI',
  LAB: 'deco/LAB',
  TEMP: 'deco/TEMP',
  EVIL: 'deco/EVIL',
  GSHIP: 'deco/GSHIP',
};

const NPC_KEYS: Readonly<Record<ShopId, string>> = {
  vespera: 'npc/vespera',
  orla: 'npc/orla',
  barnaby: 'npc/barnaby',
  garron: 'npc/garron',
  barnacle: 'npc/barnacle',
  codex: 'npc/codex',
};

const FORM_TOTEM_KEYS: Readonly<Record<HeroFormId, string>> = {
  krunk_basic: 'tile/form_totem',
  krunk_fire: 'tile/form_totem_fire',
  krunk_leaf: 'tile/form_totem_leaf',
  krunk_rock: 'tile/form_totem_rock',
  krunk_electric: 'tile/form_totem_electric',
  krunk_shadow: 'tile/form_totem',
};

const BUILTIN_TOTEM_KEYS: Readonly<Record<HeroFormId, string>> = {
  krunk_basic: 'totem_krunk_basic',
  krunk_fire: 'totem_krunk_fire',
  krunk_leaf: 'totem_krunk_leaf',
  krunk_rock: 'totem_krunk_rock',
  krunk_electric: 'totem_krunk_electric',
  krunk_shadow: 'totem_krunk_shadow',
};

const DEFAULT_PARALLAX_LAYERS: readonly [
  ParallaxLayerMeta,
  ParallaxLayerMeta,
  ParallaxLayerMeta,
  ParallaxLayerMeta,
] = [
  { scrollX: 0.03, scrollY: 0.01, anchorY: 'top', tileX: true, fillViewport: true },
  { scrollX: 0.08, scrollY: 0.04, anchorY: 'bottom', tileX: true, fillViewport: false },
  { scrollX: 0.2, scrollY: 0.08, anchorY: 'bottom', tileX: true, fillViewport: false },
  { scrollX: 0.42, scrollY: 0.14, anchorY: 'bottom', tileX: true, fillViewport: false },
];

function isDrawable(
  img: HTMLCanvasElement | HTMLImageElement | null | undefined,
): img is HTMLCanvasElement | HTMLImageElement {
  if (!img) return false;
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  }
  return img.width > 0 && img.height > 0;
}

function getDrawableW(img: HTMLCanvasElement | HTMLImageElement): number {
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.naturalWidth || img.width;
  }
  return img.width;
}

function getDrawableH(img: HTMLCanvasElement | HTMLImageElement): number {
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.naturalHeight || img.height;
  }
  return img.height;
}

function isSolidMaskTile(code: number): boolean {
  return code === TileCode.Solid || code === TileCode.SecretWall;
}

function wrapOffset(val: number, period: number): number {
  if (period <= 0) return 0;
  const m = val % period;
  return m < 0 ? m + period : m;
}

function tileHash(tx: number, ty: number): number {
  let h = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Selects a SpriteFrameRect from a CustomPackEntry's clip or frames list (zero allocation).
 */
function selectEntryFrame(
  entry: CustomPackEntry | null,
  clipName: string | null,
  timeSec: number,
  fixedIndex = -1,
): SpriteFrameRect | null {
  if (!entry || !entry.frames || entry.frames.length === 0) return null;
  const frames = entry.frames;

  if (fixedIndex >= 0) {
    return frames[fixedIndex % frames.length] ?? frames[0] ?? null;
  }

  let clip: SpriteAnimClip | undefined;
  if (entry.clips) {
    if (clipName && entry.clips[clipName]) {
      clip = entry.clips[clipName];
    } else if (entry.clips.idle) {
      clip = entry.clips.idle;
    }
  }

  if (clip && clip.frames.length > 0) {
    const fps = clip.fps > 0 ? clip.fps : 6;
    const rawIdx = Math.floor(timeSec * fps);
    const step = clip.loop
      ? rawIdx % clip.frames.length
      : Math.min(rawIdx, clip.frames.length - 1);
    const frameIdx = clip.frames[step] ?? 0;
    return frames[frameIdx] ?? frames[0] ?? null;
  }

  if (frames.length === 1) return frames[0] ?? null;
  const idx = Math.floor(timeSec * 6) % frames.length;
  return frames[idx] ?? frames[0] ?? null;
}

/**
 * Checks whether a Custom Pack biome tileset is cleanly normalized (16-mask strip or 4x4 grid)
 * so we NEVER blindly slice un-normalized padded Unity atlases (e.g. 292x292 / 220x220 / 256x256).
 */
function isNormalizedCustomTileset(
  img: HTMLCanvasElement | HTMLImageElement,
  entry: CustomPackEntry | null,
): boolean {
  const layout = entry?.tileLayout;
  const w = getDrawableW(img);
  const h = getDrawableH(img);
  if (layout) {
    const ts = layout.tileSize > 0 ? layout.tileSize : 32;
    if (layout.format === 'strip16') {
      return w >= ts * 16 && h >= ts;
    }
    if (layout.format === 'grid4x4') {
      return w >= ts * 4 && h >= ts * 4;
    }
  }
  // Legacy fallback: accept only exact unpadded 512x32*N 16-mask strip or exact 128x128 4x4 grid
  if (w === 512 && h >= 32 && (h & 31) === 0) return true;
  if (w === 128 && h === 128) return true;
  return false;
}

export class TileRenderer {
  /**
   * Returns true when Custom Pack has at least one drawable parallax layer for this biome.
   */
  public hasCustomParallax(biome: BiomeId, customPack: IAssetPackManager | null): boolean {
    if (!customPack || !customPack.customPackEnabled) return false;
    const keys = BIOME_BG_KEYS[biome];
    for (let i = 0; i < 4; i++) {
      if (isDrawable(customPack.getSprite(keys[i]!))) {
        return true;
      }
    }
    return false;
  }

  public renderParallax(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    camX: number,
    camY: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null = null,
  ): void {
    const builtInArt = getBuiltInWorldArt();
    const pSet = builtInArt?.biomeParallax.get(biome) ?? atlas.biomeParallax.get(biome) ?? null;

    if (customPack && customPack.customPackEnabled && this.hasCustomParallax(biome, customPack)) {
      const keys = BIOME_BG_KEYS[biome];
      const skyImg = customPack.getSprite(keys[0]);

      // Base sky undercoat: use Built-In sky if sky layer missing, otherwise biome sky gradient safety fill
      if (!isDrawable(skyImg)) {
        if (pSet) {
          ctx.drawImage(pSet.sky, 0, 0);
        } else {
          ctx.fillStyle = BIOME_PALETTES[biome].skyTop;
          ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
        }
      } else {
        const pal = BIOME_PALETTES[biome];
        ctx.fillStyle = pal.skyTop;
        ctx.fillRect(0, 0, VIEWPORT_W, HALF_H);
        ctx.fillStyle = pal.skyBot;
        ctx.fillRect(0, HALF_H, VIEWPORT_W, VIEWPORT_H - HALF_H);
      }

      // Composite all 4 authentic origin parallax layers (sky -> far -> mid -> near)
      for (let i = 0; i < 4; i++) {
        const key = keys[i]!;
        const img = customPack.getSprite(key);
        if (!isDrawable(img)) continue;
        const entry = customPack.getEntry(key);
        const meta = entry?.parallax ?? DEFAULT_PARALLAX_LAYERS[i]!;
        this.drawParallaxLayer(ctx, img, entry, meta, camX, camY, timeSec);
      }
      return;
    }

    // Built-In upgraded 4-layer procedural pixel-art parallax
    if (!pSet) {
      ctx.fillStyle = BIOME_PALETTES[biome].skyTop;
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
      return;
    }

    ctx.drawImage(pSet.sky, 0, 0);

    const vShiftFar = Math.max(-24, Math.min(24, Math.round(camY * 2.5)));
    const vShiftMid = Math.max(-36, Math.min(36, Math.round(camY * 5.0)));
    const vShiftNear = Math.max(-44, Math.min(44, Math.round(camY * 8.0)));

    const farW = pSet.far.width;
    const farOff = Math.round(wrapOffset(camX * PPU * 0.08 + timeSec * 1.5, farW));
    const farY = 124 + vShiftFar;
    for (let x = -farOff; x < VIEWPORT_W; x += farW) {
      ctx.drawImage(pSet.far, x, farY);
    }

    const midW = pSet.mid.width;
    const midOff = Math.round(wrapOffset(camX * PPU * 0.2, midW));
    const midY = 148 + vShiftMid;
    for (let x = -midOff; x < VIEWPORT_W; x += midW) {
      ctx.drawImage(pSet.mid, x, midY);
    }

    const nearW = pSet.near.width;
    const nearOff = Math.round(wrapOffset(camX * PPU * 0.42, nearW));
    const nearY = 192 + vShiftNear;
    for (let x = -nearOff; x < VIEWPORT_W; x += nearW) {
      ctx.drawImage(pSet.near, x, nearY);
    }
  }

  private drawParallaxLayer(
    ctx: CanvasRenderingContext2D,
    img: HTMLCanvasElement | HTMLImageElement,
    entry: CustomPackEntry | null,
    meta: ParallaxLayerMeta,
    camX: number,
    camY: number,
    timeSec: number,
  ): void {
    const frame = selectEntryFrame(entry, 'idle', timeSec);
    const sx = frame ? frame.x : 0;
    const sy = frame ? frame.y : 0;
    const sw = frame ? frame.w : getDrawableW(img);
    const sh = frame ? frame.h : getDrawableH(img);
    if (sw < 4 || sh < 4) return;

    let drawW = sw;
    let drawH = sh;
    if (meta.fillViewport) {
      let scale = 1;
      if (sh < VIEWPORT_H) {
        scale = VIEWPORT_H / sh;
      }
      if (!meta.tileX && sw * scale < VIEWPORT_W) {
        scale = VIEWPORT_W / sw;
      }
      if (scale > 1.001) {
        drawW = Math.round(sw * scale);
        drawH = Math.round(sh * scale);
      }
    }

    let baseY = 0;
    if (meta.anchorY === 'center') {
      baseY = Math.round((VIEWPORT_H - drawH) * 0.5);
    } else if (meta.anchorY === 'bottom') {
      baseY = VIEWPORT_H - drawH;
    }
    const offY = Math.round(meta.offsetY ?? 0);
    const rawShiftY = Math.round((camY - 5.5) * PPU * meta.scrollY);
    let dy = baseY + offY + Math.max(-40, Math.min(40, rawShiftY));

    if (meta.fillViewport && drawH >= VIEWPORT_H) {
      const minDy = VIEWPORT_H - drawH;
      if (dy < minDy) dy = minDy;
      if (dy > 0) dy = 0;
    }

    if (meta.tileX) {
      const offX = Math.round(wrapOffset(camX * PPU * meta.scrollX, drawW));
      for (let x = -offX; x < VIEWPORT_W; x += drawW) {
        ctx.drawImage(img, sx, sy, sw, sh, x, dy, drawW, drawH);
      }
    } else {
      let dx = Math.round((VIEWPORT_W - drawW) * 0.5 - (camX - 9) * PPU * meta.scrollX);
      if (meta.fillViewport && drawW >= VIEWPORT_W) {
        const minDx = VIEWPORT_W - drawW;
        if (dx < minDx) dx = minDx;
        if (dx > 0) dx = 0;
      }
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, drawW, drawH);
    }
  }

  public renderTiles(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    room: RoomDef,
    camX: number,
    camY: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const tiles = state.roomTiles;
    const rw = room.widthTiles;
    const rh = room.heightTiles;
    const builtInArt = getBuiltInWorldArt();
    const specialMap = builtInArt?.specialTiles ?? atlas.specialTiles;

    // Resolve biome tileset (only use Custom Pack tileset when cleanly normalized!)
    const rawCustomTileset = customPack ? customPack.getBiomeTileset(state.biome) : null;
    const customTileEntry = customPack ? customPack.getEntry(BIOME_TILE_KEYS[state.biome]) : null;
    const useCustomTileset =
      isDrawable(rawCustomTileset) && isNormalizedCustomTileset(rawCustomTileset, customTileEntry);
    const tileset = useCustomTileset
      ? rawCustomTileset
      : builtInArt?.biomeTilesets.get(state.biome) ?? atlas.biomeTilesets.get(state.biome) ?? null;

    const tileLayout = useCustomTileset ? customTileEntry?.tileLayout ?? null : null;
    const tileSize = tileLayout && tileLayout.tileSize > 0 ? tileLayout.tileSize : 32;
    const tilesetIs4x4 = useCustomTileset
      ? tileLayout
        ? tileLayout.format === 'grid4x4'
        : tileset !== null && getDrawableW(tileset) === 128 && getDrawableH(tileset) === 128
      : false;
    const hasCustomInnerCorners = Boolean(
      useCustomTileset &&
        tileLayout?.hasInnerCorners &&
        tileset !== null &&
        getDrawableH(tileset) >= ((tileLayout.innerCornerRow ?? 1) + 1) * tileSize,
    );
    const customInnerRowY = (tileLayout?.innerCornerRow ?? 1) * tileSize;
    const customVariantCols =
      useCustomTileset &&
      tileLayout?.variantCols &&
      tileLayout.variantCols.length > 0 &&
      tileset !== null &&
      getDrawableH(tileset) >= tileSize * 2
        ? tileLayout.variantCols
        : null;

    const builtInInnerCorners = !useCustomTileset
      ? builtInArt?.biomeInnerCorners.get(state.biome) ?? null
      : null;
    const builtInVariantRows =
      !useCustomTileset && tileset !== null ? Math.max(1, (getDrawableH(tileset) / 32) | 0) : 1;

    // Biome deco (Origin deco/<BIOME> when Custom Pack active; Built-In deco only in Built-In mode)
    const customDecoImg = customPack ? customPack.getSprite(BIOME_DECO_KEYS[state.biome]) : null;
    const customDecoEntry = customPack ? customPack.getEntry(BIOME_DECO_KEYS[state.biome]) : null;
    const customDecoFrames =
      isDrawable(customDecoImg) && customDecoEntry?.frames && customDecoEntry.frames.length > 0
        ? customDecoEntry.frames
        : null;
    const builtInDecoSheet = !useCustomTileset
      ? builtInArt?.biomeDeco.get(state.biome) ?? atlas.biomeDeco.get(state.biome) ?? null
      : null;

    // Visible tile bounds (1-tile padding covers zoom & camera shake cleanly)
    const minTx = Math.max(0, Math.floor(camX - 10.5));
    const maxTx = Math.min(rw - 1, Math.ceil(camX + 10.5));
    const minTy = Math.max(0, Math.floor(camY - 6.5));
    const maxTy = Math.min(rh - 1, Math.ceil(camY + 6.5));

    const anim2 = ((timeSec * 4) | 0) & 1;
    const anim4 = ((timeSec * 6) | 0) & 3;
    const hasSecretSight = (state.progress.upgradeLevels.ViewSecretAreas ?? 0) > 0;
    const halfTs = tileSize >> 1;

    for (let ty = minTy; ty <= maxTy; ty++) {
      const rowOff = ty * rw;
      const sy = Math.round((camY - (ty + 1)) * PPU + HALF_H);
      for (let tx = minTx; tx <= maxTx; tx++) {
        const idx = rowOff + tx;
        const code = tiles[idx]!;
        if (code === TileCode.Empty) continue;
        const sx = Math.round((tx - camX) * PPU + HALF_W);

        if (code === TileCode.Solid || code === TileCode.SecretWall) {
          if (tileset) {
            const up = ty + 1 >= rh || isSolidMaskTile(tiles[(ty + 1) * rw + tx]!);
            const right = tx + 1 >= rw || isSolidMaskTile(tiles[rowOff + tx + 1]!);
            const down = ty - 1 < 0 || isSolidMaskTile(tiles[(ty - 1) * rw + tx]!);
            const left = tx - 1 < 0 || isSolidMaskTile(tiles[rowOff + tx - 1]!);
            const mask = (up ? 1 : 0) | (right ? 2 : 0) | (down ? 4 : 0) | (left ? 8 : 0);
            const tHash = tileHash(tx, ty);

            if (tilesetIs4x4) {
              const col = mask & 3;
              const row = (mask >> 2) & 3;
              ctx.drawImage(tileset, col * tileSize, row * tileSize, tileSize, tileSize, sx, sy, 32, 32);
            } else if (useCustomTileset) {
              // Normalized 512x64 strip16: interior solid variants (mask===15) pull from row 1 variantCols
              if (mask === 15 && customVariantCols !== null && (tHash & 3) !== 0) {
                const vCol = customVariantCols[tHash % customVariantCols.length]!;
                ctx.drawImage(tileset, vCol * tileSize, tileSize, tileSize, tileSize, sx, sy, 32, 32);
              } else {
                ctx.drawImage(tileset, mask * tileSize, 0, tileSize, tileSize, sx, sy, 32, 32);
              }

              // Concave inner-corner 16x16 quadrant compositing from row 1 cols 0..3 ([TR, TL, BR, BL])
              if (hasCustomInnerCorners) {
                if (up && right && ty + 1 < rh && tx + 1 < rw && !isSolidMaskTile(tiles[(ty + 1) * rw + tx + 1]!)) {
                  ctx.drawImage(tileset, halfTs, customInnerRowY, halfTs, halfTs, sx + 16, sy, 16, 16);
                }
                if (up && left && ty + 1 < rh && tx - 1 >= 0 && !isSolidMaskTile(tiles[(ty + 1) * rw + tx - 1]!)) {
                  ctx.drawImage(tileset, tileSize, customInnerRowY, halfTs, halfTs, sx, sy, 16, 16);
                }
                if (down && right && ty - 1 >= 0 && tx + 1 < rw && !isSolidMaskTile(tiles[(ty - 1) * rw + tx + 1]!)) {
                  ctx.drawImage(
                    tileset,
                    tileSize * 2 + halfTs,
                    customInnerRowY + halfTs,
                    halfTs,
                    halfTs,
                    sx + 16,
                    sy + 16,
                    16,
                    16,
                  );
                }
                if (down && left && ty - 1 >= 0 && tx - 1 >= 0 && !isSolidMaskTile(tiles[(ty - 1) * rw + tx - 1]!)) {
                  ctx.drawImage(
                    tileset,
                    tileSize * 3,
                    customInnerRowY + halfTs,
                    halfTs,
                    halfTs,
                    sx,
                    sy + 16,
                    16,
                    16,
                  );
                }
              }
            } else {
              // Built-In upgraded 3-variant 16-mask strip + crisp 8x8 inner-corner joins
              const vRow = builtInVariantRows > 1 ? tHash % builtInVariantRows : 0;
              ctx.drawImage(tileset, mask * 32, vRow * 32, 32, 32, sx, sy, 32, 32);

              if (builtInInnerCorners) {
                if (up && left && ty + 1 < rh && tx - 1 >= 0 && !isSolidMaskTile(tiles[(ty + 1) * rw + tx - 1]!)) {
                  ctx.drawImage(builtInInnerCorners, 0, 0, 8, 8, sx, sy, 8, 8);
                }
                if (up && right && ty + 1 < rh && tx + 1 < rw && !isSolidMaskTile(tiles[(ty + 1) * rw + tx + 1]!)) {
                  ctx.drawImage(builtInInnerCorners, 8, 0, 8, 8, sx + 24, sy, 8, 8);
                }
                if (down && left && ty - 1 >= 0 && tx - 1 >= 0 && !isSolidMaskTile(tiles[(ty - 1) * rw + tx - 1]!)) {
                  ctx.drawImage(builtInInnerCorners, 16, 0, 8, 8, sx, sy + 24, 8, 8);
                }
                if (down && right && ty - 1 >= 0 && tx + 1 < rw && !isSolidMaskTile(tiles[(ty - 1) * rw + tx + 1]!)) {
                  ctx.drawImage(builtInInnerCorners, 24, 0, 8, 8, sx + 24, sy + 24, 8, 8);
                }
              }
            }

            // Surface biome foliage/deco tufts atop exposed floor tiles with empty air above
            if (!up && code === TileCode.Solid && ty + 1 < rh && tiles[(ty + 1) * rw + tx] === TileCode.Empty) {
              if (customDecoFrames && customDecoImg) {
                if ((tHash & 7) < 2) {
                  const frame = customDecoFrames[(tHash >>> 3) % customDecoFrames.length]!;
                  if (frame.w <= 64 && frame.h <= 64) {
                    const jitterX = 6 + ((tHash >>> 8) % 20);
                    const effPivotY = frame.pivotY >= 0.75 ? frame.pivotY : 1.0;
                    const dx = Math.round(sx + jitterX - frame.w * frame.pivotX);
                    const dy = Math.round(sy + 2 - frame.h * effPivotY);
                    ctx.drawImage(customDecoImg, frame.x, frame.y, frame.w, frame.h, dx, dy, frame.w, frame.h);
                  }
                }
              } else if (builtInDecoSheet) {
                if ((tHash % 10) < 3) {
                  const decoIdx = (tHash >>> 4) & 7;
                  const jitterX = 2 + ((tHash >>> 8) % 14);
                  ctx.drawImage(builtInDecoSheet, decoIdx * 16, 0, 16, 16, sx + jitterX, sy - 15, 16, 16);
                }
              }
            }

            // Secret wall subtle shimmer crack cue
            if (code === TileCode.SecretWall) {
              const crack = specialMap.get('secret_crack');
              if (crack && (hasSecretSight || ((tx + ty + anim2) & 1) === 0)) {
                ctx.drawImage(crack, sx, sy);
              }
            }
          }
          continue;
        }

        // Special tiles (canonical slash keys for Custom Pack -> BiomeArtBaker Built-In fallback)
        switch (code) {
          case TileCode.OneWay: {
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/oneway', 'oneway', sx, sy, timeSec, 0, 'top');
            break;
          }
          case TileCode.Spike: {
            // Auto-orient spikes cleanly against adjacent floor/wall/ceiling solid tiles:
            // [0]=up (floor), [1]=right (left wall), [2]=down (ceiling), [3]=left (right wall)
            const downSolid = ty - 1 >= 0 && isSolidMaskTile(tiles[(ty - 1) * rw + tx]!);
            const leftSolid = tx - 1 >= 0 && isSolidMaskTile(tiles[rowOff + tx - 1]!);
            const upSolid = ty + 1 < rh && isSolidMaskTile(tiles[(ty + 1) * rw + tx]!);
            const rightSolid = tx + 1 < rw && isSolidMaskTile(tiles[rowOff + tx + 1]!);
            const spikeDir = downSolid ? 0 : leftSolid ? 1 : upSolid ? 2 : rightSolid ? 3 : 0;
            this.drawOrientedSpike(ctx, customPack, specialMap, sx, sy, spikeDir);
            break;
          }
          case TileCode.Breakable: {
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/breakable', 'breakable', sx, sy, timeSec, 0, 'fill');
            break;
          }
          case TileCode.StoneOverhead: {
            this.drawSpecialTile(
              ctx,
              customPack,
              specialMap,
              'tile/stone_overhead',
              'stone_overhead',
              sx,
              sy,
              timeSec,
              0,
              'fill',
            );
            break;
          }
          case TileCode.Bounce: {
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/bounce', 'bounce', sx, sy, timeSec, anim2, 'bottom');
            break;
          }
          case TileCode.Vine: {
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/vine', 'vine', sx, sy, timeSec, 0, 'fill');
            break;
          }
          case TileCode.Acid: {
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/acid', 'acid', sx, sy, timeSec, anim4, 'fill');
            break;
          }
          case TileCode.Lava: {
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/lava', 'lava', sx, sy, timeSec, anim4, 'fill');
            break;
          }
          case TileCode.Quicksand: {
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/quicksand', 'quicksand', sx, sy, timeSec, anim2, 'fill');
            break;
          }
          case TileCode.Crumble: {
            const timer = state.crumbleTimers[idx];
            const jitter = timer !== undefined && timer > 0 ? ((((timeSec * 45) | 0) & 1) ? -1 : 1) : 0;
            this.drawSpecialTile(
              ctx,
              customPack,
              specialMap,
              'tile/crumble',
              'crumble',
              sx + jitter,
              sy,
              timeSec,
              0,
              'top',
            );
            break;
          }
          case TileCode.Explosive: {
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/explosive', 'explosive', sx, sy, timeSec, anim2, 'fill');
            break;
          }
          case TileCode.Antigrav: {
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.52;
            const fieldTime = timeSec + (((tx * 3 + ty * 5) & 7) * 0.08);
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/antigrav', 'antigrav', sx, sy, fieldTime, anim2, 'center');
            ctx.globalAlpha = prevAlpha;
            break;
          }
          case TileCode.WindUp: {
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.52;
            const fieldTime = timeSec + (((tx * 3 + ty * 5) & 7) * 0.08);
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/wind_up', 'wind_up', sx, sy, fieldTime, anim4, 'fill');
            ctx.globalAlpha = prevAlpha;
            break;
          }
          case TileCode.WindLeft: {
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.52;
            const fieldTime = timeSec + (((tx * 3 + ty * 5) & 7) * 0.08);
            this.drawSpecialTile(ctx, customPack, specialMap, 'tile/wind_left', 'wind_left', sx, sy, fieldTime, anim4, 'fill');
            ctx.globalAlpha = prevAlpha;
            break;
          }
          case TileCode.WindRight: {
            const prevAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.52;
            const fieldTime = timeSec + (((tx * 3 + ty * 5) & 7) * 0.08);
            this.drawSpecialTile(
              ctx,
              customPack,
              specialMap,
              'tile/wind_right',
              'wind_right',
              sx,
              sy,
              fieldTime,
              anim4,
              'fill',
            );
            ctx.globalAlpha = prevAlpha;
            break;
          }
          default:
            break;
        }
      }
    }

    // Rising lava wave plane in Volcanic / special rooms
    if (room.risingLava && state.lavaY > 0) {
      const lavaTopY = Math.round((camY - state.lavaY) * PPU + HALF_H);
      if (lavaTopY < VIEWPORT_H) {
        const startX = -Math.round(wrapOffset(camX * PPU, 32));
        for (let x = startX; x < VIEWPORT_W + 32; x += 32) {
          this.drawSpecialTile(ctx, customPack, specialMap, 'tile/lava', 'lava', x, lavaTopY, timeSec, anim4, 'fill');
        }
        if (lavaTopY + 32 < VIEWPORT_H) {
          ctx.fillStyle = '#8f141c';
          ctx.fillRect(0, lavaTopY + 32, VIEWPORT_W, VIEWPORT_H - (lavaTopY + 32));
        }
      }
    }
  }

  private drawOrientedSpike(
    ctx: CanvasRenderingContext2D,
    customPack: IAssetPackManager | null,
    specialMap: ReadonlyMap<string, HTMLCanvasElement>,
    sx: number,
    sy: number,
    dir: number,
  ): void {
    if (customPack && customPack.customPackEnabled) {
      const img = customPack.getSprite('tile/spike');
      if (isDrawable(img)) {
        const entry = customPack.getEntry('tile/spike');
        const frame = selectEntryFrame(entry, null, 0, dir);
        if (frame) {
          ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, sx, sy, 32, 32);
          return;
        }
        const iw = getDrawableW(img);
        const ih = getDrawableH(img);
        if (iw >= 128 && ih === 32) {
          ctx.drawImage(img, (dir & 3) * 32, 0, 32, 32, sx, sy, 32, 32);
          return;
        }
        if (iw <= 64 && ih <= 64) {
          ctx.drawImage(img, 0, 0, iw, ih, sx, sy, 32, 32);
          return;
        }
      }
    }

    const spr = specialMap.get('spike');
    if (!spr) return;
    if (dir === 0) {
      ctx.drawImage(spr, sx, sy);
    } else {
      ctx.save();
      ctx.translate(sx + 16, sy + 16);
      ctx.rotate(dir * (Math.PI * 0.5));
      ctx.drawImage(spr, -16, -16);
      ctx.restore();
    }
  }

  private drawSpecialTile(
    ctx: CanvasRenderingContext2D,
    customPack: IAssetPackManager | null,
    specialMap: ReadonlyMap<string, HTMLCanvasElement>,
    customKey: string,
    fallbackKey: string,
    sx: number,
    sy: number,
    timeSec: number,
    fallbackFrameIdx: number,
    align: 'fill' | 'top' | 'bottom' | 'center',
  ): void {
    if (customPack && customPack.customPackEnabled) {
      const img = customPack.getSprite(customKey);
      if (isDrawable(img)) {
        const entry = customPack.getEntry(customKey);
        const frame = selectEntryFrame(entry, 'idle', timeSec);
        if (frame) {
          if (align === 'fill' || (frame.w === 32 && frame.h === 32)) {
            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, sx, sy, 32, 32);
          } else if (align === 'top') {
            const dh = Math.min(32, frame.h);
            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, sx, sy, 32, dh);
          } else if (align === 'bottom') {
            const dw = frame.w <= 64 ? frame.w : 32;
            const dh = frame.h <= 64 ? frame.h : 32;
            const dx = sx + ((32 - dw) >> 1);
            const dy = sy + (32 - dh);
            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
          } else {
            const dw = Math.min(32, frame.w);
            const dh = Math.min(32, frame.h);
            const dx = sx + ((32 - dw) >> 1);
            const dy = sy + ((32 - dh) >> 1);
            ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
          }
          return;
        }
        const iw = getDrawableW(img);
        const ih = getDrawableH(img);
        if (ih === 32 && iw >= 32 && (iw & 31) === 0) {
          const count = iw >> 5;
          const col = count > 1 ? fallbackFrameIdx % count : 0;
          ctx.drawImage(img, col * 32, 0, 32, 32, sx, sy, 32, 32);
          return;
        }
        if (iw <= 48 && ih <= 48) {
          const dw = Math.min(32, iw);
          const dh = Math.min(32, ih);
          const dx = sx + ((32 - dw) >> 1);
          const dy = align === 'top' ? sy : align === 'bottom' ? sy + (32 - dh) : sy + ((32 - dh) >> 1);
          ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
          return;
        }
      }
    }

    const spr = specialMap.get(fallbackKey);
    if (!spr) return;
    if (spr.width > 32) {
      const count = Math.max(1, spr.width >> 5);
      const col = fallbackFrameIdx % count;
      ctx.drawImage(spr, col * 32, 0, 32, 32, sx, sy, 32, 32);
    } else {
      ctx.drawImage(spr, sx, sy);
    }
  }

  public renderPlatformsAndProps(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    room: RoomDef,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
    font: PixelFont,
    glyphs: DeviceGlyphMap,
  ): void {
    const anim2 = ((timeSec * 3.5) | 0) & 1;
    const builtInArt = getBuiltInWorldArt();
    const specialMap = builtInArt?.specialTiles ?? atlas.specialTiles;
    const propsMap = builtInArt?.props ?? atlas.props;
    const npcsMap = builtInArt?.npcs ?? atlas.npcs;

    // 1. Dynamic moving platforms & crushers
    const customPlat = customPack ? customPack.getSprite('tile/moving_platform') : null;
    const customPlatEntry = customPack ? customPack.getEntry('tile/moving_platform') : null;
    const customPlatFrame = isDrawable(customPlat) ? selectEntryFrame(customPlatEntry, 'idle', timeSec) : null;

    const customCrush = customPack ? customPack.getSprite('tile/crusher') : null;
    const customCrushEntry = customPack ? customPack.getEntry('tile/crusher') : null;
    const customCrushFrame = isDrawable(customCrush) ? selectEntryFrame(customCrushEntry, 'idle', timeSec) : null;

    const platTile = specialMap.get('moving_platform');
    const crushTile = specialMap.get('crusher');

    for (let i = 0; i < state.platforms.length; i++) {
      const p = state.platforms[i]!;
      const wx = p.prevX + (p.x - p.prevX) * alpha;
      const wy = p.prevY + (p.y - p.prevY) * alpha;
      const sx = Math.round((wx - camX) * PPU + HALF_W);
      const sy = Math.round((camY - (wy + p.height)) * PPU + HALF_H);
      const pw = Math.max(16, Math.round(p.width * PPU));
      const ph = Math.max(12, Math.round(p.height * PPU));

      if (p.kind === 'crusher') {
        if (isDrawable(customCrush)) {
          const fx = customCrushFrame ? customCrushFrame.x : 0;
          const fy = customCrushFrame ? customCrushFrame.y : 0;
          const fw = customCrushFrame ? customCrushFrame.w : getDrawableW(customCrush);
          const fh = customCrushFrame ? customCrushFrame.h : getDrawableH(customCrush);
          if (fw > 0 && fh > 0 && fw <= 64 && fh <= 64) {
            for (let ox = 0; ox < pw; ox += 32) {
              const w = Math.min(32, pw - ox);
              ctx.drawImage(customCrush, fx, fy, Math.min(fw, w), fh, sx + ox, sy, w, ph);
            }
            continue;
          }
        }
        if (crushTile) {
          for (let ox = 0; ox < pw; ox += 32) {
            const w = Math.min(32, pw - ox);
            ctx.drawImage(crushTile, 0, 0, w, Math.min(32, ph), sx + ox, sy, w, ph);
          }
        }
      } else {
        if (isDrawable(customPlat)) {
          const fx = customPlatFrame ? customPlatFrame.x : 0;
          const fy = customPlatFrame ? customPlatFrame.y : 0;
          const fw = customPlatFrame ? customPlatFrame.w : getDrawableW(customPlat);
          const fh = customPlatFrame ? customPlatFrame.h : getDrawableH(customPlat);
          if (fw > 0 && fh > 0 && fw <= 96 && fh <= 48) {
            const drawH = Math.min(ph, Math.max(12, fh));
            for (let ox = 0; ox < pw; ox += 32) {
              const w = Math.min(32, pw - ox);
              ctx.drawImage(customPlat, fx, fy, Math.min(fw, w), fh, sx + ox, sy, w, drawH);
            }
            continue;
          }
        }
        if (platTile) {
          for (let ox = 0; ox < pw; ox += 32) {
            const w = Math.min(32, pw - ox);
            ctx.drawImage(platTile, 0, 0, w, 16, sx + ox, sy, w, Math.min(16, ph));
          }
        }
      }
    }

    // 2. Room exits — ornate carved pixel stone archway portals (doors & form/coin gates)
    const biomePal = BIOME_PALETTES[state.biome];
    for (let i = 0; i < room.exits.length; i++) {
      const ex = room.exits[i]!;
      if (ex.dir !== 'door' && !ex.requiredForm && !ex.requiredCoins) continue;
      const sx = Math.round((ex.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - (ex.y + ex.height)) * PPU + HALF_H);
      const pw = Math.max(28, Math.round(ex.width * PPU));
      const ph = Math.max(40, Math.round(ex.height * PPU));
      if (sx + pw < -24 || sx > VIEWPORT_W + 24) continue;

      const glowCol = ex.requiredForm
        ? HERO_FORM_PALETTES[ex.requiredForm][0]
        : UI_COLORS.frameGold;
      const glowHi = ex.requiredForm
        ? HERO_FORM_PALETTES[ex.requiredForm][4]
        : HIGHLIGHT_CREAM;
      const cx = sx + (pw >> 1);
      const pillarW = 6;
      const innerX = sx + pillarW;
      const innerW = Math.max(12, pw - pillarW * 2);
      const innerY = sy + 8;
      const innerH = Math.max(16, ph - 8);

      // Outer dark-plum outline silhouette (stepped arch crown + pillars + base plinths)
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(sx - 4, sy - 4, pw + 8, 9);
      ctx.fillRect(sx - 1, sy - 7, pw + 2, 5);
      ctx.fillRect(sx - 1, sy + 3, pw + 2, ph - 3);
      ctx.fillRect(sx - 3, sy + ph - 6, pw + 6, 6);

      // Carved stone lintel & stepped arch crown
      ctx.fillStyle = biomePal.earthDark;
      ctx.fillRect(sx - 3, sy - 3, pw + 6, 7);
      ctx.fillStyle = biomePal.earthMid;
      ctx.fillRect(sx - 2, sy - 3, pw + 4, 5);
      ctx.fillStyle = biomePal.earthLight;
      ctx.fillRect(sx - 2, sy - 3, pw + 4, 2);
      ctx.fillRect(sx, sy - 6, pw, 3);
      ctx.fillStyle = biomePal.earthMid;
      ctx.fillRect(sx + 1, sy - 5, pw - 2, 2);

      // Left & right carved stone masonry columns + base plinths
      ctx.fillStyle = biomePal.earthMid;
      ctx.fillRect(sx, sy + 4, pillarW, ph - 4);
      ctx.fillRect(sx + pw - pillarW, sy + 4, pillarW, ph - 4);
      ctx.fillStyle = biomePal.earthLight;
      ctx.fillRect(sx + 1, sy + 4, 2, ph - 8);
      ctx.fillRect(sx + pw - pillarW + 1, sy + 4, 2, ph - 8);
      ctx.fillStyle = biomePal.earthDeep;
      ctx.fillRect(sx + pillarW - 1, sy + 4, 1, ph - 4);
      ctx.fillRect(sx + pw - 1, sy + 4, 1, ph - 4);
      // Horizontal masonry mortar seams on pillars
      for (let my = sy + 14; my < sy + ph - 8; my += 12) {
        ctx.fillRect(sx, my, pillarW, 1);
        ctx.fillRect(sx + pw - pillarW, my, pillarW, 1);
      }
      // Grounded base plinth steps
      ctx.fillStyle = biomePal.earthDark;
      ctx.fillRect(sx - 2, sy + ph - 5, pillarW + 3, 4);
      ctx.fillRect(sx + pw - pillarW - 1, sy + ph - 5, pillarW + 3, 4);
      ctx.fillStyle = biomePal.earthLight;
      ctx.fillRect(sx - 2, sy + ph - 5, pillarW + 2, 1);
      ctx.fillRect(sx + pw - pillarW - 1, sy + ph - 5, pillarW + 2, 1);

      // Deep enchanted sanctuary portal interior + inner arched stone bevel
      ctx.fillStyle = '#120822';
      ctx.fillRect(innerX, innerY, innerW, innerH);
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(innerX, innerY, 3, 3);
      ctx.fillRect(innerX + innerW - 3, innerY, 3, 3);

      // Subtle glowing inner rune rim & animated shimmering portal veil
      const prevAlpha = ctx.globalAlpha;
      const pulse = 0.22 + 0.1 * Math.sin(timeSec * 3.2 + i);
      ctx.fillStyle = glowCol;
      ctx.globalAlpha = pulse;
      ctx.fillRect(innerX + 2, innerY + 2, Math.max(4, innerW - 4), Math.max(4, innerH - 2));
      ctx.globalAlpha = pulse * 0.9;
      ctx.fillStyle = glowHi;
      const coreW = Math.max(4, innerW >> 1);
      ctx.fillRect(cx - (coreW >> 1), innerY + 4, coreW, Math.max(4, innerH - 6));

      // Gently rising enchanted portal sparkles
      ctx.globalAlpha = 0.72;
      for (let m = 0; m < 3; m++) {
        const mx = innerX + 3 + ((m * 11 + 5) % Math.max(4, innerW - 6));
        const my = innerY + innerH - 3 - Math.round(wrapOffset(timeSec * (14 + m * 5) + m * 19, Math.max(8, innerH - 8)));
        ctx.fillStyle = m === 1 ? glowHi : glowCol;
        ctx.fillRect(mx, my, 2, 2);
      }
      ctx.globalAlpha = prevAlpha;

      // Central arch keystone crest & glowing gem
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(cx - 5, sy - 7, 10, 10);
      ctx.fillStyle = biomePal.earthLight;
      ctx.fillRect(cx - 4, sy - 6, 8, 8);
      ctx.fillStyle = glowCol;
      ctx.fillRect(cx - 2, sy - 4, 4, 4);
      ctx.fillStyle = glowHi;
      ctx.fillRect(cx - 1, sy - 3, 2, 2);

      if (ex.label) {
        font.draw(ctx, ex.label, cx, Math.max(26, sy - 17), 'gold', 1, 'center', true);
      }
    }

    // 3. Static & interactive room props + Hub NPCs
    for (let i = 0; i < room.props.length; i++) {
      const prop = room.props[i]!;
      if (
        prop.kind === 'moving_platform' ||
        prop.kind === 'crusher' ||
        prop.kind === 'spinning_platform'
      ) {
        continue;
      }

      const sx = Math.round((prop.x - camX) * PPU + HALF_W);
      const syBase = Math.round((camY - prop.y) * PPU + HALF_H);
      if (sx < -80 || sx > VIEWPORT_W + 80 || syBase < -80 || syBase > VIEWPORT_H + 96) continue;

      this.renderProp(ctx, prop, state, room, sx, syBase, anim2, timeSec, propsMap, npcsMap, customPack, font, glyphs);
    }

    // 4. Desert sandstorm wind streaks overlay
    if (room.sandstormDir) {
      const dir = room.sandstormDir;
      ctx.fillStyle = 'rgba(255, 224, 148, 0.35)';
      const shift = Math.round(timeSec * 220 * dir);
      for (let s = 0; s < 14; s++) {
        const rx = wrapOffset(s * 59 + shift, VIEWPORT_W + 40) - 20;
        const ry = (s * 29 + 17) % VIEWPORT_H;
        ctx.fillRect(rx, ry, 24, 1);
      }
    }
  }

  /**
   * Draws a foot-pivoted / clip-animated Custom Pack sprite at anchor (sx, syAnchor).
   * - anchorMode='bottom': rests sprite base on syAnchor (respects foot pivots >= 0.75, snaps center-pivoted sprites to bottom).
   * - anchorMode='center': centers sprite around (sx, syAnchor) (for hovering props like volt_node).
   * - maxHeight > 0: scales oversized sprites down cleanly preserving aspect ratio so they never clip terraces.
   * Returns rendered pixel height (> 0) if drawn, or 0 if caller should use Built-In fallback.
   * Guarded so giant uncropped multi-frame sheets without `frames` metadata are NEVER drawn raw.
   */
  private drawCustomFramedProp(
    ctx: CanvasRenderingContext2D,
    customPack: IAssetPackManager | null,
    key: string,
    clipName: string | null,
    sx: number,
    syAnchor: number,
    timeSec: number,
    maxUncroppedSize = 96,
    anchorMode: 'bottom' | 'center' = 'bottom',
    maxHeight = 0,
  ): number {
    if (!customPack || !customPack.customPackEnabled) return 0;
    const img = customPack.getSprite(key);
    if (!isDrawable(img)) return 0;

    const entry = customPack.getEntry(key);
    const frame = selectEntryFrame(entry, clipName, timeSec);
    if (frame) {
      let drawW = frame.w;
      let drawH = frame.h;
      if (maxHeight > 0 && frame.h > maxHeight) {
        const scale = maxHeight / frame.h;
        drawW = Math.max(1, Math.round(frame.w * scale));
        drawH = maxHeight;
      }
      const drawX = Math.round(sx - drawW * frame.pivotX);
      const effPivotY =
        anchorMode === 'center' ? 0.5 : frame.pivotY >= 0.75 ? frame.pivotY : 1.0;
      const drawY = Math.round(syAnchor - drawH * effPivotY);
      ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, drawX, drawY, drawW, drawH);
      return drawH;
    }

    const iw = getDrawableW(img);
    const ih = getDrawableH(img);
    if (iw <= maxUncroppedSize && ih <= maxUncroppedSize) {
      let drawW = iw;
      let drawH = ih;
      if (maxHeight > 0 && ih > maxHeight) {
        const scale = maxHeight / ih;
        drawW = Math.max(1, Math.round(iw * scale));
        drawH = maxHeight;
      }
      const drawY = anchorMode === 'center' ? Math.round(syAnchor - drawH * 0.5) : syAnchor - drawH;
      ctx.drawImage(img, 0, 0, iw, ih, Math.round(sx - drawW * 0.5), drawY, drawW, drawH);
      return drawH;
    }

    return 0;
  }

  private hasOverheadCeiling(room: RoomDef, propX: number, propY: number, checkTiles: number): boolean {
    const tx = Math.max(0, Math.min(room.widthTiles - 1, Math.floor(propX)));
    const startTy = Math.floor(propY) + 1;
    const endTy = Math.min(room.heightTiles - 1, startTy + checkTiles);
    for (let ty = startTy; ty <= endTy; ty++) {
      const code = room.tiles[ty * room.widthTiles + tx]!;
      if (code === TileCode.Solid || code === TileCode.OneWay || code === TileCode.SecretWall) {
        return true;
      }
    }
    return false;
  }

  private renderProp(
    ctx: CanvasRenderingContext2D,
    prop: InteractivePropDef,
    state: SimState,
    room: RoomDef,
    sx: number,
    syBase: number,
    anim2: number,
    timeSec: number,
    propsMap: ReadonlyMap<string, HTMLCanvasElement>,
    npcsMap: ReadonlyMap<ShopId, HTMLCanvasElement>,
    customPack: IAssetPackManager | null,
    font: PixelFont,
    glyphs: DeviceGlyphMap,
  ): void {
    switch (prop.kind) {
      case 'shop_npc': {
        const shopId = prop.shopId ?? 'codex';
        // Cap oversized Guardians (e.g. 128px Barnaby / 98px Barnacle) to 80px preserving aspect ratio
        // so they stand imposing without spearing through overhead Hub terraces or colliding with labels.
        let drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          NPC_KEYS[shopId],
          'idle',
          sx,
          syBase,
          timeSec,
          96,
          'bottom',
          80,
        );
        if (drawnH === 0) {
          const sheet = npcsMap.get(shopId);
          if (sheet) {
            ctx.drawImage(sheet, anim2 * 36, 0, 36, 40, sx - 18, syBase - 40, 36, 40);
            drawnH = 40;
          } else {
            drawnH = 40;
          }
        }

        // Dynamic NPC floating name + interact speech pill anchored cleanly above actual rendered head
        const isActive = state.activeShopPrompt === shopId;
        const shortName = NPC_DISPLAY_NAMES[shopId];
        const headClearY = syBase - Math.max(36, drawnH);
        if (isActive) {
          const bob = Math.round(Math.sin(timeSec * 6) * 2);
          const keyBadge = glyphs.interact.startsWith('[') ? glyphs.interact : `[${glyphs.interact}]`;
          const pillText = `${keyBadge} ${prop.label ?? shortName}`;
          const tw = font.measure(pillText, 1);
          const px = Math.round(sx - tw * 0.5 - 5);
          const py = Math.max(26, headClearY - 16) + bob;
          ctx.fillStyle = OUTLINE_DARK;
          ctx.fillRect(px - 1, py - 1, tw + 12, 13);
          ctx.fillStyle = UI_COLORS.frameGold;
          ctx.fillRect(px, py, tw + 10, 11);
          ctx.fillStyle = UI_COLORS.panelBg;
          ctx.fillRect(px + 1, py + 1, tw + 8, 9);
          font.draw(ctx, pillText, sx, py + 2, 'gold', 1, 'center', false);
        } else {
          font.draw(ctx, shortName, sx, Math.max(26, headClearY - 9), 'cream', 1, 'center', true);
        }
        break;
      }

      case 'volt_node': {
        const hover = Math.round(Math.sin(timeSec * 5 + prop.x) * 2);
        const drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          'tile/volt_node',
          'idle',
          sx,
          syBase - 16 + hover,
          timeSec,
          64,
          'center',
        );
        if (drawnH === 0) {
          const spr = propsMap.get('volt_node');
          if (spr) {
            ctx.drawImage(spr, anim2 * 32, 0, 32, 32, sx - 16, syBase - 32 + hover, 32, 32);
          }
        }
        // Subtle electric range ring cue when hero is in Volt form
        if (state.hero.form === 'krunk_electric') {
          ctx.fillStyle = anim2 === 0 ? '#66f7ff' : '#f2ff38';
          const cx = sx;
          const cy = syBase - 16;
          for (let a = 0; a < 8; a++) {
            const th = (a / 8) * Math.PI * 2 + timeSec * 2.5;
            ctx.fillRect(Math.round(cx + Math.cos(th) * 18), Math.round(cy + Math.sin(th) * 18), 2, 2);
          }
        }
        break;
      }

      case 'form_totem': {
        const form = prop.formId ?? 'krunk_basic';
        let drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          FORM_TOTEM_KEYS[form],
          'idle',
          sx,
          syBase,
          timeSec,
          96,
        );
        if (drawnH === 0 && FORM_TOTEM_KEYS[form] !== 'tile/form_totem') {
          drawnH = this.drawCustomFramedProp(ctx, customPack, 'tile/form_totem', 'idle', sx, syBase, timeSec, 96);
        }
        if (drawnH === 0) {
          const spr = propsMap.get(BUILTIN_TOTEM_KEYS[form]);
          if (spr) {
            ctx.drawImage(spr, sx - 18, syBase - 44);
          }
          drawnH = 44;
        }
        const pal = HERO_FORM_PALETTES[form];
        const pulse = Math.round(Math.sin(timeSec * 4 + prop.x) * 3);
        ctx.fillStyle = pal[4];
        ctx.fillRect(sx - 12, syBase - 34 + pulse, 2, 2);
        ctx.fillRect(sx + 10, syBase - 30 - pulse, 2, 2);
        if (prop.label) {
          font.draw(ctx, prop.label, sx, syBase - Math.max(44, drawnH) - 10, 'cyan', 1, 'center', true);
        }
        break;
      }

      case 'chest': {
        const opened = state.progress.openedChests.includes(prop.id);
        const drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          'tile/chest',
          opened ? 'open' : 'closed',
          sx,
          syBase,
          timeSec,
          64,
        );
        if (drawnH === 0) {
          const spr = propsMap.get(opened ? 'chest_open' : 'chest_closed');
          if (spr) {
            ctx.drawImage(spr, sx - 16, syBase - 28);
          }
        }
        if (!opened && anim2 === 0) {
          ctx.fillStyle = HIGHLIGHT_CREAM;
          ctx.fillRect(sx - 1, syBase - 18, 2, 2);
        }
        break;
      }

      case 'teleporter': {
        const unlocked = state.progress.unlockedTeleporters.includes(state.roomId);
        const lowCeiling = this.hasOverheadCeiling(room, prop.x, prop.y, 4);
        let drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          'tile/teleporter',
          unlocked ? 'idle' : 'locked',
          sx,
          syBase,
          timeSec,
          96,
          'bottom',
          lowCeiling ? 76 : 0,
        );
        if (drawnH === 0) {
          const spr = propsMap.get('teleporter');
          if (spr) {
            ctx.drawImage(spr, (unlocked ? anim2 : 0) * 40, 0, 40, 48, sx - 20, syBase - 48, 40, 48);
          }
          drawnH = 48;
        }
        font.draw(
          ctx,
          unlocked ? 'WARP' : 'PORTAL',
          sx,
          Math.max(26, syBase - Math.max(44, drawnH) - 9),
          unlocked ? 'cyan' : 'dim',
          1,
          'center',
          true,
        );
        break;
      }

      case 'save_shrine': {
        const drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          'tile/save_shrine',
          'idle',
          sx,
          syBase,
          timeSec,
          96,
        );
        if (drawnH === 0) {
          const spr = propsMap.get('save_shrine');
          if (spr) {
            ctx.drawImage(spr, anim2 * 32, 0, 32, 40, sx - 16, syBase - 40, 32, 40);
          }
        }
        break;
      }

      case 'signpost': {
        const drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          'tile/signpost',
          'idle',
          sx,
          syBase,
          timeSec,
          64,
        );
        if (drawnH === 0) {
          const spr = propsMap.get('signpost');
          if (spr) {
            ctx.drawImage(spr, sx - 12, syBase - 28);
          }
        }
        break;
      }

      case 'animal_house': {
        // Cap animal house height cleanly to <= 64px (aspect-preserved) so it sits cleanly between Hub terraces with visible label
        let drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          'tile/animal_house',
          'idle',
          sx,
          syBase,
          timeSec,
          96,
          'bottom',
          64,
        );
        if (drawnH === 0) {
          const spr = propsMap.get('animal_house');
          if (spr) {
            ctx.drawImage(spr, sx - 24, syBase - 44);
          }
          drawnH = 44;
        }
        if (prop.animalName) {
          const rescued = state.progress.rescuedAnimals.includes(prop.animalName);
          font.draw(
            ctx,
            prop.animalName,
            sx,
            Math.max(26, syBase - Math.max(44, drawnH) - 9),
            rescued ? 'green' : 'dim',
            1,
            'center',
            true,
          );
        }
        break;
      }

      case 'target_switch': {
        const active = prop.targetId ? state.openedDoors.includes(prop.targetId) : false;
        const drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          'tile/target_switch',
          active ? 'active' : 'idle',
          sx,
          syBase,
          timeSec,
          64,
        );
        if (drawnH === 0) {
          const spr = propsMap.get('target_switch');
          if (spr) {
            ctx.drawImage(spr, (active ? 1 : 0) * 24, 0, 24, 24, sx - 12, syBase - 24, 24, 24);
          }
        }
        break;
      }

      case 'target_door':
      case 'coin_door': {
        if (state.openedDoors.includes(prop.id)) break;
        const isCoin = prop.kind === 'coin_door';
        const customKey = isCoin ? 'tile/coin_door' : 'tile/door_locked';
        const drawnH = this.drawCustomFramedProp(
          ctx,
          customPack,
          customKey,
          'idle',
          sx + 16,
          syBase,
          timeSec,
          96,
        );
        if (drawnH === 0) {
          const spr = propsMap.get(isCoin ? 'coin_door' : 'door_locked');
          if (spr) {
            ctx.drawImage(spr, sx, syBase - 64);
          }
        }
        if (isCoin && prop.requiredCoins !== undefined) {
          font.draw(ctx, `${prop.requiredCoins}`, sx + 16, syBase - 36, 'gold', 1, 'center', true);
        }
        break;
      }

      default:
        break;
    }
  }
}
