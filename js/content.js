// content.js - TokenLens extraction engine
// Runs on page context and responds with extracted design tokens.

(function () {
  if (window.__tokenLensContentInitialized) return;
  window.__tokenLensContentInitialized = true;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 1;
  colorCanvas.height = 1;
  const colorCtx = colorCanvas.getContext('2d');

  function normalizeHex(hex) {
    const clean = (hex || '').trim().toUpperCase();
    if (!clean.startsWith('#')) return null;
    if (clean.length === 4) {
      return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
    }
    if (clean.length === 7) return clean;
    return null;
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function parseColor(str) {
    if (!str) return null;
    const value = str.trim();
    if (!value || value === 'transparent' || value === 'none') return null;
    if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)$/i.test(value)) return null;

    const maybeHex = normalizeHex(value);
    if (maybeHex) return maybeHex;

    if (!colorCtx) return null;

    try {
      colorCtx.fillStyle = '#000000';
      colorCtx.fillStyle = value;
      const normalized = colorCtx.fillStyle;

      const normalizedHex = normalizeHex(normalized);
      if (normalizedHex) return normalizedHex;

      const rgbMatch = normalized.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)$/i);
      if (!rgbMatch) return null;
      if (rgbMatch[4] && Number(rgbMatch[4]) === 0) return null;

      return rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]));
    } catch (_) {
      return null;
    }
  }

  function toHSL(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

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

  function luminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(hex1, hex2) {
    const l1 = luminance(hex1);
    const l2 = luminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
  }

  function cleanFont(font) {
    return (font || '').split(',')[0].replace(/["']/g, '').trim();
  }

  function pxToRem(px) {
    const n = parseFloat(px);
    return Number.isNaN(n) ? null : `${(n / 16).toFixed(3).replace(/\.?0+$/, '')}rem`;
  }

  function parsePx(value) {
    const n = Math.round(parseFloat(value));
    if (Number.isNaN(n) || n <= 0 || n >= 300) return null;
    return n;
  }

  function extractTokens() {
    const elements = Array.from(document.querySelectorAll('*')).slice(0, 2500);
    const colorMap = new Map();
    const fontSet = new Set();
    const fontSizeSet = new Set();
    const fontWeightSet = new Set();
    const spacingSet = new Set();
    const radiusSet = new Set();
    const shadowSet = new Set();
    const lineHeightSet = new Set();
    const gradientSet = new Set();

    const rootVars = {};
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      for (const prop of rootStyle) {
        if (prop.startsWith('--')) {
          const val = rootStyle.getPropertyValue(prop).trim();
          if (val) rootVars[prop] = val;
        }
      }
    } catch (_) {}

    for (const el of elements) {
      try {
        const cs = getComputedStyle(el);

        ['color', 'background-color', 'border-color', 'outline-color', 'fill', 'stroke'].forEach(prop => {
          const hex = parseColor(cs.getPropertyValue(prop));
          if (!hex || hex === '#000000' || hex === '#FFFFFF') return;

          if (!colorMap.has(hex)) {
            colorMap.set(hex, {
              hex,
              hsl: toHSL(hex),
              count: 1,
              contrastOnWhite: contrastRatio(hex, '#FFFFFF'),
              contrastOnBlack: contrastRatio(hex, '#000000')
            });
          } else {
            colorMap.get(hex).count += 1;
          }
        });

        const gradient = cs.getPropertyValue('background-image');
        if (gradient && gradient.includes('gradient(') && gradientSet.size < 16) {
          gradientSet.add(gradient.trim());
        }

        const ff = cleanFont(cs.fontFamily);
        if (ff && ff.length > 1 && !['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'inherit', 'initial'].includes(ff.toLowerCase())) {
          fontSet.add(ff);
        }

        const fsz = cs.fontSize;
        if (fsz && fsz !== '0px') {
          const rem = pxToRem(fsz);
          if (rem) fontSizeSet.add(JSON.stringify({ px: Math.round(parseFloat(fsz)), rem }));
        }

        const fw = Number(cs.fontWeight);
        if (!Number.isNaN(fw) && fw >= 100 && fw <= 900) fontWeightSet.add(fw);

        [
          'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
          'gap', 'row-gap', 'column-gap'
        ].forEach(prop => {
          const v = cs.getPropertyValue(prop);
          if (!v || v === '0px' || v === 'auto' || v === 'normal') return;
          const n = parsePx(v);
          if (n) spacingSet.add(n);
        });

        const br = parsePx(cs.borderRadius);
        if (br) radiusSet.add(br);

        const bs = cs.boxShadow;
        if (bs && bs !== 'none' && shadowSet.size < 14) shadowSet.add(bs);

        const lh = cs.lineHeight;
        if (lh && lh !== 'normal') {
          const n = parseFloat(lh);
          if (!Number.isNaN(n) && n > 0.5 && n < 5) lineHeightSet.add(Math.round(n * 100) / 100);
        }
      } catch (_) {}
    }

    const colors = [...colorMap.values()].sort((a, b) => b.count - a.count).slice(0, 40);
    const fontSizes = [...fontSizeSet].map(s => JSON.parse(s)).sort((a, b) => a.px - b.px);
    const fontWeights = [...fontWeightSet].sort((a, b) => a - b);
    const spacing = [...spacingSet].sort((a, b) => a - b).slice(0, 28);
    const radii = [...radiusSet].sort((a, b) => a - b);
    const lineHeights = [...lineHeightSet].sort((a, b) => a - b);
    const shadows = [...shadowSet].slice(0, 12);
    const gradients = [...gradientSet].slice(0, 8);
    const fonts = [...fontSet].slice(0, 14);

    return {
      colors,
      fonts,
      fontSizes,
      fontWeights,
      spacing,
      radii,
      shadows,
      gradients,
      lineHeights,
      rootVars,
      url: location.href,
      title: document.title,
      extractedAt: Date.now()
    };
  }

  // ── Inspect element mode ──────────────────────────────────────────
  let inspectActive = false;
  let inspectHighlight = null;
  let inspectBanner = null;
  let inspectCursorHint = null;
  let inspectCursorStyle = null;

  function createInspectBanner() {
    const el = document.createElement('div');
    el.id = '__tl_banner__';
    el.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:2147483647',
      'background:#0f1722;color:#e8f3ff',
      'font:600 12px/1 -apple-system,sans-serif',
      'padding:10px 16px;text-align:center',
      'border-bottom:2px solid #39a8a2;pointer-events:none'
    ].join(';');
    el.textContent = 'TokenLens • Hover an element and click to capture its tokens. Press Esc to cancel.';
    document.body.appendChild(el);
    return el;
  }

  function createHighlightBox() {
    const el = document.createElement('div');
    el.id = '__tl_highlight__';
    el.style.cssText = [
      'position:fixed;z-index:2147483646;pointer-events:none',
      'outline:2px solid #39a8a2;outline-offset:2px',
      'border-radius:3px;background:rgba(57,168,162,0.08)',
      'transition:top 60ms,left 60ms,width 60ms,height 60ms'
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  function createInspectCursorHint() {
    const el = document.createElement('div');
    el.id = '__tl_cursor_hint__';
    el.style.cssText = [
      'position:fixed;z-index:2147483647;pointer-events:none',
      'padding:4px 7px;border-radius:999px',
      'background:rgba(15,23,34,0.92);color:#e8f3ff',
      'border:1px solid rgba(57,168,162,0.7)',
      'font:600 10px/1 -apple-system,sans-serif',
      'letter-spacing:0.2px',
      'transform:translate(10px, 12px)'
    ].join(';');
    el.textContent = 'Inspect mode';
    document.body.appendChild(el);
    return el;
  }

  function createInspectCursorStyle() {
    const style = document.createElement('style');
    style.id = '__tl_cursor_style__';
    style.textContent = '* { cursor: crosshair !important; }';
    document.documentElement.appendChild(style);
    return style;
  }

  function extractElementTokens(el) {
    try {
      const cs = window.getComputedStyle(el);
      const tag = el.tagName.toLowerCase();
      const cls = Array.from(el.classList).slice(0, 3)
        .filter(c => c.length < 30 && !/^__|^js-/.test(c)).join('.');
      const label = cls ? `${tag}.${cls}` : tag;

      function findColorUp(start, prop, maxDepth = 6) {
        let node = start;
        let depth = 0;
        while (node && depth <= maxDepth) {
          const s = window.getComputedStyle(node);
          const hex = parseColor(s.getPropertyValue(prop));
          if (hex) return hex;
          node = node.parentElement;
          depth += 1;
        }
        return null;
      }

      function findStyleUp(start, prop, skip = [], maxDepth = 6) {
        let node = start;
        let depth = 0;
        while (node && depth <= maxDepth) {
          const s = window.getComputedStyle(node);
          const value = (s.getPropertyValue(prop) || '').trim();
          if (value && !skip.includes(value)) return value;
          node = node.parentElement;
          depth += 1;
        }
        return null;
      }

      const bg = findColorUp(el, 'background-color');
      const col = findColorUp(el, 'color');
      const bdc = findColorUp(el, 'border-top-color');

      const fontFamily = cleanFont(findStyleUp(el, 'font-family', ['', 'inherit', 'initial']) || cs.fontFamily) || null;
      const fontSize = findStyleUp(el, 'font-size', ['', '0px', 'inherit', 'initial']) || null;
      const padding = findStyleUp(el, 'padding', ['', '0px', '0px 0px 0px 0px', 'inherit', 'initial']) || null;
      const borderRadius = findStyleUp(el, 'border-radius', ['', '0px', '0px 0px 0px 0px', 'inherit', 'initial']) || null;
      const boxShadow = findStyleUp(el, 'box-shadow', ['', 'none', 'inherit', 'initial']) || null;

      return {
        label,
        background: bg,
        color: col,
        borderColor: bdc,
        fontSize,
        fontFamily,
        padding,
        borderRadius,
        boxShadow,
        capturedAt:   Date.now()
      };
    } catch (_) { return null; }
  }

  function deactivateInspect() {
    inspectActive = false;
    document.removeEventListener('mouseover', onInspectHover, true);
    document.removeEventListener('mousemove',  onInspectMove, true);
    document.removeEventListener('click',     onInspectClick, true);
    document.removeEventListener('keydown',   onInspectKey,   true);
    if (inspectBanner)    { inspectBanner.remove();    inspectBanner = null; }
    if (inspectHighlight) { inspectHighlight.remove(); inspectHighlight = null; }
    if (inspectCursorHint) { inspectCursorHint.remove(); inspectCursorHint = null; }
    if (inspectCursorStyle) { inspectCursorStyle.remove(); inspectCursorStyle = null; }
  }

  function onInspectHover(e) {
    const el = e.target;
    if (el.id === '__tl_banner__' || el.id === '__tl_highlight__' || el.id === '__tl_cursor_hint__') return;
    if (!inspectHighlight) return;
    const r = el.getBoundingClientRect();
    Object.assign(inspectHighlight.style, {
      top: `${r.top}px`, left: `${r.left}px`,
      width: `${r.width}px`, height: `${r.height}px`
    });
  }

  function onInspectMove(e) {
    if (!inspectCursorHint) return;
    inspectCursorHint.style.left = `${e.clientX}px`;
    inspectCursorHint.style.top = `${e.clientY}px`;
  }

  function onInspectClick(e) {
    if (e.target.id === '__tl_banner__' || e.target.id === '__tl_highlight__' || e.target.id === '__tl_cursor_hint__') return;
    e.preventDefault();
    e.stopPropagation();
    const result = extractElementTokens(e.target);
    deactivateInspect();
    if (result) {
      chrome.storage.local.set({ tl_inspect: result }, () => {
        chrome.runtime.sendMessage({ type: 'INSPECT_CAPTURED' }, () => {
          // Popup reopening is best-effort and browser-dependent.
          void chrome.runtime.lastError;
        });
      });
    }
  }

  function onInspectKey(e) {
    if (e.key === 'Escape') deactivateInspect();
  }

  function activateInspect() {
    if (inspectActive) return;
    inspectActive = true;
    inspectBanner    = createInspectBanner();
    inspectHighlight = createHighlightBox();
    inspectCursorHint = createInspectCursorHint();
    inspectCursorStyle = createInspectCursorStyle();
    document.addEventListener('mouseover', onInspectHover, true);
    document.addEventListener('mousemove', onInspectMove, true);
    document.addEventListener('click',     onInspectClick, true);
    document.addEventListener('keydown',   onInspectKey,   true);
  }

  // ── Message listener ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'EXTRACT_TOKENS') {
      try {
        const tokens = extractTokens();
        sendResponse({ ok: true, tokens });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Extraction failed' });
      }
      return true;
    }
    if (msg && msg.type === 'ACTIVATE_INSPECT') {
      activateInspect();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
})();
