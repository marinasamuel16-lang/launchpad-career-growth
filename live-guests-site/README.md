# Live guests site

The files served at https://launchpad-live-guests.netlify.app (one page per live
guest at `/g/<code>`). Plain HTML/CSS/JS — no build step. Copied from the
Netlify deploy of Oct 26, 2026.

Heads up: `app.js` still reads from the OLD Lovable database (whqllgoqtztzbdegrnby)
through `ld_live_get` / `ld_live_save`, not the Career Hub's own Supabase project.

To publish a change: drag this folder onto the site's Deploys page in Netlify.
