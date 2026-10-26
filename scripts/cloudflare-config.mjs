#!/usr/bin/env node
/*
 * Run after `vite build`: names the Cloudflare Worker, puts it on
 * launchpadeic.app (once that domain is in the Cloudflare account), and passes
 * it the public database settings. Secrets (database service key, AI key,
 * Stripe keys) are added separately by .github/workflows/deploy-website.yml.
 *
 * DOMAIN_READY=1 (set by the workflow after it checks Cloudflare) attaches
 * launchpadeic.app and www.launchpadeic.app. Without it the site is published
 * only to its free workers.dev test address.
 */
import { readFileSync, writeFileSync } from "node:fs";

const CONFIG = ".output/server/wrangler.json";
const DOMAINS = ["launchpadeic.app", "www.launchpadeic.app"];

// Settings given to the build directly (see deploy-website.yml) win over .env.
const env = {
  ...Object.fromEntries(
    readFileSync(".env", "utf8")
      .split("\n")
      .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  ),
  ...Object.fromEntries(
    ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  ),
};

const domainReady = process.env.DOMAIN_READY === "1";
const config = JSON.parse(readFileSync(CONFIG, "utf8"));
config.name = "launchpad-career-hub";
config.workers_dev = true; // free test address, handy for checking before the domain is live
if (domainReady) config.routes = DOMAINS.map((pattern) => ({ pattern, custom_domain: true }));
else delete config.routes;
config.vars = {
  ...(config.vars ?? {}),
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
};
config.observability = { enabled: true };
for (const [k, v] of Object.entries(config.vars)) {
  if (!v) throw new Error(`${k} is missing from .env`);
}
writeFileSync(CONFIG, JSON.stringify(config, null, 2));
console.log(
  `Worker "${config.name}"` +
    (domainReady ? ` on ${DOMAINS.join(", ")}` : " on its workers.dev test address only (domain not in Cloudflare yet)"),
);
