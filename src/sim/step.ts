import {
  TileCode,
  type BossDef,
  type BossId,
  type BossRuntime,
  type CoinRuntime,
  type CrystalDropRuntime,
  type EnemyArchetypeDef,
  type EnemyArchetypeId,
  type EnemyRuntime,
  type GameMode,
  type HeroState,
  type InputFrame,
  type ISimEngine,
  type IWorldCatalog,
  type MovingPlatformRuntime,
  type ProgressState,
  type RelicId,
  type RoomDef,
  type SimEvent,
  type SimState,
  type UpgradeKey,
} from '../contracts/index';
import { snapCameraToHero, updateCamera } from './camera';
import {
  aabbOverlap,
  breakTilesInRadius,
  getTileAt,
  isSolidTile,
  isTileSolidOrOneWayAt,
  type BlastCircle,
} from './collision';
import { initRoomCombo, registerComboCrystal, registerComboEnemyHit, tickCombo } from './combo';
import {
  FIXED_DT,
  FORM_PARAMS,
  PHYSICS,
  SIM_RULES,
  computeMaxAirJumps,
  computeMaxHp,
  computeMaxRelicSlots,
  createEmptyUpgradeLevels,
  getUpgradeLevel,
  hasRelic,
} from './constants';
import { switchHeroForm } from './forms';
import { hashState } from './hash';
import { computeEnemyBounceVy, damageHero, stepHeroPhysics } from './physics';
import { nextInt, nextRange } from './prng';

const FALLBACK_ENEMY_DEF: EnemyArchetypeDef = {
  id: 'goomba',
  name: 'Prowler',
  hp: 1,
  width: 0.8,
  height: 0.8,
  speed: 2.2,
  flying: false,
  armoredTop: false,
  shoots: false,
  shootCooldown: 2.5,
  crystalValue: 10,
  primaryColor: '#d95763',
  accentColor: '#fbf236',
};

const GHOST_SHIP_ENEMY_POOL: readonly EnemyArchetypeId[] = [
  'ghost_crow',
  'ghost_owl',
  'ghost_pig',
  'goomba',
  'air_goomba',
  'spitter',
  'horned_beetle',
  'bee',
];

function createDefaultProgress(partial?: Partial<ProgressState>): ProgressState {
  const upgradeLevels = createEmptyUpgradeLevels();
  if (partial?.upgradeLevels) {
    const keys = Object.keys(partial.upgradeLevels) as UpgradeKey[];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const val = partial.upgradeLevels[k];
      if (typeof val === 'number') {
        upgradeLevels[k] = val;
      }
    }
  }

  return {
    crystals: partial?.crystals ?? 0,
    collectedCoinIds: partial?.collectedCoinIds ? [...partial.collectedCoinIds] : [],
    unlockedForms:
      partial?.unlockedForms && partial.unlockedForms.length > 0
        ? [...partial.unlockedForms]
        : ['krunk_basic'],
    upgradeLevels,
    ownedRelics: partial?.ownedRelics ? [...partial.ownedRelics] : [],
    equippedRelics: partial?.equippedRelics ? [...partial.equippedRelics] : [],
    defeatedBosses: partial?.defeatedBosses ? [...partial.defeatedBosses] : [],
    visitedRooms: partial?.visitedRooms ? [...partial.visitedRooms] : [],
    unlockedTeleporters: partial?.unlockedTeleporters ? [...partial.unlockedTeleporters] : [],
    rescuedAnimals: partial?.rescuedAnimals ? [...partial.rescuedAnimals] : [],
    clearedComboRooms: partial?.clearedComboRooms ? [...partial.clearedComboRooms] : [],
    openedChests: partial?.openedChests ? [...partial.openedChests] : [],
    ghostShipBestWave: partial?.ghostShipBestWave ?? 0,
    ghostShipHighScore: partial?.ghostShipHighScore ?? 0,
    bestTimeAttackTicks: partial?.bestTimeAttackTicks ?? null,
  };
}

function createInitialHero(x: number, y: number, maxHp: number, maxAirJumps: number, hasRockShield: boolean): HeroState {
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    width: PHYSICS.HERO_W,
    height: PHYSICS.HERO_H,
    facing: 1,
    form: 'krunk_basic',
    action: 'idle',
    hp: maxHp,
    maxHp,
    grounded: false,
    onWall: 0,
    onVine: false,
    inQuicksand: false,
    inAntigrav: false,
    inWindY: 0,
    inWindX: 0,
    jumpsRemaining: maxAirJumps,
    maxAirJumps,
    coyoteTimer: 0,
    preJumpTimer: 0,
    jumpHoldTimer: 0,
    wallJumpTimer: 0,
    wallJumpHoldTimer: 0,
    wallStickLockTimer: 0,
    wallReleaseTimer: 0,
    wallRestickTimer: 0,
    preDashTimer: 0,
    groundDashTimer: 0,
    wallDashTimer: 0,
    stompDelayTimer: 0,
    lastEnemyHitTimer: 0,
    invulnTimer: 0,
    recoilTimer: 0,
    abilityTimer: 0,
    abilityPhase: 0,
    abilityUsedInAir: false,
    voltTargetX: 0,
    voltTargetY: 0,
    voltTargetId: null,
    rockShieldActive: hasRockShield,
    magicShieldTimer: 0,
    rebirthUsed: false,
    platinumShieldUsed: false,
    scaleX: 1,
    scaleY: 1,
    hitFlashTimer: 0,
    animTimer: 0,
    dashRingAngle: 0,
  };
}

function getEnemyDef(catalog: IWorldCatalog, id: EnemyArchetypeId): EnemyArchetypeDef {
  return catalog.enemies.get(id) ?? FALLBACK_ENEMY_DEF;
}

function createBossRuntime(bossDef: BossDef, room: RoomDef): BossRuntime {
  const bx = Math.max(2, Math.min(room.widthTiles - bossDef.width - 2, room.widthTiles * 0.65));
  const by = Math.max(2.5, Math.min(room.heightTiles - bossDef.height - 2, room.heightTiles * 0.5));
  return {
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
    state: 'hover',
    stateTimer: 1.0,
    attackIndex: 0,
    invulnTimer: 0,
    hitFlashTimer: 0,
    shieldActive: false,
    laserAngle: 0,
    defeated: false,
    arenaMorphPhase: 0,
  };
}

function spawnRoomEntities(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  forceBossId?: BossId,
): void {
  state.roomTiles = new Uint8Array(room.tiles);
  state.crumbleTimers = {};
  state.openedDoors = [];
  state.projectiles = [];
  state.lavaY = room.risingLava ? 0.5 : -10;
  state.activeShopPrompt = null;
  state.activeSignText = null;

  // Enemies
  const enemies: EnemyRuntime[] = [];
  for (let i = 0; i < room.enemies.length; i++) {
    const sp = room.enemies[i];
    const def = getEnemyDef(catalog, sp.archetype);
    const minX = sp.patrolMinX ?? Math.max(1, sp.x - 3);
    const maxX = sp.patrolMaxX ?? Math.min(room.widthTiles - 1 - def.width, sp.x + 3);
    enemies.push({
      id: sp.id,
      archetype: sp.archetype,
      x: sp.x,
      y: sp.y,
      prevX: sp.x,
      prevY: sp.y,
      vx: 0,
      vy: 0,
      width: def.width,
      height: def.height,
      facing: -1,
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
      patrolMinX: minX,
      patrolMaxX: maxX,
      aiTimer: 0,
      shootTimer: def.shoots ? def.shootCooldown * 0.6 : 99,
      hitFlashTimer: 0,
      stunTimer: 0,
      grounded: false,
    });
  }
  state.enemies = enemies;

  // Boss
  const bossId = forceBossId ?? room.bossId;
  if (
    bossId &&
    (forceBossId !== undefined ||
      state.mode === 'boss_rush' ||
      !state.progress.defeatedBosses.includes(bossId))
  ) {
    const bossDef = catalog.bosses.get(bossId);
    state.boss = bossDef ? createBossRuntime(bossDef, room) : null;
  } else {
    state.boss = null;
  }

  // Coins
  const coins: CoinRuntime[] = [];
  for (let i = 0; i < room.coins.length; i++) {
    const c = room.coins[i];
    coins.push({
      id: c.id,
      x: c.x,
      y: c.y,
      kind: c.kind,
      collected: state.progress.collectedCoinIds.includes(c.id),
    });
  }
  state.coins = coins;

  // Crystals
  const crystals: CrystalDropRuntime[] = [];
  for (let i = 0; i < room.crystals.length; i++) {
    const cr = room.crystals[i];
    crystals.push({
      id: cr.id,
      x: cr.x,
      y: cr.y,
      vx: 0,
      vy: 0,
      value: cr.value,
      collected: false,
      ttl: -1,
    });
  }
  state.crystals = crystals;

  // Moving platforms / crushers / spinning platforms
  const platforms: MovingPlatformRuntime[] = [];
  for (let i = 0; i < room.props.length; i++) {
    const p = room.props[i];
    if (p.kind === 'moving_platform' || p.kind === 'crusher' || p.kind === 'spinning_platform') {
      platforms.push({
        id: p.id,
        kind: p.kind,
        baseX: p.x,
        baseY: p.y,
        x: p.x,
        y: p.y,
        prevX: p.x,
        prevY: p.y,
        width: p.width ?? 2,
        height: p.height ?? 0.5,
        moveDx: p.moveDx ?? 0,
        moveDy: p.moveDy ?? 0,
        periodSec: Math.max(0.5, p.periodSec ?? 3.0),
        phase: 0,
        solid: true,
      });
    }
  }
  state.platforms = platforms;

  initRoomCombo(state, room);
}

function loadRoomIntoState(
  state: SimState,
  catalog: IWorldCatalog,
  roomId: string,
  spawnX?: number,
  spawnY?: number,
  forceBossId?: BossId,
): SimEvent[] {
  const fromRoomId = state.roomId;
  const room = catalog.rooms.get(roomId) ?? catalog.getRoom(catalog.startRoomId);

  state.roomId = room.id;
  state.biome = room.biome;

  const sx = spawnX ?? room.defaultSpawnX;
  const sy = spawnY ?? room.defaultSpawnY;

  const hero = state.hero;
  hero.x = sx;
  hero.y = sy;
  hero.prevX = sx;
  hero.prevY = sy;
  hero.vx = 0;
  hero.vy = 0;
  hero.grounded = false;
  hero.onWall = 0;
  hero.onVine = false;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.groundDashTimer = 0;
  hero.wallDashTimer = 0;
  hero.stompDelayTimer = 0;
  hero.recoilTimer = 0;
  hero.abilityTimer = 0;
  hero.abilityPhase = 0;
  hero.abilityUsedInAir = false;
  hero.voltTargetId = null;
  hero.platinumShieldUsed = false;
  hero.maxHp = computeMaxHp(state);
  hero.maxAirJumps = computeMaxAirJumps(state);
  hero.jumpsRemaining = hero.maxAirJumps;

  if (getUpgradeLevel(state, 'RockShield') > 0) {
    hero.rockShieldActive = true;
  }

  if (hero.action === 'dead' || hero.hp <= 0) {
    hero.hp = hero.maxHp;
    hero.action = 'idle';
    hero.rebirthUsed = false;
    state.gameOverTriggered = false;
  } else {
    hero.action = 'idle';
  }

  if (!state.progress.visitedRooms.includes(room.id)) {
    state.progress.visitedRooms.push(room.id);
  }

  spawnRoomEntities(state, room, catalog, forceBossId);
  snapCameraToHero(state, room);

  return [{ type: 'room_change', fromRoomId, toRoomId: room.id, biome: room.biome }];
}

function spawnCrystalDrops(
  state: SimState,
  x: number,
  y: number,
  totalValue: number,
  count = 2,
): void {
  const perDrop = Math.max(1, Math.round(totalValue / Math.max(1, count)));
  for (let i = 0; i < count; i++) {
    state.crystals.push({
      id: `drop_${state.tick}_${state.nextProjectileId++}`,
      x,
      y,
      vx: nextRange(state, -3.2, 3.2),
      vy: nextRange(state, 4.5, 8.0),
      value: perDrop,
      collected: false,
      ttl: 12.0,
    });
  }
}

function awardCrystals(state: SimState, rawAmount: number): number {
  let mult = 1.0;
  if (state.hero.form === 'krunk_basic' && getUpgradeLevel(state, 'CrystallineHunger') > 0) {
    mult *= SIM_RULES.CRYSTALLINE_HUNGER_MULT;
  }
  if (hasRelic(state, 'crystal_abundance')) {
    mult *= SIM_RULES.CRYSTAL_ABUNDANCE_MULT;
  }
  if (state.combo.count > 0 && hasRelic(state, 'platinum_medal')) {
    mult *= SIM_RULES.PLATINUM_MEDAL_CRYSTAL_MULT;
  }
  const finalAmount = Math.max(1, Math.round(rawAmount * mult));
  state.progress.crystals += finalAmount;
  return finalAmount;
}

function updateCrumbleTiles(state: SimState, room: RoomDef, dt: number, events: SimEvent[]): void {
  const keys = Object.keys(state.crumbleTimers);
  for (let i = 0; i < keys.length; i++) {
    const idx = Number(keys[i]);
    const timer = state.crumbleTimers[idx];
    if (timer === undefined) continue;

    if (timer > 0) {
      const next = timer - dt;
      if (next <= 0) {
        state.roomTiles[idx] = TileCode.Empty;
        state.crumbleTimers[idx] = -SIM_RULES.CRUMBLE_RESPAWN_TIME;
        const tx = idx % room.widthTiles;
        const ty = Math.floor(idx / room.widthTiles);
        events.push({ type: 'block_break', x: tx + 0.5, y: ty + 0.5, explosive: false });
      } else {
        state.crumbleTimers[idx] = next;
      }
    } else {
      const next = timer + dt;
      if (next >= 0) {
        const tx = idx % room.widthTiles;
        const ty = Math.floor(idx / room.widthTiles);
        const hero = state.hero;
        if (!aabbOverlap(hero.x, hero.y, hero.width, hero.height, tx, ty, 1, 1)) {
          state.roomTiles[idx] = TileCode.Crumble;
          delete state.crumbleTimers[idx];
        }
      } else {
        state.crumbleTimers[idx] = next;
      }
    }
  }
}

function updateMovingPlatforms(state: SimState, dt: number): void {
  for (let i = 0; i < state.platforms.length; i++) {
    const p = state.platforms[i];
    p.prevX = p.x;
    p.prevY = p.y;
    p.phase = (p.phase + (Math.PI * 2 * dt) / p.periodSec) % (Math.PI * 2);

    if (p.kind === 'spinning_platform') {
      p.x = p.baseX + Math.cos(p.phase) * p.moveDx;
      p.y = p.baseY + Math.sin(p.phase) * p.moveDy;
    } else {
      const s = Math.sin(p.phase);
      p.x = p.baseX + s * p.moveDx;
      p.y = p.baseY + s * p.moveDy;
    }
  }
}

function damageEnemy(
  state: SimState,
  enemy: EnemyRuntime,
  damage: number,
  catalog: IWorldCatalog,
  events: SimEvent[],
): boolean {
  if (!enemy.alive || damage <= 0) return false;
  enemy.hp -= damage;
  enemy.hitFlashTimer = 0.16;
  enemy.stunTimer = 0.2;
  const cx = enemy.x + enemy.width * 0.5;
  const cy = enemy.y + enemy.height * 0.5;

  const killed = enemy.hp <= 0;
  if (killed) {
    enemy.alive = false;
    enemy.hp = 0;
    const def = getEnemyDef(catalog, enemy.archetype);
    spawnCrystalDrops(state, cx, cy, def.crystalValue, 2);
    if (state.ghostShip.active) {
      state.ghostShip.score += 50 * Math.max(1, state.combo.count + 1);
      if (state.ghostShip.score > state.ghostShip.highScore) {
        state.ghostShip.highScore = state.ghostShip.score;
        state.progress.ghostShipHighScore = state.ghostShip.score;
      }
    }
  }

  registerComboEnemyHit(state, cx, cy, killed, events);
  events.push({ type: 'enemy_hit', x: cx, y: cy, killed, combo: state.combo.count });
  state.hitstopTicks = Math.max(state.hitstopTicks, killed ? 2 : 1);
  return killed;
}

function damageBoss(
  state: SimState,
  boss: BossRuntime,
  damage: number,
  catalog: IWorldCatalog,
  events: SimEvent[],
): void {
  if (boss.defeated || boss.invulnTimer > 0 || damage <= 0) return;

  boss.hp = Math.max(0, boss.hp - damage);
  boss.invulnTimer = 0.3;
  boss.hitFlashTimer = 0.2;
  const cx = boss.x + boss.width * 0.5;
  const cy = boss.y + boss.height * 0.5;

  const hpRatio = boss.hp / Math.max(1, boss.maxHp);
  const newPhase: 1 | 2 | 3 = hpRatio > 0.66 ? 1 : hpRatio > 0.33 ? 2 : 3;
  if (newPhase > boss.phase) {
    boss.phase = newPhase;
    boss.arenaMorphPhase = newPhase - 1;
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
}

function applyHeroAttackBounce(
  state: SimState,
  isStomp: boolean,
  isFireDash: boolean,
  isVoltBlink: boolean,
  input: InputFrame,
): void {
  const hero = state.hero;
  hero.jumpsRemaining = hero.maxAirJumps;
  hero.abilityUsedInAir = false;
  hero.lastEnemyHitTimer = PHYSICS.LAST_ENEMY_HIT_TIMER;

  if (hasRelic(state, 'old_clock')) {
    state.slowmoTimer = Math.max(state.slowmoTimer, SIM_RULES.OLD_CLOCK_SLOWMO_DUR);
    state.slowmoScale = SIM_RULES.OLD_CLOCK_SLOWMO_SCALE;
  }

  if (isFireDash) {
    // Flame Rocket Dash kills enemy & refreshes air dash + double jump while continuing
    return;
  }

  if (isVoltBlink) {
    let sx = input.moveX;
    let sy = input.moveY;
    const mag = Math.hypot(sx, sy);
    if (mag > 0.2) {
      sx /= mag;
      sy /= mag;
    } else {
      sx = hero.facing * 0.45;
      sy = 0.893;
    }
    hero.vx = sx * FORM_PARAMS.VOLT_EXIT_SLING;
    hero.vy = sy * FORM_PARAMS.VOLT_EXIT_SLING;
    hero.voltTargetId = null;
    hero.action = 'jump';
    hero.abilityTimer = 0;
    if (getUpgradeLevel(state, 'VoltShield') > 0) {
      hero.invulnTimer = Math.max(hero.invulnTimer, FORM_PARAMS.VOLT_SHIELD_DUR);
    }
    return;
  }

  hero.vy = computeEnemyBounceVy(state, isStomp);
  hero.grounded = false;
  hero.jumpHoldTimer = 0;
  hero.wallJumpHoldTimer = 0;
  hero.stompDelayTimer = 0;
  hero.action = 'jump';
  hero.scaleX = 0.8;
  hero.scaleY = 1.28;
}

function updateEnemiesAndCombat(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  input: InputFrame,
  dt: number,
  explosions: BlastCircle[],
  completedVoltTargetId: string | null,
  evilRingTriggered: boolean,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;

  // Apply blast / evil ring damage
  if (evilRingTriggered) {
    explosions.push({ x: hx, y: hy, radius: SIM_RULES.EVIL_RING_RADIUS });
  }

  for (let b = 0; b < explosions.length; b++) {
    const blast = explosions[b];
    const r2 = blast.radius * blast.radius;
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (!e.alive) continue;
      const ex = e.x + e.width * 0.5;
      const ey = e.y + e.height * 0.5;
      if ((ex - blast.x) * (ex - blast.x) + (ey - blast.y) * (ey - blast.y) <= r2) {
        damageEnemy(state, e, SIM_RULES.EVIL_RING_DAMAGE, catalog, events);
      }
    }
    if (state.boss && !state.boss.defeated) {
      const bx = state.boss.x + state.boss.width * 0.5;
      const by = state.boss.y + state.boss.height * 0.5;
      if ((bx - blast.x) * (bx - blast.x) + (by - blast.y) * (by - blast.y) <= r2) {
        damageBoss(state, state.boss, 2, catalog, events);
      }
    }
  }

  // Volt blink target completion hit
  if (completedVoltTargetId) {
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.alive && e.id === completedVoltTargetId) {
        damageEnemy(state, e, 2, catalog, events);
      }
    }
    if (state.boss && !state.boss.defeated && state.boss.id === completedVoltTargetId) {
      damageBoss(state, state.boss, 2, catalog, events);
    }
  }

  const dashRoundFireActive =
    hero.form === 'krunk_fire' &&
    getUpgradeLevel(state, 'DashRoundFire') > 0 &&
    (hero.action === 'fire_dash' || hero.action === 'ground_dash' || hero.action === 'wall_dash');

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (!e.alive) continue;

    e.prevX = e.x;
    e.prevY = e.y;
    e.aiTimer += dt;
    if (e.hitFlashTimer > 0) e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
    if (e.stunTimer > 0) e.stunTimer = Math.max(0, e.stunTimer - dt);

    const def = getEnemyDef(catalog, e.archetype);

    if (e.stunTimer <= 0) {
      if (def.flying) {
        e.vx = e.facing * def.speed;
        e.x += e.vx * dt;
        e.vy = Math.sin(e.aiTimer * 3.0) * 1.1;
        e.y += e.vy * dt;
        if (e.x <= e.patrolMinX) {
          e.x = e.patrolMinX;
          e.facing = 1;
        } else if (e.x >= e.patrolMaxX) {
          e.x = e.patrolMaxX;
          e.facing = -1;
        }
      } else {
        e.vx = e.facing * def.speed;
        const nextX = e.x + e.vx * dt;
        const leadTx = e.facing > 0 ? Math.floor(nextX + e.width) : Math.floor(nextX);
        const bodyTy = Math.floor(e.y + 0.15);
        const floorTy = Math.floor(e.y - 0.1);
        const hitWall = isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, leadTx, bodyTy));
        const hasFloorAhead = isTileSolidOrOneWayAt(
          state.roomTiles,
          room.widthTiles,
          room.heightTiles,
          leadTx,
          floorTy,
        );

        if (hitWall || !hasFloorAhead || nextX < e.patrolMinX || nextX > e.patrolMaxX) {
          e.facing = (e.facing * -1) as -1 | 1;
        } else {
          e.x = nextX;
        }

        // Simple gravity & floor landing for ground enemies
        e.vy = Math.max(-14, e.vy + PHYSICS.G_EFF * 0.5 * dt);
        const nextY = e.y + e.vy * dt;
        const footTy = Math.floor(nextY);
        const midTx = Math.floor(e.x + e.width * 0.5);
        if (
          e.vy <= 0 &&
          isTileSolidOrOneWayAt(state.roomTiles, room.widthTiles, room.heightTiles, midTx, footTy)
        ) {
          e.y = footTy + 1;
          e.vy = 0;
          e.grounded = true;
        } else {
          e.y = nextY;
          e.grounded = false;
        }
      }

      // Ranged shooting
      if (def.shoots) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          const ex = e.x + e.width * 0.5;
          const ey = e.y + e.height * 0.5;
          const dist = Math.hypot(hx - ex, hy - ey);
          if (dist <= 11.0 && dist > 0.5) {
            e.shootTimer = def.shootCooldown;
            const speed = 6.5;
            state.projectiles.push({
              id: state.nextProjectileId++,
              fromHero: false,
              kind: 'spit',
              x: ex,
              y: ey,
              prevX: ex,
              prevY: ey,
              vx: ((hx - ex) / dist) * speed,
              vy: ((hy - ey) / dist) * speed,
              radius: 0.22,
              ttl: 2.5,
              homing: false,
            });
          } else {
            e.shootTimer = 0.5;
          }
        }
      }
    }

    // DashRoundFire orbiting flame hit check
    if (dashRoundFireActive) {
      const ex = e.x + e.width * 0.5;
      const ey = e.y + e.height * 0.5;
      const r = SIM_RULES.DASH_ROUND_FIRE_RADIUS;
      if ((ex - hx) * (ex - hx) + (ey - hy) * (ey - hy) <= r * r) {
        damageEnemy(state, e, 2, catalog, events);
        if (hero.action === 'fire_dash') {
          hero.abilityUsedInAir = false;
          hero.jumpsRemaining = hero.maxAirJumps;
          hero.lastEnemyHitTimer = PHYSICS.LAST_ENEMY_HIT_TIMER;
        }
        if (!e.alive) continue;
      }
    }

    // Hero <-> Enemy AABB collision
    if (
      hero.action !== 'dead' &&
      aabbOverlap(hero.x, hero.y, hero.width, hero.height, e.x, e.y, e.width, e.height)
    ) {
      const isAirStomp = hero.action === 'air_stomp';
      const isFireDash = hero.action === 'fire_dash';
      const isRockUppercut = hero.action === 'rock_uppercut';
      const isVoltBlink = hero.action === 'volt_blink';
      const isShadowBlink = hero.action === 'shadow_blink';
      const isDashTackle = hero.action === 'ground_dash' || hero.action === 'wall_dash';
      const isTopBounce =
        hero.vy <= 0.5 && hero.prevY >= e.y + e.height * 0.3 && !def.armoredTop;

      if (isAirStomp || isFireDash || isRockUppercut || isVoltBlink || isShadowBlink) {
        const dmg = 2;
        damageEnemy(state, e, dmg, catalog, events);
        applyHeroAttackBounce(state, isAirStomp, isFireDash, isVoltBlink, input);

        if (isAirStomp && hero.form === 'krunk_fire' && getUpgradeLevel(state, 'StompFlame') > 0) {
          const blastX = e.x + e.width * 0.5;
          const blastY = e.y + e.height * 0.5;
          events.push({ type: 'stomp_impact', x: blastX, y: blastY, explosive: true });
          const chainBlasts: BlastCircle[] = [];
          breakTilesInRadius(state, room, blastX, blastY, SIM_RULES.STOMP_FLAME_RADIUS, events, chainBlasts);
        }
      } else if (isDashTackle && !def.armoredTop) {
        damageEnemy(state, e, 1, catalog, events);
        applyHeroAttackBounce(state, false, false, false, input);
      } else if (isTopBounce) {
        damageEnemy(state, e, 1, catalog, events);
        applyHeroAttackBounce(state, false, false, false, input);
      } else if (hero.lastEnemyHitTimer <= 0) {
        const res = damageHero(state, 1, e.x + e.width * 0.5, events, 'enemy');
        if (res.evilRingTriggered) {
          damageEnemy(state, e, SIM_RULES.EVIL_RING_DAMAGE, catalog, events);
        }
      }
    }
  }
}

function updateBossAndCombat(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  input: InputFrame,
  dt: number,
  events: SimEvent[],
): void {
  const boss = state.boss;
  if (!boss || boss.defeated) return;

  boss.prevX = boss.x;
  boss.prevY = boss.y;
  if (boss.invulnTimer > 0) boss.invulnTimer = Math.max(0, boss.invulnTimer - dt);
  if (boss.hitFlashTimer > 0) boss.hitFlashTimer = Math.max(0, boss.hitFlashTimer - dt);

  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;
  const bx = boss.x + boss.width * 0.5;
  const by = boss.y + boss.height * 0.5;
  boss.facing = hx >= bx ? 1 : -1;

  const speedScale = boss.phase === 1 ? 1.0 : boss.phase === 2 ? 1.25 : 1.5;
  boss.stateTimer -= dt;

  const minX = 1.5;
  const maxX = Math.max(minX + 1, room.widthTiles - boss.width - 1.5);
  const minY = 1.5;
  const maxY = Math.max(minY + 1, room.heightTiles - boss.height - 1.5);

  switch (boss.state) {
    case 'hover': {
      const targetX = Math.max(minX, Math.min(maxX, room.widthTiles * 0.5 + Math.sin(state.tick * 0.04 * speedScale) * (room.widthTiles * 0.25) - boss.width * 0.5));
      const targetY = Math.max(minY, Math.min(maxY, room.heightTiles * 0.55 + Math.cos(state.tick * 0.06) * 0.8));
      boss.vx = (targetX - boss.x) * 3.0;
      boss.vy = (targetY - boss.y) * 3.0;
      boss.x += boss.vx * dt;
      boss.y += boss.vy * dt;

      if (boss.stateTimer <= 0) {
        boss.state = 'telegraph';
        boss.stateTimer = 0.55 / speedScale;
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
          // Sweep dash across arena
          boss.state = 'sweep';
          boss.stateTimer = 0.85;
          const dist = Math.max(0.5, Math.hypot(hx - bx, hy - by));
          const sweepSpeed = 7.5 * speedScale;
          boss.vx = ((hx - bx) / dist) * sweepSpeed;
          boss.vy = ((hy - by) / dist) * sweepSpeed * 0.5;
        } else if (pattern === 1) {
          // Projectile barrage (Primal Eye radial thorns / boss orbs)
          boss.state = 'barrage';
          boss.stateTimer = 0.6;
          const count = boss.phase === 1 ? 3 : boss.phase === 2 ? 5 : 7;
          const baseAngle = Math.atan2(hy - by, hx - bx);
          const spread = 0.26;
          const projKind =
            boss.id === 'primal_eye'
              ? 'thorn'
              : boss.id === 'magma_boar_king'
                ? 'fireball'
                : boss.id === 'electro_sphinx'
                  ? 'plasma'
                  : boss.id === 'mecha_bull'
                    ? 'gear'
                    : 'dark_orb';
          for (let k = 0; k < count; k++) {
            const offset = (k - (count - 1) * 0.5) * spread;
            const ang = baseAngle + offset;
            const spd = 6.2 * speedScale;
            state.projectiles.push({
              id: state.nextProjectileId++,
              fromHero: false,
              kind: projKind,
              x: bx,
              y: by,
              prevX: bx,
              prevY: by,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              radius: 0.28,
              ttl: 3.0,
              homing: false,
            });
          }
        } else {
          // Vulnerable low hover pause (invites stomp/uppercut combo!)
          boss.state = 'vulnerable';
          boss.stateTimer = 1.4;
          boss.vx = 0;
          boss.vy = 0;
        }
      }
      break;
    }

    case 'sweep': {
      boss.x = Math.max(minX, Math.min(maxX, boss.x + boss.vx * dt));
      boss.y = Math.max(minY, Math.min(maxY, boss.y + boss.vy * dt));
      if (boss.stateTimer <= 0) {
        boss.state = 'vulnerable';
        boss.stateTimer = 1.1;
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
        boss.stateTimer = 1.1 / speedScale;
      }
      break;
    }

    case 'vulnerable':
    default: {
      const restY = Math.max(minY, Math.min(maxY, 2.2));
      boss.y += (restY - boss.y) * Math.min(1, 4.0 * dt);
      if (boss.stateTimer <= 0) {
        boss.state = 'hover';
        boss.stateTimer = 1.2 / speedScale;
      }
      break;
    }
  }

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

    if (isAirStomp || isFireDash || isRockUppercut || isVoltBlink || isShadowBlink) {
      damageBoss(state, boss, 2, catalog, events);
      applyHeroAttackBounce(state, isAirStomp, isFireDash, isVoltBlink, input);
    } else if (isDashTackle || isTopBounce) {
      damageBoss(state, boss, 1, catalog, events);
      applyHeroAttackBounce(state, false, false, false, input);
    } else if (hero.lastEnemyHitTimer <= 0) {
      damageHero(state, 1, bx, events, 'enemy');
    }
  }
}

function updateProjectiles(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  dt: number,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const remaining = [];

  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i];
    p.prevX = p.x;
    p.prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;

    if (p.ttl <= 0) continue;

    // Out of room bounds
    if (p.x < -1 || p.x > room.widthTiles + 1 || p.y < -1 || p.y > room.heightTiles + 1) {
      continue;
    }

    // Solid tile stop (shockwaves glide along ground)
    if (p.kind !== 'shockwave') {
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      if (isSolidTile(getTileAt(state.roomTiles, room.widthTiles, room.heightTiles, tx, ty))) {
        continue;
      }
    }

    let consumed = false;
    if (p.fromHero) {
      for (let j = 0; j < state.enemies.length; j++) {
        const e = state.enemies[j];
        if (!e.alive) continue;
        if (
          aabbOverlap(
            p.x - p.radius,
            p.y - p.radius,
            p.radius * 2,
            p.radius * 2,
            e.x,
            e.y,
            e.width,
            e.height,
          )
        ) {
          damageEnemy(state, e, 2, catalog, events);
          if (p.kind !== 'shockwave') {
            consumed = true;
            break;
          }
        }
      }
      if (!consumed && state.boss && !state.boss.defeated) {
        const b = state.boss;
        if (
          aabbOverlap(
            p.x - p.radius,
            p.y - p.radius,
            p.radius * 2,
            p.radius * 2,
            b.x,
            b.y,
            b.width,
            b.height,
          )
        ) {
          damageBoss(state, b, 1, catalog, events);
          if (p.kind !== 'shockwave') {
            consumed = true;
          }
        }
      }
    } else if (hero.action !== 'dead') {
      if (
        aabbOverlap(
          p.x - p.radius,
          p.y - p.radius,
          p.radius * 2,
          p.radius * 2,
          hero.x,
          hero.y,
          hero.width,
          hero.height,
        )
      ) {
        damageHero(state, 1, p.x, events, 'projectile');
        consumed = true;
      }
    }

    if (!consumed) {
      remaining.push(p);
    }
  }

  state.projectiles = remaining;
}

function updateCrystalsAndCoins(
  state: SimState,
  room: RoomDef,
  dt: number,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;
  const magnetRadius = hasRelic(state, 'magnet')
    ? SIM_RULES.MAGNET_RELIC_RADIUS
    : SIM_RULES.MAGNET_BASE_RADIUS;
  const magnetR2 = magnetRadius * magnetRadius;
  const pickupR2 = SIM_RULES.CRYSTAL_PICKUP_RADIUS * SIM_RULES.CRYSTAL_PICKUP_RADIUS;

  for (let i = 0; i < state.crystals.length; i++) {
    const cr = state.crystals[i];
    if (cr.collected) continue;

    // Dynamic dropped crystals experience gravity & TTL
    if (cr.ttl > 0) {
      cr.ttl -= dt;
      if (cr.ttl <= 0) {
        cr.collected = true;
        continue;
      }
      cr.vy = Math.max(-12, cr.vy + PHYSICS.G_EFF * 0.45 * dt);
      const nextX = cr.x + cr.vx * dt;
      const nextY = cr.y + cr.vy * dt;
      const tx = Math.floor(nextX);
      const ty = Math.floor(nextY);
      if (isTileSolidOrOneWayAt(state.roomTiles, room.widthTiles, room.heightTiles, tx, ty) && cr.vy < 0) {
        cr.y = ty + 1.05;
        cr.vy = -cr.vy * 0.35;
        cr.vx *= 0.7;
      } else {
        cr.x = nextX;
        cr.y = nextY;
      }
    }

    // Magnet vacuum pull
    const dx = hx - cr.x;
    const dy = hy - cr.y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= pickupR2) {
      cr.collected = true;
      const value = awardCrystals(state, cr.value);
      registerComboCrystal(state, events);
      events.push({ type: 'crystal_pickup', x: cr.x, y: cr.y, value });
      continue;
    }

    if (distSq <= magnetR2 && distSq > 1e-4) {
      const dist = Math.sqrt(distSq);
      const pull = SIM_RULES.MAGNET_PULL_SPEED * dt;
      cr.x += (dx / dist) * pull;
      cr.y += (dy / dist) * pull;
      const ndx = hx - cr.x;
      const ndy = hy - cr.y;
      if (ndx * ndx + ndy * ndy <= pickupR2) {
        cr.collected = true;
        const value = awardCrystals(state, cr.value);
        registerComboCrystal(state, events);
        events.push({ type: 'crystal_pickup', x: cr.x, y: cr.y, value });
      }
    }
  }

  // Coins
  const coinR2 = SIM_RULES.COIN_PICKUP_RADIUS * SIM_RULES.COIN_PICKUP_RADIUS;
  for (let i = 0; i < state.coins.length; i++) {
    const c = state.coins[i];
    if (c.collected) continue;
    const dx = hx - c.x;
    const dy = hy - c.y;
    const overlaps =
      dx * dx + dy * dy <= coinR2 ||
      aabbOverlap(hero.x, hero.y, hero.width, hero.height, c.x - 0.3, c.y - 0.3, 0.6, 0.6);
    if (overlaps) {
      c.collected = true;
      if (!state.progress.collectedCoinIds.includes(c.id)) {
        state.progress.collectedCoinIds.push(c.id);
      }
      if (hasRelic(state, 'extra_coin')) {
        state.progress.crystals += SIM_RULES.EXTRA_COIN_CRYSTAL_BONUS;
      }
      events.push({
        type: 'coin_pickup',
        x: c.x,
        y: c.y,
        coinId: c.id,
        totalCoins: state.progress.collectedCoinIds.length,
      });
    }
  }
}

function updateInteractiveProps(
  state: SimState,
  room: RoomDef,
  input: InputFrame,
  events: SimEvent[],
): void {
  const hero = state.hero;
  const hx = hero.x + hero.width * 0.5;
  const hy = hero.y + hero.height * 0.5;

  state.activeShopPrompt = null;
  state.activeSignText = null;

  for (let i = 0; i < room.props.length; i++) {
    const prop = room.props[i];
    const pw = prop.width ?? 1;
    const ph = prop.height ?? 1;
    const px = prop.x + pw * 0.5;
    const py = prop.y + ph * 0.5;
    const dist = Math.hypot(hx - px, hy - py);

    switch (prop.kind) {
      case 'shop_npc': {
        if (dist <= SIM_RULES.PROP_INTERACT_RADIUS && prop.shopId) {
          state.activeShopPrompt = prop.shopId;
          if (input.interactPressed) {
            events.push({ type: 'shop_interact', shopId: prop.shopId });
          }
        }
        break;
      }

      case 'signpost': {
        if (dist <= SIM_RULES.PROP_INTERACT_RADIUS && prop.label) {
          state.activeSignText = prop.label;
        }
        break;
      }

      case 'teleporter': {
        if (dist <= 1.6 && !state.progress.unlockedTeleporters.includes(room.id)) {
          state.progress.unlockedTeleporters.push(room.id);
          events.push({ type: 'teleporter_unlock', roomId: room.id });
        }
        break;
      }

      case 'save_shrine': {
        if (dist <= 1.6 && input.interactPressed) {
          hero.hp = hero.maxHp;
          if (getUpgradeLevel(state, 'RockShield') > 0) {
            hero.rockShieldActive = true;
          }
          events.push({ type: 'heal', x: hx, y: hy, hp: hero.hp });
        }
        break;
      }

      case 'form_totem': {
        if (dist <= 1.5 && prop.formId) {
          const alreadyUnlocked = state.progress.unlockedForms.includes(prop.formId);
          if (!alreadyUnlocked) {
            state.progress.unlockedForms.push(prop.formId);
            switchHeroForm(state, prop.formId, events);
          } else if (input.interactPressed && hero.form !== prop.formId) {
            switchHeroForm(state, prop.formId, events);
          }
        }
        break;
      }

      case 'chest': {
        if (dist <= 1.35 && !state.progress.openedChests.includes(prop.id)) {
          state.progress.openedChests.push(prop.id);
          if (prop.coinId && !state.progress.collectedCoinIds.includes(prop.coinId)) {
            state.progress.collectedCoinIds.push(prop.coinId);
            events.push({
              type: 'coin_pickup',
              x: px,
              y: py,
              coinId: prop.coinId,
              totalCoins: state.progress.collectedCoinIds.length,
            });
          }
          spawnCrystalDrops(state, px, py + 0.4, 45, 3);
        }
        break;
      }

      case 'animal_house': {
        if (dist <= 1.5 && prop.animalName && !state.progress.rescuedAnimals.includes(prop.animalName)) {
          state.progress.rescuedAnimals.push(prop.animalName);
          awardCrystals(state, 50);
        }
        break;
      }

      case 'target_switch': {
        if (dist <= 1.25 && prop.targetId && !state.openedDoors.includes(prop.targetId)) {
          state.openedDoors.push(prop.targetId);
        }
        break;
      }

      case 'coin_door': {
        const req = prop.requiredCoins ?? 0;
        if (
          dist <= 1.8 &&
          !state.openedDoors.includes(prop.id) &&
          state.progress.collectedCoinIds.length >= req
        ) {
          state.openedDoors.push(prop.id);
        }
        break;
      }

      default:
        break;
    }
  }
}

function spawnGhostShipWave(state: SimState, room: RoomDef, catalog: IWorldCatalog): void {
  const wave = state.ghostShip.wave;
  const count = Math.min(10, 2 + wave);
  const enemies: EnemyRuntime[] = [];

  for (let i = 0; i < count; i++) {
    const poolIdx = nextInt(state, 0, GHOST_SHIP_ENEMY_POOL.length);
    const arch = GHOST_SHIP_ENEMY_POOL[poolIdx];
    const def = getEnemyDef(catalog, arch);
    const sx = nextRange(state, 2.5, Math.max(3.5, room.widthTiles - 3.5));
    const sy = def.flying ? nextRange(state, 3.5, Math.max(4.5, room.heightTiles - 2.5)) : 2.0;
    enemies.push({
      id: `gship_w${wave}_${i}`,
      archetype: arch,
      x: sx,
      y: sy,
      prevX: sx,
      prevY: sy,
      vx: 0,
      vy: 0,
      width: def.width,
      height: def.height,
      facing: i % 2 === 0 ? -1 : 1,
      hp: def.hp + (wave >= 5 ? 1 : 0),
      maxHp: def.hp + (wave >= 5 ? 1 : 0),
      alive: true,
      patrolMinX: 1.5,
      patrolMaxX: Math.max(3, room.widthTiles - 1.5 - def.width),
      aiTimer: i * 0.4,
      shootTimer: def.shoots ? def.shootCooldown : 99,
      hitFlashTimer: 0,
      stunTimer: 0,
      grounded: false,
    });
  }

  state.enemies = enemies;
  initRoomCombo(state, room);
}

function updateGhostShip(state: SimState, room: RoomDef, catalog: IWorldCatalog, dt: number): void {
  if (!state.ghostShip.active) return;

  const allDead = state.enemies.every((e) => !e.alive);
  if (allDead) {
    state.ghostShip.waveClearTimer += dt;
    if (state.ghostShip.waveClearTimer >= 1.0) {
      state.ghostShip.wave += 1;
      state.ghostShip.waveClearTimer = 0;
      state.ghostShip.hazardTier = state.ghostShip.wave >= 6 ? 2 : state.ghostShip.wave >= 3 ? 1 : 0;
      state.ghostShip.score += state.ghostShip.wave * 100;
      if (state.ghostShip.score > state.ghostShip.highScore) {
        state.ghostShip.highScore = state.ghostShip.score;
        state.progress.ghostShipHighScore = state.ghostShip.score;
      }
      if (state.ghostShip.wave > state.progress.ghostShipBestWave) {
        state.progress.ghostShipBestWave = state.ghostShip.wave;
      }
      spawnGhostShipWave(state, room, catalog);
    }
  }
}

function checkRoomExits(
  state: SimState,
  room: RoomDef,
  input: InputFrame,
  catalog: IWorldCatalog,
  events: SimEvent[],
): boolean {
  const hero = state.hero;
  for (let i = 0; i < room.exits.length; i++) {
    const exit = room.exits[i];
    if (!aabbOverlap(hero.x, hero.y, hero.width, hero.height, exit.x, exit.y, exit.width, exit.height)) {
      continue;
    }
    if (exit.dir === 'door' && !input.interactPressed && input.moveY <= 0.5) {
      if (exit.label) {
        state.activeSignText = exit.label;
      }
      continue;
    }
    if (exit.requiredForm && !state.progress.unlockedForms.includes(exit.requiredForm)) {
      state.activeSignText = `Requires ${exit.requiredForm}`;
      continue;
    }
    if (exit.requiredCoins && state.progress.collectedCoinIds.length < exit.requiredCoins) {
      state.activeSignText = `Requires ${exit.requiredCoins} coins`;
      continue;
    }
    if (!catalog.rooms.has(exit.targetRoomId)) {
      continue;
    }

    const changeEvents = loadRoomIntoState(
      state,
      catalog,
      exit.targetRoomId,
      exit.targetSpawnX,
      exit.targetSpawnY,
    );
    events.push(...changeEvents);
    return true;
  }
  return false;
}

export function createSimEngine(): ISimEngine {
  return {
    createInitialState(
      catalog: IWorldCatalog,
      options?: {
        seed?: number;
        mode?: GameMode;
        roomId?: string;
        progress?: Partial<ProgressState>;
      },
    ): SimState {
      const seed = (options?.seed ?? SIM_RULES.DEFAULT_SEED) >>> 0;
      const mode: GameMode = options?.mode ?? 'story';
      const roomId = options?.roomId ?? catalog.startRoomId;
      const room = catalog.rooms.get(roomId) ?? catalog.getRoom(catalog.startRoomId);
      const progress = createDefaultProgress(options?.progress);

      const state: SimState = {
        tick: 0,
        seed,
        rngState: seed,
        mode,
        roomId: room.id,
        biome: room.biome,
        roomTiles: new Uint8Array(room.tiles),
        crumbleTimers: {},
        openedDoors: [],
        lavaY: room.risingLava ? 0.5 : -10,
        hitstopTicks: 0,
        slowmoTimer: 0,
        slowmoScale: 1.0,
        timeAttackTicks: 0,
        hero: createInitialHero(room.defaultSpawnX, room.defaultSpawnY, PHYSICS.START_HP, 1, false),
        enemies: [],
        boss: null,
        projectiles: [],
        crystals: [],
        coins: [],
        platforms: [],
        combo: {
          preset: room.mode,
          count: 0,
          maxSceneCombo: 0,
          timer: 0,
          maxTimer: 4.0,
          decayAccum: 0,
          freezeTimer: 0,
          miniComboTimer: 0,
          miniComboCount: 0,
          roomComboCleared: false,
          bannerTimer: 0,
          bannerText: '',
        },
        camera: {
          x: room.defaultSpawnX,
          y: room.defaultSpawnY,
          prevX: room.defaultSpawnX,
          prevY: room.defaultSpawnY,
          snappedX: room.defaultSpawnX,
          snappedY: room.defaultSpawnY,
          zoom: 1.0,
          shakeTimer: 0,
          shakeIntensity: 0,
        },
        ghostShip: {
          active: mode === 'ghost_ship',
          wave: mode === 'ghost_ship' ? 1 : 0,
          score: 0,
          highScore: progress.ghostShipHighScore,
          waveClearTimer: 0,
          hazardTier: 0,
          spikeTimer: 0,
        },
        progress,
        nextProjectileId: 1,
        victoryTriggered: false,
        gameOverTriggered: false,
        activeShopPrompt: null,
        activeSignText: null,
      };

      state.hero.maxHp = computeMaxHp(state);
      state.hero.hp = state.hero.maxHp;
      state.hero.maxAirJumps = computeMaxAirJumps(state);
      state.hero.jumpsRemaining = state.hero.maxAirJumps;
      state.hero.rockShieldActive = getUpgradeLevel(state, 'RockShield') > 0;

      if (!state.progress.visitedRooms.includes(room.id)) {
        state.progress.visitedRooms.push(room.id);
      }

      spawnRoomEntities(state, room, catalog);
      if (mode === 'ghost_ship') {
        spawnGhostShipWave(state, room, catalog);
      }
      snapCameraToHero(state, room);

      return state;
    },

    step(state: SimState, input: InputFrame, catalog: IWorldCatalog): SimEvent[] {
      const events: SimEvent[] = [];
      state.tick += 1;

      if (state.mode === 'time_attack' && !state.victoryTriggered && !state.gameOverTriggered) {
        state.timeAttackTicks += 1;
      }

      const room = catalog.rooms.get(state.roomId) ?? catalog.getRoom(catalog.startRoomId);

      // Hitstop freeze frames
      if (state.hitstopTicks > 0) {
        state.hitstopTicks -= 1;
        updateCamera(state, room, FIXED_DT);
        return events;
      }

      // Slowmo time dilation (Old Clock / Max Room Combo)
      let dt = FIXED_DT;
      if (state.slowmoTimer > 0) {
        state.slowmoTimer = Math.max(0, state.slowmoTimer - FIXED_DT);
        dt = FIXED_DT * state.slowmoScale;
        if (state.slowmoTimer === 0) {
          state.slowmoScale = 1.0;
        }
      }

      if (state.hero.action === 'dead') {
        updateCamera(state, room, dt);
        return events;
      }

      // 1. World environment updates
      updateCrumbleTiles(state, room, dt, events);
      updateMovingPlatforms(state, dt);

      // 2. Hero physics, form abilities, and swept AABB collision
      state.hero.prevX = state.hero.x;
      state.hero.prevY = state.hero.y;
      const heroOut = stepHeroPhysics(state, input, room, dt, events);

      // Rising lava hazard
      if (room.risingLava) {
        state.lavaY = Math.min(room.heightTiles - 2, state.lavaY + 0.35 * dt);
        if (state.hero.y < state.lavaY) {
          damageHero(state, 1, state.hero.x + state.hero.width * 0.5, events, 'lava');
        }
      }

      // 3. Check room exits before clamping room X bounds
      const transitioned = checkRoomExits(state, room, input, catalog, events);
      if (transitioned) {
        return events;
      }

      // Keep hero within horizontal room bounds if not exiting
      if (state.hero.x < 0) {
        state.hero.x = 0;
        if (state.hero.vx < 0) state.hero.vx = 0;
      } else if (state.hero.x + state.hero.width > room.widthTiles) {
        state.hero.x = Math.max(0, room.widthTiles - state.hero.width);
        if (state.hero.vx > 0) state.hero.vx = 0;
      }

      // Bottomless pit safety check
      if (state.hero.y < -2.0) {
        damageHero(state, 1, state.hero.x + state.hero.width * 0.5, events, 'lava');
        if (state.hero.hp > 0 && !state.gameOverTriggered) {
          state.hero.x = room.defaultSpawnX;
          state.hero.y = room.defaultSpawnY;
          state.hero.vx = 0;
          state.hero.vy = 0;
        }
      }

      // 4. Enemies, boss, projectiles
      updateEnemiesAndCombat(
        state,
        room,
        catalog,
        input,
        dt,
        heroOut.explosions,
        heroOut.completedVoltTargetId,
        heroOut.evilRingTriggered,
        events,
      );
      updateBossAndCombat(state, room, catalog, input, dt, events);
      updateProjectiles(state, room, catalog, dt, events);

      // 5. Crystals, coins, props
      updateCrystalsAndCoins(state, room, dt, events);
      updateInteractiveProps(state, room, input, events);

      // 6. Ghost Ship endless progression
      updateGhostShip(state, room, catalog, dt);

      // 7. Combo decay
      tickCombo(state, dt);

      // 8. Smooth pixel-snapped camera
      updateCamera(state, room, dt);

      return events;
    },

    warpToRoom(
      state: SimState,
      catalog: IWorldCatalog,
      roomId: string,
      spawnX?: number,
      spawnY?: number,
    ): SimEvent[] {
      return loadRoomIntoState(state, catalog, roomId, spawnX, spawnY);
    },

    hashState(state: SimState): number {
      return hashState(state);
    },

    buyUpgrade(state: SimState, catalog: IWorldCatalog, key: UpgradeKey): boolean {
      const def = catalog.getUpgrade(key);
      if (!def) return false;
      const currentLevel = state.progress.upgradeLevels[key] ?? 0;
      if (currentLevel >= def.maxLevel) return false;
      if (def.requiredForm && !state.progress.unlockedForms.includes(def.requiredForm)) {
        return false;
      }
      const price = def.basePrice + currentLevel * def.priceStep;
      if (state.progress.crystals < price) return false;

      state.progress.crystals -= price;
      state.progress.upgradeLevels[key] = currentLevel + 1;

      // Apply immediate effects
      if (key === 'ExtraLife') {
        state.hero.maxHp = computeMaxHp(state);
        state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 1);
      } else if (key === 'TripleJump') {
        state.hero.maxAirJumps = computeMaxAirJumps(state);
        state.hero.jumpsRemaining = Math.max(state.hero.jumpsRemaining, state.hero.maxAirJumps);
      } else if (key === 'RockShield') {
        state.hero.rockShieldActive = true;
      }

      return true;
    },

    buyRelic(state: SimState, catalog: IWorldCatalog, id: RelicId): boolean {
      if (state.progress.ownedRelics.includes(id)) return false;
      const def = catalog.getRelic(id);
      if (!def) return false;
      if (state.progress.crystals < def.price) return false;

      state.progress.crystals -= def.price;
      state.progress.ownedRelics.push(id);

      // Auto-equip if a relic slot is available
      if (state.progress.equippedRelics.length < computeMaxRelicSlots(state)) {
        state.progress.equippedRelics.push(id);
        if (id === 'lively_heart') {
          state.hero.maxHp = computeMaxHp(state);
          state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 1);
        }
      }

      return true;
    },

    toggleEquipRelic(state: SimState, _catalog: IWorldCatalog, id: RelicId): boolean {
      if (!state.progress.ownedRelics.includes(id)) return false;
      const idx = state.progress.equippedRelics.indexOf(id);
      if (idx >= 0) {
        state.progress.equippedRelics.splice(idx, 1);
        state.hero.maxHp = computeMaxHp(state);
        state.hero.hp = Math.min(state.hero.hp, state.hero.maxHp);
        return true;
      }

      if (state.progress.equippedRelics.length >= computeMaxRelicSlots(state)) {
        return false;
      }

      state.progress.equippedRelics.push(id);
      state.hero.maxHp = computeMaxHp(state);
      if (id === 'lively_heart') {
        state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 1);
      }
      return true;
    },

    startGhostShip(state: SimState, catalog: IWorldCatalog): SimEvent[] {
      state.mode = 'ghost_ship';
      state.victoryTriggered = false;
      state.gameOverTriggered = false;
      state.hero.hp = computeMaxHp(state);
      state.hero.maxHp = state.hero.hp;
      state.hero.action = 'idle';
      state.hero.rebirthUsed = false;
      state.ghostShip = {
        active: true,
        wave: 1,
        score: 0,
        highScore: state.progress.ghostShipHighScore,
        waveClearTimer: 0,
        hazardTier: 0,
        spikeTimer: 0,
      };
      const events = loadRoomIntoState(state, catalog, catalog.ghostShipRoomId);
      const room = catalog.rooms.get(state.roomId) ?? catalog.getRoom(catalog.startRoomId);
      spawnGhostShipWave(state, room, catalog);
      return events;
    },

    startBossRush(state: SimState, catalog: IWorldCatalog, bossId: BossId): SimEvent[] {
      state.mode = 'boss_rush';
      state.ghostShip.active = false;
      state.victoryTriggered = false;
      state.gameOverTriggered = false;
      state.hero.hp = computeMaxHp(state);
      state.hero.maxHp = state.hero.hp;
      state.hero.action = 'idle';
      state.hero.rebirthUsed = false;

      const bossDef = catalog.bosses.get(bossId);
      const targetRoomId =
        bossDef && catalog.rooms.has(bossDef.roomId) ? bossDef.roomId : state.roomId;
      return loadRoomIntoState(state, catalog, targetRoomId, undefined, undefined, bossId);
    },

    startTimeAttack(state: SimState, catalog: IWorldCatalog): SimEvent[] {
      state.mode = 'time_attack';
      state.ghostShip.active = false;
      state.timeAttackTicks = 0;
      state.victoryTriggered = false;
      state.gameOverTriggered = false;
      state.hero.hp = computeMaxHp(state);
      state.hero.maxHp = state.hero.hp;
      state.hero.action = 'idle';
      state.hero.rebirthUsed = false;
      return loadRoomIntoState(state, catalog, catalog.startRoomId);
    },
  };
}
