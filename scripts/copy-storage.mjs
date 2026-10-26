#!/usr/bin/env node
/*
 * One-time move: copies every stored file (Leader Drop videos, headshots,
 * profile photos) from the old Lovable Cloud project to the Career Hub's own
 * Supabase project, keeping the exact same paths so the database rows that
 * point at them keep working. Files already in the new project are skipped,
 * so it is safe to run more than once.
 *
 * Old project: read with its public key while a temporary read rule is in
 * place (added and removed around this run). New project: written with
 * SUPABASE_SERVICE_ROLE_KEY.
 */

const OLD_URL = "https://whqllgoqtztzbdegrnby.supabase.co";
const OLD_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocWxsZ29xdHp0emJkZWdybmJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTI0NTAsImV4cCI6MjA5NTQyODQ1MH0.9ccbSs6FfjU6nD2lrXfMfXdvpS7aP_B0XsZIj_6SLrg";
const NEW_URL = "https://yvebvsgixedduxicjisv.supabase.co";
const NEW_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const BUCKETS = ["avatars", "leader-drops"];

if (!NEW_KEY) {
  console.error("::error::SUPABASE_SERVICE_ROLE_KEY secret is missing");
  process.exit(1);
}

const auth = (key) => ({ apikey: key, Authorization: `Bearer ${key}` });
const enc = (path) => path.split("/").map(encodeURIComponent).join("/");

/** Every file path in a bucket, walking into folders. */
async function listAll(base, key, bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { ...auth(key), "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
    const items = await res.json();
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id === null) out.push(...(await listAll(base, key, bucket, path))); // a folder
      else out.push({ path, size: it.metadata?.size ?? 0, type: it.metadata?.mimetype });
    }
    if (items.length < 1000) break;
  }
  return out;
}

let copied = 0;
let skipped = 0;
let failed = 0;
for (const bucket of BUCKETS) {
  const have = new Set((await listAll(NEW_URL, NEW_KEY, bucket)).map((f) => f.path));
  const files = await listAll(OLD_URL, OLD_KEY, bucket);
  console.log(`${bucket}: ${files.length} files in the old project, ${have.size} already in the new one`);
  for (const f of files) {
    if (have.has(f.path)) {
      skipped++;
      continue;
    }
    try {
      const get = await fetch(`${OLD_URL}/storage/v1/object/authenticated/${bucket}/${enc(f.path)}`, {
        headers: auth(OLD_KEY),
      });
      if (!get.ok) throw new Error(`download ${get.status} ${await get.text()}`);
      const body = Buffer.from(await get.arrayBuffer());
      const put = await fetch(`${NEW_URL}/storage/v1/object/${bucket}/${enc(f.path)}`, {
        method: "POST",
        headers: {
          ...auth(NEW_KEY),
          "Content-Type": f.type || get.headers.get("content-type") || "application/octet-stream",
          "x-upsert": "false",
        },
        body,
      });
      if (!put.ok) throw new Error(`upload ${put.status} ${await put.text()}`);
      copied++;
      console.log(`  copied ${bucket}/${f.path} (${(body.length / 1048576).toFixed(1)} MB)`);
    } catch (e) {
      failed++;
      console.log(`::error::${bucket}/${f.path}: ${e.message}`);
    }
  }
}
console.log(`Done: ${copied} copied, ${skipped} already there, ${failed} failed`);
console.log(`::notice title=Files::${copied} copied, ${skipped} already there, ${failed} failed`);
if (failed) process.exit(1);
