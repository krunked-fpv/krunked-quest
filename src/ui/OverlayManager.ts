import { BIOME_PALETTES, HERO_FORM_PALETTES } from '../assets/palettes.js';
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
import { makeIcon, makeLogoCrest, type IconName } from './icons.js';
import { buildMapPanel } from './MapOverlay.js';
import { buildShopPanel } from './ShopMenus.js';
import { buildTouchCustomizerSection } from './TouchCustomizer.js';
import {
  buildCreditsPanel,
  buildGameOverPanel,
  buildVictoryPanel,
  computeCompletionPercent,
} from './VictoryScreens.js';

export type UiSfxKind = 'move' | 'confirm' | 'back' | 'tab' | 'error';

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

  onUiSfx?(kind: UiSfxKind): void;
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

type OptionsTabId = 'display' | 'controls' | 'touch' | 'audio' | 'keys';

const OPTIONS_TABS: ReadonlyArray<{ id: OptionsTabId; label: string; icon: IconName }> = [
  { id: 'display', label: 'Display', icon: 'palette' },
  { id: 'controls', label: 'Controls', icon: 'gamepad' },
  { id: 'touch', label: 'Touch', icon: 'touch' },
  { id: 'audio', label: 'Audio', icon: 'volume' },
  { id: 'keys', label: 'Keys', icon: 'keyboard' },
];

const KEYBIND_LABELS: ReadonlyArray<{ key: keyof KeyBindings; label: string }> = [
  { key: 'left', label: 'Move Left' },
  { key: 'right', label: 'Move Right' },
  { key: 'up', label: 'Look Up' },
  { key: 'down', label: 'Down / Drop' },
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
      return 'Keyboard';
    case 'gamepad_xbox':
      return 'Xbox Pad';
    case 'gamepad_ps':
      return 'PlayStation Pad';
    case 'gamepad_switch':
      return 'Switch Pad';
    case 'gamepad_tesla':
      return 'Tesla Pad';
    case 'touch':
      return 'Touch';
  }
}

function deviceIcon(device: InputDeviceMode): IconName {
  if (device === 'keyboard') return 'keyboard';
  if (device === 'touch') return 'touch';
  return 'gamepad';
}

function stripBrackets(glyph: string): string {
  return glyph.startsWith('[') && glyph.endsWith(']') ? glyph.slice(1, -1) : glyph;
}

function setSliderFill(input: HTMLInputElement, val: number, min: number, max: number): void {
  const pct = max > min ? Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)) : 0;
  input.style.setProperty('--slider-pct', `${pct.toFixed(1)}%`);
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
  private _signBannerTextEl: HTMLElement | null = null;
  private _toastEl: HTMLElement | null = null;
  private _toastTextEl: HTMLElement | null = null;
  private _drawerEl: HTMLElement | null = null;
  private _drawerStatsEl: HTMLElement | null = null;
  private _deviceQaBtns = new Map<string, HTMLButtonElement>();

  private _drawerOpen = false;
  private _optionsTab: OptionsTabId = 'display';
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
      this._actions.onUiSfx?.('confirm');
      this._actions.onRebindKey(targetKey, ev.code);
    } else if (this._lastView) {
      this._actions.onUiSfx?.('back');
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

    const gamepadBack = view.activeDevice !== 'keyboard' && frame.stompPressed;
    if (frame.pausePressed || gamepadBack) {
      if (view.screenMode === 'paused') {
        this._actions.onUiSfx?.('back');
        this._actions.onResume();
        return;
      }
      if (view.screenMode === 'options') {
        this._actions.onUiSfx?.('back');
        this._actions.onCloseOptions();
        return;
      }
      if (view.screenMode === 'shop') {
        this._actions.onUiSfx?.('back');
        this._actions.onCloseShop();
        return;
      }
      if (view.screenMode === 'map') {
        this._actions.onUiSfx?.('back');
        this._actions.onCloseMap();
        return;
      }
      if (view.screenMode === 'credits') {
        this._actions.onUiSfx?.('back');
        this._actions.onReturnToTitle();
        return;
      }
    }

    if (frame.mapPressed && view.screenMode === 'map') {
      this._actions.onUiSfx?.('back');
      this._actions.onCloseMap();
      return;
    }

    // Quick Q/E or LB/RB tab switching inside Options
    if (view.screenMode === 'options' && (frame.formNextPressed || frame.formPrevPressed)) {
      const idx = OPTIONS_TABS.findIndex((t) => t.id === this._optionsTab);
      const delta = frame.formNextPressed ? 1 : -1;
      const next = OPTIONS_TABS[(idx + delta + OPTIONS_TABS.length) % OPTIONS_TABS.length];
      if (next) {
        this._optionsTab = next.id;
        this._actions.onUiSfx?.('tab');
        this.render(view);
      }
      return;
    }

    if (!this._screenLayer) return;

    const doc = this._root.ownerDocument;
    const active = (doc?.activeElement as HTMLElement | null) ?? null;

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
          this._actions.onUiSfx?.('move');
          if (typeof nextEl.scrollIntoView === 'function') {
            nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
        }
        this._navCooldown = 0.16;
      }
    }

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
    this._signBannerTextEl = null;
    this._toastEl = null;
    this._toastTextEl = null;
    this._drawerEl = null;
    this._drawerStatsEl = null;
  }

  // --------------------------------------------------------------------------
  // Screen Dispatch
  // --------------------------------------------------------------------------

  private _renderScreenLayer(doc: Document, view: OverlayViewState): void {
    if (this._screenLayer) {
      this._screenLayer.remove();
      this._screenLayer = null;
    }

    if (view.screenMode === 'playing') {
      const activeEl = doc.activeElement as HTMLElement | null;
      if (activeEl && activeEl !== doc.body && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }
      return;
    }

    const backdrop = doc.createElement('div');
    backdrop.className =
      view.screenMode === 'title' ? 'kq-screen-backdrop kq-title-backdrop' : 'kq-screen-backdrop';
    backdrop.setAttribute('data-screen', view.screenMode);

    // Clicking backdrop dismisses contextual overlays (Pause, Map, Shop)
    if (view.screenMode === 'paused' || view.screenMode === 'map' || view.screenMode === 'shop') {
      backdrop.addEventListener('click', (ev) => {
        if (ev.target !== backdrop) return;
        this._actions.onUiSfx?.('back');
        if (view.screenMode === 'paused') this._actions.onResume();
        else if (view.screenMode === 'map') this._actions.onCloseMap();
        else if (view.screenMode === 'shop') this._actions.onCloseShop();
      });
    }

    let content: HTMLElement;
    switch (view.screenMode) {
      case 'title':
        content = this._buildTitleStage(doc, view);
        break;
      case 'paused':
        content = this._buildPausePanel(doc, view);
        break;
      case 'options':
        content = this._buildOptionsPanel(doc, view);
        break;
      case 'shop':
        content = buildShopPanel(doc, view, this._actions);
        break;
      case 'map':
        content = buildMapPanel(doc, view, this._actions);
        break;
      case 'victory':
        content = buildVictoryPanel(doc, view, this._actions);
        break;
      case 'gameover':
        content = buildGameOverPanel(doc, view, this._actions);
        break;
      case 'credits':
        content = buildCreditsPanel(doc, view, this._actions);
        break;
      default:
        return;
    }

    backdrop.appendChild(content);
    this._root.appendChild(backdrop);
    this._screenLayer = backdrop;

    const preferred =
      content.querySelector<HTMLButtonElement>('.kq-btn-primary:not(:disabled)') ??
      content.querySelector<HTMLButtonElement>('button:not(:disabled)');
    preferred?.focus?.({ preventScroll: true });
  }

  // --------------------------------------------------------------------------
  // Open-Air Theatrical Title Screen
  // --------------------------------------------------------------------------

  private _buildTitleStage(doc: Document, view: OverlayViewState): HTMLElement {
    const stage = doc.createElement('div');
    stage.className = 'kq-title-stage';

    // 1. Top utility strip: Edition pill on left, compact Art Pack controller on right
    const topBar = doc.createElement('div');
    topBar.className = 'kq-title-topbar';

    const editionPill = doc.createElement('div');
    editionPill.className = 'kq-title-version-pill';
    editionPill.append(
      makeIcon(doc, 'sparkle', 13),
      doc.createTextNode(`${view.catalog.rooms.size} Rooms · 11 Biomes`),
    );

    const packBar = doc.createElement('div');
    packBar.className = 'kq-title-pack-bar';

    const dot = doc.createElement('span');
    dot.className = view.customPackEnabled
      ? 'kq-pack-dot kq-pack-dot-active'
      : view.customPackAvailable
        ? 'kq-pack-dot kq-pack-dot-ready'
        : 'kq-pack-dot';

    const statusTxt = doc.createElement('span');
    statusTxt.className = 'kq-pack-status-text';
    statusTxt.textContent = view.customPackAvailable
      ? `Art (${view.customPackCount})`
      : 'Art';

    const customBtn = this._iconBtn(
      doc,
      'Custom Pack',
      'sparkle',
      view.customPackEnabled ? 'kq-btn kq-btn-xs kq-btn-pill kq-btn-active' : 'kq-btn kq-btn-xs kq-btn-pill',
      () => {
        if (view.customPackEnabled) return;
        this._actions.onUiSfx?.('tab');
        this._actions.onToggleCustomPack(true);
      },
    );
    customBtn.setAttribute('aria-pressed', String(view.customPackEnabled));
    if (!view.customPackAvailable) {
      customBtn.title = 'Load a custom pack folder first to enable custom sprites';
    }

    const builtInBtn = this._iconBtn(
      doc,
      'Built-In',
      'palette',
      !view.customPackEnabled ? 'kq-btn kq-btn-xs kq-btn-pill kq-btn-active' : 'kq-btn kq-btn-xs kq-btn-pill',
      () => {
        if (!view.customPackEnabled) return;
        this._actions.onUiSfx?.('tab');
        this._actions.onToggleCustomPack(false);
      },
    );
    builtInBtn.setAttribute('aria-pressed', String(!view.customPackEnabled));

    const loadBtn = this._iconBtn(
      doc,
      this._packLoading ? 'Loading…' : 'Load',
      'folder',
      'kq-btn kq-btn-xs kq-btn-pill kq-btn-accent',
      () => {
        if (this._packLoading) return;
        this._packLoading = true;
        loadBtn.disabled = true;
        void this._actions.onLoadCustomPack().finally(() => {
          this._packLoading = false;
        });
      },
    );
    loadBtn.disabled = this._packLoading;

    packBar.append(dot, statusTxt, customBtn, builtInBtn, loadBtn);
    topBar.append(editionPill, packBar);
    stage.appendChild(topBar);

    // 2. Center Hero Crest + Wordmark + Sculpted Menu Dock
    const center = doc.createElement('div');
    center.className = 'kq-title-center';

    const logoWrap = doc.createElement('div');
    logoWrap.className = 'kq-logo-wrap';

    const crest = makeLogoCrest(doc);

    const h1 = doc.createElement('h1');
    h1.className = 'kq-logo';
    h1.textContent = 'KRUNKED QUEST';

    const sub = doc.createElement('div');
    sub.className = 'kq-subtitle-pill';
    sub.append(makeIcon(doc, 'flame', 12), doc.createTextNode('16-Bit Action Metroidvania'));

    logoWrap.append(crest, h1, sub);
    center.appendChild(logoWrap);

    const dock = doc.createElement('div');
    dock.className = 'kq-title-dock';

    if (view.hasSave) {
      const contBtn = this._menuBtn(doc, 'Continue Quest', 'play', 'kq-btn kq-btn-menu kq-btn-primary', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onContinue();
      });
      if (view.saveSummary) {
        const meta = doc.createElement('span');
        meta.className = 'kq-continue-meta';
        meta.textContent = `${view.saveSummary.roomName} · ${view.saveSummary.coins}/${view.catalog.totalCoins}`;
        const left = contBtn.querySelector('.kq-btn-menu-left');
        if (left) {
          const stack = doc.createElement('span');
          stack.style.display = 'flex';
          stack.style.flexDirection = 'column';
          stack.style.gap = '1px';
          const mainLbl = left.lastChild;
          if (mainLbl) stack.appendChild(mainLbl);
          stack.appendChild(meta);
          left.appendChild(stack);
        }
      }
      dock.appendChild(contBtn);
    }

    dock.appendChild(
      this._menuBtn(
        doc,
        'New Game',
        'sparkle',
        view.hasSave ? 'kq-btn kq-btn-menu' : 'kq-btn kq-btn-menu kq-btn-primary',
        () => {
          this._actions.onUiSfx?.('confirm');
          this._actions.onNewGame();
        },
      ),
    );

    dock.appendChild(
      this._menuBtn(doc, 'Ghost Ship Endless', 'anchor', 'kq-btn kq-btn-menu', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onStartGhostShip();
      }),
    );

    dock.appendChild(
      this._menuBtn(doc, 'Time Attack', 'clock', 'kq-btn kq-btn-menu', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onStartTimeAttack();
      }),
    );

    const secRow = doc.createElement('div');
    secRow.className = 'kq-title-secondary-row';
    secRow.append(
      this._iconBtn(doc, 'Options', 'gear', 'kq-btn', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onOpenOptions('title');
      }),
      this._iconBtn(doc, 'Credits', 'trophy', 'kq-btn', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onOpenCredits();
      }),
    );
    dock.appendChild(secRow);

    if (view.customPackMessage) {
      const msg = doc.createElement('div');
      msg.className = 'kq-pack-feedback';
      msg.textContent = view.customPackMessage;
      dock.appendChild(msg);
    }

    center.appendChild(dock);
    stage.appendChild(center);

    // 3. Bottom Control Legend Strip
    const ctrlBar = doc.createElement('div');
    ctrlBar.className = 'kq-title-controls';

    const addCtrlChip = (label: string, keyText: string) => {
      const chip = doc.createElement('span');
      chip.className = 'kq-ctrl-chip';
      const cap = doc.createElement('span');
      cap.className = 'kq-keycap';
      cap.textContent = stripBrackets(keyText);
      chip.append(cap, doc.createTextNode(label));
      ctrlBar.appendChild(chip);
    };

    const devChip = doc.createElement('span');
    devChip.className = 'kq-ctrl-chip';
    devChip.style.color = 'var(--kq-cyan)';
    devChip.append(makeIcon(doc, deviceIcon(view.activeDevice), 14), doc.createTextNode(deviceLabel(view.activeDevice)));
    ctrlBar.appendChild(devChip);

    const sep = () => {
      const d = doc.createElement('span');
      d.className = 'kq-ctrl-sep';
      return d;
    };

    ctrlBar.appendChild(sep());
    addCtrlChip('Jump', view.glyphs.jump);
    addCtrlChip('Dash', view.glyphs.dash);
    addCtrlChip('Stomp', view.glyphs.stomp);
    ctrlBar.appendChild(sep());
    addCtrlChip('Playtest', 'F9');

    stage.appendChild(ctrlBar);
    return stage;
  }

  // --------------------------------------------------------------------------
  // Pause Panel with Live Adventure Telemetry
  // --------------------------------------------------------------------------

  private _buildPausePanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-pause';

    const room = view.catalog.rooms.get(view.simState.roomId);
    const biomePal = room ? BIOME_PALETTES[room.biome] : undefined;

    const header = doc.createElement('div');
    header.className = 'kq-panel-header';

    const headLeft = doc.createElement('div');
    const title = doc.createElement('h2');
    title.className = 'kq-panel-heading';
    title.textContent = 'PAUSED';
    const sub = doc.createElement('div');
    sub.className = 'kq-panel-subheading';
    sub.textContent = room?.name ?? view.simState.roomId;
    headLeft.append(title, sub);

    const rightTags = doc.createElement('div');
    rightTags.style.display = 'inline-flex';
    rightTags.style.gap = '6px';
    rightTags.style.alignItems = 'center';

    if (room && biomePal) {
      const bChip = doc.createElement('span');
      bChip.className = 'kq-biome-chip';
      bChip.style.backgroundColor = biomePal.skyBot;
      bChip.style.borderColor = biomePal.colors[0];
      bChip.textContent = biomePal.label;
      rightTags.appendChild(bChip);
    }

    const formChip = doc.createElement('span');
    formChip.className = 'kq-badge';
    const fSw = doc.createElement('span');
    fSw.className = 'kq-swatch';
    fSw.style.backgroundColor = HERO_FORM_PALETTES[view.simState.hero.form][0];
    formChip.append(fSw, doc.createTextNode(FORM_SHORT_LABELS[view.simState.hero.form]));
    rightTags.appendChild(formChip);

    header.append(headLeft, rightTags);
    panel.appendChild(header);

    // Live Run Status Strip
    const summary = doc.createElement('div');
    summary.className = 'kq-pause-summary';
    const addMetric = (icon: IconName, color: string, val: string, lbl: string) => {
      const box = doc.createElement('div');
      box.className = 'kq-pause-metric';
      const v = doc.createElement('div');
      v.className = 'kq-pause-metric-val';
      const ic = makeIcon(doc, icon, 14);
      ic.style.color = color;
      v.append(ic, doc.createTextNode(val));
      const l = doc.createElement('div');
      l.className = 'kq-pause-metric-lbl';
      l.textContent = lbl;
      box.append(v, l);
      summary.appendChild(box);
    };

    addMetric('heart', '#ff546e', `${view.simState.hero.hp}/${view.simState.hero.maxHp}`, 'Hearts');
    addMetric('crystal', '#56ecff', String(view.simState.progress.crystals), 'Crystals');
    addMetric(
      'coin',
      '#ffd84d',
      `${view.simState.progress.collectedCoinIds.length}/${view.catalog.totalCoins}`,
      'Coins',
    );
    addMetric('trophy', '#52e88a', `${computeCompletionPercent(view)}%`, 'Quest');
    panel.appendChild(summary);

    const list = doc.createElement('div');
    list.className = 'kq-menu-list';
    list.appendChild(
      this._menuBtn(doc, 'Resume Quest', 'play', 'kq-btn kq-btn-menu kq-btn-primary', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onResume();
      }),
    );
    list.appendChild(
      this._menuBtn(doc, 'World Map', 'map', 'kq-btn kq-btn-menu kq-btn-accent', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onOpenMap();
      }),
    );
    list.appendChild(
      this._menuBtn(doc, 'Options', 'gear', 'kq-btn kq-btn-menu', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onOpenOptions('paused');
      }),
    );
    list.appendChild(
      this._menuBtn(doc, 'Return to Subrosa Haven', 'home', 'kq-btn kq-btn-menu', () => {
        this._actions.onUiSfx?.('confirm');
        this._actions.onReturnToHub();
      }),
    );
    list.appendChild(
      this._menuBtn(doc, 'Save & Quit to Title', 'close', 'kq-btn kq-btn-menu kq-btn-danger', () => {
        this._actions.onUiSfx?.('back');
        this._actions.onSaveAndQuit();
      }),
    );
    panel.appendChild(list);

    const footer = doc.createElement('div');
    footer.className = 'kq-footer-hint';
    footer.append(
      makeIcon(doc, deviceIcon(view.activeDevice), 13),
      doc.createTextNode(`${deviceLabel(view.activeDevice)} · Press ${stripBrackets(view.glyphs.pause)} to Resume`),
    );
    panel.appendChild(footer);

    return panel;
  }

  // --------------------------------------------------------------------------
  // Tabbed Options Panel
  // --------------------------------------------------------------------------

  private _buildOptionsPanel(doc: Document, view: OverlayViewState): HTMLElement {
    const panel = doc.createElement('div');
    panel.className = 'kq-panel kq-panel-wide';

    const header = doc.createElement('div');
    header.className = 'kq-panel-header';

    const titleWrap = doc.createElement('div');
    const title = doc.createElement('h2');
    title.className = 'kq-panel-heading';
    title.append(makeIcon(doc, 'gear', 19), doc.createTextNode('OPTIONS'));
    titleWrap.appendChild(title);

    const backBtn = this._iconBtn(doc, 'Back', 'close', 'kq-btn kq-btn-sm kq-btn-primary', () => {
      this._actions.onUiSfx?.('back');
      this._actions.onCloseOptions();
    });
    header.append(titleWrap, backBtn);
    panel.appendChild(header);

    // 5-Tab Bar
    const tabBar = doc.createElement('div');
    tabBar.className = 'kq-tab-bar';
    tabBar.setAttribute('role', 'tablist');
    for (const tab of OPTIONS_TABS) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      const active = this._optionsTab === tab.id;
      btn.setAttribute('aria-selected', String(active));
      btn.setAttribute('data-options-tab', tab.id);
      btn.className = active ? 'kq-tab kq-tab-active' : 'kq-tab';
      btn.append(makeIcon(doc, tab.icon, 14), doc.createTextNode(tab.label));
      btn.addEventListener('click', () => {
        if (this._optionsTab === tab.id) return;
        this._optionsTab = tab.id;
        this._actions.onUiSfx?.('tab');
        this.render(view);
      });
      tabBar.appendChild(btn);
    }
    panel.appendChild(tabBar);

    const scroll = doc.createElement('div');
    scroll.className = 'kq-panel-scroll';

    if (this._optionsTab === 'display') {
      const displaySec = this._section(doc, 'Display & Visuals', 'palette');

      const fpsRow = this._optRow(doc, 'Frame Rate Limit', 'Simulation stays deterministic at 60 Hz with smooth interpolation');
      const fpsGroup = doc.createElement('div');
      fpsGroup.className = 'kq-seg-group';
      const fpsChoices: readonly FpsLimitOption[] = [30, 60, 120];
      for (const fps of fpsChoices) {
        fpsGroup.appendChild(
          this._btn(
            doc,
            `${fps} FPS`,
            view.settings.render.fpsLimit === fps ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
            () => {
              this._actions.onUiSfx?.('confirm');
              this._actions.onUpdateRenderSettings({ fpsLimit: fps });
            },
          ),
        );
      }
      fpsRow.appendChild(fpsGroup);
      displaySec.appendChild(fpsRow);

      const snapRow = this._optRow(doc, 'Classic Native-Snap', 'Lock rendering to crisp 60 Hz pixel steps without sub-frame interpolation');
      snapRow.appendChild(
        this._btn(
          doc,
          view.settings.render.classicSnap ? 'ON' : 'OFF',
          view.settings.render.classicSnap ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
          () => {
            this._actions.onUiSfx?.('confirm');
            this._actions.onUpdateRenderSettings({ classicSnap: !view.settings.render.classicSnap });
          },
        ),
      );
      displaySec.appendChild(snapRow);

      const shakeRow = this._optRow(doc, 'Screen Shake', 'Pixel-snapped camera recoil on stomps, blasts, and boss hits');
      shakeRow.appendChild(
        this._btn(
          doc,
          view.settings.render.screenShake ? 'ON' : 'OFF',
          view.settings.render.screenShake ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
          () => {
            this._actions.onUiSfx?.('confirm');
            this._actions.onUpdateRenderSettings({ screenShake: !view.settings.render.screenShake });
          },
        ),
      );
      displaySec.appendChild(shakeRow);

      const packRow = this._optRow(
        doc,
        'Art Pack Mode',
        view.customPackAvailable
          ? `${view.customPackCount} custom pack sprites loaded and ready`
          : 'Switch live between Built-In pixel art or a local Custom Pack folder',
      );
      const packGroup = doc.createElement('div');
      packGroup.className = 'kq-seg-group';
      packGroup.appendChild(
        this._btn(
          doc,
          view.customPackEnabled ? 'Custom Pack' : 'Built-In Art',
          view.customPackEnabled ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
          () => {
            this._actions.onUiSfx?.('confirm');
            this._actions.onToggleCustomPack(!view.customPackEnabled);
          },
        ),
      );
      packGroup.appendChild(
        this._iconBtn(doc, 'Load Folder', 'folder', 'kq-btn kq-btn-sm kq-btn-accent', () => {
          void this._actions.onLoadCustomPack();
        }),
      );
      packRow.appendChild(packGroup);
      displaySec.appendChild(packRow);

      scroll.appendChild(displaySec);
    } else if (this._optionsTab === 'controls') {
      const ctrlSec = this._section(doc, 'Device & Gamepad Controls', 'gamepad');

      const touchModeRow = this._optRow(doc, 'Touch Overlay Visibility', 'Auto activates seamlessly only when touching the screen');
      const touchGroup = doc.createElement('div');
      touchGroup.className = 'kq-seg-group';
      const touchChoices: ReadonlyArray<{ mode: TouchVisibilitySetting; label: string }> = [
        { mode: 'auto', label: 'Auto' },
        { mode: 'always_on', label: 'Always On' },
        { mode: 'off', label: 'Off' },
      ];
      for (const c of touchChoices) {
        touchGroup.appendChild(
          this._btn(
            doc,
            c.label,
            view.settings.input.touchMode === c.mode ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
            () => {
              this._actions.onUiSfx?.('confirm');
              this._actions.onUpdateInputSettings({ touchMode: c.mode });
            },
          ),
        );
      }
      touchModeRow.appendChild(touchGroup);
      ctrlSec.appendChild(touchModeRow);

      const hapticRow = this._optRow(doc, 'Gamepad Haptics', 'Dual-rumble vibration feedback on stomps, damage, and heals');
      hapticRow.appendChild(
        this._btn(
          doc,
          view.settings.input.hapticsEnabled ? 'ON' : 'OFF',
          view.settings.input.hapticsEnabled ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm',
          () => {
            this._actions.onUiSfx?.('confirm');
            this._actions.onUpdateInputSettings({ hapticsEnabled: !view.settings.input.hapticsEnabled });
          },
        ),
      );
      ctrlSec.appendChild(hapticRow);

      ctrlSec.appendChild(
        this._sliderRow(
          doc,
          'Analog Stick Deadzone',
          0.1,
          0.4,
          0.02,
          view.settings.input.deadzone,
          (v) => v.toFixed(2),
          (v) => this._actions.onUpdateInputSettings({ deadzone: v }),
        ),
      );
      scroll.appendChild(ctrlSec);
    } else if (this._optionsTab === 'touch') {
      scroll.appendChild(buildTouchCustomizerSection(doc, view, this._actions));
    } else if (this._optionsTab === 'audio') {
      const audioSec = this._section(doc, 'Sound & Chiptune Mix', 'volume');
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
      const muteRow = this._optRow(doc, 'Audio Output', 'Instantly mute or unmute all soundtrack & foley channels');
      muteRow.appendChild(
        this._iconBtn(
          doc,
          view.settings.audio.muted ? 'Muted' : 'Sound On',
          view.settings.audio.muted ? 'volumeMute' : 'volume',
          view.settings.audio.muted ? 'kq-btn kq-btn-sm kq-btn-danger' : 'kq-btn kq-btn-sm kq-btn-active',
          () => {
            this._actions.onUpdateAudioSettings({ muted: !view.settings.audio.muted });
            this._actions.onUiSfx?.('confirm');
          },
        ),
      );
      audioSec.appendChild(muteRow);
      scroll.appendChild(audioSec);
    } else if (this._optionsTab === 'keys') {
      const bindSec = this._section(doc, 'Keyboard Bindings', 'keyboard');
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
          isListening ? 'Press Key…' : formatKeyCode(code),
          isListening ? 'kq-btn kq-btn-sm kq-btn-primary' : 'kq-btn kq-btn-sm',
          () => {
            this._listeningBindKey = item.key;
            this._actions.onSetKeyCaptureSuppressed(true);
            this._actions.onUiSfx?.('tab');
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
      const resetBtn = this._btn(doc, 'Reset Defaults', 'kq-btn kq-btn-sm', () => {
        this._actions.onUiSfx?.('back');
        this._actions.onResetKeyBindings();
      });
      resetRow.append(note, resetBtn);
      bindSec.appendChild(resetRow);
      scroll.appendChild(bindSec);
    }

    panel.appendChild(scroll);

    const footer = doc.createElement('div');
    footer.className = 'kq-footer-hint';
    footer.textContent = `Switch tabs with ${stripBrackets(view.glyphs.form)} · Press ${stripBrackets(view.glyphs.pause)} to return`;
    panel.appendChild(footer);

    return panel;
  }

  // --------------------------------------------------------------------------
  // Signpost Dialogue Banner, Toast & F9 Playtest Drawer
  // --------------------------------------------------------------------------

  private _renderSignBanner(doc: Document, view: OverlayViewState): void {
    const text = view.screenMode === 'playing' ? view.simState.activeSignText : null;
    if (!text) {
      if (this._signBannerEl) {
        this._signBannerEl.remove();
        this._signBannerEl = null;
        this._signBannerTextEl = null;
      }
      return;
    }
    if (!this._signBannerEl) {
      const box = doc.createElement('div');
      box.className = 'kq-sign-banner';
      const ic = makeIcon(doc, 'book', 17, 'kq-sign-banner-icon');
      const txt = doc.createElement('span');
      box.append(ic, txt);
      this._root.appendChild(box);
      this._signBannerEl = box;
      this._signBannerTextEl = txt;
    }
    if (this._signBannerTextEl && this._signBannerTextEl.textContent !== text) {
      this._signBannerTextEl.textContent = text;
    }
  }

  private _renderToast(doc: Document, view: OverlayViewState): void {
    if (!view.toastMessage) {
      if (this._toastEl) {
        this._toastEl.remove();
        this._toastEl = null;
        this._toastTextEl = null;
      }
      return;
    }
    if (!this._toastEl) {
      const toast = doc.createElement('div');
      toast.className = 'kq-toast';
      const ic = makeIcon(doc, 'sparkle', 14);
      ic.style.color = 'var(--kq-cyan)';
      const txt = doc.createElement('span');
      toast.append(ic, txt);
      this._root.appendChild(toast);
      this._toastEl = toast;
      this._toastTextEl = txt;
    }
    if (this._toastTextEl && this._toastTextEl.textContent !== view.toastMessage) {
      this._toastTextEl.textContent = view.toastMessage;
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
    const closeBtn = this._iconBtn(doc, '', 'close', 'kq-btn kq-btn-xs', () => this.togglePlaytestDrawer(false));
    closeBtn.setAttribute('aria-label', 'Close Playtest Drawer');
    header.append(title, closeBtn);
    drawer.appendChild(header);

    const stats = doc.createElement('div');
    stats.className = 'kq-drawer-stats';
    this._drawerStatsEl = stats;
    drawer.appendChild(stats);
    this._updateDrawerTelemetry(view);

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
    const warpBtn = this._btn(doc, 'WARP', 'kq-btn kq-btn-xs kq-btn-primary', () => {
      this._actions.onWarpRoom(roomSelect.value);
    });
    warpRow.append(roomSelect, warpBtn);
    drawer.appendChild(warpRow);

    const formGrid = doc.createElement('div');
    formGrid.className = 'kq-drawer-grid';
    for (const f of HERO_FORMS) {
      formGrid.appendChild(
        this._btn(
          doc,
          FORM_SHORT_LABELS[f],
          view.simState.hero.form === f ? 'kq-btn kq-btn-xs kq-btn-active' : 'kq-btn kq-btn-xs',
          () => this._actions.onSetForm(f),
        ),
      );
    }
    drawer.appendChild(formGrid);

    const actionsGrid = doc.createElement('div');
    actionsGrid.className = 'kq-drawer-grid-2';
    actionsGrid.appendChild(this._btn(doc, 'UNLOCK FORMS', 'kq-btn kq-btn-xs', () => this._actions.onUnlockAllForms()));
    actionsGrid.appendChild(this._btn(doc, '+5000 ◆', 'kq-btn kq-btn-xs', () => this._actions.onGrantCrystals(5000)));
    actionsGrid.appendChild(this._btn(doc, 'HEAL FULL', 'kq-btn kq-btn-xs', () => this._actions.onHealFull()));
    actionsGrid.appendChild(
      this._btn(doc, 'KILL ENEMIES', 'kq-btn kq-btn-xs kq-btn-danger', () => this._actions.onKillRoomEnemies()),
    );
    drawer.appendChild(actionsGrid);

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
    const bossBtn = this._btn(doc, 'BOSS', 'kq-btn kq-btn-xs kq-btn-accent', () => {
      this._actions.onChallengeBoss(bossSelect.value as BossId);
    });
    bossRow.append(bossSelect, bossBtn);
    drawer.appendChild(bossRow);

    const toggleGrid = doc.createElement('div');
    toggleGrid.className = 'kq-drawer-grid-2';

    const nextFps: FpsLimitOption =
      view.settings.render.fpsLimit === 30 ? 60 : view.settings.render.fpsLimit === 60 ? 120 : 30;
    toggleGrid.appendChild(
      this._btn(doc, `FPS: ${view.settings.render.fpsLimit}`, 'kq-btn kq-btn-xs', () => {
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
      this._btn(doc, `TOUCH: ${view.settings.input.touchMode}`, 'kq-btn kq-btn-xs', () => {
        this._actions.onUpdateInputSettings({ touchMode: nextTouch });
      }),
    );

    toggleGrid.appendChild(
      this._btn(
        doc,
        view.customPackEnabled ? 'PACK: CUSTOM' : 'PACK: BUILTIN',
        view.customPackEnabled ? 'kq-btn kq-btn-xs kq-btn-active' : 'kq-btn kq-btn-xs',
        () => {
          this._actions.onToggleCustomPack(!view.customPackEnabled);
        },
      ),
    );

    toggleGrid.appendChild(this._btn(doc, 'SAVE NOW', 'kq-btn kq-btn-xs', () => this._actions.onForceSave()));
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
  // DOM Builders
  // --------------------------------------------------------------------------

  private _btn(doc: Document, label: string, className: string, onClick: () => void): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  private _iconBtn(
    doc: Document,
    label: string,
    icon: IconName,
    className: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = className;
    b.appendChild(makeIcon(doc, icon, 14));
    if (label) {
      b.appendChild(doc.createTextNode(label));
    }
    b.addEventListener('click', onClick);
    return b;
  }

  private _menuBtn(
    doc: Document,
    label: string,
    icon: IconName,
    className: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = className;

    const left = doc.createElement('span');
    left.className = 'kq-btn-menu-left';
    left.append(makeIcon(doc, icon, 16), doc.createTextNode(label));

    const arrow = makeIcon(doc, 'chevronRight', 15, 'kq-btn-menu-arrow');
    b.append(left, arrow);
    b.addEventListener('click', onClick);
    return b;
  }

  private _section(doc: Document, titleText: string, icon?: IconName): HTMLElement {
    const sec = doc.createElement('section');
    sec.className = 'kq-section';
    const title = doc.createElement('div');
    title.className = 'kq-section-title';
    if (icon) title.appendChild(makeIcon(doc, icon, 14));
    title.appendChild(doc.createTextNode(titleText));
    sec.appendChild(title);
    return sec;
  }

  private _optRow(doc: Document, labelText: string, hintText?: string): HTMLElement {
    const row = doc.createElement('div');
    row.className = 'kq-opt-row';
    const wrap = doc.createElement('div');
    wrap.className = 'kq-opt-label-wrap';
    const lbl = doc.createElement('span');
    lbl.className = 'kq-opt-label';
    lbl.textContent = labelText;
    wrap.appendChild(lbl);
    if (hintText) {
      const hint = doc.createElement('span');
      hint.className = 'kq-opt-hint';
      hint.textContent = hintText;
      wrap.appendChild(hint);
    }
    row.appendChild(wrap);
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
    setSliderFill(input, value, min, max);

    const valSpan = doc.createElement('span');
    valSpan.className = 'kq-slider-val';
    valSpan.textContent = format(value);

    input.addEventListener('input', () => {
      const num = Number(input.value);
      if (Number.isFinite(num)) {
        setSliderFill(input, num, min, max);
        valSpan.textContent = format(num);
        onChange(num);
      }
    });

    wrap.append(input, valSpan);
    row.appendChild(wrap);
    return row;
  }
}
