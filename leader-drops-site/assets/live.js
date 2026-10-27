/* LaunchPad EIC — Live guest page
   One personal link per guest: when and how the conversation happens, their three
   questions, and a short form for the details we use to introduce them.
   Vanilla JS, no build step. Lives on the Leader Drops site at /live/<code>; same database as Leader Drops. */
(() => {
  "use strict";

  // Shared settings (database address, public key, contact email) live in
  // /assets/config.js, the same file the Leader Drop pages use.
  const LD = window.LD_CONFIG || {};
  const C = {
    SUPABASE_URL: LD.SUPABASE_URL,
    // Public "anon" key: safe in the browser. Reads and writes go through
    // ld_live_get / ld_live_save, which only touch the invite behind this link.
    SUPABASE_ANON_KEY: LD.SUPABASE_ANON_KEY,
    BUCKET: LD.BUCKET || "leader-drops",
    MAX_HEADSHOT_MB: LD.MAX_HEADSHOT_MB || 15,
    CONTACT_EMAIL: LD.CONTACT_EMAIL || "launchpadeic@gmail.com",
    // "Add to Apple Calendar": a real .ics file built from the database.
    ICS_URL: (LD.SUPABASE_URL || "") + "/functions/v1/launchpad-ics",
    HOST_TZ: "America/New_York",
    LENGTH_MIN: 10,
  };

  const params = new URLSearchParams(location.search);
  const pathCode = (location.pathname.match(/\/(?:live|g)\/([^/?#]+)/) || [])[1] || params.get("i") || "";
  const CODE = decodeURIComponent(pathCode).trim().toLowerCase();
  const sb = window.supabase
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const MB = 1024 * 1024;
  const $ = (sel, root = document) => root.querySelector(sel);
  const main = $("#main");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const linkedinOk = (v) => /^(https?:\/\/)?([a-z0-9-]+\.)?linkedin\.com\/\S+/i.test(v.trim());
  const normLinkedin = (v) => { v = v.trim(); return v && !/^https?:\/\//i.test(v) ? "https://" + v : v; };
  const fmtMB = (b) => (b / MB).toFixed(1) + " MB";

  const ICON = {
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/></svg>',
  };

  function toast(msg, ms = 3200) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function screenState(title, body) {
    main.innerHTML = `<section class="screen"><div class="state">
      <p class="eyebrow">LaunchPad EIC</p>
      <h1 class="headline" style="margin-top:14px">${title}</h1>
      <p class="lede">${body}</p>
    </div></section>`;
  }

  // ---------- time ----------
  function partsIn(date, tz, opts) { return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(date); }
  function describeWhen(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hostTime = partsIn(d, C.HOST_TZ, { hour: "numeric", minute: "2-digit" });
    const localTime = partsIn(d, localTz, { hour: "numeric", minute: "2-digit" });
    const hostDay = partsIn(d, C.HOST_TZ, { weekday: "long", month: "long", day: "numeric" });
    const localDay = partsIn(d, localTz, { weekday: "long", month: "long", day: "numeric" });
    const differs = hostTime !== localTime || hostDay !== localDay;
    return {
      date: d,
      short: partsIn(d, C.HOST_TZ, { weekday: "short", month: "short", day: "numeric" }),
      day: hostDay,
      time: hostTime + " ET",
      local: differs ? `${localTime} your time${localDay !== hostDay ? ", " + localDay : ""}` : "",
      past: Date.now() > d.getTime() + 2 * 3600 * 1000,
    };
  }

  // ---------- calendar ----------
  const calUtc = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  function eventFor(D, when) {
    return {
      title: "LaunchPad EIC conversation",
      start: calUtc(when.date),
      end: calUtc(when.date.getTime() + 20 * 60 * 1000),
      location: D.meeting_url || "Online",
      details: [
        "Short, casual conversation for LaunchPad EIC (about " + C.LENGTH_MIN + " minutes).",
        D.topic ? "Topic: " + D.topic : "",
        D.meeting_url ? "Join: " + D.meeting_url : "Meeting link to follow.",
        "Your questions: " + location.origin + "/live/" + D.slug,
      ].filter(Boolean).join("\n"),
    };
  }

  // Apple Calendar (and Outlook) use the hosted .ics file at C.ICS_URL, which builds the
  // same event from the database. Google Calendar opens a pre-filled "new event" page.
  function googleCalFor(D, when) {
    const ev = eventFor(D, when);
    const q = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates: ev.start + "/" + ev.end, details: ev.details, location: ev.location });
    return "https://calendar.google.com/calendar/render?" + q.toString();
  }

  // ---------- image ----------
  async function shrinkImage(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.88));
      return blob ? new File([blob], "headshot.jpg", { type: "image/jpeg" }) : file;
    } catch (_) { return file; }
  }

  // ---------- state ----------
  let D = null;
  const F = { name: "", title: "", company: "", linkedin: "", bio: "" };
  const HS = { path: null, url: null, status: "none", pct: 0 }; // headshot
  let dirty = false;
  let saving = false;

  window.addEventListener("beforeunload", (e) => {
    if ((dirty || HS.status === "uploading") && D && !D.preview) { e.preventDefault(); e.returnValue = ""; }
  });

  async function load() {
    if (!sb) return screenState("Something didn’t load", "Refresh the page to try again.");
    if (!/^[a-z0-9-]{3,70}$/.test(CODE)) {
      return screenState("This page needs your personal link", `Use the link we sent you. If you can’t find it, email <a href="mailto:${C.CONTACT_EMAIL}">${C.CONTACT_EMAIL}</a>.`);
    }
    const { data, error } = await sb.rpc("ld_live_get", { p_code: CODE });
    if (error) return screenState("We couldn’t load your page", "Check your connection and refresh.");
    if (!data) return screenState("We couldn’t find this link", `Double-check the link, or email <a href="mailto:${C.CONTACT_EMAIL}">${C.CONTACT_EMAIL}</a> and we’ll sort it out.`);
    if (data.format !== "live") { location.replace("/drop/" + encodeURIComponent(data.slug)); return; }
    D = data;
    Object.assign(F, { name: D.leader_name || "", title: D.title || "", company: D.company || "", linkedin: D.linkedin || "", bio: D.bio || "" });
    if (D.headshot) {
      HS.path = D.headshot; HS.status = "done";
      try {
        const { data: s } = await sb.storage.from(C.BUCKET).createSignedUrl(D.headshot, 3600);
        HS.url = s?.signedUrl || null;
      } catch (_) {}
    }
    document.title = (D.preview ? "Preview · " : "") + `${firstName(D.leader_name)}’s Conversation · LaunchPad EIC`;
    render();
  }

  function render() {
    const name = firstName(D.leader_name);
    const when = describeWhen(D.recording_at);
    const qs = (D.questions || []).filter(Boolean);
    const ro = !!D.preview;
    const savedLine = D.saved_at
      ? "Saved " + new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(D.saved_at))
      : "";

    main.innerHTML = `
    <section class="screen">
      ${ro ? `<div class="notice preview"><b>Preview.</b> This is the page ${esc(name || "your guest")} sees. ${D.saved_at ? "Their details are below (last " + esc(savedLine.replace(/^Saved/, "saved")) + ")." : "They haven’t added their details yet."}</div>` : ""}
      <p class="eyebrow" style="margin-top:14px">You’re invited <span class="dim">/</span> Live conversation</p>
      <p class="welcome">${name ? esc(name) + ", you’re" : "You’re"} on LaunchPad EIC.</p>
      <h1 class="headline">${esc(D.topic || "Your conversation")}</h1>
      <p class="lede">A short, casual conversation for early-career professionals. Everything you need is here, including your questions so you can think ahead.</p>

      <div class="promise">
        ${when ? `<div><strong>${esc(when.short)}</strong><span>${esc(when.time)}${when.local ? `<em>${esc(when.local)}</em>` : ""}</span></div>` : `<div><strong>Date</strong><span>We’ll confirm a time with you.</span></div>`}
        <div><strong>~${C.LENGTH_MIN} min</strong><span>Relaxed video conversation</span></div>
        <div><strong>3 questions</strong><span>Below, so nothing catches you off guard</span></div>
      </div>
      <div class="when-actions">
        ${D.meeting_url ? `<a class="btn btn-primary btn-block" href="${esc(D.meeting_url)}" target="_blank" rel="noopener">${ICON.video} Join the Call</a>` : ""}
        ${when && !when.past ? `<p class="cal-label">Add it to your calendar</p>
        <div class="cal-row">
          <a class="btn btn-ghost" id="calApple" href="#">${ICON.cal} Apple Calendar</a>
          <a class="btn btn-ghost" id="calGoogle" href="#" target="_blank" rel="noopener">${ICON.cal} Google Calendar</a>
        </div>` : ""}
        ${D.meeting_url ? "" : `<p class="small center">The meeting link is coming before the call.</p>`}
      </div>

      <div class="section">
        <p class="eyebrow">Prep</p>
        <h2>Your three questions</h2>
        <p class="lede">No script needed. One real story per question is perfect.</p>
        <ol class="qlist">
          ${qs.map((q, i) => `<li><span class="qn">0${i + 1}</span><p>${esc(q)}</p></li>`).join("")}
        </ol>
        <p class="prep-note">It’s a conversation, not a test. Follow-ups come naturally, and nothing is published until it’s edited.</p>
      </div>

      <div class="section" id="about">
        <p class="eyebrow">${ro ? "Their details" : "One quick favor"}</p>
        <h2>Help us introduce you</h2>
        <p class="lede">${ro ? "What they’ve shared for the title card, thumbnail and description." : "We use this for your title card, thumbnail and episode description. It takes a minute."}</p>

        <p class="intro-label">Here’s how we’ll introduce you</p>
        <div class="lower-third" aria-live="polite">
          <div class="lt-photo" id="ltPhoto" hidden></div>
          <div class="lt-card"><div><div class="lt-name" id="ltName"></div><div class="lt-line" id="ltLine"></div></div></div>
        </div>

        <div class="fields">
          <div class="field"><label for="f-name">Full name</label>
            <input class="input" id="f-name" autocomplete="name" maxlength="120" value="${esc(F.name)}" ${ro ? "disabled" : ""}></div>
          <div class="field"><label for="f-title">Title</label>
            <input class="input" id="f-title" autocomplete="organization-title" maxlength="160" value="${esc(F.title)}" ${ro ? "disabled" : ""}></div>
          <div class="field"><label for="f-company">Company</label>
            <input class="input" id="f-company" autocomplete="organization" maxlength="160" value="${esc(F.company)}" ${ro ? "disabled" : ""}></div>
          <div class="field"><label for="f-linkedin">LinkedIn <span class="opt">(optional)</span></label>
            <input class="input" id="f-linkedin" inputmode="url" autocapitalize="off" autocorrect="off" maxlength="300" placeholder="linkedin.com/in/yourname" value="${esc(F.linkedin)}" ${ro ? "disabled" : ""}>
            <span class="field-err" id="e-linkedin" hidden>That doesn’t look like a LinkedIn link. It should include linkedin.com/.</span></div>
          <div class="field"><label for="f-bio">Short bio</label>
            ${ro
              ? (F.bio ? `<p class="bio-read" id="f-bio">${esc(F.bio)}</p>` : `<p class="bio-read" id="f-bio" style="color:var(--muted)">No bio yet.</p>`)
              : `<div class="bio-wrap"><textarea class="input" id="f-bio" maxlength="800" placeholder="Two or three sentences: what you do, where you’ve been, what you care about.">${esc(F.bio)}</textarea><span class="counter" id="bioCount"></span></div>`}
          </div>
          <div class="field"><span class="label">Headshot</span>
            <label class="headshot-pick ${ro ? "readonly" : ""}" ${ro ? "" : 'for="f-headshot"'}>
              <span class="avatar" id="hsAvatar"></span>
              <span><b id="hsLabel"></b><small id="hsSub"></small></span>
            </label>
            ${ro ? "" : `<input type="file" id="f-headshot" accept="image/*" hidden>`}
          </div>
        </div>

        ${ro ? (HS.url ? `<p class="small center" style="margin-top:12px"><a href="${esc(HS.url)}" target="_blank" rel="noopener">Open the full-size headshot</a></p>` : "")
          : `<div id="saveMsg"></div>
        <div class="save-row">
          <button class="btn btn-primary btn-block" id="save" type="button">${D.saved_at ? "Update My Details" : "Save My Details"} <span class="arrow">→</span></button>
          <p class="small saved-at" id="savedAt">${D.saved_at ? "✓ " + esc(savedLine) + ". You can update this anytime before the call." : ""}</p>
        </div>`}
      </div>

      <p class="small center footer-note">Questions? Email <a href="mailto:${C.CONTACT_EMAIL}">${C.CONTACT_EMAIL}</a></p>
    </section>`;

    // calendar
    const apple = $("#calApple"), google = $("#calGoogle");
    // A real https link to a .ics file: iPhone and Mac open it straight into "Add to Calendar".
    if (apple && when) apple.href = C.ICS_URL + "?i=" + encodeURIComponent(D.slug);
    if (google && when) google.href = googleCalFor(D, when);

    paintIntro();
    paintHeadshot();
    if (ro) return;

    const f = (id) => $("#" + id);
    ["name", "title", "company", "linkedin"].forEach((k) => {
      f("f-" + k).addEventListener("input", (e) => {
        F[k] = e.target.value; dirty = true;
        if (k === "linkedin") { f("e-linkedin").hidden = true; e.target.removeAttribute("aria-invalid"); }
        if (k === "title" || k === "company") e.target.removeAttribute("aria-invalid");
        paintIntro();
      });
    });
    f("f-linkedin").addEventListener("blur", (e) => {
      const bad = e.target.value.trim() && !linkedinOk(e.target.value);
      f("e-linkedin").hidden = !bad; e.target.setAttribute("aria-invalid", bad ? "true" : "false");
    });
    const bio = f("f-bio"), count = f("bioCount");
    const syncCount = () => { count.textContent = `${bio.value.length}/800`; };
    bio.addEventListener("input", () => { F.bio = bio.value; dirty = true; syncCount(); });
    syncCount();

    f("f-headshot").addEventListener("change", onHeadshot);
    f("save").addEventListener("click", save);
  }

  function paintIntro() {
    const n = $("#ltName"), l = $("#ltLine"), p = $("#ltPhoto");
    if (!n) return;
    n.textContent = F.name.trim() || "Your Name";
    l.textContent = [F.title.trim(), F.company.trim()].filter(Boolean).join(" • ") || "Title • Company";
    if (HS.url) { p.hidden = false; p.innerHTML = `<img alt="" src="${esc(HS.url)}">`; } else { p.hidden = true; p.innerHTML = ""; }
  }

  function paintHeadshot() {
    const av = $("#hsAvatar"), label = $("#hsLabel"), sub = $("#hsSub");
    if (!av) return;
    if (HS.url) av.innerHTML = `<img alt="" src="${esc(HS.url)}">`;
    else av.textContent = (F.name.trim()[0] || "+").toUpperCase();
    if (D.preview) {
      label.textContent = HS.path ? "Headshot added" : "No headshot yet";
      sub.textContent = HS.path ? "Shown on the left." : "";
      return;
    }
    if (HS.status === "uploading") { label.textContent = "Uploading photo…"; sub.textContent = "One moment."; }
    else if (HS.status === "error") { label.textContent = "That photo didn’t upload"; sub.textContent = "Tap to try again, or choose another photo."; }
    else if (HS.path) { label.textContent = "Photo added ✓"; sub.textContent = "Tap to replace it."; }
    else { label.textContent = "Add a headshot"; sub.textContent = "A clear, recent photo. JPG or PNG."; }
  }

  async function onHeadshot(e) {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) { toast("Choose a JPG or PNG photo."); return; }
    if (file.size > C.MAX_HEADSHOT_MB * MB) { toast(`That photo is ${fmtMB(file.size)}. Keep it under ${C.MAX_HEADSHOT_MB} MB.`); return; }
    HS.status = "uploading"; paintHeadshot();
    const small = await shrinkImage(file);
    const path = `${D.invite_id}/headshot-live-${Date.now()}.jpg`;
    const prevUrl = HS.url;
    HS.url = URL.createObjectURL(small); paintHeadshot(); paintIntro();
    try {
      const { error } = await sb.storage.from(C.BUCKET).upload(path, small, { contentType: small.type || "image/jpeg", upsert: false, cacheControl: "3600" });
      if (error) throw error;
      HS.path = path; HS.status = "done"; dirty = true;
    } catch (_) {
      HS.status = "error"; HS.url = prevUrl;
    }
    paintHeadshot(); paintIntro();
  }

  async function save() {
    if (saving) return;
    const btn = $("#save"), msg = $("#saveMsg");
    msg.innerHTML = "";
    const missing = [];
    if (!F.title.trim()) { missing.push("title"); $("#f-title").setAttribute("aria-invalid", "true"); }
    if (!F.company.trim()) { missing.push("company"); $("#f-company").setAttribute("aria-invalid", "true"); }
    if (missing.length) { msg.innerHTML = `<div class="notice err" role="alert">Add your ${missing.join(" and ")} so we can introduce you.</div>`; return; }
    if (F.linkedin.trim() && !linkedinOk(F.linkedin)) {
      $("#e-linkedin").hidden = false; $("#f-linkedin").setAttribute("aria-invalid", "true");
      msg.innerHTML = `<div class="notice err" role="alert">Fix the LinkedIn link, or clear it.</div>`; return;
    }
    if (HS.status === "uploading") { toast("Your photo is still uploading. One moment."); return; }

    saving = true; btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Saving…`;
    const payload = {
      name: F.name.trim(), title: F.title.trim(), company: F.company.trim(),
      linkedin: normLinkedin(F.linkedin) || null,
      bio: F.bio.trim() || null,
      headshot_url: HS.path || null,
    };
    try {
      const { data, error } = await sb.rpc("ld_live_save", { p_invite: D.invite_id, p: payload });
      if (error) {
        const m = error.message || "";
        const friendly = {
          missing_details: "Add your title and company so we can introduce you.",
          bad_linkedin: "That LinkedIn link doesn’t look right. Fix it, or clear it.",
          missing_upload: "Your photo didn’t finish saving. Choose it again, then save.",
          too_long: "One of the fields is too long. Shorten it and try again.",
          invalid_link: `This link isn’t active anymore. Email ${C.CONTACT_EMAIL} and we’ll sort it out.`,
        };
        const key = Object.keys(friendly).find((k) => m.includes(k));
        throw new Error(key ? friendly[key] : "We couldn’t save just now. Check your connection and try again.");
      }
      dirty = false;
      D.saved_at = new Date().toISOString();
      F.linkedin = payload.linkedin || "";
      const fn = data?.first_name || firstName(F.name);
      msg.innerHTML = `<div class="notice ok" role="status">Saved. Thank you${fn ? ", " + esc(fn) : ""}! See you on the call.</div>`;
      const savedLine = "Saved " + new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date());
      $("#savedAt").textContent = "✓ " + savedLine + ". You can update this anytime before the call.";
      btn.innerHTML = `Update My Details <span class="arrow">→</span>`;
    } catch (err) {
      msg.innerHTML = `<div class="notice err" role="alert">${esc(err.message)}</div>`;
      btn.innerHTML = `${D.saved_at ? "Update My Details" : "Save My Details"} <span class="arrow">→</span>`;
    } finally {
      saving = false; btn.disabled = false;
    }
  }

  load();
})();
