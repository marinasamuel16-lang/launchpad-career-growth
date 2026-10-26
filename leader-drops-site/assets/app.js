/* LaunchPad EIC — Leader Drops (leader-facing flow)
   Vanilla JS, no build step. Screens render into #main. */
(() => {
  "use strict";

  const C = window.LD_CONFIG;
  const params = new URLSearchParams(location.search);
  const DEMO = params.has("demo");
  const pathCode = (location.pathname.match(/\/drop\/([^/?#]+)/) || [])[1] || "";
  const CODE = DEMO ? "demo" : decodeURIComponent(pathCode || params.get("i") || "").trim().toLowerCase();
  let INVITE = DEMO ? "00000000-0000-4000-8000-000000000000" : ""; // storage folder id, set after the invitation loads
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const CODE_RE = /^[a-z0-9-]{3,60}$/;
  const MB = 1024 * 1024;
  const sb = !DEMO && window.supabase
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  const DEFAULT_QUESTIONS = [
    "What took you way too long to understand about building a successful career?",
    "What career advice do you disagree with — and what would you tell someone instead?",
    "If you were starting your career again tomorrow, what would you do differently?",
  ];
  const HINTS = [
    "Think: a lesson you learned through experience rather than something you read.",
    "Think: the advice everyone repeats that didn't hold up for you.",
    "Think: the move you'd make earlier, or the one you'd skip entirely.",
  ];
  const PERMISSION_TEXT =
    "I give Launchpad EIC permission to edit, caption, excerpt, publish, and distribute the video responses I submitted across Launchpad EIC's website, YouTube, social media channels, newsletters, and promotional materials.";

  // Progress segments shown in the top bar (story style)
  const SEGMENTS = ["q0", "q1", "q2", "drop", "about", "release"];

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtTime = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const fmtMB = (b) => (b >= MB * 100 ? Math.round(b / MB) : (b / MB).toFixed(1)) + " MB";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const isTouch = matchMedia("(pointer: coarse)").matches;

  const ICON = {
    upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
    flip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h13a3 3 0 0 1 3 3v1"/><path d="m6 4-3 3 3 3"/><path d="M21 17H8a3 3 0 0 1-3-3v-1"/><path d="m18 20 3-3-3-3"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M17 9.5a4 4 0 0 1 0 5"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M8 7h7M8 11h5"/></svg>',
    yt: '<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15V9l5.8 3-5.8 3z"/></svg>',
    li: '<svg viewBox="0 0 24 24"><path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6h.1a3.8 3.8 0 0 1 3.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.3zM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1zM7.1 20.5H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z"/></svg>',
    rocket: '<svg viewBox="0 0 24 24"><path d="M12 2c3.5 2 5.5 5.6 5.5 9.6 0 1.3-.2 2.6-.6 3.8H7.1c-.4-1.2-.6-2.5-.6-3.8C6.5 7.6 8.5 4 12 2zm0 6.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7.6 16.5h8.8L15 20H9l-1.4-3.5zM9.5 21h5l-.6 1.5h-3.8L9.5 21z"/></svg>',
  };

  // ---------- persisted state (survives refresh) ----------
  const KEY = `ld:v2:${CODE || "none"}`;
  const fresh = () => ({
    step: "landing",
    answers: [null, null, null],          // {path,size,type,duration,source}
    drop: { mode: "text", text: "", video: null },
    about: { name: "", title: "", company: "", linkedin: "", bio: "", prefilled: false, headshot: null },
    permission: false,
    result: null,                         // {leader_id, first_name}
    nominated: false,
  });
  let S = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const f0 = fresh(); S = Object.assign(f0, JSON.parse(raw)); S.about = Object.assign(fresh().about, S.about || {}); }
  } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };

  let INVITE_DATA = null; // {leader_name, questions[], submitted}

  // ---------- upload manager ----------
  // slot: q0 | q1 | q2 | drop | headshot
  const U = {};
  const listeners = new Set();
  const emit = (slot) => listeners.forEach((fn) => fn(slot));

  const EXT = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v", "video/3gpp": "3gp", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
  const TYPE_BY_EXT = { mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm", "3gp": "video/3gpp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };
  function contentTypeOf(file) {
    const t = (file.type || "").split(";")[0].toLowerCase();
    if (EXT[t]) return t;
    const ext = (file.name || "").split(".").pop().toLowerCase();
    return TYPE_BY_EXT[ext] || t || "application/octet-stream";
  }

  function slotSaved(slot) {
    if (slot === "headshot") return S.about.headshot;
    if (slot === "drop") return S.drop.video;
    return S.answers[+slot.slice(1)];
  }
  function setSlotSaved(slot, val) {
    if (slot === "headshot") S.about.headshot = val;
    else if (slot === "drop") S.drop.video = val;
    else S.answers[+slot.slice(1)] = val;
    save();
  }

  function clearSlot(slot) {
    const u = U[slot];
    if (u) {
      u.cancelled = true;
      try { u.tus && Promise.resolve(u.tus.abort(false)).catch(() => {}); } catch (_) {}
      clearInterval(u.timer);
      if (u.objectUrl) URL.revokeObjectURL(u.objectUrl);
      delete U[slot];
    }
    setSlotSaved(slot, null);
    emit(slot);
  }

  function uploadErrorMessage(status, body) {
    if (status === 413 || /too large|exceeded the maximum/i.test(body)) return "This file is larger than our uploader accepts. Record in the browser instead, or trim the video and try again.";
    if (status === 415 || /mime|content type|not supported/i.test(body)) return "This video format isn't supported. Please use an .mp4 or .mov file.";
    if (status === 401 || status === 403) return "This link is no longer accepting uploads. If you think that's a mistake, email " + C.CONTACT_EMAIL + ".";
    return "The upload didn't go through — check your connection and tap Retry.";
  }

  function startUpload(slot, file, meta = {}) {
    clearSlot(slot);
    const type = contentTypeOf(file);
    const ext = EXT[type] || "bin";
    const path = `${INVITE}/${slot}-${Date.now()}.${ext}`;
    const u = (U[slot] = { status: "uploading", pct: 0, file, type, path, meta, objectUrl: meta.objectUrl || null, error: null });
    u.promise = new Promise((resolve) => (u.resolve = resolve));

    const done = () => {
      if (u.cancelled) return;
      u.status = "done"; u.pct = 100;
      setSlotSaved(slot, { path, size: file.size, type, duration: meta.duration || null, source: meta.source || "upload", name: meta.previewName || null });
      emit(slot); u.resolve(true);
    };
    const fail = (msg) => {
      if (u.cancelled) return;
      u.status = "error"; u.error = msg;
      emit(slot); u.resolve(false);
    };
    const progress = (p) => { if (!u.cancelled) { u.pct = Math.min(99, p); emit(slot); } };

    if (DEMO) {
      const total = Math.min(4200, 1400 + file.size / 40000);
      const t0 = Date.now();
      u.timer = setInterval(() => {
        const p = ((Date.now() - t0) / total) * 100;
        if (p >= 100) { clearInterval(u.timer); done(); } else progress(p);
      }, 120);
      return u;
    }

    if (slot === "headshot") {
      progress(20);
      sb.storage.from(C.BUCKET).upload(path, file, { contentType: type, upsert: false, cacheControl: "3600" })
        .then(({ error }) => (error ? fail(uploadErrorMessage(error.statusCode ? +error.statusCode : 0, error.message || "")) : done()))
        .catch(() => fail(uploadErrorMessage(0, "")));
      return u;
    }

    const upload = new window.tus.Upload(file, {
      endpoint: `${C.STORAGE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1500, 3000, 6000, 10000, 20000],
      headers: { authorization: `Bearer ${C.SUPABASE_ANON_KEY}`, apikey: C.SUPABASE_ANON_KEY, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: false,
      chunkSize: 6 * MB, // Supabase requires exactly 6 MB chunks
      metadata: { bucketName: C.BUCKET, objectName: path, contentType: type, cacheControl: "3600" },
      onProgress: (sent, total) => progress((sent / total) * 100),
      onSuccess: done,
      onShouldRetry: (err) => {
        const s = err?.originalResponse?.getStatus?.();
        return !s || s === 409 || s === 423 || s >= 500;
      },
      onError: (err) => {
        const res = err?.originalResponse;
        fail(uploadErrorMessage(res?.getStatus?.() || 0, res?.getBody?.() || String(err?.message || "")));
      },
    });
    u.tus = upload;
    upload.start();
    return u;
  }

  function retryUpload(slot) {
    const u = U[slot];
    if (!u || !u.file) return;
    const { file, meta } = u;
    const keepUrl = u.objectUrl;
    u.objectUrl = null; // keep preview alive across restart
    startUpload(slot, file, { ...meta, objectUrl: keepUrl });
  }

  const anyUploading = () => Object.values(U).some((u) => u.status === "uploading");
  window.addEventListener("beforeunload", (e) => {
    if (anyUploading()) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---------- video probing / validation ----------
  function probeVideo(url) {
    return new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata"; v.muted = true; v.playsInline = true;
      let settled = false;
      const finish = (r) => { if (!settled) { settled = true; v.removeAttribute("src"); v.load(); resolve(r); } };
      v.onloadedmetadata = () => finish({ playable: true, duration: isFinite(v.duration) ? v.duration : null });
      v.onerror = () => finish({ playable: false, duration: null });
      setTimeout(() => finish({ playable: false, duration: null }), 5000);
      v.src = url;
    });
  }

  async function validateVideo(file) {
    const looksVideo = /^video\//i.test(file.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name || "");
    if (!looksVideo) return { error: "That file isn't a video. Choose an .mp4 or .mov file." };
    if (file.size > C.MAX_VIDEO_MB * MB) return { error: `That video is ${fmtMB(file.size)} — the limit is ${C.MAX_VIDEO_MB} MB. Trim it, or record here in the browser instead.` };
    if (file.size < 2000) return { error: "That file looks empty. Try choosing it again." };
    const url = URL.createObjectURL(file);
    const meta = await probeVideo(url);
    if (meta.duration && meta.duration > C.MAX_SECONDS + 1.5) {
      URL.revokeObjectURL(url);
      return { error: `That video runs ${fmtTime(meta.duration)}. Answers max out at ${fmtTime(C.MAX_SECONDS)} — trim it and upload again.` };
    }
    return { url, duration: meta.duration, playable: meta.playable };
  }

  // ---------- recorder ----------
  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (_) { return false; } }) || "";
  }
  // Make the black frame match the video's real shape (no cropping, no zoom illusion).
  function fitStage(videoEl) {
    const stage = videoEl.closest(".stage");
    if (!stage || !videoEl.videoWidth || !videoEl.videoHeight) return;
    stage.style.aspectRatio = `${videoEl.videoWidth} / ${videoEl.videoHeight}`;
  }
  const canRecord = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  class Recorder {
    constructor(video) { this.video = video; this.stream = null; this.facing = "user"; this.rec = null; }
    async open(facing = this.facing) {
      this.closeStream();
      this.facing = facing;
      // No width/height constraints: the phone then uses its normal field of view
      // instead of cropping into the sensor, which is what made faces look too close.
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, frameRate: { ideal: 30, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const track = this.stream.getVideoTracks()[0];
      try {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.zoom && typeof caps.zoom.min === "number") {
          await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] });
        }
      } catch (_) {}
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.classList.toggle("mirror", facing === "user");
      try { await this.video.play(); } catch (_) {}
      // Shape the frame to the camera, so nothing is cropped out of view.
      const fit = () => { if (this.video.videoWidth) fitStage(this.video); };
      this.video.onloadedmetadata = fit; fit();
    }
    async cameraCount() {
      try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput").length; } catch (_) { return 1; }
    }
    start() {
      const mime = pickMime();
      const opts = { videoBitsPerSecond: C.RECORD_BITRATE, audioBitsPerSecond: 128000 };
      if (mime) opts.mimeType = mime;
      try { this.rec = new MediaRecorder(this.stream, opts); }
      catch (_) { this.rec = new MediaRecorder(this.stream); }
      this.chunks = [];
      this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.t0 = performance.now();
      this.rec.start(1000);
    }
    elapsed() { return this.rec ? (performance.now() - this.t0) / 1000 : 0; }
    stop() {
      return new Promise((resolve) => {
        const rec = this.rec;
        if (!rec || rec.state === "inactive") return resolve(null);
        const duration = this.elapsed();
        rec.onstop = () => {
          const type = (rec.mimeType || this.chunks[0]?.type || "video/webm").split(";")[0];
          const blob = new Blob(this.chunks, { type });
          this.rec = null;
          resolve({ blob, type, duration });
        };
        try { rec.requestData(); } catch (_) {}
        rec.stop();
      });
    }
    closeStream() {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      if (this.video) this.video.srcObject = null;
    }
    destroy() {
      try { if (this.rec && this.rec.state !== "inactive") this.rec.stop(); } catch (_) {}
      this.rec = null;
      this.closeStream();
    }
  }

  // ---------- navigation ----------
  let cleanup = null;
  const main = $("#main");
  const ORDER = ["landing", "tips", "q0", "q1", "q2", "drop", "about", "release", "success"];

  function go(step, push = true) {
    if (cleanup) { try { cleanup(); } catch (_) {} cleanup = null; }
    listeners.clear();
    S.step = step; save();
    if (push) history.pushState({ step }, "", location.href);
    render();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
  window.addEventListener("popstate", (e) => {
    const step = e.state?.step;
    if (!step) return;
    if (S.result && step !== "success") { history.pushState({ step: "success" }, "", location.href); return; }
    go(step, false);
  });

  function chrome(step) {
    const idx = SEGMENTS.indexOf(step);
    const seg = $("#segments");
    seg.hidden = idx < 0;
    seg.innerHTML = SEGMENTS.map((s, i) => `<span class="${i < idx ? "done" : i === idx ? "now" : ""}"></span>`).join("");
    const back = $("#back");
    const pos = ORDER.indexOf(step);
    back.hidden = !(pos > 0 && step !== "success");
    back.onclick = () => history.length > 1 && history.state?.step ? history.back() : go(ORDER[pos - 1]);
  }

  function toast(msg, ms = 3200) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function render() {
    const step = S.step;
    chrome(step);
    const fn = {
      landing: screenLanding, tips: screenTips, q0: () => screenQuestion(0), q1: () => screenQuestion(1), q2: () => screenQuestion(2),
      drop: screenDrop, about: screenAbout, release: screenRelease, success: screenSuccess,
    }[step] || screenLanding;
    fn();
  }

  // ---------- screens ----------
  function screenState(title, body, extra = "") {
    chrome("none");
    main.innerHTML = `<section class="screen"><div class="state">
      <p class="eyebrow">Leader Drops</p>
      <h1 class="headline" style="margin-top:14px">${title}</h1>
      <p class="lede">${body}</p>${extra}
    </div></section>`;
  }

  function screenLanding() {
    const name = firstName(INVITE_DATA?.leader_name);
    main.innerHTML = `
      <section class="screen">
        <div class="brand-lockup" aria-label="LaunchPad EIC Leader Drops">
          <div class="l1">LAUNCHPAD EIC</div>
          <div class="l2">LEADER<br><em>DROPS</em></div>
        </div>
        ${name ? `<p class="welcome">${esc(name)}, welcome to your Leader Drop.</p>` : ""}
        <h1 class="headline">Your experience could change someone’s next move.</h1>
        <p class="lede">Three questions. Five minutes. No meetings, scheduling, or prep. Just the career lessons you think the next generation should hear.</p>
        <div class="promise">
          <div><strong>3 QUESTIONS</strong><span>Personalized for you</span></div>
          <div><strong>~5 MINUTES</strong><span>Record whenever you want</span></div>
          <div><strong>ZERO MEETINGS</strong><span>No scheduling required</span></div>
        </div>
        <div class="footer-cta">
          <button class="btn btn-primary btn-block" id="start" type="button">${hasProgress() ? "Pick Up Where I Left Off" : "Start My Leader Drop"} <span class="arrow">→</span></button>
          <p class="small center" style="margin:0">Record from your phone or computer. Retakes are always allowed.</p>
        </div>
      </section>`;
    $("#start").onclick = () => { markStarted(); go(hasProgress() ? resumeStep() : "tips"); };
  }
  function hasProgress() { return S.answers.some(Boolean) || !!S.drop.text || !!S.drop.video || !!S.about.bio || !!S.about.headshot; }
  let startedSent = false;
  function markStarted() {
    if (DEMO || startedSent || !sb || !INVITE) return;
    startedSent = true;
    sb.rpc("ld_mark_started", { p_invite: INVITE }).then(() => {}, () => {});
  }
  function resumeStep() {
    for (let i = 0; i < 3; i++) if (!S.answers[i]) return "q" + i;
    if (!S.drop.text && !S.drop.video) return "drop";
    if (!aboutValid()) return "about";
    return "release";
  }

  function screenTips() {
    const tips = [
      [ICON.clock, "30–90 seconds per answer", "Two minutes max. Shorter usually lands harder."],
      [ICON.phone, "Vertical video preferred", "Hold your phone upright, like a Story."],
      [ICON.mute, "Find somewhere reasonably quiet", "Your office, your car, a hallway — all fine."],
      [ICON.eye, "Look at the camera", "Talk to one person, not an audience."],
      [ICON.spark, "Don’t worry about being perfect", "Pauses and restarts are human. Retakes are unlimited."],
      [ICON.book, "Stories > generic advice", "One real moment beats five principles."],
    ];
    main.innerHTML = `
      <section class="screen">
        <p class="eyebrow" style="margin-top:18px">Before you record</p>
        <h1 class="display" style="font-size:clamp(56px,17vw,92px);margin:14px 0 16px">Keep it<br>real.</h1>
        <p class="lede">This isn’t a polished interview. Imagine an ambitious person early in their career asked you this question over coffee. Give them the answer you’d actually tell them.</p>
        <ul class="tips">
          ${tips.map(([i, t, s]) => `<li>${i}<div>${t}<span class="sub">${s}</span></div></li>`).join("")}
        </ul>
        <div class="footer-cta">
          <button class="btn btn-primary btn-block" id="ready" type="button">I’m Ready <span class="arrow">→</span></button>
        </div>
      </section>`;
    $("#ready").onclick = () => go("q0");
  }

  /* Capture widget: record / upload / review for one slot. Used by questions and One Drop. */
  function mountCapture(root, slot, { onUse, useLabel = "Use This Answer" }) {
    let rec = null;
    let mode = null; // choose | camera | blocked | review
    let tickTimer = null;
    let countdownTimer = null;
    let signedUrl = null;

    const fileInput = document.createElement("input");
    fileInput.type = "file"; fileInput.accept = "video/mp4,video/quicktime,video/webm,video/x-m4v,video/*,.mp4,.mov,.m4v,.webm";
    fileInput.hidden = true; fileInput.id = `file-${slot}`;
    const nativeCam = document.createElement("input");
    nativeCam.type = "file"; nativeCam.accept = "video/*"; nativeCam.setAttribute("capture", "user");
    nativeCam.hidden = true; nativeCam.id = `cam-${slot}`;
    root.after(fileInput, nativeCam);

    const pick = async (file, source) => {
      if (!file) return;
      const v = await validateVideo(file);
      if (v.error) { showChoose(v.error); return; }
      startUpload(slot, file, { duration: v.duration, source, objectUrl: v.url, playable: v.playable, previewName: file.name });
      showReview();
    };
    fileInput.onchange = () => { const f = fileInput.files[0]; fileInput.value = ""; pick(f, "upload"); };
    nativeCam.onchange = () => { const f = nativeCam.files[0]; nativeCam.value = ""; pick(f, "camera"); };

    function stopTimers() { clearInterval(tickTimer); clearInterval(countdownTimer); tickTimer = countdownTimer = null; }
    function teardownCamera() { stopTimers(); if (rec) { rec.destroy(); rec = null; } }

    function showChoose(error) {
      teardownCamera(); mode = "choose";
      root.innerHTML = `
        <div class="capture-choices">
          <button class="choice rec" type="button" data-act="record">
            <span class="ico"><i></i></span>
            <span><b>Record video</b><small>Right here, up to 2 min</small></span>
          </button>
          <button class="choice" type="button" data-act="upload">
            <span class="ico">${ICON.upload}</span>
            <span><b>Upload video</b><small>.mp4 or .mov from your device</small></span>
          </button>
        </div>
        ${error ? `<div class="notice err" role="alert">${esc(error)}</div>` : ""}`;
      root.querySelector('[data-act="record"]').onclick = () => (canRecord() ? showCamera() : showBlocked("Your browser can’t record video here."));
      root.querySelector('[data-act="upload"]').onclick = () => fileInput.click();
    }

    function showBlocked(reason) {
      teardownCamera(); mode = "blocked";
      root.innerHTML = `
        <div class="notice" role="alert"><strong>${esc(reason)}</strong><br>No problem — upload a video instead${isTouch ? ", or record one with your phone’s camera app" : ""}.</div>
        <div style="display:grid;gap:10px;margin-top:14px">
          <button class="btn btn-primary btn-block" type="button" data-act="upload">${ICON.upload.replace("<svg", '<svg style="width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2"')} Upload Video</button>
          ${isTouch ? `<button class="btn btn-ghost btn-block" type="button" data-act="native">Open Camera App</button>` : ""}
          <button class="btn btn-text" type="button" data-act="retry">Try the in-browser camera again</button>
        </div>
        <p class="small" style="margin-top:8px">To allow camera access later: tap the <strong>aA</strong> or lock icon in your address bar → allow Camera and Microphone.</p>`;
      root.querySelector('[data-act="upload"]').onclick = () => fileInput.click();
      root.querySelector('[data-act="native"]')?.addEventListener("click", () => nativeCam.click());
      root.querySelector('[data-act="retry"]').onclick = () => showCamera();
    }

    async function showCamera() {
      teardownCamera(); mode = "camera";
      root.innerHTML = `
        <div class="stage">
          <video playsinline autoplay muted class="mirror" aria-label="Camera preview"></video>
          <div class="overlay-top">
            <button class="icon-btn" type="button" data-act="cancel" aria-label="Close camera">${ICON.close}</button>
            <span class="pill" data-el="timer" hidden><span class="dot"></span><span data-el="t">0:00</span> / ${fmtTime(C.MAX_SECONDS)}</span>
            <button class="icon-btn" type="button" data-act="flip" aria-label="Switch camera" hidden>${ICON.flip}</button>
          </div>
          <div class="countdown" data-el="count" hidden></div>
          <div class="no-preview" data-el="loading"><div><div class="spinner" style="margin:0 auto 12px"></div>Opening camera…</div></div>
          <div class="time-bar"><i data-el="bar"></i></div>
        </div>
        <div class="stage-controls">
          <div class="side-ctl"></div>
          <button class="shutter" type="button" data-act="shutter" aria-label="Start recording" disabled><i></i></button>
          <div class="side-ctl"><button class="btn btn-text" type="button" data-act="upload" style="padding:0">Upload</button></div>
        </div>
        <p class="cap-hint" data-el="hint">Tap the red button. You’ll get a 3-second countdown.</p>`;
      const video = root.querySelector("video");
      const el = (n) => root.querySelector(`[data-el="${n}"]`);
      const shutter = root.querySelector('[data-act="shutter"]');
      const flip = root.querySelector('[data-act="flip"]');
      root.querySelector('[data-act="cancel"]').onclick = () => showChoose();
      root.querySelector('[data-act="upload"]').onclick = () => { teardownCamera(); fileInput.click(); showChoose(); };

      rec = new Recorder(video);
      const thisRec = rec;
      try {
        await rec.open("user");
      } catch (err) {
        if (rec !== thisRec) return;
        const name = err && err.name;
        const reason = name === "NotAllowedError" || name === "SecurityError" ? "Camera access was blocked."
          : name === "NotFoundError" || name === "OverconstrainedError" ? "We couldn’t find a camera on this device."
          : name === "NotReadableError" ? "Your camera is being used by another app."
          : "We couldn’t open your camera.";
        showBlocked(reason);
        return;
      }
      if (rec !== thisRec) return;
      el("loading").hidden = true;
      shutter.disabled = false;
      if ((await rec.cameraCount()) > 1) flip.hidden = false;

      flip.onclick = async () => {
        if (rec?.rec) return;
        flip.disabled = true;
        try { await rec.open(rec.facing === "user" ? "environment" : "user"); } catch (_) { toast("Couldn’t switch cameras."); }
        flip.disabled = false;
      };

      let recording = false;
      shutter.onclick = async () => {
        if (!recording && !countdownTimer) {
          // countdown
          shutter.disabled = true; flip.hidden = true;
          el("hint").textContent = "Get ready…";
          let n = 3;
          const c = el("count");
          c.hidden = false; c.innerHTML = `<span>${n}</span>`;
          countdownTimer = setInterval(() => {
            n -= 1;
            if (n > 0) { c.innerHTML = `<span>${n}</span>`; return; }
            clearInterval(countdownTimer); countdownTimer = null;
            c.hidden = true;
            try { rec.start(); } catch (e) { showBlocked("Recording isn’t supported in this browser."); return; }
            recording = true;
            shutter.disabled = false;
            shutter.classList.add("recording");
            shutter.setAttribute("aria-label", "Stop recording");
            el("timer").hidden = false;
            el("hint").textContent = "Recording — tap the square when you’re done.";
            tickTimer = setInterval(() => {
              const s = rec.elapsed();
              el("t").textContent = fmtTime(s);
              el("bar").style.width = Math.min(100, (s / C.MAX_SECONDS) * 100) + "%";
              if (s >= C.MAX_SECONDS) finish(true);
              else if (s >= C.MAX_SECONDS - 15) el("hint").textContent = `Wrap it up — ${Math.ceil(C.MAX_SECONDS - s)}s left.`;
            }, 250);
          }, 900);
        } else if (recording) {
          if (rec.elapsed() < 2) { toast("Keep going — that was under 2 seconds."); return; }
          finish(false);
        }
      };

      async function finish(auto) {
        if (!recording) return;
        recording = false;
        stopTimers();
        shutter.disabled = true;
        const out = await rec.stop();
        teardownCamera();
        if (!out || !out.blob.size) { showChoose("That recording came out empty. Try again, or upload a video."); return; }
        const ext = EXT[out.type] || "webm";
        const file = new File([out.blob], `${slot}.${ext}`, { type: out.type });
        if (auto) toast("Hit the 2-minute mark — recording saved.");
        startUpload(slot, file, { duration: Math.min(out.duration, C.MAX_SECONDS), source: "record", objectUrl: URL.createObjectURL(file), playable: true });
        showReview();
      }
    }

    async function showReview() {
      teardownCamera(); mode = "review";
      const u = U[slot];
      const saved = slotSaved(slot);
      let src = u?.objectUrl || signedUrl;
      const playable = u ? u.meta.playable !== false : true;
      root.innerHTML = `
        <div class="stage">
          ${src && playable ? `<video playsinline controls preload="metadata" class="contain" src="${esc(src)}" aria-label="Your answer"></video>
             <button class="play-ov" type="button" data-act="play" aria-label="Play your answer"><span></span></button>`
            : `<div class="no-preview"><div><b>${saved ? "Answer saved" : "Video selected"}</b>${
                u && !playable ? "This browser can’t preview this file, but it will upload fine." : saved ? "Loading preview…" : ""}</div></div>`}
          <div class="overlay-top">
            <span class="pill">${esc(fmtTime(u?.meta.duration || saved?.duration || 0))}${(u?.meta.duration || saved?.duration) ? "" : ""}</span>
          </div>
        </div>
        <p class="cap-hint" data-el="watch">${src && playable ? "Watch it back before you decide." : ""}</p>
        <div class="upload" data-el="up" aria-live="polite"></div>
        <div class="row-2" style="margin-top:14px">
          <button class="btn btn-ghost" type="button" data-act="retake">Retake</button>
          <button class="btn btn-primary" type="button" data-act="use">${esc(useLabel)} <span class="arrow">→</span></button>
        </div>`;
      const pill = root.querySelector(".pill");
      if (!(u?.meta.duration || saved?.duration)) pill.hidden = true;

      const v = root.querySelector("video");
      const playBtn = root.querySelector('[data-act="play"]');
      if (v && playBtn) {
        playBtn.onclick = () => { v.play().catch(() => {}); };
        v.onplay = () => { playBtn.hidden = true; root.querySelector('[data-el="watch"]').textContent = ""; };
        v.onpause = () => { playBtn.hidden = false; };
        v.onended = () => { playBtn.hidden = false; };
        v.onloadedmetadata = () => {
          fitStage(v);
          // Browser recordings report an unknown length until the file is scrubbed once.
          if (!isFinite(v.duration) || v.duration === 0) {
            v.currentTime = 1e6;
            v.ontimeupdate = () => { v.ontimeupdate = null; v.currentTime = 0; };
          }
        };
      }
      root.querySelector('[data-act="retake"]').onclick = () => { signedUrl = null; clearSlot(slot); showChoose(); };
      root.querySelector('[data-act="use"]').onclick = () => {
        const cur = U[slot];
        if (cur && cur.status === "error") { toast("That upload failed — tap Retry first."); return; }
        onUse();
      };
      paintUpload();

      // After a refresh the local file is gone — fetch a short-lived preview link.
      if (!src && saved && !DEMO && sb) {
        const { data } = await sb.storage.from(C.BUCKET).createSignedUrl(saved.path, 3600);
        if (data?.signedUrl && mode === "review" && slotSaved(slot) === saved) { signedUrl = data.signedUrl; showReview(); }
        else if (mode === "review") { const np = root.querySelector(".no-preview div"); if (np) np.innerHTML = "<b>Answer saved</b>Preview unavailable, but your video is safely uploaded."; }
      } else if (!src && saved && DEMO) {
        const np = root.querySelector(".no-preview div"); if (np) np.innerHTML = "<b>Answer saved</b>Your video is safely uploaded.";
      }
    }

    function paintUpload() {
      const box = root.querySelector('[data-el="up"]');
      if (!box) return;
      const u = U[slot];
      const saved = slotSaved(slot);
      const status = u ? u.status : saved ? "done" : "none";
      const size = u?.file?.size || saved?.size || 0;
      box.className = `upload ${status}`;
      if (status === "uploading") {
        box.innerHTML = `<div class="upload-row"><span>Uploading securely…</span><span class="num">${Math.floor(u.pct)}%${size ? " · " + fmtMB(size) : ""}</span></div>
          <div class="bar"><i style="width:${u.pct}%"></i></div>
          <span class="small">You can keep going — this finishes in the background. Keep this tab open.</span>`;
      } else if (status === "done") {
        box.innerHTML = `<div class="upload-row"><span class="state-ok">✓ Uploaded</span><span class="num">${size ? fmtMB(size) : ""}</span></div><div class="bar"><i style="width:100%"></i></div>`;
      } else if (status === "error") {
        box.innerHTML = `<div class="upload-row"><span class="state-err">Upload failed</span><button class="btn btn-text" type="button" data-act="retry" style="min-height:0;padding:0;color:var(--violet-hi)">Retry</button></div>
          <div class="bar"><i style="width:${u.pct}%"></i></div><span class="small">${esc(u.error)}</span>`;
        box.querySelector('[data-act="retry"]').onclick = () => retryUpload(slot);
      } else {
        box.hidden = true;
      }
    }

    const onChange = (s) => { if (s === slot && mode === "review") paintUpload(); };
    listeners.add(onChange);

    if (U[slot] || slotSaved(slot)) showReview(); else showChoose();

    return () => { teardownCamera(); fileInput.remove(); nativeCam.remove(); };
  }

  function screenQuestion(i) {
    const q = (INVITE_DATA?.questions || DEFAULT_QUESTIONS)[i];
    const next = i < 2 ? "q" + (i + 1) : "drop";
    main.innerHTML = `
      <section class="screen">
        <p class="eyebrow" style="margin-top:10px">Leader Drop <span class="dim">/</span> <span>Question ${i + 1} of 3</span></p>
        <h1 class="question">“${esc(q)}”</h1>
        <p class="hint">${esc(HINTS[i])}</p>
        <div id="capture"></div>
      </section>`;
    cleanup = mountCapture($("#capture"), "q" + i, { onUse: () => go(next), useLabel: "Use This Answer" });
  }

  function screenDrop() {
    const mode = S.drop.mode;
    main.innerHTML = `
      <section class="screen">
        <p class="eyebrow" style="margin-top:10px">Signature question</p>
        <h1 class="one-last">One last<br><span>thing…</span></h1>
        <h2 class="question" style="margin-top:6px">What is your ONE DROP of advice?</h2>
        <p class="hint">Give us the one sentence you want an early-career professional to remember.</p>
        <div class="seg-toggle" role="group" aria-label="Answer format">
          <button type="button" data-mode="text" aria-pressed="${mode === "text"}">Type it</button>
          <button type="button" data-mode="video" aria-pressed="${mode === "video"}">Say it on video</button>
        </div>
        <div id="dropBody"></div>
        <div class="footer-cta" id="dropCta"></div>
      </section>`;
    main.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => {
      if (S.drop.mode === b.dataset.mode) return;
      S.drop.mode = b.dataset.mode; save(); go("drop", false);
    }));

    const body = $("#dropBody");
    const cta = $("#dropCta");
    if (mode === "text") {
      body.innerHTML = `
        <div class="drop-text">
          <label for="dropText" class="sr-only">Your one drop of advice</label>
          <textarea id="dropText" maxlength="200" placeholder="e.g. Nobody is thinking about your career as much as you are — act like it.">${esc(S.drop.text)}</textarea>
          <span class="counter" id="dropCount">0/200</span>
        </div>`;
      cta.innerHTML = `<button class="btn btn-primary btn-block" id="dropNext" type="button">Continue <span class="arrow">→</span></button>`;
      const ta = $("#dropText"), cnt = $("#dropCount"), btn = $("#dropNext");
      const sync = () => { cnt.textContent = `${ta.value.length}/200`; btn.disabled = ta.value.trim().length < 3; };
      ta.oninput = () => { S.drop.text = ta.value; save(); sync(); };
      sync();
      btn.onclick = () => { S.drop.text = ta.value.trim(); save(); go("about"); };
    } else {
      cleanup = mountCapture(body, "drop", { onUse: () => go("about"), useLabel: "Continue" });
    }
  }

  function aboutValid() {
    const a = S.about;
    return a.name.trim() && a.title.trim() && a.company.trim() && (!a.linkedin.trim() || linkedinOk(a.linkedin));
  }
  function linkedinOk(v) { return /^(https?:\/\/)?([a-z0-9-]+\.)?linkedin\.com\/\S+/i.test(v.trim()); }
  function normLinkedin(v) { v = v.trim(); return v && !/^https?:\/\//i.test(v) ? "https://" + v : v; }

  async function shrinkImage(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.86));
      return blob ? new File([blob], "headshot.jpg", { type: "image/jpeg" }) : file;
    } catch (_) { return file; }
  }

  function screenAbout() {
    const a = S.about;
    const needsDetails = !(a.name.trim() && a.title.trim() && a.company.trim());
    main.innerHTML = `
      <section class="screen">
        <p class="eyebrow" style="margin-top:10px">Almost done</p>
        <h1 class="headline" style="margin-top:12px">Anything to add?</h1>
        <p class="lede">Both of these are optional. Skip straight ahead if you like.</p>

        <p class="intro-label">Here’s how we’ll introduce you</p>
        <div class="lower-third" aria-live="polite">
          <div class="lt-card"><div><div class="lt-name" id="ltName"></div><div class="lt-line" id="ltLine"></div></div></div>
        </div>
        <div class="lt-edit"><button type="button" id="ltToggle">${needsDetails ? "Add your details" : "Correct my details"}</button></div>
        <div class="fields" id="detailFields" ${needsDetails ? "" : "hidden"} style="margin-top:4px">
          <div class="field"><label for="f-name">Full name</label>
            <input class="input" id="f-name" autocomplete="name" required maxlength="120" value="${esc(a.name)}"></div>
          <div class="field"><label for="f-title">Current title</label>
            <input class="input" id="f-title" autocomplete="organization-title" required maxlength="160" value="${esc(a.title)}"></div>
          <div class="field"><label for="f-company">Company / organization</label>
            <input class="input" id="f-company" autocomplete="organization" required maxlength="160" value="${esc(a.company)}"></div>
          <div class="field"><label for="f-linkedin">LinkedIn URL <span class="opt">(optional)</span></label>
            <input class="input" id="f-linkedin" inputmode="url" autocapitalize="off" autocorrect="off" maxlength="300" value="${esc(a.linkedin)}" placeholder="linkedin.com/in/yourname">
            <span class="field-err" id="e-linkedin" hidden>That doesn’t look like a LinkedIn link — it should include linkedin.com/.</span></div>
        </div>

        <div class="fields">
          <div class="field"><label for="f-bio">Short bio <span class="opt">(optional)</span></label>
            <div class="drop-text"><textarea id="f-bio" class="bio" maxlength="600" placeholder="A line or two we can use in the description — what you do and what you care about.">${esc(a.bio)}</textarea>
            <span class="counter" id="bioCount">0/600</span></div></div>
          <div class="field"><span style="font-size:13px;font-weight:700;color:var(--ink-2)">Headshot <span class="opt" style="color:var(--muted);font-weight:500">(optional)</span></span>
            <label class="headshot-pick" for="f-headshot">
              <span class="avatar" id="hsAvatar"></span>
              <span><b id="hsLabel">Add a photo</b><small id="hsSub">Used on the video thumbnail. JPG or PNG.</small></span>
            </label>
            <input type="file" id="f-headshot" accept="image/*" hidden>
          </div>
        </div>

        <div class="footer-cta">
          <button class="btn btn-primary btn-block" id="aboutNext" type="button">Continue <span class="arrow">→</span></button>
        </div>
      </section>`;

    const f = (id) => $("#" + id);
    const paint = () => {
      f("ltName").textContent = a.name.trim() || "Your Name";
      f("ltLine").textContent = [a.title.trim(), a.company.trim()].filter(Boolean).join(" • ") || "Title • Company";
      f("aboutNext").disabled = !aboutValid();
      f("bioCount").textContent = `${a.bio.length}/600`;
      save();
    };
    ["name", "title", "company", "linkedin"].forEach((k) => {
      f("f-" + k).addEventListener("input", (e) => { a[k] = e.target.value; if (k === "linkedin") { f("e-linkedin").hidden = true; e.target.removeAttribute("aria-invalid"); } paint(); });
    });
    f("f-linkedin").addEventListener("blur", (e) => {
      const bad = e.target.value.trim() && !linkedinOk(e.target.value);
      f("e-linkedin").hidden = !bad; e.target.setAttribute("aria-invalid", bad ? "true" : "false");
    });
    f("f-bio").oninput = (e) => { a.bio = e.target.value; paint(); };
    f("ltToggle").onclick = () => {
      const h = f("detailFields"); h.hidden = !h.hidden;
      f("ltToggle").textContent = h.hidden ? "Correct my details" : "Done";
      if (!h.hidden) f("f-name").focus();
    };

    const paintHs = () => {
      const u = U.headshot, saved = a.headshot;
      const av = f("hsAvatar");
      if (u?.objectUrl) av.innerHTML = `<img alt="" src="${esc(u.objectUrl)}">`;
      else av.textContent = saved ? "✓" : (a.name.trim()[0] || "+").toUpperCase();
      if (u?.status === "uploading") { f("hsLabel").textContent = "Uploading photo…"; f("hsSub").textContent = `${Math.floor(u.pct)}%`; }
      else if (u?.status === "error") { f("hsLabel").textContent = "Photo didn’t upload"; f("hsSub").textContent = "Tap to try another photo."; }
      else if (u?.status === "done" || saved) { f("hsLabel").textContent = "Photo added ✓"; f("hsSub").textContent = "Tap to replace it."; }
    };
    f("f-headshot").onchange = async (e) => {
      const file = e.target.files[0]; e.target.value = "";
      if (!file) return;
      if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) { toast("Choose a JPG or PNG photo."); return; }
      if (file.size > C.MAX_HEADSHOT_MB * MB) { toast(`That photo is ${fmtMB(file.size)} — keep it under ${C.MAX_HEADSHOT_MB} MB.`); return; }
      const small = await shrinkImage(file);
      startUpload("headshot", small, { objectUrl: URL.createObjectURL(small), source: "upload" });
      paintHs();
    };
    listeners.add((sl) => { if (sl === "headshot") paintHs(); });
    paintHs();
    paint();

    f("aboutNext").onclick = () => {
      a.linkedin = normLinkedin(a.linkedin); save();
      if (!aboutValid()) { f("detailFields").hidden = false; toast("Add your name, title, and company to continue."); return; }
      go("release");
    };
  }

  function checklist() {
    const items = [0, 1, 2].map((i) => {
      const slot = "q" + i, u = U[slot], saved = S.answers[i];
      const st = u ? u.status : saved ? "done" : "missing";
      return { label: `Question ${i + 1}`, st, step: slot };
    });
    const du = U.drop;
    const dropSt = S.drop.mode === "text"
      ? (S.drop.text.trim().length >= 3 ? "done" : "missing")
      : (du ? du.status : S.drop.video ? "done" : "missing");
    items.push({ label: "One Drop", st: dropSt, step: "drop" });
    if (U.headshot) items.push({ label: "Headshot", st: U.headshot.status, step: "about", optional: true });
    items.push({ label: "Your details", st: aboutValid() ? "done" : "missing", step: "about" });
    if (S.about.bio.trim()) items.push({ label: "Bio", st: "done", step: "about", optional: true });
    return items;
  }

  function screenRelease() {
    main.innerHTML = `
      <section class="screen">
        <p class="eyebrow" style="margin-top:10px">Last step</p>
        <h1 class="headline" style="margin-top:12px">Permission to share</h1>
        <label class="release" for="perm">
          <input type="checkbox" id="perm" ${S.permission ? "checked" : ""}>
          <span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7"/></svg></span>
          <p>${esc(PERMISSION_TEXT)}</p>
        </label>
        <p class="assurance">Your words remain yours. We may shorten videos for clarity or formatting, but we will never intentionally change the meaning of your response.</p>
        <div class="summary" id="summary" aria-live="polite"></div>
        <div id="submitMsg"></div>
        <div class="footer-cta">
          <div class="upload" id="submitProgress" hidden></div>
          <button class="btn btn-primary btn-block" id="submit" type="button">Submit My Leader Drop <span class="arrow">→</span></button>
        </div>
      </section>`;

    const paint = () => {
      const items = checklist();
      $("#summary").innerHTML = items.map((it) => {
        const map = { done: ["ok", "✓ Ready"], uploading: ["pending", `Uploading ${Math.floor(U[it.step === "about" ? "headshot" : it.step]?.pct || 0)}%`], error: ["bad", "Upload failed — fix"], missing: ["bad", "Missing — add"] };
        const [cls, txt] = map[it.st] || map.missing;
        const link = it.st === "error" || it.st === "missing";
        return `<div><span>${it.label}</span><span class="${cls}">${link ? `<a href="#" data-step="${it.step}">${txt}</a>` : txt}</span></div>`;
      }).join("");
      $("#summary").querySelectorAll("[data-step]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); go(a.dataset.step); }));
      const blocked = items.some((it) => (it.st === "missing" || it.st === "error") && !it.optional);
      $("#submit").disabled = !S.permission || blocked || submitting;
    };
    $("#perm").onchange = (e) => { S.permission = e.target.checked; save(); paint(); };
    listeners.add(paint);
    paint();
    $("#submit").onclick = submit;
  }

  let submitting = false;
  async function submit() {
    if (submitting) return;
    submitting = true;
    const btn = $("#submit"), prog = $("#submitProgress"), msg = $("#submitMsg");
    btn.disabled = true; msg.innerHTML = "";
    btn.innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:2px"></span> Finishing uploads…`;
    try {
      // 1) wait for anything still uploading
      const pending = () => Object.entries(U).filter(([, u]) => u.status === "uploading");
      const paintProg = () => {
        const all = Object.values(U).filter((u) => u.status !== "error");
        const total = all.reduce((t, u) => t + (u.file?.size || 1), 0) || 1;
        const sent = all.reduce((t, u) => t + (u.file?.size || 1) * (u.pct / 100), 0);
        const pct = Math.floor((sent / total) * 100);
        prog.hidden = pending().length === 0;
        prog.innerHTML = `<div class="upload-row"><span>Uploading ${pending().length} video${pending().length === 1 ? "" : "s"}…</span><span class="num">${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div><span class="small">Keep this page open.</span>`;
      };
      listeners.add(paintProg); paintProg();
      await Promise.all(pending().map(([, u]) => u.promise));
      listeners.delete(paintProg); prog.hidden = true;
      const failed = checklist().filter((it) => it.st === "error" && !it.optional);
      if (failed.length) throw new Error("An upload failed. Tap “Upload failed — fix” above to retry it.");
      if (U.headshot && U.headshot.status === "error") clearSlot("headshot");

      btn.innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:2px"></span> Submitting…`;
      const a = S.about;
      const payload = {
        name: a.name.trim(), title: a.title.trim(), company: a.company.trim(),
        linkedin: normLinkedin(a.linkedin) || null,
        intro_name: a.name.trim(), intro_line: `${a.title.trim()} • ${a.company.trim()}`,
        bio: a.bio.trim() || null,
        video_1_url: S.answers[0]?.path, video_2_url: S.answers[1]?.path, video_3_url: S.answers[2]?.path,
        one_drop: S.drop.mode === "text" ? S.drop.text.trim() : null,
        one_drop_video_url: S.drop.mode === "video" ? S.drop.video?.path : null,
        headshot_url: a.headshot?.path || null,
        permission_granted: S.permission === true,
        permission_text: PERMISSION_TEXT,
      };
      let result;
      if (DEMO) { await sleep(900); result = { leader_id: "demo", first_name: firstName(a.name) }; }
      else {
        const { data, error } = await sb.rpc("ld_submit", { p_invite: INVITE, p: payload });
        if (error) {
          const m = error.message || "";
          const friendly = {
            already_submitted: "This Leader Drop was already submitted — thank you!",
            permission_required: "Please check the permission box to submit.",
            missing_details: "Add your name, title, and company to submit.",
            bad_linkedin: "That LinkedIn link doesn’t look right. Fix it on the About You step, or clear it.",
            missing_upload: "One of your videos didn’t finish saving. Tap Back, retake the answer that won’t play, then submit again.",
            one_drop_required: "Add your One Drop before submitting.",
            invalid_link: "This link isn’t valid anymore. Email " + C.CONTACT_EMAIL + " and we’ll sort it out.",
            too_long: "One of your answers is too long — shorten it and try again.",
          };
          const key = Object.keys(friendly).find((k) => m.includes(k));
          if (key === "already_submitted") { S.result = { leader_id: null, first_name: firstName(a.name) }; save(); go("success"); return; }
          throw new Error(key ? friendly[key] : "We couldn’t submit just now. Check your connection and try again — your videos are saved.");
        }
        result = data;
      }
      S.result = result; save();
      go("success");
    } catch (err) {
      msg.innerHTML = `<div class="notice err" role="alert">${esc(err.message)}</div>`;
      btn.innerHTML = `Submit My Leader Drop <span class="arrow">→</span>`;
      btn.disabled = !S.permission;
    } finally {
      submitting = false;
    }
  }

  function burst() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = document.createElement("canvas");
    cv.className = "burst"; document.body.appendChild(cv);
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    const colors = ["#8b5cf6", "#b490ff", "#c24bd2", "#5b34e6", "#ffffff"];
    const ps = Array.from({ length: 90 }, () => ({
      x: innerWidth / 2, y: innerHeight * 0.3, vx: (Math.random() - 0.5) * 11, vy: Math.random() * -11 - 2,
      s: Math.random() * 6 + 3, c: colors[(Math.random() * colors.length) | 0], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    }));
    const t0 = performance.now();
    const frame = (t) => {
      const k = (t - t0) / 1600;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach((p) => {
        p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      });
      if (k < 1) requestAnimationFrame(frame); else cv.remove();
    };
    requestAnimationFrame(frame);
  }

  function screenSuccess() {
    const name = S.result?.first_name || firstName(S.about.name);
    main.innerHTML = `
      <section class="screen">
        <div class="success-hero">
          <p class="eyebrow">Leader Drop received</p>
          <h1 class="display" style="margin-top:12px">You<br><span>dropped it.</span> <span aria-hidden="true" style="-webkit-text-fill-color:initial;background:none">🎙️</span></h1>
        </div>
        <p class="lede">Thanks${name ? `, <strong style="color:var(--ink)">${esc(name)}</strong>` : ""}. Your experience is officially headed to the next generation.</p>

        <div class="section" id="mic">
          <p class="eyebrow">Keep it going</p>
          <h2>Pass the mic</h2>
          <p class="lede" style="font-size:16px">Who is one leader whose advice people need to hear?</p>
          <div id="micBody"></div>
        </div>

        <div class="section" id="follow" ${S.nominated ? "" : "hidden"}>
          <h2 style="font-size:22px">Want to see your Drop when it goes live?</h2>
          <div class="follow">
            <a href="${esc(C.LINKS.youtube)}" target="_blank" rel="noopener">${ICON.yt}YouTube</a>
            <a href="${esc(C.LINKS.linkedin)}" target="_blank" rel="noopener">${ICON.li}LinkedIn</a>
            <a href="${esc(C.LINKS.site)}" target="_blank" rel="noopener">${ICON.rocket}LaunchPad EIC</a>
          </div>
        </div>
      </section>`;
    if (!sessionStorage.getItem("ld-burst-" + INVITE)) { try { sessionStorage.setItem("ld-burst-" + INVITE, "1"); } catch (_) {} burst(); }

    const showFollow = () => { $("#follow").hidden = false; };
    const micBody = $("#micBody");
    const paintForm = (done) => {
      if (done) {
        micBody.innerHTML = `<div class="notice ok" style="margin-top:14px">Mic passed to <strong>${esc(done)}</strong>. Thank you.</div>
          <button class="btn btn-text" type="button" id="another" style="padding:0;margin-top:6px">Nominate another leader</button>`;
        $("#another").onclick = () => paintForm();
        return;
      }
      micBody.innerHTML = `
        <form class="fields" id="nomForm" novalidate style="margin-top:16px">
          <div class="field"><label for="n-name">Leader name</label><input class="input" id="n-name" maxlength="120" autocomplete="off" placeholder="Their full name"></div>
          <div class="field"><label for="n-contact">LinkedIn URL or email</label><input class="input" id="n-contact" maxlength="255" autocapitalize="off" autocorrect="off" inputmode="email" placeholder="linkedin.com/in/… or name@company.com"></div>
          <div class="field-err" id="n-err" hidden></div>
          <div class="row-2">
            <button class="btn btn-ghost" type="button" id="skip">Skip</button>
            <button class="btn btn-primary" type="submit" id="nominate">Nominate a Leader</button>
          </div>
        </form>`;
      $("#skip").onclick = () => { S.nominated = true; save(); $("#mic").hidden = true; showFollow(); $("#follow").scrollIntoView({ behavior: "smooth" }); };
      $("#nomForm").onsubmit = async (e) => {
        e.preventDefault();
        const nm = $("#n-name").value.trim(), ct = $("#n-contact").value.trim();
        const err = $("#n-err");
        const validContact = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ct) || linkedinOk(ct);
        if (!nm || !validContact) { err.hidden = false; err.textContent = !nm ? "Add their name." : "Add a LinkedIn URL or an email address."; return; }
        err.hidden = true;
        const b = $("#nominate"); b.disabled = true; b.textContent = "Sending…";
        try {
          if (!DEMO) {
            if (!S.result?.leader_id) throw new Error("x");
            const { error } = await sb.rpc("ld_nominate", { p_invite: INVITE, p_leader: S.result.leader_id, p_name: nm, p_contact: linkedinOk(ct) ? normLinkedin(ct) : ct });
            if (error) throw error;
          } else await sleep(500);
          S.nominated = true; save();
          paintForm(nm); showFollow();
        } catch (_) {
          err.hidden = false; err.textContent = `That didn’t go through. You can also email the name to ${C.CONTACT_EMAIL}.`;
          b.disabled = false; b.textContent = "Nominate a Leader";
        }
      };
    };
    paintForm();
  }

  // ---------- boot ----------
  async function boot() {
    if (DEMO) {
      const f = document.createElement("div"); f.className = "demo-flag"; f.textContent = "Demo mode · nothing is uploaded"; document.body.appendChild(f);
      INVITE_DATA = { leader_name: "Michael Johnson", title: "President", company: "NJII", linkedin: "https://www.linkedin.com/in/example", questions: DEFAULT_QUESTIONS, submitted: false };
    } else {
      if (!UUID_RE.test(CODE) && !CODE_RE.test(CODE)) {
        screenState("This link is missing its code.", `Leader Drops links are personal. Open the exact link you were sent, or email <a href="mailto:${C.CONTACT_EMAIL}">${C.CONTACT_EMAIL}</a> and we’ll send a fresh one.`);
        return;
      }
      main.innerHTML = `<section class="screen"><div class="state" style="display:grid;place-items:center"><div class="spinner"></div></div></section>`;
      let res;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await sb.rpc("ld_get_invite", { p_code: CODE });
        if (!res.error) break;
        await sleep(800 * (attempt + 1));
      }
      if (res.error) {
        screenState("We can’t connect right now.", "Check your connection and refresh this page. Anything you already uploaded is saved.",
          `<div class="footer-cta" style="position:static"><button class="btn btn-primary btn-block" type="button" onclick="location.reload()">Try Again</button></div>`);
        return;
      }
      if (!res.data) {
        screenState("This link isn’t active.", `It may have been mistyped or replaced. Email <a href="mailto:${C.CONTACT_EMAIL}">${C.CONTACT_EMAIL}</a> and we’ll send you a working one.`);
        return;
      }
      INVITE_DATA = res.data;
      INVITE = INVITE_DATA.invite_id;
      if (INVITE_DATA.submitted) {
        if (S.result) { history.replaceState({ step: "success" }, "", location.href); S.step = "success"; render(); return; }
        screenState("Your Leader Drop is already in.", `Thank you — we have your answers. Want to change something? Email <a href="mailto:${C.CONTACT_EMAIL}">${C.CONTACT_EMAIL}</a>.`);
        return;
      }
      if (S.result) { S = fresh(); save(); } // invite reopened by admin
    }
    // Pre-fill details from the invitation (leaders only retype them to correct something).
    if (!S.about.prefilled && INVITE_DATA) {
      Object.assign(S.about, {
        name: INVITE_DATA.leader_name || "", title: INVITE_DATA.title || "",
        company: INVITE_DATA.company || "", linkedin: INVITE_DATA.linkedin || "", prefilled: true,
      });
      save();
    }
    // Refresh safety: only fully uploaded files were persisted, so anything in S is real.
    if (S.result) S.step = "success";
    else if (!ORDER.includes(S.step) || S.step === "success") S.step = "landing";
    // Returning after a refresh: land on the welcome screen with a "pick up" button.
    if (S.step !== "success") S.step = "landing";
    history.replaceState({ step: S.step }, "", location.href);
    render();
  }

  boot();
})();
