/**
 * Krunked Quest — Tile, Parallax & Interactive Prop Renderer
 * Renders 3-layer atmospheric pixel-art parallax, 16-mask autotiled biome terrain,
 * animated hazards, moving platforms, and interactive props/NPCs.
 * Strictly integer-snapped, zero per-frame allocations!
 */

import {
  PPU,
  TileCode,
  VIEWPORT_H,
  VIEWPORT_W,
  type BiomeId,
  type DeviceGlyphMap,
  type IAssetPackManager,
  type InteractivePropDef,
  type RoomDef,
  type ShopId,
  type SimState,
} from '../contracts/index.js';
import {
  BIOME_PALETTES,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
} from '../assets/palettes.js';
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

function isDrawable(
  img: HTMLCanvasElement | HTMLImageElement | null | undefined,
): img is HTMLCanvasElement | HTMLImageElement {
  if (!img) return false;
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  }
  return img.width > 0 && img.height > 0;
}

function isSolidMaskTile(code: number): boolean {
  return code === TileCode.Solid || code === TileCode.SecretWall;
}

function wrapOffset(val: number, period: number): number {
  const m = val % period;
  return m < 0 ? m + period : m;
}

export class TileRenderer {
  public renderParallax(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    camX: number,
    camY: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
  ): void {
    const pSet = atlas.biomeParallax.get(biome);
    if (!pSet) {
      ctx.fillStyle = BIOME_PALETTES[biome].skyTop;
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
      return;
    }

    // Layer 0: Banded 16-bit sky + celestial body
    ctx.drawImage(pSet.sky, 0, 0);

    // Subtle vertical camera shift clamped cleanly so horizons never expose gaps
    const vShiftFar = Math.max(-24, Math.min(24, Math.round(camY * 2.5)));
    const vShiftMid = Math.max(-36, Math.min(36, Math.round(camY * 5.0)));
    const vShiftNear = Math.max(-44, Math.min(44, Math.round(camY * 8.0)));

    // Layer 1: Far silhouettes (0.08x horizontal scroll + subtle drift)
    const farW = pSet.far.width;
    const farOff = Math.round(wrapOffset(camX * PPU * 0.08 + timeSec * 1.5, farW));
    const farY = 124 + vShiftFar;
    for (let x = -farOff; x < VIEWPORT_W; x += farW) {
      ctx.drawImage(pSet.far, x, farY);
    }

    // Layer 2: Mid silhouettes (0.20x horizontal scroll)
    const midW = pSet.mid.width;
    const midOff = Math.round(wrapOffset(camX * PPU * 0.2, midW));
    const midY = 148 + vShiftMid;
    for (let x = -midOff; x < VIEWPORT_W; x += midW) {
      ctx.drawImage(pSet.mid, x, midY);
    }

    // Layer 3: Near silhouettes (0.42x horizontal scroll)
    const nearW = pSet.near.width;
    const nearOff = Math.round(wrapOffset(camX * PPU * 0.42, nearW));
    const nearY = 192 + vShiftNear;
    for (let x = -nearOff; x < VIEWPORT_W; x += nearW) {
      ctx.drawImage(pSet.near, x, nearY);
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

    // Resolve biome tileset (Custom Pack override -> ProceduralPixelAtlas fallback)
    const customTileset = customPack ? customPack.getBiomeTileset(state.biome) : null;
    const tileset = isDrawable(customTileset)
      ? customTileset
      : atlas.biomeTilesets.get(state.biome) ?? null;
    const decoSheet = atlas.biomeDeco.get(state.biome) ?? null;

    // Determine whether tileset is 16x1 strip (512x32) or 4x4 grid (128x128)
    const tilesetIs4x4 =
      tileset !== null && tileset.width < 512 && tileset.width >= 128 && tileset.height >= 128;

    // Visible tile bounds (small 1-tile padding covers zoom & camera shake cleanly)
    const minTx = Math.max(0, Math.floor(camX - 10.5));
    const maxTx = Math.min(rw - 1, Math.ceil(camX + 10.5));
    const minTy = Math.max(0, Math.floor(camY - 6.5));
    const maxTy = Math.min(rh - 1, Math.ceil(camY + 6.5));

    const anim2 = ((timeSec * 4) | 0) & 1;
    const anim4 = ((timeSec * 6) | 0) & 3;
    const hasSecretSight = (state.progress.upgradeLevels.ViewSecretAreas ?? 0) > 0;

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

            if (tilesetIs4x4) {
              const col = mask & 3;
              const row = (mask >> 2) & 3;
              ctx.drawImage(tileset, col * 32, row * 32, 32, 32, sx, sy, 32, 32);
            } else {
              ctx.drawImage(tileset, mask * 32, 0, 32, 32, sx, sy, 32, 32);
            }

            // Lush biome decorative tufts/flowers atop exposed surface tiles
            if (!up && code === TileCode.Solid && decoSheet) {
              const decoHash = ((tx * 37 + ty * 17) ^ (tx * 13)) & 15;
              if (decoHash < 8) {
                ctx.drawImage(decoSheet, decoHash * 16, 0, 16, 16, sx + ((tx * 7) & 15), sy - 15, 16, 16);
              }
            }

            // Secret wall subtle shimmer crack cue
            if (code === TileCode.SecretWall) {
              const crack = atlas.specialTiles.get('secret_crack');
              if (crack && (hasSecretSight || ((tx + ty + anim2) & 1) === 0)) {
                ctx.drawImage(crack, sx, sy);
              }
            }
          }
          continue;
        }

        // Special tiles
        switch (code) {
          case TileCode.OneWay: {
            const spr = this.resolveSprite(customPack, atlas.specialTiles, 'tile_oneway', 'oneway');
            if (spr) ctx.drawImage(spr, sx, sy);
            break;
          }
          case TileCode.Spike: {
            const spr = this.resolveSprite(customPack, atlas.specialTiles, 'tile_spike', 'spike');
            if (spr) ctx.drawImage(spr, sx, sy);
            break;
          }
          case TileCode.Breakable: {
            const spr = this.resolveSprite(customPack, atlas.specialTiles, 'tile_breakable', 'breakable');
            if (spr) ctx.drawImage(spr, sx, sy);
            break;
          }
          case TileCode.StoneOverhead: {
            const spr = this.resolveSprite(
              customPack,
              atlas.specialTiles,
              'tile_stone_overhead',
              'stone_overhead',
            );
            if (spr) ctx.drawImage(spr, sx, sy);
            break;
          }
          case TileCode.Bounce: {
            const spr = atlas.specialTiles.get('bounce');
            if (spr) ctx.drawImage(spr, anim2 * 32, 0, 32, 32, sx, sy, 32, 32);
            break;
          }
          case TileCode.Vine: {
            const spr = this.resolveSprite(customPack, atlas.specialTiles, 'tile_vine', 'vine');
            if (spr) ctx.drawImage(spr, sx, sy);
            break;
          }
          case TileCode.Acid: {
            const spr = atlas.specialTiles.get('acid');
            if (spr) ctx.drawImage(spr, anim4 * 32, 0, 32, 32, sx, sy, 32, 32);
            break;
          }
          case TileCode.Lava: {
            const spr = atlas.specialTiles.get('lava');
            if (spr) ctx.drawImage(spr, anim4 * 32, 0, 32, 32, sx, sy, 32, 32);
            break;
          }
          case TileCode.Quicksand: {
            const spr = atlas.specialTiles.get('quicksand');
            if (spr) ctx.drawImage(spr, anim2 * 32, 0, 32, 32, sx, sy, 32, 32);
            break;
          }
          case TileCode.Crumble: {
            const spr = atlas.specialTiles.get('crumble');
            if (spr) {
              const timer = state.crumbleTimers[idx];
              const jitter = timer !== undefined && timer > 0 ? (((timeSec * 45) | 0) & 1 ? -1 : 1) : 0;
              ctx.drawImage(spr, sx + jitter, sy);
            }
            break;
          }
          case TileCode.Explosive: {
            const spr = atlas.specialTiles.get('explosive');
            if (spr) ctx.drawImage(spr, anim2 * 32, 0, 32, 32, sx, sy, 32, 32);
            break;
          }
          case TileCode.Antigrav: {
            const spr = atlas.specialTiles.get('antigrav');
            if (spr) ctx.drawImage(spr, anim2 * 32, 0, 32, 32, sx, sy, 32, 32);
            break;
          }
          case TileCode.WindUp: {
            const spr = atlas.specialTiles.get('wind_up');
            if (spr) ctx.drawImage(spr, anim4 * 32, 0, 32, 32, sx, sy, 32, 32);
            break;
          }
          case TileCode.WindLeft: {
            const spr = atlas.specialTiles.get('wind_left');
            if (spr) ctx.drawImage(spr, anim4 * 32, 0, 32, 32, sx, sy, 32, 32);
            break;
          }
          case TileCode.WindRight: {
            const spr = atlas.specialTiles.get('wind_right');
            if (spr) ctx.drawImage(spr, anim4 * 32, 0, 32, 32, sx, sy, 32, 32);
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
        const lavaSpr = atlas.specialTiles.get('lava');
        if (lavaSpr) {
          const startX = -Math.round(wrapOffset(camX * PPU, 32));
          for (let x = startX; x < VIEWPORT_W + 32; x += 32) {
            ctx.drawImage(lavaSpr, anim4 * 32, 0, 32, 32, x, lavaTopY, 32, 32);
          }
        }
        if (lavaTopY + 32 < VIEWPORT_H) {
          ctx.fillStyle = '#8f141c';
          ctx.fillRect(0, lavaTopY + 32, VIEWPORT_W, VIEWPORT_H - (lavaTopY + 32));
        }
      }
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

    // 1. Dynamic moving platforms & crushers
    const platTile = atlas.specialTiles.get('moving_platform');
    const crushTile = atlas.specialTiles.get('crusher');
    for (let i = 0; i < state.platforms.length; i++) {
      const p = state.platforms[i]!;
      const wx = p.prevX + (p.x - p.prevX) * alpha;
      const wy = p.prevY + (p.y - p.prevY) * alpha;
      const sx = Math.round((wx - camX) * PPU + HALF_W);
      const sy = Math.round((camY - (wy + p.height)) * PPU + HALF_H);
      const pw = Math.max(16, Math.round(p.width * PPU));
      const ph = Math.max(12, Math.round(p.height * PPU));

      if (p.kind === 'crusher' && crushTile) {
        for (let ox = 0; ox < pw; ox += 32) {
          const w = Math.min(32, pw - ox);
          ctx.drawImage(crushTile, 0, 0, w, Math.min(32, ph), sx + ox, sy, w, ph);
        }
      } else if (platTile) {
        for (let ox = 0; ox < pw; ox += 32) {
          const w = Math.min(32, pw - ox);
          ctx.drawImage(platTile, 0, 0, w, 16, sx + ox, sy, w, Math.min(16, ph));
        }
      }
    }

    // 2. Room exits subtle glowing doorway cues (especially locked gates or doors)
    for (let i = 0; i < room.exits.length; i++) {
      const ex = room.exits[i]!;
      if (ex.dir !== 'door' && !ex.requiredForm && !ex.requiredCoins) continue;
      const sx = Math.round((ex.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - (ex.y + ex.height)) * PPU + HALF_H);
      const pw = Math.round(ex.width * PPU);
      const ph = Math.round(ex.height * PPU);
      if (sx + pw < -16 || sx > VIEWPORT_W + 16) continue;

      const glowCol = ex.requiredForm
        ? HERO_FORM_PALETTES[ex.requiredForm][0]
        : UI_COLORS.frameGold;
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(sx, sy, pw, ph);
      ctx.fillStyle = glowCol;
      ctx.fillRect(sx + 2, sy + 2, Math.max(2, pw - 4), Math.max(2, ph - 4));
      ctx.fillStyle = '#1b0f30';
      ctx.fillRect(sx + 4, sy + 4, Math.max(2, pw - 8), Math.max(2, ph - 8));
      if (ex.label) {
        font.draw(ctx, ex.label, sx + (pw >> 1), sy - 11, 'gold', 1, 'center', true);
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
      if (sx < -64 || sx > VIEWPORT_W + 64 || syBase < -64 || syBase > VIEWPORT_H + 80) continue;

      this.renderProp(ctx, prop, state, sx, syBase, anim2, timeSec, atlas, customPack, font, glyphs);
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

  private renderProp(
    ctx: CanvasRenderingContext2D,
    prop: InteractivePropDef,
    state: SimState,
    sx: number,
    syBase: number,
    anim2: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
    font: PixelFont,
    glyphs: DeviceGlyphMap,
  ): void {
    switch (prop.kind) {
      case 'shop_npc': {
        const shopId = prop.shopId ?? 'codex';
        const customNpc = customPack ? customPack.getSprite(`npc_${shopId}`) : null;
        if (isDrawable(customNpc)) {
          ctx.drawImage(customNpc, sx - (customNpc.width >> 1), syBase - customNpc.height);
        } else {
          const sheet = atlas.npcs.get(shopId);
          if (sheet) {
            ctx.drawImage(sheet, anim2 * 36, 0, 36, 40, sx - 18, syBase - 40, 36, 40);
          }
        }
        // Crisp NPC floating name + interact speech pill when near hero
        const isActive = state.activeShopPrompt === shopId;
        const shortName = NPC_DISPLAY_NAMES[shopId];
        if (isActive) {
          const bob = Math.round(Math.sin(timeSec * 6) * 2);
          const pillText = `[${glyphs.interact}] ${prop.label ?? shortName}`;
          const tw = font.measure(pillText, 1);
          const px = Math.round(sx - tw * 0.5 - 5);
          const py = syBase - 55 + bob;
          ctx.fillStyle = OUTLINE_DARK;
          ctx.fillRect(px - 1, py - 1, tw + 12, 13);
          ctx.fillStyle = UI_COLORS.frameGold;
          ctx.fillRect(px, py, tw + 10, 11);
          ctx.fillStyle = UI_COLORS.panelBg;
          ctx.fillRect(px + 1, py + 1, tw + 8, 9);
          font.draw(ctx, pillText, sx, py + 2, 'gold', 1, 'center', false);
        } else {
          font.draw(ctx, shortName, sx, syBase - 49, 'cream', 1, 'center', true);
        }
        break;
      }

      case 'volt_node': {
        const spr = atlas.props.get('volt_node');
        if (spr) {
          const hover = Math.round(Math.sin(timeSec * 5 + prop.x) * 2);
          ctx.drawImage(spr, anim2 * 32, 0, 32, 32, sx - 16, syBase - 32 + hover, 32, 32);
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
        const spr = atlas.props.get(`totem_${form}`);
        if (spr) {
          ctx.drawImage(spr, sx - 18, syBase - 44);
        }
        const pal = HERO_FORM_PALETTES[form];
        // Floating glow motes around totem orb
        const pulse = Math.round(Math.sin(timeSec * 4 + prop.x) * 3);
        ctx.fillStyle = pal[4];
        ctx.fillRect(sx - 12, syBase - 34 + pulse, 2, 2);
        ctx.fillRect(sx + 10, syBase - 30 - pulse, 2, 2);
        if (prop.label) {
          font.draw(ctx, prop.label, sx, syBase - 54, 'cyan', 1, 'center', true);
        }
        break;
      }

      case 'chest': {
        const opened = state.progress.openedChests.includes(prop.id);
        const spr = atlas.props.get(opened ? 'chest_open' : 'chest_closed');
        if (spr) {
          ctx.drawImage(spr, sx - 16, syBase - 28);
        }
        if (!opened && anim2 === 0) {
          ctx.fillStyle = HIGHLIGHT_CREAM;
          ctx.fillRect(sx - 1, syBase - 18, 2, 2);
        }
        break;
      }

      case 'teleporter': {
        const spr = atlas.props.get('teleporter');
        const unlocked = state.progress.unlockedTeleporters.includes(state.roomId);
        if (spr) {
          ctx.drawImage(spr, (unlocked ? anim2 : 0) * 40, 0, 40, 48, sx - 20, syBase - 48, 40, 48);
        }
        font.draw(
          ctx,
          unlocked ? 'WARP' : 'PORTAL',
          sx,
          syBase - 57,
          unlocked ? 'cyan' : 'dim',
          1,
          'center',
          true,
        );
        break;
      }

      case 'save_shrine': {
        const spr = atlas.props.get('save_shrine');
        if (spr) {
          ctx.drawImage(spr, anim2 * 32, 0, 32, 40, sx - 16, syBase - 40, 32, 40);
        }
        break;
      }

      case 'signpost': {
        const spr = atlas.props.get('signpost');
        if (spr) {
          ctx.drawImage(spr, sx - 12, syBase - 28);
        }
        break;
      }

      case 'animal_house': {
        const spr = atlas.props.get('animal_house');
        if (spr) {
          ctx.drawImage(spr, sx - 24, syBase - 44);
        }
        if (prop.animalName) {
          const rescued = state.progress.rescuedAnimals.includes(prop.animalName);
          font.draw(
            ctx,
            prop.animalName,
            sx,
            syBase - 53,
            rescued ? 'green' : 'dim',
            1,
            'center',
            true,
          );
        }
        break;
      }

      case 'target_switch': {
        const spr = atlas.props.get('target_switch');
        const active = prop.targetId ? state.openedDoors.includes(prop.targetId) : false;
        if (spr) {
          ctx.drawImage(spr, (active ? 1 : 0) * 24, 0, 24, 24, sx - 12, syBase - 24, 24, 24);
        }
        break;
      }

      case 'target_door':
      case 'coin_door': {
        if (state.openedDoors.includes(prop.id)) break;
        const spr = atlas.props.get(prop.kind === 'coin_door' ? 'coin_door' : 'door_locked');
        if (spr) {
          ctx.drawImage(spr, sx, syBase - 64);
        }
        if (prop.kind === 'coin_door' && prop.requiredCoins !== undefined) {
          font.draw(ctx, `${prop.requiredCoins}`, sx + 16, syBase - 36, 'gold', 1, 'center', true);
        }
        break;
      }

      default:
        break;
    }
  }

  private resolveSprite(
    customPack: IAssetPackManager | null,
    fallbackMap: ReadonlyMap<string, HTMLCanvasElement>,
    customKey: string,
    fallbackKey: string,
  ): HTMLCanvasElement | HTMLImageElement | null {
    if (customPack) {
      const custom = customPack.getSprite(customKey);
      if (isDrawable(custom)) return custom;
    }
    return fallbackMap.get(fallbackKey) ?? null;
  }
}
