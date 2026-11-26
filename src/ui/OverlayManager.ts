import {
  HERO_FORMS,
  type AudioSettings,
  type BossId,
  type DeviceGlyphMap,
  type FpsLimitOption,
  type GameSettings,
  type HeroFormId,
  type InputDeviceMode,
  type InputFrame,
  type InputSettings,
  type IWorldCatalog,
  type KeyBindings,
  type RelicId,
  type RenderSettings,
  type ScreenMode,
  type ShopId,
  type SimState,
  type TouchLayoutConfig,
  type TouchVisibilitySetting,
  type UpgradeKey,
  type VirtualGamepadSnapshot,
} from '../contracts/index.js';
import { formatKeyCode } from '../input/InputOrchestrator.js';
import { buildMapPanel } from './MapOverlay.js';
import { buildShopPanel } from './ShopMenus.js';
import { buildTouchCustomizerSection } from './TouchCustomizer.js';
import { buildCreditsPanel, buildGameOverPanel, buildVictoryPanel } from './VictoryScreens.js';

export interface OverlayActions {
  onContinue(): void;
  onNewGame(): void;
  onStartGhostShip(): void;
  onStartTimeAttack(): void;
  onResume(): void;
  onOpenOptions(from: 'title' | 'paused'): void;
  onCloseOptions(): void;
  onOpenMap(): void;
  onCloseMap(): void;
  onCloseShop(): void;
  onReturnToHub(): void;
  onSaveAndQuit(): void;
  onRetryGameOver(): void;
  onOpenCredits(): void;
  onReturnToTitle(): void;

  onLoadCustomPack(): Promise<{ ok: boolean; count: number; message: string }>;
  onToggleCustomPack(enabled: boolean): boolean;

  onUpdateRenderSettings(patch: Partial<RenderSettings>): void;
  onUpdateAudioSettings(patch: Partial<AudioSettings>): void;
  onUpdateInputSettings(patch: Partial<InputSettings>): void;
  onUpdateTouchLayout(patch: Partial<TouchLayoutConfig>): void;
  onRebindKey(action: keyof KeyBindings, code: string): void;
  onResetKeyBindings(): void;
  onSetKeyCaptureSuppressed(suppressed: boolean): void;

  onBuyUpgrade(key: UpgradeKey): boolean;
  onBuyRelic(id: RelicId): boolean;
  onToggleEquipRelic(id: RelicId): boolean;
  onChallengeBoss(bossId: BossId): boolean;
  onFastTravel(roomId: string): boolean;

  onWarpRoom(roomId: string): boolean;
  onUnlockAllForms(): void;
  onSetForm(form: HeroFormId): void;
  onGrantCrystals(amount: number): void;
  onHealFull(): void;
  onKillRoomEnemies(): void;
  onForceSave(): void;
  onResetSave(): void;
}

export interface OverlayViewState {
  screenMode: ScreenMode;
  optionsReturnMode: 'title' | 'paused';
  activeShop: ShopId | null;
  hasSave: boolean;
  saveSummary: { roomName: string; crystals: number; coins: number; form: HeroFormId } | null;
  simState: SimState;
  catalog: IWorldCatalog;
  settings: GameSettings;
  glyphs: DeviceGlyphMap;
  activeDevice: InputDeviceMode;
  touchOverlayVisible: boolean;
  customPackAvailable: boolean;
  customPackEnabled: boolean;
  customPackCount: number;
  customPackMessage: string | null;
  measuredFps: number;
  toastMessage: string | null;
}

const KEYBIND_LABELS: ReadonlyArray<{ key: keyof KeyBindings; label: string }> = [
  { key: 'left', label: 'Move Left' },
  { key: 'right', label: 'Move Right' },
  { key: 'up', label: 'Look Up' },
  { key: 'down', label: 'Down / Crouch' },
  { key: 'jump', label: 'Jump' },
  { key: 'dash', label: 'Dash / Ability' },
  { key: 'stomp', label: 'Stomp' },
  { key: 'formPrev', label: 'Prev Form' },
  { key: 'formNext', label: 'Next Form' },
  { key: 'interact', label: 'Interact' },
  { key: 'map', label: 'World Map' },
  { key: 'pause', label: 'Pause' },
];

const FORM_SHORT_LABELS: Record<HeroFormId, string> = {
  krunk_basic: 'Basic',
  krunk_fire: 'Fire',
  krunk_leaf: 'Leaf',
  krunk_rock: 'Rock',
  krunk_electric: 'Volt',
  krunk_shadow: 'Shadow',
};

function deviceLabel(device: InputDeviceMode): string {
  switch (device) {
    case 'keyboard':
      return 'KEYBOARD';
    case 'gamepad_xbox':
      return 'XBOX PAD';
    case 'gamepad_ps':
      return 'PS PAD';
    case 'gamepad_switch':
      return 'SWITCH PAD';
    case 'gamepad_tesla':
      return 'TESLA PAD';
    case 'touch':
      return 'TOUCH';
  }
}

function makeNeutralButtons(count = 16): Array<{ pressed: boolean; value: number }> {
  return Array.from({ length: count }, () => ({ pressed: false, value: 0 }));
}

function makeVirtualXboxSnapshot(activePulse: boolean): VirtualGamepadSnapshot {
  return {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)',
    mapping: 'standard',
    axes: [activePulse ? 0.5 : 0, 0, 0, 0],
    buttons: makeNeutralButtons(),
  };
}

function makeVirtualTeslaSnapshot(activePulse: boolean): VirtualGamepadSnapshot {
  return {
    id: 'Tesla In-Car USB Gamepad (HID)',
    mapping: '',
    // Axis 9 POV hat: -3/7 is Right (triggers device switch), 3.2857 is neutral
    axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, activePulse ? -3 / 7 : 3.2857],
    buttons: makeNeutralButtons(),
  };
}

export class OverlayManager {
  private readonly _root: HTMLElement;
  private readonly _actions: OverlayActions;
  private _lastView: OverlayViewState | null = null;

  private _screenLayer: HTMLElement | null = null;
  private _signBannerEl: HTMLElement | null = null;
  private _toastEl: HTMLElement | null = null;
  private _drawerEl: HTMLElement | null = null;
  private _drawerStatsEl: HTMLElement | null = null;
  private _deviceQaBtns = new Map<string, HTMLButtonElement>();

  private _drawerOpen = false;
  private _selectedWarpRoom = '';
  private _selectedBossId: BossId = 'primal_eye';
  private _listeningBindKey: keyof KeyBindings | null = null;
  private _packLoading = false;
  private _navCooldown = 0;

  private readonly _onCaptureKeyDown = (ev: KeyboardEvent) => {
    if (!this._listeningBindKey) return;
    ev.preventDefault();
    ev.stopPropagation();
    const targetKey = this._listeningBindKey;
    this._listeningBindKey = null;
    this._actions.onSetKeyCaptureSuppressed(false);
    if (ev.code !== 'Escape') {
      this._actions.onRebindKey(targetKey, ev.code);
    } else if (this._lastView) {
      this.render(this._lastView);
    }
  };

  constructor(root: HTMLElement, actions: OverlayActions) {
    this._root = root;
    this._actions = actions;
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onCaptureKeyDown, { capture: true });
    }
  }

  get isPlaytestDrawerOpen(): boolean {
    return this._drawerOpen;
  }

  togglePlaytestDrawer(force?: boolean): void {
    const next = force !== undefined ? force : !this._drawerOpen;
    if (next === this._drawerOpen) return;
    this._drawerOpen = next;
    if (this._lastView) {
      this._renderPlaytestDrawer(this._lastView);
    }
  }

  render(view: OverlayViewState): void {
    this._lastView = view;
    const doc = this._root.ownerDocument;
    if (!doc) return;

    if (!this._selectedWarpRoom || !view.catalog.rooms.has(this._selectedWarpRoom)) {
      this._selectedWarpRoom = view.simState.roomId;
    }

    // Cancel rebinding if leaving options
    if (view.screenMode !== 'options' && this._listeningBindKey) {
      this._listeningBindKey = null;
      this._actions.onSetKeyCaptureSuppressed(false);
    }

    this._renderScreenLayer(doc, view);
    this._renderSignBanner(doc, view);
    this._renderToast(doc, view);
    this._renderPlaytestDrawer(view);
  }

  updateLiveOverlays(view: OverlayViewState): void {
    this._lastView = view;
    const doc = this._root.ownerDocument;
    if (!doc) return;
    this._renderSignBanner(doc, view);
    this._renderToast(doc, view);
    if (this._drawerOpen && this._drawerStatsEl) {
      this._updateDrawerTelemetry(view);
      this._syncDeviceQaButtons(view);
    }
  }

  handleMenuNavigation(frame: InputFrame, dt: number, view: OverlayViewState): void {
    if (this._listeningBindKey) return;
    if (this._navCooldown > 0) {
      this._navCooldown = Math.max(0, this._navCooldown - dt);
    }

    // Close / Back shortcuts across Keyboard, Xbox, PS, Switch, Tesla Gamepad & Touch
    const gamepadBack = view.activeDevice !== 'keyboard' && frame.stompPressed;
    if (frame.pausePressed || gamepadBack) {
      if (view.screenMode === 'paused') {
        this._actions.onResume();
        return;
      }
      if (view.screenMode === 'options') {
        this._actions.onCloseOptions();
        return;
      }
      if (view.screenMode === 'shop') {
        this._actions.onCloseShop();
        return;
      }
      if (view.screenMode === 'map') {
        this._actions.onCloseMap();
        return;
      }
      if (view.screenMode === 'credits') {
        this._actions.onReturnToTitle();
        return;
      }
    }

    if (frame.mapPressed && view.screenMode === 'map') {
      this._actions.onCloseMap();
      return;
    }

    if (!this._screenLayer) return;

    const doc = this._root.ownerDocument;
    const active = (doc?.activeElement as HTMLElement | null) ?? null;

    // Range slider horizontal adjustment via Gamepad / Keyboard Left-Right
    if (
      this._navCooldown <= 0 &&
      Math.abs(frame.moveX) > 0.5 &&
      active &&
      active.tagName === 'INPUT' &&
      (active as HTMLInputElement).type === 'range' &&
      this._screenLayer.contains(active)
    ) {
      const rangeEl = active as HTMLInputElement;
      const step = Number(rangeEl.step) || 0.05;
      const min = Number(rangeEl.min);
      const max = Number(rangeEl.max);
      const cur = Number(rangeEl.value);
      const dir = frame.moveX > 0 ? 1 : -1;
      const next = Math.max(
        Number.isFinite(min) ? min : -Infinity,
        Math.min(Number.isFinite(max) ? max : Infinity, cur + dir * step),
      );
      if (next !== cur) {
        rangeEl.value = String(Number(next.toFixed(4)));
        rangeEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      this._navCooldown = 0.08;
      return;
    }

    // Move focus with Up/Down or Left/Right on Keyboard or Gamepad
    const moveVertical = Math.abs(frame.moveY) > 0.5;
    const moveHorizontal = Math.abs(frame.moveX) > 0.5;
    if (this._navCooldown <= 0 && (moveVertical || moveHorizontal)) {
      const focusables = Array.from(
        this._screenLayer.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
        ),
      );
      if (focusables.length > 0) {
        const activeIdx = active ? focusables.indexOf(active) : -1;
        const delta = moveVertical ? (frame.moveY < 0 ? 1 : -1) : frame.moveX > 0 ? 1 : -1;
        const nextIdx =
          activeIdx < 0
            ? delta > 0
              ? 0
              : focusables.length - 1
            : (activeIdx + delta + focusables.length) % focusables.length;
        const nextEl = focusables[nextIdx];
        if (nextEl) {
          nextEl.focus?.({ preventScroll: true });
          if (typeof nextEl.scrollIntoView === 'function') {
            nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
        }
        this._navCooldown = 0.16;
      }
    }

    // Confirm via Gamepad A / Y (keyboard Enter/Space natively clicks focused buttons)
    if (view.activeDevice !== 'keyboard' && (frame.jumpPressed || frame.interactPressed)) {
      if (active && this._screenLayer.contains(active)) {
        if (active.tagName === 'SELECT') {
          const sel = active as HTMLSelectElement;
          if (sel.options.length > 0) {
            sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else if (typeof active.click === 'function') {
          active.click();
        }
      } else {
        const firstBtn = this._screenLayer.querySelector<HTMLButtonElement>('button:not(:disabled)');
        firstBtn?.click();
      }
    }
  }

  dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onCaptureKeyDown, { capture: true });
    }
    this._listeningBindKey = null;
    this._deviceQaBtns.clear();
    while (this._root.firstChild) {
      this._root.removeChild(this._root.firstChild);
    }
    this._screenLayer = null;
    this._signBannerEl = null;
    this._toastEl = null;
    this._drawerEl = null;
    this._drawerStatsEl = null;
  }

  // --------------------------------------------------------------------------
  // Screen Rendering Dispatch (Delegates cleanly to specialized meta-UI modules)
  // --------------------------------------------------------------------------

  private _renderScreenLayer(doc: Document, view: OverlayViewState): void {
    if (this._screenLayer) {
      this._screenLayer.remove();
      this._screenLayer = null;
    }

    if (view.screenMode === 'playing') {
      return;
    }

    const backdrop = doc.createElement('div');
    backdrop.className =
      view.screenMode === 'title' ? 'kq-screen-backdrop kq-title-backdrop' : 'kq-screen-backdrop';
    backdrop.setAttribute('data-screen', view.screenMode);

    let panel: HTMLElement;
    switch (view.screenMode) {
      case 'title':
        panel = this._buildTitlePanel(doc, view);
        break;
      case 'paused':
        panel = this._buildPausePanel(doc, view);
        break;
      case 'options':
        panel = this._buildOptionsPanel(doc, view);
        break;
      case 'shop':
        panel = buildShopPanel(doc, view, this._actions);
        break;
      case 'map':
        panel = buildMapPanel(doc, view, this._actions);
        break;
      case 'victory':
        panel = buildVictoryPanel(doc, view, this._actions);
        break;
      case 'gameover':
        panel = buildGameOverPanel(doc, view, this._actions);
        break;
      case 'credits':
        panel = buildCreditsPanel(doc, view, this._actions);
        break;
      default:
        return;
    }

    backdrop.appendChild(panel);
    this._root.appendChild(backdrop);
    this._screenLayer = backdrop;

    // Auto-focus primary interactive button for immediate keyboard/gamepad flow
    const preferred =
      panel.querySelector<HTMLButtonElement>('.kq-btn-primary:not(:disabled)') ??
      panel.querySelector<HTMLButtonElement>('button:not(:disabled)');
    preferred?.focus?.({ preventScroll: true });
  }

  private _buildTitlePanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-title';

    const logoWrap = doc.createElement('div');
    logoWrap.className = 'kq-logo-wrap';

    const h1 = doc.createElement('h1');
    h1.className = 'kq-logo';
    h1.textContent = 'KRUNKED QUEST';

    const sub = doc.createElement('div');
    sub.className = 'kq-subtitle';
    sub.textContent = '16-BIT ACTION PLATFORMER';

    logoWrap.append(h1, sub);
    panel.appendChild(logoWrap);

    const list = doc.createElement('div');
    list.className = 'kq-menu-list';

    if (view.hasSave) {
      const contBtn = this._btn(doc, 'CONTINUE', 'kq-btn kq-btn-primary', () => this._actions.onContinue());
      if (view.saveSummary) {
        const meta = doc.createElement('span');
        meta.className = 'kq-continue-meta';
        meta.textContent = `(${view.saveSummary.roomName} · ${view.saveSummary.crystals}◆ · ${view.saveSummary.coins}★)`;
        contBtn.appendChild(meta);
      }
      list.appendChild(contBtn);
    }

    list.appendChild(
      this._btn(
        doc,
        'NEW GAME',
        view.hasSave ? 'kq-btn' : 'kq-btn kq-btn-primary',
        () => this._actions.onNewGame(),
      ),
    );
    list.appendChild(this._btn(doc, 'GHOST SHIP ENDLESS', 'kq-btn', () => this._actions.onStartGhostShip()));
    list.appendChild(this._btn(doc, 'TIME ATTACK', 'kq-btn', () => this._actions.onStartTimeAttack()));
    list.appendChild(this._btn(doc, 'OPTIONS', 'kq-btn', () => this._actions.onOpenOptions('title')));
    list.appendChild(this._btn(doc, 'CREDITS', 'kq-btn', () => this._actions.onOpenCredits()));

    panel.appendChild(list);

    // Custom Art Pack bar
    const packBox = doc.createElement('div');
    packBox.className = 'kq-pack-box';

    const statusRow = doc.createElement('div');
    statusRow.className = 'kq-pack-row';

    const badge = doc.createElement('span');
    if (view.customPackEnabled) {
      badge.className = 'kq-badge kq-badge-active';
      badge.textContent = `CUSTOM PACK ACTIVE (${view.customPackCount} ASSETS)`;
    } else if (view.customPackAvailable) {
      badge.className = 'kq-badge kq-badge-ready';
      badge.textContent = `PACK READY (${view.customPackCount} ASSETS)`;
    } else {
      badge.className = 'kq-badge';
      badge.textContent = 'BUILT-IN PIXEL ART';
    }
    statusRow.appendChild(badge);
    packBox.appendChild(statusRow);

    const btnRow = doc.createElement('div');
    btnRow.className = 'kq-pack-row';

    const loadBtn = this._btn(
      doc,
      this._packLoading ? 'LOADING PACK...' : 'LOAD CUSTOM PACK',
      'kq-btn kq-btn-sm kq-btn-accent',
      () => {
        if (this._packLoading) return;
        this._packLoading = true;
        loadBtn.disabled = true;
        loadBtn.textContent = 'LOADING PACK...';
        void this._actions.onLoadCustomPack().finally(() => {
          this._packLoading = false;
        });
      },
    );
    loadBtn.disabled = this._packLoading;

    const toggleLabel = view.customPackEnabled ? 'USE BUILT-IN ART' : 'USE CUSTOM PACK';
    const toggleBtn = this._btn(
      doc,
      toggleLabel,
      view.customPackEnabled ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
      () => {
        this._actions.onToggleCustomPack(!view.customPackEnabled);
      },
    );
    if (!view.customPackAvailable && !view.customPackEnabled) {
      toggleBtn.title = 'Load a custom pack folder first to enable custom sprites';
    }

    btnRow.append(loadBtn, toggleBtn);
    packBox.appendChild(btnRow);

    if (view.customPackMessage) {
      const msg = doc.createElement('div');
      msg.className = 'kq-panel-subheading';
      msg.textContent = view.customPackMessage;
      packBox.appendChild(msg);
    }

    panel.appendChild(packBox);

    const footer = doc.createElement('div');
    footer.className = 'kq-footer-hint';
    footer.textContent = `${deviceLabel(view.activeDevice)} · JUMP ${view.glyphs.jump} · DASH ${view.glyphs.dash} · STOMP ${view.glyphs.stomp} · [F9] PLAYTEST`;
    panel.appendChild(footer);

    return panel;
  }

  private _buildPausePanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-title';

    const header = doc.createElement('div');
    header.className = 'kq-panel-header';
    const title = doc.createElement('h2');
    title.className = 'kq-panel-heading';
    title.textContent = 'PAUSED';
    const roomBadge = doc.createElement('span');
    roomBadge.className = 'kq-badge kq-badge-gold';
    roomBadge.textContent = view.catalog.rooms.get(view.simState.roomId)?.name ?? view.simState.roomId;
    header.append(title, roomBadge);
    panel.appendChild(header);

    const list = doc.createElement('div');
    list.className = 'kq-menu-list';
    list.appendChild(this._btn(doc, 'RESUME', 'kq-btn kq-btn-primary', () => this._actions.onResume()));
    list.appendChild(this._btn(doc, 'WORLD MAP', 'kq-btn kq-btn-accent', () => this._actions.onOpenMap()));
    list.appendChild(this._btn(doc, 'OPTIONS', 'kq-btn', () => this._actions.onOpenOptions('paused')));
    list.appendChild(this._btn(doc, 'RETURN TO HUB', 'kq-btn', () => this._actions.onReturnToHub()));
    list.appendChild(
      this._btn(doc, 'SAVE & QUIT TO TITLE', 'kq-btn kq-btn-danger', () => this._actions.onSaveAndQuit()),
    );
    panel.appendChild(list);

    const footer = doc.createElement('div');
    footer.className = 'kq-footer-hint';
    footer.textContent = `CRYSTALS: ${view.simState.progress.crystals} · COINS: ${view.simState.progress.collectedCoinIds.length}/${view.catalog.totalCoins} · ${deviceLabel(view.activeDevice)}`;
    panel.appendChild(footer);

    return panel;
  }

  private _buildOptionsPanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-wide';

    const header = doc.createElement('div');
    header.className = 'kq-panel-header';
    const title = doc.createElement('h2');
    title.className = 'kq-panel-heading';
    title.textContent = 'OPTIONS';
    const backBtn = this._btn(doc, 'BACK', 'kq-btn kq-btn-sm kq-btn-primary', () => this._actions.onCloseOptions());
    header.append(title, backBtn);
    panel.appendChild(header);

    const scroll = doc.createElement('div');
    scroll.className = 'kq-panel-scroll';

    // 1. Display & Art
    const displaySec = this._section(doc, 'Display & Art');

    const fpsRow = this._optRow(doc, 'FPS Limit');
    const fpsGroup = doc.createElement('div');
    fpsGroup.className = 'kq-seg-group';
    const fpsChoices: readonly FpsLimitOption[] = [30, 60, 120];
    for (const fps of fpsChoices) {
      fpsGroup.appendChild(
        this._btn(
          doc,
          `${fps} FPS`,
          view.settings.render.fpsLimit === fps ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
          () => this._actions.onUpdateRenderSettings({ fpsLimit: fps }),
        ),
      );
    }
    fpsRow.appendChild(fpsGroup);
    displaySec.appendChild(fpsRow);

    const snapRow = this._optRow(doc, 'Classic Native-Snap');
    snapRow.appendChild(
      this._btn(
        doc,
        view.settings.render.classicSnap ? 'ON' : 'OFF',
        view.settings.render.classicSnap ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
        () => this._actions.onUpdateRenderSettings({ classicSnap: !view.settings.render.classicSnap }),
      ),
    );
    displaySec.appendChild(snapRow);

    const shakeRow = this._optRow(doc, 'Screen Shake');
    shakeRow.appendChild(
      this._btn(
        doc,
        view.settings.render.screenShake ? 'ON' : 'OFF',
        view.settings.render.screenShake ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
        () => this._actions.onUpdateRenderSettings({ screenShake: !view.settings.render.screenShake }),
      ),
    );
    displaySec.appendChild(shakeRow);

    const packRow = this._optRow(doc, 'Art Style');
    const packGroup = doc.createElement('div');
    packGroup.className = 'kq-seg-group';
    packGroup.appendChild(
      this._btn(
        doc,
        view.customPackEnabled ? 'CUSTOM PACK' : 'BUILT-IN ART',
        view.customPackEnabled ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
        () => this._actions.onToggleCustomPack(!view.customPackEnabled),
      ),
    );
    packGroup.appendChild(
      this._btn(doc, 'LOAD FOLDER', 'kq-btn kq-btn-sm kq-btn-accent', () => {
        void this._actions.onLoadCustomPack();
      }),
    );
    packRow.appendChild(packGroup);
    displaySec.appendChild(packRow);

    scroll.appendChild(displaySec);

    // 2. Input & Gamepad Settings
    const ctrlSec = this._section(doc, 'Device & Gamepad Controls');

    const touchModeRow = this._optRow(doc, 'Touch Overlay Visibility');
    const touchGroup = doc.createElement('div');
    touchGroup.className = 'kq-seg-group';
    const touchChoices: ReadonlyArray<{ mode: TouchVisibilitySetting; label: string }> = [
      { mode: 'auto', label: 'AUTO' },
      { mode: 'always_on', label: 'ALWAYS ON' },
      { mode: 'off', label: 'OFF' },
    ];
    for (const c of touchChoices) {
      touchGroup.appendChild(
        this._btn(
          doc,
          c.label,
          view.settings.input.touchMode === c.mode ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
          () => this._actions.onUpdateInputSettings({ touchMode: c.mode }),
        ),
      );
    }
    touchModeRow.appendChild(touchGroup);
    ctrlSec.appendChild(touchModeRow);

    const hapticRow = this._optRow(doc, 'Gamepad Haptics');
    hapticRow.appendChild(
      this._btn(
        doc,
        view.settings.input.hapticsEnabled ? 'ON' : 'OFF',
        view.settings.input.hapticsEnabled ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
        () => this._actions.onUpdateInputSettings({ hapticsEnabled: !view.settings.input.hapticsEnabled }),
      ),
    );
    ctrlSec.appendChild(hapticRow);

    ctrlSec.appendChild(
      this._sliderRow(
        doc,
        'Stick Deadzone',
        0.1,
        0.4,
        0.02,
        view.settings.input.deadzone,
        (v) => v.toFixed(2),
        (v) => this._actions.onUpdateInputSettings({ deadzone: v }),
      ),
    );
    scroll.appendChild(ctrlSec);

    // 3. Dedicated Interactive Touch Layout Customizer
    scroll.appendChild(buildTouchCustomizerSection(doc, view, this._actions));

    // 4. Audio
    const audioSec = this._section(doc, 'Audio');
    audioSec.appendChild(
      this._sliderRow(
        doc,
        'Master Volume',
        0,
        1,
        0.05,
        view.settings.audio.masterVolume,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._actions.onUpdateAudioSettings({ masterVolume: v }),
      ),
    );
    audioSec.appendChild(
      this._sliderRow(
        doc,
        'SFX Volume',
        0,
        1,
        0.05,
        view.settings.audio.sfxVolume,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._actions.onUpdateAudioSettings({ sfxVolume: v }),
      ),
    );
    audioSec.appendChild(
      this._sliderRow(
        doc,
        'Music Volume',
        0,
        1,
        0.05,
        view.settings.audio.musicVolume,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._actions.onUpdateAudioSettings({ musicVolume: v }),
      ),
    );
    const muteRow = this._optRow(doc, 'Mute All Audio');
    muteRow.appendChild(
      this._btn(
        doc,
        view.settings.audio.muted ? 'MUTED' : 'SOUND ON',
        view.settings.audio.muted ? 'kq-btn kq-btn-sm kq-btn-danger' : 'kq-btn kq-btn-sm kq-btn-active',
        () => this._actions.onUpdateAudioSettings({ muted: !view.settings.audio.muted }),
      ),
    );
    audioSec.appendChild(muteRow);
    scroll.appendChild(audioSec);

    // 5. Key Bindings
    const bindSec = this._section(doc, 'Keyboard Bindings');
    const bindGrid = doc.createElement('div');
    bindGrid.className = 'kq-bind-grid';

    for (const item of KEYBIND_LABELS) {
      const row = doc.createElement('div');
      row.className = 'kq-bind-row';

      const lbl = doc.createElement('span');
      lbl.textContent = item.label;

      const isListening = this._listeningBindKey === item.key;
      const code = view.settings.input.bindings[item.key];
      const bindBtn = this._btn(
        doc,
        isListening ? 'PRESS KEY...' : formatKeyCode(code),
        isListening ? 'kq-btn kq-btn-sm kq-btn-primary' : 'kq-btn kq-btn-sm',
        () => {
          this._listeningBindKey = item.key;
          this._actions.onSetKeyCaptureSuppressed(true);
          this.render(view);
        },
      );
      row.append(lbl, bindBtn);
      bindGrid.appendChild(row);
    }
    bindSec.appendChild(bindGrid);

    const resetRow = doc.createElement('div');
    resetRow.className = 'kq-opt-row';
    const note = doc.createElement('span');
    note.className = 'kq-panel-subheading';
    note.textContent = 'Arrow keys + WASD and Z/X/C alternates remain active alongside custom keys.';
    const resetBtn = this._btn(doc, 'RESET DEFAULTS', 'kq-btn kq-btn-sm', () => this._actions.onResetKeyBindings());
    resetRow.append(note, resetBtn);
    bindSec.appendChild(resetRow);

    scroll.appendChild(bindSec);
    panel.appendChild(scroll);

    return panel;
  }

  // --------------------------------------------------------------------------
  // Signpost, Toast & F9 Playtest Drawer
  // --------------------------------------------------------------------------

  private _renderSignBanner(doc: Document, view: OverlayViewState): void {
    const text = view.screenMode === 'playing' ? view.simState.activeSignText : null;
    if (!text) {
      if (this._signBannerEl) {
        this._signBannerEl.remove();
        this._signBannerEl = null;
      }
      return;
    }
    if (!this._signBannerEl) {
      this._signBannerEl = doc.createElement('div');
      this._signBannerEl.className = 'kq-sign-banner';
      this._root.appendChild(this._signBannerEl);
    }
    if (this._signBannerEl.textContent !== text) {
      this._signBannerEl.textContent = text;
    }
  }

  private _renderToast(doc: Document, view: OverlayViewState): void {
    if (!view.toastMessage) {
      if (this._toastEl) {
        this._toastEl.remove();
        this._toastEl = null;
      }
      return;
    }
    if (!this._toastEl) {
      this._toastEl = doc.createElement('div');
      this._toastEl.className = 'kq-toast';
      this._root.appendChild(this._toastEl);
    }
    if (this._toastEl.textContent !== view.toastMessage) {
      this._toastEl.textContent = view.toastMessage;
    }
  }

  private _renderPlaytestDrawer(view: OverlayViewState): void {
    if (!this._drawerOpen) {
      if (this._drawerEl) {
        this._drawerEl.remove();
        this._drawerEl = null;
        this._drawerStatsEl = null;
        this._deviceQaBtns.clear();
      }
      return;
    }
    const doc = this._root.ownerDocument;
    if (!doc) return;

    if (this._drawerEl) {
      this._drawerEl.remove();
      this._drawerEl = null;
      this._drawerStatsEl = null;
      this._deviceQaBtns.clear();
    }

    const drawer = doc.createElement('aside');
    drawer.className = 'kq-playtest-drawer';
    drawer.id = 'kq-playtest-drawer';

    const header = doc.createElement('div');
    header.className = 'kq-drawer-header';
    const title = doc.createElement('span');
    title.textContent = 'F9 PLAYTEST DRAWER';
    const closeBtn = this._btn(doc, '✕', 'kq-btn kq-btn-sm', () => this.togglePlaytestDrawer(false));
    header.append(title, closeBtn);
    drawer.appendChild(header);

    const stats = doc.createElement('div');
    stats.className = 'kq-drawer-stats';
    this._drawerStatsEl = stats;
    drawer.appendChild(stats);
    this._updateDrawerTelemetry(view);

    // Compact DEVICE QA Row calling window.__KRUNKED_DEBUG__
    const qaBox = doc.createElement('div');
    qaBox.className = 'kq-drawer-qa';

    const qaHead = doc.createElement('div');
    qaHead.className = 'kq-drawer-qa-head';
    const qaTitle = doc.createElement('span');
    qaTitle.textContent = 'DEVICE QA';
    const clearPadBtn = this._btn(doc, 'CLR PAD', 'kq-btn kq-btn-xs', () => {
      const dbg = typeof window !== 'undefined' ? window.__KRUNKED_DEBUG__ : undefined;
      dbg?.injectGamepad(null);
      if (this._lastView) {
        this._updateDrawerTelemetry(this._lastView);
        this._syncDeviceQaButtons(this._lastView);
      }
    });
    clearPadBtn.setAttribute('data-qa-device', 'clear_gamepad');
    clearPadBtn.title = 'Clear virtual gamepad override';
    qaHead.append(qaTitle, clearPadBtn);
    qaBox.appendChild(qaHead);

    const qaGrid = doc.createElement('div');
    qaGrid.className = 'kq-drawer-qa-grid';

    const qaDefs: ReadonlyArray<{
      id: string;
      label: string;
      device: InputDeviceMode;
      onClick: () => void;
    }> = [
      {
        id: 'touch',
        label: 'SIM TOUCH',
        device: 'touch',
        onClick: () => {
          const dbg = typeof window !== 'undefined' ? window.__KRUNKED_DEBUG__ : undefined;
          if (!dbg) return;
          dbg.injectGamepad(null);
          dbg.simulateTouchEvent();
        },
      },
      {
        id: 'keyboard',
        label: 'SIM KEY',
        device: 'keyboard',
        onClick: () => {
          const dbg = typeof window !== 'undefined' ? window.__KRUNKED_DEBUG__ : undefined;
          if (!dbg) return;
          dbg.injectGamepad(null);
          dbg.simulateKeyEvent('ArrowRight');
        },
      },
      {
        id: 'xbox',
        label: 'SIM XBOX',
        device: 'gamepad_xbox',
        onClick: () => {
          const dbg = typeof window !== 'undefined' ? window.__KRUNKED_DEBUG__ : undefined;
          if (!dbg) return;
          dbg.injectGamepad(makeVirtualXboxSnapshot(true));
          dbg.injectGamepad(makeVirtualXboxSnapshot(false));
        },
      },
      {
        id: 'tesla',
        label: 'SIM TESLA',
        device: 'gamepad_tesla',
        onClick: () => {
          const dbg = typeof window !== 'undefined' ? window.__KRUNKED_DEBUG__ : undefined;
          if (!dbg) return;
          dbg.injectGamepad(makeVirtualTeslaSnapshot(true));
          dbg.injectGamepad(makeVirtualTeslaSnapshot(false));
        },
      },
    ];

    for (const qd of qaDefs) {
      const btn = this._btn(doc, qd.label, 'kq-btn kq-btn-xs', () => {
        qd.onClick();
        if (this._lastView) {
          this._updateDrawerTelemetry(this._lastView);
          this._syncDeviceQaButtons(this._lastView);
        }
      });
      btn.setAttribute('data-qa-device', qd.id);
      this._deviceQaBtns.set(qd.device, btn);
      qaGrid.appendChild(btn);
    }

    qaBox.appendChild(qaGrid);
    drawer.appendChild(qaBox);
    this._syncDeviceQaButtons(view);

    // Room Warp Selector
    const warpRow = doc.createElement('div');
    warpRow.className = 'kq-drawer-row';
    const roomSelect = doc.createElement('select');
    roomSelect.className = 'kq-select';
    for (const rid of view.catalog.roomOrder) {
      const r = view.catalog.rooms.get(rid);
      const opt = doc.createElement('option');
      opt.value = rid;
      opt.textContent = r ? `${rid} (${r.biome})` : rid;
      if (rid === this._selectedWarpRoom) opt.selected = true;
      roomSelect.appendChild(opt);
    }
    roomSelect.addEventListener('change', () => {
      this._selectedWarpRoom = roomSelect.value;
    });
    const warpBtn = this._btn(doc, 'WARP', 'kq-btn kq-btn-sm kq-btn-primary', () => {
      this._actions.onWarpRoom(roomSelect.value);
    });
    warpRow.append(roomSelect, warpBtn);
    drawer.appendChild(warpRow);

    // Form Switcher
    const formGrid = doc.createElement('div');
    formGrid.className = 'kq-drawer-grid';
    for (const f of HERO_FORMS) {
      formGrid.appendChild(
        this._btn(
          doc,
          FORM_SHORT_LABELS[f],
          view.simState.hero.form === f ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
          () => this._actions.onSetForm(f),
        ),
      );
    }
    drawer.appendChild(formGrid);

    // Quick Action Grid
    const actionsGrid = doc.createElement('div');
    actionsGrid.className = 'kq-drawer-grid-2';
    actionsGrid.appendChild(this._btn(doc, 'UNLOCK FORMS', 'kq-btn kq-btn-sm', () => this._actions.onUnlockAllForms()));
    actionsGrid.appendChild(this._btn(doc, '+5000 ◆', 'kq-btn kq-btn-sm', () => this._actions.onGrantCrystals(5000)));
    actionsGrid.appendChild(this._btn(doc, 'HEAL FULL', 'kq-btn kq-btn-sm', () => this._actions.onHealFull()));
    actionsGrid.appendChild(
      this._btn(doc, 'KILL ENEMIES', 'kq-btn kq-btn-sm kq-btn-danger', () => this._actions.onKillRoomEnemies()),
    );
    drawer.appendChild(actionsGrid);

    // Boss Launcher
    const bossRow = doc.createElement('div');
    bossRow.className = 'kq-drawer-row';
    const bossSelect = doc.createElement('select');
    bossSelect.className = 'kq-select';
    for (const boss of view.catalog.bosses.values()) {
      const opt = doc.createElement('option');
      opt.value = boss.id;
      opt.textContent = `${boss.name} (${boss.maxHp}HP)`;
      if (boss.id === this._selectedBossId) opt.selected = true;
      bossSelect.appendChild(opt);
    }
    bossSelect.addEventListener('change', () => {
      this._selectedBossId = bossSelect.value as BossId;
    });
    const bossBtn = this._btn(doc, 'BOSS', 'kq-btn kq-btn-sm kq-btn-accent', () => {
      this._actions.onChallengeBoss(bossSelect.value as BossId);
    });
    bossRow.append(bossSelect, bossBtn);
    drawer.appendChild(bossRow);

    // Quick Toggles: FPS, Touch, Custom Pack, Save
    const toggleGrid = doc.createElement('div');
    toggleGrid.className = 'kq-drawer-grid-2';

    const nextFps: FpsLimitOption =
      view.settings.render.fpsLimit === 30 ? 60 : view.settings.render.fpsLimit === 60 ? 120 : 30;
    toggleGrid.appendChild(
      this._btn(doc, `FPS: ${view.settings.render.fpsLimit}`, 'kq-btn kq-btn-sm', () => {
        this._actions.onUpdateRenderSettings({ fpsLimit: nextFps });
      }),
    );

    const nextTouch: TouchVisibilitySetting =
      view.settings.input.touchMode === 'auto'
        ? 'always_on'
        : view.settings.input.touchMode === 'always_on'
          ? 'off'
          : 'auto';
    toggleGrid.appendChild(
      this._btn(doc, `TOUCH: ${view.settings.input.touchMode}`, 'kq-btn kq-btn-sm', () => {
        this._actions.onUpdateInputSettings({ touchMode: nextTouch });
      }),
    );

    toggleGrid.appendChild(
      this._btn(
        doc,
        view.customPackEnabled ? 'PACK: CUSTOM' : 'PACK: BUILTIN',
        view.customPackEnabled ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
        () => {
          this._actions.onToggleCustomPack(!view.customPackEnabled);
        },
      ),
    );

    toggleGrid.appendChild(this._btn(doc, 'SAVE NOW', 'kq-btn kq-btn-sm', () => this._actions.onForceSave()));
    drawer.appendChild(toggleGrid);

    this._root.appendChild(drawer);
    this._drawerEl = drawer;
  }

  private _syncDeviceQaButtons(view: OverlayViewState): void {
    const dbgState = typeof window !== 'undefined' ? window.__KRUNKED_DEBUG__?.getDeviceState() : undefined;
    const activeDev = dbgState?.activeDevice ?? view.activeDevice;
    for (const [dev, btn] of this._deviceQaBtns.entries()) {
      btn.className = dev === activeDev ? 'kq-btn kq-btn-xs kq-btn-active' : 'kq-btn kq-btn-xs';
    }
  }

  private _updateDrawerTelemetry(view: OverlayViewState): void {
    if (!this._drawerStatsEl) return;
    const s = view.simState;
    this._drawerStatsEl.innerHTML = '';
    const doc = this._root.ownerDocument;
    if (!doc) return;

    const dbgState = typeof window !== 'undefined' ? window.__KRUNKED_DEBUG__?.getDeviceState() : undefined;
    const activeDev = dbgState?.activeDevice ?? view.activeDevice;
    const touchVis = dbgState?.touchOverlayVisible ?? view.touchOverlayVisible;

    const entries: Array<[string, string]> = [
      ['ROOM', s.roomId],
      ['FPS', `${Math.round(view.measuredFps)}/${view.settings.render.fpsLimit}`],
      ['HP', `${s.hero.hp}/${s.hero.maxHp}`],
      ['FORM', FORM_SHORT_LABELS[s.hero.form]],
      ['◆', String(s.progress.crystals)],
      ['DEV', `${deviceLabel(activeDev)} (${touchVis ? 'T:ON' : 'T:OFF'})`],
    ];
    for (const [k, v] of entries) {
      const cell = doc.createElement('div');
      const strong = doc.createElement('strong');
      strong.textContent = `${k}: `;
      cell.append(strong, doc.createTextNode(v));
      this._drawerStatsEl.appendChild(cell);
    }
  }

  // --------------------------------------------------------------------------
  // DOM Helpers
  // --------------------------------------------------------------------------

  private _btn(doc: Document, label: string, className: string, onClick: () => void): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  private _section(doc: Document, titleText: string): HTMLElement {
    const sec = doc.createElement('section');
    sec.className = 'kq-section';
    const title = doc.createElement('div');
    title.className = 'kq-section-title';
    title.textContent = titleText;
    sec.appendChild(title);
    return sec;
  }

  private _optRow(doc: Document, labelText: string): HTMLElement {
    const row = doc.createElement('div');
    row.className = 'kq-opt-row';
    const lbl = doc.createElement('span');
    lbl.className = 'kq-opt-label';
    lbl.textContent = labelText;
    row.appendChild(lbl);
    return row;
  }

  private _sliderRow(
    doc: Document,
    labelText: string,
    min: number,
    max: number,
    step: number,
    value: number,
    format: (v: number) => string,
    onChange: (v: number) => void,
  ): HTMLElement {
    const row = this._optRow(doc, labelText);
    const wrap = doc.createElement('div');
    wrap.className = 'kq-slider-wrap';

    const input = doc.createElement('input');
    input.type = 'range';
    input.className = 'kq-slider';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);

    const valSpan = doc.createElement('span');
    valSpan.className = 'kq-slider-val';
    valSpan.textContent = format(value);

    input.addEventListener('input', () => {
      const num = Number(input.value);
      if (Number.isFinite(num)) {
        valSpan.textContent = format(num);
        onChange(num);
      }
    });

    wrap.append(input, valSpan);
    row.appendChild(wrap);
    return row;
  }
}
