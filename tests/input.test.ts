import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SAVE_STORAGE_KEY,
  type SaveData,
  type VirtualGamepadSnapshot,
} from '../src/contracts/index.js';
import {
  InputOrchestrator,
  TouchOverlay,
  detectGamepadDevice,
  getGlyphsForDevice,
} from '../src/input/index.js';
import {
  SaveManager,
  cloneGameSettings,
  createDefaultProgress,
  type StorageLike,
} from '../src/app/SaveManager.js';

function makeButtons(pressedIndices: number[] = [], total = 16): Array<{ pressed: boolean; value: number }> {
  const pressedSet = new Set(pressedIndices);
  return Array.from({ length: total }, (_, idx) => ({
    pressed: pressedSet.has(idx),
    value: pressedSet.has(idx) ? 1 : 0,
  }));
}

function createMockStorage(): StorageLike & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem(key: string) {
      return raw.has(key) ? (raw.get(key) as string) : null;
    },
    setItem(key: string, value: string) {
      raw.set(key, value);
    },
    removeItem(key: string) {
      raw.delete(key);
    },
  };
}

// Lightweight DOM mock to verify TouchOverlay mounts/unmounts zero buttons in Node Vitest
class FakeElement {
  tagName: string;
  className = '';
  textContent = '';
  type = '';
  children: FakeElement[] = [];
  attrs = new Map<string, string>();
  styleMap = new Map<string, string>();
  ownerDocument: FakeDocument;
  private listeners = new Map<string, Array<(ev: unknown) => void>>();

  constructor(tagName: string, doc: FakeDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = doc;
  }

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  get childElementCount(): number {
    return this.children.length;
  }

  style = {
    setProperty: (k: string, v: string) => {
      this.styleMap.set(k, v);
    },
  };

  classList = {
    set: new Set<string>(),
    add: (c: string) => {
      this.classList.set.add(c);
    },
    remove: (c: string) => {
      this.classList.set.delete(c);
    },
    toggle: (c: string, force?: boolean) => {
      if (force === undefined) {
        if (this.classList.set.has(c)) this.classList.set.delete(c);
        else this.classList.set.add(c);
      } else if (force) {
        this.classList.set.add(c);
      } else {
        this.classList.set.delete(c);
      }
    },
  };

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeElement): FakeElement {
    const idx = this.children.indexOf(child);
    if (idx >= 0) this.children.splice(idx, 1);
    return child;
  }

  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }

  removeAttribute(k: string): void {
    this.attrs.delete(k);
  }

  addEventListener(type: string, fn: (ev: unknown) => void): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }

  dispatch(type: string, ev: Record<string, unknown>): void {
    const arr = this.listeners.get(type) ?? [];
    for (const fn of arr) {
      fn({
        preventDefault: () => {},
        stopPropagation: () => {},
        ...ev,
      });
    }
  }

  setPointerCapture(_pointerId: number): void {
    // no-op for fake DOM
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: 160, height: 112 };
  }

  findByAttr(attr: string, val: string): FakeElement | null {
    if (this.attrs.get(attr) === val) return this;
    for (const c of this.children) {
      const found = c.findByAttr(attr, val);
      if (found) return found;
    }
    return null;
  }

  findByClass(cls: string): FakeElement | null {
    if (this.className.split(' ').includes(cls)) return this;
    for (const c of this.children) {
      const found = c.findByClass(cls);
      if (found) return found;
    }
    return null;
  }

  countByTag(tag: string): number {
    const upper = tag.toUpperCase();
    let count = this.tagName === upper ? 1 : 0;
    for (const c of this.children) {
      count += c.countByTag(upper);
    }
    return count;
  }
}

class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag, this);
  }
}

describe('InputOrchestrator — Desktop Boot & Auto-Activating Touch', () => {
  it('1. starts on desktop with keyboard active and touchOverlayVisible === false (zero touch DOM)', () => {
    const target = new EventTarget();
    const input = new InputOrchestrator({ windowTarget: target });

    expect(input.activeDevice).toBe('keyboard');
    expect(input.touchOverlayVisible).toBe(false);
    expect(input.settings.touchMode).toBe('auto');

    const doc = new FakeDocument();
    const touchRoot = doc.createElement('div');
    const overlay = new TouchOverlay(touchRoot as unknown as HTMLElement, input);

    expect(overlay.isMounted).toBe(false);
    expect(touchRoot.childElementCount).toBe(0);
    expect(touchRoot.countByTag('BUTTON')).toBe(0);

    overlay.dispose();
    input.dispose();
  });

  it('2. switches to touch and shows TouchOverlay on touch event (pointerdown / touchstart / virtual)', () => {
    const target = new EventTarget();
    const input = new InputOrchestrator({ windowTarget: target });
    const doc = new FakeDocument();
    const touchRoot = doc.createElement('div');
    const overlay = new TouchOverlay(touchRoot as unknown as HTMLElement, input);

    // Non-touch pointerdown (mouse) must NOT activate touch overlay
    input.notifyPointerDown('mouse');
    expect(input.activeDevice).toBe('keyboard');
    expect(input.touchOverlayVisible).toBe(false);
    expect(touchRoot.countByTag('BUTTON')).toBe(0);

    // Touch pointerdown immediately switches device and mounts touch buttons
    input.notifyPointerDown('touch');
    expect(input.activeDevice).toBe('touch');
    expect(input.touchOverlayVisible).toBe(true);
    expect(overlay.isMounted).toBe(true);
    expect(touchRoot.countByTag('BUTTON')).toBeGreaterThanOrEqual(6);

    const glyphs = input.getGlyphs();
    expect(glyphs.device).toBe('touch');
    expect(glyphs.jump).toBe('JUMP');
    expect(glyphs.dash).toBe('DASH');
    expect(glyphs.stomp).toBe('STOMP');
    expect(glyphs.form).toBe('FORM');

    // Also verify touchstart DOM event & injectVirtualTouch(true)
    input.injectVirtualTouch(false);
    expect(input.touchOverlayVisible).toBe(false);
    expect(touchRoot.childElementCount).toBe(0);

    target.dispatchEvent(new Event('touchstart'));
    expect(input.activeDevice).toBe('touch');
    expect(input.touchOverlayVisible).toBe(true);
    expect(touchRoot.countByTag('BUTTON')).toBeGreaterThanOrEqual(6);

    overlay.dispose();
    input.dispose();
  });

  it('3. switches back to keyboard and removes all touch DOM on keyboard input', () => {
    const target = new EventTarget();
    const input = new InputOrchestrator({ windowTarget: target });
    const doc = new FakeDocument();
    const touchRoot = doc.createElement('div');
    const overlay = new TouchOverlay(touchRoot as unknown as HTMLElement, input);

    input.injectVirtualTouch(true);
    expect(input.activeDevice).toBe('touch');
    expect(input.touchOverlayVisible).toBe(true);
    expect(touchRoot.childElementCount).toBe(1);

    // Any keydown switches back to keyboard and unmounts touch overlay completely
    input.notifyKeyDown('Space');
    expect(input.activeDevice).toBe('keyboard');
    expect(input.touchOverlayVisible).toBe(false);
    expect(overlay.isMounted).toBe(false);
    expect(touchRoot.childElementCount).toBe(0);
    expect(touchRoot.countByTag('BUTTON')).toBe(0);

    const frame = input.pollFrame();
    expect(frame.jumpHeld).toBe(true);
    expect(frame.jumpPressed).toBe(true);

    // Next frame while still held: jumpPressed is false, jumpHeld stays true
    const frame2 = input.pollFrame();
    expect(frame2.jumpHeld).toBe(true);
    expect(frame2.jumpPressed).toBe(false);

    // Direct form select (Digit3 -> index 2) and WASD + Arrows dual movement
    input.notifyKeyUp('Space');
    input.notifyKeyDown('KeyD');
    input.notifyKeyDown('Digit3');
    const frame3 = input.pollFrame();
    expect(frame3.moveX).toBe(1);
    expect(frame3.directFormIndex).toBe(2);

    overlay.dispose();
    input.dispose();
  });

  it('4. maps Xbox & Tesla virtual gamepads with 0.20 deadzone, POV hat fallback, buttons, glyphs, and hides touch', () => {
    const target = new EventTarget();
    const input = new InputOrchestrator({ windowTarget: target });

    // Detect all 4 gamepad families
    expect(detectGamepadDevice('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)')).toBe('gamepad_xbox');
    expect(detectGamepadDevice('DualSense Wireless Controller (Vendor: 054c)')).toBe('gamepad_ps');
    expect(detectGamepadDevice('Pro Controller (Vendor: 057e)')).toBe('gamepad_switch');
    expect(detectGamepadDevice('Tesla USB Gamepad (HID)')).toBe('gamepad_tesla');

    // Start in touch mode to verify gamepad hides touch overlay
    input.injectVirtualTouch(true);
    expect(input.touchOverlayVisible).toBe(true);

    // Xbox gamepad within 0.20 deadzone should produce zero movement and NOT steal focus
    const xboxIdle: VirtualGamepadSnapshot = {
      id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)',
      mapping: 'standard',
      axes: [0.18, -0.19, 0, 0],
      buttons: makeButtons([]),
    };
    input.injectVirtualGamepadState(xboxIdle);
    const fIdle = input.pollFrame();
    expect(fIdle.moveX).toBe(0);
    expect(fIdle.moveY).toBe(0);
    expect(input.activeDevice).toBe('touch');

    // Xbox active stick (> 0.20 deadzone) + Jump (A=0) + Dash (X=2) + FormNext (RB=5)
    const xboxActive: VirtualGamepadSnapshot = {
      id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)',
      mapping: 'standard',
      axes: [0.6, -1.0, 0, 0], // stick right 0.6, stick up (-1.0 -> moveY=+1)
      buttons: makeButtons([0, 2, 5]),
    };
    input.injectVirtualGamepadState(xboxActive);
    const fXbox = input.pollFrame();
    expect(input.activeDevice).toBe('gamepad_xbox');
    expect(input.touchOverlayVisible).toBe(false);
    expect(fXbox.moveX).toBeCloseTo(0.5, 4); // (0.6 - 0.2) / 0.8 = 0.5
    expect(fXbox.moveY).toBe(1);
    expect(fXbox.jumpHeld).toBe(true);
    expect(fXbox.jumpPressed).toBe(true);
    expect(fXbox.dashHeld).toBe(true);
    expect(fXbox.dashPressed).toBe(true);
    expect(fXbox.formNextPressed).toBe(true);
    expect(input.getGlyphs()).toMatchObject({
      device: 'gamepad_xbox',
      jump: 'A',
      dash: 'X',
      stomp: 'B',
      form: 'LB/RB',
    });

    // Switch back to touch, then activate Tesla HID gamepad using POV Hat (axis 9) & Stomp (B=1) + Pause (9)
    input.injectVirtualGamepadState(null);
    input.pollFrame(); // release held state
    input.injectVirtualTouch(true);
    expect(input.touchOverlayVisible).toBe(true);

    const teslaPovRight: VirtualGamepadSnapshot = {
      id: 'Tesla In-Car USB Gamepad',
      mapping: '',
      // axis 9 = -3/7 (-0.4286) is POV Right
      axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, -3 / 7],
      buttons: makeButtons([1, 9]),
    };
    input.injectVirtualGamepadState(teslaPovRight);
    const fTesla = input.pollFrame();
    expect(input.activeDevice).toBe('gamepad_tesla');
    expect(input.touchOverlayVisible).toBe(false);
    expect(fTesla.moveX).toBe(1);
    expect(fTesla.moveY).toBe(0);
    expect(fTesla.stompHeld).toBe(true);
    expect(fTesla.stompPressed).toBe(true);
    expect(fTesla.pausePressed).toBe(true);
    expect(input.getGlyphs()).toMatchObject({
      device: 'gamepad_tesla',
      jump: 'A',
      dash: 'X',
      stomp: 'B',
      form: 'LB/RB',
    });

    // Tesla neutral POV hat (3.2857) + raw HID D-pad axes 6 & 7 (Left + Down)
    const teslaRawAxes: VirtualGamepadSnapshot = {
      id: 'Tesla Bluetooth Gamepad',
      mapping: '',
      axes: [0, 0, 0, 0, 0, 0, -1, 1, 0, 3.2857],
      buttons: makeButtons([]),
    };
    input.injectVirtualGamepadState(teslaRawAxes);
    const fTeslaRaw = input.pollFrame();
    expect(fTeslaRaw.moveX).toBe(-1);
    expect(fTeslaRaw.moveY).toBe(-1);

    // Verify PS and Switch glyphs
    expect(getGlyphsForDevice('gamepad_ps')).toMatchObject({
      jump: '✕',
      dash: '□',
      stomp: '○',
      form: 'L1/R1',
    });
    expect(getGlyphsForDevice('gamepad_switch')).toMatchObject({
      jump: 'B',
      dash: 'Y',
      stomp: 'A',
      form: 'L/R',
    });

    input.dispose();
  });

  it('5. strictly enforces touchMode overrides (always_on and off)', () => {
    const target = new EventTarget();
    const input = new InputOrchestrator({ windowTarget: target });

    // always_on forces touch overlay visible even after keyboard & gamepad inputs
    input.updateSettings({ touchMode: 'always_on' });
    expect(input.touchOverlayVisible).toBe(true);

    input.notifyKeyDown('ArrowRight');
    expect(input.activeDevice).toBe('keyboard');
    expect(input.touchOverlayVisible).toBe(true);

    input.injectVirtualGamepadState({
      id: 'Xbox Wireless Controller',
      mapping: 'standard',
      axes: [1, 0],
      buttons: makeButtons([0]),
    });
    input.pollFrame();
    expect(input.activeDevice).toBe('gamepad_xbox');
    expect(input.touchOverlayVisible).toBe(true);

    // off forces touch overlay hidden even after touch events & virtual touch
    input.injectVirtualGamepadState(null);
    input.updateSettings({ touchMode: 'off' });
    expect(input.touchOverlayVisible).toBe(false);

    input.notifyPointerDown('touch');
    input.injectVirtualTouch(true);
    expect(input.touchOverlayVisible).toBe(false);
    expect(input.activeDevice).not.toBe('touch');

    // Switching back to auto restores auto-activation
    input.updateSettings({ touchMode: 'auto' });
    expect(input.touchOverlayVisible).toBe(false);
    input.injectVirtualTouch(true);
    expect(input.touchOverlayVisible).toBe(true);
    expect(input.activeDevice).toBe('touch');

    input.dispose();
  });

  it('5b. tracks simultaneous multi-touch pointerIds (Move + Jump + Dash) without dropping holds', () => {
    const target = new EventTarget();
    const input = new InputOrchestrator({ windowTarget: target });
    const doc = new FakeDocument();
    const touchRoot = doc.createElement('div');
    const overlay = new TouchOverlay(touchRoot as unknown as HTMLElement, input);

    input.injectVirtualTouch(true);
    const dpad = touchRoot.findByClass('kq-touch-dpad');
    const jumpBtn = touchRoot.findByAttr('data-touch-action', 'jump');
    const dashBtn = touchRoot.findByAttr('data-touch-action', 'dash');
    expect(dpad).not.toBeNull();
    expect(jumpBtn).not.toBeNull();
    expect(dashBtn).not.toBeNull();

    // Pointer 1 holds D-pad Right (x=140 of 160), Pointer 2 holds Jump, Pointer 3 holds Dash
    dpad!.dispatch('pointerdown', { pointerId: 1, clientX: 140, clientY: 36 });
    jumpBtn!.dispatch('pointerdown', { pointerId: 2 });
    dashBtn!.dispatch('pointerdown', { pointerId: 3 });

    const f1 = input.pollFrame();
    expect(f1.moveX).toBe(1);
    expect(f1.jumpHeld).toBe(true);
    expect(f1.jumpPressed).toBe(true);
    expect(f1.dashHeld).toBe(true);
    expect(f1.dashPressed).toBe(true);

    // Release Jump (pointerId 2) & slide D-pad to Left (x=20) — Dash & Move remain active!
    jumpBtn!.dispatch('pointerup', { pointerId: 2 });
    dpad!.dispatch('pointermove', { pointerId: 1, clientX: 20, clientY: 36 });

    const f2 = input.pollFrame();
    expect(f2.moveX).toBe(-1);
    expect(f2.jumpHeld).toBe(false);
    expect(f2.dashHeld).toBe(true);

    // Release remaining pointers
    dpad!.dispatch('pointerup', { pointerId: 1 });
    dashBtn!.dispatch('pointerup', { pointerId: 3 });
    const f3 = input.pollFrame();
    expect(f3.moveX).toBe(0);
    expect(f3.dashHeld).toBe(false);

    overlay.dispose();
    input.dispose();
  });
});

describe('SaveManager — Round-Trip Serialization & Corruption Recovery', () => {
  it('6. round-trips valid SaveData and recovers gracefully from malformed or partial JSON', () => {
    const storage = createMockStorage();
    const saves = new SaveManager(storage);

    expect(saves.hasSave()).toBe(false);
    expect(saves.load()).toBeNull();

    const progress = createDefaultProgress();
    progress.crystals = 4320;
    progress.collectedCoinIds = ['coin_01', 'coin_02', 'coin_02']; // duplicate should dedupe
    progress.unlockedForms = ['krunk_basic', 'krunk_leaf', 'krunk_fire'];
    progress.upgradeLevels.ExtraLife = 3;
    progress.upgradeLevels.ItemSlot = 1;
    progress.ownedRelics = ['magnet', 'magic_feather'];
    progress.equippedRelics = ['magnet', 'magic_feather'];
    progress.defeatedBosses = ['primal_eye'];
    progress.visitedRooms = ['mlair_01', 'hub_haven', 'tdm_01'];
    progress.unlockedTeleporters = ['hub_haven', 'tdm_03'];
    progress.ghostShipBestWave = 7;
    progress.ghostShipHighScore = 18500;
    progress.bestTimeAttackTicks = 5400;

    const settings = cloneGameSettings(DEFAULT_SETTINGS);
    settings.render.fpsLimit = 60;
    settings.render.classicSnap = true;
    settings.input.touchMode = 'always_on';
    settings.input.touchLayout.opacity = 0.5;
    settings.input.touchLayout.scale = 1.2;
    settings.audio.masterVolume = 0.6;

    const payload: SaveData = {
      version: 1,
      savedAt: 1730000000000,
      roomId: 'tdm_01',
      spawnX: 12.5,
      spawnY: 4.0,
      activeForm: 'krunk_fire',
      progress,
      settings,
    };

    expect(saves.save(payload)).toBe(true);
    expect(saves.hasSave()).toBe(true);
    expect(storage.raw.has(SAVE_STORAGE_KEY)).toBe(true);

    const loaded = saves.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.roomId).toBe('tdm_01');
    expect(loaded?.spawnX).toBe(12.5);
    expect(loaded?.spawnY).toBe(4.0);
    expect(loaded?.activeForm).toBe('krunk_fire');
    expect(loaded?.progress.crystals).toBe(4320);
    expect(loaded?.progress.collectedCoinIds).toEqual(['coin_01', 'coin_02']);
    expect(loaded?.progress.unlockedForms).toEqual(['krunk_basic', 'krunk_leaf', 'krunk_fire']);
    expect(loaded?.progress.upgradeLevels.ExtraLife).toBe(3);
    expect(loaded?.progress.equippedRelics).toEqual(['magnet', 'magic_feather']);
    expect(loaded?.progress.bestTimeAttackTicks).toBe(5400);
    expect(loaded?.settings.render.fpsLimit).toBe(60);
    expect(loaded?.settings.render.classicSnap).toBe(true);
    expect(loaded?.settings.input.touchMode).toBe('always_on');
    expect(loaded?.settings.input.touchLayout.opacity).toBe(0.5);
    expect(loaded?.settings.input.touchLayout.scale).toBe(1.2);
    expect(loaded?.settings.audio.masterVolume).toBe(0.6);

    // Malformed JSON -> graceful null recovery (never throws)
    storage.setItem(SAVE_STORAGE_KEY, '{this is not valid json!!!');
    expect(saves.load()).toBeNull();
    expect(saves.hasSave()).toBe(false);

    // Wrong version -> null recovery
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ version: 99, roomId: 'hub_haven' }));
    expect(saves.load()).toBeNull();

    // Partially corrupt v1 save -> clamped & sanitized cleanly
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        roomId: 'hub_haven',
        spawnX: Number.NaN,
        activeForm: 'invalid_form',
        progress: {
          crystals: -500,
          unlockedForms: ['bogus'],
          ownedRelics: ['magnet', 'not_a_relic'],
          equippedRelics: ['magnet', 'magic_feather'], // magic_feather not owned & exceeds 1 slot
        },
        settings: {
          render: { fpsLimit: 999 },
          audio: { masterVolume: 5.0 },
          input: { touchMode: 'invalid', touchLayout: { opacity: 0.99, scale: 0.1 } },
        },
      }),
    );

    const sanitized = saves.load();
    expect(sanitized).not.toBeNull();
    expect(sanitized?.activeForm).toBe('krunk_basic');
    expect(sanitized?.progress.crystals).toBe(0);
    expect(sanitized?.progress.unlockedForms).toEqual(['krunk_basic']);
    expect(sanitized?.progress.ownedRelics).toEqual(['magnet']);
    expect(sanitized?.progress.equippedRelics).toEqual(['magnet']);
    expect(sanitized?.settings.render.fpsLimit).toBe(120);
    expect(sanitized?.settings.audio.masterVolume).toBe(1);
    expect(sanitized?.settings.input.touchMode).toBe('auto');
    expect(sanitized?.settings.input.touchLayout.opacity).toBe(0.65);
    expect(sanitized?.settings.input.touchLayout.scale).toBe(0.75);

    saves.clear();
    expect(saves.load()).toBeNull();
    expect(saves.hasSave()).toBe(false);
  });
});
