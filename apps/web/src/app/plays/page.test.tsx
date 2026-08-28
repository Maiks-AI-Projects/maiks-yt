import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MaiksPlaysPageContent, metadata } from "./page";

describe("MaiksPlays page", () => {
  it("exports production page metadata", () => {
    expect(metadata).toMatchObject({
      title: "MaiksPlays",
      description:
        "A Maiks.yt channel page for the games Michael enjoys that do not fit an existing dedicated channel."
    });
  });

  it("renders the approved copy without making current platform promises", () => {
    const markup = renderToStaticMarkup(<MaiksPlaysPageContent linkSlot={{ status: "unavailable" }} />);

    expect(markup).toContain("Games that do not need their own channel.");
    expect(markup).toContain("MaiksPlays is where I put games I enjoy");
    expect(markup).toContain("Dedicated channels are still active homes");
    expect(markup).toContain("MaiksPlays is not here to replace them.");
    expect(markup).toContain("Later, I may send the same stream");
    expect(markup).toContain("I am not promising that yet.");
    expect(markup).toContain("multiple outgoing streams");
    expect(markup).toContain("Fiber repairs or a second connection may change that");
    expect(markup).not.toContain("Twitch");
    expect(markup).not.toContain("YouTube");
  });

  it("renders verified runtime links and no raw internal fields", () => {
    const markup = renderToStaticMarkup(
      <MaiksPlaysPageContent
        linkSlot={{
          status: "available",
          links: [
            {
              title: "MaiksPlays on Twitch",
              description: "Gaming streams beyond Minecraft.",
              href: "https://www.twitch.tv/maiksplays"
            }
          ]
        }}
      />
    );

    expect(markup).toContain("MaiksPlays on Twitch");
    expect(markup).toContain("Gaming streams beyond Minecraft.");
    expect(markup).toContain('href="https://www.twitch.tv/maiksplays"');
    expect(markup).toContain("Open link");
    expect(markup).not.toContain("raw-internal-id");
    expect(markup).not.toContain("raw-audit-state");
    expect(markup).not.toContain("internalId");
    expect(markup).not.toContain("availabilityNote");
  });

  it("renders finite unavailable copy for absent runtime links", () => {
    const markup = renderToStaticMarkup(<MaiksPlaysPageContent linkSlot={{ status: "unavailable" }} />);

    expect(markup).toContain("MaiksPlays follow links are not available here right now.");
    expect(markup).toContain("I will only show destinations the site can verify.");
    expect(markup).not.toContain("500");
    expect(markup).not.toContain("HTTP");
    expect(markup).not.toContain("exception");
  });
});
