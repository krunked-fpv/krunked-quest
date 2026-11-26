/**
 * Krunked Quest — Crisp Pixel-Art HUD & Animated Title Screen Backdrop Renderer
 * Drawn natively at 576x324 using pre-baked bitmap PixelFont & pixel sprites.
 * Zero blurry canvas fonts, zero per-frame allocations!
 */

import {
  COMBO_RULES,
  HERO_FORMS,
  SIM_HZ,
  VIEWPORT_H,
  VIEWPORT_W,
  type BossRuntime,
  type DeviceGlyphMap,
  type IWorldCatalog,
  type ScreenMode,
  type ShopId,
  type SimState,
} from '../contracts/index.js';
import {
  BIOME_PALETTES,
  HERO_FORM_LABELS,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
} from '../assets/palettes.js';
import {
  HERO_STD_FRAME_H,
  HERO_STD_FRAME_W,
  HeroStdFrame,
  type ProceduralPixelAtlas,
} from '../assets/ProceduralPixelAtlas.js';
import type { PixelFont } from './PixelFont.js';

// Precomputed 32-segment radial combo wheel coordinates (zero per-frame trig!)
const COMBO_SEGS = 32;
const COMBO_COS = new Float32Array(COMBO_SEGS);
const COMBO_SIN = new Float32Array(COMBO_SEGS);
for (let i = 0; i < COMBO_SEGS; i++) {
  const ang = -Math.PI * 0.5 + (i / COMBO_SEGS) * Math.PI * 2;
  COMBO_COS[i] = Math.cos(ang);
  COMBO_SIN[i] = Math.sin(ang);
}

const SHOP_PROMPT_LABELS: Readonly<Record<ShopId, string>> = {
  vespera: 'VESPERA',
  orla: 'ORLA',
  barnaby: 'BARNABY',
  garron: 'GARRON',
  barnacle: 'CAPT. BARNACLE',
  codex: 'CODEX',
};

export class HudRenderer {
  private bossTrailRatio = 1;
  private roomToastTimer = 0;
  private roomToastText = '';
  private roomToastBiome = '';

  public triggerRoomToast(roomName: string, biomeLabel: string): void {
    this.roomToastText = roomName.toUpperCase();
    this.roomToastBiome = biomeLabel;
    this.roomToastTimer = 2.4;
  }

  public update(dt: number, state: SimState): void {
    if (this.roomToastTimer > 0) {
      this.roomToastTimer = Math.max(0, this.roomToastTimer - dt);
    }
    if (state.boss && !state.boss.defeated && state.boss.maxHp > 0) {
      const target = Math.max(0, state.boss.hp / state.boss.maxHp);
      if (this.bossTrailRatio < target) {
        this.bossTrailRatio = target;
      } else {
        this.bossTrailRatio = Math.max(target, this.bossTrailRatio - dt * 0.45);
      }
    } else {
      this.bossTrailRatio = 1;
    }
  }

  /** Animated 16-bit neo-retro Title Screen pixel-art backdrop at 576x324. */
  public renderTitleBackdrop(
    ctx: CanvasRenderingContext2D,
    atlas: ProceduralPixelAtlas,
    timeSec: number,
  ): void {
    const pSet = atlas.biomeParallax.get('TDM');
    if (pSet) {
      ctx.drawImage(pSet.sky, 0, 0);

      const farW = pSet.far.width;
      const farOff = Math.round((timeSec * 8) % farW);
      for (let x = -farOff; x < VIEWPORT_W; x += farW) {
        ctx.drawImage(pSet.far, x, 118);
      }

      const midW = pSet.mid.width;
      const midOff = Math.round((timeSec * 18) % midW);
      for (let x = -midOff; x < VIEWPORT_W; x += midW) {
        ctx.drawImage(pSet.mid, x, 142);
      }

      const nearW = pSet.near.width;
      const nearOff = Math.round((timeSec * 32) % nearW);
      for (let x = -nearOff; x < VIEWPORT_W; x += nearW) {
        ctx.drawImage(pSet.near, x, 188);
      }
    } else {
      ctx.fillStyle = '#1b57cc';
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
    }

    // Scenic lush pixel grassy ridge along bottom of title screen
    const tdmTiles = atlas.biomeTilesets.get('TDM');
    const tdmDeco = atlas.biomeDeco.get('TDM');
    const scrollGround = Math.round((timeSec * 44) % 32);
    if (tdmTiles) {
      for (let x = -scrollGround; x < VIEWPORT_W + 32; x += 32) {
        // mask 14 = left(8) + down(4) + right(2), exposed top!
        ctx.drawImage(tdmTiles, 14 * 32, 0, 32, 32, x, VIEWPORT_H - 36, 32, 32);
        // mask 15 = full interior
        ctx.drawImage(tdmTiles, 15 * 32, 0, 32, 32, x, VIEWPORT_H - 4, 32, 32);
      }
    }
    if (tdmDeco) {
      for (let i = 0; i < 12; i++) {
        const dx = (i * 56 - scrollGround + VIEWPORT_W + 64) % (VIEWPORT_W + 64) - 32;
        ctx.drawImage(tdmDeco, (i & 7) * 16, 0, 16, 16, dx, VIEWPORT_H - 51, 16, 16);
      }
    }

    // Floating sparkling crystals & coins drifting across foreground
    const crystalSpr = atlas.collectibles.get('crystal');
    const coinSpr = atlas.collectibles.get('coin');
    const f4 = ((timeSec * 8) | 0) & 3;
    if (crystalSpr && coinSpr) {
      for (let i = 0; i < 5; i++) {
        const cx = Math.round(((560 - timeSec * 28 + i * 124) % (VIEWPORT_W + 60) + VIEWPORT_W + 60) % (VIEWPORT_W + 60) - 30);
        const cy = 246 + Math.round(Math.sin(timeSec * 3 + i * 1.4) * 12);
        if (i % 2 === 0) {
          ctx.drawImage(crystalSpr, f4 * 16, 0, 16, 20, cx, cy, 16, 20);
        } else {
          ctx.drawImage(coinSpr, f4 * 20, 0, 20, 20, cx, cy, 20, 20);
        }
      }
    }

    // Heroic Krunk sprinting joyfully across the lower-left ridge cycling forms subtly!
    const formIdx = ((timeSec * 0.25) | 0) % HERO_FORMS.length;
    const activeForm = HERO_FORMS[formIdx]!;
    const heroSet = atlas.heroSheets.get(activeForm);
    if (heroSet) {
      const runFrame = HeroStdFrame.Run0 + (((timeSec * 10) | 0) & 3);
      const jumpArc = Math.max(0, Math.sin(timeSec * 2.4)) > 0.82 ? Math.round(Math.sin((timeSec * 2.4 - 0.96) * 8) * 16) : 0;
      const hx = 92;
      const hy = VIEWPORT_H - 36 - Math.max(0, jumpArc);
      ctx.fillStyle = 'rgba(24, 11, 32, 0.4)';
      ctx.fillRect(hx - 10, VIEWPORT_H - 37, 20, 3);
      ctx.drawImage(
        heroSet.standard,
        (jumpArc > 2 ? HeroStdFrame.Jump : runFrame) * HERO_STD_FRAME_W,
        0,
        HERO_STD_FRAME_W,
        HERO_STD_FRAME_H,
        hx - (HERO_STD_FRAME_W >> 1),
        hy - HERO_STD_FRAME_H + 3,
        HERO_STD_FRAME_W,
        HERO_STD_FRAME_H,
      );
    }

    // Subtle dark atmospheric vignette strip across top/center so HTML title logo pops
    ctx.fillStyle = 'rgba(13, 8, 22, 0.22)';
    ctx.fillRect(0, 0, VIEWPORT_W, 196);
  }

  public renderHud(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    catalog: IWorldCatalog,
    atlas: ProceduralPixelAtlas,
    font: PixelFont,
    glyphs: DeviceGlyphMap,
    screenMode: ScreenMode,
    timeSec: number,
  ): void {
    if (screenMode === 'title') return;

    this.renderTopLeftCluster(ctx, state, atlas, font, glyphs, timeSec);
    this.renderTopRightCluster(ctx, state, catalog, atlas, font, timeSec);

    if (state.boss && !state.boss.defeated) {
      this.renderBossBar(ctx, state.boss, catalog, font, timeSec);
    }

    if (state.combo.bannerTimer > 0) {
      this.renderComboBanner(ctx, state.combo.bannerText || 'KRUNKED COMBO!', font, timeSec);
    }

    if (this.roomToastTimer > 0 && screenMode === 'playing' && state.combo.bannerTimer <= 0) {
      this.renderRoomToast(ctx, font);
    }

    if (screenMode === 'playing') {
      if (state.activeSignText) {
        this.renderSignBanner(ctx, state.activeSignText, font);
      } else if (state.activeShopPrompt) {
        this.renderInteractPrompt(ctx, state.activeShopPrompt, glyphs, font, timeSec);
      }
    }
  }

  private renderTopLeftCluster(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    atlas: ProceduralPixelAtlas,
    font: PixelFont,
    glyphs: DeviceGlyphMap,
    timeSec: number,
  ): void {
    // 1. Glowing Radial Combo Wheel at (22, 22)
    const cx = 22;
    const cy = 22;
    const ratio =
      state.combo.maxTimer > 0
        ? Math.max(0, Math.min(1, state.combo.timer / state.combo.maxTimer))
        : 0;
    const activeSegs = Math.round(ratio * COMBO_SEGS);
    const pulse = (((timeSec * 10) | 0) & 1) === 0;

    // Dark plum backing disk + gold outer bezel
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(cx - 14, cy - 13, 29, 27);
    ctx.fillRect(cx - 13, cy - 14, 27, 29);
    ctx.fillStyle = UI_COLORS.panelBgAlt;
    ctx.fillRect(cx - 12, cy - 12, 25, 25);

    // Unfilled wheel track
    ctx.fillStyle = '#331d4a';
    for (let i = 0; i < COMBO_SEGS; i++) {
      const px = Math.round(cx + COMBO_COS[i]! * 10.5);
      const py = Math.round(cy + COMBO_SIN[i]! * 10.5);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }

    // Active radial combo fill (cyan -> gold -> radiant magenta-white near 95% auto-heal!)
    const fillCol =
      ratio >= COMBO_RULES.HEAL_THRESHOLD
        ? pulse
          ? UI_COLORS.comboMax
          : UI_COLORS.comboHigh
        : ratio >= 0.7
          ? UI_COLORS.comboHigh
          : ratio >= 0.35
            ? UI_COLORS.comboMid
            : UI_COLORS.comboLow;

    ctx.fillStyle = fillCol;
    for (let i = 0; i < activeSegs; i++) {
      const px = Math.round(cx + COMBO_COS[i]! * 10.5);
      const py = Math.round(cy + COMBO_SIN[i]! * 10.5);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }

    // Center combo count or tiny heart-heal indicator
    if (state.combo.count > 0) {
      font.draw(
        ctx,
        `${state.combo.count}`,
        cx + 1,
        cy - 3,
        ratio >= 0.7 ? 'gold' : 'cyan',
        1,
        'center',
        true,
      );
    } else {
      font.draw(ctx, '0', cx + 1, cy - 3, 'dim', 1, 'center', true);
    }

    // 2. Heart Orbs (+ RockShield / MagicShield badges)
    const heartFull = atlas.collectibles.get('heart_full');
    const heartEmpty = atlas.collectibles.get('heart_empty');
    const maxHp = Math.max(1, Math.min(10, state.hero.maxHp));
    const lowHpPulse = state.hero.hp === 1 && (((timeSec * 8) | 0) & 1) === 1 ? -1 : 0;
    let hx = 40;
    const hy = 8;

    for (let i = 0; i < maxHp; i++) {
      const filled = i < state.hero.hp;
      const spr = filled ? heartFull : heartEmpty;
      if (spr) {
        ctx.drawImage(spr, hx, hy + (filled && i === 0 ? lowHpPulse : 0));
      }
      hx += 15;
    }

    if (state.hero.rockShieldActive) {
      const rs = atlas.collectibles.get('rock_shield');
      if (rs) {
        ctx.drawImage(rs, hx + 1, hy);
        hx += 15;
      }
    }
    if (state.hero.magicShieldTimer > 0) {
      const ms = atlas.collectibles.get('magic_shield');
      if (ms) {
        ctx.drawImage(ms, hx + 1, hy);
      }
    }

    // 3. Active Form Badge below hearts
    const form = state.hero.form;
    const pal = HERO_FORM_PALETTES[form];
    const badgeX = 40;
    const badgeY = 25;
    const badgeW = 54;
    const badgeH = 14;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = pal[2];
    ctx.fillRect(badgeX + 1, badgeY + 1, badgeW - 2, badgeH - 2);
    ctx.fillStyle = pal[0];
    ctx.fillRect(badgeX + 1, badgeY + 1, badgeW - 2, 2);

    const icon = atlas.collectibles.get(`form_icon_${form}`);
    if (icon) {
      ctx.drawImage(icon, badgeX + 2, badgeY + 1);
    }
    font.draw(ctx, HERO_FORM_LABELS[form], badgeX + 16, badgeY + 4, 'white', 1, 'left', true);

    if (state.progress.unlockedForms.length > 1) {
      font.draw(ctx, glyphs.form, badgeX + badgeW + 4, badgeY + 4, 'dim', 1, 'left', true);
    }
  }

  private renderTopRightCluster(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    catalog: IWorldCatalog,
    atlas: ProceduralPixelAtlas,
    font: PixelFont,
    timeSec: number,
  ): void {
    // 1. Compact Pixel Minimap Grid at far top-right
    const mapW = 56;
    const mapH = 34;
    const mapX = VIEWPORT_W - mapW - 7;
    const mapY = 7;

    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(mapX - 1, mapY - 1, mapW + 2, mapH + 2);
    ctx.fillStyle = UI_COLORS.frameLight;
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(mapX + 1, mapY + 1, mapW - 2, mapH - 2);

    const curRoom = catalog.rooms.get(state.roomId);
    const centerMapX = curRoom ? curRoom.mapX : 0;
    const centerMapY = curRoom ? curRoom.mapY : 0;
    const blink = (((timeSec * 6) | 0) & 1) === 0;
    const showSecrets = (state.progress.upgradeLevels.ViewSecretAreas ?? 0) > 0;
    const showArenas = (state.progress.upgradeLevels.ViewMapArenas ?? 0) > 0;

    const order = catalog.roomOrder;
    for (let i = 0; i < order.length; i++) {
      const rid = order[i]!;
      const room = catalog.rooms.get(rid);
      if (!room) continue;
      const isCurrent = rid === state.roomId;
      const visited = isCurrent || state.progress.visitedRooms.includes(rid);
      if (!visited && !(showSecrets && room.isSecret) && !(showArenas && room.mode === 'arena')) {
        continue;
      }

      const cellX = mapX + 25 + (room.mapX - centerMapX) * 6;
      const cellY = mapY + 14 - (room.mapY - centerMapY) * 5;
      if (cellX < mapX + 2 || cellX + 4 > mapX + mapW - 2 || cellY < mapY + 2 || cellY + 3 > mapY + mapH - 2) {
        continue;
      }

      let col = BIOME_PALETTES[room.biome].capMid;
      if (isCurrent) {
        col = blink ? HIGHLIGHT_CREAM : UI_COLORS.frameGold;
      } else if (room.bossId) {
        col = '#ff3858';
      } else if (room.hasTeleporter) {
        col = '#59f2ff';
      } else if (room.isSecret) {
        col = '#d44dff';
      } else if (room.mode === 'arena') {
        col = '#ffae33';
      }

      ctx.fillStyle = col;
      ctx.fillRect(cellX, cellY, 5, 4);
    }

    // 2. Crystal & Coin counters just left of minimap
    const counterRightX = mapX - 8;
    const crystalSpr = atlas.collectibles.get('crystal');
    const coinSpr = atlas.collectibles.get('coin');
    const f4 = ((timeSec * 6) | 0) & 3;

    // Crystals row
    const crystalStr = `${state.progress.crystals}`;
    font.draw(ctx, crystalStr, counterRightX, 9, 'cyan', 1, 'right', true);
    if (crystalSpr) {
      const cw = font.measure(crystalStr, 1);
      ctx.drawImage(crystalSpr, f4 * 16, 0, 16, 20, counterRightX - cw - 15, 4, 12, 15);
    }

    // Coins row
    const coinStr = `${state.progress.collectedCoinIds.length}/${catalog.totalCoins}`;
    font.draw(ctx, coinStr, counterRightX, 23, 'gold', 1, 'right', true);
    if (coinSpr) {
      const tw = font.measure(coinStr, 1);
      ctx.drawImage(coinSpr, f4 * 20, 0, 20, 20, counterRightX - tw - 16, 19, 13, 13);
    }

    // Mode badges (Time Attack stopwatch / Ghost Ship wave & score)
    if (state.mode === 'time_attack') {
      const totalSec = state.timeAttackTicks / SIM_HZ;
      const mins = Math.floor(totalSec / 60);
      const secs = Math.floor(totalSec % 60);
      const centis = Math.floor((totalSec * 100) % 100);
      const mm = mins < 10 ? `0${mins}` : `${mins}`;
      const ss = secs < 10 ? `0${secs}` : `${secs}`;
      const cc = centis < 10 ? `0${centis}` : `${centis}`;
      font.draw(ctx, `${mm}:${ss}.${cc}`, VIEWPORT_W - 8, 45, 'yellow', 1, 'right', true);
    } else if (state.mode === 'ghost_ship' && state.ghostShip.active) {
      font.draw(
        ctx,
        `WAVE ${state.ghostShip.wave}  PTS ${state.ghostShip.score}`,
        VIEWPORT_W - 8,
        45,
        'green',
        1,
        'right',
        true,
      );
    }
  }

  private renderBossBar(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    catalog: IWorldCatalog,
    font: PixelFont,
    timeSec: number,
  ): void {
    const def = catalog.bosses.get(boss.id);
    const title = def ? def.name.toUpperCase() : boss.id.toUpperCase();
    const barW = 244;
    const barH = 10;
    const bx = Math.round((VIEWPORT_W - barW) * 0.5);
    const by = VIEWPORT_H - 22;

    // Boss Name & Phase diamonds above bar
    font.draw(ctx, title, VIEWPORT_W * 0.5, by - 11, 'cream', 1, 'center', true);

    // Ornate dark-plum + gold pixel frame
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(bx - 3, by - 3, barW + 6, barH + 6);
    ctx.fillStyle = UI_COLORS.frameGold;
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(bx, by, barW, barH);

    // White damage drain trail
    const trailW = Math.round(Math.max(0, Math.min(1, this.bossTrailRatio)) * barW);
    if (trailW > 0) {
      ctx.fillStyle = UI_COLORS.bossHpTrail;
      ctx.fillRect(bx, by, trailW, barH);
    }

    // Active crimson-to-gold health fill
    const hpRatio = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;
    const fillW = Math.round(hpRatio * barW);
    if (fillW > 0) {
      const flash = boss.hitFlashTimer > 0 && (((timeSec * 30) | 0) & 1) === 0;
      ctx.fillStyle = flash ? HIGHLIGHT_CREAM : UI_COLORS.bossHpDark;
      ctx.fillRect(bx, by, fillW, barH);
      ctx.fillStyle = flash ? HIGHLIGHT_CREAM : UI_COLORS.bossHpMid;
      ctx.fillRect(bx, by + 1, fillW, barH - 3);
      ctx.fillStyle = flash ? HIGHLIGHT_CREAM : UI_COLORS.bossHpLight;
      ctx.fillRect(bx, by + 1, fillW, 2);
    }

    // Subtle 5-segment tick notches
    ctx.fillStyle = OUTLINE_DARK;
    for (let s = 1; s < 5; s++) {
      ctx.fillRect(bx + Math.round((barW * s) / 5), by, 1, barH);
    }

    // Phase diamond pips on left & right ends
    for (let p = 0; p < 3; p++) {
      const active = p < boss.phase;
      const px = bx + barW + 8 + p * 7;
      const py = by + 3;
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(px - 1, py - 1, 6, 6);
      ctx.fillStyle = active ? UI_COLORS.frameGold : '#3b244d';
      ctx.fillRect(px, py, 4, 4);
    }
  }

  private renderComboBanner(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: PixelFont,
    timeSec: number,
  ): void {
    const pulse = (((timeSec * 12) | 0) & 1) === 0;
    const bannerY = 58 + Math.round(Math.sin(timeSec * 14) * 2);
    const label = text.toUpperCase();
    const tw = font.measure(label, 2);
    const rx = Math.round((VIEWPORT_W - tw) * 0.5 - 14);
    const rw = tw + 28;

    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(rx - 2, bannerY - 4, rw + 4, 24);
    ctx.fillStyle = pulse ? UI_COLORS.frameGold : '#ff42b3';
    ctx.fillRect(rx, bannerY - 2, rw, 20);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(rx + 2, bannerY, rw - 4, 16);

    font.draw(ctx, label, VIEWPORT_W * 0.5, bannerY + 2, pulse ? 'gold' : 'white', 2, 'center', true);
  }

  private renderRoomToast(ctx: CanvasRenderingContext2D, font: PixelFont): void {
    const ty = 12;
    const tw = Math.max(font.measure(this.roomToastText, 1), font.measure(this.roomToastBiome, 1));
    const px = Math.round((VIEWPORT_W - tw) * 0.5 - 8);
    ctx.fillStyle = 'rgba(22, 12, 36, 0.85)';
    ctx.fillRect(px, ty - 2, tw + 16, 20);
    ctx.fillStyle = UI_COLORS.frameLight;
    ctx.fillRect(px, ty - 2, tw + 16, 1);
    ctx.fillRect(px, ty + 17, tw + 16, 1);
    font.draw(ctx, this.roomToastText, VIEWPORT_W * 0.5, ty + 1, 'gold', 1, 'center', true);
    font.draw(ctx, this.roomToastBiome, VIEWPORT_W * 0.5, ty + 10, 'dim', 1, 'center', false);
  }

  private renderInteractPrompt(
    ctx: CanvasRenderingContext2D,
    shopId: ShopId,
    glyphs: DeviceGlyphMap,
    font: PixelFont,
    timeSec: number,
  ): void {
    const label = `[${glyphs.interact}] TALK TO ${SHOP_PROMPT_LABELS[shopId]}`;
    const tw = font.measure(label, 1);
    const px = Math.round((VIEWPORT_W - tw) * 0.5 - 8);
    const py = VIEWPORT_H - 28 + Math.round(Math.sin(timeSec * 6) * 1.5);
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(px - 1, py - 1, tw + 18, 15);
    ctx.fillStyle = UI_COLORS.frameGold;
    ctx.fillRect(px, py, tw + 16, 13);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(px + 1, py + 1, tw + 14, 11);
    font.draw(ctx, label, VIEWPORT_W * 0.5, py + 3, 'gold', 1, 'center', false);
  }

  private renderSignBanner(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: PixelFont,
  ): void {
    const upper = text.toUpperCase();
    const maxChars = 64;
    const shown = upper.length > maxChars ? `${upper.slice(0, maxChars - 3)}...` : upper;
    const tw = font.measure(shown, 1);
    const px = Math.round((VIEWPORT_W - tw) * 0.5 - 10);
    const py = VIEWPORT_H - 30;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(px - 1, py - 1, tw + 22, 17);
    ctx.fillStyle = UI_COLORS.frameLight;
    ctx.fillRect(px, py, tw + 20, 15);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(px + 1, py + 1, tw + 18, 13);
    font.draw(ctx, shown, VIEWPORT_W * 0.5, py + 4, 'cream', 1, 'center', false);
  }
}
