/**
 * Krunked Quest — Zero-Allocation Pooled Pixel Particle & Floating Popup System
 * Pre-allocates fixed pools at boot so 60/120 FPS hot loops allocate ZERO objects.
 */

import {
  PPU,
  VIEWPORT_H,
  VIEWPORT_W,
  type BiomeId,
  type HeroFormId,
  type IAssetPackManager,
  type SimEvent,
} from '../contracts/index.js';
import {
  BIOME_PALETTES,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
} from '../assets/palettes.js';
import type { ProceduralPixelAtlas } from '../assets/ProceduralPixelAtlas.js';
import {
  isDrawable,
  resolveCustomFrame,
  type SpriteSliceOut,
} from './EntityRenderer.js';
import type { PixelFont, PixelFontColor } from './PixelFont.js';

const MAX_PARTICLES = 256;
const MAX_SHOCKWAVES = 16;
const MAX_POPUPS = 32;
const MAX_FX_BURSTS = 24;
const HALF_W = VIEWPORT_W * 0.5; // 288
const HALF_H = VIEWPORT_H * 0.5; // 162
const BOSS_DEFEAT_COLORS: readonly string[] = [
  '#ffd84d',
  '#ff42a8',
  '#59f2ff',
  '#7aff66',
  HIGHLIGHT_CREAM,
];

const enum ParticleShape {
  Square = 0,
  Cross = 1,
  Diamond = 2,
  Line = 3,
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  size: number;
  color: string;
  color2: string;
  life: number;
  maxLife: number;
  shape: ParticleShape;
  outlined: boolean;
}

interface Shockwave {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  color2: string;
  flat: boolean;
  skipWithCustomPack: boolean;
}

interface FloatingPopup {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: PixelFontColor;
  scale: number;
}

interface FxBurst {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  key: string;
  flipX: boolean;
}

export class ParticleSystem {
  private readonly particles: Particle[] = [];
  private readonly shockwaves: Shockwave[] = [];
  private readonly popups: FloatingPopup[] = [];
  private readonly fxBursts: FxBurst[] = [];
  private nextParticleCursor = 0;
  private nextWaveCursor = 0;
  private nextPopupCursor = 0;
  private nextBurstCursor = 0;
  private rng = 0x9e3779b9;
  private ambientTimer = 0;
  private readonly slice: SpriteSliceOut = {
    sx: 0,
    sy: 0,
    sw: 32,
    sh: 32,
    pivotX: 0.5,
    pivotY: 0.5,
    hasManifestRect: false,
    matchedClip: false,
  };

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 1,
        size: 2,
        color: HIGHLIGHT_CREAM,
        color2: OUTLINE_DARK,
        life: 0,
        maxLife: 0.4,
        shape: ParticleShape.Square,
        outlined: false,
      });
    }
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      this.shockwaves.push({
        active: false,
        x: 0,
        y: 0,
        radius: 0,
        maxRadius: 1,
        life: 0,
        maxLife: 0.25,
        color: HIGHLIGHT_CREAM,
        color2: UI_COLORS.frameGold,
        flat: false,
        skipWithCustomPack: false,
      });
    }
    for (let i = 0; i < MAX_POPUPS; i++) {
      this.popups.push({
        active: false,
        x: 0,
        y: 0,
        vy: 1.5,
        life: 0,
        maxLife: 0.75,
        text: '',
        color: 'gold',
        scale: 1,
      });
    }
    for (let i = 0; i < MAX_FX_BURSTS; i++) {
      this.fxBursts.push({
        active: false,
        x: 0,
        y: 0,
        life: 0,
        maxLife: 0.25,
        size: 32,
        key: 'stomp_ring',
        flipX: false,
      });
    }
  }

  private rand(): number {
    let x = this.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rng = x >>> 0;
    return this.rng / 0x100000000;
  }

  private randRange(min: number, max: number): number {
    return min + (max - min) * this.rand();
  }

  public clear(): void {
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles[i]!.active = false;
    for (let i = 0; i < MAX_SHOCKWAVES; i++) this.shockwaves[i]!.active = false;
    for (let i = 0; i < MAX_POPUPS; i++) this.popups[i]!.active = false;
    for (let i = 0; i < MAX_FX_BURSTS; i++) this.fxBursts[i]!.active = false;
  }

  public spawnFxBurst(
    x: number,
    y: number,
    key: string,
    size = 36,
    life = 0.26,
    flipX = false,
  ): void {
    const b = this.fxBursts[this.nextBurstCursor]!;
    this.nextBurstCursor = (this.nextBurstCursor + 1) % MAX_FX_BURSTS;
    b.active = true;
    b.x = x;
    b.y = y;
    b.life = life;
    b.maxLife = life;
    b.size = size;
    b.key = key;
    b.flipX = flipX;
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    gravity: number,
    size: number,
    color: string,
    color2: string,
    life: number,
    shape: ParticleShape,
    outlined: boolean,
    drag = 0.96,
  ): void {
    const p = this.particles[this.nextParticleCursor]!;
    this.nextParticleCursor = (this.nextParticleCursor + 1) % MAX_PARTICLES;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.gravity = gravity;
    p.drag = drag;
    p.size = size;
    p.color = color;
    p.color2 = color2;
    p.life = life;
    p.maxLife = life;
    p.shape = shape;
    p.outlined = outlined;
  }

  private spawnShockwave(
    x: number,
    y: number,
    maxRadius: number,
    life: number,
    color: string,
    color2: string,
    flat: boolean,
    skipWithCustomPack = false,
  ): void {
    const w = this.shockwaves[this.nextWaveCursor]!;
    this.nextWaveCursor = (this.nextWaveCursor + 1) % MAX_SHOCKWAVES;
    w.active = true;
    w.x = x;
    w.y = y;
    w.radius = 0.12;
    w.maxRadius = maxRadius;
    w.life = life;
    w.maxLife = life;
    w.color = color;
    w.color2 = color2;
    w.flat = flat;
    w.skipWithCustomPack = skipWithCustomPack;
  }

  public spawnPopup(
    x: number,
    y: number,
    text: string,
    color: PixelFontColor,
    scale = 1,
    life = 0.8,
  ): void {
    const pop = this.popups[this.nextPopupCursor]!;
    this.nextPopupCursor = (this.nextPopupCursor + 1) % MAX_POPUPS;
    pop.active = true;
    pop.x = x;
    pop.y = y;
    pop.vy = 1.65;
    pop.life = life;
    pop.maxLife = life;
    pop.text = text;
    pop.color = color;
    pop.scale = scale;
  }

  /** Continuous form trail particles emitted cleanly during movement/abilities. */
  public emitFormTrail(x: number, y: number, form: HeroFormId, intensity = 1): void {
    const pal = HERO_FORM_PALETTES[form];
    for (let i = 0; i < intensity; i++) {
      const shape =
        form === 'krunk_leaf'
          ? ParticleShape.Diamond
          : form === 'krunk_electric'
            ? ParticleShape.Cross
            : ParticleShape.Square;
      this.spawnParticle(
        x + this.randRange(-0.28, 0.28),
        y + this.randRange(-0.22, 0.25),
        this.randRange(-1.4, 1.4),
        form === 'krunk_fire' ? this.randRange(0.8, 2.5) : this.randRange(-0.6, 1.2),
        form === 'krunk_rock' ? -14 : form === 'krunk_leaf' ? -2.2 : 0,
        this.rand() > 0.5 ? 3 : 2,
        this.rand() > 0.45 ? pal[4] : pal[0],
        pal[2],
        this.randRange(0.18, 0.34),
        shape,
        false,
        0.92,
      );
    }
  }

  /** Subtle atmospheric motes (fireflies, ash embers, sand flecks, ghostly mist). */
  public emitAmbient(dt: number, camX: number, camY: number, biome: BiomeId): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 0.14;
    const pal = BIOME_PALETTES[biome];
    const x = camX + this.randRange(-9.5, 9.5);
    const y = camY + this.randRange(-5.2, 5.2);
    const isEmber = biome === 'ATVC' || biome === 'EVIL';
    const isSand = biome === 'DSI';
    this.spawnParticle(
      x,
      y,
      isSand ? this.randRange(-3.2, -1.5) : this.randRange(-0.45, 0.45),
      isEmber ? this.randRange(0.6, 1.6) : this.randRange(-0.25, 0.45),
      0,
      this.rand() > 0.7 ? 2 : 1,
      pal.ambientMote,
      pal.accent,
      this.randRange(1.0, 2.0),
      isEmber ? ParticleShape.Square : ParticleShape.Cross,
      false,
      0.99,
    );
  }

  public consumeEvents(events: readonly SimEvent[]): void {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      switch (ev.type) {
        case 'jump': {
          const pal = HERO_FORM_PALETTES[ev.form];
          const count = ev.air ? 8 : 6;
          for (let k = 0; k < count; k++) {
            const ang = (k / count) * Math.PI * 2;
            this.spawnParticle(
              ev.x + Math.cos(ang) * 0.2,
              ev.y + 0.08,
              Math.cos(ang) * (ev.air ? 2.8 : 2.1),
              ev.air ? Math.sin(ang) * 1.1 : this.randRange(0.2, 1.1),
              -4,
              ev.air ? 3 : 2,
              ev.air ? pal[4] : HIGHLIGHT_CREAM,
              pal[0],
              0.28,
              ev.air ? ParticleShape.Diamond : ParticleShape.Square,
              false,
            );
          }
          if (ev.air) {
            this.spawnShockwave(ev.x, ev.y + 0.1, 0.8, 0.2, pal[4], pal[0], true, true);
          }
          this.spawnFxBurst(ev.x, ev.y + 0.15, 'jump_dust', 28, 0.22);
          break;
        }

        case 'land': {
          const n = ev.heavy ? 12 : 5;
          for (let k = 0; k < n; k++) {
            const side = k % 2 === 0 ? 1 : -1;
            this.spawnParticle(
              ev.x + side * this.randRange(0.05, 0.28),
              ev.y + 0.06,
              side * this.randRange(1.2, ev.heavy ? 4.8 : 2.6),
              this.randRange(0.5, ev.heavy ? 3.2 : 1.4),
              -10,
              ev.heavy ? 3 : 2,
              HIGHLIGHT_CREAM,
              '#cbb8d9',
              ev.heavy ? 0.36 : 0.24,
              ParticleShape.Square,
              true,
            );
          }
          if (ev.heavy) {
            this.spawnShockwave(ev.x, ev.y + 0.08, 1.35, 0.24, HIGHLIGHT_CREAM, UI_COLORS.frameGold, true, true);
          }
          this.spawnFxBurst(ev.x, ev.y + 0.12, 'land_dust', ev.heavy ? 42 : 28, 0.24);
          break;
        }

        case 'wall_jump': {
          for (let k = 0; k < 7; k++) {
            this.spawnParticle(
              ev.x,
              ev.y + this.randRange(0.1, 0.7),
              ev.dir * this.randRange(1.5, 4.2),
              this.randRange(-0.5, 2.6),
              -8,
              3,
              HIGHLIGHT_CREAM,
              '#d4b8ff',
              0.26,
              ParticleShape.Square,
              true,
            );
          }
          break;
        }

        case 'dash': {
          const c1 =
            ev.kind === 'fire'
              ? '#ffae38'
              : ev.kind === 'volt'
                ? '#66f7ff'
                : ev.kind === 'shadow'
                  ? '#ff3b9a'
                  : HIGHLIGHT_CREAM;
          const c2 =
            ev.kind === 'fire'
              ? '#ff2b2b'
              : ev.kind === 'volt'
                ? '#f2ff38'
                : ev.kind === 'shadow'
                  ? '#24ff78'
                  : '#c48aff';
          for (let k = 0; k < 12; k++) {
            this.spawnParticle(
              ev.x + this.randRange(-0.25, 0.25),
              ev.y + this.randRange(0.1, 0.75),
              this.randRange(-4.5, 4.5),
              this.randRange(-1.8, 2.4),
              ev.kind === 'fire' ? 2 : -4,
              this.rand() > 0.4 ? 3 : 2,
              k % 2 === 0 ? c1 : c2,
              c2,
              0.3,
              ev.kind === 'volt' ? ParticleShape.Cross : ParticleShape.Diamond,
              false,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.4, 0.95, 0.2, c1, c2, false, true);
          this.spawnFxBurst(
            ev.x,
            ev.y + 0.45,
            ev.kind === 'fire'
              ? 'fire_blast'
              : ev.kind === 'volt'
                ? 'volt_arc'
                : ev.kind === 'shadow'
                  ? 'evil_stomp'
                  : ev.kind === 'wall'
                    ? 'wall_stomp'
                    : 'stomp_jump',
            ev.kind === 'fire' ? 46 : 40,
            0.28,
          );
          break;
        }

        case 'ground_stomp': {
          const col1 = ev.fiery ? '#ffe640' : HIGHLIGHT_CREAM;
          const col2 = ev.fiery ? '#ff4419' : '#ff59b8';
          const count = ev.fiery ? 18 : 12;
          for (let k = 0; k < count; k++) {
            const ang = this.randRange(0.2, Math.PI - 0.2);
            const spd = this.randRange(2.2, ev.fiery ? 7.2 : 5.2);
            this.spawnParticle(
              ev.x,
              ev.y + 0.1,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              -16,
              3,
              k % 2 === 0 ? col1 : col2,
              col2,
              this.randRange(0.24, 0.42),
              ParticleShape.Square,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.12, ev.fiery ? 1.85 : 1.35, 0.26, col1, col2, true, true);
          this.spawnFxBurst(ev.x, ev.y + 0.35, 'stomp_ring', ev.fiery ? 56 : 46, 0.3);
          this.spawnFxBurst(ev.x, ev.y + 0.45, 'stomp_jump', 42, 0.28);
          if (ev.fiery) {
            this.spawnFxBurst(ev.x, ev.y + 0.45, 'fire_blast', 52, 0.3);
          }
          break;
        }

        case 'tongue_lash': {
          const fxKey =
            ev.kind === 'wall_dash'
              ? 'wall_stomp'
              : ev.kind === 'ground_dash'
                ? 'stomp_jump'
                : ev.kind === 'ground_stomp'
                  ? 'stomp_ring'
                  : 'stomp_hit';
          this.spawnFxBurst(ev.x, ev.y + 0.35, fxKey, 42, 0.26, ev.dirX < 0);
          for (let k = 0; k < 8; k++) {
            this.spawnParticle(
              ev.x + this.randRange(-0.18, 0.18),
              ev.y + 0.35 + this.randRange(-0.15, 0.15),
              ev.dirX * this.randRange(2.0, 5.5) + this.randRange(-1.2, 1.2),
              ev.dirY * this.randRange(1.5, 4.5) + this.randRange(-0.8, 1.8),
              -9,
              3,
              k % 2 === 0 ? HIGHLIGHT_CREAM : '#ff59b8',
              '#d42aff',
              this.randRange(0.18, 0.32),
              ParticleShape.Diamond,
              true,
            );
          }
          break;
        }

        case 'stomp_start':
          this.spawnShockwave(ev.x, ev.y + 0.45, 0.75, 0.16, HIGHLIGHT_CREAM, UI_COLORS.comboMid, false, true);
          this.spawnFxBurst(ev.x, ev.y + 0.35, 'stomp_jump', 36, 0.22);
          break;

        case 'stomp_impact': {
          const col1 = ev.explosive ? '#ffe640' : HIGHLIGHT_CREAM;
          const col2 = ev.explosive ? '#ff3b1f' : '#ffad4d';
          const count = ev.explosive ? 22 : 14;
          for (let k = 0; k < count; k++) {
            const ang = this.randRange(0.15, Math.PI - 0.15);
            const spd = this.randRange(2.0, ev.explosive ? 8.5 : 5.8);
            this.spawnParticle(
              ev.x,
              ev.y + 0.1,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              -18,
              this.rand() > 0.45 ? 4 : 3,
              k % 2 === 0 ? col1 : col2,
              col2,
              this.randRange(0.26, 0.48),
              ParticleShape.Square,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.1, ev.explosive ? 2.1 : 1.45, 0.28, col1, col2, true, true);
          this.spawnFxBurst(ev.x, ev.y + 0.35, 'stomp_ring', ev.explosive ? 64 : 48, 0.32);
          if (ev.explosive) {
            this.spawnFxBurst(ev.x, ev.y + 0.5, 'fire_blast', 56, 0.32);
          }
          break;
        }

        case 'uppercut': {
          for (let k = 0; k < 14; k++) {
            this.spawnParticle(
              ev.x + this.randRange(-0.35, 0.35),
              ev.y + 0.4,
              this.randRange(-3.2, 3.2),
              this.randRange(3.5, 9.0),
              -18,
              3,
              k % 2 === 0 ? '#ffe7a1' : '#ffad16',
              '#a20ec7',
              0.38,
              ParticleShape.Square,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.7, 1.25, 0.24, '#ffe7a1', '#ffad16', false);
          break;
        }

        case 'enemy_hit': {
          const count = ev.killed ? 16 : 9;
          for (let k = 0; k < count; k++) {
            const ang = (k / count) * Math.PI * 2 + this.randRange(-0.2, 0.2);
            const spd = this.randRange(2.5, ev.killed ? 7.2 : 4.8);
            this.spawnParticle(
              ev.x,
              ev.y + 0.4,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              -10,
              k % 3 === 0 ? 4 : 3,
              k % 2 === 0 ? HIGHLIGHT_CREAM : UI_COLORS.frameGold,
              '#ff42a8',
              this.randRange(0.24, 0.42),
              k % 2 === 0 ? ParticleShape.Cross : ParticleShape.Diamond,
              true,
            );
          }
          this.spawnShockwave(
            ev.x,
            ev.y + 0.4,
            ev.killed ? 1.25 : 0.75,
            0.22,
            HIGHLIGHT_CREAM,
            UI_COLORS.frameGold,
            false,
            true,
          );
          this.spawnFxBurst(ev.x, ev.y + 0.45, ev.killed ? 'stomp_hit' : 'hit_spark', ev.killed ? 42 : 30, 0.24);
          if (ev.killed) {
            const label = ev.combo > 1 ? `${ev.combo}X!` : '+5';
            this.spawnPopup(ev.x, ev.y + 0.9, label, ev.combo >= 4 ? 'magenta' : 'gold', 1, 0.72);
          }
          break;
        }

        case 'boss_hit': {
          for (let k = 0; k < 18; k++) {
            const ang = this.randRange(0, Math.PI * 2);
            const spd = this.randRange(3.0, 8.0);
            this.spawnParticle(
              ev.x,
              ev.y,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              -8,
              4,
              k % 2 === 0 ? HIGHLIGHT_CREAM : '#ff5268',
              '#ffd84d',
              0.38,
              ParticleShape.Diamond,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y, 1.9, 0.28, HIGHLIGHT_CREAM, '#ff5268', false, true);
          this.spawnFxBurst(ev.x, ev.y, 'stomp_hit', 48, 0.26);
          this.spawnPopup(ev.x, ev.y + 0.8, 'HIT!', 'orange', 1, 0.65);
          break;
        }

        case 'boss_defeated': {
          for (let k = 0; k < 44; k++) {
            const ang = (k / 44) * Math.PI * 2;
            const spd = this.randRange(2.2, 9.5);
            this.spawnParticle(
              ev.x,
              ev.y,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              -7,
              4,
              BOSS_DEFEAT_COLORS[k % BOSS_DEFEAT_COLORS.length]!,
              HIGHLIGHT_CREAM,
              this.randRange(0.55, 1.05),
              k % 2 === 0 ? ParticleShape.Cross : ParticleShape.Diamond,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y, 3.8, 0.55, '#ffd84d', '#ff42a8', false);
          this.spawnPopup(ev.x, ev.y + 1.0, 'VICTORY!', 'gold', 2, 1.4);
          break;
        }

        case 'hero_hurt': {
          const col1 = ev.shieldBlocked ? '#66f7ff' : '#ff3858';
          const col2 = ev.shieldBlocked ? '#ffd84d' : HIGHLIGHT_CREAM;
          for (let k = 0; k < 14; k++) {
            const ang = (k / 14) * Math.PI * 2;
            this.spawnParticle(
              ev.x,
              ev.y + 0.45,
              Math.cos(ang) * this.randRange(2.5, 6.0),
              Math.sin(ang) * this.randRange(2.5, 6.0),
              -8,
              3,
              k % 2 === 0 ? col1 : col2,
              col2,
              0.36,
              ParticleShape.Diamond,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.45, 1.4, 0.25, col1, col2, false);
          if (ev.shieldBlocked) {
            this.spawnPopup(ev.x, ev.y + 1.0, 'GUARD!', 'cyan', 1, 0.75);
          }
          break;
        }

        case 'hero_dead': {
          for (let k = 0; k < 28; k++) {
            const ang = (k / 28) * Math.PI * 2;
            this.spawnParticle(
              ev.x,
              ev.y + 0.45,
              Math.cos(ang) * this.randRange(2.0, 7.5),
              Math.sin(ang) * this.randRange(2.0, 7.5),
              -4,
              4,
              k % 2 === 0 ? '#ff42b3' : HIGHLIGHT_CREAM,
              '#9d1cd4',
              0.65,
              ParticleShape.Cross,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.45, 2.5, 0.45, '#ff42b3', HIGHLIGHT_CREAM, false);
          break;
        }

        case 'heal': {
          for (let k = 0; k < 14; k++) {
            this.spawnParticle(
              ev.x + this.randRange(-0.5, 0.5),
              ev.y + this.randRange(0.0, 0.9),
              this.randRange(-0.8, 0.8),
              this.randRange(1.8, 4.2),
              0,
              3,
              k % 2 === 0 ? '#7aff80' : HIGHLIGHT_CREAM,
              '#38e89e',
              0.52,
              ParticleShape.Cross,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.45, 1.4, 0.3, '#7aff80', HIGHLIGHT_CREAM, false);
          this.spawnPopup(ev.x, ev.y + 1.05, '+1 HP', 'green', 1, 0.9);
          break;
        }

        case 'crystal_pickup': {
          for (let k = 0; k < 7; k++) {
            const ang = (k / 7) * Math.PI * 2;
            this.spawnParticle(
              ev.x,
              ev.y,
              Math.cos(ang) * 2.6,
              Math.sin(ang) * 2.6 + 1.0,
              -4,
              2,
              k % 2 === 0 ? UI_COLORS.crystalLight : UI_COLORS.crystalMid,
              UI_COLORS.crystalDark,
              0.28,
              ParticleShape.Diamond,
              false,
            );
          }
          if (ev.value >= 5) {
            this.spawnPopup(ev.x, ev.y + 0.45, `+${ev.value}`, 'cyan', 1, 0.62);
          }
          break;
        }

        case 'coin_pickup': {
          for (let k = 0; k < 16; k++) {
            const ang = (k / 16) * Math.PI * 2;
            this.spawnParticle(
              ev.x,
              ev.y,
              Math.cos(ang) * this.randRange(2.5, 5.5),
              Math.sin(ang) * this.randRange(2.5, 5.5),
              -4,
              3,
              k % 2 === 0 ? UI_COLORS.coinLight : UI_COLORS.coinMid,
              UI_COLORS.coinDark,
              0.48,
              ParticleShape.Cross,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y, 1.35, 0.3, UI_COLORS.coinLight, UI_COLORS.coinMid, false);
          this.spawnPopup(ev.x, ev.y + 0.7, 'COIN!', 'gold', 1, 0.95);
          break;
        }

        case 'combo_max': {
          for (let k = 0; k < 28; k++) {
            const ang = (k / 28) * Math.PI * 2;
            this.spawnParticle(
              ev.x,
              ev.y + 0.5,
              Math.cos(ang) * this.randRange(3.2, 8.0),
              Math.sin(ang) * this.randRange(3.2, 8.0),
              -6,
              4,
              k % 3 === 0 ? '#ffd84d' : k % 3 === 1 ? '#ff42b3' : '#66f7ff',
              HIGHLIGHT_CREAM,
              0.68,
              ParticleShape.Cross,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.5, 2.8, 0.45, '#ffd84d', '#ff42b3', false);
          this.spawnPopup(ev.x, ev.y + 1.2, 'KRUNKED!', 'gold', 2, 1.15);
          break;
        }

        case 'block_break': {
          const count = ev.explosive ? 20 : 12;
          for (let k = 0; k < count; k++) {
            this.spawnParticle(
              ev.x + this.randRange(-0.35, 0.35),
              ev.y + this.randRange(-0.35, 0.35),
              this.randRange(-5.5, 5.5),
              this.randRange(1.5, 7.5),
              -22,
              this.rand() > 0.4 ? 4 : 3,
              ev.explosive ? (k % 2 === 0 ? '#ffe640' : '#ff3824') : k % 2 === 0 ? '#e6a86a' : '#965c32',
              OUTLINE_DARK,
              0.46,
              ParticleShape.Square,
              true,
            );
          }
          if (ev.explosive) {
            this.spawnShockwave(ev.x, ev.y, 2.2, 0.32, '#ffe640', '#ff3824', false);
          }
          break;
        }

        case 'bounce_pad': {
          for (let k = 0; k < 10; k++) {
            this.spawnParticle(
              ev.x + this.randRange(-0.4, 0.4),
              ev.y + 0.2,
              this.randRange(-2.5, 2.5),
              this.randRange(2.5, 6.2),
              -10,
              3,
              k % 2 === 0 ? '#ff99e8' : '#ffd84d',
              '#ff38a8',
              0.34,
              ParticleShape.Diamond,
              true,
            );
          }
          this.spawnShockwave(ev.x, ev.y + 0.25, 1.2, 0.22, '#ff99e8', '#ffd84d', true);
          break;
        }

        case 'form_switch':
        case 'room_change':
        case 'shop_interact':
        case 'teleporter_unlock':
        case 'victory':
          break;
      }
    }
  }

  public emitFormSwitchRing(x: number, y: number, form: HeroFormId): void {
    const pal = HERO_FORM_PALETTES[form];
    for (let k = 0; k < 18; k++) {
      const ang = (k / 18) * Math.PI * 2;
      this.spawnParticle(
        x + Math.cos(ang) * 0.25,
        y + 0.45 + Math.sin(ang) * 0.25,
        Math.cos(ang) * 4.5,
        Math.sin(ang) * 4.5,
        0,
        3,
        k % 2 === 0 ? pal[4] : pal[0],
        pal[2],
        0.36,
        ParticleShape.Diamond,
        true,
        0.92,
      );
    }
    this.spawnShockwave(x, y + 0.45, 1.5, 0.28, pal[4], pal[0], false);
  }

  /** Crisp running footfall / turnaround dust puff (zero-alloc). */
  public emitFootstepDust(x: number, y: number, moveDir: number, skid = false): void {
    const count = skid ? 4 : 2;
    for (let i = 0; i < count; i++) {
      this.spawnParticle(
        x + this.randRange(-0.12, 0.12),
        y + 0.04,
        -moveDir * this.randRange(0.7, skid ? 2.8 : 1.7),
        this.randRange(0.35, skid ? 1.5 : 0.9),
        -5.5,
        skid ? 3 : 2,
        HIGHLIGHT_CREAM,
        '#cbb8d9',
        this.randRange(0.16, skid ? 0.28 : 0.22),
        ParticleShape.Square,
        false,
        0.92,
      );
    }
  }

  /** Subtle wall-slide friction sparks / glistening mist droplets (zero-alloc). */
  public emitWallSlideSpark(x: number, y: number, wallSide: number, form: HeroFormId): void {
    const pal = HERO_FORM_PALETTES[form];
    this.spawnParticle(
      x,
      y + this.randRange(-0.15, 0.2),
      -wallSide * this.randRange(0.8, 2.1),
      this.randRange(0.4, 1.8),
      -6.5,
      2,
      HIGHLIGHT_CREAM,
      pal[4],
      this.randRange(0.16, 0.26),
      ParticleShape.Diamond,
      false,
      0.93,
    );
  }

  public update(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i]!;
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const w = this.shockwaves[i]!;
      if (!w.active) continue;
      w.life -= dt;
      if (w.life <= 0) {
        w.active = false;
        continue;
      }
      const prog = 1 - w.life / w.maxLife;
      w.radius = w.maxRadius * (1 - (1 - prog) * (1 - prog));
    }

    for (let i = 0; i < MAX_POPUPS; i++) {
      const pop = this.popups[i]!;
      if (!pop.active) continue;
      pop.life -= dt;
      if (pop.life <= 0) {
        pop.active = false;
        continue;
      }
      pop.y += pop.vy * dt;
      pop.vy *= 0.93;
    }

    for (let i = 0; i < MAX_FX_BURSTS; i++) {
      const b = this.fxBursts[i]!;
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    font: PixelFont,
    atlas: ProceduralPixelAtlas | null = null,
    customPack: IAssetPackManager | null = null,
  ): void {
    // 0. Pooled pixel sprite FX bursts (stomp impact rings, tongue sparks, fire blasts, volt arcs!)
    for (let i = 0; i < MAX_FX_BURSTS; i++) {
      const b = this.fxBursts[i]!;
      if (!b.active) continue;
      const sx = Math.round((b.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - b.y) * PPU + HALF_H);
      if (sx < -128 || sx > VIEWPORT_W + 128 || sy < -128 || sy > VIEWPORT_H + 128) continue;
      const prog = Math.max(0, Math.min(0.999, 1 - b.life / b.maxLife));
      const fullKey = `fx/${b.key}`;
      const customFx = customPack ? customPack.getSprite(fullKey) : null;
      if (isDrawable(customFx)) {
        const fallbackCols = b.key === 'stomp_ring' ? 8 : 0;
        const fallbackRows = b.key === 'stomp_ring' ? 2 : 0;
        resolveCustomFrame(
          customPack,
          fullKey,
          customFx,
          0,
          24,
          false,
          this.slice,
          undefined,
          fallbackCols,
          fallbackRows,
          -1,
          prog,
        );
        const dw = this.slice.hasManifestRect ? this.slice.sw : b.size;
        const dh = this.slice.hasManifestRect
          ? this.slice.sh
          : Math.round(b.size / Math.max(0.4, this.slice.sw / Math.max(1, this.slice.sh)));
        const dx = -Math.round(dw * this.slice.pivotX);
        const dy = -Math.round(dh * this.slice.pivotY);
        if (b.flipX) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.scale(-1, 1);
          ctx.drawImage(
            customFx,
            this.slice.sx,
            this.slice.sy,
            this.slice.sw,
            this.slice.sh,
            dx,
            dy,
            dw,
            dh,
          );
          ctx.restore();
        } else {
          ctx.drawImage(
            customFx,
            this.slice.sx,
            this.slice.sy,
            this.slice.sw,
            this.slice.sh,
            sx + dx,
            sy + dy,
            dw,
            dh,
          );
        }
      } else if (atlas) {
        const builtKey =
          b.key === 'stomp_hit' || b.key === 'hit_spark' || b.key === 'stomp_jump' || b.key === 'wall_stomp'
            ? 'tongue_impact'
            : b.key === 'evil_stomp'
              ? 'shadow_slash'
              : b.key;
        const built = atlas.fx.get(builtKey);
        if (built) {
          const f4 = Math.min(3, (prog * 4) | 0);
          const fw = built.width >> 2;
          const fh = built.height;
          ctx.drawImage(built, f4 * fw, 0, fw, fh, sx - (fw >> 1), sy - (fh >> 1), fw, fh);
        }
      }
    }

    // 1. Pixel-stepped shockwave rings (skip redundant procedural rings when origin `fx/*` bursts are active!)
    const hasCustomFx = !!(customPack && isDrawable(customPack.getSprite('fx/stomp_ring')));
    for (let i = 0; i < MAX_SHOCKWAVES; i++) {
      const w = this.shockwaves[i]!;
      if (!w.active) continue;
      if (hasCustomFx && w.skipWithCustomPack) continue;
      const sx = Math.round((w.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - w.y) * PPU + HALF_H);
      const rx = Math.max(2, Math.round(w.radius * PPU));
      const ry = w.flat ? Math.max(2, Math.round(rx * 0.35)) : rx;
      const t = w.life / w.maxLife;
      const segs = 20;
      ctx.fillStyle = t > 0.5 ? w.color : w.color2;
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2;
        const px = Math.round(sx + Math.cos(ang) * rx);
        const py = Math.round(sy + Math.sin(ang) * ry);
        ctx.fillRect(px, py, 2, 2);
      }
    }

    // 2. Crisp pixel particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i]!;
      if (!p.active) continue;
      const sx = Math.round((p.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - p.y) * PPU + HALF_H);
      if (sx < -8 || sx > VIEWPORT_W + 8 || sy < -8 || sy > VIEWPORT_H + 8) continue;

      const t = p.life / p.maxLife;
      const sz = Math.max(1, Math.round(p.size * (t > 0.25 ? 1 : t * 4)));
      const col = t > 0.4 ? p.color : p.color2;

      if (p.shape === ParticleShape.Cross) {
        if (p.outlined) {
          ctx.fillStyle = OUTLINE_DARK;
          ctx.fillRect(sx - sz - 1, sy - 1, sz * 2 + 3, 3);
          ctx.fillRect(sx - 1, sy - sz - 1, 3, sz * 2 + 3);
        }
        ctx.fillStyle = col;
        ctx.fillRect(sx - sz, sy, sz * 2 + 1, 1);
        ctx.fillRect(sx, sy - sz, 1, sz * 2 + 1);
      } else if (p.shape === ParticleShape.Diamond) {
        if (p.outlined) {
          ctx.fillStyle = OUTLINE_DARK;
          ctx.fillRect(sx - 2, sy - 1, 5, 3);
          ctx.fillRect(sx - 1, sy - 2, 3, 5);
        }
        ctx.fillStyle = col;
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      } else {
        const half = sz >> 1;
        if (p.outlined && sz >= 2) {
          ctx.fillStyle = OUTLINE_DARK;
          ctx.fillRect(sx - half - 1, sy - half - 1, sz + 2, sz + 2);
        }
        ctx.fillStyle = col;
        ctx.fillRect(sx - half, sy - half, sz, sz);
      }
    }

    // 3. Crisp floating combat / pickup popups
    for (let i = 0; i < MAX_POPUPS; i++) {
      const pop = this.popups[i]!;
      if (!pop.active) continue;
      const sx = Math.round((pop.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - pop.y) * PPU + HALF_H);
      font.draw(ctx, pop.text, sx, sy, pop.color, pop.scale, 'center', true);
    }
  }
}
