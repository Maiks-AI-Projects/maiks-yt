import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AboutNavigation } from "./about-navigation";

describe("AboutNavigation", () => {
  it("keeps the approved route order", () => {
    const markup = renderToStaticMarkup(<AboutNavigation current="about" />);
    const labels = ["Who I am", "AI and my work", "Medical history", "My history"];
    const positions = labels.map((label) => markup.indexOf(label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(markup).toContain('href="/about/ai"');
  });

  it.each([
    ["about", "/about"],
    ["ai", "/about/ai"],
    ["health", "/about/health"],
    ["history", "/about/history"]
  ] as const)("marks %s as the current route", (current, href) => {
    const markup = renderToStaticMarkup(<AboutNavigation current={current} />);
    const currentAnchor = markup.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0];

    expect(currentAnchor).toContain(`href="${href}"`);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
