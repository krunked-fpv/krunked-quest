import {
  TileCode,
  type HeroActionState,
  type InteractivePropDef,
  type MovingPlatformRuntime,
  type RoomDef,
  type SimEvent,
  type SimState,
} from '../contracts/index';
import { PHYSICS, SIM_RULES } from './constants';

export interface BlastCircle {
  x: number;
  y: number;
  radius: number;
}

export interface MoveResult {
  hitWall: -1 | 0 | 1;
  hitCeiling: boolean;
  landed: boolean;
  hitBounce: boolean;
  cornerNudged: boolean;
  brokeTile: boolean;
  hitHazard: 'spike' | 'acid' | 'lava' | null;
  steppedCrumbleIndices: number[];
  explosions: BlastCircle[];
}

export function getTileAt(
  tiles: Uint8Array,
  width: number,
  height: number,
  tx: number,
  ty: number,
): TileCode {
  if (tx < 0 || tx >= width || ty < 0 || ty >= height) {
    return TileCode.Empty;
  }
  return tiles[ty * width + tx] as TileCode;
}

export function isSolidTile(tile: TileCode): boolean {
  return (
    tile === TileCode.Solid ||
    tile === TileCode.Spike ||
    tile === TileCode.Breakable ||
    tile === TileCode.StoneOverhead ||
    tile === TileCode.Bounce ||
    tile === TileCode.Crumble ||
    tile === TileCode.Explosive
  );
}

export function isWallSlideTile(tile: TileCode): boolean {
  return (
    tile === TileCode.Solid ||
    tile === TileCode.Breakable ||
    tile === TileCode.StoneOverhead ||
    tile === TileCode.Bounce ||
    tile === TileCode.Crumble ||
    tile === TileCode.Explosive
  );
}

export function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function canBreakTileHoriz(action: HeroActionState, tile: TileCode): boolean {
  if (tile === TileCode.Breakable || tile === TileCode.Explosive) {
    return (
      action === 'ground_dash' ||
      action === 'wall_dash' ||
      action === 'fire_dash' ||
      action === 'volt_blink' ||
      action === 'shadow_blink' ||
      action === 'rock_uppercut'
    );
  }
  if (tile === TileCode.StoneOverhead) {
    return action === 'rock_uppercut';
  }
  return false;
}

function canBreakTileUp(action: HeroActionState, tile: TileCode): boolean {
  if (tile === TileCode.StoneOverhead) {
    return action === 'rock_uppercut';
  }
  if (tile === TileCode.Breakable || tile === TileCode.Explosive) {
    return (
      action === 'rock_uppercut' ||
      action === 'fire_dash' ||
      action === 'volt_blink' ||
      action === 'shadow_blink'
    );
  }
  return false;
}

function canBreakTileDown(action: HeroActionState, tile: TileCode): boolean {
  if (tile === TileCode.Breakable || tile === TileCode.Explosive) {
    return (
      action === 'air_stomp' ||
      action === 'volt_blink' ||
      action === 'shadow_blink'
    );
  }
  return false;
}

function isClosedDoorProp(prop: InteractivePropDef, state: SimState): boolean {
  if (prop.kind === 'target_door') {
    return !state.openedDoors.includes(prop.id);
  }
  if (prop.kind === 'coin_door') {
    const req = prop.requiredCoins ?? 0;
    return !state.openedDoors.includes(prop.id) && state.progress.collectedCoinIds.length < req;
  }
  return false;
}

export function breakTileAt(
  state: SimState,
  room: RoomDef,
  tx: number,
  ty: number,
  events: SimEvent[],
  explosions: BlastCircle[],
): boolean {
  if (tx < 0 || tx >= room.widthTiles || ty < 0 || ty >= room.heightTiles) {
    return false;
  }
  const idx = ty * room.widthTiles + tx;
  const tile = state.roomTiles[idx] as TileCode;
  if (
    tile !== TileCode.Breakable &&
    tile !== TileCode.StoneOverhead &&
    tile !== TileCode.Crumble &&
    tile !== TileCode.Explosive
  ) {
    return false;
  }

  const explosive = tile === TileCode.Explosive;
  state.roomTiles[idx] = TileCode.Empty;
  if (tile === TileCode.Crumble) {
    state.crumbleTimers[idx] = -SIM_RULES.CRUMBLE_RESPAWN_TIME;
  }

  const cx = tx + 0.5;
  const cy = ty + 0.5;
  events.push({ type: 'block_break', x: cx, y: cy, explosive });

  if (explosive) {
    explosions.push({ x: cx, y: cy, radius: SIM_RULES.EXPLOSIVE_RADIUS });
    state.camera.shakeTimer = Math.max(state.camera.shakeTimer, 0.24);
    state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, 0.28);
    breakTilesInRadius(state, room, cx, cy, SIM_RULES.EXPLOSIVE_RADIUS, events, explosions);
  }

  return true;
}

export function breakTilesInRadius(
  state: SimState,
  room: RoomDef,
  cx: number,
  cy: number,
  radius: number,
  events: SimEvent[],
  explosions: BlastCircle[],
): boolean {
  let brokeAny = false;
  const minTx = Math.max(0, Math.floor(cx - radius));
  const maxTx = Math.min(room.widthTiles - 1, Math.floor(cx + radius));
  const minTy = Math.max(0, Math.floor(cy - radius));
  const maxTy = Math.min(room.heightTiles - 1, Math.floor(cy + radius));
  const r2 = radius * radius;

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const dx = tx + 0.5 - cx;
      const dy = ty + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        if (breakTileAt(state, room, tx, ty, events, explosions)) {
          brokeAny = true;
        }
      }
    }
  }
  return brokeAny;
}

function overlapsAnySolidTile(
  tiles: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const skin = SIM_RULES.TILE_SKIN;
  const minTx = Math.floor(x + skin);
  const maxTx = Math.floor(x + w - skin);
  const minTy = Math.floor(y + skin);
  const maxTy = Math.floor(y + h - skin);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (isSolidTile(getTileAt(tiles, width, height, tx, ty))) {
        return true;
      }
    }
  }
  return false;
}

function getBlockingDoors(state: SimState, room: RoomDef): InteractivePropDef[] {
  const doors: InteractivePropDef[] = [];
  for (let i = 0; i < room.props.length; i++) {
    const p = room.props[i];
    if (isClosedDoorProp(p, state)) {
      doors.push(p);
    }
  }
  return doors;
}

/**
 * Carries the hero with any moving platform they are currently standing on.
 */
export function carryHeroOnMovingPlatforms(state: SimState, room: RoomDef): void {
  const hero = state.hero;
  if (!hero.grounded || state.platforms.length === 0) {
    return;
  }

  for (let i = 0; i < state.platforms.length; i++) {
    const plat = state.platforms[i];
    if (!plat.solid) continue;
    const prevTop = plat.prevY + plat.height;
    const riding =
      Math.abs(hero.y - prevTop) <= 0.1 &&
      hero.x + hero.width > plat.prevX + 0.02 &&
      hero.x < plat.prevX + plat.width - 0.02;
    if (!riding) continue;

    const dx = plat.x - plat.prevX;
    const dy = plat.y - plat.prevY;
    if (dx !== 0) {
      const nextX = hero.x + dx;
      if (!overlapsAnySolidTile(state.roomTiles, room.widthTiles, room.heightTiles, nextX, hero.y, hero.width, hero.height)) {
        hero.x = nextX;
      }
    }
    if (dy !== 0) {
      const nextY = plat.y + plat.height;
      if (!overlapsAnySolidTile(state.roomTiles, room.widthTiles, room.heightTiles, hero.x, nextY, hero.width, hero.height)) {
        hero.y = nextY;
      }
    }
    break;
  }
}

/**
 * Swept sub-stepped AABB movement with max substep <= PHYSICS.MAX_SUBSTEP_DIST (0.20u).
 * Guarantees zero tunneling even at 45 u/s Volt Blink and 18 u/s Air Stomp.
 */
export function moveHeroWithCollision(
  state: SimState,
  room: RoomDef,
  dx: number,
  dy: number,
  events: SimEvent[],
): MoveResult {
  const hero = state.hero;
  const w = hero.width;
  const h = hero.height;
  const tiles = state.roomTiles;
  const rw = room.widthTiles;
  const rh = room.heightTiles;
  const skin = SIM_RULES.TILE_SKIN;
  const wasGrounded = hero.grounded;

  const result: MoveResult = {
    hitWall: 0,
    hitCeiling: false,
    landed: false,
    hitBounce: false,
    cornerNudged: false,
    brokeTile: false,
    hitHazard: null,
    steppedCrumbleIndices: [],
    explosions: [],
  };

  const maxDisp = Math.max(Math.abs(dx), Math.abs(dy));
  const steps = Math.max(1, Math.ceil(maxDisp / PHYSICS.MAX_SUBSTEP_DIST));
  let stepDx = dx / steps;
  let stepDy = dy / steps;
  const doors = getBlockingDoors(state, room);

  let groundedThisMove = false;

  for (let s = 0; s < steps; s++) {
    // ---- Horizontal substep ----
    if (stepDx !== 0) {
      hero.x += stepDx;
      const minTy = Math.floor(hero.y + skin);
      const maxTy = Math.floor(hero.y + h - skin);

      if (stepDx > 0) {
        const rightTx = Math.floor(hero.x + w - skin);
        let blocked = false;
        for (let ty = minTy; ty <= maxTy; ty++) {
          const tile = getTileAt(tiles, rw, rh, rightTx, ty);
          if (!isSolidTile(tile)) continue;
          if (canBreakTileHoriz(hero.action, tile)) {
            breakTileAt(state, room, rightTx, ty, events, result.explosions);
            result.brokeTile = true;
            continue;
          }
          if (tile === TileCode.Spike) {
            result.hitHazard = 'spike';
          }
          blocked = true;
        }
        if (blocked) {
          hero.x = rightTx - w;
          hero.vx = 0;
          stepDx = 0;
          result.hitWall = 1;
        }
      } else {
        const leftTx = Math.floor(hero.x + skin);
        let blocked = false;
        for (let ty = minTy; ty <= maxTy; ty++) {
          const tile = getTileAt(tiles, rw, rh, leftTx, ty);
          if (!isSolidTile(tile)) continue;
          if (canBreakTileHoriz(hero.action, tile)) {
            breakTileAt(state, room, leftTx, ty, events, result.explosions);
            result.brokeTile = true;
            continue;
          }
          if (tile === TileCode.Spike) {
            result.hitHazard = 'spike';
          }
          blocked = true;
        }
        if (blocked) {
          hero.x = leftTx + 1;
          hero.vx = 0;
          stepDx = 0;
          result.hitWall = -1;
        }
      }

      // Closed doors horizontal block
      for (let d = 0; d < doors.length && stepDx !== 0; d++) {
        const door = doors[d];
        const dw = door.width ?? 1;
        const dh = door.height ?? 2;
        if (aabbOverlap(hero.x, hero.y + skin, w, h - skin * 2, door.x, door.y, dw, dh)) {
          if (stepDx > 0) {
            hero.x = door.x - w;
            result.hitWall = 1;
          } else {
            hero.x = door.x + dw;
            result.hitWall = -1;
          }
          hero.vx = 0;
          stepDx = 0;
        }
      }
    }

    // ---- Vertical substep ----
    if (stepDy !== 0) {
      const prevBottom = hero.y;
      hero.y += stepDy;

      if (stepDy > 0) {
        const topTy = Math.floor(hero.y + h - skin);
        const minTx = Math.floor(hero.x + skin);
        const maxTx = Math.floor(hero.x + w - skin);

        let blockedTiles = 0;
        let firstBlockedTx = -1;
        let lastBlockedTx = -1;

        for (let tx = minTx; tx <= maxTx; tx++) {
          const tile = getTileAt(tiles, rw, rh, tx, topTy);
          if (!isSolidTile(tile)) continue;
          if (canBreakTileUp(hero.action, tile)) {
            breakTileAt(state, room, tx, topTy, events, result.explosions);
            result.brokeTile = true;
            continue;
          }
          if (tile === TileCode.Spike) {
            result.hitHazard = 'spike';
          }
          blockedTiles++;
          if (firstBlockedTx === -1) firstBlockedTx = tx;
          lastBlockedTx = tx;
        }

        if (blockedTiles > 0) {
          // 0.125u (4px) upward ceiling corner nudge
          let nudged = false;
          const nudgeMax = PHYSICS.CORNER_NUDGE + 1e-4;

          // Case 1: Only right corner clips a ceiling tile -> nudge hero left
          if (firstBlockedTx === lastBlockedTx) {
            const overlapRight = hero.x + w - firstBlockedTx;
            const overlapLeft = firstBlockedTx + 1 - hero.x;

            if (overlapRight > 0 && overlapRight <= nudgeMax) {
              const candX = firstBlockedTx - w;
              if (
                candX >= 0 &&
                !overlapsAnySolidTile(tiles, rw, rh, candX, hero.y, w, h)
              ) {
                hero.x = candX;
                nudged = true;
                result.cornerNudged = true;
              }
            }
            if (!nudged && overlapLeft > 0 && overlapLeft <= nudgeMax) {
              const candX = firstBlockedTx + 1;
              if (
                candX + w <= rw &&
                !overlapsAnySolidTile(tiles, rw, rh, candX, hero.y, w, h)
              ) {
                hero.x = candX;
                nudged = true;
                result.cornerNudged = true;
              }
            }
          }

          if (!nudged) {
            hero.y = topTy - h;
            hero.vy = 0;
            stepDy = 0;
            result.hitCeiling = true;
          }
        }
      } else {
        // Moving downward
        const botTy = Math.floor(hero.y + skin);
        const minTx = Math.floor(hero.x + skin);
        const maxTx = Math.floor(hero.x + w - skin);

        let landedSolid = false;
        let hitBounceTile = false;

        for (let tx = minTx; tx <= maxTx; tx++) {
          const tile = getTileAt(tiles, rw, rh, tx, botTy);

          if (tile === TileCode.OneWay) {
            const tileTop = botTy + 1;
            if (prevBottom >= tileTop - SIM_RULES.ONE_WAY_SNAP_TOLERANCE && hero.y <= tileTop) {
              landedSolid = true;
            }
            continue;
          }

          if (!isSolidTile(tile)) continue;

          if (canBreakTileDown(hero.action, tile)) {
            breakTileAt(state, room, tx, botTy, events, result.explosions);
            result.brokeTile = true;
            continue;
          }

          if (tile === TileCode.Bounce) {
            hitBounceTile = true;
            landedSolid = true;
          } else if (tile === TileCode.Crumble) {
            const idx = botTy * rw + tx;
            if (!result.steppedCrumbleIndices.includes(idx)) {
              result.steppedCrumbleIndices.push(idx);
            }
            landedSolid = true;
          } else if (tile === TileCode.Spike) {
            result.hitHazard = 'spike';
            landedSolid = true;
          } else {
            landedSolid = true;
          }
        }

        if (landedSolid) {
          hero.y = botTy + 1;
          stepDy = 0;
          if (hitBounceTile) {
            result.hitBounce = true;
            groundedThisMove = false;
          } else {
            hero.vy = 0;
            groundedThisMove = true;
          }
        }

        // Moving platforms top-landing check
        if (!landedSolid && state.platforms.length > 0) {
          for (let i = 0; i < state.platforms.length; i++) {
            const plat = state.platforms[i];
            if (!plat.solid) continue;
            const platTop = plat.y + plat.height;
            if (
              hero.x + w > plat.x + skin &&
              hero.x < plat.x + plat.width - skin &&
              prevBottom >= platTop - SIM_RULES.ONE_WAY_SNAP_TOLERANCE - 0.04 &&
              hero.y <= platTop
            ) {
              hero.y = platTop;
              hero.vy = 0;
              stepDy = 0;
              groundedThisMove = true;
              break;
            }
          }
        }
      }
    }

    // Crusher platform squeeze check
    for (let i = 0; i < state.platforms.length; i++) {
      const plat: MovingPlatformRuntime = state.platforms[i];
      if (plat.kind !== 'crusher' || !plat.solid) continue;
      if (aabbOverlap(hero.x + 0.05, hero.y + 0.05, w - 0.1, h - 0.1, plat.x, plat.y, plat.width, plat.height)) {
        result.hitHazard = 'spike';
      }
    }
  }

  // Post-move static ground support check (when vy <= 0 and not bounced)
  if (!result.hitBounce && !groundedThisMove && hero.vy <= 0) {
    const probeY = hero.y - 0.03;
    const botTy = Math.floor(probeY);
    const minTx = Math.floor(hero.x + skin);
    const maxTx = Math.floor(hero.x + w - skin);

    for (let tx = minTx; tx <= maxTx; tx++) {
      const tile = getTileAt(tiles, rw, rh, tx, botTy);
      if (tile === TileCode.OneWay) {
        if (Math.abs(hero.y - (botTy + 1)) <= 0.05) {
          groundedThisMove = true;
        }
      } else if (isSolidTile(tile)) {
        if (tile === TileCode.Bounce) {
          continue;
        }
        if (canBreakTileDown(hero.action, tile)) {
          continue;
        }
        if (tile === TileCode.Crumble) {
          const idx = botTy * rw + tx;
          if (!result.steppedCrumbleIndices.includes(idx)) {
            result.steppedCrumbleIndices.push(idx);
          }
        } else if (tile === TileCode.Spike) {
          result.hitHazard = 'spike';
        }
        groundedThisMove = true;
      }
    }

    if (!groundedThisMove) {
      for (let i = 0; i < state.platforms.length; i++) {
        const plat = state.platforms[i];
        if (!plat.solid) continue;
        const platTop = plat.y + plat.height;
        if (
          hero.x + w > plat.x + skin &&
          hero.x < plat.x + plat.width - skin &&
          Math.abs(hero.y - platTop) <= 0.06
        ) {
          groundedThisMove = true;
          break;
        }
      }
    }
  }

  hero.grounded = groundedThisMove;
  result.landed = !wasGrounded && groundedThisMove;

  // Sense zones & hazards across hero body
  senseHeroZones(state, room, result);

  // Keep quicksand at floor row from letting hero drop out of world
  if (hero.inQuicksand && hero.y < 0.05) {
    const botRowTx = Math.floor(hero.x + w * 0.5);
    if (getTileAt(tiles, rw, rh, botRowTx, 0) === TileCode.Quicksand) {
      hero.y = 0.05;
      if (hero.vy < 0) hero.vy = 0;
      hero.grounded = true;
    }
  }

  return result;
}

export function detectAdjacentWall(
  state: SimState,
  room: RoomDef,
  preferDir: number,
): -1 | 0 | 1 {
  const hero = state.hero;
  if (hero.grounded) return 0;

  const tiles = state.roomTiles;
  const rw = room.widthTiles;
  const rh = room.heightTiles;
  const probe = 0.06;
  const minTy = Math.floor(hero.y + 0.1);
  const maxTy = Math.floor(hero.y + hero.height - 0.1);

  let leftHit = false;
  const leftTx = Math.floor(hero.x - probe);
  for (let ty = minTy; ty <= maxTy; ty++) {
    if (isWallSlideTile(getTileAt(tiles, rw, rh, leftTx, ty))) {
      leftHit = true;
      break;
    }
  }

  let rightHit = false;
  const rightTx = Math.floor(hero.x + hero.width + probe);
  for (let ty = minTy; ty <= maxTy; ty++) {
    if (isWallSlideTile(getTileAt(tiles, rw, rh, rightTx, ty))) {
      rightHit = true;
      break;
    }
  }

  if (leftHit && rightHit) {
    return preferDir < 0 ? -1 : 1;
  }
  if (leftHit) return -1;
  if (rightHit) return 1;
  return 0;
}

function senseHeroZones(state: SimState, room: RoomDef, result: MoveResult): void {
  const hero = state.hero;
  const tiles = state.roomTiles;
  const rw = room.widthTiles;
  const rh = room.heightTiles;

  let onVine = false;
  let inQuicksand = false;
  let inAntigrav = false;
  let windY = 0;
  let windX = room.sandstormDir ?? 0;

  const minTx = Math.floor(hero.x + 0.04);
  const maxTx = Math.floor(hero.x + hero.width - 0.04);
  const minTy = Math.floor(hero.y + 0.04);
  const maxTy = Math.floor(hero.y + hero.height - 0.04);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const tile = getTileAt(tiles, rw, rh, tx, ty);
      switch (tile) {
        case TileCode.Vine:
          onVine = true;
          break;
        case TileCode.Quicksand:
          inQuicksand = true;
          break;
        case TileCode.Antigrav:
          inAntigrav = true;
          break;
        case TileCode.WindUp:
          windY = 1;
          break;
        case TileCode.WindLeft:
          windX = -1;
          break;
        case TileCode.WindRight:
          windX = 1;
          break;
        case TileCode.Acid:
          if (!result.hitHazard) result.hitHazard = 'acid';
          break;
        case TileCode.Lava:
          if (!result.hitHazard) result.hitHazard = 'lava';
          break;
        case TileCode.Spike:
          result.hitHazard = 'spike';
          break;
        default:
          break;
      }
    }
  }

  // Side probe for vines and spikes so brushing against a vine rail or spike face registers cleanly
  if (!onVine) {
    const sideMinTy = Math.floor(hero.y + 0.08);
    const sideMaxTy = Math.floor(hero.y + hero.height - 0.08);
    const leftTx = Math.floor(hero.x - 0.06);
    const rightTx = Math.floor(hero.x + hero.width + 0.06);
    for (let ty = sideMinTy; ty <= sideMaxTy; ty++) {
      if (
        getTileAt(tiles, rw, rh, leftTx, ty) === TileCode.Vine ||
        getTileAt(tiles, rw, rh, rightTx, ty) === TileCode.Vine
      ) {
        onVine = true;
        break;
      }
    }
  }

  if (!result.hitHazard) {
    const spikeMinTx = Math.floor(hero.x - 0.04);
    const spikeMaxTx = Math.floor(hero.x + hero.width + 0.04);
    const spikeMinTy = Math.floor(hero.y - 0.04);
    const spikeMaxTy = Math.floor(hero.y + hero.height + 0.04);
    for (let ty = spikeMinTy; ty <= spikeMaxTy; ty++) {
      for (let tx = spikeMinTx; tx <= spikeMaxTx; tx++) {
        if (getTileAt(tiles, rw, rh, tx, ty) === TileCode.Spike) {
          result.hitHazard = 'spike';
          break;
        }
      }
      if (result.hitHazard) break;
    }
  }

  hero.onVine = onVine;
  hero.inQuicksand = inQuicksand;
  hero.inAntigrav = inAntigrav;
  hero.inWindY = windY;
  hero.inWindX = windX;
}

/**
 * Simple swept collision for patrolling ground enemies and dropped crystals.
 */
export function isTileSolidOrOneWayAt(
  tiles: Uint8Array,
  rw: number,
  rh: number,
  tx: number,
  ty: number,
): boolean {
  const tile = getTileAt(tiles, rw, rh, tx, ty);
  return isSolidTile(tile) || tile === TileCode.OneWay;
}
