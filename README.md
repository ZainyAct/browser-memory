# Browser Memory Store

A **searchable, self-updating memory store** for personalized browser agent behavior: capture browser interactions, store raw events in Supabase, summarize them into memories, and search over memories. **Backend runs entirely on Supabase Edge Functions** (no local server).

---

## Stack

- **Supabase** – Auth, Postgres (events + memories), RLS, FTS, **Edge Functions** (ingest, summarize, search, workflow, analytics)
- **Next.js** – Login, search UI, “Summarize last 20m”, workflow graph, analytics charts
- **Browser extension (Chrome & Firefox)** – Capture tabs, clicks, form interactions; send to Edge Functions with Supabase token

## Repo structure

```
browser-memory/
  supabase/
    schema.sql              # Tables, RLS, FTS, search_memories RPC
    functions/              # Edge Functions (Deno)
      _shared/              # CORS, auth, summarizer, workflow, analytics
      ingest-event/
      ingest-batch/
      summarize-run/
      search/
      recent-memories/
      recent-events/
      workflow-graph/
      analytics-charts/
  frontend/                 # Next.js App Router
  extension/                # Chrome & Firefox extension
  backend/                  # Legacy FastAPI (optional; Edge Functions replace this)
```

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the contents of **`supabase/schema.sql`** (tables, indexes, RLS, FTS, and `search_memories` RPC).
3. In **Authentication** → **Providers**, enable Email (or your chosen provider).
4. Create a user (or sign up from the frontend later).
5. In **Project Settings** → **API**, copy **Project URL** and **anon public** key.

---

## 2. Deploy Edge Functions

Install [Supabase CLI](https://supabase.com/docs/guides/cli) and link your project:

```bash
cd browser-memory
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

Deploy all functions:

```bash
npx supabase functions deploy ingest-event
npx supabase functions deploy ingest-batch
npx supabase functions deploy summarize-run
npx supabase functions deploy search
npx supabase functions deploy recent-memories
npx supabase functions deploy recent-events
npx supabase functions deploy workflow-graph
npx supabase functions deploy analytics-charts
```

Or deploy in one go (if your CLI supports it):

```bash
npx supabase functions deploy
```

Functions will be available at `https://YOUR_PROJECT_REF.supabase.co/functions/v1/<function-name>`.

---

## 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# (No NEXT_PUBLIC_API_BASE needed – frontend uses SUPABASE_URL/functions/v1 by default)
npm i
npm run dev
```

- Open [http://localhost:3000](http://localhost:3000), sign in with your Supabase user.
- Use **“Copy token for extension”** and paste that token (and your Supabase URL) into the extension Options.

---

## 4. Browser extension (Chrome or Firefox)

1. **Chrome:** `chrome://extensions` → Developer mode → **Load unpacked** → select **`extension/`**.
2. **Firefox:** `about:debugging` → This Firefox → **Load Temporary Add-on** → select **`extension/manifest.json`**.

Then open the extension **Options** and set:

- **Supabase project URL** – e.g. `https://xxxx.supabase.co`
- **Supabase access token** – from the frontend (“Copy token for extension” after signing in).

Click **Save**, then reload the extension. Events will be sent to `https://xxxx.supabase.co/functions/v1/ingest-event`.

---

## 5. Demo flow

1. Supabase: schema applied, Edge Functions deployed.
2. Frontend: `.env.local` with Supabase URL + anon key, `npm run dev`.
3. Sign in on the frontend → Copy token for extension.
4. Extension: Options → paste Supabase URL and token → Save.
5. Browse (switch tabs, click, change inputs); extension sends events to Edge Functions.
6. In the frontend, click **“Summarize last 20m”** to create memories.
7. Use **Search**, **Recent memories**, **Recent events**, **Workflow graph**, and **Analytics** tabs.

---

## API (Edge Functions)

All at `https://YOUR_PROJECT.supabase.co/functions/v1/<name>`. All require **Authorization: Bearer &lt;Supabase access token&gt;** (RLS applies per user).

| Method | Function | Description |
|--------|----------|-------------|
| POST | `ingest-event` | Ingest one event (body: type, url, title, text_content, selector, metadata) |
| POST | `ingest-batch` | Ingest many events (body: { events: [...] }) |
| POST | `summarize-run` | Summarize last N minutes (body: { minutes: 20 }) |
| GET | `search?q=...&limit=20` | Full-text search over memories |
| GET | `recent-memories?limit=50` | Recent memories |
| GET | `recent-events?limit=100&host=...` | Recent events, optional host filter |
| GET | `workflow-graph?limit=500` | Workflow graph (nodes = hosts, edges = transitions) |
| GET | `analytics-charts?limit=1000` | Chart data: by_type, by_host, over_time |

---

## Git and GitHub Pages

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

1. Repo **Settings** → **Pages** → **Source**: **GitHub Actions**.
2. After the next push, the frontend is at **`https://YOUR_USERNAME.github.io/browser-memory/`**.

The deployed site shows “Not configured” until `NEXT_PUBLIC_SUPABASE_URL` (and anon key) are set for that build (e.g. via GitHub Actions secrets).

### For others to use (full instance)

1. **Fork** the repo.
2. **Supabase:** Create a project, run `supabase/schema.sql`, enable Auth, deploy Edge Functions (step 2 above), copy URL + anon key.
3. **Frontend:** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e.g. in GitHub Actions secrets or your host), then build and deploy.
4. **Extension:** Load `extension/`, set Supabase URL and token in Options.

No separate backend server is required.

---

## Optional: legacy Python backend

The **`backend/`** folder contains the original FastAPI app. It is **optional**; Edge Functions replace it. To run it locally instead of Edge Functions:

- Start the backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
- Set **`NEXT_PUBLIC_API_BASE=http://localhost:8000`** in the frontend so it calls the local API instead of Edge Functions.
- In the extension, set the API base to `http://localhost:8000` (you’d need to add an “API base” field; currently the extension only supports Supabase URL → `/functions/v1`).

---

## Next steps

- Replace rule-based summarizer with an LLM (e.g. OpenAI) inside the `summarize-run` Edge Function.
- Add `pgvector` and embeddings for semantic search.
- Add a scheduled Edge Function or cron to run summarization periodically.
