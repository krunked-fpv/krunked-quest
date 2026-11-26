import { describe, expect, it } from 'vitest';
import {
  TileCode,
  createEmptyInputFrame,
  type BossId,
  type EnemyArchetypeId,
  type HeroFormDef,
  type HeroFormId,
  type InputFrame,
  type IWorldCatalog,
  type RelicDef,
  type RelicId,
  type RoomDef,
  type SimEvent,
  type SimState,
  type UpgradeDef,
  type UpgradeKey,
} from '../src/contracts/index';
import { BOSS_DEFS, BOSSES_BY_ID } from '../src/data/bosses';
import { ENEMY_ARCHETYPES, ENEMY_ARCHETYPES_BY_ID } from '../src/data/enemies';
import { createSimEngine } from '../src/sim/index';
import { damageBoss } from '../src/sim/bosses';
import { damageEnemy } from '../src/sim/enemies';

function parseAsciiGrid(rows: string[]): { widthTiles: number; heightTiles: number; tiles: Uint8Array } {
  const heightTiles = rows.length;
  const widthTiles = rows[0].length;
  const tiles = new Uint8Array(widthTiles * heightTiles);
  const legend: Record<string, TileCode> = {
    '.': TileCode.Empty,
    '#': TileCode.Solid,
    '-': TileCode.OneWay,
    '^': TileCode.Spike,
    B: TileCode.Breakable,
    S: TileCode.StoneOverhead,
    O: TileCode.Bounce,
    V: TileCode.Vine,
    A: TileCode.Acid,
    L: TileCode.Lava,
    Q: TileCode.Quicksand,
    C: TileCode.Crumble,
    X: TileCode.Explosive,
    G: TileCode.Antigrav,
    W: TileCode.WindUp,
  };
  for (let r = 0; r < heightTiles; r++) {
    const ty = heightTiles - 1 - r;
    const line = rows[r];
    for (let tx = 0; tx < widthTiles; tx++) {
      tiles[ty * widthTiles + tx] = legend[line[tx]] ?? TileCode.Empty;
    }
  }
  return { widthTiles, heightTiles, tiles };
}

const ARENA_ASCII = [
  '############################',
  '#..........................#',
  '#..........................#',
  '#..........................#',
  '#..........------..........#',
  '#..........................#',
  '#..........................#',
  '#....-----........-----....#',
  '#..........................#',
  '#..........................#',
  '#..........................#',
  '############################',
  '############################',
];

function makeRoom(id: string, overrides: Partial<RoomDef> = {}): RoomDef {
  const grid = parseAsciiGrid(ARENA_ASCII);
  return {
    id,
    name: id,
    biome: 'TDM',
    mode: 'arena',
    mapX: 0,
    mapY: 0,
    widthTiles: grid.widthTiles,
    heightTiles: grid.heightTiles,
    tiles: grid.tiles,
    defaultSpawnX: 4.0,
    defaultSpawnY: 2.0,
    exits: [],
    enemies: [],
    coins: [],
    crystals: [],
    props: [],
    ...overrides,
  };
}

function makeCombatCatalog(extraRooms: RoomDef[] = []): IWorldCatalog {
  const startRoom = makeRoom('mlair_01', { biome: 'MLAIR', mode: 'normal' });
  const gshipRoom = makeRoom('gship_01', {
    biome: 'GSHIP',
    mode: 'arena',
    defaultSpawnX: 13.5,
    defaultSpawnY: 2.0,
  });

  const bossRooms: RoomDef[] = BOSS_DEFS.map((b, idx) =>
    makeRoom(b.roomId, {
      biome: b.biome,
      mode: 'boss',
      bossId: b.id,
      mapX: idx + 1,
      defaultSpawnX: 3.5,
      defaultSpawnY: 2.0,
    }),
  );

  const allRooms = [startRoom, gshipRoom, ...bossRooms, ...extraRooms];
  const roomMap = new Map<string, RoomDef>();
  for (const r of allRooms) roomMap.set(r.id, r);

  const upgrades: UpgradeDef[] = [
    { id: 0, key: 'ExtraLife', name: 'Extra Life', description: '', shop: 'vespera', basePrice: 700, priceStep: 700, maxLevel: 5 },
    { id: 5, key: 'StompFlame', name: 'Stomp Flame', description: '', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_fire' },
    { id: 14, key: 'DashRoundFire', name: 'Dash Fire Ring', description: '', shop: 'orla', basePrice: 3500, priceStep: 0, maxLevel: 1, requiredForm: 'krunk_fire' },
  ];

  const relics: RelicDef[] = [
    { id: 'evil_ring', name: 'Evil Ring', description: '', price: 3500, iconColor: '#f00' },
  ];

  const forms: HeroFormDef[] = [
    { id: 'krunk_basic', name: 'Basic', abilityName: 'Stomp', description: '', palette: ['#1', '#2', '#3', '#4', '#5', '#6'], wallSlideVelY: -4, defaultUnlocked: true },
    { id: 'krunk_fire', name: 'Fire', abilityName: 'Fire Dash', description: '', palette: ['#1', '#2', '#3', '#4', '#5', '#6'], wallSlideVelY: -2, defaultUnlocked: false },
    { id: 'krunk_leaf', name: 'Leaf', abilityName: 'Leaf Glide', description: '', palette: ['#1', '#2', '#3', '#4', '#5', '#6'], wallSlideVelY: -2, defaultUnlocked: false },
    { id: 'krunk_rock', name: 'Rock', abilityName: 'Uppercut', description: '', palette: ['#1', '#2', '#3', '#4', '#5', '#6'], wallSlideVelY: -2, defaultUnlocked: false },
    { id: 'krunk_electric', name: 'Volt', abilityName: 'Volt Blink', description: '', palette: ['#1', '#2', '#3', '#4', '#5', '#6'], wallSlideVelY: -2, defaultUnlocked: false },
    { id: 'krunk_shadow', name: 'Shadow', abilityName: 'Shadow Blink', description: '', palette: ['#1', '#2', '#3', '#4', '#5', '#6'], wallSlideVelY: -2, defaultUnlocked: false },
  ];

  return {
    startRoomId: 'mlair_01',
    hubRoomId: 'mlair_01',
    ghostShipRoomId: 'gship_01',
    rooms: roomMap,
    roomOrder: allRooms.map((r) => r.id),
    upgrades,
    relics,
    forms,
    enemies: ENEMY_ARCHETYPES_BY_ID,
    bosses: BOSSES_BY_ID,
    totalCoins: 200,
    getRoom: (id) => {
      const r = roomMap.get(id);
      if (!r) throw new Error(`Missing room ${id}`);
      return r;
    },
    getUpgrade: (key: UpgradeKey) => {
      const u = upgrades.find((x) => x.key === key);
      if (!u) throw new Error(`Missing upgrade ${key}`);
      return u;
    },
    getRelic: (id: RelicId) => {
      const r = relics.find((x) => x.id === id);
      if (!r) throw new Error(`Missing relic ${id}`);
      return r;
    },
    getForm: (id: HeroFormId) => {
      const f = forms.find((x) => x.id === id);
      if (!f) throw new Error(`Missing form ${id}`);
      return f;
    },
  };
}

function stepN(
  engine: ReturnType<typeof createSimEngine>,
  state: SimState,
  catalog: IWorldCatalog,
  n: number,
  makeInput: (tick: number) => Partial<InputFrame> = () => ({}),
): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    out.push(...engine.step(state, { ...createEmptyInputFrame(), ...makeInput(i) }, catalog));
  }
  return out;
}

// ============================================================================
// 1. All 34 Enemy Archetypes, Big Jelly Split, Bombalon & Stomp Combat
// ============================================================================

describe('34 Enemy Archetypes & Specialty Combat', () => {
  it('executes bespoke deterministic AI for all 34 EnemyArchetypeIds with finite bounds and specialty projectiles', () => {
    expect(ENEMY_ARCHETYPES.length).toBe(34);
    const engine = createSimEngine();

    // Test every single archetype across 180 ticks (3 seconds)
    for (let i = 0; i < ENEMY_ARCHETYPES.length; i++) {
      const def = ENEMY_ARCHETYPES[i];
      const spawnY = def.flying || def.id === 'ladybug' || def.id === 'ghost_pig' ? 6.5 : 2.0;
      const room = makeRoom(`test_${def.id}`, {
        defaultSpawnX: 8.0,
        defaultSpawnY: 2.0,
        enemies: [
          {
            id: `e_${def.id}`,
            archetype: def.id as EnemyArchetypeId,
            x: 14.0,
            y: spawnY,
            patrolMinX: 6.0,
            patrolMaxX: 22.0,
          },
        ],
      });
      const catalog = makeCombatCatalog([room]);
      const state = engine.createInitialState(catalog, { roomId: room.id, seed: 1000 + i });
      state.hero.invulnTimer = 10.0; // Keep hero alive while observing AI

      let moved = false;
      let spawnedProj = false;
      const startX = state.enemies[0].x;
      const startY = state.enemies[0].y;

      for (let t = 0; t < 180; t++) {
        engine.step(state, createEmptyInputFrame(), catalog);
        const e = state.enemies[0];
        expect(Number.isFinite(e.x)).toBe(true);
        expect(Number.isFinite(e.y)).toBe(true);
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.x).toBeLessThanOrEqual(room.widthTiles);
        expect(e.y).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeLessThanOrEqual(room.heightTiles);
        if (Math.abs(e.x - startX) > 0.1 || Math.abs(e.y - startY) > 0.1) {
          moved = true;
        }
        if (state.projectiles.length > 0) {
          spawnedProj = true;
        }
      }

      expect(moved, `Archetype ${def.id} should move`).toBe(true);
      if (
        def.shoots ||
        def.id === 'toxic_slug' ||
        def.id === 'atom_eye' ||
        def.id === 'botmerang' ||
        def.id === 'launcher_pig' ||
        def.id === 'eagle_cannon' ||
        def.id === 'zeppelin'
      ) {
        expect(spawnedProj, `Ranged archetype ${def.id} should fire projectiles`).toBe(true);
      }
    }
  });

  it('splits big_jelly into 2 mini_jelly on death, updates combo target, and scales crystal payout with combo', () => {
    const room = makeRoom('jelly_split', {
      defaultSpawnX: 5.0,
      defaultSpawnY: 2.0,
      enemies: [
        { id: 'bj_1', archetype: 'big_jelly', x: 14.0, y: 5.5, patrolMinX: 10.0, patrolMaxX: 18.0 },
      ],
    });
    const catalog = makeCombatCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, { roomId: room.id });

    expect(state.enemies.length).toBe(1);
    expect(state.combo.maxSceneCombo).toBe(1);

    // Build an existing combo before killing big_jelly so combo scaling applies
    state.combo.count = 5;
    state.combo.timer = 3.0;
    const events: SimEvent[] = [];
    const killed = damageEnemy(state, state.enemies[0], 2, catalog, room, events);

    expect(killed).toBe(true);
    expect(state.enemies[0].alive).toBe(false);

    // 2 mini_jelly entities spawned!
    const splits = state.enemies.filter((e) => e.archetype === 'mini_jelly');
    expect(splits.length).toBe(2);
    expect(splits.every((s) => s.alive)).toBe(true);
    expect(splits[0].facing).toBe(-1);
    expect(splits[1].facing).toBe(1);
    expect(state.combo.maxSceneCombo).toBe(3);
    expect(state.combo.roomComboCleared).toBe(false);

    // Crystal drops should exceed base big_jelly crystalValue (40) due to combo scaling!
    const droppedValue = state.crystals.reduce((acc, c) => acc + c.value, 0);
    expect(droppedValue).toBeGreaterThan(40);

    // Killing both mini_jellies completes the room combo!
    damageEnemy(state, splits[0], 1, catalog, room, events);
    expect(state.combo.roomComboCleared).toBe(false);
    damageEnemy(state, splits[1], 1, catalog, room, events);
    expect(state.combo.roomComboCleared).toBe(true);
    expect(events.some((e) => e.type === 'combo_max')).toBe(true);
  });

  it('ignites bombalon fuse when hero approaches and detonates deterministically', () => {
    const room = makeRoom('bomb_room', {
      defaultSpawnX: 11.0,
      defaultSpawnY: 2.0,
      enemies: [
        { id: 'bomb_1', archetype: 'bombalon', x: 14.0, y: 4.5, patrolMinX: 10.0, patrolMaxX: 18.0 },
      ],
    });
    const catalog = makeCombatCatalog([room]);
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, { roomId: room.id });
    state.hero.invulnTimer = 5.0;

    const events = stepN(engine, state, catalog, 100);
    expect(state.enemies[0].alive).toBe(false);
    expect(events.some((e) => e.type === 'block_break' && e.explosive)).toBe(true);
  });
});

// ============================================================================
// 2. All 8 Bosses & Mini-Bosses: Phases, Attacks, Mechanics, Unlocks & Victory
// ============================================================================

describe('All 8 Bosses & Mini-Bosses State Machines', () => {
  it('verifies phase transitions (1->2->3), bespoke attacks, defeat rewards & form unlocks across all 8 bosses', () => {
    const catalog = makeCombatCatalog();
    const engine = createSimEngine();

    const expectedUnlocks: Partial<Record<BossId, HeroFormId>> = {
      primal_eye: 'krunk_leaf',
      magma_boar_king: 'krunk_fire',
      mecha_bull: 'krunk_rock',
      electro_sphinx: 'krunk_electric',
      nightmare_sovereign: 'krunk_shadow',
    };

    for (const def of BOSS_DEFS) {
      const state = engine.createInitialState(catalog, { roomId: def.roomId, seed: 42 });
      const room = catalog.getRoom(def.roomId);
      expect(state.boss).not.toBeNull();
      expect(state.boss!.id).toBe(def.id);
      expect(state.boss!.maxHp).toBe(def.maxHp);
      expect(state.boss!.phase).toBe(1);

      state.hero.invulnTimer = 30.0; // Observe full multi-attack cycles safely

      const observedStates = new Set<string>();
      const observedProjectiles = new Set<string>();
      let laserSwept = false;
      const initialLaser = state.boss!.laserAngle;

      // Run Phase 1 for 7 seconds (420 ticks) so every boss executes multiple full attack cycles
      for (let t = 0; t < 420; t++) {
        engine.step(state, createEmptyInputFrame(), catalog);
        observedStates.add(state.boss!.state);
        for (const p of state.projectiles) {
          observedProjectiles.add(p.kind);
        }
        if (Math.abs(state.boss!.laserAngle - initialLaser) > 0.2) {
          laserSwept = true;
        }
      }

      // Every boss must transition across multiple distinct states & spawn projectiles
      expect(observedStates.size, `${def.id} should visit multiple AI states`).toBeGreaterThanOrEqual(3);
      expect(observedProjectiles.size, `${def.id} should emit attack projectiles`).toBeGreaterThanOrEqual(1);

      if (def.id === 'primal_eye' || def.id === 'electro_sphinx') {
        expect(laserSwept, `${def.id} should sweep laserAngle`).toBe(true);
      }

      // Drop boss into Phase 2 (<= 66% HP)
      state.boss!.shieldActive = false;
      state.boss!.invulnTimer = 0;
      const dmgToP2 = Math.ceil(def.maxHp * 0.4);
      damageBoss(state, state.boss!, dmgToP2, catalog, room, [], true);
      expect(state.boss!.phase, `${def.id} enters Phase 2`).toBe(2);

      // Drop boss into Phase 3 (<= 33% HP)
      state.boss!.shieldActive = false;
      state.boss!.invulnTimer = 0;
      const dmgToP3 = Math.max(1, state.boss!.hp - Math.max(1, Math.floor(def.maxHp * 0.25)));
      damageBoss(state, state.boss!, dmgToP3, catalog, room, [], true);
      expect(state.boss!.phase, `${def.id} enters Phase 3`).toBe(3);

      // Step Phase 3 cleanly
      stepN(engine, state, catalog, 60);

      // Defeat boss
      state.boss!.shieldActive = false;
      state.boss!.invulnTimer = 0;
      const defeatEvents: SimEvent[] = [];
      damageBoss(state, state.boss!, state.boss!.hp, catalog, room, defeatEvents, true);

      expect(state.boss!.defeated).toBe(true);
      expect(state.progress.defeatedBosses).toContain(def.id);
      expect(defeatEvents.some((e) => e.type === 'boss_defeated' && e.bossId === def.id)).toBe(true);

      const expectedForm = expectedUnlocks[def.id];
      if (expectedForm) {
        expect(state.progress.unlockedForms).toContain(expectedForm);
      }

      if (def.id === 'nightmare_sovereign') {
        expect(state.victoryTriggered).toBe(true);
        expect(defeatEvents.some((e) => e.type === 'victory' && e.mode === 'story')).toBe(true);
      }
    }
  });

  it('executes mecha_bull signature telegraph -> shielded drill_charge -> wall crash -> stunned vulnerability window', () => {
    const catalog = makeCombatCatalog();
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, { roomId: 'lab_boss', seed: 77 });
    const room = catalog.getRoom('lab_boss');
    state.hero.invulnTimer = 20.0;

    let sawTelegraph = false;
    let sawShieldedCharge = false;
    let blockedWhileCharging = false;
    let sawStunnedWindow = false;
    let damagedWhileStunned = false;

    for (let t = 0; t < 280; t++) {
      engine.step(state, createEmptyInputFrame(), catalog);
      const b = state.boss!;
      if (b.state === 'telegraph') {
        sawTelegraph = true;
      }
      if (b.state === 'drill_charge' && b.shieldActive) {
        sawShieldedCharge = true;
        const hpBefore = b.hp;
        const hit = damageBoss(state, b, 2, catalog, room, [], true);
        if (!hit && b.hp === hpBefore) {
          blockedWhileCharging = true;
        }
      }
      if (b.state === 'stunned' && !b.shieldActive) {
        sawStunnedWindow = true;
        if (!damagedWhileStunned) {
          const hpBefore = b.hp;
          b.invulnTimer = 0;
          const hit = damageBoss(state, b, 2, catalog, room, [], true);
          if (hit && b.hp === hpBefore - 2) {
            damagedWhileStunned = true;
          }
        }
      }
    }

    expect(sawTelegraph).toBe(true);
    expect(sawShieldedCharge).toBe(true);
    expect(blockedWhileCharging).toBe(true);
    expect(sawStunnedWindow).toBe(true);
    expect(damagedWhileStunned).toBe(true);
  });

  it('executes nightmare_sovereign arenaMorphPhase 1 -> 2 -> 3, shield break, homing missiles, and Shadow Form victory', () => {
    const catalog = makeCombatCatalog();
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, { roomId: 'evil_boss', seed: 99 });
    const room = catalog.getRoom('evil_boss');
    const boss = state.boss!;
    state.hero.invulnTimer = 30.0;

    // Phase 1 morph initialized on spawn
    expect(boss.arenaMorphPhase).toBe(1);
    expect(state.platforms.length).toBeGreaterThanOrEqual(3);
    expect(state.platforms[0].kind).toBe('moving_platform');
    expect(state.platforms[0].moveDy).toBe(0);

    // Run until shield_phase activates, then shatter shield with heavy strike!
    let sawShield = false;
    let shatteredShield = false;
    let sawHomingMissile = false;

    for (let t = 0; t < 600; t++) {
      engine.step(state, createEmptyInputFrame(), catalog);
      if (boss.shieldActive && !shatteredShield) {
        sawShield = true;
        boss.invulnTimer = 0;
        const ev: SimEvent[] = [];
        damageBoss(state, boss, 2, catalog, room, ev, true);
        if (!boss.shieldActive && boss.state === 'vulnerable') {
          shatteredShield = true;
        }
      }
      if (state.projectiles.some((p) => p.kind === 'missile' && p.homing)) {
        sawHomingMissile = true;
      }
    }

    expect(sawShield).toBe(true);
    expect(shatteredShield).toBe(true);
    expect(sawHomingMissile).toBe(true);

    // Transition to Phase 2 -> arenaMorphPhase === 2 (vertical eclipse elevators!)
    boss.shieldActive = false;
    boss.invulnTimer = 0;
    damageBoss(state, boss, 12, catalog, room, [], true); // 30 -> 18 (60% -> Phase 2)
    expect(boss.phase).toBe(2);
    expect(boss.arenaMorphPhase).toBe(2);
    expect(state.platforms[0].moveDy).toBeGreaterThan(0);

    // Transition to Phase 3 -> arenaMorphPhase === 3 (orbital spinning platforms!)
    boss.shieldActive = false;
    boss.invulnTimer = 0;
    damageBoss(state, boss, 10, catalog, room, [], true); // 18 -> 8 (26.6% -> Phase 3)
    expect(boss.phase).toBe(3);
    expect(boss.arenaMorphPhase).toBe(3);
    expect(state.platforms[0].kind).toBe('spinning_platform');

    // Step platforms to confirm dynamic movement in Phase 3
    const p0x = state.platforms[0].x;
    const p0y = state.platforms[0].y;
    stepN(engine, state, catalog, 20);
    expect(Math.hypot(state.platforms[0].x - p0x, state.platforms[0].y - p0y)).toBeGreaterThan(0.2);

    // Final blow unlocks krunk_shadow + triggers Victory!
    boss.shieldActive = false;
    boss.invulnTimer = 0;
    const winEvents: SimEvent[] = [];
    damageBoss(state, boss, boss.hp, catalog, room, winEvents, true);
    expect(state.progress.unlockedForms).toContain('krunk_shadow');
    expect(state.victoryTriggered).toBe(true);
    expect(winEvents.some((e) => e.type === 'victory')).toBe(true);
  });
});

// ============================================================================
// 3. Ghost Ship Endless (15 Escalating Waves + 3-Tier Hazards), Boss Rush, Time Attack
// ============================================================================

describe('Special Modes: Ghost Ship Endless, Boss Rush & Time Attack', () => {
  it('clears 15 escalating Ghost Ship waves with 3-tier dynamic hazard cycles, crystal/score bonuses & progress tracking', () => {
    const catalog = makeCombatCatalog();
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, { seed: 2026 });

    engine.startGhostShip(state, catalog);
    expect(state.mode).toBe('ghost_ship');
    expect(state.ghostShip.active).toBe(true);
    expect(state.ghostShip.wave).toBe(1);
    expect(state.ghostShip.hazardTier).toBe(0);

    const seenTiers = new Set<number>([state.ghostShip.hazardTier]);
    let sawTier1DeckSpikes = false;
    let sawTier2DeckSpikes = false;
    let sawTier2Platforms = false;
    const room = catalog.getRoom(state.roomId);

    for (let waveNum = 1; waveNum <= 15; waveNum++) {
      expect(state.ghostShip.wave).toBe(waveNum);
      expect(state.enemies.length).toBeGreaterThanOrEqual(3);
      seenTiers.add(state.ghostShip.hazardTier);

      // Keep hero parked safely at center spawn while observing hazard pulses
      state.hero.x = room.defaultSpawnX;
      state.hero.y = room.defaultSpawnY;
      state.hero.invulnTimer = 5.0;

      // Simulate ~2.5s on tier 1 (wave 3) and tier 2 (wave 6) to observe dynamic spike/platform cycles
      if (waveNum === 3 || waveNum === 6) {
        for (let t = 0; t < 210; t++) {
          engine.step(state, createEmptyInputFrame(), catalog);
          let hasSpike = false;
          for (let idx = 0; idx < state.roomTiles.length; idx++) {
            if (state.roomTiles[idx] === TileCode.Spike) {
              hasSpike = true;
              break;
            }
          }
          if (waveNum === 3 && hasSpike) sawTier1DeckSpikes = true;
          if (waveNum === 6 && hasSpike) sawTier2DeckSpikes = true;
          if (waveNum === 6 && state.platforms.length >= 2) sawTier2Platforms = true;
        }
      }

      // Clear all enemies in the wave (including any split mini_jellies if big_jelly spawned!)
      const crystalsBefore = state.progress.crystals;
      const scoreBefore = state.ghostShip.score;
      let guard = 0;
      while (state.enemies.some((e) => e.alive) && guard < 10) {
        guard++;
        const len = state.enemies.length;
        for (let i = 0; i < len; i++) {
          const e = state.enemies[i];
          if (e.alive) {
            damageEnemy(state, e, 99, catalog, room, []);
          }
        }
      }
      expect(state.enemies.every((e) => !e.alive)).toBe(true);

      // Step through the 1.0s wave-clear breather (flush any hitstop/slowmo cleanly)
      state.hitstopTicks = 0;
      state.slowmoTimer = 0;
      state.slowmoScale = 1.0;
      stepN(engine, state, catalog, 65);

      expect(state.ghostShip.wave).toBe(waveNum + 1);
      expect(state.ghostShip.score).toBeGreaterThan(scoreBefore);
      expect(state.progress.crystals).toBeGreaterThan(crystalsBefore);
    }

    expect(seenTiers.has(0)).toBe(true);
    expect(seenTiers.has(1)).toBe(true);
    expect(seenTiers.has(2)).toBe(true);
    expect(sawTier1DeckSpikes).toBe(true);
    expect(sawTier2DeckSpikes).toBe(true);
    expect(sawTier2Platforms).toBe(true);
    expect(state.progress.ghostShipBestWave).toBeGreaterThanOrEqual(15);
    expect(state.progress.ghostShipHighScore).toBe(state.ghostShip.score);
    expect(state.progress.ghostShipHighScore).toBeGreaterThan(15000);
  });

  it('supports Boss Rush rematch for all 8 bosses even after story defeat and resets boss HP & arena cleanly', () => {
    const catalog = makeCombatCatalog();
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, {
      progress: {
        defeatedBosses: BOSS_DEFS.map((b) => b.id),
      },
    });

    for (const def of BOSS_DEFS) {
      const ev = engine.startBossRush(state, catalog, def.id);
      expect(state.mode).toBe('boss_rush');
      expect(state.roomId).toBe(def.roomId);
      expect(state.boss).not.toBeNull();
      expect(state.boss!.id).toBe(def.id);
      expect(state.boss!.hp).toBe(def.maxHp);
      expect(state.boss!.phase).toBe(1);
      expect(state.boss!.defeated).toBe(false);
      expect(state.victoryTriggered).toBe(false);
      expect(ev.some((e) => e.type === 'room_change' && e.toRoomId === def.roomId)).toBe(true);
    }
  });

  it('tracks Time Attack ticks cleanly and records bestTimeAttackTicks on victory', () => {
    const catalog = makeCombatCatalog();
    const engine = createSimEngine();
    const state = engine.createInitialState(catalog, { seed: 303 });

    engine.startTimeAttack(state, catalog);
    expect(state.mode).toBe('time_attack');
    expect(state.roomId).toBe(catalog.startRoomId);
    expect(state.timeAttackTicks).toBe(0);

    stepN(engine, state, catalog, 45);
    expect(state.timeAttackTicks).toBe(45);

    // Warp to Primal Eye boss room & defeat to finish Time Attack run #1
    engine.warpToRoom(state, catalog, 'ap_boss');
    stepN(engine, state, catalog, 15);
    expect(state.timeAttackTicks).toBe(60);

    const room = catalog.getRoom('ap_boss');
    state.boss!.shieldActive = false;
    state.boss!.invulnTimer = 0;
    const winEv: SimEvent[] = [];
    damageBoss(state, state.boss!, state.boss!.hp, catalog, room, winEv, true);

    expect(state.victoryTriggered).toBe(true);
    expect(state.progress.bestTimeAttackTicks).toBe(60);
    expect(winEv.some((e) => e.type === 'victory' && e.mode === 'time_attack' && e.ticks === 60)).toBe(true);

    // Ticks stop advancing after victory
    stepN(engine, state, catalog, 10);
    expect(state.timeAttackTicks).toBe(60);

    // Faster Time Attack run #2 beats record (25 ticks < 60 ticks)
    engine.startTimeAttack(state, catalog);
    expect(state.timeAttackTicks).toBe(0);
    engine.warpToRoom(state, catalog, 'ap_boss');
    stepN(engine, state, catalog, 25);
    state.boss!.invulnTimer = 0;
    damageBoss(state, state.boss!, state.boss!.hp, catalog, room, [], true);
    expect(state.progress.bestTimeAttackTicks).toBe(25);
  });
});

// ============================================================================
// 4. Bit-for-Bit Combat, Boss & Ghost Ship Determinism
// ============================================================================

describe('Combat, Boss & Ghost Ship Replay Determinism', () => {
  it('produces identical hashState() sequences across two seeded replays of Nightmare Sovereign and Ghost Ship', () => {
    const catalog = makeCombatCatalog();
    const engine = createSimEngine();

    const runBossReplay = () => {
      const state = engine.createInitialState(catalog, {
        seed: 0xbeefcafe,
        roomId: 'evil_boss',
        progress: { unlockedForms: ['krunk_basic', 'krunk_fire', 'krunk_shadow'] },
      });
      const hashes: number[] = [];
      for (let t = 0; t < 180; t++) {
        const input: InputFrame = {
          ...createEmptyInputFrame(),
          moveX: t % 60 < 30 ? 1 : -1,
          jumpPressed: t % 35 === 5,
          jumpHeld: t % 35 >= 5 && t % 35 < 16,
          dashPressed: t % 50 === 20,
          stompPressed: t % 70 === 40,
        };
        engine.step(state, input, catalog);
        hashes.push(engine.hashState(state));
      }
      return hashes;
    };

    const bossRun1 = runBossReplay();
    const bossRun2 = runBossReplay();
    expect(bossRun1).toEqual(bossRun2);
    expect(new Set(bossRun1).size).toBeGreaterThan(80);

    const runGhostShipReplay = () => {
      const state = engine.createInitialState(catalog, { seed: 0x1337c0de });
      engine.startGhostShip(state, catalog);
      const hashes: number[] = [];
      for (let t = 0; t < 150; t++) {
        const input: InputFrame = {
          ...createEmptyInputFrame(),
          moveX: t < 75 ? 1 : -1,
          jumpPressed: t === 15 || t === 60 || t === 105,
          dashPressed: t === 30 || t === 90,
        };
        engine.step(state, input, catalog);
        hashes.push(engine.hashState(state));
      }
      return hashes;
    };

    const gs1 = runGhostShipReplay();
    const gs2 = runGhostShipReplay();
    expect(gs1).toEqual(gs2);
    expect(new Set(gs1).size).toBeGreaterThan(80);
  });
});
