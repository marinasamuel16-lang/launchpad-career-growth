import { createServerFn } from "@tanstack/react-start";

export type YoutubeVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
};

const CHANNEL_ID = "UCJevLjcZXvfdphkdEkRnG9A"; // @launchpadeic

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : "";
}

function pickAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"`));
  return m ? m[1] : "";
}

export const getYoutubeVideos = createServerFn({ method: "GET" }).handler(
  async (): Promise<YoutubeVideo[]> => {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
      { headers: { "user-agent": "Mozilla/5.0" } },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1).map((e) => "<entry>" + e);
    return entries.map((entry): YoutubeVideo => {
      const id = pick(entry, "yt:videoId");
      const title = pick(entry, "title");
      const description = pick(pick(entry, "media:group"), "media:description");
      const publishedAt = pick(entry, "published");
      const thumbnail = pickAttr(entry, "media:thumbnail", "url");
      const url = pickAttr(entry, "link", "href");
      return {
        id,
        title,
        description,
        publishedAt,
        thumbnail: thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: url || `https://www.youtube.com/watch?v=${id}`,
      };
    });
  },
);
