const API_BASE = "http://localhost:8000";

// Use same API as options page: Firefox = browser, Chrome = chrome
const ext = (typeof browser !== "undefined" && browser.storage) ? browser : chrome;

async function getToken() {
  const obj = await ext.storage.local.get(["supabaseToken"]);
  const supabaseToken = obj && obj.supabaseToken;
  return supabaseToken || null;
}

const DEBUG = true; // set to false to quiet logs

// Log token status when background starts (and optionally on first send)
let tokenCheckLogged = false;
async function logTokenStatus() {
  if (!DEBUG || tokenCheckLogged) return;
  const token = await getToken();
  tokenCheckLogged = true;
  if (token) {
    console.log("[Browser Memory] Token in storage: yes, length", token.length, "– ready to send events.");
  } else {
    console.log("[Browser Memory] Token in storage: NO. Open extension Options, paste your Supabase token, click Save.");
  }
}

async function sendEvent(payload) {
  const token = await getToken();
  await logTokenStatus();
  if (!token) {
    if (DEBUG) console.log("[Browser Memory] No token – open extension Options and paste your Supabase token.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/ingest/event`, {
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
    if (!res.ok && DEBUG) console.warn("[Browser Memory] Backend error:", res.status, await res.text());
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
