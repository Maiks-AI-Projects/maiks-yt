import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../links/creator-links-data", () => ({
  getCreatorLinks: vi.fn(async () => ({ status: "loaded", links: [] }))
}));

import ChannelsPage from "./page";

describe("/channels", () => {
  it("links to the MaiksPlays page while its dedicated hostname is being published", async () => {
    const markup = renderToStaticMarkup(await ChannelsPage());

    expect(markup).toContain('href="/plays"');
    expect(markup).toContain("Read why MaiksPlays exists");
  });
});
