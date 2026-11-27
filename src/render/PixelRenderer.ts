/**
 * Krunked Quest — Main 576x324 Crisp 16-Bit Neo-Retro Pixel Renderer
 * Coordinates ProceduralPixelAtlas, optional CustomPack overlay, TileRenderer,
 * EntityRenderer, ParticleSystem, BiomeRenderer, BossRenderer, and HudRenderer
 * with strict nearest-neighbor rendering, 1-pixel camera snapping, cached
 * biome-tinted vignettes, smooth room transition curtains, and zero per-frame allocations.
 */

import {
  PPU,
  VIEWPORT_H,
  VIEWPORT_W,
  type BiomeId,
  type DeviceGlyphMap,
  type IAssetPackManager,
  type IPixelRenderer,
  type IWorldCatalog,
  type RenderSettings,
  type ScreenMode,
  type SimEvent,
  type SimState,
} from '../contracts/index.js';
import { BIOME_PALETTES, OUTLINE_VOID } from '../assets/palettes.js';
import { ProceduralPixelAtlas } from '../assets/ProceduralPixelAtlas.js';
import { BiomeRenderer } from './BiomeRenderer.js';
import { BossRenderer } from './BossRenderer.js';
import { EntityRenderer } from './EntityRenderer.js';
import { HudRenderer } from './HudRenderer.js';
import { ParticleSystem } from './Particles.js';
import { PixelFont } from './PixelFont.js';
import { TileRenderer } from './TileRenderer.js';

const HALF_W = VIEWPORT_W * 0.5; // 288
const HALF_H = VIEWPORT_H * 0.5; // 162

export class PixelRenderer implements IPixelRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly atlas = new ProceduralPixelAtlas();
  private readonly font = new PixelFont();
  private readonly particles = new ParticleSystem();
  private readonly biomeRenderer = new BiomeRenderer();
  private readonly bossRenderer = new BossRenderer();
  private readonly tileRenderer = new TileRenderer();
  private readonly entityRenderer = new EntityRenderer();
  private readonly hudRenderer = new HudRenderer();
  private readonly vignetteCache = new Map<BiomeId, HTMLCanvasElement>();

  private packManager: IAssetPackManager | null = null;
  private prevRoomId = '';
  private prevTimeSec = -1;
  private trailTimer = 0;
  private footstepTimer = 0;
  private wallSparkTimer = 0;
  private prevHeroFacing: -1 | 1 = 1;
  private roomFadeTimer = 0;
  private impactFlashTimer = 0;
  private impactFlashColor = '#fff8dc';
  private pendingFormSwitch = false;

  public attach(canvas: HTMLCanvasElement): void {
    canvas.width = VIEWPORT_W;
    canvas.height = VIEWPORT_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
    this.atlas.bakeIfBrowser();
    this.font.ensureBaked();
  }

  public setPackManager(packs: IAssetPackManager): void {
    this.packManager = packs;
  }

  public consumeEvents(events: readonly SimEvent[]): void {
    this.particles.consumeEvents(events);
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      if (ev.type === 'form_switch') {
        this.pendingFormSwitch = true;
      } else if (ev.type === 'room_change') {
        this.particles.clear();
        this.bossRenderer.resetTrails();
        this.entityRenderer.resetAfterimages();
        this.roomFadeTimer = 0.24;
      } else if (ev.type === 'boss_defeated') {
        this.bossRenderer.resetTrails();
        this.impactFlashTimer = 0.14;
        this.impactFlashColor = '#fff4b8';
      } else if (ev.type === 'stomp_impact' && ev.explosive) {
        this.impactFlashTimer = 0.07;
        this.impactFlashColor = '#ffdf9e';
      } else if (ev.type === 'boss_hit') {
        this.impactFlashTimer = 0.06;
        this.impactFlashColor = '#ffffff';
      } else if (ev.type === 'heal') {
        this.impactFlashTimer = 0.09;
        this.impactFlashColor = '#8affb0';
      } else if (ev.type === 'hero_hurt' && !ev.shieldBlocked) {
        this.impactFlashTimer = 0.08;
        this.impactFlashColor = '#ff4a68';
      }
    }
  }

  /** Pre-bakes a subtle, tasteful biome-tinted edge vignette once per biome (zero per-frame alloc). */
  private getBiomeVignette(biome: BiomeId): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const cached = this.vignetteCache.get(biome);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = VIEWPORT_W;
    canvas.height = VIEWPORT_H;
    const vctx = canvas.getContext('2d');
    if (!vctx) return null;

    const pal = BIOME_PALETTES[biome];
    const grad = vctx.createRadialGradient(
      HALF_W,
      HALF_H,
      VIEWPORT_H * 0.42,
      HALF_W,
      HALF_H,
      VIEWPORT_W * 0.62,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.72, 'rgba(10, 5, 20, 0.06)');
    grad.addColorStop(1, pal.earthDeep);

    vctx.globalAlpha = 0.34;
    vctx.fillStyle = grad;
    vctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
    vctx.globalAlpha = 1;

    this.vignetteCache.set(biome, canvas);
    return canvas;
  }

  public render(
    state: SimState,
    catalog: IWorldCatalog,
    interpAlpha: number,
    settings: RenderSettings,
    glyphs: DeviceGlyphMap,
    screenMode: ScreenMode,
    timeSec: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    this.atlas.bakeIfBrowser();
    this.font.ensureBaked();
    ctx.imageSmoothingEnabled = false;

    const dt =
      this.prevTimeSec < 0 ? 1 / 60 : Math.max(0, Math.min(0.05, timeSec - this.prevTimeSec));
    this.prevTimeSec = timeSec;

    if (this.roomFadeTimer > 0) {
      this.roomFadeTimer = Math.max(0, this.roomFadeTimer - dt);
    }
    if (this.impactFlashTimer > 0) {
      this.impactFlashTimer = Math.max(0, this.impactFlashTimer - dt);
    }

    const activePack =
      this.packManager && this.packManager.customPackEnabled && settings.useCustomPack
        ? this.packManager
        : null;

    // Animated 16-bit pixel backdrop on Title screen
    if (screenMode === 'title') {
      this.tileRenderer.renderParallax(ctx, 'TDM', timeSec * 1.4, 0, timeSec, this.atlas, activePack);
      this.hudRenderer.renderTitleBackdrop(ctx, this.atlas, timeSec, activePack, true);
      return;
    }

    const room = catalog.rooms.get(state.roomId);
    if (!room) {
      ctx.fillStyle = OUTLINE_VOID;
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
      return;
    }

    if (this.prevRoomId !== state.roomId) {
      this.prevRoomId = state.roomId;
      this.hudRenderer.triggerRoomToast(room.name, BIOME_PALETTES[state.biome].label);
      this.roomFadeTimer = 0.24;
    }

    if (this.pendingFormSwitch) {
      this.pendingFormSwitch = false;
      this.particles.emitFormSwitchRing(
        state.hero.x + state.hero.width * 0.5,
        state.hero.y,
        state.hero.form,
      );
    }

    // Dynamic hero trails, footstep/skid puffs, and wall-slide sparks
    if (screenMode === 'playing') {
      const hero = state.hero;
      const heroCx = hero.x + hero.width * 0.5;

      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        const act = hero.action;
        const intense =
          act === 'fire_dash' ||
          act === 'ground_stomp' ||
          act === 'ground_dash' ||
          act === 'wall_dash' ||
          act === 'air_stomp' ||
          act === 'flip' ||
          act === 'rock_uppercut' ||
          act === 'volt_dive' ||
          act === 'volt_blink' ||
          act === 'shadow_blink' ||
          act === 'leaf_glide';
        if (intense) {
          this.trailTimer = 0.032;
          this.particles.emitFormTrail(
            heroCx,
            hero.y + hero.height * 0.45,
            hero.form,
            act === 'fire_dash' || act === 'air_stomp' ? 2 : 1,
          );
        } else {
          this.trailTimer = 0.08;
        }
      }

      // Ground footstep puffs & quick-turnaround skid dust
      if (hero.grounded && Math.abs(hero.vx) > 3.2) {
        this.footstepTimer -= dt;
        const turned = hero.facing !== this.prevHeroFacing && Math.abs(hero.vx) > 2.5;
        if (turned || this.footstepTimer <= 0) {
          this.particles.emitFootstepDust(heroCx, hero.y, hero.vx >= 0 ? 1 : -1, turned);
          this.footstepTimer = 0.14;
        }
      } else {
        this.footstepTimer = 0.04;
      }
      this.prevHeroFacing = hero.facing;

      // Wall-slide friction sparks
      if (hero.action === 'wall_slide' && hero.onWall !== 0) {
        this.wallSparkTimer -= dt;
        if (this.wallSparkTimer <= 0) {
          const wallX = hero.onWall > 0 ? hero.x + hero.width : hero.x;
          this.particles.emitWallSlideSpark(wallX, hero.y + hero.height * 0.45, hero.onWall, hero.form);
          this.wallSparkTimer = 0.085;
        }
      } else {
        this.wallSparkTimer = 0;
      }

      this.particles.emitAmbient(dt, state.camera.x, state.camera.y, state.biome);
      this.particles.update(dt);
    }
    this.hudRenderer.update(dt, state);

    // 1-pixel-snapped interpolated camera
    const alpha = settings.classicSnap ? 1 : Math.max(0, Math.min(1, interpAlpha));
    const rawCamX = state.camera.prevX + (state.camera.x - state.camera.prevX) * alpha;
    const rawCamY = state.camera.prevY + (state.camera.y - state.camera.prevY) * alpha;

    let shakePxX = 0;
    let shakePxY = 0;
    if (settings.screenShake && state.camera.shakeTimer > 0 && state.camera.shakeIntensity > 0) {
      const amp = Math.max(1, Math.round(state.camera.shakeIntensity * PPU * 0.35));
      shakePxX = Math.round(Math.sin(timeSec * 83.7) * amp);
      shakePxY = Math.round(Math.cos(timeSec * 97.3) * amp);
    }

    const camX = (Math.round(rawCamX * PPU) + shakePxX) / PPU;
    const camY = (Math.round(rawCamY * PPU) + shakePxY) / PPU;

    // 1. Multi-layer pixel parallax backdrop + biome midground
    this.tileRenderer.renderParallax(ctx, state.biome, camX, camY, timeSec, this.atlas, activePack);
    const customBgActive = this.tileRenderer.hasCustomParallax(state.biome, activePack);
    this.biomeRenderer.renderMidground(ctx, state, room, camX, camY, timeSec, customBgActive);

    // 2. World pass (with optional crisp arena zoom centered on viewport)
    const zoom = state.camera.zoom;
    const zoomed = zoom > 1.001 || zoom < 0.999;
    if (zoomed) {
      ctx.save();
      ctx.translate(HALF_W, HALF_H);
      ctx.scale(zoom, zoom);
      ctx.translate(-HALF_W, -HALF_H);
      ctx.imageSmoothingEnabled = false;
    }

    this.tileRenderer.renderTiles(ctx, state, room, camX, camY, timeSec, this.atlas, activePack);
    this.tileRenderer.renderPlatformsAndProps(
      ctx,
      state,
      room,
      camX,
      camY,
      alpha,
      timeSec,
      this.atlas,
      activePack,
      this.font,
      glyphs,
    );

    const activeBoss = state.boss && !state.boss.defeated ? state.boss : null;
    if (activeBoss) {
      this.bossRenderer.renderBack(ctx, state, activeBoss, room, camX, camY, alpha, timeSec);
      this.bossRenderer.renderBody(
        ctx,
        state,
        activeBoss,
        camX,
        camY,
        alpha,
        timeSec,
        this.atlas,
        activePack,
      );
      state.boss = null;
    }
    try {
      this.entityRenderer.renderAll(ctx, state, camX, camY, alpha, timeSec, this.atlas, activePack);
    } finally {
      if (activeBoss) {
        state.boss = activeBoss;
      }
    }
    if (activeBoss) {
      this.bossRenderer.renderForeground(ctx, state, activeBoss, camX, camY, alpha, timeSec);
    }

    this.particles.render(ctx, camX, camY, this.font, this.atlas, activePack);

    if (zoomed) {
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
    }

    // 2.5 Bespoke biome foreground atmospheric pass
    this.biomeRenderer.renderForeground(ctx, state, room, camX, camY, timeSec, customBgActive);

    // 2.8 Subtle cached biome-tinted vignette for cinematic framing
    const vignette = this.getBiomeVignette(state.biome);
    if (vignette) {
      ctx.drawImage(vignette, 0, 0);
    }

    // 2.9 Gentle pulsing low-HP edge pulse when hero is at 1 Heart
    if (screenMode === 'playing' && state.hero.hp === 1 && state.hero.action !== 'dead') {
      const pulse = 0.08 + 0.08 * (0.5 + 0.5 * Math.sin(timeSec * 6.5));
      const prevA = ctx.globalAlpha;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff2448';
      ctx.fillRect(0, 0, VIEWPORT_W, 5);
      ctx.fillRect(0, VIEWPORT_H - 5, VIEWPORT_W, 5);
      ctx.fillRect(0, 5, 5, VIEWPORT_H - 10);
      ctx.fillRect(VIEWPORT_W - 5, 5, 5, VIEWPORT_H - 10);
      ctx.globalAlpha = prevA;
    }

    // 3. Brief subtle screen flash on heavy impacts, combo-max, heals, or hits
    if (state.hitstopTicks > 14 && state.combo.bannerTimer > 0) {
      ctx.fillStyle = 'rgba(255, 248, 220, 0.14)';
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
    } else if (this.impactFlashTimer > 0) {
      const prevA = ctx.globalAlpha;
      ctx.globalAlpha = Math.min(0.14, this.impactFlashTimer * 1.4);
      ctx.fillStyle = this.impactFlashColor;
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
      ctx.globalAlpha = prevA;
    }

    // 4. Smooth dark-obsidian room transition curtain fade-in
    if (this.roomFadeTimer > 0) {
      const prevA = ctx.globalAlpha;
      const frac = this.roomFadeTimer / 0.24;
      ctx.globalAlpha = frac * frac * 0.88;
      ctx.fillStyle = OUTLINE_VOID;
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
      ctx.globalAlpha = prevA;
    }

    // 5. Crisp 576x324 Pixel-Art HUD
    this.hudRenderer.renderHud(ctx, state, catalog, this.atlas, this.font, glyphs, screenMode, timeSec, activePack);
  }

  public dispose(): void {
    this.particles.clear();
    this.bossRenderer.resetTrails();
    this.entityRenderer.resetAfterimages();
    this.vignetteCache.clear();
    this.ctx = null;
    this.packManager = null;
  }
}

export function createPixelRenderer(): IPixelRenderer {
  return new PixelRenderer();
}
