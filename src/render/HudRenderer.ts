/**
 * Krunked Quest — Sculpted 16-Bit Pixel-Art HUD & Animated Title Screen Backdrop Renderer
 * Drawn natively at 576x324 using proportional beveled PixelFont, extracted origin HUD sprites
 * (when Custom Pack is active), and upgraded Built-In pixel sprites.
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
  type HeroFormId,
  type IAssetPackManager,
  type IWorldCatalog,
  type ScreenMode,
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
import {
  isDrawable,
  resolveCustomFrame,
  type SpriteSliceOut,
} from './EntityRenderer.js';
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

// Pre-allocated constant clip & layer lookup lists (ZERO per-frame allocations!)
const TITLE_PARALLAX_KEYS: readonly string[] = ['bg/TDM_far', 'bg/TDM_mid', 'bg/TDM_near'];
const TITLE_PARALLAX_SPEEDS: readonly number[] = [10, 20, 34];
const TITLE_HERO_JUMP_CLIPS: readonly string[] = ['jump', 'run', 'idle'];
const TITLE_HERO_RUN_CLIPS: readonly string[] = ['run', 'idle'];
const HUD_COMBO_FRAME: readonly string[] = ['part_0', 'frame', 'idle'];
const HUD_COMBO_DARK: readonly string[] = ['part_1', 'dark'];
const HUD_COMBO_RAINBOW: readonly string[] = ['part_3', 'rainbow'];
const HUD_COMBO_RED: readonly string[] = ['part_3', 'red'];

function wrapOffset(val: number, period: number): number {
  const m = val % period;
  return m < 0 ? m + period : m;
}

export class HudRenderer {
  private bossTrailRatio = 1;
  private roomToastTimer = 0;
  private roomToastMax = 2.6;
  private roomToastText = '';
  private roomToastBiome = '';
  private lastCrystals = -1;
  private lastCoins = -1;
  private lastHp = -1;
  private lastForm: HeroFormId | null = null;
  private crystalPopTimer = 0;
  private coinPopTimer = 0;
  private healPopTimer = 0;
  private formFlashTimer = 0;

  private readonly slice: SpriteSliceOut = {
    sx: 0,
    sy: 0,
    sw: 32,
    sh: 32,
    pivotX: 0.5,
    pivotY: 1.0,
    hasManifestRect: false,
    matchedClip: false,
  };

  public triggerRoomToast(roomName: string, biomeLabel: string): void {
    const upperRoom = roomName.toUpperCase();
    const upperBiome = biomeLabel.toUpperCase();
    // Deduplicate redundant "BIOME — CHAMBER" so biome isn't printed twice!
    let cleanTitle = upperRoom;
    const emDash = upperRoom.indexOf('—');
    const hyDash = upperRoom.indexOf(' - ');
    if (emDash > 0 && upperRoom.slice(0, emDash).trim() === upperBiome) {
      cleanTitle = upperRoom.slice(emDash + 1).trim();
    } else if (hyDash > 0 && upperRoom.slice(0, hyDash).trim() === upperBiome) {
      cleanTitle = upperRoom.slice(hyDash + 3).trim();
    }
    this.roomToastText = cleanTitle || upperRoom;
    this.roomToastBiome = cleanTitle === upperBiome ? '' : upperBiome;
    this.roomToastMax = 2.6;
    this.roomToastTimer = 2.6;
  }

  public update(dt: number, state: SimState): void {
    if (this.roomToastTimer > 0) {
      this.roomToastTimer = Math.max(0, this.roomToastTimer - dt);
    }
    if (this.crystalPopTimer > 0) this.crystalPopTimer = Math.max(0, this.crystalPopTimer - dt);
    if (this.coinPopTimer > 0) this.coinPopTimer = Math.max(0, this.coinPopTimer - dt);
    if (this.healPopTimer > 0) this.healPopTimer = Math.max(0, this.healPopTimer - dt);
    if (this.formFlashTimer > 0) this.formFlashTimer = Math.max(0, this.formFlashTimer - dt);

    // Reactive micro-pop triggers on pickups, heals, and form switches
    if (this.lastCrystals >= 0 && state.progress.crystals > this.lastCrystals) {
      this.crystalPopTimer = 0.24;
    }
    this.lastCrystals = state.progress.crystals;

    const coinCount = state.progress.collectedCoinIds.length;
    if (this.lastCoins >= 0 && coinCount > this.lastCoins) {
      this.coinPopTimer = 0.34;
    }
    this.lastCoins = coinCount;

    if (this.lastHp >= 0 && state.hero.hp > this.lastHp) {
      this.healPopTimer = 0.36;
    }
    this.lastHp = state.hero.hp;

    if (this.lastForm !== null && state.hero.form !== this.lastForm) {
      this.formFlashTimer = 0.28;
    }
    this.lastForm = state.hero.form;

    if (state.boss && !state.boss.defeated && state.boss.maxHp > 0) {
      const target = Math.max(0, state.boss.hp / state.boss.maxHp);
      if (this.bossTrailRatio < target) {
        this.bossTrailRatio = target;
      } else {
        this.bossTrailRatio = Math.max(target, this.bossTrailRatio - dt * 0.42);
      }
    } else {
      this.bossTrailRatio = 1;
    }
  }

  /** Animated 16-bit neo-retro Title Screen pixel-art backdrop at 576x324 (Custom Pack + Built-In). */
  public renderTitleBackdrop(
    ctx: CanvasRenderingContext2D,
    atlas: ProceduralPixelAtlas,
    timeSec: number,
    customPack: IAssetPackManager | null = null,
    skipParallax = false,
  ): void {
    // 1. Parallax Sky Backdrop
    if (!skipParallax) {
      const customBg = customPack ? (customPack.getSprite('bg/TDM') ?? customPack.getSprite('bg/OPOUSO')) : null;
      if (isDrawable(customBg)) {
        const bw =
          typeof HTMLImageElement !== 'undefined' && customBg instanceof HTMLImageElement
            ? customBg.naturalWidth || customBg.width
            : customBg.width;
        const bh =
          typeof HTMLImageElement !== 'undefined' && customBg instanceof HTMLImageElement
            ? customBg.naturalHeight || customBg.height
            : customBg.height;
        const drawH = VIEWPORT_H;
        const drawW = Math.max(VIEWPORT_W, Math.round((bw / Math.max(1, bh)) * drawH));
        const scrollOff = Math.round(wrapOffset(timeSec * 14, drawW));
        for (let x = -scrollOff; x < VIEWPORT_W; x += drawW) {
          ctx.drawImage(customBg, 0, 0, bw, bh, x, 0, drawW, drawH);
        }

        for (let li = 0; li < TITLE_PARALLAX_KEYS.length; li++) {
          const lImg = customPack ? customPack.getSprite(TITLE_PARALLAX_KEYS[li]!) : null;
          if (!isDrawable(lImg)) continue;
          const lw =
            typeof HTMLImageElement !== 'undefined' && lImg instanceof HTMLImageElement
              ? lImg.naturalWidth || lImg.width
              : lImg.width;
          const lh =
            typeof HTMLImageElement !== 'undefined' && lImg instanceof HTMLImageElement
              ? lImg.naturalHeight || lImg.height
              : lImg.height;
          const dH = Math.min(VIEWPORT_H, lh);
          const dW = Math.max(128, Math.round((lw / Math.max(1, lh)) * dH));
          const off = Math.round(wrapOffset(timeSec * TITLE_PARALLAX_SPEEDS[li]!, dW));
          const dy = VIEWPORT_H - dH;
          for (let x = -off; x < VIEWPORT_W; x += dW) {
            ctx.drawImage(lImg, 0, 0, lw, lh, x, dy, dW, dH);
          }
        }
      } else {
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
      }
    }

    // 1.5 Warm atmospheric fireflies & sunset sparkles drifting gently across the sky
    const prevAlpha = ctx.globalAlpha;
    for (let i = 0; i < 14; i++) {
      const fx = Math.round(wrapOffset(i * 47 - timeSec * (10 + (i % 4) * 4), VIEWPORT_W + 20) - 10);
      const fy = Math.round(42 + ((i * 39) % 190) + Math.sin(timeSec * 1.9 + i * 1.7) * 9);
      const tw = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(timeSec * 3.4 + i * 2.1));
      ctx.globalAlpha = tw;
      ctx.fillStyle = i % 3 === 0 ? '#ffd84d' : i % 3 === 1 ? '#ffb8ec' : '#fff6d6';
      if (i % 4 === 0) {
        ctx.fillRect(fx - 1, fy, 3, 1);
        ctx.fillRect(fx, fy - 1, 1, 3);
      } else {
        ctx.fillRect(fx, fy, 2, 2);
      }
    }
    ctx.globalAlpha = prevAlpha;

    // 2. Scenic lush pixel grassy ridge along bottom of title screen
    const rawCustomTiles = customPack ? customPack.getBiomeTileset('TDM') : null;
    const tilesEntry = customPack ? customPack.getEntry('tiles/TDM') : null;
    const customTilesValid =
      isDrawable(rawCustomTiles) &&
      (tilesEntry?.tileLayout?.format === 'strip16' ||
        (rawCustomTiles.width >= 512 && rawCustomTiles.height <= 128));
    const tdmTiles = customTilesValid ? rawCustomTiles : atlas.biomeTilesets.get('TDM');
    const tdmDeco = atlas.biomeDeco.get('TDM');
    const scrollGround = Math.round((timeSec * 44) % 32);
    if (tdmTiles) {
      for (let x = -scrollGround; x < VIEWPORT_W + 32; x += 32) {
        ctx.drawImage(tdmTiles, 14 * 32, 0, 32, 32, x, VIEWPORT_H - 36, 32, 32);
        ctx.drawImage(tdmTiles, 15 * 32, 0, 32, 32, x, VIEWPORT_H - 4, 32, 32);
      }
    }
    if (tdmDeco && !customTilesValid) {
      for (let i = 0; i < 12; i++) {
        const dx = ((i * 56 - scrollGround + VIEWPORT_W + 64) % (VIEWPORT_W + 64)) - 32;
        ctx.drawImage(tdmDeco, (i & 7) * 16, 0, 16, 16, dx, VIEWPORT_H - 51, 16, 16);
      }
    }

    // 3. Floating sparkling crystals & coins drifting across foreground
    const customCrystal = customPack ? customPack.getSprite('ui/crystal') : null;
    const customCoin = customPack ? customPack.getSprite('ui/coin') : null;
    const crystalSpr = atlas.collectibles.get('crystal');
    const coinSpr = atlas.collectibles.get('coin');
    const f4 = ((timeSec * 8) | 0) & 3;
    for (let i = 0; i < 5; i++) {
      const cx = Math.round(
        (((560 - timeSec * 28 + i * 124) % (VIEWPORT_W + 60)) + VIEWPORT_W + 60) % (VIEWPORT_W + 60) - 30,
      );
      const cy = 244 + Math.round(Math.sin(timeSec * 3 + i * 1.4) * 12);
      // Soft ambient aura glow behind collectible
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = i % 2 === 0 ? '#56ecff' : '#ffd84d';
      ctx.fillRect(cx + 2, cy + 2, 12, 12);
      ctx.globalAlpha = 1;
      if (i % 2 === 0) {
        if (isDrawable(customCrystal)) {
          resolveCustomFrame(customPack, 'ui/crystal', customCrystal, timeSec, 8, true, this.slice);
          ctx.drawImage(
            customCrystal,
            this.slice.sx,
            this.slice.sy,
            this.slice.sw,
            this.slice.sh,
            cx,
            cy,
            16,
            16,
          );
        } else if (crystalSpr) {
          ctx.drawImage(crystalSpr, f4 * 16, 0, 16, 20, cx, cy, 16, 20);
        }
      } else {
        if (isDrawable(customCoin)) {
          resolveCustomFrame(customPack, 'ui/coin', customCoin, timeSec, 8, true, this.slice);
          ctx.drawImage(
            customCoin,
            this.slice.sx,
            this.slice.sy,
            this.slice.sw,
            this.slice.sh,
            cx,
            cy,
            20,
            20,
          );
        } else if (coinSpr) {
          ctx.drawImage(coinSpr, f4 * 20, 0, 20, 20, cx, cy, 20, 20);
        }
      }
    }

    // 4. Heroic Krunk sprinting joyfully across the lower-left ridge cycling forms!
    const formIdx = ((timeSec * 0.25) | 0) % HERO_FORMS.length;
    const activeForm = HERO_FORMS[formIdx]!;
    const formPal = HERO_FORM_PALETTES[activeForm];
    const jumpArc =
      Math.max(0, Math.sin(timeSec * 2.4)) > 0.82
        ? Math.round(Math.sin((timeSec * 2.4 - 0.96) * 8) * 16)
        : 0;
    const hx = 82;
    const hy = VIEWPORT_H - 36 - Math.max(0, jumpArc);
    ctx.fillStyle = 'rgba(24, 11, 32, 0.42)';
    ctx.fillRect(hx - 10, VIEWPORT_H - 37, 20, 3);

    // Subtle trailing elemental dust behind Krunk on title screen
    ctx.globalAlpha = 0.55;
    for (let d = 0; d < 3; d++) {
      const dx = hx - 12 - d * 9 - (((timeSec * 44) | 0) % 7);
      const dy = VIEWPORT_H - 40 - d * 2 + (((d + ((timeSec * 8) | 0)) & 1) ? -1 : 1);
      ctx.fillStyle = d === 0 ? HIGHLIGHT_CREAM : formPal[4];
      ctx.fillRect(dx, dy, 3 - d, 3 - d);
    }
    ctx.globalAlpha = 1;

    const customHeroSheet = customPack ? customPack.getHeroSheet(activeForm) : null;
    if (isDrawable(customHeroSheet)) {
      const heroKey = `hero/${activeForm}`;
      const gridCols = activeForm === 'krunk_electric' || activeForm === 'krunk_shadow' ? 5 : 10;
      const gridRows = activeForm === 'krunk_electric' || activeForm === 'krunk_shadow' ? 2 : 1;
      resolveCustomFrame(
        customPack,
        heroKey,
        customHeroSheet,
        timeSec,
        12,
        true,
        this.slice,
        jumpArc > 2 ? TITLE_HERO_JUMP_CLIPS : TITLE_HERO_RUN_CLIPS,
        gridCols,
        gridRows,
      );
      const dw = this.slice.sw;
      const dh = this.slice.sh;
      ctx.drawImage(
        customHeroSheet,
        this.slice.sx,
        this.slice.sy,
        this.slice.sw,
        this.slice.sh,
        hx - Math.round(dw * this.slice.pivotX),
        hy - Math.round(dh * this.slice.pivotY),
        dw,
        dh,
      );
    } else {
      const heroSet = atlas.heroSheets.get(activeForm);
      if (heroSet) {
        const runFrame = HeroStdFrame.Run0 + (((timeSec * 10) | 0) & 3);
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
    }
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
    customPack: IAssetPackManager | null = null,
  ): void {
    if (screenMode === 'title') return;

    this.renderTopLeftCluster(ctx, state, atlas, font, glyphs, timeSec, customPack);
    this.renderTopRightCluster(ctx, state, catalog, atlas, font, timeSec, customPack);

    if (state.boss && !state.boss.defeated) {
      this.renderBossBar(ctx, state.boss, catalog, font, timeSec);
    }

    if (state.combo.bannerTimer > 0) {
      this.renderComboBanner(ctx, state.combo.bannerText || 'KRUNKED COMBO!', font, timeSec, customPack);
    }

    if (
      this.roomToastTimer > 0 &&
      screenMode === 'playing' &&
      state.combo.bannerTimer <= 0 &&
      (!state.boss || state.boss.defeated)
    ) {
      this.renderRoomToast(ctx, font);
    }
  }

  private renderTopLeftCluster(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    atlas: ProceduralPixelAtlas,
    font: PixelFont,
    glyphs: DeviceGlyphMap,
    timeSec: number,
    customPack: IAssetPackManager | null,
  ): void {
    // 1. Sculpted Octagonal Gilded Combo Wheel at (22, 22)
    const cx = 22;
    const cy = 22;
    const ratio =
      state.combo.maxTimer > 0
        ? Math.max(0, Math.min(1, state.combo.timer / state.combo.maxTimer))
        : 0;
    const activeSegs = Math.round(ratio * COMBO_SEGS);
    const pulse = (((timeSec * 10) | 0) & 1) === 0;
    const comboActive = state.combo.count > 0;
    const healReady = ratio >= COMBO_RULES.HEAL_THRESHOLD;

    // Octagonal dark obsidian outer outline + metallic rim highlight
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(cx - 12, cy - 15, 25, 31);
    ctx.fillRect(cx - 15, cy - 12, 31, 25);
    ctx.fillRect(cx - 14, cy - 14, 29, 29);

    ctx.fillStyle = healReady
      ? pulse
        ? HIGHLIGHT_CREAM
        : UI_COLORS.frameGold
      : comboActive
        ? UI_COLORS.frameGold
        : UI_COLORS.frameLight;
    ctx.fillRect(cx - 11, cy - 14, 23, 29);
    ctx.fillRect(cx - 14, cy - 11, 29, 23);
    ctx.fillRect(cx - 13, cy - 13, 27, 27);

    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(cx - 10, cy - 13, 21, 27);
    ctx.fillRect(cx - 13, cy - 10, 27, 21);
    ctx.fillRect(cx - 12, cy - 12, 25, 25);

    // Subtle inner top bevel sheen
    ctx.fillStyle = '#2d1948';
    ctx.fillRect(cx - 10, cy - 12, 21, 2);

    // Unfilled wheel track
    ctx.fillStyle = '#331d4a';
    for (let i = 0; i < COMBO_SEGS; i++) {
      const px = Math.round(cx + COMBO_COS[i]! * 10.2);
      const py = Math.round(cy + COMBO_SIN[i]! * 10.2);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }

    // Active radial combo fill (cyan -> gold -> radiant magenta-white near 95% auto-heal!)
    const fillCol = healReady
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
      const px = Math.round(cx + COMBO_COS[i]! * 10.2);
      const py = Math.round(cy + COMBO_SIN[i]! * 10.2);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }

    if (comboActive) {
      const txt = state.combo.count >= 10 ? `${state.combo.count}` : `X${state.combo.count}`;
      font.draw(
        ctx,
        txt,
        cx,
        cy - 3,
        healReady ? 'white' : ratio >= 0.7 ? 'gold' : 'cyan',
        1,
        'center',
        true,
      );
    } else {
      font.draw(ctx, '◆', cx, cy - 3, 'dim', 1, 'center', true);
    }

    // 2. Heart Orbs + Shields inside subtle translucent backing pill for legibility
    const customHeart = customPack ? customPack.getSprite('ui/heart') : null;
    const customHeartEmpty = customPack ? customPack.getSprite('ui/heart_empty') : null;
    const hasCustomHeart = isDrawable(customHeart);
    if (hasCustomHeart) {
      const heartEntry = customPack ? customPack.getEntry('ui/heart') : null;
      const heartFrameIdx = heartEntry && heartEntry.frames && heartEntry.frames.length > 1 ? 1 : 0;
      resolveCustomFrame(customPack, 'ui/heart', customHeart, 0, 1, false, this.slice, undefined, 0, 0, heartFrameIdx);
    }
    const hsx = this.slice.sx;
    const hsy = this.slice.sy;
    const hsw = this.slice.sw;
    const hsh = this.slice.sh;

    const heartFull = atlas.collectibles.get('heart_full');
    const heartEmpty = atlas.collectibles.get('heart_empty');
    const maxHp = Math.max(1, Math.min(10, state.hero.maxHp));
    const extraIcons = (state.hero.rockShieldActive ? 1 : 0) + (state.hero.magicShieldTimer > 0 ? 1 : 0);
    const pillW = maxHp * 16 + extraIcons * 18 + 6;
    const pillX = 39;
    const pillY = 6;

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(pillX, pillY, pillW, 16);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = UI_COLORS.frameLight;
    ctx.fillRect(pillX, pillY, pillW, 1);
    ctx.fillRect(pillX, pillY + 15, pillW, 1);
    ctx.globalAlpha = prevAlpha;

    const lowHpPulse = state.hero.hp === 1 && (((timeSec * 8) | 0) & 1) === 1 ? -1 : 0;
    const healPop = this.healPopTimer > 0 ? -1 : 0;
    let hx = 42;
    const hy = 7;

    for (let i = 0; i < maxHp; i++) {
      const filled = i < state.hero.hp;
      const oy = filled ? (i === 0 ? lowHpPulse : 0) + (i === state.hero.hp - 1 ? healPop : 0) : 0;
      if (filled && hasCustomHeart) {
        ctx.drawImage(customHeart, hsx, hsy, hsw, hsh, hx - 1, hy - 1 + oy, 16, 16);
      } else if (!filled && isDrawable(customHeartEmpty)) {
        // Subtle hollow heart highlight socket so empty max-HP slots always read cleanly
        ctx.fillStyle = 'rgba(138, 86, 150, 0.28)';
        ctx.fillRect(hx + 1, hy + 2, 12, 10);
        resolveCustomFrame(customPack, 'ui/heart_empty', customHeartEmpty, timeSec, 4, true, this.slice);
        ctx.drawImage(
          customHeartEmpty,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          hx - 1,
          hy - 1,
          16,
          16,
        );
      } else {
        const spr = filled ? heartFull : heartEmpty;
        if (spr) {
          ctx.drawImage(spr, hx, hy + 1 + oy);
        }
      }
      hx += 16;
    }

    const customShieldSheet = customPack ? customPack.getSprite('ui/shield_icon') : null;
    const hasShieldSheet = isDrawable(customShieldSheet);

    if (state.hero.rockShieldActive) {
      if (hasShieldSheet) {
        resolveCustomFrame(customPack, 'ui/shield_icon', customShieldSheet, 0, 1, false, this.slice, 'rock', 2, 1, 0);
        ctx.drawImage(
          customShieldSheet,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          hx,
          hy + 1,
          17,
          13,
        );
        hx += 18;
      } else {
        const rs = atlas.collectibles.get('rock_shield');
        if (rs) {
          ctx.drawImage(rs, hx, hy + 1);
          hx += 16;
        }
      }
    }

    if (state.hero.magicShieldTimer > 0) {
      if (hasShieldSheet) {
        resolveCustomFrame(customPack, 'ui/shield_icon', customShieldSheet, 0, 1, false, this.slice, 'magic', 2, 1, 1);
        ctx.drawImage(
          customShieldSheet,
          this.slice.sx,
          this.slice.sy,
          this.slice.sw,
          this.slice.sh,
          hx,
          hy + 1,
          17,
          13,
        );
      } else {
        const ms = atlas.collectibles.get('magic_shield');
        if (ms) {
          ctx.drawImage(ms, hx, hy + 1);
        }
      }
    }

    // 3. Sculpted Elemental Form Crest Badge below hearts
    const form = state.hero.form;
    const formIdx = Math.max(0, HERO_FORMS.indexOf(form));
    const pal = HERO_FORM_PALETTES[form];
    const formLabel = HERO_FORM_LABELS[form];
    const badgeX = 39;
    const badgeY = 25;
    const badgeW = 24 + font.measure(formLabel, 1) + 7;
    const badgeH = 18;

    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.fillStyle = this.formFlashTimer > 0.14 ? HIGHLIGHT_CREAM : pal[0];
    ctx.fillRect(badgeX + 1, badgeY + 1, badgeW - 2, badgeH - 2);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(badgeX + 2, badgeY + 2, badgeW - 4, badgeH - 4);
    // Subtle form-colored left icon pocket & gleaming top edge
    ctx.fillStyle = pal[2];
    ctx.fillRect(badgeX + 2, badgeY + 2, 18, badgeH - 4);
    ctx.fillStyle = pal[4];
    ctx.fillRect(badgeX + 2, badgeY + 2, badgeW - 4, 1);

    const customFormIcons = customPack ? customPack.getSprite('ui/form_icons') : null;
    if (isDrawable(customFormIcons)) {
      resolveCustomFrame(
        customPack,
        'ui/form_icons',
        customFormIcons,
        0,
        1,
        false,
        this.slice,
        undefined,
        HERO_FORMS.length,
        1,
        formIdx,
      );
      ctx.drawImage(
        customFormIcons,
        this.slice.sx,
        this.slice.sy,
        this.slice.sw,
        this.slice.sh,
        badgeX + 4,
        badgeY + 2,
        14,
        14,
      );
    } else {
      const icon = atlas.collectibles.get(`form_icon_${form}`);
      if (icon) {
        ctx.drawImage(icon, badgeX + 4, badgeY + 3);
      }
    }
    font.draw(ctx, formLabel, badgeX + 23, badgeY + 6, 'white', 1, 'left', true);

    if (state.progress.unlockedForms.length > 1) {
      const gx = badgeX + badgeW + 4;
      const gw = font.measure(glyphs.form, 1) + 6;
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(gx, badgeY + 3, gw, 12);
      ctx.fillStyle = UI_COLORS.frameLight;
      ctx.fillRect(gx, badgeY + 3, gw, 1);
      ctx.globalAlpha = 1;
      font.draw(ctx, glyphs.form, gx + 3, badgeY + 6, 'cream', 1, 'left', false);
    }

    // 4. Extracted origin `ui/combo_bar` gauge strip below form badge when combo is active
    if (comboActive && customPack) {
      const comboBar = customPack.getSprite('ui/combo_bar');
      if (isDrawable(comboBar)) {
        const barX = 39;
        const barY = 46;
        const barW = 106;
        const barH = 13;
        const fillW = 102;
        const fillH = 10;
        resolveCustomFrame(customPack, 'ui/combo_bar', comboBar, 0, 1, false, this.slice, HUD_COMBO_DARK);
        if (this.slice.matchedClip) {
          ctx.drawImage(
            comboBar,
            this.slice.sx,
            this.slice.sy,
            this.slice.sw,
            this.slice.sh,
            barX + 2,
            barY + 2,
            fillW,
            fillH,
          );
        }
        const fillClip = ratio >= 0.7 ? HUD_COMBO_RAINBOW : HUD_COMBO_RED;
        resolveCustomFrame(customPack, 'ui/combo_bar', comboBar, timeSec, 12, true, this.slice, fillClip);
        if (this.slice.matchedClip && ratio > 0.01) {
          const fw = Math.max(1, Math.round(this.slice.sw * ratio));
          const dw = Math.max(1, Math.round(fillW * ratio));
          ctx.drawImage(comboBar, this.slice.sx, this.slice.sy, fw, this.slice.sh, barX + 2, barY + 2, dw, fillH);
        }
        resolveCustomFrame(customPack, 'ui/combo_bar', comboBar, 0, 1, false, this.slice, HUD_COMBO_FRAME);
        if (this.slice.matchedClip) {
          ctx.drawImage(comboBar, this.slice.sx, this.slice.sy, this.slice.sw, this.slice.sh, barX, barY, barW, barH);
        }
        if (healReady) {
          const healHeart = customPack.getSprite('ui/combo_wheel');
          if (isDrawable(healHeart)) {
            resolveCustomFrame(customPack, 'ui/combo_wheel', healHeart, timeSec, 12, true, this.slice);
            ctx.drawImage(
              healHeart,
              this.slice.sx,
              this.slice.sy,
              this.slice.sw,
              this.slice.sh,
              barX + barW - 22,
              barY - 6,
              32,
              24,
            );
          }
        }
      }
    }
  }

  private renderTopRightCluster(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    catalog: IWorldCatalog,
    atlas: ProceduralPixelAtlas,
    font: PixelFont,
    timeSec: number,
    customPack: IAssetPackManager | null,
  ): void {
    // 1. Sculpted Pixel Minimap at far top-right
    const mapW = 58;
    const mapH = 36;
    const mapX = VIEWPORT_W - mapW - 7;
    const mapY = 6;

    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(mapX - 1, mapY - 1, mapW + 2, mapH + 2);
    ctx.fillStyle = UI_COLORS.frameLight;
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(mapX + 1, mapY + 1, mapW - 2, mapH - 2);
    // Gold corner rivets on minimap bezel
    ctx.fillStyle = UI_COLORS.frameGold;
    ctx.fillRect(mapX, mapY, 2, 2);
    ctx.fillRect(mapX + mapW - 2, mapY, 2, 2);
    ctx.fillRect(mapX, mapY + mapH - 2, 2, 2);
    ctx.fillRect(mapX + mapW - 2, mapY + mapH - 2, 2, 2);

    // Subtle interior radar crosshairs
    ctx.fillStyle = '#24143a';
    ctx.fillRect(mapX + 2, mapY + 18, mapW - 4, 1);
    ctx.fillRect(mapX + 29, mapY + 2, 1, mapH - 4);

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

      const cellX = mapX + 26 + (room.mapX - centerMapX) * 6;
      const cellY = mapY + 16 - (room.mapY - centerMapY) * 5;
      if (cellX < mapX + 2 || cellX + 4 > mapX + mapW - 2 || cellY < mapY + 2 || cellY + 3 > mapY + mapH - 2) {
        continue;
      }

      let col = BIOME_PALETTES[room.biome].capMid;
      if (isCurrent) {
        col = blink ? HIGHLIGHT_CREAM : UI_COLORS.frameGold;
      } else if (room.bossId) {
        col = '#ff3858';
      } else if (room.hasTeleporter) {
        col = '#56ecff';
      } else if (room.isSecret) {
        col = '#d44dff';
      } else if (room.mode === 'arena') {
        col = '#ffae33';
      }

      ctx.fillStyle = col;
      ctx.fillRect(cellX, cellY, 5, 4);
      if (isCurrent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cellX + 2, cellY + 1, 1, 2);
      }
    }

    // 2. Glass-Framed Crystal & Coin Counter Pill just left of minimap!
    const crystalStr = `${state.progress.crystals}`;
    const coinStr = `${state.progress.collectedCoinIds.length}/${catalog.totalCoins}`;
    const cw = font.measure(crystalStr, 1);
    const tw = font.measure(coinStr, 1);
    const pillInnerW = Math.max(cw, tw) + 28;
    const pillX = mapX - pillInnerW - 6;
    const pillY = 6;
    const pillH = 36;

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(pillX - 1, pillY - 1, pillInnerW + 2, pillH + 2);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(pillX, pillY, pillInnerW, pillH);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = UI_COLORS.frameLight;
    ctx.fillRect(pillX, pillY, pillInnerW, 1);
    ctx.fillRect(pillX, pillY + pillH - 1, pillInnerW, 1);
    ctx.fillStyle = '#2d1a4a';
    ctx.fillRect(pillX + 3, pillY + 18, pillInnerW - 6, 1);
    ctx.globalAlpha = prevAlpha;

    const counterRightX = pillX + pillInnerW - 5;
    const iconLeftX = pillX + 5;
    const customCrystal = customPack ? customPack.getSprite('ui/crystal') : null;
    const customCoin = customPack ? customPack.getSprite('ui/coin') : null;
    const crystalSpr = atlas.collectibles.get('crystal');
    const coinSpr = atlas.collectibles.get('coin');
    const f4 = ((timeSec * 6) | 0) & 3;
    const cPop = this.crystalPopTimer > 0 ? -1 : 0;
    const kPop = this.coinPopTimer > 0 ? -1 : 0;

    // Crystals row
    if (isDrawable(customCrystal)) {
      resolveCustomFrame(customPack, 'ui/crystal', customCrystal, timeSec, 8, true, this.slice);
      ctx.drawImage(
        customCrystal,
        this.slice.sx,
        this.slice.sy,
        this.slice.sw,
        this.slice.sh,
        iconLeftX,
        pillY + 2 + cPop,
        13,
        13,
      );
    } else if (crystalSpr) {
      ctx.drawImage(crystalSpr, f4 * 16, 0, 16, 20, iconLeftX, pillY + 1 + cPop, 12, 15);
    }
    font.draw(ctx, crystalStr, counterRightX, pillY + 6 + cPop, this.crystalPopTimer > 0 ? 'white' : 'cyan', 1, 'right', true);

    // Coins row
    if (isDrawable(customCoin)) {
      resolveCustomFrame(customPack, 'ui/coin', customCoin, timeSec, 8, true, this.slice);
      ctx.drawImage(
        customCoin,
        this.slice.sx,
        this.slice.sy,
        this.slice.sw,
        this.slice.sh,
        iconLeftX,
        pillY + 21 + kPop,
        13,
        13,
      );
    } else if (coinSpr) {
      ctx.drawImage(coinSpr, f4 * 20, 0, 20, 20, iconLeftX, pillY + 21 + kPop, 13, 13);
    }
    font.draw(ctx, coinStr, counterRightX, pillY + 24 + kPop, this.coinPopTimer > 0 ? 'white' : 'gold', 1, 'right', true);

    // Mode badges (Time Attack stopwatch / Ghost Ship wave & score)
    if (state.mode === 'time_attack') {
      const totalSec = state.timeAttackTicks / SIM_HZ;
      const mins = Math.floor(totalSec / 60);
      const secs = Math.floor(totalSec % 60);
      const centis = Math.floor((totalSec * 100) % 100);
      const mm = mins < 10 ? `0${mins}` : `${mins}`;
      const ss = secs < 10 ? `0${secs}` : `${secs}`;
      const cc = centis < 10 ? `0${centis}` : `${centis}`;
      const timeTxt = `${mm}:${ss}.${cc}`;
      const tw2 = font.measure(timeTxt, 1) + 10;
      ctx.fillStyle = 'rgba(16, 10, 30, 0.8)';
      ctx.fillRect(VIEWPORT_W - tw2 - 7, 45, tw2, 13);
      ctx.fillStyle = UI_COLORS.frameGold;
      ctx.fillRect(VIEWPORT_W - tw2 - 7, 45, tw2, 1);
      font.draw(ctx, timeTxt, VIEWPORT_W - 12, 48, 'yellow', 1, 'right', true);
    } else if (state.mode === 'ghost_ship' && state.ghostShip.active) {
      const gsTxt = `W${state.ghostShip.wave} · ${state.ghostShip.score} PTS`;
      const gw2 = font.measure(gsTxt, 1) + 10;
      ctx.fillStyle = 'rgba(16, 10, 30, 0.8)';
      ctx.fillRect(VIEWPORT_W - gw2 - 7, 45, gw2, 13);
      ctx.fillStyle = '#52e88a';
      ctx.fillRect(VIEWPORT_W - gw2 - 7, 45, gw2, 1);
      font.draw(ctx, gsTxt, VIEWPORT_W - 12, 48, 'green', 1, 'right', true);
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
    const barW = 252;
    const barH = 10;
    const bx = Math.round((VIEWPORT_W - barW) * 0.5);
    const by = VIEWPORT_H - 22;

    // Subtle dark backing plaque behind boss title
    const titleW = font.measure(title, 1);
    ctx.fillStyle = 'rgba(16, 10, 30, 0.78)';
    ctx.fillRect(Math.round(VIEWPORT_W * 0.5 - titleW * 0.5 - 8), by - 14, titleW + 16, 11);
    font.draw(ctx, title, VIEWPORT_W * 0.5, by - 12, 'gold', 1, 'center', true);

    // Ornate boss bar bezel with gilded corner caps
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(bx - 4, by - 3, barW + 8, barH + 6);
    ctx.fillStyle = UI_COLORS.frameGold;
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.fillStyle = UI_COLORS.frameGoldDark;
    ctx.fillRect(bx - 2, by + barH + 1, barW + 4, 1);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(bx, by, barW, barH);

    const trailW = Math.round(Math.max(0, Math.min(1, this.bossTrailRatio)) * barW);
    if (trailW > 0) {
      ctx.fillStyle = UI_COLORS.bossHpTrail;
      ctx.fillRect(bx, by, trailW, barH);
    }

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

    // Segment ticks
    ctx.fillStyle = OUTLINE_DARK;
    for (let s = 1; s < 5; s++) {
      ctx.fillRect(bx + Math.round((barW * s) / 5), by, 1, barH);
    }

    // End diamond ornaments
    ctx.fillStyle = HIGHLIGHT_CREAM;
    ctx.fillRect(bx - 3, by + 4, 2, 2);
    ctx.fillRect(bx + barW + 1, by + 4, 2, 2);

    // Radiant Phase Gems
    for (let p = 0; p < 3; p++) {
      const active = p < boss.phase;
      const px = bx + barW + 9 + p * 8;
      const py = by + 2;
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(px - 1, py - 1, 7, 7);
      ctx.fillStyle = active ? UI_COLORS.frameGold : '#34204a';
      ctx.fillRect(px, py, 5, 5);
      if (active) {
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(px + 1, py + 1, 2, 2);
      }
    }
  }

  private renderComboBanner(
    ctx: CanvasRenderingContext2D,
    text: string,
    font: PixelFont,
    timeSec: number,
    customPack: IAssetPackManager | null,
  ): void {
    const pulse = (((timeSec * 12) | 0) & 1) === 0;
    const bannerY = 54 + Math.round(Math.sin(timeSec * 14) * 2);

    const customBanner = customPack ? customPack.getSprite('ui/combo_badge') : null;
    if (isDrawable(customBanner)) {
      resolveCustomFrame(customPack, 'ui/combo_badge', customBanner, timeSec, 8, true, this.slice);
      const bw = this.slice.sw;
      const bh = this.slice.sh;
      if (bw / Math.max(1, bh) > 1.35) {
        const drawH = 48;
        const drawW = Math.min(200, Math.round((bw / Math.max(1, bh)) * drawH));
        ctx.drawImage(
          customBanner,
          this.slice.sx,
          this.slice.sy,
          bw,
          bh,
          Math.round((VIEWPORT_W - drawW) * 0.5),
          bannerY - 6,
          drawW,
          drawH,
        );
        return;
      }
    }

    const label = text.toUpperCase();
    const tw = font.measure(label, 2);
    const rx = Math.round((VIEWPORT_W - tw) * 0.5 - 16);
    const rw = tw + 32;

    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(rx - 2, bannerY - 4, rw + 4, 24);
    ctx.fillStyle = pulse ? UI_COLORS.frameGold : '#ff42b3';
    ctx.fillRect(rx, bannerY - 2, rw, 20);
    ctx.fillStyle = UI_COLORS.panelBg;
    ctx.fillRect(rx + 2, bannerY, rw - 4, 16);

    font.draw(ctx, label, VIEWPORT_W * 0.5, bannerY + 2, pulse ? 'gold' : 'white', 2, 'center', true);
  }

  private renderRoomToast(ctx: CanvasRenderingContext2D, font: PixelFont): void {
    const elapsed = this.roomToastMax - this.roomToastTimer;
    const fadeIn = Math.min(1, elapsed / 0.24);
    const fadeOut = Math.min(1, this.roomToastTimer / 0.48);
    const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
    if (alpha <= 0.02) return;

    const slideY = Math.round((1 - fadeIn) * -8);
    const ty = 7 + slideY;
    const showSub = this.roomToastBiome.length > 0 && this.roomToastBiome !== this.roomToastText;
    const tw = showSub
      ? Math.max(font.measure(this.roomToastText, 1), font.measure(this.roomToastBiome, 1))
      : font.measure(this.roomToastText, 1);
    const boxW = tw + 24;
    const boxH = showSub ? 22 : 14;
    const px = Math.round((VIEWPORT_W - boxW) * 0.5);

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;

    // Sleek dark obsidian plaque with gilded top/bottom wing accents
    ctx.fillStyle = 'rgba(14, 8, 28, 0.86)';
    ctx.fillRect(px, ty - 2, boxW, boxH);
    ctx.fillStyle = UI_COLORS.frameGold;
    ctx.fillRect(px + 2, ty - 2, boxW - 4, 1);
    ctx.fillStyle = UI_COLORS.frameLight;
    ctx.fillRect(px + 4, ty - 2 + boxH - 1, boxW - 8, 1);
    // Ornamental gold diamond pips on left & right ends
    ctx.fillStyle = UI_COLORS.frameGold;
    ctx.fillRect(px + 4, ty + (showSub ? 7 : 3), 2, 2);
    ctx.fillRect(px + boxW - 6, ty + (showSub ? 7 : 3), 2, 2);

    font.draw(ctx, this.roomToastText, VIEWPORT_W * 0.5, ty + 1, 'gold', 1, 'center', true);
    if (showSub) {
      font.draw(ctx, this.roomToastBiome, VIEWPORT_W * 0.5, ty + 11, 'cyan', 1, 'center', false);
    }

    ctx.globalAlpha = prevAlpha;
  }
}
