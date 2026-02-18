// Use same API in both options and background: Firefox = browser, Chrome = chrome
const ext = (typeof browser !== "undefined" && browser.storage) ? browser : chrome;

const supabaseUrlEl = document.getElementById("supabaseUrl");
const tokenEl = document.getElementById("token");
const statusEl = document.getElementById("status");

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#c00" : "#333";
}

async function load() {
  const obj = await ext.storage.local.get(["supabaseUrl", "supabaseToken", "tokenNeedsRefresh"]);
  supabaseUrlEl.value = obj.supabaseUrl || "";
  const supabaseToken = obj.supabaseToken;
  tokenEl.value = supabaseToken || "";
  if (obj.tokenNeedsRefresh) {
    showStatus("Your token may have expired (they last ~1 hour). Open the app, sign in, and click 'Send URL & token to extension' again, then Save here.", true);
  } else if (supabaseToken && obj.supabaseUrl) {
    const len = supabaseToken.length;
    const preview = len > 20 ? supabaseToken.slice(0, 10) + "…" + supabaseToken.slice(-6) : "(short)";
    showStatus(`Loaded: token in storage (length ${len}). Preview: ${preview}`);
    console.log("[Browser Memory Options] Token loaded from storage, length:", len);
  } else if (obj.supabaseUrl && !supabaseToken) {
    showStatus("URL set from app. Paste your token above, then click Save.");
  } else {
    showStatus("Paste your token and click Save — or open the app and click 'Send URL & token to extension' to set the URL automatically.");
    console.log("[Browser Memory Options] No URL/token in storage.");
  }
}
load();

document.getElementById("save").addEventListener("click", async () => {
  const token = tokenEl.value.trim();
  if (!token) {
    showStatus("Paste your token (or use 'Send URL & token' on the app first).", true);
    return;
  }
  const urlFromInput = supabaseUrlEl.value.trim().replace(/\/$/, "");
  const stored = await ext.storage.local.get(["supabaseUrl", "supabaseToken"]);
  const urlFromStorage = (stored && stored.supabaseUrl) || "";
  const supabaseUrl = urlFromInput || urlFromStorage;
  if (!supabaseUrl) {
    showStatus("Enter the Supabase project URL, or open the app and click 'Send URL & token to extension' to set it automatically.", true);
    return;
  }
  try {
    await ext.storage.local.set({ supabaseUrl, supabaseToken: token });
  } catch (e) {
    showStatus("Storage set failed: " + e.message, true);
    console.error("[Browser Memory Options] storage.local.set error:", e);
    return;
  }
  let obj2;
  try {
    obj2 = await ext.storage.local.get(["supabaseUrl", "supabaseToken"]);
  } catch (e) {
    showStatus("Storage get failed: " + e.message, true);
    console.error("[Browser Memory Options] storage.local.get error:", e);
    return;
  }
  const supabaseToken = obj2 && obj2.supabaseToken;
  const storedUrl = obj2 && obj2.supabaseUrl;
  if (supabaseToken === token && storedUrl === supabaseUrl) {
    await ext.storage.local.remove("tokenNeedsRefresh");
    showStatus(`Saved. API: ${supabaseUrl}/functions/v1 — Reload the extension, then switch tabs to test. Tokens expire ~1h; send again from the app if you get 401s.`);
    console.log("[Browser Memory Options] Token saved and verified, length:", token.length);
  } else {
    showStatus("Save verification failed – storage read back different. See console. Reload extension and try again.", true);
    console.warn("[Browser Memory Options] Save verification failed. Read back:", supabaseToken ? "length " + supabaseToken.length : "undefined", "expected length:", token.length);
  }
});

document.getElementById("clear").addEventListener("click", async () => {
  await ext.storage.local.remove(["supabaseUrl", "supabaseToken"]);
  supabaseUrlEl.value = "";
  tokenEl.value = "";
  const obj3 = await ext.storage.local.get(["supabaseUrl", "supabaseToken"]);
  showStatus(obj3?.supabaseToken ? "Clear may have failed." : "Cleared.");
  console.log("[Browser Memory Options] Cleared.");
});
