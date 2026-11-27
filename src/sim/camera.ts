import type { RoomDef, SimState } from '../contracts/index';
import {
  ARENA_ZOOM,
  PHYSICS,
  PPU,
  SIM_RULES,
  VIEWPORT_TILES_H,
  VIEWPORT_TILES_W,
} from './constants';

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function getRoomTargetZoom(room: RoomDef): number {
  return room.mode === 'arena' || room.mode === 'boss' ? ARENA_ZOOM : 1.0;
}

function clampToRoom(
  x: number,
  y: number,
  room: RoomDef,
  zoom: number,
): { x: number; y: number } {
  const halfW = (VIEWPORT_TILES_W * 0.5) / zoom;
  const halfH = (VIEWPORT_TILES_H * 0.5) / zoom;

  const clampedX =
    room.widthTiles <= halfW * 2
      ? room.widthTiles * 0.5
      : clamp(x, halfW, room.widthTiles - halfW);

  const clampedY =
    room.heightTiles <= halfH * 2
      ? room.heightTiles * 0.5
      : clamp(y, halfH, room.heightTiles - halfH);

  return { x: clampedX, y: clampedY };
}

/**
 * Triggers a crisp, pixel-snapped screen shake with linear intensity decay.
 */
export function triggerCameraShake(
  state: SimState,
  strength: number = SIM_RULES.CAM_SHAKE_STRENGTH,
): void {
  const cam = state.camera;
  const clamped = Math.max(0, Math.min(0.28, strength));
  cam.shakeIntensity = Math.max(cam.shakeIntensity, clamped);
  const dur = clamped / SIM_RULES.CAM_SHAKE_DECAY_RATE;
  cam.shakeTimer = Math.max(cam.shakeTimer, dur);
}

export function snapCameraToHero(state: SimState, room: RoomDef): void {
  const cam = state.camera;
  const hero = state.hero;
  const zoom = getRoomTargetZoom(room);
  cam.zoom = zoom;

  // Centered hero framing — zero directional look-ahead whip on turnarounds
  const targetX = hero.x + hero.width * 0.5;
  const targetY = hero.y + hero.height * 0.5 + 0.45;
  const clamped = clampToRoom(targetX, targetY, room, zoom);

  cam.x = clamped.x;
  cam.y = clamped.y;
  cam.prevX = clamped.x;
  cam.prevY = clamped.y;
  cam.snappedX = Math.round(cam.x * PPU) / PPU;
  cam.snappedY = Math.round(cam.y * PPU) / PPU;
}

export function updateCamera(state: SimState, room: RoomDef, dt: number): void {
  const cam = state.camera;
  const hero = state.hero;

  cam.prevX = cam.x;
  cam.prevY = cam.y;

  const targetZoom = getRoomTargetZoom(room);
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, PHYSICS.CAM_VEL * dt);

  const heroCx = hero.x + hero.width * 0.5;
  const heroCy = hero.y + hero.height * 0.5 + 0.45;

  // Authentic +-1.0u horizontal deadzone with zero turnaround look-ahead whip
  const dx = heroCx - cam.x;
  let rawTargetX = cam.x;
  if (dx > SIM_RULES.CAM_DEADZONE_X) {
    rawTargetX = heroCx - SIM_RULES.CAM_DEADZONE_X;
  } else if (dx < -SIM_RULES.CAM_DEADZONE_X) {
    rawTargetX = heroCx + SIM_RULES.CAM_DEADZONE_X;
  }

  const target = clampToRoom(rawTargetX, heroCy, room, cam.zoom);

  // Stop micro-creeping within 0.10u stop threshold
  const distToTarget = Math.hypot(target.x - cam.x, target.y - cam.y);
  if (distToTarget >= SIM_RULES.CAM_STOP_DIST) {
    const alpha = Math.min(1, PHYSICS.CAM_VEL * dt);
    cam.x += (target.x - cam.x) * alpha;
    cam.y += (target.y - cam.y) * alpha;
  }

  const finalClamped = clampToRoom(cam.x, cam.y, room, cam.zoom);
  cam.x = finalClamped.x;
  cam.y = finalClamped.y;

  // Deterministic pixel-snapped screen shake with linear intensity decay (0.36 u/s)
  let shakeOffX = 0;
  let shakeOffY = 0;
  if (cam.shakeIntensity > 0 || cam.shakeTimer > 0) {
    const currentAmp = cam.shakeIntensity;
    if (currentAmp > 0) {
      shakeOffX = Math.sin(state.tick * 2.17) * currentAmp;
      shakeOffY = Math.cos(state.tick * 3.13) * currentAmp;
      cam.shakeIntensity = Math.max(0, currentAmp - SIM_RULES.CAM_SHAKE_DECAY_RATE * dt);
      cam.shakeTimer = cam.shakeIntensity / SIM_RULES.CAM_SHAKE_DECAY_RATE;
    } else {
      cam.shakeTimer = Math.max(0, cam.shakeTimer - dt);
    }
  }

  cam.snappedX = Math.round((cam.x + shakeOffX) * PPU) / PPU;
  cam.snappedY = Math.round((cam.y + shakeOffY) * PPU) / PPU;
}
