# Deployment

The frontend is a static Nuxt SPA on Vercel. The backend runs on a VPS with Docker Compose; Caddy in front of it provides HTTPS automatically.

## Backend on the VPS

Steps that need your own accounts are marked **(you)**.

1. **(you)** Point a domain at the VPS: an `A` record such as `api.example.com` → the VPS IP. Ports 80 and 443 must be open.
2. **(you)** Install Docker with the Compose plugin on the VPS.
3. Copy the repository to the VPS (for example `git clone`).
4. Create the environment file and fill it in:
   ```bash
   cd deploy && cp .env.example .env
   ```
   Set `API_DOMAIN`, `FRONTEND_ORIGINS` (the Vercel URL from the next section) and, for the AI chat, `GEMINI_API_KEY`.
5. Start it:
   ```bash
   docker compose up -d --build
   ```
6. Check it: `https://<API_DOMAIN>/api/instruments` returns the instrument list. The first start downloads the Binance history in the background (about a minute); the price cache lives in the `market-data` volume and survives restarts and rebuilds.

Update after code changes:

```bash
git pull && cd deploy && docker compose up -d --build
```

## Frontend on Vercel

1. **(you)** Import the repository in Vercel and set **Root Directory** to `frontend`. Vercel detects Nuxt.
2. **(you)** Add the environment variable `NUXT_PUBLIC_API_BASE=https://<API_DOMAIN>`.
3. Deploy. Put the resulting URL (and any custom domain) into `FRONTEND_ORIGINS` on the VPS and restart the backend: `docker compose up -d`.

## Secrets

`deploy/.env` holds the Gemini key. It is git-ignored; never commit it. The frontend never sees the key: all AI calls go through the backend, which applies the per-IP and daily limits.
