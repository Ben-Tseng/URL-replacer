const api = typeof browser !== "undefined" ? browser : chrome;
const DEFAULT_CONFIG = {
  urlTemplate: "",
  replaceToken: ""
};

const MENU_ID = "open-replaced-url";

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

async function handleContextMenuClick(info, tab) {
  const config = await getConfig();
  if (!config.urlTemplate || !config.replaceToken) return;

  const selection = (info.selectionText || "").trim();
  const value = selection || (await promptInputInPage(tab.id, config.replaceToken));
  const targetUrl = buildTargetUrl(config.urlTemplate, config.replaceToken, value);

  if (!targetUrl) return;
  await api.tabs.create({ url: targetUrl });
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
