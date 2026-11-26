/**
 * Krunked Quest — Bespoke Multi-Part Animated 16-Bit Boss Renderer
 * Handcrafted pixel-art rendering for ALL 8 Bosses & Mini-Bosses with crisp 1px outlines,
 * hit-flash, phase-escalating auras, animated weapons/appendages, attack telegraphs,
 * shadow/fire trails, stun stars, sweeping lasers, hexagonal shield, and arena morph cues.
 * Strict nearest-neighbor 1-pixel-snapped, headless-safe, ZERO per-frame allocations!
 */

import {
  PPU,
  VIEWPORT_H,
  VIEWPORT_W,
  type BossId,
  type BossRuntime,
  type IAssetPackManager,
  type RoomDef,
  type SimState,
} from '../contracts/index.js';
import {
  FLASH_WHITE,
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
} from '../assets/palettes.js';
import type { ProceduralPixelAtlas } from '../assets/ProceduralPixelAtlas.js';

const HALF_W = VIEWPORT_W * 0.5; // 288
const HALF_H = VIEWPORT_H * 0.5; // 162
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;

// Pre-allocated fixed ring buffer for shadow afterimages & magma charge fire trails (ZERO allocations!)
const MAX_TRAIL = 8;

// Precomputed 6-vertex unit hexagon table for Nightmare Sovereign translucent energy shield
const HEX_VERTS = 6;
const HEX_COS = new Float32Array(HEX_VERTS);
const HEX_SIN = new Float32Array(HEX_VERTS);
for (let i = 0; i < HEX_VERTS; i++) {
  const ang = (i / HEX_VERTS) * TWO_PI;
  HEX_COS[i] = Math.cos(ang);
  HEX_SIN[i] = Math.sin(ang);
}

// Reusable scratch vertex buffers for rotated hexagon (avoids per-frame array allocations)
const SCRATCH_HEX_X = new Int32Array(HEX_VERTS);
const SCRATCH_HEX_Y = new Int32Array(HEX_VERTS);

// Palette constants for all 8 bespoke bosses
const DINO_HI = '#78e659';
const DINO_MID = '#2e9938';
const DINO_DARK = '#144f28';
const DINO_BELLY = '#ffe896';
const DINO_SPINE = '#ffd84d';
const DINO_EYE = '#ff3858';

const EYE_BARK_HI = '#c27d47';
const EYE_BARK_MID = '#824929';
const EYE_BARK_DARK = '#472219';
const EYE_MOSS_HI = '#9ef53d';
const EYE_MOSS_MID = '#4cb828';
const EYE_SCLERA_HI = '#fff8e6';
const EYE_SCLERA_MID = '#ebd6b8';
const EYE_VEIN = '#cc3b73';
const EYE_IRIS_HI = '#c7ff4d';
const EYE_IRIS_MID = '#38cc38';
const EYE_IRIS_DARK = '#125930';
const EYE_THORN = '#ff427a';
const EYE_LASER_DARK = '#9c0d30';
const EYE_LASER_BRIGHT = '#ff2b4a';

const BOAR_HI = '#ff8a24';
const BOAR_MID = '#cc291f';
const BOAR_DARK = '#4d1424';
const BOAR_ARMOR = '#382236';
const BOAR_LAVA_HOT = '#ffe84d';
const BOAR_EYE = '#fff799';

const BONE_HI = '#fff2d6';
const BONE_MID = '#cbb594';
const BONE_DARK = '#6e5847';
const BONE_SOUL = '#38ebd9';
const BONE_SOUL_BRIGHT = '#c2ffff';

const BULL_HI = '#c4cfde';
const BULL_MID = '#6c7a94';
const BULL_DARK = '#333b52';
const BULL_BRASS = '#ffad16';
const BULL_BRASS_DARK = '#945f00';
const BULL_VISOR = '#ff2b4a';
const BULL_STEAM_HI = '#e8f0ff';
const BULL_STEAM_MID = '#9fb0cc';
const BULL_STAR = '#ffe838';

const SPHINX_GOLD_HI = '#ffe866';
const SPHINX_GOLD_MID = '#d4961f';
const SPHINX_GOLD_DARK = '#6e4214';
const SPHINX_CYAN_HI = '#c2ffff';
const SPHINX_CYAN_MID = '#59f2ff';
const SPHINX_CYAN_DARK = '#185978';

const SHADOW_BODY_DARK = '#1d1220';
const SHADOW_BODY_MID = '#4d1473';
const SHADOW_BODY_HI = '#730087';
const SHADOW_OUTLINE = '#ff006a';
const SHADOW_EYE = '#24ff78';

const SOV_BODY_HI = '#ff3b9a';
const SOV_BODY_MID = '#781480';
const SOV_BODY_DARK = '#1c0829';
const SOV_CAPE_DARK = '#420a3a';
const SOV_CAPE_MID = '#8c1460';
const SOV_CAPE_EDGE = '#ff3b9a';
const SOV_GOLD = '#ffe838';
const SOV_RIFT = '#24ff78';
const SOV_SHIELD = '#59f2ff';

function isDrawable(
  img: HTMLCanvasElement | HTMLImageElement | null | undefined,
): img is HTMLCanvasElement | HTMLImageElement {
  if (!img) return false;
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  }
  return img.width > 0 && img.height > 0;
}

function isTelegraphState(st: string): boolean {
  return (
    st === 'telegraph' ||
    st === 'charge_telegraph' ||
    st === 'pre_drill' ||
    st === 'windup' ||
    st === 'aim'
  );
}

function isLaserState(st: string): boolean {
  return st === 'laser' || st === 'beam' || st === 'sweep' || st === 'laser_sweep';
}

function isChargeOrDashState(st: string): boolean {
  return (
    st === 'charge' ||
    st === 'drill' ||
    st === 'drill_charge' ||
    st === 'sprint' ||
    st === 'sweep' ||
    st === 'dash' ||
    st === 'blink' ||
    st === 'swoop'
  );
}

function isSlamState(st: string): boolean {
  return (
    st === 'slam' ||
    st === 'smash' ||
    st === 'stomp' ||
    st === 'leap' ||
    st === 'ground_pound' ||
    st === 'paw_slam'
  );
}

export class BossRenderer {
  // Zero-allocation fixed circular trail buffer (for Shadow Doppelganger afterimages & Magma Boar fire trails)
  private readonly trailX = new Float64Array(MAX_TRAIL);
  private readonly trailY = new Float64Array(MAX_TRAIL);
  private readonly trailFacing = new Int8Array(MAX_TRAIL);
  private readonly trailTime = new Float64Array(MAX_TRAIL);
  private trailCursor = 0;
  private trailBossId: BossId | null = null;
  private lastSampleTime = -1;
  private lastBossX = 0;
  private lastBossY = 0;

  public resetTrails(): void {
    this.trailTime.fill(-99);
    this.trailCursor = 0;
    this.trailBossId = null;
    this.lastSampleTime = -1;
  }

  private updateTrails(boss: BossRuntime, wx: number, wy: number, timeSec: number): void {
    if (this.trailBossId !== boss.id) {
      this.resetTrails();
      this.trailBossId = boss.id;
      this.lastBossX = wx;
      this.lastBossY = wy;
    }

    const jumpedDist = Math.hypot(wx - this.lastBossX, wy - this.lastBossY);
    const speed = Math.hypot(boss.vx, boss.vy);
    const wantsShadow =
      boss.id === 'shadow_doppelganger' &&
      (jumpedDist > 1.2 || speed > 3.6 || isChargeOrDashState(boss.state) || boss.state === 'stomp');
    const wantsFire =
      boss.id === 'magma_boar_king' &&
      (speed > 3.4 || isChargeOrDashState(boss.state));

    if (wantsShadow && jumpedDist > 1.5) {
      // Blink detected! Drop 3 echoing afterimages from the pre-blink origin toward destination
      for (let k = 0; k < 3; k++) {
        const frac = k * 0.25;
        this.pushTrail(
          this.lastBossX + (wx - this.lastBossX) * frac,
          this.lastBossY + (wy - this.lastBossY) * frac,
          boss.facing,
          timeSec - k * 0.05,
        );
      }
      this.lastSampleTime = timeSec;
    } else if ((wantsShadow || wantsFire) && (this.lastSampleTime < 0 || timeSec - this.lastSampleTime >= 0.045)) {
      this.pushTrail(wx, wy, boss.facing, timeSec);
      this.lastSampleTime = timeSec;
    }

    this.lastBossX = wx;
    this.lastBossY = wy;
  }

  private pushTrail(x: number, y: number, facing: -1 | 1, timeSec: number): void {
    const idx = this.trailCursor;
    this.trailCursor = (this.trailCursor + 1) % MAX_TRAIL;
    this.trailX[idx] = x;
    this.trailY[idx] = y;
    this.trailFacing[idx] = facing;
    this.trailTime[idx] = timeSec;
  }

  /**
   * Pass 1 (Behind Boss & Hero): Arena morph cues, phase aura, ground-pound dust, shadow/fire trails.
   */
  public renderBack(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    boss: BossRuntime,
    room: RoomDef,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
  ): void {
    const wx = boss.prevX + (boss.x - boss.prevX) * alpha;
    const wy = boss.prevY + (boss.y - boss.prevY) * alpha;
    this.updateTrails(boss, wx, wy, timeSec);

    const cx = Math.round((wx + boss.width * 0.5 - camX) * PPU + HALF_W);
    const cy = Math.round((camY - (wy + boss.height * 0.5)) * PPU + HALF_H);
    const prevAlpha = ctx.globalAlpha;

    // 1. Nightmare Sovereign arena morphing platform cues (glowing arcane energy frames & phase beams!)
    if (boss.id === 'nightmare_sovereign' && boss.arenaMorphPhase > 0) {
      this.renderArenaMorphCues(ctx, state, boss, room, camX, camY, alpha, timeSec);
    }

    // 2. Nightmare Sovereign Phase-3 Eclipse Halo (glows majestically behind sovereign!)
    if (boss.id === 'nightmare_sovereign' && boss.phase >= 2) {
      const hover = Math.round(Math.sin(timeSec * 3.0) * 4);
      this.renderSovereignEclipseHalo(ctx, cx, cy + hover - 12, boss.phase, timeSec);
    }

    // 3. Phase-escalating energy aura behind every boss
    this.renderPhaseAura(ctx, boss, cx, cy, timeSec);

    // 4. Shadow Doppelganger void shockwave aura & echoing shadow afterimages
    if (boss.id === 'shadow_doppelganger') {
      this.renderShadowVoidAuraAndAfterimages(ctx, boss, camX, camY, timeSec);
    }

    // 5. Magma Boar King fiery charge trail
    if (boss.id === 'magma_boar_king') {
      this.renderMagmaChargeTrail(ctx, boss, camX, camY, timeSec);
    }

    ctx.globalAlpha = prevAlpha;
  }

  /**
   * Pass 2 (Boss Body): Multi-part animated bespoke pixel rendering for all 8 bosses!
   */
  public renderBody(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    boss: BossRuntime,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const wx = boss.prevX + (boss.x - boss.prevX) * alpha;
    const wy = boss.prevY + (boss.y - boss.prevY) * alpha;
    const cx = Math.round((wx + boss.width * 0.5 - camX) * PPU + HALF_W);
    const cy = Math.round((camY - (wy + boss.height * 0.5)) * PPU + HALF_H);
    const footY = Math.round((camY - wy) * PPU + HALF_H);
    const flash = boss.hitFlashTimer > 0;
    const prevAlpha = ctx.globalAlpha;

    // Optional Custom Pack sprite override (keeps dynamic telegraphs/lasers/shields/stun stars intact!)
    const customBoss = customPack ? customPack.getSprite(`boss_${boss.id}`) : null;
    if (!flash && isDrawable(customBoss)) {
      const bw = Math.round(boss.width * PPU);
      const bh = Math.round(boss.height * PPU);
      const hover = Math.round(Math.sin(timeSec * 3.4) * 3);
      ctx.save();
      ctx.translate(cx, cy + hover);
      if (boss.facing < 0 && boss.id !== 'primal_eye') {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(customBoss, -(bw >> 1), -(bh >> 1), bw, bh);
      ctx.restore();
      ctx.globalAlpha = prevAlpha;
      return;
    }

    // Bespoke multi-part animated pixel rendering per BossId
    switch (boss.id) {
      case 'dino_behemoth':
        this.renderDinoBehemoth(ctx, boss, cx, footY, flash, timeSec);
        break;
      case 'primal_eye':
        this.renderPrimalEye(ctx, state, boss, wx, wy, cx, cy, flash, timeSec, atlas);
        break;
      case 'magma_boar_king':
        this.renderMagmaBoarKing(ctx, boss, cx, footY, flash, timeSec);
        break;
      case 'bone_colossus':
        this.renderBoneColossus(ctx, boss, cx, cy, footY, flash, timeSec);
        break;
      case 'mecha_bull':
        this.renderMechaBull(ctx, boss, cx, footY, flash, timeSec);
        break;
      case 'electro_sphinx':
        this.renderElectroSphinx(ctx, boss, cx, cy, flash, timeSec);
        break;
      case 'shadow_doppelganger':
        this.renderShadowDoppelganger(ctx, boss, cx, footY, flash, timeSec);
        break;
      case 'nightmare_sovereign':
        this.renderNightmareSovereign(ctx, boss, cx, cy, flash, timeSec);
        break;
    }

    ctx.globalAlpha = prevAlpha;
  }

  /**
   * Pass 3 (Foreground Over Entities): Laser beams, hexagonal shield, telegraph reticles,
   * stun stars, ground-pound shockwaves & smash flashes so combat cues are 100% readable!
   */
  public renderForeground(
    ctx: CanvasRenderingContext2D,
    _state: SimState,
    boss: BossRuntime,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
  ): void {
    const wx = boss.prevX + (boss.x - boss.prevX) * alpha;
    const wy = boss.prevY + (boss.y - boss.prevY) * alpha;
    const cx = Math.round((wx + boss.width * 0.5 - camX) * PPU + HALF_W);
    const cy = Math.round((camY - (wy + boss.height * 0.5)) * PPU + HALF_H);
    const footY = Math.round((camY - wy) * PPU + HALF_H);
    const prevAlpha = ctx.globalAlpha;

    // 1. Primal Eye segmented crimson laser beam (`boss.laserAngle`)
    if (boss.id === 'primal_eye') {
      const hover = Math.round(Math.sin(timeSec * 3.5) * 3);
      if (isTelegraphState(boss.state)) {
        this.drawCrimsonSightline(ctx, cx, cy + hover, boss.laserAngle, timeSec);
      } else if (isLaserState(boss.state)) {
        this.drawSegmentedCrimsonLaser(ctx, cx, cy + hover, boss.laserAngle, timeSec);
      }
    }

    // 2. Electro Sphinx crackling 90-degree sweeping plasma laser (`boss.laserAngle`)
    if (boss.id === 'electro_sphinx') {
      const hover = Math.round(Math.sin(timeSec * 3.2) * 3);
      const gemY = cy + hover + 2;
      if (isTelegraphState(boss.state)) {
        this.drawPlasmaSweepTelegraph(ctx, cx, gemY, boss.laserAngle, timeSec);
      } else if (isLaserState(boss.state)) {
        this.drawCracklingPlasmaLaser(ctx, cx, gemY, boss.laserAngle, timeSec);
      }
    }

    // 3. Dino Behemoth ground-pound dust & shockwave flash
    if (boss.id === 'dino_behemoth') {
      const heavyImpact =
        isSlamState(boss.state) ||
        boss.state === 'vulnerable' ||
        (boss.vy < -2.5) ||
        (boss.state === 'sweep' && Math.abs(boss.vy) < 1.0);
      if (heavyImpact) {
        this.drawGroundPoundShockwave(ctx, cx, footY, boss.state === 'vulnerable' ? 0.65 : 1.0, timeSec);
      }
    }

    // 4. Bone Colossus bone-club smash telegraph floor zone
    if (boss.id === 'bone_colossus' && (isTelegraphState(boss.state) || isSlamState(boss.state))) {
      this.drawBoneClubTelegraph(ctx, cx, footY, boss.facing, isSlamState(boss.state), timeSec);
    }

    // 5. Mecha Bull bright red drill-charge telegraph lane & orbiting yellow stun stars!
    if (boss.id === 'mecha_bull') {
      if (isTelegraphState(boss.state)) {
        this.drawMechaBullChargeTelegraph(ctx, cx, cy, boss.facing, timeSec);
      }
      if (boss.state === 'stunned') {
        this.drawOrbitingStunStars(ctx, cx, footY - 70, timeSec);
      }
    }

    // 6. Boss Energy Shield Ring:
    //    - Nightmare Sovereign gets the signature Hexagonal Translucent Energy Shield Ring!
    //    - Other bosses (e.g. Mecha Bull during armored drill charge) get a crisp armored energy barrier!
    if (boss.shieldActive) {
      if (boss.id === 'nightmare_sovereign') {
        const hover = Math.round(Math.sin(timeSec * 3.0) * 4);
        this.drawHexagonalEnergyShield(ctx, cx, cy + hover, 58, timeSec);
      } else {
        this.drawArmoredBarrierRing(ctx, cx, cy, Math.round(Math.max(boss.width, boss.height) * PPU * 0.56), boss.facing, timeSec);
      }
    }

    ctx.globalAlpha = prevAlpha;
  }

  // ==========================================================================
  // BOSS 1: DINO BEHEMOTH — Heavy Armored Snout, Chomping Jaw, Ground-Pound Shockwave
  // ==========================================================================

  private renderDinoBehemoth(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    cx: number,
    footY: number,
    flash: boolean,
    timeSec: number,
  ): void {
    const dir = boss.facing;
    const stride = Math.round(Math.sin(timeSec * 8) * 3);
    const breathe = Math.round(Math.sin(timeSec * 4) * 2);
    const chompOpen = isTelegraphState(boss.state) || boss.state === 'barrage'
      ? 9
      : isSlamState(boss.state) || boss.state === 'sweep'
        ? 4 + Math.round(Math.abs(Math.sin(timeSec * 16)) * 6)
        : Math.round(Math.max(0, Math.sin(timeSec * 5.5)) * 5);

    const hi = flash ? FLASH_WHITE : DINO_HI;
    const mid = flash ? FLASH_WHITE : DINO_MID;
    const dark = flash ? HIGHLIGHT_CREAM : DINO_DARK;
    const belly = flash ? FLASH_WHITE : DINO_BELLY;
    const spine = flash ? FLASH_WHITE : DINO_SPINE;
    const eye = flash ? FLASH_WHITE : DINO_EYE;

    // Ground contact shadow
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(cx - 34, footY - 2, 68, 4);
    ctx.globalAlpha = 1;

    const bodyY = footY - 34 + breathe;

    // 1. Heavy armored tail wagging behind
    const tailWag = Math.round(Math.sin(timeSec * 5) * 3);
    this.drawOutlinedRect(ctx, cx - dir * 32 - 9, bodyY + 6 + tailWag, 18, 12, mid, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx - dir * 42 - 6, bodyY + 10 + tailWag, 12, 8, dark, OUTLINE_DARK);
    // Tail ridge spikes
    this.drawOutlinedRect(ctx, cx - dir * 36 - 3, bodyY + 1 + tailWag, 6, 5, spine, OUTLINE_DARK);

    // 2. Back stomping leg
    this.drawOutlinedRect(ctx, cx - dir * 14 - 8, footY - 18 - (stride > 0 ? 2 : 0), 16, 18, dark, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx - dir * 10 - 5, footY - 5, 10, 5, HIGHLIGHT_CREAM, OUTLINE_DARK);

    // 3. Hulking scaly torso + golden dorsal armor plates
    this.drawOutlinedShadedBox(ctx, cx - 26, bodyY - 14, 52, 36, hi, mid, dark);
    // Plated cream belly
    this.drawOutlinedRect(ctx, cx - 14 + dir * 4, bodyY + 2, 24, 18, belly, OUTLINE_DARK);
    if (!flash) {
      ctx.fillStyle = DINO_SPINE;
      ctx.fillRect(cx - 12 + dir * 4, bodyY + 7, 20, 2);
      ctx.fillRect(cx - 12 + dir * 4, bodyY + 13, 20, 2);
    }

    // Jagged golden back spines
    for (let s = 0; s < 4; s++) {
      const sx = cx - dir * (20 - s * 9) - 3;
      const sy = bodyY - 21 - (s % 2) * 3;
      this.drawOutlinedRect(ctx, sx, sy, 7, 8, spine, OUTLINE_DARK);
    }

    // 4. Front clawed stomping leg
    this.drawOutlinedRect(ctx, cx + dir * 10 - 9, footY - 19 + (stride < 0 ? -2 : 0), 18, 19, mid, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + dir * 14 - 5, footY - 5, 11, 5, HIGHLIGHT_CREAM, OUTLINE_DARK);

    // 5. Heavy Armored Snout (upper cranium + riveted brow plate)
    const headX = cx + dir * 20;
    const headY = bodyY - 22;
    this.drawOutlinedShadedBox(ctx, headX - 18, headY - 10, 36, 18, hi, mid, dark);
    // Heavy armored snout noseplate extending forward
    const snoutX = dir > 0 ? headX + 8 : headX - 28;
    this.drawOutlinedShadedBox(ctx, snoutX, headY - 6, 20, 14, spine, hi, mid);
    // Horned nose ridge
    const hornX = dir > 0 ? snoutX + 12 : snoutX + 2;
    this.drawOutlinedRect(ctx, hornX, headY - 12, 6, 7, HIGHLIGHT_CREAM, OUTLINE_DARK);
    // Angry crimson eye + heavy brow
    const eyeX = dir > 0 ? headX + 2 : headX - 9;
    this.drawOutlinedRect(ctx, eyeX, headY - 5, 7, 6, eye, OUTLINE_DARK);
    if (!flash) {
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(eyeX + (dir > 0 ? 4 : 1), headY - 3, 2, 3);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(eyeX + 1, headY - 4, 2, 1);
    }
    // Upper sharp fangs hanging under snout
    for (let t = 0; t < 3; t++) {
      const fx = dir > 0 ? headX + 6 + t * 6 : headX - 10 - t * 6;
      this.drawOutlinedRect(ctx, fx, headY + 7, 4, 5, HIGHLIGHT_CREAM, OUTLINE_DARK);
    }

    // 6. Independently Articulated Chomping Lower Jaw!
    const jawY = headY + 9 + chompOpen;
    const jawX = dir > 0 ? headX - 6 : headX - 24;
    // Open crimson mouth interior visible when chomping wide
    if (chompOpen > 2 && !flash) {
      ctx.fillStyle = '#6e0d24';
      ctx.fillRect(jawX + 2, headY + 8, 26, chompOpen + 2);
      ctx.fillStyle = '#ff477e';
      ctx.fillRect(jawX + 6, headY + 10, 16, Math.max(2, chompOpen - 2));
    }
    this.drawOutlinedShadedBox(ctx, jawX, jawY, 30, 9, mid, dark, OUTLINE_DARK);
    // Lower teeth rising up
    for (let t = 0; t < 3; t++) {
      const fx = dir > 0 ? jawX + 8 + t * 6 : jawX + 4 + t * 6;
      this.drawOutlinedRect(ctx, fx, jawY - 4, 4, 4, HIGHLIGHT_CREAM, OUTLINE_DARK);
    }
  }

  // ==========================================================================
  // BOSS 2: PRIMAL EYE — Pulsing Organic Eye, Tracking Green Cat-Iris, Vine Pods
  // ==========================================================================

  private renderPrimalEye(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    boss: BossRuntime,
    wx: number,
    wy: number,
    cx: number,
    cy: number,
    flash: boolean,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
  ): void {
    const hover = Math.round(Math.sin(timeSec * 3.5) * 3);
    const ey = cy + hover;
    const pulseSpeed = boss.phase === 3 ? 8.0 : boss.phase === 2 ? 6.0 : 4.2;
    const pulse = Math.round(Math.sin(timeSec * pulseSpeed) * 2.5);

    // 1. Radiating ancient bark horns & moss spikes behind organic eye shell
    const barkHi = flash ? FLASH_WHITE : EYE_BARK_HI;
    const barkMid = flash ? FLASH_WHITE : EYE_BARK_MID;
    const barkDark = flash ? HIGHLIGHT_CREAM : EYE_BARK_DARK;
    const mossHi = flash ? FLASH_WHITE : EYE_MOSS_HI;
    const mossMid = flash ? FLASH_WHITE : EYE_MOSS_MID;

    for (let s = 0; s < 10; s++) {
      const ang = (s / 10) * TWO_PI + Math.sin(timeSec * 1.6) * 0.08;
      const sx = Math.round(cx + Math.cos(ang) * (36 + pulse));
      const sy = Math.round(ey + Math.sin(ang) * (34 + pulse));
      this.drawOutlinedRect(ctx, sx - 5, sy - 5, 10, 10, s % 2 === 0 ? barkMid : mossMid, OUTLINE_DARK);
      if (!flash) {
        ctx.fillStyle = s % 2 === 0 ? barkHi : mossHi;
        ctx.fillRect(sx - 3, sy - 3, 4, 4);
      }
    }

    // 2. Pulsing organic bark-armored eye body (pixel-stepped shaded ellipse!)
    this.drawPixelEllipse(ctx, cx, ey, 35 + pulse, 32 - (pulse >> 1), barkHi, barkMid, barkDark, OUTLINE_DARK);

    // Lush moss crown across upper brow
    this.drawPixelEllipse(ctx, cx, ey - 22, 26, 9, mossHi, mossMid, barkDark, OUTLINE_DARK);

    // 3. Glowing veined cream sclera
    this.drawPixelEllipse(
      ctx,
      cx,
      ey,
      26 + (pulse >> 1),
      22,
      flash ? FLASH_WHITE : EYE_SCLERA_HI,
      flash ? FLASH_WHITE : EYE_SCLERA_MID,
      flash ? HIGHLIGHT_CREAM : '#bfa091',
      OUTLINE_DARK,
    );

    if (!flash) {
      // Pulsing organic crimson sclera veins
      ctx.fillStyle = EYE_VEIN;
      ctx.fillRect(cx - 22, ey - 6, 8, 2);
      ctx.fillRect(cx - 16, ey - 4, 4, 1);
      ctx.fillRect(cx - 20, ey + 7, 7, 2);
      ctx.fillRect(cx + 15, ey - 5, 8, 2);
      ctx.fillRect(cx + 14, ey + 7, 7, 2);
    }

    // 4. Hero-Tracking Green Cat-Iris!
    const heroCx = state.hero.x + state.hero.width * 0.5;
    const heroCy = state.hero.y + state.hero.height * 0.5;
    const bossCx = wx + boss.width * 0.5;
    const bossCy = wy + boss.height * 0.5;
    const dx = heroCx - bossCx;
    const dy = heroCy - bossCy;
    const dist = Math.hypot(dx, dy) || 1;
    const lookX = Math.round((dx / dist) * 10);
    const lookY = Math.round((-dy / dist) * 7);
    const ix = cx + lookX;
    const iy = ey + lookY;

    if (!flash) {
      const chargingLaser = isTelegraphState(boss.state) || isLaserState(boss.state);
      if (atlas.primalEyeIris && !chargingLaser) {
        ctx.drawImage(atlas.primalEyeIris, ix - 14, iy - 14);
      } else {
        // Live rendered blazing green cat-iris (glows crimson-amber core when firing laser!)
        this.drawPixelEllipse(
          ctx,
          ix,
          iy,
          12,
          12,
          EYE_IRIS_HI,
          EYE_IRIS_MID,
          EYE_IRIS_DARK,
          OUTLINE_DARK,
        );
        this.drawPixelEllipse(
          ctx,
          ix,
          iy,
          8,
          8,
          chargingLaser ? EYE_LASER_BRIGHT : '#ffae24',
          chargingLaser ? EYE_LASER_DARK : '#d97814',
          EYE_IRIS_DARK,
          OUTLINE_DARK,
        );
        // Vertical reptilian cat-slit pupil
        const slitW = chargingLaser ? 4 : 3;
        ctx.fillStyle = chargingLaser && (((timeSec * 20) | 0) & 1) === 0 ? HIGHLIGHT_CREAM : OUTLINE_DARK;
        ctx.fillRect(ix - (slitW >> 1), iy - 8, slitW, 16);
        // Specular eye glints
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(ix - 5, iy - 6, 3, 3);
        ctx.fillRect(ix + 3, iy + 4, 2, 2);
      }
    }

    // Thick upper & lower eyelids (narrow fiercely during telegraph/laser!)
    const squint = isTelegraphState(boss.state) || isLaserState(boss.state) ? 5 : 0;
    this.drawOutlinedRect(ctx, cx - 24, ey - 24, 48, 6 + squint, barkDark, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx - 22, ey + 18 - squint, 44, 5 + squint, barkDark, OUTLINE_DARK);

    // 5. Orbiting Thorny Vine Pods (4 pods; escalates to 6 in Phase 3!)
    const podCount = boss.phase === 3 ? 6 : 4;
    const orbitR = 52 + (boss.phase - 1) * 6 + Math.round(Math.sin(timeSec * 3.2) * 4);
    const orbitSpd = boss.phase === 3 ? 2.5 : boss.phase === 2 ? 1.85 : 1.25;

    for (let p = 0; p < podCount; p++) {
      const ang = timeSec * orbitSpd + (p / podCount) * TWO_PI;
      const px = Math.round(cx + Math.cos(ang) * orbitR);
      const py = Math.round(ey + Math.sin(ang) * orbitR * 0.76);

      // Articulated pixel thorny vine stalk connecting eye body to pod
      for (let seg = 1; seg <= 4; seg++) {
        const frac = seg * 0.2;
        const sx = Math.round(cx + (px - cx) * frac);
        const sy = Math.round(ey + (py - ey) * frac);
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(sx - 2, sy - 2, 5, 5);
        ctx.fillStyle = flash ? FLASH_WHITE : EYE_MOSS_MID;
        ctx.fillRect(sx - 1, sy - 1, 3, 3);
        if (!flash && seg === 2) {
          ctx.fillStyle = EYE_THORN;
          ctx.fillRect(sx + 2, sy - 2, 2, 2);
        }
      }

      // Thorny vine pod bulb
      if (!flash && atlas.primalEyeTendril) {
        ctx.drawImage(atlas.primalEyeTendril, px - 12, py - 12);
      } else {
        this.drawPixelEllipse(ctx, px, py, 8, 8, mossHi, mossMid, EYE_IRIS_DARK, OUTLINE_DARK);
        this.drawOutlinedRect(ctx, px - 2, py - 11, 4, 4, flash ? FLASH_WHITE : EYE_THORN, OUTLINE_DARK);
        this.drawOutlinedRect(ctx, px - 2, py + 7, 4, 4, flash ? FLASH_WHITE : EYE_THORN, OUTLINE_DARK);
        this.drawOutlinedRect(ctx, px - 11, py - 2, 4, 4, flash ? FLASH_WHITE : EYE_THORN, OUTLINE_DARK);
        this.drawOutlinedRect(ctx, px + 7, py - 2, 4, 4, flash ? FLASH_WHITE : EYE_THORN, OUTLINE_DARK);
      }
    }
  }

  // ==========================================================================
  // BOSS 3: MAGMA BOAR KING — Blazing Lava Crown, Molten Warhammer, Rage Tusks
  // ==========================================================================

  private renderMagmaBoarKing(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    cx: number,
    footY: number,
    flash: boolean,
    timeSec: number,
  ): void {
    const dir = boss.facing;
    const charging = isChargeOrDashState(boss.state) || Math.abs(boss.vx) > 3.5;
    const slamming = isTelegraphState(boss.state) || isSlamState(boss.state);
    const bounce = Math.round(Math.sin(timeSec * (charging ? 18 : 6)) * (charging ? 3 : 2));

    const hi = flash ? FLASH_WHITE : BOAR_HI;
    const mid = flash ? FLASH_WHITE : BOAR_MID;
    const dark = flash ? HIGHLIGHT_CREAM : BOAR_DARK;
    const lava = flash ? FLASH_WHITE : BOAR_LAVA_HOT;
    const armor = flash ? HIGHLIGHT_CREAM : BOAR_ARMOR;

    // Ground shadow
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(cx - 38, footY - 2, 76, 4);
    ctx.globalAlpha = 1;

    const by = footY - 38 + bounce;

    // 1. Sturdy armored hooves
    const hoofStep = Math.round(Math.sin(timeSec * (charging ? 22 : 7)) * 4);
    this.drawOutlinedRect(ctx, cx - 22 + hoofStep, footY - 14, 14, 14, armor, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + 8 - hoofStep, footY - 14, 14, 14, armor, OUTLINE_DARK);
    if (!flash) {
      ctx.fillStyle = lava;
      ctx.fillRect(cx - 20 + hoofStep, footY - 4, 10, 2);
      ctx.fillRect(cx + 10 - hoofStep, footY - 4, 10, 2);
    }

    // 2. Massive molten boar body + volcanic armor plates
    this.drawPixelEllipse(ctx, cx, by + 4, 34, 26, hi, mid, dark, OUTLINE_DARK);
    // Glowing magma cracks across flanks
    if (!flash) {
      ctx.fillStyle = lava;
      ctx.fillRect(cx - 18, by + 2, 12, 2);
      ctx.fillRect(cx - 8, by + 4, 2, 8);
      ctx.fillRect(cx + 6, by - 4, 10, 2);
      ctx.fillRect(cx + 12, by - 2, 2, 9);
    }
    // Obsidian pauldrons
    this.drawOutlinedShadedBox(ctx, cx - 32, by - 12, 16, 16, mid, armor, OUTLINE_DARK);
    this.drawOutlinedShadedBox(ctx, cx + 16, by - 12, 16, 16, mid, armor, OUTLINE_DARK);

    // 3. Blazing Lava Crown atop head (animated roaring flames!)
    const crownY = by - 24;
    this.drawOutlinedShadedBox(ctx, cx - 18, crownY, 36, 9, lava, armor, OUTLINE_DARK);
    const flameBoost = boss.phase === 3 || charging ? 7 : 3;
    for (let f = 0; f < 5; f++) {
      const fx = cx - 14 + f * 7;
      const fh = 10 + flameBoost + Math.round(Math.sin(timeSec * 14 + f * 1.9) * 4);
      this.drawOutlinedRect(ctx, fx - 2, crownY - fh, 6, fh, f % 2 === 0 ? hi : mid, OUTLINE_DARK);
      if (!flash) {
        ctx.fillStyle = lava;
        ctx.fillRect(fx - 1, crownY - fh + 3, 4, Math.max(3, fh - 4));
        ctx.fillStyle = HIGHLIGHT_CREAM;
        ctx.fillRect(fx, crownY - fh + 5, 2, 3);
      }
    }

    // 4. Fierce boar snout, glowing eyes & massive curving Rage Tusks!
    const faceX = cx + dir * 10;
    // Burning eyes
    this.drawOutlinedRect(ctx, faceX - 10, by - 10, 7, 6, flash ? FLASH_WHITE : BOAR_EYE, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, faceX + 4, by - 10, 7, 6, flash ? FLASH_WHITE : BOAR_EYE, OUTLINE_DARK);
    // Snout plate
    this.drawOutlinedShadedBox(ctx, faceX - 9, by - 1, 20, 12, hi, mid, dark);
    if (!flash) {
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(faceX - 4, by + 3, 3, 4);
      ctx.fillRect(faceX + 3, by + 3, 3, 4);
    }
    // Giant curving Rage Tusks (glow red-hot when charging!)
    const tuskTip = charging ? lava : HIGHLIGHT_CREAM;
    this.drawOutlinedRect(ctx, faceX - 20, by + 2, 9, 7, HIGHLIGHT_CREAM, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, faceX - 24, by - 7, 7, 11, tuskTip, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, faceX + 12, by + 2, 9, 7, HIGHLIGHT_CREAM, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, faceX + 18, by - 7, 7, 11, tuskTip, OUTLINE_DARK);

    // 5. Glowing Molten Warhammer (raises high overhead during telegraph, slams down on strike!)
    const swingUp = isTelegraphState(boss.state) ? -28 : isSlamState(boss.state) ? 14 : Math.round(Math.sin(timeSec * 4.5) * 5);
    const handleX = cx + dir * 32;
    const handleY = by + 4 + swingUp;
    // Iron-obsidian haft
    this.drawOutlinedRect(ctx, handleX - 3, handleY - 20, 6, 36, armor, OUTLINE_DARK);
    // Massive glowing molten hammer head!
    const headW = 28;
    const headH = 18;
    const hx = handleX - (headW >> 1);
    const hy = handleY - 30;
    this.drawOutlinedShadedBox(ctx, hx, hy, headW, headH, hi, armor, OUTLINE_DARK);
    if (!flash) {
      // Glowing molten impact faces & magma core runes on warhammer!
      ctx.fillStyle = lava;
      ctx.fillRect(hx + 2, hy + 2, 4, headH - 4);
      ctx.fillRect(hx + headW - 6, hy + 2, 4, headH - 4);
      ctx.fillRect(hx + 10, hy + 6, 8, 6);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(hx + 12, hy + 8, 4, 2);
      if (slamming) {
        // Blazing swing ember aura around warhammer
        ctx.fillStyle = lava;
        ctx.fillRect(hx - 4, hy - 4, 3, 3);
        ctx.fillRect(hx + headW + 1, hy - 3, 3, 3);
      }
    }
  }

  private renderMagmaChargeTrail(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    camX: number,
    camY: number,
    timeSec: number,
  ): void {
    for (let i = 0; i < MAX_TRAIL; i++) {
      const age = timeSec - this.trailTime[i]!;
      if (age < 0 || age > 0.38) continue;
      const frac = 1 - age / 0.38;
      const sx = Math.round((this.trailX[i]! + boss.width * 0.5 - camX) * PPU + HALF_W);
      const sy = Math.round((camY - this.trailY[i]!) * PPU + HALF_H);
      const flameH = Math.max(6, Math.round(28 * frac));
      const flameW = Math.max(8, Math.round(24 * frac));

      ctx.globalAlpha = frac * 0.72;
      ctx.fillStyle = BOAR_MID;
      ctx.fillRect(sx - (flameW >> 1), sy - flameH, flameW, flameH);
      ctx.fillStyle = BOAR_HI;
      ctx.fillRect(sx - (flameW >> 2), sy - Math.round(flameH * 0.75), flameW >> 1, Math.round(flameH * 0.75));
      ctx.fillStyle = BOAR_LAVA_HOT;
      ctx.fillRect(sx - 3, sy - Math.round(flameH * 0.45), 6, Math.round(flameH * 0.45));
    }
  }

  // ==========================================================================
  // BOSS 4: BONE COLOSSUS — Towering Ivory Skull, Floating Ribcage, Bone-Club
  // ==========================================================================

  private renderBoneColossus(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    cx: number,
    cy: number,
    footY: number,
    flash: boolean,
    timeSec: number,
  ): void {
    const dir = boss.facing;
    const floatY = Math.round(Math.sin(timeSec * 3.0) * 4);
    const hi = flash ? FLASH_WHITE : BONE_HI;
    const mid = flash ? FLASH_WHITE : BONE_MID;
    const dark = flash ? HIGHLIGHT_CREAM : BONE_DARK;
    const soul = flash ? FLASH_WHITE : BONE_SOUL;
    const soulBright = flash ? FLASH_WHITE : BONE_SOUL_BRIGHT;

    // Ground shadow
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(cx - 28, footY - 2, 56, 4);
    ctx.globalAlpha = 1;

    // 1. Floating Ribcage Segments (3 independent levitating ivory rib tiers + glowing cyan soul core!)
    const ribBaseY = cy + 6 + floatY;
    // Central glowing spirit flame core inside ribcage
    const corePulse = Math.round(Math.sin(timeSec * 8) * 2);
    this.drawPixelEllipse(ctx, cx, ribBaseY + 8, 10 + corePulse, 13 + corePulse, soulBright, soul, '#12596b', OUTLINE_DARK);

    // Floating spine vertebrae
    for (let v = 0; v < 3; v++) {
      const vy = ribBaseY + v * 11 + Math.round(Math.sin(timeSec * 4.5 + v * 0.9) * 2);
      this.drawOutlinedRect(ctx, cx - 4, vy, 8, 7, mid, OUTLINE_DARK);
    }

    // 3 floating ribcage pairs bobbing with staggered phases
    for (let r = 0; r < 3; r++) {
      const ribW = 24 - r * 3;
      const ry = ribBaseY + r * 10 + Math.round(Math.sin(timeSec * 4.2 + r * 1.1) * 2);
      // Left curved rib segment
      this.drawOutlinedShadedBox(ctx, cx - ribW - 4, ry, ribW - 2, 6, hi, mid, dark);
      this.drawOutlinedRect(ctx, cx - ribW - 6, ry + 2, 5, 6, mid, OUTLINE_DARK);
      // Right curved rib segment
      this.drawOutlinedShadedBox(ctx, cx + 6, ry, ribW - 2, 6, hi, mid, dark);
      this.drawOutlinedRect(ctx, cx + ribW + 1, ry + 2, 5, 6, mid, OUTLINE_DARK);
    }

    // 2. Towering Ivory Skull with Glowing Sockets
    const skullY = cy - 22 + Math.round(Math.sin(timeSec * 3.0 + 0.5) * 3);
    // Cranium dome
    this.drawPixelEllipse(ctx, cx, skullY - 4, 24, 19, hi, mid, dark, OUTLINE_DARK);
    // Cheekbones & nasal ridge
    this.drawOutlinedShadedBox(ctx, cx - 19, skullY + 5, 38, 11, hi, mid, dark);
    // Cracked ancient forehead rune
    if (!flash) {
      ctx.fillStyle = dark;
      ctx.fillRect(cx - 2, skullY - 17, 2, 7);
      ctx.fillRect(cx, skullY - 12, 3, 2);
      ctx.fillStyle = soul;
      ctx.fillRect(cx - 1, skullY - 14, 2, 3);
    }
    // Deep dark eye sockets with blazing cyan spirit flames!
    this.drawOutlinedRect(ctx, cx - 15, skullY - 6, 11, 10, OUTLINE_DARK, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + 4, skullY - 6, 11, 10, OUTLINE_DARK, OUTLINE_DARK);
    const socketFlame = boss.phase === 3 ? UI_COLORS.frameGold : soul;
    const eyeFlicker = Math.round(Math.sin(timeSec * 15) * 1.5);
    ctx.fillStyle = flash ? FLASH_WHITE : socketFlame;
    ctx.fillRect(cx - 12, skullY - 3, 5, 5);
    ctx.fillRect(cx + 7, skullY - 3, 5, 5);
    ctx.fillStyle = HIGHLIGHT_CREAM;
    ctx.fillRect(cx - 11, skullY - 2 + eyeFlicker, 3, 2);
    ctx.fillRect(cx + 8, skullY - 2 - eyeFlicker, 3, 2);
    // Nasal cavity
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(cx - 2, skullY + 4, 4, 5);

    // Articulated rattling jawbone
    const jawDrop = isTelegraphState(boss.state) || boss.state === 'barrage' ? 5 : Math.round(Math.abs(Math.sin(timeSec * 6)) * 2);
    this.drawOutlinedShadedBox(ctx, cx - 13, skullY + 15 + jawDrop, 26, 8, mid, dark, OUTLINE_DARK);
    for (let t = -9; t <= 7; t += 5) {
      ctx.fillStyle = hi;
      ctx.fillRect(cx + t, skullY + 13 + jawDrop, 3, 4);
    }

    // 3. Articulated Floating Skeletal Hand + Giant Bone-Club!
    const raised = isTelegraphState(boss.state);
    const smashing = isSlamState(boss.state);
    const clubY = raised ? skullY - 18 : smashing ? footY - 18 : cy + 4 + floatY;
    const clubX = cx + dir * (smashing ? 34 : 32);

    // Skeletal gauntlet clutching handle
    this.drawOutlinedShadedBox(ctx, clubX - 6, clubY + 4, 12, 10, hi, mid, dark);
    // Massive femur bone-club shaft & knobby ends
    if (smashing) {
      // Horizontal smashing club sweep!
      const sx = dir > 0 ? clubX - 4 : clubX - 38;
      this.drawOutlinedShadedBox(ctx, sx, clubY, 42, 10, hi, mid, dark);
      this.drawOutlinedRect(ctx, dir > 0 ? sx + 34 : sx - 4, clubY - 5, 12, 9, hi, OUTLINE_DARK);
      this.drawOutlinedRect(ctx, dir > 0 ? sx + 34 : sx - 4, clubY + 6, 12, 9, mid, OUTLINE_DARK);
    } else {
      // Vertical raised/poised giant bone-club!
      this.drawOutlinedShadedBox(ctx, clubX - 5, clubY - 28, 10, 36, hi, mid, dark);
      this.drawOutlinedRect(ctx, clubX - 11, clubY - 34, 10, 10, hi, OUTLINE_DARK);
      this.drawOutlinedRect(ctx, clubX + 1, clubY - 34, 10, 10, hi, OUTLINE_DARK);
      if (raised && !flash) {
        // Pulsing telegraph glow on club head
        ctx.fillStyle = soulBright;
        ctx.fillRect(clubX - 8, clubY - 31, 4, 4);
        ctx.fillRect(clubX + 4, clubY - 31, 4, 4);
      }
    }
  }

  private drawBoneClubTelegraph(
    ctx: CanvasRenderingContext2D,
    cx: number,
    footY: number,
    facing: -1 | 1,
    impactNow: boolean,
    timeSec: number,
  ): void {
    const zoneX = cx + facing * 34;
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 18);
    ctx.globalAlpha = impactNow ? 0.9 : 0.4 + pulse * 0.45;
    ctx.fillStyle = impactNow ? HIGHLIGHT_CREAM : BONE_SOUL;
    ctx.fillRect(zoneX - 24, footY - 4, 48, impactNow ? 6 : 3);
    ctx.fillStyle = impactNow ? BONE_SOUL_BRIGHT : UI_COLORS.frameGold;
    ctx.fillRect(zoneX - 18, footY - 2, 36, 2);

    // Warning exclamation diamond above impact zone during windup
    if (!impactNow) {
      const wy = footY - 22 + Math.round(Math.sin(timeSec * 14) * 2);
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(zoneX - 3, wy - 8, 6, 12);
      ctx.fillStyle = UI_COLORS.frameGold;
      ctx.fillRect(zoneX - 2, wy - 7, 4, 6);
      ctx.fillRect(zoneX - 2, wy + 1, 4, 2);
    }
  }

  // ==========================================================================
  // BOSS 5: MECHA BULL — Spinning Steel Drill Horn, Steam Vents, Red Flash, Stun Stars
  // ==========================================================================

  private renderMechaBull(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    cx: number,
    footY: number,
    flash: boolean,
    timeSec: number,
  ): void {
    const dir = boss.facing;
    const stunned = boss.state === 'stunned';
    const telegraph = isTelegraphState(boss.state);
    const charging = isChargeOrDashState(boss.state) || boss.shieldActive;
    const redFlash = telegraph && (((timeSec * 22) | 0) & 1) === 0;
    const shudder = telegraph ? ((((timeSec * 50) | 0) & 1) === 0 ? -2 : 2) : stunned ? Math.round(Math.sin(timeSec * 8) * 2) : 0;
    const sag = stunned ? 5 : 0;

    const hi = flash ? FLASH_WHITE : redFlash ? '#ff8095' : BULL_HI;
    const mid = flash ? FLASH_WHITE : redFlash ? '#e02447' : BULL_MID;
    const dark = flash ? HIGHLIGHT_CREAM : redFlash ? '#6e0d24' : BULL_DARK;
    const brass = flash ? FLASH_WHITE : BULL_BRASS;

    // Ground shadow
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(cx - 38, footY - 2, 76, 4);
    ctx.globalAlpha = 1;

    const bx = cx + shudder;
    const by = footY - 38 + sag;

    // 1. Twin Brass Shoulder Steam Vents + Rising Animated Steam Puffs!
    const vent1X = bx - 22;
    const vent2X = bx + 14;
    const ventY = by - 26;
    this.drawOutlinedShadedBox(ctx, vent1X, ventY, 8, 12, brass, BULL_BRASS_DARK, OUTLINE_DARK);
    this.drawOutlinedShadedBox(ctx, vent2X, ventY, 8, 12, brass, BULL_BRASS_DARK, OUTLINE_DARK);

    if (!flash) {
      const steamRate = telegraph ? 3.2 : charging ? 2.4 : stunned ? 0.9 : 1.4;
      const puffCount = telegraph ? 4 : 3;
      for (let v = 0; v < 2; v++) {
        const vx = (v === 0 ? vent1X : vent2X) + 4;
        for (let p = 0; p < puffCount; p++) {
          const cycle = (timeSec * steamRate + p / puffCount + v * 0.45) % 1;
          const px = vx + Math.round(Math.sin(cycle * 5 + v) * (stunned ? 6 : 3)) - (charging ? dir * Math.round(cycle * 18) : 0);
          const py = ventY - 3 - Math.round(cycle * (telegraph ? 26 : 16));
          const rad = 3 + Math.round(cycle * 4);
          ctx.globalAlpha = (1 - cycle) * (telegraph ? 0.9 : 0.65);
          ctx.fillStyle = telegraph ? '#ffd8d8' : BULL_STEAM_MID;
          ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
          ctx.fillStyle = BULL_STEAM_HI;
          ctx.fillRect(px - rad + 1, py - rad + 1, Math.max(2, rad * 2 - 3), Math.max(2, rad - 1));
        }
      }
      ctx.globalAlpha = 1;
    }

    // 2. Pistoning mechanical legs
    const piston = stunned ? 0 : Math.round(Math.sin(timeSec * (charging ? 26 : 9)) * 4);
    this.drawOutlinedShadedBox(ctx, bx - 24 + piston, footY - 15, 14, 15, mid, dark, OUTLINE_DARK);
    this.drawOutlinedShadedBox(ctx, bx + 10 - piston, footY - 15, 14, 15, mid, dark, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, bx - 26 + piston, footY - 5, 18, 5, brass, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, bx + 8 - piston, footY - 5, 18, 5, brass, OUTLINE_DARK);

    // 3. Riveted Armored Steel Chassis
    this.drawOutlinedShadedBox(ctx, bx - 30, by - 16, 60, 40, hi, mid, dark);
    // Brass Foundry trim bar & reactor core
    this.drawOutlinedRect(ctx, bx - 28, by + 12, 56, 5, brass, OUTLINE_DARK);
    if (!flash) {
      // Corner rivets
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(bx - 26, by - 12, 2, 2);
      ctx.fillRect(bx + 24, by - 12, 2, 2);
      ctx.fillRect(bx - 26, by + 8, 2, 2);
      ctx.fillRect(bx + 24, by + 8, 2, 2);
    }

    // Swept Curved Brass Bull Horns
    this.drawOutlinedRect(ctx, bx - 34, by - 20, 10, 8, brass, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, bx - 40, by - 30, 8, 12, flash ? FLASH_WHITE : '#ffe7a1', OUTLINE_DARK);
    this.drawOutlinedRect(ctx, bx + 24, by - 20, 10, 8, brass, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, bx + 32, by - 30, 8, 12, flash ? FLASH_WHITE : '#ffe7a1', OUTLINE_DARK);

    // 4. Glowing Crimson Cyclops Visor
    const visorX = bx - 18 + dir * 4;
    const visorY = by - 8;
    this.drawOutlinedRect(ctx, visorX, visorY, 32, 9, OUTLINE_DARK, OUTLINE_DARK);
    if (!stunned) {
      const scan = Math.round(Math.sin(timeSec * (telegraph ? 22 : 6)) * 7);
      ctx.fillStyle = flash ? FLASH_WHITE : BULL_VISOR;
      ctx.fillRect(visorX + 2, visorY + 2, 28, 5);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(visorX + 12 + scan, visorY + 3, 6, 3);
    } else if (!flash) {
      // Stunned X-dimmed visor flicker
      ctx.fillStyle = '#5c1428';
      ctx.fillRect(visorX + 2, visorY + 2, 28, 5);
    }

    // 5. Spinning Steel Drill Horn (mounted forward on snout/chassis!)
    const drillSpin = stunned ? 0 : ((timeSec * (charging || telegraph ? 28 : 12)) | 0) & 3;
    const drillBaseX = bx + dir * 28;
    const drillY = by + 4;
    // 4 telescoping conical steel tiers tapering outward in `dir`
    for (let t = 0; t < 4; t++) {
      const tierW = 8;
      const tierH = 22 - t * 5;
      const tx = dir > 0 ? drillBaseX + t * 7 : drillBaseX - (t + 1) * 7;
      const ty = drillY - (tierH >> 1);
      this.drawOutlinedShadedBox(ctx, tx, ty, tierW, tierH, hi, mid, dark);
      // Animated diagonal helical spiral flute scrolling across the spinning drill!
      if (!flash) {
        const stripeY = ty + 2 + ((t * 3 + drillSpin * 3) % Math.max(3, tierH - 4));
        ctx.fillStyle = telegraph ? BULL_VISOR : HIGHLIGHT_CREAM;
        ctx.fillRect(tx + 1, stripeY, tierW - 2, 2);
      }
    }
    // Sharp gleaming drill tip
    const tipX = dir > 0 ? drillBaseX + 28 : drillBaseX - 33;
    this.drawOutlinedRect(ctx, tipX, drillY - 2, 5, 4, telegraph ? BULL_VISOR : HIGHLIGHT_CREAM, OUTLINE_DARK);
  }

  private drawMechaBullChargeTelegraph(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    facing: -1 | 1,
    timeSec: number,
  ): void {
    const blink = (((timeSec * 24) | 0) & 1) === 0;
    // Horizontal bright red drill-charge lane telegraph ahead of bull
    const laneX = facing > 0 ? cx + 44 : cx - 224;
    ctx.globalAlpha = blink ? 0.85 : 0.4;
    ctx.fillStyle = BULL_VISOR;
    for (let s = 0; s < 14; s++) {
      const sx = laneX + s * 13;
      ctx.fillRect(sx, cy + 2, 8, 3);
    }
    ctx.fillStyle = HIGHLIGHT_CREAM;
    ctx.fillRect(facing > 0 ? cx + 46 : cx - 220, cy + 3, 174, 1);

    // Bold pulsing crimson "!!" warning icon above bull
    ctx.globalAlpha = 1;
    const wy = cy - 48 + Math.round(Math.sin(timeSec * 20) * 2);
    this.drawOutlinedRect(ctx, cx - 8, wy - 10, 6, 10, blink ? BULL_VISOR : BULL_STAR, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx - 8, wy + 2, 6, 4, blink ? BULL_VISOR : BULL_STAR, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + 2, wy - 10, 6, 10, blink ? BULL_VISOR : BULL_STAR, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + 2, wy + 2, 6, 4, blink ? BULL_VISOR : BULL_STAR, OUTLINE_DARK);
  }

  private drawOrbitingStunStars(
    ctx: CanvasRenderingContext2D,
    cx: number,
    headTopY: number,
    timeSec: number,
  ): void {
    ctx.globalAlpha = 1;
    for (let s = 0; s < 4; s++) {
      const ang = timeSec * 5.2 + (s * TWO_PI) * 0.25;
      const sx = Math.round(cx + Math.cos(ang) * 26);
      const sy = Math.round(headTopY + Math.sin(ang) * 7);
      // 1px dark-outlined crisp yellow 4-point pixel stun star!
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(sx - 4, sy - 1, 9, 3);
      ctx.fillRect(sx - 1, sy - 4, 3, 9);
      ctx.fillRect(sx - 2, sy - 2, 5, 5);
      ctx.fillStyle = BULL_STAR;
      ctx.fillRect(sx - 3, sy, 7, 1);
      ctx.fillRect(sx, sy - 3, 1, 7);
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  // ==========================================================================
  // BOSS 6: ELECTRO SPHINX — Golden Pharaoh Crest, Floating Paw Platforms, Gem Core
  // ==========================================================================

  private renderElectroSphinx(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    cx: number,
    cy: number,
    flash: boolean,
    timeSec: number,
  ): void {
    const hover = Math.round(Math.sin(timeSec * 3.2) * 3);
    const sy = cy + hover;
    const goldHi = flash ? FLASH_WHITE : SPHINX_GOLD_HI;
    const goldMid = flash ? FLASH_WHITE : SPHINX_GOLD_MID;
    const goldDark = flash ? HIGHLIGHT_CREAM : SPHINX_GOLD_DARK;
    const cyanHi = flash ? FLASH_WHITE : SPHINX_CYAN_HI;
    const cyanMid = flash ? FLASH_WHITE : SPHINX_CYAN_MID;
    const cyanDark = flash ? HIGHLIGHT_CREAM : SPHINX_CYAN_DARK;

    // 1. Electric-winged golden aura flares behind sphinx
    const flap = Math.round(Math.sin(timeSec * 6) * 5);
    this.drawOutlinedShadedBox(ctx, cx - 48, sy - 14 + flap, 22, 16, cyanMid, goldMid, goldDark);
    this.drawOutlinedShadedBox(ctx, cx + 26, sy - 14 + flap, 22, 16, cyanMid, goldMid, goldDark);

    // 2. Regal Golden Torso + Striped Lapis Collar
    this.drawPixelEllipse(ctx, cx, sy + 6, 26, 20, goldHi, goldMid, goldDark, OUTLINE_DARK);
    if (!flash) {
      ctx.fillStyle = cyanDark;
      ctx.fillRect(cx - 18, sy - 8, 36, 4);
      ctx.fillStyle = cyanMid;
      ctx.fillRect(cx - 14, sy - 4, 28, 2);
    }

    // 3. Golden Pharaoh Crest (Nemes Headdress with gold/cyan stripes + Uraeus finial!)
    const headY = sy - 16;
    // Wide flared headdress wings
    this.drawOutlinedShadedBox(ctx, cx - 28, headY - 12, 56, 22, goldHi, goldMid, goldDark);
    if (!flash) {
      // Sacred alternating cyan pharaoh nemes stripes
      ctx.fillStyle = cyanDark;
      for (let st = -8; st <= 6; st += 5) {
        ctx.fillRect(cx - 26, headY + st, 12, 2);
        ctx.fillRect(cx + 14, headY + st, 12, 2);
      }
      ctx.fillStyle = cyanMid;
      ctx.fillRect(cx - 24, headY - 10, 48, 2);
    }
    // Crown uraeus lightning finial
    this.drawOutlinedRect(ctx, cx - 4, headY - 24, 8, 13, cyanMid, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx - 2, headY - 27, 4, 5, goldHi, OUTLINE_DARK);

    // Sphinx sculpted faceplate + glowing electric eyes
    this.drawOutlinedShadedBox(ctx, cx - 14, headY - 8, 28, 18, goldHi, goldMid, goldDark);
    this.drawOutlinedRect(ctx, cx - 10, headY - 3, 6, 4, cyanHi, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + 4, headY - 3, 6, 4, cyanHi, OUTLINE_DARK);

    // 4. Glowing Energized Gem Core in Chest!
    const gemPulse = isTelegraphState(boss.state) || isLaserState(boss.state) ? 3 : Math.round(Math.sin(timeSec * 8) * 1.5);
    const gemY = sy + 4;
    this.drawOutlinedRect(ctx, cx - 8 - gemPulse, gemY - 8 - gemPulse, 16 + gemPulse * 2, 16 + gemPulse * 2, cyanMid, OUTLINE_DARK);
    if (!flash) {
      ctx.fillStyle = cyanHi;
      ctx.fillRect(cx - 5 - (gemPulse >> 1), gemY - 5 - (gemPulse >> 1), 10 + gemPulse, 10 + gemPulse);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(cx - 2, gemY - 2, 4, 4);
      // Tiny crackling pixel lightning arcs around energized gem core
      if ((((timeSec * 18) | 0) & 1) === 0) {
        ctx.fillStyle = SPHINX_GOLD_HI;
        ctx.fillRect(cx - 12, gemY - 2, 4, 1);
        ctx.fillRect(cx + 9, gemY + 1, 4, 1);
      }
    }

    // 5. Two Floating Cyan-Edged Paw Platforms hovering left & right!
    const pawSlam = isSlamState(boss.state) ? 16 : isTelegraphState(boss.state) ? -10 : 0;
    const pawBobL = Math.round(Math.sin(timeSec * 4.5) * 4);
    const pawBobR = Math.round(Math.sin(timeSec * 4.5 + Math.PI) * 4);
    this.drawSphinxPawPlatform(ctx, cx - 44, sy + 24 + pawBobL + pawSlam, goldHi, goldMid, goldDark, cyanMid, cyanHi, flash, timeSec);
    this.drawSphinxPawPlatform(ctx, cx + 44, sy + 24 + pawBobR + pawSlam, goldHi, goldMid, goldDark, cyanMid, cyanHi, flash, timeSec);
  }

  private drawSphinxPawPlatform(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    goldHi: string,
    goldMid: string,
    goldDark: string,
    cyanMid: string,
    cyanHi: string,
    flash: boolean,
    timeSec: number,
  ): void {
    // Glowing cyan platform deck rim & levitation jets beneath paw
    if (!flash) {
      const jet = 4 + (((timeSec * 16) | 0) & 3);
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = cyanMid;
      ctx.fillRect(px - 10, py + 8, 20, jet);
      ctx.fillStyle = cyanHi;
      ctx.fillRect(px - 5, py + 8, 10, Math.max(2, jet - 2));
      ctx.globalAlpha = 1;
    }
    // Paw platform slab with luminous cyan border trim
    this.drawOutlinedShadedBox(ctx, px - 16, py - 7, 32, 15, goldHi, goldMid, goldDark);
    if (!flash) {
      ctx.fillStyle = cyanMid;
      ctx.fillRect(px - 15, py - 6, 30, 2);
      ctx.fillRect(px - 15, py + 5, 30, 2);
      // 3 sculpted golden claw toes
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(px - 6, py - 1, 2, 6);
      ctx.fillRect(px + 4, py - 1, 2, 6);
    }
  }

  private drawPlasmaSweepTelegraph(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    laserAngle: number,
    timeSec: number,
  ): void {
    // 90-degree sweeping sector arc cues around boss.laserAngle
    const len = 180;
    const blink = (((timeSec * 20) | 0) & 1) === 0;
    ctx.globalAlpha = blink ? 0.72 : 0.35;
    for (let edge = -1; edge <= 1; edge += 2) {
      const ang = laserAngle + edge * (HALF_PI * 0.5);
      const ex = Math.round(cx + Math.cos(ang) * len);
      const ey = Math.round(cy - Math.sin(ang) * len);
      this.drawDashedPixelLine(ctx, cx, cy, ex, ey, SPHINX_CYAN_MID);
    }
    // Center targeting beam preview
    const tx = Math.round(cx + Math.cos(laserAngle) * len);
    const ty = Math.round(cy - Math.sin(laserAngle) * len);
    this.drawDashedPixelLine(ctx, cx, cy, tx, ty, SPHINX_GOLD_HI);
  }

  private drawCracklingPlasmaLaser(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    laserAngle: number,
    timeSec: number,
  ): void {
    const len = 360;
    const cos = Math.cos(laserAngle);
    const sin = -Math.sin(laserAngle);
    const perpX = -sin;
    const perpY = cos;
    const steps = 64;
    const tick = (timeSec * 30) | 0;

    // 1. Dark-plum outer 1px outline sheath + deep cyan glow
    ctx.globalAlpha = 1;
    ctx.fillStyle = OUTLINE_DARK;
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * len;
      const px = Math.round(cx + cos * d);
      const py = Math.round(cy + sin * d);
      ctx.fillRect(px - 5, py - 5, 11, 11);
    }
    ctx.fillStyle = SPHINX_CYAN_MID;
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * len;
      const px = Math.round(cx + cos * d);
      const py = Math.round(cy + sin * d);
      ctx.fillRect(px - 4, py - 4, 9, 9);
    }
    // 2. Blazing white-cyan core
    ctx.fillStyle = HIGHLIGHT_CREAM;
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * len;
      const px = Math.round(cx + cos * d);
      const py = Math.round(cy + sin * d);
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
    // 3. Crackling zigzag electric arcs dancing along plasma beam!
    ctx.fillStyle = SPHINX_GOLD_HI;
    for (let i = 1; i < steps; i += 2) {
      const d = (i / steps) * len;
      const zig = ((((i * 7 + tick) & 3) - 1.5) * 4.5);
      const px = Math.round(cx + cos * d + perpX * zig);
      const py = Math.round(cy + sin * d + perpY * zig);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
    // 4. Blazing plasma emitter flare at gem core
    this.drawPixelEllipse(ctx, cx, cy, 11, 11, HIGHLIGHT_CREAM, SPHINX_CYAN_HI, SPHINX_CYAN_MID, OUTLINE_DARK);
  }

  // ==========================================================================
  // BOSS 7: SHADOW DOPPELGANGER — Sleek Dark Mirror of Krunk + Neon Magenta Outline
  // ==========================================================================

  private renderShadowDoppelganger(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    cx: number,
    footY: number,
    flash: boolean,
    timeSec: number,
  ): void {
    const dir = boss.facing;
    const dashing = isChargeOrDashState(boss.state) || Math.abs(boss.vx) > 4.2;
    const stomping = isSlamState(boss.state) || boss.vy < -5;
    const runBob = Math.round(Math.sin(timeSec * 14) * 2);

    const outCol = flash ? FLASH_WHITE : SHADOW_OUTLINE;
    const bodyDark = flash ? FLASH_WHITE : SHADOW_BODY_DARK;
    const bodyMid = flash ? FLASH_WHITE : SHADOW_BODY_MID;
    const bodyHi = flash ? HIGHLIGHT_CREAM : SHADOW_BODY_HI;
    const eyeCol = flash ? FLASH_WHITE : SHADOW_EYE;

    // Ground shadow
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(cx - 15, footY - 2, 30, 3);
    ctx.globalAlpha = 1;

    const cy = footY - 20 + (stomping ? 0 : runBob);

    // 1. Billowing tattered shadow scarf/cape trailing opposite facing
    const flutter = Math.round(Math.sin(timeSec * 16) * 3);
    this.drawOutlinedRect(ctx, cx - dir * 16 - 6, cy - 3 + flutter, 14, 7, bodyMid, outCol);
    this.drawOutlinedRect(ctx, cx - dir * 24 - 4, cy + 1 - flutter, 10, 5, bodyDark, outCol);

    if (stomping) {
      // Spinning void cannonball air-stomp mirror pose!
      this.drawPixelEllipse(ctx, cx, cy, 16, 16, bodyHi, bodyMid, bodyDark, outCol);
      if (!flash) {
        ctx.fillStyle = SHADOW_OUTLINE;
        ctx.fillRect(cx - 10, cy - 2, 20, 3);
        ctx.fillStyle = eyeCol;
        ctx.fillRect(cx - 6, cy - 1, 12, 2);
      }
      return;
    }

    // 2. Agile boots
    const stride = dashing ? 6 : Math.round(Math.sin(timeSec * 16) * 4);
    this.drawOutlinedRect(ctx, cx - 9 - stride, footY - 7, 7, 6, bodyDark, outCol);
    this.drawOutlinedRect(ctx, cx + 2 + stride, footY - 7, 7, 6, bodyDark, outCol);

    // 3. Sleek Krunk-proportioned dark body with NEON MAGENTA OUTLINE (#ff006a)!
    const rx = dashing ? 16 : 13;
    const ry = dashing ? 11 : 13;
    // Outer dark halo behind neon magenta rim for maximum contrast
    this.drawPixelEllipse(ctx, cx, cy, rx + 1, ry + 1, OUTLINE_DARK, OUTLINE_DARK, OUTLINE_DARK, OUTLINE_DARK);
    this.drawPixelEllipse(ctx, cx, cy, rx, ry, bodyHi, bodyMid, bodyDark, outCol);

    // 4. Twin curved spectral mirror-Krunk horns
    this.drawOutlinedRect(ctx, cx - 12, cy - ry - 7, 6, 8, bodyDark, outCol);
    this.drawOutlinedRect(ctx, cx + 6, cy - ry - 7, 6, 8, bodyDark, outCol);
    if (!flash) {
      // Glowing emerald rift jewel between horns
      ctx.fillStyle = eyeCol;
      ctx.fillRect(cx - 2, cy - ry - 4, 4, 4);
    }

    // 5. Fierce glowing neon-emerald Krunk mirror eyes
    const eyeOff = dir * 3;
    this.drawOutlinedRect(ctx, cx + eyeOff - 7, cy - 5, 5, 6, outCol, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + eyeOff + 2, cy - 5, 5, 6, outCol, OUTLINE_DARK);
    if (!flash) {
      ctx.fillStyle = eyeCol;
      ctx.fillRect(cx + eyeOff - 5, cy - 4, 3, 4);
      ctx.fillRect(cx + eyeOff + 3, cy - 4, 3, 4);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(cx + eyeOff - 5, cy - 4, 1, 2);
      ctx.fillRect(cx + eyeOff + 3, cy - 4, 1, 2);
    }
  }

  private renderShadowVoidAuraAndAfterimages(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    camX: number,
    camY: number,
    timeSec: number,
  ): void {
    const sxNow = Math.round((boss.x + boss.width * 0.5 - camX) * PPU + HALF_W);
    const syNow = Math.round((camY - (boss.y + boss.height * 0.5)) * PPU + HALF_H);

    // 1. Pulsing Void Shockwave Aura around Shadow Doppelganger
    const waveFrac = (timeSec * (boss.phase === 3 ? 2.4 : 1.6)) % 1;
    const waveR = 16 + Math.round(waveFrac * 26);
    ctx.globalAlpha = (1 - waveFrac) * 0.65;
    ctx.fillStyle = SHADOW_OUTLINE;
    this.drawPixelRing(ctx, sxNow, syNow, waveR, 2, 24);
    ctx.globalAlpha = (1 - waveFrac) * 0.45;
    ctx.fillStyle = SHADOW_EYE;
    this.drawPixelRing(ctx, sxNow, syNow, Math.max(10, waveR - 6), 1, 16);

    // 2. Echoing Shadow Afterimages during dashes & blinks!
    for (let i = 0; i < MAX_TRAIL; i++) {
      const age = timeSec - this.trailTime[i]!;
      if (age < 0 || age > 0.42) continue;
      const frac = 1 - age / 0.42;
      const tx = Math.round((this.trailX[i]! + boss.width * 0.5 - camX) * PPU + HALF_W);
      const ty = Math.round((camY - (this.trailY[i]! + boss.height * 0.5)) * PPU + HALF_H);
      if (Math.abs(tx - sxNow) < 4 && Math.abs(ty - syNow) < 4) continue;

      ctx.globalAlpha = frac * 0.58;
      this.drawPixelEllipse(ctx, tx, ty, 13, 13, SHADOW_BODY_MID, SHADOW_BODY_DARK, SHADOW_BODY_DARK, SHADOW_OUTLINE);
      // Echoing twin horns
      ctx.fillStyle = SHADOW_OUTLINE;
      ctx.fillRect(tx - 11, ty - 18, 4, 6);
      ctx.fillRect(tx + 7, ty - 18, 4, 6);
      ctx.fillStyle = SHADOW_EYE;
      ctx.fillRect(tx - 4, ty - 4, 2, 3);
      ctx.fillRect(tx + 3, ty - 4, 2, 3);
    }
  }

  // ==========================================================================
  // BOSS 8: NIGHTMARE SOVEREIGN — Tattered Cape, Hexagonal Shield, Eclipse Halo, Arena Morph
  // ==========================================================================

  private renderNightmareSovereign(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    cx: number,
    cy: number,
    flash: boolean,
    timeSec: number,
  ): void {
    const hover = Math.round(Math.sin(timeSec * 3.0) * 4);
    const sy = cy + hover;
    const hi = flash ? FLASH_WHITE : SOV_BODY_HI;
    const mid = flash ? FLASH_WHITE : SOV_BODY_MID;
    const dark = flash ? HIGHLIGHT_CREAM : SOV_BODY_DARK;
    const capeDark = flash ? HIGHLIGHT_CREAM : SOV_CAPE_DARK;
    const capeMid = flash ? FLASH_WHITE : SOV_CAPE_MID;
    const capeEdge = flash ? FLASH_WHITE : SOV_CAPE_EDGE;
    const gold = flash ? FLASH_WHITE : SOV_GOLD;
    const rift = flash ? FLASH_WHITE : SOV_RIFT;

    // 1. Tattered Crimson-Violet Royal Cape (5 billowing vertical pixel strips!)
    for (let s = -2; s <= 2; s++) {
      const stripX = cx + s * 11;
      const sway = Math.round(Math.sin(timeSec * 5.2 + s * 1.1) * 4);
      const stripLen = 46 - Math.abs(s) * 4 + Math.round(Math.cos(timeSec * 4.0 + s) * 4);
      this.drawOutlinedShadedBox(ctx, stripX - 6 + sway, sy - 6, 13, stripLen, capeEdge, capeMid, capeDark);
      // Tattered jagged hem tip
      this.drawOutlinedRect(ctx, stripX - 3 + sway, sy - 6 + stripLen - 2, 7, 6, capeEdge, OUTLINE_DARK);
    }

    // 2. Floating Void Sovereign Torso & Ornate Crimson Mantle Shoulders
    this.drawOutlinedShadedBox(ctx, cx - 34, sy - 16, 18, 16, hi, mid, dark);
    this.drawOutlinedShadedBox(ctx, cx + 16, sy - 16, 18, 16, hi, mid, dark);
    this.drawPixelEllipse(ctx, cx, sy - 4, 24, 24, hi, mid, dark, OUTLINE_DARK);

    // 3. 3-Point Neon Rift Eclipse Crown
    this.drawOutlinedRect(ctx, cx - 22, sy - 38, 8, 18, rift, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx - 5, sy - 44, 10, 22, gold, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + 14, sy - 38, 8, 18, rift, OUTLINE_DARK);
    this.drawOutlinedShadedBox(ctx, cx - 22, sy - 24, 44, 7, hi, mid, dark);

    // 4. Tri-Eye Eldritch Visage
    this.drawOutlinedRect(ctx, cx - 14, sy - 10, 8, 7, gold, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx + 6, sy - 10, 8, 7, gold, OUTLINE_DARK);
    this.drawOutlinedRect(ctx, cx - 4, sy - 20, 8, 7, rift, OUTLINE_DARK);
    if (!flash) {
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(cx - 11, sy - 8, 2, 4);
      ctx.fillRect(cx + 9, sy - 8, 2, 4);
      ctx.fillRect(cx - 1, sy - 18, 2, 4);
      // Glowing eclipse chest sigil
      ctx.fillStyle = gold;
      ctx.fillRect(cx - 5, sy + 5, 10, 8);
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(cx - 3, sy + 7, 6, 4);
    }

    // 5. Floating Clawed Sovereign Gauntlets gesturing ominously!
    const castLift = isTelegraphState(boss.state) || boss.state === 'barrage' ? -12 : 0;
    const handBobL = Math.round(Math.sin(timeSec * 4.5) * 4);
    const handBobR = Math.round(Math.sin(timeSec * 4.5 + 2.2) * 4);
    this.drawOutlinedShadedBox(ctx, cx - 46, sy + 4 + handBobL + castLift, 12, 12, hi, mid, dark);
    this.drawOutlinedShadedBox(ctx, cx + 34, sy + 4 + handBobR + castLift, 12, 12, hi, mid, dark);
    if (!flash && (isTelegraphState(boss.state) || boss.state === 'barrage')) {
      ctx.fillStyle = rift;
      ctx.fillRect(cx - 43, sy + 1 + handBobL + castLift, 6, 6);
      ctx.fillRect(cx + 37, sy + 1 + handBobR + castLift, 6, 6);
    }
  }

  private renderSovereignEclipseHalo(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    phase: 1 | 2 | 3,
    timeSec: number,
  ): void {
    const isPhase3 = phase === 3;
    const outerR = isPhase3 ? 52 : 40;
    const pulse = Math.round(Math.sin(timeSec * 5.0) * 3);

    // Blazing solar-eclipse corona rays in Phase 3!
    if (isPhase3) {
      const rays = 12;
      for (let r = 0; r < rays; r++) {
        const ang = (r / rays) * TWO_PI + timeSec * 1.4;
        const tipR = outerR + 12 + (r % 2 === 0 ? pulse : -pulse);
        const rx = Math.round(cx + Math.cos(ang) * tipR);
        const ry = Math.round(cy + Math.sin(ang) * tipR);
        const bx = Math.round(cx + Math.cos(ang) * (outerR - 4));
        const by = Math.round(cy + Math.sin(ang) * (outerR - 4));
        ctx.globalAlpha = 0.85;
        this.drawPixelSegment(ctx, bx, by, rx, ry, r % 2 === 0 ? 4 : 2, r % 2 === 0 ? SOV_GOLD : SOV_BODY_HI);
      }
    }

    // Dark void eclipsed disk + flaming crimson-gold corona ring
    ctx.globalAlpha = isPhase3 ? 0.52 : 0.28;
    ctx.fillStyle = OUTLINE_DARK;
    this.drawPixelDisk(ctx, cx, cy, outerR - 4);

    ctx.globalAlpha = isPhase3 ? 0.92 : 0.55;
    ctx.fillStyle = isPhase3 ? SOV_BODY_HI : SOV_BODY_MID;
    this.drawPixelRing(ctx, cx, cy, outerR + pulse, isPhase3 ? 4 : 2, 40);

    if (isPhase3) {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = SOV_GOLD;
      this.drawPixelRing(ctx, cx, cy, outerR - 2 + pulse, 2, 36);
      ctx.fillStyle = SOV_RIFT;
      for (let k = 0; k < 6; k++) {
        const ang = -timeSec * 2.2 + (k / 6) * TWO_PI;
        const px = Math.round(cx + Math.cos(ang) * (outerR + 5));
        const py = Math.round(cy + Math.sin(ang) * (outerR + 5));
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
    }
  }

  private drawHexagonalEnergyShield(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    timeSec: number,
  ): void {
    const rot = timeSec * 0.85;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const pulse = Math.round(Math.sin(timeSec * 7.5) * 2);
    const rad = radius + pulse;

    for (let i = 0; i < HEX_VERTS; i++) {
      const ux = HEX_COS[i]!;
      const uy = HEX_SIN[i]!;
      SCRATCH_HEX_X[i] = Math.round(cx + (ux * cosR - uy * sinR) * rad);
      SCRATCH_HEX_Y[i] = Math.round(cy + (ux * sinR + uy * cosR) * rad);
    }

    // 1. Translucent hexagonal energy interior fill (pixel-stepped horizontal bands inside hex radius)
    ctx.globalAlpha = 0.14 + 0.05 * Math.sin(timeSec * 8);
    ctx.fillStyle = SOV_SHIELD;
    this.drawPixelDisk(ctx, cx, cy, Math.round(rad * 0.84));

    // 2. Crisp pixel-stepped 6-edge hexagonal shield perimeter!
    for (let i = 0; i < HEX_VERTS; i++) {
      const next = (i + 1) % HEX_VERTS;
      const x0 = SCRATCH_HEX_X[i]!;
      const y0 = SCRATCH_HEX_Y[i]!;
      const x1 = SCRATCH_HEX_X[next]!;
      const y1 = SCRATCH_HEX_Y[next]!;
      ctx.globalAlpha = 0.72;
      this.drawPixelSegment(ctx, x0, y0, x1, y1, 4, OUTLINE_DARK);
      ctx.globalAlpha = 0.92;
      this.drawPixelSegment(ctx, x0, y0, x1, y1, 2, i % 2 === 0 ? SOV_SHIELD : SOV_BODY_HI);
    }

    // 3. Glowing hexagonal vertex nodes
    ctx.globalAlpha = 1;
    for (let i = 0; i < HEX_VERTS; i++) {
      const vx = SCRATCH_HEX_X[i]!;
      const vy = SCRATCH_HEX_Y[i]!;
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(vx - 3, vy - 3, 7, 7);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(vx - 2, vy - 2, 5, 5);
      ctx.fillStyle = SOV_SHIELD;
      ctx.fillRect(vx - 1, vy - 1, 3, 3);
    }
  }

  private renderArenaMorphCues(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    boss: BossRuntime,
    room: RoomDef,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
  ): void {
    const morphPhase = boss.arenaMorphPhase;
    const primary = morphPhase >= 3 ? SOV_GOLD : morphPhase === 2 ? SOV_BODY_HI : SOV_SHIELD;
    const secondary = morphPhase >= 3 ? SOV_RIFT : morphPhase === 2 ? SOV_GOLD : SOV_BODY_HI;
    const pulse = 0.45 + 0.4 * Math.sin(timeSec * (5 + morphPhase * 2));

    // 1. Highlight every live arena moving/morph platform with glowing energy frames & floor pillars
    for (let i = 0; i < state.platforms.length; i++) {
      const p = state.platforms[i]!;
      const wx = p.prevX + (p.x - p.prevX) * alpha;
      const wy = p.prevY + (p.y - p.prevY) * alpha;
      const sx = Math.round((wx - camX) * PPU + HALF_W);
      const sy = Math.round((camY - (wy + p.height)) * PPU + HALF_H);
      const pw = Math.max(16, Math.round(p.width * PPU));
      const ph = Math.max(12, Math.round(p.height * PPU));

      // Vertical arcane levitation tether column rising from arena floor
      ctx.globalAlpha = pulse * 0.24;
      ctx.fillStyle = primary;
      ctx.fillRect(sx + (pw >> 1) - 3, sy + ph, 6, Math.max(0, VIEWPORT_H - (sy + ph)));

      // Glowing morph-phase energy outline around platform
      ctx.globalAlpha = pulse * 0.9;
      ctx.fillStyle = primary;
      ctx.fillRect(sx - 2, sy - 2, pw + 4, 2);
      ctx.fillRect(sx - 2, sy + ph, pw + 4, 2);
      ctx.fillRect(sx - 2, sy, 2, ph);
      ctx.fillRect(sx + pw, sy, 2, ph);

      // Corner rune diamonds
      ctx.fillStyle = secondary;
      ctx.fillRect(sx - 3, sy - 3, 3, 3);
      ctx.fillRect(sx + pw, sy - 3, 3, 3);
    }

    // 2. Ambient morphing arena floor & pillar energy glyphs scaling with arenaMorphPhase (1..3)
    const floorY = Math.round((camY - 1.0) * PPU + HALF_H);
    const roomSpan = Math.max(12, room.widthTiles);
    const pillarCount = 2 + morphPhase;
    for (let k = 0; k < pillarCount; k++) {
      const worldX = ((k + 1) / (pillarCount + 1)) * roomSpan;
      const sx = Math.round((worldX - camX) * PPU + HALF_W);
      if (sx < -16 || sx > VIEWPORT_W + 16) continue;

      ctx.globalAlpha = pulse * 0.22;
      ctx.fillStyle = primary;
      ctx.fillRect(sx - 2, 0, 4, VIEWPORT_H);
      ctx.globalAlpha = pulse * 0.72;
      ctx.fillStyle = secondary;
      ctx.fillRect(sx - 8, floorY - 3, 16, 3);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(sx - 1, floorY - 10 - Math.round(Math.sin(timeSec * 6 + k) * 4), 2, 6);
    }
  }

  // ==========================================================================
  // Shared Boss VFX Helpers (Phase Auras, Crimson Laser, Ground-Pound, Barriers)
  // ==========================================================================

  private renderPhaseAura(
    ctx: CanvasRenderingContext2D,
    boss: BossRuntime,
    cx: number,
    cy: number,
    timeSec: number,
  ): void {
    const rad = Math.round(Math.max(boss.width, boss.height) * PPU * 0.54);
    if (boss.phase === 1) {
      // Subtle thematic boss presence motes in Phase 1
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = HERO_FORM_PALETTES.krunk_basic[4];
      for (let s = 0; s < 6; s++) {
        const ang = (s / 6) * TWO_PI + timeSec * 1.4;
        const ax = Math.round(cx + Math.cos(ang) * rad);
        const ay = Math.round(cy + Math.sin(ang) * rad);
        ctx.fillRect(ax - 1, ay - 1, 2, 2);
      }
      return;
    }

    // Phase 2 & Phase 3 escalating rage aura rings & orbiting energy sparks!
    const isP3 = boss.phase === 3;
    const colOuter = isP3 ? '#ff3868' : '#ffae24';
    const colInner = isP3 ? '#ffe838' : '#fff5b8';
    const segs = isP3 ? 16 : 12;
    const spd = isP3 ? 4.4 : 2.6;

    ctx.globalAlpha = isP3 ? 0.22 : 0.14;
    ctx.fillStyle = colOuter;
    this.drawPixelRing(ctx, cx, cy, rad + 4, isP3 ? 3 : 2, 32);

    ctx.globalAlpha = 0.85;
    for (let s = 0; s < segs; s++) {
      const ang = (s / segs) * TWO_PI + timeSec * spd;
      const ax = Math.round(cx + Math.cos(ang) * rad);
      const ay = Math.round(cy + Math.sin(ang) * rad);
      ctx.fillStyle = OUTLINE_DARK;
      ctx.fillRect(ax - 2, ay - 2, 5, 5);
      ctx.fillStyle = s % 2 === 0 ? colOuter : colInner;
      ctx.fillRect(ax - 1, ay - 1, 3, 3);
    }
  }

  private drawCrimsonSightline(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    laserAngle: number,
    timeSec: number,
  ): void {
    const len = 340;
    const tx = Math.round(cx + Math.cos(laserAngle) * len);
    const ty = Math.round(cy - Math.sin(laserAngle) * len);
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(timeSec * 24);
    this.drawDashedPixelLine(ctx, cx, cy, tx, ty, EYE_LASER_BRIGHT);
  }

  private drawSegmentedCrimsonLaser(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    laserAngle: number,
    timeSec: number,
  ): void {
    const len = 360;
    const cos = Math.cos(laserAngle);
    const sin = -Math.sin(laserAngle);
    const steps = 68;
    const segShift = (timeSec * 18) % 1;

    // Outer dark outline
    ctx.globalAlpha = 1;
    ctx.fillStyle = OUTLINE_DARK;
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * len;
      ctx.fillRect(Math.round(cx + cos * d) - 4, Math.round(cy + sin * d) - 4, 9, 9);
    }
    // Deep crimson sheath
    ctx.fillStyle = EYE_LASER_DARK;
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * len;
      ctx.fillRect(Math.round(cx + cos * d) - 3, Math.round(cy + sin * d) - 3, 7, 7);
    }
    // Blazing scarlet laser body
    ctx.fillStyle = EYE_LASER_BRIGHT;
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * len;
      ctx.fillRect(Math.round(cx + cos * d) - 2, Math.round(cy + sin * d) - 2, 5, 5);
    }
    // Pulsing segmented energy nodes travelling rapidly along the crimson beam!
    for (let seg = 0; seg < 18; seg++) {
      const d = ((seg + segShift) / 18) * len;
      const nx = Math.round(cx + cos * d);
      const ny = Math.round(cy + sin * d);
      ctx.fillStyle = UI_COLORS.frameGold;
      ctx.fillRect(nx - 3, ny - 3, 7, 7);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(nx - 1, ny - 1, 3, 3);
    }
  }

  private drawGroundPoundShockwave(
    ctx: CanvasRenderingContext2D,
    cx: number,
    footY: number,
    intensity: number,
    timeSec: number,
  ): void {
    const wave = (timeSec * 4.5) % 1;
    const spread = Math.round(18 + wave * 48);
    // Expanding golden-white ground-pound shockwave flash band
    ctx.globalAlpha = (1 - wave) * 0.85 * intensity;
    ctx.fillStyle = DINO_SPINE;
    ctx.fillRect(cx - spread, footY - 4, spread * 2, 4);
    ctx.fillStyle = HIGHLIGHT_CREAM;
    ctx.fillRect(cx - (spread >> 1), footY - 3, spread, 2);

    // Billowing pixel dust clouds left & right of feet
    ctx.globalAlpha = (1 - wave * 0.7) * 0.78 * intensity;
    for (let side = -1; side <= 1; side += 2) {
      for (let p = 0; p < 3; p++) {
        const dx = cx + side * (16 + p * 12 + Math.round(wave * 18));
        const dy = footY - 6 - p * 3 - Math.round(wave * 10);
        const sz = 8 - p;
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(dx - (sz >> 1) - 1, dy - (sz >> 1) - 1, sz + 2, sz + 2);
        ctx.fillStyle = p === 0 ? HIGHLIGHT_CREAM : DINO_BELLY;
        ctx.fillRect(dx - (sz >> 1), dy - (sz >> 1), sz, sz);
      }
    }
  }

  private drawArmoredBarrierRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    facing: -1 | 1,
    timeSec: number,
  ): void {
    const blink = (((timeSec * 14) | 0) & 1) === 0;
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = blink ? '#66f7ff' : UI_COLORS.frameGold;
    for (let s = 0; s < 20; s++) {
      const ang = (s / 20) * TWO_PI + timeSec * 2.5 * facing;
      const px = Math.round(cx + Math.cos(ang) * radius);
      const py = Math.round(cy + Math.sin(ang) * radius);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
  }

  // ==========================================================================
  // Crisp Integer-Snapped 1px-Outlined Pixel-Art Drawing Primitives
  // ==========================================================================

  private drawOutlinedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    outline: string,
  ): void {
    const ix = x | 0;
    const iy = y | 0;
    const iw = Math.max(1, w | 0);
    const ih = Math.max(1, h | 0);
    ctx.fillStyle = outline;
    ctx.fillRect(ix - 1, iy - 1, iw + 2, ih + 2);
    ctx.fillStyle = fill;
    ctx.fillRect(ix, iy, iw, ih);
  }

  private drawOutlinedShadedBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    hi: string,
    mid: string,
    dark: string,
  ): void {
    const ix = x | 0;
    const iy = y | 0;
    const iw = Math.max(3, w | 0);
    const ih = Math.max(3, h | 0);
    ctx.fillStyle = OUTLINE_DARK;
    ctx.fillRect(ix - 1, iy - 1, iw + 2, ih + 2);
    ctx.fillStyle = mid;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = hi;
    ctx.fillRect(ix, iy, iw, Math.max(2, ih >> 2));
    ctx.fillStyle = dark;
    ctx.fillRect(ix, iy + ih - Math.max(2, ih >> 2), iw, Math.max(2, ih >> 2));
  }

  private drawPixelEllipse(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    hi: string,
    mid: string,
    dark: string,
    outline: string,
  ): void {
    const irx = Math.max(2, rx | 0);
    const iry = Math.max(2, ry | 0);
    const invRy2 = 1 / ((iry + 1) * (iry + 1));

    // 1. Crisp 1px dark outline silhouette
    ctx.fillStyle = outline;
    for (let dy = -iry - 1; dy <= iry + 1; dy++) {
      const rem = 1 - dy * dy * invRy2;
      if (rem < 0) continue;
      const span = Math.round((irx + 1) * Math.sqrt(rem));
      ctx.fillRect(cx - span, cy + dy, span * 2 + 1, 1);
    }

    // 2. 3-tone shaded interior (2px vertical scan bands for crisp fast retro shading)
    const invInnerRy2 = 1 / (iry * iry);
    for (let dy = -iry; dy <= iry; dy++) {
      const rem = 1 - dy * dy * invInnerRy2;
      if (rem <= 0) continue;
      const span = Math.floor(irx * Math.sqrt(rem));
      if (span <= 0) continue;
      if (dy < -(iry >> 1)) {
        ctx.fillStyle = hi;
      } else if (dy > (iry >> 1)) {
        ctx.fillStyle = dark;
      } else {
        ctx.fillStyle = mid;
      }
      ctx.fillRect(cx - span, cy + dy, span * 2, 1);
    }
  }

  private drawPixelDisk(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
  ): void {
    const r = Math.max(2, radius | 0);
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy += 2) {
      const span = Math.floor(Math.sqrt(Math.max(0, r2 - dy * dy)));
      ctx.fillRect(cx - span, cy + dy, span * 2, 2);
    }
  }

  private drawPixelRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    thickness: number,
    steps: number,
  ): void {
    const half = thickness >> 1;
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * TWO_PI;
      const px = Math.round(cx + Math.cos(ang) * radius) - half;
      const py = Math.round(cy + Math.sin(ang) * radius) - half;
      ctx.fillRect(px, py, thickness, thickness);
    }
  }

  private drawPixelSegment(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thickness: number,
    color: string,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(2, Math.min(48, Math.round(Math.hypot(dx, dy) / 3)));
    const half = thickness >> 1;
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      ctx.fillRect(Math.round(x0 + dx * t) - half, Math.round(y0 + dy * t) - half, thickness, thickness);
    }
  }

  private drawDashedPixelLine(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(4, Math.min(48, Math.round(Math.hypot(dx, dy) / 6)));
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i += 2) {
      const t = i / steps;
      ctx.fillRect(Math.round(x0 + dx * t) - 1, Math.round(y0 + dy * t) - 1, 2, 2);
    }
  }
}
