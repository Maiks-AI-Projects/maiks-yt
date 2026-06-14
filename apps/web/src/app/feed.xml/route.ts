import { getPublicUpdateUrl, publicUpdates } from "../../content/public-updates";

const siteUrl = "https://maiks.yt";

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");

const createAbsoluteUrl = (path: string): string => new URL(path, siteUrl).toString();

export const GET = (): Response => {
  const items = publicUpdates
    .map((update) => {
      const link = createAbsoluteUrl(getPublicUpdateUrl(update));

      return [
        "    <item>",
        `      <title>${escapeXml(update.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid>${escapeXml(link)}</guid>`,
        `      <pubDate>${new Date(update.publishedAt).toUTCString()}</pubDate>`,
        `      <category>${escapeXml(update.kind)}</category>`,
        `      <description>${escapeXml(update.summary)}</description>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  const xml = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\">",
    "  <channel>",
    "    <title>Maiks.yt Updates</title>",
    `    <link>${siteUrl}</link>`,
    "    <description>Public updates from Maiks.yt.</description>",
    "    <language>en</language>",
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>"
  ].join("\n");

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8"
    }
  });
};
