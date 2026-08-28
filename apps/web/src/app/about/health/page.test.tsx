import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HealthPage from "./page";

describe("/about/health rendered copy", () => {
  it("uses simple factual tumor wording without dramatic replacement qualifiers", () => {
    const markup = renderToStaticMarkup(<HealthPage />);

    expect(markup).toContain("I have a brain tumor, brain damage, and ADHD.");
    expect(markup).not.toMatch(/\b(?:serious|severe|life-threatening|major|incurable) brain tumou?r\b/i);
    expect(markup).not.toMatch(/\bbrain tumou?r (?:is|was|that is|that was) (?:serious|severe|life-threatening|major|incurable)\b/i);
  });
});
