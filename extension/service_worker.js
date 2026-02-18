// Use same API as options page: Firefox = browser, Chrome = chrome
const ext = (typeof browser !== "undefined" && browser.storage) ? browser : chrome;

async function getApiConfig() {
  const obj = await ext.storage.local.get(["supabaseUrl", "supabaseToken"]);
  const url = (obj.supabaseUrl || "").trim().replace(/\/$/, "");
  const token = obj.supabaseToken || null;
  const apiBase = url ? `${url}/functions/v1` : null;
  return { apiBase, token };
}

const DEBUG = true; // set to false to quiet logs

// Log token status when background starts (and optionally on first send)
let tokenCheckLogged = false;
async function logTokenStatus() {
  if (!DEBUG || tokenCheckLogged) return;
  const { apiBase, token } = await getApiConfig();
  tokenCheckLogged = true;
  if (apiBase && token) {
    console.log("[Browser Memory] API and token set – ready to send events.");
  } else {
    console.log("[Browser Memory] Open extension Options, set Supabase URL and paste token, then Save.");
  }
}

async function sendEvent(payload) {
  const { apiBase, token } = await getApiConfig();
  await logTokenStatus();
  if (!apiBase || !token) {
    if (DEBUG) console.log("[Browser Memory] No Supabase URL or token – open extension Options and set both.");
    return;
  }

  try {
    const res = await fetch(`${apiBase}/ingest-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (DEBUG) {
      const status = res.ok ? "ok" : res.status;
      console.log("[Browser Memory] Sent", payload.type, payload.url || "", "→", status);
    }
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401 && DEBUG) {
        console.warn("[Browser Memory] Backend error: 401 – token may have expired. Open the app and click 'Send URL & token to extension' again.");
        ext.storage.local.set({ tokenNeedsRefresh: true });
      }
      if (DEBUG && res.status !== 401) console.warn("[Browser Memory] Backend error:", res.status, text);
    } else {
      ext.storage.local.remove("tokenNeedsRefresh");
    }
  } catch (e) {
    if (DEBUG) console.warn("[Browser Memory] Send failed (is backend running on :8000?):", e.message);
  }
}

// Tab activated
ext.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await ext.tabs.get(tabId);
  if (!tab?.url) return;

  sendEvent({
    type: "tab_activated",
    url: tab.url,
    title: tab.title || null,
    metadata: { tabId }
  });
});

// Tab updated (URL/title changes)
ext.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab?.url) return;

  sendEvent({
    type: "tab_updated",
    url: tab.url,
    title: tab.title || null,
    metadata: { tabId }
  });
});

// Receive events from content script
ext.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg?.kind === "event") {
    sendEvent(msg.payload);
  }
});
