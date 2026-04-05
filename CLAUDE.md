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

### Notes
- WebSocket (Socket.io) server — incompatible with Vercel, Netlify, GitHub Pages, Cloudflare Pages/Workers free
- Render serves built Vite client (`client/dist/`) as static files via Express
- Build command: `npm install && cd server && npm install && cd ../client && npm install && npx vite build`
- Start command: `npm start` (runs `server/index.js`)
- Render fallback URL: https://superbucin.onrender.com (if custom domain not set)
