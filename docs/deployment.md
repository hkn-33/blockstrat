# Deployment

The backend (FastAPI, `backend/`) runs on a VPS under [Coolify](https://coolify.io), which builds it from the repository's Dockerfile and puts it behind HTTPS. The frontend (Nuxt, `frontend/`) runs on Vercel. The browser loads the site from Vercel and calls the API on its own domain; the API answers only the site's origins, and the Groq key never leaves the backend.

```
browser ──► https://blockstrat.example.com   (Vercel: the Nuxt site)
   │
   └──────► https://api.example.com          (Coolify on the VPS: Traefik ─► the backend container)
                                                  └─► Groq, Binance
```

Steps that need your own accounts are marked **(you)**.

## 1. Backend on Coolify

1. **(you)** Install Coolify on the VPS (Ubuntu or Debian, 2 GB RAM or more), as root:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
   Open `http://<VPS IP>:8000`, create the admin account, and keep ports 80 and 443 open in the firewall.
2. **(you)** Point a domain at the VPS: a DNS `A` record such as `api.example.com` → the VPS IP.
3. **(you)** In Coolify: **Projects → New → Add Resource → Application**, then the repository. For a private repository either connect GitHub with **GitHub App**, or pick **Private Repository (with Deploy Key)**: add the key's public half under the repository's **Settings → Deploy keys** (read-only) and use the SSH address `git@github.com:<owner>/<repo>.git`. Deploys on push to `main`, see step 4.
4. Settings of the application:
   - **Branch**: `main`
   - **Build Pack**: `Dockerfile`
   - **Base Directory**: `/backend`
   - **Dockerfile Location**: `/Dockerfile`
   - **Ports Exposes**: `8000`
   - **Domains**: `https://api.example.com` (Coolify's proxy gets and renews the HTTPS certificate). Without a domain
     of your own, use the free address Coolify generates (`…sslip.io`), changed to start with `https://`: the site on
     Vercel is HTTPS, and browsers block its calls to a plain `http://` API.
5. **Environment Variables** (Developer view accepts the whole list at once). Leave **Build Variable** unticked: these are needed only when the app runs.
   ```
   GROQ_API_KEY=<your key from console.groq.com/keys>
   FRONTEND_ORIGINS=https://blockstrat.example.com,https://blockstrat.vercel.app
   ```
   `FRONTEND_ORIGINS` is filled in properly in step 3 below, once the Vercel address is known. Everything else has a
   default and is optional: `GROQ_MODEL` (default `openai/gpt-oss-120b`), `AI_REQUESTS_PER_IP_PER_HOUR` (10),
   `AI_REQUESTS_PER_DAY` (200), `BACKTESTS_PER_IP_PER_HOUR` (1500), `SEARCHES_PER_IP_PER_HOUR` (30),
   `CHARTS_PER_IP_PER_HOUR` (300); set one only to change it without a new release.
6. **Persistent Storage → Add → Volume**: destination path `/data`. The price history from Binance is cached there and survives redeploys. Use a volume, not a bind mount: the container runs as a non-root user that owns `/data` in the image, and a new volume keeps that owner.
7. **Health Check**: path `/api/instruments`, port `8000`.
8. **Deploy**. When it is up, `https://api.example.com/api/instruments` returns the list of markets. The first start downloads the Binance history in the background, about a minute.

## 2. Frontend on Vercel

1. **(you)** In Vercel: **Add New → Project**, import the same repository.
2. **Root Directory**: `frontend`. Vercel recognises Nuxt; keep its build settings.
3. **Environment Variables** (Production and Preview):
   ```
   NUXT_PUBLIC_API_BASE=https://api.example.com
   ```
   No trailing slash. The API key does not belong here: everything in the frontend is public.
4. **Deploy**, then add your own domain under **Settings → Domains** if you have one.

## 3. Make them talk to each other

1. In Coolify, set `FRONTEND_ORIGINS` to every address the site is opened from, exactly as the browser shows it (`https://`, no trailing slash, comma separated), for example `https://blockstrat.example.com,https://blockstrat.vercel.app`.
2. **Redeploy** the backend in Coolify (environment changes apply on the next deploy).
3. Check: open the site, open the browser's developer tools → **Network**, and load `/app`. Requests to `api.example.com/api/...` answer `200`.
   - A **CORS** error means the site's address is missing from `FRONTEND_ORIGINS` or differs from it (`www.`, `http` instead of `https`, a trailing slash).
   - **Failed to fetch** with nothing else: `NUXT_PUBLIC_API_BASE` is wrong, or the API is not up yet.
   - Vercel's preview deployments have their own addresses; add one to `FRONTEND_ORIGINS` to test it, or test on the production address.

## 4. Deploy on every push to `main`

- **Vercel** deploys `main` on its own once the repository is imported; other branches get preview deployments.
- **Coolify** with a **GitHub App** source deploys on push when **Auto Deploy** is on (the application's **Advanced**
  settings). With a **deploy key**, GitHub must also be told to call Coolify: in the application's **Webhooks**, copy
  the **GitHub** URL under **Manual Git Webhooks** and set a **GitHub Webhook Secret**; then on GitHub, under the
  repository's **Settings → Webhooks → Add webhook**, paste the URL, set **Content type** to `application/json`,
  enter the same secret, and keep **Just the push event**.

Nothing runs the tests before a deploy: run `uv run pytest` in `backend/` and `npm test` and `npm run typecheck` in
`frontend/` before pushing to `main`.

## What protects the backend

- **Limits per client address**, per hour, on every endpoint that costs the server work: backtests, strategy searches, charts and the AI, plus a daily total for the AI so the Groq quota cannot be used up. Over a limit the API answers `429` with `Retry-After`. The numbers are the variables above.
- **At most two strategy searches at once**; more get `503` and try again shortly.
- **Real client addresses**: the address is taken from the proxy's `X-Forwarded-For` only when the request comes from a private network, where Coolify's proxy runs, so a client cannot fake its address to dodge the limits (`FORWARDED_ALLOW_IPS` in the Dockerfile).
- **Request size** is capped at 256 KB, refused before it is read.
- **CORS** lets only the site's own origins call the API from a browser.
- **The AI** gets what users type as data, never as instructions; it can only answer with strategy JSON, which is validated, and never runs code. Provider errors are answered as "AI is resting", without details.
- **Logs**: no access log (it would keep visitors' addresses), no request bodies or prompts, no keys; an error logs only its kind and the path.
- **No public API docs** (`/docs`, `/openapi.json`); set `API_DOCS=1` only while developing.
- The container runs as a **non-root user**, and answers carry `nosniff`, `no-referrer` and `DENY` framing headers.

## Secrets

The Groq key lives only in Coolify's environment variables, and locally in `backend/.env`. Both are outside git (`.env` is git-ignored); never commit a key, never put it in a `NUXT_PUBLIC_` variable. If a key leaks, revoke it at console.groq.com/keys and set the new one in Coolify.
