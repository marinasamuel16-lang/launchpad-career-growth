/* Leader Drops — admin dashboard */
(() => {
  "use strict";
  const C = window.LD_CONFIG;
  const DEMO = new URLSearchParams(location.search).has("demo");
  const sb = DEMO ? null : window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "ld-admin-auth" },
  });
  const STATUSES = ["Submitted", "Editing", "Scheduled", "Published"];
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const amain = $("#amain");
  const isLive = (inv) => !!inv && inv.format === "live";
  // Leader Drops record at /drop/<code>; live interviews have their page at /live/<code>.
  const linkFor = (inv) => `${location.origin}/${isLive(inv) ? "live" : "drop"}/${inv.slug}`;
  // A live page opened with "-preview" doesn't count as the guest opening it.
  const previewFor = (inv) => (isLive(inv) ? `${linkFor(inv)}-preview` : linkFor(inv));
  const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const fmtDateTime = (d) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const initials = (n) => String(n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  // Live interviews are scheduled in Eastern time (Marina's time zone).
  const HOST_TZ = "America/New_York";
  const etParts = (t) => Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: HOST_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  // "2026-10-28" + "18:00" in New York -> ISO time (daylight saving handled).
  function etToISO(date, time) {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    const want = Date.UTC(y, m - 1, d, hh, mm);
    let t = want;
    for (let k = 0; k < 3; k++) {
      const p = etParts(t);
      t += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    }
    return new Date(t).toISOString();
  }
  const isoToET = (iso) => { const p = etParts(iso); return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}` }; };
  const fmtET = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: HOST_TZ, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) + " ET";
  const fmtETShort = (iso) => new Intl.DateTimeFormat("en-US", { timeZone: HOST_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) + " ET";

  let DROPS = [], INVITES = [], NOMS = [], LEADS = [];
  let leadsReady = true; // false until the guest_leads table exists
  const view = { tab: "subs", q: "", status: "All", invQ: "", leadQ: "", leadF: "All" };
  const avatarCache = {};

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  }
  async function copy(text, label = "Copied") {
    try { await navigator.clipboard.writeText(text); toast(label); }
    catch (_) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(label); } catch (e) { toast("Couldn’t copy — select and copy manually."); }
      ta.remove();
    }
  }

  async function signed(path, download) {
    if (!path) return null;
    if (DEMO) return null;
    const opts = download ? { download: download } : undefined;
    const { data, error } = await sb.storage.from(C.BUCKET).createSignedUrl(path, 60 * 60, opts);
    return error ? null : data.signedUrl;
  }
  const extOf = (p) => (p || "").split(".").pop();
  const slug = (s) => String(s || "leader").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ---------- auth ----------
  function screenLogin(err) {
    $("#whoami").hidden = true;
    amain.innerHTML = `
      <section class="login screen">
        <p class="eyebrow">Admin</p>
        <h1>Leader<br>Drops</h1>
        <p class="lede" style="font-size:15px">Sign in with the LaunchPad EIC admin account.</p>
        <form class="fields" id="loginForm">
          <div class="field"><label for="l-email">Email</label><input class="input" id="l-email" type="email" autocomplete="username" required value="${esc(C.CONTACT_EMAIL)}"></div>
          <div class="field"><label for="l-pass">Password</label><input class="input" id="l-pass" type="password" autocomplete="current-password" required></div>
          ${err ? `<div class="notice err" role="alert">${esc(err)}</div>` : ""}
          <button class="btn btn-primary btn-block" type="submit" id="l-go">Sign in</button>
          <p class="small">Same email and password as the LaunchPad Career Hub app.</p>
        </form>
      </section>`;
    $("#l-pass").focus();
    $("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      const b = $("#l-go"); b.disabled = true; b.textContent = "Signing in…";
      const { error } = await sb.auth.signInWithPassword({ email: $("#l-email").value.trim(), password: $("#l-pass").value });
      if (error) { screenLogin(error.message === "Invalid login credentials" ? "That email and password don’t match." : error.message); return; }
      start();
    };
  }

  async function start() {
    if (DEMO) { seedDemo(); $("#whoami").hidden = false; $("#whoEmail").textContent = "Demo data"; renderDash(); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return screenLogin();
    const { data: isAdmin, error } = await sb.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
    // Database rules are the real gate (non-admins see nothing); this just gives a clear message.
    if (!error && isAdmin === false) { await sb.auth.signOut(); return screenLogin("This account isn’t an admin."); }
    $("#whoami").hidden = false;
    $("#whoEmail").textContent = session.user.email;
    amain.innerHTML = `<div style="display:grid;place-items:center;padding:80px"><div class="spinner"></div></div>`;
    await load();
    renderDash();
  }
  $("#signout").onclick = async () => { if (sb) await sb.auth.signOut(); location.reload(); };

  async function load() {
    const [d, i, n, l] = await Promise.all([
      sb.from("leader_drops").select("*").order("submission_timestamp", { ascending: false }),
      sb.from("leader_drop_invites").select("*").order("created_at", { ascending: false }),
      sb.from("leader_drop_nominations").select("*").order("created_at", { ascending: false }),
      sb.from("guest_leads").select("*").order("created_at", { ascending: false }),
    ]);
    if (d.error || i.error || n.error) toast("Some data didn’t load. Refresh to try again.");
    DROPS = d.data || []; INVITES = i.data || []; NOMS = n.data || []; LEADS = l.data || [];
    leadsReady = !l.error;
    // headshot thumbnails
    await Promise.all(DROPS.filter((r) => r.headshot_url && !avatarCache[r.headshot_url]).map(async (r) => {
      avatarCache[r.headshot_url] = await signed(r.headshot_url);
    }));
  }

  // ---------- dashboard ----------
  function avatar(r, cls = "") {
    const url = r.headshot_url && avatarCache[r.headshot_url];
    return `<span class="avatar ${cls}">${url ? `<img alt="" src="${esc(url)}">` : esc(initials(r.name))}</span>`;
  }
  function statusSelect(r) {
    return `<span class="status-wrap st-${esc(r.status)}"><select class="status-select" data-status="${r.leader_id}" aria-label="Status for ${esc(r.name)}">
      ${STATUSES.map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></span>`;
  }

  function renderDash() {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, DROPS.filter((r) => r.status === s).length]));
    const openInv = INVITES.filter((i) => !i.submitted_at).length;
    const TABS = [["subs", "Submissions", DROPS.length], ["leads", "Live", LEADS.length], ["create", "Create Invite", null], ["invites", "Invitations", INVITES.length], ["noms", "Nominations", NOMS.length]];
    amain.innerHTML = `
      <section class="a-hero">
        <div>
          <p class="eyebrow">Inbox</p>
          <div class="big"><strong>${counts.Submitted}</strong><span>NEW<br>SUBMISSIONS</span></div>
        </div>
        <div class="pipeline" aria-label="Pipeline">
          ${STATUSES.map((s) => `<div><b>${counts[s]}</b><small class="status st-${s}">${s}</small></div>`).join("")}
          <div><b>${openInv}</b><small>Invites out</small></div>
        </div>
      </section>
      <nav class="tabs" role="tablist">
        ${TABS.map(([k, label, n]) => `<button role="tab" data-tab="${k}" aria-selected="${view.tab === k}">${label}${n === null ? "" : `<span class="count">${n}</span>`}</button>`).join("")}
      </nav>
      <section id="tabBody"></section>`;
    amain.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { view.tab = b.dataset.tab; renderDash(); }));
    ({ subs: renderSubs, leads: renderLeads, create: renderCreate, invites: renderInvites, noms: renderNoms })[view.tab]();
  }

  function filtered() {
    const q = view.q.trim().toLowerCase();
    return DROPS.filter((r) => (view.status === "All" || r.status === view.status) &&
      (!q || [r.name, r.title, r.company, r.one_drop, r.linkedin].some((v) => (v || "").toLowerCase().includes(q))));
  }

  function renderSubs() {
    const body = $("#tabBody");
    body.innerHTML = `
      <div class="toolbar">
        <label class="search"><span class="sr-only">Search leaders</span>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input class="input" id="q" type="search" placeholder="Search leaders, companies, One Drops…" value="${esc(view.q)}">
        </label>
        <div class="chips" role="group" aria-label="Filter by status">
          ${["All", ...STATUSES].map((s) => `<button class="chip" type="button" data-f="${s}" aria-pressed="${view.status === s}">${s}</button>`).join("")}
        </div>
      </div>
      <div id="rows"></div>`;
    $("#q").oninput = (e) => { view.q = e.target.value; paintRows(); };
    body.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => {
      view.status = b.dataset.f;
      body.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      paintRows();
    }));
    paintRows();
  }

  function paintRows() {
    const rows = filtered();
    const box = $("#rows");
    if (!DROPS.length) {
      box.innerHTML = `<div class="empty"><b>No Leader Drops yet.</b>Use <em>Create Leader Drop</em> to make a personalized invitation.</div>`;
      return;
    }
    if (!rows.length) { box.innerHTML = `<div class="empty"><b>No matches.</b>Try a different name or status.</div>`; return; }
    box.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Leader</th><th>Title</th><th>Company</th><th>Date</th><th>Videos</th><th>One Drop</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr data-id="${r.leader_id}" class="${r.status === "Submitted" ? "is-new" : ""}" tabindex="0" aria-label="Open ${esc(r.name)}">
              <td class="c-who"><div class="who">${avatar(r)}<div><b>${esc(r.name)}</b>
                <span class="small" style="display:block">${esc(r.title)} · ${esc(r.company)}</span></div></div></td>
              <td class="c-title">${esc(r.title)}</td>
              <td class="c-company">${esc(r.company)}</td>
              <td><span class="date">${fmtDate(r.submission_timestamp)}</span></td>
              <td><div class="vids">
                ${[1, 2, 3].map((n) => `<button class="vid-btn" type="button" data-play="${r.leader_id}:${n}" title="Play answer ${n}">Q${n}</button>`).join("")}
                ${r.one_drop_video_url ? `<button class="vid-btn" type="button" data-play="${r.leader_id}:drop" title="Play One Drop">★</button>` : ""}
              </div></td>
              <td class="c-drop"><div class="drop-cell ${r.one_drop ? "" : "video"}">${r.one_drop ? `“${esc(r.one_drop)}”` : "Video answer"}</div></td>
              <td>${statusSelect(r)}</td>
            </tr>`).join("")}
        </tbody>
      </table></div>`;
    box.querySelectorAll("tr[data-id]").forEach((tr) => {
      const open = (focus) => openDrawer(tr.dataset.id, focus);
      tr.addEventListener("click", (e) => { if (e.target.closest("select,button,a")) return; open(); });
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === tr) open(); });
    });
    box.querySelectorAll("[data-play]").forEach((b) => (b.onclick = () => { const [id, n] = b.dataset.play.split(":"); openDrawer(id, n); }));
    wireStatus(box);
  }

  function wireStatus(root) {
    root.querySelectorAll("[data-status]").forEach((sel) => (sel.onchange = async () => {
      const r = DROPS.find((x) => x.leader_id === sel.dataset.status);
      const prev = r.status; const next = sel.value;
      sel.parentElement.className = `status-wrap st-${next}`;
      r.status = next;
      if (!DEMO) {
        const { error } = await sb.from("leader_drops").update({ status: next }).eq("leader_id", r.leader_id);
        if (error) { r.status = prev; sel.value = prev; sel.parentElement.className = `status-wrap st-${prev}`; toast("Couldn’t update status."); return; }
      }
      toast(`${r.name} → ${next}`);
      // refresh counts without losing the open drawer
      const scroll = scrollY; const hadDrawer = !!$(".drawer");
      if (!hadDrawer) { renderDash(); scrollTo(0, scroll); }
      else { document.querySelectorAll(`[data-status="${r.leader_id}"]`).forEach((s) => { s.value = next; s.parentElement.className = `status-wrap st-${next}`; }); }
    }));
  }

  function answersText(r) {
    const lines = [
      `${r.intro_name || r.name}`,
      `${r.intro_line || `${r.title} • ${r.company}`}`,
      r.linkedin ? r.linkedin : null,
      r.bio ? `Bio: ${r.bio}` : null,
      "",
      `Q1: ${r.question_1}`, `Q2: ${r.question_2}`, `Q3: ${r.question_3}`,
      "",
      `ONE DROP: ${r.one_drop ? `“${r.one_drop}”` : "(video answer)"}`,
      r.bonus_video_url ? `BONUS (members first): ${r.bonus_question || ""}` : null,
      "",
      `Submitted ${fmtDateTime(r.submission_timestamp)} · Status: ${r.status}`,
    ];
    return lines.filter((l) => l !== null).join("\n");
  }

  function openDrawer(id, focus) {
    const r = DROPS.find((x) => x.leader_id === id);
    if (!r) return;
    closeDrawer();
    const bg = document.createElement("div"); bg.className = "drawer-bg";
    const d = document.createElement("aside"); d.className = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", r.name);
    const vids = [
      { key: "1", label: "Question 1", q: r.question_1, path: r.video_1_url },
      { key: "2", label: "Question 2", q: r.question_2, path: r.video_2_url },
      { key: "3", label: "Question 3", q: r.question_3, path: r.video_3_url },
    ];
    d.innerHTML = `
      <div class="drawer-head">
        ${statusSelect(r)}
        <button class="icon-btn" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="d-intro">${avatar(r)}<div><h2>${esc(r.intro_name || r.name)}</h2><p>${esc(r.intro_line || `${r.title} • ${r.company}`)}</p></div></div>
      <dl class="d-meta">
        <dt>Name</dt><dd>${esc(r.name)}</dd>
        <dt>Title</dt><dd>${esc(r.title)}</dd>
        <dt>Company</dt><dd>${esc(r.company)}</dd>
        <dt>LinkedIn</dt><dd>${r.linkedin ? `<a href="${esc(r.linkedin)}" target="_blank" rel="noopener">${esc(r.linkedin.replace(/^https?:\/\/(www\.)?/, ""))}</a>` : "—"}</dd>
        <dt>Bio</dt><dd>${r.bio ? esc(r.bio) : "—"}</dd>
        <dt>Submitted</dt><dd>${fmtDateTime(r.submission_timestamp)}</dd>
        <dt>Permission</dt><dd>${r.permission_granted ? `✓ Granted ${fmtDateTime(r.permission_granted_at)}` : "—"}</dd>
      </dl>
      <div class="d-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-copyall>Copy answers</button>
        ${r.headshot_url ? `<button class="btn btn-ghost btn-sm" type="button" data-dl="${esc(r.headshot_url)}" data-name="${slug(r.name)}-headshot.${extOf(r.headshot_url)}">Download headshot</button>` : ""}
        <button class="btn btn-ghost btn-sm" type="button" data-dlall>Download all videos</button>
      </div>
      ${vids.map((v) => `
        <div class="answer" id="ans-${v.key}">
          <div class="qn">${v.label}</div>
          <h3>${esc(v.q)}</h3>
          <div class="player" data-player="${esc(v.path)}"><button class="btn btn-ghost btn-sm" type="button" data-load>▶ Load video</button></div>
          <div class="a-row">
            <button class="btn btn-ghost btn-sm" type="button" data-dl="${esc(v.path)}" data-name="${slug(r.name)}-q${v.key}.${extOf(v.path)}">Download original</button>
            <button class="btn btn-text btn-sm" type="button" data-copy="${esc(v.q)}">Copy question</button>
          </div>
        </div>`).join("")}
      <div class="answer" id="ans-drop">
        <div class="qn">One Drop</div>
        ${r.one_drop ? `<p class="drop-quote">${esc(r.one_drop)}</p>
          <div class="a-row"><button class="btn btn-ghost btn-sm" type="button" data-copy="${esc(r.one_drop)}">Copy One Drop</button></div>` : ""}
        ${r.one_drop_video_url ? `
          <div class="player" data-player="${esc(r.one_drop_video_url)}"><button class="btn btn-ghost btn-sm" type="button" data-load>▶ Load video</button></div>
          <div class="a-row"><button class="btn btn-ghost btn-sm" type="button" data-dl="${esc(r.one_drop_video_url)}" data-name="${slug(r.name)}-one-drop.${extOf(r.one_drop_video_url)}">Download original</button></div>` : ""}
      </div>
      ${r.bonus_video_url ? `
      <div class="answer" id="ans-bonus">
        <div class="qn">Bonus · members first</div>
        <h3>${esc(r.bonus_question || "Bonus question")}</h3>
        <div class="player" data-player="${esc(r.bonus_video_url)}"><button class="btn btn-ghost btn-sm" type="button" data-load>▶ Load video</button></div>
        <div class="a-row">
          <button class="btn btn-ghost btn-sm" type="button" data-dl="${esc(r.bonus_video_url)}" data-name="${slug(r.name)}-bonus.${extOf(r.bonus_video_url)}">Download original</button>
          <a class="btn btn-text btn-sm" href="${esc((C.LINKS && C.LINKS.site) || "https://launchpadeic.app")}/admin/extras" target="_blank" rel="noopener">Publish to members →</a>
        </div>
      </div>` : ""}`;
    document.body.append(bg, d);
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", onKey);
    d._off = () => document.removeEventListener("keydown", onKey);
    bg.onclick = closeDrawer;
    d.querySelector("[data-close]").onclick = closeDrawer;
    d.querySelector("[data-close]").focus();
    wireStatus(d);

    d.querySelector("[data-copyall]").onclick = () => copy(answersText(r), "Answers copied");
    d.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copy(b.dataset.copy)));
    d.querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => download(b.dataset.dl, b.dataset.name)));
    d.querySelector("[data-dlall]").onclick = async () => {
      const list = [[r.video_1_url, 1], [r.video_2_url, 2], [r.video_3_url, 3]].map(([p, n]) => [p, `${slug(r.name)}-q${n}.${extOf(p)}`]);
      if (r.one_drop_video_url) list.push([r.one_drop_video_url, `${slug(r.name)}-one-drop.${extOf(r.one_drop_video_url)}`]);
      if (r.bonus_video_url) list.push([r.bonus_video_url, `${slug(r.name)}-bonus.${extOf(r.bonus_video_url)}`]);
      for (const [p, n] of list) { await download(p, n); await new Promise((res) => setTimeout(res, 700)); }
    };
    const loadPlayer = async (box) => {
      if (box.dataset.loaded) return;
      box.dataset.loaded = "1";
      box.innerHTML = `<div class="spinner"></div>`;
      if (DEMO) { box.innerHTML = `<span class="small">Demo — videos play here in the live dashboard.</span>`; return; }
      const url = await signed(box.dataset.player);
      box.innerHTML = url ? `<video controls playsinline preload="metadata" src="${esc(url)}"></video>` : `<span class="small">Couldn’t load this video.</span>`;
      return box.querySelector("video");
    };
    d.querySelectorAll("[data-player]").forEach((box) => (box.querySelector("[data-load]").onclick = () => loadPlayer(box)));
    // Auto-load every player (signed URLs are cheap; video only buffers metadata)
    d.querySelectorAll("[data-player]").forEach((box) => loadPlayer(box));
    if (focus) {
      const target = d.querySelector(`#ans-${focus}`);
      if (target) setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        const v = target.querySelector("video"); if (v) v.play().catch(() => {});
      }, 450);
    }
  }
  function closeDrawer() {
    const d = $(".drawer"); if (!d) return;
    d.querySelectorAll("video").forEach((v) => v.pause());
    d._off && d._off();
    d.remove(); $(".drawer-bg")?.remove();
    document.body.style.overflow = "";
    if (view.tab === "subs") renderDash();
  }

  async function download(path, name) {
    if (DEMO) { toast("Demo — downloads work in the live dashboard."); return; }
    const url = await signed(path, name);
    if (!url) { toast("Couldn’t create a download link."); return; }
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- invitations ----------
  const DEFAULT_Q = [
    "What took you way too long to understand about building a successful career?",
    "What career advice do you disagree with — and what would you tell someone instead?",
    "If you were starting your career again tomorrow, what would you do differently?",
  ];
  // Optional 4th question. Members of the Career Hub see the answer first, then
  // it unlocks for everyone (published from the Career Hub admin → Premium extras).
  const DEFAULT_BONUS = "What’s one unwritten rule of getting ahead that nobody told you early on?";
  // Live interview questions: same spirit as Frank Amoruso's (experience, people, one perspective).
  const LIVE_Q = [
    "Looking back on your career, what’s something you’ve come to understand through experience that you wish you had recognized much earlier?",
    "What have you learned about working with people and bringing out the best in them, and how has that shaped your own path?",
    "If you could give an ambitious young professional one perspective that took you years to develop, what would it be?",
  ];
  const INV_STATES = ["Created", "Sent", "Opened", "Started", "Submitted", "Published"];
  // For a live guest, "Started" means they've added their bio/headshot on their page.
  const stLabel = (inv, st) => (isLive(inv) && st === "Started" ? "Details in" : st);
  function invStatus(inv) {
    const drop = DROPS.find((d) => d.invite_id === inv.id);
    if (drop && drop.status === "Published") return "Published";
    if (inv.submitted_at) return "Submitted";
    if (inv.started_at) return "Started";
    if (inv.first_opened_at) return "Opened";
    if (inv.sent_at) return "Sent";
    return "Created";
  }
  function invitationText(inv) {
    const first = inv.leader_name.trim().split(/\s+/)[0];
    if (isLive(inv)) {
      const about = inv.topic ? ` about ${inv.topic.replace(/[.\s]+$/, "")}` : "";
      if (inv.recording_at) return `Hi ${first}!

Thank you so much for joining LaunchPad EIC. I’m really looking forward to our conversation${about}.

We’re set for ${fmtET(inv.recording_at)}. It’s very casual and only about 10 minutes long.

Your page has the time, a button to add it to your calendar, and your three questions so you can think ahead:
${linkFor(inv)}

If you have a minute before the call, there’s also a quick spot to add a short bio and headshot so we can introduce you properly.

Best,
Marina Samuel`;
      return `Hi ${first}!

I’m Marina Samuel, an NJIT alum (Class of 2025) and the host of LaunchPad EIC, a career podcast for people in the first few years of their careers.

I’d love to have you on for a short live conversation${about}. Would you be open to being a guest?

It’s very casual and only about 10 minutes long. Here’s a page with the topic and the three questions I’d ask, so you can see exactly what it would be:
${linkFor(inv)}

Best,
Marina Samuel`;
    }
    return `Hi ${first} — I’d love to feature your perspective in a Launchpad Leader Drop.

No podcast scheduling or meeting — just 3 questions you can answer by video whenever you have ~5 minutes.

Your questions are ready here:
${linkFor(inv)}

3 questions. 5 minutes. Years of experience.`;
  }
  async function copyInvitation(inv) {
    await copy(invitationText(inv), isLive(inv) ? "Live invite copied — paste it into WhatsApp, text, LinkedIn, or email" : "Invitation copied — paste it into LinkedIn, text, or email");
    if (!inv.sent_at) {
      inv.sent_at = new Date().toISOString();
      if (!DEMO) {
        const { error } = await sb.from("leader_drop_invites").update({ sent_at: inv.sent_at }).eq("id", inv.id).is("sent_at", null);
        if (error) inv.sent_at = null;
      }
    }
  }
  function normLinkedin(v) { v = (v || "").trim(); return v && !/^https?:\/\//i.test(v) ? "https://" + v : v; }

  let lastCreated = null;
  let prefill = null;
  let createFmt = "drop"; // "drop" or "live"
  function renderCreate() {
    const body = $("#tabBody");
    const pf = prefill || {}; prefill = null;
    if (pf.format) createFmt = pf.format;
    const live = createFmt === "live";
    const QS = live ? LIVE_Q : DEFAULT_Q;
    const v = (k, d = "") => esc(pf[k] ?? d);
    body.innerHTML = `
      <div class="create-wrap">
        <form class="create" id="createForm" novalidate>
          <div>
            <p class="eyebrow">New invitation${pf.leadId ? " · from your Live list" : ""}</p>
            <div class="fmt-switch" role="radiogroup" aria-label="Kind of invitation">
              <button type="button" role="radio" data-fmt="drop" aria-checked="${!live}">Leader Drop</button>
              <button type="button" role="radio" data-fmt="live" aria-checked="${live}">Live interview</button>
            </div>
            <h3 class="create-title">${live ? "Create Live Interview" : "Create Leader Drop"}</h3>
            <p class="small" style="margin:4px 0 0">${live
              ? "They get one page with the date and time, an add-to-calendar button, their three questions, and a quick spot for their bio and headshot."
              : "The leader sees their name and these three questions the moment they open the link, and records their answers on their own time."}</p>
          </div>
          <div class="create-grid2">
            <div class="field"><label for="c-name">${live ? "Guest name" : "Leader name"}</label><input class="input" id="c-name" required maxlength="120" placeholder="Michael Johnson" value="${v("name")}"></div>
            <div class="field"><label for="c-title">Title</label><input class="input" id="c-title" maxlength="160" placeholder="President" value="${v("title")}"></div>
            <div class="field"><label for="c-company">Company</label><input class="input" id="c-company" maxlength="160" placeholder="NJII" value="${v("company")}"></div>
            <div class="field"><label for="c-linkedin">LinkedIn URL</label><input class="input" id="c-linkedin" maxlength="300" inputmode="url" autocapitalize="off" placeholder="linkedin.com/in/…" value="${v("linkedin")}"></div>
          </div>
          ${live ? `
          <div class="create-grid2">
            <div class="field"><label for="c-date">Date</label><input class="input" id="c-date" type="date" value="${v("date")}"></div>
            <div class="field"><label for="c-time">Time (Eastern)</label><input class="input" id="c-time" type="time" step="300" value="${v("time", "18:00")}"></div>
          </div>
          <p class="small" style="margin:-4px 0 0">No date yet? Leave it blank. Their page says you’ll confirm a time, and you can add it later from Invitations → Edit.</p>
          <div class="field"><label for="c-topic">Topic</label><input class="input" id="c-topic" maxlength="200" placeholder="What Experience Teaches: Perspective, People and Wisdom" value="${v("topic")}"></div>
          <div class="field"><label for="c-meet">Meeting link <span class="opt">(optional, add it later if you don’t have it yet)</span></label><input class="input" id="c-meet" maxlength="500" inputmode="url" autocapitalize="off" placeholder="https://zoom.us/j/…" value="${v("meeting_url")}"></div>` : ""}
          <div class="fields" style="margin-top:0">
            ${QS.map((q, i) => `<div class="field"><label for="c-q${i}">Question ${i + 1}</label><textarea class="input qbox" id="c-q${i}" maxlength="300" rows="${live ? 3 : 2}">${esc((pf.questions && pf.questions[i]) || q)}</textarea></div>`).join("")}
            ${live ? "" : `<div class="field"><label for="c-bonus">Bonus question <span class="opt">(optional for them · members see it first, everyone two weeks later · clear it to leave it out)</span></label><textarea class="input qbox" id="c-bonus" maxlength="300" rows="2">${esc(pf.bonus_question ?? DEFAULT_BONUS)}</textarea></div>`}
          </div>
          <div class="field-err" id="c-err" hidden></div>
          <div><button class="btn btn-primary" type="submit" id="c-go">${live ? "Create Live Invite" : "Create Invitation"}</button></div>
        </form>
        <aside class="create-result" id="createResult">${lastCreated ? resultCard(lastCreated) : `<div class="empty" style="padding:30px 10px"><b>Your invitation appears here.</b>You’ll get the link and a ready-to-send message.</div>`}</aside>
      </div>`;
    wireResult();

    // Switching kind keeps what's typed. Questions switch to that kind's defaults unless you edited them.
    body.querySelectorAll("[data-fmt]").forEach((b) => (b.onclick = () => {
      if (b.dataset.fmt === createFmt) return;
      const val = (id, fallback) => { const el = $(id); return el ? el.value : fallback; };
      const keep = {
        name: val("#c-name"), title: val("#c-title"), company: val("#c-company"), linkedin: val("#c-linkedin"),
        topic: val("#c-topic", pf.topic), date: val("#c-date", pf.date), time: val("#c-time", pf.time), meeting_url: val("#c-meet", pf.meeting_url),
        bonus_question: val("#c-bonus", pf.bonus_question),
        leadId: pf.leadId, note: pf.note,
      };
      const cur = [0, 1, 2].map((i) => $(`#c-q${i}`).value.trim());
      if (cur.some((q, i) => q !== QS[i])) keep.questions = cur;
      createFmt = b.dataset.fmt; prefill = keep; renderCreate();
    }));

    $("#createForm").onsubmit = async (e) => {
      e.preventDefault();
      const err = $("#c-err"); err.hidden = true;
      const fail = (msg) => { err.hidden = false; err.textContent = msg; };
      const name = $("#c-name").value.trim();
      const linkedin = normLinkedin($("#c-linkedin").value);
      if (!name) { $("#c-name").setAttribute("aria-invalid", "true"); $("#c-name").focus(); return; }
      if (linkedin && !/^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\/\S+/i.test(linkedin)) return fail("That LinkedIn URL should include linkedin.com/…");
      const qs = [0, 1, 2].map((i) => $(`#c-q${i}`).value.trim());
      if (qs.some((q) => q.length < 5)) return fail("Each of the three questions needs text.");
      const row = {
        format: createFmt,
        leader_name: name,
        title: $("#c-title").value.trim() || null,
        company: $("#c-company").value.trim() || null,
        linkedin: linkedin || null,
        question_1: qs[0], question_2: qs[1], question_3: qs[2],
        note: pf.note || null,
      };
      if (!live) row.bonus_question = $("#c-bonus").value.trim() || null;
      else row.bonus_question = null;
      if (live) {
        const date = $("#c-date").value, time = $("#c-time").value;
        if (date && !time) return fail("Add a time for that date (Eastern).");
        row.recording_at = date ? etToISO(date, time) : null;
        row.topic = $("#c-topic").value.trim() || null;
        let meet = $("#c-meet").value.trim();
        if (meet && !/^https?:\/\//i.test(meet)) meet = "https://" + meet;
        row.meeting_url = meet || null;
      }
      const b = $("#c-go"); b.disabled = true; b.textContent = "Creating…";
      let made;
      if (DEMO) made = { id: crypto.randomUUID(), slug: `${slug(name)}-x7k29q`, created_at: new Date().toISOString(), first_opened_at: null, started_at: null, sent_at: null, submitted_at: null, ...row };
      else {
        const { data, error } = await sb.from("leader_drop_invites").insert(row).select().single();
        if (error) { fail("Couldn’t create the invitation: " + error.message); b.disabled = false; b.textContent = live ? "Create Live Invite" : "Create Invitation"; return; }
        made = data;
      }
      INVITES.unshift(made);
      lastCreated = made;
      if (pf.leadId) {
        await saveLead(pf.leadId, live
          ? { invite_id: made.id, format: "live", status: "Invited", live_url: linkFor(made), live_date: made.recording_at ? isoToET(made.recording_at).date : null }
          : { invite_id: made.id, format: "leader_drop", status: "Invited" }, true);
      }
      renderDash();
      toast(live ? "Live invite created" : "Invitation created");
    };
  }
  function resultCard(inv) {
    const live = isLive(inv);
    return `
      <div class="result-card">
        <p class="eyebrow">Ready to send${live ? " · Live interview" : " · Leader Drop"}</p>
        <h3 class="create-title" style="font-size:26px">${esc(inv.leader_name)}</h3>
        <p class="small" style="margin:0 0 12px">${esc([inv.title, inv.company].filter(Boolean).join(" • "))}${live ? `<br><b>${inv.recording_at ? esc(fmtET(inv.recording_at)) : "Date not set yet"}</b>` : ""}</p>
        <div class="link-box"><code>${esc(linkFor(inv))}</code></div>
        <pre class="msg-preview">${esc(invitationText(inv))}</pre>
        <div class="a-row">
          <button class="btn btn-primary btn-sm" type="button" data-copyinv="${inv.id}">${live ? "Copy Live Invite" : "Copy Invitation"}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-copylink="${inv.id}">Copy link</button>
          <a class="btn btn-text btn-sm" href="${esc(previewFor(inv))}" target="_blank" rel="noopener">Preview</a>
          ${live ? `<button class="btn btn-text btn-sm" type="button" data-edit="${inv.id}">Edit</button>` : ""}
        </div>
        <p class="small" style="margin:10px 0 0">${live
          ? "Preview shows their page without marking it as opened."
          : `Heads up: opening the link yourself marks it as “Opened.” Use <a href="/?demo" target="_blank" rel="noopener">demo mode</a> to look around instead.`}</p>
      </div>`;
  }
  function wireResult(root = document) {
    const find = (id) => INVITES.find((i) => i.id === id);
    root.querySelectorAll("[data-copyinv]").forEach((b) => (b.onclick = async () => { await copyInvitation(find(b.dataset.copyinv)); if (view.tab === "invites") paintInvites(); }));
    root.querySelectorAll("[data-copylink]").forEach((b) => (b.onclick = () => copy(linkFor(find(b.dataset.copylink)), "Link copied")));
    root.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openInviteEditor(find(b.dataset.edit))));
  }

  // Change a live interview after it's made: reschedule, add the meeting link, tweak questions.
  function openInviteEditor(inv) {
    if (!inv) return;
    closeDrawer();
    const bg = document.createElement("div"); bg.className = "drawer-bg";
    const d = document.createElement("aside"); d.className = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.setAttribute("aria-label", `Edit ${inv.leader_name}`);
    const when = inv.recording_at ? isoToET(inv.recording_at) : { date: "", time: "18:00" };
    const qs = [inv.question_1, inv.question_2, inv.question_3];
    d.innerHTML = `
      <div class="drawer-head">
        <p class="eyebrow" style="margin:0">Edit live interview</p>
        <button class="icon-btn" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <form id="invForm" class="fields" novalidate>
        <div class="create-grid2">
          <div class="field"><label for="e-name">Guest name</label><input class="input" id="e-name" maxlength="120" value="${esc(inv.leader_name)}"></div>
          <div class="field"><label for="e-title">Title</label><input class="input" id="e-title" maxlength="160" value="${esc(inv.title || "")}"></div>
          <div class="field"><label for="e-company">Company</label><input class="input" id="e-company" maxlength="160" value="${esc(inv.company || "")}"></div>
          <div class="field"><label for="e-linkedin">LinkedIn URL</label><input class="input" id="e-linkedin" maxlength="300" inputmode="url" autocapitalize="off" value="${esc(inv.linkedin || "")}"></div>
          <div class="field"><label for="e-date">Date</label><input class="input" id="e-date" type="date" value="${esc(when.date)}"></div>
          <div class="field"><label for="e-time">Time (Eastern)</label><input class="input" id="e-time" type="time" step="300" value="${esc(when.time)}"></div>
        </div>
        <div class="field"><label for="e-topic">Topic</label><input class="input" id="e-topic" maxlength="200" value="${esc(inv.topic || "")}"></div>
        <div class="field"><label for="e-meet">Meeting link</label><input class="input" id="e-meet" maxlength="500" inputmode="url" autocapitalize="off" placeholder="https://zoom.us/j/…" value="${esc(inv.meeting_url || "")}"></div>
        ${qs.map((q, i) => `<div class="field"><label for="e-q${i}">Question ${i + 1}</label><textarea class="input qbox" id="e-q${i}" maxlength="300" rows="3">${esc(q || "")}</textarea></div>`).join("")}
        <div class="field-err" id="e-err" hidden></div>
        <div class="a-row">
          <button class="btn btn-primary" type="submit" id="e-go">Save changes</button>
          <a class="btn btn-text btn-sm" href="${esc(previewFor(inv))}" target="_blank" rel="noopener">Preview page</a>
        </div>
        <p class="small" style="margin:0">Changes show on their page right away. If you moved the date, send them the invite again so they can update their calendar.</p>
      </form>`;
    document.body.append(bg, d);
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", onKey);
    d._off = () => document.removeEventListener("keydown", onKey);
    bg.onclick = closeDrawer;
    d.querySelector("[data-close]").onclick = closeDrawer;
    d.querySelector("#e-date").focus();
    d.querySelector("#invForm").onsubmit = async (e) => {
      e.preventDefault();
      const err = d.querySelector("#e-err"); err.hidden = true;
      const fail = (msg) => { err.hidden = false; err.textContent = msg; };
      const val = (id) => d.querySelector(id).value.trim();
      const name = val("#e-name");
      if (!name) return fail("The guest needs a name.");
      const linkedin = normLinkedin(val("#e-linkedin"));
      if (linkedin && !/^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\/\S+/i.test(linkedin)) return fail("That LinkedIn URL should include linkedin.com/…");
      const date = val("#e-date"), time = val("#e-time");
      if (date && !time) return fail("Add a time for that date (Eastern).");
      const qsNew = [0, 1, 2].map((i) => val(`#e-q${i}`));
      if (qsNew.some((q) => q.length < 5)) return fail("Each of the three questions needs text.");
      let meet = val("#e-meet");
      if (meet && !/^https?:\/\//i.test(meet)) meet = "https://" + meet;
      const patch = {
        leader_name: name, title: val("#e-title") || null, company: val("#e-company") || null, linkedin: linkedin || null,
        recording_at: date ? etToISO(date, time) : null, topic: val("#e-topic") || null, meeting_url: meet || null,
        question_1: qsNew[0], question_2: qsNew[1], question_3: qsNew[2],
      };
      const btn = d.querySelector("#e-go"); btn.disabled = true; btn.textContent = "Saving…";
      if (!DEMO) {
        const { error } = await sb.from("leader_drop_invites").update(patch).eq("id", inv.id);
        if (error) { fail("Couldn’t save: " + error.message); btn.disabled = false; btn.textContent = "Save changes"; return; }
      }
      Object.assign(inv, patch);
      const lead = LEADS.find((l) => l.invite_id === inv.id);
      if (lead) await saveLead(lead.id, { live_date: patch.recording_at ? isoToET(patch.recording_at).date : null }, true);
      closeDrawer(); renderDash(); toast("Live interview updated");
    };
  }

  function renderInvites() {
    const body = $("#tabBody");
    body.innerHTML = `
      <div class="toolbar">
        <label class="search"><span class="sr-only">Search invitations</span>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input class="input" id="iq" type="search" placeholder="Search invited leaders and guests…" value="${esc(view.invQ)}">
        </label>
        <button class="btn btn-primary btn-sm" type="button" id="goCreate">+ Create Invite</button>
      </div>
      <div class="funnel" id="funnel"></div>
      <div id="invRows"></div>`;
    $("#iq").oninput = (e) => { view.invQ = e.target.value; paintInvites(); };
    $("#goCreate").onclick = () => { view.tab = "create"; renderDash(); };
    paintInvites();
  }
  function paintInvites() {
    const counts = Object.fromEntries(INV_STATES.map((k) => [k, 0]));
    INVITES.forEach((i) => counts[invStatus(i)]++);
    $("#funnel").innerHTML = INV_STATES.map((k) => `<div><b>${counts[k]}</b><small class="inv-pill inv-${k}">${k}</small></div>`).join("");
    const q = view.invQ.trim().toLowerCase();
    const rows = INVITES.filter((i) => !q || [i.leader_name, i.title, i.company].some((v) => (v || "").toLowerCase().includes(q)));
    const d = (v) => (v ? `<span class="date">${fmtDateTime(v)}</span>` : `<span class="small">—</span>`);
    $("#invRows").innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Leader</th><th>Status</th><th>Created</th><th>First opened</th><th>Started</th><th>Submitted</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((inv) => {
            const st = invStatus(inv);
            const kind = isLive(inv)
              ? `<span class="fmt">Live · ${inv.recording_at ? esc(fmtETShort(inv.recording_at)) : "date not set"}</span>`
              : `<span class="fmt fmt-drop">Leader Drop</span>`;
            return `<tr style="cursor:default">
              <td class="c-who"><b>${esc(inv.leader_name)}</b><span class="small" style="display:block">${esc([inv.title, inv.company].filter(Boolean).join(" · "))}</span>${kind}</td>
              <td><span class="inv-pill inv-${st}">${stLabel(inv, st)}</span></td>
              <td>${d(inv.created_at)}</td>
              <td>${d(inv.first_opened_at)}</td>
              <td>${d(inv.started_at)}</td>
              <td>${d(inv.submitted_at)}</td>
              <td><div class="row-actions">
                <button class="btn btn-ghost btn-sm" type="button" data-copyinv="${inv.id}">${isLive(inv) ? "Copy Live Invite" : "Copy Invitation"}</button>
                <button class="btn btn-text btn-sm" type="button" data-copylink="${inv.id}">Copy link</button>
                ${isLive(inv) ? `<button class="btn btn-text btn-sm" type="button" data-edit="${inv.id}">Edit</button><a class="btn btn-text btn-sm" href="${esc(previewFor(inv))}" target="_blank" rel="noopener">Preview</a>` : ""}
                ${inv.submitted_at ? `<button class="btn btn-text btn-sm" type="button" data-view="${inv.id}">View drop</button>` : `<button class="btn btn-text btn-sm" type="button" data-del="${inv.id}" style="color:#ff8a96">Delete</button>`}
              </div></td></tr>`;
          }).join("") : `<tr style="cursor:default"><td colspan="7"><div class="empty"><b>${INVITES.length ? "No matches." : "No invitations yet."}</b>${INVITES.length ? "Try another name." : "Create one — each leader gets their own link."}</div></td></tr>`}
        </tbody>
      </table></div>`;
    const box = $("#invRows");
    wireResult(box);
    box.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => {
      const drop = DROPS.find((x) => x.invite_id === b.dataset.view);
      if (drop) openDrawer(drop.leader_id);
    }));
    box.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      const inv = INVITES.find((i) => i.id === b.dataset.del);
      if (!confirm(`Delete the invitation for ${inv.leader_name}? The link will stop working immediately.`)) return;
      if (!DEMO) {
        const { error } = await sb.from("leader_drop_invites").delete().eq("id", inv.id);
        if (error) { toast("Couldn’t delete that invitation."); return; }
      }
      INVITES = INVITES.filter((i) => i.id !== inv.id);
      if (lastCreated?.id === inv.id) lastCreated = null;
      renderDash();
    }));
  }

  function renderNoms() {
    const body = $("#tabBody");
    const byId = Object.fromEntries(DROPS.map((d) => [d.leader_id, d]));
    body.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Nominee</th><th>Contact</th><th>Nominated by</th><th>Date</th><th></th></tr></thead>
        <tbody>
          ${NOMS.length ? NOMS.map((n) => {
            const from = byId[n.from_leader_id];
            const isUrl = /linkedin\.com/i.test(n.nominee_contact);
            const href = isUrl ? n.nominee_contact : `mailto:${n.nominee_contact}`;
            return `<tr style="cursor:default">
              <td class="c-who"><b>${esc(n.nominee_name)}</b></td>
              <td class="c-drop"><a href="${esc(href)}" target="_blank" rel="noopener">${esc(n.nominee_contact.replace(/^https?:\/\/(www\.)?/, ""))}</a></td>
              <td>${from ? `${esc(from.name)}<span class="small" style="display:block">${esc(from.company)}</span>` : "—"}</td>
              <td><span class="date">${fmtDate(n.created_at)}</span></td>
              <td><div class="row-actions"><button class="btn btn-ghost btn-sm" type="button" data-prefill="${esc(n.id)}">Create Leader Drop</button></div></td>
            </tr>`;
          }).join("") : `<tr style="cursor:default"><td colspan="5"><div class="empty"><b>No nominations yet.</b>Leaders can pass the mic after they submit.</div></td></tr>`}
        </tbody>
      </table></div>`;
    body.querySelectorAll("[data-prefill]").forEach((b) => (b.onclick = () => {
      const n = NOMS.find((x) => x.id === b.dataset.prefill);
      prefill = { name: n.nominee_name, linkedin: /linkedin\.com/i.test(n.nominee_contact) ? n.nominee_contact : "", note: `Nominated via Pass the Mic (${n.nominee_contact})` };
      view.tab = "create"; renderDash(); $("#c-title").focus();
    }));
  }

  // ---------- leads ----------
  const LEAD_STATES = ["New", "Contacted", "Invited", "Recorded", "Not now"];
  const LEAD_FIELDS = ["name", "title", "company", "linkedin", "email", "source", "topic", "notes", "status", "live_url", "live_date"];
  function leadInvite(l) { return l.invite_id ? INVITES.find((i) => i.id === l.invite_id) : null; }
  // A Leader Drop lead counts as Recorded as soon as its invitation is submitted.
  function leadStatus(l) {
    const inv = leadInvite(l);
    if (inv && inv.submitted_at && l.status !== "Not now") return "Recorded";
    return l.status;
  }
  async function saveLead(id, patch, quiet) {
    const l = LEADS.find((x) => x.id === id);
    if (!l) return false;
    const prev = { ...l };
    Object.assign(l, patch);
    if (!DEMO) {
      const { error } = await sb.from("guest_leads").update(patch).eq("id", id);
      if (error) { Object.assign(l, prev); toast("Couldn’t save that lead."); return false; }
    }
    if (!quiet) toast("Lead saved");
    return true;
  }
  function renderLeads() {
    const body = $("#tabBody");
    if (!leadsReady) {
      body.innerHTML = `<div class="empty"><b>The Live tab isn’t switched on yet.</b>The database table for leads hasn’t been created. Once it is, refresh this page.</div>`;
      return;
    }
    body.innerHTML = `
      <div class="toolbar">
        <label class="search"><span class="sr-only">Search leads</span>
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input class="input" id="lq" type="search" placeholder="Search names, companies, topics…" value="${esc(view.leadQ)}">
        </label>
        <button class="btn btn-primary btn-sm" type="button" id="addLead">+ Add lead</button>
      </div>
      <div class="chips" role="group" aria-label="Filter leads by status" style="margin-bottom:14px">
        ${["All", ...LEAD_STATES].map((s) => `<button class="chip" type="button" data-lf="${s}" aria-pressed="${view.leadF === s}">${s}</button>`).join("")}
      </div>
      <div id="leadRows"></div>`;
    $("#lq").oninput = (e) => { view.leadQ = e.target.value; paintLeads(); };
    $("#addLead").onclick = () => openLeadDrawer(null);
    body.querySelectorAll("[data-lf]").forEach((b) => (b.onclick = () => {
      view.leadF = b.dataset.lf;
      body.querySelectorAll("[data-lf]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      paintLeads();
    }));
    paintLeads();
  }

  function paintLeads() {
    const box = $("#leadRows");
    const q = view.leadQ.trim().toLowerCase();
    const rows = LEADS.filter((l) => (view.leadF === "All" || leadStatus(l) === view.leadF) &&
      (!q || [l.name, l.title, l.company, l.topic, l.source, l.notes].some((v) => (v || "").toLowerCase().includes(q))));
    if (!LEADS.length) {
      box.innerHTML = `<div class="empty"><b>No leads yet.</b>Add anyone you might want on the show. When you’re ready, turn them into a Leader Drop or a live interview with one click.</div>`;
      return;
    }
    if (!rows.length) { box.innerHTML = `<div class="empty"><b>No matches.</b>Try a different name or status.</div>`; return; }
    box.innerHTML = `
      <div class="table-wrap"><table class="leads">
        <thead><tr><th>Lead</th><th>Topic idea</th><th>Status</th><th>Added</th><th></th></tr></thead>
        <tbody>
          ${rows.map((l) => {
            const st = leadStatus(l);
            const inv = leadInvite(l);
            const fmt = inv && isLive(inv)
              ? `<span class="fmt">Live${inv.recording_at ? ` · ${esc(fmtETShort(inv.recording_at))}` : ""} · <a href="${esc(previewFor(inv))}" target="_blank" rel="noopener">page</a></span>`
              : inv ? `<span class="fmt">Leader Drop</span>`
              : l.format === "live" ? `<span class="fmt">Live${l.live_date ? ` · ${fmtDate(l.live_date + "T12:00:00")}` : ""}</span>` : "";
            return `<tr data-lead="${l.id}" tabindex="0" aria-label="Edit ${esc(l.name)}">
              <td class="c-who"><b>${esc(l.name)}</b><span class="small" style="display:block">${esc([l.title, l.company].filter(Boolean).join(" · ") || "—")}</span>
                ${l.source ? `<span class="small lead-src">${esc(l.source)}</span>` : ""}</td>
              <td class="c-drop"><div class="drop-cell">${l.topic ? esc(l.topic) : `<span class="small">—</span>`}</div></td>
              <td><span class="lead-pill lead-${st.replace(/\s/g, "")}">${esc(st)}</span>${fmt}</td>
              <td><span class="date">${fmtDate(l.created_at)}</span></td>
              <td><div class="row-actions">
                ${inv
                  ? `<button class="btn btn-ghost btn-sm" type="button" data-leadinv="${l.id}">Copy ${isLive(inv) ? "live" : "Leader Drop"} invite</button>`
                  : `<button class="btn btn-primary btn-sm" type="button" data-todrop="${l.id}">→ Leader Drop</button>
                     <button class="btn btn-ghost btn-sm" type="button" data-tolive="${l.id}">→ Live interview</button>`}
              </div></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>`;
    box.querySelectorAll("tr[data-lead]").forEach((tr) => {
      tr.addEventListener("click", (e) => { if (e.target.closest("select,button,a")) return; openLeadDrawer(tr.dataset.lead); });
      tr.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === tr) openLeadDrawer(tr.dataset.lead); });
    });
    box.querySelectorAll("[data-todrop]").forEach((b) => (b.onclick = () => leadToDrop(b.dataset.todrop)));
    box.querySelectorAll("[data-tolive]").forEach((b) => (b.onclick = () => leadToLive(b.dataset.tolive)));
    box.querySelectorAll("[data-leadinv]").forEach((b) => (b.onclick = async () => {
      const l = LEADS.find((x) => x.id === b.dataset.leadinv);
      const inv = leadInvite(l);
      if (inv) { await copyInvitation(inv); if (l.status === "New" || l.status === "Contacted") await saveLead(l.id, { status: "Invited" }, true); paintLeads(); }
    }));
  }

  // One click: jump to Create with everything filled in, as a Leader Drop or a live interview.
  function leadToDrop(id) { leadToCreate(id, "drop"); }
  function leadToLive(id) { leadToCreate(id, "live"); }
  function leadToCreate(id, format) {
    const l = LEADS.find((x) => x.id === id);
    prefill = {
      format, name: l.name, title: l.title, company: l.company, linkedin: l.linkedin, leadId: l.id,
      topic: format === "live" ? l.topic || "" : undefined,
      date: format === "live" ? l.live_date || "" : undefined,
      note: [l.source && `Lead source: ${l.source}`, l.topic && `Topic idea: ${l.topic}`].filter(Boolean).join(" · ") || null,
    };
    lastCreated = null;
    view.tab = "create"; renderDash();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openLeadDrawer(id, showLive) {
    const isNew = !id;
    const l = isNew ? { status: "New" } : LEADS.find((x) => x.id === id);
    if (!l) return;
    closeDrawer();
    const bg = document.createElement("div"); bg.className = "drawer-bg";
    const d = document.createElement("aside"); d.className = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.setAttribute("aria-label", isNew ? "Add lead" : l.name);
    const inv = leadInvite(l);
    const f = (key, label, attrs = "") => `<div class="field"><label for="lf-${key}">${label}</label><input class="input" id="lf-${key}" ${attrs} value="${esc(l[key] || "")}"></div>`;
    d.innerHTML = `
      <div class="drawer-head">
        <p class="eyebrow" style="margin:0">${isNew ? "New lead" : "Lead"}</p>
        <button class="icon-btn" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <form id="leadForm" class="fields" novalidate>
        <div class="create-grid2">
          ${f("name", "Name", 'required maxlength="120" placeholder="Jane Smith"')}
          ${f("title", "Title", 'maxlength="160" placeholder="Engineering Manager"')}
          ${f("company", "Company", 'maxlength="160" placeholder="PSEG"')}
          ${f("linkedin", "LinkedIn URL", 'maxlength="300" inputmode="url" autocapitalize="off" placeholder="linkedin.com/in/…"')}
          ${f("email", "Email", 'type="email" maxlength="200" autocapitalize="off" placeholder="optional"')}
          ${f("source", "How you found them", 'maxlength="200" placeholder="NJIT alum, met at career fair…"')}
        </div>
        <div class="field"><label for="lf-topic">Topic idea</label><input class="input" id="lf-topic" maxlength="200" placeholder="switching from engineering to product" value="${esc(l.topic || "")}"></div>
        <div class="field"><label for="lf-notes">Notes</label><textarea class="input qbox" id="lf-notes" rows="3" maxlength="2000">${esc(l.notes || "")}</textarea></div>
        <div class="create-grid2">
          <div class="field"><label for="lf-status">Status</label><select class="input" id="lf-status">${LEAD_STATES.map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>

        </div>
        <div class="field-err" id="lf-err" hidden></div>
        <div class="a-row">
          <button class="btn btn-primary" type="submit" id="lf-go">${isNew ? "Add lead" : "Save"}</button>
          ${isNew ? "" : `<button class="btn btn-text btn-sm" type="button" id="lf-del" style="color:#ff8a96">Delete lead</button>`}
        </div>
      </form>
      ${isNew ? "" : `
      <div class="answer">
        <div class="qn">Turn into a guest</div>
        <div class="a-row">
          ${inv
            ? `<button class="btn btn-primary btn-sm" type="button" data-dinv>Copy ${isLive(inv) ? "live" : "Leader Drop"} invite</button>
               ${isLive(inv) ? `<button class="btn btn-ghost btn-sm" type="button" data-dedit>Edit live interview</button><a class="btn btn-text btn-sm" href="${esc(previewFor(inv))}" target="_blank" rel="noopener">Open their page</a>` : ""}
               <span class="small" style="align-self:center">${isLive(inv) ? `Live${inv.recording_at ? " · " + esc(fmtETShort(inv.recording_at)) : ""}` : "Leader Drop"}: <span class="inv-pill inv-${invStatus(inv)}">${stLabel(inv, invStatus(inv))}</span></span>`
            : `<button class="btn btn-primary btn-sm" type="button" data-ddrop>→ Leader Drop</button>
               <button class="btn btn-ghost btn-sm" type="button" data-dlive>→ Live interview</button>`}
        </div>
      </div>`}`;
    document.body.append(bg, d);
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", onKey);
    d._off = () => document.removeEventListener("keydown", onKey);
    bg.onclick = closeDrawer;
    d.querySelector("[data-close]").onclick = closeDrawer;
    (isNew ? d.querySelector("#lf-name") : d.querySelector("[data-close]")).focus();

    d.querySelector("#leadForm").onsubmit = async (e) => {
      e.preventDefault();
      const err = d.querySelector("#lf-err"); err.hidden = true;
      const val = (k) => { const el = d.querySelector(`#lf-${k}`); return el ? el.value.trim() : undefined; };
      const row = {};
      LEAD_FIELDS.forEach((k) => { const v = val(k); if (v !== undefined) row[k] = v || null; });
      if (!row.name) { d.querySelector("#lf-name").setAttribute("aria-invalid", "true"); d.querySelector("#lf-name").focus(); return; }
      row.status = row.status || "New";
      if (row.linkedin) row.linkedin = normLinkedin(row.linkedin);
      if (row.live_url) row.live_url = normLinkedin(row.live_url);
      const btn = d.querySelector("#lf-go"); btn.disabled = true;
      if (isNew) {
        let made;
        if (DEMO) made = { id: crypto.randomUUID(), created_at: new Date().toISOString(), format: null, invite_id: null, ...row };
        else {
          const { data, error } = await sb.from("guest_leads").insert(row).select().single();
          if (error) { err.hidden = false; err.textContent = "Couldn’t add the lead: " + error.message; btn.disabled = false; return; }
          made = data;
        }
        LEADS.unshift(made);
        toast("Lead added");
      } else if (!(await saveLead(l.id, row))) { btn.disabled = false; return; }
      closeDrawer(); renderDash();
    };
    if (!isNew) {
      d.querySelector("#lf-del").onclick = async () => {
        if (!confirm(`Delete ${l.name} from your leads? Any Leader Drop invitation already made stays.`)) return;
        if (!DEMO) {
          const { error } = await sb.from("guest_leads").delete().eq("id", l.id);
          if (error) { toast("Couldn’t delete that lead."); return; }
        }
        LEADS = LEADS.filter((x) => x.id !== l.id);
        closeDrawer(); renderDash();
      };
      d.querySelector("[data-ddrop]")?.addEventListener("click", () => { closeDrawer(); leadToDrop(l.id); });
      d.querySelector("[data-dinv]")?.addEventListener("click", async () => { await copyInvitation(inv); if (l.status === "New" || l.status === "Contacted") await saveLead(l.id, { status: "Invited" }, true); });
      d.querySelector("[data-dlive]")?.addEventListener("click", () => { closeDrawer(); leadToLive(l.id); });
      d.querySelector("[data-dedit]")?.addEventListener("click", () => openInviteEditor(inv));
    }
  }

  // ---------- demo data ----------
  function seedDemo() {
    const now = Date.now(), day = 86400000;
    const mk = (i, name, title, company, drop, status, days, extra = {}) => ({
      leader_id: "demo-" + i, invite_id: "inv-" + i, name, title, company,
      linkedin: `https://www.linkedin.com/in/${slug(name)}`, intro_name: name, intro_line: `${title} • ${company}`,
      question_1: DEFAULT_Q[0], question_2: DEFAULT_Q[1], question_3: DEFAULT_Q[2],
      video_1_url: `inv-${i}/q0.mp4`, video_2_url: `inv-${i}/q1.mov`, video_3_url: `inv-${i}/q2.mp4`,
      one_drop: drop, one_drop_video_url: null, headshot_url: null, permission_granted: true,
      permission_granted_at: new Date(now - days * day).toISOString(), submission_timestamp: new Date(now - days * day).toISOString(), status, ...extra,
    });
    DROPS = [
      mk(1, "Priya Raman", "Director of Engineering", "Northwind Health", "Your manager can’t advocate for work they never hear about.", "Submitted", 0.2),
      mk(2, "Marcus Webb", "Senior Product Manager", "Halcyon Logistics", null, "Submitted", 1, { one_drop_video_url: "inv-2/drop.mp4" }),
      mk(3, "Dana Okafor", "VP, Clinical Operations", "Meridian Bio", "Say yes to the messy project nobody wants.", "Editing", 4),
      mk(4, "Luis Ortega", "Plant Manager", "Garden State Energy", "Learn the business before you try to change it.", "Scheduled", 9),
      mk(5, "Hannah Cho", "Head of Talent", "Brightline Studios", "Ask for feedback before you need it.", "Published", 21),
    ];
    const iso = (x) => new Date(now - x * day).toISOString();
    INVITES = [
      { id: "inv-6", slug: "sam-patel-h3k9dq", leader_name: "Sam Patel", title: "Engineering Manager", company: "PSEG", created_at: iso(2), sent_at: iso(2), first_opened_at: iso(1), started_at: iso(0.9), submitted_at: null },
      { id: "inv-8", slug: "ana-lopez-p2m7zc", leader_name: "Ana Lopez", title: "Senior Consultant", company: "Deloitte", created_at: iso(1.5), sent_at: iso(1.4), first_opened_at: iso(1.2), started_at: null, submitted_at: null },
      { id: "inv-9", slug: "chris-lee-t8w4nb", leader_name: "Chris Lee", title: "Product Lead", company: "Prudential", created_at: iso(1.2), sent_at: iso(1.1), first_opened_at: null, started_at: null, submitted_at: null },
      { id: "inv-10", format: "live", slug: "elena-novak-k4m8pt", leader_name: "Elena Novak", title: "Product Marketing Lead", company: "Prudential", topic: "Career pivots without starting over", recording_at: new Date(now + 6 * day).toISOString(), meeting_url: null, question_1: LIVE_Q[0], question_2: LIVE_Q[1], question_3: LIVE_Q[2], created_at: iso(4), sent_at: iso(4), first_opened_at: iso(3), started_at: null, submitted_at: null },
      { id: "inv-7", slug: "rachel-kim-q5r2xa", leader_name: "Rachel Kim", title: "Director of HR", company: "Hackensack Meridian", created_at: iso(0.3), sent_at: null, first_opened_at: null, started_at: null, submitted_at: null },
      ...DROPS.map((d, i) => ({ id: d.invite_id, slug: `${slug(d.name)}-a1b2c3`, leader_name: d.name, title: d.title, company: d.company, created_at: iso(i + 25), sent_at: iso(i + 25), first_opened_at: d.submission_timestamp, started_at: d.submission_timestamp, submitted_at: d.submission_timestamp })),
    ];
    LEADS = [
      { id: "lead-1", name: "Jordan Reyes", title: "Senior Data Analyst", company: "Hackensack Meridian Health", linkedin: "https://www.linkedin.com/in/jordan-reyes", source: "NJIT alum, BME ’17", topic: "moving from analyst to manager without an MBA", status: "New", format: null, invite_id: null, created_at: iso(0.5) },
      { id: "lead-2", name: "Tasha Greene", title: "Founder", company: "Greene Street Bakery", source: "Instagram follower", topic: "leaving a corporate job to start a small business", status: "Contacted", format: null, invite_id: null, created_at: iso(3) },
      { id: "lead-3", name: "Sam Patel", title: "Engineering Manager", company: "PSEG", source: "Referred by Richard Klein", topic: "your first year managing former peers", status: "Invited", format: "leader_drop", invite_id: "inv-6", created_at: iso(6) },
      { id: "lead-4", name: "Elena Novak", title: "Product Marketing Lead", company: "Prudential", source: "LinkedIn post on career pivots", topic: "career pivots", status: "Invited", format: "live", live_url: `${location.origin}/live/elena-novak-k4m8pt`, live_invited_at: iso(4), live_date: new Date(now + 6 * day).toISOString().slice(0, 10), invite_id: "inv-10", created_at: iso(8) },
    ];
    NOMS = [{ id: "n1", from_leader_id: "demo-1", nominee_name: "Rachel Kim", nominee_contact: "https://www.linkedin.com/in/rachel-kim", created_at: new Date(now - 0.2 * day).toISOString() }];
  }

  if (sb) sb.auth.onAuthStateChange((evt) => { if (evt === "SIGNED_OUT") screenLogin(); });
  start();
})();
