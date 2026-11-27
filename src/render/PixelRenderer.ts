/**
 * Krunked Quest — Main 576x324 Crisp 16-Bit Neo-Retro Pixel Renderer
 * Coordinates ProceduralPixelAtlas, optional CustomPack overlay, TileRenderer,
 * EntityRenderer, ParticleSystem, and HudRenderer with strict nearest-neighbor
 * rendering, 1-pixel camera snapping, and zero per-frame allocations.
 */

import {
  PPU,
  VIEWPORT_H,
  VIEWPORT_W,
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

  private packManager: IAssetPackManager | null = null;
  private prevRoomId = '';
  private prevTimeSec = -1;
  private trailTimer = 0;
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
      } else if (ev.type === 'boss_defeated') {
        this.bossRenderer.resetTrails();
      }
    }
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

    // Enforce nearest-neighbor crisp pixel rendering on every frame
    ctx.imageSmoothingEnabled = false;

    const dt =
      this.prevTimeSec < 0 ? 1 / 60 : Math.max(0, Math.min(0.05, timeSec - this.prevTimeSec));
    this.prevTimeSec = timeSec;

    // Active Custom Pack overlay (seamlessly falls back to ProceduralPixelAtlas per key)
    const activePack =
      this.packManager && this.packManager.customPackEnabled && settings.useCustomPack
        ? this.packManager
        : null;

    // Animated 16-bit pixel backdrop on Title screen (delegates 4-layer parallax to TileRenderer!)
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

    // Room change detection for crisp room title toast
    if (this.prevRoomId !== state.roomId) {
      this.prevRoomId = state.roomId;
      this.hudRenderer.triggerRoomToast(room.name, BIOME_PALETTES[state.biome].label);
    }

    // Trigger hero form-switch ring burst cleanly at hero coordinates
    if (this.pendingFormSwitch) {
      this.pendingFormSwitch = false;
      this.particles.emitFormSwitchRing(
        state.hero.x + state.hero.width * 0.5,
        state.hero.y,
        state.hero.form,
      );
    }

    // Emit dynamic hero form & ability trails
    if (screenMode === 'playing') {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        const act = state.hero.action;
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
            state.hero.x + state.hero.width * 0.5,
            state.hero.y + state.hero.height * 0.45,
            state.hero.form,
            act === 'fire_dash' || act === 'air_stomp' ? 2 : 1,
          );
        } else {
          this.trailTimer = 0.08;
        }
      }
      this.particles.emitAmbient(dt, state.camera.x, state.camera.y, state.biome);
      this.particles.update(dt);
    }
    this.hudRenderer.update(dt, state);

    // 1-pixel-snapped interpolated camera (classicSnap locks interpAlpha to 1)
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

    // 1. Multi-layer pixel parallax backdrop (origin Custom Pack or Built-In) + biome midground
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

    // Bespoke multi-part BossRenderer replaces generic boss draw cleanly (ZERO double-sprite ghosting!)
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

    // 2.5 Bespoke biome foreground atmospheric pass (dials back gracefully when origin BG is active)
    this.biomeRenderer.renderForeground(ctx, state, room, camX, camY, timeSec, customBgActive);

    // 3. Brief subtle white flash overlay on max-combo hitstop celebration
    if (state.hitstopTicks > 14 && state.combo.bannerTimer > 0) {
      ctx.fillStyle = 'rgba(255, 248, 220, 0.14)';
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
    }

    // 4. Crisp 576x324 Pixel-Art HUD (with origin HUD sprites when Custom Pack is active!)
    this.hudRenderer.renderHud(ctx, state, catalog, this.atlas, this.font, glyphs, screenMode, timeSec, activePack);
  }

  public dispose(): void {
    this.particles.clear();
    this.bossRenderer.resetTrails();
    this.ctx = null;
    this.packManager = null;
  }
}

export function createPixelRenderer(): IPixelRenderer {
  return new PixelRenderer();
}
