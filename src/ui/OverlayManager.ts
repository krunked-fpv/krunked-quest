import {
  HERO_FORMS,
  SIM_HZ,
  type AudioSettings,
  type BiomeId,
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
} from '../contracts/index.js';
import { formatKeyCode } from '../input/InputOrchestrator.js';

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

const SHOP_META: Record<ShopId, { title: string; subtitle: string }> = {
  vespera: { title: 'Vespera — Core Upgrades', subtitle: 'Expand vitality, relic slots, and resilience' },
  orla: { title: 'Orla — Form Mastery & Maps', subtitle: 'Unlock form evolutions and cartography tools' },
  barnaby: { title: 'Barnaby — Relic Bazaar', subtitle: 'Buy and equip mystical combat charms' },
  garron: { title: 'Garron — Arena & Boss Rematch', subtitle: 'Challenge conquered or upcoming guardians' },
  barnacle: { title: 'Captain Barnacle — Ghost Ship', subtitle: 'Endless wave survival aboard the cursed galleon' },
  codex: { title: 'Codex — Adventurer Tome', subtitle: 'Controls, elemental forms, and quest records' },
};

const BIOME_COLORS: Record<BiomeId, string> = {
  MLAIR: '#4a306d',
  OPOUSO: '#2e6b5e',
  TDM: '#3b7a3d',
  FLIN: '#1f5c43',
  AP: '#6b4e2b',
  ATVC: '#8b2e2e',
  DSI: '#947435',
  LAB: '#2b5d7a',
  TEMP: '#69538c',
  EVIL: '#591c48',
  GSHIP: '#244763',
};

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

function formatTicksAsTime(ticks: number): string {
  const totalSec = Math.max(0, ticks / SIM_HZ);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const centis = Math.floor((totalSec - Math.floor(totalSec)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

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
      return 'IN-CAR PAD';
    case 'touch':
      return 'TOUCH';
  }
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
    }
  }

  handleMenuNavigation(frame: InputFrame, dt: number, view: OverlayViewState): void {
    if (this._listeningBindKey) return;
    if (this._navCooldown > 0) {
      this._navCooldown = Math.max(0, this._navCooldown - dt);
    }

    // Close / Back shortcuts
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

    // Move focus with Up/Down on Keyboard or Gamepad
    if (this._navCooldown <= 0 && Math.abs(frame.moveY) > 0.5) {
      const focusables = Array.from(
        this._screenLayer.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)'),
      );
      if (focusables.length > 0) {
        const doc = this._root.ownerDocument;
        const activeIdx = doc ? focusables.indexOf(doc.activeElement as HTMLElement) : -1;
        const delta = frame.moveY < 0 ? 1 : -1;
        const nextIdx =
          activeIdx < 0
            ? delta > 0
              ? 0
              : focusables.length - 1
            : (activeIdx + delta + focusables.length) % focusables.length;
        focusables[nextIdx]?.focus();
        this._navCooldown = 0.17;
      }
    }

    // Confirm via Gamepad A / Y (keyboard Enter/Space natively clicks focused buttons)
    if (view.activeDevice !== 'keyboard' && (frame.jumpPressed || frame.interactPressed)) {
      const doc = this._root.ownerDocument;
      const active = doc?.activeElement as HTMLElement | null;
      if (active && this._screenLayer.contains(active) && typeof active.click === 'function') {
        active.click();
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
  // Screen Rendering Dispatch
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
        panel = this._buildShopPanel(doc, view);
        break;
      case 'map':
        panel = this._buildMapPanel(doc, view);
        break;
      case 'victory':
        panel = this._buildVictoryPanel(doc, view);
        break;
      case 'gameover':
        panel = this._buildGameOverPanel(doc, view);
        break;
      case 'credits':
        panel = this._buildCreditsPanel(doc, view);
        break;
      default:
        return;
    }

    backdrop.appendChild(panel);
    this._root.appendChild(backdrop);
    this._screenLayer = backdrop;

    // Auto-focus primary button for immediate keyboard/gamepad flow
    const firstBtn = panel.querySelector<HTMLButtonElement>('button:not(:disabled)');
    firstBtn?.focus({ preventScroll: true });
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
    list.appendChild(this._btn(doc, 'WORLD MAP', 'kq-btn', () => this._actions.onOpenMap()));
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

    // 1. Display & Performance
    const displaySec = this._section(doc, 'Display & Art');

    // FPS Limit
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

    // Classic Native-Snap
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

    // Screen Shake
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

    // Custom Pack
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

    // 2. Controls & Touch
    const ctrlSec = this._section(doc, 'Touch & Gamepad Controls');

    const touchModeRow = this._optRow(doc, 'Touch Controls');
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

    ctrlSec.appendChild(
      this._sliderRow(
        doc,
        'Touch Opacity',
        0.2,
        0.65,
        0.01,
        view.settings.input.touchLayout.opacity,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._actions.onUpdateTouchLayout({ opacity: v }),
      ),
    );

    ctrlSec.appendChild(
      this._sliderRow(
        doc,
        'Touch Scale',
        0.75,
        1.35,
        0.05,
        view.settings.input.touchLayout.scale,
        (v) => `${Math.round(v * 100)}%`,
        (v) => this._actions.onUpdateTouchLayout({ scale: v }),
      ),
    );

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

    // 3. Audio
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

    // 4. Key Bindings
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

  private _buildShopPanel(doc: Document, view: OverlayViewState): HTMLElement {
    const shopId: ShopId = view.activeShop ?? 'codex';
    const meta = SHOP_META[shopId];

    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-wide';

    const header = doc.createElement('div');
    header.className = 'kq-panel-header';

    const leftHead = doc.createElement('div');
    const h2 = doc.createElement('h2');
    h2.className = 'kq-panel-heading';
    h2.textContent = meta.title;
    const sub = doc.createElement('div');
    sub.className = 'kq-panel-subheading';
    sub.textContent = meta.subtitle;
    leftHead.append(h2, sub);

    const rightHead = doc.createElement('div');
    rightHead.className = 'kq-shop-balance';
    const bal = doc.createElement('span');
    bal.textContent = `◆ ${view.simState.progress.crystals}`;
    const closeBtn = this._btn(doc, 'CLOSE', 'kq-btn kq-btn-sm kq-btn-primary', () => this._actions.onCloseShop());
    rightHead.append(bal, closeBtn);

    header.append(leftHead, rightHead);
    panel.appendChild(header);

    const scroll = doc.createElement('div');
    scroll.className = 'kq-panel-scroll';

    if (shopId === 'vespera' || shopId === 'orla') {
      const upgrades = view.catalog.upgrades.filter((u) => u.shop === shopId);
      const list = doc.createElement('div');
      list.className = 'kq-card-list';

      for (const upg of upgrades) {
        const curLevel = view.simState.progress.upgradeLevels[upg.key] ?? 0;
        const maxed = curLevel >= upg.maxLevel;
        const price = upg.basePrice + curLevel * upg.priceStep;
        const formLocked =
          upg.requiredForm !== undefined && !view.simState.progress.unlockedForms.includes(upg.requiredForm);
        const canAfford = view.simState.progress.crystals >= price;

        const card = doc.createElement('div');
        card.className = 'kq-card';

        const info = doc.createElement('div');
        info.className = 'kq-card-info';

        const titleRow = doc.createElement('div');
        titleRow.className = 'kq-card-title';
        titleRow.textContent = upg.name;

        const lvlBadge = doc.createElement('span');
        lvlBadge.className = maxed ? 'kq-badge kq-badge-active' : 'kq-badge';
        lvlBadge.textContent = maxed ? 'MAX' : `LV ${curLevel}/${upg.maxLevel}`;
        titleRow.appendChild(lvlBadge);

        if (upg.requiredForm) {
          const formBadge = doc.createElement('span');
          formBadge.className = formLocked ? 'kq-badge' : 'kq-badge kq-badge-ready';
          formBadge.textContent = FORM_SHORT_LABELS[upg.requiredForm];
          titleRow.appendChild(formBadge);
        }

        const desc = doc.createElement('div');
        desc.className = 'kq-card-desc';
        desc.textContent = upg.description;
        info.append(titleRow, desc);

        const buyBtn = this._btn(
          doc,
          maxed ? 'MAXED' : formLocked ? 'LOCKED' : `BUY ${price}◆`,
          !maxed && !formLocked && canAfford ? 'kq-btn kq-btn-sm kq-btn-primary' : 'kq-btn kq-btn-sm',
          () => {
            this._actions.onBuyUpgrade(upg.key);
          },
        );
        buyBtn.disabled = maxed || formLocked || !canAfford;

        card.append(info, buyBtn);
        list.appendChild(card);
      }
      scroll.appendChild(list);
    } else if (shopId === 'barnaby') {
      const maxSlots = 1 + (view.simState.progress.upgradeLevels.ItemSlot ?? 0);
      const equippedCount = view.simState.progress.equippedRelics.length;

      const slotBar = doc.createElement('div');
      slotBar.className = 'kq-badge kq-badge-gold';
      slotBar.textContent = `RELIC SLOTS EQUIPPED: ${equippedCount} / ${maxSlots}`;
      scroll.appendChild(slotBar);

      const list = doc.createElement('div');
      list.className = 'kq-card-list';

      for (const relic of view.catalog.relics) {
        const owned = view.simState.progress.ownedRelics.includes(relic.id);
        const equipped = view.simState.progress.equippedRelics.includes(relic.id);
        const canAfford = view.simState.progress.crystals >= relic.price;

        const card = doc.createElement('div');
        card.className = equipped ? 'kq-card kq-card-equipped' : 'kq-card';

        const info = doc.createElement('div');
        info.className = 'kq-card-info';

        const titleRow = doc.createElement('div');
        titleRow.className = 'kq-card-title';
        const swatch = doc.createElement('span');
        swatch.className = 'kq-swatch';
        swatch.style.backgroundColor = relic.iconColor;
        const nameSpan = doc.createElement('span');
        nameSpan.textContent = relic.name;
        titleRow.append(swatch, nameSpan);

        if (equipped) {
          const eq = doc.createElement('span');
          eq.className = 'kq-badge kq-badge-active';
          eq.textContent = 'EQUIPPED';
          titleRow.appendChild(eq);
        }

        const desc = doc.createElement('div');
        desc.className = 'kq-card-desc';
        desc.textContent = relic.description;
        info.append(titleRow, desc);

        let actionBtn: HTMLButtonElement;
        if (!owned) {
          actionBtn = this._btn(
            doc,
            `BUY ${relic.price}◆`,
            canAfford ? 'kq-btn kq-btn-sm kq-btn-primary' : 'kq-btn kq-btn-sm',
            () => {
              this._actions.onBuyRelic(relic.id);
            },
          );
          actionBtn.disabled = !canAfford;
        } else {
          actionBtn = this._btn(
            doc,
            equipped ? 'UNEQUIP' : 'EQUIP',
            equipped ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm kq-btn-accent',
            () => {
              this._actions.onToggleEquipRelic(relic.id);
            },
          );
        }

        card.append(info, actionBtn);
        list.appendChild(card);
      }
      scroll.appendChild(list);
    } else if (shopId === 'garron') {
      const list = doc.createElement('div');
      list.className = 'kq-card-list';

      for (const boss of view.catalog.bosses.values()) {
        const defeated = view.simState.progress.defeatedBosses.includes(boss.id);
        const card = doc.createElement('div');
        card.className = defeated ? 'kq-card kq-card-equipped' : 'kq-card';

        const info = doc.createElement('div');
        info.className = 'kq-card-info';

        const titleRow = doc.createElement('div');
        titleRow.className = 'kq-card-title';
        titleRow.textContent = boss.name;

        const hpBadge = doc.createElement('span');
        hpBadge.className = 'kq-badge kq-badge-gold';
        hpBadge.textContent = `${boss.maxHp} HP`;
        titleRow.appendChild(hpBadge);

        if (defeated) {
          const defBadge = doc.createElement('span');
          defBadge.className = 'kq-badge kq-badge-active';
          defBadge.textContent = 'DEFEATED';
          titleRow.appendChild(defBadge);
        }

        const desc = doc.createElement('div');
        desc.className = 'kq-card-desc';
        const unlockTxt = boss.unlockForm ? ` · Unlocks ${FORM_SHORT_LABELS[boss.unlockForm]} Form` : '';
        desc.textContent = `${boss.subtitle} (${boss.biome}) · Reward: ${boss.crystalReward}◆${unlockTxt}`;
        info.append(titleRow, desc);

        const fightBtn = this._btn(doc, 'CHALLENGE', 'kq-btn kq-btn-sm kq-btn-primary', () => {
          this._actions.onChallengeBoss(boss.id);
        });
        card.append(info, fightBtn);
        list.appendChild(card);
      }
      scroll.appendChild(list);
    } else if (shopId === 'barnacle') {
      const sec = this._section(doc, 'Cursed Galleon Endless Voyage');
      const p = doc.createElement('div');
      p.className = 'kq-card-desc';
      p.textContent =
        'Board the Ghost Ship and survive escalating waves of spectral raiders, hazard tiers, and relentless combo multipliers. Collect crystals and beat your wave record!';
      sec.appendChild(p);

      const stats = doc.createElement('div');
      stats.className = 'kq-stat-grid';
      stats.append(
        this._statItem(doc, 'Best Wave', String(view.simState.progress.ghostShipBestWave)),
        this._statItem(doc, 'High Score', String(view.simState.progress.ghostShipHighScore)),
      );
      sec.appendChild(stats);

      sec.appendChild(
        this._btn(doc, 'SET SAIL — LAUNCH GHOST SHIP', 'kq-btn kq-btn-primary', () => {
          this._actions.onStartGhostShip();
        }),
      );
      scroll.appendChild(sec);
    } else {
      // Codex — Controls, Forms, Quest Progress
      const ctrlSec = this._section(doc, `Active Controls (${deviceLabel(view.activeDevice)})`);
      const ctrlGrid = doc.createElement('div');
      ctrlGrid.className = 'kq-stat-grid';
      ctrlGrid.append(
        this._statItem(doc, 'Jump', view.glyphs.jump),
        this._statItem(doc, 'Dash / Form Ability', view.glyphs.dash),
        this._statItem(doc, 'Air Stomp', view.glyphs.stomp),
        this._statItem(doc, 'Switch Form', view.glyphs.form),
        this._statItem(doc, 'Interact', view.glyphs.interact),
        this._statItem(doc, 'Map / Pause', `${view.glyphs.map} / ${view.glyphs.pause}`),
      );
      ctrlSec.appendChild(ctrlGrid);
      scroll.appendChild(ctrlSec);

      const formSec = this._section(doc, 'Elemental Forms');
      const formList = doc.createElement('div');
      formList.className = 'kq-card-list';
      for (const form of view.catalog.forms) {
        const unlocked = view.simState.progress.unlockedForms.includes(form.id);
        const card = doc.createElement('div');
        card.className = unlocked ? 'kq-card kq-card-equipped' : 'kq-card';
        const info = doc.createElement('div');
        info.className = 'kq-card-info';
        const titleRow = doc.createElement('div');
        titleRow.className = 'kq-card-title';
        const swatch = doc.createElement('span');
        swatch.className = 'kq-swatch';
        swatch.style.backgroundColor = form.palette[2] ?? '#ff4fa3';
        const nm = doc.createElement('span');
        nm.textContent = `${form.name} — ${form.abilityName}`;
        const st = doc.createElement('span');
        st.className = unlocked ? 'kq-badge kq-badge-active' : 'kq-badge';
        st.textContent = unlocked ? 'UNLOCKED' : 'LOCKED';
        titleRow.append(swatch, nm, st);
        const desc = doc.createElement('div');
        desc.className = 'kq-card-desc';
        desc.textContent = form.description;
        info.append(titleRow, desc);
        card.appendChild(info);
        formList.appendChild(card);
      }
      formSec.appendChild(formList);
      scroll.appendChild(formSec);

      const progSec = this._section(doc, 'Quest Ledger');
      const progGrid = doc.createElement('div');
      progGrid.className = 'kq-stat-grid';
      progGrid.append(
        this._statItem(
          doc,
          'Golden Coins',
          `${view.simState.progress.collectedCoinIds.length} / ${view.catalog.totalCoins}`,
        ),
        this._statItem(doc, 'Bosses Defeated', `${view.simState.progress.defeatedBosses.length} / ${view.catalog.bosses.size}`),
        this._statItem(
          doc,
          'Rooms Explored',
          `${view.simState.progress.visitedRooms.length} / ${view.catalog.rooms.size}`,
        ),
        this._statItem(doc, 'Teleporters', String(view.simState.progress.unlockedTeleporters.length)),
      );
      progSec.appendChild(progGrid);
      scroll.appendChild(progSec);
    }

    panel.appendChild(scroll);
    return panel;
  }

  private _buildMapPanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-wide';

    const header = doc.createElement('div');
    header.className = 'kq-panel-header';
    const title = doc.createElement('h2');
    title.className = 'kq-panel-heading';
    title.textContent = 'WORLD MAP';
    const closeBtn = this._btn(doc, 'CLOSE', 'kq-btn kq-btn-sm kq-btn-primary', () => this._actions.onCloseMap());
    header.append(title, closeBtn);
    panel.appendChild(header);

    const progress = view.simState.progress;
    const visitedSet = new Set(progress.visitedRooms);
    visitedSet.add(view.simState.roomId);
    const tpSet = new Set(progress.unlockedTeleporters);
    const showExits = (progress.upgradeLevels.ViewMapExits ?? 0) > 0;
    const showSecrets = (progress.upgradeLevels.ViewSecretAreas ?? 0) > 0;
    const showArenas = (progress.upgradeLevels.ViewMapArenas ?? 0) > 0;

    const allRooms = Array.from(view.catalog.rooms.values());
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const r of allRooms) {
      minX = Math.min(minX, r.mapX);
      maxX = Math.max(maxX, r.mapX);
      minY = Math.min(minY, r.mapY);
      maxY = Math.max(maxY, r.mapY);
    }
    if (!Number.isFinite(minX)) {
      minX = maxX = minY = maxY = 0;
    }

    const cols = Math.max(1, maxX - minX + 1);

    const gridWrap = doc.createElement('div');
    gridWrap.className = 'kq-map-grid-wrap';

    const grid = doc.createElement('div');
    grid.className = 'kq-map-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(74px, 1fr))`;

    const roomAt = new Map<string, (typeof allRooms)[number]>();
    for (const r of allRooms) {
      roomAt.set(`${r.mapX},${r.mapY}`, r);
    }

    // Y-up map coordinates -> top row is maxY, bottom row is minY
    for (let gy = maxY; gy >= minY; gy--) {
      for (let gx = minX; gx <= maxX; gx++) {
        const room = roomAt.get(`${gx},${gy}`);
        if (!room) {
          const spacer = doc.createElement('div');
          grid.appendChild(spacer);
          continue;
        }
        const visited = visitedSet.has(room.id);
        const isCurrent = room.id === view.simState.roomId;
        const canFastTravel = tpSet.has(room.id);
        const revealed = visited || (room.isSecret && showSecrets) || (room.mode !== 'normal' && showArenas);

        const cell = doc.createElement('button');
        cell.type = 'button';
        let cls = 'kq-map-cell';
        if (isCurrent) cls += ' kq-map-cell-current';
        if (canFastTravel) cls += ' kq-map-cell-teleporter';
        if (room.isSecret && showSecrets) cls += ' kq-map-cell-secret';
        if (!revealed) cls += ' kq-map-cell-unvisited';
        cell.className = cls;
        cell.style.backgroundColor = revealed ? BIOME_COLORS[room.biome] ?? '#201239' : '#150d24';
        cell.disabled = !canFastTravel;

        const nameLine = doc.createElement('div');
        nameLine.textContent = revealed ? room.name : '???';

        const icons = doc.createElement('div');
        icons.className = 'kq-map-icons';
        const tags: string[] = [];
        if (isCurrent) tags.push('●YOU');
        if (canFastTravel) tags.push('⚡TP');
        if (showArenas && room.mode === 'boss') tags.push('☠BOSS');
        else if (showArenas && room.mode === 'arena') tags.push('⚔ARENA');
        if (showSecrets && room.isSecret) tags.push('?SEC');
        if (showExits && revealed && room.exits.length > 0) {
          const dirs = room.exits
            .map((e) => (e.dir === 'left' ? '←' : e.dir === 'right' ? '→' : e.dir === 'up' ? '↑' : e.dir === 'down' ? '↓' : '◈'))
            .join('');
          tags.push(dirs);
        }
        icons.textContent = tags.join(' ');

        cell.append(nameLine, icons);
        if (canFastTravel) {
          cell.title = `Fast travel to ${room.name}`;
          cell.addEventListener('click', () => {
            this._actions.onFastTravel(room.id);
          });
        }

        grid.appendChild(cell);
      }
    }

    gridWrap.appendChild(grid);
    panel.appendChild(gridWrap);

    // Quick Fast-Travel Teleporter buttons
    const unlockedTps = progress.unlockedTeleporters.filter((id) => view.catalog.rooms.has(id));
    if (unlockedTps.length > 0) {
      const tpSec = this._section(doc, 'Unlocked Teleporters — Click to Fast Travel');
      const tpRow = doc.createElement('div');
      tpRow.className = 'kq-pack-row';
      for (const roomId of unlockedTps) {
        const r = view.catalog.rooms.get(roomId);
        if (!r) continue;
        tpRow.appendChild(
          this._btn(
            doc,
            `⚡ ${r.name}`,
            roomId === view.simState.roomId ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm kq-btn-accent',
            () => {
              this._actions.onFastTravel(roomId);
            },
          ),
        );
      }
      tpSec.appendChild(tpRow);
      panel.appendChild(tpSec);
    }

    const legend = doc.createElement('div');
    legend.className = 'kq-map-legend';
    legend.textContent = `● Current Room  |  ⚡ Teleporter (${unlockedTps.length} unlocked)  |  Explored: ${visitedSet.size}/${allRooms.length}`;
    panel.appendChild(legend);

    return panel;
  }

  private _buildVictoryPanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-title';

    const h2 = doc.createElement('h2');
    h2.className = 'kq-logo';
    h2.textContent = 'VICTORY!';
    panel.appendChild(h2);

    const sub = doc.createElement('div');
    sub.className = 'kq-subtitle';
    sub.textContent =
      view.simState.mode === 'time_attack'
        ? 'TIME ATTACK COMPLETE'
        : view.simState.mode === 'boss_rush'
          ? 'GUARDIAN VANQUISHED'
          : 'QUEST TRIUMPHANT';
    panel.appendChild(sub);

    const stats = doc.createElement('div');
    stats.className = 'kq-stat-grid';
    const timeTicks = view.simState.mode === 'time_attack' ? view.simState.timeAttackTicks : view.simState.tick;
    stats.append(
      this._statItem(doc, 'Clear Time', formatTicksAsTime(timeTicks)),
      this._statItem(doc, 'Crystals', String(view.simState.progress.crystals)),
      this._statItem(
        doc,
        'Coins',
        `${view.simState.progress.collectedCoinIds.length} / ${view.catalog.totalCoins}`,
      ),
      this._statItem(
        doc,
        'Bosses',
        `${view.simState.progress.defeatedBosses.length} / ${view.catalog.bosses.size}`,
      ),
    );
    panel.appendChild(stats);

    const list = doc.createElement('div');
    list.className = 'kq-menu-list';
    list.appendChild(this._btn(doc, 'VIEW CREDITS', 'kq-btn kq-btn-primary', () => this._actions.onOpenCredits()));
    list.appendChild(this._btn(doc, 'CONTINUE EXPLORING', 'kq-btn', () => this._actions.onReturnToHub()));
    list.appendChild(this._btn(doc, 'RETURN TO TITLE', 'kq-btn', () => this._actions.onReturnToTitle()));
    panel.appendChild(list);

    return panel;
  }

  private _buildGameOverPanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-title';

    const h2 = doc.createElement('h2');
    h2.className = 'kq-panel-heading';
    h2.style.fontSize = '28px';
    h2.style.color = '#ff5468';
    h2.textContent = 'DEFEATED';
    panel.appendChild(h2);

    const stats = doc.createElement('div');
    stats.className = 'kq-stat-grid';
    if (view.simState.mode === 'ghost_ship') {
      stats.append(
        this._statItem(doc, 'Wave Reached', String(view.simState.ghostShip.wave)),
        this._statItem(doc, 'Score', String(view.simState.ghostShip.score)),
        this._statItem(doc, 'Best Wave', String(view.simState.progress.ghostShipBestWave)),
        this._statItem(doc, 'Crystals', String(view.simState.progress.crystals)),
      );
    } else {
      stats.append(
        this._statItem(doc, 'Room', view.catalog.rooms.get(view.simState.roomId)?.name ?? view.simState.roomId),
        this._statItem(doc, 'Crystals', String(view.simState.progress.crystals)),
      );
    }
    panel.appendChild(stats);

    const list = doc.createElement('div');
    list.className = 'kq-menu-list';
    list.appendChild(this._btn(doc, 'RETRY / RESPAWN', 'kq-btn kq-btn-primary', () => this._actions.onRetryGameOver()));
    list.appendChild(this._btn(doc, 'RETURN TO HUB', 'kq-btn', () => this._actions.onReturnToHub()));
    list.appendChild(this._btn(doc, 'TITLE SCREEN', 'kq-btn kq-btn-danger', () => this._actions.onReturnToTitle()));
    panel.appendChild(list);

    return panel;
  }

  private _buildCreditsPanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-title';

    const h2 = doc.createElement('h2');
    h2.className = 'kq-logo';
    h2.textContent = 'KRUNKED QUEST';
    panel.appendChild(h2);

    const sec = this._section(doc, 'Credits');
    const lines = [
      'Engine & 60Hz Deterministic Simulation — Krunked Quest Team',
      '16-Bit Pixel Craft & Procedural Synth — Krunked Quest Studio',
      'Multi-Device Controls — Keyboard, Gamepad & Auto-Touch',
      'Thank you for playing Krunked Quest!',
    ];
    for (const line of lines) {
      const p = doc.createElement('div');
      p.className = 'kq-card-desc';
      p.style.textAlign = 'center';
      p.textContent = line;
      sec.appendChild(p);
    }
    panel.appendChild(sec);

    const footer = doc.createElement('div');
    footer.className = 'kq-footer-hint';
    footer.textContent = `TOTAL COINS: ${view.simState.progress.collectedCoinIds.length}/${view.catalog.totalCoins} · FORMS: ${view.simState.progress.unlockedForms.length}/${HERO_FORMS.length}`;
    panel.appendChild(footer);

    panel.appendChild(this._btn(doc, 'RETURN TO TITLE', 'kq-btn kq-btn-primary', () => this._actions.onReturnToTitle()));
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
      }
      return;
    }
    const doc = this._root.ownerDocument;
    if (!doc) return;

    if (this._drawerEl) {
      this._drawerEl.remove();
      this._drawerEl = null;
      this._drawerStatsEl = null;
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
    actionsGrid.appendChild(this._btn(doc, 'KILL ENEMIES', 'kq-btn kq-btn-sm kq-btn-danger', () => this._actions.onKillRoomEnemies()));
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

  private _updateDrawerTelemetry(view: OverlayViewState): void {
    if (!this._drawerStatsEl) return;
    const s = view.simState;
    this._drawerStatsEl.innerHTML = '';
    const doc = this._root.ownerDocument;
    if (!doc) return;

    const entries: Array<[string, string]> = [
      ['ROOM', s.roomId],
      ['FPS', `${Math.round(view.measuredFps)}/${view.settings.render.fpsLimit}`],
      ['HP', `${s.hero.hp}/${s.hero.maxHp}`],
      ['FORM', FORM_SHORT_LABELS[s.hero.form]],
      ['◆', String(s.progress.crystals)],
      ['DEV', `${deviceLabel(view.activeDevice)} (${view.touchOverlayVisible ? 'T:ON' : 'T:OFF'})`],
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

  private _statItem(doc: Document, label: string, value: string): HTMLElement {
    const box = doc.createElement('div');
    box.className = 'kq-stat-item';
    const l = doc.createElement('span');
    l.className = 'kq-stat-label';
    l.textContent = label;
    const v = doc.createElement('span');
    v.className = 'kq-stat-value';
    v.textContent = value;
    box.append(l, v);
    return box;
  }
}
