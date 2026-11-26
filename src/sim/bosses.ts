import {
  type BossDef,
  type BossRuntime,
  type InputFrame,
  type IWorldCatalog,
  type MovingPlatformRuntime,
  type ProjectileRuntime,
  type RoomDef,
  type SimEvent,
  type SimState,
} from '../contracts/index';
import {
  aabbOverlap,
  getTileAt,
  isSolidTile,
  type BlastCircle,
} from './collision';
import { registerComboEnemyHit } from './combo';
import { PHYSICS } from './constants';
import { applyHeroAttackBounce, awardCrystals } from './enemies';
import { damageHero } from './physics';

interface ArenaBounds {
  minX: number;
  maxX: number;
  floorY: number;
  maxY: number;
  centerX: number;
}

function findArenaBounds(state: SimState, room: RoomDef, boss: BossRuntime): ArenaBounds {
  const rw = room.widthTiles;
  const rh = room.heightTiles;
  const tiles = state.roomTiles;

  // Probe floor top near arena center
  const probeTx = Math.max(1, Math.min(rw - 2, Math.floor(rw * 0.5)));
  let floorY = 1.0;
  for (let ty = Math.min(rh - 2, 4); ty >= 0; ty--) {
    if (isSolidTile(getTileAt(tiles, rw, rh, probeTx, ty))) {
      floorY = ty + 1;
      break;
    }
  }

  // Probe left & right inner arena walls at mid body height
  const wallProbeTy = Math.min(rh - 2, Math.max(1, Math.floor(floorY + 1)));
  let leftWallEdge = 1.0;
  for (let tx = 0; tx < Math.floor(rw * 0.4); tx++) {
    if (isSolidTile(getTileAt(tiles, rw, rh, tx, wallProbeTy))) {
      leftWallEdge = tx + 1;
    } else if (tx >= 1) {
      break;
    }
  }

  let rightWallEdge = rw - 1.0;
  for (let tx = rw - 1; tx > Math.floor(rw * 0.6); tx--) {
    if (isSolidTile(getTileAt(tiles, rw, rh, tx, wallProbeTy))) {
      rightWallEdge = tx;
    } else if (tx <= rw - 2) {
      break;
    }
  }

  const minX = Math.max(1.0, leftWallEdge + 0.05);
  const maxX = Math.max(minX + 1.0, rightWallEdge - boss.width - 0.05);
  const maxY = Math.max(floorY + 2.0, rh - boss.height - 1.2);
  const centerX = (minX + maxX) * 0.5;

  return { minX, maxX, floorY, maxY, centerX };
}

function isGroundedBoss(id: BossDef['id']): boolean {
  return (
    id === 'dino_behemoth' ||
    id === 'magma_boar_king' ||
    id === 'bone_colossus' ||
    id === 'mecha_bull' ||
    id === 'shadow_doppelganger'
  );
}

function spawnBossProjectile(
  state: SimState,
  kind: ProjectileRuntime['kind'],
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  ttl: number,
  homing = false,
): void {
  state.projectiles.push({
    id: state.nextProjectileId++,
    fromHero: false,
    kind,
    x,
    y,
    prevX: x,
    prevY: y,
    vx,
    vy,
    radius,
    ttl,
    homing,
  });
}

function spawnGroundShockwaves(state: SimState, cx: number, floorY: number, speed: number): void {
  const dirs: readonly (-1 | 1)[] = [-1, 1];
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    spawnBossProjectile(
      state,
      'shockwave',
      cx + dir * 0.6,
      floorY + 0.35,
      dir * speed,
      0,
      0.42,
      1.6,
      false,
    );
  }
}

function spawnRadialBurst(
  state: SimState,
  kind: ProjectileRuntime['kind'],
  cx: number,
  cy: number,
  count: number,
  speed: number,
  radius: number,
  ttl: number,
  startAngle = 0,
  arcSpan = Math.PI * 2,
): void {
  const denom = arcSpan >= Math.PI * 1.99 ? count : Math.max(1, count - 1);
  for (let k = 0; k < count; k++) {
    const ang = startAngle + (k / denom) * arcSpan;
    spawnBossProjectile(
      state,
      kind,
      cx,
      cy,
      Math.cos(ang) * speed,
      Math.sin(ang) * speed,
      radius,
      ttl,
      false,
    );
  }
}

/**
 * Dynamic mid-fight arena platform morphing for Nightmare Sovereign (arenaMorphPhase 1 -> 2 -> 3).
 * Cleanly creates or updates room moving/temporary platform states deterministically.
 */
export function applyNightmareArenaMorph(
  state: SimState,
  room: RoomDef,
  morphPhase: number,
): void {
  const clampedPhase = Math.max(1, Math.min(3, Math.floor(morphPhase)));

  // Determine floor Y for platform placement
  const probeTx = Math.max(1, Math.min(room.widthTiles - 2, Math.floor(room.widthTiles * 0.5)));
  let floorY = 1.0;
  for (let ty = Math.min(room.heightTiles - 2, 4); ty >= 0; ty--) {
    if (isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, probeTx, ty))) {
      floorY = ty + 1;
      break;
    }
  }

  // Ensure arena has at least 3 morphable platforms
  if (state.platforms.length === 0) {
    const span = Math.max(8, room.widthTiles - 6);
    const leftX = Math.max(2.5, room.widthTiles * 0.22 - 1.5);
    const centerX = Math.max(3.5, room.widthTiles * 0.5 - 1.5);
    const rightX = Math.min(room.widthTiles - 5.5, room.widthTiles * 0.78 - 1.5);
    const lowY = Math.min(room.heightTiles - 4.5, floorY + 2.5);
    const highY = Math.min(room.heightTiles - 3.0, floorY + Math.min(5.0, span * 0.25));

    const seeds: MovingPlatformRuntime[] = [
      {
        id: 'nm_morph_left',
        kind: 'moving_platform',
        baseX: leftX,
        baseY: lowY,
        x: leftX,
        y: lowY,
        prevX: leftX,
        prevY: lowY,
        width: 3.0,
        height: 0.5,
        moveDx: 1.2,
        moveDy: 0,
        periodSec: 4.5,
        phase: 0,
        solid: true,
      },
      {
        id: 'nm_morph_center',
        kind: 'moving_platform',
        baseX: centerX,
        baseY: highY,
        x: centerX,
        y: highY,
        prevX: centerX,
        prevY: highY,
        width: 3.2,
        height: 0.5,
        moveDx: 1.4,
        moveDy: 0,
        periodSec: 4.5,
        phase: Math.PI * 0.5,
        solid: true,
      },
      {
        id: 'nm_morph_right',
        kind: 'moving_platform',
        baseX: rightX,
        baseY: lowY,
        x: rightX,
        y: lowY,
        prevX: rightX,
        prevY: lowY,
        width: 3.0,
        height: 0.5,
        moveDx: 1.2,
        moveDy: 0,
        periodSec: 4.5,
        phase: Math.PI,
        solid: true,
      },
    ];
    state.platforms.push(...seeds);
  }

  for (let i = 0; i < state.platforms.length; i++) {
    const p = state.platforms[i];
    if (clampedPhase === 1) {
      // Phase 1: Stable wide horizontal sway
      p.kind = 'moving_platform';
      p.moveDx = 1.2;
      p.moveDy = 0;
      p.periodSec = 4.5;
      p.solid = true;
    } else if (clampedPhase === 2) {
      // Phase 2: Rising vertical eclipse elevators + alternating solid pulse
      p.kind = 'moving_platform';
      p.moveDx = i % 2 === 0 ? 0.6 : 1.8;
      p.moveDy = 1.8;
      p.periodSec = 3.2;
      p.solid = true;
    } else {
      // Phase 3: High-velocity orbital eclipse platforms
      p.kind = 'spinning_platform';
      p.moveDx = 2.2;
      p.moveDy = 1.5;
      p.periodSec = 2.4;
      p.solid = true;
    }
  }
}

export function createBossRuntime(
  bossDef: BossDef,
  room: RoomDef,
  state?: SimState,
): BossRuntime {
  const tiles = state ? state.roomTiles : room.tiles;
  const rw = room.widthTiles;
  const rh = room.heightTiles;
  const probeTx = Math.max(1, Math.min(rw - 2, Math.floor(rw * 0.5)));
  let floorY = 1.0;
  for (let ty = Math.min(rh - 2, 4); ty >= 0; ty--) {
    if (isSolidTile(getTileAt(tiles, rw, rh, probeTx, ty))) {
      floorY = ty + 1;
      break;
    }
  }

  const bx = Math.max(2, Math.min(rw - bossDef.width - 2, rw * 0.65));
  const grounded = isGroundedBoss(bossDef.id);
  const by = grounded
    ? floorY
    : Math.max(floorY + 1.5, Math.min(rh - bossDef.height - 1.5, rh * 0.5));

  const runtime: BossRuntime = {
    id: bossDef.id,
    x: bx,
    y: by,
    prevX: bx,
    prevY: by,
    vx: 0,
    vy: 0,
    width: bossDef.width,
    height: bossDef.height,
    facing: -1,
    hp: bossDef.maxHp,
    maxHp: bossDef.maxHp,
    phase: 1,
    state: grounded ? 'stalk' : 'hover',
    stateTimer: 0.75,
    attackIndex: 0,
    invulnTimer: 0,
    hitFlashTimer: 0,
    shieldActive: false,
    laserAngle: Math.PI,
    defeated: false,
    arenaMorphPhase: bossDef.id === 'nightmare_sovereign' ? 1 : 0,
  };

  if (state && bossDef.id === 'nightmare_sovereign') {
    applyNightmareArenaMorph(state, room, 1);
  }

  return runtime;
}

export function damageBoss(
  state: SimState,
  boss: BossRuntime,
  damage: number,
  catalog: IWorldCatalog,
  room: RoomDef,
  events: SimEvent[],
  isHeavyAttack = false,
): boolean {
  if (boss.defeated || boss.invulnTimer > 0 || damage <= 0) return false;

  const cx = boss.x + boss.width * 0.5;
  const cy = boss.y + boss.height * 0.5;

  // Active shield handling
  if (boss.shieldActive) {
    if (boss.id === 'nightmare_sovereign' && isHeavyAttack) {
      // Heavy form strike or shockwave shatters Nightmare Sovereign's shield!
      boss.shieldActive = false;
      boss.state = 'vulnerable';
      boss.stateTimer = 1.3;
      boss.hitFlashTimer = 0.22;
      boss.invulnTimer = 0.18;
      state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.2);
      state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.24);
      events.push({ type: 'block_break', x: cx, y: cy, explosive: true });
      return false;
    }
    boss.hitFlashTimer = 0.08;
    return false;
  }

  boss.hp = Math.max(0, boss.hp - damage);
  boss.invulnTimer = 0.3;
  boss.hitFlashTimer = 0.2;

  const hpRatio = boss.hp / Math.max(1, boss.maxHp);
  const newPhase: 1 | 2 | 3 = hpRatio > 0.66 ? 1 : hpRatio > 0.33 ? 2 : 3;
  if (newPhase > boss.phase) {
    boss.phase = newPhase;
    if (boss.id === 'nightmare_sovereign') {
      boss.arenaMorphPhase = newPhase; // 1 -> 2 -> 3
      applyNightmareArenaMorph(state, room, newPhase);
      state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.28);
      state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.28);
    } else {
      boss.arenaMorphPhase = newPhase - 1;
    }
  }

  registerComboEnemyHit(state, cx, cy, false, events);
  events.push({
    type: 'boss_hit',
    x: cx,
    y: cy,
    bossId: boss.id,
    hp: boss.hp,
    maxHp: boss.maxHp,
  });
  state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.16);
  state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.2);
  state.hitstopTicks = Math.max(state.hitstopTicks, 3);

  if (boss.hp <= 0) {
    boss.defeated = true;
    boss.shieldActive = false;
    const bossDef = catalog.bosses.get(boss.id);
    if (!state.progress.defeatedBosses.includes(boss.id)) {
      state.progress.defeatedBosses.push(boss.id);
    }

    const unlockForm = bossDef?.unlockForm;
    if (unlockForm && !state.progress.unlockedForms.includes(unlockForm)) {
      state.progress.unlockedForms.push(unlockForm);
    }

    if (bossDef) {
      awardCrystals(state, bossDef.crystalReward);
      const bossCoinId = `boss_${boss.id}`;
      if (bossDef.coinReward > 0 && !state.progress.collectedCoinIds.includes(bossCoinId)) {
        state.progress.collectedCoinIds.push(bossCoinId);
        events.push({
          type: 'coin_pickup',
          x: cx,
          y: cy,
          coinId: bossCoinId,
          totalCoins: state.progress.collectedCoinIds.length,
        });
      }
    }

    events.push({
      type: 'boss_defeated',
      x: cx,
      y: cy,
      bossId: boss.id,
      unlockForm,
    });

    if (
      boss.id === 'nightmare_sovereign' ||
      state.mode === 'boss_rush' ||
      (state.mode === 'time_attack' && boss.id === 'primal_eye')
    ) {
      state.victoryTriggered = true;
      const ticks = state.mode === 'time_attack' ? state.timeAttackTicks : state.tick;
      if (
        state.mode === 'time_attack' &&
        (state.progress.bestTimeAttackTicks === null || ticks < state.progress.bestTimeAttackTicks)
      ) {
        state.progress.bestTimeAttackTicks = ticks;
      }
      events.push({ type: 'victory', mode: state.mode, ticks });
    }
  }

  return true;
}

// ============================================================================
// Active Laser Beam Collision Helper (Primal Eye & Electro Sphinx)
// ============================================================================

function checkBossLaserHit(
  state: SimState,
  boss: BossRuntime,
  bx: number,
  by: number,
  events: SimEvent[],
): void {
  const hero = state.hero;
  if (hero.action === 'dead') return;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;
  const cos = Math.cos(boss.laserAngle);
  const sin = Math.sin(boss.laserAngle);
  const rx = hx - bx;
  const ry = hy - by;
  const proj = rx * cos + ry * sin;
  if (proj > 0.8 && proj < 16.0) {
    const perp = Math.abs(-rx * sin + ry * cos);
    if (perp <= 0.48) {
      damageHero(state, 1, bx, events, 'projectile');
    }
  }
}

// ============================================================================
// Gravity-Assisted Boss Motion Helper
// ============================================================================

function stepGroundedBossPhysics(
  boss: BossRuntime,
  bounds: ArenaBounds,
  dt: number,
  gravityScale = 0.72,
): { landed: boolean; hitWall: -1 | 0 | 1 } {
  let hitWall: -1 | 0 | 1 = 0;
  let nextX = boss.x + boss.vx * dt;
  if (nextX <= bounds.minX) {
    nextX = bounds.minX;
    hitWall = -1;
  } else if (nextX >= bounds.maxX) {
    nextX = bounds.maxX;
    hitWall = 1;
  }
  boss.x = nextX;

  const wasAirborne = boss.y > bounds.floorY + 0.05;
  boss.vy = Math.max(-18.0, boss.vy + PHYSICS.G_EFF * gravityScale * dt);
  boss.y += boss.vy * dt;

  let landed = false;
  if (boss.y <= bounds.floorY) {
    boss.y = bounds.floorY;
    boss.vy = 0;
    landed = wasAirborne;
  } else if (boss.y >= bounds.maxY) {
    boss.y = bounds.maxY;
    if (boss.vy > 0) boss.vy = 0;
  }

  return { landed, hitWall };
}

// ============================================================================
// Bespoke Multi-Phase State Machines for ALL 8 Bosses & Mini-Bosses
// ============================================================================

function stepDinoBehemoth(
  state: SimState,
  boss: BossRuntime,
  bounds: ArenaBounds,
  hx: number,
  dt: number,
  events: SimEvent[],
): void {
  const bx = boss.x + boss.width * 0.5;
  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.25 : 1.5;

  switch (boss.state) {
    case 'stalk':
    case 'idle': {
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = boss.facing * 2.2 * speedScale;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.45 / speedScale;
        boss.vx = 0;
      }
      break;
    }

    case 'telegraph': {
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = 0;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        const pattern = boss.attackIndex % (boss.phase >= 2 ? 2 : 1);
        boss.attackIndex += 1;
        if (pattern === 0) {
          boss.state = 'leap';
          boss.stateTimer = 2.0;
          const jumpDist = Math.max(-9.0, Math.min(9.0, hx - bx));
          boss.vx = jumpDist * 1.15;
          boss.vy = 13.5 + boss.phase * 1.0;
        } else {
          boss.state = 'charge';
          boss.stateTimer = 0.85;
          boss.vx = boss.facing * (8.5 * speedScale);
        }
      }
      break;
    }

    case 'leap': {
      const res = stepGroundedBossPhysics(boss, bounds, dt, 0.78);
      if (res.landed || (boss.y <= bounds.floorY + 0.02 && boss.stateTimer < 1.85)) {
        // Heavy landing radial thorn burst!
        boss.vx = 0;
        const count = boss.phase === 1 ? 4 : boss.phase === 2 ? 6 : 8;
        spawnRadialBurst(
          state,
          'thorn',
          boss.x + boss.width * 0.5,
          bounds.floorY + 0.5,
          count,
          6.0 * speedScale,
          0.26,
          2.6,
          0.18,
          Math.PI - 0.36,
        );
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.24);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.26);
        events.push({ type: 'stomp_impact', x: boss.x + boss.width * 0.5, y: bounds.floorY, explosive: false });
        boss.state = 'recover';
        boss.stateTimer = 1.15 / speedScale;
      }
      break;
    }

    case 'charge': {
      const res = stepGroundedBossPhysics(boss, bounds, dt);
      if (res.hitWall !== 0 || boss.stateTimer <= 0) {
        boss.vx = 0;
        boss.state = 'recover';
        boss.stateTimer = 1.0 / speedScale;
      }
      break;
    }

    case 'recover':
    default: {
      boss.vx *= 0.82;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'stalk';
        boss.stateTimer = 0.7 / speedScale;
      }
      break;
    }
  }
}

function stepPrimalEye(
  state: SimState,
  boss: BossRuntime,
  bounds: ArenaBounds,
  hx: number,
  hy: number,
  dt: number,
  events: SimEvent[],
): void {
  const bx = boss.x + boss.width * 0.5;
  const by = boss.y + boss.height * 0.5;
  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.25 : 1.5;

  switch (boss.state) {
    case 'hover': {
      const targetX = Math.max(
        bounds.minX,
        Math.min(bounds.maxX, bounds.centerX + Math.sin(state.tick * 0.045 * speedScale) * ((bounds.maxX - bounds.minX) * 0.38)),
      );
      const targetY = Math.max(
        bounds.floorY + 1.8,
        Math.min(bounds.maxY, bounds.floorY + 4.2 + Math.cos(state.tick * 0.065) * 1.1),
      );
      boss.vx = (targetX - boss.x) * 3.0;
      boss.vy = (targetY - boss.y) * 3.0;
      boss.x = Math.max(bounds.minX, Math.min(bounds.maxX, boss.x + boss.vx * dt));
      boss.y = Math.max(bounds.floorY + 0.5, Math.min(bounds.maxY, boss.y + boss.vy * dt));
      boss.laserAngle = Math.atan2(hy - by, hx - bx);

      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.5 / speedScale;
      }
      break;
    }

    case 'telegraph': {
      boss.vx *= 0.85;
      boss.vy *= 0.85;
      boss.laserAngle = Math.atan2(hy - by, hx - bx);
      if (boss.stateTimer <= 0) {
        const pattern = boss.attackIndex % 3;
        boss.attackIndex += 1;
        if (pattern === 0) {
          // Bouncing wall-slam spin!
          boss.state = 'wall_spin';
          boss.stateTimer = 1.15 + boss.phase * 0.25;
          const ang = Math.atan2(hy - by, hx - bx);
          const spinSpd = 9.2 * speedScale;
          boss.vx = Math.cos(ang) * spinSpd;
          boss.vy = Math.sin(ang) * spinSpd;
          if (Math.abs(boss.vy) < 3.0) boss.vy = boss.vy >= 0 ? 4.0 : -4.0;
        } else if (pattern === 1) {
          // Radial thorn + spit wave!
          boss.state = 'barrage';
          boss.stateTimer = 0.55;
          const count = boss.phase === 1 ? 6 : boss.phase === 2 ? 8 : 10;
          const baseAng = Math.atan2(hy - by, hx - bx);
          for (let k = 0; k < count; k++) {
            const ang = baseAng + (k / count) * Math.PI * 2;
            const kind: ProjectileRuntime['kind'] = k % 2 === 0 ? 'thorn' : 'spit';
            const spd = 6.2 * speedScale;
            spawnBossProjectile(state, kind, bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.26, 3.0);
          }
        } else {
          // Diagonal sweep laserAngle beam!
          boss.state = 'laser';
          boss.stateTimer = 1.05;
          boss.vx = 0;
          boss.vy = 0;
          boss.laserAngle = Math.atan2(hy - by, hx - bx) - 0.65;
        }
      }
      break;
    }

    case 'wall_spin': {
      boss.x += boss.vx * dt;
      boss.y += boss.vy * dt;
      let bounced = false;
      if (boss.x <= bounds.minX) {
        boss.x = bounds.minX;
        boss.vx = Math.abs(boss.vx);
        bounced = true;
      } else if (boss.x >= bounds.maxX) {
        boss.x = bounds.maxX;
        boss.vx = -Math.abs(boss.vx);
        bounced = true;
      }
      if (boss.y <= bounds.floorY) {
        boss.y = bounds.floorY;
        boss.vy = Math.abs(boss.vy);
        bounced = true;
      } else if (boss.y >= bounds.maxY) {
        boss.y = bounds.maxY;
        boss.vy = -Math.abs(boss.vy);
        bounced = true;
      }
      if (bounced) {
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.14);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.18);
        // Shed aimed thorn splinter on wall slam impact
        const ang = Math.atan2(hy - by, hx - bx);
        spawnBossProjectile(state, 'thorn', bx, by, Math.cos(ang) * 6.5, Math.sin(ang) * 6.5, 0.24, 2.5);
      }
      if (boss.stateTimer <= 0) {
        boss.state = 'vulnerable';
        boss.stateTimer = 0.95;
        boss.vx = 0;
        boss.vy = 0;
      }
      break;
    }

    case 'barrage': {
      boss.vx *= 0.9;
      boss.vy *= 0.9;
      if (boss.stateTimer <= 0) {
        boss.state = 'hover';
        boss.stateTimer = 0.75 / speedScale;
      }
      break;
    }

    case 'laser': {
      boss.vx = 0;
      boss.vy = 0;
      const sweepRate = 1.25 * speedScale;
      boss.laserAngle += sweepRate * dt;
      checkBossLaserHit(state, boss, bx, by, events);
      if (boss.stateTimer <= 0) {
        boss.state = 'vulnerable';
        boss.stateTimer = 0.95;
      }
      break;
    }

    case 'vulnerable':
    default: {
      const restY = Math.max(bounds.floorY + 0.6, Math.min(bounds.maxY, bounds.floorY + 1.4));
      boss.y += (restY - boss.y) * Math.min(1, 4.0 * dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'hover';
        boss.stateTimer = 0.8 / speedScale;
      }
      break;
    }
  }
}

function stepMagmaBoarKing(
  state: SimState,
  boss: BossRuntime,
  bounds: ArenaBounds,
  hx: number,
  dt: number,
  events: SimEvent[],
): void {
  const bx = boss.x + boss.width * 0.5;
  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.25 : 1.5;

  switch (boss.state) {
    case 'stalk': {
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = boss.facing * 2.4 * speedScale;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.48 / speedScale;
        boss.vx = 0;
      }
      break;
    }

    case 'telegraph': {
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = 0;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        const pattern = boss.attackIndex % 3;
        boss.attackIndex += 1;
        if (pattern === 0) {
          boss.state = 'hammer_slam';
          boss.stateTimer = 1.2;
          boss.vx = boss.facing * 2.2;
          boss.vy = 9.5;
        } else if (pattern === 1) {
          boss.state = 'rage_sprint';
          boss.stateTimer = 1.1 + boss.phase * 0.35;
          boss.vx = boss.facing * (9.5 + boss.phase * 1.4);
        } else {
          boss.state = 'fireball_barrage';
          boss.stateTimer = 0.7;
          const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
          for (let k = 0; k < count; k++) {
            const frac = count > 1 ? k / (count - 1) - 0.5 : 0;
            const fvx = boss.facing * (4.0 + Math.abs(frac) * 5.0) + frac * 6.0;
            const fvy = 7.5 + (k % 2) * 2.0;
            spawnBossProjectile(
              state,
              'fireball',
              bx,
              boss.y + boss.height * 0.85,
              fvx,
              fvy,
              0.27, // gravity arc fireball
              3.2,
            );
          }
        }
      }
      break;
    }

    case 'hammer_slam': {
      const res = stepGroundedBossPhysics(boss, bounds, dt, 0.85);
      if (res.landed || (boss.y <= bounds.floorY + 0.02 && boss.stateTimer < 1.05)) {
        boss.vx = 0;
        spawnGroundShockwaves(state, boss.x + boss.width * 0.5, bounds.floorY, 8.5 * speedScale);
        if (boss.phase >= 2) {
          spawnBossProjectile(state, 'fireball', bx, bounds.floorY + 1.0, -4.5, 8.5, 0.27, 3.0);
          spawnBossProjectile(state, 'fireball', bx, bounds.floorY + 1.0, 4.5, 8.5, 0.27, 3.0);
        }
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.24);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.26);
        events.push({ type: 'stomp_impact', x: bx, y: bounds.floorY, explosive: true });
        boss.state = 'recover';
        boss.stateTimer = 1.05 / speedScale;
      }
      break;
    }

    case 'rage_sprint': {
      const res = stepGroundedBossPhysics(boss, bounds, dt);
      if (res.hitWall !== 0) {
        boss.facing = (res.hitWall * -1) as -1 | 1;
        boss.vx = boss.facing * (9.5 + boss.phase * 1.4);
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.16);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.2);
      }
      if (boss.stateTimer <= 0) {
        boss.vx = 0;
        boss.state = 'recover';
        boss.stateTimer = 1.0 / speedScale;
      }
      break;
    }

    case 'fireball_barrage': {
      boss.vx *= 0.85;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'stalk';
        boss.stateTimer = 0.8 / speedScale;
      }
      break;
    }

    case 'recover':
    default: {
      boss.vx *= 0.8;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'stalk';
        boss.stateTimer = 0.7 / speedScale;
      }
      break;
    }
  }
}

function stepBoneColossus(
  state: SimState,
  boss: BossRuntime,
  bounds: ArenaBounds,
  hx: number,
  dt: number,
  events: SimEvent[],
): void {
  const bx = boss.x + boss.width * 0.5;
  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.25 : 1.5;

  switch (boss.state) {
    case 'stalk': {
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = boss.facing * 2.1 * speedScale;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.45 / speedScale;
        boss.vx = 0;
      }
      break;
    }

    case 'telegraph': {
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = 0;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        const pattern = boss.attackIndex % 2;
        boss.attackIndex += 1;
        if (pattern === 0) {
          boss.state = 'bone_leap';
          boss.stateTimer = 2.0;
          const dx = Math.max(-10.0, Math.min(10.0, hx - bx));
          boss.vx = dx * 1.1;
          boss.vy = 14.5 + boss.phase * 0.9;
        } else {
          boss.state = 'charge_stomp';
          boss.stateTimer = 0.95;
          boss.vx = boss.facing * (8.0 + boss.phase * 1.3);
        }
      }
      break;
    }

    case 'bone_leap': {
      const res = stepGroundedBossPhysics(boss, bounds, dt, 0.76);
      if (res.landed || (boss.y <= bounds.floorY + 0.02 && boss.stateTimer < 1.85)) {
        boss.vx = 0;
        const count = boss.phase === 1 ? 6 : boss.phase === 2 ? 8 : 10;
        spawnRadialBurst(
          state,
          'thorn',
          boss.x + boss.width * 0.5,
          bounds.floorY + 0.6,
          count,
          6.5 * speedScale,
          0.26,
          2.6,
          0.12,
          Math.PI - 0.24,
        );
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.25);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.26);
        events.push({ type: 'stomp_impact', x: bx, y: bounds.floorY, explosive: false });
        boss.state = 'recover';
        boss.stateTimer = 1.1 / speedScale;
      }
      break;
    }

    case 'charge_stomp': {
      const res = stepGroundedBossPhysics(boss, bounds, dt);
      if (res.hitWall !== 0 || boss.stateTimer <= 0) {
        boss.vx = 0;
        spawnBossProjectile(state, 'thorn', bx, bounds.floorY + 0.5, -7.2 * speedScale, 1.2, 0.26, 2.4);
        spawnBossProjectile(state, 'thorn', bx, bounds.floorY + 0.5, 7.2 * speedScale, 1.2, 0.26, 2.4);
        events.push({ type: 'stomp_impact', x: bx, y: bounds.floorY, explosive: false });
        boss.state = 'recover';
        boss.stateTimer = 1.0 / speedScale;
      }
      break;
    }

    case 'recover':
    default: {
      boss.vx *= 0.8;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'stalk';
        boss.stateTimer = 0.7 / speedScale;
      }
      break;
    }
  }
}

function stepMechaBull(
  state: SimState,
  boss: BossRuntime,
  bounds: ArenaBounds,
  hx: number,
  hy: number,
  dt: number,
  events: SimEvent[],
): void {
  const bx = boss.x + boss.width * 0.5;
  const by = boss.y + boss.height * 0.5;
  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.25 : 1.5;

  switch (boss.state) {
    case 'stalk': {
      boss.shieldActive = false;
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = Math.abs(hx - bx) > 2.4 ? boss.facing * 2.2 * speedScale : 0;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.45 / speedScale;
        boss.vx = 0;
      }
      break;
    }

    case 'telegraph': {
      // Pre-drill rev-up telegraph
      boss.shieldActive = false;
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = 0;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        const pattern = boss.attackIndex % 3;
        boss.attackIndex += 1;
        if (pattern === 0) {
          // Signature armored drill charge -> crashes into arena wall -> STUNNED!
          boss.state = 'drill_charge';
          boss.shieldActive = true;
          boss.stateTimer = 2.4;
          boss.vx = boss.facing * (12.5 + boss.phase * 1.6);
        } else if (pattern === 1) {
          boss.state = 'gear_volley';
          boss.shieldActive = false;
          boss.stateTimer = 0.55;
          const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
          const baseAng =
            Math.abs(hx - bx) > 1.8
              ? Math.atan2(hy - by, hx - bx)
              : boss.facing > 0
                ? 0.25
                : Math.PI - 0.25;
          const launchX = bx + boss.facing * (boss.width * 0.35);
          const launchY = by + 0.45;
          for (let k = 0; k < count; k++) {
            const offset = (k - (count - 1) * 0.5) * 0.24;
            const ang = baseAng + offset;
            const spd = 7.2 * speedScale;
            spawnBossProjectile(
              state,
              'gear',
              launchX,
              launchY,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              0.28,
              3.0,
            );
          }
        } else {
          boss.state = 'heavy_jump';
          boss.shieldActive = false;
          boss.stateTimer = 2.0;
          const dx = Math.max(-9.0, Math.min(9.0, hx - bx));
          boss.vx = dx * 1.05;
          boss.vy = 13.0 + boss.phase * 0.8;
        }
      }
      break;
    }

    case 'drill_charge': {
      boss.shieldActive = true;
      boss.vx = boss.facing * (12.5 + boss.phase * 1.6);
      const res = stepGroundedBossPhysics(boss, bounds, dt);
      if (res.hitWall !== 0 || boss.stateTimer <= 0) {
        // Wall crash! Stunned & shield shattered -> open vulnerability window!
        boss.state = 'stunned';
        boss.shieldActive = false;
        boss.stateTimer = 1.6;
        boss.vx = -boss.facing * 2.5;
        boss.vy = 3.5;
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.3);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.3);
        events.push({ type: 'stomp_impact', x: bx, y: by, explosive: true });
      }
      break;
    }

    case 'stunned': {
      boss.shieldActive = false;
      boss.vx *= 0.86;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'stalk';
        boss.stateTimer = 0.55 / speedScale;
      }
      break;
    }

    case 'heavy_jump': {
      const res = stepGroundedBossPhysics(boss, bounds, dt, 0.8);
      if (res.landed || (boss.y <= bounds.floorY + 0.02 && boss.stateTimer < 1.85)) {
        boss.vx = 0;
        spawnGroundShockwaves(state, boss.x + boss.width * 0.5, bounds.floorY, 8.0 * speedScale);
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.22);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.24);
        events.push({ type: 'stomp_impact', x: bx, y: bounds.floorY, explosive: false });
        boss.state = 'stalk';
        boss.stateTimer = 0.8 / speedScale;
      }
      break;
    }

    case 'gear_volley':
    default: {
      boss.vx *= 0.85;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'stalk';
        boss.stateTimer = 0.8 / speedScale;
      }
      break;
    }
  }
}

function stepElectroSphinx(
  state: SimState,
  boss: BossRuntime,
  bounds: ArenaBounds,
  hx: number,
  hy: number,
  dt: number,
  events: SimEvent[],
): void {
  const bx = boss.x + boss.width * 0.5;
  const by = boss.y + boss.height * 0.5;
  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.25 : 1.5;

  switch (boss.state) {
    case 'hover': {
      boss.shieldActive = false;
      const targetX = bounds.centerX + Math.sin(state.tick * 0.035 * speedScale) * ((bounds.maxX - bounds.minX) * 0.35);
      const targetY = Math.min(bounds.maxY, bounds.floorY + 4.4 + Math.cos(state.tick * 0.05) * 0.8);
      boss.vx = (targetX - boss.x) * 2.8;
      boss.vy = (targetY - boss.y) * 2.8;
      boss.x = Math.max(bounds.minX, Math.min(bounds.maxX, boss.x + boss.vx * dt));
      boss.y = Math.max(bounds.floorY + 0.8, Math.min(bounds.maxY, boss.y + boss.vy * dt));
      boss.laserAngle = Math.atan2(hy - by, hx - bx);

      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.5 / speedScale;
      }
      break;
    }

    case 'telegraph': {
      boss.vx *= 0.85;
      boss.vy *= 0.85;
      boss.laserAngle = Math.atan2(hy - by, hx - bx);
      if (boss.stateTimer <= 0) {
        const pattern = boss.attackIndex % 4;
        boss.attackIndex += 1;
        if (pattern === 0) {
          boss.state = 'paw_slam';
          boss.stateTimer = 1.4;
          boss.vx = (hx - bx) * 0.8;
          boss.vy = -12.0;
        } else if (pattern === 1) {
          // 90-degree sweeping plasma laser!
          boss.state = 'laser';
          boss.stateTimer = 1.2;
          boss.vx = 0;
          boss.vy = 0;
          boss.laserAngle = -Math.PI * 0.75; // Sweeps +90 deg (-3pi/4 -> -pi/4)
        } else if (pattern === 2) {
          boss.state = 'plasma_burst';
          boss.stateTimer = 0.65;
          const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
          const baseAng = Math.atan2(hy - by, hx - bx);
          for (let k = 0; k < count; k++) {
            const ang = baseAng + (k - (count - 1) * 0.5) * 0.2;
            const spd = 7.6 * speedScale;
            spawnBossProjectile(state, 'plasma', bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.25, 2.8);
          }
        } else {
          // Energized gem counterattack
          boss.state = 'gem_counter';
          boss.shieldActive = true;
          boss.stateTimer = 0.65;
          boss.vx = 0;
          boss.vy = 0;
        }
      }
      break;
    }

    case 'paw_slam': {
      boss.x = Math.max(bounds.minX, Math.min(bounds.maxX, boss.x + boss.vx * dt));
      boss.y += boss.vy * dt;
      if (boss.y <= bounds.floorY) {
        boss.y = bounds.floorY;
        boss.vx = 0;
        boss.vy = 0;
        spawnGroundShockwaves(state, boss.x + boss.width * 0.5, bounds.floorY, 9.0 * speedScale);
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.22);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.24);
        events.push({ type: 'stomp_impact', x: bx, y: bounds.floorY, explosive: false });
        boss.state = 'vulnerable';
        boss.stateTimer = 1.05;
      }
      break;
    }

    case 'laser': {
      boss.vx = 0;
      boss.vy = 0;
      // Smooth 90-degree (PI/2) sweep across 1.2s
      boss.laserAngle += ((Math.PI * 0.5) / 1.2) * dt;
      checkBossLaserHit(state, boss, bx, by, events);
      if (boss.stateTimer <= 0) {
        boss.state = 'vulnerable';
        boss.stateTimer = 1.0;
      }
      break;
    }

    case 'gem_counter': {
      boss.shieldActive = true;
      if (boss.stateTimer <= 0) {
        boss.shieldActive = false;
        const count = boss.phase === 1 ? 6 : boss.phase === 2 ? 8 : 10;
        spawnRadialBurst(state, 'plasma', bx, by, count, 6.8 * speedScale, 0.25, 2.6);
        boss.state = 'vulnerable';
        boss.stateTimer = 1.1;
      }
      break;
    }

    case 'plasma_burst': {
      if (boss.stateTimer <= 0) {
        boss.state = 'hover';
        boss.stateTimer = 0.9 / speedScale;
      }
      break;
    }

    case 'vulnerable':
    default: {
      boss.shieldActive = false;
      const restY = Math.max(bounds.floorY + 0.5, bounds.floorY + 1.4);
      boss.y += (restY - boss.y) * Math.min(1, 3.8 * dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'hover';
        boss.stateTimer = 0.95 / speedScale;
      }
      break;
    }
  }
}

function stepShadowDoppelganger(
  state: SimState,
  boss: BossRuntime,
  bounds: ArenaBounds,
  hx: number,
  hy: number,
  dt: number,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const bx = boss.x + boss.width * 0.5;
  const by = boss.y + boss.height * 0.5;
  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.2 : 1.42;

  switch (boss.state) {
    case 'stalk':
    case 'sprint': {
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = boss.facing * (6.8 * speedScale);
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.32 / speedScale;
        boss.vx = 0;
      }
      break;
    }

    case 'telegraph': {
      boss.facing = hx >= bx ? 1 : -1;
      boss.vx = 0;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        const pattern = boss.attackIndex % 4;
        boss.attackIndex += 1;
        if (pattern === 0) {
          // Mirrors Krunk's acrobatic jump + air stomp shockwave!
          boss.state = 'acro_jump';
          boss.stateTimer = 0.45;
          const dx = Math.max(-9.0, Math.min(9.0, hx - bx));
          boss.vx = dx * 1.6;
          boss.vy = 14.0;
        } else if (pattern === 1) {
          // Blazing horizontal shadow dash!
          boss.state = 'shadow_dash';
          boss.stateTimer = 0.48;
          boss.vx = boss.facing * 15.0 * speedScale;
          boss.vy = 0;
          events.push({ type: 'dash', x: bx, y: by, kind: 'shadow' });
        } else if (pattern === 2) {
          // Dark orb volley!
          boss.state = 'dark_volley';
          boss.stateTimer = 0.55;
          boss.vx = -boss.facing * 4.0;
          boss.vy = 6.5;
          const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
          const baseAng = Math.atan2(hy - by, hx - bx);
          for (let k = 0; k < count; k++) {
            const ang = baseAng + (k - (count - 1) * 0.5) * 0.22;
            const spd = 7.4 * speedScale;
            spawnBossProjectile(state, 'dark_orb', bx, by, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.25, 2.8);
          }
        } else {
          // Blink directly behind the hero!
          const targetX = Math.max(
            bounds.minX,
            Math.min(bounds.maxX, hero.x - hero.facing * 2.2),
          );
          boss.x = targetX;
          boss.y = Math.max(bounds.floorY, Math.min(bounds.maxY, hero.y));
          boss.prevX = boss.x;
          boss.prevY = boss.y;
          boss.facing = hero.x >= boss.x ? 1 : -1;
          boss.vx = 0;
          boss.vy = 0;
          events.push({ type: 'dash', x: boss.x + boss.width * 0.5, y: boss.y + boss.height * 0.5, kind: 'shadow' });
          const nbx = boss.x + boss.width * 0.5;
          const nby = boss.y + boss.height * 0.5;
          const ang = Math.atan2(hy - nby, hx - nbx);
          spawnBossProjectile(state, 'dark_orb', nbx, nby, Math.cos(ang) * 7.8, Math.sin(ang) * 7.8, 0.25, 2.5);
          boss.state = 'recover';
          boss.stateTimer = 0.75 / speedScale;
        }
      }
      break;
    }

    case 'acro_jump': {
      stepGroundedBossPhysics(boss, bounds, dt, 0.7);
      if (boss.stateTimer <= 0 || boss.vy <= 0) {
        boss.state = 'air_stomp';
        boss.stateTimer = 1.2;
        boss.vx = 0;
        boss.vy = -17.5;
        events.push({ type: 'stomp_start', x: bx, y: by });
      }
      break;
    }

    case 'air_stomp': {
      boss.vy = -17.5;
      const res = stepGroundedBossPhysics(boss, bounds, dt, 0);
      if (res.landed || boss.y <= bounds.floorY + 0.02) {
        boss.y = bounds.floorY;
        boss.vy = 0;
        spawnGroundShockwaves(state, boss.x + boss.width * 0.5, bounds.floorY, 10.5 * speedScale);
        state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.2);
        state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.22);
        events.push({ type: 'stomp_impact', x: boss.x + boss.width * 0.5, y: bounds.floorY, explosive: true });
        boss.state = 'recover';
        boss.stateTimer = 0.9 / speedScale;
      }
      break;
    }

    case 'shadow_dash': {
      boss.x = Math.max(bounds.minX, Math.min(bounds.maxX, boss.x + boss.vx * dt));
      if (boss.stateTimer <= 0 || boss.x <= bounds.minX + 0.05 || boss.x >= bounds.maxX - 0.05) {
        boss.vx = 0;
        boss.state = 'recover';
        boss.stateTimer = 0.75 / speedScale;
      }
      break;
    }

    case 'dark_volley': {
      stepGroundedBossPhysics(boss, bounds, dt, 0.75);
      if (boss.stateTimer <= 0) {
        boss.state = 'sprint';
        boss.stateTimer = 0.75 / speedScale;
      }
      break;
    }

    case 'recover':
    default: {
      boss.vx *= 0.82;
      stepGroundedBossPhysics(boss, bounds, dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'sprint';
        boss.stateTimer = 0.75 / speedScale;
      }
      break;
    }
  }
}

function stepNightmareSovereign(
  state: SimState,
  boss: BossRuntime,
  bounds: ArenaBounds,
  hx: number,
  hy: number,
  dt: number,
  _events: SimEvent[],
): void {
  const bx = boss.x + boss.width * 0.5;
  const by = boss.y + boss.height * 0.5;
  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.25 : 1.5;

  // Keep arenaMorphPhase synced cleanly with boss phase (1 -> 2 -> 3)
  if (boss.arenaMorphPhase < boss.phase) {
    boss.arenaMorphPhase = boss.phase;
  }

  switch (boss.state) {
    case 'hover': {
      boss.shieldActive = false;
      const targetX = bounds.centerX + Math.sin(state.tick * 0.04 * speedScale) * ((bounds.maxX - bounds.minX) * 0.38);
      const targetY = Math.min(bounds.maxY, bounds.floorY + 4.4 + Math.cos(state.tick * 0.055) * 1.1);
      boss.vx = (targetX - boss.x) * 2.8;
      boss.vy = (targetY - boss.y) * 2.8;
      boss.x = Math.max(bounds.minX, Math.min(bounds.maxX, boss.x + boss.vx * dt));
      boss.y = Math.max(bounds.floorY + 0.8, Math.min(bounds.maxY, boss.y + boss.vy * dt));

      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.36 / speedScale;
      }
      break;
    }

    case 'telegraph': {
      boss.vx *= 0.85;
      boss.vy *= 0.85;
      if (boss.stateTimer <= 0) {
        const pattern = boss.attackIndex % 4;
        boss.attackIndex += 1;
        if (pattern === 0) {
          // Alternating shield phase (shatterable with heavy attack OR drops after window)
          boss.state = 'shield_phase';
          boss.shieldActive = true;
          boss.stateTimer = 1.15;
          boss.vx = 0;
          boss.vy = 0;
          // Emit medium orbs while raising shield
          spawnRadialBurst(state, 'dark_orb', bx, by, 4 + boss.phase * 2, 5.4 * speedScale, 0.24, 3.0);
        } else if (pattern === 1) {
          // Curved / line swoop dash across the throne room
          boss.state = 'swoop_dash';
          boss.shieldActive = false;
          boss.stateTimer = 0.9;
          const dir = hx >= bx ? 1 : -1;
          boss.vx = dir * 10.6 * speedScale;
          boss.vy = -4.2;
        } else if (pattern === 2) {
          // Mixed big + medium dark_orb volley
          boss.state = 'orb_volley';
          boss.shieldActive = false;
          boss.stateTimer = 0.55;
          const count = boss.phase === 1 ? 4 : boss.phase === 2 ? 6 : 8;
          const baseAng = Math.atan2(hy - by, hx - bx);
          for (let k = 0; k < count; k++) {
            const ang = baseAng + (k - (count - 1) * 0.5) * 0.24;
            const isBig = k % 2 === 0;
            const spd = (isBig ? 5.6 : 7.4) * speedScale;
            spawnBossProjectile(
              state,
              'dark_orb',
              bx,
              by,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              isBig ? 0.36 : 0.24,
              3.2,
            );
          }
        } else {
          // Homing missile salvo!
          boss.state = 'missile_salvo';
          boss.shieldActive = false;
          boss.stateTimer = 0.6;
          const count = boss.phase === 1 ? 2 : boss.phase === 2 ? 3 : 4;
          for (let k = 0; k < count; k++) {
            const ang = Math.PI * 0.25 + (k / Math.max(1, count - 1)) * (Math.PI * 0.5);
            const spd = 5.4 * speedScale;
            spawnBossProjectile(
              state,
              'missile',
              bx,
              by + 0.4,
              Math.cos(ang) * spd,
              Math.sin(ang) * spd,
              0.26,
              3.8,
              true, // Homing!
            );
          }
        }
      }
      break;
    }

    case 'shield_phase': {
      boss.shieldActive = true;
      boss.y += Math.sin(state.tick * 0.12) * 0.8 * dt;
      boss.y = Math.max(bounds.floorY + 1.0, Math.min(bounds.maxY, boss.y));
      if (boss.stateTimer <= 0) {
        boss.shieldActive = false;
        boss.state = 'vulnerable';
        boss.stateTimer = 0.95;
      }
      break;
    }

    case 'swoop_dash': {
      // Curved swoop across arena (dips low then climbs back up)
      boss.vy = Math.sin((0.9 - boss.stateTimer) * Math.PI * 1.5 - 0.6) * 5.8;
      boss.x = Math.max(bounds.minX, Math.min(bounds.maxX, boss.x + boss.vx * dt));
      boss.y = Math.max(bounds.floorY + 0.4, Math.min(bounds.maxY, boss.y + boss.vy * dt));
      if (boss.x <= bounds.minX + 0.05 || boss.x >= bounds.maxX - 0.05) {
        boss.vx = -boss.vx;
      }
      if (boss.stateTimer <= 0) {
        boss.vx = 0;
        boss.vy = 0;
        boss.state = 'vulnerable';
        boss.stateTimer = 0.85;
      }
      break;
    }

    case 'orb_volley':
    case 'missile_salvo': {
      boss.vx *= 0.9;
      boss.vy *= 0.9;
      if (boss.stateTimer <= 0) {
        boss.state = 'hover';
        boss.stateTimer = 0.68 / speedScale;
      }
      break;
    }

    case 'vulnerable':
    default: {
      boss.shieldActive = false;
      const restY = Math.max(bounds.floorY + 0.8, Math.min(bounds.maxY, bounds.floorY + 1.8));
      boss.y += (restY - boss.y) * Math.min(1, 3.8 * dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'hover';
        boss.stateTimer = 0.68 / speedScale;
      }
      break;
    }
  }
}

// ============================================================================
// Main Boss Update + Combat Entry Point
// ============================================================================

export function updateBossAndCombat(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  input: InputFrame,
  dt: number,
  explosions: BlastCircle[],
  completedVoltTargetId: string | null,
  events: SimEvent[],
): void {
  const boss = state.boss;
  if (!boss || boss.defeated) return;

  // Apply blast / evil ring explosions to boss
  for (let b = 0; b < explosions.length; b++) {
    const blast = explosions[b];
    const r2 = blast.radius * blast.radius;
    const bx = boss.x + boss.width * 0.5;
    const by = boss.y + boss.height * 0.5;
    if ((bx - blast.x) * (bx - blast.x) + (by - blast.y) * (by - blast.y) <= r2) {
      damageBoss(state, boss, 2, catalog, room, events, true);
      if (boss.defeated) return;
    }
  }

  // Apply completed Volt Blink hit on boss
  if (completedVoltTargetId && boss.id === completedVoltTargetId) {
    damageBoss(state, boss, 2, catalog, room, events, true);
    if (boss.defeated) return;
  }

  boss.prevX = boss.x;
  boss.prevY = boss.y;
  if (boss.invulnTimer > 0) boss.invulnTimer = Math.max(0, boss.invulnTimer - dt);
  if (boss.hitFlashTimer > 0) boss.hitFlashTimer = Math.max(0, boss.hitFlashTimer - dt);
  boss.stateTimer -= dt;

  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;
  const bx = boss.x + boss.width * 0.5;
  const bounds = findArenaBounds(state, room, boss);

  // Dispatch to bespoke boss state machine
  switch (boss.id) {
    case 'dino_behemoth':
      stepDinoBehemoth(state, boss, bounds, hx, dt, events);
      break;
    case 'primal_eye':
      stepPrimalEye(state, boss, bounds, hx, hy, dt, events);
      break;
    case 'magma_boar_king':
      stepMagmaBoarKing(state, boss, bounds, hx, dt, events);
      break;
    case 'bone_colossus':
      stepBoneColossus(state, boss, bounds, hx, dt, events);
      break;
    case 'mecha_bull':
      stepMechaBull(state, boss, bounds, hx, hy, dt, events);
      break;
    case 'electro_sphinx':
      stepElectroSphinx(state, boss, bounds, hx, hy, dt, events);
      break;
    case 'shadow_doppelganger':
      stepShadowDoppelganger(state, boss, bounds, hx, hy, dt, events);
      break;
    case 'nightmare_sovereign':
      stepNightmareSovereign(state, boss, bounds, hx, hy, dt, events);
      break;
    default: {
      const _exhaustive: never = boss.id;
      void _exhaustive;
      break;
    }
  }

  if (boss.defeated) return;

  // Hero <-> Boss combat overlap
  if (
    hero.action !== 'dead' &&
    aabbOverlap(hero.x, hero.y, hero.width, hero.height, boss.x, boss.y, boss.width, boss.height)
  ) {
    const isAirStomp = hero.action === 'air_stomp';
    const isFireDash = hero.action === 'fire_dash';
    const isRockUppercut = hero.action === 'rock_uppercut';
    const isVoltBlink = hero.action === 'volt_blink';
    const isShadowBlink = hero.action === 'shadow_blink';
    const isDashTackle = hero.action === 'ground_dash' || hero.action === 'wall_dash';
    const isTopBounce = hero.vy <= 0.5 && hero.prevY >= boss.y + boss.height * 0.35;
    const isHeavy = isAirStomp || isFireDash || isRockUppercut || isVoltBlink || isShadowBlink;

    if (boss.shieldActive) {
      if (isHeavy && boss.id === 'nightmare_sovereign') {
        damageBoss(state, boss, 2, catalog, room, events, true);
        applyHeroAttackBounce(state, isAirStomp, isFireDash, isVoltBlink, input);
      } else if (isTopBounce || isHeavy) {
        // Deflect hero upward safely off shield (or punish head-on drill hit if non-top)
        if (boss.id === 'mecha_bull' && boss.state === 'drill_charge' && !isTopBounce) {
          damageHero(state, 1, bx, events, 'enemy');
        } else {
          applyHeroAttackBounce(state, false, isFireDash, isVoltBlink, input);
        }
      } else if (hero.lastEnemyHitTimer <= 0) {
        damageHero(state, 1, bx, events, 'enemy');
      }
    } else if (isHeavy) {
      damageBoss(state, boss, 2, catalog, room, events, true);
      applyHeroAttackBounce(state, isAirStomp, isFireDash, isVoltBlink, input);
    } else if (isDashTackle || isTopBounce) {
      damageBoss(state, boss, 1, catalog, room, events, false);
      applyHeroAttackBounce(state, false, false, false, input);
    } else if (hero.lastEnemyHitTimer <= 0) {
      const dmgRes = damageHero(state, 1, bx, events, 'enemy');
      if (dmgRes.evilRingTriggered) {
        damageBoss(state, boss, 2, catalog, room, events, true);
      }
    }
  }
}
