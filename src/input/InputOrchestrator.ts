import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_SETTINGS,
  DEFAULT_TOUCH_LAYOUT,
  createEmptyInputFrame,
  type DeviceGlyphMap,
  type IInputOrchestrator,
  type InputDeviceMode,
  type InputFrame,
  type InputSettings,
  type KeyBindings,
  type TouchLayoutConfig,
  type VirtualGamepadSnapshot,
} from '../contracts/index.js';

export type TouchActionButton =
  | 'jump'
  | 'dash'
  | 'stomp'
  | 'formNext'
  | 'formPrev'
  | 'interact'
  | 'map'
  | 'pause';

export interface InputOrchestratorOptions {
  settings?: Partial<InputSettings>;
  windowTarget?: EventTarget | null;
  onStateChange?: (state: InputDeviceChangeSnapshot) => void;
}

export interface InputDeviceChangeSnapshot {
  activeDevice: InputDeviceMode;
  touchOverlayVisible: boolean;
  settings: InputSettings;
}

type HapticKind = 'light' | 'stomp' | 'hit' | 'death' | 'heal';

interface GamepadLike {
  id: string;
  mapping?: string;
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
  vibrationActuator?: {
    playEffect?: (
      type: string,
      params: {
        startDelay?: number;
        duration: number;
        weakMagnitude: number;
        strongMagnitude: number;
      },
    ) => Promise<unknown>;
    pulse?: (value: number, duration: number) => Promise<unknown>;
  };
}

interface RawGamepadPoll {
  active: boolean;
  device: InputDeviceMode;
  moveX: number;
  moveY: number;
  jump: boolean;
  dash: boolean;
  stomp: boolean;
  formNext: boolean;
  formPrev: boolean;
  interact: boolean;
  map: boolean;
  pause: boolean;
}

const PREVENT_DEFAULT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
]);

const DIRECT_FORM_KEYS: readonly string[] = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
];

const HAPTIC_PATTERNS: Record<HapticKind, { duration: number; weakMagnitude: number; strongMagnitude: number }> = {
  light: { duration: 45, weakMagnitude: 0.25, strongMagnitude: 0.1 },
  stomp: { duration: 110, weakMagnitude: 0.55, strongMagnitude: 0.75 },
  hit: { duration: 160, weakMagnitude: 0.7, strongMagnitude: 0.9 },
  death: { duration: 320, weakMagnitude: 0.85, strongMagnitude: 1.0 },
  heal: { duration: 90, weakMagnitude: 0.4, strongMagnitude: 0.15 },
};

const POV_HAT_NOTCHES: ReadonlyArray<{ value: number; x: number; y: number }> = [
  { value: -1.0, x: 0, y: 1 }, // Up
  { value: -5 / 7, x: 1, y: 1 }, // Up-Right
  { value: -3 / 7, x: 1, y: 0 }, // Right
  { value: -1 / 7, x: 1, y: -1 }, // Down-Right
  { value: 1 / 7, x: 0, y: -1 }, // Down
  { value: 3 / 7, x: -1, y: -1 }, // Down-Left
  { value: 5 / 7, x: -1, y: 0 }, // Left
  { value: 1.0, x: -1, y: 1 }, // Up-Left
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function formatKeyCode(code: string): string {
  if (!code) return '?';
  if (code === 'Space') return 'SPACE';
  if (code === 'Escape') return 'ESC';
  if (code === 'Enter') return 'ENTER';
  if (code === 'Tab') return 'TAB';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT';
  if (code === 'ArrowLeft') return 'LEFT';
  if (code === 'ArrowRight') return 'RIGHT';
  if (code === 'ArrowUp') return 'UP';
  if (code === 'ArrowDown') return 'DOWN';
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  return code.toUpperCase();
}

export function detectGamepadDevice(gamepadId: string, userAgent?: string): InputDeviceMode {
  const id = (gamepadId || '').toLowerCase();
  if (/tesla|model\s?[3sxy]|cybertruck/.test(id)) {
    return 'gamepad_tesla';
  }
  if (/xbox|xinput|microsoft|045e/.test(id)) {
    return 'gamepad_xbox';
  }
  if (/nintendo|switch|pro controller|joy-?con|057e/.test(id)) {
    return 'gamepad_switch';
  }
  if (/playstation|dualsense|dualshock|sony|054c|wireless controller/.test(id)) {
    return 'gamepad_ps';
  }
  const ua = (userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase();
  if (ua.includes('tesla')) {
    return 'gamepad_tesla';
  }
  return 'gamepad_xbox';
}

export function getGlyphsForDevice(device: InputDeviceMode, bindings: KeyBindings = DEFAULT_KEY_BINDINGS): DeviceGlyphMap {
  switch (device) {
    case 'gamepad_xbox':
      return {
        device,
        jump: 'A',
        stomp: 'X',
        dash: 'RB/B',
        form: 'LB/LT',
        interact: 'X',
        map: 'Y',
        pause: 'MENU',
      };
    case 'gamepad_ps':
      return {
        device,
        jump: '✕',
        stomp: '□',
        dash: 'R1/○',
        form: 'L1/L2',
        interact: '□',
        map: '△',
        pause: 'OPT',
      };
    case 'gamepad_switch':
      return {
        device,
        jump: 'B',
        stomp: 'Y',
        dash: 'R/A',
        form: 'L/ZL',
        interact: 'Y',
        map: 'X',
        pause: '+',
      };
    case 'gamepad_tesla':
      return {
        device,
        jump: 'A',
        stomp: 'X',
        dash: 'RB/B',
        form: 'LB/LT',
        interact: 'X',
        map: 'Y',
        pause: 'MENU',
      };
    case 'touch':
      return {
        device,
        jump: 'JUMP',
        dash: 'DASH',
        stomp: 'STOMP',
        form: 'FORM',
        interact: 'USE',
        map: 'MAP',
        pause: 'PAUSE',
      };
    case 'keyboard':
    default:
      return {
        device: 'keyboard',
        jump: `[${formatKeyCode(bindings.jump)}]`,
        dash: `[${formatKeyCode(bindings.dash)}]`,
        stomp: `[${formatKeyCode(bindings.stomp)}]`,
        form: `[${formatKeyCode(bindings.formPrev)}/${formatKeyCode(bindings.formNext)}]`,
        interact: `[${formatKeyCode(bindings.interact)}]`,
        map: `[${formatKeyCode(bindings.map)}]`,
        pause: `[${formatKeyCode(bindings.pause)}]`,
      };
  }
}

function applyAxisDeadzone(raw: number, deadzone: number): number {
  if (!Number.isFinite(raw)) return 0;
  const abs = Math.abs(raw);
  if (abs <= deadzone) return 0;
  const scaled = (abs - deadzone) / Math.max(0.0001, 1 - deadzone);
  return clamp(Math.sign(raw) * scaled, -1, 1);
}

function decodePovHatAxis(raw: number): { x: number; y: number } {
  if (!Number.isFinite(raw) || raw < -1.1 || raw > 1.1) {
    return { x: 0, y: 0 };
  }
  for (const notch of POV_HAT_NOTCHES) {
    if (Math.abs(raw - notch.value) <= 0.1) {
      return { x: notch.x, y: notch.y };
    }
  }
  return { x: 0, y: 0 };
}

function readButton(pad: GamepadLike, index: number, threshold = 0.35): boolean {
  const btn = pad.buttons[index];
  if (!btn) return false;
  return Boolean(btn.pressed || btn.value >= threshold);
}

function cloneInputSettings(partial?: Partial<InputSettings>): InputSettings {
  const base = DEFAULT_SETTINGS.input;
  const touchMode =
    partial?.touchMode === 'auto' || partial?.touchMode === 'always_on' || partial?.touchMode === 'off'
      ? partial.touchMode
      : base.touchMode;
  const layout: TouchLayoutConfig = {
    opacity: clamp(partial?.touchLayout?.opacity ?? DEFAULT_TOUCH_LAYOUT.opacity, 0.2, 0.65),
    scale: clamp(partial?.touchLayout?.scale ?? DEFAULT_TOUCH_LAYOUT.scale, 0.75, 1.35),
    dpadOffsetX: Number.isFinite(partial?.touchLayout?.dpadOffsetX)
      ? (partial?.touchLayout?.dpadOffsetX as number)
      : DEFAULT_TOUCH_LAYOUT.dpadOffsetX,
    dpadOffsetY: Number.isFinite(partial?.touchLayout?.dpadOffsetY)
      ? (partial?.touchLayout?.dpadOffsetY as number)
      : DEFAULT_TOUCH_LAYOUT.dpadOffsetY,
    actionOffsetX: Number.isFinite(partial?.touchLayout?.actionOffsetX)
      ? (partial?.touchLayout?.actionOffsetX as number)
      : DEFAULT_TOUCH_LAYOUT.actionOffsetX,
    actionOffsetY: Number.isFinite(partial?.touchLayout?.actionOffsetY)
      ? (partial?.touchLayout?.actionOffsetY as number)
      : DEFAULT_TOUCH_LAYOUT.actionOffsetY,
  };
  const bindings: KeyBindings = {
    ...DEFAULT_KEY_BINDINGS,
    ...(partial?.bindings ?? {}),
  };
  return {
    touchMode,
    touchLayout: layout,
    hapticsEnabled: partial?.hapticsEnabled ?? base.hapticsEnabled,
    deadzone: clamp(partial?.deadzone ?? base.deadzone, 0.05, 0.5),
    bindings,
  };
}

export class InputOrchestrator implements IInputOrchestrator {
  private _activeDevice: InputDeviceMode = 'keyboard';
  private _touchOverlayVisible = false;
  private _settings: InputSettings;
  private readonly _windowTarget: EventTarget | null;
  private readonly _listeners = new Set<(state: InputDeviceChangeSnapshot) => void>();

  // Keyboard state
  private readonly _keysHeld = new Set<string>();
  private readonly _keysLatched = new Set<string>();
  private _suppressKeyCapture = false;

  // Virtual touch state (fed by TouchOverlay)
  private _touchMoveX = 0;
  private _touchMoveY = 0;
  private readonly _touchButtonsHeld = new Set<TouchActionButton>();
  private readonly _touchButtonsLatched = new Set<TouchActionButton>();

  // Virtual gamepad override for deterministic testing & debug bridge
  private _virtualGamepad: VirtualGamepadSnapshot | null = null;

  // Previous-frame edge state
  private _prevJump = false;
  private _prevDash = false;
  private _prevStomp = false;
  private _prevFormNext = false;
  private _prevFormPrev = false;
  private _prevInteract = false;
  private _prevMap = false;
  private _prevPause = false;

  private _disposed = false;

  private readonly _onKeyDownBound = (ev: Event) => this._handleDomKeyDown(ev as KeyboardEvent);
  private readonly _onKeyUpBound = (ev: Event) => this._handleDomKeyUp(ev as KeyboardEvent);
  private readonly _onBlurBound = () => this._handleWindowBlur();
  private readonly _onPointerDownBound = (ev: Event) => this._handleDomPointerDown(ev as PointerEvent);
  private readonly _onTouchStartBound = () => this.notifyTouchStart();

  constructor(options: InputOrchestratorOptions = {}) {
    this._settings = cloneInputSettings(options.settings);
    this._windowTarget =
      options.windowTarget !== undefined
        ? options.windowTarget
        : typeof window !== 'undefined'
          ? window
          : null;

    if (options.onStateChange) {
      this._listeners.add(options.onStateChange);
    }

    // Desktop boot contract: keyboard active, touch overlay strictly hidden unless always_on.
    this._activeDevice = 'keyboard';
    this._touchOverlayVisible = this._settings.touchMode === 'always_on';

    if (this._windowTarget) {
      this._windowTarget.addEventListener('keydown', this._onKeyDownBound);
      this._windowTarget.addEventListener('keyup', this._onKeyUpBound);
      this._windowTarget.addEventListener('blur', this._onBlurBound);
      this._windowTarget.addEventListener('pointerdown', this._onPointerDownBound, { passive: true });
      this._windowTarget.addEventListener('touchstart', this._onTouchStartBound, { passive: true });
    }
  }

  get activeDevice(): InputDeviceMode {
    return this._activeDevice;
  }

  get touchOverlayVisible(): boolean {
    return this._touchOverlayVisible;
  }

  get settings(): InputSettings {
    return {
      ...this._settings,
      touchLayout: { ...this._settings.touchLayout },
      bindings: { ...this._settings.bindings },
    };
  }

  subscribe(listener: (state: InputDeviceChangeSnapshot) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  setKeyCaptureSuppressed(suppressed: boolean): void {
    this._suppressKeyCapture = suppressed;
    if (suppressed) {
      this._keysHeld.clear();
      this._keysLatched.clear();
    }
  }

  updateSettings(patch: Partial<InputSettings>): void {
    const prevTouchMode = this._settings.touchMode;
    const prevVisible = this._touchOverlayVisible;
    const prevDevice = this._activeDevice;

    const merged: InputSettings = {
      touchMode: patch.touchMode ?? this._settings.touchMode,
      touchLayout: patch.touchLayout
        ? {
            opacity: clamp(patch.touchLayout.opacity ?? this._settings.touchLayout.opacity, 0.2, 0.65),
            scale: clamp(patch.touchLayout.scale ?? this._settings.touchLayout.scale, 0.75, 1.35),
            dpadOffsetX: patch.touchLayout.dpadOffsetX ?? this._settings.touchLayout.dpadOffsetX,
            dpadOffsetY: patch.touchLayout.dpadOffsetY ?? this._settings.touchLayout.dpadOffsetY,
            actionOffsetX: patch.touchLayout.actionOffsetX ?? this._settings.touchLayout.actionOffsetX,
            actionOffsetY: patch.touchLayout.actionOffsetY ?? this._settings.touchLayout.actionOffsetY,
          }
        : this._settings.touchLayout,
      hapticsEnabled: patch.hapticsEnabled ?? this._settings.hapticsEnabled,
      deadzone: clamp(patch.deadzone ?? this._settings.deadzone, 0.05, 0.5),
      bindings: patch.bindings
        ? { ...this._settings.bindings, ...patch.bindings }
        : this._settings.bindings,
    };

    this._settings = merged;

    if (merged.touchMode === 'always_on') {
      this._touchOverlayVisible = true;
    } else if (merged.touchMode === 'off') {
      this._touchOverlayVisible = false;
      this.clearTouchInput();
      if (this._activeDevice === 'touch') {
        this._activeDevice = 'keyboard';
      }
    } else {
      // 'auto'
      this._touchOverlayVisible = this._activeDevice === 'touch';
    }

    if (
      prevTouchMode !== merged.touchMode ||
      prevVisible !== this._touchOverlayVisible ||
      prevDevice !== this._activeDevice ||
      patch.touchLayout !== undefined ||
      patch.bindings !== undefined
    ) {
      this._emitStateChange();
    }
  }

  setTouchLayout(layout: Partial<TouchLayoutConfig>): void {
    this.updateSettings({
      touchLayout: {
        ...this._settings.touchLayout,
        ...layout,
      },
    });
  }

  getGlyphs(): DeviceGlyphMap {
    return getGlyphsForDevice(this._activeDevice, this._settings.bindings);
  }

  notifyKeyDown(code: string, repeat = false): void {
    if (!code) return;
    this._activateNonTouchDevice('keyboard');
    if (this._suppressKeyCapture) return;
    this._keysHeld.add(code);
    if (!repeat) {
      this._keysLatched.add(code);
    }
  }

  notifyKeyUp(code: string): void {
    if (!code) return;
    this._keysHeld.delete(code);
  }

  notifyPointerDown(pointerType: string): void {
    if (pointerType === 'touch') {
      this.notifyTouchStart();
    }
  }

  notifyTouchStart(): void {
    if (this._settings.touchMode === 'off') {
      if (this._touchOverlayVisible) {
        this._touchOverlayVisible = false;
        this._emitStateChange();
      }
      return;
    }
    const changed = this._activeDevice !== 'touch' || !this._touchOverlayVisible;
    this._activeDevice = 'touch';
    this._touchOverlayVisible = true;
    if (changed) {
      this._emitStateChange();
    }
  }

  injectVirtualTouch(active: boolean): void {
    if (active) {
      this.notifyTouchStart();
      return;
    }
    this.clearTouchInput();
    if (this._settings.touchMode === 'auto') {
      const changed = this._activeDevice !== 'keyboard' || this._touchOverlayVisible;
      this._activeDevice = 'keyboard';
      this._touchOverlayVisible = false;
      if (changed) {
        this._emitStateChange();
      }
    } else if (this._settings.touchMode === 'off') {
      const changed = this._touchOverlayVisible || this._activeDevice === 'touch';
      this._touchOverlayVisible = false;
      if (this._activeDevice === 'touch') {
        this._activeDevice = 'keyboard';
      }
      if (changed) {
        this._emitStateChange();
      }
    }
  }

  setTouchMove(x: number, y: number): void {
    this._touchMoveX = clamp(x, -1, 1);
    this._touchMoveY = clamp(y, -1, 1);
    if (Math.abs(this._touchMoveX) > 0.01 || Math.abs(this._touchMoveY) > 0.01) {
      this.notifyTouchStart();
    }
  }

  setTouchButton(button: TouchActionButton, held: boolean): void {
    if (held) {
      this.notifyTouchStart();
      if (!this._touchButtonsHeld.has(button)) {
        this._touchButtonsLatched.add(button);
      }
      this._touchButtonsHeld.add(button);
    } else {
      this._touchButtonsHeld.delete(button);
    }
  }

  clearTouchInput(): void {
    this._touchMoveX = 0;
    this._touchMoveY = 0;
    this._touchButtonsHeld.clear();
    this._touchButtonsLatched.clear();
  }

  injectVirtualGamepadState(pad: VirtualGamepadSnapshot | null): void {
    this._virtualGamepad = pad
      ? {
          id: pad.id,
          mapping: pad.mapping,
          axes: [...pad.axes],
          buttons: pad.buttons.map((b) => ({ pressed: Boolean(b.pressed), value: Number(b.value) || 0 })),
        }
      : null;

    if (this._virtualGamepad) {
      const sampled = this._sampleGamepad(this._virtualGamepad, true);
      if (sampled.active) {
        this._activateNonTouchDevice(sampled.device);
      }
    }
  }

  triggerHaptic(kind: HapticKind): void {
    if (!this._settings.hapticsEnabled) return;
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    const pattern = HAPTIC_PATTERNS[kind];
    if (!pattern) return;

    try {
      const pads = navigator.getGamepads();
      if (!pads) return;
      for (const rawPad of pads) {
        if (!rawPad) continue;
        const pad = rawPad as unknown as GamepadLike;
        const actuator = pad.vibrationActuator;
        if (!actuator) continue;
        if (typeof actuator.playEffect === 'function') {
          void actuator
            .playEffect('dual-rumble', {
              startDelay: 0,
              duration: pattern.duration,
              weakMagnitude: pattern.weakMagnitude,
              strongMagnitude: pattern.strongMagnitude,
            })
            .catch(() => {});
          return;
        }
        if (typeof actuator.pulse === 'function') {
          void actuator.pulse(pattern.strongMagnitude, pattern.duration).catch(() => {});
          return;
        }
      }
    } catch {
      // Ignore browser/sandbox gamepad haptic failures
    }
  }

  pollFrame(): InputFrame {
    const frame = createEmptyInputFrame();
    const b = this._settings.bindings;

    // Collect primary bound keys so alternate keys never conflict with custom rebinds.
    const primaryByCode = new Map<string, keyof KeyBindings>();
    (Object.keys(b) as Array<keyof KeyBindings>).forEach((action) => {
      primaryByCode.set(b[action], action);
    });

    const isAltAllowed = (code: string, target: keyof KeyBindings): boolean => {
      const owner = primaryByCode.get(code);
      return owner === undefined || owner === target;
    };

    const matchKeySet = (
      set: ReadonlySet<string>,
      primary: keyof KeyBindings,
      alternates: readonly string[],
      allowSharedCodes: readonly string[] = [],
    ): boolean => {
      if (set.has(b[primary])) return true;
      for (const alt of alternates) {
        if (set.has(alt) && (allowSharedCodes.includes(alt) || isAltAllowed(alt, primary))) {
          return true;
        }
      }
      return false;
    };

    // 1. Keyboard axes & buttons (Authentic PC Z=Jump, X=Stomp/Interact, C=Dash + accessible WASD/Space/Shift/J/K/L alts)
    const kbLeft = matchKeySet(this._keysHeld, 'left', ['ArrowLeft', 'KeyA']);
    const kbRight = matchKeySet(this._keysHeld, 'right', ['ArrowRight', 'KeyD']);
    const kbUp = matchKeySet(this._keysHeld, 'up', ['ArrowUp', 'KeyW']);
    const kbDown = matchKeySet(this._keysHeld, 'down', ['ArrowDown', 'KeyS']);

    const kbMoveX = (kbRight ? 1 : 0) - (kbLeft ? 1 : 0);
    const kbMoveY = (kbUp ? 1 : 0) - (kbDown ? 1 : 0);

    const kbJumpHeld = matchKeySet(this._keysHeld, 'jump', ['KeyZ', 'Space', 'KeyK']);
    const kbStompHeld = matchKeySet(this._keysHeld, 'stomp', ['KeyX', 'KeyJ']);
    const kbDashHeld = matchKeySet(this._keysHeld, 'dash', ['KeyC', 'ShiftLeft', 'ShiftRight', 'KeyL']);
    const kbFormNextHeld = matchKeySet(this._keysHeld, 'formNext', ['KeyE', 'BracketRight']);
    const kbFormPrevHeld = matchKeySet(this._keysHeld, 'formPrev', ['KeyQ', 'BracketLeft']);
    const kbInteractHeld = matchKeySet(this._keysHeld, 'interact', ['KeyF', 'Enter', 'KeyX'], ['KeyX']);
    const kbMapHeld = matchKeySet(this._keysHeld, 'map', ['KeyM', 'Tab']);
    const kbPauseHeld = matchKeySet(this._keysHeld, 'pause', ['Escape', 'KeyP']);

    const kbJumpLatched = matchKeySet(this._keysLatched, 'jump', ['KeyZ', 'Space', 'KeyK']);
    const kbStompLatched = matchKeySet(this._keysLatched, 'stomp', ['KeyX', 'KeyJ']);
    const kbDashLatched = matchKeySet(this._keysLatched, 'dash', ['KeyC', 'ShiftLeft', 'ShiftRight', 'KeyL']);
    const kbFormNextLatched = matchKeySet(this._keysLatched, 'formNext', ['KeyE', 'BracketRight']);
    const kbFormPrevLatched = matchKeySet(this._keysLatched, 'formPrev', ['KeyQ', 'BracketLeft']);
    const kbInteractLatched = matchKeySet(this._keysLatched, 'interact', ['KeyF', 'Enter', 'KeyX'], ['KeyX']);
    const kbMapLatched = matchKeySet(this._keysLatched, 'map', ['KeyM', 'Tab']);
    const kbPauseLatched = matchKeySet(this._keysLatched, 'pause', ['Escape', 'KeyP']);

    let directFormIndex = -1;
    for (let i = 0; i < DIRECT_FORM_KEYS.length; i++) {
      if (this._keysLatched.has(DIRECT_FORM_KEYS[i])) {
        directFormIndex = i;
        break;
      }
    }

    // 2. Gamepad (virtual snapshot takes priority for deterministic tests; also polls real W3C gamepads)
    const padPoll = this._pollAllGamepads();
    if (padPoll.active) {
      this._activateNonTouchDevice(padPoll.device);
    }

    // 3. Touch overlay inputs (active only when touchMode !== 'off')
    const touchAllowed = this._settings.touchMode !== 'off';
    const touchMoveX = touchAllowed ? this._touchMoveX : 0;
    const touchMoveY = touchAllowed ? this._touchMoveY : 0;
    const touchJumpHeld = touchAllowed && this._touchButtonsHeld.has('jump');
    const touchDashHeld = touchAllowed && this._touchButtonsHeld.has('dash');
    const touchStompHeld = touchAllowed && this._touchButtonsHeld.has('stomp');
    const touchFormNextHeld = touchAllowed && this._touchButtonsHeld.has('formNext');
    const touchFormPrevHeld = touchAllowed && this._touchButtonsHeld.has('formPrev');
    const touchInteractHeld = touchAllowed && this._touchButtonsHeld.has('interact');
    const touchMapHeld = touchAllowed && this._touchButtonsHeld.has('map');
    const touchPauseHeld = touchAllowed && this._touchButtonsHeld.has('pause');

    const touchJumpLatched = touchAllowed && this._touchButtonsLatched.has('jump');
    const touchDashLatched = touchAllowed && this._touchButtonsLatched.has('dash');
    const touchStompLatched = touchAllowed && this._touchButtonsLatched.has('stomp');
    const touchFormNextLatched = touchAllowed && this._touchButtonsLatched.has('formNext');
    const touchFormPrevLatched = touchAllowed && this._touchButtonsLatched.has('formPrev');
    const touchInteractLatched = touchAllowed && this._touchButtonsLatched.has('interact');
    const touchMapLatched = touchAllowed && this._touchButtonsLatched.has('map');
    const touchPauseLatched = touchAllowed && this._touchButtonsLatched.has('pause');

    // 4. Combine axes (prefer largest magnitude source cleanly)
    frame.moveX = this._pickDominantAxis(kbMoveX, padPoll.moveX, touchMoveX);
    frame.moveY = this._pickDominantAxis(kbMoveY, padPoll.moveY, touchMoveY);

    // 5. Combine held & edge-triggered pressed flags
    const jumpHeld = kbJumpHeld || padPoll.jump || touchJumpHeld;
    const dashHeld = kbDashHeld || padPoll.dash || touchDashHeld;
    const stompHeld = kbStompHeld || padPoll.stomp || touchStompHeld;
    const formNextHeld = kbFormNextHeld || padPoll.formNext || touchFormNextHeld;
    const formPrevHeld = kbFormPrevHeld || padPoll.formPrev || touchFormPrevHeld;
    const interactHeld = kbInteractHeld || padPoll.interact || touchInteractHeld;
    const mapHeld = kbMapHeld || padPoll.map || touchMapHeld;
    const pauseHeld = kbPauseHeld || padPoll.pause || touchPauseHeld;

    frame.jumpHeld = jumpHeld;
    frame.jumpPressed = kbJumpLatched || touchJumpLatched || (jumpHeld && !this._prevJump);
    frame.dashHeld = dashHeld;
    frame.dashPressed = kbDashLatched || touchDashLatched || (dashHeld && !this._prevDash);
    frame.stompHeld = stompHeld;
    frame.stompPressed = kbStompLatched || touchStompLatched || (stompHeld && !this._prevStomp);
    frame.formNextPressed = kbFormNextLatched || touchFormNextLatched || (formNextHeld && !this._prevFormNext);
    frame.formPrevPressed = kbFormPrevLatched || touchFormPrevLatched || (formPrevHeld && !this._prevFormPrev);
    frame.directFormIndex = directFormIndex;
    frame.interactPressed = kbInteractLatched || touchInteractLatched || (interactHeld && !this._prevInteract);
    frame.mapPressed = kbMapLatched || touchMapLatched || (mapHeld && !this._prevMap);
    frame.pausePressed = kbPauseLatched || touchPauseLatched || (pauseHeld && !this._prevPause);

    this._prevJump = jumpHeld;
    this._prevDash = dashHeld;
    this._prevStomp = stompHeld;
    this._prevFormNext = formNextHeld;
    this._prevFormPrev = formPrevHeld;
    this._prevInteract = interactHeld;
    this._prevMap = mapHeld;
    this._prevPause = pauseHeld;

    this._keysLatched.clear();
    this._touchButtonsLatched.clear();

    return frame;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this._windowTarget) {
      this._windowTarget.removeEventListener('keydown', this._onKeyDownBound);
      this._windowTarget.removeEventListener('keyup', this._onKeyUpBound);
      this._windowTarget.removeEventListener('blur', this._onBlurBound);
      this._windowTarget.removeEventListener('pointerdown', this._onPointerDownBound);
      this._windowTarget.removeEventListener('touchstart', this._onTouchStartBound);
    }
    this._keysHeld.clear();
    this._keysLatched.clear();
    this.clearTouchInput();
    this._listeners.clear();
  }

  private _pickDominantAxis(a: number, b: number, c: number): number {
    let best = a;
    if (Math.abs(b) > Math.abs(best)) best = b;
    if (Math.abs(c) > Math.abs(best)) best = c;
    return clamp(best, -1, 1);
  }

  private _activateNonTouchDevice(device: InputDeviceMode): void {
    const nextVisible = this._settings.touchMode === 'always_on';
    const changed = this._activeDevice !== device || this._touchOverlayVisible !== nextVisible;
    this._activeDevice = device;
    this._touchOverlayVisible = nextVisible;
    if (changed) {
      this._emitStateChange();
    }
  }

  private _emitStateChange(): void {
    const snap: InputDeviceChangeSnapshot = {
      activeDevice: this._activeDevice,
      touchOverlayVisible: this._touchOverlayVisible,
      settings: this.settings,
    };
    for (const listener of this._listeners) {
      listener(snap);
    }
  }

  private _handleDomKeyDown(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement | null;
    const isFormControl =
      target !== null &&
      (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');

    if (!isFormControl && !this._suppressKeyCapture && PREVENT_DEFAULT_KEYS.has(ev.code)) {
      ev.preventDefault();
    }
    this.notifyKeyDown(ev.code, ev.repeat);
  }

  private _handleDomKeyUp(ev: KeyboardEvent): void {
    this.notifyKeyUp(ev.code);
  }

  private _handleWindowBlur(): void {
    this._keysHeld.clear();
    this._keysLatched.clear();
    this.clearTouchInput();
  }

  private _handleDomPointerDown(ev: PointerEvent): void {
    if (ev.pointerType === 'touch') {
      this.notifyTouchStart();
    }
  }

  private _pollAllGamepads(): RawGamepadPoll {
    const empty: RawGamepadPoll = {
      active: false,
      device: this._activeDevice,
      moveX: 0,
      moveY: 0,
      jump: false,
      dash: false,
      stomp: false,
      formNext: false,
      formPrev: false,
      interact: false,
      map: false,
      pause: false,
    };

    if (this._virtualGamepad) {
      return this._sampleGamepad(this._virtualGamepad, true);
    }

    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return empty;
    }

    let pads: (Gamepad | null)[] | null = null;
    try {
      pads = Array.from(navigator.getGamepads() ?? []);
    } catch {
      return empty;
    }

    let firstConnected: RawGamepadPoll | null = null;
    for (const rawPad of pads) {
      if (!rawPad) continue;
      const sampled = this._sampleGamepad(rawPad as unknown as GamepadLike, false);
      if (sampled.active) {
        return sampled;
      }
      if (!firstConnected) {
        firstConnected = sampled;
      }
    }
    return firstConnected ?? empty;
  }

  private _sampleGamepad(pad: GamepadLike, isVirtual: boolean): RawGamepadPoll {
    const dz = this._settings.deadzone;
    const device = detectGamepadDevice(pad.id);
    const axes = pad.axes ?? [];

    // Left stick (axes 0, 1; HTML5 Gamepad Y is down=+1, world Y is up=+1)
    let moveX = axes.length > 0 ? applyAxisDeadzone(axes[0], dz) : 0;
    let moveY = axes.length > 1 ? applyAxisDeadzone(-axes[1], dz) : 0;

    // Standard D-pad buttons 12..15
    const dUp = readButton(pad, 12, 0.5);
    const dDown = readButton(pad, 13, 0.5);
    const dLeft = readButton(pad, 14, 0.5);
    const dRight = readButton(pad, 15, 0.5);
    const dpadX = (dRight ? 1 : 0) - (dLeft ? 1 : 0);
    const dpadY = (dUp ? 1 : 0) - (dDown ? 1 : 0);
    if (dpadX !== 0) moveX = dpadX;
    if (dpadY !== 0) moveY = dpadY;

    // POV Hat fallback on axis 9 (common in Tesla Chromium & generic USB HID controllers)
    if (axes.length > 9) {
      const hat = decodePovHatAxis(axes[9]);
      if (hat.x !== 0) moveX = hat.x;
      if (hat.y !== 0) moveY = hat.y;
    }

    // Raw HID D-pad axes fallback (axes 6-7 on Linux/Tesla evdev, or axes 4-5 when non-standard)
    const isNonStandard = pad.mapping !== 'standard';
    if (isNonStandard || device === 'gamepad_tesla') {
      if (axes.length >= 8) {
        const rawHatX = applyAxisDeadzone(axes[6], Math.max(dz, 0.45));
        const rawHatY = applyAxisDeadzone(-axes[7], Math.max(dz, 0.45));
        if (Math.abs(rawHatX) > Math.abs(moveX)) moveX = Math.sign(rawHatX);
        if (Math.abs(rawHatY) > Math.abs(moveY)) moveY = Math.sign(rawHatY);
      } else if (axes.length >= 6 && (isVirtual || !(axes[4] <= -0.95 && axes[5] <= -0.95))) {
        const rawHatX = applyAxisDeadzone(axes[4], Math.max(dz, 0.45));
        const rawHatY = applyAxisDeadzone(-axes[5], Math.max(dz, 0.45));
        if (Math.abs(rawHatX) > Math.abs(moveX)) moveX = Math.sign(rawHatX);
        if (Math.abs(rawHatY) > Math.abs(moveY)) moveY = Math.sign(rawHatY);
      }
    }

    // Action buttons (W3C standard mapping matching authentic origin controller muscle memory:
    // A/Cross=Jump [0], X/Square=Stomp/Interact [2], RB/R1/RT/B=Dash [5,7,1], LB/LT=Form [4,6], Y/View=Map [3,8], Menu=Pause [9])
    const jump = readButton(pad, 0);
    const stomp = readButton(pad, 2);
    const dash = readButton(pad, 5) || readButton(pad, 7, 0.35) || readButton(pad, 1);
    const interact = readButton(pad, 2);
    const formPrev = readButton(pad, 4);
    const formNext = readButton(pad, 6, 0.35);
    const map = readButton(pad, 3) || readButton(pad, 8);
    const pause = readButton(pad, 9);

    const anyButton =
      jump || stomp || dash || interact || formPrev || formNext || map || pause || dUp || dDown || dLeft || dRight;
    const anyAxis = Math.abs(moveX) > 0 || Math.abs(moveY) > 0;

    return {
      active: anyButton || anyAxis,
      device,
      moveX: clamp(moveX, -1, 1),
      moveY: clamp(moveY, -1, 1),
      jump,
      dash,
      stomp,
      formNext,
      formPrev,
      interact,
      map,
      pause,
    };
  }
}

export function createInputOrchestrator(options?: InputOrchestratorOptions): InputOrchestrator {
  return new InputOrchestrator(options);
}
