// background.js - Palext background worker
// Keeps inspect capture aligned with the currently open UI surface.

const uiPorts = {
  popup: new Set(),
  sidepanel: new Set()
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'palext-popup' && port.name !== 'palext-sidepanel') return;
  const surface = port.name === 'palext-sidepanel' ? 'sidepanel' : 'popup';
  uiPorts[surface].add(port);
  port.onDisconnect.addListener(() => uiPorts[surface].delete(port));
});

async function getActiveTabInCurrentWindow() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  }
  return tab || null;
}

async function openPalextSidePanel() {
  if (!chrome.sidePanel) {
    return { ok: false, error: 'This browser does not support the Chrome Side Panel API.' };
  }

  const tab = await getActiveTabInCurrentWindow();
  if (!tab || !tab.id || !tab.windowId) {
    return { ok: false, error: 'Open any normal website tab, then try again.' };
  }

  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: 'sidepanel.html',
    enabled: true
  });
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    return { ok: true, message: 'Palext opened in the side panel.' };
  } catch (_) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    return { ok: true, message: 'Palext opened in the side panel.' };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return false;

  if (msg.type === 'OPEN_SIDE_PANEL') {
    (async () => {
      try {
        sendResponse(await openPalextSidePanel());
      } catch (e) {
        sendResponse({ ok: false, error: e && e.message ? e.message : 'Could not open side panel.' });
      }
    })();
    return true;
  }

  if (msg.type !== 'INSPECT_CAPTURED') return false;

  (async () => {
    try {
      if (msg.sourceSurface === 'sidepanel') {
        chrome.runtime.sendMessage({ type: 'PAL_EXT_INSPECT_CAPTURED' }, () => {
          void chrome.runtime.lastError;
        });
        sendResponse({ ok: true, reopened: false, surface: 'sidepanel' });
        return;
      }

      if (uiPorts.sidepanel.size > 0) {
        chrome.runtime.sendMessage({ type: 'PAL_EXT_INSPECT_CAPTURED' }, () => {
          void chrome.runtime.lastError;
        });
        sendResponse({ ok: true, reopened: false, surface: 'sidepanel' });
        return;
      }

      if (chrome.action && chrome.action.openPopup) {
        await chrome.action.openPopup();
        sendResponse({ ok: true, reopened: true, surface: 'popup' });
        return;
      }

      await chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 430,
        height: 650
      });
      sendResponse({ ok: true, reopened: true, surface: 'popup' });
    } catch (_) {
      sendResponse({ ok: false, reopened: false });
    }
  })();

  return true;
});
