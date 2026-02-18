# GitHub Pages setup for Browser Memory Store

Follow these steps to host the frontend on GitHub Pages.

---

## 1. Create the GitHub repo

1. On GitHub, click **New repository**.
2. Name it (e.g. **browser-memory**). Don’t add a README, .gitignore, or license (you already have them).
3. Create the repository.

---

## 2. Push your code

From your project folder (e.g. `browser-memory`):

```bash
cd /path/to/browser-memory
git remote add origin https://github.com/YOUR_USERNAME/browser-memory.git
git branch -M main
git push -u origin main
```

(If the repo was already initialized and committed, only add the remote and push.)

---

## 3. Turn on GitHub Pages

1. Open the repo on GitHub.
2. Go to **Settings** → **Pages** (left sidebar).
3. Under **Build and deployment**:
   - **Source:** choose **GitHub Actions**.

After the next successful deploy, the site will be at:

**`https://YOUR_USERNAME.github.io/browser-memory/`**

---

## 4. Trigger the first deploy

- **Option A:** Push any commit to `main` (e.g. a small change or empty commit: `git commit --allow-empty -m "Trigger Pages deploy" && git push`).
- **Option B:** Go to **Actions** → **Deploy to GitHub Pages** → **Run workflow** → **Run workflow** (green button). This runs the workflow even if push didn’t trigger it.

Wait for the workflow to finish. Then open **Settings** → **Pages** again; the URL will be shown at the top when the deployment is ready.

### If the workflow didn’t run on push

1. **Enable Pages from Actions:** **Settings** → **Pages** → **Build and deployment** → **Source:** **GitHub Actions**. (If this wasn’t set, the workflow may not appear or deploy may fail.)
2. **Run it manually:** **Actions** tab → **Deploy to GitHub Pages** (left sidebar) → **Run workflow** → choose branch **main** → **Run workflow**.
3. **Check the default branch:** The workflow file must be on your repo’s default branch (usually `main`). If your default is `master`, either change it under **Settings** → **General** or change the workflow trigger to `branches: ["master"]`.
4. **Confirm the workflow file is on GitHub:** **Actions** → you should see “Deploy to GitHub Pages” in the list. If not, push again: `git push origin main`.

---

## 5. (Optional) Use your own Supabase project

By default the built site shows **“Not configured”** until it has Supabase env. To point it at your project:

1. In the repo: **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** for each:
   - **Name:** `NEXT_PUBLIC_SUPABASE_URL`  
     **Value:** your project URL, e.g. `https://xxxx.supabase.co`
   - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
     **Value:** your project’s anon/public key (from Supabase → Project settings → API).

3. Re-run the workflow: **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

The next deployment will use these secrets and the app will talk to your Supabase project (Auth + Edge Functions). Users can sign in and use the app at `https://YOUR_USERNAME.github.io/browser-memory/`.

---

## Troubleshooting

| Issue | What to do |
|--------|------------|
| 404 on the site | Wait a minute after the workflow finishes; refresh. Check **Settings** → **Pages** for the correct URL (including repo name). |
| “Not configured” on the live site | Expected if you didn’t set repo secrets. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (step 5) and re-run the workflow. |
| Build fails (e.g. “package-lock.json”) | Run `npm install` in the `frontend/` folder locally, commit `package-lock.json`, and push. |
| Blank or broken assets | The workflow sets `NEXT_PUBLIC_BASE_PATH` to the repo name so assets load under `.../browser-memory/`. If the repo has a different name, the workflow already uses `github.event.repository.name`. |

---

## Summary

1. Create repo → push code → **Settings** → **Pages** → Source: **GitHub Actions**.
2. Deploy: push to `main` or run the “Deploy to GitHub Pages” workflow.
3. Optional: add Supabase URL and anon key as repo secrets and re-run the workflow for a working app.
