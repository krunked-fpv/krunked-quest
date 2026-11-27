import type { SimState } from '../contracts/index';
import { ALL_UPGRADE_KEYS } from './constants';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnvByte(h: number, byte: number): number {
  return Math.imul((h ^ (byte & 0xff)) >>> 0, FNV_PRIME) >>> 0;
}

function fnvInt32(h: number, value: number): number {
  const v = value | 0;
  h = fnvByte(h, v & 0xff);
  h = fnvByte(h, (v >>> 8) & 0xff);
  h = fnvByte(h, (v >>> 16) & 0xff);
  h = fnvByte(h, (v >>> 24) & 0xff);
  return h;
}

function fnvFloat(h: number, value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    return fnvInt32(h, 0);
  }
  return fnvInt32(h, Math.round(value * 10000));
}

function fnvString(h: number, str: string): number {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    h = fnvByte(h, code & 0xff);
    if (code > 0xff) {
      h = fnvByte(h, (code >>> 8) & 0xff);
    }
  }
  return fnvByte(h, 0xff);
}

/**
 * Computes a deterministic 32-bit FNV-1a digest over all authoritative simulation state.
 */
export function hashState(state: SimState): number {
  let h = FNV_OFFSET_BASIS;

  h = fnvInt32(h, state.tick);
  h = fnvInt32(h, state.rngState);
  h = fnvString(h, state.mode);
  h = fnvString(h, state.roomId);
  h = fnvString(h, state.biome);
  h = fnvInt32(h, state.hitstopTicks);
  h = fnvInt32(h, state.timeAttackTicks);
  h = fnvFloat(h, state.lavaY);
  h = fnvByte(h, state.victoryTriggered ? 1 : 0);
  h = fnvByte(h, state.gameOverTriggered ? 1 : 0);

  // Hero state
  const hero = state.hero;
  h = fnvFloat(h, hero.x);
  h = fnvFloat(h, hero.y);
  h = fnvFloat(h, hero.vx);
  h = fnvFloat(h, hero.vy);
  h = fnvInt32(h, hero.facing);
  h = fnvString(h, hero.form);
  h = fnvString(h, hero.action);
  h = fnvInt32(h, hero.hp);
  h = fnvInt32(h, hero.maxHp);
  h = fnvByte(h, hero.grounded ? 1 : 0);
  h = fnvInt32(h, hero.onWall);
  h = fnvByte(h, hero.onVine ? 1 : 0);
  h = fnvInt32(h, hero.jumpsRemaining);
  h = fnvFloat(h, hero.invulnTimer);
  h = fnvByte(h, hero.rockShieldActive ? 1 : 0);
  h = fnvFloat(h, hero.magicShieldTimer);
  h = fnvByte(h, hero.rebirthUsed ? 1 : 0);
  h = fnvByte(h, hero.platinumShieldUsed ? 1 : 0);
  h = fnvFloat(h, hero.abilityTimer);
  h = fnvInt32(h, hero.abilityPhase);
  h = fnvString(h, hero.tongueKind);
  h = fnvFloat(h, hero.tongueTimer);
  h = fnvFloat(h, hero.stompSpamTimer);
  h = fnvFloat(h, hero.preStompTimer);
  h = fnvFloat(h, hero.wallSlideCoyoteTimer);
  h = fnvInt32(h, hero.wallSlideDir);
  h = fnvByte(h, hero.wallSalivaActive ? 1 : 0);
  h = fnvFloat(h, hero.fireImmunityTimer);
  h = fnvFloat(h, hero.oneWayDropTimer);

  // Combo state
  const combo = state.combo;
  h = fnvString(h, combo.preset);
  h = fnvInt32(h, combo.count);
  h = fnvInt32(h, combo.maxSceneCombo);
  h = fnvFloat(h, combo.timer);
  h = fnvFloat(h, combo.freezeTimer);
  h = fnvByte(h, combo.roomComboCleared ? 1 : 0);

  // Progress counts & economy
  const p = state.progress;
  h = fnvInt32(h, p.crystals);
  h = fnvInt32(h, p.collectedCoinIds.length);
  h = fnvInt32(h, p.unlockedForms.length);
  h = fnvInt32(h, p.ownedRelics.length);
  h = fnvInt32(h, p.equippedRelics.length);
  h = fnvInt32(h, p.defeatedBosses.length);
  h = fnvInt32(h, p.visitedRooms.length);
  h = fnvInt32(h, p.unlockedTeleporters.length);
  h = fnvInt32(h, p.rescuedAnimals.length);
  h = fnvInt32(h, p.clearedComboRooms.length);
  h = fnvInt32(h, p.openedChests.length);
  for (let i = 0; i < ALL_UPGRADE_KEYS.length; i++) {
    h = fnvByte(h, p.upgradeLevels[ALL_UPGRADE_KEYS[i]] ?? 0);
  }

  // Enemies
  h = fnvInt32(h, state.enemies.length);
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    h = fnvString(h, e.id);
    h = fnvFloat(h, e.x);
    h = fnvFloat(h, e.y);
    h = fnvFloat(h, e.vx);
    h = fnvFloat(h, e.vy);
    h = fnvInt32(h, e.hp);
    h = fnvByte(h, e.alive ? 1 : 0);
    h = fnvInt32(h, e.facing);
  }

  // Boss
  if (state.boss) {
    const b = state.boss;
    h = fnvByte(h, 1);
    h = fnvString(h, b.id);
    h = fnvFloat(h, b.x);
    h = fnvFloat(h, b.y);
    h = fnvFloat(h, b.vx);
    h = fnvFloat(h, b.vy);
    h = fnvInt32(h, b.hp);
    h = fnvInt32(h, b.phase);
    h = fnvString(h, b.state);
    h = fnvByte(h, b.defeated ? 1 : 0);
  } else {
    h = fnvByte(h, 0);
  }

  // Coins
  h = fnvInt32(h, state.coins.length);
  for (let i = 0; i < state.coins.length; i++) {
    const c = state.coins[i];
    h = fnvString(h, c.id);
    h = fnvByte(h, c.collected ? 1 : 0);
  }

  // Crystals
  h = fnvInt32(h, state.crystals.length);
  for (let i = 0; i < state.crystals.length; i++) {
    const cr = state.crystals[i];
    h = fnvFloat(h, cr.x);
    h = fnvFloat(h, cr.y);
    h = fnvInt32(h, cr.value);
    h = fnvByte(h, cr.collected ? 1 : 0);
  }

  // Projectiles
  h = fnvInt32(h, state.projectiles.length);
  for (let i = 0; i < state.projectiles.length; i++) {
    const pr = state.projectiles[i];
    h = fnvInt32(h, pr.id);
    h = fnvFloat(h, pr.x);
    h = fnvFloat(h, pr.y);
    h = fnvByte(h, pr.fromHero ? 1 : 0);
  }

  // Moving platforms
  h = fnvInt32(h, state.platforms.length);
  for (let i = 0; i < state.platforms.length; i++) {
    const pl = state.platforms[i];
    h = fnvFloat(h, pl.x);
    h = fnvFloat(h, pl.y);
  }

  // Mutable room tile state (breakables, crumbles, explosives)
  h = fnvInt32(h, state.roomTiles.length);
  for (let i = 0; i < state.roomTiles.length; i++) {
    h = fnvByte(h, state.roomTiles[i]);
  }

  // Ghost Ship
  h = fnvByte(h, state.ghostShip.active ? 1 : 0);
  h = fnvInt32(h, state.ghostShip.wave);
  h = fnvInt32(h, state.ghostShip.score);

  return h >>> 0;
}
