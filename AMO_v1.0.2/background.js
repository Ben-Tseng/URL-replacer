const api = typeof browser !== "undefined" ? browser : chrome;
const DEFAULT_CONFIG = {
  urlTemplate: "",
  replaceToken: ""
};

const MENU_ID = "open-replaced-url";
const SHORTCUT_COMMAND_ID = "open-replaced-url-shortcut";

async function getConfig() {
  const stored = await api.storage.local.get(["urlTemplate", "replaceToken"]);
  return {
    urlTemplate: stored.urlTemplate || DEFAULT_CONFIG.urlTemplate,
    replaceToken: stored.replaceToken || DEFAULT_CONFIG.replaceToken
  };
}

function buildTargetUrl(urlTemplate, replaceToken, value) {
  const cleanValue = (value || "").trim();
  if (!cleanValue) return null;

  const encodedValue = encodeURIComponent(cleanValue);
  return urlTemplate.includes(replaceToken)
    ? urlTemplate.split(replaceToken).join(encodedValue)
    : urlTemplate;
}

async function promptInputInPage(tabId, replaceToken) {
  const promptMessage = `Enter replacement text (for example ${replaceToken}):`;
  const code = `(function(){var input=window.prompt(${JSON.stringify(promptMessage)},"");return input?input.trim():"";})()`;
  const results = await api.tabs.executeScript(tabId, { code });

  const first = results && results[0];
  if (typeof first === "string") return first;
  return first && typeof first.result === "string" ? first.result : "";
}

async function getSelectionFromPage(tabId) {
  const code = `(function(){
    try {
      var active = document.activeElement;
      if (active && (active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && /^(text|search|url|tel|password|email)$/i.test(active.type)))) {
        var start = typeof active.selectionStart === "number" ? active.selectionStart : 0;
        var end = typeof active.selectionEnd === "number" ? active.selectionEnd : 0;
        if (end > start) return active.value.slice(start, end).trim();
      }
      var selected = window.getSelection ? String(window.getSelection()) : "";
      return selected.trim();
    } catch (e) {
      return "";
    }
  })()`;
  try {
    // Read selection from all frames because focused text is often inside iframes.
    const results = await api.tabs.executeScript(tabId, { code, allFrames: true });
    if (!Array.isArray(results)) return "";
    for (const item of results) {
      if (typeof item === "string" && item.trim()) return item.trim();
    }
    // Fallback to top frame when allFrames returns empty.
    const topFrameResults = await api.tabs.executeScript(tabId, { code });
    const first = topFrameResults && topFrameResults[0];
    return typeof first === "string" ? first.trim() : "";
  } catch (e) {
    try {
      // If allFrames throws (host permission/frame restrictions), still try top frame.
      const topFrameResults = await api.tabs.executeScript(tabId, { code });
      const first = topFrameResults && topFrameResults[0];
      return typeof first === "string" ? first.trim() : "";
    } catch (e2) {
      return "";
    }
  }
}

async function getTextFromClipboard() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.readText) return "";
    const text = await navigator.clipboard.readText();
    return (text || "").trim();
  } catch (e) {
    return "";
  }
}

async function handleContextMenuClick(info, tab) {
  const config = await getConfig();
  if (!config.urlTemplate || !config.replaceToken) return;

  const selection = (info.selectionText || "").trim();
  const value = selection || (await promptInputInPage(tab.id, config.replaceToken));
  const targetUrl = buildTargetUrl(config.urlTemplate, config.replaceToken, value);

  if (!targetUrl) return;
  await api.tabs.create({ url: targetUrl });
}

async function handleShortcutCommand() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs && tabs[0];
  if (!activeTab || typeof activeTab.id !== "number") return;

  const selectionText = await getSelectionFromPage(activeTab.id);
  const fallbackClipboardText = selectionText ? "" : await getTextFromClipboard();
  await handleContextMenuClick({ selectionText: selectionText || fallbackClipboardText }, activeTab);
}

function createContextMenu() {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({
      id: MENU_ID,
      title: "Open replaced URL",
      contexts: ["page", "selection", "editable"]
    });
  });
}

api.runtime.onInstalled.addListener(createContextMenu);
api.runtime.onStartup.addListener(createContextMenu);

api.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || typeof tab.id !== "number") return;
  handleContextMenuClick(info, tab).catch(() => {});
});

api.commands.onCommand.addListener((command) => {
  if (command !== SHORTCUT_COMMAND_ID) return;
  handleShortcutCommand().catch(() => {});
});
