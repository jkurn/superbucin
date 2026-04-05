## Deploy Configuration (configured by /setup-deploy)
- Platform: Render
- Production URL: https://superbucin.pricylia.com
- Deploy workflow: auto-deploy on push to main
- Deploy status command: HTTP health check
- Merge method: squash
- Project type: web app (Node.js + Socket.io WebSocket server)
- Post-deploy health check: https://superbucin.pricylia.com

### Custom deploy hooks
- Pre-merge: none
- Deploy trigger: automatic on push to main (Render GitHub integration)
- Deploy status: poll production URL
- Health check: https://superbucin.pricylia.com

### Project reference
- **Game / art inventory:** [ASSETS.md](./ASSETS.md) — local Kenney packs (`kenney_*/`, gitignored), 2D vs 3D, runtime asset paths. Use `@ASSETS.md` when adding or wiring art.

### Deploy Checklist
Before pushing to main (auto-deploys to Render):
- [ ] Render env vars match local `.env` — all 4 Supabase vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- [ ] CORS origins in `server/index.js` include `https://superbucin.pricylia.com`
- [ ] Supabase Auth redirect URLs include production domain (Supabase dashboard > Auth > URL Configuration)
- [ ] Render env group is linked to this web service
- [ ] Test on a real mobile phone (iOS Safari) before announcing to users
- [ ] Verify JS bundle contains Supabase URL: `curl -s https://superbucin.pricylia.com/assets/*.js | grep -o 'SUPABASE_URL\|supabase\.co'`
- [ ] Health check responds: `curl https://superbucin.pricylia.com/health`

### Pre-push Quality Checks
- [ ] Run `npm run lint` — must exit with 0 errors (warnings OK; **errors block commit via husky**)
- [ ] Run `npx vite build` in `client/` — verify zero errors
- [ ] Open preview on mobile viewport — check profile, lobby, game screens
- [ ] If adding a new game: verify `side` property (not `id`) in sideSelect options
- [ ] If adding a new external service: add env vars to BOTH `.env` AND Render dashboard

### Linting
- ESLint 9 configured in `eslint.config.js` (flat config)
- **Pre-commit hook** (husky + lint-staged) auto-runs `eslint --fix` on staged JS files — errors block the commit
- Convention: prefix intentionally-unused params/vars with `_` (e.g. `_roomOptions`, `_network`) to satisfy the linter
- `console.*` in client code generates warnings (not errors) — NetworkManager/UIManager are exempt in practice

### Notes
- WebSocket (Socket.io) server — incompatible with Vercel, Netlify, GitHub Pages, Cloudflare Pages/Workers free
- Render serves built Vite client (`client/dist/`) as static files via Express
- Build command: `npm install && cd server && npm install && cd ../client && npm install && npx vite build`
- Start command: `npm start` (runs `server/index.js`)
- Render fallback URL: https://superbucin.onrender.com (if custom domain not set)
