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
  const obj = await ext.storage.local.get(["supabaseUrl", "supabaseToken"]);
  supabaseUrlEl.value = obj.supabaseUrl || "";
  const supabaseToken = obj.supabaseToken;
  tokenEl.value = supabaseToken || "";
  if (supabaseToken && obj.supabaseUrl) {
    const len = supabaseToken.length;
    const preview = len > 20 ? supabaseToken.slice(0, 10) + "…" + supabaseToken.slice(-6) : "(short)";
    showStatus(`Loaded: token in storage (length ${len}). Preview: ${preview}`);
    console.log("[Browser Memory Options] Token loaded from storage, length:", len);
  } else {
    showStatus("Enter Supabase URL and paste your token above, then click Save.");
    console.log("[Browser Memory Options] No URL/token in storage.");
  }
}
load();

document.getElementById("save").addEventListener("click", async () => {
  const supabaseUrl = supabaseUrlEl.value.trim().replace(/\/$/, "");
  const token = tokenEl.value.trim();
  if (!supabaseUrl) {
    showStatus("Enter your Supabase project URL first.", true);
    return;
  }
  if (!token) {
    showStatus("Paste a token, then click Save.", true);
    return;
  }
  try {
    await ext.storage.local.set({ supabaseUrl, supabaseToken: token });
  } catch (e) {
    showStatus("Storage set failed: " + e.message, true);
    console.error("[Browser Memory Options] storage.local.set error:", e);
    return;
  }
  // Verify it was stored (read back)
  let obj2;
  try {
    obj2 = await ext.storage.local.get(["supabaseToken"]);
  } catch (e) {
    showStatus("Storage get failed: " + e.message, true);
    console.error("[Browser Memory Options] storage.local.get error:", e);
    return;
  }
  const supabaseToken = obj2 && obj2.supabaseToken;
  console.log("[Browser Memory Options] After save, get returned:", typeof obj2, obj2 ? Object.keys(obj2) : "n/a", "supabaseToken length:", supabaseToken ? supabaseToken.length : "missing");
  const storedUrl = obj2 && obj2.supabaseUrl;
  if (supabaseToken === token && storedUrl === supabaseUrl) {
    showStatus(`Saved. API: ${supabaseUrl}/functions/v1 — Reload the extension, then switch tabs to test.`);
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
