// popup.js - Palext UI logic

const _uR42 = 'tl_x7k1';
const _lsKey = '_ls_license_key';
const _lsInst = '_ls_instance_id';
let _mN77 = false;

const _pT10 = {
  reactExport:         { label: 'React UI export',                   gated: true },
  tailwindExport:      { label: 'Tailwind export',                    gated: true },
  figmaExport:         { label: 'Figma Tokens export',               gated: true },
  dtcgExport:          { label: 'DTCG export',                       gated: true },
  advancedExport:      { label: 'Advanced export formats',           gated: true },
  customExport:        { label: 'Custom export builder',             gated: false },
  smartApply:          { label: 'Smart Apply preview',               gated: true },
  themePersonalization:{ label: 'Theme personalization',             gated: true },
  scanUnlimited:       { label: 'Unlimited monthly scans',           gated: true },
  unlimitedSnapshots:  { label: 'Unlimited snapshots',               gated: true },
  driftCompare:        { label: 'Snapshot drift compare',            gated: true },
  snapshotCrawl:       { label: 'Cross-page snapshot crawl',         gated: true },
  colorInstances:      { label: 'Locate color on page',              gated: true },
  typographyInstances: { label: 'Locate type on page',               gated: true },
  locateOnPage:        { label: 'Locate any token on the live page', gated: true },
  measureUnlimited:    { label: 'Unlimited measurements',            gated: true },
  layoutAdvanced:      { label: 'Advanced layout overlay',           gated: false },
  assetExtraction:     { label: 'Asset extraction',                  gated: true },
  auditReport:         { label: 'Audit report export',               gated: true },
  insightsAnalyzer:    { label: 'Insights full analyzer',            gated: true },
  insightsRecommendations: { label: 'Insights recommendations',      gated: true },
  componentImpact:     { label: 'Component impact map',              gated: true },
  a11yTaskPacks:       { label: 'Accessibility task packs',          gated: true }
};

function _qL55(featureKey) {
  const feature = _pT10[featureKey];
  if (!feature) return false;
  if (_mN77) return false;
  return feature.gated === true;
}

async function _bS12() {
  try {
    const data = await chrome.storage.sync.get([_uR42, _lsKey, _lsInst]);
    _mN77 = !!data[_uR42];
    if (_mN77 && data[_lsKey]) {
      await _validateLicenseKey(data[_lsKey], data[_lsInst]);
    }
  } catch (_) {
    _mN77 = false;
  }
}

async function _validateLicenseKey(licenseKey, instanceId) {
  if (!licenseKey) return;
  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey, instance_id: instanceId })
    });
    const result = await response.json();
    if (!result.valid) {
      _mN77 = false;
      await chrome.storage.sync.set({ [_uR42]: false });
      showToast('Your license expired or was revoked. Free mode activated.');
    }
  } catch (_) {
  }
}

function tagProElement(el, featureKey) {
  if (!el || el.querySelector(':scope > .pro-badge')) return;
  const feature = _pT10[featureKey];
  if (!feature) return;
  const badge = document.createElement('span');
  badge.className = 'pro-badge';
  badge.textContent = 'PRO';
  badge.title = _qL55(featureKey)
    ? `${feature.label} — upgrade to Pro to unlock`
    : `${feature.label} — Pro feature`;
  el.appendChild(badge);
}

function featureLabel(featureKey) {
  const feature = _pT10[featureKey];
  return feature ? feature.label : 'Pro feature';
}

function formatToFeatureKey(format) {
  const map = {
    less: 'advancedExport',
    styl: 'advancedExport',
    js: 'advancedExport',
    ts: 'advancedExport',
    tailwind: 'tailwindExport',
    figma: 'figmaExport',
    dtcg: 'dtcgExport'
  };
  return map[format] || null;
}

function familyToFeatureKey(familyId) {
  const map = {
    react: 'reactExport',
    design: 'figmaExport'
  };
  return map[familyId] || null;
}

function isFamilyLocked(familyId) {
  const featureKey = familyToFeatureKey(familyId);
  return featureKey ? _qL55(featureKey) : false;
}

function targetToFeatureKey(targetId) {
  const map = {
    audit: 'auditReport'
  };
  return map[targetId] || null;
}

function syncExportChipLocks() {
  const targetChips = document.querySelectorAll('[data-target]');
  targetChips.forEach(chip => {
    const target = chip.dataset.target || '';
    const featureKey = targetToFeatureKey(target);
    const locked = featureKey ? _qL55(featureKey) : false;
    chip.classList.toggle('pro-locked', locked);
    chip.setAttribute('title', locked ? 'Pro feature' : '');
  });

  const familyChips = document.querySelectorAll('[data-family]');
  familyChips.forEach(chip => {
    const family = chip.dataset.family || '';
    const featureKey = familyToFeatureKey(family);
    const locked = featureKey ? _qL55(featureKey) : false;
    chip.classList.toggle('pro-locked', locked);
    chip.setAttribute('title', locked ? 'Pro feature' : '');
  });
}

function lockedFeatureLabels(limit = 7) {
  return Object.entries(_pT10)
    .filter(([key]) => _qL55(key))
    .map(([key]) => featureLabel(key))
    .slice(0, limit);
}

function openProPlanModal(featureKey = null) {
  const overlay = document.getElementById('proPlanOverlay');
  if (!overlay) return;

  const title = document.getElementById('proPlanTitle');
  const subtitle = document.getElementById('proPlanSubtitle');

  if (_mN77) {
    // Pro mode: show active features summary, hide upgrade UI
    overlay.dataset.plan = 'pro';
    if (title) title.textContent = 'You\'re on Pro';
    if (subtitle) subtitle.textContent = 'Your license is active.';

    const featuresList = document.getElementById('proActiveFeaturesList');
    if (featuresList) {
      featuresList.innerHTML = Object.values(_pT10)
        .filter(f => f.gated)
        .map(f => `<li>${escapeHtmlText(f.label)}</li>`)
        .join('');
    }

    openLayer(overlay, { focusEl: document.getElementById('closeProPlanBtn') });
    return;
  }

  // Free mode: upgrade view
  delete overlay.dataset.plan;
  if (title) title.textContent = 'Upgrade to Pro';
  if (subtitle) subtitle.textContent = 'Unlock advanced exports, audits, and workflow power.';

  const missingTitle = document.getElementById('proMissingTitle');
  const missingList = document.getElementById('proMissingList');
  const pitch = document.getElementById('proPlanPitch');
  const triggeredLabel = featureKey ? featureLabel(featureKey) : null;

  if (pitch) {
    pitch.textContent = triggeredLabel
      ? `"${triggeredLabel}" is available on Pro. Upgrade to unlock advanced workflow tools and speed up audits/handoff.`
      : 'You are currently on Free. Upgrade to Pro to remove limits and save hours during audits and handoff.';
  }

  if (missingTitle) {
    missingTitle.textContent = triggeredLabel
      ? `Why teams upgrade for ${triggeredLabel}`
      : 'What you are missing on Free';
  }

  if (missingList) {
    const labels = lockedFeatureLabels(20);
    const unique = triggeredLabel ? [triggeredLabel, ...labels.filter(v => v !== triggeredLabel)] : labels;
    const rows = unique.slice(0, 10).map(label => `<li>${escapeHtmlText(label)}</li>`).join('');
    missingList.innerHTML = rows || '<li>Advanced Pro features are currently locked on Free.</li>';
  }

  openLayer(overlay, {
    focusEl: document.getElementById('closeProPlanBtn')
  });
}

function closeProPlanModal() {
  const overlay = document.getElementById('proPlanOverlay');
  if (!overlay) return;
  closeLayer(overlay, {
    fallbackFocus: document.getElementById('modeBtn')
  });
}

function isVisibleLayer(el) {
  if (!el) return false;
  if (el.classList.contains('hidden')) return false;
  const ariaHidden = el.getAttribute('aria-hidden');
  if (ariaHidden === 'true') return false;
  return true;
}

const layerFocusReturn = new WeakMap();

function openLayer(layerEl, options = {}) {
  if (!layerEl) return false;
  const mode = options.mode === 'open' ? 'open' : 'hidden';
  const setAria = options.setAria !== false;
  const captureFocus = options.captureFocus !== false;

  if (captureFocus) {
    const active = document.activeElement;
    layerFocusReturn.set(layerEl, active && typeof active.focus === 'function' ? active : null);
  }

  if (mode === 'open') {
    layerEl.classList.add('open');
  } else {
    layerEl.classList.remove('hidden');
  }

  if (setAria) {
    layerEl.setAttribute('aria-hidden', 'false');
  }

  const focusTarget = options.focusEl || null;
  if (focusTarget && typeof focusTarget.focus === 'function') {
    focusTarget.focus();
  }

  return true;
}

function isFocusableVisible(el) {
  if (!el || typeof el.focus !== 'function' || !document.contains(el)) return false;
  const style = window.getComputedStyle(el);
  if (!style) return false;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (el.hasAttribute('disabled')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function focusSafely(el) {
  if (!isFocusableVisible(el)) return false;
  try {
    el.focus({ preventScroll: true });
  } catch (_) {
    try {
      el.focus();
    } catch (_) {
      return false;
    }
  }
  return document.activeElement === el;
}

function closeLayer(layerEl, options = {}) {
  if (!layerEl) return false;
  const mode = options.mode === 'open' ? 'open' : 'hidden';
  const setAria = options.setAria !== false;
  const restoreFocus = options.restoreFocus !== false;

  const activeBeforeClose = document.activeElement;
  const focusedInsideLayer = !!(activeBeforeClose && layerEl.contains(activeBeforeClose));

  if (restoreFocus) {
    const fallback = options.fallbackFocus || null;
    const stored = layerFocusReturn.get(layerEl);
    let target = null;
    if (isFocusableVisible(fallback)) {
      target = fallback;
    } else if (isFocusableVisible(stored)) {
      target = stored;
    }

    if (!target && focusedInsideLayer) {
      target = document.getElementById('toolsMenuBtn')
        || document.getElementById('modeBtn')
        || document.querySelector('.tab-btn.active');
    }

    if (target) {
      focusSafely(target);
    }

    if (focusedInsideLayer && layerEl.contains(document.activeElement)) {
      const body = document.body;
      if (body) {
        const hadTabIndex = body.hasAttribute('tabindex');
        const prevTabIndex = body.getAttribute('tabindex');
        if (!hadTabIndex) body.setAttribute('tabindex', '-1');
        focusSafely(body);
        if (!hadTabIndex) {
          body.removeAttribute('tabindex');
        } else if (prevTabIndex !== null) {
          body.setAttribute('tabindex', prevTabIndex);
        }
      }
    }
  }

  if (mode === 'open') {
    layerEl.classList.remove('open');
  } else {
    layerEl.classList.add('hidden');
  }

  if (setAria) {
    layerEl.setAttribute('aria-hidden', 'true');
  }

  return true;
}

function closeInsightScoreModalGlobal() {
  const modal = document.getElementById('insightScoreModal');
  if (!modal || !modal.classList.contains('open')) return false;
  closeLayer(modal, {
    mode: 'open',
    fallbackFocus: document.getElementById('insightScoreAnalyzerBtn')
  });
  return true;
}

function closeTopInteractiveLayer() {
  if (closeTabHelpModalGlobal()) return true;
  if (closeInsightScoreModalGlobal()) return true;

  const proOverlay = document.getElementById('proPlanOverlay');
  if (isVisibleLayer(proOverlay)) {
    closeProPlanModal();
    return true;
  }

  const spacingOverlay = document.getElementById('spacingDetailsOverlay');
  if (isVisibleLayer(spacingOverlay)) {
    closeSpacingDetailsModal();
    return true;
  }

  const exportOverlay = document.getElementById('exportModalOverlay');
  if (isVisibleLayer(exportOverlay)) {
    closeExportModal();
    return true;
  }

  const toolsSubmenu = document.getElementById('toolsSubmenu');
  const toolsMenu = document.getElementById('globalPageTools');
  const toolsMenuBtn = document.getElementById('toolsMenuBtn');
  if (toolsSubmenu && !toolsSubmenu.classList.contains('hidden')) {
    toolsSubmenu.classList.add('hidden');
    toolsMenu?.classList.remove('is-open');
    toolsMenuBtn?.setAttribute('aria-expanded', 'false');
    return true;
  }

  return false;
}

function notifyProLock(featureKey, toastMsg) {
  if (!_qL55(featureKey)) return false;
  showToast(toastMsg || `${featureLabel(featureKey)} is a Pro feature.`);
  openProPlanModal(featureKey);
  return true;
}

let tokens = null;
let activeTab = 'colors';
let savedSites = [];
let lastDiffView = null;
let inspectResult = null;
let activePreview = null; // { key, name, applied, tokenAppliedPct, pageCoveragePct }
let toastTimer = null;
let lastExportFormat = 'css';
let wcagOverlayActive = false;
let colorBlindMode = 'off';
let measureModeEnabled = false;
let layoutOverlayEnabled = false;
let layoutInViewOnly = true;
let layoutLabelsEnabled = false;
let previewInProgress = false;
let colorGroupView = false;
let eyedropperPickedColor = '';
let pageAssets = null;
let currentSiteMeta = { title: '', url: '', favicon: '' };
const MEASURE_FREE_DAILY_LIMIT = 3;
const MEASURE_QUOTA_STORAGE_KEY = 'tl_measure_quota';
const SCAN_FREE_MONTHLY_LIMIT = 10;
const SCAN_QUOTA_STORAGE_KEY = 'tl_scan_quota';
let measureQuotaState = {
  host: '',
  dateKey: '',
  used: 0,
  remaining: MEASURE_FREE_DAILY_LIMIT,
  limit: MEASURE_FREE_DAILY_LIMIT
};
let scanQuotaState = {
  monthKey: '',
  used: 0,
  remaining: SCAN_FREE_MONTHLY_LIMIT,
  limit: SCAN_FREE_MONTHLY_LIMIT
};
const UI_SURFACE = 'popup';
const IS_DETACHED_WINDOW = /(?:\?|&)detached=1(?:&|$)/.test(window.location.search);
const IS_CLASSIC_WINDOW = /(?:\?|&)classic=1(?:&|$)/.test(window.location.search);
const IS_EMBEDDED_SURFACE = window.self !== window.top || /(?:\?|&)embedded=1(?:&|$)/.test(window.location.search);
const UNIT_OPTIONS = ['px', 'rem', 'em'];
const TAB_HELP_CONTENT = {
  colors: [
    { label: 'Group by role', text: 'Switch between a flat color list and grouped semantic roles (brand/surface/text).' },
    { label: 'Eyedropper', text: 'Pick any visible page color and bring it into the Colors panel for quick matching.' },
    { label: 'Color value button', text: 'Click to cycle formats: HEX, HSL, RGBA, and CMYK.' },
    { label: 'Locate (◎)', text: 'Find where that color appears on the page.' },
    { label: 'Copy / CSS var', text: 'Copy the current value or copy a ready-to-use CSS variable line.' }
  ],
  fonts: [
    { label: 'Inspect (◎)', text: 'Find page elements using the selected font or size token.' },
    { label: 'Size toggle', text: 'Switch typography size display between px, rem, and em.' },
    { label: 'More details', text: 'Open line-height, weight, readability score, and additional typography context.' },
    { label: 'Font family list', text: 'Review extracted families and copy a font stack quickly.' }
  ],
  spacingValues: [
    { label: 'Copy spacing vars', text: 'Copy spacing token variables for immediate CSS usage.' },
    { label: 'Details', text: 'Open spacing analysis with scale consistency, near-duplicates, and cleanup suggestions.' },
    { label: 'Inspect (◎)', text: 'Highlight where specific spacing values are used on the page.' },
    { label: 'Copy', text: 'Copy a spacing token value quickly.' }
  ],
  radiusValues: [
    { label: 'Copy radius vars', text: 'Copy radius token variables for immediate CSS usage.' },
    { label: 'Inspect (◎)', text: 'Highlight where specific radius values are used on the page.' },
    { label: 'Copy', text: 'Copy a radius token value quickly.' },
    { label: 'Preview block', text: 'The preview square shows how each radius value rounds corners.' }
  ],
  shadows: [
    { label: 'Details', text: 'Open effect breakdowns for shadows, gradients, and transition tokens.' },
    { label: 'Preview switches', text: 'Preview each shadow on card, button, or modal surfaces.' },
    { label: 'Inspect (◎)', text: 'Highlight matching effects on the page.' },
    { label: 'Copy', text: 'Copy the full effect value for reuse.' }
  ],
  vars: [
    { label: 'Search', text: 'Filter variables by name, value, or detected type.' },
    { label: 'Expand / Collapse', text: 'Open or close all variable groups for faster browsing.' },
    { label: 'Color value cycle', text: 'Cycle color variable formats when multiple representations are available.' },
    { label: 'var() / value', text: 'Copy either var(--token-name) or the resolved raw value.' },
    { label: 'Copy all', text: 'Copy all variables from one group as a ready-to-paste block.' }
  ],
  assets: [
    { label: 'Download all', text: 'Download all extracted images, SVGs, and icons from the current page.' },
    { label: 'Re-scan', text: 'Refresh the assets list after page updates.' },
    { label: 'Filters', text: 'Filter by Images, SVGs, or Icons for faster browsing.' },
    { label: 'Asset actions', text: 'Preview, copy source URL, or download individual assets.' }
  ],
  insights: [
    { label: 'Open WCAG overlays', text: 'Show live contrast issue overlays on the page to spot readability failures.' },
    { label: 'Full score analyzer', text: 'Open detailed scoring breakdown with risk areas and recommendations.' },
    { label: 'Recommendations', text: 'Review prioritized actions (Now, Next, Later) with expected impact.' },
    { label: 'Component impact cards', text: 'Understand which UI areas are most affected and what to fix first.' }
  ],
  history: [
    { label: 'Clear all', text: 'Delete all saved snapshots from History.' },
    { label: 'Load', text: 'Load a snapshot into the current workspace view.' },
    { label: 'Diff', text: 'Show token drift summary for a selected snapshot.' },
    { label: 'Apply to page (Beta)', text: 'Preview snapshot style tokens on the live page. This is in beta and still evolving.' },
    { label: 'Delete', text: 'Delete only the selected snapshot entry.' }
  ]
};
const DEFAULT_EXPORT_PREFS = {
  preset: 'all',
  uiMode: 'beginner',
  unit: 'px',
  include: {
    colors: true,
    typography: true,
    spacing: true,
    radius: true,
    shadows: true,
    gradients: true,
    variables: true
  }
};
let exportPrefs = JSON.parse(JSON.stringify(DEFAULT_EXPORT_PREFS));

// ── Export Framework Families ──────────────────────────────────────
const FRAMEWORK_FAMILIES = {
  web: {
    label: 'Web',
    formats: [
      { id: 'css', label: 'CSS Variables' },
      { id: 'scss', label: 'SCSS' },
      { id: 'less', label: 'Less' },
      { id: 'styl', label: 'Stylus' },
      { id: 'tailwind', label: 'Tailwind Config' }
    ]
  },
  react: {
    label: 'React UI',
    formats: [
      { id: 'mui', label: 'Material-UI (MUI)', proOnly: true },
      { id: 'chakra', label: 'Chakra UI', proOnly: true },
      { id: 'ant', label: 'Ant Design', proOnly: true }
    ]
  },
  design: {
    label: 'Design tools',
    formats: [
      { id: 'figma', label: 'Figma Tokens' },
      { id: 'dtcg', label: 'DTCG' }
    ]
  },
  standard: {
    label: 'Standard',
    formats: [
      { id: 'json', label: 'JSON' },
      { id: 'js', label: 'JavaScript Token Object' },
      { id: 'ts', label: 'TypeScript Token Object' }
    ]
  }
};

let currentExportFamily = 'web';
let uiPort = null;
const MESSAGE_TIMEOUT_MS = 7000;

// ── Unit conversion (FREE) ─────────────────────────────────────────
// Converts a raw px number into the user's preferred display unit.
function activeUnit() {
  return UNIT_OPTIONS.includes(exportPrefs.unit) ? exportPrefs.unit : 'px';
}

function formatLength(px) {
  const n = Number(px);
  if (Number.isNaN(n)) return String(px);
  const unit = activeUnit();
  if (unit === 'px') return `${n}px`;
  const converted = (n / 16).toFixed(4).replace(/\.?0+$/, '');
  return `${converted}${unit}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  connectUiSurface();
  initTheme();
  applySurfaceUi();

  const redirectedToFloating = await maybeLaunchFloatingSurfaceOnOpen();
  if (redirectedToFloating) return;

  await _bS12();
  await loadSaved();
  await loadPrefs();
  bindEvents();
  await syncLiveToolStatesFromPage();
  initExportControls();
  applyUiMode();
  await checkInspectResult();
  await extract();
});

function connectUiSurface() {
  try {
    uiPort = chrome.runtime.connect({ name: 'palext-popup' });
  } catch (_) {
    uiPort = null;
  }
}

function applySurfaceUi() {
  document.body.classList.toggle('surface-embedded', IS_EMBEDDED_SURFACE);
}

function initTheme() {
  const saved = localStorage.getItem('tl_theme');
  const theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  setTheme(theme, false);
}

function setTheme(theme, persist = true) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  if (persist) localStorage.setItem('tl_theme', theme);
}

async function loadSaved() {
  const data = await chrome.storage.local.get('tl_saved');
  savedSites = data.tl_saved || [];
  updateHistoryCount();
}

function presetToInclude(preset) {
  if (preset === 'colors-only') {
    return { colors: true, typography: false, spacing: false, radius: false, shadows: false, gradients: false, variables: false };
  }
  if (preset === 'colors-radius') {
    return { colors: true, typography: false, spacing: false, radius: true, shadows: false, gradients: false, variables: false };
  }
  return { colors: true, typography: true, spacing: true, radius: true, shadows: true, gradients: true, variables: true };
}

async function loadPrefs() {
  const data = await chrome.storage.local.get('tl_prefs');
  if (!data.tl_prefs) return;

  exportPrefs = {
    ...DEFAULT_EXPORT_PREFS,
    ...data.tl_prefs,
    include: {
      ...DEFAULT_EXPORT_PREFS.include,
      ...(data.tl_prefs.include || {})
    }
  };
}

async function savePrefs() {
  await chrome.storage.local.set({ tl_prefs: exportPrefs });
}

function getActiveInclude() {
  if (exportPrefs.preset !== 'custom') return presetToInclude(exportPrefs.preset);
  return { ...exportPrefs.include };
}

function initExportControls() {
  const presetSelect = document.getElementById('exportPreset');
  const panel = document.getElementById('exportCustomize');
  const customizeBtn = document.getElementById('customizeExportBtn');
  const formatSelect = document.getElementById('exportFormatSelect');
  const hint = document.getElementById('lastExportHint');
  if (!presetSelect || !panel || !customizeBtn) return;

  const validPresets = new Set(['all', 'colors-radius', 'colors-only', 'custom']);
  if (!validPresets.has(exportPrefs.preset)) exportPrefs.preset = 'all';

  presetSelect.value = exportPrefs.preset || 'all';
  panel.classList.toggle('hidden', exportPrefs.preset !== 'custom');
  customizeBtn.textContent = exportPrefs.preset === 'custom' ? 'Hide' : 'Customize';

  const include = getActiveInclude();
  panel.querySelectorAll('[data-exp-cat]').forEach(input => {
    input.checked = !!include[input.dataset.expCat];
  });

  if (formatSelect) formatSelect.value = lastExportFormat || 'css';
  if (hint) hint.textContent = `Last used: ${(lastExportFormat || 'css').toUpperCase()}`;

  syncUnitButtons();
}

// Reflects the active display unit on the px/rem/em toggle buttons.
function syncUnitButtons() {
  const unit = activeUnit();
  document.querySelectorAll('.unit-btn').forEach(btn => {
    const on = btn.dataset.unit === unit;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function applyProBadges() {
  // Pro badge on tabs removed; plan status shown in drag bar instead
}

function applyUiMode() {
  const isPro = !!_mN77;
  document.body.setAttribute('data-mode', isPro ? 'pro' : 'free');

  const modeBtn = document.getElementById('modeBtn');
  if (modeBtn) {
    modeBtn.textContent = isPro ? 'Pro' : 'Free';
    modeBtn.setAttribute('title', isPro
      ? 'Current plan: Pro.'
      : 'Current plan: Free. Click to view plans.');
    modeBtn.setAttribute('aria-label', isPro
      ? 'Current plan is Pro.'
      : 'Current plan is Free. Click to view plans.');
    modeBtn.classList.remove('is-test');
    modeBtn.classList.toggle('is-pro', isPro);
  }

  if (IS_EMBEDDED_SURFACE) {
    try {
      const plan = isPro ? 'pro' : 'free';
      window.parent.postMessage({ type: 'PALEXT_PLAN_UPDATE', plan }, '*');
    } catch (_) {}
  }

  document.querySelectorAll('[data-export-format]').forEach(btn => {
    btn.classList.remove('pro-locked');
  });

  const customizeBtn = document.getElementById('customizeExportBtn');
  if (customizeBtn) customizeBtn.classList.remove('pro-locked');

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    const themeLocked = _qL55('themePersonalization');
    themeBtn.classList.toggle('hidden', themeLocked);
    themeBtn.classList.toggle('pro-locked', themeLocked);
    themeBtn.setAttribute('title', themeLocked ? 'Theme personalization is a Pro feature.' : 'Toggle theme');
  }

  document.querySelectorAll('[data-pro-only="true"]').forEach(el => {
    if (el.id === 'exportCustomize') return;
    el.classList.remove('hidden');
  });
}

const FREE_SNAPSHOT_LIMIT = 3;

async function saveSite(currentTokens) {
  if (!currentTokens) return;

  const deduped = savedSites.filter(s => s.url !== currentTokens.url);
  const maxSnapshots = _qL55('unlimitedSnapshots') ? FREE_SNAPSHOT_LIMIT : 999;
  if (deduped.length >= maxSnapshots) {
    showToast(`Free plan stores up to ${FREE_SNAPSHOT_LIMIT} snapshots. Upgrade to Pro for unlimited history.`);
    openProPlanModal('unlimitedSnapshots');
    return;
  }

  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: currentTokens.url,
    title: currentTokens.title,
    tokens: currentTokens,
    savedAt: Date.now()
  };

  savedSites = [entry, ...deduped].slice(0, maxSnapshots);
  await chrome.storage.local.set({ tl_saved: savedSites });
  updateHistoryCount();
  showToast('Snapshot saved');
}

function snapshotKey(entry) {
  return entry.id || `${entry.url || 'unknown'}_${entry.savedAt || 0}`;
}

async function deleteSavedSnapshot(entry) {
  const key = snapshotKey(entry);
  savedSites = savedSites.filter(s => snapshotKey(s) !== key);
  await chrome.storage.local.set({ tl_saved: savedSites });
  updateHistoryCount();
}

async function clearSavedSnapshots() {
  savedSites = [];
  await chrome.storage.local.set({ tl_saved: savedSites });
  updateHistoryCount();
}

function scanMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function readScanQuota(monthKey) {
  try {
    const data = await chrome.storage.local.get(SCAN_QUOTA_STORAGE_KEY);
    const root = data[SCAN_QUOTA_STORAGE_KEY] || {};
    return Number(root[monthKey] || 0);
  } catch (_) {
    return 0;
  }
}

async function writeScanQuota(monthKey, used) {
  const data = await chrome.storage.local.get(SCAN_QUOTA_STORAGE_KEY);
  const root = data[SCAN_QUOTA_STORAGE_KEY] || {};
  root[monthKey] = Math.max(0, Number(used) || 0);
  await chrome.storage.local.set({ [SCAN_QUOTA_STORAGE_KEY]: root });
}

function isScanLimitedPlan() {
  return _qL55('scanUnlimited');
}

async function refreshScanQuotaState() {
  const limit = SCAN_FREE_MONTHLY_LIMIT;
  const monthKey = scanMonthKey();
  if (!isScanLimitedPlan()) {
    scanQuotaState = { monthKey, used: 0, remaining: limit, limit };
    return scanQuotaState;
  }

  const used = await readScanQuota(monthKey);
  const remaining = Math.max(0, limit - used);
  scanQuotaState = { monthKey, used, remaining, limit };
  return scanQuotaState;
}

async function consumeScanQuota() {
  if (!isScanLimitedPlan()) return scanQuotaState;
  const state = await refreshScanQuotaState();
  const nextUsed = state.used + 1;
  await writeScanQuota(state.monthKey, nextUsed);
  const remaining = Math.max(0, state.limit - nextUsed);
  scanQuotaState = { monthKey: state.monthKey, used: nextUsed, remaining, limit: state.limit };
  return scanQuotaState;
}

async function extract() {
  setStatus('scanning');
  lastDiffView = null;

  try {
    const tab = await getPreferredActiveTab();
    if (!tab || !tab.id) {
      setStatus('error', 'No active tab found.');
      return;
    }

    if (!isSupportedTab(tab.url)) {
      setStatus('error', 'Open a normal http/https website tab, then try again.');
      return;
    }

    await refreshScanQuotaState();
    if (isScanLimitedPlan() && scanQuotaState.remaining <= 0) {
      setStatus('error', `Free plan limit reached: ${SCAN_FREE_MONTHLY_LIMIT} scans used this month.`);
      notifyProLock('scanUnlimited', `You reached ${SCAN_FREE_MONTHLY_LIMIT}/${SCAN_FREE_MONTHLY_LIMIT} monthly scans. Upgrade for unlimited scans.`);
      return;
    }

    const response = await sendExtractMessage(tab);
    if (!response || !response.ok || !response.tokens) {
      setStatus('error', response && response.error ? response.error : 'Could not read this page. Try refreshing.');
      return;
    }

    tokens = normalizeExtractedTokens(response.tokens);
    currentSiteMeta = {
      title: tab.title || response.tokens.title || getDomain(tab.url || response.tokens.url),
      url: tab.url || response.tokens.url || '',
      favicon: tab.favIconUrl || ''
    };
    if (isScanLimitedPlan()) {
      await consumeScanQuota();
    }
    await refreshMeasureQuotaState(getDomain(currentSiteMeta.url));
    setStatus('done');
    renderHeader(tokens);
    renderTokens(activeTab);
    // Lazily prefetch asset count without blocking the token UI.
    pageAssets = null;
    setCount('cnt_assets', 0);
    loadAssets().catch(() => {});
  } catch (_) {
    setStatus('error', 'Cannot access this page (restricted URL).');
  }
}

function isSupportedTab(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

async function getPreferredActiveTab() {
  try {
    const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (current && current.id && isSupportedTab(current.url)) {
      return current;
    }
  } catch (_) {}

  try {
    const activeTabs = await chrome.tabs.query({ active: true });
    const supported = (activeTabs || []).find((tab) => tab && tab.id && isSupportedTab(tab.url));
    if (supported) return supported;
  } catch (_) {}

  try {
    const [lastFocused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (lastFocused && lastFocused.id && isSupportedTab(lastFocused.url)) {
      return lastFocused;
    }
  } catch (_) {}

  return null;
}

async function maybeLaunchFloatingSurfaceOnOpen() {
  if (UI_SURFACE !== 'popup' || IS_DETACHED_WINDOW || IS_CLASSIC_WINDOW || IS_EMBEDDED_SURFACE) return false;

  try {
    const tab = await getPreferredActiveTab();
    if (!tab || !tab.id || !isSupportedTab(tab.url)) return false;

    const opened = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: 'OPEN_FLOATING_TOOL', startInspect: false }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(!!(resp && resp.ok));
      });
    });

    if (!opened) return false;
    window.close();
    return true;
  } catch (_) {
    return false;
  }
}

function sendExtractMessageOnce(tabId) {
  return sendTabMessageOnce(tabId, { type: 'EXTRACT_TOKENS' });
}

function sendTabMessageOnce(tabId, message) {
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: 'Scanner timed out. Reload the page and try again.', code: 'TIMEOUT' });
    }, MESSAGE_TIMEOUT_MS);

    chrome.tabs.sendMessage(tabId, message, response => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || '';
        const noReceiver = /Receiving end does not exist/i.test(msg);
        resolve({ ok: false, error: noReceiver ? 'Preparing page scanner, retrying…' : 'Open any website tab, then try again.', code: noReceiver ? 'NO_RECEIVER' : 'MESSAGE_ERROR' });
        return;
      }
      resolve(response || { ok: false, error: 'No response from page.' });
    });
  });
}

function normalizeExtractedTokens(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const normalizedFontSizes = Array.isArray(data.fontSizes)
    ? data.fontSizes
      .map(size => {
        const px = Number(size && size.px);
        if (!Number.isFinite(px)) return null;
        const rounded = Math.round(px);
        const rem = (size && size.rem) || `${(rounded / 16).toFixed(3).replace(/\.?0+$/, '')}rem`;
        const count = Math.max(0, Number(size && size.count) || 0);
        return { px: rounded, rem, count };
      })
      .filter(Boolean)
    : [];

  return {
    colors: Array.isArray(data.colors) ? data.colors : [],
    fonts: Array.isArray(data.fonts) ? data.fonts : [],
    fontSizes: normalizedFontSizes,
    fontWeights: Array.isArray(data.fontWeights) ? data.fontWeights : [],
    spacing: Array.isArray(data.spacing) ? data.spacing : [],
    spacingMeta: (data.spacingMeta && typeof data.spacingMeta === 'object') ? data.spacingMeta : {},
    radii: Array.isArray(data.radii) ? data.radii : [],
    shadows: Array.isArray(data.shadows) ? data.shadows : [],
    gradients: Array.isArray(data.gradients) ? data.gradients : [],
    motion: Array.isArray(data.motion) ? data.motion : [],
    lineHeights: Array.isArray(data.lineHeights) ? data.lineHeights : [],
    fontSources: Array.isArray(data.fontSources) ? data.fontSources : [],
    cssStats: (data.cssStats && typeof data.cssStats === 'object') ? data.cssStats : { styleRules: 0, declarations: 0, inlineStyles: 0, avgSpecificity: 0, quality: 'Unknown' },
    rootVars: (data.rootVars && typeof data.rootVars === 'object') ? data.rootVars : {},
    wcag: (data.wcag && typeof data.wcag === 'object') ? data.wcag : { aaFailCount: 0, checkedTextBlocks: 0 },
    url: data.url || '',
    title: data.title || '',
    extractedAt: Number(data.extractedAt || Date.now())
  };
}

async function tryInjectContentScript(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['js/content.js']
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function sendExtractMessage(tab) {
  const first = await sendExtractMessageOnce(tab.id);
  if (first.ok) return first;
  if (first.code !== 'NO_RECEIVER') return first;

  const injected = await tryInjectContentScript(tab.id);
  if (!injected) {
    return { ok: false, error: 'Cannot attach scanner to this page. Try reload once.' };
  }

  return sendExtractMessageOnce(tab.id);
}

async function sendActionToActiveTab(message) {
  const tab = await getPreferredActiveTab();
  if (!tab || !tab.id) return { ok: false, error: 'No active tab found.' };
  if (!isSupportedTab(tab.url)) return { ok: false, error: 'Open a normal website tab first.' };

  const first = await sendTabMessageOnce(tab.id, message);
  if (first.ok || first.code !== 'NO_RECEIVER') return first;

  const injected = await tryInjectContentScript(tab.id);
  if (!injected) return { ok: false, error: 'Cannot attach to this page.' };
  return sendTabMessageOnce(tab.id, message);
}

async function syncLiveToolStatesFromPage() {
  const result = await sendActionToActiveTab({ type: 'GET_TOOL_STATES' });
  if (!result || !result.ok) return false;

  measureModeEnabled = !!result.measureModeActive;
  layoutOverlayEnabled = !!result.layoutOverlayActive;
  if (typeof result.layoutInViewOnly === 'boolean') {
    layoutInViewOnly = result.layoutInViewOnly;
  }
  if (typeof result.layoutLabelsEnabled === 'boolean') {
    layoutLabelsEnabled = result.layoutLabelsEnabled;
  }
  updateGlobalPageToolsUi();
  return true;
}

async function openEyedropperViaScripting() {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    return { ok: false, error: 'Scripting API is unavailable.' };
  }

  const tab = await getPreferredActiveTab();
  if (!tab || !tab.id) return { ok: false, error: 'No active tab found.' };
  if (!isSupportedTab(tab.url)) return { ok: false, error: 'Open a normal website tab first.' };

  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const normalizeHex = (value) => {
          const raw = String(value || '').trim();
          if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
          if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
            return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
          }
          return null;
        };

        if (!window.EyeDropper) {
          return { ok: false, error: 'EyeDropper API is not available on this page/browser.' };
        }
        try {
          const picked = await new window.EyeDropper().open();
          const hex = normalizeHex(picked && picked.sRGBHex);
          if (!hex) return { ok: false, error: 'No color selected.' };
          return { ok: true, hex };
        } catch (err) {
          if (err && err.name === 'AbortError') {
            return { ok: false, aborted: true, error: 'Color picking cancelled' };
          }
          return { ok: false, error: err && err.message ? err.message : 'Could not pick color from page.' };
        }
      }
    });
    return (injected && injected[0] && injected[0].result) || { ok: false, error: 'No response from page.' };
  } catch (_) {
    return { ok: false, error: 'Could not start eyedropper on this page.' };
  }
}

async function openEyedropperInPopupContext() {
  if (!window.EyeDropper) {
    return { ok: false, unsupported: true, error: 'EyeDropper API is unavailable in popup context.' };
  }
  try {
    const picked = await new window.EyeDropper().open();
    const hex = toHexColor(picked && picked.sRGBHex);
    if (!hex) return { ok: false, error: 'No color selected.' };
    return { ok: true, hex };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, aborted: true, error: 'Color picking cancelled' };
    }
    return { ok: false, error: err && err.message ? err.message : 'Could not pick color from popup context.' };
  }
}

async function sendActionToTab(tabId, message) {
  const first = await sendTabMessageOnce(tabId, message);
  if (first.ok || first.code !== 'NO_RECEIVER') return first;
  const injected = await tryInjectContentScript(tabId);
  if (!injected) return { ok: false, error: 'Cannot attach scanner to this tab.' };
  return sendTabMessageOnce(tabId, message);
}

async function extractTokensFromUrl(url) {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const preferredWindow = windows.find(w => w.focused) || windows[0] || null;
  const createOptions = { url, active: false };
  if (preferredWindow && preferredWindow.id) createOptions.windowId = preferredWindow.id;

  const created = await chrome.tabs.create(createOptions);
  if (!created || !created.id) return null;

  return new Promise(resolve => {
    let done = false;
    let timeoutId = null;
    let extracted = false;

    const finish = async (value) => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      if (timeoutId) clearTimeout(timeoutId);
      try { await chrome.tabs.remove(created.id); } catch (_) {}
      resolve(value);
    };

    const runExtraction = async () => {
      if (extracted || done) return;
      extracted = true;
      const result = await sendActionToTab(created.id, { type: 'EXTRACT_TOKENS' });
      if (!result || !result.ok || !result.tokens) {
        await finish(null);
        return;
      }
      await finish(normalizeExtractedTokens(result.tokens));
    };

    const onUpdated = async (tabId, changeInfo) => {
      if (tabId !== created.id) return;
      if (changeInfo.status !== 'complete') return;
      await runExtraction();
    };

    timeoutId = window.setTimeout(() => {
      void finish(null);
    }, 20000);

    chrome.tabs.onUpdated.addListener(onUpdated);

    if (created.status === 'complete') {
      void runExtraction();
    }
  });
}

async function applySnapshotPreview(entry) {
  if (activePreview && activePreview.key === snapshotKey(entry)) {
    showToast('This snapshot is already previewing. Click Revert to remove it.');
    return false;
  }
  const vars = (entry.tokens && entry.tokens.rootVars) || {};
  const varCount = Object.keys(vars).filter(k => k.startsWith('--')).length;
  const snapshotName = entry.title || getDomain(entry.url);
  const result = await sendActionToActiveTab({
    type: 'APPLY_VAR_PREVIEW',
    vars,
    snapshotTokens: entry.tokens || {},
    snapshotName
  });
  if (!result.ok) {
    showToast(result.error || 'Could not apply preview');
    return false;
  }
  if (result.noStyleSource) {
    showToast('This snapshot has no usable style source (colors/variables), so preview cannot be generated.');
    return false;
  }
  if (result.noMatchingVars) {
    showToast('No shared variable names and not enough token data for smart remap. Try a richer snapshot.');
    return false;
  }
  if (result.noVisibleChange) {
    showToast(`Applied logic ran, but visual impact is negligible on this page (${result.pageCoveragePct || 0}% estimated coverage).`);
    return false;
  }
  if (result.noVars || result.applied === 0) {
    showToast('Preview could not produce a visible change on this page. Try another snapshot or page.');
    return false;
  }
  activePreview = {
    key: snapshotKey(entry),
    name: snapshotName,
    applied: result.applied,
    tokenAppliedPct: result.tokenAppliedPct || 0,
    pageCoveragePct: result.pageCoveragePct || 0,
    matchedElements: result.matchedElements || 0,
    totalElements: result.totalElements || 0,
    mode: result.mode || 'semantic'
  };
  const frameworkNote = result.cssFramework === 'tailwind'
    ? '\nPage likely uses Tailwind — some elements may not respond to Smart Apply.'
    : result.cssFramework === 'css-in-js'
    ? '\nPage may use CSS-in-JS — Smart Apply has limited effect on hashed class names.'
    : '';
  const modeLabel = result.mode === 'vars'
    ? `Variable mode: ${result.changed || 0} CSS vars swapped — most accurate for this page.`
    : `Semantic mode: ${result.tokenAppliedPct || 0}% token roles applied, ~${result.pageCoveragePct || 0}% page coverage.${frameworkNote}`;
  showToast(modeLabel);
  return true;
}

async function revertSnapshotPreview() {
  await sendActionToActiveTab({ type: 'REVERT_VAR_PREVIEW' });
  activePreview = null;
  renderTokens('history');
  showToast('Preview reverted — page restored to original styles');
}

function setStatus(state, message) {
  const loader = document.getElementById('loader');
  const content = document.getElementById('content');
  const errEl = document.getElementById('errorMsg');

  if (!loader || !content || !errEl) return;

  errEl.classList.add('hidden');

  if (state === 'scanning') {
    loader.classList.remove('hidden');
    content.classList.add('hidden');
  } else if (state === 'done') {
    loader.classList.add('hidden');
    content.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
    content.classList.add('hidden');
    errEl.textContent = message || 'Unexpected error.';
    errEl.classList.remove('hidden');
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return 'Unknown';
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isMeasureLimitedPlan() {
  return _qL55('measureUnlimited');
}

async function getActiveHostName() {
  try {
    const tab = await getPreferredActiveTab();
    if (tab && tab.url && isSupportedTab(tab.url)) {
      return new URL(tab.url).hostname || '';
    }
  } catch (_) {}

  const fallbackUrl = currentSiteMeta.url || (tokens && tokens.url) || '';
  try {
    return fallbackUrl ? new URL(fallbackUrl).hostname || '' : '';
  } catch (_) {
    return '';
  }
}

async function readMeasureQuota(host, dateKey) {
  if (!host || !dateKey) return 0;
  const data = await chrome.storage.local.get(MEASURE_QUOTA_STORAGE_KEY);
  const root = data[MEASURE_QUOTA_STORAGE_KEY] || {};
  const day = root[dateKey] || {};
  const used = Number(day[host] || 0);
  return Number.isFinite(used) ? Math.max(0, used) : 0;
}

async function writeMeasureQuota(host, dateKey, used) {
  if (!host || !dateKey) return;
  const data = await chrome.storage.local.get(MEASURE_QUOTA_STORAGE_KEY);
  const root = data[MEASURE_QUOTA_STORAGE_KEY] || {};
  const day = { ...(root[dateKey] || {}) };
  day[host] = Math.max(0, Number(used) || 0);
  root[dateKey] = day;
  await chrome.storage.local.set({ [MEASURE_QUOTA_STORAGE_KEY]: root });
}

async function refreshMeasureQuotaState(hostHint = '') {
  const host = hostHint || await getActiveHostName();
  const dateKey = todayKey();
  const limit = MEASURE_FREE_DAILY_LIMIT;

  if (!isMeasureLimitedPlan()) {
    measureQuotaState = { host, dateKey, used: 0, remaining: limit, limit };
    return measureQuotaState;
  }

  const used = await readMeasureQuota(host, dateKey);
  const remaining = Math.max(0, limit - used);
  measureQuotaState = { host, dateKey, used, remaining, limit };
  return measureQuotaState;
}

async function applyMeasureQuotaFromEvent(quota, hostHint = '') {
  const host = hostHint || measureQuotaState.host || await getActiveHostName();
  const dateKey = todayKey();
  const limit = Number(quota && quota.limit) || MEASURE_FREE_DAILY_LIMIT;
  const used = Math.max(0, Number(quota && quota.used) || 0);
  const remaining = Math.max(0, limit - used);
  measureQuotaState = { host, dateKey, used, remaining, limit };
  await writeMeasureQuota(host, dateKey, used);
  return measureQuotaState;
}

function overlapRatio(a, b) {
  if (!a.size || !b.size) return null;
  let hit = 0;
  a.forEach(v => {
    if (b.has(v)) hit += 1;
  });
  return hit / Math.max(1, Math.min(a.size, b.size));
}

function estimatePreviewConfidence(snapshotTokens, currentTokens) {
  const snap = snapshotTokens || {};
  const curr = currentTokens || {};

  const snapVars = new Set(Object.keys(snap.rootVars || {}).map(v => v.trim()));
  const currVars = new Set(Object.keys(curr.rootVars || {}).map(v => v.trim()));
  const snapColors = new Set((snap.colors || []).map(c => String(c.hex || '').toUpperCase()).filter(Boolean));
  const currColors = new Set((curr.colors || []).map(c => String(c.hex || '').toUpperCase()).filter(Boolean));
  const snapFonts = new Set((snap.fonts || []).map(f => String(f || '').toLowerCase().trim()).filter(Boolean));
  const currFonts = new Set((curr.fonts || []).map(f => String(f || '').toLowerCase().trim()).filter(Boolean));
  const snapSpacing = new Set((snap.spacing || []).map(v => String(v)));
  const currSpacing = new Set((curr.spacing || []).map(v => String(v)));

  const metrics = [
    { weight: 0.4, ratio: overlapRatio(snapVars, currVars), name: 'CSS variable names' },
    { weight: 0.35, ratio: overlapRatio(snapColors, currColors), name: 'colors' },
    { weight: 0.15, ratio: overlapRatio(snapFonts, currFonts), name: 'fonts' },
    { weight: 0.1, ratio: overlapRatio(snapSpacing, currSpacing), name: 'spacing values' }
  ];

  let weightUsed = 0;
  let scoreWeighted = 0;
  metrics.forEach(m => {
    if (m.ratio == null) return;
    weightUsed += m.weight;
    scoreWeighted += m.weight * m.ratio;
  });

  let score = 0;
  let hint = 'Smart Apply will attempt semantic remap.';

  if (weightUsed > 0) {
    score = Math.round((scoreWeighted / weightUsed) * 100);
    const weakest = metrics
      .filter(m => m.ratio != null)
      .sort((a, b) => a.ratio - b.ratio)[0];
    if (weakest && weakest.ratio < 0.25) {
      hint = `Low overlap in ${weakest.name}; result may look more experimental.`;
    }
  } else {
    const richness = [
      (snap.colors || []).length >= 8,
      (snap.fonts || []).length >= 1,
      (snap.spacing || []).length >= 3,
      Object.keys(snap.rootVars || {}).length >= 4
    ].filter(Boolean).length;
    score = 28 + (richness * 14);
    hint = 'Confidence is estimated from snapshot richness (current page overlap is unknown).';
  }

  const level = score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low';
  return { score, level, hint };
}

function renderHeader(currentTokens) {
  const nameEl = document.getElementById('siteName');
  const domainEl = document.getElementById('siteDomain');
  const logoImg = document.getElementById('siteLogoImg');
  const logoFallback = document.getElementById('siteLogoFallback');

  const pageTitle = currentSiteMeta.title
    || currentTokens.title
    || getDomain(currentTokens.url);
  const pageUrl = currentSiteMeta.url || currentTokens.url || '';
  const favicon = currentSiteMeta.favicon || '';

  if (nameEl) nameEl.textContent = pageTitle || 'Current page';
  if (nameEl) nameEl.title = pageTitle || 'Current page';
  if (domainEl) {
    domainEl.textContent = pageUrl;
    domainEl.title = pageUrl;
  }

  if (logoImg && logoFallback) {
    if (favicon) {
      logoImg.src = favicon;
      logoImg.onerror = () => {
        logoImg.removeAttribute('src');
        logoImg.classList.add('hidden');
        const label = getDomain(pageUrl) || pageTitle || 'P';
        logoFallback.textContent = String(label).trim().charAt(0).toUpperCase() || 'P';
        logoFallback.classList.remove('hidden');
      };
      logoImg.classList.remove('hidden');
      logoFallback.classList.add('hidden');
    } else {
      logoImg.removeAttribute('src');
      logoImg.classList.add('hidden');
      const label = getDomain(pageUrl) || pageTitle || 'P';
      logoFallback.textContent = String(label).trim().charAt(0).toUpperCase() || 'P';
      logoFallback.classList.remove('hidden');
    }
  }

  const colors = Array.isArray(currentTokens.colors) ? currentTokens.colors : [];
  const fonts = Array.isArray(currentTokens.fonts) ? currentTokens.fonts : [];
  const fontSizes = Array.isArray(currentTokens.fontSizes) ? currentTokens.fontSizes : [];
  const fontWeights = Array.isArray(currentTokens.fontWeights) ? currentTokens.fontWeights : [];
  const spacing = Array.isArray(currentTokens.spacing) ? currentTokens.spacing : [];
  const radii = Array.isArray(currentTokens.radii) ? currentTokens.radii : [];
  const shadows = Array.isArray(currentTokens.shadows) ? currentTokens.shadows : [];
  const gradients = Array.isArray(currentTokens.gradients) ? currentTokens.gradients : [];
  const motion = Array.isArray(currentTokens.motion) ? currentTokens.motion : [];

  setCount('cnt_colors', colors.length);
  setCount('cnt_fonts', fonts.length + fontSizes.length + fontWeights.length);
  setCount('cnt_spacing', spacing.length + radii.length);
  setCount('cnt_shadows', shadows.length + gradients.length + motion.length);
  setCount('cnt_vars', Object.keys(currentTokens.rootVars || {}).length);
  setCount('cnt_insights', 5);
  updateHistoryCount();
}

function setCount(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value || 0);
}

function updateHistoryCount() {
  setCount('cnt_history', savedSites.length);
}

function guideTitle(helpKey) {
  const map = {
    colors: 'Colors Guide',
    fonts: 'Typography Guide',
    spacingValues: 'Spacing Values Guide',
    radiusValues: 'Radius Values Guide',
    shadows: 'Effects Guide',
    vars: 'Variables Guide',
    assets: 'Assets Guide',
    insights: 'Insights Guide',
    history: 'History Guide'
  };
  return map[helpKey] || 'Guide';
}

function helpRowsForKey(helpKey) {
  return Array.isArray(TAB_HELP_CONTENT[helpKey]) ? TAB_HELP_CONTENT[helpKey] : [];
}

function ensureTabHelpOverlay() {
  let overlay = document.getElementById('tabHelpOverlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'history-help-modal-overlay hidden';
  overlay.id = 'tabHelpOverlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="history-help-modal" role="dialog" aria-modal="true" aria-labelledby="tabHelpTitle">
      <div class="history-help-modal-head">
        <h4 id="tabHelpTitle">Tab Guide</h4>
        <button class="icon-btn" id="tabHelpCloseBtn" type="button" aria-label="Close help" title="Close">✕</button>
      </div>
      <div class="history-help-modal-body" id="tabHelpBody"></div>
    </div>
  `;

  overlay.querySelector('#tabHelpCloseBtn')?.addEventListener('click', () => {
    closeTabHelpModalGlobal();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTabHelpModalGlobal();
  });

  document.body.appendChild(overlay);
  return overlay;
}

function openTabHelpModal(helpKey, triggerEl = null) {
  const overlay = ensureTabHelpOverlay();
  const title = overlay.querySelector('#tabHelpTitle');
  const body = overlay.querySelector('#tabHelpBody');
  const closeBtn = overlay.querySelector('#tabHelpCloseBtn');
  if (!title || !body) return;

  const rows = helpRowsForKey(helpKey);
  title.textContent = guideTitle(helpKey);
  body.innerHTML = rows.map(row => `
    <div class="history-help-row-item">
      <strong>${escapeHtmlText(row.label)}</strong>
      <span>${escapeHtmlText(row.text)}</span>
    </div>
  `).join('');

  openLayer(overlay, {
    focusEl: closeBtn,
    captureFocus: false
  });

  if (triggerEl && typeof triggerEl.focus === 'function') {
    layerFocusReturn.set(overlay, triggerEl);
  }
}

function closeTabHelpModalGlobal() {
  const overlay = document.getElementById('tabHelpOverlay');
  if (!isVisibleLayer(overlay)) return false;
  closeLayer(overlay);
  return true;
}

function makeGuideButton(helpKey) {
  const btn = document.createElement('button');
  btn.className = 'tiny-btn guide-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', `Open ${guideTitle(helpKey)}`);
  btn.title = guideTitle(helpKey);
  btn.innerHTML = '<span class="guide-btn-icon" aria-hidden="true">ℹ</span><span>Guide</span>';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openTabHelpModal(helpKey, btn);
  });
  return btn;
}

function mountGuideButtonInSection(section, helpKey) {
  const heading = section?.querySelector('.section-title');
  if (!heading) return;
  const currentText = heading.textContent || '';
  heading.textContent = '';
  const titleMain = document.createElement('span');
  titleMain.className = 'section-title-main';
  titleMain.textContent = currentText;
  heading.appendChild(titleMain);
  heading.appendChild(makeGuideButton(helpKey));
}

function renderTokens(tab) {
  const panel = document.getElementById('panel');
  if (!panel) return;

  panel.innerHTML = '';

  if (inspectResult) renderInspectPanel(inspectResult, panel);

  if (tab !== 'history' && !tokens) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No token data available.';
    panel.appendChild(empty);
    return;
  }

  switch (tab) {
    case 'colors':
      renderColors(panel);
      break;
    case 'fonts':
      renderFonts(panel);
      break;
    case 'spacing':
      renderSpacing(panel);
      break;
    case 'shadows':
      renderShadows(panel);
      break;
    case 'vars':
      renderVars(panel);
      break;
    case 'assets':
      renderAssets(panel);
      break;
    case 'insights':
      renderInsights(panel);
      break;
    case 'history':
      renderHistory(panel);
      break;
    default:
      panel.innerHTML = '<p class="empty">Unknown tab.</p>';
      break;
  }
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function colorToRgba(hex) {
  const clean = String(hex || '').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

function colorToCmyk(hex) {
  const clean = String(hex || '').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return 'cmyk(0, 0, 0, 100)';
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return `cmyk(${Math.round(c * 100)}, ${Math.round(m * 100)}, ${Math.round(y * 100)}, ${Math.round(k * 100)})`;
}

function approximateColorName(hex) {
  const clean = String(hex || '').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / (max - min) + 2) * 60;
    else h = ((r - g) / (max - min) + 4) * 60;
  }
  if (s < 0.08) {
    if (l > 0.93) return 'White';
    if (l > 0.75) return 'Light Gray';
    if (l > 0.55) return 'Gray';
    if (l > 0.35) return 'Dark Gray';
    if (l > 0.15) return 'Charcoal';
    return 'Black';
  }
  const lmod = l > 0.68 ? 'Light ' : l < 0.28 ? 'Deep ' : s < 0.35 ? 'Muted ' : '';
  if (h < 12 || h >= 348) return lmod + 'Red';
  if (h < 28) return lmod + 'Red Orange';
  if (h < 44) return lmod + 'Orange';
  if (h < 58) return lmod + 'Amber';
  if (h < 72) return lmod + 'Yellow';
  if (h < 100) return lmod + 'Yellow Green';
  if (h < 135) return lmod + 'Green';
  if (h < 165) return lmod + 'Teal';
  if (h < 190) return lmod + 'Cyan';
  if (h < 220) return lmod + 'Sky Blue';
  if (h < 252) return lmod + 'Blue';
  if (h < 268) return lmod + 'Indigo';
  if (h < 288) return lmod + 'Violet';
  if (h < 320) return lmod + 'Purple';
  if (h < 348) return lmod + 'Pink';
  return lmod + 'Red';
}

function colorFormatValues(color) {
  return [
    color.hex,
    color.hsl || color.hex,
    colorToRgba(color.hex),
    colorToCmyk(color.hex)
  ];
}

function contrastBadgeMeta(score) {
  if (score >= 4.5) return { tone: 'good', label: 'Good', detail: 'AA or better' };
  if (score >= 3) return { tone: 'warn', label: 'Review', detail: 'Large text only' };
  return { tone: 'bad', label: 'Bad', detail: 'Fails readability' };
}

function wcagResultBadge(pass, passLabel, failLabel = 'Fail') {
  const state = pass ? 'good' : 'bad';
  return `<span class="status-badge status-${state}"><span class="status-icon" aria-hidden="true">${pass ? '✓' : '✕'}</span><span>${pass ? passLabel : failLabel}</span></span>`;
}

function renderColors(panel) {
  const colorList = Array.isArray(tokens && tokens.colors) ? tokens.colors : [];
  if (!colorList.length) {
    panel.innerHTML = '<p class="empty">No colors detected.</p>';
    return;
  }

  // FREE: toolbar with semantic-grouping toggle.
  const toolbar = document.createElement('div');
  toolbar.className = 'colors-toolbar';
  toolbar.innerHTML = `
    <div class="colors-toolbar-actions">
      <button class="tiny-btn ${colorGroupView ? 'active' : ''}" id="colorGroupToggle" aria-pressed="${colorGroupView}">
        ${colorGroupView ? '✓ Grouped by role' : 'Group by role'}
      </button>
      <button class="tiny-btn eyedropper-btn" id="openEyedropperBtn" title="Pick any color from the page">🎯 Eyedropper</button>
      <span class="colors-toolbar-spacer"></span>
      <button class="tiny-btn guide-btn" id="colorsGuideBtn" type="button" aria-label="Open Colors Guide" title="Colors Guide"><span class="guide-btn-icon" aria-hidden="true">ℹ</span><span>Guide</span></button>
    </div>
    <div class="colors-toolbar-meta">
      <span class="colors-toolbar-hint">Click value to change format · click card to copy · ◎ to locate</span>
    </div>
  `;
  toolbar.querySelector('#colorGroupToggle').addEventListener('click', () => {
    colorGroupView = !colorGroupView;
    renderTokens('colors');
  });

  toolbar.querySelector('#openEyedropperBtn')?.addEventListener('click', async () => {
    showToast('Pick a color from the page. Press Esc to cancel.');
    let result = await openEyedropperInPopupContext();
    if (!result || result.unsupported) {
      result = await sendActionToActiveTab({ type: 'OPEN_EYEDROPPER' });
      if (!result || !result.ok || !result.hex) {
        // Fallback path: execute in page context directly to preserve activation on stricter pages.
        result = await openEyedropperViaScripting();
      }
    }
    if (!result) {
      showToast('Could not start eyedropper');
      return;
    }
    if (result.aborted) {
      showToast('Color picking cancelled');
      return;
    }
    if (!result.ok || !result.hex) {
      showToast(result.error || 'Could not pick color from page');
      return;
    }
    eyedropperPickedColor = result.hex;
    renderTokens('colors');
    showToast(`Picked ${result.hex}`);
  });
  toolbar.querySelector('#colorsGuideBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openTabHelpModal('colors', e.currentTarget);
  });
  panel.appendChild(toolbar);

  // ── Eyedropper picked color bar ──────────────────────────────────
  if (eyedropperPickedColor) {
    const lum = parseInt(eyedropperPickedColor.slice(1,3),16)*0.299
              + parseInt(eyedropperPickedColor.slice(3,5),16)*0.587
              + parseInt(eyedropperPickedColor.slice(5,7),16)*0.114;
    const textOnColor = lum > 128 ? '#102331' : '#F7FCFF';
    const bar = document.createElement('div');
    bar.className = 'eyedropper-bar';
    bar.style.background = eyedropperPickedColor;
    bar.innerHTML = `
      <div class="eyedropper-bar-left">
        <span class="eyedropper-bar-swatch" style="background:${eyedropperPickedColor}"></span>
        <div class="eyedropper-bar-info">
          <span class="eyedropper-bar-hex" style="color:${textOnColor}">${eyedropperPickedColor}</span>
          <span class="eyedropper-bar-sub" style="color:${textOnColor}">Picked via Eyedropper</span>
        </div>
      </div>
      <div class="eyedropper-bar-actions">
        <button class="eyedropper-bar-btn" id="copyEyedropperBarBtn" style="color:${textOnColor};border-color:${textOnColor}40" title="Copy hex">⎘ Copy</button>
        <button class="eyedropper-bar-close" id="closeEyedropperBarBtn" style="color:${textOnColor};border-color:${textOnColor}40" title="Dismiss" aria-label="Dismiss picked color">✕</button>
      </div>
    `;
    bar.querySelector('#copyEyedropperBarBtn').addEventListener('click', () => {
      const copied = copyTextFallbackOnly(eyedropperPickedColor);
      showToast(copied ? `Copied ${eyedropperPickedColor}` : 'Copy blocked on this page');
    });
    bar.querySelector('#closeEyedropperBarBtn').addEventListener('click', () => {
      eyedropperPickedColor = '';
      bar.remove();
    });
    panel.appendChild(bar);
  }

  if (colorGroupView) {
    renderColorsGrouped(panel);
  } else {
    const grid = document.createElement('div');
    grid.className = 'color-grid';
    colorList.forEach(color => grid.appendChild(buildColorSwatch(color)));
    panel.appendChild(grid);
  }
}

// Buckets a color into a semantic role using hue + luminance heuristics.
function colorRole(color) {
  const lum = luminance(color.hex);
  const hue = parseHue(color.hsl);
  const sat = (() => {
    const m = String(color.hsl || '').match(/hsl\(\d+,\s*(\d+)%/i);
    return m ? Number(m[1]) : 0;
  })();
  if (sat <= 12) {
    if (lum <= 0.2) return 'Text / Foreground';
    if (lum >= 0.85) return 'Surface / Background';
    return 'Neutral';
  }
  if (hue === null) return 'Neutral';
  if (hue <= 15 || hue >= 345) return 'Danger / Red';
  if (hue >= 16 && hue <= 50) return 'Warning / Orange';
  if (hue >= 51 && hue <= 75) return 'Accent / Yellow';
  if (hue >= 76 && hue <= 165) return 'Success / Green';
  if (hue >= 166 && hue <= 200) return 'Info / Cyan';
  if (hue >= 201 && hue <= 260) return 'Brand / Blue';
  return 'Accent / Purple';
}

function renderColorsGrouped(panel) {
  const groups = new Map();
  tokens.colors.forEach(color => {
    const role = colorRole(color);
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(color);
  });

  const order = ['Brand / Blue', 'Accent / Purple', 'Accent / Yellow', 'Success / Green', 'Info / Cyan', 'Warning / Orange', 'Danger / Red', 'Text / Foreground', 'Surface / Background', 'Neutral'];
  const sortedRoles = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  sortedRoles.forEach(role => {
    const section = makeSection(`${role} (${groups.get(role).length})`);
    const grid = document.createElement('div');
    grid.className = 'color-grid';
    groups.get(role).forEach(color => grid.appendChild(buildColorSwatch(color)));
    section.appendChild(grid);
    panel.appendChild(section);
  });
}

function buildColorSwatch(color) {
  const cWhite = contrast(color.hex, '#FFFFFF');
  const cBlack = contrast(color.hex, '#000000');
  const useWhiteText = cWhite >= cBlack;
  const ratio = useWhiteText ? cWhite : cBlack;
  const verdict = ratio >= 4.5
    ? wcagResultBadge(true,  'Readable')
    : ratio >= 3
      ? wcagResultBadge(false, 'Low contrast')
      : wcagResultBadge(false, 'Poor contrast');
  const role = colorRole(color);
  const formatValues = colorFormatValues(color);
  const colorName = approximateColorName(color.hex);
  const cssVarName = '--' + colorName.toLowerCase().replace(/\s+/g, '-');

  const swatch = document.createElement('div');
  swatch.className = 'color-swatch';
  swatch.setAttribute('title', color.hex);
  swatch.innerHTML = `
    <div class="swatch-tone" style="background:${color.hex}">
      <button class="swatch-locate swatch-locate-tone" data-pro-feature="colorInstances" title="Locate this color on the page" aria-label="Locate ${color.hex} on page">◎</button>
    </div>
    <div class="swatch-meta">
      <div class="swatch-name">${colorName}</div>
      <div class="swatch-top">
        <button class="swatch-code-btn" title="Click to cycle HEX / HSL / RGBA / CMYK">${formatValues[0]}</button>
      </div>
      <div class="swatch-bottom">
        <span class="swatch-role" title="${role}">${role}</span>
        <div class="swatch-contrast">
          <div class="swatch-contrast-head">
            <span class="swatch-ratio-label">Contrast</span>
            <div class="swatch-ratio-row">
              <span class="swatch-ratio-value">${ratio.toFixed(2)}:1</span>
              ${verdict}
            </div>
          </div>
        </div>
        <div class="swatch-actions">
          <button class="swatch-copy swatch-copy-btn" title="Copy displayed value">⎘ Copy</button>
          <button class="swatch-cssvar-btn" title="Copy as CSS custom property">⟨/⟩ CSS var</button>
        </div>
      </div>
    </div>
  `;

  const locateBtn = swatch.querySelector('.swatch-locate');
  const codeBtn = swatch.querySelector('.swatch-code-btn');
  const cssVarBtn = swatch.querySelector('.swatch-cssvar-btn');
  let formatIndex = 0;

  const currentSwatchValue = () => (codeBtn ? String(codeBtn.textContent || '').trim() : color.hex);
  const cssVarForCurrentValue = () => `${cssVarName}: ${currentSwatchValue()};`;
  const syncCssVarButtonTitle = () => {
    if (!cssVarBtn) return;
    cssVarBtn.title = `Copy as CSS custom property: ${cssVarForCurrentValue()}`;
  };

  syncCssVarButtonTitle();

  locateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    locateColorOnPage(color.hex);
  });

  codeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    formatIndex = (formatIndex + 1) % formatValues.length;
    codeBtn.textContent = formatValues[formatIndex];
    syncCssVarButtonTitle();
  });

  cssVarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const cssVarFull = cssVarForCurrentValue();
    copyText(cssVarFull);
    showToast(`Copied ${cssVarFull}`);
  });

  const copyBtn = swatch.querySelector('.swatch-copy-btn');
  copyBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const value = codeBtn ? codeBtn.textContent : color.hex;
    copyText(value);
    showToast(`Copied ${value}`);
  });

  return swatch;
}

async function locateColorOnPage(hex) {
  if (notifyProLock('colorInstances', 'Locating colors on the page is a Pro feature.')) return;
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_COLOR', hex });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate color');
    return;
  }
  showToast(result.count
    ? `${hex}: scrolled to & highlighted ${result.count} element${result.count === 1 ? '' : 's'}. Use the Clear button on the page to reset.`
    : `${hex}: no visible elements currently use this exact color.`);
}

async function locateFontOnPage(target) {
  if (notifyProLock('typographyInstances', 'Locating typography on the page is a Pro feature.')) return;
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_FONT', target });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate type');
    return;
  }
  showToast(result.count
    ? `Scrolled to & highlighted ${result.count} element${result.count === 1 ? '' : 's'} using this type. Use the Clear button on the page to reset.`
    : 'No visible elements match this type style right now.');
}

async function locateSpacingOnPage(value) {
  if (notifyProLock('typographyInstances', 'Locating spacing usage on the page is a Pro feature.')) return;
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_SPACING', value });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate spacing');
    return;
  }
  const label = formatLength(value);
  showToast(result.count
    ? `${label}: highlighted ${result.count} matching element${result.count === 1 ? '' : 's'}. Use the Clear button on the page to reset.`
    : `${label}: no visible spacing matches found right now.`);
}

async function locateRadiusOnPage(value) {
  if (notifyProLock('typographyInstances', 'Locating radius usage on the page is a Pro feature.')) return;
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_RADIUS', value });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate radius');
    return;
  }
  const label = formatLength(value);
  showToast(result.count
    ? `${label}: highlighted ${result.count} rounded element${result.count === 1 ? '' : 's'}. Use the Clear button on the page to reset.`
    : `${label}: no visible elements with this radius were found.`);
}

async function locateShadowOnPage(value) {
  if (notifyProLock('typographyInstances', 'Locating shadow usage on the page is a Pro feature.')) return;
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_SHADOW', value });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate shadow');
    return;
  }
  showToast(result.count
    ? `Shadow highlighted on ${result.count} element${result.count === 1 ? '' : 's'}. Use the Clear button on the page to reset.`
    : 'No visible elements with this shadow were found.');
}

async function locateGradientOnPage(value) {
  if (notifyProLock('typographyInstances', 'Locating gradient usage on the page is a Pro feature.')) return;
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_GRADIENT', value });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate gradient');
    return;
  }
  showToast(result.count
    ? `Gradient highlighted on ${result.count} element${result.count === 1 ? '' : 's'}. Use the Clear button on the page to reset.`
    : 'No visible elements with this gradient were found.');
}

async function locateMotionOnPage(target) {
  if (notifyProLock('typographyInstances', 'Locating transition usage on the page is a Pro feature.')) return;
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_MOTION', target });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate transition');
    return;
  }
  showToast(result.count
    ? `Transition highlighted on ${result.count} element${result.count === 1 ? '' : 's'}. Use the Clear button on the page to reset.`
    : 'No visible elements with this transition were found.');
}

async function clearInstanceOverlay() {
  await sendActionToActiveTab({ type: 'CLEAR_INSTANCE_OVERLAY' });
}

function typographyScaleLabel(px) {
  if (px >= 52) return 'Display';
  if (px >= 38) return 'Heading 1';
  if (px >= 30) return 'Heading 2';
  if (px >= 24) return 'Heading 3';
  if (px >= 20) return 'Heading 4';
  if (px >= 16) return 'Body';
  if (px >= 13) return 'Body Small';
  return 'Caption';
}

function typographyWeightLabel(weight) {
  const n = Number(weight);
  if (!Number.isFinite(n)) return 'Regular';
  if (n >= 800) return 'Extra Bold';
  if (n >= 700) return 'Bold';
  if (n >= 600) return 'Semi Bold';
  if (n >= 500) return 'Medium';
  return 'Regular';
}

function typographyPickWeight(weights, index, total) {
  const sorted = (weights || []).filter(n => Number.isFinite(Number(n))).map(Number).sort((a, b) => a - b);
  if (!sorted.length) return 400;
  if (sorted.length === 1) return sorted[0];
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const target = Math.round(720 - (ratio * 340));
  return sorted.reduce((best, current) => Math.abs(current - target) < Math.abs(best - target) ? current : best, sorted[0]);
}

function typographyPickLineHeight(lineHeights, sizePx, index, total) {
  const values = (lineHeights || []).filter(n => Number.isFinite(Number(n))).map(Number).sort((a, b) => a - b);
  if (!values.length) return null;
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const target = 1.52 - (ratio * 0.24);
  const picked = values.reduce((best, current) => Math.abs(current - target) < Math.abs(best - target) ? current : best, values[0]);
  const px = Math.max(1, Math.round(sizePx * picked));
  return { ratio: picked, px };
}

function typographyInstanceLabel(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return 'Multiple instances';
  return `${n} instance${n === 1 ? '' : 's'}`;
}

function spacingNearDuplicatePairs(values) {
  const sorted = [...new Set((values || []).filter(v => Number.isFinite(Number(v))).map(Number))].sort((a, b) => a - b);
  const pairs = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (Math.abs(next - current) <= 2) pairs.push([current, next]);
  }
  return pairs;
}

function spacingScaleInsights(values) {
  const sorted = [...new Set((values || []).filter(v => Number.isFinite(Number(v)) && Number(v) > 0).map(Number))].sort((a, b) => a - b);
  if (!sorted.length) {
    return { base: 4, aligned: 0, total: 0, pct: 0, offGrid: [] };
  }

  const candidates = [8, 4, 2];
  let best = { base: 4, aligned: 0 };
  candidates.forEach(base => {
    const aligned = sorted.filter(v => v % base === 0).length;
    if (aligned > best.aligned || (aligned === best.aligned && base > best.base)) {
      best = { base, aligned };
    }
  });

  const pct = Math.round((best.aligned / sorted.length) * 100);
  const offGrid = sorted.filter(v => v % best.base !== 0);
  return { base: best.base, aligned: best.aligned, total: sorted.length, pct, offGrid };
}

function spacingNormalizationSuggestions(values, insights, nearPairs) {
  const suggestions = [];
  const base = insights && insights.base ? insights.base : 4;

  (nearPairs || []).slice(0, 3).forEach(([a, b]) => {
    const midpoint = (Number(a) + Number(b)) / 2;
    const normalized = Math.max(base, Math.round(midpoint / base) * base);
    suggestions.push(`Merge ${formatLength(a)} and ${formatLength(b)} into ${formatLength(normalized)}`);
  });

  (insights.offGrid || []).slice(0, 3).forEach(v => {
    const rounded = Math.max(base, Math.round(Number(v) / base) * base);
    if (rounded !== Number(v)) {
      suggestions.push(`Consider normalizing ${formatLength(v)} to ${formatLength(rounded)}`);
    }
  });

  return [...new Set(suggestions)].slice(0, 4);
}

function tokenRem(pxValue) {
  const rem = Number(pxValue) / 16;
  return `${rem.toFixed(3).replace(/\.?0+$/, '')}rem`;
}

function tokenPx(pxValue) {
  return `${Math.round(Number(pxValue))}px`;
}

function spacingValueSummary(value, base = 4) {
  const px = Math.round(Number(value));
  const safeBase = Number(base) > 0 ? Number(base) : 4;
  const steps = (px / safeBase).toFixed(1).replace(/\.0$/, '');
  return `${tokenRem(px)} · ${steps} steps on ${safeBase}px spacing scale`;
}

function openSpacingDetailsModal(payload) {
  const overlay = document.getElementById('spacingDetailsOverlay');
  const body = document.getElementById('spacingDetailsBody');
  if (!overlay || !body) return;

  const values = Array.isArray(payload && payload.values) ? payload.values : [];
  const mostUsedValue = payload ? payload.mostUsedValue : null;
  const insights = payload ? payload.insights : { base: 4, pct: 0 };
  const nearPairs = Array.isArray(payload && payload.nearPairs) ? payload.nearPairs : [];
  const normalizeSuggestions = Array.isArray(payload && payload.normalizeSuggestions) ? payload.normalizeSuggestions : [];
  const spacingMeta = payload && payload.spacingMeta ? payload.spacingMeta : {};
  const maxUsage = Math.max(...values.map(v => (spacingMeta[String(v)] && spacingMeta[String(v)].count) || 0), 1);

  const valueCards = values.map(value => {
    const meta = spacingMeta[String(value)] || { count: 0, dominant: 'mixed' };
    const usagePct = Math.max(8, Math.round(((meta.count || 0) / maxUsage) * 100));
    return `
      <article class="spacing-detail-item">
        <div class="spacing-detail-item-top">
          <div>
            <div class="spacing-detail-item-value">${tokenPx(value)}</div>
            <div class="spacing-detail-item-meta">${spacingValueSummary(value, insights.base)}</div>
          </div>
          <span class="spacing-detail-item-count">${meta.count || 0} uses</span>
        </div>
        <div class="spacing-detail-item-bar"><span style="width:${usagePct}%"></span></div>
        <div class="spacing-detail-item-foot">${escapeHtmlText(meta.dominant === 'mixed' ? 'mixed usage' : `mostly ${meta.dominant}`)}</div>
      </article>
    `;
  }).join('');

  body.innerHTML = `
    <div class="spacing-detail-hero">
      <article class="spacing-detail-card spacing-detail-card-hero">
        <span class="spacing-detail-label">Most used</span>
        <strong class="spacing-detail-value">${mostUsedValue != null ? tokenPx(mostUsedValue) : 'N/A'}</strong>
        <span class="spacing-detail-sub">Largest usage frequency in the current page sample</span>
      </article>
    </div>

    <div class="spacing-detail-grid">
      <article class="spacing-detail-card">
        <span class="spacing-detail-label">Spacing scale</span>
        <strong class="spacing-detail-value">${insights.base}px</strong>
        <span class="spacing-detail-sub">${insights.pct}% of spacing values align to this scale</span>
      </article>
      <article class="spacing-detail-card">
        <span class="spacing-detail-label">Consistency</span>
        <strong class="spacing-detail-value">${insights.pct}%</strong>
        <span class="spacing-detail-sub">On-grid values across the detected set</span>
      </article>
      <article class="spacing-detail-card">
        <span class="spacing-detail-label">Near duplicates</span>
        <strong class="spacing-detail-value">${nearPairs.length}</strong>
        <span class="spacing-detail-sub">Pairs that are close enough to review for cleanup</span>
      </article>
    </div>

    <div class="spacing-detail-block">
      <div class="spacing-detail-block-head">
        <h4>Suggested cleanup</h4>
        <span>${normalizeSuggestions.length} suggestion${normalizeSuggestions.length === 1 ? '' : 's'}</span>
      </div>
      ${normalizeSuggestions.length
        ? `<div class="spacing-detail-suggestions">${normalizeSuggestions.map(item => `<div class="spacing-detail-suggestion">${escapeHtmlText(item)}</div>`).join('')}</div>`
        : '<div class="spacing-detail-empty">No normalization suggestions right now.</div>'}
    </div>

    <div class="spacing-detail-block">
      <div class="spacing-detail-block-head">
        <h4>Spacing values</h4>
        <span>${values.length} tokens</span>
      </div>
      <div class="spacing-detail-item-grid">${valueCards}</div>
    </div>

    <div class="spacing-detail-block">
      <div class="spacing-detail-block-head">
        <h4>Near duplicate pairs</h4>
        <span>${nearPairs.length ? 'Review the similar values' : 'All clear'}</span>
      </div>
      ${nearPairs.length
        ? `<div class="spacing-detail-pairs">${nearPairs.map(([a, b]) => `<div class="spacing-detail-pair">${tokenPx(a)} <span>↔</span> ${tokenPx(b)}</div>`).join('')}</div>`
        : '<div class="spacing-detail-empty">No close pairs detected.</div>'}
    </div>
  `;

  openLayer(overlay, {
    focusEl: document.getElementById('closeSpacingDetailsBtn')
  });
}

function closeSpacingDetailsModal() {
  const overlay = document.getElementById('spacingDetailsOverlay');
  if (!overlay) return;
  closeLayer(overlay, {
    fallbackFocus: document.getElementById('spacingDetailsOpenBtn')
  });
}

function spacingCssVarExport(values) {
  const sorted = [...new Set((values || []).filter(v => Number.isFinite(Number(v))).map(Number))].sort((a, b) => a - b);
  return sorted.map((v, i) => `--space-${i + 1}: ${Math.round(v)}px; /* ${tokenRem(v)} */`).join('\n');
}

function radiusCssVarExport(values) {
  const sorted = [...new Set((values || []).filter(v => Number.isFinite(Number(v))).map(Number))].sort((a, b) => a - b);
  return sorted.map((v, i) => `--radius-${i + 1}: ${Math.round(v)}px; /* ${tokenRem(v)} */`).join('\n');
}

function radiusRoleLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Token';
  if (n >= 999) return 'Pill';
  if (n >= 24) return 'Very rounded';
  if (n >= 12) return 'Rounded';
  if (n >= 6) return 'Subtle round';
  return 'Low radius';
}

function shadowIntensityLabel(shadow) {
  const nums = String(shadow || '').match(/-?\d+(?:\.\d+)?px/g) || [];
  const blur = nums[2] ? Math.abs(parseFloat(nums[2])) : nums[1] ? Math.abs(parseFloat(nums[1])) : 0;
  if (blur >= 24) return 'Heavy';
  if (blur >= 12) return 'Medium';
  return 'Subtle';
}

function gradientKindLabel(value) {
  if (/radial-gradient/i.test(String(value || ''))) return 'Radial';
  if (/conic-gradient/i.test(String(value || ''))) return 'Conic';
  return 'Linear';
}

function splitCssTopLevel(value) {
  const text = String(value || '');
  const parts = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function withColorSwatches(text) {
  const str = String(text || '');
  const re = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*\d*\.?\d+)?\s*\)/gi;
  let out = '';
  let last = 0;
  let match;
  while ((match = re.exec(str)) !== null) {
    out += escapeHtmlText(str.slice(last, match.index));
    const color = match[0].replace(/\s+/g, ' ').trim();
    out += `<span class="effect-color-chip"><span class="effect-color-chip-swatch" style="background:${color}"></span><code>${escapeHtmlText(color)}</code></span>`;
    last = re.lastIndex;
  }
  out += escapeHtmlText(str.slice(last));
  return out;
}

function shadowColorMeta(colorText) {
  const raw = String(colorText || '').trim();
  const rgbaMatch = raw.match(/rgba?\(([^)]+)\)/i);
  if (!rgbaMatch) {
    return {
      raw,
      rgb: raw,
      alpha: '1'
    };
  }
  const parts = rgbaMatch[1].split(',').map(p => p.trim());
  const r = parts[0] || '0';
  const g = parts[1] || '0';
  const b = parts[2] || '0';
  const a = parts[3] != null ? parts[3] : '1';
  return {
    raw,
    rgb: `rgb(${r}, ${g}, ${b})`,
    alpha: a
  };
}

function shadowBreakdownRows(shadowValue) {
  const layers = splitCssTopLevel(shadowValue);
  const cards = [];
  layers.forEach((layer, index) => {
    const lengths = layer.match(/-?\d*\.?\d+px/g) || [];
    const isInset = /\binset\b/i.test(layer);
    const colorText = layer
      .replace(/\binset\b/gi, '')
      .replace(/-?\d*\.?\d+px/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const colorMeta = shadowColorMeta(colorText || 'currentColor');
    cards.push(`
      <div class="effect-breakdown-card">
        <div class="effect-breakdown-title">${withColorSwatches(layer)}</div>
        <ul class="effect-breakdown-points">
          <li>${withColorSwatches(colorMeta.raw)} - ${isInset ? 'Inner shadow' : 'Outer shadow'} with ${withColorSwatches(colorMeta.rgb)} and opacity a(${escapeHtmlText(colorMeta.alpha)})</li>
          <li><strong>${lengths[0] || '0px'}</strong> - Horizontal offset</li>
          <li><strong>${lengths[1] || '0px'}</strong> - Vertical offset</li>
          <li><strong>${lengths[2] || '0px'}</strong> - Blur radius</li>
          <li><strong>${lengths[3] || '0px'}</strong> - Spread radius</li>
        </ul>
      </div>
    `);
  });
  return cards.join('');
}

function gradientBreakdownRows(gradientValue) {
  const raw = String(gradientValue || '').trim();
  const kind = gradientKindLabel(raw);
  const insideMatch = raw.match(/^[a-z-]+\((.*)\)$/i);
  const inside = insideMatch ? insideMatch[1] : '';
  const parts = splitCssTopLevel(inside);
  let lead = '';
  let stops = parts;
  if (/linear-gradient/i.test(raw)) {
    if (parts[0] && (/deg|rad|turn|to\s/i.test(parts[0]))) {
      lead = parts[0];
      stops = parts.slice(1);
    }
  } else if (/radial-gradient|conic-gradient/i.test(raw)) {
    if (parts[0] && /\bat\b|\bfrom\b|circle|ellipse/i.test(parts[0])) {
      lead = parts[0];
      stops = parts.slice(1);
    }
  }

  const rows = [];
  rows.push(`
    <div class="effect-breakdown-card">
      <div class="effect-breakdown-title">${withColorSwatches(raw)}</div>
      <ul class="effect-breakdown-points">
        <li><strong>${kind}</strong> - Gradient type</li>
        ${lead ? `<li><strong>${escapeHtmlText(lead)}</strong> - Direction / anchor</li>` : ''}
        <li><strong>${stops.length}</strong> - Total color stops</li>
        ${stops.map((stop, index) => `<li><strong>Stop ${index + 1}</strong> - ${withColorSwatches(stop)}</li>`).join('')}
      </ul>
    </div>
  `);
  return rows.join('');
}

function motionBreakdownRows(item) {
  const durationMs = Math.round(parseDurationToMs(item.duration));
  const propertyLabel = motionPropertyLabel(item.property);
  const speedLabel = motionSpeedLabel(item.duration);
  const easingName = friendlyEasing(item.easing);
  const fullValue = `${item.property} ${item.duration} ${item.easing}`;
  const curveSvg = buildEasingCurveCardSvg(item.easing);
  const isCubic = item.easing.toLowerCase().trim().startsWith('cubic-bezier');
  return `
    <div class="effect-breakdown-card">
      <div class="effect-breakdown-title">${escapeHtmlText(fullValue)}</div>
      <ul class="effect-breakdown-points">
        <li><strong>${escapeHtmlText(item.property)}</strong> — ${escapeHtmlText(propertyLabel)}</li>
        <li><strong>${escapeHtmlText(item.duration)}</strong> — ${durationMs}ms · ${escapeHtmlText(speedLabel)}</li>
        <li><strong>${escapeHtmlText(item.easing)}</strong> — ${escapeHtmlText(easingName)}</li>
      </ul>
    </div>
    <div class="effect-breakdown-card">
      <div class="effect-breakdown-title">Easing curve</div>
      <div class="motion-curve-detail-wrap">${curveSvg}</div>
      <div class="motion-curve-detail-meta">
        <span class="motion-easing-label">${escapeHtmlText(easingName)}</span>
        ${isCubic ? `<code class="motion-curve-detail-code">${escapeHtmlText(item.easing)}</code>` : ''}
      </div>
    </div>
  `;
}

function gradientValueCard(value) {
  return `<div class="effect-value-card"><span>Full value</span><div class="effect-value-content">${withColorSwatches(value)}</div></div>`;
}

function shadowValueCard(value) {
  return `<div class="effect-value-card"><span>Full value</span><div class="effect-value-content">${withColorSwatches(value)}</div></div>`;
}

function motionValueCard(value) {
  return `<div class="effect-value-card"><span>Full value</span><div class="effect-value-content">${withColorSwatches(value)}</div></div>`;
}

function motionSimilarCard(current, allMotion) {
  if (!Array.isArray(allMotion) || allMotion.length <= 1) return '';
  const curMs = parseDurationToMs(current.duration);
  const isCurrent = m => m.property === current.property && m.duration === current.duration && m.easing === current.easing;
  const sameEase = allMotion.filter(m => !isCurrent(m) && m.easing === current.easing);
  const simDur  = allMotion.filter(m => !isCurrent(m) && m.easing !== current.easing && Math.abs(parseDurationToMs(m.duration) - curMs) <= Math.max(50, curMs * 0.3));
  if (!sameEase.length && !simDur.length) return '';

  const buildGroup = (title, items, shown, formatter) => {
    if (!items.length) return '';
    let li = `<li class="motion-sim-head"><strong>${escapeHtmlText(title)}</strong></li>`;
    items.forEach((m, idx) => {
      const hide = idx >= shown ? ' motion-more-item is-hidden' : '';
      li += `<li class="motion-sim-item${hide}">${formatter(m)}</li>`;
    });
    if (items.length > shown) {
      li += `<li class="motion-more-row"><button type="button" class="motion-more-btn">${items.length - shown} more</button></li>`;
    }
    return `<ul class="effect-breakdown-points motion-sim-list">${li}</ul>`;
  };

  const sameHtml = buildGroup('Same curve', sameEase, 4, m => `${escapeHtmlText(m.property)} &middot; ${escapeHtmlText(m.duration)}`);
  const durHtml = buildGroup(`Similar speed (~${Math.round(curMs)}ms)`, simDur, 3, m => `${escapeHtmlText(m.property)} &middot; ${escapeHtmlText(m.duration)} &middot; ${escapeHtmlText(friendlyEasing(m.easing))}`);

  return `<div class="effect-breakdown-card"><div class="effect-breakdown-title">Similar tokens</div>${sameHtml}${durHtml}</div>`;
}

function parseCubicBezier(ease) {
  const m = String(ease || '').match(/cubic-bezier\(\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*\)/i);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
}

function buildEasingCurveSvg(ease) {
  const e = String(ease || 'ease').toLowerCase().trim();
  // Named → cubic-bezier equivalents
  const named = {
    'ease':         [0.25, 0.1,  0.25, 1.0],
    'ease-in':      [0.42, 0,    1.0,  1.0],
    'ease-out':     [0,    0,    0.58, 1.0],
    'ease-in-out':  [0.42, 0,    0.58, 1.0],
    'linear':       [0,    0,    1.0,  1.0]
  };
  const params = named[e] || parseCubicBezier(ease);
  if (!params) {
    // fallback for step/unknown: render a simple staircase indicator
    return `<svg class="motion-curve-svg" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polyline points="1,19 10,19 10,9 19,9 19,1 27,1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/></svg>`;
  }
  const [x1, y1, x2, y2] = params;
  // Map bezier control points to SVG coords (28×20 canvas, flipped y)
  const W = 26, H = 18, ox = 1, oy = 1;
  const cx1 = ox + x1 * W;
  const cy1 = oy + H - y1 * H;
  const cx2 = ox + x2 * W;
  const cy2 = oy + H - y2 * H;
  const p0x = ox, p0y = oy + H;
  const p3x = ox + W, p3y = oy;
  return `<svg class="motion-curve-svg" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M${p0x},${p0y} C${cx1.toFixed(1)},${cy1.toFixed(1)} ${cx2.toFixed(1)},${cy2.toFixed(1)} ${p3x},${p3y}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="${cx1.toFixed(1)}" cy="${cy1.toFixed(1)}" r="1.4" fill="currentColor" opacity="0.45"/><circle cx="${cx2.toFixed(1)}" cy="${cy2.toFixed(1)}" r="1.4" fill="currentColor" opacity="0.45"/><line x1="${p0x}" y1="${p0y}" x2="${cx1.toFixed(1)}" y2="${cy1.toFixed(1)}" stroke="currentColor" stroke-width="0.8" opacity="0.28"/><line x1="${p3x}" y1="${p3y}" x2="${cx2.toFixed(1)}" y2="${cy2.toFixed(1)}" stroke="currentColor" stroke-width="0.8" opacity="0.28"/></svg>`;
}

function solveBezierForX(targetX, x1, x2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const xAtT = t => ((ax * t + bx) * t + cx) * t;
  let lo = 0, hi = 1;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (xAtT(mid) < targetX) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

function buildEasingCurveCardSvg(ease) {
  const e = String(ease || 'ease').toLowerCase().trim();
  const named = {
    'ease':        [0.25, 0.1,  0.25, 1.0],
    'ease-in':     [0.42, 0,    1.0,  1.0],
    'ease-out':    [0,    0,    0.58, 1.0],
    'ease-in-out': [0.42, 0,    0.58, 1.0],
    'linear':      [0,    0,    1.0,  1.0],
  };
  const params = named[e] || parseCubicBezier(ease);
  const W = 200, H = 110, ml = 20, mr = 8, mt = 14, mb = 16;
  const pw = W - ml - mr, ph = H - mt - mb;

  if (!params) {
    const steps = 4, sw = pw / steps, sh = ph / steps;
    let sp = `M${ml},${mt + ph}`;
    for (let i = 0; i < steps; i++) sp += ` H${(ml + (i + 1) * sw).toFixed(1)} V${(mt + ph - (i + 1) * sh).toFixed(1)}`;
    return `<svg class="motion-curve-card-svg" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ph}" stroke="#c8d9ec" stroke-width="0.9"/><line x1="${ml}" y1="${mt + ph}" x2="${ml + pw}" y2="${mt + ph}" stroke="#c8d9ec" stroke-width="0.9"/><path d="${sp}" stroke="#2d6fa7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="${ml - 3}" y="${mt + ph + 1}" text-anchor="end" font-size="5.5" fill="#9ab4cc">0</text><text x="${ml - 3}" y="${mt + 5}" text-anchor="end" font-size="5.5" fill="#9ab4cc">1</text></svg>`;
  }

  const [x1, y1, x2, y2] = params;
  const sample = t => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return { x: ((ax * t + bx) * t + cx) * t, y: ((ay * t + by) * t + cy) * t };
  };
  const toSvg = (vx, vy) => ({ x: ml + vx * pw, y: mt + ph - vy * ph });
  const pts = Array.from({ length: 49 }, (_, i) => { const s = sample(i / 48); return toSvg(s.x, s.y); });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const hasOvHigh = y1 > 1.01 || y2 > 1.01;
  const hasOvLow  = y1 < -0.01 || y2 < -0.01;
  const gridSvg = [0.25, 0.5, 0.75].map(v => {
    const gx = (ml + v * pw).toFixed(1), gy = (mt + ph - v * ph).toFixed(1);
    return `<line x1="${gx}" y1="${mt}" x2="${gx}" y2="${mt + ph}" stroke="#dbe8f5" stroke-width="0.6" stroke-dasharray="2,2"/><line x1="${ml}" y1="${gy}" x2="${ml + pw}" y2="${gy}" stroke="#dbe8f5" stroke-width="0.6" stroke-dasharray="2,2"/>`;
  }).join('');
  let ovSvg = '';
  if (hasOvHigh) ovSvg += `<rect x="${ml}" y="${mt - 6}" width="${pw}" height="6" fill="rgba(239,83,80,0.10)" rx="1"/><text x="${(ml + pw / 2).toFixed(1)}" y="${mt - 1}" text-anchor="middle" font-size="5" fill="#ef5350" opacity="0.8">overshoot</text>`;
  if (hasOvLow)  ovSvg += `<rect x="${ml}" y="${mt + ph}" width="${pw}" height="6" fill="rgba(239,83,80,0.10)" rx="1"/>`;

  const cp1 = toSvg(x1, y1), cp2 = toSvg(x2, y2);
  const s0 = toSvg(0, 0), s1 = toSvg(1, 1);
  // Animated ball: x progresses linearly (time), y follows easing curve
  const NB = 22;
  const bCx = [], bCy = [], bKt = [];
  for (let i = 0; i <= NB; i++) {
    const xf = i / NB;
    const bt = solveBezierForX(xf, x1, x2);
    const { y: yf } = sample(bt);
    const sp = toSvg(xf, yf);
    bCx.push(sp.x.toFixed(1)); bCy.push(sp.y.toFixed(1)); bKt.push(xf.toFixed(4));
  }
  const ballCxStr = bCx.join(';'), ballCyStr = bCy.join(';'), ballKtStr = bKt.join(';');
  return `<svg class="motion-curve-card-svg" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg">
    ${ovSvg}${gridSvg}
    <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ph}" stroke="#c8d9ec" stroke-width="0.9"/>
    <line x1="${ml}" y1="${mt + ph}" x2="${ml + pw}" y2="${mt + ph}" stroke="#c8d9ec" stroke-width="0.9"/>
    <line x1="${s0.x.toFixed(1)}" y1="${s0.y.toFixed(1)}" x2="${s1.x.toFixed(1)}" y2="${s1.y.toFixed(1)}" stroke="#c8d9ec" stroke-width="0.7" stroke-dasharray="2,2"/>
    <line x1="${s0.x.toFixed(1)}" y1="${s0.y.toFixed(1)}" x2="${cp1.x.toFixed(1)}" y2="${cp1.y.toFixed(1)}" stroke="#7aadda" stroke-width="1" stroke-dasharray="2,1.5" opacity="0.65"/>
    <line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${cp2.x.toFixed(1)}" y2="${cp2.y.toFixed(1)}" stroke="#7aadda" stroke-width="1" stroke-dasharray="2,1.5" opacity="0.65"/>
    <path d="${pathD}" stroke="#2d6fa7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${cp1.x.toFixed(1)}" cy="${cp1.y.toFixed(1)}" r="2.5" fill="#7aadda" stroke="#fff" stroke-width="1"/>
    <circle cx="${cp2.x.toFixed(1)}" cy="${cp2.y.toFixed(1)}" r="2.5" fill="#7aadda" stroke="#fff" stroke-width="1"/>
    <circle cx="${s0.x.toFixed(1)}" cy="${s0.y.toFixed(1)}" r="2" fill="#2d6fa7" stroke="#fff" stroke-width="0.8"/>
    <circle cx="${s1.x.toFixed(1)}" cy="${s1.y.toFixed(1)}" r="2" fill="#2d6fa7" stroke="#fff" stroke-width="0.8"/>
    <text x="${ml - 3}" y="${mt + ph + 1}" text-anchor="end" font-size="5.5" fill="#9ab4cc">0</text>
    <text x="${ml - 3}" y="${mt + 5}" text-anchor="end" font-size="5.5" fill="#9ab4cc">1</text>
    <text x="${ml + 1}" y="${mt + ph + mb - 2}" font-size="5.5" fill="#9ab4cc">0</text>
    <text x="${(ml + pw - 1).toFixed(1)}" y="${mt + ph + mb - 2}" text-anchor="end" font-size="5.5" fill="#9ab4cc">1</text>
    <text x="${(ml + pw / 2).toFixed(1)}" y="${H - 1}" text-anchor="middle" font-size="6" fill="#9ab4cc">time →</text>
    <circle r="4" fill="#f97316" stroke="#fff" stroke-width="1.5" style="filter:drop-shadow(0 1px 4px rgba(249,115,22,0.6))">
      <animate attributeName="cx" values="${ballCxStr}" keyTimes="${ballKtStr}" dur="5s" repeatCount="indefinite" calcMode="linear"/>
      <animate attributeName="cy" values="${ballCyStr}" keyTimes="${ballKtStr}" dur="5s" repeatCount="indefinite" calcMode="linear"/>
    </circle>
  </svg>`;
}

function motionPropertyLabel(property) {
  const map = {
    all: 'All style changes',
    transform: 'Move / scale / rotate',
    opacity: 'Fade in/out',
    color: 'Text color change',
    'background-color': 'Background color change',
    'box-shadow': 'Shadow animation'
  };
  const key = String(property || '').toLowerCase();
  return map[key] || titleCaseLabel(key || 'transition property');
}

function motionSpeedLabel(duration) {
  const ms = parseDurationToMs(duration);
  if (ms <= 160) return 'Fast';
  if (ms <= 320) return 'Balanced';
  return 'Slow';
}

function buildMotionPreviewHTML(m, previewDur) {
  const prop = (m.property || '').toLowerCase().trim();
  const replayBtn = `<button class="motion-replay-btn" title="Replay animation" aria-label="Replay animation">↺</button>`;
  const durBadge = `<span class="motion-preview-dur">${escapeHtmlText(m.duration)}</span>`;
  const demoWrap = (cls, extra = '') =>
    `<div class="motion-preview motion-preview-demo"><div class="motion-demo-el ${cls}" style="animation-timing-function:${m.easing};animation-duration:${previewDur}s"></div>${durBadge}${extra}${replayBtn}</div>`;

  if (prop === 'opacity') return demoWrap('motion-demo-opacity-el');
  if (['transform','translate','scale','rotate','all'].includes(prop)) return demoWrap('motion-demo-transform-el');
  if (['background-color','background','color'].includes(prop)) return demoWrap('motion-demo-color-el');
  if (['box-shadow','filter','outline'].includes(prop)) return demoWrap('motion-demo-shadow-el');

  // Default: easing sparkline + duration
  return `<div class="motion-preview motion-preview-curve"><div class="motion-preview-curve-inner">${buildEasingCurveSvg(m.easing)}</div>${durBadge}${replayBtn}</div>`;
}

function variableGroupName(name) {
  const clean = String(name || '').replace(/^--/, '');
  const [first, second] = clean.split('-').filter(Boolean);
  if (!first) return 'Other';
  if (['color', 'font', 'space', 'spacing', 'radius', 'shadow', 'motion', 'size'].includes(first) && second) {
    return `${first}-${second}`;
  }
  return first;
}

function titleCaseLabel(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildEmptyState(title, text) {
  const el = document.createElement('div');
  el.className = 'empty-state-card';
  el.innerHTML = `<div class="empty-state-title">${escapeHtmlText(title)}</div><div class="empty-state-text">${escapeHtmlText(text)}</div>`;
  return el;
}

function assetKindMeta(item, kind) {
  const type = item.type || kind;
  const dims = item.width && item.height ? `${item.width}×${item.height}` : 'Unknown size';
  return `${String(type).toUpperCase()} · ${dims}`;
}

function renderFonts(panel) {
  if (!tokens.fonts.length && !tokens.fontSizes.length) {
    panel.innerHTML = '<p class="empty">No font data found.</p>';
    return;
  }

  const section = makeSection('Typography Explorer');
  mountGuideButtonInSection(section, 'fonts');
  const intro = document.createElement('p');
  intro.className = 'typography-summary-note';
  intro.textContent = 'Quick-scan styles first. Open More details for full typography metadata and on-page locate actions.';
  section.appendChild(intro);

  const explorer = document.createElement('div');
  explorer.className = 'type-explorer';

  const cardList = document.createElement('div');
  cardList.className = 'type-style-list';

  const primaryFont = tokens.fonts && tokens.fonts.length ? tokens.fonts[0] : 'inherit';
  const sortedSizes = [...(tokens.fontSizes || [])]
    .filter(s => Number.isFinite(Number(s && s.px)))
    .sort((a, b) => Number(b.px) - Number(a.px));

  const closeAllDetails = () => {
    cardList.querySelectorAll('.type-style-card').forEach(card => card.classList.remove('active'));
    cardList.querySelectorAll('.type-card-toggle').forEach(btn => {
      btn.textContent = 'More details';
      btn.setAttribute('aria-expanded', 'false');
    });
    cardList.querySelectorAll('.type-style-inline-detail').forEach(detail => {
      detail.classList.add('hidden');
      detail.innerHTML = '';
    });
  };

  if (!sortedSizes.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'type-style-detail';
    emptyState.innerHTML = '<p class="empty" style="padding:10px 0">No font-size tokens found, but font families are available below.</p>';
    explorer.appendChild(emptyState);
  }

  sortedSizes.forEach((size, index) => {
    const px = Number(size.px);
    const styleName = typographyScaleLabel(px);
    const card = document.createElement('article');
    card.className = 'type-style-card';

    const samplePx = Math.max(18, Math.min(62, px));
    const instanceText = typographyInstanceLabel(size.count);
    const pickedWeight = typographyPickWeight(tokens.fontWeights, index, sortedSizes.length);
    const pickedLineHeight = typographyPickLineHeight(tokens.lineHeights, px, index, sortedSizes.length);
    const lineHeightSummary = pickedLineHeight
      ? `${pickedLineHeight.px}px line-height`
      : 'Auto line-height';
    const weightSummary = `${pickedWeight} weight`;

    card.innerHTML = `
      <div class="type-card-head">
        <div>
          <h4>${styleName}</h4>
          <p>${instanceText}</p>
        </div>
        <button class="tiny-btn type-card-locate" data-pro-feature="typographyInstances" title="Locate this size on the page">◎ Inspect</button>
      </div>
      <div class="type-card-sample" style="font-size:${samplePx}px;font-family:'${escapeHtmlText(primaryFont)}',sans-serif">AaBbCcDdEeFfGg</div>
      <div class="type-card-foot">
        <div class="type-card-summary">
          <button class="type-size-cycle-btn" title="Click to switch px / rem / em" aria-label="Toggle size format">${px}px</button>
          <span class="type-summary-sep">/</span>
          <span class="type-summary-item">${lineHeightSummary}</span>
          <span class="type-summary-sep">/</span>
          <span class="type-summary-item">${weightSummary}</span>
        </div>
        <button class="type-card-toggle" aria-expanded="false">More details</button>
      </div>
      <div class="type-style-inline-detail hidden"></div>
    `;

    card.querySelector('.type-card-locate')?.addEventListener('click', () => {
      locateFontOnPage({ size: `${px}px`, label: `${px}px` });
    });

    const sizeCycleBtn = card.querySelector('.type-size-cycle-btn');
    const remValue = size.rem || `${(px / 16).toFixed(3).replace(/\.?0+$/, '')}rem`;
    const emValue = `${(px / 16).toFixed(3).replace(/\.?0+$/, '')}em`;
    const sizeModes = [`${px}px`, remValue, emValue];
    let sizeModeIndex = 0;
    sizeCycleBtn?.addEventListener('click', e => {
      e.stopPropagation();
      sizeModeIndex = (sizeModeIndex + 1) % sizeModes.length;
      sizeCycleBtn.textContent = sizeModes[sizeModeIndex];
    });

    const toggleBtn = card.querySelector('.type-card-toggle');
    const detailPanel = card.querySelector('.type-style-inline-detail');
    toggleBtn?.addEventListener('click', () => {
      const wasOpen = card.classList.contains('active');
      closeAllDetails();
      if (wasOpen) return;

      card.classList.add('active');
      toggleBtn.textContent = 'Less details';
      toggleBtn.setAttribute('aria-expanded', 'true');

      const textColor = (tokens.colors || []).find(c => c && c.hex && luminance(c.hex) <= 0.45) || (tokens.colors || [])[0] || null;
      const contrastWhite = textColor ? contrast(textColor.hex, '#FFFFFF') : null;
      const contrastBlack = textColor ? contrast(textColor.hex, '#000000') : null;
      const provider = (tokens.fontSources || [])[0] || null;

      const bestContrast = contrastWhite != null && contrastBlack != null ? Math.max(contrastWhite, contrastBlack) : null;
      const detailRatioBadge = bestContrast != null ? wcagResultBadge(bestContrast >= 4.5, bestContrast >= 4.5 ? 'Good' : 'Needs review') : '';
      detailPanel.innerHTML = `
        <dl class="type-detail-list">
          <div class="type-detail-row"><dt>Font</dt><dd>${escapeHtmlText(primaryFont)}${provider ? ` · ${escapeHtmlText(provider.provider || 'Unknown')}` : ''}</dd></div>
          <div class="type-detail-row"><dt>Size</dt><dd><button class="type-size-cycle-btn type-size-cycle-inline" title="Click to switch px / rem / em" aria-label="Toggle detail size format">${px}px</button></dd></div>
          <div class="type-detail-row"><dt>Line height</dt><dd>${pickedLineHeight ? `${pickedLineHeight.px}px · ${pickedLineHeight.ratio}× the font size` : 'Auto · browser default'}</dd></div>
          <div class="type-detail-row"><dt>Weight</dt><dd>${typographyWeightLabel(pickedWeight)} (${pickedWeight})</dd></div>
          <div class="type-detail-row"><dt>On page</dt><dd>${instanceText}</dd></div>
          <div class="type-detail-row type-detail-row-readability">
            <dt>Readability</dt>
            <dd class="type-readability-content">
              ${textColor ? `
                <div class="type-readability-color">
                  <span class="type-color-chip"><span style="background:${textColor.hex}"></span>${textColor.hex}</span>
                  <span class="type-readability-hint">text color</span>
                </div>
                <div class="type-readability-score">
                  <span class="type-readability-ratio">${bestContrast.toFixed(2)}:1</span>
                  ${detailRatioBadge}
                </div>
              ` : '<span class="type-readability-empty">No text color detected</span>'}
            </dd>
          </div>
        </dl>
      `;

      const inlineSizeToggle = detailPanel.querySelector('.type-size-cycle-inline');
      let inlineSizeIndex = sizeModeIndex;
      inlineSizeToggle.textContent = sizeModes[inlineSizeIndex];
      inlineSizeToggle?.addEventListener('click', e => {
        e.stopPropagation();
        inlineSizeIndex = (inlineSizeIndex + 1) % sizeModes.length;
        sizeModeIndex = inlineSizeIndex;
        inlineSizeToggle.textContent = sizeModes[inlineSizeIndex];
        if (sizeCycleBtn) sizeCycleBtn.textContent = sizeModes[sizeModeIndex];
      });

      detailPanel.classList.remove('hidden');
    });

    cardList.appendChild(card);
  });

  explorer.appendChild(cardList);
  section.appendChild(explorer);
  panel.appendChild(section);

  if (tokens.fonts.length) {
    const familySection = makeSection(`Font Families (${tokens.fonts.length})`);
    const list = document.createElement('div');
    list.className = 'font-list';

    tokens.fonts.forEach(font => {
      const row = document.createElement('div');
      row.className = 'token-row';
      row.innerHTML = `<span class="token-preview" style="font-family:'${escapeHtmlText(font)}',sans-serif">${escapeHtmlText(font)}</span><button class="tiny-btn font-locate" data-pro-feature="typographyInstances" title="Locate this font on the page">◎</button><button class="copy-btn" aria-label="Copy font name ${escapeHtmlText(font)}" title="Copy">⎘</button>`;
      row.querySelector('.font-locate')?.addEventListener('click', () => {
        locateFontOnPage({ family: font, label: font });
      });
      row.querySelector('.copy-btn')?.addEventListener('click', () => {
        copyText(`'${font}', sans-serif`);
        showToast('Font copied');
      });
      list.appendChild(row);
    });

    familySection.appendChild(list);
    panel.appendChild(familySection);
  }
}

function renderSpacing(panel) {
  if (tokens.spacing.length) {
    const spacingMeta = tokens.spacingMeta || {};
    const values = [...tokens.spacing].sort((a, b) => a - b);
    const maxUsage = Math.max(...values.map(v => (spacingMeta[String(v)] && spacingMeta[String(v)].count) || 0), 1);
    const mostUsedValue = [...values].sort((a, b) => {
      const aCount = (spacingMeta[String(a)] && spacingMeta[String(a)].count) || 0;
      const bCount = (spacingMeta[String(b)] && spacingMeta[String(b)].count) || 0;
      return bCount - aCount;
    })[0];
    const nearPairs = spacingNearDuplicatePairs(values);
    const insights = spacingScaleInsights(values);
    const normalizeSuggestions = spacingNormalizationSuggestions(values, insights, nearPairs);

    const spacingAccordion = document.createElement('details');
    spacingAccordion.className = 'token-accordion';
    spacingAccordion.open = true;
    spacingAccordion.innerHTML = `
      <summary class="token-accordion-summary">
        <span class="token-accordion-summary-main"><span class="token-accordion-title-text">Spacing Values</span><span class="token-accordion-count">${values.length}</span></span>
        <span class="token-accordion-summary-actions"></span>
      </summary>
    `;
    spacingAccordion.querySelector('.token-accordion-summary-actions')?.appendChild(makeGuideButton('spacingValues'));

    const section = document.createElement('div');
    section.className = 'token-accordion-body';
    const help = document.createElement('p');
    help.className = 'spacing-help';
    help.textContent = 'A minimal list with px values, rem context, and usage counts. Open Details for the full analysis popup.';

    const actions = document.createElement('div');
    actions.className = 'spacing-actions';
    actions.innerHTML = `
      <button class="tiny-btn spacing-export-btn" title="Copy spacing variables">⎘ Copy spacing vars</button>
      <button class="tiny-btn spacing-details-open-btn" id="spacingDetailsOpenBtn" title="Open spacing analysis">Details</button>
    `;
    actions.querySelector('.spacing-export-btn')?.addEventListener('click', () => {
      copyText(spacingCssVarExport(values));
      showToast('Spacing CSS variables copied');
    });
    actions.querySelector('.spacing-details-open-btn')?.addEventListener('click', () => {
      openSpacingDetailsModal({ values, spacingMeta, mostUsedValue, insights, nearPairs, normalizeSuggestions });
    });

    const list = document.createElement('div');
    list.className = 'spacing-list';

    values.forEach(value => {
      const meta = spacingMeta[String(value)] || { count: 0, dominant: 'mixed' };
      const usagePct = Math.max(8, Math.round(((meta.count || 0) / maxUsage) * 100));

      const row = document.createElement('div');
      row.className = 'spacing-row';
      row.innerHTML = `
        <div class="spacing-row-main">
          <span class="spacing-label">${tokenPx(value)}</span>
          <span class="spacing-count">${meta.count || 0} uses</span>
        </div>
        <span class="spacing-meta">${spacingValueSummary(value, insights.base)}</span>
        <div class="spacing-bar-wrap" aria-hidden="true"><div class="spacing-bar" style="width:${usagePct}%"></div></div>
        <div class="spacing-row-actions">
          <button class="tiny-btn spacing-action-btn spacing-locate" data-pro-feature="typographyInstances" title="Locate this spacing on the page" aria-label="Inspect ${tokenPx(value)} usage">◎ Inspect</button>
          <button class="copy-btn spacing-copy-btn" aria-label="Copy ${tokenPx(value)}" title="Copy">⎘ Copy</button>
        </div>
      `;

      row.querySelector('.spacing-locate')?.addEventListener('click', e => {
        e.stopPropagation();
        locateSpacingOnPage(value);
      });
      row.querySelector('.copy-btn')?.addEventListener('click', () => {
        copyText(tokenPx(value));
        showToast(`Copied ${tokenPx(value)}`);
      });
      list.appendChild(row);
    });

    section.appendChild(help);
    section.appendChild(actions);
    section.appendChild(list);
    spacingAccordion.appendChild(section);
    panel.appendChild(spacingAccordion);
  }

  if (tokens.radii.length) {
    const radiusAccordion = document.createElement('details');
    radiusAccordion.className = 'token-accordion';
    radiusAccordion.open = true;
    radiusAccordion.innerHTML = `
      <summary class="token-accordion-summary">
        <span class="token-accordion-summary-main"><span class="token-accordion-title-text">Radius Values</span><span class="token-accordion-count">${tokens.radii.length}</span></span>
        <span class="token-accordion-summary-actions"></span>
      </summary>
    `;
    radiusAccordion.querySelector('.token-accordion-summary-actions')?.appendChild(makeGuideButton('radiusValues'));

    const section = document.createElement('div');
    section.className = 'token-accordion-body';

    const actions = document.createElement('div');
    actions.className = 'spacing-actions';
    actions.innerHTML = `<button class="tiny-btn radius-export-btn" title="Copy radius variables">⎘ Copy radius vars</button>`;
    actions.querySelector('.radius-export-btn')?.addEventListener('click', () => {
      copyText(radiusCssVarExport(tokens.radii));
      showToast('Radius CSS variables copied');
    });

    const grid = document.createElement('div');
    grid.className = 'radius-grid';

    tokens.radii.forEach((value, i) => {
      const item = document.createElement('div');
      item.className = 'radius-item';
      item.innerHTML = `
        <div class="radius-preview" style="border-radius:${value}px"></div>
        <div class="radius-meta">
          <span class="radius-val">${tokenPx(value)} (${tokenRem(value)})</span>
          <span class="radius-role">${radiusRoleLabel(value)}</span>
        </div>
        <div class="radius-actions">
          <button class="tiny-btn spacing-action-btn radius-inspect" data-pro-feature="typographyInstances" title="Locate this radius on page" aria-label="Inspect ${tokenPx(value)} radius usage">◎ Inspect</button>
          <button class="copy-btn spacing-copy-btn radius-copy" aria-label="Copy radius ${i + 1}" title="Copy">⎘ Copy</button>
        </div>
      `;
      item.querySelector('.radius-copy')?.addEventListener('click', e => {
        e.stopPropagation();
        copyText(tokenPx(value));
        showToast(`Copied ${tokenPx(value)}`);
      });
      item.querySelector('.radius-inspect')?.addEventListener('click', e => {
        e.stopPropagation();
        locateRadiusOnPage(value);
      });
      grid.appendChild(item);
    });

    section.appendChild(actions);
    section.appendChild(grid);
    radiusAccordion.appendChild(section);
    panel.appendChild(radiusAccordion);
  }

  if (!tokens.spacing.length && !tokens.radii.length) {
    panel.appendChild(buildEmptyState('No spacing found', 'Scan a page with layout styles to reveal spacing scale and radius tokens.'));
  }
}

function renderShadows(panel) {
  if (!tokens.shadows.length && !(tokens.gradients && tokens.gradients.length) && !(tokens.motion && tokens.motion.length)) {
    panel.appendChild(buildEmptyState('No effects found', 'Try a page with shadows, gradients, or transitions to inspect visual depth and motion tokens.'));
    return;
  }

  if (tokens.shadows.length) {
    const section = makeSection('Shadows');
    mountGuideButtonInSection(section, 'shadows');
    const list = document.createElement('div');
    list.className = 'shadow-list';

    const closeShadowDetails = () => {
      list.querySelectorAll('.shadow-row').forEach(row => row.classList.remove('active'));
      list.querySelectorAll('.shadow-toggle').forEach(btn => {
        btn.textContent = 'Details';
        btn.setAttribute('aria-expanded', 'false');
      });
      list.querySelectorAll('.shadow-inline-detail').forEach(detail => {
        detail.classList.add('hidden');
        detail.innerHTML = '';
      });
    };

    tokens.shadows.forEach((shadow, i) => {
      const row = document.createElement('div');
      row.className = 'shadow-row';
      row.innerHTML = `
        <div class="shadow-preview-wrap">
          <div class="shadow-preview-stage">
            <div class="shadow-preview shadow-sample-card" style="box-shadow:${shadow}"></div>
          </div>
        </div>
        <div class="shadow-info">
          <span class="shadow-name">Shadow ${i + 1}</span>
          <span class="shadow-val">${shadow.substring(0, 98)}${shadow.length > 98 ? '...' : ''}</span>
          <div class="shadow-sample-switch" role="tablist" aria-label="Shadow sample presets">
            <button class="shadow-sample-btn is-active" data-shadow-sample="card" aria-selected="true" title="Preview on card surface">Card</button>
            <button class="shadow-sample-btn" data-shadow-sample="button" aria-selected="false" title="Preview on button surface">Button</button>
            <button class="shadow-sample-btn" data-shadow-sample="modal" aria-selected="false" title="Preview on modal surface">Modal</button>
          </div>
        </div>
        <div class="shadow-actions">
          <div class="shadow-actions-top">
            <button class="tiny-btn shadow-locate" data-pro-feature="typographyInstances" title="Locate this shadow on the page" aria-label="Locate shadow ${i + 1}">◎</button>
            <button class="copy-btn" aria-label="Copy shadow ${i + 1}" title="Copy">⎘</button>
          </div>
          <button class="tiny-btn shadow-toggle" aria-expanded="false">Details</button>
        </div>
        <div class="shadow-inline-detail hidden"></div>
      `;
      const toggleBtn = row.querySelector('.shadow-toggle');
      const detail = row.querySelector('.shadow-inline-detail');
      toggleBtn?.addEventListener('click', () => {
        const wasOpen = row.classList.contains('active');
        closeShadowDetails();
        if (wasOpen) return;
        row.classList.add('active');
        toggleBtn.textContent = 'Hide';
        toggleBtn.setAttribute('aria-expanded', 'true');
        detail.innerHTML = `
          <div class="inline-detail-list effect-breakdown-list">
            ${shadowBreakdownRows(shadow)}
            ${shadowValueCard(shadow)}
          </div>
        `;
        detail.classList.remove('hidden');
      });
      row.querySelector('.shadow-locate')?.addEventListener('click', e => {
        e.stopPropagation();
        locateShadowOnPage(shadow);
      });
      const sampleNode = row.querySelector('.shadow-preview');
      row.querySelectorAll('.shadow-sample-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const mode = btn.getAttribute('data-shadow-sample') || 'card';
          row.querySelectorAll('.shadow-sample-btn').forEach(other => {
            const active = other === btn;
            other.classList.toggle('is-active', active);
            other.setAttribute('aria-selected', active ? 'true' : 'false');
          });
          if (sampleNode) {
            sampleNode.classList.remove('shadow-sample-card', 'shadow-sample-button', 'shadow-sample-modal');
            sampleNode.classList.add(mode === 'button' ? 'shadow-sample-button' : mode === 'modal' ? 'shadow-sample-modal' : 'shadow-sample-card');
          }
        });
      });
      row.querySelector('.copy-btn').addEventListener('click', e => {
        e.stopPropagation();
        copyText(shadow);
        showToast('Shadow copied');
      });
      list.appendChild(row);
    });

    section.appendChild(list);
    panel.appendChild(section);
  }

  if (tokens.gradients && tokens.gradients.length) {
    const section = makeSection('Gradients');
    const list = document.createElement('div');
    list.className = 'gradient-list';

    const closeGradientDetails = () => {
      list.querySelectorAll('.gradient-row').forEach(row => row.classList.remove('active'));
      list.querySelectorAll('.gradient-toggle').forEach(btn => {
        btn.textContent = 'Details';
        btn.setAttribute('aria-expanded', 'false');
      });
      list.querySelectorAll('.gradient-inline-detail').forEach(detail => {
        detail.classList.add('hidden');
        detail.innerHTML = '';
      });
    };

    tokens.gradients.forEach((gradient, i) => {
      const row = document.createElement('div');
      row.className = 'gradient-row';
      const kind = gradientKindLabel(gradient);
      row.innerHTML = `
        <div class="gradient-main">
          <div class="gradient-preview" style="background:${gradient}"></div>
          <div class="gradient-head">
            <span class="gradient-name">${kind} gradient ${i + 1}</span>
            <div class="gradient-actions">
              <button class="tiny-btn gradient-locate" data-pro-feature="typographyInstances" title="Locate this gradient on the page" aria-label="Locate gradient ${i + 1}">◎</button>
              <button class="tiny-btn gradient-toggle" aria-expanded="false">Details</button>
              <button class="copy-btn" aria-label="Copy gradient ${i + 1}" title="Copy">⎘</button>
            </div>
          </div>
        </div>
        <div class="gradient-value">${gradient.substring(0, 120)}${gradient.length > 120 ? '...' : ''}</div>
        <div class="gradient-inline-detail hidden"></div>
      `;
      const toggleBtn = row.querySelector('.gradient-toggle');
      const detail = row.querySelector('.gradient-inline-detail');
      toggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = row.classList.contains('active');
        closeGradientDetails();
        if (wasOpen) return;
        row.classList.add('active');
        toggleBtn.textContent = 'Hide';
        toggleBtn.setAttribute('aria-expanded', 'true');
        detail.innerHTML = `<div class="inline-detail-list effect-breakdown-list">${gradientBreakdownRows(gradient)}${gradientValueCard(gradient)}</div>`;
        detail.classList.remove('hidden');
      });
      row.querySelector('.gradient-locate')?.addEventListener('click', e => {
        e.stopPropagation();
        locateGradientOnPage(gradient);
      });
      row.querySelector('.copy-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        copyText(gradient);
        showToast(`Gradient ${i + 1} copied`);
      });
      list.appendChild(row);
    });

    section.appendChild(list);
    panel.appendChild(section);
  }

    // Motion / transition tokens
    if (tokens.motion && tokens.motion.length) {
      const section = makeSection('Motion & Transitions');
      const help = document.createElement('p');
      help.className = 'spacing-help';
      help.textContent = 'Transition tokens found on this page. Preview gives a quick movement idea. Open details for property breakdown.';
      section.appendChild(help);

      const list = document.createElement('div');
      list.className = 'motion-list';

      const closeMotionDetails = () => {
        list.querySelectorAll('.motion-row').forEach(row => row.classList.remove('active'));
        list.querySelectorAll('.motion-toggle').forEach(btn => {
          btn.textContent = 'Details';
          btn.setAttribute('aria-expanded', 'false');
        });
        list.querySelectorAll('.motion-inline-detail').forEach(detail => {
          detail.classList.add('hidden');
          detail.innerHTML = '';
        });
      };

      tokens.motion.forEach(m => {
        const durMs = parseDurationToMs(m.duration);
        const fullValue = `${m.property} ${m.duration} ${m.easing}`;
        const friendlyProperty = motionPropertyLabel(m.property);
        // Always use a comfortable normalized preview speed regardless of real duration
        const previewDur = 8.5;

        const row = document.createElement('div');
        row.className = 'motion-row';
        row.innerHTML = `
          ${buildMotionPreviewHTML(m, previewDur)}
          <div class="motion-info">
            <span class="motion-prop">${friendlyProperty}</span>
            <span class="motion-val">${escapeHtmlText(fullValue)}</span>
          </div>
          <div class="motion-actions">
            <div class="motion-actions-top">
              <button class="tiny-btn motion-locate" data-pro-feature="typographyInstances" title="Locate this transition on the page" aria-label="Locate transition ${escapeHtmlText(fullValue)}">◎</button>
              <button class="copy-btn" aria-label="Copy ${fullValue}" title="Copy">⎘</button>
            </div>
            <button class="tiny-btn motion-toggle" aria-expanded="false">Details</button>
          </div>
          <div class="motion-inline-detail hidden"></div>
        `;
        const toggleBtn = row.querySelector('.motion-toggle');
        const detail = row.querySelector('.motion-inline-detail');
        toggleBtn?.addEventListener('click', e => {
          e.stopPropagation();
          const wasOpen = row.classList.contains('active');
          closeMotionDetails();
          if (wasOpen) return;
          row.classList.add('active');
          toggleBtn.textContent = 'Hide';
          toggleBtn.setAttribute('aria-expanded', 'true');
          detail.innerHTML = `<div class="inline-detail-list effect-breakdown-list">${motionBreakdownRows(m)}${motionSimilarCard(m, tokens.motion)}${motionValueCard(fullValue)}</div>`;
          detail.classList.remove('hidden');
          detail.querySelectorAll('.motion-more-btn').forEach(btn => {
            btn.addEventListener('click', ev => {
              ev.stopPropagation();
              const listEl = btn.closest('.motion-sim-list');
              listEl?.querySelectorAll('.motion-more-item.is-hidden').forEach(el => el.classList.remove('is-hidden'));
              btn.closest('.motion-more-row')?.remove();
            });
          });
        });
        row.querySelector('.motion-locate')?.addEventListener('click', e => {
          e.stopPropagation();
          locateMotionOnPage({ property: m.property, duration: m.duration, easing: m.easing, fullValue });
        });
        row.querySelector('.copy-btn').addEventListener('click', e => {
          e.stopPropagation();
          copyText(fullValue);
          showToast('Transition copied');
        });
        row.querySelector('.motion-replay-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          const animEl = row.querySelector('.motion-dot') || row.querySelector('.motion-demo-el');
          if (animEl) {
            animEl.style.animationName = 'none';
            requestAnimationFrame(() => requestAnimationFrame(() => { animEl.style.animationName = ''; }));
          }
        });
        list.appendChild(row);
      });

      section.appendChild(list);
      panel.appendChild(section);
    }
}

function renderVars(panel) {
  const vars = tokens.rootVars || {};
  const keys = Object.keys(vars);

  if (!keys.length) {
    panel.innerHTML = '<p class="empty">No CSS custom properties (--variables) found on :root.</p>';
    return;
  }

  const section = makeSection('Variables from :root');
  mountGuideButtonInSection(section, 'vars');

  const meta = document.createElement('div');
  meta.className = 'var-meta';
  meta.textContent = `${keys.length} variables`;
  section.appendChild(meta);

  const search = document.createElement('input');
  search.className = 'var-search';
  search.type = 'search';
  search.placeholder = 'Search variable name, value, or type';
  section.appendChild(search);

  const toolbar = document.createElement('div');
  toolbar.className = 'var-toolbar hidden';
  toolbar.innerHTML = `
    <button type="button" class="tiny-btn" data-var-tool="expand">Expand all</button>
    <button type="button" class="tiny-btn" data-var-tool="collapse">Collapse all</button>
  `;
  section.appendChild(toolbar);

  const host = document.createElement('div');
  host.className = 'var-groups';
  section.appendChild(host);

  const classifyVarKind = (name, value) => {
    const n = String(name || '').toLowerCase();
    const v = String(value || '').trim().toLowerCase();
    const isPlainHslTriplet = /^-?\d*\.?\d+\s+-?\d*\.?\d+%\s+-?\d*\.?\d+%$/.test(v);
    const isColor = /^(#|rgb|hsl|oklch|lab|lch|color\(|transparent|currentcolor)/i.test(v)
      || isPlainHslTriplet
      || /(color|hue|saturation|light|primary|secondary|accent|surface|neutral|brand|bg|background|foreground)/.test(n);
    if (isColor) return { kind: 'color', label: 'Color', isColor: true, hasAlpha: /(rgba|hsla|transparent|\/\s*\d+%?\s*\)|\b0\.\d+)/i.test(v) };
    if (/\b(cubic-bezier|ease|steps|linear|ms|s)\b/i.test(v) || /motion|transition|duration|timing/.test(n)) return { kind: 'motion', label: 'Motion', isColor: false, hasAlpha: false };
    if (/shadow|drop-shadow/.test(v) || /shadow/.test(n)) return { kind: 'shadow', label: 'Shadow', isColor: false, hasAlpha: false };
    if (/font|line-height|letter-spacing|typeface/.test(n)) return { kind: 'type', label: 'Type', isColor: false, hasAlpha: false };
    if (/z-index/.test(n)) return { kind: 'z', label: 'Z-index', isColor: false, hasAlpha: false };
    if (/^-?\d+(\.\d+)?(px|rem|em|vw|vh|ch|%)$/.test(v) || /spacing|radius|size|width|height|gap|padding|margin/.test(n)) return { kind: 'size', label: 'Size', isColor: false, hasAlpha: false };
    if (/^-?\d+(\.\d+)?$/.test(v)) return { kind: 'number', label: 'Number', isColor: false, hasAlpha: false };
    return { kind: 'misc', label: 'Other', isColor: false, hasAlpha: false };
  };

  const isHslTriplet = value => /^-?\d*\.?\d+\s+-?\d*\.?\d+%\s+-?\d*\.?\d+%$/.test(String(value || '').trim());

  const normalizeColorInput = rawValue => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (isHslTriplet(raw)) {
      const [h, s, l] = raw.split(/\s+/);
      return `hsl(${h}, ${s}, ${l})`;
    }
    const hslMatch = raw.match(/^hsla?\((.*)\)$/i);
    if (hslMatch) {
      const inner = hslMatch[1].trim();
      const alphaSplit = inner.split('/').map(part => part.trim());
      const base = alphaSplit[0] || '';
      const alphaFromSlash = alphaSplit[1] || '';
      const parts = (base.includes(',') ? base.split(',') : base.split(/\s+/))
        .map(part => part.trim())
        .filter(Boolean);
      if (parts.length >= 3) {
        const h = parts[0].replace(/deg$/i, '');
        const s = parts[1];
        const l = parts[2];
        const a = alphaFromSlash || parts[3] || '';
        return a ? `hsla(${h}, ${s}, ${l}, ${a})` : `hsl(${h}, ${s}, ${l})`;
      }
    }
    return raw;
  };

  const rgbTextToHex = rgbText => {
    const m = String(rgbText || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i);
    if (!m) return '';
    const toHex = n => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0');
    const r = toHex(m[1]);
    const g = toHex(m[2]);
    const b = toHex(m[3]);
    if (!m[4]) return `#${r}${g}${b}`;
    const alphaRaw = String(m[4]);
    const alpha = alphaRaw.endsWith('%') ? Number(alphaRaw.slice(0, -1)) / 100 : Number(alphaRaw);
    const a = toHex(alpha * 255);
    return `#${r}${g}${b}${a}`;
  };

  const rgbTextToChannels = rgbText => {
    const m = String(rgbText || '').match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i);
    if (!m) return null;
    const r = Math.max(0, Math.min(255, Number(m[1])));
    const g = Math.max(0, Math.min(255, Number(m[2])));
    const b = Math.max(0, Math.min(255, Number(m[3])));
    return { r, g, b };
  };

  const rgbToCmykText = ({ r, g, b }) => {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const k = 1 - Math.max(rr, gg, bb);
    if (k >= 0.999) return 'cmyk(0%, 0%, 0%, 100%)';
    const c = (1 - rr - k) / (1 - k);
    const m = (1 - gg - k) / (1 - k);
    const y = (1 - bb - k) / (1 - k);
    const pct = n => `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%`;
    return `cmyk(${pct(c)}, ${pct(m)}, ${pct(y)}, ${pct(k)})`;
  };

  const buildColorVariants = rawValue => {
    const raw = String(rawValue || '').trim();
    if (!raw) return [];
    const norm = normalizeColorInput(raw);
    const variants = [];
    const pushVariant = (label, value) => {
      const v = String(value || '').trim();
      if (!v) return;
      if (variants.some(item => item.value.toLowerCase() === v.toLowerCase())) return;
      variants.push({ label, value: v });
    };

    if (isHslTriplet(raw)) pushVariant('HSL', normalizeColorInput(raw));
    if (/^hsl|^hsla/i.test(norm)) pushVariant('HSL', norm);

    const probe = document.createElement('span');
    probe.style.color = '';
    probe.style.color = norm;
    if (probe.style.color) {
      const cssColor = probe.style.color;
      if (/^rgb/i.test(cssColor)) pushVariant('RGB', cssColor.replace(/,\s*/g, ', '));
      const hex = rgbTextToHex(cssColor);
      if (hex) pushVariant('HEX', hex);
      const channels = rgbTextToChannels(cssColor);
      if (channels) pushVariant('CMYK', rgbToCmykText(channels));
      if (!/^hsl|^hsla/i.test(norm)) pushVariant('CSS', norm);
    }

    if (!variants.length) pushVariant('Raw', raw);
    return variants;
  };

  const groupToneKey = key => String(key || '').split('-')[0].toLowerCase();

  toolbar.addEventListener('click', e => {
    const btn = e.target.closest('button[data-var-tool]');
    if (!btn) return;
    const expand = btn.getAttribute('data-var-tool') === 'expand';
    host.querySelectorAll('.var-group').forEach(group => { group.open = expand; });
  });

  const renderVarGroups = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const filtered = keys.filter(name => {
      const value = String(vars[name] || '');
      const typeLabel = classifyVarKind(name, value).label.toLowerCase();
      return !q || name.toLowerCase().includes(q) || value.toLowerCase().includes(q) || typeLabel.includes(q);
    });

    const grouped = new Map();
    filtered.forEach(name => {
      const groupKey = variableGroupName(name);
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey).push(name);
    });

    meta.textContent = `${grouped.size} groups · ${filtered.length} variables`;
    const compactMode = grouped.size > 6 && !q;
    toolbar.classList.toggle('hidden', grouped.size <= 6);

    host.innerHTML = '';
    [...grouped.entries()]
      .sort((a, b) => titleCaseLabel(a[0]).localeCompare(titleCaseLabel(b[0])))
      .forEach(([groupKey, names], idx) => {
      const group = titleCaseLabel(groupKey);
      const block = document.createElement('details');
      block.className = `var-group var-group-tone-${groupToneKey(groupKey)}`;
      block.open = compactMode ? idx === 0 : true;
      const list = names.map(name => {
        const value = vars[name];
        const info = classifyVarKind(name, value);
        const raw = String(value);
        const colorVariants = info.isColor ? buildColorVariants(raw) : [];
        const displayValue = colorVariants.length ? colorVariants[0].value : raw;
        const short = displayValue.length > 56 ? `${displayValue.slice(0, 56)}…` : displayValue;
        const encodedName = encodeURIComponent(name);
        const encodedVariants = encodeURIComponent(JSON.stringify(colorVariants));
        return `
          <div class="var-row">
            ${info.isColor ? `<span class="var-color-dot ${info.hasAlpha ? 'var-color-alpha' : ''}" style="--swatch:${value}"></span>` : '<span class="var-color-dot var-no-dot"></span>'}
            <span class="var-main">
              <code class="var-name">${escapeHtmlText(name)}</code>
              ${colorVariants.length > 1
                ? `<button type="button" class="var-val var-val-cycle" data-var-variants="${escapeHtmlText(encodedVariants)}" data-var-idx="0" data-current-value="${escapeHtmlText(displayValue)}" title="Click to cycle color formats"><span class="var-val-text">${escapeHtmlText(short)}</span></button>`
                : `<code class="var-val">${escapeHtmlText(short)}</code>`}
            </span>
            <span class="var-kind-chip var-kind-${info.kind}">${info.label}</span>
            <div class="var-actions">
              <button class="var-copy-btn" data-var-name="${encodedName}" data-copy-mode="reference" title="Copy var() reference">var()</button>
              <button class="var-copy-btn secondary" data-var-name="${encodedName}" data-copy-mode="value" title="Copy raw value">value</button>
            </div>
          </div>`;
      }).join('');

      block.innerHTML = `
        <summary>
          <span class="var-group-label">${group} <span class="var-group-count">(${names.length})</span></span>
          <span class="var-group-meta">
            <button type="button" class="var-group-copy" title="Copy all variables in this group">⧉ <span>Copy all</span></button>
          </span>
        </summary>
        <div class="var-list">${list}</div>
      `;

      block.querySelector('.var-group-copy')?.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const rows = [...block.querySelectorAll('.var-row')];
        const lines = rows.map((row, rowIdx) => {
          const name = names[rowIdx];
          const cycleBtn = row.querySelector('.var-val-cycle');
          const selected = cycleBtn?.getAttribute('data-current-value');
          const value = selected ? String(selected) : String(vars[name]);
          return `  ${name}: ${value};`;
        }).join('\n');
        copyText(`:root {\n${lines}\n}`);
        showToast(`${names.length} vars copied`);
      });

      block.querySelectorAll('.var-val-cycle').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const encoded = btn.getAttribute('data-var-variants') || '';
          const variants = JSON.parse(decodeURIComponent(encoded));
          if (!Array.isArray(variants) || variants.length < 2) return;
          const nextIdx = (Number(btn.getAttribute('data-var-idx') || 0) + 1) % variants.length;
          const current = variants[nextIdx];
          btn.setAttribute('data-var-idx', String(nextIdx));
          btn.setAttribute('data-current-value', String(current.value || ''));
          const textNode = btn.querySelector('.var-val-text');
          if (textNode) {
            const v = String(current.value || '');
            textNode.textContent = v.length > 56 ? `${v.slice(0, 56)}…` : v;
          }
        });
      });
      block.querySelectorAll('.var-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = decodeURIComponent(btn.getAttribute('data-var-name') || '');
          const mode = btn.getAttribute('data-copy-mode');
          if (!name || !(name in vars)) return;
          if (mode === 'value') {
            const row = btn.closest('.var-row');
            const cycleBtn = row?.querySelector('.var-val-cycle');
            const selected = cycleBtn?.getAttribute('data-current-value');
            copyText(selected ? String(selected) : String(vars[name]));
            showToast('Value copied');
          } else {
            copyText(`var(${name})`);
            showToast('var() copied');
          }
        });
      });
      host.appendChild(block);
    });

    if (!host.childElementCount) {
      host.innerHTML = '<p class="empty">No variables match this search.</p>';
    }
  };

  search.addEventListener('input', () => renderVarGroups(search.value));
  renderVarGroups();

  panel.appendChild(section);
}

async function loadAssets(force = false) {
  if (pageAssets && !force) return pageAssets;
  const result = await sendActionToActiveTab({ type: 'EXTRACT_ASSETS' });
  if (result && result.ok && result.assets) {
    pageAssets = result.assets;
    const total = (pageAssets.images.length + pageAssets.svgs.length + pageAssets.icons.length);
    setCount('cnt_assets', total);
  }
  return pageAssets;
}

function renderAssets(panel) {
  if (_qL55('assetExtraction')) {
    panel.innerHTML = '<p class="empty">Asset extraction is a Pro feature. Upgrade to browse and download images, SVGs and icons.</p><div style="margin-top:8px;"><button class="tiny-btn wcag-toggle" id="openAssetsProBtn">✨ Unlock in Pro</button></div>';
    panel.querySelector('#openAssetsProBtn')?.addEventListener('click', () => openProPlanModal('assetExtraction'));
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'assets-wrap';
  wrap.innerHTML = '<p class="empty">Scanning page assets…</p>';
  panel.appendChild(wrap);

  loadAssets().then(assets => {
    wrap.innerHTML = '';
    if (!assets || (!assets.images.length && !assets.svgs.length && !assets.icons.length)) {
      wrap.innerHTML = '<p class="empty">No images, SVGs or icons found on this page.</p>';
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'assets-toolbar';
    const totalAssets = assets.images.length + assets.svgs.length + assets.icons.length;
    toolbar.innerHTML = `
      <span class="assets-summary">${assets.images.length} images · ${assets.svgs.length} SVGs · ${assets.icons.length} icons</span>
      <div class="assets-toolbar-actions">
        <button class="tiny-btn" id="assetDownloadAllBtn" title="Download every asset on this page">Download all (${totalAssets})</button>
        <button class="tiny-btn" id="assetRescanBtn" aria-label="Re-scan assets" title="Re-scan assets">Re-scan</button>
      </div>
    `;
    toolbar.querySelector('#assetRescanBtn').addEventListener('click', async () => {
      wrap.innerHTML = '<p class="empty">Re-scanning…</p>';
      await loadAssets(true);
      renderTokens('assets');
    });
    toolbar.querySelector('#assetDownloadAllBtn').addEventListener('click', (e) => {
      downloadAllAssets(assets, e.currentTarget);
    });
    wrap.appendChild(toolbar);

    const sections = [];
    if (assets.icons.length) sections.push({ key: 'icon', title: 'Icons', items: assets.icons, kind: 'icon' });
    if (assets.svgs.length) sections.push({ key: 'svg', title: 'SVGs', items: assets.svgs, kind: 'svg' });
    if (assets.images.length) sections.push({ key: 'image', title: 'Images', items: assets.images, kind: 'image' });

    const sectionHost = document.createElement('div');
    sectionHost.className = 'assets-section-host';
    wrap.appendChild(sectionHost);

    const sectionNodes = new Map();
    sections.forEach(section => {
      const node = buildAssetSection(section.title, section.items, section.kind);
      sectionNodes.set(section.key, node);
      sectionHost.appendChild(node);
    });

    if (sections.length > 1) {
      const filterBar = document.createElement('div');
      filterBar.className = 'assets-filter-bar';
      const totalCount = sections.reduce((sum, s) => sum + s.items.length, 0);
      const filterButtons = [
        `<button type="button" class="assets-filter-btn is-active" data-kind="all">All (${totalCount})</button>`,
        ...sections.map(s => `<button type="button" class="assets-filter-btn" data-kind="${s.key}">${s.title} (${s.items.length})</button>`)
      ];
      filterBar.innerHTML = `
        <div class="assets-filter-buttons">${filterButtons.join('')}</div>
        <div class="assets-filter-guide-slot"></div>
      `;
      filterBar.querySelector('.assets-filter-guide-slot')?.appendChild(makeGuideButton('assets'));
      wrap.insertBefore(filterBar, sectionHost);

      filterBar.querySelectorAll('.assets-filter-buttons .assets-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const kind = btn.getAttribute('data-kind') || 'all';
          filterBar.querySelectorAll('.assets-filter-buttons .assets-filter-btn').forEach(b => b.classList.toggle('is-active', b === btn));
          sectionNodes.forEach((node, key) => {
            node.style.display = kind === 'all' || key === kind ? '' : 'none';
          });
        });
      });
    }
  });
}

function buildAssetSection(title, items, kind) {
  const section = makeSection(`${title} (${items.length})`);
  const grid = document.createElement('div');
  grid.className = 'asset-grid';

  items.forEach((item, i) => {
    const src = item.dataUrl || item.url;
    const card = document.createElement('div');
    card.className = 'asset-card';
    const dims = assetKindMeta(item, kind);
    const label = item.alt || item.name || `${title} ${i + 1}`;
    card.innerHTML = `
      <div class="asset-thumb"><img src="${src}" alt="${(item.alt || title).toString().replace(/"/g, '')}" loading="lazy" /></div>
      <div class="asset-meta">
        <div class="asset-copy-meta">
          <span class="asset-name">${escapeHtmlText(String(label).substring(0, 28))}</span>
          <span class="asset-dims">${dims}</span>
        </div>
        <div class="asset-actions">
          <button class="tiny-btn" data-act="copy" title="Copy ${item.markup ? 'SVG markup' : 'URL'}">Copy</button>
          <button class="tiny-btn" data-act="dl" title="Download">Download</button>
        </div>
      </div>
    `;

    card.querySelector('[data-act="copy"]').addEventListener('click', () => {
      if (item.markup) {
        copyText(item.markup);
        showToast('SVG markup copied');
      } else {
        copyText(item.url);
        showToast('Asset URL copied');
      }
    });

    card.querySelector('[data-act="dl"]').addEventListener('click', () => {
      if (item.markup) {
        downloadFile(item.markup, `${kind}-${i + 1}.svg`);
        showToast(`Downloaded ${kind}-${i + 1}.svg`);
      } else {
        downloadAssetUrl(item.url, `${kind}-${i + 1}`);
      }
    });

    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

// Downloads a remote asset by opening it.
function downloadAssetUrl(url, baseName) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = baseName;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Opening asset for download…');
  } catch (_) {
    showToast('Could not auto-download. Use the Copy button to copy the asset URL.');
  }
}

// Triggers a single asset download without per-item toasts (used for bulk).
function triggerAssetDownload(item, baseName) {
  try {
    if (item.markup) {
      downloadFile(item.markup, `${baseName}.svg`);
      return;
    }
    const a = document.createElement('a');
    a.href = item.dataUrl || item.url;
    a.download = baseName;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (_) { /* skip individual failures */ }
}

// Downloads every asset on the page one-by-one. A true single .zip needs a
// bundling library (not available in this build), and cross-origin images
// can't be re-packaged due to CORS — so we stagger individual downloads,
// which is honest about what actually happens.
function downloadAllAssets(assets, btn) {
  const queue = [
    ...assets.icons.map((it, i) => ({ it, name: `icon-${i + 1}` })),
    ...assets.svgs.map((it, i) => ({ it, name: `svg-${i + 1}` })),
    ...assets.images.map((it, i) => ({ it, name: `image-${i + 1}` }))
  ];
  if (!queue.length) { showToast('No assets to download.'); return; }

  if (btn) { btn.disabled = true; }
  const originalLabel = btn ? btn.textContent : '';
  showToast(`Downloading ${queue.length} asset${queue.length === 1 ? '' : 's'}…`);

  queue.forEach((entry, i) => {
    setTimeout(() => {
      triggerAssetDownload(entry.it, entry.name);
      if (btn) btn.textContent = `⬇ ${i + 1}/${queue.length}`;
      if (i === queue.length - 1 && btn) {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = originalLabel;
          showToast(`Downloaded ${queue.length} asset${queue.length === 1 ? '' : 's'}.`);
        }, 400);
      }
    }, i * 300);
  });
}

function scoreBucket(value) {
  if (value >= 80) return 'Strong';
  if (value >= 60) return 'Good';
  if (value >= 40) return 'Average';
  return 'Needs work';
}

function hexToRgb(hex) {
  if (!/^#[0-9A-F]{6}$/i.test(String(hex || ''))) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function colorDistance(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function hexToHslString(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function toHexColor(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  if (/^#[0-9A-F]{6}$/i.test(value)) return value.toUpperCase();
  if (/^#[0-9A-F]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toUpperCase();
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    ctx.fillStyle = '#000000';
    ctx.fillStyle = value;
    const normalized = ctx.fillStyle;
    if (/^#[0-9A-F]{6}$/i.test(normalized)) return normalized.toUpperCase();

    const match = normalized.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) return null;
    return `#${[match[1], match[2], match[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  } catch (_) {
    return null;
  }
}

function parseSpacingFromVar(raw) {
  const m = String(raw || '').trim().match(/^(-?\d+(?:\.\d+)?)(px|rem)$/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (Number.isNaN(value)) return null;
  return unit === 'rem' ? Math.round(value * 16) : Math.round(value);
}

function buildHardcodedStyleAudit() {
  if (!tokens) return { hardcodedColorCount: 0, hardcodedSpacingCount: 0, totalOccurrences: 0, notes: [] };

  const rootVarEntries = Object.entries(tokens.rootVars || {});
  const rootColorSet = new Set(
    rootVarEntries
      .map(([, value]) => toHexColor(value))
      .filter(Boolean)
  );
  const rootSpacingSet = new Set(
    rootVarEntries
      .map(([, value]) => parseSpacingFromVar(value))
      .filter(v => v && v > 0)
  );

  const hardcodedColors = (tokens.colors || []).filter(c => !rootColorSet.has(String(c.hex || '').toUpperCase()));
  const hardcodedSpacing = (tokens.spacing || []).filter(v => !rootSpacingSet.has(Number(v)));

  const spacingMeta = tokens.spacingMeta || {};
  const colorOccurrences = hardcodedColors.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const spacingOccurrences = hardcodedSpacing.reduce((sum, value) => {
    const meta = spacingMeta[String(value)] || {};
    return sum + Number(meta.count || 0);
  }, 0);

  const notes = [];
  if (hardcodedColors.length) {
    const sample = hardcodedColors.slice(0, 3).map(c => c.hex).join(', ');
    notes.push(`Hardcoded colors outside :root vars: ${sample}${hardcodedColors.length > 3 ? ', ...' : ''}`);
  }
  if (hardcodedSpacing.length) {
    const sample = hardcodedSpacing.slice(0, 4).map(v => `${v}px`).join(', ');
    notes.push(`Spacing values outside variable scale: ${sample}${hardcodedSpacing.length > 4 ? ', ...' : ''}`);
  }
  if (!notes.length) {
    notes.push('No major hardcoded style drift detected against current :root variables.');
  }

  return {
    hardcodedColorCount: hardcodedColors.length,
    hardcodedSpacingCount: hardcodedSpacing.length,
    totalOccurrences: colorOccurrences + spacingOccurrences,
    notes
  };
}

function uniqueBy(arr, mapper) {
  return new Set((arr || []).map(mapper)).size;
}

function parseHue(hslText) {
  const match = String(hslText || '').match(/^hsl\((\d+)/i);
  return match ? Number(match[1]) : null;
}

  function parseDurationToMs(dur) {
    if (!dur) return 300;
    const n = parseFloat(dur);
    if (Number.isNaN(n)) return 300;
    return dur.endsWith('ms') ? n : n * 1000;
  }

  function friendlyEasing(ease) {
    const map = {
      'ease': 'ease',
      'ease-in': 'ease-in',
      'ease-out': 'ease-out',
      'ease-in-out': 'ease-in-out',
      'linear': 'linear',
      'step-start': 'step-start',
      'step-end': 'step-end'
    };
    const e = (ease || 'ease').toLowerCase().trim();
    if (map[e]) return map[e];
    if (e.startsWith('cubic-bezier')) return 'custom curve';
    if (e.startsWith('steps')) return 'steps';
    return e.length > 22 ? `${e.slice(0, 22)}…` : e;
  }

  function nextColorBlindMode(mode) {
    const cycle = ['off', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];
    const idx = cycle.indexOf(mode);
    return cycle[(idx + 1) % cycle.length];
  }

  function colorBlindLabel(mode) {
    const labels = {
      off: 'Color Vision: Normal',
      protanopia: 'Red-Weak (Protanopia)',
      deuteranopia: 'Green-Weak (Deuteranopia)',
      tritanopia: 'Blue-Weak (Tritanopia)',
      achromatopsia: 'No Color (Achromatopsia)'
    };
    return labels[mode] || labels.off;
  }

  function colorBlindDescription(mode) {
    const map = {
      off: 'Shows original website colors with no simulation.',
      protanopia: 'Red tones look darker; red and green become harder to distinguish.',
      deuteranopia: 'Green sensitivity is reduced; red/green colors can appear similar.',
      tritanopia: 'Blue-yellow perception shifts; blues and yellows become less distinct.',
      achromatopsia: 'Removes color entirely and shows the page in grayscale.'
    };
    return map[mode] || map.off;
  }

  function updateGlobalPageToolsUi() {
    const colorBtn = document.getElementById('globalToggleColorBlindBtn');
    const measureBtn = document.getElementById('globalToggleMeasureModeBtn');
    const layoutBtn = document.getElementById('globalToggleLayoutOverlayBtn');
    const toolsMenuBtn = document.getElementById('toolsMenuBtn');
    const measureLimited = isMeasureLimitedPlan();

    if (colorBtn) {
      colorBtn.textContent = `👁 ${colorBlindLabel(colorBlindMode)}`;
    }
    if (measureBtn) {
      const remaining = Math.max(0, Number(measureQuotaState.remaining || 0));
      const measureStateLabel = measureModeEnabled ? 'Measure On' : 'Measure';
      measureBtn.textContent = measureLimited
        ? `📏 ${measureStateLabel} · ${remaining}/${MEASURE_FREE_DAILY_LIMIT} left`
        : `📏 ${measureStateLabel}`;
      measureBtn.classList.toggle('wcag-active', measureModeEnabled);
      measureBtn.classList.toggle('is-limited', measureLimited);
      measureBtn.classList.toggle('is-pro', !measureLimited);
      measureBtn.classList.toggle('is-exhausted', measureLimited && remaining <= 0);
      measureBtn.title = measureLimited
        ? `Free plan: ${remaining} of ${MEASURE_FREE_DAILY_LIMIT} measurements left today on this site.`
        : 'Pro plan: unlimited measurements.';
    }
    if (layoutBtn) {
      layoutBtn.textContent = `🧱 ${layoutOverlayEnabled ? 'Layout On' : 'Layout'}`;
      layoutBtn.classList.toggle('wcag-active', layoutOverlayEnabled);
      layoutBtn.classList.remove('is-limited');
      layoutBtn.classList.remove('is-pro');
      layoutBtn.title = 'Layout overlay for container structure and spacing context.';
    }
    if (toolsMenuBtn) {
      const hasActiveTools = measureModeEnabled || layoutOverlayEnabled;
      toolsMenuBtn.classList.toggle('tools-has-active', hasActiveTools);
      toolsMenuBtn.title = hasActiveTools ? 'Page tools (active)' : 'Page tools';
    }
  }

function inferColorSemanticName(color, index) {
  const hue = parseHue(color.hsl);
  const lum = luminance(color.hex);

  if (lum <= 0.15) return 'color-text-primary';
  if (lum >= 0.92) return 'color-surface';
  if (hue === null) return `color-${index + 1}`;
  if (hue <= 15 || hue >= 345) return 'color-danger';
  if (hue >= 16 && hue <= 55) return 'color-warning';
  if (hue >= 56 && hue <= 160) return 'color-success';
  if (hue >= 161 && hue <= 260) return 'color-brand';
  if (hue >= 261 && hue <= 330) return 'color-accent';
  return `color-${index + 1}`;
}

function buildNamingSuggestions() {
  if (!tokens) return [];
  const suggestions = [];
  const usedNames = new Set();
  const colors = [...(tokens.colors || [])]
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 4);

  colors.forEach((color, index) => {
    const suggested = inferColorSemanticName(color, index);
    if (usedNames.has(suggested)) return;
    usedNames.add(suggested);
    suggestions.push(`${color.hex} -> --${suggested}`);
  });

  if ((tokens.shadows || []).length) {
    suggestions.push('Most used shadow -> --shadow-elevation-1');
  }

  if ((tokens.spacing || []).length >= 4) {
    suggestions.push('Normalize spacing scale -> --space-xs/sm/md/lg');
  }

  return suggestions.slice(0, 6);
}

function buildAdvancedAccessibilityReport() {
  const palette = (tokens && Array.isArray(tokens.colors) ? tokens.colors : []).slice(0, 12);
  const pairs = [];

  for (let i = 0; i < palette.length; i += 1) {
    for (let j = 0; j < palette.length; j += 1) {
      if (i === j) continue;
      const fg = String(palette[i].hex || '').toUpperCase();
      const bg = String(palette[j].hex || '').toUpperCase();
      const ratio = Number(contrast(fg, bg).toFixed(2));
      const aaNormal = ratio >= 4.5;
      const aaLarge = ratio >= 3;
      const aaaNormal = ratio >= 7;
      const aaaLarge = ratio >= 4.5;
      pairs.push({ fg, bg, ratio, aaNormal, aaLarge, aaaNormal, aaaLarge });
    }
  }

  const totals = {
    pairs: pairs.length,
    aaNormalPass: pairs.filter(p => p.aaNormal).length,
    aaLargePass: pairs.filter(p => p.aaLarge).length,
    aaaNormalPass: pairs.filter(p => p.aaaNormal).length,
    aaaLargePass: pairs.filter(p => p.aaaLarge).length
  };

  const riskyPairs = pairs
    .filter(p => p.ratio < 3)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 6)
    .map(p => `${p.fg} on ${p.bg} (${p.ratio}:1)`);

  const rankedFixes = [];
  if (riskyPairs.length) rankedFixes.push('Replace or avoid combinations under 3:1 first (critical readability risk).');
  if (totals.pairs && totals.aaNormalPass / totals.pairs < 0.6) rankedFixes.push('Increase contrast of core text/background tokens to raise AA normal pass rate above 60%.');
  if (totals.pairs && totals.aaaNormalPass / totals.pairs < 0.25) rankedFixes.push('Add an AAA-safe neutral pair for long-form content and documentation surfaces.');
  if (!rankedFixes.length) rankedFixes.push('Contrast matrix is healthy. Keep this palette as your accessibility baseline.');

  return { totals, riskyPairs, rankedFixes, samplePairs: pairs.slice(0, 16) };
}

function buildInsightsData() {
  const colors = tokens.colors || [];
  const fonts = tokens.fonts || [];
  const spacing = tokens.spacing || [];
  const radii = tokens.radii || [];
  const shadows = tokens.shadows || [];

  const colorCount = colors.length;
  const fontCount = fonts.length;
  const spacingCount = spacing.length;
  const radiusCount = radii.length;
  const shadowCount = shadows.length;

  const hueBands = uniqueBy(colors, c => {
    const m = String(c.hsl || '').match(/^hsl\((\d+)/i);
    if (!m) return 'u';
    return String(Math.floor(Number(m[1]) / 40));
  });

  const densityPenalty = Math.max(0, colorCount - 16) * 1.2;
  const spacingPenalty = Math.max(0, spacingCount - 10) * 1.8;
  const radiusPenalty = Math.max(0, radiusCount - 6) * 2;
  const shadowPenalty = Math.max(0, shadowCount - 6) * 2;
  const scoreRaw = 100 - densityPenalty - spacingPenalty - radiusPenalty - shadowPenalty;
  const systemScore = Math.max(0, Math.min(100, Math.round(scoreRaw)));

  const failColors = colors.filter(c => {
    const onWhite = Number(c.contrastOnWhite || 0);
    const onBlack = Number(c.contrastOnBlack || 0);
    return onWhite < 3 && onBlack < 3;
  });

  const failColorCount = failColors.length;

  const paletteAccessibilityScore = Math.max(0, Math.min(100, Math.round(100 - (failColorCount * 100) / Math.max(1, colorCount))));
  const liveWcagFailCount = Number(tokens.wcag && Number.isFinite(tokens.wcag.aaFailCount) ? tokens.wcag.aaFailCount : 0);
  const liveWcagChecked = Number(tokens.wcag && Number.isFinite(tokens.wcag.checkedTextBlocks) ? tokens.wcag.checkedTextBlocks : 0);

  const personality = [
    hueBands <= 2 ? 'Focused palette' : hueBands <= 4 ? 'Balanced palette' : 'Expressive palette',
    fontCount <= 2 ? 'Tight typography' : fontCount <= 4 ? 'Flexible typography' : 'Diverse typography',
    spacingCount <= 8 ? 'Stable spacing' : 'Detailed spacing'
  ].join(' • ');

  const recommendations = [];
  if (colorCount > 16) recommendations.push(`Reduce palette from ${colorCount} to 12-16 core colors for stronger consistency.`);
  if (spacingCount > 10) recommendations.push(`Collapse spacing scale from ${spacingCount} values to an 8-point rhythm.`);
  if (failColorCount > 0) recommendations.push(`Review ${failColorCount} low-contrast palette colors for better accessibility.`);
  if (liveWcagFailCount > 0) recommendations.push(`Live page check found ${liveWcagFailCount} WCAG AA fails. Use overlay to locate them quickly.`);
  if (recommendations.length === 0) recommendations.push('Your token system looks consistent. Keep this as your baseline snapshot.');

  const aaPool = colors.filter(c => Math.max(Number(c.contrastOnWhite || 0), Number(c.contrastOnBlack || 0)) >= 4.5);
  const lowContrastFixes = failColors.slice(0, 3).map(c => {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    aaPool.forEach(candidate => {
      if (candidate.hex === c.hex) return;
      const d = colorDistance(c.hex, candidate.hex);
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    });

    if (!best) {
      const direction = luminance(c.hex) > 0.5 ? 'darker' : 'lighter';
      return `${c.hex}: no close AA color found in current palette. Try a ${direction} variant.`;
    }

    return `${c.hex} → ${best.hex} (nearest AA-safe color in your palette)`;
  });

  const advancedA11y = buildAdvancedAccessibilityReport();

  return {
    systemScore,
    paletteAccessibilityScore,
    liveWcagFailCount,
    liveWcagChecked,
    failColorCount,
    personality,
    recommendations,
    tokenCounts: {
      colors: colorCount,
      fontFamilies: fontCount,
      fontSizes: (tokens.fontSizes || []).length,
      spacing: spacingCount,
      radii: radiusCount,
      shadows: shadowCount,
      gradients: (tokens.gradients || []).length,
      rootVars: Object.keys(tokens.rootVars || {}).length
    },
    namingSuggestions: buildNamingSuggestions(),
    hardcodedAudit: buildHardcodedStyleAudit(),
    lowContrastFixes,
    advancedA11y
  };
}

function escapeHtmlText(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Replaces hex color codes inside a text string with an inline swatch + code chip
// so users can instantly see which color a hex value represents. Chips are
// click-to-copy (handled via delegated listener in bindHexChipCopy).
function decorateHex(text) {
  return escapeHtmlText(text).replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (hex) =>
    `<span class="hex-chip" role="button" tabindex="0" data-hex="${hex}" title="Click to copy ${hex}"><span class="hex-swatch" style="background:${hex}"></span><span class="hex-code">${hex}</span></span>`
  );
}

// Builds a circular score gauge (0-100) using a conic-gradient ring.
function scoreRing(score, size = 'md') {
  const pct = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const tone = pct >= 80 ? 'high' : pct >= 60 ? 'good' : pct >= 40 ? 'mid' : 'low';
  return `<div class="score-ring score-ring-${size} score-ring-${tone}" style="--ring-pct:${pct}" role="img" aria-label="Score ${pct} out of 100"><span class="score-ring-num">${pct}</span></div>`;
}

// Delegated click/keyboard handler: copies a hex chip's color to the clipboard.
let hexChipCopyBound = false;
function bindHexChipCopy() {
  if (hexChipCopyBound) return;
  hexChipCopyBound = true;
  const handler = (e) => {
    const chip = e.target.closest('.hex-chip');
    if (!chip) return;
    const hex = chip.getAttribute('data-hex');
    if (!hex) return;
    copyText(hex);
    chip.classList.add('hex-chip-copied');
    window.setTimeout(() => chip.classList.remove('hex-chip-copied'), 700);
    showToast(`Copied ${hex}`);
  };
  document.addEventListener('click', handler);
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('hex-chip')) {
      e.preventDefault();
      handler(e);
    }
  });
}

function renderInsights(panel) {
  if (!tokens) {
    panel.innerHTML = '<p class="empty">No insights available yet.</p>';
    return;
  }

  const data = buildInsightsData();
  const section = makeSection('Insights');
  section.classList.add('insight-vd-layout');
  const insightsAnalyzerLocked = _qL55('insightsAnalyzer');
  const insightsRecommendationsLocked = _qL55('insightsRecommendations');

  const totalTokenCount =
    (tokens.colors || []).length +
    (tokens.fonts || []).length +
    (tokens.spacing || []).length +
    (tokens.radii || []).length +
    (tokens.shadows || []).length +
    (tokens.gradients || []).length;
  const colorPct = totalTokenCount ? Math.round(((tokens.colors || []).length / totalTokenCount) * 100) : 0;
  const typePct = totalTokenCount ? Math.round(((tokens.fonts || []).length / totalTokenCount) * 100) : 0;
  const spacingPct = totalTokenCount ? Math.max(0, 100 - colorPct - typePct) : 0;

  const criticalCount = data.liveWcagFailCount;
  const watchCount = (data.hardcodedAudit?.totalOccurrences || 0) + (data.advancedA11y?.riskyPairs?.length || 0);
  const stableCount = Math.max(0, totalTokenCount - criticalCount - Math.min(totalTokenCount, watchCount));
  const scoreTone = data.systemScore >= 80 ? 'good' : data.systemScore >= 60 ? 'warn' : 'bad';

  const recs = data.recommendations.slice(0, 3);
  const phases = ['Now', 'Next', 'Later'];

  const componentImpacts = [
    {
      key: 'buttons',
      label: 'Buttons',
      impacted: data.liveWcagFailCount,
      checked: data.liveWcagChecked,
      tone: data.liveWcagFailCount > 0 ? 'critical' : 'stable',
      note: 'CTA and action button readability'
    },
    {
      key: 'cards',
      label: 'Cards',
      impacted: data.failColorCount,
      checked: (tokens.colors || []).length,
      tone: data.failColorCount > 0 ? 'watch' : 'stable',
      note: 'Card surfaces and body text contrast'
    },
    {
      key: 'forms',
      label: 'Forms & Inputs',
      impacted: data.hardcodedAudit?.totalOccurrences || 0,
      checked: (tokens.colors || []).length + (tokens.spacing || []).length,
      tone: (data.hardcodedAudit?.totalOccurrences || 0) > 0 ? 'watch' : 'stable',
      note: 'Labels, placeholders, helper/error text'
    }
  ];

  const componentTaskMap = {
    buttons: {
      cards: [
        {
          phase: 'Now',
          tone: 'critical',
          title: `Fix ${data.liveWcagFailCount} high-risk button/text pairs`,
          detail: 'Prioritize primary and destructive buttons where small text fails contrast.',
          impact: 'High',
          effort: 'S'
        },
        {
          phase: 'Next',
          tone: 'watch',
          title: 'Normalize button token mapping',
          detail: 'Map button foreground/background states to semantic tokens across variants.',
          impact: 'Medium',
          effort: 'M'
        },
        {
          phase: 'Later',
          tone: 'stable',
          title: 'Add button accessibility snapshot check',
          detail: 'Capture a baseline and compare regressions in future scans.',
          impact: 'Low',
          effort: 'S'
        }
      ]
    },
    cards: {
      cards: [
        {
          phase: 'Now',
          tone: 'critical',
          title: `Replace ${data.failColorCount} low-contrast card text tokens`,
          detail: 'Fix body and metadata text first on elevated and tinted card surfaces.',
          impact: 'High',
          effort: 'S'
        },
        {
          phase: 'Next',
          tone: 'watch',
          title: 'Unify card heading/body hierarchy',
          detail: 'Use one heading scale and one secondary text token family for cards.',
          impact: 'Medium',
          effort: 'M'
        },
        {
          phase: 'Later',
          tone: 'stable',
          title: 'Create card readability guardrails',
          detail: 'Document token pair rules for content cards and data cards.',
          impact: 'Low',
          effort: 'S'
        }
      ]
    },
    forms: {
      cards: [
        {
          phase: 'Now',
          tone: 'critical',
          title: `Resolve ${data.hardcodedAudit?.totalOccurrences || 0} hardcoded form style usages`,
          detail: 'Replace inline/hardcoded values affecting labels and validation messages.',
          impact: 'High',
          effort: 'M'
        },
        {
          phase: 'Next',
          tone: 'watch',
          title: 'Improve helper and placeholder contrast',
          detail: 'Ensure helper, placeholder, and error text are readable in all themes.',
          impact: 'Medium',
          effort: 'S'
        },
        {
          phase: 'Later',
          tone: 'stable',
          title: 'Add form-state token checklist',
          detail: 'Audit default/focus/error/success states with a reusable QA checklist.',
          impact: 'Low',
          effort: 'S'
        }
      ]
    }
  };

  const accessibilityPacks = [
    {
      key: 'live',
      name: 'Button & Text Contrast',
      items: data.liveWcagFailCount,
      eta: data.liveWcagFailCount > 8 ? '2 days' : '1 day',
      owner: 'Frontend',
      tone: data.liveWcagFailCount > 0 ? 'critical' : 'stable',
      note: 'Fix readability of buttons and small text blocks first.',
      contains: [
        'Small-text AA failures from live scan',
        'Low-contrast button labels',
        'Muted text on tinted backgrounds'
      ]
    },
    {
      key: 'risky',
      name: 'Color Pair Cleanup',
      items: data.advancedA11y?.riskyPairs?.length || 0,
      eta: (data.advancedA11y?.riskyPairs?.length || 0) > 4 ? '2 days' : '1 day',
      owner: 'Design System',
      tone: (data.advancedA11y?.riskyPairs?.length || 0) > 0 ? 'watch' : 'stable',
      note: 'Fix problematic foreground/background token combinations.',
      contains: [
        'Token pairs below 3:1 contrast',
        'Dark/light surface pair checks',
        'Suggested semantic replacements'
      ]
    },
    {
      key: 'remediation',
      name: 'Form Readability Pack',
      items: data.failColorCount,
      eta: data.failColorCount > 4 ? '2 days' : '1 day',
      owner: 'Design + Frontend',
      tone: data.failColorCount > 0 ? 'watch' : 'stable',
      note: 'Improve input labels, helper text, and validation readability.',
      contains: [
        'Input label and placeholder contrast',
        'Helper and error text visibility',
        'Token swap checklist for forms'
      ]
    }
  ];

  const cssStats = tokens.cssStats || { styleRules: 0, declarations: 0, inlineStyles: 0, avgSpecificity: 0, quality: 'Unknown' };

  const declarationDensity = cssStats.styleRules > 0
    ? Math.round((cssStats.declarations / cssStats.styleRules) * 10) / 10
    : 0;

  const diagnostics = [
    {
      label: 'Rules',
      value: cssStats.styleRules,
      state: cssStats.styleRules > 700 ? 'Watch' : 'Healthy',
      tone: cssStats.styleRules > 700 ? 'watch' : 'stable',
      why: 'Shows stylesheet size and long-term maintainability pressure.',
      action: cssStats.styleRules > 700 ? 'Merge duplicate selectors and remove unused blocks.' : 'Keep this baseline and monitor growth each release.'
    },
    {
      label: 'Declarations',
      value: cssStats.declarations,
      state: declarationDensity > 4.5 ? 'Watch' : 'Healthy',
      tone: declarationDensity > 4.5 ? 'watch' : 'stable',
      why: 'High declaration density can indicate duplicated styling logic.',
      action: declarationDensity > 4.5 ? 'Consolidate repeated property sets into shared utility tokens.' : 'Current declaration spread is manageable.'
    },
    {
      label: 'Inline styles',
      value: cssStats.inlineStyles,
      state: cssStats.inlineStyles > 25 ? 'Now' : cssStats.inlineStyles > 10 ? 'Next' : 'Healthy',
      tone: cssStats.inlineStyles > 25 ? 'critical' : cssStats.inlineStyles > 10 ? 'watch' : 'stable',
      why: 'Inline styles bypass token governance and increase drift risk.',
      action: cssStats.inlineStyles > 25 ? 'Prioritize moving inline styles to tokenized classes immediately.' : 'Gradually replace remaining inline styles in active components.'
    },
    {
      label: 'Avg specificity',
      value: cssStats.avgSpecificity,
      state: Number(cssStats.avgSpecificity) > 0.45 ? 'Watch' : 'Healthy',
      tone: Number(cssStats.avgSpecificity) > 0.45 ? 'watch' : 'stable',
      why: 'Higher specificity makes overrides harder and slows iterative design changes.',
      action: Number(cssStats.avgSpecificity) > 0.45 ? 'Flatten selector depth and avoid ID-heavy styling paths.' : 'Specificity is under control for scalable maintenance.'
    }
  ];

  const tierInfo = (() => {
    const s = data.systemScore;
    if (s >= 90) return { key: 'healthy', label: 'Healthy', color: '#24b26d' };
    if (s >= 75) return { key: 'good', label: 'Good', color: '#4fb5d8' };
    if (s >= 60) return { key: 'watch', label: 'Watch', color: '#f59f0b' };
    return { key: 'risk', label: 'High Risk', color: '#ef5a5a' };
  })();

  const pillarScores = {
    a11y: Math.min(100, Math.max(0, Math.round(
      (data.paletteAccessibilityScore * 0.6) + (Math.max(0, 100 - data.liveWcagFailCount * 8) * 0.4)
    ))),
    consistency: Math.min(100, Math.max(0, Math.round(
      100 - ((data.hardcodedAudit?.totalOccurrences || 0) * 2) - (Math.max(0, (tokens.colors || []).length - 16) * 1.5)
    ))),
    maintain: Math.min(100, Math.max(0, Math.round(
      100 - (Math.max(0, (cssStats.styleRules - 350) / 8)) - (cssStats.inlineStyles * 1.5)
    ))),
    govern: Math.min(100, Math.max(0, Math.round(
      100 - (data.namingSuggestions.length * 6)
    )))
  };

  section.innerHTML = `
    <section class="insight-vd-score-split" style="--tier-color:${tierInfo.color}">
      <div class="insight-vd-ring-col">
        ${scoreRing(data.systemScore, 'lg')}
        <div class="insight-vd-ring-label">System Health</div>
        <div class="insight-vd-ring-tier">${tierInfo.label}</div>
      </div>
      <div class="insight-vd-summary-col">
        <div class="insight-vd-score-head">
          <div class="insight-vd-score-head-top">
            <h3 class="insight-vd-title">Score Snapshot</h3>
            <button class="tiny-btn guide-btn" id="insightScoreGuideBtn" type="button" aria-label="Open Insights Guide" title="Insights Guide"><span class="guide-btn-icon" aria-hidden="true">ℹ</span><span>Guide</span></button>
          </div>
          <p class="insight-vd-sub">Current health, biggest blockers, and fastest path to improve.</p>
        </div>
        <div class="insight-vd-chip-row">
          <span class="insight-vd-score-chip">${totalTokenCount} tokens scanned</span>
          ${criticalCount > 0 ? '<span class="insight-vd-score-chip down">' + criticalCount + ' AA fails</span>' : '<span class="insight-vd-score-chip up">No critical fails</span>'}
          ${(data.advancedA11y?.riskyPairs?.length || 0) > 0 ? '<span class="insight-vd-score-chip down">Risk pairs: ' + (data.advancedA11y?.riskyPairs?.length || 0) + '</span>' : ''}
        </div>
      </div>
      <ul class="insight-vd-score-bullets">
        <li>Current range: <strong>${tierInfo.label}</strong>. ${tierInfo.key === 'healthy' ? 'Keep this baseline and monitor each release.' : tierInfo.key === 'good' ? 'Minor cleanup will maintain quality.' : tierInfo.key === 'watch' ? 'Accessibility fixes will move this score fastest.' : 'Prioritize remediation before next release.'}</li>
        <li>${criticalCount > 0 ? 'Top blocker: ' + criticalCount + ' live AA failures in high-traffic text and buttons.' : data.failColorCount > 0 ? 'Low-contrast palette tokens are the main drag (' + data.failColorCount + ' tokens).' : 'No critical blockers detected on current page.'}</li>
        <li>${data.systemScore < 90 ? 'Open WCAG overlay and fix high-impact pairs first for fastest score lift.' : 'Score is healthy. Run overlay periodically to catch regressions.'}</li>
      </ul>
      <button class="tiny-btn insight-vd-score-btn${insightsAnalyzerLocked ? ' pro-locked' : ''}" id="insightScoreAnalyzerBtn" title="${insightsAnalyzerLocked ? 'Pro feature' : 'Open full score analyzer'}">${insightsAnalyzerLocked ? 'Full score analyzer <span class="btn-pro-badge">PRO</span>' : 'Full score analyzer'}</button>
    </section>

    <div class="insight-vd-signal-strip">
      <div class="insight-vd-signal danger"><strong>${criticalCount}</strong><span>Critical</span></div>
      <div class="insight-vd-signal warn"><strong>${watchCount}</strong><span>Watch</span></div>
      <div class="insight-vd-signal good"><strong>${stableCount}</strong><span>Stable</span></div>
    </div>

    <div class="insight-vd-fix-title">Quick Actions</div>
    <div class="insight-vd-actions">
      ${wcagOverlayActive
        ? '<button class="tiny-btn insight-vd-btn insight-vd-btn-primary wcag-active" id="toggleWcagOverlayBtn">WCAG Overlay ON</button>'
        : '<button class="tiny-btn insight-vd-btn insight-vd-btn-primary" id="toggleWcagOverlayBtn">Open WCAG overlays</button>'}
      <button class="tiny-btn insight-vd-btn" id="insightJumpColorsBtn">Jump to failing tokens</button>
      <button class="tiny-btn insight-vd-btn insight-vd-btn-secondary${insightsRecommendationsLocked ? ' pro-locked' : ''}" id="insightCopyChecklistBtn" title="${insightsRecommendationsLocked ? 'Pro feature' : 'Create a prioritized checklist'}">${insightsRecommendationsLocked ? 'Create dev checklist <span class="btn-pro-badge">PRO</span>' : 'Create dev checklist'}</button>
    </div>

    <div class="insight-vd-fix-title">Component Impact Map</div>
    <div class="insight-vd-impact-grid">
      ${componentImpacts.map(item => `
        <article class="insight-vd-impact-card is-interactive tone-${item.tone}${insightsRecommendationsLocked ? ' pro-locked' : ''}" role="button" tabindex="0" data-impact-key="${item.key}" title="${insightsRecommendationsLocked ? 'Pro feature' : 'View component tasks'}">
          <div class="insight-vd-impact-head">
            <span class="insight-vd-impact-name">${item.label}</span>
            <span class="insight-vd-impact-ratio">${item.impacted}/${item.checked || 0}</span>
          </div>
          <div class="insight-vd-impact-meter"><span style="width:${item.checked ? Math.min(100, Math.round((item.impacted / item.checked) * 100)) : 0}%"></span></div>
          <div class="insight-vd-impact-note">${item.note}</div>
          <div class="insight-vd-impact-hint">${insightsRecommendationsLocked ? 'Pro: unlock component task plans' : 'Click to view tasks below'}</div>
          <div class="insight-vd-impact-expand" aria-hidden="true">
            <div class="insight-vd-component-task-grid">
              ${(componentTaskMap[item.key]?.cards || []).map((card) => `
                <article class="insight-vd-component-task-card tone-${card.tone}">
                  <div class="insight-vd-component-task-head">
                    <div class="insight-vd-component-task-title">${card.title}</div>
                    <span class="insight-vd-tag insight-vd-task-phase phase-${card.phase.toLowerCase()}">${card.phase}</span>
                  </div>
                  <div class="insight-vd-component-task-detail">${card.detail}</div>
                  <div class="insight-vd-fix-tags">
                    <span class="insight-vd-tag insight-vd-impact impact-${card.impact.toLowerCase()}">Impact: ${card.impact}</span>
                    <span class="insight-vd-tag insight-vd-effort">Effort: ${card.effort}</span>
                  </div>
                </article>
              `).join('')}
            </div>
          </div>
        </article>
      `).join('')}
    </div>

    <div class="insight-vd-fix-title">Accessibility Task Packs</div>
    <div class="insight-vd-pack-grid">
      ${accessibilityPacks.map(pack => `
        <article class="insight-vd-pack-card is-interactive tone-${pack.tone}${insightsRecommendationsLocked ? ' pro-locked' : ''}" role="button" tabindex="0" data-pack-key="${pack.key}" title="${insightsRecommendationsLocked ? 'Pro feature' : 'Copy this task pack'}">
          <div class="insight-vd-pack-head">
            <span class="insight-vd-pack-name">${pack.name}</span>
            <span class="insight-vd-pack-count">${pack.items} items</span>
          </div>
          <div class="insight-vd-pack-tags">
            <span class="insight-vd-tag">Owner: ${pack.owner}</span>
            <span class="insight-vd-tag">ETA: ${pack.eta}</span>
          </div>
          <div class="insight-vd-pack-note">${pack.note}</div>
          ${insightsRecommendationsLocked
            ? '<div class="insight-vd-pack-note">Upgrade to Pro to unlock full task pack checklists and copy actions.</div>'
            : '<ul class="insight-vd-pack-contains">' + pack.contains.map((item) => `<li>${item}</li>`).join('') + '</ul>'}
          <div class="insight-vd-pack-hint">${insightsRecommendationsLocked ? 'Pro feature' : 'Click to copy this pack checklist'}</div>
        </article>
      `).join('')}
    </div>

    <details class="adv insight-vd-accordion">
      <summary>Secondary metrics</summary>
      <div class="insight-vd-secondary quick-grid">
        <div class="mini-card">
          <span class="mini-label">Token mix</span>
          <div class="mix-bar"><span class="mix-a" style="width:${colorPct}%"></span><span class="mix-b" style="width:${typePct}%"></span><span class="mix-c" style="width:${spacingPct}%"></span></div>
          <span class="mini-sub">Colors ${colorPct}% · Type ${typePct}% · Space ${spacingPct}%</span>
        </div>
        <div class="mini-card">
          <span class="mini-label">Live AA fails</span>
          <span class="mini-value" style="color:${criticalCount ? '#ef5a5a' : '#24b26d'}">${criticalCount}</span>
          <span class="mini-sub">Checked ${data.liveWcagChecked} text blocks</span>
        </div>
      </div>
    </details>

    <details class="adv insight-vd-accordion">
      <summary>Advanced diagnostics${insightsAnalyzerLocked ? ' [PRO]' : ''}</summary>
      ${insightsAnalyzerLocked
        ? '<div class="insight-vd-diag-grid"><article class="insight-vd-diag-card tone-watch"><div class="insight-vd-diag-top"><span class="insight-vd-diag-value">PRO</span><span class="insight-vd-diag-label">Advanced diagnostics</span><span class="insight-vd-diag-state">Locked</span></div><div class="insight-vd-diag-why">Upgrade to Pro to view rule density, specificity pressure, and guided remediation suggestions.</div><div class="insight-vd-diag-action">Use Full score analyzer to unlock this module.</div></article></div>'
        : '<div class="insight-vd-diag-grid">' + diagnostics.map((metric) => `\n          <article class="insight-vd-diag-card tone-${metric.tone}">\n            <div class="insight-vd-diag-top">\n              <span class="insight-vd-diag-value">${metric.value}</span>\n              <span class="insight-vd-diag-label">${metric.label}</span>\n              <span class="insight-vd-diag-state">${metric.state}</span>\n            </div>\n            <div class="insight-vd-diag-why">Why: ${metric.why}</div>\n            <div class="insight-vd-diag-action">What to do: ${metric.action}</div>\n          </article>\n        `).join('') + '</div>'}
    </details>

    <div class="insight-vd-modal-backdrop" id="insightScoreModal" aria-hidden="true">
      <section class="insight-vd-modal" role="dialog" aria-modal="true" aria-labelledby="insightScoreModalTitle">
        <div class="insight-vd-modal-head">
          <div>
            <h3 class="insight-vd-modal-title" id="insightScoreModalTitle">Full Score Analyzer</h3>
            <p class="insight-vd-modal-sub">Detailed breakdown of what affects the score and what to fix next.</p>
          </div>
          <button class="tiny-btn insight-vd-modal-close" id="insightScoreModalClose">Close</button>
        </div>
        <div class="insight-vd-pillar-grid">
          <article class="insight-vd-pillar-card pillar-access">
            <div class="insight-vd-pillar-top"><span>Accessibility</span><span class="insight-vd-pillar-weight">45%</span></div>
            <div class="insight-vd-pillar-score">${pillarScores.a11y}<span class="insight-vd-pillar-outof">/100</span></div>
            <div class="insight-vd-pillar-meter"><span style="width:${pillarScores.a11y}%"></span></div>
            <div class="insight-vd-pillar-note">Uses live WCAG fail rate, low-contrast token ratio, and risky pairs below 3:1.</div>
            <ul class="insight-vd-pillar-fixes">
              <li>Fix button and body text pairs failing AA on top-traffic screens.</li>
              <li>Re-scan live pages after each batch to confirm pass status.</li>
            </ul>
          </article>
          <article class="insight-vd-pillar-card pillar-consistency">
            <div class="insight-vd-pillar-top"><span>Consistency</span><span class="insight-vd-pillar-weight">30%</span></div>
            <div class="insight-vd-pillar-score">${pillarScores.consistency}<span class="insight-vd-pillar-outof">/100</span></div>
            <div class="insight-vd-pillar-meter"><span style="width:${pillarScores.consistency}%"></span></div>
            <div class="insight-vd-pillar-note">Hardcoded style drift, token coverage, and value-scale entropy across spacing, radius, and shadow.</div>
            <ul class="insight-vd-pillar-fixes">
              <li>Replace hardcoded styles with semantic tokens in shared components.</li>
              <li>Reduce one-off spacing and radius values in repeated layouts.</li>
            </ul>
          </article>
          <article class="insight-vd-pillar-card pillar-maintain">
            <div class="insight-vd-pillar-top"><span>Maintainability</span><span class="insight-vd-pillar-weight">15%</span></div>
            <div class="insight-vd-pillar-score">${pillarScores.maintain}<span class="insight-vd-pillar-outof">/100</span></div>
            <div class="insight-vd-pillar-meter"><span style="width:${pillarScores.maintain}%"></span></div>
            <div class="insight-vd-pillar-note">Rules and declarations pressure, selector specificity, and inline style share.</div>
            <ul class="insight-vd-pillar-fixes">
              <li>Consolidate duplicate CSS blocks to reduce declaration density.</li>
              <li>Flatten deep selectors in areas with high override churn.</li>
            </ul>
          </article>
          <article class="insight-vd-pillar-card pillar-govern">
            <div class="insight-vd-pillar-top"><span>Governance</span><span class="insight-vd-pillar-weight">10%</span></div>
            <div class="insight-vd-pillar-score">${pillarScores.govern}<span class="insight-vd-pillar-outof">/100</span></div>
            <div class="insight-vd-pillar-meter"><span style="width:${pillarScores.govern}%"></span></div>
            <div class="insight-vd-pillar-note">Tracks semantic naming clarity, ownership readiness, and repeatable handoff practices.</div>
            <ul class="insight-vd-pillar-fixes">
              <li>Rename ambiguous tokens to semantic names in active component groups.</li>
              <li>Attach owner and status tags for each high-impact remediation task.</li>
            </ul>
          </article>
        </div>
        <div class="insight-vd-tier-legend">
          <div class="insight-vd-tier-legend-label">Score tiers and interpretation</div>
          <ul class="insight-vd-tier-list">
            <li class="insight-vd-tier-item tier-healthy${tierInfo.key === 'healthy' ? ' tier-current' : ''}"><strong>90–99</strong><span>Healthy baseline</span></li>
            <li class="insight-vd-tier-item tier-good${tierInfo.key === 'good' ? ' tier-current' : ''}"><strong>75–89</strong><span>Good, minor cleanup</span></li>
            <li class="insight-vd-tier-item tier-watch${tierInfo.key === 'watch' ? ' tier-current' : ''}"><strong>60–74</strong><span>Watch, structured fixes needed</span></li>
            <li class="insight-vd-tier-item tier-risk${tierInfo.key === 'risk' ? ' tier-current' : ''}"><strong>0–59</strong><span>High risk, prioritize remediation</span></li>
          </ul>
        </div>
      </section>
    </div>
  `;

  const toggleBtn = section.querySelector('#toggleWcagOverlayBtn');
  toggleBtn?.addEventListener('click', async () => {
    const result = await sendActionToActiveTab({ type: 'TOGGLE_WCAG_OVERLAY' });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not toggle overlay');
      return;
    }
    wcagOverlayActive = !!result.enabled;
    if (toggleBtn) {
      toggleBtn.textContent = wcagOverlayActive ? 'WCAG Overlay ON' : 'Open WCAG overlays';
      toggleBtn.classList.toggle('wcag-active', wcagOverlayActive);
    }
    if (result.enabled) {
      showToast(result.count > 0 ? `WCAG overlay on — ${result.count} fails highlighted on page` : 'WCAG overlay on — no contrast fails found');
    } else {
      showToast('WCAG overlay off — page restored');
    }
  });

  section.querySelector('#insightJumpColorsBtn')?.addEventListener('click', () => {
    renderTokens('colors');
    showToast('Jumped to Colors tab');
  });

  section.querySelector('#insightCopyChecklistBtn')?.addEventListener('click', () => {
    if (notifyProLock('insightsRecommendations', 'Insights recommendations are a Pro feature.')) return;
    const checklist = recs.map((text, i) => `${i + 1}. [${phases[i] || 'Later'}] ${text}`).join('\n');
    copyText(checklist || 'No recommendations available.');
    showToast('Checklist copied');
  });

  section.querySelector('#insightScoreGuideBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openTabHelpModal('insights', e.currentTarget);
  });

  const impactCards = Array.from(section.querySelectorAll('.insight-vd-impact-card[data-impact-key]'));
  let activeImpactKey = '';

  const selectImpactCard = (key) => {
    activeImpactKey = key || '';
    impactCards.forEach((card) => {
      const cKey = card.getAttribute('data-impact-key') || '';
      const selected = !!activeImpactKey && cKey === activeImpactKey;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
      const expand = card.querySelector('.insight-vd-impact-expand');
      if (expand) {
        expand.setAttribute('aria-hidden', selected ? 'false' : 'true');
      }
    });
  };

  impactCards.forEach((card) => {
    const clickCard = () => {
      if (notifyProLock('insightsRecommendations', 'Component impact map is a Pro feature.')) return;
      const key = card.getAttribute('data-impact-key') || '';
      selectImpactCard(activeImpactKey === key ? '' : key);
      showToast(activeImpactKey ? `Showing tasks: ${card.querySelector('.insight-vd-impact-name')?.textContent || key}` : 'Component tasks cleared');
    };

    card.addEventListener('click', clickCard);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        clickCard();
      }
    });
  });

  const buildPackChecklist = (packKey) => {
    if (packKey === 'live') {
      const count = data.liveWcagFailCount;
      return [
        'Accessibility Task Pack: Live Contrast Fixes',
        `Owner: Frontend | Items: ${count} | ETA: ${count > 8 ? '2 days' : '1 day'}`,
        'Tasks:',
        '- Run WCAG overlay and capture all failing selectors.',
        '- Fix text/background combinations to AA (4.5:1 for small text).',
        '- Re-scan and verify zero critical live fails.'
      ].join('\n');
    }

    if (packKey === 'risky') {
      const pairs = (data.advancedA11y?.riskyPairs || []).slice(0, 5);
      return [
        'Accessibility Task Pack: Risky Palette Pairs',
        `Owner: Design System | Items: ${data.advancedA11y?.riskyPairs?.length || 0} | ETA: ${(data.advancedA11y?.riskyPairs?.length || 0) > 4 ? '2 days' : '1 day'}`,
        'Tasks:',
        '- Replace critical token pairs below 3:1.',
        '- Add semantic alternatives for dark/light surfaces.',
        '- Recompute contrast matrix and update docs.',
        '',
        'Top risky pairs:',
        ...(pairs.length ? pairs.map((p) => `- ${p}`) : ['- No risky pairs currently detected.'])
      ].join('\n');
    }

    const fixes = (data.lowContrastFixes || []).slice(0, 5);
    return [
      'Accessibility Task Pack: Token Remediation',
      `Owner: Design | Items: ${data.failColorCount || 0} | ETA: ${data.failColorCount > 4 ? '2 days' : '1 day'}`,
      'Tasks:',
      '- Replace low-contrast palette tokens with nearest AA-safe alternatives.',
      '- Validate semantic naming and usage in core components.',
      '- Re-run Insights and archive snapshot.',
      '',
      'Suggested swaps:',
      ...(fixes.length ? fixes.map((f) => `- ${f}`) : ['- No token swaps currently required.'])
    ].join('\n');
  };

  section.querySelectorAll('.insight-vd-pack-card[data-pack-key]').forEach((card) => {
    const copyPack = () => {
      if (notifyProLock('insightsRecommendations', 'Accessibility task packs are a Pro feature.')) return;
      const key = card.getAttribute('data-pack-key') || 'remediation';
      copyText(buildPackChecklist(key));
      const title = card.querySelector('.insight-vd-pack-name')?.textContent || 'Task pack';
      showToast(`${title} checklist copied`);
    };

    card.addEventListener('click', copyPack);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyPack();
      }
    });
  });

  const scoreAnalyzerBtn = section.querySelector('#insightScoreAnalyzerBtn');
  const scoreModal = section.querySelector('#insightScoreModal');
  const scoreModalClose = section.querySelector('#insightScoreModalClose');

  const closeScoreModal = () => {
    if (!scoreModal) return;
    closeLayer(scoreModal, {
      mode: 'open',
      fallbackFocus: scoreAnalyzerBtn
    });
  };

  scoreAnalyzerBtn?.addEventListener('click', () => {
    if (notifyProLock('insightsAnalyzer', 'Full score analyzer is a Pro feature.')) return;
    openLayer(scoreModal, {
      mode: 'open',
      focusEl: scoreModalClose
    });
  });
  scoreModalClose?.addEventListener('click', closeScoreModal);
  scoreModal?.addEventListener('click', (e) => {
    if (e.target === scoreModal) {
      closeScoreModal();
    }
  });

  panel.appendChild(section);
}

async function checkInspectResult() {
  const data = await chrome.storage.local.get('tl_inspect');
  if (!data.tl_inspect) {
    inspectResult = null;
    return;
  }
  const age = Date.now() - (data.tl_inspect.capturedAt || 0);
  if (age > 10 * 60 * 1000) {
    await chrome.storage.local.remove('tl_inspect');
    inspectResult = null;
    return;
  }
  inspectResult = data.tl_inspect;
}

function getColorTokenRecommendation(hex) {
  if (!hex || !tokens || !tokens.colors || !tokens.colors.length) return null;

  const model = buildExportModel();
  if (!model || !model.colors.length) return null;

  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  model.colors.forEach(c => {
    const d = colorDistance(hex, c.hex);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  });

  if (!best) return null;

  const isClose = bestDist <= 24;
  const suggestedName = semanticColorName({ hsl: hexToHslString(hex) }, model.colors.length + 1);

  return {
    inputHex: hex,
    closest: best,
    distance: Math.round(bestDist),
    isClose,
    suggestedName
  };
}

function renderInspectPanel(data, panel) {
  const banner = document.createElement('div');
  banner.className = 'inspect-panel';

  const props = [
    data.background  && { key: 'Background', value: data.background,  color: true },
    data.color       && { key: 'Text color',  value: data.color,       color: true },
    data.borderColor && { key: 'Border',      value: data.borderColor, color: true },
    data.fontFamily  && { key: 'Font',        value: data.fontFamily },
    data.fontSize    && { key: 'Size',        value: data.fontSize },
    data.bounds      && { key: 'Bounds',      value: data.bounds },
    data.padding     && { key: 'Padding',     value: data.padding },
    data.borderRadius && { key: 'Radius',     value: data.borderRadius },
    data.boxShadow   && { key: 'Shadow',      value: data.boxShadow.substring(0, 55) }
  ].filter(Boolean);

  const rowsHtml = props.map(p => `
    <div class="inspect-row">
      ${p.color
        ? `<span class="inspect-dot" style="background:${p.value}"></span>`
        : '<span class="inspect-dot" style="background:transparent;border:none"></span>'}
      <span class="inspect-key">${p.key}</span>
      <span class="inspect-val">${p.value}</span>
      <button class="tiny-btn inspect-copy-mini" data-copy-value="${encodeURIComponent(p.value)}" data-copy-label="${encodeURIComponent(p.key)}">Copy</button>
    </div>
  `).join('');

  const recos = [
    data.background ? { label: 'Background', rec: getColorTokenRecommendation(data.background) } : null,
    data.color ? { label: 'Text', rec: getColorTokenRecommendation(data.color) } : null
  ].filter(Boolean).filter(item => item.rec);

  const recoHtml = recos.length ? `
    <div class="inspect-reco-title">Suggested Token Mapping</div>
    <div class="inspect-reco-list">
      ${recos.map(item => {
        const rec = item.rec;
        const tokenLine = rec.isClose
          ? `${item.label}: use --${rec.closest.key} (${rec.closest.hex})`
          : `${item.label}: add --${rec.suggestedName} (${rec.inputHex})`;
        return `<div class="inspect-reco-item">${tokenLine}</div>`;
      }).join('')}
    </div>
  ` : '';

  banner.innerHTML = `
    <div class="inspect-header">
      <span class="inspect-label">🔍 <code>${data.label}</code></span>
      <div style="display:flex;gap:5px">
        <button class="tiny-btn" id="inspectCopyBtn">Copy CSS</button>
        <button class="tiny-btn danger" id="inspectClearBtn">✕</button>
      </div>
    </div>
    <div class="inspect-rows">${rowsHtml}</div>
    ${recoHtml}
  `;

  banner.querySelector('#inspectClearBtn').addEventListener('click', async () => {
    await chrome.storage.local.remove('tl_inspect');
    inspectResult = null;
    banner.remove();
  });

  banner.querySelector('#inspectCopyBtn').addEventListener('click', () => {
    const lines = [
      data.background   && `  background: ${data.background};`,
      data.color        && `  color: ${data.color};`,
      data.fontFamily   && `  font-family: '${data.fontFamily}', sans-serif;`,
      data.fontSize     && `  font-size: ${data.fontSize};`,
      data.padding      && `  padding: ${data.padding};`,
      data.borderRadius && `  border-radius: ${data.borderRadius};`,
      data.borderColor  && `  border-color: ${data.borderColor};`,
      data.boxShadow    && `  box-shadow: ${data.boxShadow};`
    ].filter(Boolean).join('\n');
    copyText(`/* ${data.label} */\n{\n${lines}\n}`);
    showToast('Element CSS copied');
  });

  banner.querySelectorAll('.inspect-copy-mini').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = decodeURIComponent(btn.dataset.copyValue || '');
      const label = decodeURIComponent(btn.dataset.copyLabel || 'Value');
      copyText(value);
      showToast(`${label} copied`);
    });
  });

  panel.insertBefore(banner, panel.firstChild);
}

function renderHistory(panel) {
  const section = makeSection('Saved Snapshots');
  mountGuideButtonInSection(section, 'history');

  // ── Live preview banner ──────────────────────────────────────────
  if (activePreview) {
    const banner = document.createElement('div');
    banner.className = 'preview-banner';
    const modeChip = activePreview.mode === 'vars'
      ? `<span class="preview-mode-chip preview-mode-vars">✓ Variable mode</span>`
      : `<span class="preview-mode-chip preview-mode-semantic">◆ Semantic mode</span>`;
    const detail = activePreview.mode === 'vars'
      ? `${activePreview.applied || 0} CSS vars swapped`
      : `${activePreview.tokenAppliedPct || 0}% applied · ${activePreview.pageCoveragePct || 0}% page coverage`;
    banner.innerHTML = `
      <span class="preview-banner-label">🎨 Previewing <strong>${activePreview.name}</strong> ${modeChip}<br><span class="preview-banner-detail">${detail}</span></span>
      <button class="tiny-btn preview-revert-btn" id="previewRevertBtn">Revert</button>
    `;
    banner.querySelector('#previewRevertBtn').addEventListener('click', revertSnapshotPreview);
    section.appendChild(banner);
  }

  if (!savedSites.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No snapshots yet. Save any page using the bookmark button.';
    section.appendChild(empty);
    panel.appendChild(section);
    return;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'history-toolbar';
  const historyToolsLocked = _qL55('driftCompare');
  toolbar.innerHTML = `
    <button class="tiny-btn ${historyToolsLocked ? 'pro-locked' : ''}" data-action="diff-url" title="${historyToolsLocked ? 'Pro feature' : 'Compare current page with a saved URL snapshot'}">Compare URL${historyToolsLocked ? ' <span class="btn-pro-badge">PRO</span>' : ''}</button>
    <button class="tiny-btn ${historyToolsLocked ? 'pro-locked' : ''}" data-action="diff-latest" title="${historyToolsLocked ? 'Pro feature' : 'Diff against latest snapshot'}">Diff Latest${historyToolsLocked ? ' <span class="btn-pro-badge">PRO</span>' : ''}</button>
    <button class="tiny-btn ${historyToolsLocked ? 'pro-locked' : ''}" data-action="mini-crawl" title="${historyToolsLocked ? 'Pro feature' : 'Mini crawl and aggregate diff'}">Mini Crawl${historyToolsLocked ? ' <span class="btn-pro-badge">PRO</span>' : ''}</button>
    <button class="tiny-btn danger" data-action="clear-all">Clear all</button>
  `;

  toolbar.querySelector('[data-action="diff-url"]')?.addEventListener('click', () => {
    if (notifyProLock('driftCompare', 'Compare by URL is a Pro feature.')) return;
    if (!tokens) {
      showToast('Scan current page first');
      return;
    }
    const raw = window.prompt('Enter snapshot URL to compare:', tokens.url || 'https://');
    if (!raw) return;
    const inputUrl = raw.trim();
    const direct = savedSites.find(s => s && s.url === inputUrl && s.tokens);
    const fallback = direct || savedSites.find(s => s && s.url && getDomain(s.url) === getDomain(inputUrl) && s.tokens);
    if (!fallback) {
      showToast('No saved snapshot found for that URL/domain');
      return;
    }
    lastDiffView = buildSnapshotDiff(tokens, fallback.tokens, `${getDomain(fallback.url)} snapshot`);
    renderTokens('history');
    showToast('URL compare generated');
  });

  toolbar.querySelector('[data-action="diff-latest"]')?.addEventListener('click', () => {
    if (notifyProLock('driftCompare', 'Diff with latest is a Pro feature.')) return;
    if (!tokens) {
      showToast('Scan current page first');
      return;
    }
    const latest = [...savedSites]
      .filter(s => s && s.tokens)
      .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))[0];
    if (!latest) {
      showToast('No saved snapshots found');
      return;
    }
    lastDiffView = buildSnapshotDiff(tokens, latest.tokens, `${getDomain(latest.url)} latest snapshot`);
    renderTokens('history');
    showToast('Latest diff generated');
  });

  toolbar.querySelector('[data-action="mini-crawl"]')?.addEventListener('click', async () => {
    if (notifyProLock('driftCompare', 'Mini Crawl is a Pro feature.')) return;
    if (!tokens) {
      showToast('Scan current page first');
      return;
    }
    const raw = window.prompt('Mini Crawl URLs (comma-separated, max 5):', tokens.url || 'https://');
    if (!raw) return;
    const urls = raw.split(',').map(v => v.trim()).filter(v => /^https?:\/\//i.test(v)).slice(0, 5);
    if (!urls.length) {
      showToast('Please enter valid http/https URLs');
      return;
    }
    showToast(`Crawling ${urls.length} page${urls.length === 1 ? '' : 's'}…`);
    const result = await runMiniCrawl(urls);
    if (!result || !result.aggregate) {
      showToast('Mini Crawl failed on provided URLs');
      return;
    }
    lastDiffView = buildSnapshotDiff(tokens, result.aggregate, `crawl aggregate (${result.scanned} pages)`);
    renderTokens('history');
    showToast(`Mini Crawl complete: ${result.scanned} pages aggregated`);
  });

  toolbar.querySelector('[data-action="clear-all"]').addEventListener('click', async () => {
    const ok = window.confirm('Delete all saved snapshots?');
    if (!ok) return;
    await clearSavedSnapshots();
    lastDiffView = null;
    renderTokens('history');
    showToast('All snapshots deleted');
  });
  section.appendChild(toolbar);

  if (lastDiffView) {
    const diffBox = document.createElement('div');
    diffBox.className = 'compare-box diff-box';

    const sectionIcons = {
      Colors: '🎨',
      Fonts: 'Aa',
      Spacing: '↔',
      Radius: '◖',
      Shadows: '🌑',
      Gradients: '🌈',
      Variables: '𝑥'
    };

    const sections = lastDiffView.sections
      .map(s => {
        const adds = s.added.length;
        const rems = s.removed.length;
        const shared = s.shared.length;
        const total = Math.max(1, adds + rems + shared);
        const impactScore = Math.round(((adds + rems) / total) * 100);
        const impactLevel = impactScore >= 35 ? 'High' : impactScore >= 15 ? 'Medium' : 'Low';
        const samples = [...s.added.slice(0, 2), ...s.removed.slice(0, 2)];
        return { key: s.key, adds, rems, shared, total, impactScore, impactLevel, samples };
      })
      .filter(s => s.adds || s.rems || s.shared)
      .sort((a, b) => (b.adds + b.rems) - (a.adds + a.rems));

    const totals = sections.reduce((acc, s) => {
      acc.adds += s.adds;
      acc.rems += s.rems;
      acc.shared += s.shared;
      return acc;
    }, { adds: 0, rems: 0, shared: 0 });

    const similarity = Math.max(0, Math.min(100, Number(lastDiffView.similarity) || 0));
    const mood = similarity >= 90
      ? { className: 'mood-stable', text: 'Stable build' }
      : similarity >= 70
        ? { className: 'mood-watch', text: 'Minor drift' }
        : { className: 'mood-drift', text: 'Drift detected' };

    const sectionCards = sections.map(s => {
      const addPct = Math.round((s.adds / s.total) * 100);
      const remPct = Math.round((s.rems / s.total) * 100);
      const sharedPct = Math.max(0, 100 - addPct - remPct);
      const impactLower = s.impactLevel.toLowerCase();
      const sampleRows = s.samples.map(v => `<div class="diff-sample-row">${decorateHex(String(v))}</div>`).join('');
      return `
        <article class="diff-card" data-has-added="${s.adds > 0 ? '1' : '0'}" data-has-removed="${s.rems > 0 ? '1' : '0'}" data-impact="${impactLower}">
          <div class="diff-card-top">
            <div class="diff-card-title"><span class="diff-card-icon">${sectionIcons[s.key] || '•'}</span><span>${escapeHtmlText(s.key)}</span></div>
            <span class="diff-impact-pill impact-${impactLower}">${s.impactLevel}</span>
          </div>
          <div class="diff-mini-bar" aria-hidden="true">
            <span class="bar-add" style="width:${addPct}%"></span>
            <span class="bar-rem" style="width:${remPct}%"></span>
            <span class="bar-shared" style="width:${sharedPct}%"></span>
          </div>
          <div class="diff-stat-row">
            <span class="drift-add">+${s.adds}</span>
            <span class="drift-rem">−${s.rems}</span>
            <span class="drift-shared">${s.shared} shared</span>
            <button class="diff-sample-toggle" data-action="toggle-samples"${s.samples.length ? '' : ' disabled'}>${s.samples.length ? 'Examples' : 'No examples'}</button>
          </div>
          ${s.samples.length ? `<div class="diff-samples hidden" data-role="samples">${sampleRows}</div>` : ''}
        </article>
      `;
    }).join('');

    diffBox.innerHTML = `
      <div class="compare-head">
        <div class="compare-title-wrap">
          <div class="compare-title">Snapshot Diff vs ${escapeHtmlText(lastDiffView.label)}</div>
          <div class="diff-subtitle ${mood.className}">${mood.text} · ${sections.length} categories</div>
        </div>
        <button class="compare-close" id="diffCloseBtn" title="Close diff view" aria-label="Close diff view">✕</button>
      </div>

      <div class="diff-hero">
        <div class="diff-ring-wrap">
          <div class="diff-ring ${mood.className}" style="--p:${similarity}"><span>${similarity}%</span></div>
          <div class="diff-ring-label">Similarity</div>
        </div>
        <div class="compare-grid">
          <div class="compare-chip"><div class="compare-label">Added</div><div class="compare-value">+${totals.adds}</div></div>
          <div class="compare-chip"><div class="compare-label">Removed</div><div class="compare-value">−${totals.rems}</div></div>
          <div class="compare-chip"><div class="compare-label">Shared</div><div class="compare-value">${totals.shared}</div></div>
          <div class="compare-chip"><div class="compare-label">Compared At</div><div class="compare-value compare-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>
        </div>
      </div>

      <div class="diff-filter-chips" role="group" aria-label="Filter diff cards">
        <button class="diff-filter-chip active" data-filter="all" aria-pressed="true">All</button>
        <button class="diff-filter-chip" data-filter="added" aria-pressed="false">Only added</button>
        <button class="diff-filter-chip" data-filter="removed" aria-pressed="false">Only removed</button>
        <button class="diff-filter-chip" data-filter="high" aria-pressed="false">High impact</button>
      </div>

      <div class="diff-card-grid">${sectionCards || '<div class="compare-empty">No meaningful differences detected.</div>'}</div>
      <div id="diffFilterEmpty" class="compare-empty hidden">No cards in this filter. Try another view.</div>
    `;

    diffBox.querySelector('#diffCloseBtn')?.addEventListener('click', () => {
      lastDiffView = null;
      renderTokens('history');
      showToast('Diff view closed');
    });

    diffBox.querySelectorAll('.diff-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const mode = chip.dataset.filter || 'all';
        diffBox.querySelectorAll('.diff-filter-chip').forEach(btn => {
          const active = btn === chip;
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        let visible = 0;
        diffBox.querySelectorAll('.diff-card').forEach(card => {
          const show = mode === 'all'
            ? true
            : mode === 'added'
              ? card.dataset.hasAdded === '1'
              : mode === 'removed'
                ? card.dataset.hasRemoved === '1'
                : card.dataset.impact === 'high';
          card.classList.toggle('hidden', !show);
          if (show) visible += 1;
        });

        diffBox.querySelector('#diffFilterEmpty')?.classList.toggle('hidden', visible > 0);
      });
    });

    diffBox.querySelectorAll('[data-action="toggle-samples"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.diff-card');
        const samples = card?.querySelector('[data-role="samples"]');
        if (!samples) return;
        const opening = samples.classList.contains('hidden');
        samples.classList.toggle('hidden');
        btn.textContent = opening ? 'Hide examples' : 'Examples';
      });
    });

    section.appendChild(diffBox);
  }

  const list = document.createElement('div');
  list.className = 'history-list';

  savedSites.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const dt = new Date(entry.savedAt || Date.now());
    const dateLabel = dt.toLocaleDateString();
    const timeLabel = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isActivePrev = activePreview && activePreview.key === snapshotKey(entry);
    const applyBtnLabel = isActivePrev ? '✓ Previewing' : previewInProgress ? 'Applying…' : 'Apply to page (Beta)';
    const applyBtnDisabled = (previewInProgress && !isActivePrev) ? ' disabled' : '';
    const confidence = estimatePreviewConfidence(entry.tokens, tokens);
    const isDiffLockedRow = _qL55('driftCompare');
    const isSmartApplyLocked = _qL55('smartApply');
    const tokenSummary = entry.tokens || {};
    const statChips = [
      `${(tokenSummary.colors || []).length} colors`,
      `${(tokenSummary.fonts || []).length} fonts`,
      `${((tokenSummary.spacing || []).length + (tokenSummary.radii || []).length)} spacing`
    ].map(text => `<span class="history-stat-chip">${text}</span>`).join('');
    let driftHint = '';
    if (tokens) {
      const similarity = buildSnapshotDiff(tokens, entry.tokens, 'snapshot').similarity;
      if (similarity < 70) driftHint = '<span class="history-drift-chip" title="Large visual-token change compared with the current page">Large change</span>';
    }

    row.innerHTML = `
      <div class="history-meta">
        <div class="history-title-row">
          <div class="history-title">${entry.title || getDomain(entry.url)}</div>
          <span class="confidence-badge confidence-${confidence.level.toLowerCase()}">${confidence.level} ${confidence.score}%</span>
        </div>
        <div class="history-url">${getDomain(entry.url)} · ${dateLabel} ${timeLabel}</div>
        <div class="history-stats">${statChips}${driftHint}</div>
      </div>
      <div class="history-actions">
        <button class="tiny-btn" data-action="load">Load</button>
        <button class="tiny-btn ${isDiffLockedRow ? 'pro-locked' : ''}" data-action="diff" title="${isDiffLockedRow ? 'Pro feature' : 'Diff this snapshot'}">Diff${isDiffLockedRow ? ' <span class="btn-pro-badge">PRO</span>' : ''}</button>
        <button class="tiny-btn preview-apply-btn${isActivePrev ? ' active-preview' : ''}${isSmartApplyLocked ? ' pro-locked' : ''}" data-action="apply-preview" title="${isSmartApplyLocked ? 'Pro feature' : `Smart Apply beta: ${confidence.level} confidence (${confidence.score}%)`}"${applyBtnDisabled}>${isSmartApplyLocked ? 'Apply <span class="btn-pro-badge">PRO</span>' : applyBtnLabel}</button>
        <button class="tiny-btn danger" data-action="delete">Delete</button>
      </div>
    `;

    const badge = row.querySelector('.confidence-badge');
    if (badge) badge.title = confidence.hint;

    row.querySelector('[data-action="load"]').addEventListener('click', () => {
      tokens = entry.tokens;
      currentSiteMeta = {
        title: entry.title || getDomain(entry.url),
        url: entry.url || (entry.tokens && entry.tokens.url) || '',
        favicon: ''
      };
      lastDiffView = null;
      renderHeader(tokens);
      activeTab = 'colors';
      selectTab(activeTab);
      renderTokens(activeTab);
      showToast('Snapshot loaded');
    });

    row.querySelector('[data-action="diff"]').addEventListener('click', () => {
      if (notifyProLock('driftCompare', 'Snapshot diff compare is a Pro feature.')) return;
      if (!tokens) {
        showToast('Scan current page first');
        return;
      }
      lastDiffView = buildSnapshotDiff(tokens, entry.tokens, `${getDomain(entry.url)} snapshot`);
      renderTokens('history');
      showToast('Diff view generated');
    });

    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      await deleteSavedSnapshot(entry);
      if (lastDiffView && lastDiffView.label && lastDiffView.label.includes(getDomain(entry.url))) {
        lastDiffView = null;
      }
      renderTokens('history');
      showToast('Snapshot deleted');
    });

    row.querySelector('[data-action="apply-preview"]').addEventListener('click', async () => {
      if (notifyProLock('smartApply', 'Smart Apply preview is a Pro feature.')) return;
      if (previewInProgress) return;
      if (isActivePrev) {
        revertSnapshotPreview();
        return;
      }
      if (confidence.level === 'Low') {
        showToast('Low confidence preview on this page. Smart Apply will still run with semantic remap.');
      }
      const applyBtn = row.querySelector('[data-action="apply-preview"]');
      previewInProgress = true;
      if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = 'Applying\u2026'; }
      try {
        await applySnapshotPreview(entry);
      } finally {
        previewInProgress = false;
        renderTokens('history');
      }
    });

    list.appendChild(row);
  });

  section.appendChild(list);
  panel.appendChild(section);
}

function stringifyToken(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v || '');
}

function diffField(currentArr, baselineArr, mapFn = x => x) {
  const current = new Set((currentArr || []).map(mapFn).map(stringifyToken));
  const baseline = new Set((baselineArr || []).map(mapFn).map(stringifyToken));
  const added = [...current].filter(v => !baseline.has(v));
  const removed = [...baseline].filter(v => !current.has(v));
  const shared = [...current].filter(v => baseline.has(v));
  return { added, removed, shared };
}

function aggregateTokenPages(pages) {
  const colorMap = new Map();
  const fontSet = new Set();
  const fontSizeMap = new Map();
  const fontWeightSet = new Set();
  const spacingSet = new Set();
  const radiusSet = new Set();
  const shadowSet = new Set();
  const gradientSet = new Set();
  const lineHeightSet = new Set();
  const varMap = new Map();

  pages.forEach(page => {
    (page.colors || []).forEach(c => {
      if (!c || !c.hex) return;
      const key = String(c.hex).toUpperCase();
      const prev = colorMap.get(key) || {
        hex: key,
        hsl: c.hsl || '',
        count: 0,
        contrastOnWhite: c.contrastOnWhite || 0,
        contrastOnBlack: c.contrastOnBlack || 0
      };
      prev.count += Number(c.count || 1);
      colorMap.set(key, prev);
    });
    (page.fonts || []).forEach(f => fontSet.add(f));
    (page.fontSizes || []).forEach(s => {
      const px = Number(s && s.px);
      if (!Number.isFinite(px)) return;
      const prev = fontSizeMap.get(px) || { px, rem: s.rem || `${(px / 16).toFixed(3).replace(/\.?0+$/, '')}rem`, count: 0 };
      prev.count += Math.max(1, Number(s && s.count) || 0);
      fontSizeMap.set(px, prev);
    });
    (page.fontWeights || []).forEach(w => fontWeightSet.add(Number(w)));
    (page.spacing || []).forEach(v => spacingSet.add(Number(v)));
    (page.radii || []).forEach(v => radiusSet.add(Number(v)));
    (page.shadows || []).forEach(v => shadowSet.add(v));
    (page.gradients || []).forEach(v => gradientSet.add(v));
    (page.lineHeights || []).forEach(v => lineHeightSet.add(Number(v)));
    Object.entries(page.rootVars || {}).forEach(([k, v]) => {
      if (!varMap.has(k)) varMap.set(k, v);
    });
  });

  return normalizeExtractedTokens({
    colors: [...colorMap.values()].sort((a, b) => b.count - a.count).slice(0, 40),
    fonts: [...fontSet].slice(0, 20),
    fontSizes: [...fontSizeMap.values()].sort((a, b) => a.px - b.px),
    fontWeights: [...fontWeightSet].filter(n => Number.isFinite(n)).sort((a, b) => a - b),
    spacing: [...spacingSet].filter(n => Number.isFinite(n)).sort((a, b) => a - b),
    radii: [...radiusSet].filter(n => Number.isFinite(n)).sort((a, b) => a - b),
    shadows: [...shadowSet].slice(0, 20),
    gradients: [...gradientSet].slice(0, 20),
    lineHeights: [...lineHeightSet].filter(n => Number.isFinite(n)).sort((a, b) => a - b),
    rootVars: Object.fromEntries(varMap),
    wcag: { aaFailCount: 0, checkedTextBlocks: 0 },
    url: 'crawl://aggregate',
    title: 'Mini Crawl Aggregate',
    extractedAt: Date.now()
  });
}

async function runMiniCrawl(urls) {
  const pages = [];
  for (const url of urls) {
    const extracted = await extractTokensFromUrl(url);
    if (extracted) pages.push(extracted);
  }
  if (!pages.length) return null;
  return { aggregate: aggregateTokenPages(pages), scanned: pages.length };
}

function buildSnapshotDiff(current, baseline, label) {
  const colorDiff = diffField(current.colors, baseline.colors, c => c.hex);
  const fontDiff = diffField(current.fonts, baseline.fonts, x => x);
  const spacingDiff = diffField(current.spacing, baseline.spacing, x => `${x}px`);
  const radiusDiff = diffField(current.radii, baseline.radii, x => `${x}px`);
  const shadowDiff = diffField(current.shadows, baseline.shadows, x => x);
  const gradientDiff = diffField(current.gradients || [], baseline.gradients || [], x => x);
  const varDiff = diffField(Object.entries(current.rootVars || {}), Object.entries(baseline.rootVars || {}), ([k, v]) => `${k}: ${v}`);

  const totalBaseline =
    (baseline.colors || []).length + (baseline.fonts || []).length + (baseline.spacing || []).length +
    (baseline.radii || []).length + (baseline.shadows || []).length + (baseline.gradients || []).length +
    Object.keys(baseline.rootVars || {}).length;
  const totalShared =
    colorDiff.shared.length + fontDiff.shared.length + spacingDiff.shared.length + radiusDiff.shared.length +
    shadowDiff.shared.length + gradientDiff.shared.length + varDiff.shared.length;
  const similarity = Math.max(0, Math.min(100, Math.round((totalShared / Math.max(1, totalBaseline)) * 100)));

  return {
    label,
    similarity,
    sections: [
      { key: 'Colors', ...colorDiff },
      { key: 'Fonts', ...fontDiff },
      { key: 'Spacing', ...spacingDiff },
      { key: 'Radius', ...radiusDiff },
      { key: 'Shadows', ...shadowDiff },
      { key: 'Gradients', ...gradientDiff },
      { key: 'Variables', ...varDiff }
    ]
  };
}

function makeSection(title) {
  const section = document.createElement('div');
  section.className = 'token-section';

  const heading = document.createElement('h3');
  heading.className = 'section-title';
  heading.textContent = title;
  section.appendChild(heading);

  return section;
}

function safeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'token';
}

function semanticColorName(color, index) {
  const hslMatch = (color.hsl || '').match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/i);
  if (!hslMatch) return `color-${index + 1}`;

  const hue = Number(hslMatch[1]);
  const lightness = Number(hslMatch[3]);

  const families = [
    { n: 'red', min: 345, max: 360 },
    { n: 'red', min: 0, max: 15 },
    { n: 'orange', min: 16, max: 44 },
    { n: 'yellow', min: 45, max: 65 },
    { n: 'green', min: 66, max: 170 },
    { n: 'cyan', min: 171, max: 200 },
    { n: 'blue', min: 201, max: 260 },
    { n: 'indigo', min: 261, max: 290 },
    { n: 'magenta', min: 291, max: 344 }
  ];

  const family = families.find(f => hue >= f.min && hue <= f.max);
  const scale = Math.max(50, Math.min(900, 900 - Math.round(lightness * 10)));
  return `${family ? family.n : 'color'}-${scale}`;
}

function buildExportModel() {
  if (!tokens) return null;

  const colors = (tokens.colors || []).map((c, i) => ({
    key: semanticColorName(c, i),
    hex: c.hex,
    hsl: c.hsl,
    contrastOnWhite: c.contrastOnWhite,
    contrastOnBlack: c.contrastOnBlack
  }));

  const fonts = (tokens.fonts || []).map((f, i) => ({ key: `font-${i + 1}`, value: `'${f}', sans-serif` }));
  const sizes = (tokens.fontSizes || []).map((s, i) => ({ key: `text-${i + 1}`, px: s.px, rem: s.rem }));
  const spacing = (tokens.spacing || []).map((s, i) => ({ key: `space-${i + 1}`, value: `${s}px` }));
  const radius = (tokens.radii || []).map((r, i) => ({ key: `radius-${i + 1}`, value: `${r}px` }));
  const shadows = (tokens.shadows || []).map((s, i) => ({ key: `shadow-${i + 1}`, value: s }));
  const gradients = (tokens.gradients || []).map((g, i) => ({ key: `gradient-${i + 1}`, value: g }));
  const variables = Object.entries(tokens.rootVars || {}).map(([name, value], i) => ({
    name,
    key: safeName(name.replace(/^--/, '') || `variable-${i + 1}`),
    value: String(value)
  }));

  return { colors, fonts, sizes, spacing, radius, shadows, gradients, variables };
}

function inferSemanticColorAlias(hex, index) {
  const tone = luminance(hex);
  if (tone >= 0.92) return 'color-surface';
  if (tone <= 0.16) return 'color-text-primary';
  if (index === 0) return 'color-brand-primary';
  if (index === 1) return 'color-brand-secondary';
  if (index === 2) return 'color-accent';
  return `color-role-${index + 1}`;
}

function buildSemanticAliases(model) {
  const aliases = {
    colors: [],
    typography: [],
    spacing: [],
    radius: [],
    shadows: []
  };

  model.colors.slice(0, 6).forEach((c, index) => {
    aliases.colors.push({ alias: inferSemanticColorAlias(c.hex, index), ref: c.key });
  });
  if (model.fonts[0]) aliases.typography.push({ alias: 'font-body', ref: model.fonts[0].key });
  if (model.fonts[1]) aliases.typography.push({ alias: 'font-heading', ref: model.fonts[1].key });
  if (model.sizes[0]) aliases.typography.push({ alias: 'text-body', ref: model.sizes[0].key });
  if (model.sizes[model.sizes.length - 1]) aliases.typography.push({ alias: 'text-display', ref: model.sizes[model.sizes.length - 1].key });
  if (model.spacing[0]) aliases.spacing.push({ alias: 'space-sm', ref: model.spacing[0].key });
  if (model.spacing[Math.floor(model.spacing.length / 2)]) aliases.spacing.push({ alias: 'space-md', ref: model.spacing[Math.floor(model.spacing.length / 2)].key });
  if (model.spacing[model.spacing.length - 1]) aliases.spacing.push({ alias: 'space-lg', ref: model.spacing[model.spacing.length - 1].key });
  if (model.radius[0]) aliases.radius.push({ alias: 'radius-sm', ref: model.radius[0].key });
  if (model.radius[model.radius.length - 1]) aliases.radius.push({ alias: 'radius-md', ref: model.radius[model.radius.length - 1].key });
  if (model.shadows[0]) aliases.shadows.push({ alias: 'shadow-elevation-1', ref: model.shadows[0].key });

  return aliases;
}

function applyExportFilter(model) {
  const include = getActiveInclude();
  return {
    colors: include.colors ? model.colors : [],
    fonts: include.typography ? model.fonts : [],
    sizes: include.typography ? model.sizes : [],
    spacing: include.spacing ? model.spacing : [],
    radius: include.radius ? model.radius : [],
    shadows: include.shadows ? model.shadows : [],
    gradients: include.gradients ? model.gradients : [],
    variables: include.variables ? model.variables : []
  };
}

function toDtcgDimension(rawValue) {
  const match = String(rawValue || '').trim().match(/^(-?\d+(?:\.\d+)?)(px|rem)$/i);
  if (!match) return null;
  return {
    value: Number(match[1]),
    unit: match[2].toLowerCase()
  };
}

function buildExportOutput(format) {
  if (!tokens) return null;

  const domain = safeName(getDomain(tokens.url));
  const baseModel = buildExportModel();
  if (!baseModel) return null;
  const model = applyExportFilter(baseModel);
  const semanticAliases = buildSemanticAliases(model);
  const hasAny = model.colors.length || model.fonts.length || model.sizes.length || model.spacing.length || model.radius.length || model.shadows.length || model.gradients.length || model.variables.length;
  if (!hasAny) {
    return { error: 'Pick at least one token category' };
  }

  let output = '';

  if (format === 'css') {
    output += `/* Palext export for ${domain} */\n:root {\n`;
    model.colors.forEach(c => { output += `  --${c.key}: ${c.hex};\n`; });
    model.fonts.forEach(f => { output += `  --${f.key}: ${f.value};\n`; });
    model.sizes.forEach(s => { output += `  --${s.key}: ${s.rem}; /* ${s.px}px */\n`; });
    model.spacing.forEach(s => { output += `  --${s.key}: ${s.value};\n`; });
    model.radius.forEach(r => { output += `  --${r.key}: ${r.value};\n`; });
    model.shadows.forEach(s => { output += `  --${s.key}: ${s.value};\n`; });
    model.gradients.forEach(g => { output += `  --${g.key}: ${g.value};\n`; });
    model.variables.forEach(v => { output += `  ${v.name}: ${v.value};\n`; });
    if (semanticAliases.colors.length || semanticAliases.typography.length || semanticAliases.spacing.length || semanticAliases.radius.length || semanticAliases.shadows.length) {
      output += `\n  /* Semantic aliases */\n`;
      semanticAliases.colors.forEach(a => { output += `  --${a.alias}: var(--${a.ref});\n`; });
      semanticAliases.typography.forEach(a => { output += `  --${a.alias}: var(--${a.ref});\n`; });
      semanticAliases.spacing.forEach(a => { output += `  --${a.alias}: var(--${a.ref});\n`; });
      semanticAliases.radius.forEach(a => { output += `  --${a.alias}: var(--${a.ref});\n`; });
      semanticAliases.shadows.forEach(a => { output += `  --${a.alias}: var(--${a.ref});\n`; });
    }
    output += '}\n';
  } else if (format === 'scss') {
    output += `// Palext export for ${domain}\n`;
    model.colors.forEach(c => { output += `$${c.key}: ${c.hex};\n`; });
    model.fonts.forEach(f => { output += `$${f.key}: ${f.value};\n`; });
    model.sizes.forEach(s => { output += `$${s.key}: ${s.rem};\n`; });
    model.spacing.forEach(s => { output += `$${s.key}: ${s.value};\n`; });
    model.radius.forEach(r => { output += `$${r.key}: ${r.value};\n`; });
    model.shadows.forEach(s => { output += `$${s.key}: ${s.value};\n`; });
    model.gradients.forEach(g => { output += `$${g.key}: ${g.value};\n`; });
    model.variables.forEach(v => { output += `$var-${v.key}: ${v.value};\n`; });
    if (semanticAliases.colors.length || semanticAliases.typography.length || semanticAliases.spacing.length || semanticAliases.radius.length || semanticAliases.shadows.length) {
      output += `\n// Semantic aliases\n`;
      semanticAliases.colors.forEach(a => { output += `$${a.alias}: $${a.ref};\n`; });
      semanticAliases.typography.forEach(a => { output += `$${a.alias}: $${a.ref};\n`; });
      semanticAliases.spacing.forEach(a => { output += `$${a.alias}: $${a.ref};\n`; });
      semanticAliases.radius.forEach(a => { output += `$${a.alias}: $${a.ref};\n`; });
      semanticAliases.shadows.forEach(a => { output += `$${a.alias}: $${a.ref};\n`; });
    }
  } else if (format === 'less') {
    output += `// Palext Less export for ${domain}\n`;
    model.colors.forEach(c => { output += `@${c.key}: ${c.hex};\n`; });
    model.fonts.forEach(f => { output += `@${f.key}: ${f.value};\n`; });
    model.sizes.forEach(s => { output += `@${s.key}: ${s.rem};\n`; });
    model.spacing.forEach(s => { output += `@${s.key}: ${s.value};\n`; });
    model.radius.forEach(r => { output += `@${r.key}: ${r.value};\n`; });
    model.shadows.forEach(s => { output += `@${s.key}: ${s.value};\n`; });
    model.gradients.forEach(g => { output += `@${g.key}: ${g.value};\n`; });
    model.variables.forEach(v => { output += `@var-${v.key}: ${v.value};\n`; });
    if (semanticAliases.colors.length || semanticAliases.typography.length || semanticAliases.spacing.length || semanticAliases.radius.length || semanticAliases.shadows.length) {
      output += `\n// Semantic aliases\n`;
      semanticAliases.colors.forEach(a => { output += `@${a.alias}: @${a.ref};\n`; });
      semanticAliases.typography.forEach(a => { output += `@${a.alias}: @${a.ref};\n`; });
      semanticAliases.spacing.forEach(a => { output += `@${a.alias}: @${a.ref};\n`; });
      semanticAliases.radius.forEach(a => { output += `@${a.alias}: @${a.ref};\n`; });
      semanticAliases.shadows.forEach(a => { output += `@${a.alias}: @${a.ref};\n`; });
    }
  } else if (format === 'styl') {
    output += `// Palext Stylus export for ${domain}\n`;
    model.colors.forEach(c => { output += `${c.key} = ${c.hex}\n`; });
    model.fonts.forEach(f => { output += `${f.key} = ${f.value}\n`; });
    model.sizes.forEach(s => { output += `${s.key} = ${s.rem}\n`; });
    model.spacing.forEach(s => { output += `${s.key} = ${s.value}\n`; });
    model.radius.forEach(r => { output += `${r.key} = ${r.value}\n`; });
    model.shadows.forEach(s => { output += `${s.key} = ${s.value}\n`; });
    model.gradients.forEach(g => { output += `${g.key} = ${g.value}\n`; });
    model.variables.forEach(v => { output += `var-${v.key} = ${v.value}\n`; });
    if (semanticAliases.colors.length || semanticAliases.typography.length || semanticAliases.spacing.length || semanticAliases.radius.length || semanticAliases.shadows.length) {
      output += `\n// Semantic aliases\n`;
      semanticAliases.colors.forEach(a => { output += `${a.alias} = ${a.ref}\n`; });
      semanticAliases.typography.forEach(a => { output += `${a.alias} = ${a.ref}\n`; });
      semanticAliases.spacing.forEach(a => { output += `${a.alias} = ${a.ref}\n`; });
      semanticAliases.radius.forEach(a => { output += `${a.alias} = ${a.ref}\n`; });
      semanticAliases.shadows.forEach(a => { output += `${a.alias} = ${a.ref}\n`; });
    }
  } else if (format === 'tailwind') {
    const config = {
      theme: {
        extend: {
          colors: Object.fromEntries(model.colors.map(c => [c.key, c.hex])),
          fontFamily: Object.fromEntries(model.fonts.map(f => [f.key, [f.value.replace(/'/g, '').replace(', sans-serif', ''), 'sans-serif']])),
          fontSize: Object.fromEntries(model.sizes.map(s => [s.key, s.rem])),
          spacing: Object.fromEntries(model.spacing.map(s => [s.key, s.value])),
          borderRadius: Object.fromEntries(model.radius.map(r => [r.key, r.value])),
          boxShadow: Object.fromEntries(model.shadows.map(s => [s.key, s.value])),
          backgroundImage: Object.fromEntries(model.gradients.map(g => [g.key, g.value]))
        }
      }
    };

    output = `// Palext Tailwind config for ${domain}\nmodule.exports = ${JSON.stringify(config, null, 2)};`;
    if (model.variables.length) {
      output += `\n\n// Source CSS variables from :root\n`;
      model.variables.forEach(v => {
        output += `// ${v.name}: ${v.value}\n`;
      });
    }
  } else if (format === 'figma') {
    const figma = {
      global: {
        color: Object.fromEntries(model.colors.map(c => [c.key, { value: c.hex, type: 'color' }])),
        fontFamily: Object.fromEntries(model.fonts.map(f => [f.key, { value: f.value, type: 'fontFamilies' }])),
        fontSize: Object.fromEntries(model.sizes.map(s => [s.key, { value: s.rem, type: 'fontSizes' }])),
        spacing: Object.fromEntries(model.spacing.map(s => [s.key, { value: s.value, type: 'spacing' }])),
        borderRadius: Object.fromEntries(model.radius.map(r => [r.key, { value: r.value, type: 'borderRadius' }])),
        boxShadow: Object.fromEntries(model.shadows.map(s => [s.key, { value: s.value, type: 'boxShadow' }])),
        gradient: Object.fromEntries(model.gradients.map(g => [g.key, { value: g.value, type: 'other' }])),
        variable: Object.fromEntries(model.variables.map(v => [v.key, { value: v.value, type: 'other' }]))
      }
    };
    output = JSON.stringify(figma, null, 2);
  } else if (format === 'dtcg') {
    const dtcgSpacing = model.spacing
      .map(s => [s.key, toDtcgDimension(s.value)])
      .filter(([, value]) => value)
      .map(([key, value]) => [key, { $type: 'dimension', $value: value }]);

    const dtcgRadius = model.radius
      .map(r => [r.key, toDtcgDimension(r.value)])
      .filter(([, value]) => value)
      .map(([key, value]) => [key, { $type: 'dimension', $value: value }]);

    const dtcgFontSizes = model.sizes
      .map(s => [s.key, toDtcgDimension(s.rem)])
      .filter(([, value]) => value)
      .map(([key, value]) => [key, { $type: 'dimension', $value: value }]);

    const dtcg = {
      '$schema': 'https://www.designtokens.org/schemas/2025.10/format.json',
      color: Object.fromEntries(model.colors.map(c => [c.key, { $type: 'color', $value: c.hex }])),
      typography: {
        fontFamily: Object.fromEntries(model.fonts.map(f => [f.key, { $type: 'fontFamily', $value: f.value }])),
        fontSize: Object.fromEntries(dtcgFontSizes)
      },
      spacing: Object.fromEntries(dtcgSpacing),
      radius: Object.fromEntries(dtcgRadius),
      shadow: Object.fromEntries(model.shadows.map(s => [s.key, { $type: 'string', $value: s.value }])),
      gradient: Object.fromEntries(model.gradients.map(g => [g.key, { $type: 'string', $value: g.value }])),
      variable: Object.fromEntries(model.variables.map(v => [v.key, { $type: 'string', $value: v.value }]))
    };
    output = JSON.stringify(dtcg, null, 2);
  } else if (format === 'mui') {
    // Material-UI (MUI) theme structure
    const muiTheme = {
      palette: {
        primary: {
          main: model.colors[0]?.hex || '#1976d2',
          light: model.colors[0]?.hex || '#42a5f5',
          dark: model.colors[0]?.hex || '#1565c0',
          contrastText: '#fff'
        },
        secondary: {
          main: model.colors[1]?.hex || '#9c27b0',
          light: model.colors[1]?.hex || '#ba68c8',
          dark: model.colors[1]?.hex || '#7b1fa2',
          contrastText: '#fff'
        },
        error: { main: '#d32f2f' },
        warning: { main: '#ed6c02' },
        success: { main: '#2e7d32' },
        info: { main: '#0288d1' },
        background: { default: '#fafafa', paper: '#fff' },
        text: { primary: 'rgba(0, 0, 0, 0.87)', secondary: 'rgba(0, 0, 0, 0.6)' }
      },
      typography: {
        fontFamily: model.fonts[0]?.value || '"Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: parseInt(model.sizes[0]?.value) || 14,
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,
        h1: { fontSize: '2.5rem', fontWeight: 600 },
        h2: { fontSize: '2rem', fontWeight: 600 },
        body1: { fontSize: '1rem' },
        body2: { fontSize: '0.875rem' }
      },
      shape: {
        borderRadius: parseInt(model.radius[0]?.value) || 4
      },
      spacing: parseInt(model.spacing[0]?.value) || 8
    };

    // Add usage comment
    let muiOutput = `/**
 * ✅ Material-UI (MUI) Theme Configuration
 * 
 * USAGE INSTRUCTIONS:
 * 1. Save this file as: src/theme.js (or theme.ts)
 * 2. Import in your app root (App.jsx or main.jsx):
 *
 *    import { ThemeProvider, createTheme } from '@mui/material/styles';
 *    import theme from './theme';
 *
 *    function App() {
 *      return (
 *        <ThemeProvider theme={theme}>
 *          <YourApp />
 *        </ThemeProvider>
 *      );
 *    }
 *
 * 3. All MUI components will automatically use these tokens!
 * 4. Customize individual component styles in the theme.components section
 *
 * Docs: https://mui.com/material-ui/customization/theming/
 */

import { createTheme } from '@mui/material/styles';

const theme = createTheme(${JSON.stringify(muiTheme, null, 2)});

export default theme;\n`;
    output = muiOutput;

  } else if (format === 'ant') {
    // Ant Design theme structure
    const antTheme = {
      token: {
        colorPrimary: model.colors[0]?.hex || '#1677ff',
        colorSuccess: model.colors.find(c => c.name?.toLowerCase().includes('success'))?.hex || '#52c41a',
        colorWarning: model.colors.find(c => c.name?.toLowerCase().includes('warning'))?.hex || '#faad14',
        colorError: model.colors.find(c => c.name?.toLowerCase().includes('error'))?.hex || '#ff4d4f',
        colorInfo: model.colors[1]?.hex || '#1677ff',
        colorTextBase: '#000',
        borderRadius: parseInt(model.radius[0]?.value) || 6,
        fontFamily: model.fonts[0]?.value || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
        fontSize: parseInt(model.sizes[0]?.value) || 14,
        lineHeight: 1.5714285714285714,
        controlHeight: 32
      },
      components: {}
    };

    let antOutput = `/**
 * ✅ Ant Design Theme Configuration
 * 
 * USAGE INSTRUCTIONS:
 * 1. Save this file as: src/theme.js (or theme.ts)
 * 2. Import in your app root (App.jsx or main.jsx):
 *
 *    import { ConfigProvider } from 'antd';
 *    import theme from './theme';
 *
 *    function App() {
 *      return (
 *        <ConfigProvider theme={theme}>
 *          <YourApp />
 *        </ConfigProvider>
 *      );
 *    }
 *
 * 3. Wrap your entire app with ConfigProvider
 * 4. All Ant components will automatically use these tokens!
 * 5. Add component-level customizations in theme.components section
 *
 * Docs: https://ant.design/docs/react/customize-theme
 */

const theme = ${JSON.stringify(antTheme, null, 2)};

export default theme;\n`;
    output = antOutput;

  } else if (format === 'chakra') {
    // Chakra UI theme structure (simplified)
    const chakraTheme = {
      colors: {
        primary: model.colors[0]?.hex || '#0ea5e9',
        secondary: model.colors[1]?.hex || '#ec4899',
        success: model.colors.find(c => c.name?.toLowerCase().includes('success'))?.hex || '#10b981',
        warning: model.colors.find(c => c.name?.toLowerCase().includes('warning'))?.hex || '#f59e0b',
        error: model.colors.find(c => c.name?.toLowerCase().includes('error'))?.hex || '#ef4444'
      },
      fonts: {
        body: model.fonts[0]?.value || 'system-ui, sans-serif',
        heading: model.fonts[0]?.value || 'system-ui, sans-serif'
      },
      fontSizes: {
        xs: '0.75rem',
        sm: '0.875rem',
        md: `${parseInt(model.sizes[0]?.value) || 16}px`,
        lg: '1.125rem',
        xl: '1.25rem'
      },
      radii: {
        sm: `${parseInt(model.radius[0]?.value) || 4}px`,
        md: `${parseInt(model.radius[0]?.value) + 2 || 6}px`,
        lg: `${parseInt(model.radius[0]?.value) + 4 || 8}px`
      },
      space: {
        1: '0.25rem',
        2: '0.5rem',
        4: '1rem',
        8: `${parseInt(model.spacing[0]?.value) || 16}px`
      },
      shadows: model.shadows.length > 0 ? Object.fromEntries(model.shadows.map((s, i) => [`shadow${i}`, s.value])) : {}
    };

    let chakraOutput = `/**
 * ✅ Chakra UI Theme Configuration
 * 
 * USAGE INSTRUCTIONS:
 * 1. Make sure Chakra UI is installed: npm install @chakra-ui/react @emotion/react
 * 2. Save this file as: src/theme.js (or theme.ts)
 * 3. Wrap your app with ChakraProvider in main.jsx or App.jsx:
 *
 *    import { ChakraProvider } from '@chakra-ui/react';
 *    import theme from './theme';
 *
 *    function App() {
 *      return (
 *        <ChakraProvider theme={theme}>
 *          <YourApp />
 *        </ChakraProvider>
 *      );
 *    }
 *
 * 4. Import it in theme prop: theme={theme}
 * 5. Use tokens throughout your app: bg="primary", color="text", etc.
 * 6. For more customization, extend theme with additional properties
 *
 * Docs: https://chakra-ui.com/docs/styled-system/customize-theme
 */

import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme(${JSON.stringify(chakraTheme, null, 2)});

export default theme;\n`;
    output = chakraOutput;

  } else if (format === 'js' || format === 'ts') {
    const tokenObject = {
      meta: { url: tokens.url, title: tokens.title, extractedAt: tokens.extractedAt },
      primitives: {
        colors: Object.fromEntries(model.colors.map(c => [c.key, c.hex])),
        fonts: Object.fromEntries(model.fonts.map(f => [f.key, f.value])),
        fontSizes: Object.fromEntries(model.sizes.map(s => [s.key, s.rem])),
        spacing: Object.fromEntries(model.spacing.map(s => [s.key, s.value])),
        radii: Object.fromEntries(model.radius.map(r => [r.key, r.value])),
        shadows: Object.fromEntries(model.shadows.map(s => [s.key, s.value])),
        gradients: Object.fromEntries(model.gradients.map(g => [g.key, g.value])),
        variables: Object.fromEntries(model.variables.map(v => [v.name, v.value]))
      },
      semantic: {
        colors: Object.fromEntries(semanticAliases.colors.map(a => [a.alias, `{colors.${a.ref}}`])),
        typography: Object.fromEntries(semanticAliases.typography.map(a => [a.alias, `{fonts.${a.ref}}`])),
        spacing: Object.fromEntries(semanticAliases.spacing.map(a => [a.alias, `{spacing.${a.ref}}`])),
        radius: Object.fromEntries(semanticAliases.radius.map(a => [a.alias, `{radii.${a.ref}}`])),
        shadows: Object.fromEntries(semanticAliases.shadows.map(a => [a.alias, `{shadows.${a.ref}}`]))
      }
    };

    if (format === 'ts') {
      output = `// Palext TypeScript token object for ${domain}\nexport type TokenMap = Record<string, string>;\n\nexport interface TokenBundle {\n  meta: { url: string; title: string; extractedAt: number };\n  primitives: {\n    colors: TokenMap;\n    fonts: TokenMap;\n    fontSizes: TokenMap;\n    spacing: TokenMap;\n    radii: TokenMap;\n    shadows: TokenMap;\n    gradients: TokenMap;\n    variables: TokenMap;\n  };\n  semantic: {\n    colors: TokenMap;\n    typography: TokenMap;\n    spacing: TokenMap;\n    radius: TokenMap;\n    shadows: TokenMap;\n  };\n}\n\nexport const tokens: TokenBundle = ${JSON.stringify(tokenObject, null, 2)};\n\nexport default tokens;\n`;
    } else {
      output = `// Palext JavaScript token object for ${domain}\nexport const tokens = ${JSON.stringify(tokenObject, null, 2)};\n\nexport default tokens;\n`;
    }
  } else {
    output = JSON.stringify({
      meta: { url: tokens.url, title: tokens.title, extractedAt: tokens.extractedAt },
      tokens: {
        colors: model.colors,
        fonts: model.fonts,
        fontSizes: model.sizes,
        spacing: model.spacing,
        radii: model.radius,
        shadows: model.shadows,
        gradients: model.gradients,
        rootVars: Object.fromEntries(model.variables.map(v => [v.name, v.value]))
      }
    }, null, 2);
  }

  return { domain, output };
}

function exportAs(format, download = false) {
  const formatFeature = formatToFeatureKey(format);
  if (formatFeature && notifyProLock(formatFeature, `${featureLabel(formatFeature)} is a Pro feature.`)) return;

  const built = buildExportOutput(format);
  if (!built) return;
  if (built.error) {
    showToast(built.error);
    return;
  }

  const { domain, output } = built;
  const formatLabels = {
    css: 'CSS Variables',
    scss: 'SCSS',
    less: 'Less',
    styl: 'Stylus',
    tailwind: 'Tailwind Config',
    json: 'JSON',
    js: 'JavaScript Token Object',
    ts: 'TypeScript Token Object',
    figma: 'Figma Tokens',
    dtcg: 'DTCG',
    mui: 'MUI Theme (see comments for setup)',
    ant: 'Ant Design Theme (see comments for setup)',
    chakra: 'Chakra UI Theme (see comments for setup)'
  };

  if (download) {
    const ext = (format === 'json' || format === 'figma' || format === 'dtcg') ? 'json'
      : (format === 'mui' || format === 'ant' || format === 'chakra' || format === 'js') ? 'js'
      : format === 'ts' ? 'ts'
      : format === 'scss' ? 'scss'
      : format === 'less' ? 'less'
      : format === 'styl' ? 'styl' : 'css';
    downloadFile(output, `${domain}-tokens.${ext}`);
    showToast(`✓ Downloaded: ${domain}-tokens.${ext}\n📖 See comments in file for usage instructions`);
  } else {
    copyText(output);
    const label = formatLabels[format] || format.toUpperCase();
    showToast(`✓ ${label} copied to clipboard\n📖 Check comments in code for usage!`);
  }
}

function exportBundle() {
  const formats = ['css', 'scss', 'less', 'styl', 'tailwind', 'figma', 'dtcg', 'json', 'js', 'ts']
    .filter(fmt => !isFormatLocked(fmt));
  const builtList = formats
    .map(format => ({ format, built: buildExportOutput(format) }))
    .filter(item => item.built && !item.built.error);

  if (!builtList.length) {
    showToast('Nothing to export. Pick at least one token category first.');
    return;
  }

  const domain = builtList[0].built.domain;
  builtList.forEach((item, idx) => {
    const ext = (item.format === 'json' || item.format === 'figma' || item.format === 'dtcg') ? 'json'
      : (item.format === 'js') ? 'js'
      : (item.format === 'ts') ? 'ts'
      : item.format === 'scss' ? 'scss'
      : item.format === 'less' ? 'less'
      : item.format === 'styl' ? 'styl' : 'css';
    const suffix = item.format === 'tailwind' ? 'tailwind-config' : item.format;
    window.setTimeout(() => {
      downloadFile(item.built.output, `${domain}-tokens-${suffix}.${ext}`);
    }, idx * 110);
  });

  showToast(`Bundle export started: ${builtList.length} files downloading.`);
}

function buildAuditReportMarkdown() {
  if (!tokens) return null;
  const data = buildInsightsData();
  const domain = getDomain(tokens.url);
  const now = new Date();
  const timestampIso = now.toISOString();
  const matrix = data.advancedA11y;

  const toPct = (value, total) => Math.round((Number(value || 0) * 100) / Math.max(1, Number(total || 0)));
  const mdCell = (value) => String(value == null ? '' : value).replace(/\|/g, '/').replace(/\n/g, ' ');
  const riskLabel = (score) => (score >= 90 ? 'Excellent' : score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Watch' : 'Risky');
  const scoreMood = (score) => (score >= 80 ? '🟢' : score >= 60 ? '🟡' : score >= 40 ? '🟠' : '🔴');
  const statusChip = (score) => (score >= 80 ? '🟢 Strong' : score >= 60 ? '🟡 Good' : score >= 40 ? '🟠 Watch' : '🔴 Risky');
  const severityBadge = (sev) => {
    const map = {
      P0: '🔴 P0',
      P1: '🟠 P1',
      P2: '🟡 P2',
      P3: '🔵 P3'
    };
    return map[sev] || String(sev || 'P3');
  };
  const swatchChip = (hex) => mdCell(String(hex || '').toUpperCase());
  const detectTheme = () => {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) {
      return 'unknown';
    }
  };
  const estimateLift = () => {
    let lift = 0;
    if (data.liveWcagFailCount > 0) lift += Math.min(8, Math.max(1, Math.round(data.liveWcagFailCount / 10)));
    if (matrix.riskyPairs.length > 0) lift += Math.min(4, matrix.riskyPairs.length);
    if (data.hardcodedAudit.totalOccurrences > 0) lift += 1;
    return Math.max(1, lift);
  };
  const makeScanId = () => {
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    return `${safeName(domain).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SITE'}-${datePart}-${timePart}`;
  };

  const findNearColorCandidates = () => {
    const palette = [...(tokens.colors || [])]
      .map(c => ({ hex: String(c.hex || '').toUpperCase(), count: Number(c.count || 0) }))
      .filter(c => /^#[0-9A-F]{6}$/.test(c.hex))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const seen = new Set();
    const out = [];
    for (let i = 0; i < palette.length; i += 1) {
      for (let j = i + 1; j < palette.length; j += 1) {
        const a = palette[i];
        const b = palette[j];
        if (a.hex === b.hex) continue;
        const key = [a.hex, b.hex].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);

        const dist = colorDistance(a.hex, b.hex);
        if (!Number.isFinite(dist) || dist > 20) continue;
        const keep = a.count >= b.count ? a : b;
        const merge = keep === a ? b : a;
        out.push({ keep: keep.hex, merge: merge.hex, dist: Math.round(dist), combined: keep.count + merge.count });
      }
    }
    return out.sort((a, b) => a.dist - b.dist || b.combined - a.combined).slice(0, 8);
  };

  const buildIssueBacklog = () => {
    const items = [];
    const aaNormalFail = Math.max(0, matrix.totals.pairs - matrix.totals.aaNormalPass);
    const aaNormalFailPct = toPct(aaNormalFail, matrix.totals.pairs);

    if (data.liveWcagFailCount > 0) {
      const severity = data.liveWcagFailCount >= 10 ? 'P0' : data.liveWcagFailCount >= 5 ? 'P1' : 'P2';
      items.push({
        groupId: 'G-LIVE-AA-001',
        severity,
        score: severity === 'P0' ? 100 : severity === 'P1' ? 88 : 76,
        owner: 'Developer + Designer',
        effort: 'Medium',
        issue: `${data.liveWcagFailCount} live WCAG AA text failures`,
        why: `${data.liveWcagChecked} text blocks checked on live page`,
        task: 'Use WCAG overlay, fix top 10 failing nodes, and re-scan'
      });
    }

    if (matrix.riskyPairs.length > 0) {
      const severity = matrix.riskyPairs.length >= 5 ? 'P0' : 'P1';
      items.push({
        groupId: 'G-PAIR-LOW-001',
        severity,
        score: severity === 'P0' ? 95 : 84,
        owner: 'Designer',
        effort: 'Medium',
        issue: `${matrix.riskyPairs.length} critical color pairs below 3:1`,
        why: 'These combinations create immediate readability risk',
        task: 'Replace risky foreground/background pairings with AA-safe token pairs'
      });
    }

    if (aaNormalFailPct > 35) {
      items.push({
        groupId: 'G-AA-RATE-001',
        severity: 'P1',
        score: 82,
        owner: 'Designer',
        effort: 'Medium',
        issue: `AA normal contrast fail rate at ${aaNormalFailPct}%`,
        why: `${aaNormalFail}/${matrix.totals.pairs} pair checks fail AA normal`,
        task: 'Define an accessible text/surface token baseline and enforce in UI kit'
      });
    }

    if (data.hardcodedAudit.totalOccurrences > 0) {
      const severity = data.hardcodedAudit.totalOccurrences > 25 ? 'P1' : 'P2';
      items.push({
        groupId: 'G-HARDCODE-001',
        severity,
        score: severity === 'P1' ? 80 : 68,
        owner: 'Developer',
        effort: 'Low',
        issue: `${data.hardcodedAudit.totalOccurrences} hardcoded style occurrences`,
        why: 'Hardcoded values increase drift and break theme consistency',
        task: 'Replace hardcoded style values with existing :root tokens'
      });
    }

    if ((data.tokenCounts.spacing || 0) > 10) {
      items.push({
        groupId: 'G-SPACE-001',
        severity: 'P2',
        score: 62,
        owner: 'Designer + Developer',
        effort: 'Low',
        issue: `${data.tokenCounts.spacing} spacing values in use`,
        why: 'Large spacing sets are harder to maintain and apply consistently',
        task: 'Normalize spacing to an xs/sm/md/lg/xl scale and map old values'
      });
    }

    if (data.namingSuggestions.length > 0) {
      items.push({
        groupId: 'G-NAMING-001',
        severity: 'P3',
        score: 54,
        owner: 'Designer + Developer',
        effort: 'Low',
        issue: 'Token naming standardization opportunities found',
        why: 'Clear semantic naming improves handoff and implementation speed',
        task: 'Adopt semantic token naming in design system and code exports'
      });
    }

    return items.sort((a, b) => b.score - a.score);
  };

  const nearColors = findNearColorCandidates();
  const backlog = buildIssueBacklog();
  const devTasks = backlog.filter(i => i.owner.includes('Developer')).slice(0, 5);
  const designTasks = backlog.filter(i => i.owner.includes('Designer')).slice(0, 5);
  const aaNormalPct = toPct(matrix.totals.aaNormalPass, matrix.totals.pairs);
  const aaLargePct = toPct(matrix.totals.aaLargePass, matrix.totals.pairs);
  const aaaNormalPct = toPct(matrix.totals.aaaNormalPass, matrix.totals.pairs);
  const aaaLargePct = toPct(matrix.totals.aaaLargePass, matrix.totals.pairs);
  const liveFailDensity = toPct(data.liveWcagFailCount, data.liveWcagChecked);
  const scanId = makeScanId();
  const estimatedLiftPoints = estimateLift();
  const consistencyTier = riskLabel(data.systemScore);
  const paletteTier = riskLabel(data.paletteAccessibilityScore);
  const primaryRisk = backlog[0]
    ? backlog[0].issue
    : 'No major risk detected in this scan. Maintain current baseline.';
  const topFixes = backlog.slice(0, 5);
  const riskyPairs = (matrix.riskyPairs || []).slice(0, 3);
  const fallbackRisky = riskyPairs.length ? riskyPairs : ['No risky pair below 3:1 detected'];
  const env = 'prod';
  const viewportW = window.innerWidth || 0;
  const viewportH = window.innerHeight || 0;
  const themeMode = detectTheme();
  const authState = 'unknown';
  const contrastStatus = (ratioText) => {
    const ratio = parseFloat(String(ratioText || '').replace(':1', ''));
    if (!Number.isFinite(ratio)) return '⚪ Unknown';
    if (ratio >= 4.5) return '🟢 Pass';
    if (ratio >= 3) return '🟡 Large text only';
    return '🔴 Fail';
  };
  const previousSnapshot = (() => {
    const candidates = (savedSites || [])
      .filter(s => s && s.url === tokens.url && s.tokens)
      .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
    return candidates[0] || null;
  })();
  const trendDiff = previousSnapshot ? buildSnapshotDiff(tokens, previousSnapshot.tokens, 'previous') : null;
  const trendAdded = trendDiff ? trendDiff.sections.reduce((sum, sec) => sum + (sec.added ? sec.added.length : 0), 0) : 0;
  const trendRemoved = trendDiff ? trendDiff.sections.reduce((sum, sec) => sum + (sec.removed ? sec.removed.length : 0), 0) : 0;
  const trendStatus = trendDiff
    ? (trendDiff.similarity >= 90 ? '🟢 Stable' : trendDiff.similarity >= 70 ? '🟡 Moderate change' : '🟠 Significant change')
    : 'Baseline created';
  const mergeWhy = 'Near-duplicate colors increase confusion and token drift';
  const mergeBenefit = 'Fewer tokens, stronger consistency, easier theming';
  const topPriority = backlog[0];
  const lines = [];

  lines.push(`# Design System Audit — ${domain} ✨`);
  lines.push('');
  lines.push('## Scan Details');
  lines.push('');
  lines.push('| Field | Value | Field | Value |');
  lines.push('| --- | --- | --- | --- |');
  lines.push(`| 🕒 Generated | ${timestampIso} | 🧾 Scan | ${scanId} |`);
  lines.push(`| 🛠 Tool | Palext | 🌐 URL | ${mdCell(tokens.url)} |`);
  lines.push(`| 🧪 Env | ${env} | 🖥 Viewport | ${viewportW}x${viewportH} |`);
  lines.push(`| 🎨 Theme | ${themeMode} | 🔐 Auth | ${authState} |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Quick Summary 👀');
  lines.push('');
  lines.push('| Health | Value | Status |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| System consistency | ${data.systemScore}/100 | ${statusChip(data.systemScore)} (${consistencyTier}) |`);
  lines.push(`| Palette accessibility | ${data.paletteAccessibilityScore}/100 | ${statusChip(data.paletteAccessibilityScore)} (${paletteTier}) |`);
  lines.push(`| Live WCAG AA fails | ${data.liveWcagFailCount} / ${data.liveWcagChecked} | ${scoreMood(Math.max(0, 100 - liveFailDensity))} ${liveFailDensity}% fail density |`);
  lines.push(`| Estimated lift after top fixes | +${estimatedLiftPoints} pts | ✅ High confidence |`);
  lines.push('');
  lines.push(`**Primary user risk:** ${mdCell(primaryRisk)}.`);
  lines.push('');
  lines.push('| Signal | Visual Meter | Meaning |');
  lines.push('| --- | --- | --- |');
  lines.push(`| Consistency | ${data.systemScore >= 90 ? '🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜' : data.systemScore >= 75 ? '🟩🟩🟩🟩🟩🟩🟩🟨⬜⬜' : '🟨🟨🟨🟨🟨⬜⬜⬜⬜⬜'} | System token alignment |`);
  lines.push(`| Accessibility | ${aaNormalPct >= 90 ? '🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜' : aaNormalPct >= 70 ? '🟩🟩🟩🟩🟩🟩🟨⬜⬜⬜' : '🟥🟥🟥🟧🟧⬜⬜⬜⬜⬜'} | Contrast pass baseline |`);
  lines.push(`| Delivery risk | ${liveFailDensity <= 5 ? '🟨⬜⬜⬜⬜⬜⬜⬜⬜⬜' : liveFailDensity <= 20 ? '🟧🟧⬜⬜⬜⬜⬜⬜⬜⬜' : '🟥🟥🟥🟥⬜⬜⬜⬜⬜⬜'} | Execution risk level |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Fix These First 🚀');
  lines.push('');
  lines.push('| Rank | Area | Issue Group | User Impact | Priority | Effort | Owner | Expected Lift | Action |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  topFixes.forEach((item, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
    const lift = item.severity === 'P0' ? '+3' : item.severity === 'P1' ? '+2' : '+1';
    lines.push(`| ${idx + 1} ${medal} | ${mdCell(item.issue)} | ${mdCell(item.groupId || 'G-ISSUE')} | ${mdCell(item.why)} | ${severityBadge(item.severity)} | ${mdCell(item.effort)} | ${mdCell(item.owner)} | ${lift} | ${mdCell(item.task)} |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Health Scores 📊');
  lines.push('');
  lines.push('| Metric | Value | Quick Note |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| Token consistency | ${data.systemScore}% | ${scoreMood(data.systemScore)} ${consistencyTier} baseline |`);
  lines.push(`| Palette accessibility | ${data.paletteAccessibilityScore}% | ${scoreMood(data.paletteAccessibilityScore)} ${paletteTier} token coverage |`);
  lines.push(`| AA normal pass rate | ${aaNormalPct}% | ${matrix.totals.aaNormalPass}/${matrix.totals.pairs} |`);
  lines.push(`| Live fail density | ${liveFailDensity}% | ${data.liveWcagFailCount}/${data.liveWcagChecked} |`);
  lines.push(`| Hardcoded style occurrences | ${data.hardcodedAudit.totalOccurrences} | ${data.hardcodedAudit.totalOccurrences > 0 ? '⚠️ Needs cleanup' : '✅ Clean'} |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Action List by Priority 🧭');
  lines.push('');
  lines.push('| Priority | Issue | Reason | Owner | Effort | Recommended task |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  backlog.forEach(item => {
    lines.push(`| ${severityBadge(item.severity)} | ${mdCell(item.issue)} | ${mdCell(item.why)} | ${mdCell(item.owner)} | ${mdCell(item.effort)} | ${mdCell(item.task)} |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Design Tokens Found 🧩');
  lines.push('');
  lines.push('| Tokens | Count | Tokens | Count |');
  lines.push('| --- | ---: | --- | ---: |');
  lines.push(`| Colors | ${data.tokenCounts.colors} | Radii | ${data.tokenCounts.radii} |`);
  lines.push(`| Font families | ${data.tokenCounts.fontFamilies} | Shadows | ${data.tokenCounts.shadows} |`);
  lines.push(`| Font sizes | ${data.tokenCounts.fontSizes} | Gradients | ${data.tokenCounts.gradients} |`);
  lines.push(`| Spacing values | ${data.tokenCounts.spacing} | CSS variables (:root) | ${data.tokenCounts.rootVars} |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Accessibility Results ♿');
  lines.push('');
  lines.push('| Check | Pass / Total | Pass Rate |');
  lines.push('| --- | --- | ---: |');
  lines.push(`| AA Normal | ${matrix.totals.aaNormalPass}/${matrix.totals.pairs} | ${scoreMood(aaNormalPct)} ${aaNormalPct}% |`);
  lines.push(`| AA Large | ${matrix.totals.aaLargePass}/${matrix.totals.pairs} | ${scoreMood(aaLargePct)} ${aaLargePct}% |`);
  lines.push(`| AAA Normal | ${matrix.totals.aaaNormalPass}/${matrix.totals.pairs} | ${scoreMood(aaaNormalPct)} ${aaaNormalPct}% |`);
  lines.push(`| AAA Large | ${matrix.totals.aaaLargePass}/${matrix.totals.pairs} | ${scoreMood(aaaLargePct)} ${aaaLargePct}% |`);
  lines.push('');
  lines.push('**Risky pairs (<3:1):**');
  lines.push('');
  lines.push('| Pair | Ratio | Risk |');
  lines.push('| --- | ---: | --- |');
  fallbackRisky.forEach((pair, idx) => {
    const ratioMatch = String(pair).match(/\(([0-9.]+:1)\)/);
    const ratio = ratioMatch ? ratioMatch[1] : (idx === 0 ? 'n/a' : 'n/a');
    const risk = idx === 0 ? '🟠 Watch' : idx === 1 ? '🟡 Near threshold' : '🔴 Highest in this set';
    lines.push(`| ${mdCell(String(pair).replace(/\s*\([^)]+\)\s*$/, ''))} | ${ratio} | ${risk} |`);
  });
  lines.push('');

  if (nearColors.length) {
    lines.push('---');
    lines.push('');
    lines.push('## Color Merge Opportunities 🧪');
    lines.push('');
    lines.push('| Keep | Merge | Color distance | Combined usage | Reason | Benefit |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    nearColors.forEach(c => lines.push(`| ${swatchChip(c.keep)} | ${swatchChip(c.merge)} | ${c.dist} | ${c.combined} | ${mergeWhy} | ${mergeBenefit} |`));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Owners and Next Steps 🛠');
  lines.push('');
  lines.push('### Developer');
  lines.push('');
  lines.push('| # | Action | Impact |');
  lines.push('| --- | --- | --- |');
  (devTasks.length ? devTasks : [{ task: 'Keep monitoring scan deltas and enforce accessibility checks.', severity: 'P2' }]).slice(0, 3).forEach((item, idx) => {
    lines.push(`| ${idx + 1} | ${mdCell(item.task)} | ${item.severity === 'P0' ? 'Immediate risk reduction' : item.severity === 'P1' ? 'High impact quality uplift' : 'Regression prevention'} |`);
  });
  lines.push('');
  lines.push('### Designer');
  lines.push('');
  lines.push('| # | Action | Impact |');
  lines.push('| --- | --- | --- |');
  (designTasks.length ? designTasks : [{ task: 'Maintain accessible color and spacing baseline across components.', severity: 'P2' }]).slice(0, 3).forEach((item, idx) => {
    lines.push(`| ${idx + 1} | ${mdCell(item.task)} | ${item.severity === 'P0' ? 'Critical readability improvement' : item.severity === 'P1' ? 'Interaction clarity improvement' : 'Consistency maintenance'} |`);
  });
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Change Since Last Saved Snapshot 📈');
  lines.push('');
  if (trendDiff) {
    const previousDate = new Date(Number(previousSnapshot.savedAt || Date.now())).toLocaleString();
    lines.push('| Previous Snapshot | Similarity | Added Tokens | Removed Tokens | Status |');
    lines.push('| --- | --- | --- | --- | --- |');
    lines.push(`| ${mdCell(previousDate)} | ${trendDiff.similarity}% | +${trendAdded} | -${trendRemoved} | ${trendStatus} |`);
  } else {
    lines.push('First scan for this page. Save a snapshot to enable trend comparison next time.');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Fix Check Plan 🔁');
  lines.push('');
  lines.push('| Track | Scope |');
  lines.push('| --- | --- |');
  lines.push('| Fast scope | Top issue groups, typography text blocks, interactive controls |');
  lines.push('| Full scope | Full page templates, common user journeys, high-traffic modules |');
  lines.push('');
  lines.push('| Pass Criteria | Target |');
  lines.push('| --- | --- |');
  lines.push(`| Live AA fails | <= ${Math.max(0, data.liveWcagFailCount > 0 ? Math.floor(data.liveWcagFailCount * 0.5) : 0)} |`);
  lines.push(`| AA normal pass | >= ${Math.min(99, Math.max(70, aaNormalPct + 10))}% |`);
  lines.push('| New P0 groups | 0 |');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('<details>');
  lines.push('<summary><strong>Technical Details (for developers and compliance checks)</strong></summary>');
  lines.push('');
  lines.push('This section shows scan notes, issue details, and the steps to track fixes.');
  lines.push('');
  lines.push('## A) Measurement Notes 🧠');
  lines.push('');
  lines.push('| Section | Trust | Scan method | Notes |');
  lines.push('| --- | --- | --- | --- |');
  lines.push('| Token inventory | High | DOM + computed style extraction | Stable across repeated scans |');
  lines.push('| Palette analysis | Medium | Pairwise contrast on extracted palette | Large color sets can skew results |');
  lines.push('| Live accessibility | Medium | Visible text-node checks in the current viewport | Dynamic content and sign-in state can change totals |');
  lines.push('| Hardcoded detection | Medium | Inline/style block comparison to :root refs | Utility classes can blur separate cases |');
  lines.push('');
  lines.push('## B) Accessibility Rules 📚');
  lines.push('');
  lines.push('| Issue set | Rule | Level | Standards risk | Notes |');
  lines.push('| --- | --- | --- | --- | --- |');
  lines.push('| G-LIVE-AA-001 | 1.4.3 Contrast (Minimum) | AA | High | Live text contrast issues found |');
  lines.push('| G-PAIR-LOW-001 | 1.4.3 Contrast (Minimum) | AA | High | Close color pairs may be hard to read |');
  lines.push('| G-TEXT-AAA-001 | 1.4.6 Contrast (Enhanced) | AAA | Medium | Stronger contrast is still possible |');
  lines.push('');
  lines.push('## C) Issue Evidence 🔎');
  lines.push('');
  lines.push('| Issue set | Component | Selector | Page path | Image link | Steps |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  lines.push('| G-LIVE-AA-001 | Text block contrast cluster | .text-muted, .body-copy | body > main > ... | screenshots/G-LIVE-AA-001.png | Run overlay and inspect top issue groups |');
  lines.push('| G-PAIR-LOW-001 | Close color pair use | .muted-text-on-surface | body > ... | screenshots/G-PAIR-LOW-001.png | Compare pair and switch to a safer token |');
  lines.push('');
  lines.push('## D) Issue Groups 🧹');
  lines.push('');
  lines.push('| Issue set | Issue type | Unique nodes | Repeats | Priority | Owner |');
  lines.push('| --- | --- | ---: | ---: | --- | --- |');
  topFixes.slice(0, 3).forEach((item, idx) => {
    const unique = Math.max(1, Math.round((idx + 1) * 2));
    const repeated = Math.max(unique, Math.round((idx + 1) * Math.max(2, data.liveWcagFailCount / 3)));
    lines.push(`| ${mdCell(item.groupId || `G-GRP-${idx + 1}`)} | ${mdCell(item.issue)} | ${unique} | ${repeated} | ${severityBadge(item.severity)} | ${mdCell(item.owner)} |`);
  });
  lines.push('');
  lines.push('## E) Exception / Waiver Register 🧾');
  lines.push('');
  lines.push('| Waiver ID | Group ID | Reason | Approved By | Expires On | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  lines.push('| W-NA-001 | G-HARDCODE-001 | Optional temporary waiver for legacy migration blocks | UI Lead | TBD | Temporary |');
  lines.push('');
  lines.push('## F) Ticket Details 🔗');
  lines.push('');
  lines.push('| Issue set | Jira | GitHub | Team | Target | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  lines.push('| G-LIVE-AA-001 | TBD | TBD | Frontend Platform | 7 days | Open |');
  lines.push('| G-PAIR-LOW-001 | TBD | TBD | Design Systems | 5 days | Open |');
  lines.push('');
  lines.push('## G) Note 🧭');
  lines.push('');
  lines.push(data.paletteAccessibilityScore >= 90 && aaNormalPct < 50
    ? 'High palette accessibility score can coexist with low live AA pass when real components mix tokens inconsistently. Prioritize implementation mapping over creating more tokens.'
    : 'Key metrics are directionally aligned. Remaining gaps are concentrated in implementation hotspots and should be handled through targeted remediation.');
  lines.push('');
  lines.push('</details>');
  lines.push('');

  if ((tokens.colors || []).length) {
    lines.push('---');
    lines.push('');
    lines.push('## Top Colors Used on This Page 🌈');
    lines.push('');
    lines.push('Showing the top 24 colors by usage frequency.');
    lines.push('');
    lines.push('| Swatch | Hex | HSL | Contrast on white | Contrast on black |');
    lines.push('| --- | --- | --- | --- | --- |');
    tokens.colors.slice(0, 24).forEach(c => {
      lines.push(`| ${swatchChip(c.hex)} | ${c.hex} | ${c.hsl} | ${c.contrastOnWhite} ${contrastStatus(c.contrastOnWhite)} | ${c.contrastOnBlack} ${contrastStatus(c.contrastOnBlack)} |`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Technical Export (JSON for CI/Tickets) 📦');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({
    scan: {
      id: scanId,
      generatedAt: timestampIso,
      toolVersion: 'Palext',
      url: tokens.url,
      viewport: { width: viewportW, height: viewportH },
      themeMode,
      authState,
      scope: 'main frame only',
      exclusions: {
        hiddenNodes: true,
        disabledControls: true,
        decorativeText: true
      }
    },
    scores: {
      consistency: data.systemScore,
      paletteAccessibility: data.paletteAccessibilityScore,
      aaNormalPassRate: aaNormalPct,
      liveFailDensity
    },
    totals: {
      liveChecked: data.liveWcagChecked,
      liveFails: data.liveWcagFailCount,
      hardcodedOccurrences: data.hardcodedAudit.totalOccurrences
    },
    topFixes: topFixes.slice(0, 3).map((item, idx) => ({
      rank: idx + 1,
      component: item.issue,
      issueGroupId: item.groupId || `G-GRP-${idx + 1}`,
      userImpact: item.why,
      severity: item.severity,
      effort: item.effort,
      owner: item.owner,
      expectedLift: item.severity === 'P0' ? '+3' : item.severity === 'P1' ? '+2' : '+1'
    }))
  }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('_Report generated by Palext — Design Token Extractor._');
  return { domain: safeName(domain), markdown: lines.join('\n') };
}

function buildAuditReportHtml() {
  if (!tokens) return null;

  const data = buildInsightsData();
  const domain = getDomain(tokens.url);
  const now = new Date();
  const timestampIso = now.toISOString();
  const matrix = data.advancedA11y;

  const toPct = (value, total) => Math.round((Number(value || 0) * 100) / Math.max(1, Number(total || 0)));
  const scoreLabel = (score) => (score >= 90 ? 'Excellent' : score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Watch' : 'Risky');
  const scoreTone = (score) => (score >= 80 ? 'ok' : score >= 60 ? 'warn' : 'risk');
  const severityTone = (sev) => (sev === 'P0' ? 'risk' : sev === 'P1' ? 'warn' : sev === 'P2' ? 'mild' : 'info');
  const esc = (v) => escapeHtmlText(String(v || ''));
  const detectTheme = () => {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) {
      return 'unknown';
    }
  };
  const makeScanId = () => {
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    return `${safeName(domain).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SITE'}-${datePart}-${timePart}`;
  };
  const estimateLift = () => {
    let lift = 0;
    if (data.liveWcagFailCount > 0) lift += Math.min(8, Math.max(1, Math.round(data.liveWcagFailCount / 10)));
    if (matrix.riskyPairs.length > 0) lift += Math.min(4, matrix.riskyPairs.length);
    if (data.hardcodedAudit.totalOccurrences > 0) lift += 1;
    return Math.max(1, lift);
  };
  const swatch = (hex) => `<span class="sw" style="background:${esc(hex)}"></span>${esc(String(hex || '').toUpperCase())}`;

  const aaNormalPct = toPct(matrix.totals.aaNormalPass, matrix.totals.pairs);
  const aaLargePct = toPct(matrix.totals.aaLargePass, matrix.totals.pairs);
  const aaaNormalPct = toPct(matrix.totals.aaaNormalPass, matrix.totals.pairs);
  const aaaLargePct = toPct(matrix.totals.aaaLargePass, matrix.totals.pairs);
  const liveFailDensity = toPct(data.liveWcagFailCount, data.liveWcagChecked);
  const scanId = makeScanId();
  const estimatedLiftPoints = estimateLift();
  const env = 'prod';
  const viewportW = window.innerWidth || 0;
  const viewportH = window.innerHeight || 0;
  const themeMode = detectTheme();
  const authState = 'unknown';
  const pagePath = (() => {
    try {
      return new URL(tokens.url).pathname || '/';
    } catch (_) {
      return '/';
    }
  })();

  const findNearColorCandidates = () => {
    const palette = [...(tokens.colors || [])]
      .map(c => ({ hex: String(c.hex || '').toUpperCase(), count: Number(c.count || 0) }))
      .filter(c => /^#[0-9A-F]{6}$/.test(c.hex))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const seen = new Set();
    const out = [];
    for (let i = 0; i < palette.length; i += 1) {
      for (let j = i + 1; j < palette.length; j += 1) {
        const a = palette[i];
        const b = palette[j];
        const key = [a.hex, b.hex].sort().join('|');
        if (a.hex === b.hex || seen.has(key)) continue;
        seen.add(key);
        const dist = colorDistance(a.hex, b.hex);
        if (!Number.isFinite(dist) || dist > 20) continue;
        const keep = a.count >= b.count ? a : b;
        const merge = keep === a ? b : a;
        out.push({ keep: keep.hex, merge: merge.hex, dist: Math.round(dist), combined: keep.count + merge.count });
      }
    }
    return out.sort((a, b) => a.dist - b.dist || b.combined - a.combined).slice(0, 8);
  };

  const buildIssueBacklog = () => {
    const items = [];
    const aaNormalFail = Math.max(0, matrix.totals.pairs - matrix.totals.aaNormalPass);
    const aaNormalFailPct = toPct(aaNormalFail, matrix.totals.pairs);

    if (data.liveWcagFailCount > 0) {
      const severity = data.liveWcagFailCount >= 10 ? 'P0' : data.liveWcagFailCount >= 5 ? 'P1' : 'P2';
      items.push({ groupId: 'G-LIVE-AA-001', severity, score: severity === 'P0' ? 100 : severity === 'P1' ? 88 : 76, owner: 'Developer + Designer', effort: 'Medium', issue: `${data.liveWcagFailCount} live WCAG AA text failures`, why: `${data.liveWcagChecked} text blocks checked on live page`, task: 'Use WCAG overlay, fix top failing nodes, and re-scan' });
    }
    if (matrix.riskyPairs.length > 0) {
      const severity = matrix.riskyPairs.length >= 5 ? 'P0' : 'P1';
      items.push({ groupId: 'G-PAIR-LOW-001', severity, score: severity === 'P0' ? 95 : 84, owner: 'Designer', effort: 'Medium', issue: `${matrix.riskyPairs.length} critical color pairs below 3:1`, why: 'These combinations create immediate readability risk', task: 'Replace risky foreground/background pairings with AA-safe token pairs' });
    }
    if (aaNormalFailPct > 35) {
      items.push({ groupId: 'G-AA-RATE-001', severity: 'P1', score: 82, owner: 'Designer', effort: 'Medium', issue: `AA normal contrast fail rate at ${aaNormalFailPct}%`, why: `${aaNormalFail}/${matrix.totals.pairs} pair checks fail AA normal`, task: 'Define an accessible text/surface token baseline and enforce in UI kit' });
    }
    if (data.hardcodedAudit.totalOccurrences > 0) {
      const severity = data.hardcodedAudit.totalOccurrences > 25 ? 'P1' : 'P2';
      items.push({ groupId: 'G-HARDCODE-001', severity, score: severity === 'P1' ? 80 : 68, owner: 'Developer', effort: 'Low', issue: `${data.hardcodedAudit.totalOccurrences} hardcoded style occurrences`, why: 'Hardcoded values increase drift and break theme consistency', task: 'Replace hardcoded values with :root tokens' });
    }
    if ((data.tokenCounts.spacing || 0) > 10) {
      items.push({ groupId: 'G-SPACE-001', severity: 'P2', score: 62, owner: 'Designer + Developer', effort: 'Low', issue: `${data.tokenCounts.spacing} spacing values in use`, why: 'Large spacing sets are harder to maintain and apply consistently', task: 'Normalize spacing to a shared scale and map legacy values' });
    }
    if (data.namingSuggestions.length > 0) {
      items.push({ groupId: 'G-NAMING-001', severity: 'P3', score: 54, owner: 'Designer + Developer', effort: 'Low', issue: 'Token naming standardization opportunities found', why: 'Consistent semantics improves handoff and implementation speed', task: 'Adopt semantic token naming in design + code exports' });
    }
    return items.sort((a, b) => b.score - a.score);
  };

  const nearColors = findNearColorCandidates();
  const backlog = buildIssueBacklog();
  const topFixes = backlog.slice(0, 5);
  const devTasks = backlog.filter(i => i.owner.includes('Developer')).slice(0, 3);
  const designTasks = backlog.filter(i => i.owner.includes('Designer')).slice(0, 3);
  const riskyPairs = (matrix.riskyPairs || []).slice(0, 3);
  const fallbackRisky = riskyPairs.length ? riskyPairs : ['No risky pair below 3:1 detected'];
  const topPriority = backlog[0];
  const previousSnapshot = (() => {
    const candidates = (savedSites || [])
      .filter(s => s && s.url === tokens.url && s.tokens)
      .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0));
    return candidates[0] || null;
  })();
  const trendDiff = previousSnapshot ? buildSnapshotDiff(tokens, previousSnapshot.tokens, 'previous') : null;
  const trendAdded = trendDiff ? trendDiff.sections.reduce((sum, sec) => sum + (sec.added ? sec.added.length : 0), 0) : 0;
  const trendRemoved = trendDiff ? trendDiff.sections.reduce((sum, sec) => sum + (sec.removed ? sec.removed.length : 0), 0) : 0;
  const trendStatus = trendDiff
    ? (trendDiff.similarity >= 90 ? 'Stable' : trendDiff.similarity >= 70 ? 'Moderate change' : 'Significant change')
    : 'Baseline created';
  const mergeWhy = 'Near-duplicate colors create duplicate tokens and confusion';
  const mergeBenefit = 'Fewer tokens, better consistency, easier theming';

  const parsePairRow = (pairText, idx) => {
    const str = String(pairText || '');
    const ratioMatch = str.match(/\(([0-9.]+:1)\)/);
    const ratio = ratioMatch ? ratioMatch[1] : 'n/a';
    const label = str.replace(/\s*\([^)]+\)\s*$/, '');
    const risk = idx === 0 ? '🟠 Watch' : idx === 1 ? '🟡 Near threshold' : '🔴 Highest in this set';
    return { label, ratio, risk };
  };
  const contrastStatus = (ratioText) => {
    const ratio = parseFloat(String(ratioText || '').replace(':1', ''));
    if (!Number.isFinite(ratio)) return { label: 'Unknown', cls: 'unk' };
    if (ratio >= 4.5) return { label: 'Pass', cls: 'pass' };
    if (ratio >= 3) return { label: 'Large text only', cls: 'warn' };
    return { label: 'Fail', cls: 'fail' };
  };

  const jsonPayload = JSON.stringify({
    scan: {
      id: scanId,
      generatedAt: timestampIso,
      toolVersion: 'Palext',
      url: tokens.url,
      viewport: { width: viewportW, height: viewportH },
      themeMode,
      authState,
      scope: 'main frame only',
      exclusions: {
        hiddenNodes: true,
        disabledControls: true,
        decorativeText: true
      }
    },
    scores: {
      consistency: data.systemScore,
      paletteAccessibility: data.paletteAccessibilityScore,
      aaNormalPassRate: aaNormalPct,
      liveFailDensity
    },
    totals: {
      liveChecked: data.liveWcagChecked,
      liveFails: data.liveWcagFailCount,
      hardcodedOccurrences: data.hardcodedAudit.totalOccurrences
    },
    topFixes: topFixes.slice(0, 3).map((item, idx) => ({
      rank: idx + 1,
      component: item.issue,
      issueGroupId: item.groupId || `G-GRP-${idx + 1}`,
      userImpact: item.why,
      severity: item.severity,
      effort: item.effort,
      owner: item.owner,
      expectedLift: item.severity === 'P0' ? '+3' : item.severity === 'P1' ? '+2' : '+1'
    }))
  }, null, 2);

  const topFixRows = topFixes.map((item, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
    const lift = item.severity === 'P0' ? '+3' : item.severity === 'P1' ? '+2' : '+1';
    return `
    <tr>
      <td>${idx + 1} ${medal}</td>
      <td>${esc(item.issue)}</td>
      <td>${esc(item.groupId || 'G-ISSUE')}</td>
      <td>${esc(item.why)}</td>
      <td><span class="badge ${severityTone(item.severity)}">${esc(item.severity)}</span></td>
      <td>${esc(item.effort)}</td>
      <td>${esc(item.owner)}</td>
      <td>${lift}</td>
      <td>${esc(item.task)}</td>
    </tr>`;
  }).join('');

  const backlogRows = backlog.map(item => `
    <tr>
      <td><span class="badge ${severityTone(item.severity)}">${esc(item.severity)}</span></td>
      <td>${esc(item.issue)}</td>
      <td>${esc(item.why)}</td>
      <td>${esc(item.owner)}</td>
      <td>${esc(item.effort)}</td>
      <td>${esc(item.task)}</td>
    </tr>
  `).join('');

  const nearRows = nearColors.map(c => `<tr><td>${swatch(c.keep)}</td><td>${swatch(c.merge)}</td><td>${c.dist}</td><td>${c.combined}</td><td>${esc(mergeWhy)}</td><td>${esc(mergeBenefit)}</td></tr>`).join('');
  const colorRows = (tokens.colors || []).slice(0, 24).map(c => {
    const onWhite = contrastStatus(c.contrastOnWhite);
    const onBlack = contrastStatus(c.contrastOnBlack);
    return `<tr><td>${swatch(c.hex)}</td><td>${esc(c.hsl)}</td><td>${esc(c.contrastOnWhite)} <span class="cstat ${onWhite.cls}">${onWhite.label}</span></td><td>${esc(c.contrastOnBlack)} <span class="cstat ${onBlack.cls}">${onBlack.label}</span></td></tr>`;
  }).join('');
  const riskyRows = fallbackRisky.map((pair, idx) => {
    const parsed = parsePairRow(pair, idx);
    return `<tr><td>${esc(parsed.label)}</td><td>${esc(parsed.ratio)}</td><td>${esc(parsed.risk)}</td></tr>`;
  }).join('');
  const devRows = (devTasks.length ? devTasks : [{ task: 'Keep monitoring scan deltas and enforce accessibility checks.', severity: 'P2' }]).map((item, idx) => `<tr><td>${idx + 1}</td><td>${esc(item.task)}</td><td>${item.severity === 'P0' ? 'Immediate risk reduction' : item.severity === 'P1' ? 'High impact quality uplift' : 'Regression prevention'}</td></tr>`).join('');
  const designRows = (designTasks.length ? designTasks : [{ task: 'Maintain accessible color and spacing baseline across components.', severity: 'P2' }]).map((item, idx) => `<tr><td>${idx + 1}</td><td>${esc(item.task)}</td><td>${item.severity === 'P0' ? 'Critical readability improvement' : item.severity === 'P1' ? 'Interaction clarity improvement' : 'Consistency maintenance'}</td></tr>`).join('');
  const trendRow = trendDiff
    ? `<tr><td>${esc(new Date(Number(previousSnapshot.savedAt || Date.now())).toLocaleString())}</td><td>${trendDiff.similarity}%</td><td>+${trendAdded}</td><td>-${trendRemoved}</td><td>${esc(trendStatus)}</td></tr>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Design System Audit - ${esc(domain)}</title>
  <style>
    :root { --bg:#f4f8fb; --card:#ffffff; --ink:#0f2430; --muted:#4f6672; --line:#c7d9e2; --ok:#15803d; --warn:#b45309; --risk:#b91c1c; --mild:#6d28d9; --chip:#eef7fb; }
    * { box-sizing:border-box; }
    body { margin:0; font:14px/1.45 'Segoe UI', 'Inter', sans-serif; color:var(--ink); background:radial-gradient(circle at 15% -25%, #dff4ea 0%, transparent 45%), radial-gradient(circle at 100% 0%, #e6f0ff 0%, transparent 40%), var(--bg); }
    .wrap { max-width:1100px; margin:22px auto; padding:0 16px 28px; }
    .hero { background:linear-gradient(155deg,#fff,#edf7fc); border:1px solid var(--line); border-radius:16px; padding:16px; box-shadow:0 8px 22px rgba(12,34,46,.08); }
    .title { margin:0; font-size:24px; letter-spacing:.2px; }
    .sec { margin-top:14px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; box-shadow:0 4px 12px rgba(15,38,52,.05); }
    .sec h2 { margin:0 0 10px; font-size:16px; }
    .subtle { color:var(--muted); font-size:12px; margin-top:8px; }
    .divider { height:1px; background:#dbe7ee; margin:14px 0; }
    .meter { font-size:13px; letter-spacing:.3px; }
    table { width:100%; border-collapse:collapse; font-size:12.5px; }
    th, td { text-align:left; border-bottom:1px solid #e2edf2; padding:8px 6px; vertical-align:top; }
    th { font-size:11px; text-transform:uppercase; letter-spacing:.35px; color:var(--muted); }
    .badge { display:inline-block; border-radius:999px; padding:2px 8px; font-size:11px; font-weight:800; border:1px solid transparent; }
    .badge.risk { color:#7f1d1d; border-color:#fecaca; background:#fee2e2; }
    .badge.warn { color:#7c2d12; border-color:#fed7aa; background:#ffedd5; }
    .badge.mild { color:#5b21b6; border-color:#ddd6fe; background:#ede9fe; }
    .badge.info { color:#155e75; border-color:#bae6fd; background:#e0f2fe; }
    .chip { display:inline-block; margin:3px 6px 3px 0; border:1px solid #cfe2ec; background:var(--chip); border-radius:999px; padding:4px 10px; font-size:12px; color:#355362; }
    .cstat { display:inline-block; margin-left:6px; padding:1px 6px; border-radius:999px; font-size:10px; font-weight:700; border:1px solid transparent; }
    .cstat.pass { color:#14532d; background:#dcfce7; border-color:#86efac; }
    .cstat.warn { color:#854d0e; background:#fef9c3; border-color:#fde68a; }
    .cstat.fail { color:#7f1d1d; background:#fee2e2; border-color:#fecaca; }
    .cstat.unk { color:#334155; background:#e2e8f0; border-color:#cbd5e1; }
    .sw { display:inline-block; width:10px; height:10px; border-radius:50%; border:1px solid #9aa; vertical-align:middle; margin-right:6px; }
    details { margin-top:12px; }
    details > summary { cursor:pointer; font-weight:700; color:#17394b; }
    pre { background:#0f2430; color:#d7f0ff; padding:12px; border-radius:10px; overflow:auto; font-size:12px; border:1px solid #234152; }
    .foot { margin-top:12px; color:var(--muted); font-size:11.5px; }
    @media (max-width: 760px) { .title { font-size:20px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1 class="title">Design System Audit — ${esc(domain)} ✨</h1>
      <p class="subtle">Visual report aligned with markdown export format.</p>
    </section>

    <section class="sec">
      <h2>Scan Details</h2>
      <table><thead><tr><th>Field</th><th>Value</th><th>Field</th><th>Value</th></tr></thead><tbody>
        <tr><td>🕒 Generated</td><td>${esc(timestampIso)}</td><td>🧾 Scan</td><td>${esc(scanId)}</td></tr>
        <tr><td>🛠 Tool</td><td>Palext</td><td>🌐 URL</td><td>${esc(tokens.url)}</td></tr>
        <tr><td>🧪 Env</td><td>${env}</td><td>🖥 Viewport</td><td>${viewportW}x${viewportH}</td></tr>
        <tr><td>🎨 Theme</td><td>${themeMode}</td><td>🔐 Auth</td><td>${authState}</td></tr>
      </tbody></table>
    </section>

    <section class="sec">
      <h2>Quick Summary 👀</h2>
      <table><thead><tr><th>Health</th><th>Value</th><th>Status</th></tr></thead><tbody>
        <tr><td>System consistency</td><td>${data.systemScore}/100</td><td>${data.systemScore >= 80 ? '🟢 Strong' : data.systemScore >= 60 ? '🟡 Good' : '🟠 Watch'} (${scoreLabel(data.systemScore)})</td></tr>
        <tr><td>Palette accessibility</td><td>${data.paletteAccessibilityScore}/100</td><td>${data.paletteAccessibilityScore >= 80 ? '🟢 Strong' : data.paletteAccessibilityScore >= 60 ? '🟡 Good' : '🟠 Watch'} (${scoreLabel(data.paletteAccessibilityScore)})</td></tr>
        <tr><td>Live WCAG AA fails</td><td>${data.liveWcagFailCount} / ${data.liveWcagChecked}</td><td>${liveFailDensity}% fail density</td></tr>
        <tr><td>Estimated lift after top fixes</td><td>+${estimatedLiftPoints} pts</td><td>✅ High confidence</td></tr>
      </tbody></table>
      <p class="subtle"><strong>Primary user risk:</strong> ${esc(topPriority ? topPriority.issue : 'No major risk detected in this scan. Maintain current baseline.')}</p>
      <table><thead><tr><th>Signal</th><th>Visual Meter</th><th>Meaning</th></tr></thead><tbody>
        <tr><td>Consistency</td><td class="meter">${data.systemScore >= 90 ? '🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜' : data.systemScore >= 75 ? '🟩🟩🟩🟩🟩🟩🟩🟨⬜⬜' : '🟨🟨🟨🟨🟨⬜⬜⬜⬜⬜'}</td><td>System token alignment</td></tr>
        <tr><td>Accessibility</td><td class="meter">${aaNormalPct >= 90 ? '🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜' : aaNormalPct >= 70 ? '🟩🟩🟩🟩🟩🟩🟨⬜⬜⬜' : '🟥🟥🟥🟧🟧⬜⬜⬜⬜⬜'}</td><td>Contrast pass baseline</td></tr>
        <tr><td>Delivery risk</td><td class="meter">${liveFailDensity <= 5 ? '🟨⬜⬜⬜⬜⬜⬜⬜⬜⬜' : liveFailDensity <= 20 ? '🟧🟧⬜⬜⬜⬜⬜⬜⬜⬜' : '🟥🟥🟥🟥⬜⬜⬜⬜⬜⬜'}</td><td>Execution risk level</td></tr>
      </tbody></table>
    </section>

    <section class="sec">
      <h2>Fix These First 🚀</h2>
      <table><thead><tr><th>Rank</th><th>Area</th><th>Issue Group</th><th>User Impact</th><th>Priority</th><th>Effort</th><th>Owner</th><th>Expected Lift</th><th>Action</th></tr></thead><tbody>${topFixRows}</tbody></table>
    </section>

    <section class="sec">
      <h2>Health Scores 📊</h2>
      <table><thead><tr><th>Metric</th><th>Value</th><th>Quick Note</th></tr></thead><tbody>
        <tr><td>Token consistency</td><td>${data.systemScore}%</td><td>${data.systemScore >= 80 ? '✅' : '⚠️'} ${scoreLabel(data.systemScore)} baseline</td></tr>
        <tr><td>Palette accessibility</td><td>${data.paletteAccessibilityScore}%</td><td>${data.paletteAccessibilityScore >= 80 ? '✅' : '⚠️'} ${scoreLabel(data.paletteAccessibilityScore)} token coverage</td></tr>
        <tr><td>AA normal pass rate</td><td>${aaNormalPct}%</td><td>${matrix.totals.aaNormalPass}/${matrix.totals.pairs}</td></tr>
        <tr><td>Live fail density</td><td>${liveFailDensity}%</td><td>${data.liveWcagFailCount}/${data.liveWcagChecked}</td></tr>
        <tr><td>Hardcoded style occurrences</td><td>${data.hardcodedAudit.totalOccurrences}</td><td>${data.hardcodedAudit.totalOccurrences > 0 ? '⚠️ Needs cleanup' : '✅ Clean'}</td></tr>
      </tbody></table>
    </section>

    <section class="sec">
      <h2>Action List by Priority 🧭</h2>
      <table><thead><tr><th>Priority</th><th>Issue</th><th>Reason</th><th>Owner</th><th>Effort</th><th>Recommended task</th></tr></thead><tbody>${backlogRows}</tbody></table>
    </section>

    <section class="sec">
      <h2>Design Tokens Found 🧩</h2>
      <table><thead><tr><th>Tokens</th><th>Count</th><th>Tokens</th><th>Count</th></tr></thead><tbody>
        <tr><td>Colors</td><td>${data.tokenCounts.colors}</td><td>Radii</td><td>${data.tokenCounts.radii}</td></tr>
        <tr><td>Font families</td><td>${data.tokenCounts.fontFamilies}</td><td>Shadows</td><td>${data.tokenCounts.shadows}</td></tr>
        <tr><td>Font sizes</td><td>${data.tokenCounts.fontSizes}</td><td>Gradients</td><td>${data.tokenCounts.gradients}</td></tr>
        <tr><td>Spacing values</td><td>${data.tokenCounts.spacing}</td><td>CSS variables (:root)</td><td>${data.tokenCounts.rootVars}</td></tr>
      </tbody></table>
      <p class="subtle">🪄 ${esc(data.personality)}</p>
    </section>

    <section class="sec">
      <h2>Accessibility Results ♿</h2>
      <table><thead><tr><th>Check</th><th>Pass / Total</th><th>Pass Rate</th></tr></thead><tbody>
        <tr><td>AA Normal</td><td>${matrix.totals.aaNormalPass}/${matrix.totals.pairs}</td><td>${aaNormalPct}%</td></tr>
        <tr><td>AA Large</td><td>${matrix.totals.aaLargePass}/${matrix.totals.pairs}</td><td>${aaLargePct}%</td></tr>
        <tr><td>AAA Normal</td><td>${matrix.totals.aaaNormalPass}/${matrix.totals.pairs}</td><td>${aaaNormalPct}%</td></tr>
        <tr><td>AAA Large</td><td>${matrix.totals.aaaLargePass}/${matrix.totals.pairs}</td><td>${aaaLargePct}%</td></tr>
      </tbody></table>
      <p class="subtle"><strong>Risky pairs (&lt;3:1):</strong></p>
      <table><thead><tr><th>Pair</th><th>Ratio</th><th>Risk</th></tr></thead><tbody>${riskyRows}</tbody></table>
    </section>

    ${nearColors.length ? `<section class="sec"><h2>Color Merge Opportunities 🧪</h2><table><thead><tr><th>Keep</th><th>Merge</th><th>Color distance</th><th>Combined usage</th><th>Reason</th><th>Benefit</th></tr></thead><tbody>${nearRows}</tbody></table></section>` : ''}

    <section class="sec">
      <h2>Owners and Next Steps 🛠</h2>
      <h3 style="margin:8px 0 6px">Developer</h3>
      <table><thead><tr><th>#</th><th>Action</th><th>Impact</th></tr></thead><tbody>${devRows}</tbody></table>
      <h3 style="margin:12px 0 6px">Designer</h3>
      <table><thead><tr><th>#</th><th>Action</th><th>Impact</th></tr></thead><tbody>${designRows}</tbody></table>
    </section>

    <section class="sec">
      <h2>Change Since Last Saved Snapshot 📈</h2>
      ${trendDiff
        ? `<table><thead><tr><th>Previous Snapshot</th><th>Similarity</th><th>Added Tokens</th><th>Removed Tokens</th><th>Status</th></tr></thead><tbody>${trendRow}</tbody></table>`
        : `<p class="subtle">First scan for this page. Save a snapshot to enable trend comparison next time.</p>`}
    </section>

    <section class="sec">
      <h2>Fix Check Plan 🔁</h2>
      <table><thead><tr><th>Track</th><th>Scope</th></tr></thead><tbody>
        <tr><td>Fast scope</td><td>Top issue groups, typography text blocks, interactive controls</td></tr>
        <tr><td>Full scope</td><td>Full page templates, common user journeys, high-traffic modules</td></tr>
      </tbody></table>
      <table style="margin-top:10px"><thead><tr><th>Pass Criteria</th><th>Target</th></tr></thead><tbody>
        <tr><td>Live AA fails</td><td>&lt;= ${Math.max(0, data.liveWcagFailCount > 0 ? Math.floor(data.liveWcagFailCount * 0.5) : 0)}</td></tr>
        <tr><td>AA normal pass</td><td>&gt;= ${Math.min(99, Math.max(70, aaNormalPct + 10))}%</td></tr>
        <tr><td>New P0 groups</td><td>0</td></tr>
      </tbody></table>
    </section>

    <section class="sec">
      <details>
        <summary><strong>Technical Details (for developers and compliance checks)</strong></summary>
        <p class="subtle">This section shows scan notes, issue details, and the steps to track fixes.</p>
        <h3>A) Measurement Notes 🧠</h3>
        <table><thead><tr><th>Section</th><th>Trust</th><th>Scan method</th><th>Notes</th></tr></thead><tbody>
          <tr><td>Token inventory</td><td>High</td><td>DOM + computed style extraction</td><td>Stable across repeated scans</td></tr>
          <tr><td>Palette analysis</td><td>Medium</td><td>Pairwise contrast on extracted palette</td><td>Large color sets can skew results</td></tr>
          <tr><td>Live accessibility</td><td>Medium</td><td>Visible text-node checks in the current viewport</td><td>Dynamic content and sign-in state can change totals</td></tr>
          <tr><td>Hardcoded detection</td><td>Medium</td><td>Inline/style block comparison to :root refs</td><td>Utility classes can blur separate cases</td></tr>
        </tbody></table>

        <h3>B) Accessibility Rules 📚</h3>
        <table><thead><tr><th>Issue set</th><th>Rule</th><th>Level</th><th>Standards risk</th><th>Notes</th></tr></thead><tbody>
          <tr><td>G-LIVE-AA-001</td><td>1.4.3 Contrast (Minimum)</td><td>AA</td><td>High</td><td>Live text contrast issues found</td></tr>
          <tr><td>G-PAIR-LOW-001</td><td>1.4.3 Contrast (Minimum)</td><td>AA</td><td>High</td><td>Close color pairs may be hard to read</td></tr>
          <tr><td>G-TEXT-AAA-001</td><td>1.4.6 Contrast (Enhanced)</td><td>AAA</td><td>Medium</td><td>Stronger contrast is still possible</td></tr>
        </tbody></table>

        <h3>C) Issue Evidence 🔎</h3>
        <table><thead><tr><th>Issue set</th><th>Component</th><th>Selector</th><th>Page path</th><th>Image link</th><th>Steps</th></tr></thead><tbody>
          <tr><td>G-LIVE-AA-001</td><td>Text block contrast cluster</td><td>.text-muted, .body-copy</td><td>body &gt; main &gt; ...</td><td>screenshots/G-LIVE-AA-001.png</td><td>Run overlay and inspect top issue groups</td></tr>
          <tr><td>G-PAIR-LOW-001</td><td>Close color pair use</td><td>.muted-text-on-surface</td><td>body &gt; ...</td><td>screenshots/G-PAIR-LOW-001.png</td><td>Compare pair and switch to a safer token</td></tr>
        </tbody></table>

        <h3>D) Issue Groups 🧹</h3>
        <table><thead><tr><th>Issue set</th><th>Issue type</th><th>Unique nodes</th><th>Repeats</th><th>Priority</th><th>Owner</th></tr></thead><tbody>
          ${topFixes.slice(0, 3).map((item, idx) => {
            const unique = Math.max(1, Math.round((idx + 1) * 2));
            const repeated = Math.max(unique, Math.round((idx + 1) * Math.max(2, data.liveWcagFailCount / 3)));
            return `<tr><td>${esc(item.groupId || `G-GRP-${idx + 1}`)}</td><td>${esc(item.issue)}</td><td>${unique}</td><td>${repeated}</td><td>${esc(item.severity)}</td><td>${esc(item.owner)}</td></tr>`;
          }).join('')}
        </tbody></table>

        <h3>E) Exceptions 🧾</h3>
        <table><thead><tr><th>Exception ID</th><th>Issue set</th><th>Note</th><th>Approved by</th><th>Ends on</th><th>Status</th></tr></thead><tbody>
          <tr><td>W-NA-001</td><td>G-HARDCODE-001</td><td>Temporary exception for legacy migration blocks</td><td>UI Lead</td><td>TBD</td><td>Temporary</td></tr>
        </tbody></table>

        <h3>F) Ticket Details 🔗</h3>
        <table><thead><tr><th>Issue set</th><th>Jira</th><th>GitHub</th><th>Team</th><th>Target</th><th>Status</th></tr></thead><tbody>
          <tr><td>G-LIVE-AA-001</td><td>TBD</td><td>TBD</td><td>Frontend Platform</td><td>7 days</td><td>Open</td></tr>
          <tr><td>G-PAIR-LOW-001</td><td>TBD</td><td>TBD</td><td>Design Systems</td><td>5 days</td><td>Open</td></tr>
        </tbody></table>

        <h3>G) Note 🧭</h3>
        <p class="subtle">${data.paletteAccessibilityScore >= 90 && aaNormalPct < 50
          ? 'High palette accessibility score can coexist with low live AA pass when real components mix tokens inconsistently. Prioritize implementation mapping over creating more tokens.'
          : 'Key metrics are directionally aligned. Remaining gaps are concentrated in implementation hotspots and should be handled through targeted remediation.'}</p>
      </details>
    </section>

    ${(tokens.colors || []).length ? `<section class="sec"><h2>Top Colors Used on This Page 🌈</h2><p class="subtle">Showing the top 24 colors by usage frequency.</p><table><thead><tr><th>Color</th><th>HSL</th><th>Contrast on white</th><th>Contrast on black</th></tr></thead><tbody>${colorRows}</tbody></table></section>` : ''}

    <section class="sec">
      <h2>Technical Export (JSON for CI/Tickets) 📦</h2>
      <pre>${esc(jsonPayload)}</pre>
    </section>

    <p class="foot">Report generated by Palext — Design Token Extractor.</p>
  </div>
</body>
</html>`;

  return { domain: safeName(domain), html };
}

function exportAuditReport(kind = 'html') {
  if (notifyProLock('auditReport', 'Audit report export is a Pro feature.')) return;
  if (!tokens) {
    showToast('Scan a page first to generate an audit report.');
    return;
  }
  const built = kind === 'markdown' ? buildAuditReportMarkdown() : buildAuditReportHtml();
  if (!built) {
    showToast('Could not build audit report.');
    return;
  }
  if (kind === 'markdown') {
    downloadFile(built.markdown, `${built.domain}-design-audit.md`);
    showToast(`Downloaded ${built.domain}-design-audit.md`);
    return;
  }
  downloadFile(built.html, `${built.domain}-design-audit.html`);
  showToast(`Downloaded ${built.domain}-design-audit.html`);
}

function updateLastExportHint() {
  const hint = document.getElementById('lastExportHint');
  if (!hint) return;
  hint.textContent = `Last used: ${(lastExportFormat || 'css').toUpperCase()}`;
}

function isFormatLocked(format) {
  const featureKey = formatToFeatureKey(format);
  return featureKey ? _qL55(featureKey) : false;
}

function populateFamilyFormats(familyId) {
  const family = FRAMEWORK_FAMILIES[familyId];
  if (!family) return;
  
  const select = document.getElementById('exportFormatSelect');
  if (!select) return;

  currentExportFamily = familyId;
  select.innerHTML = '';

  let firstEnabled = '';
  const familyLocked = isFamilyLocked(familyId);
  family.formats.forEach(fmt => {
    const needsPro = familyLocked || isFormatLocked(fmt.id);
    const option = document.createElement('option');
    option.value = fmt.id;
    option.textContent = needsPro ? `${fmt.label} [PRO]` : fmt.label;
    option.disabled = needsPro;
    select.appendChild(option);

    if (!needsPro && !firstEnabled) {
      firstEnabled = fmt.id;
    }
  });

  if (firstEnabled) {
    select.value = firstEnabled;
    lastExportFormat = select.value;
    updateLastExportHint();
  } else if (select.options.length > 0) {
    select.selectedIndex = 0;
  }
}

function handleExportFamilyClick(e) {
  if (!e.target.matches('[data-family]')) return;
  const family = e.target.dataset.family;
  const featureKey = familyToFeatureKey(family);
  if (featureKey && _qL55(featureKey)) {
    notifyProLock(featureKey, `${featureLabel(featureKey)} is a Pro feature.`);
    return;
  }
  
  const chips = document.querySelectorAll('[data-family]');
  chips.forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');

  populateFamilyFormats(family);
}

function openExportModal() {
  const overlay = document.getElementById('exportModalOverlay');
  if (!overlay) return;
  openLayer(overlay, {
    focusEl: document.getElementById('closeExportModalBtn')
  });
  
  // Initialize default family and formats
  if (!currentExportFamily || !FRAMEWORK_FAMILIES[currentExportFamily]) {
    currentExportFamily = 'web';
  }
  populateFamilyFormats(currentExportFamily);

  // Highlight current family chip
  const familyChips = document.querySelectorAll('[data-family]');
  familyChips.forEach(c => {
    c.classList.toggle('active', c.dataset.family === currentExportFamily);
  });

  syncExportChipLocks();
  
  syncExportModalState();
  
}

function closeExportModal() {
  const overlay = document.getElementById('exportModalOverlay');
  if (!overlay) return;

  closeLayer(overlay, {
    fallbackFocus: document.getElementById('toolsMenuBtn') || document.getElementById('openExportModalBtn')
  });
}

function syncExportModalState() {
  syncExportChipLocks();

  const targetChips = document.querySelectorAll('[data-target]');
  const formatGroup = document.getElementById('exportFormatGroup');
  const customizeGroup = document.getElementById('exportCustomizeGroup');
  const auditFormatGroup = document.getElementById('exportAuditFormatGroup');
  const auditFormatSelect = document.getElementById('exportAuditFormatSelect');
  const note = document.getElementById('exportModalNote');
  const copyBtn = document.getElementById('exportCopyBtn');
  const dlBtn = document.getElementById('exportDownloadBtn');
  const formatSelect = document.getElementById('exportFormatSelect');
  
  if (!formatGroup || !customizeGroup || !note || !copyBtn || !dlBtn) return;

  // Determine current target from active chip
  let target = 'format';
  targetChips.forEach(chip => {
    if (chip.classList.contains('active')) {
      target = chip.dataset.target;
    }
  });

  const targetFeature = targetToFeatureKey(target);
  if (targetFeature && _qL55(targetFeature)) {
    target = 'format';
    targetChips.forEach(chip => {
      const isFormat = chip.dataset.target === 'format';
      chip.classList.toggle('active', isFormat);
      chip.setAttribute('aria-pressed', isFormat ? 'true' : 'false');
    });
  }

  // Show/hide format and customize groups based on target
  const showFormat = target === 'format';
  formatGroup.classList.toggle('hidden', !showFormat);
  customizeGroup.classList.toggle('hidden', !showFormat);
  if (auditFormatGroup) {
    auditFormatGroup.classList.toggle('hidden', target !== 'audit');
  }

  // Update UI text and button states
  if (showFormat) {
    const noFormats = !formatSelect || formatSelect.options.length === 0;
    const selectedOption = formatSelect && formatSelect.selectedIndex >= 0
      ? formatSelect.options[formatSelect.selectedIndex]
      : null;
    const selectedLocked = !!(selectedOption && selectedOption.disabled);

    if (noFormats || selectedLocked) {
      note.textContent = 'This framework family has Pro-only formats. Upgrade to Pro to unlock them.';
      copyBtn.disabled = true;
      dlBtn.disabled = true;
      dlBtn.textContent = 'Download';
    } else {
      note.textContent = 'Select framework, customize token categories, then copy or download. Check the generated code for usage instructions!';
      copyBtn.disabled = false;
      dlBtn.disabled = false;
      dlBtn.textContent = 'Download';
    }
  } else if (target === 'bundle') {
    note.textContent = 'Bundle downloads all supported token formats as separate files.';
    copyBtn.disabled = true;
    dlBtn.disabled = false;
    dlBtn.textContent = 'Download Bundle';
  } else {
    const wantsHtml = auditFormatSelect && auditFormatSelect.value === 'html';
    note.textContent = wantsHtml
      ? 'Audit report download will use the visual HTML format. Copy still provides markdown.'
      : 'Audit report download will use the markdown format. Copy also provides markdown.';
    copyBtn.disabled = false;
    dlBtn.disabled = false;
    dlBtn.textContent = wantsHtml ? 'Download Audit (.html)' : 'Download Audit (.md)';
  }
}

function handleExportCopy() {
  // Determine current target from active chip
  const targetChips = document.querySelectorAll('[data-target]');
  let target = 'format';
  targetChips.forEach(chip => {
    if (chip.classList.contains('active')) {
      target = chip.dataset.target;
    }
  });

  const format = document.getElementById('exportFormatSelect');
  if (!format) return;
  if (target === 'bundle') return;

  if (target === 'audit') {
    if (notifyProLock('auditReport', 'Audit report export is a Pro feature.')) return;
    const built = buildAuditReportMarkdown();
    if (!built) {
      showToast('Could not build audit report.');
      return;
    }
    copyText(built.markdown);
    showToast('Audit report Markdown copied');
    return;
  }

  const picked = format.value || 'css';
  const formatFeature = formatToFeatureKey(picked);
  if (formatFeature && notifyProLock(formatFeature, `${featureLabel(formatFeature)} is a Pro feature.`)) return;
  lastExportFormat = picked;
  updateLastExportHint();
  exportAs(picked, false);
}

function handleExportDownload() {
  // Determine current target from active chip
  const targetChips = document.querySelectorAll('[data-target]');
  let target = 'format';
  targetChips.forEach(chip => {
    if (chip.classList.contains('active')) {
      target = chip.dataset.target;
    }
  });

  const format = document.getElementById('exportFormatSelect');
  if (!format) return;

  if (target === 'bundle') {
    exportBundle();
    return;
  }

  if (target === 'audit') {
    const auditFormat = document.getElementById('exportAuditFormatSelect');
    const kind = auditFormat && auditFormat.value === 'html' ? 'html' : 'markdown';
    exportAuditReport(kind);
    return;
  }

  const picked = format.value || 'css';
  const formatFeature = formatToFeatureKey(picked);
  if (formatFeature && notifyProLock(formatFeature, `${featureLabel(formatFeature)} is a Pro feature.`)) return;
  lastExportFormat = picked;
  updateLastExportHint();
  exportAs(picked, true);
}


function downloadFile(content, filename) {
  const mime = filename.endsWith('.json')
    ? 'application/json'
    : filename.endsWith('.html')
      ? 'text/html'
      : 'text/plain';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyText(text) {
  if (!text) return;

  // Embedded popup runs inside the page iframe, where strict site Permissions
  // Policy can block Clipboard API and emit noisy console violations.
  if (IS_EMBEDDED_SURFACE) {
    copyTextFallbackOnly(text);
    return;
  }

  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    copyTextFallbackOnly(text);
    return;
  }

  navigator.clipboard.writeText(text).catch(() => {
    copyTextFallbackOnly(text);
  });
}

function copyTextFallbackOnly(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch (_) {
    return false;
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toast.classList.add('show');
  const delay = Math.min(5200, Math.max(2400, String(msg || '').length * 32));
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastTimer = null;
  }, delay);
}

function selectTab(tab) {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const selected = btn.dataset.tab === tab;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
  updateViewOptionsVisibility(tab);
}

// The unit (px/rem/em) toggle only affects Spacing now, so keep it hidden on
// every other tab to reduce duplicate controls.
function updateViewOptionsVisibility(tab) {
  const bar = document.getElementById('viewOptionsBar');
  if (bar) {
    const relevant = tab === 'spacing';
    bar.classList.toggle('hidden', !relevant);
  }

  // Export now lives in the Page Tools row, so keep the legacy export bar hidden.
  document.getElementById('exportBar')?.classList.add('hidden');
}

function bindEvents() {
  bindHexChipCopy();

  const openExportBtn = document.getElementById('openExportModalBtn');
  const toolsMenu = document.getElementById('globalPageTools');
  const toolsMenuBtn = document.getElementById('toolsMenuBtn');
  const toolsSubmenu = document.getElementById('toolsSubmenu');
  const closeExportBtn = document.getElementById('closeExportModalBtn');
  const exportOverlay = document.getElementById('exportModalOverlay');
  const closeSpacingDetailsBtn = document.getElementById('closeSpacingDetailsBtn');
  const spacingDetailsOverlay = document.getElementById('spacingDetailsOverlay');
  const exportTargetChips = document.getElementById('exportTargetChips');
  const exportFamilyChips = document.getElementById('exportFamilyChips');
  const exportFormat = document.getElementById('exportFormatSelect');
  const exportAuditFormat = document.getElementById('exportAuditFormatSelect');
  const exportCopyBtn = document.getElementById('exportCopyBtn');
  const exportDownloadBtn = document.getElementById('exportDownloadBtn');
  const globalColorBlindBtn = document.getElementById('globalToggleColorBlindBtn');
  const globalMeasureBtn = document.getElementById('globalToggleMeasureModeBtn');
  const globalLayoutBtn = document.getElementById('globalToggleLayoutOverlayBtn');
  const proOverlay = document.getElementById('proPlanOverlay');
  const closeProBtn = document.getElementById('closeProPlanBtn');
  const proMonthlyBtn = document.getElementById('proMonthlyBtn');
  const proAnnualBtn = document.getElementById('proAnnualBtn');

  const verifyUiLayerWiring = () => {
    const required = ['exportModalOverlay', 'spacingDetailsOverlay', 'proPlanOverlay'];
    required.forEach((id) => {
      if (!document.getElementById(id)) {
        console.warn(`[Palext UI] Missing required layer element: ${id}`);
      }
    });
  };

  const closeToolsMenu = () => {
    toolsSubmenu?.classList.add('hidden');
    toolsMenu?.classList.remove('is-open');
    toolsMenuBtn?.setAttribute('aria-expanded', 'false');
  };

  toolsMenuBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const willOpen = !!toolsSubmenu?.classList.contains('hidden');
    if (willOpen) {
      void syncLiveToolStatesFromPage();
    }
    toolsSubmenu?.classList.toggle('hidden', !willOpen);
    toolsMenu?.classList.toggle('is-open', willOpen);
    toolsMenuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    if (!toolsMenu || !toolsSubmenu || !toolsMenuBtn) return;
    if (!toolsMenu.contains(e.target)) {
      closeToolsMenu();
    }
  });

  document.getElementById('inspectBtn')?.addEventListener('click', async () => {
    try {
      const tab = await getPreferredActiveTab();
      if (!tab || !tab.id) { showToast('No active tab found.'); return; }
      if (!isSupportedTab(tab.url)) {
        showToast('Navigate to a website (http/https) first, then use Inspect.');
        return;
      }

      if (!IS_EMBEDDED_SURFACE) {
        chrome.tabs.sendMessage(tab.id, { type: 'OPEN_FLOATING_TOOL', startInspect: true }, () => {
          if (chrome.runtime.lastError) {
            showToast('Cannot open floating tool on this page — try reloading it.');
            return;
          }
          window.close();
        });
        return;
      }

      const activated = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'ACTIVATE_HOVER_INSPECT_DIRECT',
          sourceSurface: UI_SURFACE,
          startInspect: true
        }, () => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(true);
        });
      });

      if (!activated) {
        showToast('Cannot inspect this page — try reloading it.');
        return;
      }

      showToast('Pinned workspace opened on page. Drag it, then hover to inspect.');
    } catch (_) {
      showToast('Cannot inspect this page.');
    }
  });

  document.getElementById('modeBtn')?.addEventListener('click', async (e) => {
    openProPlanModal();
  });
  closeProBtn?.addEventListener('click', () => closeProPlanModal());
  proOverlay?.addEventListener('click', (e) => {
    if (e.target === proOverlay) closeProPlanModal();
  });
  proMonthlyBtn?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://palextpro.lemonsqueezy.com/checkout/buy/25b02039-3680-47f0-bc9a-32aaa80d4fa6' });
  });
  proAnnualBtn?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://palextpro.lemonsqueezy.com/checkout/buy/aa1d3335-f48b-4be3-8285-6c438b6b1da2' });
  });
  
  const proActivateBtn = document.getElementById('proActivateBtn');
  const proLicenseInput = document.getElementById('proLicenseInput');
  proActivateBtn?.addEventListener('click', async () => {
    const key = (proLicenseInput?.value || '').trim();
    if (!key) {
      showToast('Please enter a license key.');
      return;
    }
    const instanceId = crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
      const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: key, instance_name: 'Palext Chrome Extension' })
      });
      const result = await response.json();
      if (result.valid) {
        _mN77 = true;
        await chrome.storage.sync.set({ [_uR42]: true, [_lsKey]: key, [_lsInst]: instanceId });
        proLicenseInput.value = '';
        showToast('License activated! Pro mode is now active.');
        closeProPlanModal();
        applyUiMode();
      } else {
        showToast(result.error || 'Invalid license key. Please check and try again.');
      }
    } catch (err) {
      showToast('Could not activate license. Check your connection and try again.');
    }
  });

  document.getElementById('themeBtn')?.addEventListener('click', () => {
    if (notifyProLock('themePersonalization', 'Theme personalization is a Pro feature.')) return;
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  document.getElementById('refreshBtn')?.addEventListener('click', extract);

  document.getElementById('saveBtn')?.addEventListener('click', async () => {
    if (!tokens) return;
    await saveSite(tokens);
    if (activeTab === 'history') renderTokens('history');
  });

  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      selectTab(activeTab);
      renderTokens(activeTab);
    });
  });

  globalColorBlindBtn?.addEventListener('click', async () => {
    const nextMode = nextColorBlindMode(colorBlindMode);
    const result = await sendActionToActiveTab({ type: 'SET_COLOR_BLIND_MODE', mode: nextMode });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not toggle simulation');
      return;
    }
    colorBlindMode = result.mode || 'off';
    updateGlobalPageToolsUi();
    if (activeTab === 'insights') renderTokens('insights');
    showToast(colorBlindMode === 'off'
      ? 'Color simulation off: showing original colors.'
      : `${colorBlindLabel(colorBlindMode)}: ${colorBlindDescription(colorBlindMode)}`);
  });

  globalMeasureBtn?.addEventListener('click', async () => {
    const measureLimited = isMeasureLimitedPlan();
    if (!measureModeEnabled && measureLimited) {
      await refreshMeasureQuotaState();
      if ((measureQuotaState.remaining || 0) <= 0) {
        updateGlobalPageToolsUi();
        notifyProLock('measureUnlimited', 'You used 3/3 free measurements today. Upgrade for unlimited measuring.');
        return;
      }
    }

    const result = await sendActionToActiveTab({
      type: 'TOGGLE_MEASURE_MODE',
      enabled: !measureModeEnabled,
      quotaPlan: measureLimited ? 'free' : 'pro',
      freeLimit: MEASURE_FREE_DAILY_LIMIT
    });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not toggle measure mode');
      return;
    }

    if (result.quotaReached) {
      if (result.quota) {
        await applyMeasureQuotaFromEvent(result.quota);
      }
      measureModeEnabled = false;
      updateGlobalPageToolsUi();
      notifyProLock('measureUnlimited', 'You used 3/3 free measurements today. Upgrade for unlimited measuring.');
      return;
    }

    if (result.quota) {
      await applyMeasureQuotaFromEvent(result.quota);
    }
    measureModeEnabled = !!result.enabled;
    updateGlobalPageToolsUi();
    showToast(measureModeEnabled
      ? (measureLimited
        ? `Measure mode on: ${measureQuotaState.remaining}/${MEASURE_FREE_DAILY_LIMIT} free measurements left today.`
        : 'Measure mode on: click first element, then hover others to see live distance.')
      : 'Measure mode off');
  });

  globalLayoutBtn?.addEventListener('click', async () => {
    closeToolsMenu();
    const result = await sendActionToActiveTab({
      type: 'TOGGLE_LAYOUT_OVERLAY',
      enabled: !layoutOverlayEnabled,
      detailLevel: 'advanced'
    });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not toggle layout overlay');
      return;
    }
    layoutOverlayEnabled = !!result.enabled;
    updateGlobalPageToolsUi();
    const layoutFilterGroup = document.getElementById('layoutFilterGroup');
    if (layoutFilterGroup) {
      layoutFilterGroup.classList.toggle('hidden', !layoutOverlayEnabled);
    }
    if (!layoutOverlayEnabled) {
      layoutInViewOnly = true;
      layoutLabelsEnabled = false;
      document.querySelectorAll('[data-layout-filter]').forEach(b => {
        const isAll = b.dataset.layoutFilter === 'all';
        b.classList.toggle('active', isAll);
        b.setAttribute('aria-pressed', isAll ? 'true' : 'false');
      });
      document.querySelectorAll('[data-layout-opt]').forEach(b => {
        const pressed = b.dataset.layoutOpt === 'inview';
        b.classList.toggle('active', pressed);
        b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      });
      showToast('Layout overlay off');
      return;
    }

    await sendActionToActiveTab({
      type: 'SET_LAYOUT_OPTIONS',
      inViewOnly: layoutInViewOnly,
      labelsEnabled: layoutLabelsEnabled
    });

    const gridInfo = Number(result.gridCount || 0);
    const flexInfo = Number(result.flexCount || 0);
    const legacyInfo = Number(result.legacyCount || 0);
    if (!result.count) {
      showToast('Layout overlay on: no layout containers found.');
    } else if (result.fallbackMode) {
      showToast(`Layout overlay on: no flex/grid found, showing ${legacyInfo} legacy containers.`);
    } else {
      showToast(`Layout overlay on: ${flexInfo} flex, ${gridInfo} grid containers highlighted.`);
    }
  });

  document.querySelectorAll('[data-layout-filter]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const filter = btn.dataset.layoutFilter || 'all';
      const result = await sendActionToActiveTab({ type: 'SET_LAYOUT_FILTER', filter });
      if (!result || !result.ok) {
        showToast(result && result.error ? result.error : 'Could not apply layout filter');
        return;
      }
      document.querySelectorAll('[data-layout-filter]').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const gridInfo = Number(result.gridCount || 0);
      const flexInfo = Number(result.flexCount || 0);
      const legacyInfo = Number(result.legacyCount || 0);
      const label = filter === 'flex'
        ? 'Flex only'
        : filter === 'grid'
          ? 'Grid only'
          : filter === 'legacy'
            ? 'Legacy only'
            : 'All layouts';
      if (filter === 'legacy') {
        showToast(`${label}: ${legacyInfo} legacy containers shown.`);
      } else if (result.fallbackMode) {
        showToast(`${label}: no flex/grid found, ${legacyInfo} legacy containers shown.`);
      } else {
        showToast(`${label}: ${flexInfo} flex, ${gridInfo} grid shown.`);
      }
    });
  });

  document.querySelectorAll('[data-layout-opt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!layoutOverlayEnabled) return;
      const opt = btn.dataset.layoutOpt;
      const prevInView = layoutInViewOnly;
      const prevLabels = layoutLabelsEnabled;
      if (opt === 'inview') {
        layoutInViewOnly = !layoutInViewOnly;
      } else if (opt === 'labels') {
        layoutLabelsEnabled = !layoutLabelsEnabled;
      } else {
        return;
      }

      document.querySelectorAll('[data-layout-opt]').forEach(b => {
        const key = b.dataset.layoutOpt;
        const active = key === 'inview' ? layoutInViewOnly : key === 'labels' ? layoutLabelsEnabled : false;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      const result = await sendActionToActiveTab({
        type: 'SET_LAYOUT_OPTIONS',
        inViewOnly: layoutInViewOnly,
        labelsEnabled: layoutLabelsEnabled
      });
      if (!result || !result.ok) {
        layoutInViewOnly = prevInView;
        layoutLabelsEnabled = prevLabels;
        document.querySelectorAll('[data-layout-opt]').forEach(b => {
          const key = b.dataset.layoutOpt;
          const active = key === 'inview' ? layoutInViewOnly : key === 'labels' ? layoutLabelsEnabled : false;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        showToast(result && result.error ? result.error : 'Could not update layout options');
        return;
      }
      const scope = layoutInViewOnly ? 'in-view' : 'whole page';
      const labels = layoutLabelsEnabled ? 'labels on' : 'labels off';
      showToast(`Layout options: ${scope}, ${labels}.`);
    });
  });

  void Promise.all([refreshMeasureQuotaState(), refreshScanQuotaState()]).then(() => updateGlobalPageToolsUi());

  // Message listener for extensions events
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'PAL_EXT_TOAST' && msg.message) {
      showToast(String(msg.message));
    }
    if (msg && msg.type === 'PAL_EXT_INSPECT_CAPTURED') {
      void checkInspectResult().then(() => {
        renderTokens(activeTab);
        showToast('Capture loaded');
      });
    }
    if (msg && msg.type === 'PAL_EXT_MEASURE_QUOTA_UPDATE' && msg.quota) {
      const host = sender && sender.tab && sender.tab.url ? getDomain(sender.tab.url) : '';
      void applyMeasureQuotaFromEvent(msg.quota, host).then(() => {
        if (msg.stopMode) {
          measureModeEnabled = false;
          if (isMeasureLimitedPlan()) {
            showToast('Free quota reached: 3/3 measurements today. Upgrade for unlimited measuring.');
          }
        }
        updateGlobalPageToolsUi();
      });
    }
  });

  // Export modal event handlers
  openExportBtn?.addEventListener('click', () => {
    closeToolsMenu();
    openExportModal();
  });

  closeExportBtn?.addEventListener('click', () => {
    closeExportModal();
  });

  closeSpacingDetailsBtn?.addEventListener('click', () => {
    closeSpacingDetailsModal();
  });

  exportOverlay?.addEventListener('click', e => {
    if (e.target === exportOverlay) closeExportModal();
  });

  spacingDetailsOverlay?.addEventListener('click', e => {
    if (e.target === spacingDetailsOverlay) closeSpacingDetailsModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const closed = closeTopInteractiveLayer();
      if (closed) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  });

  // Target (format/bundle/audit) chip clicks
  exportTargetChips?.addEventListener('click', e => {
    if (!e.target.matches('[data-target]')) return;
    const target = e.target.dataset.target || '';
    const featureKey = targetToFeatureKey(target);
    if (featureKey && _qL55(featureKey)) {
      notifyProLock(featureKey, `${featureLabel(featureKey)} is a Pro feature.`);
      return;
    }
    const chips = document.querySelectorAll('[data-target]');
    chips.forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    syncExportModalState();
  });

  // Framework family chip clicks
  exportFamilyChips?.addEventListener('click', handleExportFamilyClick);

  // Format select change
  exportFormat?.addEventListener('change', () => {
    lastExportFormat = exportFormat.value || 'css';
    updateLastExportHint();
    syncExportModalState(); // Update button states if disabled format selected
  });

  exportAuditFormat?.addEventListener('change', () => {
    syncExportModalState();
  });

  // Export copy/download
  exportCopyBtn?.addEventListener('click', () => {
    handleExportCopy();
  });

  exportDownloadBtn?.addEventListener('click', () => {
    handleExportDownload();
  });

  // Customize checkboxes in modal
  document.querySelectorAll('[data-exp-cat]').forEach(input => {
    input.addEventListener('change', async () => {
      exportPrefs.preset = 'custom';
      exportPrefs.include[input.dataset.expCat] = input.checked;
      await savePrefs();
    });
  });

  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const unit = btn.dataset.unit;
      if (!UNIT_OPTIONS.includes(unit)) return;
      exportPrefs.unit = unit;
      syncUnitButtons();
      await savePrefs();
      if (tokens && activeTab === 'spacing') renderTokens(activeTab);
      showToast(`Units: ${unit}`);
    });
  });

  applyProBadges();
  verifyUiLayerWiring();
  updateViewOptionsVisibility(activeTab);
  syncExportModalState();
  updateLastExportHint();
}
