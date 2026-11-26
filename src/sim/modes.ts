import {
  TileCode,
  type BossId,
  type EnemyArchetypeId,
  type EnemyRuntime,
  type IWorldCatalog,
  type RoomDef,
  type SimEvent,
  type SimState,
} from '../contracts/index';
import { initRoomCombo } from './combo';
import { computeMaxHp } from './constants';
import { awardCrystals, getEnemyDef } from './enemies';
import { nextInt, nextRange } from './prng';

export type RoomLoader = (
  state: SimState,
  catalog: IWorldCatalog,
  roomId: string,
  spawnX?: number,
  spawnY?: number,
  forceBossId?: BossId,
) => SimEvent[];

// Escalating wave rosters: always led by Ghost Ship crew + biome guest enemies
const GHOST_SHIP_TIER0_POOL: readonly EnemyArchetypeId[] = [
  'ghost_crow',
  'ghost_owl',
  'ghost_pig',
  'goomba',
  'air_goomba',
  'bee',
];

const GHOST_SHIP_TIER1_POOL: readonly EnemyArchetypeId[] = [
  'ghost_crow',
  'ghost_owl',
  'ghost_pig',
  'spitter',
  'horned_beetle',
  'frog',
  'guilhofly',
  'big_jelly',
  'vulture',
  'puncher_pig',
  'fire_lizard',
];

const GHOST_SHIP_TIER2_POOL: readonly EnemyArchetypeId[] = [
  'ghost_crow',
  'ghost_owl',
  'ghost_pig',
  'mushroom_warrior',
  'spike_turtle',
  'launcher_pig',
  'eagle_cannon',
  'botmerang',
  'floating_sword',
  'zeppelin',
  'atom_eye',
  'mummy',
  'scavenger',
  'bombalon',
  'mystic_wheel',
  'big_jelly',
];

export function computeGhostShipHazardTier(wave: number): 0 | 1 | 2 {
  if (wave >= 6) return 2;
  if (wave >= 3) return 1;
  return 0;
}

function findDeckFloorRow(room: RoomDef): number {
  const midTx = Math.max(1, Math.min(room.widthTiles - 2, Math.floor(room.widthTiles * 0.5)));
  for (let ty = Math.min(room.heightTiles - 2, 3); ty >= 0; ty--) {
    if (room.tiles[ty * room.widthTiles + midTx] === TileCode.Solid) {
      return ty;
    }
  }
  return 0;
}

function restoreDeckTiles(state: SimState, room: RoomDef, deckTy: number): void {
  const rw = room.widthTiles;
  const rowStart = deckTy * rw;
  for (let tx = 1; tx < rw - 1; tx++) {
    const idx = rowStart + tx;
    if (room.tiles[idx] === TileCode.Solid) {
      state.roomTiles[idx] = TileCode.Solid;
    }
  }
}

function applyGhostShipDeckHazards(state: SimState, room: RoomDef, dt: number): void {
  const gs = state.ghostShip;
  gs.spikeTimer += dt;

  const deckTy = findDeckFloorRow(room);
  const rw = room.widthTiles;
  const safeSpawnTx = Math.floor(room.defaultSpawnX);

  // Restore clean solid deck before applying active pulse
  restoreDeckTiles(state, room, deckTy);

  if (gs.hazardTier === 0) {
    return;
  }

  if (gs.hazardTier === 1) {
    // Tier 1 (waves 3..5): Periodic outer-deck spike surges (4.0s cycle, active 1.4s)
    const cycle = gs.spikeTimer % 4.0;
    if (cycle >= 2.6) {
      const cols = [3, 4, rw - 5, rw - 4];
      for (let i = 0; i < cols.length; i++) {
        const tx = cols[i];
        if (tx >= 1 && tx < rw - 1 && Math.abs(tx - safeSpawnTx) > 2) {
          const idx = deckTy * rw + tx;
          if (room.tiles[idx] === TileCode.Solid) {
            state.roomTiles[idx] = TileCode.Spike;
          }
        }
      }
    }
    return;
  }

  // Tier 2 (waves 6+): Rapid alternating inner/outer spike vents + oscillating ghost deck platforms!
  const cycle = gs.spikeTimer % 3.2;
  const outerActive = cycle >= 0.7 && cycle < 1.65;
  const innerActive = cycle >= 2.1 && cycle < 3.05;

  if (outerActive) {
    const cols = [2, 3, 4, rw - 5, rw - 4, rw - 3];
    for (let i = 0; i < cols.length; i++) {
      const tx = cols[i];
      if (tx >= 1 && tx < rw - 1 && Math.abs(tx - safeSpawnTx) > 2) {
        const idx = deckTy * rw + tx;
        if (room.tiles[idx] === TileCode.Solid) {
          state.roomTiles[idx] = TileCode.Spike;
        }
      }
    }
  } else if (innerActive) {
    const mid = Math.floor(rw * 0.5);
    const cols = [mid - 5, mid - 4, mid + 4, mid + 5];
    for (let i = 0; i < cols.length; i++) {
      const tx = cols[i];
      if (tx >= 1 && tx < rw - 1 && Math.abs(tx - safeSpawnTx) > 1) {
        const idx = deckTy * rw + tx;
        if (room.tiles[idx] === TileCode.Solid) {
          state.roomTiles[idx] = TileCode.Spike;
        }
      }
    }
  }

  // Ensure Tier 2 dynamic moving ghost platforms exist and pulse cleanly
  if (state.platforms.length === 0 && rw >= 14) {
    const platY = Math.min(room.heightTiles - 3.5, deckTy + 4.5);
    state.platforms.push(
      {
        id: 'gship_hazard_plat_l',
        kind: 'moving_platform',
        baseX: Math.max(2.5, rw * 0.25 - 1.5),
        baseY: platY,
        x: Math.max(2.5, rw * 0.25 - 1.5),
        y: platY,
        prevX: Math.max(2.5, rw * 0.25 - 1.5),
        prevY: platY,
        width: 3.0,
        height: 0.5,
        moveDx: 1.5,
        moveDy: 1.2,
        periodSec: 3.2,
        phase: 0,
        solid: true,
      },
      {
        id: 'gship_hazard_plat_r',
        kind: 'moving_platform',
        baseX: Math.min(rw - 5.5, rw * 0.75 - 1.5),
        baseY: platY,
        x: Math.min(rw - 5.5, rw * 0.75 - 1.5),
        y: platY,
        prevX: Math.min(rw - 5.5, rw * 0.75 - 1.5),
        prevY: platY,
        width: 3.0,
        height: 0.5,
        moveDx: 1.5,
        moveDy: 1.2,
        periodSec: 3.2,
        phase: Math.PI,
        solid: true,
      },
    );
  }
}

export function spawnGhostShipWave(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
): void {
  const wave = Math.max(1, state.ghostShip.wave);
  state.ghostShip.hazardTier = computeGhostShipHazardTier(wave);

  const deckTy = findDeckFloorRow(room);
  const floorY = deckTy + 1.0;
  restoreDeckTiles(state, room, deckTy);

  const count = Math.min(12, 2 + wave);
  const pool =
    state.ghostShip.hazardTier === 0
      ? GHOST_SHIP_TIER0_POOL
      : state.ghostShip.hazardTier === 1
        ? GHOST_SHIP_TIER1_POOL
        : GHOST_SHIP_TIER2_POOL;

  const hpBonus = wave >= 10 ? 2 : wave >= 5 ? 1 : 0;
  const enemies: EnemyRuntime[] = [];

  for (let i = 0; i < count; i++) {
    // Guarantee spectral crew presence on first two slots each wave, then escalating guest pool
    const arch: EnemyArchetypeId =
      i === 0
        ? 'ghost_crow'
        : i === 1
          ? wave % 2 === 0
            ? 'ghost_owl'
            : 'ghost_pig'
          : pool[nextInt(state, 0, pool.length)];

    const def = getEnemyDef(catalog, arch);
    const sx = nextRange(state, 2.2, Math.max(3.2, room.widthTiles - 2.2 - def.width));
    const isAir = def.flying || arch === 'ghost_pig' || arch === 'ladybug';
    const sy = isAir
      ? nextRange(state, Math.min(floorY + 2.0, room.heightTiles - 3.0), Math.max(floorY + 2.5, room.heightTiles - 2.2))
      : floorY;

    const maxHp = def.hp + hpBonus;
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
      hp: maxHp,
      maxHp,
      alive: true,
      patrolMinX: 1.5,
      patrolMaxX: Math.max(3.0, room.widthTiles - 1.5 - def.width),
      aiTimer: i * 0.35,
      shootTimer: def.shoots ? Math.max(0.8, def.shootCooldown * 0.7) : 99,
      hitFlashTimer: 0,
      stunTimer: 0,
      grounded: !isAir,
    });
  }

  state.enemies = enemies;
  initRoomCombo(state, room);
}

export function startGhostShip(
  state: SimState,
  catalog: IWorldCatalog,
  loadRoom: RoomLoader,
): SimEvent[] {
  state.mode = 'ghost_ship';
  state.victoryTriggered = false;
  state.gameOverTriggered = false;
  state.hitstopTicks = 0;
  state.slowmoTimer = 0;
  state.slowmoScale = 1.0;

  state.hero.maxHp = computeMaxHp(state);
  state.hero.hp = state.hero.maxHp;
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

  const events = loadRoom(state, catalog, catalog.ghostShipRoomId);
  const room = catalog.rooms.get(state.roomId) ?? catalog.getRoom(catalog.startRoomId);
  spawnGhostShipWave(state, room, catalog);
  return events;
}

export function tickGhostShipMode(
  state: SimState,
  room: RoomDef,
  catalog: IWorldCatalog,
  dt: number,
  events: SimEvent[],
): void {
  if (!state.ghostShip.active) return;

  // Dynamic 3-tier deck hazard cycling every tick
  applyGhostShipDeckHazards(state, room, dt);

  const allDead = state.enemies.length > 0 && state.enemies.every((e) => !e.alive);
  if (allDead) {
    state.ghostShip.waveClearTimer += dt;
    if (state.ghostShip.waveClearTimer >= 1.0) {
      const clearedWave = state.ghostShip.wave;

      // Award wave clear score & crystal bonus!
      const scoreBonus = clearedWave * 150 + state.combo.count * 25;
      state.ghostShip.score += scoreBonus;

      const crystalBonus = awardCrystals(state, 35 + clearedWave * 15);
      events.push({
        type: 'crystal_pickup',
        x: state.hero.x + state.hero.width * 0.5,
        y: state.hero.y + state.hero.height,
        value: crystalBonus,
      });

      // Advance wave & escalate hazard tier
      state.ghostShip.wave = clearedWave + 1;
      state.ghostShip.waveClearTimer = 0;
      state.ghostShip.hazardTier = computeGhostShipHazardTier(state.ghostShip.wave);

      // Persist best wave & high score onto progress
      if (state.ghostShip.score > state.ghostShip.highScore) {
        state.ghostShip.highScore = state.ghostShip.score;
      }
      if (state.ghostShip.score > state.progress.ghostShipHighScore) {
        state.progress.ghostShipHighScore = state.ghostShip.score;
      }
      if (clearedWave > state.progress.ghostShipBestWave) {
        state.progress.ghostShipBestWave = clearedWave;
      }

      spawnGhostShipWave(state, room, catalog);
    }
  }
}

export function startBossRush(
  state: SimState,
  catalog: IWorldCatalog,
  bossId: BossId,
  loadRoom: RoomLoader,
): SimEvent[] {
  state.mode = 'boss_rush';
  state.ghostShip.active = false;
  state.victoryTriggered = false;
  state.gameOverTriggered = false;
  state.hitstopTicks = 0;
  state.slowmoTimer = 0;
  state.slowmoScale = 1.0;

  state.hero.maxHp = computeMaxHp(state);
  state.hero.hp = state.hero.maxHp;
  state.hero.action = 'idle';
  state.hero.rebirthUsed = false;

  const bossDef = catalog.bosses.get(bossId);
  const targetRoomId =
    bossDef && catalog.rooms.has(bossDef.roomId) ? bossDef.roomId : state.roomId;
  return loadRoom(state, catalog, targetRoomId, undefined, undefined, bossId);
}

export function startTimeAttack(
  state: SimState,
  catalog: IWorldCatalog,
  loadRoom: RoomLoader,
): SimEvent[] {
  state.mode = 'time_attack';
  state.ghostShip.active = false;
  state.timeAttackTicks = 0;
  state.victoryTriggered = false;
  state.gameOverTriggered = false;
  state.hitstopTicks = 0;
  state.slowmoTimer = 0;
  state.slowmoScale = 1.0;

  state.hero.maxHp = computeMaxHp(state);
  state.hero.hp = state.hero.maxHp;
  state.hero.action = 'idle';
  state.hero.rebirthUsed = false;

  return loadRoom(state, catalog, catalog.startRoomId);
}

export function tickTimeAttack(state: SimState): void {
  if (state.mode === 'time_attack' && !state.victoryTriggered && !state.gameOverTriggered) {
    state.timeAttackTicks += 1;
  }
}
