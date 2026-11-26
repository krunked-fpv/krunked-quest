import { DEFAULT_TOUCH_LAYOUT, type TouchLayoutConfig } from '../contracts/index.js';
import type { OverlayActions, OverlayViewState } from './OverlayManager.js';

export interface TouchPresetDef {
  readonly id: 'mobile_portrait' | 'mobile_landscape' | 'tesla_wide' | 'reset';
  readonly label: string;
  readonly description: string;
  readonly layout: TouchLayoutConfig;
}

export const TOUCH_LAYOUT_PRESETS: readonly TouchPresetDef[] = [
  {
    id: 'mobile_portrait',
    label: 'MOBILE PORTRAIT',
    description: 'Compact lower-thumb reach for handheld portrait phones',
    layout: {
      opacity: 0.42,
      scale: 0.9,
      dpadOffsetX: -4,
      dpadOffsetY: -12,
      actionOffsetX: 4,
      actionOffsetY: -12,
    },
  },
  {
    id: 'mobile_landscape',
    label: 'MOBILE LANDSCAPE',
    description: 'Balanced widescreen handheld thumb ergonomics',
    layout: {
      opacity: 0.38,
      scale: 1.0,
      dpadOffsetX: 16,
      dpadOffsetY: -4,
      actionOffsetX: -16,
      actionOffsetY: -4,
    },
  },
  {
    id: 'tesla_wide',
    label: 'TESLA 16:9 WIDE',
    description: 'Larger inset controls tuned for wide 16:9 in-car touchscreens',
    layout: {
      opacity: 0.34,
      scale: 1.15,
      dpadOffsetX: 44,
      dpadOffsetY: -20,
      actionOffsetX: -44,
      actionOffsetY: -20,
    },
  },
  {
    id: 'reset',
    label: 'RESET TOUCH',
    description: 'Restore default Krunked Quest touch geometry',
    layout: { ...DEFAULT_TOUCH_LAYOUT },
  },
] as const;

interface SliderBinding {
  key: keyof TouchLayoutConfig;
  input: HTMLInputElement;
  valSpan: HTMLSpanElement;
  format: (v: number) => string;
}

function layoutsMatch(a: TouchLayoutConfig, b: TouchLayoutConfig): boolean {
  return (
    Math.abs(a.opacity - b.opacity) < 0.005 &&
    Math.abs(a.scale - b.scale) < 0.01 &&
    Math.round(a.dpadOffsetX) === Math.round(b.dpadOffsetX) &&
    Math.round(a.dpadOffsetY) === Math.round(b.dpadOffsetY) &&
    Math.round(a.actionOffsetX) === Math.round(b.actionOffsetX) &&
    Math.round(a.actionOffsetY) === Math.round(b.actionOffsetY)
  );
}

export function buildTouchCustomizerSection(
  doc: Document,
  view: OverlayViewState,
  actions: OverlayActions,
): HTMLElement {
  const sec = doc.createElement('section');
  sec.className = 'kq-section kq-touch-customizer';
  sec.setAttribute('data-panel', 'touch-customizer');

  const head = doc.createElement('div');
  head.className = 'kq-group-header';

  const title = doc.createElement('div');
  title.className = 'kq-section-title';
  title.textContent = 'Touch Layout Customizer';

  const statusBadge = doc.createElement('span');
  statusBadge.className = view.touchOverlayVisible ? 'kq-badge kq-badge-active' : 'kq-badge';
  statusBadge.textContent = view.touchOverlayVisible
    ? 'LIVE OVERLAY VISIBLE'
    : `MODE: ${view.settings.input.touchMode.toUpperCase()}`;

  head.append(title, statusBadge);
  sec.appendChild(head);

  const current: TouchLayoutConfig = { ...view.settings.input.touchLayout };

  // Live 16:9 Interactive Layout Schematic Preview
  const previewFrame = doc.createElement('div');
  previewFrame.className = 'kq-touch-preview';
  previewFrame.setAttribute('aria-label', 'Live touch control placement preview');

  const previewTag = doc.createElement('div');
  previewTag.className = 'kq-touch-preview-tag';
  previewTag.textContent = '16:9 LIVE PREVIEW';

  const previewDpad = doc.createElement('div');
  previewDpad.className = 'kq-touch-preview-dpad';
  previewDpad.textContent = '◀ ▼ ▶';

  const previewAct = doc.createElement('div');
  previewAct.className = 'kq-touch-preview-actions';
  previewAct.textContent = 'DASH · JUMP';

  previewFrame.append(previewTag, previewDpad, previewAct);
  sec.appendChild(previewFrame);

  // Preset buttons row
  const presetRow = doc.createElement('div');
  presetRow.className = 'kq-preset-row';
  const presetButtons = new Map<TouchPresetDef['id'], HTMLButtonElement>();

  const sliders: SliderBinding[] = [];

  const syncVisuals = () => {
    // Update live mini-preview (scaled 0.28x for offsets inside the compact schematic)
    const op = current.opacity.toFixed(2);
    const sc = current.scale.toFixed(2);
    previewDpad.style.opacity = op;
    previewDpad.style.transform = `translate(${Math.round(current.dpadOffsetX * 0.28)}px, ${Math.round(current.dpadOffsetY * 0.28)}px) scale(${sc})`;
    previewAct.style.opacity = op;
    previewAct.style.transform = `translate(${Math.round(current.actionOffsetX * 0.28)}px, ${Math.round(current.actionOffsetY * 0.28)}px) scale(${sc})`;

    // Sync sliders & value labels
    for (const sb of sliders) {
      const val = current[sb.key];
      sb.input.value = String(val);
      sb.valSpan.textContent = sb.format(val);
    }

    // Highlight matching preset
    for (const preset of TOUCH_LAYOUT_PRESETS) {
      const btn = presetButtons.get(preset.id);
      if (!btn) continue;
      const matched = layoutsMatch(current, preset.layout);
      btn.className =
        preset.id === 'reset'
          ? matched
            ? 'kq-btn kq-btn-sm kq-btn-active'
            : 'kq-btn kq-btn-sm'
          : matched
            ? 'kq-btn kq-btn-sm kq-btn-active'
            : 'kq-btn kq-btn-sm kq-btn-accent';
    }
  };

  for (const preset of TOUCH_LAYOUT_PRESETS) {
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'kq-btn kq-btn-sm';
    btn.textContent = preset.label;
    btn.title = preset.description;
    btn.setAttribute('data-touch-preset', preset.id);
    btn.addEventListener('click', () => {
      Object.assign(current, preset.layout);
      actions.onUpdateTouchLayout({ ...preset.layout });
      syncVisuals();
    });
    presetButtons.set(preset.id, btn);
    presetRow.appendChild(btn);
  }
  sec.appendChild(presetRow);

  // Sliders grid (Opacity, Scale, D-Pad X/Y, Action Cluster X/Y)
  const sliderGrid = doc.createElement('div');
  sliderGrid.className = 'kq-touch-slider-grid';

  const specs: ReadonlyArray<{
    key: keyof TouchLayoutConfig;
    label: string;
    min: number;
    max: number;
    step: number;
    format: (v: number) => string;
  }> = [
    {
      key: 'opacity',
      label: 'Touch Opacity',
      min: 0.2,
      max: 0.65,
      step: 0.01,
      format: (v) => `${Math.round(v * 100)}%`,
    },
    {
      key: 'scale',
      label: 'Button Scale',
      min: 0.75,
      max: 1.35,
      step: 0.05,
      format: (v) => `${Math.round(v * 100)}%`,
    },
    {
      key: 'dpadOffsetX',
      label: 'D-Pad Offset X',
      min: -80,
      max: 120,
      step: 4,
      format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`,
    },
    {
      key: 'dpadOffsetY',
      label: 'D-Pad Offset Y',
      min: -100,
      max: 60,
      step: 4,
      format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`,
    },
    {
      key: 'actionOffsetX',
      label: 'Action Cluster X',
      min: -120,
      max: 80,
      step: 4,
      format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`,
    },
    {
      key: 'actionOffsetY',
      label: 'Action Cluster Y',
      min: -100,
      max: 60,
      step: 4,
      format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}px`,
    },
  ];

  for (const sp of specs) {
    const row = doc.createElement('div');
    row.className = 'kq-opt-row';

    const lbl = doc.createElement('span');
    lbl.className = 'kq-opt-label';
    lbl.textContent = sp.label;

    const wrap = doc.createElement('div');
    wrap.className = 'kq-slider-wrap';

    const input = doc.createElement('input');
    input.type = 'range';
    input.className = 'kq-slider';
    input.min = String(sp.min);
    input.max = String(sp.max);
    input.step = String(sp.step);
    input.value = String(current[sp.key]);
    input.setAttribute('aria-label', sp.label);
    input.setAttribute('data-touch-slider', sp.key);

    const valSpan = doc.createElement('span');
    valSpan.className = 'kq-slider-val';
    valSpan.textContent = sp.format(current[sp.key]);

    input.addEventListener('input', () => {
      const num = Number(input.value);
      if (!Number.isFinite(num)) return;
      current[sp.key] = num;
      actions.onUpdateTouchLayout({ [sp.key]: num });
      syncVisuals();
    });

    sliders.push({ key: sp.key, input, valSpan, format: sp.format });
    wrap.append(input, valSpan);
    row.append(lbl, wrap);
    sliderGrid.appendChild(row);
  }

  sec.appendChild(sliderGrid);
  syncVisuals();

  return sec;
}
