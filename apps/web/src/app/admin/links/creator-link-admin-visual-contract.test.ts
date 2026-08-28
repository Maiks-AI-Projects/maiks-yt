import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readLocalSource = (name: string): string => readFileSync(new URL(name, import.meta.url), "utf8");

describe("creator link admin visual contract", () => {
  it("keeps the approved dense master-detail geometry and responsive stack", () => {
    const css = readLocalSource("./creator-link-admin.module.css");

    expect(css).toContain("grid-template-columns: minmax(21rem, 24rem) minmax(27rem, 31rem) minmax(25rem, 1fr);");
    expect(css).toContain("height: calc(100vh - 8.35rem);");
    expect(css).toContain("grid-template-columns: minmax(20rem, 0.85fr) minmax(27rem, 1.15fr);");
    expect(css).toContain("@media (max-width: 1060px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toMatch(/\.workspace \.linkIdentity\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/s);
    expect(css).toMatch(/\.draftPreviewList,\s*\.savedPreviewList\s*\{[^}]*--surface: #0f181c;[^}]*--text: var\(--admin-text\);/s);
    expect(css).not.toContain(".previewFrame iframe");
  });

  it("keeps inventory-only ordering and the split draft/saved preview hierarchy", () => {
    const client = readLocalSource("./creator-link-admin-client.tsx");
    const rules = readLocalSource("./creator-link-admin.rules.ts");

    expect(client).toContain("Links &amp; order");
    expect(client).toContain("Save order");
    expect(client).toContain("Draft preview");
    expect(client).toContain("Local unsaved form state");
    expect(client).toContain("Saved public page");
    expect(client).toContain("Current published /links view");
    expect(client).toContain("Authoritative");
    expect(client).toContain("<CreatorLinkRow link={draftPreview} />");
    expect(client).toContain("savedPublicLinks.map((link) => <CreatorLinkRow key={link.key} link={link} />)");
    expect(client).toContain('window.addEventListener("beforeunload", handleBeforeUnload)');
    expect(client).toContain('method: "DELETE"');
    expect(client).not.toContain("<iframe");
    expect(client).not.toContain("sortOrder");
    expect(rules).toContain("buildPublicCreatorLink(source)");
    expect(rules).toContain("buildPublicCreatorLinkList(links)");
  });

  it("keeps Funding protected and delete confirmation visible in source", () => {
    const client = readLocalSource("./creator-link-admin-client.tsx");
    const rules = readLocalSource("./creator-link-admin.rules.ts");

    expect(client).toContain("Funding is protected");
    expect(client).toContain("Delete draft link?");
    expect(client).toContain("Type <strong>{selected.title}</strong> to confirm.");
    expect(client).toContain("disabled={busy !== null || !deleteEligibility.ok || !deleteConfirmationMatches}");
    expect(rules).toContain('form.key.trim() === "support" || form.purpose === "support"');
    expect(rules).toContain("confirmationTitle === selectedLink.title");
    expect(rules).toContain("Funding is protected and cannot be deleted.");
  });
});
