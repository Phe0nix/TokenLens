// popup.js - Palext UI logic

// ── Pro feature gating ─────────────────────────────────────────────
// PRO_GATING_ENABLED is the master switch. While it is `false`, every Pro
// feature stays UNLOCKED so the product can be tested freely before launch.
// When you are ready to monetize, set this to `true` and flip the individual
// `gated` attributes below to `true` for the features you want behind the
// paywall. `isProLocked()` resolves both, so no other code needs to change.
const PRO_GATING_ENABLED = false;

// Every Pro feature is registered here. The `gated` attribute is the per-feature
// lock flag — it is `false` now (gate OFF / free for testing). Set it to `true`
// later (together with PRO_GATING_ENABLED = true) to lock that feature.
const PRO_FEATURES = {
  tailwindExport:      { label: 'Tailwind export',          gated: false },
  figmaExport:         { label: 'Figma Tokens export',      gated: false },
  dtcgExport:          { label: 'DTCG export',              gated: false },
  customExport:        { label: 'Custom export builder',    gated: false },
  smartApply:          { label: 'Smart Apply preview',      gated: false },
  unlimitedSnapshots:  { label: 'Unlimited snapshots',      gated: false },
  driftCompare:        { label: 'Snapshot drift compare',   gated: false },
  colorInstances:      { label: 'Locate color on page',     gated: false },
  typographyInstances: { label: 'Locate type on page',      gated: false },
  assetExtraction:     { label: 'Asset extraction',         gated: false },
  auditReport:         { label: 'Audit report export',      gated: false }
};

// Returns true only when global gating is on AND the feature is marked gated.
// During testing (PRO_GATING_ENABLED = false) this always returns false.
function isProLocked(featureKey) {
  const feature = PRO_FEATURES[featureKey];
  if (!feature) return false;
  if (!PRO_GATING_ENABLED) return false;
  return feature.gated === true;
}

// Adds a small "PRO" badge to a registered Pro element so testers can see which
// features are paid, without blocking them while gating is off.
function tagProElement(el, featureKey) {
  if (!el || el.querySelector(':scope > .pro-badge')) return;
  const feature = PRO_FEATURES[featureKey];
  if (!feature) return;
  const badge = document.createElement('span');
  badge.className = 'pro-badge';
  badge.textContent = 'PRO';
  badge.title = isProLocked(featureKey)
    ? `${feature.label} — upgrade to Pro to unlock`
    : `${feature.label} — Pro feature (free during testing)`;
  el.appendChild(badge);
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
let previewInProgress = false;
let colorGroupView = false; // FREE: semantic color grouping toggle (Colors tab)
let eyedropperPickedColor = '';
let pageAssets = null; // PRO: cached extracted assets { images, svgs, icons }
let currentSiteMeta = { title: '', url: '', favicon: '' };
const UI_SURFACE = /sidepanel\.html$/i.test(window.location.pathname) ? 'sidepanel' : 'popup';
const UNIT_OPTIONS = ['px', 'rem', 'em'];
const TOUR_STEPS = [
  { selectors: ['#modeBtn'], title: 'Plan status', text: 'This shows your current plan/testing mode and feature access state.' },
  { selectors: ['#sidePanelBtn'], title: 'Open side panel', text: 'Open Palext in the side panel for a persistent workspace while browsing.', skipOnSidepanel: true },
  { selectors: ['#inspectBtn'], title: 'Inspect any element', text: 'Click Inspect, then hover the page to preview any element\u2019s tokens live. Click an element to pin it, then Capture sends it to the panel.' },
  { selectors: ['#refreshBtn'], title: 'Re-scan page', text: 'Refresh extraction when the page changes so token data stays accurate.' },
  { selectors: ['#saveBtn'], title: 'Save snapshot', text: 'Save this page token state for later diff and Apply preview workflows.' },
  { selectors: ['#themeBtn'], title: 'Theme switch', text: 'Switch between dark and light UI themes.' },
  { selectors: ['#replayTourBtn'], title: 'Tour button', text: 'Replay this walkthrough anytime from here.' },

  { selectors: ['[data-tab="colors"]'], title: 'Colors tab', text: 'Review palette tokens and locate color usage on the page.', before: () => tourOpenTab('colors') },
  { selectors: ['[data-tab="fonts"]'], title: 'Typography tab', text: 'Inspect type families, sizes, and hierarchy in one place.', before: () => tourOpenTab('fonts') },
  { selectors: ['[data-tab="spacing"]'], title: 'Spacing tab', text: 'Check spacing and radius tokens with normalized unit display.', before: () => tourOpenTab('spacing') },
  { selectors: ['#viewOptionsBar', '[data-tab="spacing"]'], title: 'Units control', text: 'Switch between px, rem, and em for spacing/type readability.', before: () => tourOpenTab('spacing') },
  { selectors: ['[data-tab="shadows"]'], title: 'Effects tab', text: 'Browse shadows and gradient/effect tokens.', before: () => tourOpenTab('shadows') },
  { selectors: ['[data-tab="vars"]'], title: 'Variables tab', text: 'View extracted root CSS variables from the page.', before: () => tourOpenTab('vars') },
  { selectors: ['[data-tab="assets"]'], title: 'Assets tab', text: 'Explore images, icons and SVGs with direct download actions.', before: () => tourOpenTab('assets') },
  { selectors: ['[data-tab="insights"]'], title: 'Insights tab', text: 'Insights summarizes palette health, naming quality, risky pairs, and recommendations.', before: () => tourOpenTab('insights') },
  { selectors: ['#toggleWcagOverlayBtn', '[data-tab="insights"]'], title: 'WCAG overlay', text: 'Turn on WCAG overlay to highlight live AA contrast failures directly on the page.', before: () => tourOpenTab('insights') },
  { selectors: ['[data-tab="history"]'], title: 'History tab', text: 'History stores snapshots so you can compare drift and preview changes.', before: () => tourOpenTab('history') },

  { selectors: ['#exportBar'], title: 'Export tokens', text: 'Use the Export button to open a clean export panel with formats, bundle, and audit report options.', before: () => tourOpenTab('colors') },
  { selectors: ['#openExportModalBtn', '#exportBar'], title: 'Export panel', text: 'Select output type (format, bundle, audit), then copy or download from one place.', before: () => tourOpenTab('colors') },

  { selectors: ['[data-action="load"]', '[data-tab="history"]'], title: 'History: Load', text: 'Load snapshot token data into the current workspace view.', before: () => tourOpenTab('history') },
  { selectors: ['[data-action="diff"]', '[data-action="diff-latest"]', '[data-tab="history"]'], title: 'History: Diff', text: 'Compare snapshot and current states to spot drift and changes.', before: () => tourOpenTab('history') },
  { selectors: ['[data-action="apply-preview"]', '[data-tab="history"]'], title: 'History: Apply', text: 'Apply snapshot styling preview directly on the live page.', before: () => tourOpenTab('history') },
  { selectors: ['[data-action="delete"]', '[data-action="clear-all"]', '[data-tab="history"]'], title: 'History: Delete', text: 'Delete one snapshot or clear all saved history when needed.', before: () => tourOpenTab('history') }
];
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
      { id: 'mui', label: 'Material-UI (MUI)' },
      { id: 'chakra', label: 'Chakra UI' },
      { id: 'ant', label: 'Ant Design' }
    ]
  },
  design: {
    label: 'Design tools',
    formats: [
      { id: 'figma', label: 'Figma Tokens', proOnly: true },
      { id: 'dtcg', label: 'DTCG', proOnly: true }
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
let onboardingState = null;
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
  await loadSaved();
  await loadPrefs();
  bindEvents();
  initExportControls();
  applyUiMode();
  await checkInspectResult();
  await extract();
  await maybeStartOnboardingTour();
});

function connectUiSurface() {
  try {
    uiPort = chrome.runtime.connect({ name: UI_SURFACE === 'sidepanel' ? 'palext-sidepanel' : 'palext-popup' });
  } catch (_) {
    uiPort = null;
  }
}

function applySurfaceUi() {
  document.body.classList.toggle('surface-sidepanel', UI_SURFACE === 'sidepanel');
  const sidePanelBtn = document.getElementById('sidePanelBtn');
  if (!sidePanelBtn || UI_SURFACE !== 'sidepanel') return;
  sidePanelBtn.classList.add('is-active');
  sidePanelBtn.disabled = true;
  sidePanelBtn.setAttribute('aria-label', 'Palext is already open in the side panel');
  sidePanelBtn.setAttribute('title', 'Palext is already open in the side panel');
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

// Adds PRO badges to registered Pro UI so testers see what is paid (gating off).
function applyProBadges() {
  const assetsTab = document.querySelector('[data-tab="assets"]');
  if (assetsTab && !assetsTab.querySelector('.pro-badge')) tagProElement(assetsTab, 'assetExtraction');
}

function applyUiMode() {
  // Test mode: keep all features visible and enabled before enforcing plan locks.
  document.body.setAttribute('data-mode', 'free');

  const modeBtn = document.getElementById('modeBtn');
  if (modeBtn) {
    modeBtn.textContent = 'Free (Test)';
    modeBtn.setAttribute('title', 'All features unlocked for testing');
    modeBtn.setAttribute('aria-label', 'Testing mode with all features unlocked');
  }

  document.querySelectorAll('[data-export-format]').forEach(btn => {
    btn.classList.remove('pro-locked');
  });

  const customizeBtn = document.getElementById('customizeExportBtn');
  if (customizeBtn) customizeBtn.classList.remove('pro-locked');

  document.querySelectorAll('[data-pro-only="true"]').forEach(el => {
    if (el.id === 'exportCustomize') return;
    el.classList.remove('hidden');
  });
}

const FREE_SNAPSHOT_LIMIT = 5;

async function saveSite(currentTokens) {
  if (!currentTokens) return;

  const deduped = savedSites.filter(s => s.url !== currentTokens.url);
  if (deduped.length >= FREE_SNAPSHOT_LIMIT) {
    showToast(`Free plan stores up to ${FREE_SNAPSHOT_LIMIT} snapshots. Delete one to make room.`);
    return;
  }

  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: currentTokens.url,
    title: currentTokens.title,
    tokens: currentTokens,
    savedAt: Date.now()
  };

  savedSites = [entry, ...deduped].slice(0, FREE_SNAPSHOT_LIMIT);
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

async function extract() {
  setStatus('scanning');
  lastDiffView = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      setStatus('error', 'No active tab found.');
      return;
    }

    if (!isSupportedTab(tab.url)) {
      setStatus('error', 'Open a normal http/https website tab, then try again.');
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
  return {
    colors: Array.isArray(data.colors) ? data.colors : [],
    fonts: Array.isArray(data.fonts) ? data.fonts : [],
    fontSizes: Array.isArray(data.fontSizes) ? data.fontSizes : [],
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return { ok: false, error: 'No active tab found.' };
  if (!isSupportedTab(tab.url)) return { ok: false, error: 'Open a normal website tab first.' };

  const first = await sendTabMessageOnce(tab.id, message);
  if (first.ok || first.code !== 'NO_RECEIVER') return first;

  const injected = await tryInjectContentScript(tab.id);
  if (!injected) return { ok: false, error: 'Cannot attach to this page.' };
  return sendTabMessageOnce(tab.id, message);
}

async function openEyedropperViaScripting() {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    return { ok: false, error: 'Scripting API is unavailable.' };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

async function openInSidePanel() {
  if (UI_SURFACE === 'sidepanel') {
    showToast('Palext is already open in the side panel.');
    return;
  }

  // Try direct open first so Chrome recognizes this as a user gesture.
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && tab.windowId) {
        await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true });
        try {
          await chrome.sidePanel.open({ tabId: tab.id });
        } catch (_) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
        showToast('Palext opened in the side panel.');
        return;
      }
    }
  } catch (_) {
    // Continue to background fallback.
  }

  try {
    const result = await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not open the side panel.');
      return;
    }
    showToast(result.message || 'Palext opened in the side panel.');
  } catch (_) {
    showToast('Could not open the side panel.');
  }
}

async function maybeStartOnboardingTour(force = false) {
  const data = await chrome.storage.local.get('tl_onboarded');
  if (!force && data.tl_onboarded) return;
  startOnboardingTour();
}

function tourOpenTab(tab) {
  if (!tab || activeTab === tab) return;
  activeTab = tab;
  selectTab(activeTab);
  renderTokens(activeTab);
}

function getVisibleTourSteps() {
  return TOUR_STEPS.filter(step => !(step.skipOnSidepanel && UI_SURFACE === 'sidepanel'));
}

function resolveTourTarget(step) {
  const selectors = Array.isArray(step.selectors)
    ? step.selectors
    : (step.selector ? [step.selector] : []);
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const hidden = el.classList && el.classList.contains('hidden');
    if (hidden) continue;
    return el;
  }
  return null;
}

function clearTourTarget() {
  document.querySelectorAll('.tour-target').forEach(el => el.classList.remove('tour-target'));
}

function detachTourRepositionHandlers() {
  if (!onboardingState || !onboardingState.reposition) return;
  window.removeEventListener('resize', onboardingState.reposition, true);
  window.removeEventListener('scroll', onboardingState.reposition, true);
  if (onboardingState.panelEl) onboardingState.panelEl.removeEventListener('scroll', onboardingState.reposition, true);
  onboardingState.reposition = null;
  onboardingState.panelEl = null;
}

function closeOnboardingTour() {
  detachTourRepositionHandlers();
  clearTourTarget();
  document.getElementById('tourOverlay')?.remove();
  onboardingState = null;
}

function replayOnboardingTour() {
  closeOnboardingTour();
  void maybeStartOnboardingTour(true);
}

async function finishOnboardingTour() {
  await chrome.storage.local.set({ tl_onboarded: true });
  closeOnboardingTour();
}

function placeTourCardNearTarget(card, target) {
  if (!card || !target) return;
  const spacing = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tr = target.getBoundingClientRect();
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;

  let top = tr.bottom + spacing;
  if (top + ch > vh - 8) top = tr.top - ch - spacing;
  if (top < 8) top = 8;

  let left = tr.left;
  if (left + cw > vw - 8) left = vw - cw - 8;
  if (left < 8) left = 8;

  card.style.top = `${Math.round(top)}px`;
  card.style.left = `${Math.round(left)}px`;
}

function renderOnboardingStep() {
  if (!onboardingState || !onboardingState.steps.length) return;
  const step = onboardingState.steps[onboardingState.index];
  if (typeof step.before === 'function') step.before();
  const target = resolveTourTarget(step);
  if (!target) {
    onboardingState.index += 1;
    if (onboardingState.index >= onboardingState.steps.length) {
      void finishOnboardingTour();
      return;
    }
    renderOnboardingStep();
    return;
  }

  clearTourTarget();
  target.classList.add('tour-target');
  try { target.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}

  let overlay = document.getElementById('tourOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tourOverlay';
    overlay.className = 'tour-overlay';
    document.body.appendChild(overlay);
  }

  const last = onboardingState.index === onboardingState.steps.length - 1;
  const first = onboardingState.index === 0;
  overlay.innerHTML = `
    <div class="tour-card" role="dialog" aria-modal="true" aria-label="Palext quick tour">
      <div class="tour-step">${onboardingState.index + 1} / ${onboardingState.steps.length}</div>
      <div class="tour-title">${step.title}</div>
      <div class="tour-copy">${step.text}</div>
      <div class="tour-actions">
        <button class="tiny-btn" id="tourBackBtn"${first ? ' disabled' : ''}>Back</button>
        <button class="tiny-btn" id="tourSkipBtn">Skip</button>
        <button class="tiny-btn wcag-toggle" id="tourNextBtn">${last ? 'Finish' : 'Next'}</button>
      </div>
    </div>
  `;

  const card = overlay.querySelector('.tour-card');
  const reposition = () => placeTourCardNearTarget(card, target);
  detachTourRepositionHandlers();
  onboardingState.reposition = reposition;
  onboardingState.panelEl = document.querySelector('.panel-wrap');
  window.addEventListener('resize', reposition, true);
  window.addEventListener('scroll', reposition, true);
  onboardingState.panelEl?.addEventListener('scroll', reposition, true);
  requestAnimationFrame(reposition);

  overlay.querySelector('#tourBackBtn')?.addEventListener('click', () => {
    if (onboardingState.index <= 0) return;
    onboardingState.index -= 1;
    renderOnboardingStep();
  });

  overlay.querySelector('#tourSkipBtn')?.addEventListener('click', () => {
    void finishOnboardingTour();
  });
  overlay.querySelector('#tourNextBtn')?.addEventListener('click', () => {
    onboardingState.index += 1;
    if (onboardingState.index >= onboardingState.steps.length) {
      void finishOnboardingTour();
      return;
    }
    renderOnboardingStep();
  });
}

function startOnboardingTour() {
  const steps = getVisibleTourSteps();
  if (!steps.length) return;
  onboardingState = { index: 0, steps };
  renderOnboardingStep();
}

function renderTokens(tab) {
  const panel = document.getElementById('panel');
  if (!panel) return;

  panel.innerHTML = '';

  if (inspectResult) renderInspectPanel(inspectResult, panel);

  if (tab !== 'history' && !tokens) {
    panel.innerHTML = '<p class="empty">No token data available.</p>';
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
    </div>
    <span class="colors-toolbar-hint">Click a swatch to copy · ◎ to locate on page</span>
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
    copyText(result.hex);
    renderTokens('colors');
    showToast(`Picked ${result.hex} and copied`);
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
          <span class="eyedropper-bar-sub" style="color:${textOnColor}">Picked via Eyedropper · click hex to copy</span>
        </div>
      </div>
      <div class="eyedropper-bar-actions">
        <button class="eyedropper-bar-btn" id="copyEyedropperBarBtn" style="color:${textOnColor};border-color:${textOnColor}40" title="Copy hex">⎘ Copy</button>
        <button class="eyedropper-bar-close" id="closeEyedropperBarBtn" style="color:${textOnColor};border-color:${textOnColor}40" title="Dismiss" aria-label="Dismiss picked color">✕</button>
      </div>
    `;
    bar.querySelector('#copyEyedropperBarBtn').addEventListener('click', () => {
      copyText(eyedropperPickedColor);
      showToast(`Copied ${eyedropperPickedColor}`);
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
  const lum = parseInt(color.hex.slice(1, 3), 16) * 0.299 + parseInt(color.hex.slice(3, 5), 16) * 0.587 + parseInt(color.hex.slice(5, 7), 16) * 0.114;
  const textCol = lum > 128 ? '#102331' : '#F7FCFF';
  const cWhite = contrast(color.hex, '#FFFFFF');
  const cBlack = contrast(color.hex, '#000000');
  const wcagW = cWhite >= 4.5 ? 'AA' : cWhite >= 3 ? 'A-Large' : 'Fail';
  const wcagB = cBlack >= 4.5 ? 'AA' : cBlack >= 3 ? 'A-Large' : 'Fail';

  const swatch = document.createElement('div');
  swatch.className = 'color-swatch';
  swatch.setAttribute('title', `${color.hex} - click to copy`);
  swatch.setAttribute('role', 'button');
  swatch.setAttribute('tabindex', '0');
  swatch.setAttribute('aria-label', `Color ${color.hex}, click to copy`);
  swatch.style.background = color.hex;
  swatch.innerHTML = `
    <div class="swatch-top" style="color:${textCol}">
      <span class="swatch-hex" style="color:${textCol}">${color.hex}</span>
      <span class="swatch-actions">
        <button class="swatch-locate" style="color:${textCol}" data-pro-feature="colorInstances" title="Locate this color on the page" aria-label="Locate ${color.hex} on page">◎</button>
        <span class="swatch-copy" style="color:${textCol}" aria-hidden="true">⎘</span>
      </span>
    </div>
    <div class="swatch-bottom" style="color:${textCol}">
      <span class="swatch-hsl" title="${color.hsl}">${(color.hsl || '').substring(0, 24)}</span>
      <span class="swatch-contrast" title="Contrast on white / black">W:${wcagW} B:${wcagB}</span>
    </div>
  `;

  const locateBtn = swatch.querySelector('.swatch-locate');
  locateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    locateColorOnPage(color.hex);
  });

  swatch.addEventListener('click', () => {
    copyText(color.hex);
    showToast(`Copied ${color.hex}`);
  });
  swatch.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      copyText(color.hex);
      showToast(`Copied ${color.hex}`);
    }
  });

  return swatch;
}

// PRO: highlight every element on the page using a given color.
async function locateColorOnPage(hex) {
  if (isProLocked('colorInstances')) {
    showToast('Locating colors on the page is a Pro feature.');
    return;
  }
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_COLOR', hex });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate color');
    return;
  }
  showToast(result.count
    ? `${hex}: scrolled to & highlighted ${result.count} element${result.count === 1 ? '' : 's'}. Use the Clear button on the page to reset.`
    : `${hex}: no visible elements currently use this exact color.`);
}

// PRO: highlight every element using a font family / size.
async function locateFontOnPage(target) {
  if (isProLocked('typographyInstances')) {
    showToast('Locating typography on the page is a Pro feature.');
    return;
  }
  const result = await sendActionToActiveTab({ type: 'HIGHLIGHT_FONT', target });
  if (!result || !result.ok) {
    showToast(result && result.error ? result.error : 'Could not locate type');
    return;
  }
  showToast(result.count
    ? `Scrolled to & highlighted ${result.count} element${result.count === 1 ? '' : 's'} using this type. Use the Clear button on the page to reset.`
    : 'No visible elements match this type style right now.');
}

async function clearInstanceOverlay() {
  await sendActionToActiveTab({ type: 'CLEAR_INSTANCE_OVERLAY' });
}

function renderFonts(panel) {
  if (!tokens.fonts.length && !tokens.fontSizes.length) {
    panel.innerHTML = '<p class="empty">No font data found.</p>';
    return;
  }

  // FREE: visual type hierarchy ladder (largest → smallest).
  if (tokens.fontSizes.length) {
    const section = makeSection('Type Hierarchy');
    const ladder = document.createElement('div');
    ladder.className = 'type-ladder';
    const primaryFont = tokens.fonts && tokens.fonts.length ? tokens.fonts[0] : 'inherit';
    const sorted = [...tokens.fontSizes].sort((a, b) => b.px - a.px);
    sorted.forEach(size => {
      const renderPx = Math.max(11, Math.min(34, size.px));
      const row = document.createElement('div');
      row.className = 'type-ladder-row';
      row.innerHTML = `
        <span class="type-ladder-sample" style="font-size:${renderPx}px;font-family:'${primaryFont}',sans-serif">Ag</span>
        <span class="type-ladder-meta"><strong>${size.px}px</strong> · ${formatLength(size.px)}</span>
        <button class="tiny-btn type-ladder-locate" data-pro-feature="typographyInstances" title="Locate this size on the page">◎ Locate</button>
      `;
      row.querySelector('.type-ladder-locate').addEventListener('click', () => {
        locateFontOnPage({ size: `${size.px}px`, label: `${size.px}px` });
      });
      ladder.appendChild(row);
    });
    section.appendChild(ladder);
    panel.appendChild(section);
  }

  if (tokens.fonts.length) {
    const section = makeSection('Font Families');
    const list = document.createElement('div');
    list.className = 'font-list';

    tokens.fonts.forEach(font => {
      const row = document.createElement('div');
      row.className = 'token-row';
      row.innerHTML = `<span class="token-preview" style="font-family:'${font}',sans-serif">${font}</span><button class="tiny-btn font-locate" data-pro-feature="typographyInstances" title="Locate this font on the page">◎</button><button class="copy-btn" aria-label="Copy font name ${font}" title="Copy">⎘</button>`;
      row.querySelector('.font-locate').addEventListener('click', () => {
        locateFontOnPage({ family: font, label: font });
      });
      row.querySelector('.copy-btn').addEventListener('click', () => {
        copyText(`'${font}', sans-serif`);
        showToast('Font copied');
      });
      list.appendChild(row);
    });

    section.appendChild(list);
    panel.appendChild(section);
  }

  if (tokens.fontSizes.length) {
    const section = makeSection('Font Sizes');
    const list = document.createElement('div');
    list.className = 'size-list';

    tokens.fontSizes.forEach(size => {
      const row = document.createElement('div');
      row.className = 'token-row';
      row.innerHTML = `
        <div class="size-preview" style="font-size:${Math.min(size.px, 24)}px">Ag</div>
        <div class="size-info"><span class="size-px">${size.px}px</span><span class="size-rem">${formatLength(size.px)}</span></div>
        <button class="copy-btn" aria-label="Copy size ${size.rem}" title="Copy ${activeUnit()}">⎘</button>
      `;
      row.querySelector('.copy-btn').addEventListener('click', () => {
        const value = activeUnit() === 'px' ? `${size.px}px` : formatLength(size.px);
        copyText(value);
        showToast(`Copied ${value}`);
      });
      list.appendChild(row);
    });

    section.appendChild(list);
    panel.appendChild(section);
  }

  if (tokens.fontWeights.length) {
    const section = makeSection('Font Weights');
    const grid = document.createElement('div');
    grid.className = 'weight-grid';

    tokens.fontWeights.forEach(weight => {
      const chip = document.createElement('button');
      chip.className = 'weight-chip';
      chip.style.fontWeight = weight;
      chip.textContent = String(weight);
      chip.addEventListener('click', () => {
        copyText(String(weight));
        showToast(`Copied ${weight}`);
      });
      grid.appendChild(chip);
    });

    section.appendChild(grid);
    panel.appendChild(section);
  }

  if (tokens.lineHeights.length) {
    const section = makeSection('Line Heights');
    const grid = document.createElement('div');
    grid.className = 'weight-grid';

    tokens.lineHeights.forEach(lh => {
      const chip = document.createElement('button');
      chip.className = 'weight-chip';
      chip.textContent = String(lh);
      chip.addEventListener('click', () => {
        copyText(String(lh));
        showToast(`Copied ${lh}`);
      });
      grid.appendChild(chip);
    });

    section.appendChild(grid);
    panel.appendChild(section);
  }

  if (tokens.fontSources && tokens.fontSources.length) {
    const section = makeSection('Font Sources');
    const list = document.createElement('div');
    list.className = 'insight-list';
    tokens.fontSources.forEach(item => {
      const row = document.createElement('div');
      row.className = 'insight-item';
      row.innerHTML = `<strong>${escapeHtmlText(item.provider || 'Unknown')}</strong> · ${escapeHtmlText(item.usage || '')}`;
      list.appendChild(row);
    });
    section.appendChild(list);
    panel.appendChild(section);
  }
}

function renderSpacing(panel) {
  if (tokens.spacing.length) {
    const section = makeSection('Detected Spacing Values');
    const help = document.createElement('p');
    help.className = 'spacing-help';
    help.textContent = 'These values come from margin, padding, and gap styles found on the page. Bar length shows value size, and badges show the most common source.';

    const list = document.createElement('div');
    list.className = 'spacing-list';
    const spacingMeta = tokens.spacingMeta || {};

    tokens.spacing.forEach(value => {
      const meta = spacingMeta[String(value)] || { count: 0, dominant: 'mixed' };
      const dominantLabel = meta.dominant === 'mixed' ? 'mixed usage' : `mostly ${meta.dominant}`;

      const row = document.createElement('div');
      row.className = 'spacing-row';
      row.innerHTML = `
        <div class="spacing-info">
          <span class="spacing-label">${formatLength(value)} / ${(value / 4).toFixed(1)}x</span>
          <span class="spacing-meta">Used ${meta.count || 0} times</span>
        </div>
        <span class="spacing-source">${dominantLabel}</span>
        <div class="spacing-bar-wrap"><div class="spacing-bar" style="width:${Math.min(value * 1.5, 200)}px"></div></div>
        <button class="copy-btn" aria-label="Copy ${formatLength(value)}" title="Copy">⎘</button>
      `;
      row.querySelector('.copy-btn').addEventListener('click', () => {
        copyText(formatLength(value));
        showToast(`Copied ${formatLength(value)}`);
      });
      list.appendChild(row);
    });

    section.appendChild(help);
    section.appendChild(list);
    panel.appendChild(section);
  }

  if (tokens.radii.length) {
    const section = makeSection('Border Radius');
    const grid = document.createElement('div');
    grid.className = 'radius-grid';

    tokens.radii.forEach(value => {
      const item = document.createElement('button');
      item.className = 'radius-item';
      item.innerHTML = `<div class="radius-preview" style="border-radius:${value}px"></div><span class="radius-val">${formatLength(value)}</span>`;
      item.addEventListener('click', () => {
        copyText(formatLength(value));
        showToast(`Copied ${formatLength(value)}`);
      });
      grid.appendChild(item);
    });

    section.appendChild(grid);
    panel.appendChild(section);
  }

  if (!tokens.spacing.length && !tokens.radii.length) {
    panel.innerHTML = '<p class="empty">No spacing data found.</p>';
  }
}

function renderShadows(panel) {
  if (!tokens.shadows.length && !(tokens.gradients && tokens.gradients.length) && !(tokens.motion && tokens.motion.length)) {
    panel.innerHTML = '<p class="empty">No shadows or gradients found.</p>';
    return;
  }

  if (tokens.shadows.length) {
    const section = makeSection('Shadows');
    const list = document.createElement('div');
    list.className = 'shadow-list';

    tokens.shadows.forEach((shadow, i) => {
      const row = document.createElement('div');
      row.className = 'shadow-row';
      row.innerHTML = `
        <div class="shadow-preview" style="box-shadow:${shadow}"></div>
        <div class="shadow-info">
          <span class="shadow-name">Shadow ${i + 1}</span>
          <span class="shadow-val">${shadow.substring(0, 70)}${shadow.length > 70 ? '...' : ''}</span>
        </div>
        <button class="copy-btn" aria-label="Copy shadow ${i + 1}" title="Copy">⎘</button>
      `;
      row.querySelector('.copy-btn').addEventListener('click', () => {
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

    tokens.gradients.forEach((gradient, i) => {
      const row = document.createElement('div');
      row.className = 'gradient-row';
      row.innerHTML = `
        <div class="gradient-preview" style="background:${gradient}"></div>
        <div class="gradient-value">${gradient.substring(0, 90)}${gradient.length > 90 ? '...' : ''}</div>
      `;
      row.addEventListener('click', () => {
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
      help.textContent = 'Transition tokens found on this page. Click any row to copy the full transition value.';
      section.appendChild(help);

      const list = document.createElement('div');
      list.className = 'motion-list';

      tokens.motion.forEach(m => {
        const durMs = parseDurationToMs(m.duration);
        const easingLabel = friendlyEasing(m.easing);
        const fullValue = `${m.property} ${m.duration} ${m.easing}`;

        const row = document.createElement('div');
        row.className = 'motion-row';
        row.setAttribute('title', `Click to copy: ${fullValue}`);
        row.innerHTML = `
          <div class="motion-preview" aria-hidden="true">
            <div class="motion-dot" style="animation-timing-function:${m.easing};animation-duration:${Math.max(0.4, Math.min(2, durMs / 1000))}s"></div>
          </div>
          <div class="motion-info">
            <span class="motion-prop">${m.property}</span>
            <span class="motion-meta">
              <span class="motion-dur">${m.duration}</span>
              <span class="motion-ease">${easingLabel}</span>
            </span>
          </div>
          <span class="motion-count" title="${m.count} uses">${m.count}×</span>
          <button class="copy-btn" aria-label="Copy ${fullValue}" title="Copy">⎘</button>
        `;
        row.querySelector('.copy-btn').addEventListener('click', e => {
          e.stopPropagation();
          copyText(fullValue);
          showToast('Transition copied');
        });
        row.addEventListener('click', () => {
          copyText(fullValue);
          showToast('Transition copied');
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

  const section = makeSection(`${keys.length} CSS Variables from :root`);
  const list = document.createElement('div');
  list.className = 'var-list';

  keys.forEach(name => {
    const value = vars[name];
    const row = document.createElement('div');
    row.className = 'var-row';
    const isColor = /^#|rgb|hsl|oklch|lab|lch/i.test(value);

    row.innerHTML = `
      ${isColor ? `<span class="var-color-dot" style="background:${value}"></span>` : '<span class="var-color-dot var-no-dot"></span>'}
      <code class="var-name">${name}</code>
      <code class="var-val">${String(value).substring(0, 32)}</code>
      <button class="copy-btn" aria-label="Copy variable ${name}" title="Copy">⎘</button>
    `;

    row.querySelector('.copy-btn').addEventListener('click', () => {
      copyText(`${name}: ${value}`);
      showToast('Variable copied');
    });

    list.appendChild(row);
  });

  section.appendChild(list);
  panel.appendChild(section);
}

// PRO: fetch images, SVGs and icons from the active page.
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
  if (isProLocked('assetExtraction')) {
    panel.innerHTML = '<p class="empty">Asset extraction is a Pro feature. Upgrade to browse and download images, SVGs and icons.</p>';
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
        <button class="tiny-btn" id="assetDownloadAllBtn" title="Download every asset on this page">⬇ Download all (${totalAssets})</button>
        <button class="tiny-btn" id="assetRescanBtn">↺ Re-scan</button>
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

    if (assets.icons.length) {
      wrap.appendChild(buildAssetSection('Icons', assets.icons, 'icon'));
    }
    if (assets.svgs.length) {
      wrap.appendChild(buildAssetSection('SVGs', assets.svgs, 'svg'));
    }
    if (assets.images.length) {
      wrap.appendChild(buildAssetSection('Images', assets.images, 'image'));
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
    const dims = item.width && item.height ? `${item.width}×${item.height}` : (item.type || kind);
    card.innerHTML = `
      <div class="asset-thumb"><img src="${src}" alt="${(item.alt || title).toString().replace(/"/g, '')}" loading="lazy" /></div>
      <div class="asset-meta">
        <span class="asset-dims">${dims}</span>
        <div class="asset-actions">
          <button class="tiny-btn" data-act="copy" title="Copy ${item.markup ? 'SVG markup' : 'URL'}">Copy</button>
          <button class="tiny-btn" data-act="dl" title="Download">⬇</button>
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

// Downloads a remote asset by opening it; falls back to copying the URL.
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
    copyText(url);
    showToast('Could not auto-download — URL copied instead.');
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

  const help = document.createElement('p');
  help.className = 'insight-help';
  help.textContent = 'Insights are now visual first: use Quick Actions, then explore the cards for details.';

  const totalTokenCount =
    (tokens.colors || []).length +
    (tokens.fonts || []).length +
    (tokens.spacing || []).length +
    (tokens.radii || []).length +
    (tokens.shadows || []).length +
    (tokens.gradients || []).length;
  const colorPct = totalTokenCount ? Math.round(((tokens.colors || []).length / totalTokenCount) * 100) : 0;
  const typePct = totalTokenCount ? Math.round(((tokens.fonts || []).length / totalTokenCount) * 100) : 0;
  const spacingPct = totalTokenCount ? Math.round((((tokens.spacing || []).length + (tokens.radii || []).length) / totalTokenCount) * 100) : 0;

  const visualStrip = document.createElement('div');
  visualStrip.className = 'insight-visual-strip';
  visualStrip.innerHTML = `
    <div class="insight-visual-card">
      <div class="insight-label">Design Health</div>
      <div class="insight-score-row">${scoreRing(data.systemScore, 'lg')}</div>
      <div class="insight-sub">${scoreBucket(data.systemScore)}</div>
    </div>
    <div class="insight-visual-card">
      <div class="insight-label">Token Mix</div>
      <div class="insight-pie" style="--slice-a:${Math.max(0, colorPct)};--slice-b:${Math.max(0, colorPct + typePct)}"></div>
      <div class="insight-pie-legend">
        <span><i class="dot dot-colors"></i>Colors ${colorPct}%</span>
        <span><i class="dot dot-type"></i>Type ${typePct}%</span>
        <span><i class="dot dot-space"></i>Spacing ${spacingPct}%</span>
      </div>
    </div>
    <div class="insight-visual-card">
      <div class="insight-label">Live AA Fails</div>
      <div class="insight-value">${data.liveWcagFailCount}</div>
      <div class="insight-sub">Checked ${data.liveWcagChecked} text blocks</div>
    </div>
  `;

  const pageToolsTitle = document.createElement('div');
  pageToolsTitle.className = 'section-title';
  pageToolsTitle.style.marginTop = '8px';
  pageToolsTitle.textContent = 'Quick Actions';

  const pageToolsHint = document.createElement('div');
  pageToolsHint.className = 'insight-tools-hint';
  pageToolsHint.textContent = 'These buttons run directly on the website so you can test accessibility and layout instantly.';

  const pageTools = document.createElement('div');
  pageTools.className = 'insight-quick-tools';
  pageTools.innerHTML = `
    <button class="tiny-btn insight-tool-btn" id="toggleColorBlindBtn">👁 ${colorBlindLabel(colorBlindMode)}</button>
    <button class="tiny-btn insight-tool-btn ${measureModeEnabled ? 'wcag-active' : ''}" id="toggleMeasureModeBtn">📏 ${measureModeEnabled ? 'Measure On' : 'Measure Off'}</button>
    <button class="tiny-btn insight-tool-btn ${layoutOverlayEnabled ? 'wcag-active' : ''}" id="toggleLayoutOverlayBtn">🧱 ${layoutOverlayEnabled ? 'Layout On' : 'Layout Off'}</button>
    <div class="insight-tool-note" id="colorBlindModeNote">${colorBlindDescription(colorBlindMode)}</div>
  `;

  const systemTitle = document.createElement('div');
  systemTitle.className = 'section-title';
  systemTitle.textContent = 'Token Consistency';

  // Gather token counts for the bar chart
  const tcColors  = tokens.colors?.length  || 0;
  const tcFonts   = tokens.fonts?.length   || 0;
  const tcSpacing = tokens.spacing?.length || 0;
  const tcRadii   = tokens.radii?.length   || 0;
  const tcShadows = tokens.shadows?.length || 0;

  // Ideal upper bounds per category (for progress bar scaling)
  const tcMax = { colors: 24, fonts: 6, spacing: 12, radii: 8, shadows: 8 };
  const grade = data.systemScore >= 85 ? { label: 'A', color: '#22c55e' }
              : data.systemScore >= 70 ? { label: 'B', color: '#84cc16' }
              : data.systemScore >= 55 ? { label: 'C', color: '#eab308' }
              : data.systemScore >= 40 ? { label: 'D', color: '#f97316' }
              :                           { label: 'F', color: '#ef4444' };

  // Flat 2-cell row fragment: [bar-track] [count+status badge]
  function tcBar(count, max, ideal) {
    const pct = Math.min(100, Math.round((count / max) * 100));
    const over = count > ideal;
    const empty = count === 0;
    const barColor = over ? '#f97316' : empty ? '#94a3b8' : '#22c55e';
    const badgeBg  = over ? '#f9731622' : empty ? '#94a3b822' : '#22c55e22';
    const badgeClr = over ? '#ea580c'   : empty ? '#64748b'   : '#16a34a';
    const badgeTxt = over ? `↑ ${count - ideal} over` : empty ? 'none' : '✓ ok';
    return `
      <div class="tc-bar-track" title="${count} of ${max} (ideal ≤${ideal})">
        <div class="tc-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        <div class="tc-bar-ideal" style="left:${Math.round((ideal/max)*100)}%"></div>
      </div>
      <span class="tc-count-badge" style="--badge-bg:${badgeBg};--badge-clr:${badgeClr};background:${badgeBg};color:${badgeClr};border:1px solid ${badgeClr}40">
        <strong>${count}</strong> ${badgeTxt}
      </span>`;
  }

  // Personality traits as chips
  const traits = data.personality.split(' • ').map(t => `<span class="tc-trait-chip">${t}</span>`).join('');

  const cssStats = tokens.cssStats || { styleRules: 0, declarations: 0, inlineStyles: 0, avgSpecificity: 0, quality: 'Unknown' };

  const systemCard = document.createElement('div');
  systemCard.className = 'tc-card';
  systemCard.innerHTML = `
    <div class="tc-header">
      <div class="tc-score-block">
        ${scoreRing(data.systemScore, 'lg')}
        <div class="tc-grade-badge" style="background:${grade.color}">${grade.label}</div>
      </div>
      <div class="tc-header-info">
        <div class="tc-title-text">Consistency Score</div>
        <div class="tc-score-label" style="color:${grade.color}">${scoreBucket(data.systemScore)}</div>
        <div class="tc-sub">Penalised for over-varied colors, spacing, radii &amp; shadows.</div>
        <div class="tc-traits">${traits}</div>
      </div>
    </div>
    <div class="tc-divider"></div>
    <div class="tc-categories">
      <div class="tc-cat-header">
        <span></span>
        <span>Category</span>
        <span>Density</span>
        <span>Status</span>
      </div>
      <div class="tc-cat-row">
        <span class="tc-cat-icon">🎨</span><span class="tc-cat-name">Colors</span>
        ${tcBar(tcColors, tcMax.colors, 16)}
      </div>
      <div class="tc-cat-row">
        <span class="tc-cat-icon">🔤</span><span class="tc-cat-name">Fonts</span>
        ${tcBar(tcFonts, tcMax.fonts, 3)}
      </div>
      <div class="tc-cat-row">
        <span class="tc-cat-icon">📐</span><span class="tc-cat-name">Spacing</span>
        ${tcBar(tcSpacing, tcMax.spacing, 8)}
      </div>
      <div class="tc-cat-row">
        <span class="tc-cat-icon">⬡</span><span class="tc-cat-name">Radii</span>
        ${tcBar(tcRadii, tcMax.radii, 4)}
      </div>
      <div class="tc-cat-row">
        <span class="tc-cat-icon">🌘</span><span class="tc-cat-name">Shadows</span>
        ${tcBar(tcShadows, tcMax.shadows, 4)}
      </div>
    </div>
    <div class="tc-divider"></div>
    <div class="tc-css-health">
      <div class="tc-css-title">🩺 CSS Health Snapshot</div>
      <div class="tc-css-grid">
        <div class="tc-css-stat tc-css-blue"><span class="tc-css-num">${cssStats.styleRules}</span><span class="tc-css-lbl">Rules</span></div>
        <div class="tc-css-stat tc-css-purple"><span class="tc-css-num">${cssStats.declarations}</span><span class="tc-css-lbl">Declarations</span></div>
        <div class="tc-css-stat tc-css-orange"><span class="tc-css-num">${cssStats.inlineStyles}</span><span class="tc-css-lbl">Inline styles</span></div>
        <div class="tc-css-stat tc-css-teal"><span class="tc-css-num">${cssStats.avgSpecificity}</span><span class="tc-css-lbl">Avg. specificity</span></div>
      </div>
      <div class="tc-css-quality">${cssStats.quality}</div>
    </div>
  `;

  const recTitle = document.createElement('div');
  recTitle.className = 'section-title';
  recTitle.style.marginTop = '6px';
  recTitle.textContent = 'Recommended Actions';

  const recList = document.createElement('div');
  recList.className = 'insight-list';
  data.recommendations.forEach(text => {
    const item = document.createElement('div');
    item.className = 'insight-item';
    item.innerHTML = decorateHex(text);
    recList.appendChild(item);
  });

  const recIcons = ['🎯','📏','⚠️','✅','💡'];
  recList.className = 'rec-list';
  recList.innerHTML = '';
  data.recommendations.forEach((text, i) => {
    const item = document.createElement('div');
    item.className = 'rec-item';
    item.innerHTML = `<span class="rec-icon">${recIcons[i % recIcons.length]}</span><span class="rec-text">${decorateHex(text)}</span>`;
    recList.appendChild(item);
  });

  const accessibilityTitle = document.createElement('div');
  accessibilityTitle.className = 'section-title';
  accessibilityTitle.style.marginTop = '8px';
  accessibilityTitle.textContent = 'Accessibility';

  const accScore = data.paletteAccessibilityScore;
  const accScoreColor = accScore >= 80 ? '#16a34a' : accScore >= 55 ? '#d97706' : '#dc2626';
  const wcagFailBg = data.liveWcagFailCount === 0 ? '#22c55e' : '#ef4444';
  const accessibilityGrid = document.createElement('div');
  accessibilityGrid.className = 'a11y-summary-card';
  accessibilityGrid.innerHTML = `
    <div class="a11y-sum-left">
      ${scoreRing(accScore, 'lg')}
      <div class="a11y-sum-info">
        <div class="a11y-sum-label">Palette Accessibility</div>
        <div class="a11y-sum-grade" style="color:${accScoreColor}">${scoreBucket(accScore)}</div>
        <div class="a11y-sum-sub">From ${(tokens.colors||[]).length} extracted color tokens</div>
      </div>
    </div>
    <div class="a11y-sum-right">
      <div class="a11y-live-badge" style="background:${wcagFailBg}22;border-color:${wcagFailBg}55;color:${wcagFailBg}">
        <span class="a11y-live-num">${data.liveWcagFailCount}</span>
        <span class="a11y-live-lbl">Live WCAG AA fails</span>
        <span class="a11y-live-checked">Checked ${data.liveWcagChecked} text blocks</span>
      </div>
    </div>
  `;

  const a11yAction = document.createElement('div');
  a11yAction.className = 'insight-action-row';
  a11yAction.innerHTML = wcagOverlayActive
    ? '<button class="tiny-btn wcag-toggle wcag-active" id="toggleWcagOverlayBtn">&#9679; WCAG Overlay ON</button>'
    : '<button class="tiny-btn wcag-toggle" id="toggleWcagOverlayBtn">&#9650; Show WCAG Fails on Page</button>';

  const fixList = document.createElement('div');
  fixList.className = 'fix-list';
  if (data.lowContrastFixes.length) {
    data.lowContrastFixes.forEach(text => {
      const item = document.createElement('div');
      item.className = 'fix-item';
      item.innerHTML = `<span class="fix-icon">🔆</span><span class="fix-text">${decorateHex(text)}</span>`;
      fixList.appendChild(item);
    });
  } else {
    fixList.innerHTML = '<div class="fix-all-ok">✓ No palette-level contrast replacements needed — palette looks good!</div>';
  }

  const advA11yTitle = document.createElement('div');
  advA11yTitle.className = 'section-title';
  advA11yTitle.style.marginTop = '8px';
  advA11yTitle.textContent = 'Advanced Accessibility Report';

  const matrix = data.advancedA11y;
  const tot = matrix.totals;

  // Helper: percentage bar row
  function passBar(label, pass, total, color) {
    const pct = total ? Math.round((pass / total) * 100) : 0;
    const textColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
    return `
      <div class="a11y-bar-row">
        <span class="a11y-bar-label">${label}</span>
        <div class="a11y-bar-track">
          <div class="a11y-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="a11y-bar-pct" style="color:${textColor}">${pass}/${total}</span>
        <span class="a11y-bar-badge" style="background:${textColor}20;color:${textColor}">${pct}%</span>
      </div>`;
  }

  // Risky pairs rendered as swatch pairs
  const riskyPairsHtml = matrix.riskyPairs.length
    ? matrix.riskyPairs.map(text => {
        // Format: "#HEX1 on #HEX2 (R:1)"
        const m = text.match(/(#[0-9a-fA-F]{3,8})\s+on\s+(#[0-9a-fA-F]{3,8})\s+\(([^)]+)\)/i);
        if (m) {
          return `<div class="a11y-pair-row">
            <span class="a11y-pair-swatch" style="background:${m[2]}"><span class="a11y-pair-fg" style="background:${m[1]}"></span></span>
            <span class="a11y-pair-text">${decorateHex(m[1])} <span class="a11y-pair-on">on</span> ${decorateHex(m[2])}</span>
            <span class="a11y-pair-ratio" style="background:#ef444420;color:#ef4444">${m[3]}</span>
          </div>`;
        }
        return `<div class="a11y-pair-row a11y-pair-text-only">${decorateHex(text)}</div>`;
      }).join('')
    : '<div class="a11y-ok-msg">✓ No critical (&lt;3:1) palette pairs detected</div>';

  const advCard = document.createElement('div');
  advCard.className = 'a11y-card';
  advCard.innerHTML = `
    <div class="a11y-matrix-section">
      <div class="a11y-section-head">WCAG Pass Rates <span class="a11y-pairs-hint">${tot.pairs} color pairs sampled</span></div>
      ${passBar('AA Normal (4.5:1)',  tot.aaNormalPass,  tot.pairs, '#3b82f6')}
      ${passBar('AA Large (3:1)',     tot.aaLargePass,   tot.pairs, '#6366f1')}
      ${passBar('AAA Normal (7:1)',   tot.aaaNormalPass, tot.pairs, '#8b5cf6')}
      ${passBar('AAA Large (4.5:1)', tot.aaaLargePass,  tot.pairs, '#a78bfa')}
    </div>
    <div class="a11y-divider"></div>
    <div class="a11y-fixes-section">
      <div class="a11y-section-head">Prioritized Fixes</div>
      ${matrix.rankedFixes.map(t => `<div class="a11y-fix-row"><span class="a11y-fix-icon">⚡</span><span>${decorateHex(t)}</span></div>`).join('')}
    </div>
    <div class="a11y-divider"></div>
    <div class="a11y-risky-section">
      <div class="a11y-section-head">Critical Pairs <span class="a11y-pairs-hint">ratio &lt; 3:1</span></div>
      ${riskyPairsHtml}
    </div>
  `;

  const hygieneTitle = document.createElement('div');
  hygieneTitle.className = 'section-title';
  hygieneTitle.style.marginTop = '8px';
  hygieneTitle.textContent = 'Variable Adoption';

  const hc = data.hardcodedAudit;
  const colorsOk  = hc.hardcodedColorCount === 0;
  const spacingOk = hc.hardcodedSpacingCount === 0;
  const totalOk   = hc.totalOccurrences === 0;

  const auditCard = document.createElement('div');
  auditCard.className = 'adopt-card';
  auditCard.innerHTML = `
    <div class="adopt-stats">
      <div class="adopt-stat adopt-stat-red">
        <span class="adopt-stat-icon">🎨</span>
        <span class="adopt-stat-num" style="color:${colorsOk ? '#16a34a' : '#dc2626'}">${hc.hardcodedColorCount}</span>
        <span class="adopt-stat-lbl">hardcoded colors</span>
      </div>
      <div class="adopt-stat adopt-stat-orange">
        <span class="adopt-stat-icon">📐</span>
        <span class="adopt-stat-num" style="color:${spacingOk ? '#16a34a' : '#ea580c'}">${hc.hardcodedSpacingCount}</span>
        <span class="adopt-stat-lbl">hardcoded spacing</span>
      </div>
      <div class="adopt-stat adopt-stat-purple">
        <span class="adopt-stat-icon">🔢</span>
        <span class="adopt-stat-num" style="color:${totalOk ? '#16a34a' : '#7c3aed'}">${hc.totalOccurrences}</span>
        <span class="adopt-stat-lbl">total occurrences</span>
      </div>
    </div>
  `;

  const auditList = document.createElement('div');
  auditList.className = 'adopt-notes';
  if (hc.notes.length) {
    hc.notes.forEach(text => {
      const item = document.createElement('div');
      item.className = 'adopt-note';
      item.innerHTML = `<span class="adopt-note-icon">⚠️</span><span>${decorateHex(text)}</span>`;
      auditList.appendChild(item);
    });
  } else {
    auditList.innerHTML = '<div class="adopt-all-ok">🎉 All values are tokenised — no hardcoded styles found!</div>';
  }

  const namingList = document.createElement('div');
  namingList.className = 'naming-list';
  const namingTitle = document.createElement('div');
  namingTitle.className = 'section-title';
  namingTitle.style.marginTop = '8px';
  namingTitle.textContent = 'Suggested Token Names';
  data.namingSuggestions.forEach(text => {
    const item = document.createElement('div');
    item.className = 'naming-item';
    item.innerHTML = `<span class="naming-icon">🏷️</span><span class="naming-text">${decorateHex(text)}</span>`;
    namingList.appendChild(item);
  });

  section.appendChild(help);
  section.appendChild(visualStrip);
  section.appendChild(pageToolsTitle);
  section.appendChild(pageToolsHint);
  section.appendChild(pageTools);
  section.appendChild(systemTitle);
  section.appendChild(systemCard);
  section.appendChild(recTitle);
  section.appendChild(recList);
  section.appendChild(accessibilityTitle);
  section.appendChild(accessibilityGrid);
  section.appendChild(a11yAction);
  section.appendChild(fixList);
  section.appendChild(advA11yTitle);
  section.appendChild(advCard);
  section.appendChild(hygieneTitle);
  section.appendChild(auditCard);
  section.appendChild(auditList);
  if (data.namingSuggestions.length) {
    section.appendChild(namingTitle);
    section.appendChild(namingList);
  }

  const toggleBtn = section.querySelector('#toggleWcagOverlayBtn');
  toggleBtn?.addEventListener('click', async () => {
    const result = await sendActionToActiveTab({ type: 'TOGGLE_WCAG_OVERLAY' });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not toggle overlay');
      return;
    }
    wcagOverlayActive = !!result.enabled;
    if (toggleBtn) {
      toggleBtn.textContent = wcagOverlayActive ? '\u25CF WCAG Overlay ON' : '\u25B2 Show WCAG Fails on Page';
      toggleBtn.classList.toggle('wcag-active', wcagOverlayActive);
    }
    if (result.enabled) {
      showToast(result.count > 0 ? `WCAG overlay on — ${result.count} fails highlighted on page` : 'WCAG overlay on — no contrast fails found');
    } else {
      showToast('WCAG overlay off — page restored');
    }
  });

  section.querySelector('#toggleColorBlindBtn')?.addEventListener('click', async () => {
    const nextMode = nextColorBlindMode(colorBlindMode);
    const result = await sendActionToActiveTab({ type: 'SET_COLOR_BLIND_MODE', mode: nextMode });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not toggle simulation');
      return;
    }
    colorBlindMode = result.mode || 'off';
    renderTokens('insights');
    showToast(colorBlindMode === 'off'
      ? 'Color simulation off: showing original colors.'
      : `${colorBlindLabel(colorBlindMode)}: ${colorBlindDescription(colorBlindMode)}`);
  });

  section.querySelector('#toggleMeasureModeBtn')?.addEventListener('click', async () => {
    const result = await sendActionToActiveTab({ type: 'TOGGLE_MEASURE_MODE', enabled: !measureModeEnabled });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not toggle measure mode');
      return;
    }
    measureModeEnabled = !!result.enabled;
    renderTokens('insights');
    showToast(measureModeEnabled
      ? 'Measure mode on: click two elements on page to see px distance.'
      : 'Measure mode off');
  });

  section.querySelector('#toggleLayoutOverlayBtn')?.addEventListener('click', async () => {
    const result = await sendActionToActiveTab({ type: 'TOGGLE_LAYOUT_OVERLAY', enabled: !layoutOverlayEnabled });
    if (!result || !result.ok) {
      showToast(result && result.error ? result.error : 'Could not toggle layout overlay');
      return;
    }
    layoutOverlayEnabled = !!result.enabled;
    renderTokens('insights');
    showToast(layoutOverlayEnabled
      ? `Layout overlay on${result.count ? ` (${result.count} containers)` : ''}`
      : 'Layout overlay off');
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
    section.innerHTML += '<p class="empty">No snapshots yet. Save any page using the bookmark button.</p>';
    panel.appendChild(section);
    return;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'history-toolbar';
  toolbar.innerHTML = `
    <button class="tiny-btn" data-action="mini-crawl">Mini Crawl</button>
    <button class="tiny-btn" data-action="diff-url">Compare with URL</button>
    <button class="tiny-btn" data-action="diff-latest">Diff with latest</button>
    <button class="tiny-btn danger" data-action="clear-all">Clear all</button>
  `;

  const compareHelp = document.createElement('div');
  compareHelp.className = 'preview-help';
  compareHelp.textContent = 'Compare with URL opens the target page in a hidden background tab, extracts tokens, then shows a side-by-side diff here.';
  section.appendChild(compareHelp);

  toolbar.querySelector('[data-action="mini-crawl"]')?.addEventListener('click', async () => {
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

  toolbar.querySelector('[data-action="diff-url"]')?.addEventListener('click', async () => {
    if (!tokens) {
      showToast('Scan current page first');
      return;
    }
    const input = window.prompt('Compare current page with URL:', 'https://');
    if (!input) return;
    const url = String(input).trim();
    if (!/^https?:\/\//i.test(url)) {
      showToast('Please enter a valid http/https URL');
      return;
    }
    showToast('Comparing current page with URL… extracting background tokens.');
    const remoteTokens = await extractTokensFromUrl(url);
    if (!remoteTokens) {
      showToast('Could not extract tokens from that URL');
      return;
    }
    lastDiffView = buildSnapshotDiff(tokens, remoteTokens, `${getDomain(url)} live page`);
    renderTokens('history');
    showToast('Live URL diff generated');
  });

  const diffLatestBtn = toolbar.querySelector('[data-action="diff-latest"]');
  if (!tokens || !savedSites.length) {
    diffLatestBtn.setAttribute('disabled', 'true');
    diffLatestBtn.setAttribute('title', 'Scan and save at least one snapshot first');
  }

  diffLatestBtn?.addEventListener('click', () => {
    if (!tokens || !savedSites.length) {
      showToast('Scan and save at least one snapshot first');
      return;
    }
    const latest = savedSites[0];
    lastDiffView = buildSnapshotDiff(tokens, latest.tokens, `latest snapshot (${getDomain(latest.url)})`);
    renderTokens('history');
    showToast('Diff view generated');
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

  const previewHelp = document.createElement('div');
  previewHelp.className = 'preview-help';
  previewHelp.textContent = 'Smart Apply uses variable matching + semantic remap. You will see an estimated coverage % after apply.';
  section.appendChild(previewHelp);

  const list = document.createElement('div');
  list.className = 'history-list';

  savedSites.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const dt = new Date(entry.savedAt || Date.now());
    const dateLabel = dt.toLocaleDateString();
    const timeLabel = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isActivePrev = activePreview && activePreview.key === snapshotKey(entry);
    const applyBtnLabel = isActivePrev ? '✓ Previewing' : previewInProgress ? 'Applying…' : 'Apply to page';
    const applyBtnDisabled = (previewInProgress && !isActivePrev) ? ' disabled' : '';
    const confidence = estimatePreviewConfidence(entry.tokens, tokens);

    row.innerHTML = `
      <div class="history-meta">
        <div class="history-title-row">
          <div class="history-title">${entry.title || getDomain(entry.url)}</div>
          <span class="confidence-badge confidence-${confidence.level.toLowerCase()}">${confidence.level} ${confidence.score}%</span>
        </div>
        <div class="history-url">${getDomain(entry.url)} · ${dateLabel} ${timeLabel}</div>
      </div>
      <div class="history-actions">
        <button class="tiny-btn" data-action="load">Load</button>
        <button class="tiny-btn" data-action="diff">Diff</button>
        <button class="tiny-btn preview-apply-btn${isActivePrev ? ' active-preview' : ''}" data-action="apply-preview" title="Smart Apply: ${confidence.level} confidence (${confidence.score}%)"${applyBtnDisabled}>${applyBtnLabel}</button>
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
      fontSizeMap.set(px, { px, rem: s.rem || `${(px / 16).toFixed(3).replace(/\.?0+$/, '')}rem` });
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
  const formats = ['css', 'scss', 'less', 'styl', 'tailwind', 'figma', 'dtcg', 'json', 'js', 'ts'];
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

// PRO: build a shareable Markdown design-system audit report.
function buildAuditReportMarkdown() {
  if (!tokens) return null;
  const data = buildInsightsData();
  const domain = getDomain(tokens.url);
  const date = new Date().toLocaleString();
  const matrix = data.advancedA11y;

  const toPct = (value, total) => Math.round((Number(value || 0) * 100) / Math.max(1, Number(total || 0)));
  const miniBar = (pct, width = 16) => {
    const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const filled = Math.round((p / 100) * width);
    return `[${'#'.repeat(filled)}${'-'.repeat(Math.max(0, width - filled))}] ${p}%`;
  };
  const mdCell = (value) => String(value == null ? '' : value).replace(/\|/g, '/').replace(/\n/g, ' ');
  const riskLabel = (score) => (score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Watch' : 'Risky');
  const scoreMood = (score) => (score >= 80 ? '🟢' : score >= 60 ? '🟡' : score >= 40 ? '🟠' : '🔴');
  const severityBadge = (sev) => {
    const map = {
      P0: '🔴 P0',
      P1: '🟠 P1',
      P2: '🟡 P2',
      P3: '🔵 P3'
    };
    return map[sev] || String(sev || 'P3');
  };
  const swatchChip = (hex) => {
    const h = String(hex || '').toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(h)) return mdCell(h);
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid #888;vertical-align:middle;background:${h};"></span> ${h}`;
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
  const liveFailDensity = toPct(data.liveWcagFailCount, data.liveWcagChecked);
  const topPriority = backlog[0];
  const lines = [];

  lines.push(`# 🎯 Design System Audit — ${domain}`);
  lines.push('');
  lines.push(`> 🕒 Generated by Palext on ${date}`);
  lines.push(`> 🌐 Source: ${tokens.url}`);
  lines.push('> 👥 Audience: Designers + Developers');
  lines.push('');

  lines.push('## ✨ Executive Summary');
  lines.push('');
  lines.push(`- ${scoreMood(data.systemScore)} System consistency: **${data.systemScore}/100 (${riskLabel(data.systemScore)})**`);
  lines.push(`- ${scoreMood(data.paletteAccessibilityScore)} Palette accessibility: **${data.paletteAccessibilityScore}/100 (${riskLabel(data.paletteAccessibilityScore)})**`);
  lines.push(`- 🚨 Live accessibility: **${data.liveWcagFailCount} AA fails** across ${data.liveWcagChecked} text blocks`);
  if (topPriority) lines.push(`- 🧭 Top priority: **${topPriority.issue}** (${severityBadge(topPriority.severity)}, owner: ${topPriority.owner})`);
  lines.push('');

  lines.push('## 📊 Scoreboard');
  lines.push('');
  lines.push('| Metric | Score |');
  lines.push('| --- | --- |');
  lines.push(`| 🎛️ Token consistency | ${miniBar(data.systemScore)} |`);
  lines.push(`| 🎨 Palette accessibility | ${miniBar(data.paletteAccessibilityScore)} |`);
  lines.push(`| ♿ Contrast AA normal pass rate | ${miniBar(aaNormalPct)} (${matrix.totals.aaNormalPass}/${matrix.totals.pairs}) |`);
  lines.push(`| 🚨 Live WCAG fail density | ${miniBar(Math.max(0, 100 - liveFailDensity))} (fails: ${data.liveWcagFailCount}/${data.liveWcagChecked}) |`);
  lines.push('');

  if (backlog.length) {
    lines.push('## 🧯 Priority Fix Queue');
    lines.push('');
    lines.push('| Priority | Issue | Why this matters | Owner | Effort | Recommended task |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    backlog.forEach(item => {
      lines.push(`| ${severityBadge(item.severity)} | ${mdCell(item.issue)} | ${mdCell(item.why)} | ${mdCell(item.owner)} | ${mdCell(item.effort)} | ${mdCell(item.task)} |`);
    });
    lines.push('');
  }

  lines.push('## 🧱 Token Inventory');
  lines.push('');
  lines.push(`- 🎨 Colors: ${data.tokenCounts.colors}`);
  lines.push(`- 🔤 Font families: ${data.tokenCounts.fontFamilies}`);
  lines.push(`- 🔠 Font sizes: ${data.tokenCounts.fontSizes}`);
  lines.push(`- 📏 Spacing values: ${data.tokenCounts.spacing}`);
  lines.push(`- 🟦 Radii: ${data.tokenCounts.radii}`);
  lines.push(`- 🌑 Shadows: ${data.tokenCounts.shadows}`);
  lines.push(`- 🌈 Gradients: ${data.tokenCounts.gradients}`);
  lines.push(`- 🧬 CSS variables (:root): ${data.tokenCounts.rootVars}`);
  lines.push(`- 🪄 Style summary: ${data.personality}`);
  lines.push('');

  if (nearColors.length) {
    lines.push('## 🧪 Palette Merge Candidates (Near Duplicates)');
    lines.push('');
    lines.push('| Keep | Merge | Color distance | Combined usage |');
    lines.push('| --- | --- | --- | --- |');
    nearColors.forEach(c => lines.push(`| ${swatchChip(c.keep)} | ${swatchChip(c.merge)} | ${c.dist} | ${c.combined} |`));
    lines.push('');
  }

  if ((tokens.colors || []).length) {
    lines.push('## 🌈 Color Palette');
    lines.push('');
    lines.push('| Swatch | Hex | HSL | Contrast on white | Contrast on black |');
    lines.push('| --- | --- | --- | --- | --- |');
    tokens.colors.slice(0, 24).forEach(c => {
      lines.push(`| ${swatchChip(c.hex)} | ${c.hex} | ${c.hsl} | ${c.contrastOnWhite} | ${c.contrastOnBlack} |`);
    });
    lines.push('');
  }

  lines.push('## 💡 Recommendations');
  lines.push('');
  data.recommendations.forEach(r => lines.push(`- ✅ ${r}`));
  lines.push('');

  if (data.lowContrastFixes.length) {
    lines.push('## 🛠️ Accessibility Quick Fixes');
    lines.push('');
    data.lowContrastFixes.forEach(f => lines.push(`- 🔧 ${f}`));
    lines.push('');
  }

  lines.push('## ♿ Accessibility Deep Dive');
  lines.push('');
  lines.push(`- 🧾 AA Normal pass: ${matrix.totals.aaNormalPass}/${matrix.totals.pairs} (${aaNormalPct}%)`);
  lines.push(`- 🔎 AA Large pass: ${matrix.totals.aaLargePass}/${matrix.totals.pairs} (${aaLargePct}%)`);
  lines.push(`- 🧪 AAA Normal pass: ${matrix.totals.aaaNormalPass}/${matrix.totals.pairs} (${aaaNormalPct}%)`);
  lines.push(`- 🧷 AAA Large pass: ${matrix.totals.aaaLargePass}/${matrix.totals.pairs}`);
  if (matrix.rankedFixes.length) {
    lines.push('');
    lines.push('### 🗺️ Ranked Accessibility Fix Strategy');
    lines.push('');
    matrix.rankedFixes.forEach(step => lines.push(`- 🧭 ${step}`));
  }
  if (matrix.riskyPairs.length) {
    lines.push('');
    lines.push('### 🚩 Risky pairs (<3:1)');
    lines.push('');
    matrix.riskyPairs.forEach(p => lines.push(`- ⚠️ ${p}`));
  }
  lines.push('');

  if (devTasks.length) {
    lines.push('## 👨‍💻 Developer Action Pack');
    lines.push('');
    devTasks.forEach((item, idx) => lines.push(`${idx + 1}. 🧩 ${item.task} (${severityBadge(item.severity)})`));
    lines.push('');
  }

  if (designTasks.length) {
    lines.push('## 🎨 Designer Action Pack');
    lines.push('');
    designTasks.forEach((item, idx) => lines.push(`${idx + 1}. 🪄 ${item.task} (${severityBadge(item.severity)})`));
    lines.push('');
  }

  if (data.namingSuggestions.length) {
    lines.push('## 🏷️ Suggested Token Names');
    lines.push('');
    data.namingSuggestions.forEach(n => lines.push(`- 🏷️ ${n}`));
    lines.push('');
  }

  if (data.hardcodedAudit.notes.length) {
    lines.push('## 🧵 Variable Adoption Notes');
    lines.push('');
    data.hardcodedAudit.notes.forEach(note => lines.push(`- 🧱 ${note}`));
    lines.push('');
  }

  lines.push('---');
  lines.push('_Report generated by Palext — Design Token Extractor._');
  return { domain: safeName(domain), markdown: lines.join('\n') };
}

function buildAuditReportHtml() {
  if (!tokens) return null;

  const data = buildInsightsData();
  const domain = getDomain(tokens.url);
  const date = new Date().toLocaleString();
  const matrix = data.advancedA11y;

  const toPct = (value, total) => Math.round((Number(value || 0) * 100) / Math.max(1, Number(total || 0)));
  const scoreLabel = (score) => (score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Watch' : 'Risky');
  const scoreTone = (score) => (score >= 80 ? 'ok' : score >= 60 ? 'warn' : 'risk');
  const severityTone = (sev) => (sev === 'P0' ? 'risk' : sev === 'P1' ? 'warn' : sev === 'P2' ? 'mild' : 'info');
  const esc = (v) => escapeHtmlText(String(v || ''));
  const swatch = (hex) => `<span class="sw" style="background:${esc(hex)}"></span>${esc(hex)}`;

  const aaNormalPct = toPct(matrix.totals.aaNormalPass, matrix.totals.pairs);
  const aaLargePct = toPct(matrix.totals.aaLargePass, matrix.totals.pairs);
  const aaaNormalPct = toPct(matrix.totals.aaaNormalPass, matrix.totals.pairs);

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
      items.push({ severity, score: severity === 'P0' ? 100 : severity === 'P1' ? 88 : 76, owner: 'Developer + Designer', effort: 'Medium', issue: `${data.liveWcagFailCount} live WCAG AA text failures`, why: `${data.liveWcagChecked} text blocks checked on live page`, task: 'Use WCAG overlay, fix top failing nodes, and re-scan' });
    }
    if (matrix.riskyPairs.length > 0) {
      const severity = matrix.riskyPairs.length >= 5 ? 'P0' : 'P1';
      items.push({ severity, score: severity === 'P0' ? 95 : 84, owner: 'Designer', effort: 'Medium', issue: `${matrix.riskyPairs.length} critical color pairs below 3:1`, why: 'These combinations create immediate readability risk', task: 'Replace risky foreground/background pairings with AA-safe token pairs' });
    }
    if (aaNormalFailPct > 35) {
      items.push({ severity: 'P1', score: 82, owner: 'Designer', effort: 'Medium', issue: `AA normal contrast fail rate at ${aaNormalFailPct}%`, why: `${aaNormalFail}/${matrix.totals.pairs} pair checks fail AA normal`, task: 'Define an accessible text/surface token baseline and enforce in UI kit' });
    }
    if (data.hardcodedAudit.totalOccurrences > 0) {
      const severity = data.hardcodedAudit.totalOccurrences > 25 ? 'P1' : 'P2';
      items.push({ severity, score: severity === 'P1' ? 80 : 68, owner: 'Developer', effort: 'Low', issue: `${data.hardcodedAudit.totalOccurrences} hardcoded style occurrences`, why: 'Hardcoded values increase drift and break theme consistency', task: 'Replace hardcoded values with :root tokens' });
    }
    if (data.namingSuggestions.length > 0) {
      items.push({ severity: 'P3', score: 54, owner: 'Designer + Developer', effort: 'Low', issue: 'Token naming standardization opportunities found', why: 'Consistent semantics improves handoff and implementation speed', task: 'Adopt semantic token naming in design + code exports' });
    }
    return items.sort((a, b) => b.score - a.score);
  };

  const nearColors = findNearColorCandidates();
  const backlog = buildIssueBacklog();
  const topPriority = backlog[0];

  const metricCard = (title, value, pct, tone, meta = '') => `
    <article class="mcard ${tone}">
      <div class="mname">${title}</div>
      <div class="mval">${value}</div>
      <div class="mbar"><span style="width:${Math.max(0, Math.min(100, pct))}%"></span></div>
      <div class="mmeta">${meta}</div>
    </article>
  `;

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

  const nearRows = nearColors.map(c => `<tr><td>${swatch(c.keep)}</td><td>${swatch(c.merge)}</td><td>${c.dist}</td><td>${c.combined}</td></tr>`).join('');
  const colorRows = (tokens.colors || []).slice(0, 24).map(c => `<tr><td>${swatch(c.hex)}</td><td>${esc(c.hsl)}</td><td>${esc(c.contrastOnWhite)}</td><td>${esc(c.contrastOnBlack)}</td></tr>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Design Audit - ${esc(domain)}</title>
  <style>
    :root { --bg:#f2f8fb; --card:#ffffff; --ink:#0f2430; --muted:#4f6672; --line:#c7d9e2; --accent:#0f8f86; --accent2:#17a39a; --ok:#16a34a; --warn:#d97706; --risk:#dc2626; --mild:#7c3aed; }
    * { box-sizing:border-box; }
    body { margin:0; font:14px/1.45 'Segoe UI', 'Inter', sans-serif; color:var(--ink); background:radial-gradient(circle at 12% -20%, #d5f6ef, transparent 45%), var(--bg); }
    .wrap { max-width:1060px; margin:24px auto; padding:0 16px 28px; }
    .hero { background:linear-gradient(155deg, #ffffff, #eef8fc); border:1px solid var(--line); border-radius:16px; padding:16px; box-shadow:0 8px 22px rgba(12,34,46,.08); }
    .title { margin:0; font-size:24px; letter-spacing:.2px; }
    .sub { margin:8px 0 0; color:var(--muted); font-size:12.5px; }
    .chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .chip { border:1px solid var(--line); background:#fff; border-radius:999px; padding:4px 10px; font-size:12px; color:var(--muted); }
    .sec { margin-top:16px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px; box-shadow:0 4px 14px rgba(15,38,52,.05); }
    .sec h2 { margin:0 0 10px; font-size:16px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .mcard { border:1px solid var(--line); border-radius:12px; padding:10px; background:linear-gradient(180deg,#fff,#f6fbfd); }
    .mname { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.35px; font-weight:700; }
    .mval { margin-top:4px; font-size:20px; font-weight:800; }
    .mmeta { margin-top:6px; color:var(--muted); font-size:11px; }
    .mbar { margin-top:8px; height:7px; border-radius:999px; border:1px solid var(--line); overflow:hidden; background:#eef4f7; }
    .mbar span { display:block; height:100%; background:linear-gradient(90deg,var(--accent2),var(--accent)); }
    .mcard.ok .mval { color:var(--ok); }
    .mcard.warn .mval { color:var(--warn); }
    .mcard.risk .mval { color:var(--risk); }
    table { width:100%; border-collapse:collapse; font-size:12.5px; }
    th, td { text-align:left; border-bottom:1px solid #e2edf2; padding:8px 6px; vertical-align:top; }
    th { font-size:11px; text-transform:uppercase; letter-spacing:.35px; color:var(--muted); }
    .badge { display:inline-block; border-radius:999px; padding:2px 8px; font-size:11px; font-weight:800; border:1px solid transparent; }
    .badge.risk { color:#7f1d1d; border-color:#fecaca; background:#fee2e2; }
    .badge.warn { color:#7c2d12; border-color:#fed7aa; background:#ffedd5; }
    .badge.mild { color:#5b21b6; border-color:#ddd6fe; background:#ede9fe; }
    .badge.info { color:#155e75; border-color:#bae6fd; background:#e0f2fe; }
    .sw { display:inline-block; width:10px; height:10px; border-radius:50%; border:1px solid #9aa; vertical-align:middle; margin-right:6px; }
    ul { margin:8px 0 0 18px; padding:0; }
    li { margin:5px 0; }
    .twocol { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .foot { margin-top:12px; color:var(--muted); font-size:11.5px; }
    @media (max-width: 760px) { .grid, .twocol { grid-template-columns:1fr; } .title { font-size:20px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1 class="title">🎯 Design System Audit — ${esc(domain)}</h1>
      <p class="sub">🕒 ${esc(date)} · 🌐 ${esc(tokens.url)} · 👥 Designers + Developers</p>
      <div class="chips">
        <span class="chip">System: ${data.systemScore}/100 (${scoreLabel(data.systemScore)})</span>
        <span class="chip">Palette: ${data.paletteAccessibilityScore}/100 (${scoreLabel(data.paletteAccessibilityScore)})</span>
        <span class="chip">Live fails: ${data.liveWcagFailCount}/${data.liveWcagChecked}</span>
      </div>
      ${topPriority ? `<p class="sub" style="margin-top:10px"><strong>🧭 Top priority:</strong> ${esc(topPriority.issue)} (${esc(topPriority.severity)}, ${esc(topPriority.owner)})</p>` : ''}
    </section>

    <section class="sec">
      <h2>📊 Scoreboard</h2>
      <div class="grid">
        ${metricCard('Token consistency', `${data.systemScore}%`, data.systemScore, scoreTone(data.systemScore), `${scoreLabel(data.systemScore)}`)}
        ${metricCard('Palette accessibility', `${data.paletteAccessibilityScore}%`, data.paletteAccessibilityScore, scoreTone(data.paletteAccessibilityScore), `${scoreLabel(data.paletteAccessibilityScore)}`)}
        ${metricCard('AA normal pass rate', `${aaNormalPct}%`, aaNormalPct, scoreTone(aaNormalPct), `${matrix.totals.aaNormalPass}/${matrix.totals.pairs} passing`) }
        ${metricCard('Live WCAG fail density', `${Math.max(0, 100 - toPct(data.liveWcagFailCount, data.liveWcagChecked))}%`, Math.max(0, 100 - toPct(data.liveWcagFailCount, data.liveWcagChecked)), scoreTone(Math.max(0, 100 - toPct(data.liveWcagFailCount, data.liveWcagChecked))), `fails: ${data.liveWcagFailCount}/${data.liveWcagChecked}`)}
      </div>
    </section>

    ${backlog.length ? `<section class="sec"><h2>🧯 Priority Fix Queue</h2><table><thead><tr><th>Priority</th><th>Issue</th><th>Why this matters</th><th>Owner</th><th>Effort</th><th>Recommended task</th></tr></thead><tbody>${backlogRows}</tbody></table></section>` : ''}

    <section class="sec">
      <h2>🧱 Token Inventory</h2>
      <div class="twocol">
        <ul>
          <li>🎨 Colors: ${data.tokenCounts.colors}</li>
          <li>🔤 Font families: ${data.tokenCounts.fontFamilies}</li>
          <li>🔠 Font sizes: ${data.tokenCounts.fontSizes}</li>
          <li>📏 Spacing values: ${data.tokenCounts.spacing}</li>
        </ul>
        <ul>
          <li>🟦 Radii: ${data.tokenCounts.radii}</li>
          <li>🌑 Shadows: ${data.tokenCounts.shadows}</li>
          <li>🌈 Gradients: ${data.tokenCounts.gradients}</li>
          <li>🧬 CSS vars: ${data.tokenCounts.rootVars}</li>
        </ul>
      </div>
      <p class="sub" style="margin-top:8px">🪄 ${esc(data.personality)}</p>
    </section>

    ${nearColors.length ? `<section class="sec"><h2>🧪 Palette Merge Candidates</h2><table><thead><tr><th>Keep</th><th>Merge</th><th>Distance</th><th>Combined usage</th></tr></thead><tbody>${nearRows}</tbody></table></section>` : ''}

    ${(tokens.colors || []).length ? `<section class="sec"><h2>🌈 Color Palette</h2><table><thead><tr><th>Color</th><th>HSL</th><th>Contrast on white</th><th>Contrast on black</th></tr></thead><tbody>${colorRows}</tbody></table></section>` : ''}

    <section class="sec">
      <h2>♿ Accessibility Deep Dive</h2>
      <ul>
        <li>🧾 AA Normal: ${matrix.totals.aaNormalPass}/${matrix.totals.pairs} (${aaNormalPct}%)</li>
        <li>🔎 AA Large: ${matrix.totals.aaLargePass}/${matrix.totals.pairs} (${aaLargePct}%)</li>
        <li>🧪 AAA Normal: ${matrix.totals.aaaNormalPass}/${matrix.totals.pairs} (${aaaNormalPct}%)</li>
        <li>🧷 AAA Large: ${matrix.totals.aaaLargePass}/${matrix.totals.pairs}</li>
      </ul>
      ${matrix.riskyPairs.length ? `<h3 style="margin:10px 0 6px;font-size:13px">🚩 Risky pairs (&lt;3:1)</h3><ul>${matrix.riskyPairs.map(p => `<li>⚠️ ${esc(p)}</li>`).join('')}</ul>` : ''}
    </section>

    ${(data.recommendations || []).length ? `<section class="sec"><h2>💡 Recommendations</h2><ul>${data.recommendations.map(r => `<li>✅ ${esc(r)}</li>`).join('')}</ul></section>` : ''}
    ${(data.namingSuggestions || []).length ? `<section class="sec"><h2>🏷️ Suggested Token Names</h2><ul>${data.namingSuggestions.map(n => `<li>🏷️ ${esc(n)}</li>`).join('')}</ul></section>` : ''}

    <p class="foot">Report generated by Palext — Design Token Extractor.</p>
  </div>
</body>
</html>`;

  return { domain: safeName(domain), html };
}

function exportAuditReport(kind = 'html') {
  if (isProLocked('auditReport')) {
    showToast('Audit report export is a Pro feature.');
    return;
  }
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

function populateFamilyFormats(familyId) {
  const family = FRAMEWORK_FAMILIES[familyId];
  if (!family) return;
  
  const select = document.getElementById('exportFormatSelect');
  if (!select) return;

  currentExportFamily = familyId;
  select.innerHTML = '';

  family.formats.forEach(fmt => {
    // Skip pro-only formats if pro is locked
    if (fmt.proOnly && isProLocked('advancedCustomization')) {
      return;
    }
    
    const option = document.createElement('option');
    option.value = fmt.id;
    option.textContent = fmt.label;
    if (fmt.proOnly) option.textContent += ' ◆';
    
    select.appendChild(option);
  });

  // Set to first available format
  if (select.options.length > 0) {
    select.value = select.options[0].value;
    lastExportFormat = select.value;
    updateLastExportHint();
  }
}

function handleExportFamilyClick(e) {
  if (!e.target.matches('[data-family]')) return;
  
  const chips = document.querySelectorAll('[data-family]');
  chips.forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  
  const family = e.target.dataset.family;
  populateFamilyFormats(family);
}

function openExportModal() {
  const overlay = document.getElementById('exportModalOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  
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
  
  syncExportModalState();
  
  // Focus the close button for accessibility
  document.getElementById('closeExportModalBtn')?.focus();
}

function closeExportModal() {
  const overlay = document.getElementById('exportModalOverlay');
  if (!overlay) return;
  
  // Restore focus to the Export button before hiding
  const openBtn = document.getElementById('openExportModalBtn');
  if (openBtn) openBtn.focus();
  
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function syncExportModalState() {
  const targetChips = document.querySelectorAll('[data-target]');
  const formatGroup = document.getElementById('exportFormatGroup');
  const customizeGroup = document.getElementById('exportCustomizeGroup');
  const note = document.getElementById('exportModalNote');
  const copyBtn = document.getElementById('exportCopyBtn');
  const dlBtn = document.getElementById('exportDownloadBtn');
  
  if (!formatGroup || !customizeGroup || !note || !copyBtn || !dlBtn) return;

  // Determine current target from active chip
  let target = 'format';
  targetChips.forEach(chip => {
    if (chip.classList.contains('active')) {
      target = chip.dataset.target;
    }
  });

  // Show/hide format and customize groups based on target
  const showFormat = target === 'format';
  formatGroup.classList.toggle('hidden', !showFormat);
  customizeGroup.classList.toggle('hidden', !showFormat);

  // Update UI text and button states
  if (showFormat) {
    note.textContent = 'Select framework, customize token categories, then copy or download. Check the generated code for usage instructions!';
    copyBtn.disabled = false;
    dlBtn.disabled = false;
    dlBtn.textContent = 'Download';
  } else if (target === 'bundle') {
    note.textContent = 'Bundle downloads all supported token formats as separate files.';
    copyBtn.disabled = true;
    dlBtn.disabled = false;
    dlBtn.textContent = 'Download Bundle';
  } else {
    note.textContent = 'Audit report generates a markdown design QA report for this page.';
    copyBtn.disabled = false;
    dlBtn.disabled = false;
    dlBtn.textContent = 'Download Audit';
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
    if (isProLocked('auditReport')) {
      showToast('Audit report export is a Pro feature.');
      return;
    }
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
    exportAuditReport('html');
    return;
  }

  const picked = format.value || 'css';
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
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
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

// The unit (px/rem/em) toggle only affects Spacing + Typography, so hide it on
// every other tab to keep the toolbar clean.
function updateViewOptionsVisibility(tab) {
  const bar = document.getElementById('viewOptionsBar');
  if (bar) {
    const relevant = tab === 'spacing' || tab === 'fonts';
    bar.classList.toggle('hidden', !relevant);
  }

  // The token Export / Download bars act on design tokens (CSS/SCSS/JSON), not
  // on page assets, insights or saved history, so hide them on those tabs where
  // they'd be misleading. The Assets tab provides its own "Download all" action.
  const hideTokenBars = tab === 'assets' || tab === 'insights' || tab === 'history';
  document.getElementById('exportBar')?.classList.toggle('hidden', hideTokenBars);
}

function bindEvents() {
  bindHexChipCopy();

  const openExportBtn = document.getElementById('openExportModalBtn');
  const closeExportBtn = document.getElementById('closeExportModalBtn');
  const exportOverlay = document.getElementById('exportModalOverlay');
  const exportTargetChips = document.getElementById('exportTargetChips');
  const exportFamilyChips = document.getElementById('exportFamilyChips');
  const exportFormat = document.getElementById('exportFormatSelect');
  const exportCopyBtn = document.getElementById('exportCopyBtn');
  const exportDownloadBtn = document.getElementById('exportDownloadBtn');

  document.getElementById('sidePanelBtn')?.addEventListener('click', openInSidePanel);
  document.getElementById('replayTourBtn')?.addEventListener('click', replayOnboardingTour);

  document.getElementById('inspectBtn')?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) { showToast('No active tab found.'); return; }
      if (!isSupportedTab(tab.url)) {
        showToast('Navigate to a website (http/https) first, then use Inspect.');
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_INSPECT', sourceSurface: UI_SURFACE }, () => {
        if (chrome.runtime.lastError) {
          showToast('Cannot inspect this page — try reloading it.');
          return;
        }
        if (UI_SURFACE === 'popup') {
          window.close();
        } else {
          showToast('Inspect mode active on the page. Click any element to capture it.');
        }
      });
    } catch (_) {
      showToast('Cannot inspect this page.');
    }
  });

  document.getElementById('modeBtn')?.addEventListener('click', () => {
    showToast('Test mode active: Pro features are currently unlocked for validation.');
  });

  document.getElementById('themeBtn')?.addEventListener('click', () => {
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

  // When user clicks "Revert" in the on-page pill while the popup is open,
  // sync popup state so the preview banner disappears immediately.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'VAR_PREVIEW_REVERTED') {
      activePreview = null;
      if (activeTab === 'history') renderTokens('history');
    }
    if (msg && msg.type === 'PAL_EXT_INSPECT_CAPTURED') {
      void checkInspectResult().then(() => {
        renderTokens(activeTab);
        showToast('Element captured');
      });
    }
    if (msg && msg.type === 'PAL_EXT_TOAST' && msg.message) {
      showToast(String(msg.message));
    }
  });

  // Export modal event handlers
  openExportBtn?.addEventListener('click', () => {
    openExportModal();
  });

  closeExportBtn?.addEventListener('click', () => {
    closeExportModal();
  });

  exportOverlay?.addEventListener('click', e => {
    if (e.target === exportOverlay) closeExportModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeExportModal();
  });

  // Target (format/bundle/audit) chip clicks
  exportTargetChips?.addEventListener('click', e => {
    if (!e.target.matches('[data-target]')) return;
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
      if (tokens && (activeTab === 'spacing' || activeTab === 'fonts')) renderTokens(activeTab);
      showToast(`Units: ${unit}`);
    });
  });

  applyProBadges();
  updateViewOptionsVisibility(activeTab);
  syncExportModalState();
  updateLastExportHint();
}
