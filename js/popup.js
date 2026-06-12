// popup.js - TokenLens UI logic

let tokens = null;
let activeTab = 'colors';
let savedSites = [];
let lastComparison = null;
let inspectResult = null;
const DEFAULT_EXPORT_PREFS = {
  preset: 'all',
  uiMode: 'beginner',
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

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadSaved();
  await loadPrefs();
  bindEvents();
  initExportControls();
  applyUiMode();
  await checkInspectResult();
  await extract();
});

function initTheme() {
  const theme = localStorage.getItem('tl_theme') || 'dark';
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
  if (!presetSelect || !panel || !customizeBtn) return;

  const isPro = exportPrefs.uiMode === 'pro';
  const customOption = presetSelect.querySelector('option[value="custom"]');
  if (customOption) customOption.hidden = !isPro;
  const validPresets = new Set(['all', 'colors-radius', 'colors-only', 'custom']);
  if (!validPresets.has(exportPrefs.preset)) exportPrefs.preset = 'all';
  if (!isPro && exportPrefs.preset === 'custom') {
    exportPrefs.preset = 'all';
  }

  presetSelect.value = exportPrefs.preset || 'all';
  panel.classList.toggle('hidden', presetSelect.value !== 'custom');
  customizeBtn.textContent = presetSelect.value === 'custom' ? 'Hide' : 'Customize';

  const include = getActiveInclude();
  panel.querySelectorAll('[data-exp-cat]').forEach(input => {
    input.checked = !!include[input.dataset.expCat];
  });

  if (exportPrefs.uiMode !== 'pro') {
    panel.classList.add('hidden');
    customizeBtn.textContent = 'Customize';
  }
}

function applyUiMode() {
  const mode = exportPrefs.uiMode === 'pro' ? 'pro' : 'beginner';
  const isPro = mode === 'pro';

  document.body.setAttribute('data-mode', mode);

  const modeBtn = document.getElementById('modeBtn');
  if (modeBtn) {
    modeBtn.textContent = isPro ? 'Pro' : 'Beginner';
    modeBtn.setAttribute('title', isPro ? 'Switch to Beginner mode' : 'Switch to Pro mode');
    modeBtn.setAttribute('aria-label', isPro ? 'Switch to Beginner mode' : 'Switch to Pro mode');
  }

  document.querySelectorAll('[data-pro-only="true"]').forEach(el => {
    if (el.id === 'exportCustomize') return;
    if (el.tagName === 'OPTION') {
      el.hidden = !isPro;
      return;
    }
    el.classList.toggle('hidden', !isPro);
  });

  const customizePanel = document.getElementById('exportCustomize');
  const customizeBtn = document.getElementById('customizeExportBtn');
  if (!isPro) {
    customizePanel?.classList.add('hidden');
    if (customizeBtn) customizeBtn.textContent = 'Customize';
    if (exportPrefs.preset === 'custom') exportPrefs.preset = 'all';
  }

  if (!isPro && activeTab === 'vars') {
    activeTab = 'colors';
    selectTab(activeTab);
    renderTokens(activeTab);
  }
}

async function saveSite(currentTokens) {
  if (!currentTokens) return;

  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    url: currentTokens.url,
    title: currentTokens.title,
    tokens: currentTokens,
    savedAt: Date.now()
  };

  savedSites = [entry, ...savedSites.filter(s => s.url !== currentTokens.url)].slice(0, 30);
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
  lastComparison = null;

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

    tokens = response.tokens;
    setStatus('done');
    renderHeader(tokens);
    renderTokens(activeTab);
  } catch (_) {
    setStatus('error', 'Cannot access this page (restricted URL).');
  }
}

function isSupportedTab(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

function sendExtractMessageOnce(tabId) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_TOKENS' }, response => {
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

function renderHeader(currentTokens) {
  const domainEl = document.getElementById('siteDomain');
  const statsEl = document.getElementById('siteStats');

  if (domainEl) domainEl.textContent = getDomain(currentTokens.url);

  if (statsEl) {
    statsEl.textContent = [
      `${currentTokens.colors.length} colors`,
      `${currentTokens.fonts.length} fonts`,
      `${currentTokens.fontSizes.length} type sizes`,
      `${currentTokens.gradients ? currentTokens.gradients.length : 0} gradients`
    ].join(' · ');
  }

  setCount('cnt_colors', currentTokens.colors.length);
  setCount('cnt_fonts', currentTokens.fonts.length + currentTokens.fontSizes.length + currentTokens.fontWeights.length);
  setCount('cnt_spacing', currentTokens.spacing.length + currentTokens.radii.length);
  setCount('cnt_shadows', currentTokens.shadows.length + (currentTokens.gradients ? currentTokens.gradients.length : 0));
  setCount('cnt_vars', Object.keys(currentTokens.rootVars || {}).length);
  setCount('cnt_insights', 3);
  updateHistoryCount();
}

function setCount(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value || 0);
}

function updateHistoryCount() {
  setCount('cnt_history', savedSites.length);
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
  if (!tokens.colors.length) {
    panel.innerHTML = '<p class="empty">No colors detected.</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'color-grid';

  tokens.colors.forEach(color => {
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
        <span class="swatch-copy" style="color:${textCol}" aria-hidden="true">⎘</span>
      </div>
      <div class="swatch-bottom" style="color:${textCol}">
        <span class="swatch-hsl" title="${color.hsl}">${(color.hsl || '').substring(0, 24)}</span>
        <span class="swatch-contrast" title="Contrast on white / black">W:${wcagW} B:${wcagB}</span>
      </div>
    `;
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

    grid.appendChild(swatch);
  });

  panel.appendChild(grid);
}

function renderFonts(panel) {
  if (!tokens.fonts.length && !tokens.fontSizes.length) {
    panel.innerHTML = '<p class="empty">No font data found.</p>';
    return;
  }

  if (tokens.fonts.length) {
    const section = makeSection('Font Families');
    const list = document.createElement('div');
    list.className = 'font-list';

    tokens.fonts.forEach(font => {
      const row = document.createElement('div');
      row.className = 'token-row';
      row.innerHTML = `<span class="token-preview" style="font-family:'${font}',sans-serif">${font}</span><button class="copy-btn" aria-label="Copy font name ${font}" title="Copy">⎘</button>`;
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
        <div class="size-info"><span class="size-px">${size.px}px</span><span class="size-rem">${size.rem}</span></div>
        <button class="copy-btn" aria-label="Copy size ${size.rem}" title="Copy rem">⎘</button>
      `;
      row.querySelector('.copy-btn').addEventListener('click', () => {
        copyText(size.rem);
        showToast(`Copied ${size.rem}`);
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
}

function renderSpacing(panel) {
  if (tokens.spacing.length) {
    const section = makeSection('Spacing Scale');
    const list = document.createElement('div');
    list.className = 'spacing-list';

    tokens.spacing.forEach(value => {
      const row = document.createElement('div');
      row.className = 'spacing-row';
      row.innerHTML = `
        <span class="spacing-label">${value}px / ${(value / 4).toFixed(1)}x</span>
        <div class="spacing-bar-wrap"><div class="spacing-bar" style="width:${Math.min(value * 1.5, 200)}px"></div></div>
        <button class="copy-btn" aria-label="Copy ${value}px" title="Copy">⎘</button>
      `;
      row.querySelector('.copy-btn').addEventListener('click', () => {
        copyText(`${value}px`);
        showToast(`Copied ${value}px`);
      });
      list.appendChild(row);
    });

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
      item.innerHTML = `<div class="radius-preview" style="border-radius:${value}px"></div><span class="radius-val">${value}px</span>`;
      item.addEventListener('click', () => {
        copyText(`${value}px`);
        showToast(`Copied ${value}px`);
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
  if (!tokens.shadows.length && !(tokens.gradients && tokens.gradients.length)) {
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

function uniqueBy(arr, mapper) {
  return new Set((arr || []).map(mapper)).size;
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

  const accessibilityScore = Math.max(0, Math.min(100, Math.round(100 - (failColorCount * 100) / Math.max(1, colorCount))));

  const personality = [
    hueBands <= 2 ? 'Focused palette' : hueBands <= 4 ? 'Balanced palette' : 'Expressive palette',
    fontCount <= 2 ? 'Tight typography' : fontCount <= 4 ? 'Flexible typography' : 'Diverse typography',
    spacingCount <= 8 ? 'Stable spacing' : 'Detailed spacing'
  ].join(' • ');

  const recommendations = [];
  if (colorCount > 16) recommendations.push(`Reduce palette from ${colorCount} to 12-16 core colors for stronger consistency.`);
  if (spacingCount > 10) recommendations.push(`Collapse spacing scale from ${spacingCount} values to an 8-point rhythm.`);
  if (failColorCount > 0) recommendations.push(`Review ${failColorCount} low-contrast colors for better accessibility.`);
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

  return {
    systemScore,
    accessibilityScore,
    personality,
    recommendations,
    lowContrastFixes
  };
}

function renderInsights(panel) {
  if (!tokens) {
    panel.innerHTML = '<p class="empty">No insights available yet.</p>';
    return;
  }

  const data = buildInsightsData();
  const section = makeSection('Quick Health Check');

  const help = document.createElement('p');
  help.className = 'insight-help';
  help.textContent = 'This gives a simple quality snapshot of your extracted tokens and what to improve next.';

  const grid = document.createElement('div');
  grid.className = 'insight-grid';
  grid.innerHTML = `
    <div class="insight-card">
      <div class="insight-label">System Score</div>
      <div class="insight-value">${data.systemScore}</div>
      <div class="insight-sub">${scoreBucket(data.systemScore)}</div>
    </div>
    <div class="insight-card">
      <div class="insight-label">Accessibility</div>
      <div class="insight-value">${data.accessibilityScore}</div>
      <div class="insight-sub">${scoreBucket(data.accessibilityScore)}</div>
    </div>
  `;

  const personalityCard = document.createElement('div');
  personalityCard.className = 'insight-card';
  personalityCard.style.marginBottom = '10px';
  personalityCard.innerHTML = `
    <div class="insight-label">Style Summary</div>
    <div class="insight-sub" style="font-size:11px;color:var(--text)">${data.personality}</div>
    <div class="insight-sub">A plain-language summary of your color, typography, and spacing style.</div>
  `;

  const recTitle = document.createElement('div');
  recTitle.className = 'section-title';
  recTitle.style.marginTop = '2px';
  recTitle.textContent = 'What To Improve Next';

  const recList = document.createElement('div');
  recList.className = 'insight-list';
  data.recommendations.forEach(text => {
    const item = document.createElement('div');
    item.className = 'insight-item';
    item.textContent = text;
    recList.appendChild(item);
  });

  const fixList = document.createElement('div');
  fixList.className = 'insight-list';
  if (data.lowContrastFixes.length) {
    const fixTitle = document.createElement('div');
    fixTitle.className = 'section-title';
    fixTitle.style.marginTop = '8px';
    fixTitle.textContent = 'Accessibility Quick Fixes';
    section.appendChild(fixTitle);

    data.lowContrastFixes.forEach(text => {
      const item = document.createElement('div');
      item.className = 'insight-item insight-fix';
      item.textContent = text;
      fixList.appendChild(item);
    });
  }

  section.appendChild(help);
  section.appendChild(grid);
  section.appendChild(personalityCard);
  section.appendChild(recTitle);
  section.appendChild(recList);
  if (data.lowContrastFixes.length) section.appendChild(fixList);
  panel.appendChild(section);
}

async function checkInspectResult() {
  const data = await chrome.storage.local.get('tl_inspect');
  if (!data.tl_inspect) return;
  const age = Date.now() - (data.tl_inspect.capturedAt || 0);
  if (age > 10 * 60 * 1000) {
    await chrome.storage.local.remove('tl_inspect');
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

  panel.insertBefore(banner, panel.firstChild);
}

function renderHistory(panel) {
  const section = makeSection('Saved Snapshots');

  if (lastComparison) {
    const box = document.createElement('div');
    box.className = 'compare-box';
    const cDrift = `<span class="drift-add">+${lastComparison.addedColors}</span> / <span class="drift-rem">−${lastComparison.removedColors}</span>`;
    const fDrift = `<span class="drift-add">+${lastComparison.addedFonts}</span> / <span class="drift-rem">−${lastComparison.removedFonts}</span>`;
    const sDrift = `<span class="drift-add">+${lastComparison.addedSpacing}</span> / <span class="drift-rem">−${lastComparison.removedSpacing}</span>`;
    box.innerHTML = `
      <div class="compare-title">Changes vs. ${lastComparison.label}</div>
      <div class="compare-grid">
        <div class="compare-chip"><div class="compare-label">Colors</div><div class="compare-value">${cDrift}</div></div>
        <div class="compare-chip"><div class="compare-label">Fonts</div><div class="compare-value">${fDrift}</div></div>
        <div class="compare-chip"><div class="compare-label">Spacing</div><div class="compare-value">${sDrift}</div></div>
      </div>
    `;
    section.appendChild(box);
  }

  if (!savedSites.length) {
    section.innerHTML += '<p class="empty">No snapshots yet. Save any page using the bookmark button.</p>';
    panel.appendChild(section);
    return;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'history-toolbar';
  toolbar.innerHTML = '<button class="tiny-btn danger" data-action="clear-all">Clear all</button>';
  toolbar.querySelector('[data-action="clear-all"]').addEventListener('click', async () => {
    const ok = window.confirm('Delete all saved snapshots?');
    if (!ok) return;
    await clearSavedSnapshots();
    lastComparison = null;
    renderTokens('history');
    showToast('All snapshots deleted');
  });
  section.appendChild(toolbar);

  const list = document.createElement('div');
  list.className = 'history-list';

  savedSites.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const dt = new Date(entry.savedAt || Date.now());
    const dateLabel = dt.toLocaleDateString();
    const timeLabel = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    row.innerHTML = `
      <div class="history-meta">
        <div class="history-title">${entry.title || getDomain(entry.url)}</div>
        <div class="history-url">${getDomain(entry.url)} · ${dateLabel} ${timeLabel}</div>
      </div>
      <div class="history-actions">
        <button class="tiny-btn" data-action="load">Load</button>
        <button class="tiny-btn" data-action="compare">Compare</button>
        <button class="tiny-btn danger" data-action="delete">Delete</button>
      </div>
    `;

    row.querySelector('[data-action="load"]').addEventListener('click', () => {
      tokens = entry.tokens;
      lastComparison = null;
      renderHeader(tokens);
      activeTab = 'colors';
      selectTab(activeTab);
      renderTokens(activeTab);
      showToast('Snapshot loaded');
    });

    row.querySelector('[data-action="compare"]').addEventListener('click', () => {
      if (!tokens) {
        showToast('Scan current page first');
        return;
      }
      lastComparison = compareTokens(tokens, entry.tokens, `${getDomain(entry.url)} snapshot`);
      renderTokens('history');
      showToast('Comparison ready');
    });

    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      await deleteSavedSnapshot(entry);
      if (lastComparison && lastComparison.label && lastComparison.label.includes(getDomain(entry.url))) {
        lastComparison = null;
      }
      renderTokens('history');
      showToast('Snapshot deleted');
    });

    list.appendChild(row);
  });

  section.appendChild(list);
  panel.appendChild(section);
}

function compareTokens(current, baseline, label) {
  const currColors = new Set((current.colors || []).map(c => c.hex));
  const baseColors = new Set((baseline.colors || []).map(c => c.hex));
  const currFonts = new Set(current.fonts || []);
  const baseFonts = new Set(baseline.fonts || []);
  const currSpace = new Set((current.spacing || []).map(String));
  const baseSpace = new Set((baseline.spacing || []).map(String));

  return {
    label,
    addedColors:   [...currColors].filter(v => !baseColors.has(v)).length,
    removedColors: [...baseColors].filter(v => !currColors.has(v)).length,
    addedFonts:    [...currFonts].filter(v => !baseFonts.has(v)).length,
    removedFonts:  [...baseFonts].filter(v => !currFonts.has(v)).length,
    addedSpacing:  [...currSpace].filter(v => !baseSpace.has(v)).length,
    removedSpacing:[...baseSpace].filter(v => !currSpace.has(v)).length
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

function exportAs(format) {
  if (!tokens) return;

  const domain = safeName(getDomain(tokens.url));
  const baseModel = buildExportModel();
  if (!baseModel) return;
  const model = applyExportFilter(baseModel);
  const hasAny = model.colors.length || model.fonts.length || model.sizes.length || model.spacing.length || model.radius.length || model.shadows.length || model.gradients.length || model.variables.length;
  if (!hasAny) {
    showToast('Pick at least one token category');
    return;
  }

  let output = '';

  if (format === 'css') {
    output += `/* TokenLens export for ${domain} */\n:root {\n`;
    model.colors.forEach(c => { output += `  --${c.key}: ${c.hex};\n`; });
    model.fonts.forEach(f => { output += `  --${f.key}: ${f.value};\n`; });
    model.sizes.forEach(s => { output += `  --${s.key}: ${s.rem}; /* ${s.px}px */\n`; });
    model.spacing.forEach(s => { output += `  --${s.key}: ${s.value};\n`; });
    model.radius.forEach(r => { output += `  --${r.key}: ${r.value};\n`; });
    model.shadows.forEach(s => { output += `  --${s.key}: ${s.value};\n`; });
    model.gradients.forEach(g => { output += `  --${g.key}: ${g.value};\n`; });
    model.variables.forEach(v => { output += `  ${v.name}: ${v.value};\n`; });
    output += '}\n';
  } else if (format === 'scss') {
    output += `// TokenLens export for ${domain}\n`;
    model.colors.forEach(c => { output += `$${c.key}: ${c.hex};\n`; });
    model.fonts.forEach(f => { output += `$${f.key}: ${f.value};\n`; });
    model.sizes.forEach(s => { output += `$${s.key}: ${s.rem};\n`; });
    model.spacing.forEach(s => { output += `$${s.key}: ${s.value};\n`; });
    model.radius.forEach(r => { output += `$${r.key}: ${r.value};\n`; });
    model.shadows.forEach(s => { output += `$${s.key}: ${s.value};\n`; });
    model.gradients.forEach(g => { output += `$${g.key}: ${g.value};\n`; });
    model.variables.forEach(v => { output += `$var-${v.key}: ${v.value};\n`; });
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

    output = `// TokenLens Tailwind config for ${domain}\nmodule.exports = ${JSON.stringify(config, null, 2)};`;
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

  copyText(output);
  showToast(`${format.toUpperCase()} copied`);
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
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function selectTab(tab) {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const selected = btn.dataset.tab === tab;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
}

function bindEvents() {
  document.getElementById('inspectBtn')?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) { showToast('No active tab'); return; }
      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_INSPECT' }, () => {
        if (chrome.runtime.lastError) {
          showToast('Cannot inspect this page');
          return;
        }
        window.close();
      });
    } catch (_) {
      showToast('Cannot inspect this page');
    }
  });

  document.getElementById('modeBtn')?.addEventListener('click', async () => {
    exportPrefs.uiMode = exportPrefs.uiMode === 'pro' ? 'beginner' : 'pro';
    applyUiMode();
    initExportControls();
    await savePrefs();
    showToast(exportPrefs.uiMode === 'pro' ? 'Pro mode on' : 'Beginner mode on');
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

  const presetSelect = document.getElementById('exportPreset');
  const customizeBtn = document.getElementById('customizeExportBtn');
  const customizePanel = document.getElementById('exportCustomize');

  presetSelect?.addEventListener('change', async () => {
    exportPrefs.preset = presetSelect.value;
    if (exportPrefs.preset !== 'custom') {
      exportPrefs.include = presetToInclude(exportPrefs.preset);
      customizePanel?.classList.add('hidden');
      if (customizeBtn) customizeBtn.textContent = 'Customize';
    } else {
      customizePanel?.classList.remove('hidden');
      if (customizeBtn) customizeBtn.textContent = 'Hide';
    }
    initExportControls();
    await savePrefs();
  });

  customizeBtn?.addEventListener('click', () => {
    if (!customizePanel) return;
    const shouldOpen = customizePanel.classList.contains('hidden');
    customizePanel.classList.toggle('hidden', !shouldOpen);
    customizeBtn.textContent = shouldOpen ? 'Hide' : 'Customize';
    if (shouldOpen && presetSelect && presetSelect.value !== 'custom') {
      presetSelect.value = 'custom';
      exportPrefs.preset = 'custom';
      savePrefs();
    }
  });

  document.querySelectorAll('[data-exp-cat]').forEach(input => {
    input.addEventListener('change', async () => {
      exportPrefs.preset = 'custom';
      exportPrefs.include[input.dataset.expCat] = input.checked;
      if (presetSelect) presetSelect.value = 'custom';
      await savePrefs();
    });
  });

  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => exportAs(btn.dataset.export));
  });
}
