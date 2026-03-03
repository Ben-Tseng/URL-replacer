const api = typeof browser !== "undefined" ? browser : chrome;
const MAX_TEMPLATES = 10;

const replaceTokenInput = document.getElementById("replaceToken");
const templateList = document.getElementById("templateList");
const templateItem = document.getElementById("templateItem");
const addBtn = document.getElementById("addBtn");
const saveBtn = document.getElementById("saveBtn");
const statusText = document.getElementById("status");
let autoSaveTimer = null;

function showStatus(text) {
  statusText.textContent = text;
}

function getTemplateInputs() {
  return Array.from(templateList.querySelectorAll(".url-input"));
}

function collectUrlTemplates() {
  return getTemplateInputs().map((input) => input.value.trim()).filter(Boolean);
}

function scheduleAutoSaveTemplates() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    const urlTemplates = collectUrlTemplates().slice(0, MAX_TEMPLATES);
    await api.storage.local.set({ urlTemplates });
    showStatus("URL templates auto-saved.");
  }, 300);
}

function addTemplateRow(value = "") {
  if (getTemplateInputs().length >= MAX_TEMPLATES) {
    showStatus("You can add up to 10 URL templates.");
    return;
  }

  const node = templateItem.content.firstElementChild.cloneNode(true);
  const input = node.querySelector(".url-input");
  const removeBtn = node.querySelector(".remove-btn");
  input.value = value;
  input.addEventListener("input", () => {
    scheduleAutoSaveTemplates();
  });

  removeBtn.addEventListener("click", () => {
    node.remove();
    if (!getTemplateInputs().length) {
      addTemplateRow("");
    }
    scheduleAutoSaveTemplates();
  });

  templateList.appendChild(node);
}

async function loadConfig() {
  const stored = await api.storage.local.get(["urlTemplates", "replaceToken"]);
  const templates = Array.isArray(stored.urlTemplates)
    ? stored.urlTemplates.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean).slice(0, MAX_TEMPLATES)
    : [];

  replaceTokenInput.value = (stored.replaceToken || "").trim();
  templateList.innerHTML = "";

  if (!templates.length) {
    addTemplateRow("");
    return;
  }

  templates.forEach((template) => addTemplateRow(template));
}

async function saveConfig() {
  const replaceToken = replaceTokenInput.value.trim();
  const urlTemplates = collectUrlTemplates();

  if (!replaceToken) {
    showStatus("Replace token is required.");
    return;
  }

  if (!urlTemplates.length) {
    showStatus("At least one URL template is required.");
    return;
  }

  if (urlTemplates.length > MAX_TEMPLATES) {
    showStatus("You can save up to 10 URL templates.");
    return;
  }

  for (const template of urlTemplates) {
    if (!template.includes(replaceToken)) {
      showStatus("Save failed: every URL template must include the replace token.");
      return;
    }
  }

  await api.storage.local.set({ replaceToken, urlTemplates });
  showStatus("Saved.");
}

addBtn.addEventListener("click", () => addTemplateRow(""));
saveBtn.addEventListener("click", () => {
  saveConfig().catch(() => showStatus("Save failed."));
});

loadConfig().catch(() => showStatus("Failed to load settings."));
