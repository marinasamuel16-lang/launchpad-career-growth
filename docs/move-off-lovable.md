# Moving the Career Hub off Lovable → launchpadeic.com

Same move Page & Spin made in Oct 2026. Work lives on the `move-off-lovable`
branch until switch-over, then merges to `main`.

## Where things live after the move

| What | Before | After |
|---|---|---|
| Website | launchpad-career-growth.lovable.app | launchpadeic.com (Cloudflare Worker `launchpad-career-hub`) |
| Database | Lovable Cloud `whqllgoqtztzbdegrnby` | Own Supabase project `launchpad-career-hub` — `yvebvsgixedduxicjisv` (same account as Page & Spin) |
| Google sign-in | Lovable's sign-in service | Supabase Google provider (own Google client) |
| AI | Lovable AI (`LOVABLE_API_KEY`) | Own Gemini key (`GEMINI_API_KEY`) — `src/lib/ai.server.ts` |
| Publishing | Lovable "Publish" | GitHub → Cloudflare (`.github/workflows/deploy-website.yml`) |
| Leader Drops site | Netlify, Lovable Cloud database | Netlify, new database — source now in `leader-drops-site/` |

## Done already

- [x] New Supabase project created; full layout copied (`supabase/baseline/`) and
      checked against the old one: 32 tables, 84 security rules, 28 functions,
      16 triggers, 2 file buckets — all match.
- [x] App code: Google sign-in, AI, old-address redirect, publish workflow.
- [x] Leader Drops files fetched and repointed (`leader-drops-site/`).
- [x] File-copy job (`scripts/copy-storage.mjs`, `.github/workflows/copy-files.yml`).

## Steven's steps (things only an account owner can do)

1. **Buy launchpadeic.com** in Cloudflare (the account that has pageandspin.com).
2. **Google sign-in** — new Google Cloud project "LaunchPad EIC" (so the Google
   screen doesn't say Page & Spin): consent screen (External, publish it),
   OAuth client (Web), redirect URI
   `https://yvebvsgixedduxicjisv.supabase.co/auth/v1/callback`. Paste the client
   ID + secret into Supabase → launchpad-career-hub → Authentication →
   Sign In / Providers → Google.
3. **Supabase settings** (launchpad-career-hub → Authentication):
   - URL Configuration → Site URL `https://launchpadeic.com`; Redirect URLs
     `https://launchpadeic.com/**`, `https://www.launchpadeic.com/**`,
     `com.launchpadeic.app://auth/callback`
   - Sign In / Providers → Email → turn **off** "Confirm email" (the free plan's
     built-in email only reaches team members; the app handles either setting).
4. **GitHub secrets** (launchpad-career-growth → Settings → Secrets and
   variables → Actions): `CLOUDFLARE_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## Switch-over (Claude, once the steps above are done)

1. Push to `move-off-lovable` → publishes to the test address; check it loads.
2. Copy data: one export from Lovable Cloud (auth users + identities + every
   public table) loaded into the new project with
   `session_replication_role = replica` so triggers don't fire (no duplicate
   starter milestones, no Leader Drop phone alerts).
3. Copy files: add a temporary read rule on the old project's storage, bump
   `.github/copy-files-trigger`, then remove the rule.
4. Upload `leader-drops-site/` to Netlify (drag and drop on the site's Deploys page).
5. Stripe: point the existing webhook endpoint at
   `https://launchpadeic.com/api/public/stripe-webhook`
   (events: checkout.session.completed, customer.subscription.created /
   updated / deleted).
6. Merge `move-off-lovable` → `main` (publishes on launchpadeic.com), then
   publish the Lovable project once so the old address forwards.
7. Check: sign in (password + Google), AI coach, Today's move, Premium checkout,
   Leader Drop invite page + dashboard. Update the weekly email link and the
   Sunday scheduled task to launchpadeic.com.

Lovable Cloud's free plan limits database lookups (about an hour's cool-down
after a burst), so the export in step 2 is a single query.
