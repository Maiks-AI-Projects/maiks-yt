import {
  formatPublicUpdateKind,
  getPublicUpdates,
  getPublicUpdateUrl
} from "../updates/public-update-data";

const siteUrl = "https://maiks.yt";

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");

const createAbsoluteUrl = (path: string): string => new URL(path, siteUrl).toString();

const createChannelXml = ({
  items,
  lastBuildDate
}: {
  items: string;
  lastBuildDate: string;
}): string => [
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  "<rss version=\"2.0\">",
  "  <channel>",
  "    <title>Maiks.yt Updates</title>",
  `    <link>${siteUrl}</link>`,
  "    <description>Posts, stream recaps, and announcements from Maiks.yt.</description>",
  "    <language>en</language>",
  `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
  items,
  "  </channel>",
  "</rss>"
].filter((line) => line.length > 0).join("\n");

export const GET = async (): Promise<Response> => {
  const result = await getPublicUpdates();

  if (result.status === "error") {
    return new Response(
      createChannelXml({ items: "", lastBuildDate: new Date().toUTCString() }),
      {
        status: 503,
        headers: { "content-type": "application/rss+xml; charset=utf-8" }
      }
    );
  }

  const publishedUpdates = result.updates.filter((update) => !update.isExample);
  const items = publishedUpdates.map((update) => {
    const link = createAbsoluteUrl(getPublicUpdateUrl(update));

    return [
      "    <item>",
      `      <title>${escapeXml(update.title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid>${escapeXml(link)}</guid>`,
      `      <pubDate>${new Date(update.publishedAt).toUTCString()}</pubDate>`,
      `      <category>${escapeXml(formatPublicUpdateKind(update.kind))}</category>`,
      `      <description>${escapeXml(update.summary)}</description>`,
      "    </item>"
    ].join("\n");
  }).join("\n");

  const newestPublishedAt = publishedUpdates[0]?.publishedAt;
  const xml = createChannelXml({
    items,
    lastBuildDate: newestPublishedAt
      ? new Date(newestPublishedAt).toUTCString()
      : new Date().toUTCString()
  });

  return new Response(xml, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "application/rss+xml; charset=utf-8"
    }
  });
};
