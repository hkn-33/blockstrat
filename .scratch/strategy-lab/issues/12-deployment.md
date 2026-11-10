# 12: Deployment

**What to build:** The app is live at a public link anyone can open. Frontend on Vercel, backend on the user's VPS behind HTTPS.

**Blocked by:** 01

**Status:** ready-for-human

- [ ] Backend runs on the VPS via Docker Compose with Caddy providing automatic HTTPS
- [x] Parquet data cache persists across container restarts
- [ ] Frontend deployed to Vercel, pointing at the backend's HTTPS URL via configuration
- [x] CORS on the backend allows only the frontend's origin
- [x] Secrets (Gemini key) supplied through environment variables, never committed
- [x] Deployment steps documented in the repo; steps that need the user's own accounts (Vercel, VPS, DNS) are listed for the user to perform

## Comments

Docker image build NOT verified: Docker Desktop was not running on the dev machine. `nuxt generate` verified. Steps needing the user's accounts are in docs/deployment.md.

Config files (Dockerfile, deploy/docker-compose.yml, Caddyfile, .env.example) are ready; the actual deployment needs the user's VPS, DNS and Vercel accounts. Status stays open until deployed.
