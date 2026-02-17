# Browser Memory Store

A **searchable, self-updating memory store** for personalized browser agent behavior: capture browser interactions, store raw events in Supabase, summarize them into memories, and search over memories.

---

## Git and GitHub Pages (for others to use)

### Push to GitHub

```bash
cd browser-memory
git init
git add .
git commit -m "Initial commit: Browser Memory Store"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/browser-memory.git
git push -u origin main
```

### Enable GitHub Pages

1. On GitHub: **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. On the next push to `main`, the workflow will build the frontend (static export) and deploy it.
4. Your app will be live at **`https://YOUR_USERNAME.github.io/browser-memory/`**.

The deployed site shows a **“Not configured”** message until someone runs their own Supabase + backend (see below). To get a fully working instance, fork the repo and follow **For others to use** below.

### For others to use (full instance)

1. **Fork** (or clone) this repo.
2. **Supabase:** Create a project, run `supabase/schema.sql`, enable Auth, copy URL + anon key.
3. **Backend:** Deploy the `backend/` to [Render](https://render.com), [Railway](https://railway.app), or [Fly.io](https://fly.io), and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Add the frontend and extension origins to CORS (e.g. your GitHub Pages URL and `chrome-extension://*`, `moz-extension://*`).
4. **Frontend:** In the repo, set (e.g. in GitHub Actions or your own deploy):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_BASE` = your backend URL
   Then build and deploy (or re-run the GitHub Actions workflow with these as secrets).
5. **Extension:** Load the `extension/` folder in Chrome or Firefox, then paste a Supabase access token from the frontend (after signing in).

---

## Stack

- **Supabase** – Auth, Postgres (events + memories), RLS, FTS
- **FastAPI** – Ingest events, run summarizer, search API
- **Next.js** – Login, search UI, “Summarize last 20m”, **workflow graph** (actionable flow from events)
- **Browser extension (Chrome & Firefox, MV3)** – Capture tabs, clicks, form interactions; send to backend with Supabase token

## Repo structure

```
browser-memory/
  backend/          # FastAPI
  frontend/         # Next.js App Router
  extension/        # Chrome & Firefox extension
  supabase/         # schema.sql
```

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the contents of **`supabase/schema.sql`** (tables, indexes, RLS, FTS, and `search_memories` RPC).
3. In Authentication → Providers, enable Email (or your chosen provider).
4. Create a user (or use signup from the frontend).
5. In Project Settings → API, copy **Project URL** and **anon public** key.

## 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_ANON_KEY, optionally FRONTEND_ORIGIN
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- **Health:** [http://localhost:8000/health](http://localhost:8000/health)

## 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_BASE
npm i
npm run dev
```

- Open [http://localhost:3000](http://localhost:3000), sign in with your Supabase user.
- Use **“Copy token for extension”** and paste that token into the extension Options (see below).

## 4. Browser extension (Chrome or Firefox)

The same extension works in both. Use your Supabase access token from the frontend (“Copy token for extension” button).

### Chrome

1. Open **chrome://extensions**.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the **`extension/`** folder.
4. Open the extension **Options** (Details → Extension options, or right‑click → Options).
5. Paste your token and click **Save**.

### Firefox

1. Open **about:debugging** in the address bar.
2. Click **This Firefox** (left sidebar).
3. Click **Load Temporary Add-on…**.
4. In the file picker, go to **`browser-memory/extension`** and select **`manifest.json`** (the file, not the folder).
5. The add-on loads temporarily. Click **Preferences** (or the extension’s options) to open the options page.
6. Paste your token and click **Save**.

**Note:** In Firefox, the add-on is temporary and will be removed when you close the browser. Reload it from **about:debugging** when you need it again.

The extension will send tab and click/form events to `http://localhost:8000` when the backend is running.

## 5. MVP demo flow

1. Run Supabase (cloud), backend (8000), and frontend (3000).
2. Apply **`supabase/schema.sql`** in the Supabase SQL editor.
3. Sign in on the frontend.
4. Copy token → paste in extension Options → Save.
5. Browse (switch tabs, click, change inputs); extension sends events to the backend.
6. In the frontend, click **“Summarize last 20m”** to turn recent events into memories.
7. Use the search box to **search memories** (FTS when `search_memories` RPC is present, otherwise `ilike` fallback).

## API (backend)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/ingest/event` | Ingest one event (body: `EventIn`) |
| POST | `/ingest/batch` | Ingest many events (body: `BatchIn`) |
| POST | `/summarize/run` | Summarize last N minutes (body: `SummarizeIn`, default 20) |
| GET | `/search?q=...&limit=20` | Full-text search over memories |
| GET | `/recent/memories?limit=50` | Recent memories |
| GET | `/recent/events?limit=100` | Recent raw events |
| GET | `/workflow/graph?limit=500` | Workflow graph (nodes = hosts, edges = transitions) |
| GET | `/recent/events?limit=100&host=example.com` | Recent events, optional filter by host |
| GET | `/analytics/charts?limit=1000` | Chart data: by_type, by_host, over_time |

All except `/health` require **Authorization: Bearer &lt;Supabase access token&gt;** so RLS applies per user.

## Next steps (after MVP)

- Replace rule-based summarizer with an LLM (e.g. OpenAI).
- Add `pgvector` and embeddings for semantic search.
- Add a “memory retrieval policy” (recent + relevant + domain).
- Self-updating cron: Supabase Edge Function or backend cron to run summarization on a schedule.
