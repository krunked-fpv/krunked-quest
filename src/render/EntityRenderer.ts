/**
 * Krunked Quest — Entity, Hero, Enemy, Boss & Collectible Renderer
 * Crisp pixel-snapped interpolation (with classicSnap support), squash/stretch,
 * white hit-flash, stomp smears, DashRoundFire flames, RockShield barrier,
 * Primal Eye live tracking iris + orbiting thorny tendrils, projectiles, coins & crystals.
 * Zero per-frame object allocations!
 */

import {
  PPU,
  VIEWPORT_H,
  VIEWPORT_W,
  type BossRuntime,
  type HeroState,
  type IAssetPackManager,
  type SimState,
} from '../contracts/index.js';
import {
  HERO_FORM_PALETTES,
  HIGHLIGHT_CREAM,
  OUTLINE_DARK,
  UI_COLORS,
} from '../assets/palettes.js';
import {
  HERO_ACT_FRAME_H,
  HERO_ACT_FRAME_W,
  HERO_STD_FRAME_H,
  HERO_STD_FRAME_W,
  HeroActFrame,
  HeroStdFrame,
  type ProceduralPixelAtlas,
} from '../assets/ProceduralPixelAtlas.js';

const HALF_W = VIEWPORT_W * 0.5; // 288
const HALF_H = VIEWPORT_H * 0.5; // 162

function isDrawable(
  img: HTMLCanvasElement | HTMLImageElement | null | undefined,
): img is HTMLCanvasElement | HTMLImageElement {
  if (!img) return false;
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
  }
  return img.width > 0 && img.height > 0;
}

export class EntityRenderer {
  public renderAll(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    this.renderCollectibles(ctx, state, camX, camY, timeSec, atlas, customPack);
    this.renderEnemies(ctx, state, camX, camY, alpha, timeSec, atlas, customPack);
    if (state.boss && !state.boss.defeated) {
      this.renderBoss(ctx, state, state.boss, camX, camY, alpha, timeSec, atlas, customPack);
    }
    this.renderHero(ctx, state, camX, camY, alpha, timeSec, atlas, customPack);
    this.renderProjectiles(ctx, state, camX, camY, alpha, timeSec, atlas);
  }

  private renderCollectibles(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const frame4 = ((timeSec * 8) | 0) & 3;

    // Crystals
    const customCrystal = customPack ? customPack.getSprite('ui_crystal') : null;
    const crystalSheet = atlas.collectibles.get('crystal');
    for (let i = 0; i < state.crystals.length; i++) {
      const c = state.crystals[i]!;
      if (c.collected) continue;
      const bob = Math.round(Math.sin(timeSec * 5 + c.x * 2.1 + c.y) * 2);
      const sx = Math.round((c.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - c.y) * PPU + HALF_H) + bob;
      if (sx < -20 || sx > VIEWPORT_W + 20 || sy < -20 || sy > VIEWPORT_H + 20) continue;

      if (isDrawable(customCrystal)) {
        ctx.drawImage(customCrystal, sx - 8, sy - 10, 16, 20);
      } else if (crystalSheet) {
        ctx.drawImage(crystalSheet, frame4 * 16, 0, 16, 20, sx - 8, sy - 10, 16, 20);
      }
    }

    // Coins
    const customCoin = customPack ? customPack.getSprite('ui_coin') : null;
    const coinSheet = atlas.collectibles.get('coin');
    for (let i = 0; i < state.coins.length; i++) {
      const coin = state.coins[i]!;
      if (coin.collected) continue;
      const bob = Math.round(Math.sin(timeSec * 4.5 + coin.x * 1.7) * 2);
      const sx = Math.round((coin.x - camX) * PPU + HALF_W);
      const sy = Math.round((camY - coin.y) * PPU + HALF_H) + bob;
      if (sx < -24 || sx > VIEWPORT_W + 24 || sy < -24 || sy > VIEWPORT_H + 24) continue;

      if (isDrawable(customCoin)) {
        ctx.drawImage(customCoin, sx - 10, sy - 10, 20, 20);
      } else if (coinSheet) {
        ctx.drawImage(coinSheet, frame4 * 20, 0, 20, 20, sx - 10, sy - 10, 20, 20);
      }
      // Periodic crisp glint sparkle above coin
      if (frame4 === 0) {
        ctx.fillStyle = UI_COLORS.coinLight;
        ctx.fillRect(sx + 5, sy - 9, 2, 2);
      }
    }
  }

  private renderEnemies(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i]!;
      if (!e.alive) continue;

      const wx = e.prevX + (e.x - e.prevX) * alpha;
      const wy = e.prevY + (e.y - e.prevY) * alpha;
      const footX = Math.round((wx + e.width * 0.5 - camX) * PPU + HALF_W);
      const footY = Math.round((camY - wy) * PPU + HALF_H);
      if (footX < -48 || footX > VIEWPORT_W + 48 || footY < -48 || footY > VIEWPORT_H + 64) {
        continue;
      }

      const sprSet = atlas.enemies.get(e.archetype);
      const customSpr = customPack ? customPack.getSprite(`enemy_${e.archetype}`) : null;
      const frame = ((timeSec * 6 + i * 0.7) | 0) & 1;
      const flash = e.hitFlashTimer > 0;

      // Ground contact shadow
      if (e.grounded) {
        ctx.fillStyle = 'rgba(24, 11, 32, 0.35)';
        ctx.fillRect(footX - 10, footY - 2, 20, 3);
      }

      ctx.save();
      ctx.translate(footX, footY);
      if (e.facing < 0) {
        ctx.scale(-1, 1);
      }

      if (!flash && isDrawable(customSpr)) {
        const dw = Math.max(24, Math.round(e.width * PPU));
        const dh = Math.max(24, Math.round(e.height * PPU));
        ctx.drawImage(customSpr, -(dw >> 1), -dh, dw, dh);
      } else if (sprSet) {
        const img = flash ? sprSet.flash : sprSet.sheet;
        ctx.drawImage(
          img,
          frame * sprSet.frameW,
          0,
          sprSet.frameW,
          sprSet.frameH,
          -(sprSet.frameW >> 1),
          -sprSet.frameH + 2,
          sprSet.frameW,
          sprSet.frameH,
        );
      }
      ctx.restore();

      // Stun indicator pixel stars
      if (e.stunTimer > 0) {
        const stOff = Math.round(Math.sin(timeSec * 12) * 5);
        const topY = footY - Math.round(e.height * PPU) - 6;
        ctx.fillStyle = UI_COLORS.frameGold;
        ctx.fillRect(footX - 6 + stOff, topY, 2, 2);
        ctx.fillRect(footX + 4 - stOff, topY - 1, 2, 2);
      }

      // Crisp micro HP pips for damaged multi-HP enemies
      if (e.maxHp > 1 && e.hp < e.maxHp) {
        const topY = footY - Math.round(e.height * PPU) - 8;
        const barW = e.maxHp * 5 + 1;
        const bx = footX - (barW >> 1);
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(bx, topY, barW, 4);
        for (let p = 0; p < e.maxHp; p++) {
          ctx.fillStyle = p < e.hp ? '#ff3858' : '#3d1c3d';
          ctx.fillRect(bx + 1 + p * 5, topY + 1, 4, 2);
        }
      }
    }
  }

  private renderBoss(
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
    const hover = Math.round(Math.sin(timeSec * 3.5) * 3);
    const flash = boss.hitFlashTimer > 0;
    const frame = ((timeSec * 4.5) | 0) & 1;

    // Phase 2/3 rage energy aura
    if (boss.phase >= 2) {
      const auraCol = boss.phase === 3 ? '#ff3868' : '#ffae24';
      const segs = 12;
      const rad = Math.round(Math.max(boss.width, boss.height) * PPU * 0.52);
      ctx.fillStyle = auraCol;
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2 + timeSec * (boss.phase === 3 ? 4.2 : 2.5);
        const ax = Math.round(cx + Math.cos(ang) * rad);
        const ay = Math.round(cy + hover + Math.sin(ang) * rad);
        ctx.fillRect(ax - 1, ay - 1, 3, 3);
      }
    }

    // Telegraph laser beam when boss is firing/charging laser
    if (boss.state === 'laser' || boss.state === 'beam' || boss.state === 'sweep') {
      const len = 340;
      const lx2 = Math.round(cx + Math.cos(boss.laserAngle) * len);
      const ly2 = Math.round(cy + hover - Math.sin(boss.laserAngle) * len);
      this.drawPixelBeam(ctx, cx, cy + hover, lx2, ly2, frame === 0 ? '#ff3868' : '#ffe866');
    }

    // Main boss sprite
    const sprSet = atlas.bosses.get(boss.id);
    const customBoss = customPack ? customPack.getSprite(`boss_${boss.id}`) : null;

    ctx.save();
    ctx.translate(cx, cy + hover);
    if (boss.facing < 0 && boss.id !== 'primal_eye') {
      ctx.scale(-1, 1);
    }

    if (!flash && isDrawable(customBoss)) {
      const bw = Math.round(boss.width * PPU);
      const bh = Math.round(boss.height * PPU);
      ctx.drawImage(customBoss, -(bw >> 1), -(bh >> 1), bw, bh);
    } else if (sprSet) {
      const img = flash ? sprSet.flash : sprSet.sheet;
      ctx.drawImage(
        img,
        frame * sprSet.frameW,
        0,
        sprSet.frameW,
        sprSet.frameH,
        -(sprSet.frameW >> 1),
        -(sprSet.frameH >> 1),
        sprSet.frameW,
        sprSet.frameH,
      );
    }
    ctx.restore();

    // Flagship Primal Eye live tracking iris + orbiting thorny vine tendrils!
    if (boss.id === 'primal_eye') {
      const heroCx = state.hero.x + state.hero.width * 0.5;
      const heroCy = state.hero.y + state.hero.height * 0.5;
      const bossCx = wx + boss.width * 0.5;
      const bossCy = wy + boss.height * 0.5;
      const dx = heroCx - bossCx;
      const dy = heroCy - bossCy;
      const dist = Math.hypot(dx, dy) || 1;
      const lookX = Math.round((dx / dist) * 10);
      const lookY = Math.round((-dy / dist) * 8);

      if (!flash && atlas.primalEyeIris) {
        ctx.drawImage(atlas.primalEyeIris, cx + lookX - 14, cy + hover + lookY - 14);
      }

      // 4 orbiting thorny vine tendrils pulsing around the Primal Eye
      if (atlas.primalEyeTendril) {
        const orbitR = 50 + (boss.phase - 1) * 7 + Math.round(Math.sin(timeSec * 3) * 4);
        const speed = boss.phase === 3 ? 2.6 : boss.phase === 2 ? 1.9 : 1.3;
        for (let t = 0; t < 4; t++) {
          const ang = timeSec * speed + (t * Math.PI) * 0.5;
          const tx = Math.round(cx + Math.cos(ang) * orbitR);
          const ty = Math.round(cy + hover + Math.sin(ang) * orbitR * 0.78);
          // Vine stalk pixel dots connecting body to bulb
          ctx.fillStyle = '#2c7a24';
          for (let k = 1; k <= 3; k++) {
            const frac = k * 0.24;
            ctx.fillRect(
              Math.round(cx + (tx - cx) * frac) - 1,
              Math.round(cy + hover + (ty - (cy + hover)) * frac) - 1,
              3,
              3,
            );
          }
          ctx.drawImage(atlas.primalEyeTendril, tx - 12, ty - 12);
        }
      }
    }

    // Boss invulnerable shield ring
    if (boss.shieldActive) {
      const r = Math.round(Math.max(boss.width, boss.height) * PPU * 0.56);
      ctx.fillStyle = frame === 0 ? '#66f7ff' : HIGHLIGHT_CREAM;
      for (let s = 0; s < 20; s++) {
        const ang = (s / 20) * Math.PI * 2 + timeSec * 2;
        ctx.fillRect(
          Math.round(cx + Math.cos(ang) * r) - 1,
          Math.round(cy + hover + Math.sin(ang) * r) - 1,
          2,
          2,
        );
      }
    }
  }

  private renderHero(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
    customPack: IAssetPackManager | null,
  ): void {
    const hero = state.hero;
    if (hero.action === 'dead') return;

    const wx = hero.prevX + (hero.x - hero.prevX) * alpha;
    const wy = hero.prevY + (hero.y - hero.prevY) * alpha;
    const footX = Math.round((wx + hero.width * 0.5 - camX) * PPU + HALF_W);
    const footY = Math.round((camY - wy) * PPU + HALF_H);
    const centerY = footY - Math.round(hero.height * PPU * 0.5);
    const pal = HERO_FORM_PALETTES[hero.form];

    // Invulnerability flicker (never completely invisible; quick classic blink cadence)
    const invulnBlink = hero.invulnTimer > 0 && (((timeSec * 24) | 0) & 1) === 1;

    // Ground contact shadow
    if (hero.grounded) {
      ctx.fillStyle = 'rgba(24, 11, 32, 0.42)';
      ctx.fillRect(footX - 10, footY - 1, 20, 3);
    }

    // Volt target lock-on reticle & lightning tether when Volt form has a target
    if (hero.form === 'krunk_electric' && hero.voltTargetId !== null) {
      const tx = Math.round((hero.voltTargetX - camX) * PPU + HALF_W);
      const ty = Math.round((camY - hero.voltTargetY) * PPU + HALF_H);
      this.drawPixelBeam(ctx, footX, centerY, tx, ty, '#66f7ff');
      // Corner lock-on brackets
      ctx.fillStyle = '#f2ff38';
      ctx.fillRect(tx - 12, ty - 12, 5, 2);
      ctx.fillRect(tx - 12, ty - 12, 2, 5);
      ctx.fillRect(tx + 7, ty - 12, 5, 2);
      ctx.fillRect(tx + 10, ty - 12, 2, 5);
      ctx.fillRect(tx - 12, ty + 10, 5, 2);
      ctx.fillRect(tx - 12, ty + 7, 2, 5);
      ctx.fillRect(tx + 7, ty + 10, 5, 2);
      ctx.fillRect(tx + 10, ty + 7, 2, 5);
    }

    // Form aura glow behind elemental forms
    if (hero.form !== 'krunk_basic') {
      const t = timeSec * 4;
      ctx.fillStyle = pal[4];
      for (let m = 0; m < 3; m++) {
        const ang = t + m * 2.094;
        const mx = Math.round(footX + Math.cos(ang) * 14);
        const my = Math.round(centerY + Math.sin(ang * 1.3) * 10);
        ctx.fillRect(mx, my, 2, 2);
      }
    }

    // Dynamic dash / stomp smear streaks behind hero
    if (hero.action === 'air_stomp') {
      ctx.fillStyle = pal[4];
      ctx.fillRect(footX - 10, centerY - 26, 2, 16);
      ctx.fillRect(footX + 8, centerY - 26, 2, 16);
      ctx.fillStyle = HIGHLIGHT_CREAM;
      ctx.fillRect(footX - 1, centerY - 30, 2, 18);
    } else if (
      hero.action === 'ground_dash' ||
      hero.action === 'wall_dash' ||
      hero.action === 'fire_dash' ||
      hero.action === 'volt_blink' ||
      hero.action === 'shadow_blink'
    ) {
      const dir = -hero.facing;
      ctx.fillStyle = pal[0];
      ctx.fillRect(footX + dir * 10, centerY - 7, dir * 16, 3);
      ctx.fillRect(footX + dir * 8, centerY + 3, dir * 14, 3);
      ctx.fillStyle = pal[4];
      ctx.fillRect(footX + dir * 12, centerY - 2, dir * 20, 4);
    }

    // Draw Hero Sprite
    if (!invulnBlink) {
      const heroSet = atlas.heroSheets.get(hero.form);
      const customHero = customPack ? customPack.getHeroSheet(hero.form) : null;
      const flash = hero.hitFlashTimer > 0;
      const useActionSheet =
        hero.action === 'air_stomp' ||
        hero.action === 'rock_uppercut' ||
        hero.action === 'leaf_glide';

      const sxScale = hero.scaleX > 0.2 ? hero.scaleX : 1;
      const syScale = hero.scaleY > 0.2 ? hero.scaleY : 1;
      const drawFacing = hero.action === 'wall_slide' && hero.onWall !== 0 ? -hero.onWall : hero.facing;

      ctx.save();
      ctx.translate(footX, footY);
      ctx.scale(drawFacing * sxScale, syScale);

      if (!flash && !useActionSheet && isDrawable(customHero)) {
        // Custom pack hero sheet: support either 12-frame 36x36 strip or single image cleanly
        if (customHero.width >= HERO_STD_FRAME_W * 4 && customHero.height >= HERO_STD_FRAME_H) {
          const frame = this.selectHeroStdFrame(hero, timeSec);
          const maxCols = Math.max(1, Math.floor(customHero.width / HERO_STD_FRAME_W));
          const col = frame % maxCols;
          ctx.drawImage(
            customHero,
            col * HERO_STD_FRAME_W,
            0,
            HERO_STD_FRAME_W,
            HERO_STD_FRAME_H,
            -(HERO_STD_FRAME_W >> 1),
            -HERO_STD_FRAME_H + 3,
            HERO_STD_FRAME_W,
            HERO_STD_FRAME_H,
          );
        } else {
          ctx.drawImage(customHero, -18, -34, 36, 36);
        }
      } else if (heroSet) {
        if (useActionSheet) {
          const actFrame = this.selectHeroActFrame(hero, timeSec);
          const img = flash ? heroSet.actionFlash : heroSet.action;
          ctx.drawImage(
            img,
            actFrame * HERO_ACT_FRAME_W,
            0,
            HERO_ACT_FRAME_W,
            HERO_ACT_FRAME_H,
            -(HERO_ACT_FRAME_W >> 1),
            -HERO_ACT_FRAME_H + 6,
            HERO_ACT_FRAME_W,
            HERO_ACT_FRAME_H,
          );
        } else {
          const stdFrame = this.selectHeroStdFrame(hero, timeSec);
          const img = flash ? heroSet.standardFlash : heroSet.standard;
          ctx.drawImage(
            img,
            stdFrame * HERO_STD_FRAME_W,
            0,
            HERO_STD_FRAME_W,
            HERO_STD_FRAME_H,
            -(HERO_STD_FRAME_W >> 1),
            -HERO_STD_FRAME_H + 3,
            HERO_STD_FRAME_W,
            HERO_STD_FRAME_H,
          );
        }
      }
      ctx.restore();
    }

    // Orbiting DashRoundFire flames when Fire form + DashRoundFire upgrade owned
    const hasRoundFire = (state.progress.upgradeLevels.DashRoundFire ?? 0) > 0;
    if (hasRoundFire && hero.form === 'krunk_fire') {
      const fireSpr = atlas.projectiles.get('fireball');
      const fireFrame = ((timeSec * 10) | 0) & 1;
      const baseAngle = hero.dashRingAngle !== 0 ? hero.dashRingAngle : timeSec * 5;
      for (let f = 0; f < 3; f++) {
        const ang = baseAngle + (f * Math.PI * 2) / 3;
        const fx = Math.round(footX + Math.cos(ang) * 22);
        const fy = Math.round(centerY + Math.sin(ang) * 16);
        if (fireSpr) {
          ctx.drawImage(fireSpr, fireFrame * 16, 0, 16, 16, fx - 8, fy - 8, 16, 16);
        }
      }
    }

    // RockShield golden-violet protective bubble
    if (hero.rockShieldActive) {
      const segs = 10;
      const r = 19;
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2 + timeSec * 1.8;
        const bx = Math.round(footX + Math.cos(ang) * r);
        const by = Math.round(centerY + Math.sin(ang) * r);
        ctx.fillStyle = OUTLINE_DARK;
        ctx.fillRect(bx - 2, by - 2, 5, 5);
        ctx.fillStyle = s % 2 === 0 ? UI_COLORS.shieldMid : UI_COLORS.shieldGem;
        ctx.fillRect(bx - 1, by - 1, 3, 3);
      }
    }

    // MagicShield shimmering cyan halo
    if (hero.magicShieldTimer > 0) {
      const segs = 12;
      const r = 22;
      ctx.fillStyle = UI_COLORS.magicShield;
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2 - timeSec * 3.5;
        ctx.fillRect(
          Math.round(footX + Math.cos(ang) * r) - 1,
          Math.round(centerY + Math.sin(ang) * r) - 1,
          2,
          2,
        );
      }
    }
  }

  private renderProjectiles(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    camX: number,
    camY: number,
    alpha: number,
    timeSec: number,
    atlas: ProceduralPixelAtlas,
  ): void {
    const f2 = ((timeSec * 12) | 0) & 1;
    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i]!;
      const wx = p.prevX + (p.x - p.prevX) * alpha;
      const wy = p.prevY + (p.y - p.prevY) * alpha;
      const sx = Math.round((wx - camX) * PPU + HALF_W);
      const sy = Math.round((camY - wy) * PPU + HALF_H);
      if (sx < -24 || sx > VIEWPORT_W + 24 || sy < -24 || sy > VIEWPORT_H + 24) continue;

      const spr = atlas.projectiles.get(p.kind);
      if (spr) {
        ctx.drawImage(spr, f2 * 16, 0, 16, 16, sx - 8, sy - 8, 16, 16);
      }
    }
  }

  private selectHeroStdFrame(hero: HeroState, timeSec: number): HeroStdFrame {
    const t = hero.animTimer > 0 ? hero.animTimer : timeSec;
    switch (hero.action) {
      case 'idle':
        return (((t * 3.2) | 0) & 1) === 0 ? HeroStdFrame.Idle0 : HeroStdFrame.Idle1;
      case 'run': {
        const step = ((t * 11) | 0) & 3;
        return (HeroStdFrame.Run0 + step) as HeroStdFrame;
      }
      case 'jump':
        return HeroStdFrame.Jump;
      case 'fall':
        return HeroStdFrame.Fall;
      case 'wall_slide':
        return HeroStdFrame.WallSlide;
      case 'vine_slide':
        return HeroStdFrame.VineSlide;
      case 'ground_dash':
      case 'wall_dash':
      case 'fire_dash':
      case 'volt_dive':
      case 'volt_blink':
      case 'shadow_blink':
        return HeroStdFrame.Dash;
      case 'hurt':
      case 'dead':
        return HeroStdFrame.Hurt;
      default:
        return HeroStdFrame.Idle0;
    }
  }

  private selectHeroActFrame(hero: HeroState, timeSec: number): HeroActFrame {
    const f = (((timeSec * 12) | 0) & 1);
    if (hero.action === 'air_stomp') {
      return f === 0 ? HeroActFrame.Stomp0 : HeroActFrame.Stomp1;
    }
    if (hero.action === 'rock_uppercut') {
      return f === 0 ? HeroActFrame.Uppercut0 : HeroActFrame.Uppercut1;
    }
    return f === 0 ? HeroActFrame.Glide0 : HeroActFrame.Glide1;
  }

  private drawPixelBeam(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(4, Math.min(80, Math.round(Math.hypot(dx, dy) / 5)));
    ctx.fillStyle = OUTLINE_DARK;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px - 2, py - 2, 5, 5);
    }
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
    ctx.fillStyle = HIGHLIGHT_CREAM;
    for (let i = 0; i <= steps; i += 2) {
      const t = i / steps;
      const px = Math.round(x0 + dx * t);
      const py = Math.round(y0 + dy * t);
      ctx.fillRect(px, py, 1, 1);
    }
  }
}
