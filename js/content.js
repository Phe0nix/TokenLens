// content.js - Palext extraction engine
// Runs on page context and responds with extracted design tokens.

(function () {
  if (window.__palextContentInitialized) return;
  window.__palextContentInitialized = true;

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

  function getSpacingGroup(prop) {
    if (prop.startsWith('padding')) return 'padding';
    if (prop.startsWith('margin')) return 'margin';
    return 'gap';
  }

  function getDominantSpacingSource(meta) {
    const values = [
      { key: 'padding', count: Number(meta.padding || 0) },
      { key: 'margin', count: Number(meta.margin || 0) },
      { key: 'gap', count: Number(meta.gap || 0) }
    ].sort((a, b) => b.count - a.count);

    if (!values[0].count) return 'mixed';
    if (values[0].count === values[1].count && values[0].count > 0) return 'mixed';
    return values[0].key;
  }

  function extractFontSources() {
    const providers = [];
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).map(link => link.getAttribute('href') || '');
    const styleBlocks = Array.from(document.querySelectorAll('style')).map(style => style.textContent || '');

    const hasGoogleFonts = links.some(href => /fonts\.googleapis\.com/i.test(href))
      || styleBlocks.some(text => /@import\s+url\(["']?https?:\/\/fonts\.googleapis\.com/i.test(text));
    if (hasGoogleFonts) {
      providers.push({
        provider: 'Google Fonts',
        source: 'fonts.googleapis.com',
        usage: 'Webfont stylesheet detected'
      });
    }

    const hasAdobeFonts = links.some(href => /use\.typekit\.net|fonts\.adobe\.com/i.test(href))
      || styleBlocks.some(text => /use\.typekit\.net|fonts\.adobe\.com/i.test(text));
    if (hasAdobeFonts) {
      providers.push({
        provider: 'Adobe Fonts',
        source: 'typekit/adobe',
        usage: 'Hosted font stylesheet detected'
      });
    }

    const hasSelfHosted = styleBlocks.some(text => /@font-face\s*\{/i.test(text));
    if (hasSelfHosted) {
      providers.push({
        provider: 'Self-hosted @font-face',
        source: 'local css',
        usage: '@font-face declarations found'
      });
    }

    if (!providers.length) {
      providers.push({
        provider: 'System / unknown',
        source: 'computed styles',
        usage: 'No hosted font stylesheet detected'
      });
    }

    return providers;
  }

  function estimateSelectorSpecificity(selectorText) {
    if (!selectorText) return 0;
    const idCount = (selectorText.match(/#[\w-]+/g) || []).length;
    const classCount = (selectorText.match(/\.[\w-]+|\[[^\]]+\]|:[^\s:][\w-]*/g) || []).length;
    const elCount = (selectorText.match(/(^|\s|>|\+|~)([a-z][\w-]*)/gi) || []).length;
    return (idCount * 100) + (classCount * 10) + elCount;
  }

  function collectCssStats() {
    let rules = 0;
    let declarations = 0;
    let selectorSpecificityTotal = 0;
    let selectorCount = 0;

    const stylesheets = Array.from(document.styleSheets || []);
    for (const sheet of stylesheets) {
      let cssRules;
      try {
        cssRules = sheet.cssRules || [];
      } catch (_) {
        continue;
      }

      for (const rule of Array.from(cssRules)) {
        if (!rule) continue;
        if (rule.type === CSSRule.STYLE_RULE) {
          rules += 1;
          declarations += (rule.style && rule.style.length) ? rule.style.length : 0;
          const selectors = String(rule.selectorText || '').split(',').map(s => s.trim()).filter(Boolean);
          selectors.forEach(sel => {
            selectorSpecificityTotal += estimateSelectorSpecificity(sel);
            selectorCount += 1;
          });
        }
      }
    }

    const inlineStyleCount = Array.from(document.querySelectorAll('[style]')).length;
    const avgSpecificity = selectorCount ? Math.round(selectorSpecificityTotal / selectorCount) : 0;

    return {
      styleRules: rules,
      declarations,
      inlineStyles: inlineStyleCount,
      avgSpecificity,
      quality: avgSpecificity > 120 ? 'High specificity pressure' : avgSpecificity > 60 ? 'Moderate specificity' : 'Healthy specificity'
    };
  }

  function extractTokens() {
    const elements = Array.from(document.querySelectorAll('*')).slice(0, 2500);
    const colorMap = new Map();
    const fontSet = new Set();
    const fontSizeSet = new Set();
    const fontWeightSet = new Set();
    const spacingSet = new Set();
    const spacingMeta = new Map();
    const radiusSet = new Set();
    const shadowSet = new Set();
    const lineHeightSet = new Set();
    const gradientSet = new Set();
    const motionMap = new Map();

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
          if (!n) return;

          spacingSet.add(n);

          if (!spacingMeta.has(n)) {
            spacingMeta.set(n, { count: 0, margin: 0, padding: 0, gap: 0 });
          }
          const info = spacingMeta.get(n);
          info.count += 1;
          const group = getSpacingGroup(prop);
          info[group] += 1;
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

          // Motion / transition tokens
          if (motionMap.size < 30) {
            const transStr = cs.getPropertyValue('transition');
            if (transStr && transStr !== 'none') {
              transStr.split(',').forEach(seg => {
                const parts = seg.trim().split(/\s+/);
                if (parts.length < 2) return;
                const prop = parts[0];
                const dur = parts[1] || '';
                if (!dur || dur === '0s' || dur === '0ms') return;
                const ease = parts[2] || 'ease';
                const key = `${prop}|${dur}|${ease}`;
                if (!motionMap.has(key)) {
                  motionMap.set(key, { property: prop, duration: dur, easing: ease, count: 1 });
                } else {
                  motionMap.get(key).count++;
                }
              });
            }
          }
      } catch (_) {}
    }

    const colors = [...colorMap.values()].sort((a, b) => b.count - a.count).slice(0, 40);
    const fontSizes = [...fontSizeSet].map(s => JSON.parse(s)).sort((a, b) => a.px - b.px);
    const fontWeights = [...fontWeightSet].sort((a, b) => a - b);
    const spacing = [...spacingSet].sort((a, b) => a - b).slice(0, 28);
    const spacingDetails = Object.fromEntries(
      spacing.map(value => {
        const meta = spacingMeta.get(value) || { count: 0, margin: 0, padding: 0, gap: 0 };
        return [String(value), {
          count: meta.count,
          margin: meta.margin,
          padding: meta.padding,
          gap: meta.gap,
          dominant: getDominantSpacingSource(meta)
        }];
      })
    );
    const radii = [...radiusSet].sort((a, b) => a - b);
    const lineHeights = [...lineHeightSet].sort((a, b) => a - b);
    const shadows = [...shadowSet].slice(0, 12);
    const gradients = [...gradientSet].slice(0, 8);
    const fonts = [...fontSet].slice(0, 14);
    const motion = [...motionMap.values()].sort((a, b) => b.count - a.count).slice(0, 20);
    const wcagSummary = evaluateWcagFailures({ draw: false, maxElements: 1200, maxFails: 300 });
    const fontSources = extractFontSources();
    const cssStats = collectCssStats();

    return {
      colors,
      fonts,
      fontSizes,
      fontWeights,
      spacing,
      spacingMeta: spacingDetails,
      radii,
      shadows,
      gradients,
      lineHeights,
      rootVars,
        motion,
      fontSources,
      cssStats,
      wcag: {
        aaFailCount: wcagSummary.fails,
        checkedTextBlocks: wcagSummary.checked
      },
      url: location.href,
      title: document.title,
      extractedAt: Date.now()
    };
  }

  // ── Inspect element mode ──────────────────────────────────────────
  let inspectSourceSurface = 'popup';
  let inspectHighlight = null;
  let inspectCursorStyle = null;
  let inspectMetaBadge = null;
  let wcagOverlayActive = false;
  let wcagOverlayNodes = [];
  let colorBlindMode = 'off';
  let measureModeActive = false;
  let measureFirstEl = null;
  let measureNodes = [];
  let measureCursorStyle = null;
  let layoutOverlayActive = false;
  let layoutOverlayNodes = [];

    // ── Unified Inspect mode (hover to preview, click to pin) ─────────
    let hoverInspectActive = false;
    let hoverCard = null;
    let hoverCardStyle = null;
    let hoverCurrentEl = null;   // element under cursor (live)
    let hoverLastEl = null;
    let hoverPinned = false;     // true once user clicks to pin a target
    let hoverPinnedEl = null;    // the pinned element
    let hoverCorner = 'br';      // docked corner: 'br' | 'bl'

    const HOVER_CARD_STYLE = `
  #__tl_hcard__{position:fixed;z-index:2147483647;width:328px;
  font-family:-apple-system,'Segoe UI',system-ui,sans-serif;font-size:11px;
  background:linear-gradient(165deg,rgba(10,18,30,0.98),rgba(8,13,22,0.98));border:1px solid rgba(57,168,162,0.58);
  border-radius:16px;box-shadow:0 20px 56px rgba(0,0,0,0.62),0 0 0 1px rgba(57,168,162,0.14);
  overflow:hidden;pointer-events:auto;
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  transition:opacity 0.12s ease;}
  #__tl_hcard__ .tlhc-head{display:flex;align-items:center;justify-content:space-between;
  padding:9px 12px 8px;border-bottom:1px solid rgba(255,255,255,0.06);gap:6px;}
  #__tl_hcard__ .tlhc-label-wrap{display:flex;align-items:baseline;gap:6px;min-width:0;flex:1;}
  #__tl_hcard__ .tlhc-tag{font-size:11px;font-weight:700;color:#6bd0cb;
  font-family:'SFMono-Regular',Consolas,monospace;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;max-width:220px;}
  #__tl_hcard__ .tlhc-size{font-size:10px;color:rgba(232,243,255,0.4);flex-shrink:0;}
  #__tl_hcard__ .tlhc-close{background:rgba(255,255,255,0.06);border:none;
  color:rgba(232,243,255,0.45);cursor:pointer;padding:2px 7px;border-radius:6px;
  font-size:11px;line-height:1;flex-shrink:0;transition:background 0.15s,color 0.15s;}
  #__tl_hcard__ .tlhc-close:hover{background:rgba(255,80,80,0.18);color:#ff6b6b;}
  #__tl_hcard__ .tlhc-body{padding:5px 0;max-height:340px;overflow:auto;}
  #__tl_hcard__ .tlhc-row{display:flex;align-items:flex-start;gap:8px;
  padding:5px 12px;transition:background 0.1s;cursor:default;}
  #__tl_hcard__ .tlhc-row:hover{background:rgba(255,255,255,0.04);}
  #__tl_hcard__ .tlhc-swatch{width:12px;height:12px;border-radius:3px;
  border:1px solid rgba(255,255,255,0.18);flex-shrink:0;}
  #__tl_hcard__ .tlhc-icon{font-size:11px;color:rgba(232,243,255,0.35);
  width:13px;text-align:center;flex-shrink:0;line-height:1;}
  #__tl_hcard__ .tlhc-rkey{font-size:10px;font-weight:600;color:rgba(232,243,255,0.6);
  letter-spacing:0.12px;width:84px;flex-shrink:0;padding-top:1px;}
  #__tl_hcard__ .tlhc-rval{font-size:11px;font-weight:500;color:#e8f3ff;
  flex:1;min-width:0;line-height:1.28;overflow-wrap:anywhere;word-break:break-word;
  white-space:normal;
  font-family:'SFMono-Regular',Consolas,monospace;}
  #__tl_hcard__ .tlhc-rval.na{color:rgba(232,243,255,0.22);font-style:italic;
  font-family:-apple-system,system-ui,sans-serif;}
  #__tl_hcard__ .tlhc-cpy{background:none;border:none;color:rgba(57,168,162,0.08);
  cursor:pointer;padding:0 2px;font-size:10px;line-height:1;
  transition:color 0.1s;flex-shrink:0;}
  #__tl_hcard__ .tlhc-row:hover .tlhc-cpy{color:rgba(57,168,162,0.5);}
  #__tl_hcard__ .tlhc-cpy:hover{color:#39a8a2 !important;}
  #__tl_hcard__ .tlhc-foot{display:flex;gap:6px;padding:7px 10px 9px;
  border-top:1px solid rgba(255,255,255,0.06);}
  #__tl_hcard__ .tlhc-btn{flex:1;padding:6px 10px;border-radius:8px;
  font-size:11px;font-weight:600;cursor:pointer;border:none;
  transition:all 0.15s;white-space:nowrap;font-family:inherit;}
  #__tl_hcard__ .tlhc-css{background:rgba(57,168,162,0.1);color:#39a8a2;
  border:1px solid rgba(57,168,162,0.28);}
  #__tl_hcard__ .tlhc-css:hover{background:rgba(57,168,162,0.2);}
  #__tl_hcard__ .tlhc-cap{background:#39a8a2;color:#fff;}
  #__tl_hcard__ .tlhc-cap:hover{background:#2d9090;}
  #__tl_hcard__ .tlhc-hint{padding:0 12px 9px;font-size:9.5px;line-height:1.4;
  color:rgba(232,243,255,0.4);text-align:center;}
  #__tl_hcard__ .tlhc-hint b{color:rgba(57,168,162,0.85);font-weight:600;}
  #__tl_hcard__.is-pinned{border-color:rgba(57,168,162,0.9);
  box-shadow:0 16px 48px rgba(0,0,0,0.6),0 0 0 2px rgba(57,168,162,0.35);}
  #__tl_hcard__ .tlhc-pinpill{display:none;align-items:center;gap:3px;
  font-size:9px;font-weight:700;color:#0c1118;background:#39a8a2;
  padding:2px 6px;border-radius:999px;letter-spacing:0.3px;flex-shrink:0;}
  #__tl_hcard__.is-pinned .tlhc-pinpill{display:inline-flex;}
  #__tl_hcard__ .tlhc-head-btns{display:flex;align-items:center;gap:3px;flex-shrink:0;}
  #__tl_hcard__ .tlhc-move{background:rgba(255,255,255,0.06);border:none;
  color:rgba(232,243,255,0.5);cursor:pointer;padding:2px 6px;border-radius:6px;
  font-size:11px;line-height:1;transition:background 0.15s,color 0.15s;}
  #__tl_hcard__ .tlhc-move:hover{background:rgba(57,168,162,0.18);color:#39a8a2;}
  #__tl_hcard__,#__tl_hcard__ *{cursor:default !important;}
  #__tl_hcard__ button,#__tl_hcard__ .tlhc-cpy,#__tl_hcard__ .tlhc-btn,
  #__tl_hcard__ .tlhc-close,#__tl_hcard__ .tlhc-move{cursor:pointer !important;}
  #__tl_hcard__ .tlhc-cpy.copied,#__tl_hcard__ .tlhc-btn.copied{color:#7CFFB2 !important;}`;

    function buildHoverCard() {
      // Inject shared stylesheet once
      if (!hoverCardStyle) {
        hoverCardStyle = document.createElement('style');
        hoverCardStyle.id = '__tl_hcard_style__';
        hoverCardStyle.textContent = HOVER_CARD_STYLE;
        (document.head || document.documentElement).appendChild(hoverCardStyle);
      }

      const card = document.createElement('div');
      card.id = '__tl_hcard__';
      card.innerHTML = `
        <div class="tlhc-head">
          <div class="tlhc-label-wrap">
            <span class="tlhc-tag">—</span>
            <span class="tlhc-size"></span>
          </div>
          <span class="tlhc-pinpill">📌 PINNED</span>
          <div class="tlhc-head-btns">
            <button class="tlhc-move" title="Move card to other side">⇄</button>
            <button class="tlhc-close" title="Exit inspect (Esc)">✕</button>
          </div>
        </div>
        <div class="tlhc-body">
          <div class="tlhc-row" id="__tlhcr_bg__">
            <div class="tlhc-swatch" id="__tlhcs_bg__"></div>
            <span class="tlhc-rkey">Background</span>
            <span class="tlhc-rval" id="__tlhcv_bg__">—</span>
            <button class="tlhc-cpy" data-copy-row="bg" title="Copy">⎘</button>
          </div>
          <div class="tlhc-row" id="__tlhcr_fg__">
            <div class="tlhc-swatch" id="__tlhcs_fg__"></div>
            <span class="tlhc-rkey">Text Color</span>
            <span class="tlhc-rval" id="__tlhcv_fg__">—</span>
            <button class="tlhc-cpy" data-copy-row="fg" title="Copy">⎘</button>
          </div>
          <div class="tlhc-row">
            <span class="tlhc-icon">𝑓</span>
            <span class="tlhc-rkey">Font Family</span>
            <span class="tlhc-rval" id="__tlhcv_font__">—</span>
            <button class="tlhc-cpy" data-copy-row="font" title="Copy">⎘</button>
          </div>
          <div class="tlhc-row">
            <span class="tlhc-icon">⬜</span>
            <span class="tlhc-rkey">Padding</span>
            <span class="tlhc-rval" id="__tlhcv_pad__">—</span>
            <button class="tlhc-cpy" data-copy-row="pad" title="Copy">⎘</button>
          </div>
          <div class="tlhc-row">
            <span class="tlhc-icon">◎</span>
            <span class="tlhc-rkey">Border Radius</span>
            <span class="tlhc-rval" id="__tlhcv_br__">—</span>
            <button class="tlhc-cpy" data-copy-row="br" title="Copy">⎘</button>
          </div>
          <div class="tlhc-row" id="__tlhcr_shadow__">
            <span class="tlhc-icon">◫</span>
            <span class="tlhc-rkey">Box Shadow</span>
            <span class="tlhc-rval" id="__tlhcv_sh__">—</span>
            <button class="tlhc-cpy" data-copy-row="sh" title="Copy">⎘</button>
          </div>
        </div>
        <div class="tlhc-foot">
          <button class="tlhc-btn tlhc-css" id="__tlhc_copy_css__">⎘ Copy CSS</button>
          <button class="tlhc-btn tlhc-cap" id="__tlhc_capture__">⊕ Capture</button>
        </div>
        <div class="tlhc-hint" id="__tlhc_hint__"><b>Click</b> an element to pin it · <b>Esc</b> to exit</div>`;

      document.body.appendChild(card);
      return card;
    }

    function hoverCardSetRow(valId, swatchId, value, swatchColor) {
      const valEl = hoverCard && hoverCard.querySelector('#' + valId);
      const swEl  = hoverCard && swatchId && hoverCard.querySelector('#' + swatchId);
      if (!valEl) return;
      if (value) {
        valEl.textContent = value;
        valEl.className = 'tlhc-rval';
      } else {
        valEl.textContent = '—';
        valEl.className = 'tlhc-rval na';
      }
      if (swEl) {
        swEl.style.background = swatchColor || 'transparent';
        swEl.style.opacity = swatchColor ? '1' : '0.25';
      }
    }

    function updateHoverCard(el) {
      if (!hoverCard || !el) return;
      try {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Header
        const tag = el.tagName.toLowerCase();
        const cls = Array.from(el.classList || []).slice(0, 2)
          .filter(c => c.length < 24 && !/^__|^js-/.test(c)).join('.');
        const label = cls ? `${tag}.${cls}` : tag;

        const tagEl = hoverCard.querySelector('.tlhc-tag');
        const sizeEl = hoverCard.querySelector('.tlhc-size');
        if (tagEl) tagEl.textContent = label;
        if (sizeEl) sizeEl.textContent = `${Math.round(rect.width)}×${Math.round(rect.height)}`;

        // Background color
        const bgHex = parseColor(cs.backgroundColor);
        hoverCardSetRow('__tlhcv_bg__', '__tlhcs_bg__', bgHex || null, bgHex || null);

        // Text color
        const fgHex = parseColor(cs.color);
        hoverCardSetRow('__tlhcv_fg__', '__tlhcs_fg__', fgHex || null, fgHex || null);

        // Font
        const family = cleanFont(cs.fontFamily) || null;
        const sizePx = cs.fontSize ? Math.round(parseFloat(cs.fontSize)) + 'px' : null;
        const weight = cs.fontWeight && cs.fontWeight !== '400' ? ` · ${cs.fontWeight}` : '';
        const fontVal = family ? `${family} · ${sizePx || '?'}${weight}` : null;
        hoverCardSetRow('__tlhcv_font__', null, fontVal, null);

        // Padding
        const pad = cs.padding;
        const padVal = (pad && pad !== '0px' && pad !== '0px 0px 0px 0px') ? pad : null;
        hoverCardSetRow('__tlhcv_pad__', null, padVal, null);

        // Border radius
        const br = cs.borderRadius;
        const brVal = (br && br !== '0px' && br !== '0px 0px 0px 0px') ? br : null;
        hoverCardSetRow('__tlhcv_br__', null, brVal, null);

        // Box shadow
        const sh = cs.boxShadow;
        const shRaw = (sh && sh !== 'none') ? sh : null;
        const shVal = shRaw || null;
        hoverCardSetRow('__tlhcv_sh__', null, shVal, null);

        // Store current data for copy/capture
        hoverCard.__el = el;
        hoverCard.__bg = bgHex;
        hoverCard.__fg = fgHex;
        hoverCard.__font = fontVal;
        hoverCard.__pad = padVal;
        hoverCard.__br = brVal;
        hoverCard.__shFull = shRaw;
        hoverCard.__css = buildHoverCopyCSS(el, cs, bgHex, fgHex, family, sizePx, cs.fontWeight, padVal, brVal, shRaw);
      } catch (_) {}
    }

    function buildHoverCopyCSS(el, cs, bg, fg, family, fontSize, fontWeight, padding, radius, shadow) {
      const lines = [`/* ${el.tagName.toLowerCase()} — captured by Palext */`];
      if (bg)         lines.push(`background-color: ${bg};`);
      if (fg)         lines.push(`color: ${fg};`);
      if (family)     lines.push(`font-family: '${family}', sans-serif;`);
      if (fontSize)   lines.push(`font-size: ${fontSize};`);
      if (fontWeight) lines.push(`font-weight: ${fontWeight};`);
      if (padding)    lines.push(`padding: ${padding};`);
      if (radius)     lines.push(`border-radius: ${radius};`);
      if (shadow)     lines.push(`box-shadow: ${shadow};`);
      return lines.join('\n');
    }

    // Dock the card to a screen corner so its buttons are always reachable.
    // Auto-flips horizontally if the hovered element sits under the card.
    function dockHoverCard(targetRect) {
      if (!hoverCard) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cw = hoverCard.offsetWidth  || 272;
      const ch = hoverCard.offsetHeight || 300;
      const margin = 14;

      // Auto-flip away from the hovered element (only while not pinned).
      if (!hoverPinned && targetRect) {
        const cardLeftIfBR = vw - cw - margin;
        const cardTopBand = vh - ch - margin;
        const overlapsBR = targetRect.right > cardLeftIfBR && targetRect.bottom > cardTopBand;
        const overlapsBL = targetRect.left < cw + margin && targetRect.bottom > cardTopBand;
        if (hoverCorner === 'br' && overlapsBR && !overlapsBL) hoverCorner = 'bl';
        else if (hoverCorner === 'bl' && overlapsBL && !overlapsBR) hoverCorner = 'br';
      }

      const top = vh - ch - margin;
      const left = hoverCorner === 'br' ? (vw - cw - margin) : margin;
      hoverCard.style.top  = `${Math.max(8, Math.round(top))}px`;
      hoverCard.style.left = `${Math.round(left)}px`;
    }

    function flashCopied(btn) {
      if (!btn) return;
      btn.classList.add('copied');
      const isMainBtn = btn.classList.contains('tlhc-btn');
      const prev = btn.textContent;
      if (isMainBtn) btn.textContent = '\u2713 Copied';
      setTimeout(() => {
        btn.classList.remove('copied');
        if (isMainBtn) btn.textContent = prev;
      }, 900);
    }

    async function copyTextSafe(text) {
      if (!text) return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', 'readonly');
          ta.style.position = 'fixed';
          ta.style.top = '-1000px';
          ta.style.left = '-1000px';
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
    }

    function notifyUiToast(message) {
      try {
        chrome.runtime.sendMessage({ type: 'PAL_EXT_TOAST', message }, () => {
          void chrome.runtime.lastError;
        });
      } catch (_) {}
    }

    async function pickColorWithEyeDropper() {
      if (!window.EyeDropper) {
        return { ok: false, error: 'EyeDropper API is not available on this page/browser.' };
      }
      try {
        const eyedropper = new window.EyeDropper();
        const result = await eyedropper.open();
        const hex = normalizeHex(result && result.sRGBHex);
        if (!hex) return { ok: false, error: 'No color selected' };
        return { ok: true, hex };
      } catch (err) {
        if (err && err.name === 'AbortError') {
          return { ok: false, aborted: true, error: 'Color picking cancelled' };
        }
        return { ok: false, error: 'Could not pick color from page' };
      }
    }

    function setHoverPinned(el) {
      hoverPinned = true;
      hoverPinnedEl = el;
      if (hoverCard) {
        hoverCard.classList.add('is-pinned');
        const hint = hoverCard.querySelector('#__tlhc_hint__');
        if (hint) hint.innerHTML = '<b>Pinned.</b> Click page again or <b>Esc</b> to resume hovering';
      }
      positionHighlightOn(el);
    }

    function clearHoverPinned() {
      hoverPinned = false;
      hoverPinnedEl = null;
      if (hoverCard) {
        hoverCard.classList.remove('is-pinned');
        const hint = hoverCard.querySelector('#__tlhc_hint__');
        if (hint) hint.innerHTML = '<b>Click</b> an element to pin it \u00b7 <b>Esc</b> to exit';
      }
    }

    function onHoverOver(e) {
      if (hoverPinned) return;            // frozen on the pinned element
      const el = e.target;
      if (!el || (el.closest && el.closest('#__tl_hcard__'))) return;
      if (el.id === '__tl_highlight__' || el.id === '__tl_highlight_meta__') return;
      if (hoverLastEl === el) return;
      hoverLastEl = el;
      hoverCurrentEl = el;
      updateHoverCard(el);
      positionHighlightOn(el);
      dockHoverCard(el.getBoundingClientRect());
    }

    function onHoverClick(e) {
      const t = e.target;
      if (t.closest && t.closest('#__tl_hcard__')) return;  // card clicks handled per-button
      e.preventDefault();
      e.stopPropagation();
      if (hoverPinned) {
        clearHoverPinned();                 // clicking again resumes live hovering
        if (hoverCurrentEl) { updateHoverCard(hoverCurrentEl); positionHighlightOn(hoverCurrentEl); }
        return;
      }
      updateHoverCard(t);
      setHoverPinned(t);
    }

    function onHoverScroll() {
      const el = hoverPinned ? hoverPinnedEl : hoverCurrentEl;
      if (el) positionHighlightOn(el);
    }

    function onHoverKey(e) {
      if (e.key === 'Escape') {
        if (hoverPinned) { clearHoverPinned(); return; }
        deactivateHoverInspect(true);
      }
    }

    function wireHoverCardButtons() {
      hoverCard.querySelector('.tlhc-close')?.addEventListener('click', () => {
        deactivateHoverInspect(true);
      });

      hoverCard.querySelector('.tlhc-move')?.addEventListener('click', () => {
        hoverCorner = hoverCorner === 'br' ? 'bl' : 'br';
        dockHoverCard(null);
      });

      hoverCard.querySelector('#__tlhc_capture__')?.addEventListener('click', (e) => {
        const el = hoverCard.__el;
        if (!el) return;
        const result = extractElementTokens(el);
        if (result) {
          chrome.storage.local.set({ tl_inspect: result }, () => {
            chrome.runtime.sendMessage({ type: 'INSPECT_CAPTURED', sourceSurface: inspectSourceSurface }, () => {
              void chrome.runtime.lastError;
            });
          });
          flashCopied(e.currentTarget);
        }
      });

      hoverCard.querySelector('#__tlhc_copy_css__')?.addEventListener('click', async (e) => {
        const css = hoverCard.__css || '';
        if (!css) return;
        const copied = await copyTextSafe(css);
        if (copied) notifyUiToast('CSS copied');
        else notifyUiToast('Copy failed on this page');
        flashCopied(e.currentTarget);
      });

      hoverCard.querySelectorAll('.tlhc-cpy').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const row = btn.getAttribute('data-copy-row');
          const val = row === 'bg' ? hoverCard.__bg
            : row === 'fg' ? hoverCard.__fg
            : row === 'font' ? hoverCard.__font
            : row === 'pad' ? hoverCard.__pad
            : row === 'br' ? hoverCard.__br
            : row === 'sh' ? hoverCard.__shFull
            : null;
          if (val) {
            const copied = await copyTextSafe(val);
            if (copied) flashCopied(btn);
          }
        });
      });
    }

    function activateHoverInspect() {
      if (hoverInspectActive) return;
      hoverInspectActive = true;
      hoverLastEl = null;
      hoverPinned = false;
      hoverPinnedEl = null;
      hoverCorner = 'br';
      hoverCard = buildHoverCard();
      inspectHighlight = createHighlightBox();
      inspectMetaBadge = createInspectMetaBadge();
      inspectCursorStyle = createInspectCursorStyle();
      wireHoverCardButtons();
      dockHoverCard(null);
      document.addEventListener('mouseover', onHoverOver, true);
      document.addEventListener('click',     onHoverClick, true);
      document.addEventListener('keydown',   onHoverKey,  true);
      window.addEventListener('scroll', onHoverScroll, true);
    }

    function deactivateHoverInspect(notify) {
      if (!hoverInspectActive) return;
      hoverInspectActive = false;
      hoverLastEl = null;
      hoverCurrentEl = null;
      hoverPinned = false;
      hoverPinnedEl = null;
      document.removeEventListener('mouseover', onHoverOver, true);
      document.removeEventListener('click',     onHoverClick, true);
      document.removeEventListener('keydown',   onHoverKey,  true);
      window.removeEventListener('scroll', onHoverScroll, true);
      if (hoverCard) { hoverCard.remove(); hoverCard = null; }
      if (hoverCardStyle) { hoverCardStyle.remove(); hoverCardStyle = null; }
      if (inspectHighlight) { inspectHighlight.remove(); inspectHighlight = null; }
      if (inspectMetaBadge) { inspectMetaBadge.remove(); inspectMetaBadge = null; }
      if (inspectCursorStyle) { inspectCursorStyle.remove(); inspectCursorStyle = null; }
      if (notify) {
        chrome.runtime.sendMessage({ type: 'HOVER_INSPECT_CLOSED' }).catch(() => {});
      }
    }

  function createHighlightBox() {
    const el = document.createElement('div');
    el.id = '__tl_highlight__';
    el.style.cssText = [
      'position:absolute;z-index:2147483646;pointer-events:none',
      'outline:2px solid #39a8a2;outline-offset:2px',
      'border-radius:3px;background:rgba(57,168,162,0.08)',
      'transition:top 60ms,left 60ms,width 60ms,height 60ms'
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  function createInspectMetaBadge() {
    const el = document.createElement('div');
    el.id = '__tl_highlight_meta__';
    el.style.cssText = [
      'position:absolute;z-index:2147483647;pointer-events:none;white-space:nowrap',
      'padding:4px 8px;border-radius:999px',
      'background:rgba(15,23,34,0.94);color:#e8f3ff',
      'border:1px solid rgba(57,168,162,0.7)',
      'font:700 10px/1.1 -apple-system,system-ui,sans-serif',
      'box-shadow:0 2px 10px rgba(0,0,0,0.3)'
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  function createInspectCursorStyle() {
    const style = document.createElement('style');
    style.id = '__tl_cursor_style__';
    style.textContent = [
      'body, body * { cursor: crosshair !important; }',
      '#__tl_hcard__, #__tl_hcard__ * { cursor: default !important; }',
      '#__tl_hcard__ button, #__tl_hcard__ .tlhc-cpy, #__tl_hcard__ .tlhc-btn, #__tl_hcard__ .tlhc-close, #__tl_hcard__ .tlhc-move { cursor: pointer !important; }'
    ].join('\n');
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
      const rect = el.getBoundingClientRect();

      return {
        label,
        background: bg,
        color: col,
        borderColor: bdc,
        fontSize,
        fontFamily,
        bounds: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
        padding,
        borderRadius,
        boxShadow,
        capturedAt:   Date.now()
      };
    } catch (_) { return null; }
  }

  function inspectElementLabel(el) {
    const tag = (el.tagName || '').toLowerCase();
    const cls = Array.from(el.classList || []).slice(0, 2)
      .filter(c => c.length < 24 && !/^__|^js-/.test(c)).join('.');
    return cls ? `${tag}.${cls}` : tag;
  }

  function positionHighlightOn(el) {
    if (!inspectHighlight || !el) return;
    const r = el.getBoundingClientRect();
    Object.assign(inspectHighlight.style, {
      top: `${r.top + window.scrollY}px`, left: `${r.left + window.scrollX}px`,
      width: `${r.width}px`, height: `${r.height}px`
    });
    if (inspectMetaBadge) {
      inspectMetaBadge.textContent = `${inspectElementLabel(el)} • ${Math.round(r.width)}×${Math.round(r.height)}`;
      Object.assign(inspectMetaBadge.style, {
        top: `${Math.max(0, r.top + window.scrollY - 22)}px`,
        left: `${Math.max(0, r.left + window.scrollX)}px`
      });
    }
  }

  function contrastValue(hex1, hex2) {
    const l1 = luminance(hex1);
    const l2 = luminance(hex2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function findBackgroundColorHex(el, maxDepth = 8) {
    let node = el;
    let depth = 0;
    while (node && depth <= maxDepth) {
      const cs = window.getComputedStyle(node);
      const bg = parseColor(cs.backgroundColor);
      if (bg) return bg;
      node = node.parentElement;
      depth += 1;
    }
    return '#FFFFFF';
  }

  function clearWcagOverlay() {
    wcagOverlayNodes.forEach(node => {
      try { node.remove(); } catch (_) {}
    });
    wcagOverlayNodes = [];
    wcagOverlayActive = false;
  }

  function clearMeasureNodes() {
    measureNodes.forEach(node => {
      try { node.remove(); } catch (_) {}
    });
    measureNodes = [];
  }

  function clearLayoutOverlay() {
    layoutOverlayNodes.forEach(node => {
      try { node.remove(); } catch (_) {}
    });
    layoutOverlayNodes = [];
    layoutOverlayActive = false;
  }

  function ensureMeasureCursor() {
    if (measureCursorStyle) return;
    measureCursorStyle = document.createElement('style');
    measureCursorStyle.id = '__tl_measure_cursor_style__';
    measureCursorStyle.textContent = 'body, body * { cursor: crosshair !important; }';
    document.documentElement.appendChild(measureCursorStyle);
  }

  function removeMeasureCursor() {
    if (measureCursorStyle) {
      measureCursorStyle.remove();
      measureCursorStyle = null;
    }
  }

  function createMeasureNode(styles, text) {
    const node = document.createElement('div');
    node.style.cssText = styles;
    if (text) node.textContent = text;
    document.body.appendChild(node);
    measureNodes.push(node);
    return node;
  }

  // ── Figma-style measurement: edge-to-edge lines on each side ──────
  // Draws up to 4 dashed red lines from element A's edges to element B's
  // nearest face — exactly like Figma spacing inspection.
  // Lines are strictly horizontal or strictly vertical; no diagonals.
  // Tooltips are placed on the outside of each line to prevent overlap.
  function makeMeasureLine(x1, y1, x2, y2, labelText, labelSide, scrollX, scrollY) {
    const isHoriz = y1 === y2;
    const len = isHoriz ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
    if (len < 1) return;

    const lx = Math.min(x1, x2) + scrollX;
    const ly = Math.min(y1, y2) + scrollY;

    // The dashed line itself
    createMeasureNode([
      'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
      `top:${Math.round(ly)}px;left:${Math.round(lx)}px`,
      `width:${isHoriz ? Math.round(len) : 2}px;height:${isHoriz ? 2 : Math.round(len)}px`,
      'background:repeating-linear-gradient(to ' + (isHoriz ? 'right' : 'bottom') + ',#e14d2a 0,#e14d2a 4px,transparent 4px,transparent 8px)'
    ].join(';'));

    // Tooltip — placed outside the line to avoid overlap
    const labelStyle = [
      'position:absolute;pointer-events:none;z-index:2147483647',
      'padding:3px 8px;border-radius:5px',
      'background:#e14d2a;color:#fff',
      'font:700 11px/1.2 ui-monospace,Consolas,monospace',
      'white-space:nowrap',
      'box-shadow:0 2px 8px rgba(0,0,0,0.45)'
    ];

    let labelX, labelY;
    if (isHoriz) {
      labelX = Math.round(lx + len / 2) - 20;
      labelY = labelSide === 'above' ? Math.round(ly) - 22 : Math.round(ly) + 6;
    } else {
      labelX = labelSide === 'left' ? Math.round(lx) - 58 : Math.round(lx) + 8;
      labelY = Math.round(ly + len / 2) - 9;
    }
    createMeasureNode([...labelStyle, `top:${labelY + scrollY - (isHoriz ? 0 : scrollY) + (isHoriz ? 0 : scrollY)}px;left:${labelX}px`].join(';'), labelText);
  }

  function drawMeasureForPair(a, b) {
    clearMeasureNodes();
    if (!a || !b) return;
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;

    // Draw element outlines
    createMeasureNode([
      'position:absolute;z-index:2147483644;pointer-events:none;box-sizing:border-box',
      `top:${Math.round(ar.top + sy)}px;left:${Math.round(ar.left + sx)}px`,
      `width:${Math.round(ar.width)}px;height:${Math.round(ar.height)}px`,
      'outline:2px solid #39a8a2;border-radius:3px'
    ].join(';'));
    createMeasureNode([
      'position:absolute;z-index:2147483644;pointer-events:none;box-sizing:border-box',
      `top:${Math.round(br.top + sy)}px;left:${Math.round(br.left + sx)}px`,
      `width:${Math.round(br.width)}px;height:${Math.round(br.height)}px`,
      'outline:2px solid #e6b769;border-radius:3px'
    ].join(';'));

    // ── 4 edge-to-edge gap lines (Figma style) ──────────────────────
    // RIGHT of A → LEFT of B
    if (ar.right <= br.left) {
      const gap = Math.round(br.left - ar.right);
      const midY = Math.round(Math.max(ar.top, br.top) + Math.min(ar.bottom, br.bottom)) / 2;
      const lineY = isFinite(midY) && midY > Math.max(ar.top, br.top) ? midY : (ar.top + ar.height / 2);
      createMeasureNode([
        'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
        `top:${Math.round(lineY + sy)}px;left:${Math.round(ar.right + sx)}px`,
        `width:${gap}px;height:2px`,
        'background:repeating-linear-gradient(to right,#e14d2a 0,#e14d2a 4px,transparent 4px,transparent 8px)'
      ].join(';'));
      createMeasureNode([
        'position:absolute;pointer-events:none;z-index:2147483647',
        `top:${Math.round(lineY + sy) - 20}px;left:${Math.round(ar.right + sx + gap / 2) - 20}px`,
        'padding:3px 8px;border-radius:5px;background:#e14d2a;color:#fff',
        'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
        'box-shadow:0 2px 8px rgba(0,0,0,0.45)'
      ].join(';'), `← ${gap}px →`);
    }

    // LEFT of A → RIGHT of B
    if (br.right <= ar.left) {
      const gap = Math.round(ar.left - br.right);
      const lineY = br.top + br.height / 2;
      createMeasureNode([
        'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
        `top:${Math.round(lineY + sy)}px;left:${Math.round(br.right + sx)}px`,
        `width:${gap}px;height:2px`,
        'background:repeating-linear-gradient(to right,#e14d2a 0,#e14d2a 4px,transparent 4px,transparent 8px)'
      ].join(';'));
      createMeasureNode([
        'position:absolute;pointer-events:none;z-index:2147483647',
        `top:${Math.round(lineY + sy) - 20}px;left:${Math.round(br.right + sx + gap / 2) - 20}px`,
        'padding:3px 8px;border-radius:5px;background:#e14d2a;color:#fff',
        'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
        'box-shadow:0 2px 8px rgba(0,0,0,0.45)'
      ].join(';'), `← ${gap}px →`);
    }

    // BOTTOM of A → TOP of B
    if (ar.bottom <= br.top) {
      const gap = Math.round(br.top - ar.bottom);
      const lineX = Math.round(Math.max(ar.left, br.left) + Math.min(ar.right, br.right)) / 2;
      const colX = isFinite(lineX) && lineX > Math.max(ar.left, br.left) ? lineX : (ar.left + ar.width / 2);
      createMeasureNode([
        'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
        `top:${Math.round(ar.bottom + sy)}px;left:${Math.round(colX + sx)}px`,
        `width:2px;height:${gap}px`,
        'background:repeating-linear-gradient(to bottom,#e14d2a 0,#e14d2a 4px,transparent 4px,transparent 8px)'
      ].join(';'));
      createMeasureNode([
        'position:absolute;pointer-events:none;z-index:2147483647',
        `top:${Math.round(ar.bottom + sy + gap / 2) - 9}px;left:${Math.round(colX + sx) + 8}px`,
        'padding:3px 8px;border-radius:5px;background:#e14d2a;color:#fff',
        'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
        'box-shadow:0 2px 8px rgba(0,0,0,0.45)'
      ].join(';'), `↕ ${gap}px`);
    }

    // TOP of A → BOTTOM of B
    if (br.bottom <= ar.top) {
      const gap = Math.round(ar.top - br.bottom);
      const colX = br.left + br.width / 2;
      createMeasureNode([
        'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
        `top:${Math.round(br.bottom + sy)}px;left:${Math.round(colX + sx)}px`,
        `width:2px;height:${gap}px`,
        'background:repeating-linear-gradient(to bottom,#e14d2a 0,#e14d2a 4px,transparent 4px,transparent 8px)'
      ].join(';'));
      createMeasureNode([
        'position:absolute;pointer-events:none;z-index:2147483647',
        `top:${Math.round(br.bottom + sy + gap / 2) - 9}px;left:${Math.round(colX + sx) + 8}px`,
        'padding:3px 8px;border-radius:5px;background:#e14d2a;color:#fff',
        'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
        'box-shadow:0 2px 8px rgba(0,0,0,0.45)'
      ].join(';'), `↕ ${gap}px`);
    }

    // ── When elements overlap: detect containment and show inner spacing ──
    const overlapH = ar.right > br.left && br.right > ar.left;
    const overlapV = ar.bottom > br.top && br.bottom > ar.top;
    if (overlapH && overlapV) {
      // Determine which is parent (outer) and which is child (inner)
      const aContainsB = ar.left <= br.left && ar.top <= br.top && ar.right >= br.right && ar.bottom >= br.bottom;
      const bContainsA = br.left <= ar.left && br.top <= ar.top && br.right >= ar.right && br.bottom >= ar.bottom;

      if (aContainsB || bContainsA) {
        // Draw Figma-style inner spacing: 4 lines from parent edges → child edges
        const outer = aContainsB ? ar : br;
        const inner = aContainsB ? br : ar;

        const gapTop    = Math.round(inner.top    - outer.top);
        const gapBottom = Math.round(outer.bottom - inner.bottom);
        const gapLeft   = Math.round(inner.left   - outer.left);
        const gapRight  = Math.round(outer.right  - inner.right);
        const midX = Math.round(inner.left + inner.width / 2);
        const midY = Math.round(inner.top  + inner.height / 2);

        // Top gap
        if (gapTop > 0) {
          createMeasureNode([
            'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
            `top:${Math.round(outer.top + sy)}px;left:${midX + sx}px`,
            `width:2px;height:${gapTop}px`,
            'background:repeating-linear-gradient(to bottom,#2563eb 0,#2563eb 4px,transparent 4px,transparent 8px)'
          ].join(';'));
          createMeasureNode([
            'position:absolute;pointer-events:none;z-index:2147483647',
            `top:${Math.round(outer.top + sy + gapTop / 2) - 9}px;left:${midX + sx + 6}px`,
            'padding:3px 8px;border-radius:5px;background:#2563eb;color:#fff',
            'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
            'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
          ].join(';'), `↕ ${gapTop}px`);
        }
        // Bottom gap
        if (gapBottom > 0) {
          createMeasureNode([
            'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
            `top:${Math.round(inner.bottom + sy)}px;left:${midX + sx}px`,
            `width:2px;height:${gapBottom}px`,
            'background:repeating-linear-gradient(to bottom,#2563eb 0,#2563eb 4px,transparent 4px,transparent 8px)'
          ].join(';'));
          createMeasureNode([
            'position:absolute;pointer-events:none;z-index:2147483647',
            `top:${Math.round(inner.bottom + sy + gapBottom / 2) - 9}px;left:${midX + sx + 6}px`,
            'padding:3px 8px;border-radius:5px;background:#2563eb;color:#fff',
            'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
            'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
          ].join(';'), `↕ ${gapBottom}px`);
        }
        // Left gap
        if (gapLeft > 0) {
          createMeasureNode([
            'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
            `top:${midY + sy}px;left:${Math.round(outer.left + sx)}px`,
            `width:${gapLeft}px;height:2px`,
            'background:repeating-linear-gradient(to right,#2563eb 0,#2563eb 4px,transparent 4px,transparent 8px)'
          ].join(';'));
          createMeasureNode([
            'position:absolute;pointer-events:none;z-index:2147483647',
            `top:${midY + sy - 20}px;left:${Math.round(outer.left + sx + gapLeft / 2) - 18}px`,
            'padding:3px 8px;border-radius:5px;background:#2563eb;color:#fff',
            'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
            'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
          ].join(';'), `← ${gapLeft}px →`);
        }
        // Right gap
        if (gapRight > 0) {
          createMeasureNode([
            'position:absolute;pointer-events:none;box-sizing:border-box;z-index:2147483645',
            `top:${midY + sy}px;left:${Math.round(inner.right + sx)}px`,
            `width:${gapRight}px;height:2px`,
            'background:repeating-linear-gradient(to right,#2563eb 0,#2563eb 4px,transparent 4px,transparent 8px)'
          ].join(';'));
          createMeasureNode([
            'position:absolute;pointer-events:none;z-index:2147483647',
            `top:${midY + sy - 20}px;left:${Math.round(inner.right + sx + gapRight / 2) - 18}px`,
            'padding:3px 8px;border-radius:5px;background:#2563eb;color:#fff',
            'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
            'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
          ].join(';'), `← ${gapRight}px →`);
        }
        // If all gaps are 0, elements are flush — show a badge
        if (gapTop === 0 && gapBottom === 0 && gapLeft === 0 && gapRight === 0) {
          createMeasureNode([
            'position:absolute;pointer-events:none;z-index:2147483647',
            `top:${Math.round(inner.top + sy)}px;left:${Math.round(inner.left + sx) + 4}px`,
            'padding:3px 8px;border-radius:5px;background:#7c3aed;color:#fff',
            'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
            'box-shadow:0 2px 8px rgba(0,0,0,0.45)'
          ].join(';'), 'Flush (0px padding)');
        }
      } else {
        // Partial overlap — show overlap dimensions
        const ow = Math.round(Math.min(ar.right, br.right) - Math.max(ar.left, br.left));
        const oh = Math.round(Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
        createMeasureNode([
          'position:absolute;pointer-events:none;z-index:2147483647',
          `top:${Math.round(Math.max(ar.top, br.top) + sy)}px;left:${Math.round(Math.max(ar.left, br.left) + sx) + 4}px`,
          'padding:3px 8px;border-radius:5px;background:#7c3aed;color:#fff',
          'font:700 11px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap',
          'box-shadow:0 2px 8px rgba(0,0,0,0.45)'
        ].join(';'), `Overlap ${ow}×${oh}px`);
      }
    }
  }

  function measureClickHandler(e) {
    const target = e.target;
    if (!measureModeActive || !target) return;
    if (target.id && target.id.startsWith('__tl_')) return;
    e.preventDefault();
    e.stopPropagation();
    if (!measureFirstEl) {
      measureFirstEl = target;
      clearMeasureNodes();
      const r = target.getBoundingClientRect();
      createMeasureNode([
        'position:absolute;z-index:2147483645;pointer-events:none;box-sizing:border-box',
        `top:${r.top + window.scrollY}px;left:${r.left + window.scrollX}px;width:${r.width}px;height:${r.height}px`,
        'outline:2px solid rgba(57,168,162,0.95);border-radius:3px'
      ].join(';'));
      return;
    }
    drawMeasureForPair(measureFirstEl, target);
    measureFirstEl = target;
  }

  function measureKeyHandler(e) {
    if (!measureModeActive) return;
    if (e.key === 'Escape') {
      toggleMeasureMode(false);
    }
  }

  function toggleMeasureMode(nextEnabled) {
    const enabled = typeof nextEnabled === 'boolean' ? nextEnabled : !measureModeActive;
    if (enabled === measureModeActive) {
      return { enabled: measureModeActive };
    }

    measureModeActive = enabled;
    measureFirstEl = null;

    if (measureModeActive) {
      ensureMeasureCursor();
      document.addEventListener('click', measureClickHandler, true);
      document.addEventListener('keydown', measureKeyHandler, true);
    } else {
      document.removeEventListener('click', measureClickHandler, true);
      document.removeEventListener('keydown', measureKeyHandler, true);
      removeMeasureCursor();
      clearMeasureNodes();
    }
    return { enabled: measureModeActive };
  }

  function buildLayoutOverlay() {
    clearLayoutOverlay();
    const nodes = Array.from(document.querySelectorAll('body *')).slice(0, 2400);
    let count = 0;
    for (const el of nodes) {
      if (count >= 120) break;
      const cs = getComputedStyle(el);
      if (cs.display !== 'grid' && cs.display !== 'inline-grid' && cs.display !== 'flex' && cs.display !== 'inline-flex') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) continue;
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      const tone = cs.display.includes('grid') ? 'rgba(95,145,185,0.9)' : 'rgba(57,168,162,0.9)';

      const box = document.createElement('div');
      box.style.cssText = [
        'position:absolute;z-index:2147483643;pointer-events:none;box-sizing:border-box',
        `top:${top}px;left:${left}px;width:${rect.width}px;height:${rect.height}px`,
        `outline:2px dashed ${tone};outline-offset:1px;border-radius:4px`
      ].join(';');
      document.body.appendChild(box);
      layoutOverlayNodes.push(box);

      const badge = document.createElement('div');
      badge.style.cssText = [
        'position:absolute;z-index:2147483644;pointer-events:none;white-space:nowrap',
        `top:${Math.max(0, top - 18)}px;left:${left}px`,
        'padding:2px 6px;border-radius:4px;background:#0f1722;color:#e8f3ff',
        `border:1px solid ${tone}`,
        'font:700 10px/1 ui-monospace,Menlo,monospace'
      ].join(';');
      badge.textContent = cs.display;
      document.body.appendChild(badge);
      layoutOverlayNodes.push(badge);
      count += 1;
    }
    layoutOverlayActive = count > 0;
    return { enabled: layoutOverlayActive, count };
  }

  function toggleLayoutOverlay(forceEnabled) {
    if (typeof forceEnabled === 'boolean') {
      if (forceEnabled) return buildLayoutOverlay();
      clearLayoutOverlay();
      return { enabled: false, count: 0 };
    }
    if (layoutOverlayActive) {
      clearLayoutOverlay();
      return { enabled: false, count: 0 };
    }
    return buildLayoutOverlay();
  }

  function setColorBlindMode(mode) {
    const safeMode = String(mode || 'off').toLowerCase();
    const filters = {
      off: '',
      protanopia: 'url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\"><filter id=\"p\"><feColorMatrix type=\"matrix\" values=\"0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0\"/></filter></svg>#p")',
      deuteranopia: 'url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\"><filter id=\"d\"><feColorMatrix type=\"matrix\" values=\"0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0\"/></filter></svg>#d")',
      tritanopia: 'url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\"><filter id=\"t\"><feColorMatrix type=\"matrix\" values=\"0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0\"/></filter></svg>#t")',
      achromatopsia: 'grayscale(1)'
    };

    const styleId = '__tl_colorblind_style__';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.documentElement.appendChild(styleEl);
    }

    if (!filters[safeMode] || safeMode === 'off') {
      styleEl.textContent = '';
      colorBlindMode = 'off';
      return { enabled: false, mode: 'off' };
    }

    styleEl.textContent = `html { filter: ${filters[safeMode]} !important; }`;
    colorBlindMode = safeMode;
    return { enabled: true, mode: safeMode };
  }

  function drawFailOverlay(rect, ratio) {
    // Absolute (document) coordinates so fail markers stay pinned to their
    // elements while the user scrolls the page.
    const top = rect.top + window.scrollY;
    const left = rect.left + window.scrollX;
    const box = document.createElement('div');
    box.style.cssText = [
      'position:absolute;z-index:2147483645;pointer-events:none;box-sizing:border-box',
      `top:${Math.max(0, top)}px;left:${Math.max(0, left)}px`,
      `width:${Math.max(0, rect.width)}px;height:${Math.max(0, rect.height)}px`,
      'outline:2px solid rgba(236, 127, 127, 0.95)',
      'background:rgba(236, 127, 127, 0.10)',
      'border-radius:3px'
    ].join(';');

    const badge = document.createElement('div');
    badge.style.cssText = [
      'position:absolute;z-index:2147483646;pointer-events:none;white-space:nowrap',
      `top:${Math.max(0, top - 18)}px;left:${Math.max(0, left)}px`,
      'padding:2px 5px;border-radius:4px',
      'background:#b42323;color:#fff',
      'font:700 10px/1 -apple-system,sans-serif'
    ].join(';');
    badge.textContent = `AA fail ${ratio.toFixed(2)}:1`;

    document.body.appendChild(box);
    document.body.appendChild(badge);
    wcagOverlayNodes.push(box, badge);
  }

  function evaluateWcagFailures(options = {}) {
    const maxElements = Number(options.maxElements || 1800);
    const maxFails = Number(options.maxFails || 60);
    const draw = Boolean(options.draw);

    const elements = Array.from(document.querySelectorAll('body *')).slice(0, maxElements);
    let failures = 0;
    let checked = 0;

    for (const el of elements) {
      if (failures >= maxFails) break;

      const text = (el.textContent || '').trim();
      if (!text) continue;

      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (parseFloat(cs.opacity || '1') === 0) continue;

      const color = parseColor(cs.color);
      if (!color) continue;
      const bg = findBackgroundColorHex(el);
      if (!bg) continue;

      checked += 1;

      const fontSize = parseFloat(cs.fontSize || '0');
      const fontWeight = Number(cs.fontWeight || 400);
      const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const threshold = largeText ? 3 : 4.5;
      const ratio = contrastValue(color, bg);

      if (ratio >= threshold) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) continue;

      if (draw) {
        drawFailOverlay(rect, ratio);
      }
      failures += 1;
    }

    return { fails: failures, checked };
  }

  function buildWcagOverlay() {
    clearWcagOverlay();
    const result = evaluateWcagFailures({ draw: true, maxElements: 1800, maxFails: 60 });
    const failures = result.fails;

    wcagOverlayActive = failures > 0;
    if (failures === 0) {
      wcagOverlayActive = true;
    }
    return failures;
  }

  function toggleWcagOverlay() {
    if (wcagOverlayActive) {
      clearWcagOverlay();
      return { enabled: false, count: 0 };
    }

    const count = buildWcagOverlay();
    return { enabled: true, count };
  }

  // ── Live DOM Token Replacer ───────────────────────────────────────
  let __previewAppliedVars = [];
  const __previewStyleId = '__tl_smart_preview_style__';

  function applyVarPreview(vars) {
    revertVarPreview();
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    const applied = [];
    let overlap = 0;
    let changed = 0;
    for (const [name, value] of Object.entries(vars || {})) {
      if (name.startsWith('--') && value) {
        const current = (rootStyle.getPropertyValue(name) || '').trim();
        if (current) {
          overlap += 1;
          if (current !== String(value).trim()) {
            changed += 1;
          }
        }
        root.style.setProperty(name, value);
        applied.push(name);
      }
    }
    __previewAppliedVars = applied;
    return { applied: applied.length, overlap, changed };
  }

  function saturation(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const l = (max + min) / 2;
    const d = max - min;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }

  function pickReadableText(bgHex) {
    return luminance(bgHex) > 0.56 ? '#111827' : '#F8FAFC';
  }

  function pickSmartTheme(tokens) {
    const colorEntries = (tokens && Array.isArray(tokens.colors) ? tokens.colors : [])
      .map(c => ({ hex: normalizeHex(c && c.hex), count: Number(c && c.count ? c.count : 0) }))
      .filter(c => !!c.hex);

    if (!colorEntries.length) return null;

    const totalCount = Math.max(1, colorEntries.reduce((s, c) => s + c.count, 0));
    const withMeta = colorEntries.map(c => ({
      hex: c.hex,
      count: c.count,
      freq: c.count / totalCount,
      lum: luminance(c.hex),
      sat: saturation(c.hex)
    }));

    // Determine source site tone using frequency-weighted average luminance.
    // This correctly identifies if Site A (snapshot) was a light or dark themed site.
    const weightedLum = withMeta.reduce((s, c) => s + c.lum * c.freq, 0);
    const sourceIsDark = weightedLum < 0.35;

    // Background: most-frequent color at the luminance extreme matching source tone.
    // Light source → lum > 0.72 (near-white). Dark source → lum < 0.12 (near-black).
    // This prevents a button blue from being picked as background.
    const bgStrict = sourceIsDark ? 0.12 : 0.72;
    const bgLoose  = sourceIsDark ? 0.20 : 0.60;
    const bgPool = withMeta.filter(c => sourceIsDark ? c.lum < bgStrict : c.lum > bgStrict);
    const bgPoolFallback = withMeta.filter(c => sourceIsDark ? c.lum < bgLoose : c.lum > bgLoose);
    const bgCandidates = (bgPool.length ? bgPool : bgPoolFallback).sort((a, b) => b.count - a.count);
    const bg = bgCandidates[0]?.hex || (sourceIsDark ? '#111827' : '#FFFFFF');
    const bgLum = luminance(bg);

    // Text: must contrast ≥ 4.5:1 with bg, most frequent such color.
    const textCandidates = withMeta
      .filter(c => c.hex !== bg && Number(contrastRatio(c.hex, bg)) >= 4.5)
      .sort((a, b) => b.count - a.count);
    const text = textCandidates[0]?.hex || (sourceIsDark ? '#F9FAFB' : '#111827');

    // Accent: high saturation, not bg or text, scored by saturation + frequency.
    const accentCandidates = withMeta
      .filter(c => c.hex !== bg && c.hex !== text && c.sat > 0.2)
      .sort((a, b) => (b.sat * 0.7 + b.freq * 0.3) - (a.sat * 0.7 + a.freq * 0.3));
    const accent = accentCandidates[0]?.hex
      || withMeta.filter(c => c.hex !== bg && c.hex !== text).sort((a, b) => b.sat - a.sat)[0]?.hex
      || text;

    // Surface: close to bg in luminance but distinct, low saturation (for cards/panels).
    const surfaceCandidates = withMeta.filter(c => {
      if (c.hex === bg || c.hex === text || c.hex === accent) return false;
      const diff = Math.abs(c.lum - bgLum);
      return diff > 0.015 && diff < 0.22 && c.sat < 0.2;
    }).sort((a, b) => b.count - a.count);
    const surface = surfaceCandidates[0]?.hex || bg;

    // Border: between bg and text luminance, low saturation.
    const borderCandidates = withMeta.filter(c => {
      if (c.hex === bg || c.hex === accent) return false;
      const diff = Math.abs(c.lum - bgLum);
      return diff > 0.05 && diff < 0.45 && c.sat < 0.25;
    }).sort((a, b) => b.count - a.count);
    const border = borderCandidates[0]?.hex || (sourceIsDark ? '#374151' : '#D1D5DB');

    // Detect target (current) page tone.
    const rawTargetBg = (getComputedStyle(document.body || document.documentElement).backgroundColor || '').trim();
    const targetBgHex = parseColor(rawTargetBg) || '#FFFFFF';
    const targetIsDark = luminance(targetBgHex) < 0.45;
    // Only apply bg/text overrides when both sites share the same tone.
    // Applying a light background to a dark page (or vice versa) causes the worst-looking results.
    const sameTone = sourceIsDark === targetIsDark;

    const font = Array.isArray(tokens && tokens.fonts) && tokens.fonts.length
      ? String(tokens.fonts[0]).replace(/["']/g, '').trim() : null;
    const spacing = Array.isArray(tokens && tokens.spacing) && tokens.spacing.length
      ? `${Math.max(4, Math.min(24, Number(tokens.spacing[Math.floor(tokens.spacing.length / 2)]) || 12))}px`
      : null;
    const radius = Array.isArray(tokens && tokens.radii) && tokens.radii.length
      ? `${Math.max(2, Math.min(20, Number(tokens.radii[Math.floor(tokens.radii.length / 2)]) || 8))}px`
      : null;
    const shadow = Array.isArray(tokens && tokens.shadows) && tokens.shadows.length
      ? String(tokens.shadows[0]) : null;

    let coreAvailable = 1;
    let coreApplied = 1;
    if (font) { coreAvailable += 1; coreApplied += 1; }
    if (spacing) { coreAvailable += 1; coreApplied += 1; }
    if (radius) { coreAvailable += 1; coreApplied += 1; }
    if (shadow) { coreAvailable += 1; coreApplied += 1; }

    return { bg, text, surface, accent, border, onAccent: pickReadableText(accent),
             sameTone, font, spacing, radius, shadow, coreAvailable, coreApplied };
  }

  function buildSmartPreviewCss(theme) {
    // Each rule is only added when it is safe to do so.
    // Rules that change layout (padding, margin, shadow, background on containers) are intentionally excluded.
    const fontDecl = theme.font ? `"${theme.font}", system-ui, sans-serif` : null;
    const radiusDecl = theme.radius || null;
    const parts = [];

    // CSS custom properties — only define vars that will actually be used below.
    const varLines = [
      `  --tlp-accent:    ${theme.accent};`,
      `  --tlp-on-accent: ${theme.onAccent};`,
      `  --tlp-border:    ${theme.border};`
    ];
    if (fontDecl)   varLines.push(`  --tlp-font:   ${fontDecl};`);
    if (radiusDecl) varLines.push(`  --tlp-radius: ${radiusDecl};`);
    // Only declare bg/text vars if we will actually apply them (same tone).
    if (theme.sameTone) {
      varLines.push(`  --tlp-bg:   ${theme.bg};`);
      varLines.push(`  --tlp-text: ${theme.text};`);
      if (theme.surface && theme.surface !== theme.bg)
        varLines.push(`  --tlp-surface: ${theme.surface};`);
    }
    parts.push(`:root {\n${varLines.join('\n')}\n}`);

    // Background + body text — ONLY when source and target share the same tone.
    // This prevents a white background from a light site being forced onto a dark site.
    if (theme.sameTone) {
      parts.push(`html, body {\n  background-color: var(--tlp-bg) !important;\n  color: var(--tlp-text) !important;\n}`);
      // Block-level text elements — safe to recolor when tone matches.
      // Intentionally excludes span/strong/em/small (too generic, used for icons/badges/decorators).
      parts.push(`body h1, body h2, body h3, body h4, body h5, body h6,\nbody p, body li, body label, body blockquote, body figcaption, body dt, body dd {\n  color: var(--tlp-text) !important;\n}`);
    }

    // Typography — always safe to apply regardless of tone.
    if (fontDecl) {
      parts.push(`html, body,\nbody h1, body h2, body h3, body h4, body h5, body h6 {\n  font-family: var(--tlp-font) !important;\n}`);
    }

    // Links — accent color; exclude anything that visually looks like a button.
    parts.push(`body a:not([role="button"]):not([class*="btn"]):not([class*="button"]):not([class*="Button"]) {\n  color: var(--tlp-accent) !important;\n}`);

    // Buttons — color only; NO padding, NO shadow, NO margin changes (layout-safe).
    // Excluded: buttons that contain images/SVGs (logo buttons), elements with "logo" or "brand" in class/aria-label.
    // :has(img,svg,picture) covers logo buttons like <button><img src="logo.png"></button>.
    const btnRadius = radiusDecl ? `\n  border-radius: var(--tlp-radius) !important;` : '';
    const btnExclude = ':not(:has(img, svg, picture)):not([class*="logo"]):not([id*="logo"]):not([class*="brand"]):not([aria-label*="logo" i]):not([class*="navbar-brand"])';
    parts.push(`body button${btnExclude},\nbody [role="button"]${btnExclude},\nbody input[type="button"],\nbody input[type="submit"],\nbody input[type="reset"] {\n  background-color: var(--tlp-accent) !important;\n  color: var(--tlp-on-accent) !important;${btnRadius}\n}`);

    // Form inputs — border + optional font + optional radius; NO background, NO padding.
    const inputFont   = fontDecl   ? `\n  font-family: var(--tlp-font) !important;` : '';
    const inputRadius = radiusDecl ? `\n  border-radius: calc(var(--tlp-radius) * 0.75) !important;` : '';
    parts.push(`body input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),\nbody textarea,\nbody select {\n  border-color: var(--tlp-border) !important;${inputFont}${inputRadius}\n}`);

    // Surface on ONLY main layout containers — same-tone + only when surface ≠ bg.
    // Intentionally excludes section/div/.container/.card/.tile to avoid breaking most page layouts.
    if (theme.sameTone && theme.surface && theme.surface !== theme.bg) {
      parts.push(`body main,\nbody article,\nbody aside {\n  background-color: var(--tlp-surface) !important;\n}`);
    }

    // Accent-color for native form controls (checkboxes, radios, range).
    parts.push(`body * {\n  accent-color: var(--tlp-accent) !important;\n}`);

    return parts.join('\n\n');
  }

  function estimatePreviewCoverage() {
    const allNodes = Array.from(document.querySelectorAll('body *')).slice(0, 2500);
    const totalElements = Math.max(1, allNodes.length);
    const seen = new Set();
    const selectors = [
      'h1, h2, h3, h4, h5, h6, p, li, label, blockquote, dd, dt',
      'a, a:visited',
      'button, [role="button"], input[type="button"], input[type="submit"], .btn, .button',
      'input, textarea, select',
      'main, section, article, aside, nav, header, footer, form, fieldset, table, ul, ol, li, td, th, .card, .panel, .surface, .container, .tile'
    ];

    for (const selector of selectors) {
      let matches = [];
      try {
        matches = document.querySelectorAll(selector);
      } catch (_) {
        continue;
      }
      for (const node of matches) {
        if (seen.size >= totalElements) break;
        seen.add(node);
      }
    }

    const matchedElements = seen.size;
    const pageCoveragePct = Math.max(1, Math.min(100, Math.round((matchedElements / totalElements) * 100)));
    return { matchedElements, totalElements, pageCoveragePct };
  }

  function detectCssFramework() {
    // Quick heuristic: sample up to 80 classed elements and check for Tailwind utility
    // or CSS-in-JS hashed class patterns. Returns 'tailwind', 'css-in-js', or null.
    const sample = Array.from(document.querySelectorAll('body [class]')).slice(0, 80);
    if (!sample.length) return null;
    const twRe = /\b(text-|bg-|p-\d|px-|py-|pt-|pb-|pl-|pr-|m-\d|mx-|my-|mt-|mb-|ml-|mr-|flex\b|grid\b|gap-|w-\d|h-\d|border-|rounded\b|rounded-|font-|items-|justify-|space-|leading-|tracking-|opacity-|shadow-|ring-|z-\d)/;
    const cijRe = /\b(sc-[a-zA-Z]{3,}|css-\d{4,}|[a-zA-Z]{2,8}-[a-z0-9]{7,12}\b)/;
    let tw = 0, cij = 0;
    for (const el of sample) {
      const cls = typeof el.className === 'string' ? el.className : '';
      if (twRe.test(cls)) tw++;
      if (cijRe.test(cls)) cij++;
    }
    const ratio = Math.max(tw, cij) / sample.length;
    if (ratio < 0.25) return null;
    return tw >= cij ? 'tailwind' : 'css-in-js';
  }

  function applySmartPreview(tokens) {
    const theme = pickSmartTheme(tokens || {});
    if (!theme) return { ok: false, reason: 'NO_COLOR_TOKENS' };

    let styleEl = document.getElementById(__previewStyleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = __previewStyleId;
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = buildSmartPreviewCss(theme);

    const coverage = estimatePreviewCoverage();
    const tokenRolePct = Math.max(1, Math.min(100, Math.round((theme.coreApplied / theme.coreAvailable) * 100)));
    return {
      ok: true,
      tokenRolePct,
      ...coverage
    };
  }

  function removeSmartPreview() {
    const styleEl = document.getElementById(__previewStyleId);
    if (styleEl) styleEl.remove();
  }

  function revertVarPreview() {
    const root = document.documentElement;
    for (const name of __previewAppliedVars) {
      root.style.removeProperty(name);
    }
    __previewAppliedVars = [];
    removeSmartPreview();
    removePreviewPill();
  }

  function showPreviewPill(snapshotName, summary) {
    removePreviewPill();
    const pill = document.createElement('div');
    pill.id = '__tl_preview_pill';
    pill.setAttribute('role', 'status');
    pill.style.cssText = [
      'position:fixed',
      'bottom:18px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'background:rgba(22,35,50,0.96)',
      'color:#e8f3ff',
      'border:1.5px solid #39a8a2',
      'border-radius:20px',
      'padding:7px 16px 7px 14px',
      'font:500 12px/1.4 system-ui,sans-serif',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'box-shadow:0 4px 22px rgba(0,0,0,0.55)',
      'pointer-events:auto',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)'
    ].join(';');

    const label = document.createElement('span');
    label.textContent = '\uD83C\uDFA8 Palext preview: ' + snapshotName + (summary ? ` (${summary})` : '');

    const btn = document.createElement('button');
    btn.textContent = 'Revert';
    btn.style.cssText = [
      'background:#39a8a2',
      'color:#fff',
      'border:none',
      'border-radius:10px',
      'padding:3px 10px',
      'font:600 11px system-ui,sans-serif',
      'cursor:pointer',
      'flex-shrink:0'
    ].join(';');
    btn.addEventListener('click', () => {
      revertVarPreview();
      chrome.runtime.sendMessage({ type: 'VAR_PREVIEW_REVERTED' }).catch(() => {});
    });

    pill.appendChild(label);
    pill.appendChild(btn);
    document.body.appendChild(pill);
  }

  function removePreviewPill() {
    const existing = document.getElementById('__tl_preview_pill');
    if (existing) existing.remove();
  }

  // ── Asset extraction (PRO) ─────────────────────────────────────────
  function absoluteUrl(src) {
    try { return new URL(src, location.href).href; } catch (_) { return src; }
  }

  function extractAssets() {
    const images = [];
    const svgs = [];
    const icons = [];
    const seenImg = new Set();
    const seenSvg = new Set();
    const seenIcon = new Set();

    // <img> elements (skip tiny tracking pixels).
    Array.from(document.querySelectorAll('img')).slice(0, 400).forEach(img => {
      const src = img.currentSrc || img.getAttribute('src') || '';
      if (!src || src.startsWith('data:image/gif')) return;
      const url = absoluteUrl(src);
      if (seenImg.has(url)) return;
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w && h && w < 8 && h < 8) return;
      seenImg.add(url);
      const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase().slice(0, 5);
      images.push({ url, alt: (img.alt || '').slice(0, 60), width: w, height: h, type: ext || 'img' });
    });

    // CSS background-image url() references.
    Array.from(document.querySelectorAll('*')).slice(0, 2000).forEach(el => {
      if (seenImg.size >= 120) return;
      const bg = getComputedStyle(el).backgroundImage || '';
      if (!bg || bg === 'none' || !bg.includes('url(')) return;
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (!match) return;
      const url = absoluteUrl(match[1]);
      if (url.startsWith('data:') || seenImg.has(url)) return;
      seenImg.add(url);
      const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase().slice(0, 5);
      images.push({ url, alt: 'background', width: 0, height: 0, type: ext || 'bg' });
    });

    // Inline SVG elements — serialized to data URLs so they can be previewed/copied.
    Array.from(document.querySelectorAll('svg')).slice(0, 120).forEach(svg => {
      try {
        const r = svg.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        const clone = svg.cloneNode(true);
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const markup = new XMLSerializer().serializeToString(clone);
        if (markup.length > 60000) return;
        const key = markup.slice(0, 200);
        if (seenSvg.has(key)) return;
        seenSvg.add(key);
        const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(markup);
        const isIcon = r.width <= 48 && r.height <= 48;
        const item = { markup, dataUrl, width: Math.round(r.width), height: Math.round(r.height), type: 'svg' };
        if (isIcon) icons.push(item); else svgs.push(item);
      } catch (_) {}
    });

    // Favicons / declared icons from <link rel>.
    Array.from(document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]')).forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const url = absoluteUrl(href);
      if (seenIcon.has(url)) return;
      seenIcon.add(url);
      icons.push({ url, type: 'favicon', width: 0, height: 0 });
    });

    return {
      images: images.slice(0, 120),
      svgs: svgs.slice(0, 60),
      icons: icons.slice(0, 60),
      counts: { images: images.length, svgs: svgs.length, icons: icons.length }
    };
  }

  // ── Locate instances on page (PRO) ─────────────────────────────────
  let instanceOverlayNodes = [];

  function removeInstanceClearPill() {
    const pill = document.getElementById('__tl_instance_pill__');
    if (pill) pill.remove();
  }

  function showInstanceClearPill(count) {
    removeInstanceClearPill();
    const pill = document.createElement('div');
    pill.id = '__tl_instance_pill__';
    pill.style.cssText = [
      'position:fixed;bottom:18px;left:50%;transform:translateX(-50%)',
      'z-index:2147483647;display:flex;align-items:center;gap:10px',
      'background:rgba(15,23,34,0.96);color:#e8f3ff',
      'border:1.5px solid #39a8a2;border-radius:20px',
      'padding:7px 14px;box-shadow:0 4px 22px rgba(0,0,0,0.5)',
      'font:500 12px/1.4 system-ui,sans-serif;backdrop-filter:blur(8px)'
    ].join(';');
    const label = document.createElement('span');
    label.textContent = `\uD83D\uDD0E ${count} element${count === 1 ? '' : 's'} highlighted`;
    const btn = document.createElement('button');
    btn.textContent = '✕ Clear';
    btn.style.cssText = 'background:#39a8a2;color:#fff;border:none;border-radius:10px;padding:3px 11px;font:600 11px system-ui,sans-serif;cursor:pointer';
    btn.addEventListener('click', clearInstanceOverlay);
    pill.appendChild(label);
    pill.appendChild(btn);
    document.body.appendChild(pill);
  }

  function clearInstanceOverlay() {
    instanceOverlayNodes.forEach(node => { try { node.remove(); } catch (_) {} });
    instanceOverlayNodes = [];
    removeInstanceClearPill();
  }

  function drawInstanceBox(rect, labelText) {
    // Use absolute (document) coordinates so the highlight stays pinned to the
    // element as the user scrolls, instead of floating in the viewport.
    const top = rect.top + window.scrollY;
    const left = rect.left + window.scrollX;
    const box = document.createElement('div');
    box.style.cssText = [
      'position:absolute;z-index:2147483645;pointer-events:none;box-sizing:border-box',
      `top:${Math.max(0, top)}px;left:${Math.max(0, left)}px`,
      `width:${Math.max(0, rect.width)}px;height:${Math.max(0, rect.height)}px`,
      // Clean outline only — never a solid fill, so page content stays readable
      // even when many elements (e.g. a black color) are highlighted at once.
      'outline:2px solid #39a8a2;outline-offset:1px',
      'border-radius:3px;background:transparent'
    ].join(';');
    instanceOverlayNodes.push(box);
    document.body.appendChild(box);
    if (labelText && instanceOverlayNodes.length <= 2) {
      const badge = document.createElement('div');
      badge.style.cssText = [
        'position:absolute;z-index:2147483646;pointer-events:none;white-space:nowrap',
        `top:${Math.max(0, top - 19)}px;left:${Math.max(0, left)}px`,
        'padding:2px 7px;border-radius:5px',
        'background:#0f1722;color:#e8f3ff',
        'border:1px solid #39a8a2',
        'font:700 10px/1.2 ui-monospace,Menlo,monospace;letter-spacing:0.3px',
        'box-shadow:0 2px 8px rgba(0,0,0,0.35)'
      ].join(';');
      badge.textContent = labelText;
      instanceOverlayNodes.push(badge);
      document.body.appendChild(badge);
    }
  }

  function highlightColorInstances(targetHex) {
    clearInstanceOverlay();
    const hex = normalizeHex(targetHex);
    if (!hex) return { count: 0 };
    const props = ['color', 'background-color', 'border-top-color', 'border-bottom-color', 'fill', 'stroke'];
    const elements = Array.from(document.querySelectorAll('body *')).slice(0, 4000);
    let count = 0;
    let firstEl = null;
    for (const el of elements) {
      if (count >= 120) break;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let hit = false;
      for (const prop of props) {
        if (parseColor(cs.getPropertyValue(prop)) === hex) { hit = true; break; }
      }
      if (!hit) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (!firstEl) firstEl = el;
      drawInstanceBox(rect, count === 0 ? hex : null);
      count += 1;
    }
    if (firstEl) {
      try { firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    }
    if (count > 0) showInstanceClearPill(count);
    return { count };
  }

  function highlightFontInstances(target) {
    clearInstanceOverlay();
    const family = (target && target.family ? String(target.family) : '').toLowerCase();
    const sizePx = target && target.size ? Math.round(parseFloat(target.size)) : null;
    const elements = Array.from(document.querySelectorAll('body *')).slice(0, 4000);
    let count = 0;
    let firstEl = null;
    for (const el of elements) {
      if (count >= 120) break;
      if (!(el.textContent || '').trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let match = true;
      if (family) {
        const ff = cleanFont(cs.fontFamily).toLowerCase();
        if (ff !== family) match = false;
      }
      if (match && sizePx) {
        if (Math.round(parseFloat(cs.fontSize)) !== sizePx) match = false;
      }
      if (!match) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      if (!firstEl) firstEl = el;
      drawInstanceBox(rect, count === 0 ? (target.label || family || `${sizePx}px`) : null);
      count += 1;
    }
    if (firstEl) {
      try { firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    }
    if (count > 0) showInstanceClearPill(count);
    return { count };
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
    if (msg && msg.type === 'EXTRACT_ASSETS') {
      try {
        sendResponse({ ok: true, assets: extractAssets() });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Asset scan failed' });
      }
      return true;
    }
    if (msg && msg.type === 'HIGHLIGHT_COLOR') {
      try {
        const result = highlightColorInstances(msg.hex);
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not locate color' });
      }
      return true;
    }
    if (msg && msg.type === 'HIGHLIGHT_FONT') {
      try {
        const result = highlightFontInstances(msg.target || {});
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not locate type' });
      }
      return true;
    }
    if (msg && msg.type === 'CLEAR_INSTANCE_OVERLAY') {
      clearInstanceOverlay();
      sendResponse({ ok: true });
      return true;
    }
    if (msg && msg.type === 'ACTIVATE_INSPECT') {
      inspectSourceSurface = (msg.sourceSurface === 'sidepanel') ? 'sidepanel' : 'popup';
      activateHoverInspect();
      sendResponse({ ok: true });
      return true;
    }
    if (msg && msg.type === 'TOGGLE_WCAG_OVERLAY') {
      try {
        const result = toggleWcagOverlay();
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not toggle overlay' });
      }
      return true;
    }
    if (msg && msg.type === 'OPEN_EYEDROPPER') {
      pickColorWithEyeDropper()
        .then(result => sendResponse(result))
        .catch(() => sendResponse({ ok: false, error: 'Could not start color picker' }));
      return true;
    }
    if (msg && msg.type === 'SET_COLOR_BLIND_MODE') {
      try {
        const result = setColorBlindMode(msg.mode || 'off');
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not apply color-blind simulation' });
      }
      return true;
    }
    if (msg && msg.type === 'TOGGLE_MEASURE_MODE') {
      try {
        const result = toggleMeasureMode(msg.enabled);
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not toggle measure mode' });
      }
      return true;
    }
    if (msg && msg.type === 'TOGGLE_LAYOUT_OVERLAY') {
      try {
        const result = toggleLayoutOverlay(msg.enabled);
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not toggle layout overlay' });
      }
      return true;
    }
    if (msg && msg.type === 'APPLY_VAR_PREVIEW') {
      try {
        const vars = msg.vars || {};
        const varCount = Object.keys(vars).filter(k => k.startsWith('--')).length;
        const varResult = varCount > 0 ? applyVarPreview(vars) : { applied: 0, overlap: 0, changed: 0 };

        // Decide which mode to use.
        // HIGH VAR OVERLAP (≥5 shared names): the page and snapshot share CSS variable names,
        // so variable-override alone is sufficient and accurate.
        // Injecting Smart Apply CSS on top would cause conflicts (two different color values
        // fighting for the same property, creating the inconsistency the user sees).
        // CROSS-SITE / LOW OVERLAP: use Smart Apply CSS as the only meaningful mechanism.
        const highVarOverlap = varResult.overlap >= 5;
        const varImpactPct = varCount > 0 ? Math.round((varResult.changed / varCount) * 100) : 0;
        const smartResult = highVarOverlap
          ? { ok: varResult.changed > 0,
              tokenRolePct: Math.max(1, varImpactPct),
              pageCoveragePct: Math.min(95, Math.max(5, varResult.overlap * 7)),
              matchedElements: varResult.overlap,
              totalElements: Math.max(1, varCount) }
          : applySmartPreview(msg.snapshotTokens || {});
        const cssFramework = (!highVarOverlap && smartResult.ok) ? detectCssFramework() : null;

        const hasVarImpact   = varResult.changed > 0;
        const hasSmartImpact = smartResult.ok && (smartResult.pageCoveragePct || 0) >= 5;

        if (!hasVarImpact && !hasSmartImpact) {
          revertVarPreview();
          if (varCount === 0 && (!smartResult.ok || smartResult.reason === 'NO_COLOR_TOKENS')) {
            sendResponse({ ok: true, applied: 0, noStyleSource: true });
            return true;
          }
          if (varCount > 0 && varResult.overlap === 0 && (!smartResult.ok || smartResult.reason === 'NO_COLOR_TOKENS')) {
            sendResponse({ ok: true, applied: 0, noMatchingVars: true, incoming: varCount });
            return true;
          }
          sendResponse({
            ok: true, applied: 0, noVisibleChange: true,
            overlap: varResult.overlap, incoming: varCount,
            pageCoveragePct: smartResult.pageCoveragePct || 0
          });
          return true;
        }

        const tokenAppliedPct = highVarOverlap
          ? Math.max(1, Math.min(100, varImpactPct))
          : Math.max(1, Math.min(100, Math.round(
              (Number(smartResult.tokenRolePct || 0) * 0.6)
              + (Number(varImpactPct || 0) * 0.2)
              + (Number(smartResult.pageCoveragePct || 0) * 0.2)
            )));

        const mode = highVarOverlap ? 'vars' : 'semantic';
        showPreviewPill(msg.snapshotName || 'snapshot', `${tokenAppliedPct}% applied`);
        sendResponse({
          ok: true,
          applied: varResult.applied,
          overlap: varResult.overlap,
          changed: varResult.changed,
          incoming: varCount,
          tokenAppliedPct,
          pageCoveragePct: smartResult.pageCoveragePct || 0,
          matchedElements: smartResult.matchedElements || 0,
          totalElements: smartResult.totalElements || 0,
          cssFramework,
          mode
        });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not apply preview' });
      }
      return true;
    }
    if (msg && msg.type === 'REVERT_VAR_PREVIEW') {
      try {
        revertVarPreview();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not revert preview' });
      }
      return true;
    }
    return false;
  });
})();
