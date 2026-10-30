/** Pulls the 11-character video ID out of any YouTube link (watch, youtu.be,
 *  shorts, embed, live) or a bare ID. Returns null if it isn't one. */
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      id = m ? m[1] : null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Privacy-friendly embed: no YouTube cookies until play, no unrelated suggestions at the end. */
export function youtubeEmbedUrl(id: string, autoplay = true): string {
  const q = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
  if (autoplay) q.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`;
}
